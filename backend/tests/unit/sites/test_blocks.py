from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import pytest

from zxcrunet.sites.application.blocks import (
    MAX_BLOCKS_PER_PAGE,
    BlockIn,
    InvalidBlockError,
    media_ids,
    validate_blocks,
)
from zxcrunet.sites.domain.site import Site, SiteKind, Slug

NOW = datetime(2026, 11, 12, tzinfo=UTC)


def block(type_: str, settings: dict[str, Any], **extra: Any) -> BlockIn:
    return BlockIn(id=uuid4(), type=type_, settings=settings, **extra)


HERO = {
    "label": "Backend · Python",
    "title": "  Анна Волкова, продуктовый дизайнер ",
    "primary": {"label": "Написать", "url": "https://t.me/anna"},
    "chips": ["Figma"],
}


def test_valid_blocks_are_normalised() -> None:
    [hero] = validate_blocks([block("hero", HERO)])

    assert hero["type"] == "hero"
    assert hero["version"] == 1
    assert hero["hidden"] is False
    assert hero["settings"]["title"] == "Анна Волкова, продуктовый дизайнер"
    assert hero["settings"]["secondary"] is None


@pytest.mark.parametrize(
    "url",
    ["javascript:alert(1)", "data:text/html,x", "//evil.example", "https://a b", "vbscript:x"],
)
def test_unsafe_links_are_rejected(url: str) -> None:
    with pytest.raises(InvalidBlockError) as info:
        validate_blocks([block("hero", {**HERO, "primary": {"label": "x", "url": url}})])

    assert info.value.details["index"] == 0
    assert info.value.details["errors"][0]["loc"][:2] == ["primary", "url"]


@pytest.mark.parametrize(
    "url",
    [
        "https://github.com/anna",
        "mailto:anna@example.com",
        "tel:+79990000000",
        "tg://resolve?domain=a",
        "#b-1",
    ],
)
def test_safe_links(url: str) -> None:
    validate_blocks([block("hero", {**HERO, "primary": {"label": "x", "url": url}})])


def test_unknown_fields_and_missing_required_fail() -> None:
    with pytest.raises(InvalidBlockError):
        validate_blocks([block("hero", {**HERO, "html": "<script>"})])
    with pytest.raises(InvalidBlockError):
        validate_blocks([block("facts", {"items": []})])


def test_unknown_version_and_duplicates() -> None:
    with pytest.raises(InvalidBlockError, match="version"):
        validate_blocks([block("hero", HERO, version=9)])
    same = block("hero", HERO)
    with pytest.raises(InvalidBlockError, match="unique"):
        validate_blocks([same, same])


def test_block_count_limit() -> None:
    blocks = [block("interests", {"items": ["a"]}) for _ in range(MAX_BLOCKS_PER_PAGE + 1)]

    with pytest.raises(InvalidBlockError, match="Too many"):
        validate_blocks(blocks)


def test_media_ids_are_found_anywhere() -> None:
    avatar, resume = uuid4(), uuid4()
    blocks = validate_blocks(
        [
            block("hero", {**HERO, "avatar": {"id": str(avatar), "url": "/media/2026/11/a.webp"}}),
            block("resume", {"label": "PDF", "file": {"id": str(resume), "url": "/media/r.pdf"}}),
        ]
    )

    assert media_ids(blocks) == {avatar, resume}


def test_media_url_must_be_local() -> None:
    with pytest.raises(InvalidBlockError):
        validate_blocks(
            [block("resume", {"label": "PDF", "file": {"id": str(uuid4()), "url": "https://x"}})]
        )


def test_snapshot_drops_hidden_blocks_and_counts_changes() -> None:
    site = Site.create(uuid4(), SiteKind.BUSINESS, Slug.parse("anna"), "Анна", NOW)
    home = site.pages[0]
    blocks = validate_blocks(
        [block("hero", HERO), block("interests", {"items": ["DDD"]}, hidden=True)]
    )

    site.set_blocks(home.id, blocks, NOW)
    site.publish(NOW, owner_email_verified=True)

    assert [b["type"] for b in site.published["pages"][0]["blocks"]] == ["hero"]  # type: ignore[index]
    assert site.unpublished_changes == 0
    site.set_blocks(home.id, blocks[:1], NOW)
    site.rename("Анна В.", NOW)
    assert site.unpublished_changes == 2


CONTACTS: dict[str, Any] = {
    "title": "Пишите",
    "items": [
        {"kind": "telegram", "label": "Telegram", "value": "@sasha", "url": "https://t.me/sasha"}
    ],
}

PERSONAL: dict[str, dict[str, Any]] = {
    "profile": {"title": "Саша Кулебякин: игры, книги и сериалы", "mood": "Дочитываю Канемана"},
    "now": {},
    "shelf": {"kind": "game", "style": "bento", "controls": True},
    "characters": {"title": "Мои персонажи"},
    "top": {"items": [str(uuid4())]},
    "challenge": {"year": 2026, "goal": 15},
    "quotes": {"items": [{"text": "Ничто в жизни не важно настолько…", "source": "Канеман"}]},
    "playlist": {"items": [{"track": "Firelink Shrine", "url": "https://music.example/x"}]},
    "posts": {"kind": "review"},
}


@pytest.mark.parametrize("type_", sorted(PERSONAL))
def test_personal_blocks_validate_on_personal_sites(type_: str) -> None:
    (stored,) = validate_blocks([block(type_, PERSONAL[type_])], "personal")

    assert stored["type"] == type_


def test_personal_blocks_are_not_for_business_sites() -> None:
    with pytest.raises(InvalidBlockError, match="not available"):
        validate_blocks([block("shelf", PERSONAL["shelf"])], "business")
    with pytest.raises(InvalidBlockError, match="not available"):
        validate_blocks([block("facts", {"items": [{"value": "1", "label": "x"}]})], "personal")
    # Shared blocks work everywhere.
    validate_blocks([block("contacts", CONTACTS)], "personal")


@pytest.mark.parametrize(
    ("type_", "settings"),
    [
        ("shelf", {"kind": "music"}),
        ("now", {"limit": 7}),
        ("top", {"items": []}),
        ("challenge", {"year": 2026, "goal": 0}),
        ("playlist", {"items": [{"track": "x", "url": "javascript:alert(1)"}]}),
    ],
)
def test_personal_blocks_reject_bad_settings(type_: str, settings: dict[str, Any]) -> None:
    with pytest.raises(InvalidBlockError):
        validate_blocks([block(type_, settings)], "personal")
