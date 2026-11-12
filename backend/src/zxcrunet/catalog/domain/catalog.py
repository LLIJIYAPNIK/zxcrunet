"""Catalog: titles (games, books, anime, series, films), their series and the owner's shelf.

A title belongs to the user who entered it (MVP: manual input). `source`/`external_id`
are reserved for importing from external databases later. A title is either a series
(`is_series`) or a single work that may be a part of one series of the same kind.
"""

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from zxcrunet.catalog.domain.errors import (
    InvalidPostError,
    InvalidSeriesError,
    InvalidShelfEntryError,
    InvalidTitleError,
    PostNotFoundError,
    TitleNotFoundError,
)
from zxcrunet.shared.domain.ids import uuid7

MAX_TITLES = 1000
MAX_POSTS = 500
NAME_MAX = 120
SLUG_MAX = 64
CREATOR_MAX = 80
PART_LABEL_MAX = 24
DESCRIPTION_MAX = 1200
GENRES_MAX = 6
GENRE_MAX = 40
NOTES_MAX = 2000
HEADING_MAX = 160
BODY_MAX = 5000
YEAR_MIN, YEAR_MAX = 1800, 2100
RATING_MAX = 10
COUNTER_MAX = 1_000_000
SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")

#: Free-form, validated by the application layer (criteria, spoilers, characters, …).
Details = dict[str, Any]
#: An uploaded image as blocks store it: {"id", "url", "width", "height"}.
MediaRef = dict[str, Any]


class TitleKind(StrEnum):
    GAME = "game"
    BOOK = "book"
    ANIME = "anime"
    SERIES = "series"
    FILM = "film"


class ShelfStatus(StrEnum):
    PLANNED = "planned"  # хочу
    ACTIVE = "active"  # в процессе
    DONE = "done"  # готово
    DROPPED = "dropped"  # брошено


class PostKind(StrEnum):
    REVIEW = "review"
    NOTE = "note"


_TRANSLIT = dict(
    zip(
        "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
        [
            "a", "b", "v", "g", "d", "e", "e", "zh", "z", "i", "y", "k", "l", "m", "n", "o",
            "p", "r", "s", "t", "u", "f", "kh", "ts", "ch", "sh", "shch", "", "y", "", "e",
            "yu", "ya",
        ],
        strict=True,
    )
)  # fmt: skip


def slugify(raw: str) -> str:
    """`Ведьмак 3: Дикая Охота` → `vedmak-3-dikaya-okhota`."""
    text = "".join(_TRANSLIT.get(ch, ch) for ch in raw.lower())
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:SLUG_MAX].rstrip("-") or "title"


def parse_slug(raw: str) -> str:
    value = raw.strip().lower()
    if not 1 <= len(value) <= SLUG_MAX or not SLUG_RE.fullmatch(value) or "--" in value:
        raise InvalidTitleError("Title address must be [a-z0-9-]", {"field": "slug"})
    return value


def _clean(raw: str, limit: int, field_name: str, *, required: bool = False) -> str:
    value = " ".join(raw.split())
    if required and not value:
        raise InvalidTitleError("Field is required", {"field": field_name})
    if len(value) > limit:
        raise InvalidTitleError("Field is too long", {"field": field_name, "max": limit})
    return value


def _year(value: int | None, field_name: str) -> int | None:
    if value is not None and not YEAR_MIN <= value <= YEAR_MAX:
        raise InvalidTitleError("Year is out of range", {"field": field_name})
    return value


@dataclass(slots=True)
class ShelfEntry:
    """The owner's relation to a title: status, rating, progress, notes."""

    status: ShelfStatus
    rating: int | None = None
    hours: int | None = None
    progress: int | None = None
    progress_total: int | None = None
    favorite: bool = False
    started_on: date | None = None
    finished_on: date | None = None
    notes: str = ""
    details: Details = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.rating is not None and not 1 <= self.rating <= RATING_MAX:
            raise InvalidShelfEntryError("Rating must be 1–10", {"field": "rating"})
        for name in ("hours", "progress", "progress_total"):
            value = getattr(self, name)
            if value is not None and not 0 <= value <= COUNTER_MAX:
                raise InvalidShelfEntryError("Value is out of range", {"field": name})
        if (
            self.progress is not None
            and self.progress_total is not None
            and self.progress > self.progress_total
        ):
            raise InvalidShelfEntryError("Progress exceeds the total", {"field": "progress"})
        if self.started_on and self.finished_on and self.finished_on < self.started_on:
            raise InvalidShelfEntryError("Finished before started", {"field": "finished_on"})
        self.notes = self.notes.strip()
        if len(self.notes) > NOTES_MAX:
            raise InvalidShelfEntryError("Notes are too long", {"field": "notes"})


@dataclass(slots=True)
class TitleData:
    """Everything the owner edits about a title (one form, saved at once)."""

    kind: TitleKind
    name: str
    slug: str = ""
    year: int | None = None
    year_end: int | None = None
    creator: str = ""
    genres: list[str] = field(default_factory=list)
    description: str = ""
    cover: MediaRef | None = None
    is_series: bool = False
    series_id: UUID | None = None
    part_label: str = ""
    position: int = 0


