import asyncio
import io
from datetime import datetime
from pathlib import Path
from uuid import UUID

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import DateTime, ForeignKey, Integer, String, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from zxcrunet.media.application.use_cases import ProcessedImage
from zxcrunet.media.domain.media import MediaFile, UnsupportedFileError
from zxcrunet.shared.infrastructure.db import Base

# Refuse decompression bombs early (default is ~89 Mpx with a warning only).
Image.MAX_IMAGE_PIXELS = 40_000_000


class MediaModel(Base):
    __tablename__ = "media_files"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    mime: Mapped[str] = mapped_column(String(64))
    size: Mapped[int] = mapped_column(Integer)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    key: Mapped[str] = mapped_column(String(200), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SqlMediaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, media: MediaFile) -> None:
        self._session.add(
            MediaModel(
                id=media.id,
                owner_id=media.owner_id,
                kind=media.kind.value,
                mime=media.mime,
                size=media.size,
                width=media.width,
                height=media.height,
                key=media.key,
                created_at=media.created_at,
            )
        )
        await self._session.flush()

    async def owned_ids(self, owner_id: UUID, ids: set[UUID]) -> set[UUID]:
        rows = await self._session.scalars(
            select(MediaModel.id).where(MediaModel.owner_id == owner_id, MediaModel.id.in_(ids))
        )
        return set(rows)


class LocalFileStorage:
    """Files under `root`, served at `url_prefix` (FastAPI in dev, Caddy in prod)."""

    def __init__(self, root: Path, url_prefix: str = "/media") -> None:
        self._root = root
        self._prefix = url_prefix.rstrip("/")

    def _path(self, key: str) -> Path:
        path = (self._root / key).resolve()
        if not path.is_relative_to(self._root.resolve()):
            msg = f"Key escapes the storage root: {key}"
            raise ValueError(msg)
        return path

    async def save(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)

        def write() -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(path.suffix + ".tmp")
            tmp.write_bytes(data)
            tmp.replace(path)

        await asyncio.to_thread(write)

    def public_url(self, key: str) -> str:
        return f"{self._prefix}/{key}"


class PillowImageProcessor:
    def to_webp(self, data: bytes, max_side: int) -> ProcessedImage:
        try:
            with Image.open(io.BytesIO(data)) as source:
                source.load()
                image = ImageOps.exif_transpose(source)  # keep orientation, then drop EXIF
                image.thumbnail((max_side, max_side))
                if image.mode not in {"RGB", "RGBA"}:
                    image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
                out = io.BytesIO()
                image.save(out, format="WEBP", quality=85, method=4)  # no exif= → stripped
                return ProcessedImage(data=out.getvalue(), width=image.width, height=image.height)
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
            raise UnsupportedFileError("The image cannot be read") from exc
