"""Site use cases for the cabinet, plus public host resolution."""

from dataclasses import dataclass
from typing import Any, Literal, Protocol
from uuid import UUID

from zxcrunet.media.application.use_cases import MediaService
from zxcrunet.plans.application.service import PlanService
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.uow import UnitOfWork
from zxcrunet.shared.domain.errors import AppError
from zxcrunet.sites.application.blocks import BlockIn, media_ids, validate_blocks
from zxcrunet.sites.domain.errors import SiteNotFoundError, SlugReservedError, SlugTakenError
from zxcrunet.sites.domain.repository import ReservedSlugs, SiteRepository
from zxcrunet.sites.domain.site import Page, Site, SiteKind, SiteStatus, Slug, Theme


@dataclass(frozen=True, slots=True)
class Actor:
    """The signed-in user, as the sites context needs to know them."""

    user_id: UUID
    email_verified: bool
    plan_code: str


class SiteCache(Protocol):
    """Cache of public host → resolved site payload (None is cached as «no site»)."""

    async def get(self, host: str) -> "ResolvedSite | Literal[False] | None":
        """False on a cache miss, None when «no site» is cached."""

    async def set(self, host: str, value: "ResolvedSite | None") -> None: ...

    async def invalidate(self, *hosts: str) -> None: ...


@dataclass(frozen=True, slots=True)
class SitesConfig:
    #: Parent domain of free addresses: `zxc.ru.net` (prod) or `localhost` (dev).
    sites_domain: str

    def host_for(self, slug: Slug) -> str:
        return f"{slug}.{self.sites_domain}"

    def slug_from_host(self, host: str) -> str | None:
        host = host.strip().lower().rstrip(".").split(":")[0]
        suffix = f".{self.sites_domain}"
        if not host.endswith(suffix):
            return None
        label = host[: -len(suffix)]
        return label if label and "." not in label else None


@dataclass(frozen=True, slots=True)
class ResolvedSite:
    status: Literal["published", "suspended"]
    site_id: str
    slug: str
    content: dict[str, Any] | None


class _Base:
    def __init__(
        self,
        sites: SiteRepository,
        reserved: ReservedSlugs,
        plans: PlanService,
        uow: UnitOfWork,
        clock: Clock,
        cache: SiteCache,
        config: SitesConfig,
    ) -> None:
        self.sites = sites
        self.reserved = reserved
        self.plans = plans
        self.uow = uow
        self.clock = clock
        self.cache = cache
        self.config = config

    async def _own(self, actor: Actor, site_id: UUID) -> Site:
        site = await self.sites.get(site_id)
        if site is None:
            raise SiteNotFoundError("Site not found")
        site.ensure_owned_by(actor.user_id)
        return site

    async def _ensure_slug_free(self, slug: Slug) -> None:
        if await self.reserved.is_reserved(slug):
            raise SlugReservedError("This address is reserved", {"slug": str(slug)})
        if await self.sites.slug_exists(slug):
            raise SlugTakenError("This address is taken", {"slug": str(slug)})

    async def _save(self, site: Site, *, invalidate: tuple[Slug, ...] = ()) -> Site:
        await self.sites.save(site)
        await self.uow.commit()
        if invalidate:
            await self.cache.invalidate(*(self.config.host_for(s) for s in invalidate))
        return site


@dataclass(frozen=True, slots=True)
class MySites:
    sites: list[Site]
    max_sites: int


class ListMySites(_Base):
    async def __call__(self, actor: Actor) -> MySites:
        plan = await self.plans.get(actor.plan_code)
        return MySites(
            sites=await self.sites.list_by_owner(actor.user_id), max_sites=plan.max_sites
        )


@dataclass(frozen=True, slots=True)
class SlugCheck:
    slug: str
    available: bool
    reason: str | None


class CheckSlug(_Base):
    async def __call__(self, raw: str) -> SlugCheck:
        try:
            slug = Slug.parse(raw)
            await self._ensure_slug_free(slug)
        except AppError as exc:
            return SlugCheck(slug=raw.strip().lower(), available=False, reason=exc.code)
        return SlugCheck(slug=str(slug), available=True, reason=None)


@dataclass(frozen=True, slots=True)
class NewSite:
    kind: SiteKind
    slug: str
    title: str


class CreateSite(_Base):
    async def __call__(self, actor: Actor, cmd: NewSite) -> Site:
        plan = await self.plans.get(actor.plan_code)
        plan.ensure_can_add("max_sites", await self.sites.count_by_owner(actor.user_id))
        slug = Slug.parse(cmd.slug)
        await self._ensure_slug_free(slug)
        site = Site.create(actor.user_id, cmd.kind, slug, cmd.title, self.clock.now())
        await self.sites.add(site)
        await self.uow.commit()
        await self.cache.invalidate(self.config.host_for(slug))
        return site


