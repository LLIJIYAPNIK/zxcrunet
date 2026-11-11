import pytest

from tests.fakes import Fakes
from zxcrunet.identity.application.emails import EmailTemplates
from zxcrunet.identity.application.use_cases import (
    AuthPolicy,
    CreateOwner,
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
    _Base,
)
from zxcrunet.identity.domain.errors import (
    EmailTakenError,
    InvalidCredentialsError,
    InvalidEmailError,
    InvalidTokenError,
    UserBlockedError,
    WeakPasswordError,
)
from zxcrunet.identity.domain.user import Role, UserStatus
from zxcrunet.shared.domain.errors import NotAuthenticatedError, RateLimitedError

POLICY = AuthPolicy(
    session_ttl_seconds=30 * 24 * 3600,
    verify_email_ttl_seconds=48 * 3600,
    reset_password_ttl_seconds=3600,
)
EMAIL = "Anna@Example.com"
PASSWORD = "correct horse battery"
IP = "203.0.113.7"


@pytest.fixture
def fakes() -> Fakes:
    return Fakes()


def build[UC: _Base](cls: type[UC], f: Fakes) -> UC:
    return cls(
        users=f.users,
        uow=f.uow,
        hasher=f.hasher,
        sessions=f.sessions,
        tokens=f.tokens,
        mailer=f.mailer,
        templates=EmailTemplates("https://zxc.ru.net"),
        limiter=f.limiter,
        clock=f.clock,
        policy=POLICY,
    )


async def register(f: Fakes, email: str = EMAIL, ip: str = IP) -> str:
    result = await build(RegisterUser, f)(Credentials(email, PASSWORD, ip))
    return result.session_token


class TestRegister:
    async def test_creates_user_session_and_sends_verification(self, fakes: Fakes) -> None:
        token = await register(fakes)

        user = await build(GetCurrentUser, fakes)(token)
        assert str(user.email) == "anna@example.com"
        assert not user.email_verified
        assert user.role == Role.USER
        assert fakes.uow.commits == 1
        assert fakes.mailer.sent[0].to == "anna@example.com"
        assert "https://zxc.ru.net/app/verify-email?token=" in fakes.mailer.sent[0].text

    async def test_rejects_taken_email_case_insensitively(self, fakes: Fakes) -> None:
        await register(fakes)

        with pytest.raises(EmailTakenError):
            await register(fakes, email="ANNA@example.com")

    async def test_rejects_weak_password(self, fakes: Fakes) -> None:
        with pytest.raises(WeakPasswordError):
            await build(RegisterUser, fakes)(Credentials(EMAIL, "short", IP))

    async def test_rejects_invalid_email(self, fakes: Fakes) -> None:
        with pytest.raises(InvalidEmailError):
            await build(RegisterUser, fakes)(Credentials("not-an-email", PASSWORD, IP))

    async def test_is_rate_limited_per_ip(self, fakes: Fakes) -> None:
        for i in range(5):
            await register(fakes, email=f"user{i}@example.com")

        with pytest.raises(RateLimitedError):
            await register(fakes, email="user5@example.com")


class TestLogin:
    async def test_with_correct_password(self, fakes: Fakes) -> None:
        await register(fakes)

        result = await build(Login, fakes)(Credentials(" anna@example.COM ", PASSWORD, IP))

        assert str(result.user.email) == "anna@example.com"
        assert result.session_token in fakes.sessions.tokens

    @pytest.mark.parametrize(
        ("email", "password"),
        [(EMAIL, "wrong password!"), ("nobody@example.com", PASSWORD), ("garbage", PASSWORD)],
    )
    async def test_wrong_credentials_look_the_same(
        self, fakes: Fakes, email: str, password: str
    ) -> None:
        await register(fakes)

        with pytest.raises(InvalidCredentialsError):
            await build(Login, fakes)(Credentials(email, password, IP))

    async def test_blocked_user_cannot_sign_in(self, fakes: Fakes) -> None:
        await register(fakes)
        user = next(iter(fakes.users.by_id.values()))
        user.status = UserStatus.BLOCKED

        with pytest.raises(UserBlockedError):
            await build(Login, fakes)(Credentials(EMAIL, PASSWORD, IP))

    async def test_is_rate_limited_per_email(self, fakes: Fakes) -> None:
        await register(fakes)
        login = build(Login, fakes)
        for _ in range(10):
            with pytest.raises(InvalidCredentialsError):
                await login(Credentials(EMAIL, "wrong password!", IP))

        with pytest.raises(RateLimitedError):
            await login(Credentials(EMAIL, PASSWORD, IP))


