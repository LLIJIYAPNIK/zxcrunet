"""In-memory implementations of ports for unit and API tests."""

import copy
import secrets
from collections import defaultdict
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from typing import Literal
from uuid import UUID

from dishka import Provider, Scope, provide

from zxcrunet.analytics.application.use_cases import ViewCounter
from zxcrunet.analytics.domain.repository import ViewStats
from zxcrunet.analytics.domain.views import DailyViews, DayTotal
from zxcrunet.catalog.application.use_cases import CatalogCache, PublicCatalog
from zxcrunet.catalog.domain.catalog import Post, Title, TitleKind
from zxcrunet.catalog.domain.repository import PostRepository, TitleRepository
from zxcrunet.domains.application.use_cases import CheckQueue, DnsResolver, TlsProbe
from zxcrunet.domains.domain.domain import (
    SERVING,
    CustomDomain,
    DnsRecords,
    DomainStatus,
    Hostname,
)
from zxcrunet.domains.domain.errors import DomainTakenError
from zxcrunet.domains.domain.repository import DomainFilter, DomainRepository
from zxcrunet.identity.application.ports import (
    EmailMessage,
    Mailer,
    OneTimeTokenStore,
    PasswordHasher,
    SessionStore,
    TokenPurpose,
)
from zxcrunet.identity.domain.errors import EmailTakenError
from zxcrunet.identity.domain.repository import UserFilter, UserRepository
from zxcrunet.identity.domain.user import Email, User
from zxcrunet.media.application.use_cases import FileStorage, ImageProcessor, ProcessedImage
from zxcrunet.media.domain.media import MediaFile, MediaRepository
from zxcrunet.moderation.domain.report import AuditRecord, Report, ReportStatus
from zxcrunet.moderation.domain.repository import (
    AuditFilter,
    AuditLog,
    ReportFilter,
    ReportRepository,
)
from zxcrunet.plans.domain.plan import FREE_PLAN_CODE, Plan
from zxcrunet.plans.domain.repository import PlanRepository
from zxcrunet.shared.application.admin import AuditEntry, AuditTrail
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.rate_limit import RateLimiter
from zxcrunet.shared.application.uow import UnitOfWork
from zxcrunet.shared.domain.ids import uuid7
from zxcrunet.sites.application.use_cases import ResolvedSite, SiteCache
from zxcrunet.sites.domain.errors import SlugTakenError
from zxcrunet.sites.domain.repository import (
    ReservedName,
    ReservedSlugs,
    SiteFilter,
    SiteRepository,
)
from zxcrunet.sites.domain.site import Site, SiteStatus, Slug

FREE_PLAN = Plan(
    code=FREE_PLAN_CODE,
    title="Бесплатный",
    max_sites=3,
    max_custom_domains=3,
    max_upload_mb=10,
)


class InMemoryUsers:
    def __init__(self) -> None:
        self.by_id: dict[UUID, User] = {}

    async def get(self, user_id: UUID) -> User | None:
        user = self.by_id.get(user_id)
        return replace(user) if user else None

    async def get_by_email(self, email: Email) -> User | None:
        for user in self.by_id.values():
            if user.email == email:
                return replace(user)
        return None

    async def add(self, user: User) -> None:
        if any(u.email == user.email for u in self.by_id.values()):
            raise EmailTakenError("Email is already registered")
        self.by_id[user.id] = replace(user)

    async def save(self, user: User) -> None:
        self.by_id[user.id] = replace(user)

    async def search(self, where: UserFilter, offset: int, limit: int) -> tuple[list[User], int]:
        found = [
            u
            for u in self.by_id.values()
            if (not where.text or where.text in u.email.value)
            and (not where.status or u.status == where.status)
            and (not where.role or u.role == where.role)
            and (not where.plan_code or u.plan_code == where.plan_code)
        ]
        found.sort(key=lambda u: u.created_at, reverse=True)
        return [replace(u) for u in found[offset : offset + limit]], len(found)

    async def emails(self, ids: set[UUID]) -> dict[UUID, str]:
        return {i: self.by_id[i].email.value for i in ids if i in self.by_id}

    async def count(self) -> int:
        return len(self.by_id)

    async def registrations_by_day(self, since: datetime) -> dict[date, int]:
        days: dict[date, int] = defaultdict(int)
        for u in self.by_id.values():
            if u.created_at >= since:
                days[u.created_at.date()] += 1
        return dict(days)


