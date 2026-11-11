import io
from pathlib import Path
from uuid import uuid4

import pytest
from PIL import Image

from tests.fakes import Fakes
from zxcrunet.media.application.use_cases import MediaService, Upload, UploadMedia
from zxcrunet.media.domain.media import (
    FileTooLargeError,
    MediaKind,
    MediaNotFoundError,
    Purpose,
    UnsupportedFileError,
    sniff_mime,
)
from zxcrunet.media.infrastructure.adapters import LocalFileStorage, PillowImageProcessor
from zxcrunet.plans.application.service import PlanService

PDF = b"%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def png(width: int = 3000, height: int = 1500, *, with_exif: bool = False) -> bytes:
    image = Image.new("RGB", (width, height), (90, 185, 252))
    out = io.BytesIO()
    exif = Image.Exif()
    if with_exif:
        exif[0x010F] = "SecretCam"  # Make
        exif[0x0110] = "Model X"  # Model
    image.save(out, format="PNG", exif=exif if with_exif else b"")
    return out.getvalue()


@pytest.mark.parametrize(
    ("data", "mime"),
    [
        (b"\xff\xd8\xff\xe0rest", "image/jpeg"),
        (png(4, 4), "image/png"),
        (b"RIFF\x00\x00\x00\x00WEBPVP8 ", "image/webp"),
        (b"GIF89a....", "image/gif"),
        (PDF, "application/pdf"),
        (b"<svg xmlns='http://www.w3.org/2000/svg'/>", None),
        (b"<html><script>", None),
        (b"", None),
    ],
)
def test_type_is_sniffed_from_bytes(data: bytes, mime: str | None) -> None:
    assert sniff_mime(data) == mime


def test_pillow_reencodes_downscales_and_drops_exif() -> None:
    result = PillowImageProcessor().to_webp(png(with_exif=True), max_side=2000)

    with Image.open(io.BytesIO(result.data)) as image:
        assert image.format == "WEBP"
        assert (image.width, image.height) == (2000, 1000) == (result.width, result.height)
        assert not image.getexif()


def test_pillow_rejects_garbage_that_looks_like_png() -> None:
    with pytest.raises(UnsupportedFileError):
        PillowImageProcessor().to_webp(b"\x89PNG\r\n\x1a\nnot really", max_side=100)


async def test_local_storage_writes_under_root(tmp_path: Path) -> None:
    storage = LocalFileStorage(tmp_path, "/media")

    await storage.save("2026/11/a.webp", b"data", "image/webp")

    assert (tmp_path / "2026" / "11" / "a.webp").read_bytes() == b"data"
    assert storage.public_url("2026/11/a.webp") == "/media/2026/11/a.webp"
    with pytest.raises(ValueError, match="escapes"):
        await storage.save("../outside.txt", b"x", "text/plain")


def uploader(f: Fakes) -> UploadMedia:
    return UploadMedia(f.media, f.storage, f.images, PlanService(f.plans), f.uow, f.clock)


async def test_image_upload_is_stored_as_webp() -> None:
    f = Fakes()
    owner = uuid4()

    media = await uploader(f)(Upload(owner, "free", Purpose.IMAGE, png(10, 10)))

    assert media.kind == MediaKind.IMAGE
    assert media.mime == "image/webp"
    assert media.key.endswith(f"/{media.id}.webp")
    assert media.key in f.storage.files
    await MediaService(f.media).ensure_owned(owner, {media.id})


async def test_resume_accepts_pdf_only() -> None:
    f = Fakes()

    doc = await uploader(f)(Upload(uuid4(), "free", Purpose.RESUME, PDF))
    assert (doc.kind, doc.mime) == (MediaKind.DOCUMENT, "application/pdf")

    with pytest.raises(UnsupportedFileError):
        await uploader(f)(Upload(uuid4(), "free", Purpose.RESUME, png(4, 4)))
    with pytest.raises(UnsupportedFileError):
        await uploader(f)(Upload(uuid4(), "free", Purpose.IMAGE, PDF))


async def test_plan_upload_limit() -> None:
    with pytest.raises(FileTooLargeError):
        await uploader(Fakes())(Upload(uuid4(), "free", Purpose.RESUME, PDF + b"0" * 11 * 1024**2))


async def test_foreign_media_is_not_found() -> None:
    f = Fakes()
    media = await uploader(f)(Upload(uuid4(), "free", Purpose.IMAGE, png(4, 4)))

    with pytest.raises(MediaNotFoundError):
        await MediaService(f.media).ensure_owned(uuid4(), {media.id})
