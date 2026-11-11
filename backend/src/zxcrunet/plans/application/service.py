from zxcrunet.plans.domain.plan import Plan
from zxcrunet.plans.domain.repository import PlanRepository
from zxcrunet.shared.domain.errors import NotFoundError


class PlanService:
    """Entry point for other contexts: they ask for a plan, never read the table."""

    def __init__(self, plans: PlanRepository) -> None:
        self._plans = plans

    async def get(self, code: str) -> Plan:
        plan = await self._plans.get(code)
        if plan is None:
            raise NotFoundError("Plan not found", {"plan": code})
        return plan
