from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from zxcrunet.domains.application.use_cases import SiteDomains
from zxcrunet.domains.domain.domain import CustomDomain, ServerAddresses

Status = Literal["pending", "verified", "active", "failed", "lost"]


class AddDomainIn(BaseModel):
    host: str = Field(max_length=300)


class RecordOut(BaseModel):
    """A DNS record the owner has to create at their registrar."""

    type: Literal["TXT", "A", "AAAA", "CNAME"]
    #: Full name; many registrars want only the part before the domain (`@`, `www`).
    name: str
    value: str


class ProblemOut(BaseModel):
    code: str
    details: dict[str, Any]


class DomainOut(BaseModel):
    id: UUID
    site_id: UUID
    host: str
    status: Status
    records: list[RecordOut]
    problems: list[ProblemOut]
    created_at: datetime
    last_checked_at: datetime | None
    next_check_at: datetime | None
    verified_at: datetime | None
    activated_at: datetime | None

    @classmethod
    def of(cls, domain: CustomDomain, server: ServerAddresses) -> "DomainOut":
        host = domain.host
        records = [RecordOut(type="TXT", name=host.verify_name, value=domain.verification_token)]
        if host.is_www:
            records.append(RecordOut(type="CNAME", name=host.value, value=host.apex))
        else:
            records += [
                RecordOut(type="A", name=host.value, value=ip) for ip in sorted(server.ipv4)
            ]
            records += [
                RecordOut(type="AAAA", name=host.value, value=ip) for ip in sorted(server.ipv6)
            ]
        return cls(
            id=domain.id,
            site_id=domain.site_id,
            host=host.value,
            status=domain.status.value,
            records=records,
            problems=[ProblemOut(code=p.code, details=p.details) for p in domain.problems],
            created_at=domain.created_at,
            last_checked_at=domain.last_checked_at,
            next_check_at=domain.next_check_at,
            verified_at=domain.verified_at,
            activated_at=domain.activated_at,
        )


class ServerOut(BaseModel):
    ipv4: list[str]
    ipv6: list[str]


class SiteDomainsOut(BaseModel):
    domains: list[DomainOut]
    used: int
    max_domains: int
    server: ServerOut

    @classmethod
    def of(cls, result: SiteDomains) -> "SiteDomainsOut":
        return cls(
            domains=[DomainOut.of(d, result.server) for d in result.domains],
            used=result.used,
            max_domains=result.max_domains,
            server=ServerOut(ipv4=sorted(result.server.ipv4), ipv6=sorted(result.server.ipv6)),
        )
