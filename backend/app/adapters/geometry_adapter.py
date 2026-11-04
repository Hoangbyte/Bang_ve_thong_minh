"""Development-only mock geometry adapter."""

from app.adapters.base import RecognitionAdapter
from app.schemas.recognition import (
    GeometryRecognitionRequest,
    GeometryRecognitionResponse,
)


class MockGeometryAdapter(
    RecognitionAdapter[GeometryRecognitionRequest, GeometryRecognitionResponse]
):
    """Report unavailability rather than infer an arbitrary shape from strokes."""

    async def recognize(
        self,
        request: GeometryRecognitionRequest,
    ) -> GeometryRecognitionResponse:
        return GeometryRecognitionResponse(
            success=False,
            request_id=request.request_id,
            object_id=request.object_id,
            object_version=request.object_version,
            source="mock",
            error="Mock geometry recognition is unavailable; no shape was inferred.",
        )
