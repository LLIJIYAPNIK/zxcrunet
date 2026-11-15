from datetime import date
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column

from zxcrunet.shared.infrastructure.db import Base


class PageViewDailyModel(Base):
    """Views per site and UTC day. No addresses, no hashes: numbers only."""

    __tablename__ = "page_views_daily"
    __table_args__ = (Index("ix_page_views_daily_day", "day"),)

    # Sites live in another context: referenced by id, no ORM relationship.
    site_id: Mapped[UUID] = mapped_column(
        ForeignKey("sites.id", ondelete="CASCADE"), primary_key=True
    )
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    views: Mapped[int] = mapped_column(Integer)
    visitors: Mapped[int] = mapped_column(Integer)
