"""Admin panel: plans and their limits (owner only)."""

from http import HTTPStatus

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from zxcrunet.identity.api.current import current_staff
from zxcrunet.identity.application.admin import AuthorizeOwner
from zxcrunet.plans.application.admin import CreatePlan, ListPlans, PlanFields, UpdatePlan
from zxcrunet.plans.domain.plan import DEFAULT_VIDEO_MB, Plan
from zxcrunet.shared.config import Settings

router = APIRouter(prefix="/api/admin/plans", tags=["admin"], route_class=DishkaRoute)


class PlanOut(BaseModel):
    code: str
    title: str
    max_sites: int
    max_custom_domains: int
    max_upload_mb: int
    max_video_mb: int

    @classmethod
    def of(cls, plan: Plan) -> "PlanOut":
        return cls(
            code=plan.code,
            title=plan.title,
            max_sites=plan.max_sites,
            max_custom_domains=plan.max_custom_domains,
            max_upload_mb=plan.max_upload_mb,
            max_video_mb=plan.max_video_mb,
        )


class PlansOut(BaseModel):
    items: list[PlanOut]


class PlanFieldsIn(BaseModel):
    title: str = Field(max_length=64)
    max_sites: int = Field(ge=0, le=1000)
    max_custom_domains: int = Field(ge=0, le=1000)
    max_upload_mb: int = Field(ge=1, le=100)
    max_video_mb: int = Field(default=DEFAULT_VIDEO_MB, ge=1, le=100)

    def fields(self) -> PlanFields:
        return PlanFields(
            title=self.title,
            max_sites=self.max_sites,
            max_custom_domains=self.max_custom_domains,
            max_upload_mb=self.max_upload_mb,
            max_video_mb=self.max_video_mb,
        )


class CreatePlanIn(PlanFieldsIn):
    code: str = Field(max_length=32)


@router.get("")
async def list_plans(
    request: Request,
    use_case: FromDishka[ListPlans],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
) -> PlansOut:
    staff = await current_staff(request, authorize, settings)
    return PlansOut(items=[PlanOut.of(p) for p in await use_case(staff)])


@router.post("", status_code=HTTPStatus.CREATED)
async def create_plan(
    body: CreatePlanIn,
    request: Request,
    use_case: FromDishka[CreatePlan],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
) -> PlanOut:
    staff = await current_staff(request, authorize, settings)
    return PlanOut.of(await use_case(staff, body.code, body.fields()))


@router.put("/{code}")
async def update_plan(
    code: str,
    body: PlanFieldsIn,
    request: Request,
    use_case: FromDishka[UpdatePlan],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
) -> PlanOut:
    staff = await current_staff(request, authorize, settings)
    return PlanOut.of(await use_case(staff, code, body.fields()))
