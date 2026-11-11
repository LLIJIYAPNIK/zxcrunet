from collections.abc import AsyncIterator, Callable

import pytest
from dishka import Provider, Scope, make_async_container
from httpx import ASGITransport, AsyncClient

from tests.unit.system.fakes import FakeProbe
from zxcrunet import __version__
from zxcrunet.main import create_app
from zxcrunet.system.application.readiness import CheckReadiness

ClientFactory = Callable[[list[FakeProbe]], AsyncClient]


@pytest.fixture
async def client_with() -> AsyncIterator[ClientFactory]:
    containers = []

    def factory(probes: list[FakeProbe]) -> AsyncClient:
        provider = Provider(scope=Scope.APP)
        provider.provide(lambda: CheckReadiness(probes, timeout_seconds=1), provides=CheckReadiness)
        container = make_async_container(provider)
        containers.append(container)
        app = create_app(container)
        return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")

    yield factory
    for container in containers:
        await container.close()


async def test_health(client_with: ClientFactory) -> None:
    async with client_with([]) as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}


async def test_ready_ok(client_with: ClientFactory) -> None:
    async with client_with([FakeProbe("postgres"), FakeProbe("redis")]) as client:
        response = await client.get("/api/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "checks": {"postgres": "ok", "redis": "ok"}}


async def test_ready_fail_returns_503(client_with: ClientFactory) -> None:
    async with client_with([FakeProbe("postgres", fails=True)]) as client:
        response = await client.get("/api/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "fail", "checks": {"postgres": "fail"}}


async def test_unknown_route_uses_error_format(client_with: ClientFactory) -> None:
    async with client_with([]) as client:
        response = await client.get("/api/nope")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
