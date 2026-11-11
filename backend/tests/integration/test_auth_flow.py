"""Auth against real Postgres and Redis. Needs `alembic upgrade head` beforehand."""

import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient
from redis.asyncio import Redis

from tests.fakes import CapturingMailer
from zxcrunet.identity.infrastructure.redis_stores import RedisSessionStore
from zxcrunet.shared.config import Settings
from zxcrunet.shared.infrastructure.rate_limit import RedisRateLimiter

pytestmark = pytest.mark.integration

PASSWORD = "correct horse battery"


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
