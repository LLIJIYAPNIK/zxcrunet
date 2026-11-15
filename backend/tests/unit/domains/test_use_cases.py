from datetime import timedelta
from uuid import UUID, uuid4

import pytest

from tests.fakes import Fakes
from zxcrunet.domains.application.use_cases import (
    MANUAL_CHECKS,
    AddDomain,
    AllowCertificate,
    CheckDomain,
    CheckDomainNow,
    DomainsConfig,
    DueDomains,
    ListSiteDomains,
    Owner,
    RemoveDomain,
    SiteAtHost,
)
from zxcrunet.domains.domain.domain import DomainStatus, Hostname, ServerAddresses
from zxcrunet.domains.domain.errors import (
    DomainAlreadyAddedError,
    DomainNotFoundError,
    DomainTakenError,
    HostNotAllowedError,
    InvalidHostError,
)
from zxcrunet.domains.infrastructure.adapters import SitesDirectory, SitesHostCache
from zxcrunet.plans.application.service import PlanService
from zxcrunet.plans.domain.plan import PlanLimitExceededError
from zxcrunet.shared.domain.errors import RateLimitedError
from zxcrunet.sites.application.use_cases import FindOwnedSite
from zxcrunet.sites.domain.errors import SiteNotFoundError
from zxcrunet.sites.domain.site import Site, SiteKind, Slug

IP = "203.0.113.10"
CONFIG = DomainsConfig(
    server=ServerAddresses(ipv4=frozenset({IP})), forbidden=("zxc.ru.net", "localhost")
)


@pytest.fixture
def f() -> Fakes:
    return Fakes()


class UseCases:
    def __init__(self, f: Fakes) -> None:
        sites = SitesDirectory(FindOwnedSite(f.sites))
        cache = SitesHostCache(f.site_cache)
        plans = PlanService(f.plans)
        base = (f.domains, sites, f.uow, f.clock, cache, CONFIG)
        self.list = ListSiteDomains(*base, plans)
        self.add = AddDomain(*base, plans, f.checks)
        self.remove = RemoveDomain(*base)
        self.check_now = CheckDomainNow(*base, f.dns, f.tls, f.limiter)
        self.check = CheckDomain(*base, f.dns, f.tls)
        self.due = DueDomains(f.domains, f.clock)
        self.ask = AllowCertificate(f.domains, CONFIG)
        self.site_at = SiteAtHost(f.domains, CONFIG)


@pytest.fixture
def uc(f: Fakes) -> UseCases:
    return UseCases(f)


async def site_of(f: Fakes, owner: Owner, slug: str = "anna") -> UUID:
    site = Site.create(owner.user_id, SiteKind.BUSINESS, Slug(slug), "Анна", f.clock.now())
    await f.sites.add(site)
    return site.id


def someone() -> Owner:
    return Owner(user_id=uuid4(), plan_code="free")


class TestAdd:
    async def test_adds_pending_domain_and_queues_a_check(self, f: Fakes, uc: UseCases) -> None:
        owner = someone()
        site_id = await site_of(f, owner)

        domain = await uc.add(owner, site_id, "https://Example.com/")

        assert domain.host == Hostname("example.com")
        assert domain.status == DomainStatus.PENDING
        assert domain.verification_token.startswith("zxc-")
        assert len(domain.verification_token) == 36
        assert f.checks.queued == [domain.id]
        listed = await uc.list(owner, site_id)
        assert [d.id for d in listed.domains] == [domain.id]
        assert (listed.used, listed.max_domains) == (1, 3)

    async def test_plan_limit_counts_every_site_of_the_owner(self, f: Fakes, uc: UseCases) -> None:
        owner = someone()
        first, second = await site_of(f, owner), await site_of(f, owner, "anna-two")
        await uc.add(owner, first, "a.example.com")
        await uc.add(owner, first, "b.example.com")
        await uc.add(owner, second, "c.example.com")

        with pytest.raises(PlanLimitExceededError):
            await uc.add(owner, second, "d.example.com")

    async def test_same_host_twice_is_rejected(self, f: Fakes, uc: UseCases) -> None:
        owner = someone()
        site_id = await site_of(f, owner)
        await uc.add(owner, site_id, "example.com")

        with pytest.raises(DomainAlreadyAddedError):
            await uc.add(owner, site_id, "EXAMPLE.com")

    async def test_host_proven_by_another_site_is_taken(self, f: Fakes, uc: UseCases) -> None:
        anna, boris = someone(), someone()
        mine = await uc.add(anna, await site_of(f, anna), "example.com")
        f.dns.point("example.com", mine.verification_token, IP)
        await uc.check_now(anna, mine.id)
        boris_site = await site_of(f, boris, "boris")

        with pytest.raises(DomainTakenError):
            await uc.add(boris, boris_site, "example.com")

    @pytest.mark.parametrize(
        ("host", "error"),
        [("not a domain", InvalidHostError), ("anna.zxc.ru.net", HostNotAllowedError)],
    )
    async def test_bad_hosts(
        self, f: Fakes, uc: UseCases, host: str, error: type[Exception]
    ) -> None:
        owner = someone()

        with pytest.raises(error):
            await uc.add(owner, await site_of(f, owner), host)

    async def test_only_to_own_sites(self, f: Fakes, uc: UseCases) -> None:
        site_id = await site_of(f, someone())

        with pytest.raises(SiteNotFoundError):
            await uc.add(someone(), site_id, "example.com")
        with pytest.raises(SiteNotFoundError):
            await uc.list(someone(), site_id)


