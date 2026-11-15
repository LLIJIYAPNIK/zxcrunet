"""The admin panel against real Postgres and Redis: every owner endpoint, the audit log,
reports from a site and page views through the worker's flush."""

import uuid
from typing import Any

import pytest
from dishka import AsyncContainer
from httpx import AsyncClient

from tests.fakes import CapturingMailer
from zxcrunet.analytics.application.use_cases import FlushViews
from zxcrunet.identity.application.use_cases import CreateOwner

pytestmark = pytest.mark.integration

PASSWORD = "correct horse battery"
BROWSER = "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0"


def unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


async def sign_in_owner(client: AsyncClient, container: AsyncContainer) -> str:
    email = f"{unique('owner')}@example.com"
    async with container() as request:
        await (await request.get(CreateOwner))(email, PASSWORD)
    client.cookies.clear()
    response = await client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return email


async def user_with_site(client: AsyncClient, mailer: CapturingMailer) -> dict[str, str]:
    client.cookies.clear()
    email = f"{unique('it')}@example.com"
    registered = await client.post(
        "/api/auth/register", json={"email": email, "password": PASSWORD}
    )
    await client.post("/api/auth/verify-email", json={"token": mailer.last_token()})
    slug = unique("it")
    site = await client.post("/api/sites", json={"kind": "business", "slug": slug, "title": "Тест"})
    site_id: str = site.json()["id"]
    await client.post(f"/api/sites/{site_id}/publish")
    return {
        "user_id": registered.json()["id"],
        "email": email,
        "site_id": site_id,
        "slug": slug,
        "host": f"{slug}.localhost",
    }


def from_site(host: str) -> dict[str, str]:
    return {"Origin": f"http://{host}:3000", "User-Agent": BROWSER}


async def audit_actions(client: AsyncClient, target_id: str) -> list[str]:
    log = await client.get("/api/admin/audit", params={"target_id": target_id})
    return [e["action"] for e in log.json()["items"]]


async def resolved_status(client: AsyncClient, host: str) -> int | str:
    response = await client.get("/api/public/sites/resolve", params={"host": host})
    return response.json()["status"] if response.status_code == 200 else response.status_code


async def test_users_and_plans(
    client: AsyncClient, container: AsyncContainer, mailer: CapturingMailer
) -> None:
    anna = await user_with_site(client, mailer)
    owner_email = await sign_in_owner(client, container)
    code = unique("p")[:20]

    found = await client.get("/api/admin/users", params={"q": anna["email"][:14]})
    card = await client.get(f"/api/admin/users/{anna['user_id']}")
    created = await client.post(
        "/api/admin/plans",
        json={
            "code": code,
            "title": "Про",
            "max_sites": 10,
            "max_custom_domains": 10,
            "max_upload_mb": 50,
        },
    )
    updated = await client.put(
        f"/api/admin/plans/{code}",
        json={"title": "Про+", "max_sites": 20, "max_custom_domains": 10, "max_upload_mb": 50},
    )
    plans = await client.get("/api/admin/plans")
    moved = await client.put(f"/api/admin/users/{anna['user_id']}/plan", json={"plan": code})
    blocked = await client.post(
        f"/api/admin/users/{anna['user_id']}/block", json={"reason": "спам"}
    )
    unblocked = await client.post(f"/api/admin/users/{anna['user_id']}/unblock")

    assert anna["email"] in [u["email"] for u in found.json()["items"]]
    assert card.json()["status"] == "active"
    assert created.status_code == 201
    assert updated.json()["max_sites"] == 20
    assert code in [p["code"] for p in plans.json()["items"]]
    assert moved.json()["plan"] == code
    assert blocked.json()["status"] == "blocked"
    assert unblocked.json()["status"] == "active"
    log = await client.get("/api/admin/audit", params={"target_id": anna["user_id"]})
    entries = log.json()["items"]
    assert [e["action"] for e in entries] == ["user.unblock", "user.block", "user.plan"]
    assert {e["actor_email"] for e in entries} == {owner_email}
    assert await audit_actions(client, code) == ["plan.update", "plan.create"]


async def test_blocked_user_is_signed_out(
    client: AsyncClient, container: AsyncContainer, mailer: CapturingMailer
) -> None:
    anna = await user_with_site(client, mailer)
    anna_cookies = dict(client.cookies)
    await sign_in_owner(client, container)

    await client.post(f"/api/admin/users/{anna['user_id']}/block", json={"reason": ""})
    client.cookies.clear()
    client.cookies.update(anna_cookies)
    me = await client.get("/api/auth/me")
    login = await client.post(
        "/api/auth/login", json={"email": anna["email"], "password": PASSWORD}
    )

    assert me.status_code == 401
    assert login.status_code == 403
    assert login.json()["error"]["code"] == "user_blocked"


