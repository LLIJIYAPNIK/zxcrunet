from collections.abc import AsyncIterator

import pytest
from dishka import Provider, Scope, make_async_container
from dishka.integrations.fastapi import FastapiProvider
from httpx import ASGITransport, AsyncClient

from tests.fakes import AllowAllRateLimiter, CapturingMailer
from zxcrunet.identity.application.ports import Mailer
from zxcrunet.identity.di import IdentityProvider
from zxcrunet.main import create_app
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
async def client(mailer: CapturingMailer) -> AsyncIterator[AsyncClient]:
    """Real Postgres and Redis; only email delivery and rate limiting are replaced."""
    overrides = Provider(scope=Scope.APP)
    overrides.provide(lambda: mailer, provides=Mailer)
    overrides.provide(AllowAllRateLimiter, provides=RateLimiter)
    settings = Settings(sites_domain="localhost", allowed_origins=[ORIGIN["Origin"]])
    container = make_async_container(
        InfrastructureProvider(),
        FastapiProvider(),
        PlansProvider(),
        IdentityProvider(),
        SitesProvider(),
        overrides,
        context={Settings: settings},
    )
    app = create_app(container, settings)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=ORIGIN
    ) as c:
        yield c
    await container.close()