class TestChecks:
    async def test_full_cycle(self, f: Fakes, uc: UseCases) -> None:
        owner = someone()
        site_id = await site_of(f, owner)
        domain = await uc.add(owner, site_id, "example.com")

        checked = await uc.check_now(owner, domain.id)
        assert checked.status == DomainStatus.PENDING
        assert [p.code for p in checked.problems] == ["txt_missing", "a_missing"]
        assert await uc.site_at("example.com") is None
        assert not await uc.ask("example.com")

        f.dns.point("example.com", domain.verification_token, IP)
        checked = await uc.check_now(owner, domain.id)
        assert checked.status == DomainStatus.VERIFIED
        assert "example.com" in f.site_cache.invalidated
        assert await uc.site_at("example.com") == site_id
        assert await uc.ask("example.com")

        # The certificate is not there yet: look again in a while.
        assert await uc.check(domain.id) == DomainStatus.VERIFIED
        f.tls.issued.add("example.com")
        assert await uc.check(domain.id) == DomainStatus.ACTIVE

        stored = await f.domains.get(domain.id)
        assert stored is not None
        assert stored.next_check_at == f.clock.now() + timedelta(days=1)

    async def test_background_checks_follow_the_schedule(self, f: Fakes, uc: UseCases) -> None:
        owner = someone()
        domain = await uc.add(owner, await site_of(f, owner), "example.com")
        assert await uc.due() == [domain.id]

        await uc.check(domain.id)
        assert await uc.due() == []
        f.clock.advance(minutes=1)
        assert await uc.due() == [domain.id]

        for _ in range(60):
            f.clock.advance(hours=1)
            await uc.check(domain.id)

        stored = await f.domains.get(domain.id)
        assert stored is not None
        assert stored.status == DomainStatus.FAILED
        assert await uc.check(domain.id) is None  # failed domains wait for the owner

    async def test_dns_outage_is_reported(self, f: Fakes, uc: UseCases) -> None:
        owner = someone()
        domain = await uc.add(owner, await site_of(f, owner), "example.com")
        f.dns.fail = True

        checked = await uc.check_now(owner, domain.id)

        assert [p.code for p in checked.problems] == ["dns_unavailable"]

    async def test_lost_and_back(self, f: Fakes, uc: UseCases) -> None:
        owner = someone()
        domain = await uc.add(owner, await site_of(f, owner), "example.com")
        f.dns.point("example.com", domain.verification_token, IP)
        f.tls.issued.add("example.com")
        await uc.check(domain.id)
        await uc.check(domain.id)

        f.dns.records.clear()
        for _ in range(3):
            f.clock.advance(days=1)
            await uc.check(domain.id)
        f.site_cache.invalidated.clear()
        assert await uc.check(domain.id) == DomainStatus.LOST
        assert await uc.site_at("example.com") is None

        f.dns.point("example.com", domain.verification_token, IP)
        checked = await uc.check_now(owner, domain.id)

        assert checked.status == DomainStatus.VERIFIED
        assert f.site_cache.invalidated == ["example.com"]

    async def test_the_first_proof_wins(self, f: Fakes, uc: UseCases) -> None:
        anna, boris = someone(), someone()
        mine = await uc.add(anna, await site_of(f, anna), "example.com")
        theirs = await uc.add(boris, await site_of(f, boris, "boris"), "example.com")
        f.dns.point("example.com", mine.verification_token, IP)
        await uc.check_now(anna, mine.id)

        # Even with both tokens published, the host is already serving Anna's site.
        f.dns.point("example.com", theirs.verification_token, IP)
        checked = await uc.check_now(boris, theirs.id)

        assert checked.status == DomainStatus.PENDING
        assert [p.code for p in checked.problems] == ["domain_taken"]

    async def test_manual_checks_are_rate_limited(self, f: Fakes, uc: UseCases) -> None:
        owner = someone()
        domain = await uc.add(owner, await site_of(f, owner), "example.com")
        for _ in range(MANUAL_CHECKS):
            await uc.check_now(owner, domain.id)

        with pytest.raises(RateLimitedError):
            await uc.check_now(owner, domain.id)

    async def test_somebody_elses_domain_looks_missing(self, f: Fakes, uc: UseCases) -> None:
        owner = someone()
        domain = await uc.add(owner, await site_of(f, owner), "example.com")

        with pytest.raises(DomainNotFoundError):
            await uc.check_now(someone(), domain.id)
        with pytest.raises(DomainNotFoundError):
            await uc.remove(someone(), domain.id)

    async def test_unknown_or_service_hosts(self, uc: UseCases) -> None:
        assert await uc.check(uuid4()) is None
        assert not await uc.ask("anna.zxc.ru.net")
        assert not await uc.ask("not a host")
        assert await uc.site_at("localhost") is None


class TestRemove:
    async def test_removing_a_serving_domain_drops_the_cache(self, f: Fakes, uc: UseCases) -> None:
        owner = someone()
        domain = await uc.add(owner, await site_of(f, owner), "example.com")
        f.dns.point("example.com", domain.verification_token, IP)
        await uc.check_now(owner, domain.id)
        f.site_cache.invalidated.clear()

        await uc.remove(owner, domain.id)

        assert await f.domains.get(domain.id) is None
        assert f.site_cache.invalidated == ["example.com"]
        assert not await uc.ask("example.com")
