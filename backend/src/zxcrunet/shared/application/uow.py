from typing import Protocol


class UnitOfWork(Protocol):
    """One transaction per use case."""

    async def commit(self) -> None: ...

    async def rollback(self) -> None: ...
