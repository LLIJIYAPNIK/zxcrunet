from dishka import Provider, Scope, provide
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.plans.application.service import PlanService
from zxcrunet.plans.domain.repository import PlanRepository
from zxcrunet.plans.infrastructure.repository import SqlPlanRepository


class PlansProvider(Provider):
    scope = Scope.REQUEST

    @provide
    def repository(self, session: AsyncSession) -> PlanRepository:
        return SqlPlanRepository(session)

    service = provide(PlanService)
