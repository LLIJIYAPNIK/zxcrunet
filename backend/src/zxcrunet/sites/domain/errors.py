from zxcrunet.shared.domain.errors import (
    ConflictError,
    ForbiddenError,
    InvalidInputError,
    NotFoundError,
)


class InvalidSlugError(InvalidInputError):
    code = "invalid_slug"


class SlugReservedError(InvalidInputError):
    code = "slug_reserved"


class SlugTakenError(ConflictError):
    code = "slug_taken"


class InvalidThemeError(InvalidInputError):
    code = "invalid_theme"


class SiteNotFoundError(NotFoundError):
    code = "site_not_found"


class PageNotFoundError(NotFoundError):
    code = "page_not_found"


class InvalidPagePathError(InvalidInputError):
    code = "invalid_page_path"


class PagePathTakenError(ConflictError):
    code = "page_path_taken"


class HomePageRequiredError(InvalidInputError):
    code = "home_page_required"


class PageLimitError(InvalidInputError):
    code = "page_limit"


class EmailNotVerifiedError(ForbiddenError):
    code = "email_not_verified"


class SiteSuspendedError(ForbiddenError):
    code = "site_suspended"


class TitleRequiredError(InvalidInputError):
    code = "title_required"
