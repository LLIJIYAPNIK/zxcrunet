"""Catalog use cases: the owner's shelves and posts, and their public read model."""

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Protocol
from uuid import UUID

from zxcrunet.catalog.application.details import validate_details
from zxcrunet.catalog.domain.catalog import (
    MAX_POSTS,
    MAX_TITLES,
    Post,
    PostData,
    ShelfEntry,
    ShelfStatus,
    Title,
    TitleData,
)
from zxcrunet.catalog.domain.errors import (
    CatalogLimitError,
    InvalidPostError,
    InvalidSeriesError,
    InvalidShelfEntryError,
    PostNotFoundError,
    TitleNotFoundError,
    TitleSlugTakenError,
)
from zxcrunet.catalog.domain.repository import PostRepository, TitleRepository
from zxcrunet.media.application.use_cases import MediaService
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.content import media_ids
from zxcrunet.shared.application.uow import UnitOfWork

PublicCatalog = dict[str, Any]


class CatalogCache(Protocol):
    """Public catalog payload per owner (invalidated on every change)."""

    async def get(self, owner_id: UUID) -> PublicCatalog | None: ...

    async def set(self, owner_id: UUID, value: PublicCatalog) -> None: ...

    async def invalidate(self, owner_id: UUID) -> None: ...


class PersonalSites(Protocol):
    """Port to the sites context: whose published personal site lives at a host."""

    async def owner_at(self, host: str) -> UUID | None: ...


@dataclass(frozen=True, slots=True)
class EntryInput:
    status: ShelfStatus
    rating: int | None = None
    hours: int | None = None
    progress: int | None = None
    progress_total: int | None = None
    favorite: bool = False
    started_on: date | None = None
    finished_on: date | None = None
    notes: str = ""
    details: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class CatalogView:
    titles: list[Title]
    posts: list[Post]
    max_titles: int
    max_posts: int


class _Base:
    def __init__(
        self,
        titles: TitleRepository,
        posts: PostRepository,
        media: MediaService,
        uow: UnitOfWork,
        clock: Clock,
        cache: CatalogCache,
    ) -> None:
        self.titles = titles
        self.posts = posts
        self.media = media
        self.uow = uow
        self.clock = clock
        self.cache = cache

    async def _own_title(self, owner_id: UUID, title_id: UUID) -> Title:
        title = await self.titles.get(title_id)
        if title is None:
            raise TitleNotFoundError("Title not found")
        title.ensure_owned_by(owner_id)
        return title

    async def _own_post(self, owner_id: UUID, post_id: UUID) -> Post:
        post = await self.posts.get(post_id)
        if post is None:
            raise PostNotFoundError("Post not found")
        post.ensure_owned_by(owner_id)
        return post

    async def _commit(self, owner_id: UUID) -> None:
        await self.uow.commit()
        await self.cache.invalidate(owner_id)


class ListCatalog(_Base):
    async def __call__(self, owner_id: UUID) -> CatalogView:
        return CatalogView(
            titles=await self.titles.list_by_owner(owner_id),
            posts=await self.posts.list_by_owner(owner_id),
            max_titles=MAX_TITLES,
            max_posts=MAX_POSTS,
        )


class _TitleWriter(_Base):
    async def _prepare(
        self, title: Title, data: TitleData, entry: EntryInput | None, *, is_new: bool
    ) -> None:
        now = self.clock.now()
        has_parts = not is_new and title.is_series and await self.titles.count_parts(title.id)
        if has_parts and not data.is_series:
            raise InvalidSeriesError("Remove the parts from the series first")
        title.apply(data, now)
        if title.series_id is not None:
            series = await self.titles.get(title.series_id)
            title.check_series(series)
        await self._pick_slug(title, explicit=bool(data.slug.strip()))
        shelf = await self._entry(title.owner_id, entry)
        title.put_on_shelf(shelf, now)
        files = media_ids([title.cover, shelf.details if shelf else {}])
        await self.media.ensure_owned(title.owner_id, files)

    async def _pick_slug(self, title: Title, *, explicit: bool) -> None:
        base, n = title.slug, 1
        while await self.titles.slug_taken(
            title.owner_id, title.kind, title.slug, except_id=title.id
        ):
            if explicit:
                raise TitleSlugTakenError("This address is used by another title")
            n += 1
            suffix = f"-{n}"
            title.slug = base[: 64 - len(suffix)].rstrip("-") + suffix

    async def _entry(self, owner_id: UUID, entry: EntryInput | None) -> ShelfEntry | None:
        if entry is None:
            return None
        details = validate_details(entry.details)
        for related in details["related"]:
            if related["title_id"] is not None:
                linked = await self.titles.get(UUID(related["title_id"]))
                if linked is None or linked.owner_id != owner_id:
                    raise InvalidShelfEntryError("Related title not found", {"field": "related"})
        return ShelfEntry(
            status=entry.status,
            rating=entry.rating,
            hours=entry.hours,
            progress=entry.progress,
            progress_total=entry.progress_total,
            favorite=entry.favorite,
            started_on=entry.started_on,
            finished_on=entry.finished_on,
            notes=entry.notes,
            details=details,
        )


