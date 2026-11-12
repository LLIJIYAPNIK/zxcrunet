from zxcrunet.shared.domain.errors import ConflictError, InvalidInputError, NotFoundError


class TitleNotFoundError(NotFoundError):
    code = "title_not_found"


class PostNotFoundError(NotFoundError):
    code = "post_not_found"


class TitleSlugTakenError(ConflictError):
    code = "title_slug_taken"


class InvalidTitleError(InvalidInputError):
    code = "invalid_title"


class InvalidSeriesError(InvalidInputError):
    code = "invalid_series"


class InvalidShelfEntryError(InvalidInputError):
    code = "invalid_shelf_entry"


class InvalidPostError(InvalidInputError):
    code = "invalid_post"


class CatalogLimitError(InvalidInputError):
    code = "catalog_limit"
