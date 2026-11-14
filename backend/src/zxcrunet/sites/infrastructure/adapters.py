"""Adapters to the other contexts."""

from uuid import UUID

from zxcrunet.domains.application.use_cases import SiteAtHost


class DomainsCustomHosts:
    def __init__(self, site_at: SiteAtHost) -> None:
        self._site_at = site_at

    async def site_at(self, host: str) -> UUID | None:
        return await self._site_at(host)
