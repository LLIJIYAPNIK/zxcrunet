"""Schema of `ShelfEntry.details`: what the title page shows besides the core fields.

Mirrored by zod in `frontend/src/lib/catalog/schemas.ts`.
"""

from typing import Annotated, Any
from uuid import UUID

from pydantic import Field, StringConstraints, ValidationError, field_validator

from zxcrunet.catalog.domain.errors import InvalidShelfEntryError
from zxcrunet.shared.application.content import ContentModel, MediaRef, Short, Url, safe_url

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, max_length=24)]
Paragraph = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


class Criterion(ContentModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    score: int = Field(ge=1, le=10)


class PlotSection(ContentModel):
    label: Short = ""
    text: Paragraph
    #: Blurred until the guest presses «Показать спойлеры».
    spoiler: bool = True


class Character(ContentModel):
    name: Name
    role: Short = ""
    #: Part labels the character appears in (`I`, `III`).
    parts: list[Tag] = Field(default_factory=list, max_length=12)
    #: Favourite characters also appear in the «Мои персонажи» block.
    favorite: bool = False
    avatar: MediaRef | None = None


class Boss(ContentModel):
    name: Name
    note: Short = ""
    defeated: bool = False


class Track(ContentModel):
    title: Name
    artist: Short = ""
    part: Tag = ""
    url: Url | None = None

    @field_validator("url")
    @classmethod
    def _safe(cls, value: str | None) -> str | None:
        return safe_url(value) if value else None


class Extra(ContentModel):
    """A DLC, an expansion, a special: done or not."""

    name: Name
    done: bool = False


class Related(ContentModel):
    #: A title from the same catalog, or just a name when it is not on the shelf.
    title_id: UUID | None = None
    name: Short = ""
    note: Short = ""


class Details(ContentModel):
    criteria: list[Criterion] = Field(default_factory=list, max_length=8)
    plot: list[PlotSection] = Field(default_factory=list, max_length=12)
    characters: list[Character] = Field(default_factory=list, max_length=24)
    bosses: list[Boss] = Field(default_factory=list, max_length=40)
    tracks: list[Track] = Field(default_factory=list, max_length=30)
    extras: list[Extra] = Field(default_factory=list, max_length=12)
    screenshots: list[MediaRef] = Field(default_factory=list, max_length=24)
    related: list[Related] = Field(default_factory=list, max_length=8)
    #: Where it was watched or read: «В кино · март 2024».
    place: Short = ""
    #: Favourite part of a series: «III».
    favorite_part: Tag = ""


def validate_details(raw: dict[str, Any]) -> dict[str, Any]:
    try:
        details = Details.model_validate(raw)
    except ValidationError as exc:
        errors = [
            {"loc": [str(p) for p in err["loc"]], "msg": err["msg"], "type": err["type"]}
            for err in exc.errors()
        ]
        raise InvalidShelfEntryError("Title details are invalid", {"errors": errors}) from exc
    return details.model_dump(mode="json")
