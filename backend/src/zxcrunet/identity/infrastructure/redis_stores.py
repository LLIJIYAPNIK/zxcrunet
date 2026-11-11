import hashlib
import secrets
from uuid import UUID

from redis.asyncio import Redis

from zxcrunet.identity.application.ports import TokenPurpose


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _decode(raw: bytes | str | None) -> UUID | None:
    if raw is None:
        return None
    return UUID(raw.decode() if isinstance(raw, bytes) else raw)


class RedisSessionStore:
    """`sess:<sha256(token)>` → user id, plus `user-sess:<user id>` set for revoking all."""

    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def create(self, user_id: UUID, ttl_seconds: int) -> str:
        token = secrets.token_urlsafe(32)
        key = f"sess:{_digest(token)}"
        index = f"user-sess:{user_id}"
        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.set(key, str(user_id), ex=ttl_seconds)
            pipe.sadd(index, key)
            pipe.expire(index, ttl_seconds)
            await pipe.execute()
        return token

    async def get_user_id(self, token: str) -> UUID | None:
        return _decode(await self._redis.get(f"sess:{_digest(token)}"))

    async def delete(self, token: str) -> None:
        key = f"sess:{_digest(token)}"
        user_id = _decode(await self._redis.getdel(key))
        if user_id is not None:
            await self._redis.srem(f"user-sess:{user_id}", key)

    async def delete_all(self, user_id: UUID) -> None:
        index = f"user-sess:{user_id}"
        keys = await self._redis.smembers(index)
        if keys:
            await self._redis.delete(*keys)
        await self._redis.delete(index)


class RedisOneTimeTokenStore:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def issue(self, purpose: TokenPurpose, user_id: UUID, ttl_seconds: int) -> str:
        token = secrets.token_urlsafe(32)
        await self._redis.set(f"tok:{purpose}:{_digest(token)}", str(user_id), ex=ttl_seconds)
        return token

    async def consume(self, purpose: TokenPurpose, token: str) -> UUID | None:
        return _decode(await self._redis.getdel(f"tok:{purpose}:{_digest(token)}"))
