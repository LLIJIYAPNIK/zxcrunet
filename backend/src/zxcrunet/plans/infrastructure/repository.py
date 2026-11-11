from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.plans.domain.plan import Plan
from zxcrunet.plans.infrastructure.models import PlanModel


class SqlPlanRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, code: str) -> Plan | None:
        row = await self._session.get(PlanModel, code)
        if row is None:
            return None
        return Plan(
            code=row.code,
            title=row.title,
            max_sites=row.max_sites,
            max_custom_domains=row.max_custom_domains,
            max_upload_mb=row.max_upload_mb,
        )
