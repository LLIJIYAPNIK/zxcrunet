from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Protocol
from uuid import UUID

from zxcrunet.shared.domain.errors import InvalidInputError, NotFoundError
from zxcrunet.shared.domain.ids import uuid7


class UnsupportedFileError(InvalidInputError):
    code = "unsupported_file"


class FileTooLargeError(InvalidInputError):
    code = "file_too_large"


class MediaNotFoundError(NotFoundError):
    code = "media_not_found"


class MediaKind(StrEnum):
    IMAGE = "image"
    DOCUMENT = "document"


class Purpose(StrEnum):
    """What the upload is for: decides which file types are accepted."""

    IMAGE = "image"
    RESUME = "resume"


# Magic numbers: the type is decided by the bytes, never by the name or the browser.
_SIGNATURES: list[tuple[bytes, int, str]] = [
    (b"\xff\xd8\xff", 0, "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", 0, "image/png"),
    (b"GIF87a", 0, "image/gif"),
    (b"GIF89a", 0, "image/gif"),
    (b"%PDF-", 0, "application/pdf"),
]


RIFF_HEADER = 12


def sniff_mime(data: bytes) -> str | None:
    if len(data) >= RIFF_HEADER and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    for magic, offset, mime in _SIGNATURES:
        if data[offset : offset + len(magic)] == magic:
            return mime
    return None


ACCEPTED: dict[Purpose, frozenset[str]] = {
    Purpose.IMAGE: frozenset({"image/jpeg", "image/png", "image/gif", "image/webp"}),
    Purpose.RESUME: frozenset({"application/pdf"}),
}


@dataclass(slots=True)
class MediaFile:
    owner_id: UUID
    kind: MediaKind
    mime: str
    size: int
    key: str
    created_at: datetime
    width: int | None = None
    height: int | None = None
    id: UUID = field(default_factory=uuid7)


class MediaRepository(Protocol):
    async def add(self, media: MediaFile) -> None: ...

    async def owned_ids(self, owner_id: UUID, ids: set[UUID]) -> set[UUID]:
        """Subset of `ids` that exist and belong to `owner_id`."""
