from dishka import Provider, Scope, provide, provide_all
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.analytics.application.use_cases import (
    Dashboard,
    FlushViews,
    PublishedSites,
    RecordView,
    ServiceFigures,
    SiteViews,
    ViewCounter,
)
from zxcrunet.analytics.domain.repository import ViewStats
from zxcrunet.analytics.infrastructure.adapters import ContextFigures, SitesPublished
from zxcrunet.analytics.infrastructure.repository import RedisViewCounter, SqlViewStats
from zxcrunet.domains.application.admin import DomainTotals
from zxcrunet.identity.application.admin import UserDirectory
from zxcrunet.moderation.application.use_cases import OpenReports
from zxcrunet.sites.application.admin import SiteDirectory


class AnalyticsProvider(Provider):
    @provide(scope=Scope.APP)
    def counter(self, redis: Redis) -> ViewCounter:
        return RedisViewCounter(redis)

    @provide(scope=Scope.REQUEST)
    def stats(self, session: AsyncSession) -> ViewStats:
        return SqlViewStats(session)

    @provide(scope=Scope.REQUEST)
    def sites(self, directory: SiteDirectory) -> PublishedSites:
        return SitesPublished(directory)

    @provide(scope=Scope.REQUEST)
    def figures(
        self,
        users: UserDirectory,
        sites: SiteDirectory,
        domains: DomainTotals,
        reports: OpenReports,
    ) -> ServiceFigures:
        return ContextFigures(users, sites, domains, reports)

    use_cases = provide_all(RecordView, FlushViews, Dashboard, SiteViews, scope=Scope.REQUEST)
