from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dishka import AsyncContainer, make_async_container
from dishka.integrations.fastapi import FastapiProvider, setup_dishka
from fastapi import FastAPI

from zxcrunet import __version__
from zxcrunet.identity.api.router import router as auth_router
from zxcrunet.identity.di import IdentityProvider
from zxcrunet.plans.di import PlansProvider
from zxcrunet.shared.api.errors import register_error_handlers
from zxcrunet.shared.api.origin import OriginCheckMiddleware
from zxcrunet.shared.config import Settings
from zxcrunet.shared.di import InfrastructureProvider
from zxcrunet.sites.api.router import public_router as sites_public_router
from zxcrunet.sites.api.router import router as sites_router
from zxcrunet.sites.di import SitesProvider
from zxcrunet.system.api.router import router as system_router
from zxcrunet.system.di import SystemProvider


def make_container(settings: Settings) -> AsyncContainer:
    return make_async_container(
        InfrastructureProvider(),
        FastapiProvider(),
        SystemProvider(),
        PlansProvider(),
        IdentityProvider(),
        SitesProvider(),
        context={Settings: settings},
    )


def create_app(
    container: AsyncContainer | None = None, settings: Settings | None = None
) -> FastAPI:
    """Application factory: `uvicorn --factory zxcrunet.main:create_app`."""
    settings = settings or Settings()
    container = container or make_container(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await container.close()

    app = FastAPI(
        title="zxcrunet API",
        version=__version__,
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(OriginCheckMiddleware, allowed_origins=settings.allowed_origins)
    register_error_handlers(app)
    app.include_router(system_router)
    app.include_router(auth_router)
    app.include_router(sites_router)
    app.include_router(sites_public_router)
    setup_dishka(container, app)
    return app
