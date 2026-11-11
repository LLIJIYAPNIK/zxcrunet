from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from zxcrunet.shared.errors import NotFoundError, register_error_handlers


def make_client() -> AsyncClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/missing")
    async def missing() -> None:
        raise NotFoundError("Site not found", {"slug": "nope"})

    @app.get("/typed/{number}")
    async def typed(number: int) -> int:
        return number

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_app_error_format() -> None:
    async with make_client() as client:
        response = await client.get("/missing")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "not_found", "message": "Site not found", "details": {"slug": "nope"}}
    }


async def test_validation_error_format() -> None:
    async with make_client() as client:
        response = await client.get("/typed/abc")

    body = response.json()["error"]
    assert response.status_code == 422
    assert body["code"] == "validation_error"
    assert body["details"]["errors"][0]["loc"] == ["path", "number"]
