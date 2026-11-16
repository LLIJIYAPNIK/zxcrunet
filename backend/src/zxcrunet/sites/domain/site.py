"""Site aggregate: a business or personal card with pages, a draft and a published snapshot."""

import re
from dataclasses import dataclass, field, replace
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from zxcrunet.shared.domain.ids import uuid7
from zxcrunet.sites.domain.errors import (
    EmailNotVerifiedError,
    HomePageRequiredError,
    InvalidPagePathError,
    InvalidSlugError,
    InvalidThemeError,
    PageLimitError,
    PageNotFoundError,
    PagePathTakenError,
    SiteNotFoundError,
    SiteSuspendedError,
    TitleRequiredError,
)

SLUG_MIN, SLUG_MAX = 3, 32
SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")
PAGE_PATH_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$")
HEX_RE = re.compile(r"^#[0-9a-f]{6}$")
MAX_PAGES = 20
TITLE_MAX = 120
SEO_TITLE_MAX = 70
SEO_DESCRIPTION_MAX = 200
DEFAULT_ACCENT = "#5ab9fc"
DEFAULT_SECOND = "#ffb545"
SUSPENSION_REASON_MAX = 500

Block = dict[str, Any]
Snapshot = dict[str, Any]


class SiteStyle(StrEnum):
    """The look of a card on top of its palette: fonts, corners, textures, dividers."""

    NEON = "neon"
    GOTHIC = "gothic"


#: Curated fonts with Cyrillic, served by the frontend (mirror: `frontend/src/lib/theme/fonts.ts`).
FONTS: tuple[str, ...] = (
    "onest", "inter", "manrope", "golos", "unbounded", "russo", "dela-gothic", "tektur",
    "cormorant", "playfair", "eb-garamond", "lora", "pt-serif", "old-standard", "yeseva",
    "prata", "ruslan", "monomakh", "rubik-glitch", "rubik-wet-paint", "caveat", "marck",
    "jetbrains", "ibm-plex-mono", "press-start", "pixelify", "poiret",
)  # fmt: skip
#: Fonts readable at body size; display faces are for headings only.
BODY_FONTS: frozenset[str] = frozenset(
    {"onest", "inter", "manrope", "golos", "cormorant", "eb-garamond", "lora", "pt-serif",
     "old-standard", "jetbrains", "ibm-plex-mono"}
)  # fmt: skip


def check_fonts(heading: str, body: str) -> None:
    """Empty means «the style's default»; otherwise a known font (body: a readable one)."""
    if heading and heading not in FONTS:
        raise InvalidThemeError("Unknown font", {"field": "heading_font"})
    if body and body not in BODY_FONTS:
        raise InvalidThemeError("Font is not available for body text", {"field": "body_font"})


class SiteKind(StrEnum):
    BUSINESS = "business"
    PERSONAL = "personal"


class SiteStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    SUSPENDED = "suspended"


@dataclass(frozen=True, slots=True)
class Slug:
    """Subdomain label: `[a-z0-9-]`, 3–32 chars, no hyphen at the ends, no `--`."""

    value: str

    @classmethod
    def parse(cls, raw: str) -> "Slug":
        value = raw.strip().lower()
        if not SLUG_MIN <= len(value) <= SLUG_MAX:
            raise InvalidSlugError(
                "Slug length is out of range",
                {"reason": "length", "min": SLUG_MIN, "max": SLUG_MAX},
            )
        if not SLUG_RE.fullmatch(value) or "--" in value:
            raise InvalidSlugError("Slug has invalid characters", {"reason": "format"})
        return cls(value)

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True, slots=True)
class Theme:
    accent: str = DEFAULT_ACCENT
    second: str | None = DEFAULT_SECOND
    style: SiteStyle = SiteStyle.NEON
    #: Empty: the style's own fonts.
    heading_font: str = ""
    body_font: str = ""

    @classmethod
    def parse(cls, accent: str, second: str | None) -> "Theme":
        values = [accent.lower()] + ([second.lower()] if second else [])
        if not all(HEX_RE.fullmatch(v) for v in values):
            raise InvalidThemeError("Colours must be #rrggbb")
        return cls(accent=values[0], second=values[1] if second else None)

    def with_colors(self, accent: str, second: str | None) -> "Theme":
        colors = Theme.parse(accent, second)
        return replace(self, accent=colors.accent, second=colors.second)

    def with_look(self, style: SiteStyle, heading_font: str, body_font: str) -> "Theme":
        check_fonts(heading_font, body_font)
        return replace(self, style=style, heading_font=heading_font, body_font=body_font)

    def as_dict(self) -> dict[str, Any]:
        return {
            "accent": self.accent,
            "second": self.second,
            "style": self.style.value,
            "heading_font": self.heading_font,
            "body_font": self.body_font,
        }


