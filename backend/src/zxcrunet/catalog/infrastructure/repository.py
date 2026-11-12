import json
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.catalog.application.use_cases import PublicCatalog
from zxcrunet.catalog.domain.catalog import (
    Post,
    PostKind,
    ShelfEntry,
    ShelfStatus,
    Title,
    TitleKind,
)
from zxcrunet.catalog.domain.errors import TitleSlugTakenError
from zxcrunet.catalog.infrastructure.models import PostModel, ShelfEntryModel, TitleModel
from zxcrunet.shared.domain.ids import uuid7
from zxcrunet.sites.application.use_cases import ResolveSite


def _title(row: TitleModel) -> Title:
    entry = row.entry
    return Title(
        id=row.id,
        owner_id=row.owner_id,
        kind=TitleKind(row.kind),
        name=row.name,
        slug=row.slug,
        year=row.year,
        year_end=row.year_end,
        creator=row.creator,
        genres=list(row.genres),
        description=row.description,
        cover=row.cover,
        is_series=row.is_series,
        series_id=row.series_id,
        part_label=row.part_label,
        position=row.position,
        source=row.source,
        external_id=row.external_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        entry=None
        if entry is None
        else ShelfEntry(
            status=ShelfStatus(entry.status),
            rating=entry.rating,
            hours=entry.hours,
            progress=entry.progress,
            progress_total=entry.progress_total,
            favorite=entry.favorite,
            started_on=entry.started_on,
            finished_on=entry.finished_on,
            notes=entry.notes,
            details=dict(entry.details),
        ),
    )


def _apply_title(row: TitleModel, title: Title) -> None:
    row.owner_id = title.owner_id
    row.kind = title.kind.value
    row.name = title.name
    row.slug = title.slug
    row.year = title.year
    row.year_end = title.year_end
    row.creator = title.creator
    row.genres = list(title.genres)
    row.description = title.description
    row.cover = title.cover
    row.is_series = title.is_series
    row.series_id = title.series_id
    row.part_label = title.part_label
    row.position = title.position
    row.source = title.source
    row.external_id = title.external_id
    row.created_at = title.created_at
    row.updated_at = title.updated_at
    entry = title.entry
    if entry is None:
        row.entry = None
        return
    model = row.entry or ShelfEntryModel(id=uuid7(), owner_id=title.owner_id)
    model.status = entry.status.value
    model.rating = entry.rating
    model.hours = entry.hours
    model.progress = entry.progress
    model.progress_total = entry.progress_total
    model.favorite = entry.favorite
    model.started_on = entry.started_on
    model.finished_on = entry.finished_on
    model.notes = entry.notes
    model.details = dict(entry.details)
    row.entry = model


class SqlTitleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, title_id: UUID) -> Title | None:
        row = await self._session.get(TitleModel, title_id)
        return _title(row) if row else None

    async def list_by_owner(self, owner_id: UUID) -> list[Title]:
        rows = await self._session.scalars(
            select(TitleModel)
            .where(TitleModel.owner_id == owner_id)
            .order_by(TitleModel.created_at, TitleModel.id)
        )
        return [_title(r) for r in rows]

    async def count_by_owner(self, owner_id: UUID) -> int:
        count = await self._session.scalar(
            select(func.count()).select_from(TitleModel).where(TitleModel.owner_id == owner_id)
        )
        return int(count or 0)

    async def slug_taken(
        self, owner_id: UUID, kind: TitleKind, slug: str, *, except_id: UUID | None = None
    ) -> bool:
        query = exists().where(
            TitleModel.owner_id == owner_id,
            TitleModel.kind == kind.value,
            TitleModel.slug == slug,
        )
        if except_id is not None:
            query = query.where(TitleModel.id != except_id)
        return bool(await self._session.scalar(select(query)))

    async def count_parts(self, series_id: UUID) -> int:
        count = await self._session.scalar(
            select(func.count()).select_from(TitleModel).where(TitleModel.series_id == series_id)
        )
        return int(count or 0)

    async def add(self, title: Title) -> None:
        row = TitleModel(id=title.id)
        _apply_title(row, title)
        self._session.add(row)
        await self._flush()

    async def save(self, title: Title) -> None:
        row = await self._session.get(TitleModel, title.id)
        if row is None:
            msg = f"Title {title.id} does not exist"
            raise LookupError(msg)
        _apply_title(row, title)
        await self._flush()

    async def delete(self, title: Title) -> None:
        row = await self._session.get(TitleModel, title.id)
        if row is not None:
            # Parts and posts keep living: the database sets their links to NULL.
            await self._session.delete(row)
            await self._session.flush()

    async def _flush(self) -> None:
        try:
            await self._session.flush()
        except IntegrityError as exc:
            await self._session.rollback()
            raise TitleSlugTakenError("This address is used by another title") from exc


