from http import HTTPStatus
from typing import Literal

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, Response
from pydantic import BaseModel

from zxcrunet import __version__
from zxcrunet.system.application.readiness import CheckReadiness

router = APIRouter(prefix="/api/health", tags=["system"], route_class=DishkaRoute)


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


class ReadinessResponse(BaseModel):
    status: Literal["ok", "fail"]
    checks: dict[str, Literal["ok", "fail"]]


@router.get("")
async def health() -> HealthResponse:
    """Liveness: the process is up and serving requests."""
    return HealthResponse(status="ok", version=__version__)


@router.get("/ready", responses={HTTPStatus.SERVICE_UNAVAILABLE: {"model": ReadinessResponse}})
async def ready(check: FromDishka[CheckReadiness], response: Response) -> ReadinessResponse:
    """Readiness: Postgres and Redis are reachable."""
    report = await check()
    if not report.ready:
        response.status_code = HTTPStatus.SERVICE_UNAVAILABLE
    return ReadinessResponse(
        status="ok" if report.ready else "fail",
        checks={name: "ok" if ok else "fail" for name, ok in report.checks.items()},
    )