class CreateTitle(_TitleWriter):
    async def __call__(self, owner_id: UUID, data: TitleData, entry: EntryInput | None) -> Title:
        if await self.titles.count_by_owner(owner_id) >= MAX_TITLES:
            raise CatalogLimitError("Too many titles", {"max": MAX_TITLES})
        title = Title(
            owner_id=owner_id, kind=data.kind, name="", slug="", created_at=self.clock.now()
        )
        await self._prepare(title, data, entry, is_new=True)
        await self.titles.add(title)
        await self._commit(owner_id)
        return title


class UpdateTitle(_TitleWriter):
    async def __call__(
        self, owner_id: UUID, title_id: UUID, data: TitleData, entry: EntryInput | None
    ) -> Title:
        title = await self._own_title(owner_id, title_id)
        await self._prepare(title, data, entry, is_new=False)
        await self.titles.save(title)
        await self._commit(owner_id)
        return title


class DeleteTitle(_Base):
    async def __call__(self, owner_id: UUID, title_id: UUID) -> None:
        title = await self._own_title(owner_id, title_id)
        await self.titles.delete(title)
        await self._commit(owner_id)


class _PostWriter(_Base):
    async def _check_link(self, owner_id: UUID, data: PostData) -> None:
        if data.title_id is None:
            return
        title = await self.titles.get(data.title_id)
        if title is None or title.owner_id != owner_id:
            raise InvalidPostError("Linked title not found", {"field": "title_id"})


class CreatePost(_PostWriter):
    async def __call__(self, owner_id: UUID, data: PostData) -> Post:
        if await self.posts.count_by_owner(owner_id) >= MAX_POSTS:
            raise CatalogLimitError("Too many posts", {"max": MAX_POSTS})
        await self._check_link(owner_id, data)
        post = Post.create(owner_id, data, self.clock.now())
        await self.posts.add(post)
        await self._commit(owner_id)
        return post


class UpdatePost(_PostWriter):
    async def __call__(self, owner_id: UUID, post_id: UUID, data: PostData) -> Post:
        post = await self._own_post(owner_id, post_id)
        await self._check_link(owner_id, data)
        post.apply(data, self.clock.now())
        await self.posts.save(post)
        await self._commit(owner_id)
        return post


class DeletePost(_Base):
    async def __call__(self, owner_id: UUID, post_id: UUID) -> None:
        post = await self._own_post(owner_id, post_id)
        await self.posts.delete(post)
        await self._commit(owner_id)


# --- public read model --------------------------------------------------------------


def _iso(value: date | None) -> str | None:
    return value.isoformat() if value else None


def title_payload(title: Title) -> dict[str, Any]:
    """JSON shape of a title on public pages (no owner, no import metadata)."""
    entry = title.entry
    return {
        "id": str(title.id),
        "kind": title.kind.value,
        "name": title.name,
        "slug": title.slug,
        "year": title.year,
        "year_end": title.year_end,
        "creator": title.creator,
        "genres": list(title.genres),
        "description": title.description,
        "cover": title.cover,
        "is_series": title.is_series,
        "series_id": str(title.series_id) if title.series_id else None,
        "part_label": title.part_label,
        "position": title.position,
        "updated_at": title.updated_at.isoformat() if title.updated_at else None,
        "entry": None
        if entry is None
        else {
            "status": entry.status.value,
            "rating": entry.rating,
            "hours": entry.hours,
            "progress": entry.progress,
            "progress_total": entry.progress_total,
            "favorite": entry.favorite,
            "started_on": _iso(entry.started_on),
            "finished_on": _iso(entry.finished_on),
            "notes": entry.notes,
            "details": entry.details,
        },
    }


def post_payload(post: Post) -> dict[str, Any]:
    return {
        "id": str(post.id),
        "kind": post.kind.value,
        "heading": post.heading,
        "body": post.body,
        "title_id": str(post.title_id) if post.title_id else None,
        "published_on": post.published_on.isoformat(),
    }


class GetPublicCatalog:
    """Public: the shelves and posts shown by the personal site at `host`. Cached."""

    def __init__(
        self,
        titles: TitleRepository,
        posts: PostRepository,
        sites: PersonalSites,
        cache: CatalogCache,
    ) -> None:
        self.titles = titles
        self.posts = posts
        self.sites = sites
        self.cache = cache

    async def __call__(self, host: str) -> PublicCatalog | None:
        owner_id = await self.sites.owner_at(host)
        if owner_id is None:
            return None
        cached = await self.cache.get(owner_id)
        if cached is not None:
            return cached
        payload: PublicCatalog = {
            "titles": [title_payload(t) for t in await self.titles.list_by_owner(owner_id)],
            "posts": [post_payload(p) for p in await self.posts.list_by_owner(owner_id)],
        }
        await self.cache.set(owner_id, payload)
        return payload
