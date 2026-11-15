"""Owner use cases of the plans context: list, create and edit plans and their limits."""

from dataclasses import asdict, dataclass

from zxcrunet.plans.domain.plan import Plan
from zxcrunet.plans.domain.repository import PlanRepository
from zxcrunet.shared.application.admin import AuditEntry, AuditTrail, Staff
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.uow import UnitOfWork
from zxcrunet.shared.domain.errors import ConflictError, NotFoundError


class PlanExistsError(ConflictError):
    code = "plan_exists"


@dataclass(frozen=True, slots=True)
class PlanFields:
    title: str
    max_sites: int
    max_custom_domains: int
    max_upload_mb: int


class _Admin:
    def __init__(
        self, plans: PlanRepository, uow: UnitOfWork, audit: AuditTrail, clock: Clock
    ) -> None:
        self.plans = plans
        self.uow = uow
        self.audit = audit
        self.clock = clock

    async def _record(self, staff: Staff, action: str, plan: Plan, **extra: object) -> None:
        await self.audit.record(
            AuditEntry(
                actor_id=staff.user_id,
                action=action,
                target_type="plan",
                target_id=plan.code,
                at=self.clock.now(),
                details={**asdict(plan), **extra},
            )
        )


class ListPlans(_Admin):
    async def __call__(self, _: Staff) -> list[Plan]:
        return await self.plans.list()


class CreatePlan(_Admin):
    async def __call__(self, staff: Staff, code: str, fields: PlanFields) -> Plan:
        plan = Plan.create(
            code, fields.title, fields.max_sites, fields.max_custom_domains, fields.max_upload_mb
        )
        if await self.plans.get(plan.code) is not None:
            raise PlanExistsError("A plan with this code exists", {"plan": plan.code})
        await self.plans.add(plan)
        await self._record(staff, "plan.create", plan)
        await self.uow.commit()
        return plan


class UpdatePlan(_Admin):
    """New limits apply at once: they are checked on every action, never copied to users."""

    async def __call__(self, staff: Staff, code: str, fields: PlanFields) -> Plan:
        current = await self.plans.get(code)
        if current is None:
            raise NotFoundError("Plan not found", {"plan": code})
        plan = Plan.create(
            current.code,
            fields.title,
            fields.max_sites,
            fields.max_custom_domains,
            fields.max_upload_mb,
        )
        await self.plans.save(plan)
        await self._record(staff, "plan.update", plan, previous=asdict(current))
        await self.uow.commit()
        return plan
