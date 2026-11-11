"""Expected errors. The API layer maps each kind to an HTTP status."""

from typing import Any


class AppError(Exception):
    """Base class for expected errors that are reported to API clients."""

    code: str = "app_error"

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class InvalidInputError(AppError):
    code = "invalid_input"


class NotAuthenticatedError(AppError):
    code = "not_authenticated"


class ForbiddenError(AppError):
    code = "forbidden"


class NotFoundError(AppError):
    code = "not_found"


class ConflictError(AppError):
    code = "conflict"


class RateLimitedError(AppError):
    code = "rate_limited"
