from datetime import timedelta
from uuid import uuid4

import pytest

from tests.fakes import Fakes
from zxcrunet.identity.application.admin import (
    AuthorizeOwner,
    BlockUser,
    ChangeUserPlan,
    GetUser,
    ListUsers,
    UnblockUser,
    UserDirectory,
)
from zxcrunet.identity.application.emails import EmailTemplates
from zxcrunet.identity.application.use_cases import AuthPolicy, GetCurrentUser
from zxcrunet.identity.domain.errors import NotOwnerError, OwnerProtectedError, UserBlockedError
from zxcrunet.identity.domain.repository import UserFilter
from zxcrunet.identity.domain.user import Email, Role, User, UserStatus
from zxcrunet.plans.application.service import PlanService
from zxcrunet.plans.domain.plan import Plan
from zxcrunet.shared.application.admin import Paging, Staff
from zxcrunet.shared.domain.errors import NotAuthenticatedError, NotFoundError

POLICY = AuthPolicy(
    session_ttl_seconds=3600, verify_email_ttl_seconds=3600, reset_password_ttl_seconds=3600
)
STAFF = Staff(user_id=uuid4())


@pytest.fixture
def f() -> Fakes:
    return Fakes()


async def user(f: Fakes, email: str, *, owner: bool = False, minutes: int = 0) -> User:
    created = User(
        email=Email(email),
        password_hash="hashed:x",
        created_at=f.clock.now() + timedelta(minutes=minutes),
    )
    if owner:
        created.promote_to_owner()
    await f.users.add(created)
    return created


def get_current(f: Fakes) -> GetCurrentUser:
    return GetCurrentUser(
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


class TestAuthorizeOwner:
    async def test_owner_gets_a_staff(self, f: Fakes) -> None:
        owner = await user(f, "owner@example.com", owner=True)
        token = await f.sessions.create(owner.id, 60)

        staff = await AuthorizeOwner(get_current(f))(token)

        assert staff == Staff(user_id=owner.id)

    async def test_regular_user_is_forbidden(self, f: Fakes) -> None:
        anna = await user(f, "anna@example.com")
        token = await f.sessions.create(anna.id, 60)

        with pytest.raises(NotOwnerError):
            await AuthorizeOwner(get_current(f))(token)

    async def test_no_session_is_not_authenticated(self, f: Fakes) -> None:
        with pytest.raises(NotAuthenticatedError):
            await AuthorizeOwner(get_current(f))(None)


class TestListAndGet:
    async def test_searches_by_email_newest_first(self, f: Fakes) -> None:
        await user(f, "anna@example.com", minutes=1)
        await user(f, "boris@example.com", minutes=2)
        await user(f, "anna.k@mail.test", minutes=3)
        list_users = ListUsers(f.users, f.uow, f.audit, f.clock)

        found = await list_users(STAFF, UserFilter(text="anna"), Paging(0, 10))

        assert [str(u.email) for u in found.items] == ["anna.k@mail.test", "anna@example.com"]
        assert found.total == 2

    async def test_filters_and_pages(self, f: Fakes) -> None:
        for i in range(5):
            await user(f, f"u{i}@example.com", minutes=i)
        await user(f, "owner@example.com", owner=True, minutes=10)
        list_users = ListUsers(f.users, f.uow, f.audit, f.clock)

        page = await list_users(STAFF, UserFilter(role=Role.USER), Paging(offset=1, limit=2))

        assert [str(u.email) for u in page.items] == ["u3@example.com", "u2@example.com"]
        assert page.total == 5

    async def test_paging_is_clamped(self) -> None:
        assert Paging(offset=-5, limit=1000) == Paging(offset=0, limit=100)

    async def test_missing_user_is_not_found(self, f: Fakes) -> None:
        with pytest.raises(NotFoundError):
            await GetUser(f.users, f.uow, f.audit, f.clock)(STAFF, uuid4())


class TestBlock:
    async def test_blocks_ends_sessions_and_logs(self, f: Fakes) -> None:
        anna = await user(f, "anna@example.com")
        token = await f.sessions.create(anna.id, 60)
        block = BlockUser(f.users, f.uow, f.audit, f.clock, f.sessions)

        blocked = await block(STAFF, anna.id, "  spam   links ")

        assert blocked.status == UserStatus.BLOCKED
        assert await f.sessions.get_user_id(token) is None
        assert f.audit.actions == ["user.block"]
        assert f.audit.records[0].details == {"email": "anna@example.com", "reason": "spam links"}
        assert f.audit.records[0].actor_id == STAFF.user_id
        assert f.uow.commits == 1
        with pytest.raises(UserBlockedError):
            await get_current(f)(await f.sessions.create(anna.id, 60))

    async def test_blocking_twice_changes_nothing(self, f: Fakes) -> None:
        anna = await user(f, "anna@example.com")
        block = BlockUser(f.users, f.uow, f.audit, f.clock, f.sessions)
        await block(STAFF, anna.id, "")

        await block(STAFF, anna.id, "")

        assert f.audit.actions == ["user.block"]

    async def test_owner_cannot_be_blocked(self, f: Fakes) -> None:
        owner = await user(f, "owner@example.com", owner=True)

        with pytest.raises(OwnerProtectedError):
            await BlockUser(f.users, f.uow, f.audit, f.clock, f.sessions)(STAFF, owner.id, "")
        assert f.audit.records == []

    async def test_unblock(self, f: Fakes) -> None:
        anna = await user(f, "anna@example.com")
        await BlockUser(f.users, f.uow, f.audit, f.clock, f.sessions)(STAFF, anna.id, "")

        restored = await UnblockUser(f.users, f.uow, f.audit, f.clock)(STAFF, anna.id)

        assert restored.status == UserStatus.ACTIVE
        assert f.audit.actions == ["user.block", "user.unblock"]


class TestChangePlan:
    async def test_moves_user_to_another_plan(self, f: Fakes) -> None:
        await f.plans.add(Plan("pro", "Про", 10, 10, 50))
        anna = await user(f, "anna@example.com")
        change = ChangeUserPlan(f.users, f.uow, f.audit, f.clock, PlanService(f.plans))

        changed = await change(STAFF, anna.id, "pro")

        assert changed.plan_code == "pro"
        assert (await f.users.get(anna.id)).plan_code == "pro"  # type: ignore[union-attr]
        assert f.audit.records[0].details["previous"] == "free"

    async def test_unknown_plan_is_not_found(self, f: Fakes) -> None:
        anna = await user(f, "anna@example.com")
        change = ChangeUserPlan(f.users, f.uow, f.audit, f.clock, PlanService(f.plans))

        with pytest.raises(NotFoundError):
            await change(STAFF, anna.id, "gold")
        assert f.audit.records == []


class TestDirectory:
    async def test_emails_and_registrations(self, f: Fakes) -> None:
        anna = await user(f, "anna@example.com")
        await user(f, "boris@example.com", minutes=60 * 24)
        directory = UserDirectory(f.users)

        assert await directory.emails({anna.id, uuid4()}) == {anna.id: "anna@example.com"}
        totals = await directory.totals(f.clock.now())
        assert totals.users == 2
        assert sorted(totals.registrations.values()) == [1, 1]
