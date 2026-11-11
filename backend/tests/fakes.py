"""In-memory implementations of ports for unit and API tests."""

import secrets
from collections import defaultdict
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import UUID

from dishka import Provider, Scope, provide

from zxcrunet.identity.application.ports import (
    EmailMessage,
    Mailer,
    OneTimeTokenStore,
    PasswordHasher,
    SessionStore,
    TokenPurpose,
)
from zxcrunet.identity.domain.errors import EmailTakenError
from zxcrunet.identity.domain.repository import UserRepository
from zxcrunet.identity.domain.user import Email, User
from zxcrunet.plans.domain.plan import FREE_PLAN_CODE, Plan
from zxcrunet.plans.domain.repository import PlanRepository
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.rate_limit import RateLimiter
from zxcrunet.shared.application.uow import UnitOfWork

FREE_PLAN = Plan(
    code=FREE_PLAN_CODE,
    title="Бесплатный",
    max_sites=3,
    max_custom_domains=3,
    max_upload_mb=10,
)


class InMemoryUsers:
    def __init__(self) -> None:
        self.by_id: dict[UUID, User] = {}

    async def get(self, user_id: UUID) -> User | None:
        user = self.by_id.get(user_id)
        return replace(user) if user else None

    async def get_by_email(self, email: Email) -> User | None:
        for user in self.by_id.values():
            if user.email == email:
                return replace(user)
        return None

    async def add(self, user: User) -> None:
        if any(u.email == user.email for u in self.by_id.values()):
            raise EmailTakenError("Email is already registered")
        self.by_id[user.id] = replace(user)

    async def save(self, user: User) -> None:
        self.by_id[user.id] = replace(user)


class FakeUoW:
    def __init__(self) -> None:
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        pass


class FakeHasher:
    def hash(self, password: str) -> str:
        return f"hashed:{password}"

    def verify(self, password_hash: str, password: str) -> bool:
        return password_hash == f"hashed:{password}"

    def needs_rehash(self, password_hash: str) -> bool:
        return False


class InMemorySessions:
    def __init__(self) -> None:
        self.tokens: dict[str, UUID] = {}

    async def create(self, user_id: UUID, ttl_seconds: int) -> str:
        token = secrets.token_urlsafe(16)
        self.tokens[token] = user_id
        return token

    async def get_user_id(self, token: str) -> UUID | None:
        return self.tokens.get(token)

    async def delete(self, token: str) -> None:
        self.tokens.pop(token, None)

    async def delete_all(self, user_id: UUID) -> None:
        self.tokens = {t: u for t, u in self.tokens.items() if u != user_id}


class InMemoryTokens:
    def __init__(self) -> None:
        self.tokens: dict[tuple[TokenPurpose, str], UUID] = {}

    async def issue(self, purpose: TokenPurpose, user_id: UUID, ttl_seconds: int) -> str:
        token = secrets.token_urlsafe(16)
        self.tokens[(purpose, token)] = user_id
        return token

    async def consume(self, purpose: TokenPurpose, token: str) -> UUID | None:
        return self.tokens.pop((purpose, token), None)


class CapturingMailer:
    def __init__(self) -> None:
        self.sent: list[EmailMessage] = []

    async def send(self, message: EmailMessage) -> None:
        self.sent.append(message)

    def last_token(self) -> str:
        """Token from the link in the most recent email."""
        return self.sent[-1].text.split("token=")[1].split()[0]


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self.counts: dict[str, int] = defaultdict(int)

    async def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        self.counts[key] += 1
        return self.counts[key] <= limit


class AllowAllRateLimiter:
    async def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        return True


class FixedClock:
    def __init__(self, now: datetime | None = None) -> None:
        self.current = now or datetime(2026, 11, 11, 12, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.current

    def advance(self, **kwargs: float) -> None:
        self.current += timedelta(**kwargs)


class InMemoryPlans:
    async def get(self, code: str) -> Plan | None:
        return FREE_PLAN if code == FREE_PLAN_CODE else None


class Fakes:
    """One set of shared fakes for a test."""

    def __init__(self) -> None:
        self.users = InMemoryUsers()
        self.uow = FakeUoW()
        self.hasher = FakeHasher()
        self.sessions = InMemorySessions()
        self.tokens = InMemoryTokens()
        self.mailer = CapturingMailer()
        self.limiter = InMemoryRateLimiter()
        self.clock = FixedClock()
        self.plans = InMemoryPlans()


class FakesProvider(Provider):
    """Overrides every port with the in-memory fakes (registered last, so it wins)."""

    scope = Scope.APP

    def __init__(self, fakes: Fakes) -> None:
        super().__init__()
        self.fakes = fakes

    @provide
    def users(self) -> UserRepository:
        return self.fakes.users

    @provide
    def uow(self) -> UnitOfWork:
        return self.fakes.uow

    @provide
    def hasher(self) -> PasswordHasher:
        return self.fakes.hasher

    @provide
    def sessions(self) -> SessionStore:
        return self.fakes.sessions

    @provide
    def tokens(self) -> OneTimeTokenStore:
        return self.fakes.tokens

    @provide
    def mailer(self) -> Mailer:
        return self.fakes.mailer

    @provide
    def limiter(self) -> RateLimiter:
        return self.fakes.limiter

    @provide
    def clock(self) -> Clock:
        return self.fakes.clock

    @provide
    def plans(self) -> PlanRepository:
        return self.fakes.plans
