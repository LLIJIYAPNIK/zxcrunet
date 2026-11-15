from uuid import UUID, uuid4

import pytest

from tests.fakes import Fakes
from zxcrunet.plans.application.service import PlanService
from zxcrunet.shared.application.admin import Paging, Staff
from zxcrunet.shared.domain.errors import NotFoundError
from zxcrunet.sites.application.admin import (
    GetSite,
    ListReservedNames,
    ListSites,
    NameAlreadyReservedError,
    ReleaseName,
    ReserveName,
    RestoreSite,
    SiteDirectory,
    SuspendSite,
)
from zxcrunet.sites.application.use_cases import ResolveSite, SitesConfig
from zxcrunet.sites.domain.errors import InvalidSlugError, SiteNotFoundError, SiteSuspendedError
from zxcrunet.sites.domain.repository import SiteFilter
from zxcrunet.sites.domain.site import Site, SiteKind, SiteStatus, Slug

CONFIG = SitesConfig(sites_domain="zxc.ru.net")
STAFF = Staff(user_id=uuid4())
BLOCK = {"id": str(uuid4()), "type": "hero", "version": 1, "hidden": False, "settings": {}}


@pytest.fixture
def f() -> Fakes:
    return Fakes()


def admin[UC: SuspendSite | RestoreSite | ListSites | GetSite](cls: type[UC], f: Fakes) -> UC:
    return cls(f.sites, f.uow, f.audit, f.clock, f.site_cache, CONFIG, f.custom_hosts)


async def site(
    f: Fakes, slug: str = "anna", *, published: bool = True, kind: SiteKind = SiteKind.BUSINESS
) -> Site:
    created = Site.create(uuid4(), kind, Slug(slug), slug.title(), f.clock.now())
    created.set_blocks(created.pages[0].id, [BLOCK], f.clock.now())
    if published:
        created.publish(f.clock.now(), owner_email_verified=True)
    await f.sites.add(created)
    return created


async def stored(f: Fakes, site_id: UUID) -> Site:
    found = await f.sites.get(site_id)
    assert found is not None
    return found


class TestSuspension:
    async def test_suspend_logs_and_drops_every_address_from_cache(self, f: Fakes) -> None:
        anna = await site(f)
        f.custom_hosts.sites["anna.example.com"] = anna.id

        suspended = await admin(SuspendSite, f)(STAFF, anna.id, "  фишинг ")

        assert suspended.status == SiteStatus.SUSPENDED
        assert suspended.suspension_reason == "фишинг"
        assert set(f.site_cache.invalidated) == {"anna.zxc.ru.net", "anna.example.com"}
        assert f.audit.actions == ["site.suspend"]
        assert f.audit.records[0].details["previous"] == "published"

    async def test_owner_of_the_site_cannot_publish_it_back(self, f: Fakes) -> None:
        anna = await site(f)
        await admin(SuspendSite, f)(STAFF, anna.id, "спам")

        again = await stored(f, anna.id)
        with pytest.raises(SiteSuspendedError):
            again.publish(f.clock.now(), owner_email_verified=True)
        with pytest.raises(SiteSuspendedError):
            again.unpublish()

    async def test_restore_returns_a_published_site_to_published(self, f: Fakes) -> None:
        anna = await site(f)
        await admin(SuspendSite, f)(STAFF, anna.id, "спам")

        restored = await admin(RestoreSite, f)(STAFF, anna.id)

        assert restored.status == SiteStatus.PUBLISHED
        assert restored.suspension_reason == ""
        assert f.audit.actions == ["site.suspend", "site.restore"]

    async def test_restore_returns_a_draft_to_draft(self, f: Fakes) -> None:
        draft = await site(f, published=False)
        suspend = admin(SuspendSite, f)
        await suspend(STAFF, draft.id, "спам")
        # A second suspension (a new reason) keeps the original status to return to.
        await suspend(STAFF, draft.id, "ещё спам")

        restored = await admin(RestoreSite, f)(STAFF, draft.id)

        assert restored.status == SiteStatus.DRAFT

    async def test_restore_of_a_live_site_changes_nothing(self, f: Fakes) -> None:
        anna = await site(f)

        await admin(RestoreSite, f)(STAFF, anna.id)

        assert f.audit.records == []

    async def test_unknown_site(self, f: Fakes) -> None:
        with pytest.raises(SiteNotFoundError):
            await admin(SuspendSite, f)(STAFF, uuid4(), "спам")


