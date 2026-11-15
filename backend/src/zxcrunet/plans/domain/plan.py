import re
from dataclasses import dataclass
from typing import Literal

from zxcrunet.shared.domain.errors import ForbiddenError, InvalidInputError

FREE_PLAN_CODE = "free"
PLAN_CODE_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$")
TITLE_MAX = 64
#: Sanity bounds for limits set in the admin panel.
MAX_COUNT_LIMIT = 1000
MAX_UPLOAD_MB = 100

LimitName = Literal["max_sites", "max_custom_domains"]


class PlanLimitExceededError(ForbiddenError):
    code = "plan_limit_exceeded"


class InvalidPlanError(InvalidInputError):
    code = "invalid_plan"


@dataclass(frozen=True, slots=True)
class Plan:
    code: str
    title: str
    max_sites: int
    max_custom_domains: int
    max_upload_mb: int

    @classmethod
    def create(
        cls, code: str, title: str, max_sites: int, max_custom_domains: int, max_upload_mb: int
    ) -> "Plan":
        """A validated plan: the admin panel creates and edits plans through this."""
        clean_code = code.strip().lower()
        if not PLAN_CODE_RE.fullmatch(clean_code):
            raise InvalidPlanError("Plan code must be [a-z0-9-], 1-32 chars", {"field": "code"})
        clean_title = " ".join(title.split())[:TITLE_MAX]
        if not clean_title:
            raise InvalidPlanError("Plan title is required", {"field": "title"})
        for name, value, low, high in (
            ("max_sites", max_sites, 0, MAX_COUNT_LIMIT),
            ("max_custom_domains", max_custom_domains, 0, MAX_COUNT_LIMIT),
            ("max_upload_mb", max_upload_mb, 1, MAX_UPLOAD_MB),
        ):
            if not low <= value <= high:
                raise InvalidPlanError(
                    "Limit is out of range", {"field": name, "min": low, "max": high}
                )
        return cls(clean_code, clean_title, max_sites, max_custom_domains, max_upload_mb)

    def ensure_can_add(self, limit: LimitName, current: int) -> None:
        """Raise when adding one more item would exceed the plan's limit."""
        allowed: int = getattr(self, limit)
        if current + 1 > allowed:
            raise PlanLimitExceededError(
                "Plan limit reached",
                {"limit": limit, "allowed": allowed, "current": current, "plan": self.code},
            )
