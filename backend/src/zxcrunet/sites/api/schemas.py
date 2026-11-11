from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from zxcrunet.sites.application.use_cases import ResolvedSite, SlugCheck
from zxcrunet.sites.domain.site import Page, Site

Kind = Literal["business", "personal"]
Status = Literal["draft", "published", "suspended"]


class CreateSiteIn(BaseModel):
    kind: Kind
    slug: str = Field(max_length=64)
    title: str = Field(max_length=200)


class UpdateSiteIn(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    slug: str | None = Field(default=None, max_length=64)
    accent: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    second: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    seo_title: str | None = Field(default=None, max_length=200)
    seo_description: str | None = Field(default=None, max_length=400)


class CreatePageIn(BaseModel):
    path: str = Field(max_length=64)
    title: str = Field(max_length=200)


class UpdatePageIn(BaseModel):
    path: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, max_length=200)


class ThemeOut(BaseModel):
    accent: str
    second: str | None


class PageOut(BaseModel):
    id: UUID
    path: str
    title: str
    position: int
    blocks_count: int

    @classmethod
    def of(cls, page: Page) -> "PageOut":
        return cls(
            id=page.id,
            path=page.path,
            title=page.title,
            position=page.position,
            blocks_count=len(page.blocks),
        )


class SiteSummaryOut(BaseModel):
    id: UUID
    kind: Kind
    slug: str
    host: str
    title: str
    status: Status
    theme: ThemeOut
    has_unpublished_changes: bool
    created_at: datetime
    updated_at: datetime | None
    published_at: datetime | None

    @classmethod
    def of(cls, site: Site, host: str) -> "SiteSummaryOut":
        return cls(
            id=site.id,
            kind=site.kind.value,
            slug=str(site.slug),
            host=host,
            title=site.title,
            status=site.status.value,
            theme=ThemeOut(accent=site.theme.accent, second=site.theme.second),
            has_unpublished_changes=site.has_unpublished_changes,
            created_at=site.created_at,
            updated_at=site.updated_at,
            published_at=site.published_at,
        )


class SiteOut(SiteSummaryOut):
    seo_title: str
    seo_description: str
    pages: list[PageOut]

    @classmethod
    def of(cls, site: Site, host: str) -> "SiteOut":
        summary = SiteSummaryOut.of(site, host)
        return cls(
            **summary.model_dump(),
            seo_title=site.seo_title,
            seo_description=site.seo_description,
            pages=[PageOut.of(p) for p in sorted(site.pages, key=lambda p: p.position)],
        )


class SitesListOut(BaseModel):
    sites: list[SiteSummaryOut]
    max_sites: int


class SlugCheckOut(BaseModel):
    slug: str
    available: bool
    reason: str | None

    @classmethod
    def of(cls, check: SlugCheck) -> "SlugCheckOut":
        return cls(slug=check.slug, available=check.available, reason=check.reason)


class PublicPageOut(BaseModel):
    path: str
    title: str
    blocks: list[dict[str, Any]]


class PublicSeoOut(BaseModel):
    title: str
    description: str


class PublicContentOut(BaseModel):
    kind: Kind
    title: str
    theme: ThemeOut
    seo: PublicSeoOut
    pages: list[PublicPageOut]


class ResolvedSiteOut(BaseModel):
    status: Literal["published", "suspended"]
    site_id: UUID
    slug: str
    content: PublicContentOut | None

    @classmethod
    def of(cls, resolved: ResolvedSite) -> "ResolvedSiteOut":
        return cls.model_validate(
            {
                "status": resolved.status,
                "site_id": resolved.site_id,
                "slug": resolved.slug,
                "content": resolved.content,
            }
        )
