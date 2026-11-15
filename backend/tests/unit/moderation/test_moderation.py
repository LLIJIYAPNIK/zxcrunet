from uuid import UUID, uuid4

import pytest

from tests.fakes import Fakes
from zxcrunet.moderation.application.use_cases import (
    REPORTS_PER_HOUR,
    DecideReport,
    ListAuditLog,
    ListReports,
    NewReport,
    OpenReports,
    SubmitReport,
)
from zxcrunet.moderation.domain.report import (
    Decision,
    Report,
    ReportClosedError,
    ReportMessageRequiredError,
    ReportNotFoundError,
    ReportReason,
    ReportStatus,
)
from zxcrunet.moderation.domain.repository import AuditFilter, ReportFilter
from zxcrunet.shared.application.admin import Paging, Staff
from zxcrunet.shared.domain.errors import NotFoundError, RateLimitedError

STAFF = Staff(user_id=uuid4())
SITE = uuid4()


class FakeSites:
    def __init__(self) -> None:
        self.published = {"anna.zxc.ru.net": SITE}

    async def published_at(self, host: str) -> UUID | None:
        return self.published.get(host)


class FakeSuspender:
    def __init__(self) -> None:
        self.suspended: list[tuple[UUID, str]] = []

    async def suspend(self, staff: Staff, site_id: UUID, reason: str) -> None:
        self.suspended.append((site_id, reason))


@pytest.fixture
def f() -> Fakes:
    return Fakes()


def submit(f: Fakes) -> SubmitReport:
    return SubmitReport(f.reports, FakeSites(), f.uow, f.clock, f.limiter)


def report(
    host: str = "anna.zxc.ru.net", reason: ReportReason = ReportReason.SPAM, message: str = ""
) -> NewReport:
    return NewReport(host=host, path="games", reason=reason, message=message, ip="203.0.113.7")


class TestReportDomain:
    def test_other_needs_a_message(self) -> None:
        with pytest.raises(ReportMessageRequiredError):
            Report.submit(SITE, "h", "/", ReportReason.OTHER, "   ", Fakes().clock.now())

    def test_message_keeps_lines_and_is_cut(self) -> None:
        text = "  первая   строка \n\n вторая " + "х" * 2000
        made = Report.submit(SITE, "h", "/", ReportReason.FRAUD, text, Fakes().clock.now())

        assert made.message.startswith("первая строка\n\nвторая х")
        assert len(made.message) == 1000

    def test_decided_once(self) -> None:
        now = Fakes().clock.now()
        made = Report.submit(SITE, "h", "/", ReportReason.SPAM, "", now)
        made.decide(Decision.DISMISS, STAFF.user_id, "", now)

        with pytest.raises(ReportClosedError):
            made.decide(Decision.SUSPEND, STAFF.user_id, "", now)


class TestSubmit:
    async def test_saves_an_open_report_for_the_site(self, f: Fakes) -> None:
        made = await submit(f)(report(host="Anna.ZXC.ru.net:443"))

        assert made.site_id == SITE
        assert made.host == "anna.zxc.ru.net"
        assert made.path == "/games"
        assert made.status == ReportStatus.OPEN
        assert f.uow.commits == 1

    async def test_unknown_or_unpublished_host(self, f: Fakes) -> None:
        with pytest.raises(NotFoundError):
            await submit(f)(report(host="nobody.zxc.ru.net"))

    async def test_rate_limited_by_address(self, f: Fakes) -> None:
        for _ in range(REPORTS_PER_HOUR):
            await submit(f)(report())

        with pytest.raises(RateLimitedError):
            await submit(f)(report())


class TestDecide:
    async def setup_reports(self, f: Fakes) -> list[Report]:
        made = []
        for minutes in range(3):
            f.clock.advance(minutes=minutes)
            made.append(await submit(f)(report()))
        other = Report.submit(
            uuid4(), "boris.zxc.ru.net", "/", ReportReason.SPAM, "", f.clock.now()
        )
        await f.reports.add(other)
        return made

    async def test_suspend_resolves_every_open_report_of_the_site(self, f: Fakes) -> None:
        made = await self.setup_reports(f)
        suspender = FakeSuspender()
        decide = DecideReport(f.reports, suspender, f.uow, f.clock, f.audit)

        decided = await decide(STAFF, made[0].id, Decision.SUSPEND, "фишинг")

        assert suspender.suspended == [(SITE, "фишинг")]
        assert {r.id for r in decided} == {r.id for r in made}
        assert all(r.status == ReportStatus.RESOLVED for r in decided)
        assert f.audit.actions == ["report.resolved"] * 3
        counts = await f.reports.count_by_status()
        assert counts == {ReportStatus.RESOLVED: 3, ReportStatus.OPEN: 1}

    async def test_dismiss_touches_one_report(self, f: Fakes) -> None:
        made = await self.setup_reports(f)
        suspender = FakeSuspender()
        decide = DecideReport(f.reports, suspender, f.uow, f.clock, f.audit)

        decided = await decide(STAFF, made[1].id, Decision.DISMISS, "")

        assert [r.status for r in decided] == [ReportStatus.DISMISSED]
        assert suspender.suspended == []
        assert await OpenReports(f.reports)() == 3

    async def test_unknown_report(self, f: Fakes) -> None:
        decide = DecideReport(f.reports, FakeSuspender(), f.uow, f.clock, f.audit)
        with pytest.raises(ReportNotFoundError):
            await decide(STAFF, uuid4(), Decision.DISMISS, "")


class TestQueue:
    async def test_open_queue_is_oldest_first_with_counts(self, f: Fakes) -> None:
        first = await submit(f)(report())
        f.clock.advance(minutes=5)
        second = await submit(f)(report())
        await DecideReport(f.reports, FakeSuspender(), f.uow, f.clock, f.audit)(
            STAFF, second.id, Decision.DISMISS, ""
        )

        queue = await ListReports(f.reports)(STAFF, ReportFilter(ReportStatus.OPEN), Paging())

        assert [r.id for r in queue.reports.items] == [first.id]
        assert queue.counts == {ReportStatus.OPEN: 1, ReportStatus.DISMISSED: 1}


class TestAuditLog:
    async def test_newest_first_and_filters(self, f: Fakes) -> None:
        made = await submit(f)(report())
        decide = DecideReport(f.reports, FakeSuspender(), f.uow, f.clock, f.audit)
        await decide(STAFF, made.id, Decision.DISMISS, "")

        everything = await ListAuditLog(f.audit)(STAFF, AuditFilter(), Paging())
        reports = await ListAuditLog(f.audit)(
            STAFF, AuditFilter(target_type="report", target_id=str(made.id)), Paging()
        )
        nobody = await ListAuditLog(f.audit)(STAFF, AuditFilter(actor_id=uuid4()), Paging())

        assert everything.total == 1
        assert reports.items[0].action == "report.dismissed"
        assert nobody.total == 0
