"""Readiness check: are the service's dependencies reachable."""

import asyncio
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol


class DependencyProbe(Protocol):
    """Port: checks that one external dependency is reachable."""

    name: str

    async def check(self) -> None:
        """Return normally when healthy, raise any exception otherwise."""


@dataclass(frozen=True, slots=True)
class ReadinessReport:
    checks: dict[str, bool]

    @property
    def ready(self) -> bool:
        return all(self.checks.values())


class CheckReadiness:
    def __init__(self, probes: Sequence[DependencyProbe], timeout_seconds: float) -> None:
        self._probes = probes
        self._timeout = timeout_seconds

    async def __call__(self) -> ReadinessReport:
        results = await asyncio.gather(*(self._run(probe) for probe in self._probes))
        return ReadinessReport(
            checks=dict(zip((p.name for p in self._probes), results, strict=True))
        )

    async def _run(self, probe: DependencyProbe) -> bool:
        try:
            async with asyncio.timeout(self._timeout):
                await probe.check()
        except Exception:  # any failure means "not ready"
            return False
        return True
