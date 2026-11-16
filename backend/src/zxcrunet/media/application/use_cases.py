from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from zxcrunet.media.domain.media import (
    ACCEPTED,
    EXTENSIONS,
    FileTooLargeError,
    MediaFile,
    MediaKind,
    MediaNotFoundError,
    MediaRepository,
    Purpose,
    UnsupportedFileError,
    sniff_mime,
)
from zxcrunet.plans.application.service import PlanService
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.uow import UnitOfWork

MB = 1024 * 1024


class FileStorage(Protocol):
    """Where bytes live. Local disk now, S3 later — the domain does not care."""

    async def save(self, key: str, data: bytes, content_type: str) -> None: ...

    def public_url(self, key: str) -> str: ...


@dataclass(frozen=True, slots=True)
class ProcessedImage:
    data: bytes
    width: int
    height: int


class ImageProcessor(Protocol):
    def to_webp(self, data: bytes, max_side: int) -> ProcessedImage:
        """Decode, drop metadata (EXIF), downscale to `max_side`, encode WebP.

        Raises UnsupportedFileError when the bytes are not a decodable image.
        """


class VideoCleaner(Protocol):
    def strip_metadata(self, data: bytes, mime: str) -> bytes:
        """Blank out tags (location, device, author) without re-encoding the video.

        The result has the same length and plays the same.
        """


@dataclass(frozen=True, slots=True)
class Upload:
    owner_id: UUID
    plan_code: str
    purpose: Purpose
    data: bytes


class UploadMedia:
    MAX_SIDE = 2000

    def __init__(
        self,
        media: MediaRepository,
        storage: FileStorage,
        images: ImageProcessor,
        videos: VideoCleaner,
        plans: PlanService,
        uow: UnitOfWork,
        clock: Clock,
    ) -> None:
        self._media = media
        self._storage = storage
        self._images = images
        self._videos = videos
        self._plans = plans
        self._uow = uow
        self._clock = clock

    async def max_bytes(self, plan_code: str, purpose: Purpose = Purpose.IMAGE) -> int:
        plan = await self._plans.get(plan_code)
        return (plan.max_video_mb if purpose == Purpose.VIDEO else plan.max_upload_mb) * MB

    async def __call__(self, cmd: Upload) -> MediaFile:
        limit = await self.max_bytes(cmd.plan_code, cmd.purpose)
        if len(cmd.data) > limit:
            raise FileTooLargeError("File is too large", {"max_mb": limit // MB})
        mime = sniff_mime(cmd.data)
        if mime is None or mime not in ACCEPTED[cmd.purpose]:
            raise UnsupportedFileError(
                "Unsupported file type", {"accepted": sorted(ACCEPTED[cmd.purpose])}
            )

        now = self._clock.now()
        if mime.startswith("image/"):
            image = self._images.to_webp(cmd.data, self.MAX_SIDE)
            media = MediaFile(
                owner_id=cmd.owner_id,
                kind=MediaKind.IMAGE,
                mime="image/webp",
                size=len(image.data),
                key="",
                created_at=now,
                width=image.width,
                height=image.height,
            )
            payload = image.data
        else:
            video = mime.startswith("video/")
            payload = self._videos.strip_metadata(cmd.data, mime) if video else cmd.data
            media = MediaFile(
                owner_id=cmd.owner_id,
                kind=MediaKind.VIDEO if video else MediaKind.DOCUMENT,
                mime=mime,
                size=len(payload),
                key="",
                created_at=now,
            )

        media.key = f"{now:%Y/%m}/{media.id}.{EXTENSIONS[media.mime]}"
        await self._storage.save(media.key, payload, media.mime)
        await self._media.add(media)
        await self._uow.commit()
        return media

    def url(self, media: MediaFile) -> str:
        return self._storage.public_url(media.key)


class MediaService:
    """Entry point for other contexts (sites checks that blocks use the owner's files)."""

    def __init__(self, media: MediaRepository) -> None:
        self._media = media

    async def ensure_owned(self, owner_id: UUID, ids: set[UUID]) -> None:
        if not ids:
            return
        missing = ids - await self._media.owned_ids(owner_id, ids)
        if missing:
            raise MediaNotFoundError("File not found", {"ids": sorted(str(i) for i in missing)})