class FakeUoW:
    def __init__(self) -> None:
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        pass


class FakeHasher:
    def hash(self, password: str) -> str:
        return f"hashed:{password}"

    def verify(self, password_hash: str, password: str) -> bool:
        return password_hash == f"hashed:{password}"

    def needs_rehash(self, password_hash: str) -> bool:
        return False


class InMemorySessions:
    def __init__(self) -> None:
        self.tokens: dict[str, UUID] = {}

    async def create(self, user_id: UUID, ttl_seconds: int) -> str:
        token = secrets.token_urlsafe(16)
        self.tokens[token] = user_id
        return token

    async def get_user_id(self, token: str) -> UUID | None:
        return self.tokens.get(token)

    async def delete(self, token: str) -> None:
        self.tokens.pop(token, None)

    async def delete_all(self, user_id: UUID) -> None:
        self.tokens = {t: u for t, u in self.tokens.items() if u != user_id}


class InMemoryTokens:
    def __init__(self) -> None:
        self.tokens: dict[tuple[TokenPurpose, str], UUID] = {}

    async def issue(self, purpose: TokenPurpose, user_id: UUID, ttl_seconds: int) -> str:
        token = secrets.token_urlsafe(16)
        self.tokens[(purpose, token)] = user_id
        return token

    async def consume(self, purpose: TokenPurpose, token: str) -> UUID | None:
        return self.tokens.pop((purpose, token), None)


class CapturingMailer:
    def __init__(self) -> None:
        self.sent: list[EmailMessage] = []

    async def send(self, message: EmailMessage) -> None:
        self.sent.append(message)

    def last_token(self) -> str:
        """Token from the link in the most recent email."""
        return self.sent[-1].text.split("token=")[1].split()[0]


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self.counts: dict[str, int] = defaultdict(int)

    async def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        self.counts[key] += 1
        return self.counts[key] <= limit


class AllowAllRateLimiter:
    async def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        return True


