"""Custom domain use cases: the cabinet, the background checker, Caddy and host resolution."""

import secrets
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from zxcrunet.domains.domain.domain import (
    CustomDomain,
    DnsRecords,
    DomainStatus,
    Hostname,
    ServerAddresses,
    evaluate,
)
from zxcrunet.domains.domain.errors import (
    DomainAlreadyAddedError,
    DomainNotFoundError,
    DomainTakenError,
)
from zxcrunet.domains.domain.repository import DomainRepository
from zxcrunet.plans.application.service import PlanService
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.rate_limit import RateLimiter, enforce
from zxcrunet.shared.application.uow import UnitOfWork
from zxcrunet.shared.domain.errors import AppError

#: «Проверить сейчас»: this many manual checks per user per window.
MANUAL_CHECKS = 10
MANUAL_WINDOW_SECONDS = 600


@dataclass(frozen=True, slots=True)
class Owner:
    """The signed-in user, as the domains context needs to know them."""

    user_id: UUID
    plan_code: str


# --- ports ------------------------------------------------------------------------


class SiteDirectory(Protocol):
    """Port to the sites context."""

    async def ensure_owned(self, user_id: UUID, site_id: UUID) -> None:
        """Raise the sites context's «not found» unless the user owns the site."""


class HostCache(Protocol):
    """Port to the sites context's cache of host → site."""

    async def invalidate(self, host: str) -> None: ...


class DnsResolver(Protocol):
    async def lookup(self, host: Hostname) -> DnsRecords:
        """TXT of `_zxc-verify.<host>`, A and AAAA of the host (CNAMEs followed)."""


class TlsProbe(Protocol):
    async def has_certificate(self, host: Hostname) -> bool:
        """Does the host answer over HTTPS with a valid certificate?

        The first request also makes Caddy obtain the certificate (on-demand TLS).
        """


class CheckQueue(Protocol):
    async def enqueue(self, domain_id: UUID) -> None:
        """Check this domain in the background as soon as possible."""


@dataclass(frozen=True, slots=True)
class DomainsConfig:
    server: ServerAddresses
    #: The service's own zones: they never become custom domains.
    forbidden: tuple[str, ...]

    def parse(self, raw: str) -> Hostname:
        return Hostname.parse(raw, forbidden=self.forbidden)


# --- cabinet -----------------------------------------------------------------------


class _Cabinet:
    def __init__(
        self,
        domains: DomainRepository,
        sites: SiteDirectory,
        uow: UnitOfWork,
        clock: Clock,
        cache: HostCache,
        config: DomainsConfig,
    ) -> None:
        self.domains = domains
        self.sites = sites
        self.uow = uow
        self.clock = clock
        self.cache = cache
        self.config = config

    async def _own(self, owner: Owner, domain_id: UUID) -> CustomDomain:
        domain = await self.domains.get(domain_id)
        if domain is None:
            raise DomainNotFoundError("Domain not found")
        domain.ensure_owned_by(owner.user_id)
        return domain


@dataclass(frozen=True, slots=True)
class SiteDomains:
    domains: list[CustomDomain]
    used: int
    max_domains: int
    server: ServerAddresses


class ListSiteDomains(_Cabinet):
    def __init__(
        self,
        domains: DomainRepository,
        sites: SiteDirectory,
        uow: UnitOfWork,
        clock: Clock,
        cache: HostCache,
        config: DomainsConfig,
        plans: PlanService,
    ) -> None:
        super().__init__(domains, sites, uow, clock, cache, config)
        self.plans = plans

    async def __call__(self, owner: Owner, site_id: UUID) -> SiteDomains:
        await self.sites.ensure_owned(owner.user_id, site_id)
        plan = await self.plans.get(owner.plan_code)
        return SiteDomains(
            domains=await self.domains.list_by_site(site_id),
            used=await self.domains.count_by_owner(owner.user_id),
            max_domains=plan.max_custom_domains,
            server=self.config.server,
        )


class AddDomain(_Cabinet):
    def __init__(
        self,
        domains: DomainRepository,
        sites: SiteDirectory,
        uow: UnitOfWork,
        clock: Clock,
        cache: HostCache,
        config: DomainsConfig,
        plans: PlanService,
        queue: CheckQueue,
    ) -> None:
        super().__init__(domains, sites, uow, clock, cache, config)
        self.plans = plans
        self.queue = queue

    async def __call__(self, owner: Owner, site_id: UUID, raw_host: str) -> CustomDomain:
        await self.sites.ensure_owned(owner.user_id, site_id)
        plan = await self.plans.get(owner.plan_code)
        plan.ensure_can_add("max_custom_domains", await self.domains.count_by_owner(owner.user_id))
        host = self.config.parse(raw_host)
        if await self.domains.added_by_owner(owner.user_id, host):
            raise DomainAlreadyAddedError("You have already added this domain", {"host": str(host)})
        # Pending claims of the same host by others are allowed: the DNS proof decides.
        if await self.domains.claimed(host):
            raise DomainTakenError("This domain is attached to another site", {"host": str(host)})
        token = f"zxc-{secrets.token_hex(16)}"
        domain = CustomDomain.create(site_id, owner.user_id, host, token, self.clock.now())
        await self.domains.add(domain)
        await self.uow.commit()
        await self.queue.enqueue(domain.id)
        return domain


