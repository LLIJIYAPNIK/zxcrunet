"""Identity use cases: registration, sessions, email verification, password reset."""

from dataclasses import dataclass

from zxcrunet.identity.application.emails import EmailTemplates
from zxcrunet.identity.application.ports import (
    Mailer,
    OneTimeTokenStore,
    PasswordHasher,
    SessionStore,
    TokenPurpose,
)
from zxcrunet.identity.domain.errors import (
    EmailTakenError,
    InvalidCredentialsError,
    InvalidEmailError,
    InvalidTokenError,
)
from zxcrunet.identity.domain.repository import UserRepository
from zxcrunet.identity.domain.user import Email, User, UserStatus, validate_password
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.rate_limit import RateLimiter, enforce
from zxcrunet.shared.application.uow import UnitOfWork
from zxcrunet.shared.domain.errors import NotAuthenticatedError

HOUR = 3600


@dataclass(frozen=True, slots=True)
class AuthPolicy:
    session_ttl_seconds: int
    verify_email_ttl_seconds: int
    reset_password_ttl_seconds: int
    register_per_ip_per_hour: int = 5


@dataclass(frozen=True, slots=True)
class AuthResult:
    user: User
    session_token: str


@dataclass(frozen=True, slots=True)
class Credentials:
    email: str
    password: str
    ip: str


class _Base:
    def __init__(
        self,
        users: UserRepository,
        uow: UnitOfWork,
        hasher: PasswordHasher,
        sessions: SessionStore,
        tokens: OneTimeTokenStore,
        mailer: Mailer,
        templates: EmailTemplates,
        limiter: RateLimiter,
        clock: Clock,
        policy: AuthPolicy,
    ) -> None:
        self.users = users
        self.uow = uow
        self.hasher = hasher
        self.sessions = sessions
        self.tokens = tokens
        self.mailer = mailer
        self.templates = templates
        self.limiter = limiter
        self.clock = clock
        self.policy = policy

    async def _send_verification(self, user: User) -> None:
        token = await self.tokens.issue(
            TokenPurpose.VERIFY_EMAIL, user.id, self.policy.verify_email_ttl_seconds
        )
        await self.mailer.send(
            self.templates.verify_email(
                str(user.email), token, self.policy.verify_email_ttl_seconds // HOUR
            )
        )

    async def _start_session(self, user: User) -> AuthResult:
        token = await self.sessions.create(user.id, self.policy.session_ttl_seconds)
        return AuthResult(user=user, session_token=token)


class RegisterUser(_Base):
    async def __call__(self, cmd: Credentials) -> AuthResult:
        await enforce(
            self.limiter,
            f"register:ip:{cmd.ip}",
            limit=self.policy.register_per_ip_per_hour,
            window_seconds=HOUR,
        )
        email = Email.parse(cmd.email)
        validate_password(cmd.password, email)
        if await self.users.get_by_email(email) is not None:
            raise EmailTakenError("Email is already registered")

        user = User(
            email=email, password_hash=self.hasher.hash(cmd.password), created_at=self.clock.now()
        )
        await self.users.add(user)
        await self.uow.commit()

        await self._send_verification(user)
        return await self._start_session(user)


class Login(_Base):
    WINDOW = 15 * 60

    async def __call__(self, cmd: Credentials) -> AuthResult:
        await enforce(self.limiter, f"login:ip:{cmd.ip}", limit=30, window_seconds=self.WINDOW)
        try:
            email = Email.parse(cmd.email)
        except InvalidEmailError as exc:
            raise InvalidCredentialsError("Wrong email or password") from exc
        await enforce(self.limiter, f"login:email:{email}", limit=10, window_seconds=self.WINDOW)

        user = await self.users.get_by_email(email)
        if user is None:
            # Spend the same time as a real check so timing does not reveal accounts.
            self.hasher.verify(_DUMMY_HASH.get(self.hasher), cmd.password)
            raise InvalidCredentialsError("Wrong email or password")
        if not self.hasher.verify(user.password_hash, cmd.password):
            raise InvalidCredentialsError("Wrong email or password")
        user.ensure_active()

        if self.hasher.needs_rehash(user.password_hash):
            user.change_password(self.hasher.hash(cmd.password))
            await self.users.save(user)
            await self.uow.commit()
        return await self._start_session(user)


