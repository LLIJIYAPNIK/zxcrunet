from datetime import UTC, date, datetime
from uuid import uuid4

import pytest

from zxcrunet.catalog.domain.catalog import (
    Post,
    PostData,
    PostKind,
    ShelfEntry,
    ShelfStatus,
    Title,
    TitleData,
    TitleKind,
    slugify,
)
from zxcrunet.catalog.domain.errors import (
    InvalidPostError,
    InvalidSeriesError,
    InvalidShelfEntryError,
    InvalidTitleError,
    TitleNotFoundError,
)

NOW = datetime(2026, 11, 12, tzinfo=UTC)
OWNER = uuid4()


def game(name: str = "Dark Souls", **extra: object) -> Title:
    return Title.create(OWNER, TitleData(kind=TitleKind.GAME, name=name, **extra), NOW)  # type: ignore[arg-type]


def test_slug_is_transliterated() -> None:
    assert slugify("Ведьмак 3: Дикая Охота") == "vedmak-3-dikaya-okhota"
    assert slugify("Щука и ёж") == "shchuka-i-ezh"
    assert slugify("!!!") == "title"


def test_create_cleans_fields() -> None:
    title = game("  Dark   Souls ", genres=["soulslike", " soulslike", "", "RPG"], year=2011)

    assert title.name == "Dark Souls"
    assert title.slug == "dark-souls"
    assert title.genres == ["soulslike", "RPG"]
    assert title.entry is None


def test_explicit_slug_is_validated() -> None:
    assert game(slug="ds-1").slug == "ds-1"
    with pytest.raises(InvalidTitleError):
        game(slug="Не slug")


@pytest.mark.parametrize(
    "extra",
    [{"name": " "}, {"year": 1500}, {"year": 2016, "year_end": 2011}, {"genres": list("abcdefg")}],
)
def test_invalid_titles(extra: dict[str, object]) -> None:
    with pytest.raises(InvalidTitleError):
        game(**{"name": "X", **extra})  # type: ignore[arg-type]


def test_kind_cannot_change() -> None:
    title = game()
    with pytest.raises(InvalidTitleError):
        title.apply(TitleData(kind=TitleKind.BOOK, name="Dark Souls"), NOW)


def test_series_rules() -> None:
    series = game(is_series=True)
    part = game("Dark Souls III", series_id=series.id, part_label="III")
    part.check_series(series)

    book_series = Title.create(OWNER, TitleData(TitleKind.BOOK, "Ведьмак", is_series=True), NOW)
    with pytest.raises(InvalidSeriesError, match="same kind"):
        part.check_series(book_series)
    with pytest.raises(InvalidSeriesError, match="not a series"):
        part.check_series(game("Elden Ring"))
    with pytest.raises(InvalidSeriesError, match="not found"):
        part.check_series(None)
    with pytest.raises(InvalidSeriesError):
        game(is_series=True, series_id=series.id)


def test_foreign_title_looks_missing() -> None:
    with pytest.raises(TitleNotFoundError):
        game().ensure_owned_by(uuid4())


def test_shelf_entry_invariants() -> None:
    entry = ShelfEntry(status=ShelfStatus.ACTIVE, progress=212, progress_total=499, notes=" hi ")
    assert entry.notes == "hi"
    with pytest.raises(InvalidShelfEntryError):
        ShelfEntry(status=ShelfStatus.DONE, rating=11)
    with pytest.raises(InvalidShelfEntryError):
        ShelfEntry(status=ShelfStatus.ACTIVE, progress=5, progress_total=4)
    with pytest.raises(InvalidShelfEntryError):
        ShelfEntry(
            status=ShelfStatus.DONE, started_on=date(2026, 2, 1), finished_on=date(2026, 1, 1)
        )


def test_post_defaults_to_today_and_needs_heading() -> None:
    post = Post.create(OWNER, PostData(PostKind.NOTE, " Короткий  пост "), NOW)
    assert post.heading == "Короткий пост"
    assert post.published_on == NOW.date()
    with pytest.raises(InvalidPostError):
        post.apply(PostData(PostKind.NOTE, "  "), NOW)