class FixedClock:
    def __init__(self, now: datetime | None = None) -> None:
        self.current = now or datetime(2026, 11, 11, 12, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.current

    def advance(self, **kwargs: float) -> None:
        self.current += timedelta(**kwargs)


class InMemoryPlans:
    def __init__(self) -> None:
        self.by_code: dict[str, Plan] = {FREE_PLAN_CODE: FREE_PLAN}

    async def get(self, code: str) -> Plan | None:
        return self.by_code.get(code)

    async def list(self) -> list[Plan]:
        return sorted(self.by_code.values(), key=lambda p: (p.max_sites, p.code))

    async def add(self, plan: Plan) -> None:
        self.by_code[plan.code] = plan

    async def save(self, plan: Plan) -> None:
        self.by_code[plan.code] = plan


class InMemorySites:
    def __init__(self) -> None:
        self.by_id: dict[UUID, Site] = {}

    async def get(self, site_id: UUID) -> Site | None:
        site = self.by_id.get(site_id)
        return copy.deepcopy(site) if site else None

    async def get_by_slug(self, slug: Slug) -> Site | None:
        for site in self.by_id.values():
            if site.slug == slug:
                return copy.deepcopy(site)
        return None

    async def list_by_owner(self, owner_id: UUID) -> list[Site]:
        return [copy.deepcopy(s) for s in self.by_id.values() if s.owner_id == owner_id]

    async def count_by_owner(self, owner_id: UUID) -> int:
        return sum(1 for s in self.by_id.values() if s.owner_id == owner_id)

    async def slug_exists(self, slug: Slug) -> bool:
        return any(s.slug == slug for s in self.by_id.values())

    async def add(self, site: Site) -> None:
        if await self.slug_exists(site.slug):
            raise SlugTakenError("This address is taken")
        self.by_id[site.id] = copy.deepcopy(site)

    async def save(self, site: Site) -> None:
        self.by_id[site.id] = copy.deepcopy(site)

    async def delete(self, site: Site) -> None:
        self.by_id.pop(site.id, None)

    async def search(self, where: SiteFilter, offset: int, limit: int) -> tuple[list[Site], int]:
        found = [
            s
            for s in self.by_id.values()
            if (not where.text or where.text in s.slug.value or where.text in s.title.lower())
            and (not where.status or s.status == where.status)
            and (not where.kind or s.kind == where.kind)
            and (not where.owner_id or s.owner_id == where.owner_id)
            and (where.ids is None or s.id in where.ids)
        ]
        found.sort(key=lambda s: s.created_at, reverse=True)
        return [copy.deepcopy(s) for s in found[offset : offset + limit]], len(found)

    async def count_by_status(self) -> dict[SiteStatus, int]:
        counts: dict[SiteStatus, int] = defaultdict(int)
        for site in self.by_id.values():
            counts[site.status] += 1
        return dict(counts)

    async def block_usage(self, limit: int) -> list[tuple[str, int, int]]:
        blocks: dict[str, int] = defaultdict(int)
        sites: dict[str, set[UUID]] = defaultdict(set)
        for site in self.by_id.values():
            if site.status != SiteStatus.PUBLISHED or not site.published:
                continue
            for page in site.published["pages"]:
                for block in page["blocks"]:
                    blocks[block["type"]] += 1
                    sites[block["type"]].add(site.id)
        rows = [(t, n, len(sites[t])) for t, n in blocks.items()]
        return sorted(rows, key=lambda r: (-r[1], r[0]))[:limit]


class InMemoryReservedSlugs:
    def __init__(self, names: set[str] | None = None) -> None:
        initial = names if names is not None else {"www", "api", "admin", "app"}
        self.names: dict[str, str] = dict.fromkeys(initial, "")

    async def is_reserved(self, slug: Slug) -> bool:
        return slug.value in self.names

    async def list(self) -> list[ReservedName]:
        return [ReservedName(Slug(n), r) for n, r in sorted(self.names.items())]

    async def add(self, name: ReservedName) -> None:
        self.names[name.slug.value] = name.reason

    async def remove(self, slug: Slug) -> bool:
        return self.names.pop(slug.value, None) is not None


class InMemorySiteCache:
    def __init__(self) -> None:
        self.data: dict[str, ResolvedSite | None] = {}
        self.invalidated: list[str] = []

    async def get(self, host: str) -> ResolvedSite | Literal[False] | None:
        return self.data.get(host, False)

    async def set(self, host: str, value: ResolvedSite | None) -> None:
        self.data[host] = value

    async def invalidate(self, *hosts: str) -> None:
        self.invalidated.extend(hosts)
        for host in hosts:
            self.data.pop(host, None)


class InMemoryMedia:
    def __init__(self) -> None:
        self.by_id: dict[UUID, MediaFile] = {}

    async def add(self, media: MediaFile) -> None:
        self.by_id[media.id] = media

    async def owned_ids(self, owner_id: UUID, ids: set[UUID]) -> set[UUID]:
        return {i for i in ids if i in self.by_id and self.by_id[i].owner_id == owner_id}


class InMemoryStorage:
    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}

    async def save(self, key: str, data: bytes, content_type: str) -> None:
        self.files[key] = data

    def public_url(self, key: str) -> str:
        return f"/media/{key}"


