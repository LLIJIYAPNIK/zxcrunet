"""Page views without personal data, and the owner's dashboard.

A view is counted in Redis: a counter per site and day, plus a HyperLogLog of visitor
hashes for distinct visitors. A visitor hash is SHA-256 of a random salt of the day,
the IP address and the User-Agent: the salt lives in Redis for two days only, so the
hashes cannot be traced back once it is gone. Neither the IP nor the hash reaches the
database: the worker copies only the day's numbers to Postgres every few minutes.
"""

import hashlib
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Protocol
from uuid import UUID

from zxcrunet.analytics.domain.repository import ViewStats
from zxcrunet.analytics.domain.views import DailyViews, DayTotal, is_bot, period
from zxcrunet.shared.application.admin import Staff
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.uow import UnitOfWork

#: Longest User-Agent that goes into the hash.
UA_MAX = 512

# --- ports ------------------------------------------------------------------------


class ViewCounter(Protocol):
    """Today's live counters (Redis)."""

    async def salt(self, day: date) -> str:
        """Random salt of the day, created on first use, gone after two days."""

    async def hit(self, day: date, site_id: UUID, visitor: str) -> None: ...

    async def snapshot(self, day: date) -> list[DailyViews]:
        """Current numbers of every site viewed that day."""


class PublishedSites(Protocol):
    async def published_at(self, host: str) -> UUID | None: ...


@dataclass(frozen=True, slots=True)
class BlockCount:
    type: str
    blocks: int
    sites: int


@dataclass(frozen=True, slots=True)
class ServiceTotals:
    """What the other contexts report for the dashboard."""

    users: int
    registrations: dict[date, int]
    sites: dict[str, int]
    domains: dict[str, int]
    open_reports: int
    blocks: list[BlockCount]


class ServiceFigures(Protocol):
    """Port to identity, sites, domains and moderation."""

    async def collect(self, since: datetime) -> ServiceTotals: ...


# --- counting -----------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class PageView:
    host: str
    path: str
    ip: str
    user_agent: str


def visitor_hash(salt: str, ip: str, user_agent: str) -> str:
    raw = f"{salt}\n{ip}\n{user_agent[:UA_MAX]}".encode()
    return hashlib.sha256(raw).hexdigest()[:32]


class RecordView:
    """The beacon of a published page. Bots and unknown hosts are ignored silently."""

    def __init__(self, sites: PublishedSites, counter: ViewCounter, clock: Clock) -> None:
        self.sites = sites
        self.counter = counter
        self.clock = clock

    async def __call__(self, view: PageView) -> bool:
        if is_bot(view.user_agent):
            return False
        site_id = await self.sites.published_at(view.host)
        if site_id is None:
            return False
        day = self.clock.now().date()
        salt = await self.counter.salt(day)
        await self.counter.hit(day, site_id, visitor_hash(salt, view.ip, view.user_agent))
        return True


class FlushViews:
    """Worker, every few minutes: copy yesterday's and today's numbers to the database."""

    def __init__(
        self, counter: ViewCounter, stats: ViewStats, uow: UnitOfWork, clock: Clock
    ) -> None:
        self.counter = counter
        self.stats = stats
        self.uow = uow
        self.clock = clock

    async def __call__(self) -> int:
        today = self.clock.now().date()
        rows: list[DailyViews] = []
        for day in (today - timedelta(days=1), today):
            rows += await self.counter.snapshot(day)
        if rows:
            await self.stats.store(rows)
            await self.uow.commit()
        return len(rows)


# --- the owner's dashboard ----------------------------------------------------------


@dataclass(frozen=True, slots=True)
class DayCount:
    day: date
    count: int


@dataclass(frozen=True, slots=True)
class DashboardData:
    days: int
    users: int
    registrations: list[DayCount]
    sites: dict[str, int]
    domains: dict[str, int]
    open_reports: int
    views: list[DayTotal]
    blocks: list[BlockCount]


def _fill(days: list[date], totals: list[DayTotal]) -> list[DayTotal]:
    by_day = {t.day: t for t in totals}
    return [by_day.get(d, DayTotal(d, 0, 0)) for d in days]


class Dashboard:
    def __init__(self, figures: ServiceFigures, stats: ViewStats, clock: Clock) -> None:
        self.figures = figures
        self.stats = stats
        self.clock = clock

    async def __call__(self, _: Staff, days: int) -> DashboardData:
        span = period(self.clock.now().date(), days)
        since = datetime.combine(span[0], time.min, tzinfo=self.clock.now().tzinfo)
        totals = await self.figures.collect(since)
        return DashboardData(
            days=len(span),
            users=totals.users,
            registrations=[DayCount(d, totals.registrations.get(d, 0)) for d in span],
            sites=totals.sites,
            domains=totals.domains,
            open_reports=totals.open_reports,
            views=_fill(span, await self.stats.totals(span[0])),
            blocks=totals.blocks,
        )


class SiteViews:
    """Views of one site per day, for its card in the admin panel."""

    def __init__(self, stats: ViewStats, clock: Clock) -> None:
        self.stats = stats
        self.clock = clock

    async def __call__(self, _: Staff, site_id: UUID, days: int) -> list[DayTotal]:
        span = period(self.clock.now().date(), days)
        return _fill(span, await self.stats.for_site(site_id, span[0]))
