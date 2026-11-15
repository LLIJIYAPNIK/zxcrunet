"""Custom domain aggregate: proving ownership over DNS, then serving a site over HTTPS.

Statuses: `pending` → `verified` → `active`, with `failed` (no proof within 48 hours)
and `lost` (records gone for three daily checks in a row) as the dead ends.
"""

import ipaddress
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any
from uuid import UUID

from zxcrunet.domains.domain.errors import (
    DomainNotFoundError,
    HostNotAllowedError,
    InvalidHostError,
)
from zxcrunet.shared.domain.ids import uuid7

HOST_MAX = 253
LABEL_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
SCHEME_RE = re.compile(r"^[a-z][a-z0-9+.-]*://")
#: Label of the TXT record that proves ownership: `_zxc-verify.<host>`.
VERIFY_LABEL = "_zxc-verify"

#: How long a new domain is checked before it is given up as `failed`.
VERIFY_WINDOW = timedelta(hours=48)
#: Delays between automatic checks of a pending domain; the last one repeats.
BACKOFF = (
    timedelta(minutes=1),
    timedelta(minutes=2),
    timedelta(minutes=5),
    timedelta(minutes=10),
    timedelta(minutes=30),
    timedelta(hours=1),
    timedelta(hours=2),
)
#: Verified and active domains are re-checked once a day.
RECHECK_INTERVAL = timedelta(days=1)
#: A verified domain waits for its certificate; we look again this often.
TLS_PROBE_INTERVAL = timedelta(minutes=10)
#: Failed daily re-checks in a row before an active domain is `lost`.
MAX_FAILURES = 3


class DomainStatus(StrEnum):
    PENDING = "pending"
    VERIFIED = "verified"
    ACTIVE = "active"
    FAILED = "failed"
    LOST = "lost"


SERVING = frozenset({DomainStatus.VERIFIED, DomainStatus.ACTIVE})


@dataclass(frozen=True, slots=True)
class Hostname:
    """A lower-case ASCII host name (IDN converted to punycode), without a port or path."""

    value: str

    @classmethod
    def parse(cls, raw: str, *, forbidden: tuple[str, ...] = ()) -> "Hostname":
        value = SCHEME_RE.sub("", raw.strip().lower())
        value = value.removesuffix("/").rstrip(".")
        if not value or any(ch in value for ch in "/?#@: "):
            raise InvalidHostError("Enter a domain like example.com", {"reason": "format"})
        try:
            ipaddress.ip_address(value)
        except ValueError:
            pass
        else:
            raise HostNotAllowedError("IP addresses cannot be attached", {"reason": "ip"})
        try:
            value = value.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise InvalidHostError("Domain has invalid characters", {"reason": "format"}) from exc
        labels = value.split(".")
        if (
            len(value) > HOST_MAX
            or len(labels) < 2  # noqa: PLR2004 — a host needs a name and a zone
            or not all(LABEL_RE.fullmatch(label) for label in labels)
            or labels[-1].isdigit()
        ):
            raise InvalidHostError("Enter a domain like example.com", {"reason": "format"})
        for own in forbidden:
            if value == own or value.endswith(f".{own}"):
                raise HostNotAllowedError(
                    "Addresses of the service are attached automatically", {"reason": "service"}
                )
        return cls(value)

    @property
    def is_www(self) -> bool:
        return self.value.startswith("www.") and self.value.count(".") >= 2  # noqa: PLR2004

    @property
    def apex(self) -> str:
        """`www.example.com` → `example.com`; other hosts stay as they are."""
        return self.value.removeprefix("www.") if self.is_www else self.value

    @property
    def verify_name(self) -> str:
        return f"{VERIFY_LABEL}.{self.value}"

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True, slots=True)
class DnsRecords:
    """What the resolver found. `error` is set when DNS itself did not answer."""

    txt: tuple[str, ...] = ()
    a: tuple[str, ...] = ()
    aaaa: tuple[str, ...] = ()
    error: str | None = None


@dataclass(frozen=True, slots=True)
class ServerAddresses:
    """Where custom domains must point: the IPs of our server."""

    ipv4: frozenset[str]
    ipv6: frozenset[str] = frozenset()


@dataclass(frozen=True, slots=True)
class Problem:
    code: str
    details: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {"code": self.code, "details": self.details}


@dataclass(frozen=True, slots=True)
class CheckResult:
    problems: tuple[Problem, ...]

    @property
    def ok(self) -> bool:
        return not self.problems


