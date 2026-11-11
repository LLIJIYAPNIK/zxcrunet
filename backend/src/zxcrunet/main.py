from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dishka import AsyncContainer, make_async_container
from dishka.integrations.fastapi import setup_dishka
from fastapi import FastAPI

from zxcrunet import __version__
from zxcrunet.shared.config import Settings
from zxcrunet.shared.di import InfrastructureProvider
from zxcrunet.shared.errors import register_error_handlers
from zxcrunet.system.api.router import router as system_router
from zxcrunet.system.di import SystemProvider


def make_container(settings: Settings) -> AsyncContainer:
    return make_async_container(
        InfrastructureProvider(),
        SystemProvider(),
        context={Settings: settings},
    )


def create_app(container: AsyncContainer | None = None) -> FastAPI:
    """Application factory: `uvicorn --factory zxcrunet.main:create_app`."""
    container = container or make_container(Settings())

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
    register_error_handlers(app)
    app.include_router(system_router)
    setup_dishka(container, app)
    return app
