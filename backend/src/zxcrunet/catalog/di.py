from dishka import Provider, Scope, provide, provide_all
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.catalog.application.use_cases import (
    CatalogCache,
    CreatePost,
    CreateTitle,
    DeletePost,
    DeleteTitle,
    GetPublicCatalog,
    ListCatalog,
    PersonalSites,
    UpdatePost,
    UpdateTitle,
)
from zxcrunet.catalog.domain.repository import PostRepository, TitleRepository
from zxcrunet.catalog.infrastructure.repository import (
    RedisCatalogCache,
    SitesPersonalSites,
    SqlPostRepository,
    SqlTitleRepository,
)
from zxcrunet.sites.application.use_cases import ResolveSite


class CatalogProvider(Provider):
    @provide(scope=Scope.APP)
    def cache(self, redis: Redis) -> CatalogCache:
        return RedisCatalogCache(redis)

    @provide(scope=Scope.REQUEST)
    def titles(self, session: AsyncSession) -> TitleRepository:
        return SqlTitleRepository(session)

    @provide(scope=Scope.REQUEST)
    def posts(self, session: AsyncSession) -> PostRepository:
        return SqlPostRepository(session)

    @provide(scope=Scope.REQUEST)
    def personal_sites(self, resolve: ResolveSite) -> PersonalSites:
        return SitesPersonalSites(resolve)

    use_cases = provide_all(
        ListCatalog,
        CreateTitle,
        UpdateTitle,
        DeleteTitle,
        CreatePost,
        UpdatePost,
        DeletePost,
        GetPublicCatalog,
        scope=Scope.REQUEST,
    )
