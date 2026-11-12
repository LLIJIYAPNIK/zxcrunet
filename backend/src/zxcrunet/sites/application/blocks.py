"""Block registry: one Pydantic schema per block type and version.

The frontend mirrors every schema in zod (`frontend/src/blocks`). The backend is the
authority: blocks are validated here before they reach the draft.
"""

from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    field_validator,
)

from zxcrunet.shared.application.content import (
    ContentModel as _Model,
)
from zxcrunet.shared.application.content import (
    Line,
    Link,
    MediaRef,
    Short,
    Text,
    Url,
    safe_url,
)
from zxcrunet.shared.application.content import (
    media_ids as _media_ids,
)
from zxcrunet.shared.domain.errors import InvalidInputError

MAX_BLOCKS_PER_PAGE = 40

TitleKind = Literal["game", "book", "anime", "series", "film"]
ALL_KINDS: tuple[TitleKind, ...] = ("game", "book", "anime", "series", "film")


class InvalidBlockError(InvalidInputError):
    code = "invalid_block"


# --- business blocks ----------------------------------------------------------


class HeroSettings(_Model):
    label: Short = ""
    title: Line
    lead: Text = ""
    primary: Link | None = None
    secondary: Link | None = None
    card_name: Short = ""
    card_role: Short = ""
    avatar: MediaRef | None = None
    chips: list[Short] = Field(default_factory=list, max_length=6)


class Fact(_Model):
    value: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=16)]
    label: Line


class FactsSettings(_Model):
    items: list[Fact] = Field(min_length=1, max_length=4)


class ExperienceItem(_Model):
    title: Short
    text: Text = ""
    current: bool = False


class ExperienceSettings(_Model):
    label: Short = ""
    title: Line = ""
    items: list[ExperienceItem] = Field(min_length=1, max_length=20)


class Project(_Model):
    label: Short = ""
    title: Short
    text: Text = ""
    tags: list[Short] = Field(default_factory=list, max_length=8)
    link: Link | None = None


class ProjectsSettings(_Model):
    label: Short = ""
    title: Line = ""
    all_link: Link | None = None
    items: list[Project] = Field(min_length=1, max_length=12)


class InterestsSettings(_Model):
    label: Short = ""
    items: list[Short] = Field(min_length=1, max_length=24)


ContactKind = Literal["telegram", "github", "email", "phone", "vk", "linkedin", "website"]


class Contact(_Model):
    kind: ContactKind
    label: Short
    value: Short
    url: Url

    @field_validator("url")
    @classmethod
    def _safe(cls, value: str) -> str:
        return safe_url(value)


class ContactsSettings(_Model):
    title: Line
    title_muted: Short = ""
    items: list[Contact] = Field(min_length=1, max_length=8)


class ResumeSettings(_Model):
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    #: None until the PDF is uploaded; such a block renders nothing.
    file: MediaRef | None = None


# --- personal blocks ----------------------------------------------------------
# Shelves, «now», characters and posts come from the owner's catalog when the page is
# rendered; blocks keep only presentation and references (title ids) to it.

Required = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class ProfileSettings(_Model):
    cover: MediaRef | None = None
    avatar: MediaRef | None = None
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    lead: Text = ""
    mood: Short = ""


class NowSettings(_Model):
    label: Short = ""
    kinds: list[TitleKind] = Field(
        default_factory=lambda: list(ALL_KINDS),
        min_length=1,
        max_length=5,
    )
    limit: int = Field(default=3, ge=1, le=6)


ShelfStyle = Literal["cards", "bento", "spines", "tickets", "tracker"]


class ShelfSettings(_Model):
    kind: TitleKind
    style: ShelfStyle = "cards"
    label: Short = ""
    title: Line = ""
    lead: Text = ""
    #: Status filters, sorting and views for guests (their choice is remembered).
    controls: bool = False
    limit: int = Field(default=12, ge=1, le=60)
    all_link: Link | None = None


class CharactersSettings(_Model):
    label: Short = ""
    title: Line = ""


class TopSettings(_Model):
    label: Short = ""
    title: Line = ""
    items: list[UUID] = Field(min_length=1, max_length=10)


class ChallengeSettings(_Model):
    label: Short = ""
    kind: TitleKind = "book"
    year: int = Field(ge=2000, le=2100)
    goal: int = Field(ge=1, le=1000)


class Quote(_Model):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)]
    source: Line = ""
    title_id: UUID | None = None


