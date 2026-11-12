from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from zxcrunet.shared.infrastructure.db import Base


class TitleModel(Base):
    __tablename__ = "catalog_titles"
    __table_args__ = (UniqueConstraint("owner_id", "kind", "slug"),)

    id: Mapped[UUID] = mapped_column(primary_key=True)
    # Owner lives in the identity context: referenced by id, no ORM relationship.
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(64))
    year: Mapped[int | None] = mapped_column(Integer)
    year_end: Mapped[int | None] = mapped_column(Integer)
    creator: Mapped[str] = mapped_column(String(80))
    genres: Mapped[list[str]] = mapped_column(JSONB)
    description: Mapped[str] = mapped_column(String(1200))
    cover: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    is_series: Mapped[bool] = mapped_column(Boolean)
    series_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("catalog_titles.id", ondelete="SET NULL"), index=True
    )
    part_label: Mapped[str] = mapped_column(String(24))
    position: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(16))
    external_id: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    entry: Mapped["ShelfEntryModel | None"] = relationship(
        back_populates="title", cascade="all, delete-orphan", lazy="selectin", uselist=False
    )


class ShelfEntryModel(Base):
    __tablename__ = "shelf_entries"
    __table_args__ = (UniqueConstraint("owner_id", "title_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title_id: Mapped[UUID] = mapped_column(
        ForeignKey("catalog_titles.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(16))
    rating: Mapped[int | None] = mapped_column(Integer)
    hours: Mapped[int | None] = mapped_column(Integer)
    progress: Mapped[int | None] = mapped_column(Integer)
    progress_total: Mapped[int | None] = mapped_column(Integer)
    favorite: Mapped[bool] = mapped_column(Boolean)
    started_on: Mapped[date | None] = mapped_column(Date)
    finished_on: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(String(2000))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB)

    title: Mapped[TitleModel] = relationship(back_populates="entry")


class PostModel(Base):
    __tablename__ = "catalog_posts"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    heading: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    title_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("catalog_titles.id", ondelete="SET NULL"), index=True
    )
    published_on: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
