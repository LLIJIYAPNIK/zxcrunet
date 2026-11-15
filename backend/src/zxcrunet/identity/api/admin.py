"""Admin panel: users (owner only)."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from dishka.integrations.fastapi import DishkaRoute, FromDishka
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from zxcrunet.identity.api.current import current_staff
from zxcrunet.identity.application.admin import (
    AuthorizeOwner,
    BlockUser,
    ChangeUserPlan,
    GetUser,
    ListUsers,
    UnblockUser,
)
from zxcrunet.identity.domain.repository import UserFilter
from zxcrunet.identity.domain.user import Role, User, UserStatus
from zxcrunet.shared.application.admin import Paging, search_text
from zxcrunet.shared.config import Settings

router = APIRouter(prefix="/api/admin/users", tags=["admin"], route_class=DishkaRoute)


class AdminUserOut(BaseModel):
    id: UUID
    email: str
    email_verified: bool
    role: Literal["user", "owner"]
    status: Literal["active", "blocked"]
    plan: str
    created_at: datetime

    @classmethod
    def of(cls, user: User) -> "AdminUserOut":
        return cls(
            id=user.id,
            email=str(user.email),
            email_verified=user.email_verified,
            role=user.role.value,
            status=user.status.value,
            plan=user.plan_code,
            created_at=user.created_at,
        )


class AdminUsersOut(BaseModel):
    items: list[AdminUserOut]
    total: int


class BlockUserIn(BaseModel):
    reason: str = Field(default="", max_length=500)


class ChangePlanIn(BaseModel):
    plan: str = Field(min_length=1, max_length=32)


@router.get("")
async def list_users(
    request: Request,
    use_case: FromDishka[ListUsers],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
    q: str | None = Query(default=None, max_length=100),
    status: Literal["active", "blocked"] | None = None,
    role: Literal["user", "owner"] | None = None,
    plan: str | None = Query(default=None, max_length=32),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> AdminUsersOut:
    staff = await current_staff(request, authorize, settings)
    where = UserFilter(
        text=search_text(q),
        status=UserStatus(status) if status else None,
        role=Role(role) if role else None,
        plan_code=plan or None,
    )
    found = await use_case(staff, where, Paging(offset, limit))
    return AdminUsersOut(items=[AdminUserOut.of(u) for u in found.items], total=found.total)


@router.get("/{user_id}")
async def get_user(
    user_id: UUID,
    request: Request,
    use_case: FromDishka[GetUser],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
) -> AdminUserOut:
    staff = await current_staff(request, authorize, settings)
    return AdminUserOut.of(await use_case(staff, user_id))


@router.post("/{user_id}/block")
async def block_user(
    user_id: UUID,
    body: BlockUserIn,
    request: Request,
    use_case: FromDishka[BlockUser],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
) -> AdminUserOut:
    staff = await current_staff(request, authorize, settings)
    return AdminUserOut.of(await use_case(staff, user_id, body.reason))


@router.post("/{user_id}/unblock")
async def unblock_user(
    user_id: UUID,
    request: Request,
    use_case: FromDishka[UnblockUser],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
) -> AdminUserOut:
    staff = await current_staff(request, authorize, settings)
    return AdminUserOut.of(await use_case(staff, user_id))


@router.put("/{user_id}/plan")
async def change_plan(
    user_id: UUID,
    body: ChangePlanIn,
    request: Request,
    use_case: FromDishka[ChangeUserPlan],
    authorize: FromDishka[AuthorizeOwner],
    settings: FromDishka[Settings],
) -> AdminUserOut:
    staff = await current_staff(request, authorize, settings)
    return AdminUserOut.of(await use_case(staff, user_id, body.plan))
