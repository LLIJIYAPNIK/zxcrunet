from pathlib import Path

from dishka import Provider, Scope, provide, provide_all
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.media.application.use_cases import (
    FileStorage,
    ImageProcessor,
    MediaService,
    UploadMedia,
)
from zxcrunet.media.domain.media import MediaRepository
from zxcrunet.media.infrastructure.adapters import (
    LocalFileStorage,
    PillowImageProcessor,
    SqlMediaRepository,
)
from zxcrunet.shared.config import Settings


class MediaProvider(Provider):
    @provide(scope=Scope.APP)
    def storage(self, settings: Settings) -> FileStorage:
        return LocalFileStorage(Path(settings.media_root), settings.media_url_prefix)

    @provide(scope=Scope.APP)
    def images(self) -> ImageProcessor:
        return PillowImageProcessor()

    @provide(scope=Scope.REQUEST)
    def repository(self, session: AsyncSession) -> MediaRepository:
        return SqlMediaRepository(session)

    use_cases = provide_all(UploadMedia, MediaService, scope=Scope.REQUEST)
