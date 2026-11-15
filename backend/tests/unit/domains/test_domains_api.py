from collections.abc import AsyncIterator
from typing import Any

import pytest
from dishka import make_async_container
from dishka.integrations.fastapi import FastapiProvider
from httpx import ASGITransport, AsyncClient

from tests.fakes import Fakes, FakesProvider
from zxcrunet.domains.di import DomainsProvider
from zxcrunet.identity.di import IdentityProvider
from zxcrunet.main import create_app
from zxcrunet.media.di import MediaProvider
from zxcrunet.plans.di import PlansProvider
from zxcrunet.shared.config import Settings
from zxcrunet.shared.di import InfrastructureProvider
from zxcrunet.sites.di import SitesProvider

ORIGIN = {"Origin": "http://localhost:3000"}
CREDS = {"email": "anna@example.com", "password": "correct horse battery"}
IP = "203.0.113.10"


@pytest.fixture
def fakes() -> Fakes:
    return Fakes()


@pytest.fixture
async def client(fakes: Fakes) -> AsyncIterator[AsyncClient]:
    settings = Settings(env="test", sites_domain="localhost", domains_server_ipv4=[IP])
    container = make_async_container(
        InfrastructureProvider(),
        FastapiProvider(),
        PlansProvider(),
        IdentityProvider(),
        MediaProvider(),
        SitesProvider(),
        DomainsProvider(),
        FakesProvider(fakes),
        context={Settings: settings},
    )
    app = create_app(container, settings)
    # The peer address decides whether /internal answers: 10.x is «inside Docker».
    transport = ASGITransport(app=app, client=("10.0.0.5", 40000))
    async with AsyncClient(transport=transport, base_url="http://test", headers=ORIGIN) as c:
        yield c
    await container.close()


async def published_site(client: AsyncClient, fakes: Fakes) -> str:
    await client.post("/api/auth/register", json=CREDS)
    await client.post("/api/auth/verify-email", json={"token": fakes.mailer.last_token()})
    created = await client.post(
        "/api/sites", json={"kind": "business", "slug": "anna", "title": "Анна"}
    )
    site_id: str = created.json()["id"]
    await client.post(f"/api/sites/{site_id}/publish")
    return site_id


async def ask(client: AsyncClient, domain: str, **headers: str) -> int:
    response = await client.get("/internal/tls/ask", params={"domain": domain}, headers=headers)
    return response.status_code


async def test_domains_need_a_session(client: AsyncClient) -> None:
    response = await client.get("/api/sites/0195f3a0-0000-7000-8000-000000000001/domains")

    assert response.status_code == 401


async def test_add_check_serve_and_remove(client: AsyncClient, fakes: Fakes) -> None:
    site_id = await published_site(client, fakes)

    added = await client.post(f"/api/sites/{site_id}/domains", json={"host": "Example.com"})
    domain: dict[str, Any] = added.json()
    token = domain["records"][0]["value"]
    assert added.status_code == 201
    assert domain["host"] == "example.com"
    assert domain["status"] == "pending"
    assert domain["records"] == [
        {"type": "TXT", "name": "_zxc-verify.example.com", "value": token},
        {"type": "A", "name": "example.com", "value": IP},
    ]

    listed = (await client.get(f"/api/sites/{site_id}/domains")).json()
    assert [d["id"] for d in listed["domains"]] == [domain["id"]]
    assert (listed["used"], listed["max_domains"]) == (1, 3)
    assert listed["server"] == {"ipv4": [IP], "ipv6": []}

    pending = (await client.post(f"/api/domains/{domain['id']}/check")).json()
    assert pending["status"] == "pending"
    assert [p["code"] for p in pending["problems"]] == ["txt_missing", "a_missing"]
    assert await ask(client, "example.com") == 404
    resolve = {"host": "example.com"}
    assert (await client.get("/api/public/sites/resolve", params=resolve)).status_code == 404

    fakes.dns.point("example.com", token, IP)
    verified = (await client.post(f"/api/domains/{domain['id']}/check")).json()
    assert verified["status"] == "verified"
    assert verified["problems"] == []
    assert await ask(client, "example.com") == 200

    resolved = await client.get("/api/public/sites/resolve", params=resolve)
    assert resolved.status_code == 200
    assert resolved.json()["slug"] == "anna"

    assert (await client.delete(f"/api/domains/{domain['id']}")).status_code == 204
    assert await ask(client, "example.com") == 404
    assert (await client.get("/api/public/sites/resolve", params=resolve)).status_code == 404


async def test_www_gets_a_cname(client: AsyncClient, fakes: Fakes) -> None:
    site_id = await published_site(client, fakes)

    added = await client.post(f"/api/sites/{site_id}/domains", json={"host": "www.example.com"})

    assert added.json()["records"][1] == {
        "type": "CNAME",
        "name": "www.example.com",
        "value": "example.com",
    }


async def test_errors_use_the_common_format(client: AsyncClient, fakes: Fakes) -> None:
    site_id = await published_site(client, fakes)

    bad = await client.post(f"/api/sites/{site_id}/domains", json={"host": "anna.localhost"})
    missing = await client.post("/api/domains/0195f3a0-0000-7000-8000-000000000001/check")

    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "host_not_allowed"
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "domain_not_found"


async def test_ask_is_only_for_the_inside(client: AsyncClient, fakes: Fakes) -> None:
    site_id = await published_site(client, fakes)
    added = (
        await client.post(f"/api/sites/{site_id}/domains", json={"host": "example.com"})
    ).json()
    fakes.dns.point("example.com", added["records"][0]["value"], IP)
    await client.post(f"/api/domains/{added['id']}/check")

    assert await ask(client, "example.com") == 200
    # Anything that came through the public proxy carries a forwarding header.
    assert await ask(client, "example.com", **{"X-Forwarded-For": "198.51.100.1"}) == 404
    assert await ask(client, "example.com", Forwarded="for=198.51.100.1") == 404
    assert await ask(client, "unknown.example") == 404


async def test_ask_refuses_public_peers(fakes: Fakes) -> None:
    settings = Settings(env="test", sites_domain="localhost")
    container = make_async_container(
        InfrastructureProvider(),
        FastapiProvider(),
        PlansProvider(),
        IdentityProvider(),
        MediaProvider(),
        SitesProvider(),
        DomainsProvider(),
        FakesProvider(fakes),
        context={Settings: settings},
    )
    transport = ASGITransport(app=create_app(container, settings), client=("198.51.100.1", 1))
    async with AsyncClient(transport=transport, base_url="http://test") as public:
        response = await public.get("/internal/tls/ask", params={"domain": "example.com"})
    await container.close()

    assert response.status_code == 404
