import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from zxcrunet.identity.domain.errors import (
    InvalidEmailError,
    OwnerProtectedError,
    UserBlockedError,
    WeakPasswordError,
)
from zxcrunet.plans.domain.plan import FREE_PLAN_CODE
from zxcrunet.shared.domain.ids import uuid7

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$")
EMAIL_MAX_LENGTH = 254
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


class Role(StrEnum):
    USER = "user"
    OWNER = "owner"


class UserStatus(StrEnum):
    ACTIVE = "active"
    BLOCKED = "blocked"


@dataclass(frozen=True, slots=True)
class Email:
    value: str

    @classmethod
    def parse(cls, raw: str) -> "Email":
        value = raw.strip().lower()
        if len(value) > EMAIL_MAX_LENGTH or not EMAIL_RE.fullmatch(value):
            raise InvalidEmailError("Invalid email address")
        return cls(value)

    def __str__(self) -> str:
        return self.value


def validate_password(raw: str, email: Email) -> None:
    if len(raw) < PASSWORD_MIN_LENGTH:
        raise WeakPasswordError("Password is too short", {"min_length": PASSWORD_MIN_LENGTH})
    if len(raw) > PASSWORD_MAX_LENGTH:
        raise WeakPasswordError("Password is too long", {"max_length": PASSWORD_MAX_LENGTH})
    if raw.strip().lower() in {email.value, email.value.split("@")[0]}:
        raise WeakPasswordError("Password must not repeat the email")


@dataclass(slots=True)
class User:
    email: Email
    password_hash: str
    created_at: datetime
    id: UUID = field(default_factory=uuid7)
    role: Role = Role.USER
    status: UserStatus = UserStatus.ACTIVE
    plan_code: str = FREE_PLAN_CODE
    email_verified_at: datetime | None = None

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None

    @property
    def is_owner(self) -> bool:
        return self.role == Role.OWNER

    def verify_email(self, now: datetime) -> None:
        if self.email_verified_at is None:
            self.email_verified_at = now

    def change_password(self, password_hash: str) -> None:
        self.password_hash = password_hash

    def promote_to_owner(self) -> None:
        self.role = Role.OWNER

    @property
    def is_blocked(self) -> bool:
        return self.status == UserStatus.BLOCKED

    def block(self) -> None:
        if self.is_owner:
            raise OwnerProtectedError("The owner cannot be blocked")
        self.status = UserStatus.BLOCKED

    def unblock(self) -> None:
        self.status = UserStatus.ACTIVE

    def change_plan(self, plan_code: str) -> None:
        self.plan_code = plan_code

    def ensure_active(self) -> None:
        if self.status == UserStatus.BLOCKED:
            raise UserBlockedError("User is blocked")