def _post(row: PostModel) -> Post:
    return Post(
        id=row.id,
        owner_id=row.owner_id,
        kind=PostKind(row.kind),
        heading=row.heading,
        body=row.body,
        title_id=row.title_id,
        published_on=row.published_on,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _apply_post(row: PostModel, post: Post) -> None:
    row.owner_id = post.owner_id
    row.kind = post.kind.value
    row.heading = post.heading
    row.body = post.body
    row.title_id = post.title_id
    row.published_on = post.published_on
    row.created_at = post.created_at
    row.updated_at = post.updated_at


class SqlPostRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, post_id: UUID) -> Post | None:
        row = await self._session.get(PostModel, post_id)
        return _post(row) if row else None

    async def list_by_owner(self, owner_id: UUID) -> list[Post]:
        rows = await self._session.scalars(
            select(PostModel)
            .where(PostModel.owner_id == owner_id)
            .order_by(PostModel.published_on.desc(), PostModel.created_at.desc())
        )
        return [_post(r) for r in rows]

    async def count_by_owner(self, owner_id: UUID) -> int:
        count = await self._session.scalar(
            select(func.count()).select_from(PostModel).where(PostModel.owner_id == owner_id)
        )
        return int(count or 0)

    async def add(self, post: Post) -> None:
        row = PostModel(id=post.id)
        _apply_post(row, post)
        self._session.add(row)
        await self._session.flush()

    async def save(self, post: Post) -> None:
        row = await self._session.get(PostModel, post.id)
        if row is None:
            msg = f"Post {post.id} does not exist"
            raise LookupError(msg)
        _apply_post(row, post)
        await self._session.flush()

    async def delete(self, post: Post) -> None:
        row = await self._session.get(PostModel, post.id)
        if row is not None:
            await self._session.delete(row)
            await self._session.flush()


class RedisCatalogCache:
    """`catalog:<owner_id>` → public catalog JSON."""

    def __init__(self, redis: Redis, ttl_seconds: int = 300) -> None:
        self._redis = redis
        self._ttl = ttl_seconds

    @staticmethod
    def _key(owner_id: UUID) -> str:
        return f"catalog:{owner_id}"

    async def get(self, owner_id: UUID) -> PublicCatalog | None:
        raw = await self._redis.get(self._key(owner_id))
        if raw is None:
            return None
        data: PublicCatalog = json.loads(raw)
        return data

    async def set(self, owner_id: UUID, value: PublicCatalog) -> None:
        payload = json.dumps(value, ensure_ascii=False)
        await self._redis.set(self._key(owner_id), payload, ex=self._ttl)

    async def invalidate(self, owner_id: UUID) -> None:
        await self._redis.delete(self._key(owner_id))


class SitesPersonalSites:
    """Adapter to the sites context through its public application service."""

    def __init__(self, resolve: ResolveSite) -> None:
        self._resolve = resolve

    async def owner_at(self, host: str) -> UUID | None:
        site = await self._resolve(host)
        if site is None or site.status != "published" or site.kind != "personal":
            return None
        return UUID(site.owner_id) if site.owner_id else None