@dataclass(slots=True)
class Title:
    owner_id: UUID
    kind: TitleKind
    name: str
    slug: str
    created_at: datetime
    id: UUID = field(default_factory=uuid7)
    year: int | None = None
    year_end: int | None = None
    creator: str = ""
    genres: list[str] = field(default_factory=list)
    description: str = ""
    cover: MediaRef | None = None
    is_series: bool = False
    series_id: UUID | None = None
    part_label: str = ""
    position: int = 0
    source: str = "manual"
    external_id: str | None = None
    updated_at: datetime | None = None
    entry: ShelfEntry | None = None

    @classmethod
    def create(cls, owner_id: UUID, data: TitleData, now: datetime) -> "Title":
        title = cls(owner_id=owner_id, kind=data.kind, name="", slug="", created_at=now)
        title.apply(data, now)
        return title

    def ensure_owned_by(self, user_id: UUID) -> None:
        # Somebody else's title looks exactly like a missing one.
        if self.owner_id != user_id:
            raise TitleNotFoundError("Title not found")

    def apply(self, data: TitleData, now: datetime) -> None:
        """Validate and take every editable field; series links are checked separately."""
        if data.kind != self.kind and self.name:
            raise InvalidTitleError("Kind of a title cannot change", {"field": "kind"})
        name = _clean(data.name, NAME_MAX, "name", required=True)
        year = _year(data.year, "year")
        year_end = _year(data.year_end, "year_end")
        if year is not None and year_end is not None and year_end < year:
            raise InvalidTitleError("Years are reversed", {"field": "year_end"})
        genres = [_clean(g, GENRE_MAX, "genres") for g in data.genres]
        genres = list(dict.fromkeys(g for g in genres if g))
        if len(genres) > GENRES_MAX:
            raise InvalidTitleError("Too many genres", {"field": "genres", "max": GENRES_MAX})
        description = data.description.strip()
        if len(description) > DESCRIPTION_MAX:
            raise InvalidTitleError("Description is too long", {"field": "description"})
        if data.is_series and data.series_id is not None:
            raise InvalidSeriesError("A series cannot be a part of another series")
        if data.series_id == self.id:
            raise InvalidSeriesError("A title cannot be its own series")

        self.kind = data.kind
        self.name = name
        self.slug = parse_slug(data.slug) if data.slug.strip() else slugify(name)
        self.year, self.year_end = year, year_end
        self.creator = _clean(data.creator, CREATOR_MAX, "creator")
        self.genres = genres
        self.description = description
        self.cover = dict(data.cover) if data.cover else None
        self.is_series = data.is_series
        self.series_id = data.series_id
        self.part_label = _clean(data.part_label, PART_LABEL_MAX, "part_label")
        self.position = max(0, min(data.position, 999))
        self.updated_at = now

    def check_series(self, series: "Title | None") -> None:
        """`series` is the title `series_id` points to (None when it does not exist)."""
        if self.series_id is None:
            return
        if series is None or series.owner_id != self.owner_id:
            raise InvalidSeriesError("Series not found")
        if not series.is_series:
            raise InvalidSeriesError("The chosen title is not a series")
        if series.kind != self.kind:
            raise InvalidSeriesError("A part must be of the same kind as its series")

    def put_on_shelf(self, entry: ShelfEntry | None, now: datetime) -> None:
        self.entry = entry
        self.updated_at = now


@dataclass(slots=True)
class PostData:
    kind: PostKind
    heading: str
    body: str = ""
    title_id: UUID | None = None
    published_on: date | None = None


@dataclass(slots=True)
class Post:
    """A review or a note in the owner's feed; may point at a title."""

    owner_id: UUID
    kind: PostKind
    heading: str
    body: str
    published_on: date
    created_at: datetime
    id: UUID = field(default_factory=uuid7)
    title_id: UUID | None = None
    updated_at: datetime | None = None

    @classmethod
    def create(cls, owner_id: UUID, data: PostData, now: datetime) -> "Post":
        post = cls(
            owner_id=owner_id,
            kind=data.kind,
            heading="",
            body="",
            published_on=now.date(),
            created_at=now,
        )
        post.apply(data, now)
        return post

    def ensure_owned_by(self, user_id: UUID) -> None:
        if self.owner_id != user_id:
            raise PostNotFoundError("Post not found")

    def apply(self, data: PostData, now: datetime) -> None:
        heading = " ".join(data.heading.split())
        if not heading:
            raise InvalidPostError("Heading is required", {"field": "heading"})
        if len(heading) > HEADING_MAX:
            raise InvalidPostError("Heading is too long", {"field": "heading"})
        body = data.body.strip()
        if len(body) > BODY_MAX:
            raise InvalidPostError("Text is too long", {"field": "body"})
        self.kind = data.kind
        self.heading = heading
        self.body = body
        self.title_id = data.title_id
        self.published_on = data.published_on or self.published_on
        self.updated_at = now
