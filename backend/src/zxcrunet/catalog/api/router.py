from http import HTTPStatus
from uuid import UUID

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, Query, Request

from zxcrunet.catalog.api.schemas import (
    CatalogOut,
    PostIn,
    PostOut,
    PublicCatalogOut,
    TitleIn,
    TitleOut,
)
from zxcrunet.catalog.application.use_cases import (
    CreatePost,
    CreateTitle,
    DeletePost,
    DeleteTitle,
    GetPublicCatalog,
    ListCatalog,
    UpdatePost,
    UpdateTitle,
)
from zxcrunet.identity.api.current import current_user
from zxcrunet.identity.application.use_cases import GetCurrentUser
from zxcrunet.shared.config import Settings
from zxcrunet.sites.domain.errors import SiteNotFoundError

router = APIRouter(prefix="/api/catalog", tags=["catalog"], route_class=DishkaRoute)
public_router = APIRouter(prefix="/api/public", tags=["public"], route_class=DishkaRoute)


async def _owner(request: Request, get_current: GetCurrentUser, settings: Settings) -> UUID:
    return (await current_user(request, get_current, settings)).id


@router.get("")
async def list_catalog(
    request: Request,
    use_case: FromDishka[ListCatalog],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> CatalogOut:
    """The signed-in user's titles (with their shelf entries) and posts."""
    return CatalogOut.of(await use_case(await _owner(request, get_current, settings)))


@router.post("/titles", status_code=HTTPStatus.CREATED)
async def create_title(
    body: TitleIn,
    request: Request,
    use_case: FromDishka[CreateTitle],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> TitleOut:
    owner = await _owner(request, get_current, settings)
    entry = body.entry.to_input() if body.entry else None
    return TitleOut.of(await use_case(owner, body.to_data(), entry))


@router.put("/titles/{title_id}")
async def update_title(
    title_id: UUID,
    body: TitleIn,
    request: Request,
    use_case: FromDishka[UpdateTitle],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> TitleOut:
    owner = await _owner(request, get_current, settings)
    entry = body.entry.to_input() if body.entry else None
    return TitleOut.of(await use_case(owner, title_id, body.to_data(), entry))


@router.delete("/titles/{title_id}", status_code=HTTPStatus.NO_CONTENT)
async def delete_title(
    title_id: UUID,
    request: Request,
    use_case: FromDishka[DeleteTitle],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> None:
    await use_case(await _owner(request, get_current, settings), title_id)


@router.post("/posts", status_code=HTTPStatus.CREATED)
async def create_post(
    body: PostIn,
    request: Request,
    use_case: FromDishka[CreatePost],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> PostOut:
    owner = await _owner(request, get_current, settings)
    return PostOut.of(await use_case(owner, body.to_data()))


@router.put("/posts/{post_id}")
async def update_post(
    post_id: UUID,
    body: PostIn,
    request: Request,
    use_case: FromDishka[UpdatePost],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> PostOut:
    owner = await _owner(request, get_current, settings)
    return PostOut.of(await use_case(owner, post_id, body.to_data()))


@router.delete("/posts/{post_id}", status_code=HTTPStatus.NO_CONTENT)
async def delete_post(
    post_id: UUID,
    request: Request,
    use_case: FromDishka[DeletePost],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> None:
    await use_case(await _owner(request, get_current, settings), post_id)


@public_router.get("/catalog")
async def public_catalog(
    use_case: FromDishka[GetPublicCatalog], host: str = Query(max_length=253)
) -> PublicCatalogOut:
    """Shelves and posts of the published personal site at `host`; 404 otherwise."""
    payload = await use_case(host)
    if payload is None:
        raise SiteNotFoundError("No personal site at this address")
    return PublicCatalogOut.model_validate(payload)
