"""How other contexts' routers get the signed-in user."""

from fastapi import Request

from zxcrunet.identity.application.admin import AuthorizeOwner
from zxcrunet.identity.application.use_cases import GetCurrentUser
from zxcrunet.identity.domain.user import User
from zxcrunet.shared.application.admin import Staff
from zxcrunet.shared.config import Settings


def session_token(request: Request, settings: Settings) -> str | None:
    return request.cookies.get(settings.session_cookie_name)


async def current_user(request: Request, get_current: GetCurrentUser, settings: Settings) -> User:
    """Raises NotAuthenticatedError (401) without a valid session."""
    return await get_current(session_token(request, settings))


async def current_staff(request: Request, authorize: AuthorizeOwner, settings: Settings) -> Staff:
    """401 without a session, 403 for anyone but the owner."""
    return await authorize(session_token(request, settings))
