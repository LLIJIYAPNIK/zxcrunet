import os

import pytest

RUN_INTEGRATION = os.environ.get("ZXC_RUN_INTEGRATION") == "1"


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if RUN_INTEGRATION:
        return
    skip = pytest.mark.skip(reason="set ZXC_RUN_INTEGRATION=1 with Postgres and Redis running")
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip)
