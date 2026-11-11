"""CSRF defence: mutating API requests must come from an allowed Origin."""

from http import HTTPStatus

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from zxcrunet.shared.api.errors import error_body

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class OriginCheckMiddleware:
    def __init__(self, app: ASGIApp, allowed_origins: list[str], path_prefix: str = "/api") -> None:
        self.app = app
        self.allowed = {o.rstrip("/") for o in allowed_origins}
        self.prefix = path_prefix

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope["method"] in SAFE_METHODS
            or not scope["path"].startswith(self.prefix)
        ):
            await self.app(scope, receive, send)
            return

        headers = dict(scope["headers"])
        origin = headers.get(b"origin", b"").decode("latin-1").rstrip("/")
        if origin in self.allowed:
            await self.app(scope, receive, send)
            return

        response = JSONResponse(
            error_body("origin_not_allowed", "Request origin is not allowed"),
            HTTPStatus.FORBIDDEN,
        )
        await response(scope, receive, send)
