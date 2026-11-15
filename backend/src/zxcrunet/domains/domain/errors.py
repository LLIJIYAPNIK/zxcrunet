from zxcrunet.shared.domain.errors import (
    ConflictError,
    ForbiddenError,
    InvalidInputError,
    NotFoundError,
)


class InvalidHostError(InvalidInputError):
    code = "invalid_host"


class HostNotAllowedError(InvalidInputError):
    """The service's own domains and IP addresses cannot be attached."""

    code = "host_not_allowed"


class DomainAlreadyAddedError(ConflictError):
    code = "domain_already_added"


class DomainTakenError(ConflictError):
    """Another site has already proven ownership of this host."""

    code = "domain_taken"


class DomainNotFoundError(NotFoundError):
    code = "domain_not_found"


class DomainRevokedError(ForbiddenError):
    """The product owner revoked the domain; it can only be removed."""

    code = "domain_revoked"
