import asyncio


class FakeProbe:
    def __init__(self, name: str, *, fails: bool = False, hangs: bool = False) -> None:
        self.name = name
        self._fails = fails
        self._hangs = hangs

    async def check(self) -> None:
        if self._hangs:
            await asyncio.sleep(10)
        if self._fails:
            raise ConnectionError(self.name)
