from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from zxcrunet.domains.domain.domain import (
    MAX_FAILURES,
    RECHECK_INTERVAL,
    TLS_PROBE_INTERVAL,
    VERIFY_WINDOW,
    CheckResult,
    CustomDomain,
    DnsRecords,
    DomainStatus,
    Hostname,
    Problem,
    ServerAddresses,
    backoff,
    evaluate,
)
from zxcrunet.domains.domain.errors import HostNotAllowedError, InvalidHostError

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=UTC)
SERVICE = ("zxc.ru.net", "localhost")
SERVER = ServerAddresses(ipv4=frozenset({"203.0.113.10"}), ipv6=frozenset({"2001:db8::10"}))
TOKEN = "zxc-token"
OK = CheckResult(())
BAD = CheckResult((Problem("txt_missing"),))


class TestHostname:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("Example.COM", "example.com"),
            ("  https://anna.example.com/ ", "anna.example.com"),
            ("example.com.", "example.com"),
            ("пример.рф", "xn--e1afmkfd.xn--p1ai"),
            ("xn--e1afmkfd.xn--p1ai", "xn--e1afmkfd.xn--p1ai"),
            ("my-site.co.uk", "my-site.co.uk"),
        ],
    )
    def test_normalises(self, raw: str, expected: str) -> None:
        assert Hostname.parse(raw, forbidden=SERVICE).value == expected

    @pytest.mark.parametrize(
        "raw",
        [
            "",
            "example",
            "exa mple.com",
            "example.com/path",
            "example.com:8080",
            "user@example.com",
            "-example.com",
            "example-.com",
            "a..com",
            "example.123",
            f"{'a' * 64}.com",
            f"{'a.' * 127}com",
        ],
    )
    def test_rejects_malformed(self, raw: str) -> None:
        with pytest.raises(InvalidHostError):
            Hostname.parse(raw, forbidden=SERVICE)

    @pytest.mark.parametrize(
        "raw", ["zxc.ru.net", "anna.zxc.ru.net", "a.b.zxc.ru.net", "anna.localhost", "1.2.3.4"]
    )
    def test_rejects_service_zones_and_ips(self, raw: str) -> None:
        with pytest.raises(HostNotAllowedError):
            Hostname.parse(raw, forbidden=SERVICE)

    def test_names(self) -> None:
        www = Hostname.parse("www.example.com")
        apex = Hostname.parse("example.com")

        assert www.is_www
        assert www.apex == "example.com"
        assert not apex.is_www
        assert apex.apex == "example.com"
        assert not Hostname.parse("www.com").is_www
        assert apex.verify_name == "_zxc-verify.example.com"


class TestEvaluate:
    def test_matching_records_pass(self) -> None:
        records = DnsRecords(txt=("other", TOKEN), a=("203.0.113.10",), aaaa=("2001:db8::10",))

        assert evaluate(records, TOKEN, SERVER).ok

    def test_every_problem_is_listed(self) -> None:
        result = evaluate(DnsRecords(), TOKEN, SERVER)

        assert [p.code for p in result.problems] == ["txt_missing", "a_missing"]

    def test_wrong_values_show_what_was_found(self) -> None:
        records = DnsRecords(
            txt=("old",), a=("203.0.113.10", "198.51.100.7"), aaaa=("2001:db8::99",)
        )

        problems = evaluate(records, TOKEN, SERVER).problems

        assert problems == (
            Problem("txt_mismatch", {"found": ["old"]}),
            Problem("a_wrong", {"found": ["198.51.100.7", "203.0.113.10"]}),
            Problem("aaaa_wrong", {"found": ["2001:db8::99"]}),
        )

    def test_any_aaaa_is_wrong_without_ipv6_on_the_server(self) -> None:
        records = DnsRecords(txt=(TOKEN,), a=("203.0.113.10",), aaaa=("2001:db8::10",))

        result = evaluate(records, TOKEN, ServerAddresses(ipv4=SERVER.ipv4))

        assert [p.code for p in result.problems] == ["aaaa_wrong"]

    def test_dns_failure_is_one_problem(self) -> None:
        result = evaluate(DnsRecords(error="timeout"), TOKEN, SERVER)

        assert result.problems == (Problem("dns_unavailable", {"reason": "timeout"}),)


def status(domain: CustomDomain) -> DomainStatus:
    """Read without mypy narrowing: the status changes between asserts."""
    return domain.status


