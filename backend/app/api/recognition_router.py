"""HTTP endpoints for the recognition features."""

import logging
from collections.abc import Awaitable
from time import perf_counter
from typing import Annotated, TypeVar

from fastapi import APIRouter, Depends

from app.api.dependencies import get_recognition_service
from app.schemas.common import ErrorResponse
from app.schemas.recognition import (
    EquationRecognitionRequest,
    EquationRecognitionResponse,
    GeometryRecognitionRequest,
    GeometryRecognitionResponse,
    HandwritingRecognitionRequest,
    HandwritingRecognitionResponse,
    RecognitionResponse,
)
from app.services.recognition_service import RecognitionService

router = APIRouter(prefix="/recognition", tags=["Recognition"])
logger = logging.getLogger(__name__)
ResponseT = TypeVar("ResponseT", bound=RecognitionResponse)

ERROR_RESPONSES = {
    413: {"model": ErrorResponse, "description": "Request body is too large."},
    422: {"model": ErrorResponse, "description": "Invalid request data."},
    500: {"model": ErrorResponse, "description": "Unexpected internal error."},
    502: {"model": ErrorResponse, "description": "Recognition processing failed."},
    503: {"model": ErrorResponse, "description": "Recognition provider unavailable."},
    504: {"model": ErrorResponse, "description": "Recognition request timed out."},
}


async def _run_recognition(
    request_id: str,
    endpoint: str,
    operation: Awaitable[ResponseT],
) -> ResponseT:
    started_at = perf_counter()
    try:
        response = await operation
    except Exception as exception:
        duration_ms = (perf_counter() - started_at) * 1_000
        logger.error(
            "Recognition request failed: request_id=%s endpoint=%s "
            "category=%s duration_ms=%.2f",
            request_id,
            endpoint,
            type(exception).__name__,
            duration_ms,
        )
        raise

    duration_ms = (perf_counter() - started_at) * 1_000
    logger.info(
        "Recognition request completed: request_id=%s endpoint=%s "
        "category=%s success=%s source=%s duration_ms=%.2f",
        request_id,
        endpoint,
        "recognized" if response.success else "unrecognized",
        response.success,
        response.source or "unspecified",
        duration_ms,
    )
    return response


@router.post(
    "/handwriting",
    response_model=HandwritingRecognitionResponse,
    responses=ERROR_RESPONSES,
    summary="Recognize handwriting",
    description=(
        "Submit strokes for handwriting recognition. Mock responses are identified "
        "by `source=mock`; no AI recognition is performed by the current mock adapter."
    ),
)
async def recognize_handwriting(
    request: HandwritingRecognitionRequest,
    service: Annotated[RecognitionService, Depends(get_recognition_service)],
) -> HandwritingRecognitionResponse:
    return await _run_recognition(
        request.request_id,
        "/api/recognition/handwriting",
        service.recognize_handwriting(request),
    )


@router.post(
    "/geometry",
    response_model=GeometryRecognitionResponse,
    responses=ERROR_RESPONSES,
    summary="Recognize geometry",
    description=(
        "Submit strokes for shape recognition. The current mock adapter reports "
        "recognition as unavailable rather than inferring an arbitrary shape."
    ),
)
async def recognize_geometry(
    request: GeometryRecognitionRequest,
    service: Annotated[RecognitionService, Depends(get_recognition_service)],
) -> GeometryRecognitionResponse:
    return await _run_recognition(
        request.request_id,
        "/api/recognition/geometry",
        service.recognize_geometry(request),
    )


@router.post(
    "/equation",
    response_model=EquationRecognitionResponse,
    responses=ERROR_RESPONSES,
    summary="Recognize an equation",
    description=(
        "Submit strokes for equation recognition. The current mock adapter does "
        "not infer or execute mathematical expressions."
    ),
)
async def recognize_equation(
    request: EquationRecognitionRequest,
    service: Annotated[RecognitionService, Depends(get_recognition_service)],
) -> EquationRecognitionResponse:
    return await _run_recognition(
        request.request_id,
        "/api/recognition/equation",
        service.recognize_equation(request),
    )