def _clean_title(raw: str, limit: int, *, allow_empty: bool = False) -> str:
    value = " ".join(raw.split())
    if not value and not allow_empty:
        raise TitleRequiredError("Title is required")
    return value[:limit]


@dataclass(slots=True)
class Page:
    path: str
    title: str
    position: int
    id: UUID = field(default_factory=uuid7)
    blocks: list[Block] = field(default_factory=list)

    @property
    def is_home(self) -> bool:
        return self.path == ""

    @staticmethod
    def parse_path(raw: str) -> str:
        value = raw.strip().strip("/").lower()
        if not PAGE_PATH_RE.fullmatch(value) or "--" in value:
            raise InvalidPagePathError("Page path must be [a-z0-9-], 1–32 chars")
        return value


@dataclass(slots=True)
class Site:
    owner_id: UUID
    kind: SiteKind
    slug: Slug
    title: str
    created_at: datetime
    id: UUID = field(default_factory=uuid7)
    theme: Theme = field(default_factory=Theme)
    status: SiteStatus = SiteStatus.DRAFT
    seo_title: str = ""
    seo_description: str = ""
    updated_at: datetime | None = None
    published_at: datetime | None = None
    revision: int = 1
    published_revision: int | None = None
    published: Snapshot | None = None
    pages: list[Page] = field(default_factory=list)
    #: Set by the product owner when the site is taken down; shown to the site's owner.
    suspension_reason: str = ""
    suspended_at: datetime | None = None
    #: Where `restore` returns the site: published or draft, as it was.
    status_before_suspension: SiteStatus | None = None

    @classmethod
    def create(
        cls, owner_id: UUID, kind: SiteKind, slug: Slug, title: str, now: datetime
    ) -> "Site":
        clean = _clean_title(title, TITLE_MAX)
        site = cls(owner_id=owner_id, kind=kind, slug=slug, title=clean, created_at=now)
        site.updated_at = now
        site.pages.append(Page(path="", title=clean, position=0))
        return site

    # --- access -------------------------------------------------------------

    def ensure_owned_by(self, user_id: UUID) -> None:
        # Somebody else's site looks exactly like a missing one.
        if self.owner_id != user_id:
            raise SiteNotFoundError("Site not found")

    @property
    def has_unpublished_changes(self) -> bool:
        return self.published_revision != self.revision

    # --- editing (every change bumps the draft revision) --------------------

    def _touch(self, now: datetime) -> None:
        self.revision += 1
        self.updated_at = now

    def rename(self, title: str, now: datetime) -> None:
        self.title = _clean_title(title, TITLE_MAX)
        self._touch(now)

    def change_slug(self, slug: Slug, now: datetime) -> None:
        # The address is live immediately: it is not part of the draft.
        self.slug = slug
        self.updated_at = now

    def set_theme(self, theme: Theme, now: datetime) -> None:
        self.theme = theme
        self._touch(now)

    def set_seo(self, title: str, description: str, now: datetime) -> None:
        self.seo_title = _clean_title(title, SEO_TITLE_MAX, allow_empty=True)
        self.seo_description = " ".join(description.split())[:SEO_DESCRIPTION_MAX]
        self._touch(now)

    def page(self, page_id: UUID) -> Page:
        for page in self.pages:
            if page.id == page_id:
                return page
        raise PageNotFoundError("Page not found")

    def add_page(self, raw_path: str, title: str, now: datetime) -> Page:
        if len(self.pages) >= MAX_PAGES:
            raise PageLimitError("Too many pages", {"max": MAX_PAGES})
        path = Page.parse_path(raw_path)
        self._ensure_path_free(path)
        page = Page(path=path, title=_clean_title(title, TITLE_MAX), position=len(self.pages))
        self.pages.append(page)
        self._touch(now)
        return page

    def update_page(
        self, page_id: UUID, now: datetime, *, title: str | None, raw_path: str | None
    ) -> Page:
        page = self.page(page_id)
        if raw_path is not None and not page.is_home:
            path = Page.parse_path(raw_path)
            if path != page.path:
                self._ensure_path_free(path)
                page.path = path
        if title is not None:
            page.title = _clean_title(title, TITLE_MAX)
        self._touch(now)
        return page

    def set_blocks(self, page_id: UUID, blocks: list[Block], now: datetime) -> Page:
        """Replace a page's blocks (already validated by the application layer)."""
        page = self.page(page_id)
        page.blocks = [dict(b) for b in blocks]
        self._touch(now)
        return page

    @property
    def unpublished_changes(self) -> int:
        """Saved edits since the last publish (0 when the public version is current)."""
        if self.published_revision is None:
            return self.revision
        return self.revision - self.published_revision

    def remove_page(self, page_id: UUID, now: datetime) -> None:
        page = self.page(page_id)
        if page.is_home:
            raise HomePageRequiredError("The home page cannot be removed")
        self.pages.remove(page)
        for position, other in enumerate(self.pages):
            other.position = position
        self._touch(now)

    def _ensure_path_free(self, path: str) -> None:
        if any(p.path == path for p in self.pages):
            raise PagePathTakenError("Page path is already used", {"path": path})

    # --- publishing ---------------------------------------------------------

    def snapshot(self) -> Snapshot:
        return {
            "kind": self.kind.value,
            "title": self.title,
            "theme": self.theme.as_dict(),
            "seo": {"title": self.seo_title, "description": self.seo_description},
            "pages": [
                {
                    "path": p.path,
                    "title": p.title,
                    # Hidden blocks never leave the draft.
                    "blocks": [b for b in p.blocks if not b.get("hidden")],
                }
                for p in sorted(self.pages, key=lambda p: p.position)
            ],
        }

    def publish(self, now: datetime, *, owner_email_verified: bool) -> None:
        if self.status == SiteStatus.SUSPENDED:
            raise SiteSuspendedError("Site is suspended")
        if not owner_email_verified:
            raise EmailNotVerifiedError("Confirm your email to publish")
        self.published = self.snapshot()
        self.published_revision = self.revision
        self.published_at = now
        self.status = SiteStatus.PUBLISHED

    def unpublish(self) -> None:
        if self.status == SiteStatus.SUSPENDED:
            raise SiteSuspendedError("Site is suspended")
        self.status = SiteStatus.DRAFT

    @property
    def is_suspended(self) -> bool:
        return self.status == SiteStatus.SUSPENDED

    def suspend(self, reason: str, now: datetime) -> None:
        """Taken down by the product owner: the public address answers «unavailable»."""
        if not self.is_suspended:
            self.status_before_suspension = self.status
        self.status = SiteStatus.SUSPENDED
        self.suspension_reason = " ".join(reason.split())[:SUSPENSION_REASON_MAX]
        self.suspended_at = now

    def restore(self) -> None:
        """Undo `suspend`: back to published (if it was and has a snapshot) or draft."""
        if not self.is_suspended:
            return
        was_published = self.status_before_suspension == SiteStatus.PUBLISHED
        self.status = SiteStatus.PUBLISHED if was_published and self.published else SiteStatus.DRAFT
        self.status_before_suspension = None
        self.suspension_reason = ""
        self.suspended_at = None
