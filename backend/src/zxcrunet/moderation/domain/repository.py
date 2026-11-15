from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from zxcrunet.moderation.domain.report import AuditRecord, Report, ReportStatus


@dataclass(frozen=True, slots=True)
class ReportFilter:
    status: ReportStatus | None = None
    site_id: UUID | None = None


@dataclass(frozen=True, slots=True)
class AuditFilter:
    #: `user`, `site`, `domain`, `plan`, `report`, `slug`.
    target_type: str | None = None
    target_id: str | None = None
    actor_id: UUID | None = None


class ReportRepository(Protocol):
    async def get(self, report_id: UUID) -> Report | None: ...

    async def search(
        self, where: ReportFilter, offset: int, limit: int
    ) -> tuple[list[Report], int]:
        """Open reports oldest first (a queue); decided ones newest first."""

    async def open_for_site(self, site_id: UUID) -> list[Report]: ...

    async def count_by_status(self) -> dict[ReportStatus, int]: ...

    async def add(self, report: Report) -> None: ...

    async def save(self, report: Report) -> None: ...


class AuditLog(Protocol):
    async def add(self, record: AuditRecord) -> None: ...

    async def search(
        self, where: AuditFilter, offset: int, limit: int
    ) -> tuple[list[AuditRecord], int]:
        """Newest first."""
