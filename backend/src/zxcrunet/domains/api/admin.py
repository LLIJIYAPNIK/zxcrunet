"""Admin panel: custom domains (owner only)."""

from typing import Literal
from uuid import UUID

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from zxcrunet.domains.api.schemas import DomainOut
from zxcrunet.domains.application.admin import ConfirmDomain, ListDomains, RevokeDomain
from zxcrunet.domains.application.use_cases import DomainsConfig
from zxcrunet.domains.domain.domain import CustomDomain, DomainStatus
from zxcrunet.domains.domain.repository import DomainFilter
from zxcrunet.identity.api.current import current_staff
from zxcrunet.identity.application.admin import AuthorizeOwner, UserDirectory
from zxcrunet.shared.application.admin import Paging, search_text
from zxcrunet.shared.config import Settings
from zxcrunet.sites.application.admin import SiteDirectory

router = APIRouter(prefix="/api/admin/domains", tags=["admin"], route_class=DishkaRoute)


class AdminDomainOut(DomainOut):
    owner_id: UUID
    owner_email: str | None
    #: Free address of the site the domain is attached to.
    site_host: str | None
    attempts: int
    failures: int


class AdminDomainsOut(BaseModel):
    items: list[AdminDomainOut]
    total: int


class RevokeDomainIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


async def _out(
    domains: list[CustomDomain],
    config: DomainsConfig,
    users: UserDirectory,
    sites: SiteDirectory,
) -> list[AdminDomainOut]:
    emails = await users.emails({d.owner_id for d in domains})
    hosts = await sites.hosts({d.site_id for d in domains})
    return [
        AdminDomainOut(
            **DomainOut.of(d, config.server).model_dump(),
            owner_id=d.owner_id,
            owner_email=emails.get(d.owner_id),
            site_host=hosts.get(d.site_id),
            attempts=d.attempts,
            failures=d.failures,
        )
        for d in domains
    ]


@router.get("")
async def list_domains(
    request: Request,
    use_case: FromDishka[ListDomains],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    config: FromDishka[DomainsConfig],
    users: FromDishka[UserDirectory],
    sites: FromDishka[SiteDirectory],
    q: str | None = Query(default=None, max_length=100),
    status: Literal["pending", "verified", "active", "failed", "lost"] | None = None,
    site_id: UUID | None = None,
    owner_id: UUID | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> AdminDomainsOut:
    staff = await current_staff(request, authorize, settings)
    where = DomainFilter(
        text=search_text(q),
        status=DomainStatus(status) if status else None,
        site_id=site_id,
        owner_id=owner_id,
    )
    found = await use_case(staff, where, Paging(offset, limit))
    return AdminDomainsOut(items=await _out(found.items, config, users, sites), total=found.total)


@router.post("/{domain_id}/confirm")
async def confirm_domain(
    domain_id: UUID,
    request: Request,
    use_case: FromDishka[ConfirmDomain],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    config: FromDishka[DomainsConfig],
    users: FromDishka[UserDirectory],
    sites: FromDishka[SiteDirectory],
) -> AdminDomainOut:
    staff = await current_staff(request, authorize, settings)
    return (await _out([await use_case(staff, domain_id)], config, users, sites))[0]


@router.post("/{domain_id}/revoke")
async def revoke_domain(
    domain_id: UUID,
    body: RevokeDomainIn,
    request: Request,
    use_case: FromDishka[RevokeDomain],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    config: FromDishka[DomainsConfig],
    users: FromDishka[UserDirectory],
    sites: FromDishka[SiteDirectory],
) -> AdminDomainOut:
    staff = await current_staff(request, authorize, settings)
    return (await _out([await use_case(staff, domain_id, body.reason)], config, users, sites))[0]
