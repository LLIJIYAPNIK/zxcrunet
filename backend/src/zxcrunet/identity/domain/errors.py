from zxcrunet.shared.domain.errors import (
    ConflictError,
    ForbiddenError,
    InvalidInputError,
    NotAuthenticatedError,
)


class InvalidEmailError(InvalidInputError):
    code = "invalid_email"


class WeakPasswordError(InvalidInputError):
    code = "weak_password"


class EmailTakenError(ConflictError):
    code = "email_taken"


class InvalidCredentialsError(NotAuthenticatedError):
    code = "invalid_credentials"


class InvalidTokenError(InvalidInputError):
    code = "invalid_token"


class UserBlockedError(ForbiddenError):
    code = "user_blocked"
