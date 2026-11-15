import secrets
from datetime import date, timedelta
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.analytics.domain.views import DailyViews, DayTotal
from zxcrunet.analytics.infrastructure.models import PageViewDailyModel

#: Live counters outlive the day a little, so yesterday can still be flushed.
COUNTER_TTL = timedelta(days=3)
#: The salt of a day is forgotten soon after: hashes cannot be recomputed later.
SALT_TTL = timedelta(days=2)


class SqlViewStats:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def store(self, rows: list[DailyViews]) -> None:
        m = PageViewDailyModel
        query = insert(m).values(
            [
                {"site_id": r.site_id, "day": r.day, "views": r.views, "visitors": r.visitors}
                for r in rows
            ]
        )
        query = query.on_conflict_do_update(
            index_elements=[m.site_id, m.day],
            set_={
                "views": func.greatest(m.views, query.excluded.views),
                "visitors": func.greatest(m.visitors, query.excluded.visitors),
            },
        )
        await self._session.execute(query)

    async def totals(self, since: date) -> list[DayTotal]:
        m = PageViewDailyModel
        rows = await self._session.execute(
            select(m.day, func.sum(m.views), func.sum(m.visitors))
            .where(m.day >= since)
            .group_by(m.day)
            .order_by(m.day)
        )
        return [DayTotal(row[0], int(row[1]), int(row[2])) for row in rows]

    async def for_site(self, site_id: UUID, since: date) -> list[DayTotal]:
        m = PageViewDailyModel
        rows = await self._session.execute(
            select(m.day, m.views, m.visitors)
            .where(m.site_id == site_id, m.day >= since)
            .order_by(m.day)
        )
        return [DayTotal(row[0], int(row[1]), int(row[2])) for row in rows]


def _text(value: object) -> str:
    return value.decode() if isinstance(value, bytes) else str(value)


class RedisViewCounter:
    """Keys per UTC day: `views:<day>:sites` (set of site ids), `views:<day>:<site>`
    (counter), `visitors:<day>:<site>` (HyperLogLog of visitor hashes), `views:<day>:salt`.
    """

    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def salt(self, day: date) -> str:
        key = f"views:{day.isoformat()}:salt"
        candidate = secrets.token_hex(32)
        # The first request of the day sets the salt; every later one reads the same value.
        await self._redis.set(key, candidate, nx=True, ex=SALT_TTL)
        value = await self._redis.get(key)
        return _text(value) if value is not None else candidate

    async def hit(self, day: date, site_id: UUID, visitor: str) -> None:
        stamp = day.isoformat()
        views = f"views:{stamp}:{site_id}"
        visitors = f"visitors:{stamp}:{site_id}"
        sites = f"views:{stamp}:sites"
        async with self._redis.pipeline(transaction=False) as pipe:
            pipe.incr(views)
            pipe.pfadd(visitors, visitor)
            pipe.sadd(sites, str(site_id))
            for key in (views, visitors, sites):
                pipe.expire(key, COUNTER_TTL)
            await pipe.execute()

    async def snapshot(self, day: date) -> list[DailyViews]:
        stamp = day.isoformat()
        members = await self._redis.smembers(f"views:{stamp}:sites")
        ids = sorted(_text(m) for m in members)
        if not ids:
            return []
        async with self._redis.pipeline(transaction=False) as pipe:
            for site in ids:
                pipe.get(f"views:{stamp}:{site}")
                pipe.pfcount(f"visitors:{stamp}:{site}")
            values = await pipe.execute()
        return [
            DailyViews(UUID(site), day, int(values[2 * i] or 0), int(values[2 * i + 1] or 0))
            for i, site in enumerate(ids)
        ]
