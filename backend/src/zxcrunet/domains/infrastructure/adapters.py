"""Adapters to the other contexts and to the task queue."""

from typing import Protocol
from uuid import UUID

from zxcrunet.sites.application.use_cases import FindOwnedSite, SiteCache


class SitesDirectory:
    def __init__(self, find: FindOwnedSite) -> None:
        self._find = find

    async def ensure_owned(self, user_id: UUID, site_id: UUID) -> None:
        await self._find(user_id, site_id)


class SitesHostCache:
    def __init__(self, cache: SiteCache) -> None:
        self._cache = cache

    async def invalidate(self, host: str) -> None:
        await self._cache.invalidate(host)


class CheckTask(Protocol):
    async def kiq(self, domain_id: str) -> object: ...


class QueuedChecks:
    """Puts a check on the Taskiq queue; the worker runs it."""

    def __init__(self, task: CheckTask) -> None:
        self._task = task

    async def enqueue(self, domain_id: UUID) -> None:
        await self._task.kiq(str(domain_id))
