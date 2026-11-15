from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from zxcrunet.sites.domain.site import Site, SiteKind, SiteStatus, Slug


@dataclass(frozen=True, slots=True)
class SiteFilter:
    #: Part of the slug or the title, lower-case.
    text: str | None = None
    status: SiteStatus | None = None
    kind: SiteKind | None = None
    owner_id: UUID | None = None
    ids: frozenset[UUID] | None = None


@dataclass(frozen=True, slots=True)
class ReservedName:
    slug: Slug
    reason: str


class SiteRepository(Protocol):
    async def get(self, site_id: UUID) -> Site | None: ...

    async def get_by_slug(self, slug: Slug) -> Site | None: ...

    async def list_by_owner(self, owner_id: UUID) -> list[Site]: ...

    async def count_by_owner(self, owner_id: UUID) -> int: ...

    async def slug_exists(self, slug: Slug) -> bool: ...

    async def add(self, site: Site) -> None: ...

    async def save(self, site: Site) -> None: ...

    async def delete(self, site: Site) -> None: ...

    async def search(self, where: SiteFilter, offset: int, limit: int) -> tuple[list[Site], int]:
        """Newest first; returns the page and the total number of matches."""

    async def count_by_status(self) -> dict[SiteStatus, int]: ...

    async def block_usage(self, limit: int) -> list[tuple[str, int, int]]:
        """(block type, number of blocks, number of sites) on published sites, most used first."""


class ReservedSlugs(Protocol):
    async def is_reserved(self, slug: Slug) -> bool: ...

    async def list(self) -> list[ReservedName]: ...

    async def add(self, name: ReservedName) -> None: ...

    async def remove(self, slug: Slug) -> bool:
        """False when the name was not reserved."""
