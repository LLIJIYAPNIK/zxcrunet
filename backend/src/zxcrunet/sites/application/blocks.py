"""Block registry: one Pydantic schema per block type and version.

The frontend mirrors every schema in zod (`frontend/src/blocks`). The backend is the
authority: blocks are validated here before they reach the draft.
"""

import re
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

from zxcrunet.shared.domain.errors import InvalidInputError

MAX_BLOCKS_PER_PAGE = 40
SAFE_URL = re.compile(r"^(https?://|mailto:|tg://|#)[^\s<>\"']*$", re.IGNORECASE)

Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)]
Line = Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1200)]


class InvalidBlockError(InvalidInputError):
    code = "invalid_block"


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Link(_Model):
    label: Short
    url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]

    @field_validator("url")
    @classmethod
    def _safe(cls, value: str) -> str:
        if not SAFE_URL.fullmatch(value):
            msg = "only http(s), mailto, tg links and #anchors are allowed"
            raise ValueError(msg)
        return value


class MediaRef(_Model):
    id: UUID
    url: Annotated[str, StringConstraints(pattern=r"^/media/[A-Za-z0-9/_.-]+$", max_length=200)]
    width: int | None = None
    height: int | None = None


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
    url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]

    @field_validator("url")
    @classmethod
    def _safe(cls, value: str) -> str:
        return Link(label="x", url=value).url


class ContactsSettings(_Model):
    title: Line
    title_muted: Short = ""
    items: list[Contact] = Field(min_length=1, max_length=8)


class ResumeSettings(_Model):
    label: Short
    file: MediaRef


SCHEMAS: dict[str, dict[int, type[_Model]]] = {
    "hero": {1: HeroSettings},
    "facts": {1: FactsSettings},
    "experience": {1: ExperienceSettings},
    "projects": {1: ProjectsSettings},
    "interests": {1: InterestsSettings},
    "contacts": {1: ContactsSettings},
    "resume": {1: ResumeSettings},
}

BlockType = Literal["hero", "facts", "experience", "projects", "interests", "contacts", "resume"]


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


def validate_blocks(blocks: list[BlockIn]) -> list[dict[str, Any]]:
    """Validate and normalise; returns plain dicts ready to be stored."""
    if len(blocks) > MAX_BLOCKS_PER_PAGE:
        raise InvalidBlockError("Too many blocks", {"max": MAX_BLOCKS_PER_PAGE})
    if len({b.id for b in blocks}) != len(blocks):
        raise InvalidBlockError("Block ids must be unique")
    result: list[dict[str, Any]] = []
    for index, block in enumerate(blocks):
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
    found: set[UUID] = set()

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            if set(value) >= {"id", "url"} and str(value.get("url", "")).startswith("/media/"):
                found.add(UUID(str(value["id"])))
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk([b["settings"] for b in blocks])
    return found
