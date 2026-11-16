from datetime import UTC, datetime
from typing import Any, get_args
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from zxcrunet.sites.application.blocks import (
    MAX_BLOCKS_PER_PAGE,
    BlockIn,
    BodyFontId,
    FontId,
    InvalidBlockError,
    media_ids,
    validate_blocks,
)
from zxcrunet.sites.domain.site import BODY_FONTS, FONTS, Site, SiteKind, Slug

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
    assert hero["settings"]["pattern"] == "rings"


def test_card_and_cover_patterns() -> None:
    [hero] = validate_blocks([block("hero", {**HERO, "pattern": "circuit"})])
    [profile] = validate_blocks([block("profile", {"title": "Обо мне"})], "personal")

    assert hero["settings"]["pattern"] == "circuit"
    assert profile["settings"]["pattern"] == "glow"
    with pytest.raises(InvalidBlockError):
        validate_blocks([block("hero", {**HERO, "pattern": "url(javascript:x)"})])


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


def test_facts_take_up_to_ten_items() -> None:
    fact = {"value": "1", "label": "x"}
    (stored,) = validate_blocks([block("facts", {"items": [fact] * 10})], "business")

    assert len(stored["settings"]["items"]) == 10
    with pytest.raises(InvalidBlockError):
        validate_blocks([block("facts", {"items": [fact] * 11})])


def test_stack_skills_with_grade_and_level() -> None:
    skills = [
        {"name": " Python ", "grade": "senior", "level": 90, "note": "8 лет"},
        {"name": "Go"},
    ]
    (stored,) = validate_blocks([block("stack", {"items": skills})], "business")

    python, go = stored["settings"]["items"]
    assert python == {"name": "Python", "grade": "senior", "level": 90, "note": "8 лет"}
    assert go == {"name": "Go", "grade": "", "level": 0, "note": ""}


@pytest.mark.parametrize(
    "skill",
    [{"name": "Python", "grade": "god"}, {"name": "Python", "level": 101}, {"name": " "}],
)
def test_stack_rejects_bad_skills(skill: dict[str, Any]) -> None:
    with pytest.raises(InvalidBlockError):
        validate_blocks([block("stack", {"items": [skill]})])


def test_stack_is_business_only() -> None:
    with pytest.raises(InvalidBlockError, match="not available"):
        validate_blocks([block("stack", {"items": [{"name": "Python"}]})], "personal")


def test_fonts_mirror_the_domain() -> None:
    assert get_args(FontId) == FONTS
    assert set(get_args(BodyFontId)) == BODY_FONTS


def test_appearance_is_stored_only_when_set() -> None:
    cover = uuid4()
    plain, styled = validate_blocks(
        [
            block("hero", HERO, appearance={}),
            block(
                "facts",
                {"items": [{"value": "8", "label": "лет"}]},
                appearance={
                    "background": "image",
                    "image": {"id": str(cover), "url": "/media/2026/11/c.webp"},
                    "dim": 60,
                    "color": "#AABBCC",
                    "divider": "ornament",
                    "heading_font": "ruslan",
                    "body_font": "lora",
                },
            ),
        ]
    )

    assert "appearance" not in plain
    assert styled["appearance"]["background"] == "image"
    assert styled["appearance"]["color"] == "#aabbcc"
    assert styled["appearance"]["space"] == "none"
    assert media_ids([plain, styled]) == {cover}


@pytest.mark.parametrize(
    "appearance",
    [
        {"background": "hologram"},
        {"color": "red"},
        {"dim": 95},
        {"angle": 400},
        {"heading_font": "comic-sans"},
        {"body_font": "ruslan"},
        {"extra": 1},
    ],
)
def test_bad_appearance_is_rejected(appearance: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        block("hero", HERO, appearance=appearance)


VIDEO_FILE = {"id": "0195f3a0-0000-7000-8000-000000000001", "url": "/media/2026/11/a.mp4"}
PICTURE = {"id": "0195f3a0-0000-7000-8000-000000000002", "url": "/media/2026/11/b.webp"}


@pytest.mark.parametrize(
    "embed",
    [
        {"provider": "youtube", "id": "dQw4w9WgXcQ"},
        {"provider": "vk", "id": "-22822305_456241864", "hash": "a1b2c3d4e5f6"},
        {"provider": "rutube", "id": "c6cc4d620b1d4338901770a44b3e82f4"},
    ],
)
def test_video_embeds_by_provider_and_id(embed: dict[str, str]) -> None:
    [video] = validate_blocks([block("video", {"embed": embed})], "personal")

    assert video["settings"]["embed"]["id"] == embed["id"]
    assert video["settings"]["source"] == "embed"


@pytest.mark.parametrize(
    "embed",
    [
        {"provider": "youtube", "id": "https://youtu.be/dQw4w9WgXcQ"},
        {"provider": "youtube", "id": "dQw4w9WgXc'"},
        {"provider": "vk", "id": "video-1_2"},
        {"provider": "rutube", "id": "C6CC4D620B1D4338901770A44B3E82F4"},
        {"provider": "vimeo", "id": "123"},
        {"provider": "vk", "id": "-1_2", "hash": "zz"},
    ],
)
def test_video_embeds_reject_anything_but_ids(embed: dict[str, str]) -> None:
    with pytest.raises(InvalidBlockError):
        validate_blocks([block("video", {"embed": embed})])


def test_uploaded_video_must_be_a_clip() -> None:
    [video] = validate_blocks(
        [block("video", {"source": "file", "file": VIDEO_FILE, "mode": "loop", "aspect": "9:16"})]
    )
    assert video["settings"]["file"]["url"].endswith(".mp4")
    assert media_ids([video]) == {UUID(VIDEO_FILE["id"])}
    with pytest.raises(InvalidBlockError):
        validate_blocks([block("video", {"source": "file", "file": PICTURE})])


def test_carousel_with_pictures_and_clips() -> None:
    [carousel] = validate_blocks(
        [
            block(
                "carousel",
                {
                    "items": [
                        {"media": PICTURE, "alt": "Закат"},
                        {"media": VIDEO_FILE, "link": {"label": "", "url": "https://x.example"}},
                    ],
                    "mode": "marquee",
                    "speed": 30,
                    "direction": "right",
                },
            )
        ],
        "business",
    )

    assert carousel["settings"]["autoplay"] is True
    assert len(carousel["settings"]["items"]) == 2
    for bad in ({"interval": 1}, {"speed": 500}, {"items": [{"media": PICTURE}] * 31}):
        with pytest.raises(InvalidBlockError):
            validate_blocks([block("carousel", bad)])


def test_video_background_takes_a_clip() -> None:
    [hero] = validate_blocks(
        [block("hero", HERO, appearance={"background": "video", "video": VIDEO_FILE})]
    )
    assert hero["appearance"]["video"]["url"] == VIDEO_FILE["url"]
    with pytest.raises(ValidationError):
        block("hero", HERO, appearance={"background": "video", "video": PICTURE})
