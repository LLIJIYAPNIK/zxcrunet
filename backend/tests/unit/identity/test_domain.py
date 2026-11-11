from datetime import UTC, datetime

import pytest

from zxcrunet.identity.domain.errors import InvalidEmailError, UserBlockedError, WeakPasswordError
from zxcrunet.identity.domain.user import Email, User, UserStatus, validate_password

NOW = datetime(2026, 11, 11, tzinfo=UTC)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  Anna@Example.COM ", "anna@example.com"),
        ("a.b+tag@sub.example.ru", "a.b+tag@sub.example.ru"),
    ],
)
def test_email_is_normalised(raw: str, expected: str) -> None:
    assert Email.parse(raw).value == expected


@pytest.mark.parametrize("raw", ["", "anna", "anna@", "@example.com", "an na@example.com", "a@b.c"])
def test_invalid_email(raw: str) -> None:
    with pytest.raises(InvalidEmailError):
        Email.parse(raw)


@pytest.mark.parametrize("password", ["1234567", "x" * 129, "anna@example.com", "ANNA"])
def test_weak_passwords(password: str) -> None:
    with pytest.raises(WeakPasswordError):
        validate_password(password, Email.parse("anna@example.com"))


def test_good_password() -> None:
    validate_password("correct horse battery", Email.parse("anna@example.com"))


def make_user() -> User:
    return User(email=Email.parse("anna@example.com"), password_hash="h", created_at=NOW)


def test_verify_email_keeps_first_time() -> None:
    user = make_user()
    user.verify_email(NOW)
    user.verify_email(datetime(2027, 1, 1, tzinfo=UTC))

    assert user.email_verified_at == NOW


def test_blocked_user_is_not_active() -> None:
    user = make_user()
    user.status = UserStatus.BLOCKED

    with pytest.raises(UserBlockedError):
        user.ensure_active()


def test_new_user_gets_uuid7_and_free_plan() -> None:
    user = make_user()

    assert user.id.version == 7
    assert user.plan_code == "free"
