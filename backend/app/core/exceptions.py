import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.common import ErrorDetail, ErrorResponse
from app.services.recognition_service import (
    RecognitionProcessingError,
    RecognitionServiceError,
    RecognitionTimeoutError,
    RecognitionUnavailableError,
)

logger = logging.getLogger(__name__)

SERVICE_ERROR_RESPONSES: dict[type[RecognitionServiceError], tuple[int, str, str]] = {
    RecognitionUnavailableError: (
        503,
        "RECOGNITION_UNAVAILABLE",
        "Recognition service is temporarily unavailable.",
    ),
    RecognitionTimeoutError: (
        504,
        "RECOGNITION_TIMEOUT",
        "Recognition request timed out.",
    ),
    RecognitionProcessingError: (
        502,
        "RECOGNITION_PROCESSING_ERROR",
        "Recognition service could not process the request.",
    ),
}


async def handle_recognition_service_exception(
    request: Request,
    exception: RecognitionServiceError,
) -> JSONResponse:
    status_code, error_code, message = SERVICE_ERROR_RESPONSES.get(
        type(exception),
        (
            502,
            "RECOGNITION_PROCESSING_ERROR",
            "Recognition service could not process the request.",
        ),
    )
    logger.warning(
        "Recognition service failure for %s %s (%s)",
        request.method,
        request.url.path,
        error_code,
        exc_info=(
            (
                type(exception.__cause__),
                exception.__cause__,
                exception.__cause__.__traceback__,
            )
            if exception.__cause__ is not None
            else None
        ),
    )
    response = ErrorResponse(
        error=ErrorDetail(code=error_code, message=message)
    )
    return JSONResponse(status_code=status_code, content=response.model_dump())


async def handle_http_exception(
    request: Request,
    exception: StarletteHTTPException,
) -> JSONResponse:
    if exception.status_code >= 500:
        message = "An unexpected error occurred."
        logger.error(
            "HTTP %s while handling %s %s",
            exception.status_code,
            request.method,
            request.url.path,
        )
    else:
        message = str(exception.detail)
        logger.warning(
            "HTTP %s while handling %s %s: %s",
            exception.status_code,
            request.method,
            request.url.path,
            message,
        )

    response = ErrorResponse(
        error=ErrorDetail(
            code=f"HTTP_{exception.status_code}",
            message=message,
        )
    )
    return JSONResponse(
        status_code=exception.status_code,
        content=response.model_dump(),
        headers=exception.headers,
    )


async def handle_validation_exception(
    request: Request,
    exception: RequestValidationError,
) -> JSONResponse:
    logger.info(
        "Request validation failed for %s %s (%s error(s))",
        request.method,
        request.url.path,
        len(exception.errors()),
    )
    response = ErrorResponse(
        error=ErrorDetail(
            code="VALIDATION_ERROR",
            message="Request validation failed.",
        )
    )
    return JSONResponse(status_code=422, content=response.model_dump())


async def handle_unexpected_exception(
    request: Request,
    exception: Exception,
) -> JSONResponse:
    logger.exception(
        "Unhandled exception while handling %s %s",
        request.method,
        request.url.path,
        exc_info=exception,
    )
    response = ErrorResponse(
        error=ErrorDetail(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred.",
        )
    )
    return JSONResponse(status_code=500, content=response.model_dump())


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(RequestValidationError, handle_validation_exception)
    app.add_exception_handler(
        RecognitionServiceError,
        handle_recognition_service_exception,
    )
    app.add_exception_handler(Exception, handle_unexpected_exception)
