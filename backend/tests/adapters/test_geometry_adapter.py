import pytest
from pydantic import ValidationError

from app.adapters.geometry_adapter import MockGeometryAdapter
from app.schemas.recognition import (
    GeometryRecognitionRequest,
    GeometryRecognitionResponse,
)


def valid_request() -> GeometryRecognitionRequest:
    return GeometryRecognitionRequest(
        request_id="request-geometry",
        mode="automatic",
        object_id="object-geometry",
        object_version=3,
        strokes=[
            {
                "id": "stroke-1",
                "points": [
                    {"x": 0, "y": 0, "t": 0},
                    {"x": 20, "y": 15, "t": 10},
                ],
            }
        ],
        canvas={"width": 800, "height": 600},
    )


@pytest.mark.asyncio
async def test_mock_geometry_reports_unavailable_without_inventing_a_shape() -> None:
    request = valid_request()

    response = await MockGeometryAdapter().recognize(request)

    assert isinstance(response, GeometryRecognitionResponse)
    assert response.success is False
    assert response.source == "mock"
    assert (response.request_id, response.object_id, response.object_version) == (
        request.request_id,
        request.object_id,
        request.object_version,
    )
    assert response.result is None
    assert response.error is not None
    assert "no shape was inferred" in response.error


def test_invalid_empty_points_are_rejected_before_adapter_call() -> None:
    with pytest.raises(ValidationError, match="at least 1 item"):
        GeometryRecognitionRequest(
            request_id="request-geometry",
            mode="manual",
            object_id="object-geometry",
            object_version=0,
            strokes=[{"id": "stroke-1", "points": []}],
            canvas={"width": 800, "height": 600},
        )
