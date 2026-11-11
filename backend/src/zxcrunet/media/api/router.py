from http import HTTPStatus
from typing import Annotated, Literal
from uuid import UUID

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, File, Form, Request, UploadFile
from pydantic import BaseModel

from zxcrunet.identity.api.current import current_user
from zxcrunet.identity.application.use_cases import GetCurrentUser
from zxcrunet.media.application.use_cases import Upload, UploadMedia
from zxcrunet.media.domain.media import FileTooLargeError, Purpose
from zxcrunet.shared.config import Settings

router = APIRouter(prefix="/api/media", tags=["media"], route_class=DishkaRoute)


class MediaOut(BaseModel):
    id: UUID
    url: str
    kind: Literal["image", "document"]
    mime: str
    size: int
    width: int | None
    height: int | None


@router.post("", status_code=HTTPStatus.CREATED)
async def upload(
    request: Request,
    file: Annotated[UploadFile, File()],
    purpose: Annotated[Literal["image", "resume"], Form()],
    use_case: FromDishka[UploadMedia],
    get_current: FromDishka[GetCurrentUser],
    settings: FromDishka[Settings],
) -> MediaOut:
    user = await current_user(request, get_current, settings)
    limit = await use_case.max_bytes(user.plan_code)
    data = await file.read(limit + 1)  # never read more than the plan allows
    if len(data) > limit:
        raise FileTooLargeError("File is too large", {"max_mb": limit // (1024 * 1024)})
    media = await use_case(Upload(user.id, user.plan_code, Purpose(purpose), data))
    return MediaOut(
        id=media.id,
        url=use_case.url(media),
        kind=media.kind.value,
        mime=media.mime,
        size=media.size,
        width=media.width,
        height=media.height,
    )
