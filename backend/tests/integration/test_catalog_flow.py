"""Catalog against real Postgres and Redis. Needs `alembic upgrade head` beforehand."""

import uuid

import pytest
from httpx import AsyncClient

from tests.fakes import CapturingMailer
from tests.integration.test_sites_flow import unique_slug, verified_user

pytestmark = pytest.mark.integration


async def test_series_shelf_posts_and_public_catalog(
    client: AsyncClient, mailer: CapturingMailer
) -> None:
    await verified_user(client, mailer)
    series = await client.post(
        "/api/catalog/titles",
        json={"kind": "game", "name": "Dark Souls", "is_series": True, "genres": ["soulslike"]},
    )
    assert series.status_code == 201
    series_id = series.json()["id"]
    part = await client.post(
        "/api/catalog/titles",
        json={
            "kind": "game",
            "name": "Dark Souls III",
            "series_id": series_id,
            "part_label": "III",
            "year": 2016,
            "entry": {
                "status": "done",
                "rating": 9,
                "hours": 78,
                "finished_on": "2026-03-01",
                "details": {
                    "bosses": [{"name": "Душа пепла", "note": "финал", "defeated": True}],
                    "extras": [{"name": "The Ringed City"}],
                },
            },
        },
    )
    assert part.status_code == 201
    part_id = part.json()["id"]

    duplicate = await client.post(
        "/api/catalog/titles", json={"kind": "game", "name": "Другое", "slug": "dark-souls"}
    )
    assert duplicate.status_code == 409

    post = await client.post(
        "/api/catalog/posts",
        json={"kind": "review", "heading": "Закрывает круг", "title_id": part_id},
    )
    assert post.status_code == 201

    slug = unique_slug()
    site = await client.post("/api/sites", json={"kind": "personal", "slug": slug, "title": "Саша"})
    await client.post(f"/api/sites/{site.json()['id']}/publish")
    host = f"{slug}.localhost"

    public = await client.get("/api/public/catalog", params={"host": host})
    assert public.status_code == 200
    titles = {t["name"]: t for t in public.json()["titles"]}
    assert titles["Dark Souls III"]["series_id"] == series_id
    assert titles["Dark Souls III"]["entry"]["details"]["bosses"][0]["defeated"] is True

    # Deleting the series keeps its part; deleting the part keeps the post.
    assert (await client.delete(f"/api/catalog/titles/{series_id}")).status_code == 204
    assert (await client.delete(f"/api/catalog/titles/{part_id}")).status_code == 204
    mine = (await client.get("/api/catalog")).json()
    assert mine["titles"] == []
    assert mine["posts"][0]["title_id"] is None

    public = await client.get("/api/public/catalog", params={"host": host})
    assert public.json()["titles"] == []


async def test_catalogs_are_private_per_user(client: AsyncClient, mailer: CapturingMailer) -> None:
    await verified_user(client, mailer)
    title = await client.post(
        "/api/catalog/titles", json={"kind": "book", "name": f"Книга {uuid.uuid4().hex[:6]}"}
    )

    client.cookies.clear()
    await verified_user(client, mailer)

    assert (await client.get("/api/catalog")).json()["titles"] == []
    other = await client.delete(f"/api/catalog/titles/{title.json()['id']}")
    assert other.status_code == 404