def new_domain() -> CustomDomain:
    return CustomDomain.create(uuid4(), uuid4(), Hostname.parse("example.com"), TOKEN, NOW)


class TestLifecycle:
    def test_new_domain_is_pending_and_due_now(self) -> None:
        domain = new_domain()

        assert status(domain) == DomainStatus.PENDING
        assert domain.next_check_at == NOW
        assert not domain.is_serving

    def test_failed_checks_back_off(self) -> None:
        domain = new_domain()
        delays = []
        now = NOW
        for _ in range(9):
            domain.record_check(BAD, now)
            assert domain.next_check_at is not None
            delays.append(domain.next_check_at - now)
            now = domain.next_check_at

        assert delays[:3] == [timedelta(minutes=1), timedelta(minutes=2), timedelta(minutes=5)]
        assert delays[-1] == delays[-2] == timedelta(hours=2)
        assert domain.problems == [Problem("txt_missing")]
        assert backoff(0) == backoff(1)

    def test_gives_up_after_48_hours(self) -> None:
        domain = new_domain()
        domain.record_check(BAD, NOW + VERIFY_WINDOW - timedelta(minutes=1))
        assert status(domain) == DomainStatus.PENDING

        domain.record_check(BAD, NOW + VERIFY_WINDOW)

        assert status(domain) == DomainStatus.FAILED
        assert domain.next_check_at is None

    def test_failed_domain_gets_a_new_window_on_restart(self) -> None:
        domain = new_domain()
        domain.record_check(BAD, NOW + VERIFY_WINDOW)
        domain.record_check(BAD, NOW + VERIFY_WINDOW * 2)
        assert status(domain) == DomainStatus.FAILED

        later = NOW + timedelta(days=5)
        domain.restart(later)
        domain.record_check(BAD, later)

        assert status(domain) == DomainStatus.PENDING
        assert domain.checks_started_at == later
        assert domain.attempts == 1

    def test_verified_then_active_then_rechecked_daily(self) -> None:
        domain = new_domain()
        domain.record_check(OK, NOW)

        assert status(domain) == DomainStatus.VERIFIED
        assert domain.is_serving
        assert domain.verified_at == NOW
        assert domain.next_check_at == NOW
        assert domain.problems == []

        domain.certificate_pending(NOW)
        assert domain.next_check_at == NOW + TLS_PROBE_INTERVAL

        domain.certificate_issued(NOW + timedelta(minutes=10))
        assert status(domain) == DomainStatus.ACTIVE
        assert domain.next_check_at == NOW + timedelta(minutes=10) + RECHECK_INTERVAL

        domain.record_check(OK, NOW + timedelta(days=1))
        assert domain.next_check_at == NOW + timedelta(days=2)

    def test_lost_after_three_failed_rechecks_in_a_row(self) -> None:
        domain = new_domain()
        domain.record_check(OK, NOW)
        domain.certificate_issued(NOW)

        domain.record_check(BAD, NOW + timedelta(days=1))
        domain.record_check(OK, NOW + timedelta(days=2))  # resets the streak
        for day in range(3, 3 + MAX_FAILURES - 1):
            domain.record_check(BAD, NOW + timedelta(days=day))
            assert status(domain) == DomainStatus.ACTIVE
        domain.record_check(BAD, NOW + timedelta(days=9))

        assert status(domain) == DomainStatus.LOST
        assert not domain.is_serving
        assert domain.next_check_at is None

    def test_lost_domain_comes_back_when_records_return(self) -> None:
        domain = new_domain()
        domain.record_check(OK, NOW)
        for day in range(1, MAX_FAILURES + 1):
            domain.record_check(BAD, NOW + timedelta(days=day))
        assert status(domain) == DomainStatus.LOST

        domain.record_check(BAD, NOW + timedelta(days=10))
        assert status(domain) == DomainStatus.LOST
        domain.record_check(OK, NOW + timedelta(days=11))

        assert status(domain) == DomainStatus.VERIFIED
        assert domain.failures == 0

    def test_host_taken_by_another_site_is_not_verified(self) -> None:
        domain = new_domain()

        domain.record_check(OK, NOW, host_free=False)

        assert status(domain) == DomainStatus.PENDING
        assert domain.problems == [Problem("domain_taken")]

    def test_certificate_only_for_verified(self) -> None:
        domain = new_domain()

        domain.certificate_issued(NOW)
        domain.certificate_pending(NOW)

        assert status(domain) == DomainStatus.PENDING
        assert domain.next_check_at == NOW
