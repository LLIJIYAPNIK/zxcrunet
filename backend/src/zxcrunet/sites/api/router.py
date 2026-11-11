from http import HTTPStatus
from uuid import UUID

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, Query, Request

from zxcrunet.identity.api.current import current_user
from zxcrunet.identity.application.use_cases import GetCurrentUser
from zxcrunet.shared.config import Settings
from zxcrunet.sites.api.schemas import (
    CreatePageIn,
    CreateSiteIn,
    PageOut,
    ResolvedSiteOut,
    SetBlocksIn,
    SiteOut,
    SitesListOut,
    SiteSummaryOut,
    SlugCheckOut,
    UpdatePageIn,
    UpdateSiteIn,
)
from zxcrunet.sites.application.use_cases import (
    Actor,
    AddPage,
    CheckSlug,
    CreateSite,
    DeletePage,
    DeleteSite,
    GetMySite,
    ListMySites,
    NewPage,
    NewSite,
    PublishSite,
    ResolveSite,
    SetPageBlocks,
    SiteChanges,
    SitesConfig,
    UnpublishSite,
    UpdatePage,
    UpdateSite,
)
from zxcrunet.sites.domain.errors import SiteNotFoundError
from zxcrunet.sites.domain.site import SiteKind

router = APIRouter(prefix="/api/sites", tags=["sites"], route_class=DishkaRoute)
public_router = APIRouter(prefix="/api/public", tags=["public"], route_class=DishkaRoute)


async def _actor(request: Request, get_current: GetCurrentUser, settings: Settings) -> Actor:
    user = await current_user(request, get_current, settings)
    return Actor(user_id=user.id, email_verified=user.email_verified, plan_code=user.plan_code)


@router.get("")
async def list_sites(
    request: Request,
    use_case: FromDishka[ListMySites],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
    config: FromDishka[SitesConfig],
) -> SitesListOut:
    result = await use_case(await _actor(request, get_current, settings))
    return SitesListOut(
        sites=[SiteSummaryOut.of(s, config.host_for(s.slug)) for s in result.sites],
        max_sites=result.max_sites,
    )


@router.get("/slug-check")
async def check_slug(
    request: Request,
    use_case: FromDishka[CheckSlug],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
    slug: str = Query(max_length=64),
) -> SlugCheckOut:
    await _actor(request, get_current, settings)
    return SlugCheckOut.of(await use_case(slug))


@router.post("", status_code=HTTPStatus.CREATED)
async def create_site(
    body: CreateSiteIn,
    request: Request,
    use_case: FromDishka[CreateSite],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
    config: FromDishka[SitesConfig],
) -> SiteOut:
    actor = await _actor(request, get_current, settings)
    site = await use_case(actor, NewSite(SiteKind(body.kind), body.slug, body.title))
    return SiteOut.of(site, config.host_for(site.slug))


@router.get("/{site_id}")
async def get_site(
    site_id: UUID,
    request: Request,
    use_case: FromDishka[GetMySite],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
    config: FromDishka[SitesConfig],
) -> SiteOut:
    site = await use_case(await _actor(request, get_current, settings), site_id)
    return SiteOut.of(site, config.host_for(site.slug))


@router.patch("/{site_id}")
async def update_site(
    site_id: UUID,
    body: UpdateSiteIn,
    request: Request,
    use_case: FromDishka[UpdateSite],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
    config: FromDishka[SitesConfig],
) -> SiteOut:
    actor = await _actor(request, get_current, settings)
    site = await use_case(actor, site_id, SiteChanges(**body.model_dump()))
    return SiteOut.of(site, config.host_for(site.slug))


@router.delete("/{site_id}", status_code=HTTPStatus.NO_CONTENT)
async def delete_site(
    site_id: UUID,
    request: Request,
    use_case: FromDishka[DeleteSite],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> None:
    await use_case(await _actor(request, get_current, settings), site_id)


@router.post("/{site_id}/publish")
async def publish_site(
    site_id: UUID,
    request: Request,
    use_case: FromDishka[PublishSite],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
    config: FromDishka[SitesConfig],
) -> SiteOut:
    site = await use_case(await _actor(request, get_current, settings), site_id)
    return SiteOut.of(site, config.host_for(site.slug))


@router.post("/{site_id}/unpublish")
async def unpublish_site(
    site_id: UUID,
    request: Request,
    use_case: FromDishka[UnpublishSite],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
    config: FromDishka[SitesConfig],
) -> SiteOut:
    site = await use_case(await _actor(request, get_current, settings), site_id)
    return SiteOut.of(site, config.host_for(site.slug))


@router.post("/{site_id}/pages", status_code=HTTPStatus.CREATED)
async def add_page(
    site_id: UUID,
    body: CreatePageIn,
    request: Request,
    use_case: FromDishka[AddPage],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> PageOut:
    actor = await _actor(request, get_current, settings)
    return PageOut.of(await use_case(actor, site_id, NewPage(body.path, body.title)))


@router.patch("/{site_id}/pages/{page_id}")
async def update_page(
    site_id: UUID,
    page_id: UUID,
    body: UpdatePageIn,
    request: Request,
    use_case: FromDishka[UpdatePage],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> PageOut:
    actor = await _actor(request, get_current, settings)
    page = await use_case(actor, site_id, page_id, title=body.title, path=body.path)
    return PageOut.of(page)


@router.delete("/{site_id}/pages/{page_id}", status_code=HTTPStatus.NO_CONTENT)
async def delete_page(
    site_id: UUID,
    page_id: UUID,
    request: Request,
    use_case: FromDishka[DeletePage],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> None:
    await use_case(await _actor(request, get_current, settings), site_id, page_id)


@router.put("/{site_id}/pages/{page_id}/blocks")
async def set_blocks(
    site_id: UUID,
    page_id: UUID,
    body: SetBlocksIn,
    request: Request,
    use_case: FromDishka[SetPageBlocks],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> PageOut:
    actor = await _actor(request, get_current, settings)
    return PageOut.of(await use_case(actor, site_id, page_id, body.blocks))


@public_router.get("/sites/resolve")
async def resolve_site(
    use_case: FromDishka[ResolveSite], host: str = Query(max_length=253)
) -> ResolvedSiteOut:
    """Which published site lives at `host`. 404 for unknown hosts and drafts."""
    resolved = await use_case(host)
    if resolved is None:
        raise SiteNotFoundError("No site at this address")
    return ResolvedSiteOut.of(resolved)