class TestSession:
    async def test_logout_ends_session(self, fakes: Fakes) -> None:
        token = await register(fakes)

        await build(Logout, fakes)(token)

        with pytest.raises(NotAuthenticatedError):
            await build(GetCurrentUser, fakes)(token)

    @pytest.mark.parametrize("token", [None, "", "unknown"])
    async def test_missing_or_unknown_token(self, fakes: Fakes, token: str | None) -> None:
        with pytest.raises(NotAuthenticatedError):
            await build(GetCurrentUser, fakes)(token)


class TestVerifyEmail:
    async def test_link_from_email_verifies_once(self, fakes: Fakes) -> None:
        await register(fakes)
        token = fakes.mailer.last_token()

        user = await build(VerifyEmail, fakes)(token)

        assert user.email_verified_at == fakes.clock.now()
        with pytest.raises(InvalidTokenError):
            await build(VerifyEmail, fakes)(token)

    async def test_resend_sends_new_link(self, fakes: Fakes) -> None:
        session = await register(fakes)
        user = await build(GetCurrentUser, fakes)(session)

        await build(ResendVerification, fakes)(user)

        assert len(fakes.mailer.sent) == 2

    async def test_resend_is_noop_when_verified(self, fakes: Fakes) -> None:
        session = await register(fakes)
        await build(VerifyEmail, fakes)(fakes.mailer.last_token())
        user = await build(GetCurrentUser, fakes)(session)

        await build(ResendVerification, fakes)(user)

        assert len(fakes.mailer.sent) == 1


class TestPasswordReset:
    async def test_full_reset_flow(self, fakes: Fakes) -> None:
        old_session = await register(fakes)
        await build(RequestPasswordReset, fakes)(PasswordResetRequest(EMAIL, IP))
        token = fakes.mailer.last_token()
        assert "/app/reset-password?token=" in fakes.mailer.sent[-1].text

        await build(ResetPassword, fakes)(PasswordReset(token, "brand new password"))

        result = await build(Login, fakes)(Credentials(EMAIL, "brand new password", IP))
        assert result.user.email_verified, "opening the link proves the inbox"
        assert old_session not in fakes.sessions.tokens, "old sessions are revoked"
        with pytest.raises(InvalidTokenError):
            await build(ResetPassword, fakes)(PasswordReset(token, "another password"))

    @pytest.mark.parametrize("email", ["nobody@example.com", "garbage"])
    async def test_unknown_email_is_silent(self, fakes: Fakes, email: str) -> None:
        await build(RequestPasswordReset, fakes)(PasswordResetRequest(email, IP))

        assert fakes.mailer.sent == []

    async def test_new_password_must_be_strong(self, fakes: Fakes) -> None:
        await register(fakes)
        await build(RequestPasswordReset, fakes)(PasswordResetRequest(EMAIL, IP))

        with pytest.raises(WeakPasswordError):
            await build(ResetPassword, fakes)(PasswordReset(fakes.mailer.last_token(), "123"))


class TestCreateOwner:
    async def test_creates_verified_owner(self, fakes: Fakes) -> None:
        user = await build(CreateOwner, fakes)("owner@example.com", PASSWORD)

        assert user.is_owner
        assert user.email_verified

    async def test_promotes_existing_user_keeping_password(self, fakes: Fakes) -> None:
        await register(fakes)

        user = await build(CreateOwner, fakes)(EMAIL, None)

        assert user.is_owner
        result = await build(Login, fakes)(Credentials(EMAIL, PASSWORD, IP))
        assert result.user.is_owner

    async def test_new_owner_needs_password(self, fakes: Fakes) -> None:
        with pytest.raises(InvalidCredentialsError):
            await build(CreateOwner, fakes)("owner@example.com", None)
