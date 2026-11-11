from dishka import Provider, Scope, provide
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine

from zxcrunet.shared.config import Settings
from zxcrunet.system.application.readiness import CheckReadiness
from zxcrunet.system.infrastructure.probes import PostgresProbe, RedisProbe


class SystemProvider(Provider):
    @provide(scope=Scope.APP)
    def check_readiness(
        self, settings: Settings, engine: AsyncEngine, redis: Redis
    ) -> CheckReadiness:
        return CheckReadiness(
            [PostgresProbe(engine), RedisProbe(redis)],
            timeout_seconds=settings.probe_timeout_seconds,
        )
