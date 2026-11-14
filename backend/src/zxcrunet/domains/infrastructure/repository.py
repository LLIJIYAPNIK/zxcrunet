from datetime import datetime
from uuid import UUID

from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.domains.domain.domain import (
    SERVING,
    CustomDomain,
    DomainStatus,
    Hostname,
    Problem,
)
from zxcrunet.domains.domain.errors import DomainAlreadyAddedError, DomainTakenError
from zxcrunet.domains.infrastructure.models import CustomDomainModel

_SERVING = [s.value for s in SERVING]


def _to_domain(row: CustomDomainModel) -> CustomDomain:
    return CustomDomain(
        id=row.id,
        site_id=row.site_id,
        owner_id=row.owner_id,
        host=Hostname(row.host),
        verification_token=row.verification_token,
        status=DomainStatus(row.status),
        created_at=row.created_at,
        checks_started_at=row.checks_started_at,
        attempts=row.attempts,
        failures=row.failures,
        last_checked_at=row.last_checked_at,
        problems=[Problem(p["code"], dict(p.get("details") or {})) for p in row.problems],
        next_check_at=row.next_check_at,
        verified_at=row.verified_at,
        activated_at=row.activated_at,
    )


def _apply(row: CustomDomainModel, domain: CustomDomain) -> None:
    row.site_id = domain.site_id
    row.owner_id = domain.owner_id
    row.host = domain.host.value
    row.verification_token = domain.verification_token
    row.status = domain.status.value
    row.created_at = domain.created_at
    row.checks_started_at = domain.checks_started_at
    row.attempts = domain.attempts
    row.failures = domain.failures
    row.last_checked_at = domain.last_checked_at
    row.problems = [p.as_dict() for p in domain.problems]
    row.next_check_at = domain.next_check_at
    row.verified_at = domain.verified_at
    row.activated_at = domain.activated_at


class SqlDomainRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, domain_id: UUID) -> CustomDomain | None:
        row = await self._session.get(CustomDomainModel, domain_id)
        return _to_domain(row) if row else None

    async def list_by_site(self, site_id: UUID) -> list[CustomDomain]:
        rows = await self._session.scalars(
            select(CustomDomainModel)
            .where(CustomDomainModel.site_id == site_id)
            .order_by(CustomDomainModel.created_at)
        )
        return [_to_domain(r) for r in rows]

    async def count_by_owner(self, owner_id: UUID) -> int:
        count = await self._session.scalar(
            select(func.count())
            .select_from(CustomDomainModel)
            .where(CustomDomainModel.owner_id == owner_id)
        )
        return int(count or 0)

    async def added_by_owner(self, owner_id: UUID, host: Hostname) -> bool:
        query = exists().where(
            CustomDomainModel.owner_id == owner_id, CustomDomainModel.host == host.value
        )
        return bool(await self._session.scalar(select(query)))

    async def claimed(self, host: Hostname, *, except_id: UUID | None = None) -> bool:
        query = exists().where(
            CustomDomainModel.host == host.value, CustomDomainModel.status.in_(_SERVING)
        )
        if except_id is not None:
            query = query.where(CustomDomainModel.id != except_id)
        return bool(await self._session.scalar(select(query)))

    async def serving(self, host: Hostname) -> CustomDomain | None:
        row = await self._session.scalar(
            select(CustomDomainModel).where(
                CustomDomainModel.host == host.value, CustomDomainModel.status.in_(_SERVING)
            )
        )
        return _to_domain(row) if row else None

    async def due(self, now: datetime, limit: int) -> list[UUID]:
        rows = await self._session.scalars(
            select(CustomDomainModel.id)
            .where(CustomDomainModel.next_check_at <= now)
            .order_by(CustomDomainModel.next_check_at)
            .limit(limit)
        )
        return list(rows)

    async def add(self, domain: CustomDomain) -> None:
        row = CustomDomainModel(id=domain.id)
        _apply(row, domain)
        self._session.add(row)
        try:
            await self._session.flush()
        except IntegrityError as exc:
            await self._session.rollback()
            raise DomainAlreadyAddedError("You have already added this domain") from exc

    async def save(self, domain: CustomDomain) -> None:
        row = await self._session.get(CustomDomainModel, domain.id)
        if row is None:
            msg = f"Domain {domain.id} does not exist"
            raise LookupError(msg)
        _apply(row, domain)
        try:
            await self._session.flush()
        except IntegrityError as exc:
            # Two sites proved the same host at once: the first commit wins.
            await self._session.rollback()
            raise DomainTakenError("This domain is attached to another site") from exc

    async def delete(self, domain: CustomDomain) -> None:
        row = await self._session.get(CustomDomainModel, domain.id)
        if row is not None:
            await self._session.delete(row)
            await self._session.flush()
