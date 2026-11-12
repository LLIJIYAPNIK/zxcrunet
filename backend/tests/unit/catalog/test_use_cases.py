from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import pytest

from tests.fakes import Fakes
from zxcrunet.catalog.application.use_cases import (
    CreatePost,
    CreateTitle,
    DeleteTitle,
    EntryInput,
    GetPublicCatalog,
    ListCatalog,
    UpdatePost,
    UpdateTitle,
    _Base,
)
from zxcrunet.catalog.domain.catalog import (
    PostData,
    PostKind,
    ShelfStatus,
    Title,
    TitleData,
    TitleKind,
)
from zxcrunet.catalog.domain.errors import (
    InvalidPostError,
    InvalidSeriesError,
    InvalidShelfEntryError,
    TitleNotFoundError,
    TitleSlugTakenError,
)
from zxcrunet.media.application.use_cases import MediaService
from zxcrunet.media.domain.media import MediaFile, MediaKind, MediaNotFoundError

OWNER = uuid4()


@pytest.fixture
def fakes() -> Fakes:
    return Fakes()


def build[UC: _Base](cls: type[UC], f: Fakes) -> UC:
    return cls(
        titles=f.titles,
        posts=f.posts,
        media=MediaService(f.media),
        uow=f.uow,
        clock=f.clock,
        cache=f.catalog_cache,
    )


def data(name: str = "Dark Souls III", **extra: Any) -> TitleData:
    return TitleData(kind=extra.pop("kind", TitleKind.GAME), name=name, **extra)


async def add(
    f: Fakes, name: str = "Dark Souls III", entry: EntryInput | None = None, **kw: Any
) -> Title:
    owner: UUID = kw.pop("owner", OWNER)
    return await build(CreateTitle, f)(owner, data(name, **kw), entry)


