from typing import Protocol

from zxcrunet.shared.domain.errors import RateLimitedError


class RateLimiter(Protocol):
    async def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        """Count one attempt; return False when `limit` is exceeded within the window."""


async def enforce(limiter: RateLimiter, key: str, limit: int, window_seconds: int) -> None:
    if not await limiter.hit(key, limit, window_seconds):
        raise RateLimitedError(
            "Too many attempts, try again later", {"retry_after_seconds": window_seconds}
        )
