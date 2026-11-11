from dishka import Provider, Scope, provide, provide_all
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.shared.config import Settings
from zxcrunet.sites.application.use_cases import (
    AddPage,
    CheckSlug,
    CreateSite,
    DeletePage,
    DeleteSite,
    GetMySite,
    ListMySites,
    PublishSite,
    ResolveSite,
    SiteCache,
    SitesConfig,
    UnpublishSite,
    UpdatePage,
    UpdateSite,
)
from zxcrunet.sites.domain.repository import ReservedSlugs, SiteRepository
from zxcrunet.sites.infrastructure.repository import (
    RedisSiteCache,
    SqlReservedSlugs,
    SqlSiteRepository,
)


class SitesProvider(Provider):
    @provide(scope=Scope.APP)
    def config(self, settings: Settings) -> SitesConfig:
        return SitesConfig(sites_domain=settings.sites_domain)

    @provide(scope=Scope.APP)
    def cache(self, redis: Redis) -> SiteCache:
        return RedisSiteCache(redis)

    @provide(scope=Scope.REQUEST)
    def sites(self, session: AsyncSession) -> SiteRepository:
        return SqlSiteRepository(session)

    @provide(scope=Scope.REQUEST)
    def reserved(self, session: AsyncSession) -> ReservedSlugs:
        return SqlReservedSlugs(session)

    use_cases = provide_all(
        ListMySites,
        CheckSlug,
        CreateSite,
        GetMySite,
        UpdateSite,
        DeleteSite,
        PublishSite,
        UnpublishSite,
        AddPage,
        UpdatePage,
        DeletePage,
        ResolveSite,
        scope=Scope.REQUEST,
    )
