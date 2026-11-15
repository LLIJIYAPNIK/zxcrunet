from uuid import UUID

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.moderation.domain.report import (
    AuditRecord,
    Report,
    ReportReason,
    ReportStatus,
)
from zxcrunet.moderation.domain.repository import AuditFilter, ReportFilter
from zxcrunet.moderation.infrastructure.models import AuditLogModel, ReportModel
from zxcrunet.shared.application.admin import AuditEntry
from zxcrunet.shared.domain.ids import uuid7


def _report(row: ReportModel) -> Report:
    return Report(
        id=row.id,
        site_id=row.site_id,
        host=row.host,
        path=row.path,
        reason=ReportReason(row.reason),
        message=row.message,
        created_at=row.created_at,
        status=ReportStatus(row.status),
        decided_at=row.decided_at,
        decided_by=row.decided_by,
        note=row.note,
    )


def _apply(row: ReportModel, report: Report) -> None:
    row.site_id = report.site_id
    row.host = report.host
    row.path = report.path
    row.reason = report.reason.value
    row.message = report.message
    row.created_at = report.created_at
    row.status = report.status.value
    row.decided_at = report.decided_at
    row.decided_by = report.decided_by
    row.note = report.note


class SqlReportRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, report_id: UUID) -> Report | None:
        row = await self._session.get(ReportModel, report_id)
        return _report(row) if row else None

    async def search(
        self, where: ReportFilter, offset: int, limit: int
    ) -> tuple[list[Report], int]:
        conditions: list[ColumnElement[bool]] = []
        if where.status:
            conditions.append(ReportModel.status == where.status.value)
        if where.site_id:
            conditions.append(ReportModel.site_id == where.site_id)
        total = await self._session.scalar(
            select(func.count()).select_from(ReportModel).where(*conditions)
        )
        # The open queue is worked oldest first; history is read newest first.
        order = (
            ReportModel.created_at.asc()
            if where.status == ReportStatus.OPEN
            else ReportModel.created_at.desc()
        )
        rows = await self._session.scalars(
            select(ReportModel).where(*conditions).order_by(order).offset(offset).limit(limit)
        )
        return [_report(r) for r in rows], int(total or 0)

    async def open_for_site(self, site_id: UUID) -> list[Report]:
        rows = await self._session.scalars(
            select(ReportModel).where(
                ReportModel.site_id == site_id, ReportModel.status == ReportStatus.OPEN.value
            )
        )
        return [_report(r) for r in rows]

    async def count_by_status(self) -> dict[ReportStatus, int]:
        rows = await self._session.execute(
            select(ReportModel.status, func.count()).group_by(ReportModel.status)
        )
        return {ReportStatus(row[0]): int(row[1]) for row in rows}

    async def add(self, report: Report) -> None:
        row = ReportModel(id=report.id)
        _apply(row, report)
        self._session.add(row)
        await self._session.flush()

    async def save(self, report: Report) -> None:
        row = await self._session.get(ReportModel, report.id)
        if row is None:
            msg = f"Report {report.id} does not exist"
            raise LookupError(msg)
        _apply(row, report)
        await self._session.flush()


def _record(row: AuditLogModel) -> AuditRecord:
    return AuditRecord(
        id=row.id,
        actor_id=row.actor_id,
        action=row.action,
        target_type=row.target_type,
        target_id=row.target_id,
        at=row.at,
        details=dict(row.details),
    )


class SqlAuditLog:
    """The audit log. As an AuditTrail it adds rows to the use case's own transaction."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, record: AuditRecord) -> None:
        self._session.add(
            AuditLogModel(
                id=record.id,
                actor_id=record.actor_id,
                action=record.action,
                target_type=record.target_type,
                target_id=record.target_id,
                at=record.at,
                details=record.details,
            )
        )
        await self._session.flush()

    async def record(self, entry: AuditEntry) -> None:
        await self.add(
            AuditRecord(
                id=uuid7(),
                actor_id=entry.actor_id,
                action=entry.action,
                target_type=entry.target_type,
                target_id=entry.target_id,
                at=entry.at,
                details=entry.details,
            )
        )

    async def search(
        self, where: AuditFilter, offset: int, limit: int
    ) -> tuple[list[AuditRecord], int]:
        conditions: list[ColumnElement[bool]] = []
        if where.target_type:
            conditions.append(AuditLogModel.target_type == where.target_type)
        if where.target_id:
            conditions.append(AuditLogModel.target_id == where.target_id)
        if where.actor_id:
            conditions.append(AuditLogModel.actor_id == where.actor_id)
        total = await self._session.scalar(
            select(func.count()).select_from(AuditLogModel).where(*conditions)
        )
        rows = await self._session.scalars(
            select(AuditLogModel)
            .where(*conditions)
            .order_by(AuditLogModel.at.desc(), AuditLogModel.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return [_record(r) for r in rows], int(total or 0)
