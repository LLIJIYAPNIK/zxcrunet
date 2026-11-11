"""In-memory implementations of ports for unit and API tests."""

import copy
import secrets
from collections import defaultdict
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Literal
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
from zxcrunet.sites.application.use_cases import ResolvedSite, SiteCache
from zxcrunet.sites.domain.errors import SlugTakenError
from zxcrunet.sites.domain.repository import ReservedSlugs, SiteRepository
from zxcrunet.sites.domain.site import Site, Slug

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


class InMemorySites:
    def __init__(self) -> None:
        self.by_id: dict[UUID, Site] = {}

    async def get(self, site_id: UUID) -> Site | None:
        site = self.by_id.get(site_id)
        return copy.deepcopy(site) if site else None

    async def get_by_slug(self, slug: Slug) -> Site | None:
        for site in self.by_id.values():
            if site.slug == slug:
                return copy.deepcopy(site)
        return None

    async def list_by_owner(self, owner_id: UUID) -> list[Site]:
        return [copy.deepcopy(s) for s in self.by_id.values() if s.owner_id == owner_id]

    async def count_by_owner(self, owner_id: UUID) -> int:
        return sum(1 for s in self.by_id.values() if s.owner_id == owner_id)

    async def slug_exists(self, slug: Slug) -> bool:
        return any(s.slug == slug for s in self.by_id.values())

    async def add(self, site: Site) -> None:
        if await self.slug_exists(site.slug):
            raise SlugTakenError("This address is taken")
        self.by_id[site.id] = copy.deepcopy(site)

    async def save(self, site: Site) -> None:
        self.by_id[site.id] = copy.deepcopy(site)

    async def delete(self, site: Site) -> None:
        self.by_id.pop(site.id, None)


class InMemoryReservedSlugs:
    def __init__(self, names: set[str] | None = None) -> None:
        self.names = names if names is not None else {"www", "api", "admin", "app"}

    async def is_reserved(self, slug: Slug) -> bool:
        return slug.value in self.names


class InMemorySiteCache:
    def __init__(self) -> None:
        self.data: dict[str, ResolvedSite | None] = {}
        self.invalidated: list[str] = []

    async def get(self, host: str) -> ResolvedSite | Literal[False] | None:
        return self.data.get(host, False)

    async def set(self, host: str, value: ResolvedSite | None) -> None:
        self.data[host] = value

    async def invalidate(self, *hosts: str) -> None:
        self.invalidated.extend(hosts)
        for host in hosts:
            self.data.pop(host, None)


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
        self.sites = InMemorySites()
        self.reserved = InMemoryReservedSlugs()
        self.site_cache = InMemorySiteCache()


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

    @provide
    def sites(self) -> SiteRepository:
        return self.fakes.sites

    @provide
    def reserved(self) -> ReservedSlugs:
        return self.fakes.reserved

    @provide
    def site_cache(self) -> SiteCache:
        return self.fakes.site_cache
