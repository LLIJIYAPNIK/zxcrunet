"""How other contexts' routers get the signed-in user."""

from fastapi import Request

from zxcrunet.identity.application.use_cases import GetCurrentUser
from zxcrunet.identity.domain.user import User
from zxcrunet.shared.config import Settings


def session_token(request: Request, settings: Settings) -> str | None:
    return request.cookies.get(settings.session_cookie_name)


async def current_user(request: Request, get_current: GetCurrentUser, settings: Settings) -> User:
    """Raises NotAuthenticatedError (401) without a valid session."""
    return await get_current(session_token(request, settings))