class GetMySite(_Base):
    async def __call__(self, actor: Actor, site_id: UUID) -> Site:
        return await self._own(actor, site_id)


@dataclass(frozen=True, slots=True)
class SiteChanges:
    title: str | None = None
    slug: str | None = None
    accent: str | None = None
    second: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None


class UpdateSite(_Base):
    async def __call__(self, actor: Actor, site_id: UUID, changes: SiteChanges) -> Site:
        site = await self._own(actor, site_id)
        now = self.clock.now()
        stale: tuple[Slug, ...] = ()
        if changes.title is not None:
            site.rename(changes.title, now)
        if changes.slug is not None:
            slug = Slug.parse(changes.slug)
            if slug != site.slug:
                await self._ensure_slug_free(slug)
                stale = (site.slug, slug)
                site.change_slug(slug, now)
        if changes.accent is not None:
            site.set_theme(Theme.parse(changes.accent, changes.second), now)
        if changes.seo_title is not None or changes.seo_description is not None:
            site.set_seo(
                changes.seo_title if changes.seo_title is not None else site.seo_title,
                changes.seo_description
                if changes.seo_description is not None
                else site.seo_description,
                now,
            )
        return await self._save(site, invalidate=stale)


class DeleteSite(_Base):
    async def __call__(self, actor: Actor, site_id: UUID) -> None:
        site = await self._own(actor, site_id)
        await self.sites.delete(site)
        await self.uow.commit()
        await self.cache.invalidate(self.config.host_for(site.slug))


class PublishSite(_Base):
    async def __call__(self, actor: Actor, site_id: UUID) -> Site:
        site = await self._own(actor, site_id)
        site.publish(self.clock.now(), owner_email_verified=actor.email_verified)
        return await self._save(site, invalidate=(site.slug,))


class UnpublishSite(_Base):
    async def __call__(self, actor: Actor, site_id: UUID) -> Site:
        site = await self._own(actor, site_id)
        site.unpublish()
        return await self._save(site, invalidate=(site.slug,))


@dataclass(frozen=True, slots=True)
class NewPage:
    path: str
    title: str


class AddPage(_Base):
    async def __call__(self, actor: Actor, site_id: UUID, cmd: NewPage) -> Page:
        site = await self._own(actor, site_id)
        page = site.add_page(cmd.path, cmd.title, self.clock.now())
        await self._save(site)
        return page


class UpdatePage(_Base):
    async def __call__(
        self, actor: Actor, site_id: UUID, page_id: UUID, *, title: str | None, path: str | None
    ) -> Page:
        site = await self._own(actor, site_id)
        page = site.update_page(page_id, self.clock.now(), title=title, raw_path=path)
        await self._save(site)
        return page


class DeletePage(_Base):
    async def __call__(self, actor: Actor, site_id: UUID, page_id: UUID) -> None:
        site = await self._own(actor, site_id)
        site.remove_page(page_id, self.clock.now())
        await self._save(site)


class SetPageBlocks(_Base):
    """Autosave target of the editor: the whole ordered list of a page's blocks."""

    def __init__(
        self,
        sites: SiteRepository,
        reserved: ReservedSlugs,
        plans: PlanService,
        uow: UnitOfWork,
        clock: Clock,
        cache: SiteCache,
        config: SitesConfig,
        media: MediaService,
    ) -> None:
        super().__init__(sites, reserved, plans, uow, clock, cache, config)
        self.media = media

    async def __call__(
        self, actor: Actor, site_id: UUID, page_id: UUID, blocks: list[BlockIn]
    ) -> Page:
        site = await self._own(actor, site_id)
        clean = validate_blocks(blocks)
        await self.media.ensure_owned(actor.user_id, media_ids(clean))
        page = site.set_blocks(page_id, clean, self.clock.now())
        await self._save(site)
        return page


class ResolveSite(_Base):
    """Public: which published site lives at this host. Read-only and cached."""

    async def __call__(self, host: str) -> ResolvedSite | None:
        key = host.strip().lower().rstrip(".").split(":")[0]
        cached = await self.cache.get(key)
        if cached is not False:
            return cached
        resolved = await self._resolve(key)
        await self.cache.set(key, resolved)
        return resolved

    async def _resolve(self, host: str) -> ResolvedSite | None:
        label = self.config.slug_from_host(host)
        if label is None:
            return None  # custom domains arrive in stage 6
        try:
            slug = Slug.parse(label)
        except AppError:
            return None
        site = await self.sites.get_by_slug(slug)
        if site is None:
            return None
        if site.status == SiteStatus.SUSPENDED:
            return ResolvedSite("suspended", str(site.id), str(site.slug), None)
        if site.status == SiteStatus.PUBLISHED and site.published is not None:
            return ResolvedSite("published", str(site.id), str(site.slug), site.published)
        return None
