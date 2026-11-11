from dataclasses import dataclass
from typing import Literal

from zxcrunet.shared.domain.errors import ForbiddenError

FREE_PLAN_CODE = "free"

LimitName = Literal["max_sites", "max_custom_domains"]


class PlanLimitExceededError(ForbiddenError):
    code = "plan_limit_exceeded"


@dataclass(frozen=True, slots=True)
class Plan:
    code: str
    title: str
    max_sites: int
    max_custom_domains: int
    max_upload_mb: int

    def ensure_can_add(self, limit: LimitName, current: int) -> None:
        """Raise when adding one more item would exceed the plan's limit."""
        allowed: int = getattr(self, limit)
        if current + 1 > allowed:
            raise PlanLimitExceededError(
                "Plan limit reached",
                {"limit": limit, "allowed": allowed, "current": current, "plan": self.code},
            )
