from datetime import date
from typing import Protocol
from uuid import UUID

from zxcrunet.analytics.domain.views import DailyViews, DayTotal


class ViewStats(Protocol):
    """Daily aggregates in the database."""

    async def store(self, rows: list[DailyViews]) -> None:
        """Insert or update; counts never go down (a lost Redis key cannot erase a day)."""

    async def totals(self, since: date) -> list[DayTotal]:
        """All sites together, per day (days without views are left out)."""

    async def for_site(self, site_id: UUID, since: date) -> list[DayTotal]: ...
