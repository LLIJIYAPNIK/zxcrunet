from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from zxcrunet.shared.infrastructure.db import Base


class SiteModel(Base):
    __tablename__ = "sites"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    # Owner lives in the identity context: referenced by id, no ORM relationship.
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    slug: Mapped[str] = mapped_column(String(32), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    theme_accent: Mapped[str] = mapped_column(String(7))
    theme_second: Mapped[str | None] = mapped_column(String(7))
    status: Mapped[str] = mapped_column(String(16))
    seo_title: Mapped[str] = mapped_column(String(70))
    seo_description: Mapped[str] = mapped_column(String(200))
    revision: Mapped[int] = mapped_column(Integer)
    published_revision: Mapped[int | None] = mapped_column(Integer)
    published: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    pages: Mapped[list["PageModel"]] = relationship(
        back_populates="site",
        cascade="all, delete-orphan",
        order_by="PageModel.position",
        lazy="selectin",
    )


class PageModel(Base):
    __tablename__ = "site_pages"
    __table_args__ = (UniqueConstraint("site_id", "path"),)

    id: Mapped[UUID] = mapped_column(primary_key=True)
    site_id: Mapped[UUID] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    path: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column(Integer)
    blocks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)

    site: Mapped[SiteModel] = relationship(back_populates="pages")


class ReservedSlugModel(Base):
    __tablename__ = "reserved_slugs"

    slug: Mapped[str] = mapped_column(String(32), primary_key=True)
    reason: Mapped[str] = mapped_column(String(120))
