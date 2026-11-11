from collections.abc import AsyncIterator

import pytest
from dishka import make_async_container
from dishka.integrations.fastapi import FastapiProvider
from httpx import ASGITransport, AsyncClient

from tests.fakes import Fakes, FakesProvider
from zxcrunet.identity.di import IdentityProvider
from zxcrunet.main import create_app
from zxcrunet.plans.di import PlansProvider
from zxcrunet.shared.config import Settings
from zxcrunet.shared.di import InfrastructureProvider
from zxcrunet.sites.di import SitesProvider

ORIGIN = {"Origin": "http://localhost:3000"}
CREDS = {"email": "anna@example.com", "password": "correct horse battery"}


@pytest.fixture
def fakes() -> Fakes:
    return Fakes()


@pytest.fixture
async def client(fakes: Fakes) -> AsyncIterator[AsyncClient]:
    settings = Settings(env="test", sites_domain="localhost")
    container = make_async_container(
        InfrastructureProvider(),
        FastapiProvider(),
        PlansProvider(),
        IdentityProvider(),
        SitesProvider(),
        FakesProvider(fakes),
        context={Settings: settings},
    )
    app = create_app(container, settings)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=ORIGIN
    ) as c:
        yield c
    await container.close()


async def signed_in(client: AsyncClient, fakes: Fakes, *, verified: bool = True) -> None:
    await client.post("/api/auth/register", json=CREDS)
    if verified:
        await client.post("/api/auth/verify-email", json={"token": fakes.mailer.last_token()})


async def test_sites_need_a_session(client: AsyncClient) -> None:
    response = await client.get("/api/sites")

    assert response.status_code == 401


async def test_create_publish_and_resolve(client: AsyncClient, fakes: Fakes) -> None:
    await signed_in(client, fakes)

    created = await client.post(
        "/api/sites", json={"kind": "business", "slug": "anna", "title": "Анна Волкова"}
    )
    site_id = created.json()["id"]
    assert created.status_code == 201
    assert created.json()["host"] == "anna.localhost"
    assert created.json()["status"] == "draft"
    assert [p["path"] for p in created.json()["pages"]] == [""]

    assert (await client.get("/api/public/sites/resolve?host=anna.localhost")).status_code == 404

    published = await client.post(f"/api/sites/{site_id}/publish")
    assert published.json()["status"] == "published"
    assert published.json()["has_unpublished_changes"] is False

    resolved = await client.get("/api/public/sites/resolve", params={"host": "anna.localhost"})
    assert resolved.status_code == 200
    assert resolved.json()["content"]["title"] == "Анна Волкова"
    assert resolved.json()["content"]["theme"] == {"accent": "#5ab9fc", "second": "#ffb545"}


async def test_publish_without_verified_email_is_403(client: AsyncClient, fakes: Fakes) -> None:
    await signed_in(client, fakes, verified=False)
    site_id = (
        await client.post("/api/sites", json={"kind": "personal", "slug": "anna", "title": "А"})
    ).json()["id"]

    response = await client.post(f"/api/sites/{site_id}/publish")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "email_not_verified"


async def test_slug_check_and_errors(client: AsyncClient, fakes: Fakes) -> None:
    await signed_in(client, fakes)
    await client.post("/api/sites", json={"kind": "business", "slug": "anna", "title": "Анна"})

    taken = await client.get("/api/sites/slug-check", params={"slug": "anna"})
    duplicate = await client.post(
        "/api/sites", json={"kind": "business", "slug": "anna", "title": "Ещё"}
    )
    reserved = await client.post(
        "/api/sites", json={"kind": "business", "slug": "admin", "title": "Ещё"}
    )

    assert taken.json() == {"slug": "anna", "available": False, "reason": "slug_taken"}
    assert (duplicate.status_code, duplicate.json()["error"]["code"]) == (409, "slug_taken")
    assert (reserved.status_code, reserved.json()["error"]["code"]) == (422, "slug_reserved")


async def test_plan_limit_is_403(client: AsyncClient, fakes: Fakes) -> None:
    await signed_in(client, fakes)
    for slug in ("one", "two", "three"):
        await client.post("/api/sites", json={"kind": "business", "slug": slug, "title": slug})

    response = await client.post(
        "/api/sites", json={"kind": "business", "slug": "four", "title": "four"}
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "plan_limit_exceeded"
    assert response.json()["error"]["details"]["allowed"] == 3


async def test_update_pages_and_delete(client: AsyncClient, fakes: Fakes) -> None:
    await signed_in(client, fakes)
    site_id = (
        await client.post("/api/sites", json={"kind": "business", "slug": "anna", "title": "А"})
    ).json()["id"]

    patched = await client.patch(
        f"/api/sites/{site_id}", json={"title": "Анна", "accent": "#ff4f8b"}
    )
    page = await client.post(
        f"/api/sites/{site_id}/pages", json={"path": "projects", "title": "Проекты"}
    )
    page_id = page.json()["id"]
    renamed = await client.patch(f"/api/sites/{site_id}/pages/{page_id}", json={"title": "Работы"})
    removed = await client.delete(f"/api/sites/{site_id}/pages/{page_id}")
    deleted = await client.delete(f"/api/sites/{site_id}")

    assert patched.json()["theme"]["accent"] == "#ff4f8b"
    assert page.status_code == 201
    assert renamed.json()["title"] == "Работы"
    assert removed.status_code == 204
    assert deleted.status_code == 204
    assert (await client.get(f"/api/sites/{site_id}")).status_code == 404
