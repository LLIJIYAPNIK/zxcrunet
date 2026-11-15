"""Admin panel: sites and reserved names (owner only)."""

from datetime import datetime
from http import HTTPStatus
from typing import Literal
from uuid import UUID

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from zxcrunet.identity.api.current import current_staff
from zxcrunet.identity.application.admin import AuthorizeOwner, UserDirectory
from zxcrunet.shared.application.admin import Paging, search_text
from zxcrunet.shared.config import Settings
from zxcrunet.sites.api.schemas import Kind, Status
from zxcrunet.sites.application.admin import (
    GetSite,
    ListReservedNames,
    ListSites,
    ReleaseName,
    ReservedNameUse,
    ReserveName,
    RestoreSite,
    SuspendSite,
)
from zxcrunet.sites.application.use_cases import SitesConfig
from zxcrunet.sites.domain.repository import SiteFilter
from zxcrunet.sites.domain.site import Site, SiteKind, SiteStatus

router = APIRouter(prefix="/api/admin", tags=["admin"], route_class=DishkaRoute)


class AdminSiteOut(BaseModel):
    id: UUID
    kind: Kind
    slug: str
    host: str
    title: str
    status: Status
    owner_id: UUID
    owner_email: str | None
    pages: int
    unpublished_changes: int
    created_at: datetime
    updated_at: datetime | None
    published_at: datetime | None
    suspension_reason: str
    suspended_at: datetime | None

    @classmethod
    def of(cls, site: Site, host: str, owner_email: str | None) -> "AdminSiteOut":
        return cls(
            id=site.id,
            kind=site.kind.value,
            slug=str(site.slug),
            host=host,
            title=site.title,
            status=site.status.value,
            owner_id=site.owner_id,
            owner_email=owner_email,
            pages=len(site.pages),
            unpublished_changes=site.unpublished_changes,
            created_at=site.created_at,
            updated_at=site.updated_at,
            published_at=site.published_at,
            suspension_reason=site.suspension_reason,
            suspended_at=site.suspended_at,
        )


class AdminSitesOut(BaseModel):
    items: list[AdminSiteOut]
    total: int


class SuspendSiteIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class ReservedNameOut(BaseModel):
    slug: str
    reason: str
    in_use: bool

    @classmethod
    def of(cls, use: ReservedNameUse) -> "ReservedNameOut":
        return cls(slug=str(use.name.slug), reason=use.name.reason, in_use=use.in_use)


class ReservedNamesOut(BaseModel):
    items: list[ReservedNameOut]


class ReserveNameIn(BaseModel):
    slug: str = Field(max_length=64)
    reason: str = Field(default="", max_length=120)


async def _out(sites: list[Site], config: SitesConfig, users: UserDirectory) -> list[AdminSiteOut]:
    emails = await users.emails({s.owner_id for s in sites})
    return [AdminSiteOut.of(s, config.host_for(s.slug), emails.get(s.owner_id)) for s in sites]


@router.get("/sites")
async def list_sites(
    request: Request,
    use_case: FromDishka[ListSites],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    config: FromDishka[SitesConfig],
    users: FromDishka[UserDirectory],
    q: str | None = Query(default=None, max_length=100),
    status: Literal["draft", "published", "suspended"] | None = None,
    kind: Literal["business", "personal"] | None = None,
    owner_id: UUID | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> AdminSitesOut:
    staff = await current_staff(request, authorize, settings)
    where = SiteFilter(
        text=search_text(q),
        status=SiteStatus(status) if status else None,
        kind=SiteKind(kind) if kind else None,
        owner_id=owner_id,
    )
    found = await use_case(staff, where, Paging(offset, limit))
    return AdminSitesOut(items=await _out(found.items, config, users), total=found.total)


@router.get("/sites/{site_id}")
async def get_site(
    site_id: UUID,
    request: Request,
    use_case: FromDishka[GetSite],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    config: FromDishka[SitesConfig],
    users: FromDishka[UserDirectory],
) -> AdminSiteOut:
    staff = await current_staff(request, authorize, settings)
    return (await _out([await use_case(staff, site_id)], config, users))[0]


@router.post("/sites/{site_id}/suspend")
async def suspend_site(
    site_id: UUID,
    body: SuspendSiteIn,
    request: Request,
    use_case: FromDishka[SuspendSite],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    config: FromDishka[SitesConfig],
    users: FromDishka[UserDirectory],
) -> AdminSiteOut:
    staff = await current_staff(request, authorize, settings)
    return (await _out([await use_case(staff, site_id, body.reason)], config, users))[0]


@router.post("/sites/{site_id}/restore")
async def restore_site(
    site_id: UUID,
    request: Request,
    use_case: FromDishka[RestoreSite],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    config: FromDishka[SitesConfig],
    users: FromDishka[UserDirectory],
) -> AdminSiteOut:
    staff = await current_staff(request, authorize, settings)
    return (await _out([await use_case(staff, site_id)], config, users))[0]


@router.get("/reserved-slugs")
async def list_reserved(
    request: Request,
    use_case: FromDishka[ListReservedNames],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
) -> ReservedNamesOut:
    staff = await current_staff(request, authorize, settings)
    return ReservedNamesOut(items=[ReservedNameOut.of(n) for n in await use_case(staff)])


@router.post("/reserved-slugs", status_code=HTTPStatus.CREATED)
async def reserve(
    body: ReserveNameIn,
    request: Request,
    use_case: FromDishka[ReserveName],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
) -> ReservedNameOut:
    staff = await current_staff(request, authorize, settings)
    return ReservedNameOut.of(await use_case(staff, body.slug, body.reason))


@router.delete("/reserved-slugs/{slug}", status_code=HTTPStatus.NO_CONTENT)
async def release(
    slug: str,
    request: Request,
    use_case: FromDishka[ReleaseName],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
) -> None:
    staff = await current_staff(request, authorize, settings)
    await use_case(staff, slug)
