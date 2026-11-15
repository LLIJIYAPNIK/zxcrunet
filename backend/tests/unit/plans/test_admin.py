from uuid import uuid4

import pytest

from tests.fakes import FREE_PLAN, Fakes
from zxcrunet.plans.application.admin import (
    CreatePlan,
    ListPlans,
    PlanExistsError,
    PlanFields,
    UpdatePlan,
)
from zxcrunet.plans.domain.plan import InvalidPlanError, Plan
from zxcrunet.shared.application.admin import Staff
from zxcrunet.shared.domain.errors import NotFoundError

STAFF = Staff(user_id=uuid4())
PRO = PlanFields(title="Про", max_sites=10, max_custom_domains=5, max_upload_mb=50)


@pytest.fixture
def f() -> Fakes:
    return Fakes()


class TestPlanCreate:
    def test_cleans_code_and_title(self) -> None:
        plan = Plan.create(" Pro-2 ", "  Про   плюс ", 1, 2, 3)

        assert plan == Plan("pro-2", "Про плюс", 1, 2, 3)

    @pytest.mark.parametrize(
        ("code", "title", "sites", "domains", "upload", "field"),
        [
            ("", "Про", 1, 1, 1, "code"),
            ("про", "Про", 1, 1, 1, "code"),
            ("pro", "  ", 1, 1, 1, "title"),
            ("pro", "Про", -1, 1, 1, "max_sites"),
            ("pro", "Про", 1, 1001, 1, "max_custom_domains"),
            ("pro", "Про", 1, 1, 0, "max_upload_mb"),
        ],
    )
    def test_rejects_bad_values(
        self, code: str, title: str, sites: int, domains: int, upload: int, field: str
    ) -> None:
        with pytest.raises(InvalidPlanError) as error:
            Plan.create(code, title, sites, domains, upload)
        assert error.value.details["field"] == field


class TestAdmin:
    async def test_create_list_and_log(self, f: Fakes) -> None:
        created = await CreatePlan(f.plans, f.uow, f.audit, f.clock)(STAFF, "pro", PRO)

        plans = await ListPlans(f.plans, f.uow, f.audit, f.clock)(STAFF)

        assert plans == [FREE_PLAN, created]
        assert f.audit.actions == ["plan.create"]
        assert f.audit.records[0].target_id == "pro"

    async def test_code_must_be_new(self, f: Fakes) -> None:
        with pytest.raises(PlanExistsError):
            await CreatePlan(f.plans, f.uow, f.audit, f.clock)(STAFF, "free", PRO)

    async def test_update_changes_limits_and_keeps_previous_in_log(self, f: Fakes) -> None:
        updated = await UpdatePlan(f.plans, f.uow, f.audit, f.clock)(STAFF, "free", PRO)

        assert updated == Plan("free", "Про", 10, 5, 50)
        assert await f.plans.get("free") == updated
        assert f.audit.records[0].details["previous"]["max_sites"] == FREE_PLAN.max_sites
        assert f.uow.commits == 1

    async def test_update_of_unknown_plan(self, f: Fakes) -> None:
        with pytest.raises(NotFoundError):
            await UpdatePlan(f.plans, f.uow, f.audit, f.clock)(STAFF, "gold", PRO)
