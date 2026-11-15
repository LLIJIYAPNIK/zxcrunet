"""Adapters to the other contexts."""

from uuid import UUID

from zxcrunet.domains.application.use_cases import SiteAtHost, SiteHosts


class DomainsCustomHosts:
    def __init__(self, site_at: SiteAtHost, hosts: SiteHosts) -> None:
        self._site_at = site_at
        self._hosts = hosts

    async def site_at(self, host: str) -> UUID | None:
        return await self._site_at(host)

    async def hosts_of(self, site_id: UUID) -> list[str]:
        return await self._hosts(site_id)
