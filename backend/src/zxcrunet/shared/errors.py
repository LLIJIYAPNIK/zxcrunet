"""Unified API error format: {"error": {"code", "message", "details"}}."""

from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Base class for expected errors that are reported to API clients."""

    code: str = "app_error"
    status_code: int = HTTPStatus.BAD_REQUEST

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(AppError):
    code = "not_found"
    status_code = HTTPStatus.NOT_FOUND


def error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


async def _app_error_handler(_: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):
        raise exc
    return JSONResponse(error_body(exc.code, exc.message, exc.details), exc.status_code)


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
