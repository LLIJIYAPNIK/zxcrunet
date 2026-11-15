"""Reports (complaints) about published sites, and the audit log of owner actions."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from zxcrunet.shared.domain.errors import ConflictError, InvalidInputError, NotFoundError
from zxcrunet.shared.domain.ids import uuid7

MESSAGE_MAX = 1000
NOTE_MAX = 500
PATH_MAX = 200


class ReportReason(StrEnum):
    SPAM = "spam"
    FRAUD = "fraud"
    ILLEGAL = "illegal"
    ADULT = "adult"
    HARASSMENT = "harassment"
    COPYRIGHT = "copyright"
    OTHER = "other"


class ReportStatus(StrEnum):
    OPEN = "open"
    #: Action was taken: the site was suspended.
    RESOLVED = "resolved"
    #: Looked at, no violation.
    DISMISSED = "dismissed"


class Decision(StrEnum):
    SUSPEND = "suspend"
    DISMISS = "dismiss"


class ReportNotFoundError(NotFoundError):
    code = "report_not_found"


class ReportClosedError(ConflictError):
    code = "report_closed"


class ReportMessageRequiredError(InvalidInputError):
    """«Other» needs a few words: otherwise there is nothing to check."""

    code = "report_message_required"


def _clean(raw: str, limit: int) -> str:
    # Keep line breaks of a message, squeeze everything else.
    lines = (" ".join(line.split()) for line in raw.strip().splitlines())
    return "\n".join(lines)[:limit]


@dataclass(slots=True)
class Report:
    site_id: UUID
    host: str
    path: str
    reason: ReportReason
    message: str
    created_at: datetime
    id: UUID = field(default_factory=uuid7)
    status: ReportStatus = ReportStatus.OPEN
    decided_at: datetime | None = None
    decided_by: UUID | None = None
    note: str = ""

    @classmethod
    def submit(
        cls,
        site_id: UUID,
        host: str,
        path: str,
        reason: ReportReason,
        message: str,
        now: datetime,
    ) -> "Report":
        text = _clean(message, MESSAGE_MAX)
        if reason == ReportReason.OTHER and not text:
            raise ReportMessageRequiredError("Describe the problem")
        clean_path = "/" + path.strip().lstrip("/")
        return cls(
            site_id=site_id,
            host=host,
            path=clean_path[:PATH_MAX],
            reason=reason,
            message=text,
            created_at=now,
        )

    @property
    def is_open(self) -> bool:
        return self.status == ReportStatus.OPEN

    def decide(self, decision: Decision, by: UUID, note: str, now: datetime) -> None:
        if not self.is_open:
            raise ReportClosedError("The report is already decided")
        self.status = (
            ReportStatus.RESOLVED if decision == Decision.SUSPEND else ReportStatus.DISMISSED
        )
        self.decided_by = by
        self.decided_at = now
        self.note = " ".join(note.split())[:NOTE_MAX]


@dataclass(frozen=True, slots=True)
class AuditRecord:
    """One owner action, as stored in the audit log."""

    id: UUID
    actor_id: UUID
    action: str
    target_type: str
    target_id: str
    at: datetime
    details: dict[str, Any]
