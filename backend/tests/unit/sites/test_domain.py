from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from zxcrunet.sites.domain.errors import (
    EmailNotVerifiedError,
    HomePageRequiredError,
    InvalidPagePathError,
    InvalidSlugError,
    InvalidThemeError,
    PagePathTakenError,
    SiteNotFoundError,
    SiteSuspendedError,
    TitleRequiredError,
)
from zxcrunet.sites.domain.site import Site, SiteKind, SiteStatus, Slug, Theme

NOW = datetime(2026, 11, 12, tzinfo=UTC)


def make_site(title: str = "Анна Волкова") -> Site:
    return Site.create(uuid4(), SiteKind.BUSINESS, Slug.parse("anna"), title, NOW)


@pytest.mark.parametrize(
    ("raw", "expected"), [("Anna", "anna"), (" a-1 ", "a-1"), ("x" * 32, "x" * 32), ("007", "007")]
)
def test_valid_slugs(raw: str, expected: str) -> None:
    assert Slug.parse(raw).value == expected


@pytest.mark.parametrize(
    ("raw", "reason"),
    [
        ("ab", "length"),
        ("x" * 33, "length"),
        ("-anna", "format"),
        ("anna-", "format"),
        ("an--na", "format"),
        ("xn--80a", "format"),
        ("анна", "format"),
        ("an_na", "format"),
        ("an.na", "format"),
    ],
)
def test_invalid_slugs(raw: str, reason: str) -> None:
    with pytest.raises(InvalidSlugError) as info:
        Slug.parse(raw)
    assert info.value.details["reason"] == reason


def test_new_site_has_home_page_and_is_a_draft() -> None:
    site = make_site("  Анна   Волкова ")

    assert site.title == "Анна Волкова"
    assert site.status == SiteStatus.DRAFT
    assert [p.path for p in site.pages] == [""]
    assert site.has_unpublished_changes


def test_empty_title_is_rejected() -> None:
    with pytest.raises(TitleRequiredError):
        make_site("   ")


def test_theme_requires_hex() -> None:
    assert Theme.parse("#FF4F8B", None) == Theme("#ff4f8b", None)
    with pytest.raises(InvalidThemeError):
        Theme.parse("red", None)


def test_publish_takes_a_snapshot_of_the_draft() -> None:
    site = make_site()
    site.publish(NOW, owner_email_verified=True)

    site.rename("Новое имя", NOW + timedelta(minutes=1))

    assert site.status == SiteStatus.PUBLISHED
    assert site.published is not None
    assert site.published["title"] == "Анна Волкова", (
        "the public version waits for the next publish"
    )
    assert site.has_unpublished_changes
    site.publish(NOW, owner_email_verified=True)
    assert site.published["title"] == "Новое имя"
    assert not site.has_unpublished_changes


def test_publish_needs_verified_email() -> None:
    with pytest.raises(EmailNotVerifiedError):
        make_site().publish(NOW, owner_email_verified=False)


def test_suspended_site_cannot_be_published_or_unpublished() -> None:
    site = make_site()
    site.suspend()

    with pytest.raises(SiteSuspendedError):
        site.publish(NOW, owner_email_verified=True)
    with pytest.raises(SiteSuspendedError):
        site.unpublish()


def test_slug_change_is_live_and_not_a_draft_change() -> None:
    site = make_site()
    site.publish(NOW, owner_email_verified=True)

    site.change_slug(Slug.parse("anna-v"), NOW)

    assert not site.has_unpublished_changes


def test_pages_add_rename_remove() -> None:
    site = make_site()
    about = site.add_page("/About/", "Обо мне", NOW)

    assert about.path == "about"
    with pytest.raises(PagePathTakenError):
        site.add_page("about", "Ещё раз", NOW)
    with pytest.raises(InvalidPagePathError):
        site.add_page("a/b", "Вложенная", NOW)

    site.update_page(about.id, NOW, title="Про меня", raw_path="me")
    assert (about.path, about.title) == ("me", "Про меня")

    site.remove_page(about.id, NOW)
    assert [p.path for p in site.pages] == [""]


def test_home_page_cannot_be_removed_or_moved() -> None:
    site = make_site()
    home = site.pages[0]

    site.update_page(home.id, NOW, title="Главная", raw_path="elsewhere")
    assert home.path == ""
    with pytest.raises(HomePageRequiredError):
        site.remove_page(home.id, NOW)


def test_foreign_site_looks_missing() -> None:
    with pytest.raises(SiteNotFoundError):
        make_site().ensure_owned_by(uuid4())
