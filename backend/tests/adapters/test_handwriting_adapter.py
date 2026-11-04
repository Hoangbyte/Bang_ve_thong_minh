import pytest
from pydantic import ValidationError

from app.adapters.base import AdapterUnavailableError
from app.adapters.handwriting_adapter import MockHandwritingAdapter
from app.schemas.recognition import (
    HandwritingRecognitionRequest,
    HandwritingRecognitionResponse,
)


def valid_request() -> HandwritingRecognitionRequest:
    return HandwritingRecognitionRequest(
        request_id="request-handwriting",
        mode="manual",
        object_id="object-handwriting",
        object_version=7,
        strokes=[
            {
                "id": "stroke-1",
                "points": [
                    {"x": 1, "y": 2, "t": 0, "pressure": 0.6},
                    {"x": 2, "y": 3, "t": 10},
                ],
            }
        ],
        canvas={"width": 800, "height": 600},
    )


@pytest.mark.asyncio
async def test_mock_handwriting_returns_explicit_placeholder_and_preserves_metadata() -> None:
    request = valid_request()

    response = await MockHandwritingAdapter().recognize(request)

    assert isinstance(response, HandwritingRecognitionResponse)
    assert response.success is True
    assert response.source == "mock"
    assert (response.request_id, response.object_id, response.object_version) == (
        request.request_id,
        request.object_id,
        request.object_version,
    )
    assert response.result is not None
    assert response.result.text.startswith("[MOCK]")
    assert response.result.confidence is None
    assert response.result.cleaned_strokes is None


def test_invalid_empty_strokes_are_rejected_before_adapter_call() -> None:
    with pytest.raises(ValidationError, match="at least 1 item"):
        HandwritingRecognitionRequest(
            request_id="request-handwriting",
            mode="manual",
            object_id="object-handwriting",
            object_version=0,
            strokes=[],
            canvas={"width": 800, "height": 600},
        )


@pytest.mark.asyncio
async def test_adapter_unavailability_is_not_converted_to_success() -> None:
    class UnavailableHandwritingAdapter(MockHandwritingAdapter):
        async def recognize(
            self,
            request: HandwritingRecognitionRequest,
        ) -> HandwritingRecognitionResponse:
            raise AdapterUnavailableError("Provider unavailable")

    with pytest.raises(AdapterUnavailableError, match="Provider unavailable"):
        await UnavailableHandwritingAdapter().recognize(valid_request())
