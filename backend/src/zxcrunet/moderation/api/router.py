from datetime import datetime
from http import HTTPStatus
from typing import Any, Literal
from uuid import UUID

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from zxcrunet.identity.api.current import current_staff
from zxcrunet.identity.application.admin import AuthorizeOwner, UserDirectory
from zxcrunet.moderation.application.use_cases import (
    DecideReport,
    ListAuditLog,
    ListReports,
    NewReport,
    SubmitReport,
)
from zxcrunet.moderation.domain.report import (
    MESSAGE_MAX,
    AuditRecord,
    Decision,
    Report,
    ReportReason,
    ReportStatus,
)
from zxcrunet.moderation.domain.repository import AuditFilter, ReportFilter
from zxcrunet.shared.api.client import client_ip, ensure_sent_from
from zxcrunet.shared.application.admin import Paging
from zxcrunet.shared.config import Settings

public_router = APIRouter(prefix="/api/public/events", tags=["public"], route_class=DishkaRoute)
router = APIRouter(prefix="/api/admin", tags=["admin"], route_class=DishkaRoute)

Reason = Literal["spam", "fraud", "illegal", "adult", "harassment", "copyright", "other"]
StatusName = Literal["open", "resolved", "dismissed"]


class ReportIn(BaseModel):
    host: str = Field(max_length=300)
    path: str = Field(default="/", max_length=300)
    reason: Reason
    message: str = Field(default="", max_length=MESSAGE_MAX * 2)


class ReportAcceptedOut(BaseModel):
    id: UUID


class ReportOut(BaseModel):
    id: UUID
    site_id: UUID
    host: str
    path: str
    reason: Reason
    message: str
    status: StatusName
    created_at: datetime
    decided_at: datetime | None
    decided_by: UUID | None
    note: str

    @classmethod
    def of(cls, report: Report) -> "ReportOut":
        return cls(
            id=report.id,
            site_id=report.site_id,
            host=report.host,
            path=report.path,
            reason=report.reason.value,
            message=report.message,
            status=report.status.value,
            created_at=report.created_at,
            decided_at=report.decided_at,
            decided_by=report.decided_by,
            note=report.note,
        )


class ReportCountsOut(BaseModel):
    open: int
    resolved: int
    dismissed: int


class ReportsOut(BaseModel):
    items: list[ReportOut]
    total: int
    counts: ReportCountsOut


class DecisionIn(BaseModel):
    decision: Literal["suspend", "dismiss"]
    note: str = Field(default="", max_length=500)


class DecidedOut(BaseModel):
    items: list[ReportOut]


class AuditOut(BaseModel):
    id: UUID
    actor_id: UUID
    actor_email: str | None
    action: str
    target_type: str
    target_id: str
    at: datetime
    details: dict[str, Any]

    @classmethod
    def of(cls, record: AuditRecord, email: str | None) -> "AuditOut":
        return cls(
            id=record.id,
            actor_id=record.actor_id,
            actor_email=email,
            action=record.action,
            target_type=record.target_type,
            target_id=record.target_id,
            at=record.at,
            details=record.details,
        )


class AuditPageOut(BaseModel):
    items: list[AuditOut]
    total: int


@public_router.post("/reports", status_code=HTTPStatus.CREATED)
async def submit_report(
    body: ReportIn, request: Request, use_case: FromDishka[SubmitReport]
) -> ReportAcceptedOut:
    """«Пожаловаться» on a published site: sent from a page of that site."""
    ensure_sent_from(request, body.host)
    report = await use_case(
        NewReport(
            host=body.host,
            path=body.path,
            reason=ReportReason(body.reason),
            message=body.message,
            ip=client_ip(request),
        )
    )
    return ReportAcceptedOut(id=report.id)


@router.get("/reports")
async def list_reports(
    request: Request,
    use_case: FromDishka[ListReports],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    status: StatusName | None = None,
    site_id: UUID | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> ReportsOut:
    staff = await current_staff(request, authorize, settings)
    where = ReportFilter(status=ReportStatus(status) if status else None, site_id=site_id)
    queue = await use_case(staff, where, Paging(offset, limit))
    return ReportsOut(
        items=[ReportOut.of(r) for r in queue.reports.items],
        total=queue.reports.total,
        counts=ReportCountsOut(
            open=queue.counts.get(ReportStatus.OPEN, 0),
            resolved=queue.counts.get(ReportStatus.RESOLVED, 0),
            dismissed=queue.counts.get(ReportStatus.DISMISSED, 0),
        ),
    )


@router.post("/reports/{report_id}/decision")
async def decide_report(
    report_id: UUID,
    body: DecisionIn,
    request: Request,
    use_case: FromDishka[DecideReport],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
) -> DecidedOut:
    staff = await current_staff(request, authorize, settings)
    decided = await use_case(staff, report_id, Decision(body.decision), body.note)
    return DecidedOut(items=[ReportOut.of(r) for r in decided])


@router.get("/audit")
async def audit_log(
    request: Request,
    use_case: FromDishka[ListAuditLog],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    users: FromDishka[UserDirectory],
    target_type: Literal["user", "site", "domain", "plan", "report", "slug"] | None = None,
    target_id: str | None = Query(default=None, max_length=253),
    actor_id: UUID | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> AuditPageOut:
    staff = await current_staff(request, authorize, settings)
    where = AuditFilter(target_type=target_type, target_id=target_id, actor_id=actor_id)
    found = await use_case(staff, where, Paging(offset, limit))
    emails = await users.emails({r.actor_id for r in found.items})
    return AuditPageOut(
        items=[AuditOut.of(r, emails.get(r.actor_id)) for r in found.items], total=found.total
    )
