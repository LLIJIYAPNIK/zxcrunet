"""Owner (admin panel) use cases of the domains context: list, confirm, revoke."""

from uuid import UUID

from zxcrunet.domains.application.use_cases import HostCache
from zxcrunet.domains.domain.domain import CustomDomain, DomainStatus
from zxcrunet.domains.domain.errors import DomainNotFoundError, DomainTakenError
from zxcrunet.domains.domain.repository import DomainFilter, DomainRepository
from zxcrunet.shared.application.admin import AuditEntry, AuditTrail, Paging, Slice, Staff
from zxcrunet.shared.application.clock import Clock
from zxcrunet.shared.application.uow import UnitOfWork

REASON_MAX = 500


class _Admin:
    def __init__(
        self,
        domains: DomainRepository,
        uow: UnitOfWork,
        audit: AuditTrail,
        clock: Clock,
        cache: HostCache,
    ) -> None:
        self.domains = domains
        self.uow = uow
        self.audit = audit
        self.clock = clock
        self.cache = cache

    async def _domain(self, domain_id: UUID) -> CustomDomain:
        domain = await self.domains.get(domain_id)
        if domain is None:
            raise DomainNotFoundError("Domain not found")
        return domain

    async def _record(
        self, staff: Staff, action: str, domain: CustomDomain, **details: object
    ) -> None:
        await self.audit.record(
            AuditEntry(
                actor_id=staff.user_id,
                action=action,
                target_type="domain",
                target_id=str(domain.id),
                at=self.clock.now(),
                details={"host": str(domain.host), "site_id": str(domain.site_id), **details},
            )
        )


class ListDomains(_Admin):
    async def __call__(self, _: Staff, where: DomainFilter, paging: Paging) -> Slice[CustomDomain]:
        items, total = await self.domains.search(where, paging.offset, paging.limit)
        return Slice(items, total)


class ConfirmDomain(_Admin):
    """Make a domain `verified` without the DNS proof (the owner checked it by hand)."""

    async def __call__(self, staff: Staff, domain_id: UUID) -> CustomDomain:
        domain = await self._domain(domain_id)
        if domain.is_serving:
            return domain
        if await self.domains.claimed(domain.host, except_id=domain.id):
            raise DomainTakenError(
                "This domain is attached to another site", {"host": str(domain.host)}
            )
        previous = domain.status
        domain.confirm(self.clock.now())
        await self.domains.save(domain)
        await self._record(staff, "domain.confirm", domain, previous=previous.value)
        await self.uow.commit()
        await self.cache.invalidate(str(domain.host))
        return domain


class RevokeDomain(_Admin):
    """Stop serving a domain for good; its owner can only remove it."""

    async def __call__(self, staff: Staff, domain_id: UUID, reason: str) -> CustomDomain:
        domain = await self._domain(domain_id)
        if domain.is_revoked:
            return domain
        was_serving = domain.is_serving
        previous = domain.status
        domain.revoke(self.clock.now())
        await self.domains.save(domain)
        await self._record(
            staff,
            "domain.revoke",
            domain,
            previous=previous.value,
            reason=" ".join(reason.split())[:REASON_MAX],
        )
        await self.uow.commit()
        if was_serving:
            await self.cache.invalidate(str(domain.host))
        return domain


class DomainTotals:
    """For the dashboard: domains by status."""

    def __init__(self, domains: DomainRepository) -> None:
        self.domains = domains

    async def __call__(self) -> dict[DomainStatus, int]:
        return await self.domains.count_by_status()
