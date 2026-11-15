from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol
from uuid import UUID

from zxcrunet.identity.domain.user import Email, Role, User, UserStatus


@dataclass(frozen=True, slots=True)
class UserFilter:
    #: Part of the email, lower-case.
    text: str | None = None
    status: UserStatus | None = None
    role: Role | None = None
    plan_code: str | None = None


class UserRepository(Protocol):
    async def get(self, user_id: UUID) -> User | None: ...

    async def get_by_email(self, email: Email) -> User | None: ...

    async def add(self, user: User) -> None: ...

    async def save(self, user: User) -> None: ...

    async def search(self, where: UserFilter, offset: int, limit: int) -> tuple[list[User], int]:
        """Newest first; returns the page and the total number of matches."""

    async def emails(self, ids: set[UUID]) -> dict[UUID, str]: ...

    async def count(self) -> int: ...

    async def registrations_by_day(self, since: datetime) -> dict[date, int]:
        """Sign-ups per UTC day from `since` on (days without sign-ups are left out)."""
