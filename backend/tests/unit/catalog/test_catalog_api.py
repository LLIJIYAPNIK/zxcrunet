from collections.abc import AsyncIterator

import pytest
from dishka import make_async_container
from dishka.integrations.fastapi import FastapiProvider
from httpx import ASGITransport, AsyncClient

from tests.fakes import Fakes, FakesProvider
from zxcrunet.catalog.di import CatalogProvider
from zxcrunet.domains.di import DomainsProvider
from zxcrunet.identity.di import IdentityProvider
from zxcrunet.main import create_app
from zxcrunet.media.di import MediaProvider
from zxcrunet.plans.di import PlansProvider
from zxcrunet.shared.config import Settings
from zxcrunet.shared.di import InfrastructureProvider
from zxcrunet.sites.di import SitesProvider

ORIGIN = {"Origin": "http://localhost:3000"}
CREDS = {"email": "sasha@example.com", "password": "correct horse battery"}


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
        MediaProvider(),
        SitesProvider(),
        DomainsProvider(),
        CatalogProvider(),
        FakesProvider(fakes),
        context={Settings: settings},
    )
    app = create_app(container, settings)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=ORIGIN
    ) as c:
        yield c
    await container.close()


async def signed_in(client: AsyncClient, fakes: Fakes) -> None:
    await client.post("/api/auth/register", json=CREDS)
    await client.post("/api/auth/verify-email", json={"token": fakes.mailer.last_token()})


async def publish(client: AsyncClient, kind: str, slug: str) -> None:
    site = await client.post("/api/sites", json={"kind": kind, "slug": slug, "title": "Саша"})
    await client.post(f"/api/sites/{site.json()['id']}/publish")


async def test_catalog_needs_a_session(client: AsyncClient) -> None:
    assert (await client.get("/api/catalog")).status_code == 401


async def test_titles_posts_and_public_catalog(client: AsyncClient, fakes: Fakes) -> None:
    await signed_in(client, fakes)
    series = await client.post(
        "/api/catalog/titles", json={"kind": "game", "name": "Dark Souls", "is_series": True}
    )
    part = await client.post(
        "/api/catalog/titles",
        json={
            "kind": "game",
            "name": "Dark Souls III",
            "year": 2016,
            "series_id": series.json()["id"],
            "part_label": "III",
            "entry": {
                "status": "done",
                "rating": 9,
                "hours": 78,
                "details": {"criteria": [{"name": "Геймплей", "score": 10}]},
            },
        },
    )
    assert part.status_code == 201
    assert part.json()["entry"]["details"]["criteria"] == [{"name": "Геймплей", "score": 10}]

    post = await client.post(
        "/api/catalog/posts",
        json={"kind": "review", "heading": "Закрывает круг", "title_id": part.json()["id"]},
    )
    assert post.status_code == 201

    mine = await client.get("/api/catalog")
    assert [t["name"] for t in mine.json()["titles"]] == ["Dark Souls", "Dark Souls III"]
    assert mine.json()["max_titles"] == 1000

    await publish(client, "business", "work")
    business = await client.get("/api/public/catalog", params={"host": "work.localhost"})
    assert business.status_code == 404  # shelves are shown only by personal sites

    await publish(client, "personal", "sasha")
    public = await client.get("/api/public/catalog", params={"host": "sasha.localhost"})
    assert public.status_code == 200
    assert public.json()["posts"][0]["heading"] == "Закрывает круг"

    edited = await client.put(
        f"/api/catalog/titles/{part.json()['id']}",
        json={"kind": "game", "name": "Dark Souls III", "entry": None},
    )
    assert edited.json()["entry"] is None
    public = await client.get("/api/public/catalog", params={"host": "sasha.localhost"})
    assert public.json()["titles"][1]["entry"] is None  # cache was invalidated

    assert (await client.delete(f"/api/catalog/titles/{series.json()['id']}")).status_code == 204


async def test_errors_use_the_common_format(client: AsyncClient, fakes: Fakes) -> None:
    await signed_in(client, fakes)

    bad = await client.post(
        "/api/catalog/titles",
        json={
            "kind": "book",
            "name": "X",
            "entry": {"status": "done", "rating": 5, "details": {"x": 1}},
        },
    )

    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "invalid_shelf_entry"
