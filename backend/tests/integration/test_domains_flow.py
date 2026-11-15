"""Custom domains against real Postgres and Redis; DNS and TLS are mocked.

Walks the whole status cycle through the API and the worker's use cases:
pending → verified → active → lost → verified, and `failed` after 48 hours.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from dishka import AsyncContainer
from httpx import AsyncClient

from tests.fakes import CapturingMailer, FakeDns, FakeTls, RecordingCheckQueue
from zxcrunet.domains.application.use_cases import CheckDomain, DueDomains

pytestmark = pytest.mark.integration

PASSWORD = "correct horse battery"
IP = "203.0.113.10"


class MovableClock:
    def __init__(self) -> None:
        self.current = datetime.now(UTC)

    def now(self) -> datetime:
        return self.current


async def published_site(client: AsyncClient, mailer: CapturingMailer) -> str:
    client.cookies.clear()
    email = f"it-{uuid.uuid4().hex[:12]}@example.com"
    await client.post("/api/auth/register", json={"email": email, "password": PASSWORD})
    await client.post("/api/auth/verify-email", json={"token": mailer.last_token()})
    slug = f"it-{uuid.uuid4().hex[:10]}"
    created = await client.post(
        "/api/sites", json={"kind": "business", "slug": slug, "title": "Тест"}
    )
    site_id: str = created.json()["id"]
    await client.post(f"/api/sites/{site_id}/publish")
    return site_id


def unique_host() -> str:
    return f"it-{uuid.uuid4().hex[:10]}.example.com"


async def worker_check(container: AsyncContainer, domain_id: str) -> str | None:
    async with container() as request:
        status = await (await request.get(CheckDomain))(uuid.UUID(domain_id))
    return status.value if status else None


async def resolves(client: AsyncClient, host: str) -> bool:
    response = await client.get("/api/public/sites/resolve", params={"host": host})
    return response.status_code == 200


async def certificate_allowed(client: AsyncClient, host: str) -> bool:
    response = await client.get("/internal/tls/ask", params={"domain": host})
    return response.status_code == 200


async def check_now(client: AsyncClient, domain_id: str) -> dict[str, Any]:
    response = await client.post(f"/api/domains/{domain_id}/check")
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    return body


async def test_full_status_cycle(
    client: AsyncClient,
    container: AsyncContainer,
    mailer: CapturingMailer,
    dns: FakeDns,
    tls: FakeTls,
    checks: RecordingCheckQueue,
) -> None:
    site_id = await published_site(client, mailer)
    host = unique_host()

    added = await client.post(f"/api/sites/{site_id}/domains", json={"host": host})
    domain: dict[str, Any] = added.json()
    domain_id, token = domain["id"], domain["records"][0]["value"]
    assert added.status_code == 201
    assert domain["status"] == "pending"
    assert checks.queued == [uuid.UUID(domain_id)]

    # The worker's first check: nothing at the registrar yet.
    assert await worker_check(container, domain_id) == "pending"
    stored = (await client.get(f"/api/sites/{site_id}/domains")).json()["domains"][0]
    assert [p["code"] for p in stored["problems"]] == ["txt_missing", "a_missing"]
    assert stored["next_check_at"] is not None
    assert not await resolves(client, host)

    # The records are in place: «Проверить сейчас».
    dns.point(host, token, IP)
    assert (await check_now(client, domain_id))["status"] == "verified"
    assert await certificate_allowed(client, host)
    assert await resolves(client, host)

    # The scheduler finds it due; the certificate shows up on the second probe.
    async with container() as request:
        assert uuid.UUID(domain_id) in await (await request.get(DueDomains))()
    assert await worker_check(container, domain_id) == "verified"
    tls.issued.add(host)
    assert await worker_check(container, domain_id) == "active"

    # The owner breaks DNS: three failed re-checks in a row and the domain is lost.
    dns.records.pop(host)
    assert (await check_now(client, domain_id))["status"] == "active"
    assert (await check_now(client, domain_id))["status"] == "active"
    assert (await check_now(client, domain_id))["status"] == "lost"
    assert not await certificate_allowed(client, host)
    assert not await resolves(client, host)

    # The records are back.
    dns.point(host, token, IP)
    assert (await check_now(client, domain_id))["status"] == "verified"
    assert await resolves(client, host)

    assert (await client.delete(f"/api/domains/{domain_id}")).status_code == 204
    assert not await resolves(client, host)


async def test_failed_after_48_hours_and_one_site_per_host(
    client: AsyncClient, container: AsyncContainer, mailer: CapturingMailer, dns: FakeDns
) -> None:
    host = unique_host()
    first_site = await published_site(client, mailer)
    first = (await client.post(f"/api/sites/{first_site}/domains", json={"host": host})).json()

    clock = MovableClock()
    async with container() as request:
        check = await request.get(CheckDomain)
        check.clock = clock
        await check(uuid.UUID(first["id"]))
        clock.current += timedelta(hours=49)
        await check(uuid.UUID(first["id"]))
    stored = (await client.get(f"/api/sites/{first_site}/domains")).json()["domains"][0]
    assert stored["status"] == "failed"
    assert stored["next_check_at"] is None

    # A second owner claims the same host and proves it.
    second_site = await published_site(client, mailer)
    second = (await client.post(f"/api/sites/{second_site}/domains", json={"host": host})).json()
    dns.point(host, second["records"][0]["value"], IP)
    assert (await check_now(client, second["id"]))["status"] == "verified"

    # A third one cannot even add it now.
    third_site = await published_site(client, mailer)
    taken = await client.post(f"/api/sites/{third_site}/domains", json={"host": host})
    assert taken.status_code == 409
    assert taken.json()["error"]["code"] == "domain_taken"

    # Deleting a site deletes its domains: the host is free again.
    client.cookies.clear()
    await client.post("/api/auth/login", json={"email": mailer.sent[-2].to, "password": PASSWORD})
    assert (await client.delete(f"/api/sites/{second_site}")).status_code == 204
    assert not await resolves(client, host)
