"""Auth against real Postgres and Redis. Needs `alembic upgrade head` beforehand."""

import uuid
from collections.abc import AsyncIterator

import pytest
from dishka import Provider, Scope, make_async_container
from dishka.integrations.fastapi import FastapiProvider
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis

from tests.fakes import AllowAllRateLimiter, CapturingMailer
from zxcrunet.identity.application.ports import Mailer
from zxcrunet.identity.di import IdentityProvider
from zxcrunet.identity.infrastructure.redis_stores import RedisSessionStore
from zxcrunet.main import create_app
from zxcrunet.plans.di import PlansProvider
from zxcrunet.shared.application.rate_limit import RateLimiter
from zxcrunet.shared.config import Settings
from zxcrunet.shared.di import InfrastructureProvider
from zxcrunet.shared.infrastructure.rate_limit import RedisRateLimiter

pytestmark = pytest.mark.integration

ORIGIN = {"Origin": "http://localhost:3000"}
PASSWORD = "correct horse battery"


@pytest.fixture
def mailer() -> CapturingMailer:
    return CapturingMailer()


@pytest.fixture
async def client(mailer: CapturingMailer) -> AsyncIterator[AsyncClient]:
    overrides = Provider(scope=Scope.APP)
    overrides.provide(lambda: mailer, provides=Mailer)
    overrides.provide(AllowAllRateLimiter, provides=RateLimiter)
    settings = Settings()
    container = make_async_container(
        InfrastructureProvider(),
        FastapiProvider(),
        PlansProvider(),
        IdentityProvider(),
        overrides,
        context={Settings: settings},
    )
    app = create_app(container, settings)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=ORIGIN
    ) as c:
        yield c
    await container.close()


def unique_email() -> str:
    return f"it-{uuid.uuid4().hex[:12]}@example.com"


async def test_register_verify_logout_login(client: AsyncClient, mailer: CapturingMailer) -> None:
    email = unique_email()

    registered = await client.post(
        "/api/auth/register", json={"email": email, "password": PASSWORD}
    )
    assert registered.status_code == 201

    me = await client.get("/api/auth/me")
    assert me.json()["user"]["email"] == email
    assert me.json()["limits"]["plan"] == "free", "the free plan is seeded by the migration"

    verified = await client.post("/api/auth/verify-email", json={"token": mailer.last_token()})
    assert verified.json()["email_verified"] is True

    assert (await client.post("/api/auth/logout")).status_code == 204
    assert (await client.get("/api/auth/me")).status_code == 401

    login = await client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200
    assert login.json()["email_verified"] is True


async def test_duplicate_email_hits_unique_constraint(client: AsyncClient) -> None:
    email = unique_email()
    body = {"email": email, "password": PASSWORD}

    await client.post("/api/auth/register", json=body)
    again = await client.post("/api/auth/register", json={**body, "email": email.upper()})

    assert again.status_code == 409


async def test_password_reset_revokes_sessions(
    client: AsyncClient, mailer: CapturingMailer
) -> None:
    email = unique_email()
    await client.post("/api/auth/register", json={"email": email, "password": PASSWORD})
    old_cookie = client.cookies.get("zxc_session")

    await client.post("/api/auth/password/forgot", json={"email": email})
    reset = await client.post(
        "/api/auth/password/reset",
        json={"token": mailer.last_token(), "password": "brand new password"},
    )

    assert reset.status_code == 204
    me = await client.get("/api/auth/me", cookies={"zxc_session": old_cookie or ""})
    assert me.status_code == 401


@pytest.fixture
async def redis() -> AsyncIterator[Redis]:
    client = Redis.from_url(Settings().redis_url)
    yield client
    await client.aclose()


async def test_redis_rate_limiter_counts_within_window(redis: Redis) -> None:
    limiter = RedisRateLimiter(redis, prefix=f"rl-test-{uuid.uuid4().hex}")

    results = [await limiter.hit("k", limit=2, window_seconds=60) for _ in range(3)]

    assert results == [True, True, False]


async def test_redis_sessions_delete_all(redis: Redis) -> None:
    store = RedisSessionStore(redis)
    user_id = uuid.uuid4()
    a = await store.create(user_id, 60)
    b = await store.create(user_id, 60)

    await store.delete_all(user_id)

    assert await store.get_user_id(a) is None
    assert await store.get_user_id(b) is None