class QuotesSettings(_Model):
    label: Short = ""
    title: Line = ""
    items: list[Quote] = Field(min_length=1, max_length=20)


class PlaylistTrack(_Model):
    track: Required
    artist: Short = ""
    title_id: UUID | None = None
    url: Url | None = None

    @field_validator("url")
    @classmethod
    def _safe(cls, value: str | None) -> str | None:
        return safe_url(value) if value else None


class PlaylistSettings(_Model):
    label: Short = ""
    title: Line = ""
    lead: Text = ""
    items: list[PlaylistTrack] = Field(min_length=1, max_length=30)


class PostsSettings(_Model):
    label: Short = ""
    title: Line = ""
    kind: Literal["all", "review", "note"] = "all"
    limit: int = Field(default=6, ge=1, le=24)


SCHEMAS: dict[str, dict[int, type[_Model]]] = {
    "hero": {1: HeroSettings},
    "facts": {1: FactsSettings},
    "experience": {1: ExperienceSettings},
    "projects": {1: ProjectsSettings},
    "interests": {1: InterestsSettings},
    "contacts": {1: ContactsSettings},
    "resume": {1: ResumeSettings},
    "profile": {1: ProfileSettings},
    "now": {1: NowSettings},
    "shelf": {1: ShelfSettings},
    "characters": {1: CharactersSettings},
    "top": {1: TopSettings},
    "challenge": {1: ChallengeSettings},
    "quotes": {1: QuotesSettings},
    "playlist": {1: PlaylistSettings},
    "posts": {1: PostsSettings},
}

BlockType = Literal[
    "hero",
    "facts",
    "experience",
    "projects",
    "interests",
    "contacts",
    "resume",
    "profile",
    "now",
    "shelf",
    "characters",
    "top",
    "challenge",
    "quotes",
    "playlist",
    "posts",
]


class BlockIn(BaseModel):
    """Envelope the editor sends; `settings` is checked against the type's schema."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    type: BlockType
    version: int = Field(default=1, ge=1)
    hidden: bool = False
    settings: dict[str, Any]


def _errors(exc: ValidationError) -> list[dict[str, Any]]:
    return [
        {"loc": [str(p) for p in err["loc"]], "msg": err["msg"], "type": err["type"]}
        for err in exc.errors()
    ]


COMMON_BLOCKS = frozenset({"hero", "interests", "contacts"})
PERSONAL_ONLY = frozenset(
    {"profile", "now", "shelf", "characters", "top", "challenge", "quotes", "playlist", "posts"}
)
BUSINESS_ONLY = frozenset(SCHEMAS) - COMMON_BLOCKS - PERSONAL_ONLY


def allowed_for(site_kind: str) -> frozenset[str]:
    """Block types a site of this kind may use (catalog blocks only on personal sites)."""
    return COMMON_BLOCKS | (PERSONAL_ONLY if site_kind == "personal" else BUSINESS_ONLY)


def validate_blocks(blocks: list[BlockIn], site_kind: str | None = None) -> list[dict[str, Any]]:
    """Validate and normalise; returns plain dicts ready to be stored."""
    if len(blocks) > MAX_BLOCKS_PER_PAGE:
        raise InvalidBlockError("Too many blocks", {"max": MAX_BLOCKS_PER_PAGE})
    if len({b.id for b in blocks}) != len(blocks):
        raise InvalidBlockError("Block ids must be unique")
    allowed = allowed_for(site_kind) if site_kind else frozenset(SCHEMAS)
    result: list[dict[str, Any]] = []
    for index, block in enumerate(blocks):
        if block.type not in allowed:
            raise InvalidBlockError(
                "Block is not available for this kind of site",
                {"index": index, "type": block.type},
            )
        schema = SCHEMAS[block.type].get(block.version)
        if schema is None:
            raise InvalidBlockError("Unknown block version", {"index": index, "type": block.type})
        try:
            settings = schema.model_validate(block.settings)
        except ValidationError as exc:
            raise InvalidBlockError(
                "Block settings are invalid",
                {"index": index, "type": block.type, "errors": _errors(exc)},
            ) from exc
        result.append(
            {
                "id": str(block.id),
                "type": block.type,
                "version": block.version,
                "hidden": block.hidden,
                "settings": settings.model_dump(mode="json"),
            }
        )
    return result


def media_ids(blocks: list[dict[str, Any]]) -> set[UUID]:
    """Every uploaded file a list of validated blocks refers to."""
    return _media_ids([b["settings"] for b in blocks])