class _DummyHash:
    """Lazily computed hash of a random password, per hasher instance."""

    def __init__(self) -> None:
        self._cache: dict[int, str] = {}

    def get(self, hasher: PasswordHasher) -> str:
        key = id(hasher)
        if key not in self._cache:
            self._cache[key] = hasher.hash("zxcrunet-dummy-password")
        return self._cache[key]


_DUMMY_HASH = _DummyHash()


class Logout(_Base):
    async def __call__(self, session_token: str | None) -> None:
        if session_token:
            await self.sessions.delete(session_token)


class GetCurrentUser(_Base):
    async def __call__(self, session_token: str | None) -> User:
        if not session_token:
            raise NotAuthenticatedError("Not signed in")
        user_id = await self.sessions.get_user_id(session_token)
        user = await self.users.get(user_id) if user_id else None
        if user is None:
            raise NotAuthenticatedError("Session expired")
        user.ensure_active()
        return user


class VerifyEmail(_Base):
    async def __call__(self, token: str) -> User:
        user_id = await self.tokens.consume(TokenPurpose.VERIFY_EMAIL, token)
        user = await self.users.get(user_id) if user_id else None
        if user is None:
            raise InvalidTokenError("Link is invalid or expired")
        user.verify_email(self.clock.now())
        await self.users.save(user)
        await self.uow.commit()
        return user


class ResendVerification(_Base):
    async def __call__(self, user: User) -> None:
        if user.email_verified:
            return
        await enforce(self.limiter, f"resend:user:{user.id}", limit=3, window_seconds=HOUR)
        await self._send_verification(user)


@dataclass(frozen=True, slots=True)
class PasswordResetRequest:
    email: str
    ip: str


class RequestPasswordReset(_Base):
    """Always succeeds from the caller's point of view, so accounts cannot be probed."""

    async def __call__(self, cmd: PasswordResetRequest) -> None:
        await enforce(self.limiter, f"forgot:ip:{cmd.ip}", limit=10, window_seconds=HOUR)
        try:
            email = Email.parse(cmd.email)
        except InvalidEmailError:
            return
        await enforce(self.limiter, f"forgot:email:{email}", limit=3, window_seconds=HOUR)
        user = await self.users.get_by_email(email)
        if user is None or user.status != UserStatus.ACTIVE:
            return
        token = await self.tokens.issue(
            TokenPurpose.RESET_PASSWORD, user.id, self.policy.reset_password_ttl_seconds
        )
        await self.mailer.send(
            self.templates.reset_password(
                str(user.email), token, self.policy.reset_password_ttl_seconds // 60
            )
        )


@dataclass(frozen=True, slots=True)
class PasswordReset:
    token: str
    password: str


class ResetPassword(_Base):
    async def __call__(self, cmd: PasswordReset) -> None:
        user_id = await self.tokens.consume(TokenPurpose.RESET_PASSWORD, cmd.token)
        user = await self.users.get(user_id) if user_id else None
        if user is None:
            raise InvalidTokenError("Link is invalid or expired")
        validate_password(cmd.password, user.email)
        user.change_password(self.hasher.hash(cmd.password))
        # Opening the link from the inbox proves the address belongs to the user.
        user.verify_email(self.clock.now())
        await self.users.save(user)
        await self.uow.commit()
        await self.sessions.delete_all(user.id)


class CreateOwner(_Base):
    """CLI: create the product owner, or promote an existing user."""

    async def __call__(self, email_raw: str, password: str | None) -> User:
        email = Email.parse(email_raw)
        user = await self.users.get_by_email(email)
        if user is None:
            if password is None:
                raise InvalidCredentialsError("Password is required for a new owner")
            validate_password(password, email)
            user = User(
                email=email, password_hash=self.hasher.hash(password), created_at=self.clock.now()
            )
            user.promote_to_owner()
            user.verify_email(self.clock.now())
            await self.users.add(user)
        else:
            user.promote_to_owner()
            user.verify_email(self.clock.now())
            if password is not None:
                validate_password(password, email)
                user.change_password(self.hasher.hash(password))
            await self.users.save(user)
        await self.uow.commit()
        return user