class FakeImageProcessor:
    def to_webp(self, data: bytes, max_side: int) -> ProcessedImage:
        return ProcessedImage(data=b"RIFF0000WEBP" + data[:16], width=640, height=480)


class InMemoryTitles:
    def __init__(self) -> None:
        self.by_id: dict[UUID, Title] = {}

    async def get(self, title_id: UUID) -> Title | None:
        title = self.by_id.get(title_id)
        return copy.deepcopy(title) if title else None

    async def list_by_owner(self, owner_id: UUID) -> list[Title]:
        return [copy.deepcopy(t) for t in self.by_id.values() if t.owner_id == owner_id]

    async def count_by_owner(self, owner_id: UUID) -> int:
        return sum(1 for t in self.by_id.values() if t.owner_id == owner_id)

    async def slug_taken(
        self, owner_id: UUID, kind: TitleKind, slug: str, *, except_id: UUID | None = None
    ) -> bool:
        return any(
            t.owner_id == owner_id and t.kind == kind and t.slug == slug and t.id != except_id
            for t in self.by_id.values()
        )

    async def count_parts(self, series_id: UUID) -> int:
        return sum(1 for t in self.by_id.values() if t.series_id == series_id)

    async def add(self, title: Title) -> None:
        self.by_id[title.id] = copy.deepcopy(title)

    async def save(self, title: Title) -> None:
        self.by_id[title.id] = copy.deepcopy(title)

    async def delete(self, title: Title) -> None:
        self.by_id.pop(title.id, None)
        for other in self.by_id.values():
            if other.series_id == title.id:
                other.series_id = None


class InMemoryPosts:
    def __init__(self) -> None:
        self.by_id: dict[UUID, Post] = {}

    async def get(self, post_id: UUID) -> Post | None:
        post = self.by_id.get(post_id)
        return copy.deepcopy(post) if post else None

    async def list_by_owner(self, owner_id: UUID) -> list[Post]:
        posts = [copy.deepcopy(p) for p in self.by_id.values() if p.owner_id == owner_id]
        return sorted(posts, key=lambda p: (p.published_on, p.created_at), reverse=True)

    async def count_by_owner(self, owner_id: UUID) -> int:
        return sum(1 for p in self.by_id.values() if p.owner_id == owner_id)

    async def add(self, post: Post) -> None:
        self.by_id[post.id] = copy.deepcopy(post)

    async def save(self, post: Post) -> None:
        self.by_id[post.id] = copy.deepcopy(post)

    async def delete(self, post: Post) -> None:
        self.by_id.pop(post.id, None)


class InMemoryCatalogCache:
    def __init__(self) -> None:
        self.data: dict[UUID, PublicCatalog] = {}
        self.invalidated: list[UUID] = []

    async def get(self, owner_id: UUID) -> PublicCatalog | None:
        return self.data.get(owner_id)

    async def set(self, owner_id: UUID, value: PublicCatalog) -> None:
        self.data[owner_id] = value

    async def invalidate(self, owner_id: UUID) -> None:
        self.invalidated.append(owner_id)
        self.data.pop(owner_id, None)


