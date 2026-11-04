import pytest
from pydantic import ValidationError

from app.adapters.base import AdapterTimeoutError
from app.adapters.equation_adapter import MockEquationAdapter
from app.schemas.recognition import (
    EquationRecognitionRequest,
    EquationRecognitionResponse,
)


def valid_request() -> EquationRecognitionRequest:
    return EquationRecognitionRequest(
        request_id="request-equation",
        mode="manual",
        object_id="object-equation",
        object_version=11,
        strokes=[
            {
                "id": "stroke-1",
                "points": [
                    {"x": 4, "y": 8, "t": 0},
                    {"x": 9, "y": 12, "t": 12},
                ],
            }
        ],
        canvas={"width": 800, "height": 600},
    )


@pytest.mark.asyncio
async def test_mock_equation_reports_unavailable_without_inventing_expression() -> None:
    request = valid_request()

    response = await MockEquationAdapter().recognize(request)

    assert isinstance(response, EquationRecognitionResponse)
    assert response.success is False
    assert response.source == "mock"
    assert (response.request_id, response.object_id, response.object_version) == (
        request.request_id,
        request.object_id,
        request.object_version,
    )
    assert response.result is None
    assert response.error is not None
    assert "no expression was inferred" in response.error


def test_invalid_mode_is_rejected_before_adapter_call() -> None:
    with pytest.raises(ValidationError, match="Input should be 'manual' or 'automatic'"):
        EquationRecognitionRequest(
            request_id="request-equation",
            mode="unsupported",
            object_id="object-equation",
            object_version=0,
            strokes=[
                {"id": "stroke-1", "points": [{"x": 0, "y": 0, "t": 0}]}
            ],
            canvas={"width": 800, "height": 600},
        )


@pytest.mark.asyncio
async def test_adapter_timeout_is_not_converted_to_success() -> None:
    class TimedOutEquationAdapter(MockEquationAdapter):
        async def recognize(
            self,
            request: EquationRecognitionRequest,
        ) -> EquationRecognitionResponse:
            raise AdapterTimeoutError("Recognition timed out")

    with pytest.raises(AdapterTimeoutError, match="Recognition timed out"):
        await TimedOutEquationAdapter().recognize(valid_request())
