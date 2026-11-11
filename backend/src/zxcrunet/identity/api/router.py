from http import HTTPStatus

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, Request, Response

from zxcrunet.identity.api.current import session_token
from zxcrunet.identity.api.schemas import (
    CredentialsIn,
    EmailIn,
    LimitsOut,
    MeOut,
    ResetPasswordIn,
    TokenIn,
    UserOut,
)
from zxcrunet.identity.application.use_cases import (
    AuthPolicy,
    Credentials,
    GetCurrentUser,
    Login,
    Logout,
    PasswordReset,
    PasswordResetRequest,
    RegisterUser,
    RequestPasswordReset,
    ResendVerification,
    ResetPassword,
    VerifyEmail,
)
from zxcrunet.plans.application.service import PlanService
from zxcrunet.shared.config import Settings

router = APIRouter(prefix="/api/auth", tags=["auth"], route_class=DishkaRoute)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _set_session(response: Response, settings: Settings, policy: AuthPolicy, token: str) -> None:
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=policy.session_ttl_seconds,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
        # No `domain`: host-only, so users' subdomains never receive the session.
    )


def _clear_session(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )


@router.post("/register", status_code=HTTPStatus.CREATED)
async def register(
    body: CredentialsIn,
    request: Request,
    response: Response,
    use_case: FromDishka[RegisterUser],
    settings: FromDishka[Settings],
    policy: FromDishka[AuthPolicy],
) -> UserOut:
    result = await use_case(Credentials(body.email, body.password, client_ip(request)))
    _set_session(response, settings, policy, result.session_token)
    return UserOut.of(result.user)


@router.post("/login")
async def login(
    body: CredentialsIn,
    request: Request,
    response: Response,
    use_case: FromDishka[Login],
    settings: FromDishka[Settings],
    policy: FromDishka[AuthPolicy],
) -> UserOut:
    result = await use_case(Credentials(body.email, body.password, client_ip(request)))
    _set_session(response, settings, policy, result.session_token)
    return UserOut.of(result.user)


@router.post("/logout", status_code=HTTPStatus.NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    use_case: FromDishka[Logout],
    settings: FromDishka[Settings],
) -> None:
    await use_case(session_token(request, settings))
    _clear_session(response, settings)


@router.get("/me")
async def me(
    request: Request,
    current: FromDishka[GetCurrentUser],
    plans: FromDishka[PlanService],
    settings: FromDishka[Settings],
) -> MeOut:
    user = await current(session_token(request, settings))
    plan = await plans.get(user.plan_code)
    return MeOut(user=UserOut.of(user), limits=LimitsOut.of(plan))


@router.post("/verify-email")
async def verify_email(body: TokenIn, use_case: FromDishka[VerifyEmail]) -> UserOut:
    return UserOut.of(await use_case(body.token))


@router.post("/verify-email/resend", status_code=HTTPStatus.ACCEPTED)
async def resend_verification(
    request: Request,
    current: FromDishka[GetCurrentUser],
    use_case: FromDishka[ResendVerification],
    settings: FromDishka[Settings],
) -> None:
    await use_case(await current(session_token(request, settings)))


@router.post("/password/forgot", status_code=HTTPStatus.ACCEPTED)
async def forgot_password(
    body: EmailIn, request: Request, use_case: FromDishka[RequestPasswordReset]
) -> None:
    await use_case(PasswordResetRequest(body.email, client_ip(request)))


@router.post("/password/reset", status_code=HTTPStatus.NO_CONTENT)
async def reset_password(
    body: ResetPasswordIn,
    response: Response,
    use_case: FromDishka[ResetPassword],
    settings: FromDishka[Settings],
) -> None:
    await use_case(PasswordReset(body.token, body.password))
    _clear_session(response, settings)