class InMemoryDomains:
    def __init__(self) -> None:
        self.by_id: dict[UUID, CustomDomain] = {}

    async def get(self, domain_id: UUID) -> CustomDomain | None:
        domain = self.by_id.get(domain_id)
        return copy.deepcopy(domain) if domain else None

    async def list_by_site(self, site_id: UUID) -> list[CustomDomain]:
        found = [d for d in self.by_id.values() if d.site_id == site_id]
        return [copy.deepcopy(d) for d in sorted(found, key=lambda d: d.created_at)]

    async def count_by_owner(self, owner_id: UUID) -> int:
        return sum(1 for d in self.by_id.values() if d.owner_id == owner_id)

    async def added_by_owner(self, owner_id: UUID, host: Hostname) -> bool:
        return any(d.owner_id == owner_id and d.host == host for d in self.by_id.values())

    async def claimed(self, host: Hostname, *, except_id: UUID | None = None) -> bool:
        return any(
            d.host == host and d.status in SERVING and d.id != except_id
            for d in self.by_id.values()
        )

    async def serving(self, host: Hostname) -> CustomDomain | None:
        for d in self.by_id.values():
            if d.host == host and d.status in SERVING:
                return copy.deepcopy(d)
        return None

    async def due(self, now: datetime, limit: int) -> list[UUID]:
        due = [d for d in self.by_id.values() if d.next_check_at and d.next_check_at <= now]
        return [d.id for d in sorted(due, key=lambda d: d.next_check_at or now)][:limit]

    async def serving_hosts(self, site_id: UUID) -> list[Hostname]:
        return [d.host for d in self.by_id.values() if d.site_id == site_id and d.is_serving]

    async def search(
        self, where: DomainFilter, offset: int, limit: int
    ) -> tuple[list[CustomDomain], int]:
        found = [
            d
            for d in self.by_id.values()
            if (not where.text or where.text in d.host.value)
            and (not where.status or d.status == where.status)
            and (not where.site_id or d.site_id == where.site_id)
            and (not where.owner_id or d.owner_id == where.owner_id)
        ]
        found.sort(key=lambda d: d.created_at, reverse=True)
        return [copy.deepcopy(d) for d in found[offset : offset + limit]], len(found)

    async def count_by_status(self) -> dict[DomainStatus, int]:
        counts: dict[DomainStatus, int] = defaultdict(int)
        for d in self.by_id.values():
            counts[d.status] += 1
        return dict(counts)

    async def add(self, domain: CustomDomain) -> None:
        self.by_id[domain.id] = copy.deepcopy(domain)

    async def save(self, domain: CustomDomain) -> None:
        if domain.status in SERVING and await self.claimed(domain.host, except_id=domain.id):
            raise DomainTakenError("This domain is attached to another site")
        self.by_id[domain.id] = copy.deepcopy(domain)

    async def delete(self, domain: CustomDomain) -> None:
        self.by_id.pop(domain.id, None)


class FakeDns:
    """Records per host; unknown hosts have none. `fail` makes DNS itself time out."""

    def __init__(self) -> None:
        self.records: dict[str, DnsRecords] = {}
        self.fail = False
        self.lookups: list[str] = []

    def point(self, host: str, token: str, *ips: str) -> None:
        self.records[host] = DnsRecords(txt=(token,), a=ips or ("203.0.113.10",))

    async def lookup(self, host: Hostname) -> DnsRecords:
        self.lookups.append(host.value)
        if self.fail:
            return DnsRecords(error="timeout")
        return self.records.get(host.value, DnsRecords())


class FakeTls:
    def __init__(self) -> None:
        self.issued: set[str] = set()

    async def has_certificate(self, host: Hostname) -> bool:
        return host.value in self.issued


class RecordingCheckQueue:
    def __init__(self) -> None:
        self.queued: list[UUID] = []

    async def enqueue(self, domain_id: UUID) -> None:
        self.queued.append(domain_id)


class FakeCustomHosts:
    """The domains context as the sites context sees it: custom host → site id."""

    def __init__(self) -> None:
        self.sites: dict[str, UUID] = {}

    async def site_at(self, host: str) -> UUID | None:
        return self.sites.get(host)

    async def hosts_of(self, site_id: UUID) -> list[str]:
        return [host for host, owner in self.sites.items() if owner == site_id]


