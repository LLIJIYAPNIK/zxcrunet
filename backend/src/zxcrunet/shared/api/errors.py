"""Unified API error format: {"error": {"code", "message", "details"}}."""

from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from zxcrunet.shared.domain.errors import (
    AppError,
    ConflictError,
    ForbiddenError,
    InvalidInputError,
    NotAuthenticatedError,
    NotFoundError,
    RateLimitedError,
)

STATUS_BY_ERROR: dict[type[AppError], HTTPStatus] = {
    InvalidInputError: HTTPStatus.UNPROCESSABLE_ENTITY,
    NotAuthenticatedError: HTTPStatus.UNAUTHORIZED,
    ForbiddenError: HTTPStatus.FORBIDDEN,
    NotFoundError: HTTPStatus.NOT_FOUND,
    ConflictError: HTTPStatus.CONFLICT,
    RateLimitedError: HTTPStatus.TOO_MANY_REQUESTS,
}


def status_for(exc: AppError) -> HTTPStatus:
    for kind in type(exc).__mro__:
        if kind in STATUS_BY_ERROR:
            return STATUS_BY_ERROR[kind]
    return HTTPStatus.BAD_REQUEST


def error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


async def _app_error_handler(_: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):
        raise exc
    return JSONResponse(error_body(exc.code, exc.message, exc.details), status_for(exc))


async def _http_error_handler(_: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, StarletteHTTPException):
        raise exc
    code = "not_found" if exc.status_code == HTTPStatus.NOT_FOUND else "http_error"
    return JSONResponse(error_body(code, str(exc.detail)), exc.status_code, headers=exc.headers)


async def _validation_error_handler(_: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):
        raise exc
    errors = [
        {"loc": list(err["loc"]), "msg": err["msg"], "type": err["type"]} for err in exc.errors()
    ]
    return JSONResponse(
        error_body("validation_error", "Request validation failed", {"errors": errors}),
        HTTPStatus.UNPROCESSABLE_ENTITY,
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
