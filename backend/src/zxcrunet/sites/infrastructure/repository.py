import json
from dataclasses import asdict
from typing import Literal
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import ColumnElement, exists, func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.sites.application.use_cases import ResolvedSite
from zxcrunet.sites.domain.errors import SlugTakenError
from zxcrunet.sites.domain.repository import ReservedName, SiteFilter
from zxcrunet.sites.domain.site import Page, Site, SiteKind, SiteStatus, Slug, Theme
from zxcrunet.sites.infrastructure.models import PageModel, ReservedSlugModel, SiteModel


def _to_domain(row: SiteModel) -> Site:
    return Site(
        id=row.id,
        owner_id=row.owner_id,
        kind=SiteKind(row.kind),
        slug=Slug(row.slug),
        title=row.title,
        theme=Theme(accent=row.theme_accent, second=row.theme_second),
        status=SiteStatus(row.status),
        seo_title=row.seo_title,
        seo_description=row.seo_description,
        revision=row.revision,
        published_revision=row.published_revision,
        published=row.published,
        created_at=row.created_at,
        updated_at=row.updated_at,
        published_at=row.published_at,
        suspension_reason=row.suspension_reason,
        suspended_at=row.suspended_at,
        status_before_suspension=(
            SiteStatus(row.status_before_suspension) if row.status_before_suspension else None
        ),
        pages=[
            Page(id=p.id, path=p.path, title=p.title, position=p.position, blocks=list(p.blocks))
            for p in row.pages
        ],
    )


def _apply(row: SiteModel, site: Site) -> None:
    row.owner_id = site.owner_id
    row.kind = site.kind.value
    row.slug = site.slug.value
    row.title = site.title
    row.theme_accent = site.theme.accent
    row.theme_second = site.theme.second
    row.status = site.status.value
    row.seo_title = site.seo_title
    row.seo_description = site.seo_description
    row.revision = site.revision
    row.published_revision = site.published_revision
    row.published = site.published
    row.created_at = site.created_at
    row.updated_at = site.updated_at
    row.published_at = site.published_at
    row.suspension_reason = site.suspension_reason
    row.suspended_at = site.suspended_at
    row.status_before_suspension = (
        site.status_before_suspension.value if site.status_before_suspension else None
    )

    existing = {p.id: p for p in row.pages}
    wanted: list[PageModel] = []
    for page in site.pages:
        model = existing.get(page.id) or PageModel(id=page.id)
        model.path = page.path
        model.title = page.title
        model.position = page.position
        model.blocks = list(page.blocks)
        wanted.append(model)
    row.pages = wanted


_BLOCK_USAGE = text(
    """
    SELECT block ->> 'type' AS type, count(*) AS blocks, count(DISTINCT s.id) AS sites
    FROM sites AS s
    CROSS JOIN LATERAL jsonb_array_elements(s.published -> 'pages') AS page
    CROSS JOIN LATERAL jsonb_array_elements(page -> 'blocks') AS block
    WHERE s.status = :status AND s.published IS NOT NULL
    GROUP BY 1
    ORDER BY 2 DESC, 1
    LIMIT :limit
    """
)


class SqlSiteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, site_id: UUID) -> Site | None:
        row = await self._session.get(SiteModel, site_id)
        return _to_domain(row) if row else None

    async def get_by_slug(self, slug: Slug) -> Site | None:
        row = await self._session.scalar(select(SiteModel).where(SiteModel.slug == slug.value))
        return _to_domain(row) if row else None

    async def list_by_owner(self, owner_id: UUID) -> list[Site]:
        rows = await self._session.scalars(
            select(SiteModel).where(SiteModel.owner_id == owner_id).order_by(SiteModel.created_at)
        )
        return [_to_domain(r) for r in rows]

    async def count_by_owner(self, owner_id: UUID) -> int:
        count = await self._session.scalar(
            select(func.count()).select_from(SiteModel).where(SiteModel.owner_id == owner_id)
        )
        return int(count or 0)

    async def slug_exists(self, slug: Slug) -> bool:
        return bool(
            await self._session.scalar(select(exists().where(SiteModel.slug == slug.value)))
        )

    async def add(self, site: Site) -> None:
        row = SiteModel(id=site.id)
        _apply(row, site)
        self._session.add(row)
        await self._flush()

    async def save(self, site: Site) -> None:
        row = await self._session.get(SiteModel, site.id)
        if row is None:
            msg = f"Site {site.id} does not exist"
            raise LookupError(msg)
        _apply(row, site)
        await self._flush()

    async def delete(self, site: Site) -> None:
        row = await self._session.get(SiteModel, site.id)
        if row is not None:
            await self._session.delete(row)
            await self._session.flush()

    async def search(self, where: SiteFilter, offset: int, limit: int) -> tuple[list[Site], int]:
        conditions: list[ColumnElement[bool]] = []
        if where.text:
            conditions.append(
                or_(
                    SiteModel.slug.icontains(where.text, autoescape=True),
                    SiteModel.title.icontains(where.text, autoescape=True),
                )
            )
        if where.status:
            conditions.append(SiteModel.status == where.status.value)
        if where.kind:
            conditions.append(SiteModel.kind == where.kind.value)
        if where.owner_id:
            conditions.append(SiteModel.owner_id == where.owner_id)
        if where.ids is not None:
            conditions.append(SiteModel.id.in_(where.ids))
        total = await self._session.scalar(
            select(func.count()).select_from(SiteModel).where(*conditions)
        )
        rows = await self._session.scalars(
            select(SiteModel)
            .where(*conditions)
            .order_by(SiteModel.created_at.desc(), SiteModel.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return [_to_domain(r) for r in rows], int(total or 0)

    async def count_by_status(self) -> dict[SiteStatus, int]:
        rows = await self._session.execute(
            select(SiteModel.status, func.count()).group_by(SiteModel.status)
        )
        return {SiteStatus(row[0]): int(row[1]) for row in rows}

    async def block_usage(self, limit: int) -> list[tuple[str, int, int]]:
        """(block type, blocks, sites) over the published versions of published sites."""
        rows = await self._session.execute(_BLOCK_USAGE, {"status": "published", "limit": limit})
        return [(str(row[0]), int(row[1]), int(row[2])) for row in rows]

    async def _flush(self) -> None:
        try:
            await self._session.flush()
        except IntegrityError as exc:
            await self._session.rollback()
            raise SlugTakenError("This address is taken") from exc


class SqlReservedSlugs:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def is_reserved(self, slug: Slug) -> bool:
        return await self._session.get(ReservedSlugModel, slug.value) is not None

    async def list(self) -> list[ReservedName]:
        rows = await self._session.scalars(
            select(ReservedSlugModel).order_by(ReservedSlugModel.slug)
        )
        return [ReservedName(Slug(r.slug), r.reason) for r in rows]

    async def add(self, name: ReservedName) -> None:
        self._session.add(ReservedSlugModel(slug=name.slug.value, reason=name.reason))
        await self._session.flush()

    async def remove(self, slug: Slug) -> bool:
        row = await self._session.get(ReservedSlugModel, slug.value)
        if row is None:
            return False
        await self._session.delete(row)
        await self._session.flush()
        return True


class RedisSiteCache:
    """`site-host:<host>` → JSON payload, or `null` for a known miss (shorter TTL)."""

    def __init__(self, redis: Redis, ttl_seconds: int = 60, miss_ttl_seconds: int = 15) -> None:
        self._redis = redis
        self._ttl = ttl_seconds
        self._miss_ttl = miss_ttl_seconds

    @staticmethod
    def _key(host: str) -> str:
        return f"site-host:{host}"

    async def get(self, host: str) -> ResolvedSite | Literal[False] | None:
        raw = await self._redis.get(self._key(host))
        if raw is None:
            return False
        data = json.loads(raw)
        return ResolvedSite(**data) if data else None

    async def set(self, host: str, value: ResolvedSite | None) -> None:
        payload = json.dumps(asdict(value) if value else None, ensure_ascii=False)
        await self._redis.set(self._key(host), payload, ex=self._ttl if value else self._miss_ttl)

    async def invalidate(self, *hosts: str) -> None:
        if hosts:
            await self._redis.delete(*(self._key(h) for h in hosts))
