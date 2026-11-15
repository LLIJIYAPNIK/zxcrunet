"""Page views of published sites: counted without personal data, aggregated per day."""

import re
from dataclasses import dataclass
from datetime import date, timedelta
from uuid import UUID

#: Crawlers, link previews and uptime checkers are not visitors.
BOT_RE = re.compile(
    r"bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|monitor|curl|wget|python-|headless",
    re.IGNORECASE,
)
#: Longest period the dashboard shows.
MAX_DAYS = 90


def is_bot(user_agent: str) -> bool:
    return not user_agent.strip() or bool(BOT_RE.search(user_agent))


@dataclass(frozen=True, slots=True)
class DailyViews:
    site_id: UUID
    day: date
    views: int
    #: Distinct visitors that day (a HyperLogLog estimate, ~1% error).
    visitors: int


@dataclass(frozen=True, slots=True)
class DayTotal:
    day: date
    views: int
    visitors: int


def period(today: date, days: int) -> list[date]:
    """The last `days` days up to today, oldest first."""
    days = min(max(days, 1), MAX_DAYS)
    return [today - timedelta(days=offset) for offset in range(days - 1, -1, -1)]
