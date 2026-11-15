"""Owner (admin panel) use cases of the sites context: sites, suspension, reserved names."""

from dataclasses import dataclass
from uuid import UUID

from zxcrunet.shared.application.admin import AuditEntry, AuditTrail, Paging, Slice, Staff
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.uow import UnitOfWork
from zxcrunet.shared.domain.errors import ConflictError, NotFoundError
from zxcrunet.sites.application.use_cases import (
    CustomHosts,
    ResolveSite,
    SiteCache,
    SitesConfig,
)
from zxcrunet.sites.domain.errors import SiteNotFoundError
from zxcrunet.sites.domain.repository import (
    ReservedName,
    ReservedSlugs,
    SiteFilter,
    SiteRepository,
)
from zxcrunet.sites.domain.site import Site, SiteStatus, Slug

REASON_MAX = 120


class NameAlreadyReservedError(ConflictError):
    code = "slug_already_reserved"


class _Admin:
    def __init__(
        self,
        sites: SiteRepository,
        uow: UnitOfWork,
        audit: AuditTrail,
        clock: Clock,
        cache: SiteCache,
        config: SitesConfig,
        custom_hosts: CustomHosts,
    ) -> None:
        self.sites = sites
        self.uow = uow
        self.audit = audit
        self.clock = clock
        self.cache = cache
        self.config = config
        self.custom_hosts = custom_hosts

    async def _site(self, site_id: UUID) -> Site:
        site = await self.sites.get(site_id)
        if site is None:
            raise SiteNotFoundError("Site not found")
        return site

    async def _record(self, staff: Staff, action: str, site: Site, **details: object) -> None:
        await self.audit.record(
            AuditEntry(
                actor_id=staff.user_id,
                action=action,
                target_type="site",
                target_id=str(site.id),
                at=self.clock.now(),
                details={"slug": str(site.slug), "owner_id": str(site.owner_id), **details},
            )
        )

    async def _invalidate(self, site: Site) -> None:
        """Every public address of the site: the free one and its custom domains."""
        hosts = [self.config.host_for(site.slug), *await self.custom_hosts.hosts_of(site.id)]
        await self.cache.invalidate(*hosts)


class ListSites(_Admin):
    async def __call__(self, _: Staff, where: SiteFilter, paging: Paging) -> Slice[Site]:
        sites, total = await self.sites.search(where, paging.offset, paging.limit)
        return Slice(sites, total)


class GetSite(_Admin):
    async def __call__(self, _: Staff, site_id: UUID) -> Site:
        return await self._site(site_id)


class SuspendSite(_Admin):
    """Take a site down: its addresses answer «Сайт недоступен» until it is restored."""

    async def __call__(self, staff: Staff, site_id: UUID, reason: str) -> Site:
        site = await self._site(site_id)
        was = site.status
        site.suspend(reason, self.clock.now())
        await self.sites.save(site)
        await self._record(
            staff, "site.suspend", site, reason=site.suspension_reason, previous=was.value
        )
        await self.uow.commit()
        await self._invalidate(site)
        return site


class RestoreSite(_Admin):
    async def __call__(self, staff: Staff, site_id: UUID) -> Site:
        site = await self._site(site_id)
        if not site.is_suspended:
            return site
        site.restore()
        await self.sites.save(site)
        await self._record(staff, "site.restore", site, status=site.status.value)
        await self.uow.commit()
        await self._invalidate(site)
        return site


# --- reserved names ----------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class ReservedNameUse:
    name: ReservedName
    #: A site already uses this address: reserving does not take it away.
    in_use: bool


class _Names:
    def __init__(
        self,
        reserved: ReservedSlugs,
        sites: SiteRepository,
        uow: UnitOfWork,
        audit: AuditTrail,
        clock: Clock,
    ) -> None:
        self.reserved = reserved
        self.sites = sites
        self.uow = uow
        self.audit = audit
        self.clock = clock

    async def _record(self, staff: Staff, action: str, slug: Slug, **details: object) -> None:
        await self.audit.record(
            AuditEntry(
                actor_id=staff.user_id,
                action=action,
                target_type="slug",
                target_id=str(slug),
                at=self.clock.now(),
                details=dict(details),
            )
        )


class ListReservedNames(_Names):
    async def __call__(self, _: Staff) -> list[ReservedNameUse]:
        names = await self.reserved.list()
        return [ReservedNameUse(n, await self.sites.slug_exists(n.slug)) for n in names]


class ReserveName(_Names):
    async def __call__(self, staff: Staff, raw: str, reason: str) -> ReservedNameUse:
        slug = Slug.parse(raw)
        if await self.reserved.is_reserved(slug):
            raise NameAlreadyReservedError("This name is already reserved", {"slug": str(slug)})
        name = ReservedName(slug, " ".join(reason.split())[:REASON_MAX])
        await self.reserved.add(name)
        await self._record(staff, "slug.reserve", slug, reason=name.reason)
        await self.uow.commit()
        return ReservedNameUse(name, await self.sites.slug_exists(slug))


class ReleaseName(_Names):
    async def __call__(self, staff: Staff, raw: str) -> None:
        slug = Slug(raw.strip().lower())
        if not await self.reserved.remove(slug):
            raise NotFoundError("This name is not reserved", {"slug": str(slug)})
        await self._record(staff, "slug.release", slug)
        await self.uow.commit()


# --- for other contexts ---------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class BlockUsage:
    type: str
    blocks: int
    sites: int


@dataclass(frozen=True, slots=True)
class SiteTotals:
    by_status: dict[SiteStatus, int]
    blocks: list[BlockUsage]


class SiteDirectory:
    """Read-only answers for other contexts: moderation, analytics, admin lists."""

    def __init__(self, sites: SiteRepository, resolve: ResolveSite, config: SitesConfig) -> None:
        self.sites = sites
        self.resolve = resolve
        self.config = config

    async def published_at(self, host: str) -> UUID | None:
        """The published site at this public host (cached, like the proxy's lookup)."""
        resolved = await self.resolve(host)
        if resolved is None or resolved.status != "published":
            return None
        return UUID(resolved.site_id)

    async def hosts(self, ids: set[UUID]) -> dict[UUID, str]:
        """Free address of each site, for lists in the admin panel."""
        if not ids:
            return {}
        sites, _ = await self.sites.search(SiteFilter(ids=frozenset(ids)), 0, len(ids))
        return {s.id: self.config.host_for(s.slug) for s in sites}

    async def totals(self, top_blocks: int = 12) -> SiteTotals:
        return SiteTotals(
            by_status=await self.sites.count_by_status(),
            blocks=[BlockUsage(*row) for row in await self.sites.block_usage(top_blocks)],
        )
