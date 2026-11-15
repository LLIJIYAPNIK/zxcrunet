from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.plans.domain.plan import Plan
from zxcrunet.plans.infrastructure.models import PlanModel


def _to_domain(row: PlanModel) -> Plan:
    return Plan(
        code=row.code,
        title=row.title,
        max_sites=row.max_sites,
        max_custom_domains=row.max_custom_domains,
        max_upload_mb=row.max_upload_mb,
    )


def _apply(row: PlanModel, plan: Plan) -> None:
    row.title = plan.title
    row.max_sites = plan.max_sites
    row.max_custom_domains = plan.max_custom_domains
    row.max_upload_mb = plan.max_upload_mb


class SqlPlanRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, code: str) -> Plan | None:
        row = await self._session.get(PlanModel, code)
        return _to_domain(row) if row else None

    async def list(self) -> list[Plan]:
        rows = await self._session.scalars(
            select(PlanModel).order_by(PlanModel.max_sites, PlanModel.code)
        )
        return [_to_domain(r) for r in rows]

    async def add(self, plan: Plan) -> None:
        row = PlanModel(code=plan.code)
        _apply(row, plan)
        self._session.add(row)
        await self._session.flush()

    async def save(self, plan: Plan) -> None:
        row = await self._session.get(PlanModel, plan.code)
        if row is None:
            msg = f"Plan {plan.code} does not exist"
            raise LookupError(msg)
        _apply(row, plan)
        await self._session.flush()