class TestTitles:
    async def test_create_with_entry_and_details(self, fakes: Fakes) -> None:
        entry = EntryInput(
            status=ShelfStatus.DONE,
            rating=9,
            hours=78,
            details={
                "criteria": [{"name": "Сюжет", "score": 9}],
                "bosses": [{"name": "Безымянный король", "defeated": True}],
            },
        )

        title = await add(fakes, entry=entry, year=2016)

        assert title.slug == "dark-souls-iii"
        assert title.entry is not None
        assert title.entry.details["bosses"][0] == {
            "name": "Безымянный король",
            "note": "",
            "defeated": True,
        }
        assert fakes.uow.commits == 1
        assert fakes.catalog_cache.invalidated == [OWNER]

    async def test_auto_slug_gets_a_suffix_but_explicit_one_conflicts(self, fakes: Fakes) -> None:
        await add(fakes, "Дюна", kind=TitleKind.FILM)
        second = await add(fakes, "Дюна", kind=TitleKind.FILM, year=2021)
        book = await add(fakes, "Дюна", kind=TitleKind.BOOK)

        assert second.slug == "dyuna-2"
        assert book.slug == "dyuna"  # slugs are unique per kind
        with pytest.raises(TitleSlugTakenError):
            await add(fakes, "Другая", kind=TitleKind.FILM, slug="dyuna")

    async def test_invalid_details(self, fakes: Fakes) -> None:
        entry = EntryInput(status=ShelfStatus.DONE, details={"criteria": [{"name": "x"}]})

        with pytest.raises(InvalidShelfEntryError) as caught:
            await add(fakes, entry=entry)

        assert caught.value.details["errors"][0]["loc"] == ["criteria", "0", "score"]

    async def test_related_titles_must_be_mine(self, fakes: Fakes) -> None:
        stranger = await add(fakes, "Чужое", owner=uuid4())
        entry = EntryInput(
            status=ShelfStatus.DONE, details={"related": [{"title_id": str(stranger.id)}]}
        )

        with pytest.raises(InvalidShelfEntryError):
            await add(fakes, entry=entry)

    async def test_cover_must_be_my_upload(self, fakes: Fakes) -> None:
        mine, theirs = uuid4(), uuid4()
        for media_id, owner in ((mine, OWNER), (theirs, uuid4())):
            await fakes.media.add(
                MediaFile(
                    id=media_id,
                    owner_id=owner,
                    kind=MediaKind.IMAGE,
                    mime="image/webp",
                    size=10,
                    width=1,
                    height=1,
                    key=f"{media_id}.webp",
                    created_at=datetime(2026, 11, 12, tzinfo=UTC),
                )
            )

        await add(fakes, cover={"id": str(mine), "url": "/media/a.webp"})
        with pytest.raises(MediaNotFoundError):
            await add(fakes, "B", cover={"id": str(theirs), "url": "/media/b.webp"})

    async def test_series_and_parts(self, fakes: Fakes) -> None:
        series = await add(fakes, "Dark Souls", is_series=True)
        part = await add(fakes, series_id=series.id, part_label="III")
        assert part.series_id == series.id

        with pytest.raises(InvalidSeriesError, match="Remove the parts"):
            await build(UpdateTitle, fakes)(OWNER, series.id, data("Dark Souls"), None)

        await build(DeleteTitle, fakes)(OWNER, series.id)
        view = await build(ListCatalog, fakes)(OWNER)
        assert [(t.name, t.series_id) for t in view.titles] == [("Dark Souls III", None)]

    async def test_part_of_a_missing_series(self, fakes: Fakes) -> None:
        with pytest.raises(InvalidSeriesError):
            await add(fakes, series_id=uuid4())

    async def test_update_and_remove_from_shelf(self, fakes: Fakes) -> None:
        title = await add(fakes, entry=EntryInput(status=ShelfStatus.ACTIVE))

        updated = await build(UpdateTitle, fakes)(OWNER, title.id, data("DS III", slug=""), None)

        assert updated.name == "DS III"
        assert updated.entry is None
        assert updated.slug == "ds-iii"

    async def test_foreign_title_is_not_found(self, fakes: Fakes) -> None:
        title = await add(fakes)

        with pytest.raises(TitleNotFoundError):
            await build(DeleteTitle, fakes)(uuid4(), title.id)


class TestPosts:
    async def test_post_links_only_my_titles(self, fakes: Fakes) -> None:
        mine = await add(fakes)
        theirs = await add(fakes, "Чужое", owner=uuid4())
        create = build(CreatePost, fakes)

        post = await create(OWNER, PostData(PostKind.REVIEW, "Закрывает круг", title_id=mine.id))
        with pytest.raises(InvalidPostError):
            await create(OWNER, PostData(PostKind.REVIEW, "Нет", title_id=theirs.id))

        edited = await build(UpdatePost, fakes)(OWNER, post.id, PostData(PostKind.NOTE, "Заметка"))
        assert (edited.kind, edited.title_id) == (PostKind.NOTE, None)


class FakeSites:
    def __init__(self, owners: dict[str, UUID]) -> None:
        self.owners = owners

    async def owner_at(self, host: str) -> UUID | None:
        return self.owners.get(host)


async def test_public_catalog_is_cached_per_owner(fakes: Fakes) -> None:
    await add(fakes, entry=EntryInput(status=ShelfStatus.DONE, rating=9))
    await build(CreatePost, fakes)(OWNER, PostData(PostKind.NOTE, "Привет"))
    public = GetPublicCatalog(
        fakes.titles, fakes.posts, FakeSites({"sasha.zxc.ru.net": OWNER}), fakes.catalog_cache
    )

    payload = await public("sasha.zxc.ru.net")

    assert payload is not None
    assert payload["titles"][0]["entry"]["rating"] == 9
    assert "owner_id" not in payload["titles"][0]
    assert payload["posts"][0]["heading"] == "Привет"
    assert fakes.catalog_cache.data[OWNER] == payload
    assert await public("nobody.zxc.ru.net") is None
