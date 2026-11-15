"""The dashboard asks the other contexts through their application services."""

from datetime import datetime
from uuid import UUID

from zxcrunet.analytics.application.use_cases import BlockCount, ServiceTotals
from zxcrunet.domains.application.admin import DomainTotals
from zxcrunet.identity.application.admin import UserDirectory
from zxcrunet.moderation.application.use_cases import OpenReports
from zxcrunet.sites.application.admin import SiteDirectory


class SitesPublished:
    def __init__(self, sites: SiteDirectory) -> None:
        self._sites = sites

    async def published_at(self, host: str) -> UUID | None:
        return await self._sites.published_at(host)


class ContextFigures:
    def __init__(
        self,
        users: UserDirectory,
        sites: SiteDirectory,
        domains: DomainTotals,
        reports: OpenReports,
    ) -> None:
        self._users = users
        self._sites = sites
        self._domains = domains
        self._reports = reports

    async def collect(self, since: datetime) -> ServiceTotals:
        users = await self._users.totals(since)
        sites = await self._sites.totals()
        domains = await self._domains()
        return ServiceTotals(
            users=users.users,
            registrations=users.registrations,
            sites={status.value: count for status, count in sites.by_status.items()},
            domains={status.value: count for status, count in domains.items()},
            open_reports=await self._reports(),
            blocks=[BlockCount(b.type, b.blocks, b.sites) for b in sites.blocks],
        )
