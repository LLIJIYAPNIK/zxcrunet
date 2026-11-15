from datetime import date
from http import HTTPStatus
from uuid import UUID

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from zxcrunet.analytics.application.use_cases import (
    Dashboard,
    DashboardData,
    PageView,
    RecordView,
    SiteViews,
)
from zxcrunet.analytics.domain.views import MAX_DAYS, DayTotal
from zxcrunet.identity.api.current import current_staff
from zxcrunet.identity.application.admin import AuthorizeOwner
from zxcrunet.shared.api.client import client_ip, ensure_sent_from
from zxcrunet.shared.config import Settings

public_router = APIRouter(prefix="/api/public/events", tags=["public"], route_class=DishkaRoute)
router = APIRouter(prefix="/api/admin", tags=["admin"], route_class=DishkaRoute)


class ViewIn(BaseModel):
    host: str = Field(max_length=300)
    path: str = Field(default="/", max_length=300)


class DayViewsOut(BaseModel):
    day: date
    views: int
    visitors: int

    @classmethod
    def of(cls, total: DayTotal) -> "DayViewsOut":
        return cls(day=total.day, views=total.views, visitors=total.visitors)


class DayCountOut(BaseModel):
    day: date
    count: int


class BlockUsageOut(BaseModel):
    type: str
    blocks: int
    sites: int


class DashboardOut(BaseModel):
    days: int
    users: int
    registrations: list[DayCountOut]
    #: Sites by status: draft, published, suspended.
    sites: dict[str, int]
    #: Custom domains by status.
    domains: dict[str, int]
    open_reports: int
    views: list[DayViewsOut]
    blocks: list[BlockUsageOut]

    @classmethod
    def of(cls, data: DashboardData) -> "DashboardOut":
        return cls(
            days=data.days,
            users=data.users,
            registrations=[DayCountOut(day=r.day, count=r.count) for r in data.registrations],
            sites=data.sites,
            domains=data.domains,
            open_reports=data.open_reports,
            views=[DayViewsOut.of(v) for v in data.views],
            blocks=[
                BlockUsageOut(type=b.type, blocks=b.blocks, sites=b.sites) for b in data.blocks
            ],
        )


class SiteViewsOut(BaseModel):
    days: list[DayViewsOut]


@public_router.post("/views", status_code=HTTPStatus.NO_CONTENT)
async def record_view(body: ViewIn, request: Request, use_case: FromDishka[RecordView]) -> None:
    """Beacon of a published page. Always 204: the page never waits for or reads it."""
    ensure_sent_from(request, body.host)
    await use_case(
        PageView(
            host=body.host,
            path=body.path,
            ip=client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
        )
    )


@router.get("/dashboard")
async def dashboard(
    request: Request,
    use_case: FromDishka[Dashboard],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    days: int = Query(default=30, ge=1, le=MAX_DAYS),
) -> DashboardOut:
    staff = await current_staff(request, authorize, settings)
    return DashboardOut.of(await use_case(staff, days))


@router.get("/sites/{site_id}/views")
async def site_views(
    site_id: UUID,
    request: Request,
    use_case: FromDishka[SiteViews],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    days: int = Query(default=30, ge=1, le=MAX_DAYS),
) -> SiteViewsOut:
    staff = await current_staff(request, authorize, settings)
    return SiteViewsOut(days=[DayViewsOut.of(d) for d in await use_case(staff, site_id, days)])
