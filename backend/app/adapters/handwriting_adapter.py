"""Development-only mock handwriting adapter."""

from app.adapters.base import RecognitionAdapter
from app.schemas.recognition import (
    HandwritingRecognitionRequest,
    HandwritingRecognitionResponse,
    HandwritingRecognitionResult,
)


class MockHandwritingAdapter(
    RecognitionAdapter[HandwritingRecognitionRequest, HandwritingRecognitionResponse]
):
    """Return an explicit placeholder, not a claim of actual handwriting recognition."""

    async def recognize(
        self,
        request: HandwritingRecognitionRequest,
    ) -> HandwritingRecognitionResponse:
        return HandwritingRecognitionResponse(
            success=True,
            request_id=request.request_id,
            object_id=request.object_id,
            object_version=request.object_version,
            source="mock",
            result=HandwritingRecognitionResult(
                text="[MOCK] Handwriting recognition is not implemented.",
                confidence=None,
                cleaned_strokes=None,
            ),
        )
