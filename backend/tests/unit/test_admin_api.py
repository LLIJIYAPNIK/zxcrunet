"""The admin API and the public events on in-memory fakes: roles, origins, wiring."""

from collections.abc import AsyncIterator

import pytest
from dishka import make_async_container
from httpx import ASGITransport, AsyncClient

from tests.fakes import Fakes, FakesProvider
from zxcrunet.identity.domain.user import Email, User
from zxcrunet.main import app_providers, create_app
from zxcrunet.shared.config import Settings

ORIGIN = {"Origin": "http://localhost:3000"}
SITE_ORIGIN = {"Origin": "http://anna.localhost:3000"}
BROWSER = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0"}
PASSWORD = "correct horse battery"

ADMIN_GETS = [
    "/api/admin/dashboard",
    "/api/admin/users",
    "/api/admin/plans",
    "/api/admin/sites",
    "/api/admin/reserved-slugs",
    "/api/admin/domains",
    "/api/admin/reports",
    "/api/admin/audit",
]


@pytest.fixture
def fakes() -> Fakes:
    return Fakes()


@pytest.fixture
async def client(fakes: Fakes) -> AsyncIterator[AsyncClient]:
    settings = Settings(env="test", sites_domain="localhost")
    container = make_async_container(
        *app_providers(), FakesProvider(fakes), context={Settings: settings}
    )
    app = create_app(container, settings)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=ORIGIN) as c:
        yield c
    await container.close()


async def sign_in(client: AsyncClient, fakes: Fakes, email: str, *, owner: bool) -> User:
    user = User(
        email=Email(email), password_hash=f"hashed:{PASSWORD}", created_at=fakes.clock.now()
    )
    user.verify_email(fakes.clock.now())
    if owner:
        user.promote_to_owner()
    await fakes.users.add(user)
    client.cookies.clear()
    response = await client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return user


async def published_site(client: AsyncClient, fakes: Fakes) -> str:
    await sign_in(client, fakes, "anna@example.com", owner=False)
    created = await client.post(
        "/api/sites", json={"kind": "business", "slug": "anna", "title": "Анна"}
    )
    site_id: str = created.json()["id"]
    await client.post(f"/api/sites/{site_id}/publish")
    return site_id


@pytest.mark.parametrize("path", ADMIN_GETS)
async def test_admin_needs_a_session(client: AsyncClient, path: str) -> None:
    response = await client.get(path)

    assert response.status_code == 401


@pytest.mark.parametrize("path", ADMIN_GETS)
async def test_admin_is_for_the_owner_only(client: AsyncClient, fakes: Fakes, path: str) -> None:
    await sign_in(client, fakes, "anna@example.com", owner=False)

    response = await client.get(path)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "owner_only"


async def test_owner_sees_every_admin_list(client: AsyncClient, fakes: Fakes) -> None:
    await sign_in(client, fakes, "owner@example.com", owner=True)

    for path in ADMIN_GETS:
        response = await client.get(path)
        assert response.status_code == 200, (path, response.text)


async def test_admin_writes_check_origin(client: AsyncClient, fakes: Fakes) -> None:
    owner = await sign_in(client, fakes, "owner@example.com", owner=True)

    response = await client.post(
        f"/api/admin/users/{owner.id}/block", json={}, headers={"Origin": "https://evil.test"}
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "origin_not_allowed"


async def test_report_from_the_site_itself(client: AsyncClient, fakes: Fakes) -> None:
    site_id = await published_site(client, fakes)
    client.cookies.clear()
    body = {"host": "anna.localhost:3000", "path": "/", "reason": "spam", "message": ""}

    accepted = await client.post("/api/public/events/reports", json=body, headers=SITE_ORIGIN)
    foreign = await client.post(
        "/api/public/events/reports", json=body, headers={"Origin": "https://evil.test"}
    )

    assert accepted.status_code == 201, accepted.text
    assert foreign.status_code == 403
    assert [str(r.site_id) for r in fakes.reports.by_id.values()] == [site_id]


async def test_view_beacon(client: AsyncClient, fakes: Fakes) -> None:
    await published_site(client, fakes)
    client.cookies.clear()
    body = {"host": "anna.localhost:3000", "path": "/"}

    counted = await client.post(
        "/api/public/events/views", json=body, headers={**SITE_ORIGIN, **BROWSER}
    )
    bot = await client.post(
        "/api/public/events/views",
        json=body,
        headers={**SITE_ORIGIN, "User-Agent": "Googlebot/2.1"},
    )

    assert counted.status_code == bot.status_code == 204
    assert sum(fakes.view_counter.views.values()) == 1


async def test_owner_takes_a_site_down_from_a_report(client: AsyncClient, fakes: Fakes) -> None:
    site_id = await published_site(client, fakes)
    body = {"host": "anna.localhost", "reason": "fraud", "message": "просит деньги"}
    await client.post("/api/public/events/reports", json=body, headers=SITE_ORIGIN)
    await sign_in(client, fakes, "owner@example.com", owner=True)

    queue = (await client.get("/api/admin/reports", params={"status": "open"})).json()
    decided = await client.post(
        f"/api/admin/reports/{queue['items'][0]['id']}/decision",
        json={"decision": "suspend", "note": "мошенничество"},
    )
    site = (await client.get(f"/api/admin/sites/{site_id}")).json()
    log = (await client.get("/api/admin/audit")).json()

    assert queue["counts"] == {"open": 1, "resolved": 0, "dismissed": 0}
    assert decided.status_code == 200
    assert site["status"] == "suspended"
    assert site["owner_email"] == "anna@example.com"
    assert [e["action"] for e in log["items"]] == ["report.resolved", "site.suspend"]
    assert log["items"][0]["actor_email"] == "owner@example.com"
