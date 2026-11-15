from fastapi import Request

from zxcrunet.shared.api.origin import origin_matches_host
from zxcrunet.shared.domain.errors import ForbiddenError


def client_ip(request: Request) -> str:
    """The peer address (uvicorn puts the real one here behind Caddy with --proxy-headers)."""
    return request.client.host if request.client else "unknown"


class OriginMismatchError(ForbiddenError):
    code = "origin_not_allowed"


def ensure_sent_from(request: Request, host: str) -> None:
    """Anonymous public writes must come from a page of the site they are about."""
    if not origin_matches_host(request.headers.get("origin"), host):
        raise OriginMismatchError("Request origin does not match the site")
