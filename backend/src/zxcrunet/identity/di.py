from collections.abc import AsyncIterator

from dishka import Provider, Scope, provide, provide_all
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.identity.application.emails import EmailTemplates
from zxcrunet.identity.application.ports import (
    Mailer,
    OneTimeTokenStore,
    PasswordHasher,
    SessionStore,
)
from zxcrunet.identity.application.use_cases import (
    AuthPolicy,
    CreateOwner,
    GetCurrentUser,
    Login,
    Logout,
    RegisterUser,
    RequestPasswordReset,
    ResendVerification,
    ResetPassword,
    VerifyEmail,
)
from zxcrunet.identity.domain.repository import UserRepository
from zxcrunet.identity.infrastructure.hasher import Argon2PasswordHasher
from zxcrunet.identity.infrastructure.mailer import QueuedMailer
from zxcrunet.identity.infrastructure.redis_stores import (
    RedisOneTimeTokenStore,
    RedisSessionStore,
)
from zxcrunet.identity.infrastructure.repository import SqlUserRepository
from zxcrunet.shared.config import Settings


class IdentityProvider(Provider):
    @provide(scope=Scope.APP)
    def policy(self, settings: Settings) -> AuthPolicy:
        return AuthPolicy(
            session_ttl_seconds=settings.session_ttl_days * 24 * 3600,
            verify_email_ttl_seconds=settings.verify_email_ttl_hours * 3600,
            reset_password_ttl_seconds=settings.reset_password_ttl_minutes * 60,
            register_per_ip_per_hour=settings.register_per_ip_per_hour,
        )

    @provide(scope=Scope.APP)
    def templates(self, settings: Settings) -> EmailTemplates:
        return EmailTemplates(settings.public_url)

    @provide(scope=Scope.APP)
    def hasher(self) -> PasswordHasher:
        return Argon2PasswordHasher()

    @provide(scope=Scope.APP)
    def sessions(self, redis: Redis) -> SessionStore:
        return RedisSessionStore(redis)

    @provide(scope=Scope.APP)
    def tokens(self, redis: Redis) -> OneTimeTokenStore:
        return RedisOneTimeTokenStore(redis)

    @provide(scope=Scope.APP)
    async def mailer(self) -> AsyncIterator[Mailer]:
        from zxcrunet.worker import broker, send_email  # noqa: PLC0415 — the broker reads settings on import

        await broker.startup()
        yield QueuedMailer(send_email)
        await broker.shutdown()

    @provide(scope=Scope.REQUEST)
    def users(self, session: AsyncSession) -> UserRepository:
        return SqlUserRepository(session)

    use_cases = provide_all(
        RegisterUser,
        Login,
        Logout,
        GetCurrentUser,
        VerifyEmail,
        ResendVerification,
        RequestPasswordReset,
        ResetPassword,
        CreateOwner,
        scope=Scope.REQUEST,
    )
