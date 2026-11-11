"""Sites against real Postgres and Redis. Needs `alembic upgrade head` beforehand."""

import uuid

import pytest
from httpx import AsyncClient

from tests.fakes import CapturingMailer

pytestmark = pytest.mark.integration

PASSWORD = "correct horse battery"


async def verified_user(client: AsyncClient, mailer: CapturingMailer) -> None:
    email = f"it-{uuid.uuid4().hex[:12]}@example.com"
    await client.post("/api/auth/register", json={"email": email, "password": PASSWORD})
    await client.post("/api/auth/verify-email", json={"token": mailer.last_token()})


def unique_slug() -> str:
    return f"it-{uuid.uuid4().hex[:10]}"


async def test_create_edit_publish_resolve_delete(
    client: AsyncClient, mailer: CapturingMailer
) -> None:
    await verified_user(client, mailer)
    slug = unique_slug()
    host = f"{slug}.localhost"

    created = await client.post(
        "/api/sites", json={"kind": "personal", "slug": slug, "title": "Саша"}
    )
    site_id = created.json()["id"]
    assert created.status_code == 201

    page = await client.post(f"/api/sites/{site_id}/pages", json={"path": "games", "title": "Игры"})
    assert page.status_code == 201
    await client.patch(f"/api/sites/{site_id}", json={"accent": "#b6ff2e", "second": "#ff4f8b"})

    assert (await client.get("/api/public/sites/resolve", params={"host": host})).status_code == 404
    await client.post(f"/api/sites/{site_id}/publish")

    resolved = await client.get("/api/public/sites/resolve", params={"host": host})
    content = resolved.json()["content"]
    assert resolved.status_code == 200
    assert content["theme"] == {"accent": "#b6ff2e", "second": "#ff4f8b"}
    assert [p["path"] for p in content["pages"]] == ["", "games"]

    stored = await client.get(f"/api/sites/{site_id}")
    assert [p["title"] for p in stored.json()["pages"]] == ["Саша", "Игры"]

    assert (await client.delete(f"/api/sites/{site_id}")).status_code == 204
    assert (await client.get("/api/public/sites/resolve", params={"host": host})).status_code == 404


async def test_reserved_slugs_come_from_the_migration(
    client: AsyncClient, mailer: CapturingMailer
) -> None:
    await verified_user(client, mailer)

    check = await client.get("/api/sites/slug-check", params={"slug": "postmaster"})

    assert check.json()["reason"] == "slug_reserved"


async def test_slug_is_unique_across_users(client: AsyncClient, mailer: CapturingMailer) -> None:
    slug = unique_slug()
    await verified_user(client, mailer)
    await client.post("/api/sites", json={"kind": "business", "slug": slug, "title": "Первый"})

    client.cookies.clear()
    await verified_user(client, mailer)
    second = await client.post(
        "/api/sites", json={"kind": "business", "slug": slug, "title": "Второй"}
    )

    assert second.status_code == 409
