from dishka import Provider, Scope, provide, provide_all
from sqlalchemy.ext.asyncio import AsyncSession
from taskiq import AsyncBroker

from zxcrunet.domains.application.use_cases import (
    AddDomain,
    AllowCertificate,
    CheckDomain,
    CheckDomainNow,
    CheckQueue,
    DnsResolver,
    DomainsConfig,
    DueDomains,
    HostCache,
    ListSiteDomains,
    RemoveDomain,
    SiteAtHost,
    SiteDirectory,
    TlsProbe,
)
from zxcrunet.domains.domain.domain import ServerAddresses
from zxcrunet.domains.domain.repository import DomainRepository
from zxcrunet.domains.infrastructure.adapters import QueuedChecks, SitesDirectory, SitesHostCache
from zxcrunet.domains.infrastructure.network import DnsPythonResolver, HandshakeTlsProbe
from zxcrunet.domains.infrastructure.repository import SqlDomainRepository
from zxcrunet.shared.config import Settings
from zxcrunet.sites.application.use_cases import FindOwnedSite, SiteCache


class DomainsProvider(Provider):
    @provide(scope=Scope.APP)
    def config(self, settings: Settings) -> DomainsConfig:
        forbidden = dict.fromkeys((settings.service_domain, settings.sites_domain, "localhost"))
        return DomainsConfig(
            server=ServerAddresses(
                ipv4=frozenset(settings.domains_server_ipv4),
                ipv6=frozenset(settings.domains_server_ipv6),
            ),
            forbidden=tuple(forbidden),
        )

    @provide(scope=Scope.APP)
    def resolver(self, settings: Settings) -> DnsResolver:
        return DnsPythonResolver(settings.dns_nameservers, settings.dns_timeout_seconds)

    @provide(scope=Scope.APP)
    def tls(self, settings: Settings) -> TlsProbe:
        return HandshakeTlsProbe(
            settings.tls_probe_timeout_seconds, verify=settings.tls_probe_verify
        )

    @provide(scope=Scope.APP)
    def queue(self, _: AsyncBroker) -> CheckQueue:
        # Asking for the broker makes sure it is started.
        from zxcrunet.worker import check_domain  # noqa: PLC0415 — the broker reads settings on import

        return QueuedChecks(check_domain)

    @provide(scope=Scope.APP)
    def host_cache(self, cache: SiteCache) -> HostCache:
        return SitesHostCache(cache)

    @provide(scope=Scope.REQUEST)
    def domains(self, session: AsyncSession) -> DomainRepository:
        return SqlDomainRepository(session)

    @provide(scope=Scope.REQUEST)
    def sites(self, find: FindOwnedSite) -> SiteDirectory:
        return SitesDirectory(find)

    use_cases = provide_all(
        ListSiteDomains,
        AddDomain,
        RemoveDomain,
        CheckDomainNow,
        CheckDomain,
        DueDomains,
        AllowCertificate,
        SiteAtHost,
        scope=Scope.REQUEST,
    )
