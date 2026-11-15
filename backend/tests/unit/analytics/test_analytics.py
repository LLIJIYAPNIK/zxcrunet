from datetime import date, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from tests.fakes import Fakes
from zxcrunet.analytics.application.use_cases import (
    BlockCount,
    Dashboard,
    FlushViews,
    PageView,
    RecordView,
    ServiceTotals,
    SiteViews,
    visitor_hash,
)
from zxcrunet.analytics.domain.views import DailyViews, DayTotal, is_bot, period
from zxcrunet.shared.application.admin import Staff

STAFF = Staff(user_id=uuid4())
SITE = uuid4()
BROWSER = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1.15"


class FakeSites:
    async def published_at(self, host: str) -> UUID | None:
        return SITE if host == "anna.zxc.ru.net" else None


class FakeFigures:
    def __init__(self) -> None:
        self.since: datetime | None = None

    async def collect(self, since: datetime) -> ServiceTotals:
        self.since = since
        return ServiceTotals(
            users=7,
            registrations={since.date(): 2},
            sites={"published": 3, "draft": 1},
            domains={"active": 1},
            open_reports=4,
            blocks=[BlockCount("hero", 3, 3)],
        )


@pytest.fixture
def f() -> Fakes:
    return Fakes()


def view(ip: str = "203.0.113.7", ua: str = BROWSER, host: str = "anna.zxc.ru.net") -> PageView:
    return PageView(host=host, path="/", ip=ip, user_agent=ua)


class TestDomain:
    @pytest.mark.parametrize(
        "ua", ["", "Googlebot/2.1", "TelegramBot (like TwitterBot)", "curl/8.4", "HeadlessChrome"]
    )
    def test_bots(self, ua: str) -> None:
        assert is_bot(ua)

    def test_browser_is_not_a_bot(self) -> None:
        assert not is_bot(BROWSER)

    def test_period_is_oldest_first_and_bounded(self) -> None:
        today = date(2026, 11, 15)

        assert period(today, 3) == [date(2026, 11, 13), date(2026, 11, 14), today]
        assert len(period(today, 1000)) == 90
        assert period(today, 0) == [today]

    def test_visitor_hash_depends_on_the_salt(self) -> None:
        one = visitor_hash("salt-1", "203.0.113.7", BROWSER)

        assert one == visitor_hash("salt-1", "203.0.113.7", BROWSER)
        assert one != visitor_hash("salt-2", "203.0.113.7", BROWSER)
        assert "203.0.113.7" not in one


class TestRecordAndFlush:
    async def test_counts_views_and_distinct_visitors(self, f: Fakes) -> None:
        record = RecordView(FakeSites(), f.view_counter, f.clock)

        assert await record(view())
        assert await record(view())
        assert await record(view(ip="198.51.100.1"))
        assert not await record(view(ua="Googlebot/2.1"))
        assert not await record(view(host="nobody.zxc.ru.net"))

        today = f.clock.now().date()
        assert await f.view_counter.snapshot(today) == [DailyViews(SITE, today, 3, 2)]

    async def test_flush_copies_yesterday_and_today(self, f: Fakes) -> None:
        record = RecordView(FakeSites(), f.view_counter, f.clock)
        await record(view())
        f.clock.advance(days=1)
        await record(view())
        await record(view())
        today = f.clock.now().date()

        stored = await FlushViews(f.view_counter, f.view_stats, f.uow, f.clock)()

        assert stored == 2
        assert await f.view_stats.for_site(SITE, today - timedelta(days=1)) == [
            DayTotal(today - timedelta(days=1), 1, 1),
            DayTotal(today, 2, 1),
        ]
        assert f.uow.commits == 1

    async def test_flush_never_lowers_a_day(self, f: Fakes) -> None:
        today = f.clock.now().date()
        await f.view_stats.store([DailyViews(SITE, today, 10, 5)])
        await RecordView(FakeSites(), f.view_counter, f.clock)(view())

        await FlushViews(f.view_counter, f.view_stats, f.uow, f.clock)()

        assert await f.view_stats.for_site(SITE, today) == [DayTotal(today, 10, 5)]

    async def test_nothing_to_flush(self, f: Fakes) -> None:
        assert await FlushViews(f.view_counter, f.view_stats, f.uow, f.clock)() == 0
        assert f.uow.commits == 0


class TestDashboard:
    async def test_fills_every_day_of_the_period(self, f: Fakes) -> None:
        today = f.clock.now().date()
        await f.view_stats.store([DailyViews(SITE, today, 5, 3), DailyViews(uuid4(), today, 1, 1)])
        figures = FakeFigures()

        data = await Dashboard(figures, f.view_stats, f.clock)(STAFF, 7)

        assert data.days == 7
        assert [v.day for v in data.views] == period(today, 7)
        assert data.views[-1] == DayTotal(today, 6, 4)
        assert data.views[0] == DayTotal(today - timedelta(days=6), 0, 0)
        assert data.registrations[0].count == 2
        assert sum(r.count for r in data.registrations) == 2
        assert figures.since is not None
        assert figures.since.date() == today - timedelta(days=6)
        assert data.open_reports == 4

    async def test_site_views(self, f: Fakes) -> None:
        today = f.clock.now().date()
        await f.view_stats.store([DailyViews(SITE, today, 5, 3)])

        days = await SiteViews(f.view_stats, f.clock)(STAFF, SITE, 2)

        assert days == [DayTotal(today - timedelta(days=1), 0, 0), DayTotal(today, 5, 3)]
