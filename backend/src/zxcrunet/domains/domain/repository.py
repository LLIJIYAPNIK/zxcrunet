from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from zxcrunet.domains.domain.domain import CustomDomain, DomainStatus, Hostname


@dataclass(frozen=True, slots=True)
class DomainFilter:
    #: Part of the host, lower-case.
    text: str | None = None
    status: DomainStatus | None = None
    site_id: UUID | None = None
    owner_id: UUID | None = None


class DomainRepository(Protocol):
    async def get(self, domain_id: UUID) -> CustomDomain | None: ...

    async def list_by_site(self, site_id: UUID) -> list[CustomDomain]: ...

    async def count_by_owner(self, owner_id: UUID) -> int: ...

    async def added_by_owner(self, owner_id: UUID, host: Hostname) -> bool: ...

    async def claimed(self, host: Hostname, *, except_id: UUID | None = None) -> bool:
        """Is the host verified or active for some site (other than `except_id`)?"""

    async def serving(self, host: Hostname) -> CustomDomain | None:
        """The verified or active domain record for this host, if any."""

    async def due(self, now: datetime, limit: int) -> list[UUID]:
        """Ids of domains whose next automatic check is due, oldest first."""

    async def serving_hosts(self, site_id: UUID) -> list[Hostname]:
        """Hosts of the site's verified and active domains."""

    async def search(
        self, where: DomainFilter, offset: int, limit: int
    ) -> tuple[list[CustomDomain], int]:
        """Newest first; returns the page and the total number of matches."""

    async def count_by_status(self) -> dict[DomainStatus, int]: ...

    async def add(self, domain: CustomDomain) -> None: ...

    async def save(self, domain: CustomDomain) -> None: ...

    async def delete(self, domain: CustomDomain) -> None: ...
