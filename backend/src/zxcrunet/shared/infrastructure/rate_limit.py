from redis.asyncio import Redis


class RedisRateLimiter:
    """Fixed-window counter: INCR + EXPIRE on the first hit."""

    def __init__(self, redis: Redis, prefix: str = "rl") -> None:
        self._redis = redis
        self._prefix = prefix

    async def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        full_key = f"{self._prefix}:{key}"
        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.incr(full_key)
            pipe.expire(full_key, window_seconds, nx=True)
            count, _ = await pipe.execute()
        return int(count) <= limit
