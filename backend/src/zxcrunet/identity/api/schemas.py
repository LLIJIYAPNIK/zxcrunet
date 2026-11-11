from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from zxcrunet.identity.domain.user import User
from zxcrunet.plans.domain.plan import Plan


class CredentialsIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class EmailIn(BaseModel):
    email: str = Field(max_length=254)


class TokenIn(BaseModel):
    token: str = Field(min_length=1, max_length=128)


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=1, max_length=128)
    password: str = Field(max_length=128)


class UserOut(BaseModel):
    id: UUID
    email: str
    email_verified: bool
    role: Literal["user", "owner"]
    created_at: datetime

    @classmethod
    def of(cls, user: User) -> "UserOut":
        return cls(
            id=user.id,
            email=str(user.email),
            email_verified=user.email_verified,
            role=user.role.value,
            created_at=user.created_at,
        )


class LimitsOut(BaseModel):
    plan: str
    plan_title: str
    max_sites: int
    max_custom_domains: int
    max_upload_mb: int

    @classmethod
    def of(cls, plan: Plan) -> "LimitsOut":
        return cls(
            plan=plan.code,
            plan_title=plan.title,
            max_sites=plan.max_sites,
            max_custom_domains=plan.max_custom_domains,
            max_upload_mb=plan.max_upload_mb,
        )


class MeOut(BaseModel):
    user: UserOut
    limits: LimitsOut
