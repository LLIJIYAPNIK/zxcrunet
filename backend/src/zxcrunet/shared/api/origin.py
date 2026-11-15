"""CSRF defence: mutating API requests must come from an allowed Origin."""

from http import HTTPStatus

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from zxcrunet.shared.api.errors import error_body

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class OriginCheckMiddleware:
    """`exempt` paths are anonymous endpoints called from users' sites (other origins).

    They use no session, so there is nothing to forge; each checks that the Origin
    matches the site it writes about (`origin_matches_host`).
    """

    def __init__(
        self,
        app: ASGIApp,
        allowed_origins: list[str],
        path_prefix: str = "/api",
        exempt: tuple[str, ...] = (),
    ) -> None:
        self.app = app
        self.allowed = {o.rstrip("/") for o in allowed_origins}
        self.prefix = path_prefix
        self.exempt = exempt

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope["method"] in SAFE_METHODS
            or not scope["path"].startswith(self.prefix)
            or scope["path"].startswith(self.exempt)
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


def _bare_host(value: str) -> str:
    return value.strip().lower().rstrip(".").split(":")[0]


def origin_matches_host(origin: str | None, host: str) -> bool:
    """Did the browser send this request from a page of `host` (any scheme or port)?"""
    if not origin or "://" not in origin:
        return False
    return _bare_host(origin.split("://", 1)[1].split("/")[0]) == _bare_host(host)
