"""Building blocks of user content shared by contexts: safe links, uploaded files, text sizes."""

import re
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

SAFE_URL = re.compile(r"^(https?://|mailto:|tel:|tg://|#)[^\s<>\"']*$", re.IGNORECASE)

Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)]
Line = Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1200)]
Url = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class ContentModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


def safe_url(value: str) -> str:
    if not SAFE_URL.fullmatch(value):
        msg = "only http(s), mailto, tel, tg links and #anchors are allowed"
        raise ValueError(msg)
    return value


class Link(ContentModel):
    label: Short
    url: Url

    @field_validator("url")
    @classmethod
    def _safe(cls, value: str) -> str:
        return safe_url(value)


class MediaRef(ContentModel):
    id: UUID
    url: Annotated[str, StringConstraints(pattern=r"^/media/[A-Za-z0-9/_.-]+$", max_length=200)]
    width: int | None = None
    height: int | None = None


def media_ids(value: Any) -> set[UUID]:
    """Every uploaded file (a `{"id", "url": "/media/…"}` object) inside plain JSON data."""
    found: set[UUID] = set()

    def walk(item: Any) -> None:
        if isinstance(item, dict):
            if set(item) >= {"id", "url"} and str(item.get("url", "")).startswith("/media/"):
                found.add(UUID(str(item["id"])))
            for nested in item.values():
                walk(nested)
        elif isinstance(item, list):
            for nested in item:
                walk(nested)

    walk(value)
    return found