def evaluate(records: DnsRecords, token: str, server: ServerAddresses) -> CheckResult:
    """Do the records prove ownership and point at our server? Lists every problem."""
    if records.error:
        return CheckResult((Problem("dns_unavailable", {"reason": records.error}),))
    problems: list[Problem] = []
    if not records.txt:
        problems.append(Problem("txt_missing"))
    elif token not in records.txt:
        problems.append(Problem("txt_mismatch", {"found": list(records.txt[:5])}))
    if not records.a:
        problems.append(Problem("a_missing"))
    elif not set(records.a) <= server.ipv4:
        problems.append(Problem("a_wrong", {"found": sorted(set(records.a))[:5]}))
    # An AAAA record pointing elsewhere sends IPv6 visitors (and the CA) to another server.
    if records.aaaa and not set(records.aaaa) <= server.ipv6:
        problems.append(Problem("aaaa_wrong", {"found": sorted(set(records.aaaa))[:5]}))
    return CheckResult(tuple(problems))


def backoff(attempt: int) -> timedelta:
    """Delay after the `attempt`-th failed check (1-based)."""
    return BACKOFF[min(max(attempt, 1), len(BACKOFF)) - 1]


@dataclass(slots=True)
class CustomDomain:
    site_id: UUID
    owner_id: UUID
    host: Hostname
    verification_token: str
    created_at: datetime
    id: UUID = field(default_factory=uuid7)
    status: DomainStatus = DomainStatus.PENDING
    #: Start of the current 48-hour verification window.
    checks_started_at: datetime | None = None
    #: Failed checks in the current window (drives the backoff).
    attempts: int = 0
    #: Failed re-checks in a row of a verified or active domain.
    failures: int = 0
    last_checked_at: datetime | None = None
    problems: list[Problem] = field(default_factory=list)
    next_check_at: datetime | None = None
    verified_at: datetime | None = None
    activated_at: datetime | None = None

    @classmethod
    def create(
        cls, site_id: UUID, owner_id: UUID, host: Hostname, token: str, now: datetime
    ) -> "CustomDomain":
        return cls(
            site_id=site_id,
            owner_id=owner_id,
            host=host,
            verification_token=token,
            created_at=now,
            checks_started_at=now,
            next_check_at=now,
        )

    def ensure_owned_by(self, user_id: UUID) -> None:
        # Somebody else's domain looks exactly like a missing one.
        if self.owner_id != user_id:
            raise DomainNotFoundError("Domain not found")

    @property
    def is_serving(self) -> bool:
        return self.status in SERVING

    @property
    def awaits_certificate(self) -> bool:
        return self.status == DomainStatus.VERIFIED

    def restart(self, now: datetime) -> None:
        """A manual check of a `failed` domain opens a new 48-hour window."""
        if self.status == DomainStatus.FAILED:
            self.status = DomainStatus.PENDING
            self.checks_started_at = now
            self.attempts = 0

    def record_check(self, result: CheckResult, now: datetime, *, host_free: bool = True) -> None:
        """Apply a DNS check. `host_free` is False when another site already owns the host."""
        if result.ok and not host_free:
            result = CheckResult((Problem("domain_taken"),))
        self.last_checked_at = now
        self.problems = list(result.problems)
        if self.status in {DomainStatus.PENDING, DomainStatus.FAILED}:
            self._check_pending(result, now)
        elif self.status in SERVING:
            self._recheck(result, now)
        elif result.ok:  # lost: the records are back
            self._verify(now)

    def _check_pending(self, result: CheckResult, now: datetime) -> None:
        if result.ok:
            self._verify(now)
            return
        if self.status == DomainStatus.FAILED:
            return
        self.attempts += 1
        started = self.checks_started_at or self.created_at
        if now - started >= VERIFY_WINDOW:
            self.status = DomainStatus.FAILED
            self.next_check_at = None
        else:
            self.next_check_at = now + backoff(self.attempts)

    def _recheck(self, result: CheckResult, now: datetime) -> None:
        if result.ok:
            self.failures = 0
            self.next_check_at = now + (
                TLS_PROBE_INTERVAL if self.awaits_certificate else RECHECK_INTERVAL
            )
            return
        self.failures += 1
        if self.failures >= MAX_FAILURES:
            self.status = DomainStatus.LOST
            self.next_check_at = None
        else:
            self.next_check_at = now + RECHECK_INTERVAL

    def _verify(self, now: datetime) -> None:
        self.status = DomainStatus.VERIFIED
        self.verified_at = now
        self.attempts = 0
        self.failures = 0
        # Ask for the certificate right away.
        self.next_check_at = now

    def certificate_issued(self, now: datetime) -> None:
        if self.status == DomainStatus.VERIFIED:
            self.status = DomainStatus.ACTIVE
            self.activated_at = now
            self.next_check_at = now + RECHECK_INTERVAL

    def certificate_pending(self, now: datetime) -> None:
        if self.status == DomainStatus.VERIFIED:
            self.next_check_at = now + TLS_PROBE_INTERVAL
