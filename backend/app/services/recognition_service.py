"""Coordinate recognition adapters with shared timeout and concurrency controls."""

import asyncio
from typing import TypeVar

from app.adapters.base import (
    AdapterError,
    AdapterTimeoutError,
    AdapterUnavailableError,
    RecognitionAdapter,
)
from app.core.config import Settings
from app.schemas.recognition import (
    EquationRecognitionRequest,
    EquationRecognitionResponse,
    GeometryRecognitionRequest,
    GeometryRecognitionResponse,
    HandwritingRecognitionRequest,
    HandwritingRecognitionResponse,
    RecognitionRequest,
    RecognitionResponse,
)


class RecognitionServiceError(Exception):
    """Base exception for recognition service failures."""


class RecognitionTimeoutError(RecognitionServiceError):
    """Raised when a recognition request exceeds its configured time limit."""


class RecognitionUnavailableError(RecognitionServiceError):
    """Raised when the selected recognition provider is unavailable."""


class RecognitionProcessingError(RecognitionServiceError):
    """Raised when a known adapter failure prevents recognition from completing."""


RequestT = TypeVar("RequestT", bound=RecognitionRequest)
ResponseT = TypeVar("ResponseT", bound=RecognitionResponse)


class RecognitionService:
    """Dispatch feature requests to injected adapters under shared resource limits.

    Timeout covers both waiting for a concurrency permit and adapter execution.
    The semaphore is shared across all three recognition features in this instance.
    """

    def __init__(
        self,
        *,
        handwriting_adapter: RecognitionAdapter[
            HandwritingRecognitionRequest,
            HandwritingRecognitionResponse,
        ],
        geometry_adapter: RecognitionAdapter[
            GeometryRecognitionRequest,
            GeometryRecognitionResponse,
        ],
        equation_adapter: RecognitionAdapter[
            EquationRecognitionRequest,
            EquationRecognitionResponse,
        ],
        settings: Settings,
    ) -> None:
        self._handwriting_adapter = handwriting_adapter
        self._geometry_adapter = geometry_adapter
        self._equation_adapter = equation_adapter
        self._timeout_seconds = settings.recognition_timeout_seconds
        self._semaphore = asyncio.Semaphore(
            settings.max_concurrent_recognition_requests
        )

    async def recognize_handwriting(
        self,
        request: HandwritingRecognitionRequest,
    ) -> HandwritingRecognitionResponse:
        return await self._execute(request, self._handwriting_adapter)

    async def recognize_geometry(
        self,
        request: GeometryRecognitionRequest,
    ) -> GeometryRecognitionResponse:
        return await self._execute(request, self._geometry_adapter)

    async def recognize_equation(
        self,
        request: EquationRecognitionRequest,
    ) -> EquationRecognitionResponse:
        return await self._execute(request, self._equation_adapter)

    async def _execute(
        self,
        request: RequestT,
        adapter: RecognitionAdapter[RequestT, ResponseT],
    ) -> ResponseT:
        try:
            async with asyncio.timeout(self._timeout_seconds):
                async with self._semaphore:
                    response = await adapter.recognize(request)
        except AdapterTimeoutError as exc:
            raise RecognitionTimeoutError(
                "The recognition provider timed out."
            ) from exc
        except TimeoutError as exc:
            raise RecognitionTimeoutError(
                "The recognition request exceeded its configured time limit."
            ) from exc
        except AdapterUnavailableError as exc:
            raise RecognitionUnavailableError(
                "The recognition provider is unavailable."
            ) from exc
        except AdapterError as exc:
            raise RecognitionProcessingError(
                "The recognition provider could not process the request."
            ) from exc

        if (
            response.request_id != request.request_id
            or response.object_id != request.object_id
            or response.object_version != request.object_version
        ):
            response = response.model_copy(
                update={
                    "request_id": request.request_id,
                    "object_id": request.object_id,
                    "object_version": request.object_version,
                }
            )
        return response
