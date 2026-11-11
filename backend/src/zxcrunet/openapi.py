"""Print the OpenAPI schema.

uv run python -m zxcrunet.openapi > ../frontend/src/lib/api/openapi.json
"""

import json
import sys

from zxcrunet.main import create_app


def render() -> str:
    return json.dumps(create_app().openapi(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"


if __name__ == "__main__":
    sys.stdout.buffer.write(render().encode("utf-8"))
