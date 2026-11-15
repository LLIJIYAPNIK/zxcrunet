"""Adapters to the sites context."""

from uuid import UUID

from zxcrunet.shared.application.admin import Staff
from zxcrunet.sites.application.admin import SiteDirectory, SuspendSite


class SitesReported:
    def __init__(self, sites: SiteDirectory) -> None:
        self._sites = sites

    async def published_at(self, host: str) -> UUID | None:
        return await self._sites.published_at(host)


class SitesSuspender:
    def __init__(self, suspend: SuspendSite) -> None:
        self._suspend = suspend

    async def suspend(self, staff: Staff, site_id: UUID, reason: str) -> None:
        await self._suspend(staff, site_id, reason)
