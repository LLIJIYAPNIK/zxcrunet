import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from tests.fakes import FREE_PLAN
from zxcrunet.openapi import render
from zxcrunet.plans.domain.plan import PlanLimitExceededError
from zxcrunet.shared.api.origin import OriginCheckMiddleware
from zxcrunet.shared.domain.ids import uuid7

OPENAPI_FILE = Path(__file__).parents[3] / "frontend" / "src" / "lib" / "api" / "openapi.json"


def test_plan_allows_up_to_limit() -> None:
    FREE_PLAN.ensure_can_add("max_sites", current=2)

    with pytest.raises(PlanLimitExceededError) as info:
        FREE_PLAN.ensure_can_add("max_sites", current=3)
    assert info.value.details == {"limit": "max_sites", "allowed": 3, "current": 3, "plan": "free"}


def test_uuid7_is_versioned_and_time_ordered() -> None:
    ids = [uuid7() for _ in range(50)]

    assert all(i.version == 7 and i.variant == "specified in RFC 4122" for i in ids)
    assert [i.bytes[:6] for i in ids] == sorted(i.bytes[:6] for i in ids)
    assert len(set(ids)) == len(ids)


def origin_client() -> AsyncClient:
    app = FastAPI()

    @app.post("/api/thing")
    async def thing() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/api/thing")
    async def read() -> dict[str, bool]:
        return {"ok": True}

    app.add_middleware(OriginCheckMiddleware, allowed_origins=["https://zxc.ru.net"])
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.parametrize(
    ("headers", "status"),
    [
        ({"Origin": "https://zxc.ru.net"}, 200),
        ({"Origin": "https://evil.example"}, 403),
        ({"Origin": "https://anna.zxc.ru.net"}, 403),
        ({}, 403),
    ],
)
async def test_origin_check_on_mutating_requests(headers: dict[str, str], status: int) -> None:
    async with origin_client() as client:
        response = await client.post("/api/thing", headers=headers)

    assert response.status_code == status
    if status == 403:
        assert response.json()["error"]["code"] == "origin_not_allowed"


async def test_origin_check_skips_safe_methods() -> None:
    async with origin_client() as client:
        response = await client.get("/api/thing")

    assert response.status_code == 200


def test_frontend_openapi_is_up_to_date() -> None:
    """Regenerate: uv run python -m zxcrunet.openapi > ../frontend/src/lib/api/openapi.json"""
    assert json.loads(OPENAPI_FILE.read_text(encoding="utf-8")) == json.loads(render())
