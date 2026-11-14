from uuid import UUID, uuid4

import pytest

from tests.fakes import Fakes
from zxcrunet.plans.application.service import PlanService
from zxcrunet.plans.domain.plan import PlanLimitExceededError
from zxcrunet.sites.application.use_cases import (
    Actor,
    AddPage,
    CheckSlug,
    CreateSite,
    DeleteSite,
    GetMySite,
    ListMySites,
    NewPage,
    NewSite,
    PublishSite,
    ResolveSite,
    SiteChanges,
    SitesConfig,
    UnpublishSite,
    UpdateSite,
    _Base,
)
from zxcrunet.sites.domain.errors import (
    EmailNotVerifiedError,
    InvalidSlugError,
    SiteNotFoundError,
    SlugReservedError,
    SlugTakenError,
)
from zxcrunet.sites.domain.site import SiteKind, SiteStatus

CONFIG = SitesConfig(sites_domain="zxc.ru.net")


@pytest.fixture
def fakes() -> Fakes:
    return Fakes()


def build[UC: _Base](cls: type[UC], f: Fakes) -> UC:
    if issubclass(cls, ResolveSite):
        return cls(
            sites=f.sites,
            reserved=f.reserved,
            plans=PlanService(f.plans),
            uow=f.uow,
            clock=f.clock,
            cache=f.site_cache,
            config=CONFIG,
            custom_hosts=f.custom_hosts,
        )
    return cls(
        sites=f.sites,
        reserved=f.reserved,
        plans=PlanService(f.plans),
        uow=f.uow,
        clock=f.clock,
        cache=f.site_cache,
        config=CONFIG,
    )


def actor(user_id: UUID | None = None, *, verified: bool = True) -> Actor:
    return Actor(user_id=user_id or uuid4(), email_verified=verified, plan_code="free")


async def create(f: Fakes, who: Actor, slug: str = "anna") -> UUID:
    site = await build(CreateSite, f)(who, NewSite(SiteKind.BUSINESS, slug, "Анна"))
    return site.id


class TestCreate:
    async def test_creates_draft_for_owner(self, fakes: Fakes) -> None:
        me = actor()
        site_id = await create(fakes, me)

        mine = await build(ListMySites, fakes)(me)

        assert [s.id for s in mine.sites] == [site_id]
        assert mine.max_sites == 3
        assert mine.sites[0].status == SiteStatus.DRAFT

    async def test_plan_limit(self, fakes: Fakes) -> None:
        me = actor()
        for slug in ("one", "two", "three"):
            await create(fakes, me, slug)

        with pytest.raises(PlanLimitExceededError):
            await create(fakes, me, "four")

    async def test_reserved_and_taken_slugs(self, fakes: Fakes) -> None:
        await create(fakes, actor(), "anna")

        with pytest.raises(SlugReservedError):
            await create(fakes, actor(), "admin")
        with pytest.raises(SlugTakenError):
            await create(fakes, actor(), "ANNA")
        with pytest.raises(InvalidSlugError):
            await create(fakes, actor(), "a")


class TestSlugCheck:
    @pytest.mark.parametrize(
        ("slug", "available", "reason"),
        [
            ("free-name", True, None),
            ("anna", False, "slug_taken"),
            ("www", False, "slug_reserved"),
            ("-x-", False, "invalid_slug"),
        ],
    )
    async def test_reasons(
        self, fakes: Fakes, slug: str, available: bool, reason: str | None
    ) -> None:
        await create(fakes, actor(), "anna")

        check = await build(CheckSlug, fakes)(slug)

        assert (check.available, check.reason) == (available, reason)


class TestOwnership:
    async def test_other_users_get_not_found(self, fakes: Fakes) -> None:
        site_id = await create(fakes, actor())

        with pytest.raises(SiteNotFoundError):
            await build(GetMySite, fakes)(actor(), site_id)
        with pytest.raises(SiteNotFoundError):
            await build(DeleteSite, fakes)(actor(), site_id)


class TestPublishAndResolve:
    async def test_draft_is_not_public(self, fakes: Fakes) -> None:
        await create(fakes, actor())

        assert await build(ResolveSite, fakes)("anna.zxc.ru.net") is None

    async def test_published_site_resolves_by_host(self, fakes: Fakes) -> None:
        me = actor()
        site_id = await create(fakes, me)
        await build(PublishSite, fakes)(me, site_id)

        resolved = await build(ResolveSite, fakes)("ANNA.zxc.ru.net:443")

        assert resolved is not None
        assert resolved.status == "published"
        assert resolved.content is not None
        assert resolved.content["title"] == "Анна"
        assert resolved.content["pages"] == [{"path": "", "title": "Анна", "blocks": []}]

    async def test_publish_requires_verified_email(self, fakes: Fakes) -> None:
        me = actor(verified=False)
        site_id = await create(fakes, me)

        with pytest.raises(EmailNotVerifiedError):
            await build(PublishSite, fakes)(me, site_id)

    async def test_cache_is_used_and_invalidated(self, fakes: Fakes) -> None:
        me = actor()
        site_id = await create(fakes, me)
        resolve = build(ResolveSite, fakes)
        assert await resolve("anna.zxc.ru.net") is None
        assert fakes.site_cache.data == {"anna.zxc.ru.net": None}, "a miss is cached too"

        await build(PublishSite, fakes)(me, site_id)
        assert "anna.zxc.ru.net" not in fakes.site_cache.data

        assert (await resolve("anna.zxc.ru.net")) is not None
        await build(UnpublishSite, fakes)(me, site_id)
        assert await resolve("anna.zxc.ru.net") is None

    async def test_rename_moves_the_address(self, fakes: Fakes) -> None:
        me = actor()
        site_id = await create(fakes, me)
        await build(PublishSite, fakes)(me, site_id)
        resolve = build(ResolveSite, fakes)
        await resolve("anna.zxc.ru.net")

        await build(UpdateSite, fakes)(me, site_id, SiteChanges(slug="anna-v"))

        assert await resolve("anna.zxc.ru.net") is None
        assert await resolve("anna-v.zxc.ru.net") is not None

    async def test_suspended_site_resolves_as_suspended(self, fakes: Fakes) -> None:
        me = actor()
        site_id = await create(fakes, me)
        fakes.sites.by_id[site_id].suspend()

        resolved = await build(ResolveSite, fakes)("anna.zxc.ru.net")

        assert resolved is not None
        assert resolved.status == "suspended"
        assert resolved.content is None

    @pytest.mark.parametrize(
        "host", ["zxc.ru.net", "a.b.zxc.ru.net", "anna.example.com", "x.zxc.ru.net"]
    )
    async def test_foreign_or_nested_hosts_do_not_resolve(self, fakes: Fakes, host: str) -> None:
        assert await build(ResolveSite, fakes)(host) is None


class TestEditing:
    async def test_update_theme_seo_and_pages(self, fakes: Fakes) -> None:
        me = actor()
        site_id = await create(fakes, me)

        site = await build(UpdateSite, fakes)(
            me,
            site_id,
            SiteChanges(accent="#FF4F8B", second=None, seo_title="Анна", seo_description="Дизайн"),
        )
        page = await build(AddPage, fakes)(me, site_id, NewPage("about", "Обо мне"))

        assert site.theme.accent == "#ff4f8b"
        assert site.seo_description == "Дизайн"
        assert page.path == "about"
        stored = await build(GetMySite, fakes)(me, site_id)
        assert [p.path for p in stored.pages] == ["", "about"]
