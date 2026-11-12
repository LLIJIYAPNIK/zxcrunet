from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from zxcrunet.catalog.application.details import Details
from zxcrunet.catalog.application.use_cases import CatalogView, EntryInput, title_payload
from zxcrunet.catalog.domain.catalog import (
    Post,
    PostData,
    PostKind,
    ShelfStatus,
    Title,
    TitleData,
    TitleKind,
)
from zxcrunet.shared.application.content import MediaRef

Kind = Literal["game", "book", "anime", "series", "film"]
Status = Literal["planned", "active", "done", "dropped"]
PostKindName = Literal["review", "note"]


class EntryIn(BaseModel):
    status: Status
    rating: int | None = Field(default=None, ge=1, le=10)
    hours: int | None = Field(default=None, ge=0, le=1_000_000)
    progress: int | None = Field(default=None, ge=0, le=1_000_000)
    progress_total: int | None = Field(default=None, ge=0, le=1_000_000)
    favorite: bool = False
    started_on: date | None = None
    finished_on: date | None = None
    notes: str = Field(default="", max_length=4000)
    details: dict[str, Any] = Field(default_factory=dict)

    def to_input(self) -> EntryInput:
        return EntryInput(
            status=ShelfStatus(self.status),
            rating=self.rating,
            hours=self.hours,
            progress=self.progress,
            progress_total=self.progress_total,
            favorite=self.favorite,
            started_on=self.started_on,
            finished_on=self.finished_on,
            notes=self.notes,
            details=self.details,
        )


class TitleIn(BaseModel):
    kind: Kind
    name: str = Field(max_length=200)
    slug: str = Field(default="", max_length=80)
    year: int | None = None
    year_end: int | None = None
    creator: str = Field(default="", max_length=200)
    genres: list[str] = Field(default_factory=list, max_length=12)
    description: str = Field(default="", max_length=2400)
    cover: MediaRef | None = None
    is_series: bool = False
    series_id: UUID | None = None
    part_label: str = Field(default="", max_length=48)
    position: int = 0
    #: null: the title is in the catalog but not on the shelf.
    entry: EntryIn | None = None

    def to_data(self) -> TitleData:
        return TitleData(
            kind=TitleKind(self.kind),
            name=self.name,
            slug=self.slug,
            year=self.year,
            year_end=self.year_end,
            creator=self.creator,
            genres=self.genres,
            description=self.description,
            cover=self.cover.model_dump(mode="json") if self.cover else None,
            is_series=self.is_series,
            series_id=self.series_id,
            part_label=self.part_label,
            position=self.position,
        )


class EntryOut(BaseModel):
    status: Status
    rating: int | None
    hours: int | None
    progress: int | None
    progress_total: int | None
    favorite: bool
    started_on: date | None
    finished_on: date | None
    notes: str
    details: Details


class TitleOut(BaseModel):
    id: UUID
    kind: Kind
    name: str
    slug: str
    year: int | None
    year_end: int | None
    creator: str
    genres: list[str]
    description: str
    cover: MediaRef | None
    is_series: bool
    series_id: UUID | None
    part_label: str
    position: int
    updated_at: datetime | None
    entry: EntryOut | None

    @classmethod
    def of(cls, title: Title) -> "TitleOut":
        return cls.model_validate(title_payload(title))


class PostIn(BaseModel):
    kind: PostKindName
    heading: str = Field(max_length=300)
    body: str = Field(default="", max_length=10_000)
    title_id: UUID | None = None
    published_on: date | None = None

    def to_data(self) -> PostData:
        return PostData(
            kind=PostKind(self.kind),
            heading=self.heading,
            body=self.body,
            title_id=self.title_id,
            published_on=self.published_on,
        )


class PostOut(BaseModel):
    id: UUID
    kind: PostKindName
    heading: str
    body: str
    title_id: UUID | None
    published_on: date

    @classmethod
    def of(cls, post: Post) -> "PostOut":
        return cls(
            id=post.id,
            kind=post.kind.value,
            heading=post.heading,
            body=post.body,
            title_id=post.title_id,
            published_on=post.published_on,
        )


class CatalogOut(BaseModel):
    titles: list[TitleOut]
    posts: list[PostOut]
    max_titles: int
    max_posts: int

    @classmethod
    def of(cls, view: CatalogView) -> "CatalogOut":
        return cls(
            titles=[TitleOut.of(t) for t in view.titles],
            posts=[PostOut.of(p) for p in view.posts],
            max_titles=view.max_titles,
            max_posts=view.max_posts,
        )


class PublicCatalogOut(BaseModel):
    """Same shapes as the cabinet, without limits."""

    titles: list[TitleOut]
    posts: list[PostOut]
