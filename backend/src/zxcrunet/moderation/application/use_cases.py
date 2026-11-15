"""Moderation: visitors report sites, the owner decides; every owner action is in the log."""

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from zxcrunet.moderation.domain.report import (
    AuditRecord,
    Decision,
    Report,
    ReportNotFoundError,
    ReportReason,
    ReportStatus,
)
from zxcrunet.moderation.domain.repository import (
    AuditFilter,
    AuditLog,
    ReportFilter,
    ReportRepository,
)
from zxcrunet.shared.application.admin import AuditEntry, AuditTrail, Paging, Slice, Staff
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.rate_limit import RateLimiter, enforce
from zxcrunet.shared.application.uow import UnitOfWork
from zxcrunet.shared.domain.errors import NotFoundError

#: Reports from one address: this many per hour.
REPORTS_PER_HOUR = 5
HOUR = 3600

# --- ports ------------------------------------------------------------------------


class ReportedSites(Protocol):
    """Port to the sites context."""

    async def published_at(self, host: str) -> UUID | None:
        """Id of the published site at this host (free address or custom domain)."""


class SiteSuspender(Protocol):
    """Port to the sites context: take a site down (it logs its own audit entry)."""

    async def suspend(self, staff: Staff, site_id: UUID, reason: str) -> None: ...


# --- public -----------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class NewReport:
    host: str
    path: str
    reason: ReportReason
    message: str
    ip: str


class SubmitReport:
    """«Пожаловаться» on a published site. Anonymous, rate limited by address."""

    def __init__(
        self,
        reports: ReportRepository,
        sites: ReportedSites,
        uow: UnitOfWork,
        clock: Clock,
        limiter: RateLimiter,
    ) -> None:
        self.reports = reports
        self.sites = sites
        self.uow = uow
        self.clock = clock
        self.limiter = limiter

    async def __call__(self, cmd: NewReport) -> Report:
        await enforce(
            self.limiter, f"reports:ip:{cmd.ip}", limit=REPORTS_PER_HOUR, window_seconds=HOUR
        )
        host = cmd.host.strip().lower().rstrip(".").split(":")[0]
        site_id = await self.sites.published_at(host)
        if site_id is None:
            raise NotFoundError("Site not found")
        report = Report.submit(site_id, host, cmd.path, cmd.reason, cmd.message, self.clock.now())
        await self.reports.add(report)
        await self.uow.commit()
        return report


# --- owner ------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class ReportQueue:
    reports: Slice[Report]
    counts: dict[ReportStatus, int]


class ListReports:
    def __init__(self, reports: ReportRepository) -> None:
        self.reports = reports

    async def __call__(self, _: Staff, where: ReportFilter, paging: Paging) -> ReportQueue:
        items, total = await self.reports.search(where, paging.offset, paging.limit)
        return ReportQueue(Slice(items, total), await self.reports.count_by_status())


class DecideReport:
    """Dismiss a report, or suspend the site: then every open report on it is resolved."""

    def __init__(
        self,
        reports: ReportRepository,
        suspender: SiteSuspender,
        uow: UnitOfWork,
        clock: Clock,
        audit: AuditTrail,
    ) -> None:
        self.reports = reports
        self.suspender = suspender
        self.uow = uow
        self.clock = clock
        self.audit = audit

    async def __call__(
        self, staff: Staff, report_id: UUID, decision: Decision, note: str
    ) -> list[Report]:
        report = await self.reports.get(report_id)
        if report is None:
            raise ReportNotFoundError("Report not found")
        now = self.clock.now()
        report.decide(decision, staff.user_id, note, now)
        decided = [report]
        if decision == Decision.SUSPEND:
            # The sites context commits the suspension and logs it on its own.
            await self.suspender.suspend(staff, report.site_id, note or report.reason.value)
            for other in await self.reports.open_for_site(report.site_id):
                if other.id != report.id:
                    other.decide(decision, staff.user_id, note, now)
                    decided.append(other)
        for item in decided:
            await self.reports.save(item)
            await self.audit.record(
                AuditEntry(
                    actor_id=staff.user_id,
                    action=f"report.{item.status.value}",
                    target_type="report",
                    target_id=str(item.id),
                    at=now,
                    details={
                        "site_id": str(item.site_id),
                        "host": item.host,
                        "reason": item.reason.value,
                        "note": item.note,
                    },
                )
            )
        await self.uow.commit()
        return decided


class ListAuditLog:
    def __init__(self, log: AuditLog) -> None:
        self.log = log

    async def __call__(self, _: Staff, where: AuditFilter, paging: Paging) -> Slice[AuditRecord]:
        items, total = await self.log.search(where, paging.offset, paging.limit)
        return Slice(items, total)


class OpenReports:
    """For the dashboard: how many reports wait for a decision."""

    def __init__(self, reports: ReportRepository) -> None:
        self.reports = reports

    async def __call__(self) -> int:
        return (await self.reports.count_by_status()).get(ReportStatus.OPEN, 0)