class InMemoryReports:
    def __init__(self) -> None:
        self.by_id: dict[UUID, Report] = {}

    async def get(self, report_id: UUID) -> Report | None:
        report = self.by_id.get(report_id)
        return copy.deepcopy(report) if report else None

    async def search(
        self, where: ReportFilter, offset: int, limit: int
    ) -> tuple[list[Report], int]:
        found = [
            r
            for r in self.by_id.values()
            if (not where.status or r.status == where.status)
            and (not where.site_id or r.site_id == where.site_id)
        ]
        found.sort(key=lambda r: r.created_at, reverse=where.status != ReportStatus.OPEN)
        return [copy.deepcopy(r) for r in found[offset : offset + limit]], len(found)

    async def open_for_site(self, site_id: UUID) -> list[Report]:
        found = [r for r in self.by_id.values() if r.site_id == site_id and r.is_open]
        return [copy.deepcopy(r) for r in found]

    async def count_by_status(self) -> dict[ReportStatus, int]:
        counts: dict[ReportStatus, int] = defaultdict(int)
        for r in self.by_id.values():
            counts[r.status] += 1
        return dict(counts)

    async def add(self, report: Report) -> None:
        self.by_id[report.id] = copy.deepcopy(report)

    async def save(self, report: Report) -> None:
        self.by_id[report.id] = copy.deepcopy(report)


class InMemoryAuditLog:
    """Both the AuditTrail port and the audit log repository."""

    def __init__(self) -> None:
        self.records: list[AuditRecord] = []

    @property
    def actions(self) -> list[str]:
        return [r.action for r in self.records]

    async def record(self, entry: AuditEntry) -> None:
        await self.add(
            AuditRecord(
                id=uuid7(),
                actor_id=entry.actor_id,
                action=entry.action,
                target_type=entry.target_type,
                target_id=entry.target_id,
                at=entry.at,
                details=dict(entry.details),
            )
        )

    async def add(self, record: AuditRecord) -> None:
        self.records.append(record)

    async def search(
        self, where: AuditFilter, offset: int, limit: int
    ) -> tuple[list[AuditRecord], int]:
        found = [
            r
            for r in reversed(self.records)
            if (not where.target_type or r.target_type == where.target_type)
            and (not where.target_id or r.target_id == where.target_id)
            and (not where.actor_id or r.actor_id == where.actor_id)
        ]
        return found[offset : offset + limit], len(found)


class InMemoryViewCounter:
    def __init__(self) -> None:
        self.salts: dict[date, str] = {}
        self.views: dict[tuple[date, UUID], int] = defaultdict(int)
        self.visitors: dict[tuple[date, UUID], set[str]] = defaultdict(set)

    async def salt(self, day: date) -> str:
        return self.salts.setdefault(day, secrets.token_hex(8))

    async def hit(self, day: date, site_id: UUID, visitor: str) -> None:
        self.views[(day, site_id)] += 1
        self.visitors[(day, site_id)].add(visitor)

    async def snapshot(self, day: date) -> list[DailyViews]:
        return [
            DailyViews(site, d, count, len(self.visitors[(d, site)]))
            for (d, site), count in sorted(self.views.items(), key=lambda kv: str(kv[0][1]))
            if d == day
        ]


class InMemoryViewStats:
    def __init__(self) -> None:
        self.rows: dict[tuple[UUID, date], DailyViews] = {}

    async def store(self, rows: list[DailyViews]) -> None:
        for row in rows:
            old = self.rows.get((row.site_id, row.day))
            best = row
            if old is not None:
                best = replace(
                    row, views=max(row.views, old.views), visitors=max(row.visitors, old.visitors)
                )
            self.rows[(row.site_id, row.day)] = best

    async def totals(self, since: date) -> list[DayTotal]:
        days: dict[date, list[int]] = defaultdict(lambda: [0, 0])
        for row in self.rows.values():
            if row.day >= since:
                days[row.day][0] += row.views
                days[row.day][1] += row.visitors
        return [DayTotal(d, v[0], v[1]) for d, v in sorted(days.items())]

    async def for_site(self, site_id: UUID, since: date) -> list[DayTotal]:
        rows = [r for r in self.rows.values() if r.site_id == site_id and r.day >= since]
        return [DayTotal(r.day, r.views, r.visitors) for r in sorted(rows, key=lambda r: r.day)]


