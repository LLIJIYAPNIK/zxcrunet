from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.identity.domain.errors import EmailTakenError
from zxcrunet.identity.domain.user import Email, Role, User, UserStatus
from zxcrunet.identity.infrastructure.models import UserModel


def _to_domain(row: UserModel) -> User:
    return User(
        id=row.id,
        email=Email(row.email),
        password_hash=row.password_hash,
        role=Role(row.role),
        status=UserStatus(row.status),
        plan_code=row.plan_code,
        email_verified_at=row.email_verified_at,
        created_at=row.created_at,
    )


def _apply(row: UserModel, user: User) -> None:
    row.email = user.email.value
    row.password_hash = user.password_hash
    row.role = user.role.value
    row.status = user.status.value
    row.plan_code = user.plan_code
    row.email_verified_at = user.email_verified_at
    row.created_at = user.created_at


class SqlUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, user_id: UUID) -> User | None:
        row = await self._session.get(UserModel, user_id)
        return _to_domain(row) if row else None

    async def get_by_email(self, email: Email) -> User | None:
        row = await self._session.scalar(select(UserModel).where(UserModel.email == email.value))
        return _to_domain(row) if row else None

    async def add(self, user: User) -> None:
        row = UserModel(id=user.id)
        _apply(row, user)
        self._session.add(row)
        try:
            await self._session.flush()
        except IntegrityError as exc:
            await self._session.rollback()
            raise EmailTakenError("Email is already registered") from exc

    async def save(self, user: User) -> None:
        row = await self._session.get(UserModel, user.id)
        if row is None:
            msg = f"User {user.id} does not exist"
            raise LookupError(msg)
        _apply(row, user)
        await self._session.flush()
