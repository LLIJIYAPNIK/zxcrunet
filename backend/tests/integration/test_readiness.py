from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from zxcrunet.main import create_app, make_container
from zxcrunet.shared.config import Settings

pytestmark = pytest.mark.integration


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    container = make_container(Settings())
    app = create_app(container)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    await container.close()


async def test_ready_against_real_dependencies(client: AsyncClient) -> None:
    response = await client.get("/api/health/ready")

    assert response.json() == {"status": "ok", "checks": {"postgres": "ok", "redis": "ok"}}
