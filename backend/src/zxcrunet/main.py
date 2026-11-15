from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from dishka import AsyncContainer, Provider, make_async_container
from dishka.integrations.fastapi import FastapiProvider, setup_dishka
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from zxcrunet import __version__
from zxcrunet.analytics.api.router import public_router as analytics_public_router
from zxcrunet.analytics.api.router import router as analytics_router
from zxcrunet.analytics.di import AnalyticsProvider
from zxcrunet.catalog.api.router import public_router as catalog_public_router
from zxcrunet.catalog.api.router import router as catalog_router
from zxcrunet.catalog.di import CatalogProvider
from zxcrunet.domains.api.admin import router as domains_admin_router
from zxcrunet.domains.api.router import internal_router as domains_internal_router
from zxcrunet.domains.api.router import router as domains_router
from zxcrunet.domains.di import DomainsProvider
from zxcrunet.identity.api.admin import router as users_admin_router
from zxcrunet.identity.api.router import router as auth_router
from zxcrunet.identity.di import IdentityProvider
from zxcrunet.media.api.router import router as media_router
from zxcrunet.media.di import MediaProvider
from zxcrunet.moderation.api.router import public_router as moderation_public_router
from zxcrunet.moderation.api.router import router as moderation_router
from zxcrunet.moderation.di import ModerationProvider
from zxcrunet.plans.api.admin import router as plans_admin_router
from zxcrunet.plans.di import PlansProvider
from zxcrunet.shared.api.errors import register_error_handlers
from zxcrunet.shared.api.origin import OriginCheckMiddleware
from zxcrunet.shared.config import Settings
from zxcrunet.shared.di import InfrastructureProvider
from zxcrunet.sites.api.admin import router as sites_admin_router
from zxcrunet.sites.api.router import public_router as sites_public_router
from zxcrunet.sites.api.router import router as sites_router
from zxcrunet.sites.di import SitesProvider
from zxcrunet.system.api.router import router as system_router
from zxcrunet.system.di import SystemProvider

#: Anonymous writes from users' sites: reports and page views (see OriginCheckMiddleware).
PUBLIC_WRITES = "/api/public/events/"


def app_providers() -> list[Provider]:
    """Every provider of the application, in order; tests append their overrides."""
    return [
        InfrastructureProvider(),
        FastapiProvider(),
        SystemProvider(),
        PlansProvider(),
        IdentityProvider(),
        MediaProvider(),
        SitesProvider(),
        CatalogProvider(),
        DomainsProvider(),
        ModerationProvider(),
        AnalyticsProvider(),
    ]


def make_container(settings: Settings) -> AsyncContainer:
    return make_async_container(*app_providers(), context={Settings: settings})


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
    app.add_middleware(
        OriginCheckMiddleware,
        allowed_origins=settings.allowed_origins,
        exempt=(PUBLIC_WRITES,),
    )
    register_error_handlers(app)
    app.include_router(system_router)
    app.include_router(auth_router)
    app.include_router(sites_router)
    app.include_router(sites_public_router)
    app.include_router(media_router)
    app.include_router(catalog_router)
    app.include_router(catalog_public_router)
    app.include_router(domains_router)
    app.include_router(domains_internal_router)
    app.include_router(moderation_public_router)
    app.include_router(analytics_public_router)
    # The admin panel (owner only).
    app.include_router(analytics_router)
    app.include_router(users_admin_router)
    app.include_router(plans_admin_router)
    app.include_router(sites_admin_router)
    app.include_router(domains_admin_router)
    app.include_router(moderation_router)
    # Uploaded files. In production Caddy serves this folder directly.
    media_root = Path(settings.media_root)
    media_root.mkdir(parents=True, exist_ok=True)
    app.mount(settings.media_url_prefix, StaticFiles(directory=media_root), name="media")
    setup_dishka(container, app)
    return app