class Fakes:
    """One set of shared fakes for a test."""

    def __init__(self) -> None:
        self.users = InMemoryUsers()
        self.uow = FakeUoW()
        self.hasher = FakeHasher()
        self.sessions = InMemorySessions()
        self.tokens = InMemoryTokens()
        self.mailer = CapturingMailer()
        self.limiter = InMemoryRateLimiter()
        self.clock = FixedClock()
        self.plans = InMemoryPlans()
        self.sites = InMemorySites()
        self.reserved = InMemoryReservedSlugs()
        self.site_cache = InMemorySiteCache()
        self.media = InMemoryMedia()
        self.storage = InMemoryStorage()
        self.images = FakeImageProcessor()
        self.titles = InMemoryTitles()
        self.posts = InMemoryPosts()
        self.catalog_cache = InMemoryCatalogCache()
        self.domains = InMemoryDomains()
        self.dns = FakeDns()
        self.tls = FakeTls()
        self.checks = RecordingCheckQueue()
        self.custom_hosts = FakeCustomHosts()
        self.reports = InMemoryReports()
        self.audit = InMemoryAuditLog()
        self.view_counter = InMemoryViewCounter()
        self.view_stats = InMemoryViewStats()


class FakesProvider(Provider):
    """Overrides every port with the in-memory fakes (registered last, so it wins)."""

    scope = Scope.APP

    def __init__(self, fakes: Fakes) -> None:
        super().__init__()
        self.fakes = fakes

    @provide
    def users(self) -> UserRepository:
        return self.fakes.users

    @provide
    def uow(self) -> UnitOfWork:
        return self.fakes.uow

    @provide
    def hasher(self) -> PasswordHasher:
        return self.fakes.hasher

    @provide
    def sessions(self) -> SessionStore:
        return self.fakes.sessions

    @provide
    def tokens(self) -> OneTimeTokenStore:
        return self.fakes.tokens

    @provide
    def mailer(self) -> Mailer:
        return self.fakes.mailer

    @provide
    def limiter(self) -> RateLimiter:
        return self.fakes.limiter

    @provide
    def clock(self) -> Clock:
        return self.fakes.clock

    @provide
    def plans(self) -> PlanRepository:
        return self.fakes.plans

    @provide
    def sites(self) -> SiteRepository:
        return self.fakes.sites

    @provide
    def reserved(self) -> ReservedSlugs:
        return self.fakes.reserved

    @provide
    def site_cache(self) -> SiteCache:
        return self.fakes.site_cache

    @provide
    def media(self) -> MediaRepository:
        return self.fakes.media

    @provide
    def storage(self) -> FileStorage:
        return self.fakes.storage

    @provide
    def images(self) -> ImageProcessor:
        return self.fakes.images

    @provide
    def titles(self) -> TitleRepository:
        return self.fakes.titles

    @provide
    def posts(self) -> PostRepository:
        return self.fakes.posts

    @provide
    def catalog_cache(self) -> CatalogCache:
        return self.fakes.catalog_cache

    @provide
    def domains(self) -> DomainRepository:
        return self.fakes.domains

    @provide
    def dns(self) -> DnsResolver:
        return self.fakes.dns

    @provide
    def tls(self) -> TlsProbe:
        return self.fakes.tls

    @provide
    def checks(self) -> CheckQueue:
        return self.fakes.checks

    @provide
    def reports(self) -> ReportRepository:
        return self.fakes.reports

    @provide
    def audit_trail(self) -> AuditTrail:
        return self.fakes.audit

    @provide
    def audit_log(self) -> AuditLog:
        return self.fakes.audit

    @provide
    def view_counter(self) -> ViewCounter:
        return self.fakes.view_counter

    @provide
    def view_stats(self) -> ViewStats:
        return self.fakes.view_stats
