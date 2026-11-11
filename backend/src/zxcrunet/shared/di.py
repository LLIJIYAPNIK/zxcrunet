from collections.abc import AsyncIterator

from dishka import Provider, Scope, from_context, provide
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from zxcrunet.shared.config import Settings
from zxcrunet.shared.infrastructure.db import create_engine


class InfrastructureProvider(Provider):
    """Shared infrastructure: settings, database and Redis connections."""

    settings = from_context(provides=Settings, scope=Scope.APP)

    @provide(scope=Scope.APP)
    async def engine(self, settings: Settings) -> AsyncIterator[AsyncEngine]:
        engine = create_engine(settings.database_url)
        yield engine
        await engine.dispose()

    @provide(scope=Scope.APP)
    def session_factory(self, engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
        return async_sessionmaker(engine, expire_on_commit=False)

    @provide(scope=Scope.REQUEST)
    async def session(
        self, factory: async_sessionmaker[AsyncSession]
    ) -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    @provide(scope=Scope.APP)
    async def redis(self, settings: Settings) -> AsyncIterator[Redis]:
        client = Redis.from_url(settings.redis_url)
        yield client
        await client.aclose()
