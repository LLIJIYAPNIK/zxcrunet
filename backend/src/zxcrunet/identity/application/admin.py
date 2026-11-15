"""Owner (admin panel) use cases of the identity context: users, blocking, plans."""

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

from zxcrunet.identity.application.ports import SessionStore
from zxcrunet.identity.application.use_cases import GetCurrentUser
from zxcrunet.identity.domain.errors import NotOwnerError
from zxcrunet.identity.domain.repository import UserFilter, UserRepository
from zxcrunet.identity.domain.user import User
from zxcrunet.plans.application.service import PlanService
from zxcrunet.shared.application.admin import AuditEntry, AuditTrail, Paging, Slice, Staff
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.uow import UnitOfWork
from zxcrunet.shared.domain.errors import NotFoundError

REASON_MAX = 500


def clean_reason(raw: str) -> str:
    return " ".join(raw.split())[:REASON_MAX]


class AuthorizeOwner:
    """The only way to get a Staff: a valid session of a user with the `owner` role."""

    def __init__(self, get_current: GetCurrentUser) -> None:
        self.get_current = get_current

    async def __call__(self, session_token: str | None) -> Staff:
        user = await self.get_current(session_token)
        if not user.is_owner:
            raise NotOwnerError("Only the owner can do this")
        return Staff(user_id=user.id)


class _Admin:
    def __init__(
        self, users: UserRepository, uow: UnitOfWork, audit: AuditTrail, clock: Clock
    ) -> None:
        self.users = users
        self.uow = uow
        self.audit = audit
        self.clock = clock

    async def _user(self, user_id: UUID) -> User:
        user = await self.users.get(user_id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    async def _record(self, staff: Staff, action: str, user: User, **details: object) -> None:
        await self.audit.record(
            AuditEntry(
                actor_id=staff.user_id,
                action=action,
                target_type="user",
                target_id=str(user.id),
                at=self.clock.now(),
                details={"email": str(user.email), **details},
            )
        )


class ListUsers(_Admin):
    async def __call__(self, _: Staff, where: UserFilter, paging: Paging) -> Slice[User]:
        users, total = await self.users.search(where, paging.offset, paging.limit)
        return Slice(users, total)


class GetUser(_Admin):
    async def __call__(self, _: Staff, user_id: UUID) -> User:
        return await self._user(user_id)


class BlockUser(_Admin):
    """Blocks sign-in and ends every session of the user right away."""

    def __init__(
        self,
        users: UserRepository,
        uow: UnitOfWork,
        audit: AuditTrail,
        clock: Clock,
        sessions: SessionStore,
    ) -> None:
        super().__init__(users, uow, audit, clock)
        self.sessions = sessions

    async def __call__(self, staff: Staff, user_id: UUID, reason: str) -> User:
        user = await self._user(user_id)
        if user.is_blocked:
            return user
        user.block()
        await self.users.save(user)
        await self._record(staff, "user.block", user, reason=clean_reason(reason))
        await self.uow.commit()
        await self.sessions.delete_all(user.id)
        return user


class UnblockUser(_Admin):
    async def __call__(self, staff: Staff, user_id: UUID) -> User:
        user = await self._user(user_id)
        if not user.is_blocked:
            return user
        user.unblock()
        await self.users.save(user)
        await self._record(staff, "user.unblock", user)
        await self.uow.commit()
        return user


class ChangeUserPlan(_Admin):
    def __init__(
        self,
        users: UserRepository,
        uow: UnitOfWork,
        audit: AuditTrail,
        clock: Clock,
        plans: PlanService,
    ) -> None:
        super().__init__(users, uow, audit, clock)
        self.plans = plans

    async def __call__(self, staff: Staff, user_id: UUID, plan_code: str) -> User:
        user = await self._user(user_id)
        plan = await self.plans.get(plan_code)
        if user.plan_code == plan.code:
            return user
        previous = user.plan_code
        user.change_plan(plan.code)
        await self.users.save(user)
        await self._record(staff, "user.plan", user, plan=plan.code, previous=previous)
        await self.uow.commit()
        return user


@dataclass(frozen=True, slots=True)
class UserTotals:
    users: int
    registrations: dict[date, int]


class UserDirectory:
    """Read-only answers for other contexts (admin lists, the dashboard)."""

    def __init__(self, users: UserRepository) -> None:
        self.users = users

    async def emails(self, ids: set[UUID]) -> dict[UUID, str]:
        return await self.users.emails(ids)

    async def totals(self, since: datetime) -> UserTotals:
        return UserTotals(
            users=await self.users.count(),
            registrations=await self.users.registrations_by_day(since),
        )
