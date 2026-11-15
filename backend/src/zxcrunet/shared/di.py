from collections.abc import AsyncIterator

from dishka import Provider, Scope, from_context, provide
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from taskiq import AsyncBroker

from zxcrunet.shared.application.clock import Clock, SystemClock
from zxcrunet.shared.application.rate_limit import RateLimiter
from zxcrunet.shared.application.uow import UnitOfWork
from zxcrunet.shared.config import Settings
from zxcrunet.shared.infrastructure.db import create_engine
from zxcrunet.shared.infrastructure.rate_limit import RedisRateLimiter
from zxcrunet.shared.infrastructure.uow import SqlAlchemyUnitOfWork


class InfrastructureProvider(Provider):
    """Shared infrastructure: settings, database, Redis, clock, rate limiting."""

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

    @provide(scope=Scope.REQUEST)
    def uow(self, session: AsyncSession) -> UnitOfWork:
        return SqlAlchemyUnitOfWork(session)

    @provide(scope=Scope.APP)
    async def redis(self, settings: Settings) -> AsyncIterator[Redis]:
        client = Redis.from_url(settings.redis_url)
        yield client
        await client.aclose()

    @provide(scope=Scope.APP)
    def rate_limiter(self, redis: Redis) -> RateLimiter:
        return RedisRateLimiter(redis)

    @provide(scope=Scope.APP)
    async def broker(self) -> AsyncIterator[AsyncBroker]:
        """The Taskiq broker, started once for every producer of tasks in this process."""
        from zxcrunet.worker import broker  # noqa: PLC0415 — the broker reads settings on import

        await broker.startup()
        yield broker
        await broker.shutdown()

    @provide(scope=Scope.APP)
    def clock(self) -> Clock:
        return SystemClock()
