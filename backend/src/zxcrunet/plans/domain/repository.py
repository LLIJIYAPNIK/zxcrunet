from typing import Protocol

from zxcrunet.plans.domain.plan import Plan


class PlanRepository(Protocol):
    async def get(self, code: str) -> Plan | None: ...