async def test_sites_and_reserved_names(
    client: AsyncClient, container: AsyncContainer, mailer: CapturingMailer
) -> None:
    anna = await user_with_site(client, mailer)
    await sign_in_owner(client, container)
    name = unique("res")

    listed = await client.get("/api/admin/sites", params={"q": anna["slug"]})
    suspended = await client.post(
        f"/api/admin/sites/{anna['site_id']}/suspend", json={"reason": "фишинг"}
    )
    while_down = await resolved_status(client, anna["host"])
    restored = await client.post(f"/api/admin/sites/{anna['site_id']}/restore")
    after = await resolved_status(client, anna["host"])
    card = await client.get(f"/api/admin/sites/{anna['site_id']}")
    reserved = await client.post(
        "/api/admin/reserved-slugs", json={"slug": name, "reason": "бренд"}
    )
    names = await client.get("/api/admin/reserved-slugs")
    check = await client.get("/api/sites/slug-check", params={"slug": name})
    released = await client.delete(f"/api/admin/reserved-slugs/{name}")

    assert [s["id"] for s in listed.json()["items"]] == [anna["site_id"]]
    assert listed.json()["items"][0]["owner_email"] == anna["email"]
    assert suspended.json()["status"] == "suspended"
    assert while_down == "suspended"
    assert restored.json()["status"] == "published"
    assert after == "published"
    assert card.json()["suspension_reason"] == ""
    assert reserved.status_code == 201
    assert name in [n["slug"] for n in names.json()["items"]]
    assert check.json()["reason"] == "slug_reserved"
    assert released.status_code == 204
    assert await audit_actions(client, anna["site_id"]) == ["site.restore", "site.suspend"]
    assert await audit_actions(client, name) == ["slug.release", "slug.reserve"]


async def test_domains(
    client: AsyncClient, container: AsyncContainer, mailer: CapturingMailer
) -> None:
    anna = await user_with_site(client, mailer)
    host = f"{unique('it')}.example.com"
    added = await client.post(f"/api/sites/{anna['site_id']}/domains", json={"host": host})
    domain_id = added.json()["id"]
    await sign_in_owner(client, container)

    found = await client.get("/api/admin/domains", params={"q": host, "status": "pending"})
    confirmed = await client.post(f"/api/admin/domains/{domain_id}/confirm")
    serving = await resolved_status(client, host)
    revoked = await client.post(f"/api/admin/domains/{domain_id}/revoke", json={"reason": "спам"})
    gone = await resolved_status(client, host)

    item: dict[str, Any] = found.json()["items"][0]
    assert item["owner_email"] == anna["email"]
    assert item["site_host"] == anna["host"]
    assert confirmed.json()["status"] == "verified"
    assert serving == "published"
    assert revoked.json()["status"] == "failed"
    assert revoked.json()["revoked"] is True
    assert gone == 404
    assert await audit_actions(client, domain_id) == ["domain.revoke", "domain.confirm"]


async def test_reports_views_and_dashboard(
    client: AsyncClient, container: AsyncContainer, mailer: CapturingMailer
) -> None:
    anna = await user_with_site(client, mailer)
    client.cookies.clear()
    site = from_site(anna["host"])
    report = {"host": anna["host"], "path": "/", "reason": "fraud", "message": "просит деньги"}

    submitted = await client.post("/api/public/events/reports", json=report, headers=site)
    for _ in range(3):
        view = {"host": anna["host"], "path": "/"}
        beacon = await client.post("/api/public/events/views", json=view, headers=site)
        assert beacon.status_code == 204
    async with container() as request:
        assert await (await request.get(FlushViews))() >= 1

    await sign_in_owner(client, container)
    queue = await client.get(
        "/api/admin/reports", params={"status": "open", "site_id": anna["site_id"]}
    )
    decided = await client.post(
        f"/api/admin/reports/{submitted.json()['id']}/decision",
        json={"decision": "suspend", "note": "мошенничество"},
    )
    views = await client.get(f"/api/admin/sites/{anna['site_id']}/views", params={"days": 7})
    dashboard = await client.get("/api/admin/dashboard", params={"days": 7})

    assert submitted.status_code == 201
    assert [r["id"] for r in queue.json()["items"]] == [submitted.json()["id"]]
    assert decided.json()["items"][0]["status"] == "resolved"
    assert await resolved_status(client, anna["host"]) == "suspended"
    today = views.json()["days"][-1]
    assert (today["views"], today["visitors"]) == (3, 1)
    data = dashboard.json()
    assert len(data["views"]) == len(data["registrations"]) == 7
    assert data["views"][-1]["views"] >= 3
    assert data["users"] >= 1
    assert data["sites"]["suspended"] >= 1
    assert await audit_actions(client, submitted.json()["id"]) == ["report.resolved"]
