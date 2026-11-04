"""Development-only mock equation adapter."""

from app.adapters.base import RecognitionAdapter
from app.schemas.recognition import (
    EquationRecognitionRequest,
    EquationRecognitionResponse,
)


class MockEquationAdapter(
    RecognitionAdapter[EquationRecognitionRequest, EquationRecognitionResponse]
):
    """Report unavailability without parsing or executing user-provided expressions."""

    async def recognize(
        self,
        request: EquationRecognitionRequest,
    ) -> EquationRecognitionResponse:
        return EquationRecognitionResponse(
            success=False,
            request_id=request.request_id,
            object_id=request.object_id,
            object_version=request.object_version,
            source="mock",
            error="Mock equation recognition is unavailable; no expression was inferred.",
        )
