from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from zxcrunet.shared.infrastructure.db import Base


class CustomDomainModel(Base):
    __tablename__ = "custom_domains"
    __table_args__ = (
        UniqueConstraint("owner_id", "host", name="uq_custom_domains_owner_host"),
        # One host serves one site in the whole system; pending claims may compete.
        Index(
            "uq_custom_domains_serving_host",
            "host",
            unique=True,
            postgresql_where=text("status IN ('verified', 'active')"),
        ),
        Index("ix_custom_domains_next_check_at", "next_check_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    # Sites and users live in other contexts: referenced by id, no ORM relationship.
    site_id: Mapped[UUID] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    host: Mapped[str] = mapped_column(String(253))
    verification_token: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    checks_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer)
    failures: Mapped[int] = mapped_column(Integer)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    problems: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    next_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
