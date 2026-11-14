from collections.abc import AsyncIterator

import pytest
from dishka import AsyncContainer, Provider, Scope, make_async_container
from dishka.integrations.fastapi import FastapiProvider
from httpx import ASGITransport, AsyncClient

from tests.fakes import AllowAllRateLimiter, CapturingMailer, FakeDns, FakeTls, RecordingCheckQueue
from zxcrunet.catalog.di import CatalogProvider
from zxcrunet.domains.application.use_cases import CheckQueue, DnsResolver, TlsProbe
from zxcrunet.domains.di import DomainsProvider
from zxcrunet.identity.application.ports import Mailer
from zxcrunet.identity.di import IdentityProvider
from zxcrunet.main import create_app
from zxcrunet.media.di import MediaProvider
from zxcrunet.plans.di import PlansProvider
from zxcrunet.shared.application.rate_limit import RateLimiter
from zxcrunet.shared.config import Settings
from zxcrunet.shared.di import InfrastructureProvider
from zxcrunet.sites.di import SitesProvider

ORIGIN = {"Origin": "http://localhost:3000"}


@pytest.fixture
def mailer() -> CapturingMailer:
    return CapturingMailer()


@pytest.fixture
def dns() -> FakeDns:
    return FakeDns()


@pytest.fixture
def tls() -> FakeTls:
    return FakeTls()


@pytest.fixture
def checks() -> RecordingCheckQueue:
    return RecordingCheckQueue()


SETTINGS = Settings(
    sites_domain="localhost",
    allowed_origins=[ORIGIN["Origin"]],
    domains_server_ipv4=["203.0.113.10"],
)


@pytest.fixture
async def container(
    mailer: CapturingMailer, dns: FakeDns, tls: FakeTls, checks: RecordingCheckQueue
) -> AsyncIterator[AsyncContainer]:
    """Real Postgres and Redis; email, rate limits, DNS, TLS and the task queue are replaced."""
    overrides = Provider(scope=Scope.APP)
    overrides.provide(lambda: mailer, provides=Mailer)
    overrides.provide(AllowAllRateLimiter, provides=RateLimiter)
    overrides.provide(lambda: dns, provides=DnsResolver)
    overrides.provide(lambda: tls, provides=TlsProbe)
    overrides.provide(lambda: checks, provides=CheckQueue)
    app_container = make_async_container(
        InfrastructureProvider(),
        FastapiProvider(),
        PlansProvider(),
        IdentityProvider(),
        MediaProvider(),
        SitesProvider(),
        DomainsProvider(),
        CatalogProvider(),
        overrides,
        context={Settings: SETTINGS},
    )
    yield app_container
    await app_container.close()


@pytest.fixture
async def client(container: AsyncContainer) -> AsyncIterator[AsyncClient]:
    app = create_app(container, SETTINGS)
    # A private peer address: /internal answers only inside the Docker network.
    transport = ASGITransport(app=app, client=("10.0.0.5", 40000))
    async with AsyncClient(transport=transport, base_url="http://test", headers=ORIGIN) as c:
        yield c
