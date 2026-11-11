from collections.abc import AsyncIterator

import pytest
from dishka.integrations.fastapi import FastapiProvider
from httpx import ASGITransport, AsyncClient

from tests.fakes import Fakes, FakesProvider
from zxcrunet.identity.di import IdentityProvider
from zxcrunet.main import create_app
from zxcrunet.plans.di import PlansProvider
from zxcrunet.shared.config import Settings
from zxcrunet.shared.di import InfrastructureProvider

ORIGIN = {"Origin": "http://localhost:3000"}
BODY = {"email": "anna@example.com", "password": "correct horse battery"}


@pytest.fixture
def fakes() -> Fakes:
    return Fakes()


@pytest.fixture
async def client(fakes: Fakes) -> AsyncIterator[AsyncClient]:
    from dishka import make_async_container  # noqa: PLC0415

    settings = Settings(env="test")
    container = make_async_container(
        InfrastructureProvider(),
        FastapiProvider(),
        PlansProvider(),
        IdentityProvider(),
        FakesProvider(fakes),
        context={Settings: settings},
    )
    app = create_app(container, settings)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=ORIGIN
    ) as c:
        yield c
    await container.close()


async def test_register_sets_host_only_httponly_cookie(client: AsyncClient) -> None:
    response = await client.post("/api/auth/register", json=BODY)

    assert response.status_code == 201
    assert response.json()["email"] == "anna@example.com"
    assert response.json()["email_verified"] is False
    cookie = response.headers["set-cookie"].lower()
    assert cookie.startswith("zxc_session=")
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "domain=" not in cookie
    assert "path=/" in cookie


async def test_me_returns_user_and_plan_limits(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=BODY)

    response = await client.get("/api/auth/me")

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == "anna@example.com"
    assert body["user"]["role"] == "user"
    assert body["limits"] == {
        "plan": "free",
        "plan_title": "Бесплатный",
        "max_sites": 3,
        "max_custom_domains": 3,
        "max_upload_mb": 10,
    }


async def test_me_without_session_is_401(client: AsyncClient) -> None:
    response = await client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


async def test_logout_clears_cookie_and_session(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=BODY)

    response = await client.post("/api/auth/logout")

    assert response.status_code == 204
    assert 'zxc_session=""' in response.headers["set-cookie"]
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_login_errors_use_common_format(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=BODY)
    client.cookies.clear()

    response = await client.post("/api/auth/login", json={**BODY, "password": "wrong password"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


async def test_duplicate_register_is_409(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=BODY)

    response = await client.post("/api/auth/register", json=BODY)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


async def test_weak_password_is_422(client: AsyncClient) -> None:
    response = await client.post("/api/auth/register", json={**BODY, "password": "123"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "weak_password"


async def test_verify_email_flow(client: AsyncClient, fakes: Fakes) -> None:
    await client.post("/api/auth/register", json=BODY)

    response = await client.post(
        "/api/auth/verify-email", json={"token": fakes.mailer.last_token()}
    )

    assert response.status_code == 200
    assert response.json()["email_verified"] is True
    me = await client.get("/api/auth/me")
    assert me.json()["user"]["email_verified"] is True


async def test_password_reset_flow(client: AsyncClient, fakes: Fakes) -> None:
    await client.post("/api/auth/register", json=BODY)

    forgot = await client.post("/api/auth/password/forgot", json={"email": BODY["email"]})
    reset = await client.post(
        "/api/auth/password/reset",
        json={"token": fakes.mailer.last_token(), "password": "brand new password"},
    )

    assert forgot.status_code == 202
    assert reset.status_code == 204
    assert (await client.get("/api/auth/me")).status_code == 401
    login = await client.post("/api/auth/login", json={**BODY, "password": "brand new password"})
    assert login.status_code == 200


async def test_forgot_is_202_for_unknown_email(client: AsyncClient, fakes: Fakes) -> None:
    response = await client.post("/api/auth/password/forgot", json={"email": "who@example.com"})

    assert response.status_code == 202
    assert fakes.mailer.sent == []


async def test_mutating_request_without_origin_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/auth/login", json=BODY, headers={"Origin": ""})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "origin_not_allowed"


async def test_rate_limit_is_429(client: AsyncClient) -> None:
    for i in range(5):
        await client.post("/api/auth/register", json={**BODY, "email": f"u{i}@example.com"})

    response = await client.post("/api/auth/register", json={**BODY, "email": "u5@example.com"})

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
