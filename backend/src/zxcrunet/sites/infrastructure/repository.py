import json
from dataclasses import asdict
from typing import Literal
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.sites.application.use_cases import ResolvedSite
from zxcrunet.sites.domain.errors import SlugTakenError
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
