from uuid import uuid4

import pytest

from tests.fakes import Fakes
from zxcrunet.domains.application.admin import (
    ConfirmDomain,
    DomainTotals,
    ListDomains,
    RevokeDomain,
)
from zxcrunet.domains.application.use_cases import CheckDomain, DomainsConfig, SiteHosts
from zxcrunet.domains.domain.domain import CustomDomain, DomainStatus, Hostname, ServerAddresses
from zxcrunet.domains.domain.errors import DomainRevokedError, DomainTakenError
from zxcrunet.domains.domain.repository import DomainFilter
from zxcrunet.domains.infrastructure.adapters import SitesDirectory, SitesHostCache
from zxcrunet.shared.application.admin import Paging, Staff
from zxcrunet.sites.application.use_cases import FindOwnedSite

STAFF = Staff(user_id=uuid4())
CONFIG = DomainsConfig(server=ServerAddresses(ipv4=frozenset({"203.0.113.10"})), forbidden=())


@pytest.fixture
def f() -> Fakes:
    return Fakes()


def admin[UC: ConfirmDomain | RevokeDomain | ListDomains](cls: type[UC], f: Fakes) -> UC:
    return cls(f.domains, f.uow, f.audit, f.clock, SitesHostCache(f.site_cache))


async def domain(f: Fakes, host: str = "anna.example.com") -> CustomDomain:
    created = CustomDomain.create(uuid4(), uuid4(), Hostname(host), "zxc-token", f.clock.now())
    await f.domains.add(created)
    return created


class TestConfirm:
    async def test_pending_becomes_verified_and_is_logged(self, f: Fakes) -> None:
        pending = await domain(f)

        confirmed = await admin(ConfirmDomain, f)(STAFF, pending.id)

        assert confirmed.status == DomainStatus.VERIFIED
        assert confirmed.next_check_at == f.clock.now()
        assert f.audit.actions == ["domain.confirm"]
        assert f.audit.records[0].details["previous"] == "pending"
        assert f.site_cache.invalidated == ["anna.example.com"]

    async def test_host_served_by_another_site_cannot_be_confirmed(self, f: Fakes) -> None:
        first = await domain(f)
        await admin(ConfirmDomain, f)(STAFF, first.id)
        rival = await domain(f)

        with pytest.raises(DomainTakenError):
            await admin(ConfirmDomain, f)(STAFF, rival.id)

    async def test_confirm_undoes_a_revoke(self, f: Fakes) -> None:
        revoked = await domain(f)
        await admin(RevokeDomain, f)(STAFF, revoked.id, "фишинг")

        confirmed = await admin(ConfirmDomain, f)(STAFF, revoked.id)

        assert confirmed.status == DomainStatus.VERIFIED
        assert not confirmed.is_revoked


class TestRevoke:
    async def test_serving_domain_stops_serving_for_good(self, f: Fakes) -> None:
        active = await domain(f)
        await admin(ConfirmDomain, f)(STAFF, active.id)

        revoked = await admin(RevokeDomain, f)(STAFF, active.id, " фишинг ")

        assert revoked.status == DomainStatus.FAILED
        assert revoked.next_check_at is None
        assert [p.code for p in revoked.problems] == ["revoked"]
        assert await f.domains.serving(Hostname("anna.example.com")) is None
        assert f.audit.records[-1].details["reason"] == "фишинг"
        assert f.site_cache.invalidated == ["anna.example.com", "anna.example.com"]

    async def test_owner_of_the_domain_cannot_restart_checks(self, f: Fakes) -> None:
        pending = await domain(f)
        await admin(RevokeDomain, f)(STAFF, pending.id, "спам")
        stored = await f.domains.get(pending.id)
        assert stored is not None

        with pytest.raises(DomainRevokedError):
            stored.restart(f.clock.now())

    async def test_background_check_leaves_it_alone(self, f: Fakes) -> None:
        pending = await domain(f)
        await admin(RevokeDomain, f)(STAFF, pending.id, "спам")
        f.dns.point("anna.example.com", "zxc-token")
        check = CheckDomain(
            f.domains,
            SitesDirectory(FindOwnedSite(f.sites)),
            f.uow,
            f.clock,
            SitesHostCache(f.site_cache),
            CONFIG,
            f.dns,
            f.tls,
        )

        assert await check(pending.id) is None
        assert f.dns.lookups == []

    async def test_revoking_twice_logs_once(self, f: Fakes) -> None:
        pending = await domain(f)
        revoke = admin(RevokeDomain, f)
        await revoke(STAFF, pending.id, "спам")
        await revoke(STAFF, pending.id, "спам")

        assert f.audit.actions == ["domain.revoke"]


class TestQueries:
    async def test_list_totals_and_site_hosts(self, f: Fakes) -> None:
        anna = await domain(f, "anna.example.com")
        await domain(f, "boris.example.com")
        await admin(ConfirmDomain, f)(STAFF, anna.id)

        found = await admin(ListDomains, f)(STAFF, DomainFilter(text="anna"), Paging())
        totals = await DomainTotals(f.domains)()
        hosts = await SiteHosts(f.domains)(anna.site_id)

        assert [d.id for d in found.items] == [anna.id]
        assert totals == {DomainStatus.VERIFIED: 1, DomainStatus.PENDING: 1}
        assert hosts == ["anna.example.com"]
