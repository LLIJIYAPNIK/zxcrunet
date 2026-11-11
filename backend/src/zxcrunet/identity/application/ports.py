from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol
from uuid import UUID


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...

    def verify(self, password_hash: str, password: str) -> bool: ...

    def needs_rehash(self, password_hash: str) -> bool: ...


class SessionStore(Protocol):
    """Server-side sessions. Only a hash of the token is stored."""

    async def create(self, user_id: UUID, ttl_seconds: int) -> str: ...

    async def get_user_id(self, token: str) -> UUID | None: ...

    async def delete(self, token: str) -> None: ...

    async def delete_all(self, user_id: UUID) -> None: ...


class TokenPurpose(StrEnum):
    VERIFY_EMAIL = "verify_email"
    RESET_PASSWORD = "reset_password"  # noqa: S105 — a purpose name, not a secret


class OneTimeTokenStore(Protocol):
    async def issue(self, purpose: TokenPurpose, user_id: UUID, ttl_seconds: int) -> str: ...

    async def consume(self, purpose: TokenPurpose, token: str) -> UUID | None:
        """Return the user id and invalidate the token; None if unknown or expired."""


@dataclass(frozen=True, slots=True)
class EmailMessage:
    to: str
    subject: str
    text: str


class Mailer(Protocol):
    async def send(self, message: EmailMessage) -> None: ...
