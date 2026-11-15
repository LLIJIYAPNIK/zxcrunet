from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from zxcrunet.shared.infrastructure.db import Base


class ReportModel(Base):
    __tablename__ = "reports"
    __table_args__ = (Index("ix_reports_status_created_at", "status", "created_at"),)

    id: Mapped[UUID] = mapped_column(primary_key=True)
    # Sites live in another context: referenced by id, no ORM relationship.
    site_id: Mapped[UUID] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    host: Mapped[str] = mapped_column(String(253))
    path: Mapped[str] = mapped_column(String(200))
    reason: Mapped[str] = mapped_column(String(16))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    note: Mapped[str] = mapped_column(String(500))


class AuditLogModel(Base):
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_log_at", "at"),
        Index("ix_audit_log_target", "target_type", "target_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    # No foreign key: the log outlives the users and objects it mentions.
    actor_id: Mapped[UUID] = mapped_column(index=True)
    action: Mapped[str] = mapped_column(String(64))
    target_type: Mapped[str] = mapped_column(String(16))
    target_id: Mapped[str] = mapped_column(String(253))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB)