class TestList:
    async def test_search_by_slug_or_title_and_status(self, f: Fakes) -> None:
        await site(f, "anna")
        await site(f, "annette", published=False)
        await site(f, "boris")
        list_sites = admin(ListSites, f)

        found = await list_sites(STAFF, SiteFilter(text="ann"), Paging())
        drafts = await list_sites(STAFF, SiteFilter(status=SiteStatus.DRAFT), Paging())

        assert {str(s.slug) for s in found.items} == {"anna", "annette"}
        assert [str(s.slug) for s in drafts.items] == ["annette"]

    async def test_get(self, f: Fakes) -> None:
        anna = await site(f)

        assert (await admin(GetSite, f)(STAFF, anna.id)).id == anna.id


class TestReservedNames:
    async def test_reserve_list_and_release(self, f: Fakes) -> None:
        await site(f, "shop")
        names = (f.reserved, f.sites, f.uow, f.audit, f.clock)

        added = await ReserveName(*names)(STAFF, "Shop", "  магазины ")
        listed = await ListReservedNames(*names)(STAFF)
        await ReleaseName(*names)(STAFF, "shop")

        assert added.in_use
        assert added.name.reason == "магазины"
        assert ("shop", True) in [(str(n.name.slug), n.in_use) for n in listed]
        assert not await f.reserved.is_reserved(Slug("shop"))
        assert f.audit.actions == ["slug.reserve", "slug.release"]

    async def test_errors(self, f: Fakes) -> None:
        names = (f.reserved, f.sites, f.uow, f.audit, f.clock)
        with pytest.raises(NameAlreadyReservedError):
            await ReserveName(*names)(STAFF, "www", "")
        with pytest.raises(InvalidSlugError):
            await ReserveName(*names)(STAFF, "a", "")
        with pytest.raises(NotFoundError):
            await ReleaseName(*names)(STAFF, "nothing")


class TestDirectory:
    def directory(self, f: Fakes) -> SiteDirectory:
        resolve = ResolveSite(
            sites=f.sites,
            reserved=f.reserved,
            plans=PlanService(f.plans),
            uow=f.uow,
            clock=f.clock,
            cache=f.site_cache,
            config=CONFIG,
            custom_hosts=f.custom_hosts,
        )
        return SiteDirectory(f.sites, resolve, CONFIG)

    async def test_published_at_ignores_drafts_and_suspended(self, f: Fakes) -> None:
        anna = await site(f, "anna")
        await site(f, "boris", published=False)
        gone = await site(f, "gone")
        await admin(SuspendSite, f)(STAFF, gone.id, "спам")
        directory = self.directory(f)

        assert await directory.published_at("ANNA.zxc.ru.net:443") == anna.id
        assert await directory.published_at("boris.zxc.ru.net") is None
        assert await directory.published_at("gone.zxc.ru.net") is None

    async def test_hosts_and_totals(self, f: Fakes) -> None:
        anna = await site(f, "anna")
        await site(f, "boris", published=False)
        directory = self.directory(f)

        assert await directory.hosts({anna.id}) == {anna.id: "anna.zxc.ru.net"}
        totals = await directory.totals()
        assert totals.by_status == {SiteStatus.PUBLISHED: 1, SiteStatus.DRAFT: 1}
        assert [(b.type, b.blocks, b.sites) for b in totals.blocks] == [("hero", 1, 1)]
