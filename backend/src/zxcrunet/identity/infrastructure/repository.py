from datetime import date, datetime
from uuid import UUID

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.identity.domain.errors import EmailTakenError
from zxcrunet.identity.domain.repository import UserFilter
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

    async def search(self, where: UserFilter, offset: int, limit: int) -> tuple[list[User], int]:
        conditions: list[ColumnElement[bool]] = []
        if where.text:
            conditions.append(UserModel.email.contains(where.text, autoescape=True))
        if where.status:
            conditions.append(UserModel.status == where.status.value)
        if where.role:
            conditions.append(UserModel.role == where.role.value)
        if where.plan_code:
            conditions.append(UserModel.plan_code == where.plan_code)
        total = await self._session.scalar(
            select(func.count()).select_from(UserModel).where(*conditions)
        )
        rows = await self._session.scalars(
            select(UserModel)
            .where(*conditions)
            .order_by(UserModel.created_at.desc(), UserModel.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return [_to_domain(r) for r in rows], int(total or 0)

    async def emails(self, ids: set[UUID]) -> dict[UUID, str]:
        if not ids:
            return {}
        rows = await self._session.execute(
            select(UserModel.id, UserModel.email).where(UserModel.id.in_(ids))
        )
        return {row.id: row.email for row in rows}

    async def count(self) -> int:
        return int(await self._session.scalar(select(func.count()).select_from(UserModel)) or 0)

    async def registrations_by_day(self, since: datetime) -> dict[date, int]:
        day = func.date(func.timezone("UTC", UserModel.created_at)).label("day")
        rows = await self._session.execute(
            select(day, func.count()).where(UserModel.created_at >= since).group_by(day)
        )
        return {row[0]: int(row[1]) for row in rows}