class RemoveDomain(_Cabinet):
    async def __call__(self, owner: Owner, domain_id: UUID) -> None:
        domain = await self._own(owner, domain_id)
        await self.domains.delete(domain)
        await self.uow.commit()
        if domain.is_serving:
            await self.cache.invalidate(str(domain.host))


# --- checks ------------------------------------------------------------------------


class _Checker(_Cabinet):
    def __init__(
        self,
        domains: DomainRepository,
        sites: SiteDirectory,
        uow: UnitOfWork,
        clock: Clock,
        cache: HostCache,
        config: DomainsConfig,
        resolver: DnsResolver,
        tls: TlsProbe,
    ) -> None:
        super().__init__(domains, sites, uow, clock, cache, config)
        self.resolver = resolver
        self.tls = tls

    async def _check(self, domain: CustomDomain) -> CustomDomain:
        """One DNS check (and a certificate probe for a verified domain), one transaction."""
        was_serving = domain.is_serving
        records = await self.resolver.lookup(domain.host)
        result = evaluate(records, domain.verification_token, self.config.server)
        host_free = not await self.domains.claimed(domain.host, except_id=domain.id)
        # The probe goes after the verifying commit: Caddy asks us before issuing.
        probe = domain.awaits_certificate
        domain.record_check(result, self.clock.now(), host_free=host_free)
        if probe and domain.awaits_certificate:
            if await self.tls.has_certificate(domain.host):
                domain.certificate_issued(self.clock.now())
            else:
                domain.certificate_pending(self.clock.now())
        await self.domains.save(domain)
        await self.uow.commit()
        if domain.is_serving != was_serving:
            await self.cache.invalidate(str(domain.host))
        return domain


class CheckDomainNow(_Checker):
    """«Проверить сейчас» in the cabinet: rate limited, the answer comes right away."""

    def __init__(
        self,
        domains: DomainRepository,
        sites: SiteDirectory,
        uow: UnitOfWork,
        clock: Clock,
        cache: HostCache,
        config: DomainsConfig,
        resolver: DnsResolver,
        tls: TlsProbe,
        limiter: RateLimiter,
    ) -> None:
        super().__init__(domains, sites, uow, clock, cache, config, resolver, tls)
        self.limiter = limiter

    async def __call__(self, owner: Owner, domain_id: UUID) -> CustomDomain:
        domain = await self._own(owner, domain_id)
        await enforce(
            self.limiter,
            f"domains:check:user:{owner.user_id}",
            limit=MANUAL_CHECKS,
            window_seconds=MANUAL_WINDOW_SECONDS,
        )
        domain.restart(self.clock.now())
        return await self._check(domain)


class CheckDomain(_Checker):
    """Background check of one domain (the worker), whatever its schedule says."""

    async def __call__(self, domain_id: UUID) -> DomainStatus | None:
        domain = await self.domains.get(domain_id)
        if domain is None or domain.status == DomainStatus.FAILED:
            return None
        if domain.status == DomainStatus.LOST:
            return domain.status
        return (await self._check(domain)).status


class DueDomains:
    """Ids of domains whose automatic check is due (the scheduler runs this every minute)."""

    BATCH = 200

    def __init__(self, domains: DomainRepository, clock: Clock) -> None:
        self.domains = domains
        self.clock = clock

    async def __call__(self) -> list[UUID]:
        return await self.domains.due(self.clock.now(), self.BATCH)


# --- Caddy and the sites context ----------------------------------------------------


class AllowCertificate:
    """Caddy's on-demand TLS `ask`: may a certificate be obtained for this host?"""

    def __init__(self, domains: DomainRepository, config: DomainsConfig) -> None:
        self.domains = domains
        self.config = config

    async def __call__(self, raw_host: str) -> bool:
        try:
            host = self.config.parse(raw_host)
        except AppError:
            return False
        return await self.domains.serving(host) is not None


class SiteAtHost:
    """Which site a custom host serves (verified or active domains only)."""

    def __init__(self, domains: DomainRepository, config: DomainsConfig) -> None:
        self.domains = domains
        self.config = config

    async def __call__(self, raw_host: str) -> UUID | None:
        try:
            host = self.config.parse(raw_host)
        except AppError:
            return None
        domain = await self.domains.serving(host)
        return domain.site_id if domain else None
