import ipaddress
from http import HTTPStatus
from uuid import UUID

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, Query, Request
from fastapi.responses import PlainTextResponse

from zxcrunet.domains.api.schemas import AddDomainIn, DomainOut, SiteDomainsOut
from zxcrunet.domains.application.use_cases import (
    AddDomain,
    AllowCertificate,
    CheckDomainNow,
    DomainsConfig,
    ListSiteDomains,
    Owner,
    RemoveDomain,
)
from zxcrunet.identity.api.current import current_user
from zxcrunet.identity.application.use_cases import GetCurrentUser
from zxcrunet.shared.config import Settings
from zxcrunet.shared.domain.errors import NotFoundError

router = APIRouter(prefix="/api", tags=["domains"], route_class=DishkaRoute)
#: Only for Caddy inside the Docker network; the public proxy never routes /internal.
internal_router = APIRouter(prefix="/internal", include_in_schema=False, route_class=DishkaRoute)


async def _owner(request: Request, get_current: GetCurrentUser, settings: Settings) -> Owner:
    user = await current_user(request, get_current, settings)
    return Owner(user_id=user.id, plan_code=user.plan_code)


@router.get("/sites/{site_id}/domains")
async def list_domains(
    site_id: UUID,
    request: Request,
    use_case: FromDishka[ListSiteDomains],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> SiteDomainsOut:
    return SiteDomainsOut.of(await use_case(await _owner(request, get_current, settings), site_id))


@router.post("/sites/{site_id}/domains", status_code=HTTPStatus.CREATED)
async def add_domain(
    site_id: UUID,
    body: AddDomainIn,
    request: Request,
    use_case: FromDishka[AddDomain],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
    config: FromDishka[DomainsConfig],
) -> DomainOut:
    owner = await _owner(request, get_current, settings)
    return DomainOut.of(await use_case(owner, site_id, body.host), config.server)


@router.post("/domains/{domain_id}/check")
async def check_domain(
    domain_id: UUID,
    request: Request,
    use_case: FromDishka[CheckDomainNow],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
    config: FromDishka[DomainsConfig],
) -> DomainOut:
    owner = await _owner(request, get_current, settings)
    return DomainOut.of(await use_case(owner, domain_id), config.server)


@router.delete("/domains/{domain_id}", status_code=HTTPStatus.NO_CONTENT)
async def remove_domain(
    domain_id: UUID,
    request: Request,
    use_case: FromDishka[RemoveDomain],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> None:
    await use_case(await _owner(request, get_current, settings), domain_id)


def _from_inside(request: Request) -> bool:
    """A direct request from a private address, not one forwarded by the public proxy."""
    if "x-forwarded-for" in request.headers or "forwarded" in request.headers:
        return False
    try:
        peer = ipaddress.ip_address(request.client.host if request.client else "")
    except ValueError:
        return False
    return peer.is_private or peer.is_loopback


@internal_router.get("/tls/ask", response_class=PlainTextResponse)
async def tls_ask(
    request: Request,
    use_case: FromDishka[AllowCertificate],
    domain: str = Query(max_length=300),
) -> str:
    """Caddy on-demand TLS: 200 only for verified and active custom domains."""
    if not _from_inside(request) or not await use_case(domain):
        raise NotFoundError("Unknown domain")
    return "ok"
