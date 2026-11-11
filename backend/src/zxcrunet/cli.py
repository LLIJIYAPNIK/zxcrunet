"""Management commands.

uv run python -m zxcrunet.cli create-owner owner@example.com
echo "secret" | uv run python -m zxcrunet.cli create-owner owner@example.com --password-stdin
"""

import argparse
import asyncio
import getpass
import sys

from dishka import Scope

from zxcrunet.identity.application.use_cases import CreateOwner
from zxcrunet.main import make_container
from zxcrunet.shared.config import Settings
from zxcrunet.shared.domain.errors import AppError


async def create_owner(email: str, password: str | None) -> None:
    container = make_container(Settings())
    try:
        async with container(scope=Scope.REQUEST) as request:
            use_case = await request.get(CreateOwner)
            user = await use_case(email, password)
    finally:
        await container.close()
    print(f"Owner ready: {user.email} ({user.id})")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="zxcrunet")
    sub = parser.add_subparsers(dest="command", required=True)
    owner = sub.add_parser("create-owner", help="create the product owner or promote a user")
    owner.add_argument("email")
    owner.add_argument("--password-stdin", action="store_true", help="read password from stdin")
    owner.add_argument(
        "--keep-password", action="store_true", help="promote an existing user, keep the password"
    )
    args = parser.parse_args(argv)

    password: str | None
    if args.keep_password:
        password = None
    elif args.password_stdin:
        password = sys.stdin.readline().rstrip("\n")
    else:
        password = getpass.getpass("Password: ")
    try:
        asyncio.run(create_owner(args.email, password))
    except AppError as exc:
        print(f"Error: {exc.code}: {exc.message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
