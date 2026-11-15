"""What every owner (admin panel) use case shares: who acts, the audit trail, paging."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol
from uuid import UUID

#: Page size bounds of admin lists.
DEFAULT_LIMIT = 50
MAX_LIMIT = 100


@dataclass(frozen=True, slots=True)
class Staff:
    """The product owner acting in the admin panel.

    Only `identity`'s AuthorizeOwner creates it, after checking the role, so a use case
    that receives a Staff knows the caller is an owner.
    """

    user_id: UUID


@dataclass(frozen=True, slots=True)
class AuditEntry:
    actor_id: UUID
    #: `<target>.<verb>`, e.g. `user.block`, `site.suspend`, `report.resolve`.
    action: str
    target_type: str
    target_id: str
    at: datetime
    details: dict[str, Any] = field(default_factory=dict)


class AuditTrail(Protocol):
    """Port to the moderation context's audit log.

    `record` joins the use case's transaction: the entry is saved by the same commit
    as the action itself, or not at all.
    """

    async def record(self, entry: AuditEntry) -> None: ...


@dataclass(frozen=True, slots=True)
class Paging:
    offset: int = 0
    limit: int = DEFAULT_LIMIT

    def __post_init__(self) -> None:
        object.__setattr__(self, "offset", max(self.offset, 0))
        object.__setattr__(self, "limit", min(max(self.limit, 1), MAX_LIMIT))


@dataclass(frozen=True, slots=True)
class Slice[T]:
    """One page of a list plus the total number of matches."""

    items: list[T]
    total: int


def search_text(raw: str | None) -> str | None:
    """A search box value: trimmed, lower-case, at most 100 chars; None when empty."""
    value = " ".join((raw or "").split()).lower()[:100]
    return value or None
