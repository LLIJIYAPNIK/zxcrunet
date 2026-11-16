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
from zxcrunet.media.infrastructure.video import (
    TagStrippingVideoCleaner,
    blank_mp4_metadata,
    blank_webm_metadata,
)
from zxcrunet.plans.application.service import PlanService

PDF = b"%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def box(kind: bytes, payload: bytes) -> bytes:
    return (8 + len(payload)).to_bytes(4, "big") + kind + payload


#: A tiny MP4: tags with a location in moov/udta and in a track's meta box.
MP4 = (
    box(b"ftyp", b"isom\0\0\0\0isomavc1")
    + box(
        b"moov",
        box(b"mvhd", bytes(20))
        + box(b"udta", box(b"\xa9xyz", b"+55.7558+037.6173/"))
        + box(b"trak", box(b"tkhd", bytes(8)) + box(b"meta", b"SecretCam")),
    )
    + box(b"mdat", b"frames")
)


def ebml(ident: bytes, payload: bytes) -> bytes:
    return ident + (0x01 << 56 | len(payload)).to_bytes(8, "big") + payload


#: A tiny WebM whose segment has an unknown size, as browsers record them.
WEBM = (
    ebml(b"\x1a\x45\xdf\xa3", b"\x42\x82\x84webm")
    + b"\x18\x53\x80\x67\x01\xff\xff\xff\xff\xff\xff\xff"
    + ebml(b"\x15\x49\xa9\x66", b"info")
    + ebml(b"\x12\x54\xc3\x67", b"SecretCam +55.7558+037.6173")
    + ebml(b"\x1f\x43\xb6\x75", b"frames")
)


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
        (MP4, "video/mp4"),
        (WEBM, "video/webm"),
        (box(b"ftyp", b"qt  \0\0\0\0qt  "), None),
        (box(b"ftyp", b"heic\0\0\0\0mif1heic"), None),
        (ebml(b"\x1a\x45\xdf\xa3", b"\x42\x82\x88matroska"), None),
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


def test_mp4_tags_are_blanked_in_place() -> None:
    clean = blank_mp4_metadata(MP4)

    assert len(clean) == len(MP4)
    assert b"55.7558" not in clean
    assert b"SecretCam" not in clean
    assert b"udta" not in clean
    assert clean.count(b"free") == 2
    assert clean.endswith(box(b"mdat", b"frames"))


def test_webm_tags_become_void() -> None:
    clean = blank_webm_metadata(WEBM)

    assert len(clean) == len(WEBM)
    assert b"SecretCam" not in clean
    assert b"\x12\x54\xc3\x67" not in clean
    assert clean.endswith(ebml(b"\x1f\x43\xb6\x75", b"frames"))
    assert b"info" in clean


@pytest.mark.parametrize("data", [b"", b"\0\0\0\x01moov", MP4[:30], WEBM[:20]])
def test_broken_videos_are_left_alone(data: bytes) -> None:
    cleaner = TagStrippingVideoCleaner()
    assert len(cleaner.strip_metadata(data, "video/mp4")) == len(data)
    assert len(cleaner.strip_metadata(data, "video/webm")) == len(data)


def uploader(f: Fakes) -> UploadMedia:
    return UploadMedia(
        f.media,
        f.storage,
        f.images,
        TagStrippingVideoCleaner(),
        PlanService(f.plans),
        f.uow,
        f.clock,
    )


async def test_video_is_stored_as_is_without_tags() -> None:
    f = Fakes()

    media = await uploader(f)(Upload(uuid4(), "free", Purpose.VIDEO, MP4))

    assert (media.kind, media.mime) == (MediaKind.VIDEO, "video/mp4")
    assert media.key.endswith(f"/{media.id}.mp4")
    assert b"SecretCam" not in f.storage.files[media.key]
    with pytest.raises(UnsupportedFileError):
        await uploader(f)(Upload(uuid4(), "free", Purpose.VIDEO, png(4, 4)))
    with pytest.raises(UnsupportedFileError):
        await uploader(f)(Upload(uuid4(), "free", Purpose.IMAGE, MP4))


async def test_videos_have_their_own_plan_limit() -> None:
    padding = bytes(12 * 1024**2)  # over the 10 MB image limit, under 15 MB for video
    big = MP4 + box(b"free", padding)
    f = Fakes()

    assert (await uploader(f)(Upload(uuid4(), "free", Purpose.VIDEO, big))).size == len(big)
    with pytest.raises(FileTooLargeError):
        await uploader(f)(Upload(uuid4(), "free", Purpose.VIDEO, big + padding))


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
