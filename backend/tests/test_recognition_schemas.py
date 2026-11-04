from copy import deepcopy

import pytest
from pydantic import ValidationError

from app.schemas.recognition import (
    MAX_CANVAS_DIMENSION,
    MAX_IDENTIFIER_LENGTH,
    MAX_POINTS_PER_REQUEST,
    MAX_POINTS_PER_STROKE,
    MAX_STROKES_PER_REQUEST,
    EquationRecognitionRequest,
    EquationRecognitionResponse,
    GeometryRecognitionRequest,
    GeometryRecognitionResponse,
    HandwritingRecognitionRequest,
    HandwritingRecognitionResponse,
    RecognitionRequest,
)

REQUEST_MODELS = [
    HandwritingRecognitionRequest,
    GeometryRecognitionRequest,
    EquationRecognitionRequest,
]


def valid_request_data() -> dict:
    return {
        "request_id": "request-1",
        "mode": "manual",
        "object_id": "object-1",
        "object_version": 0,
        "strokes": [
            {
                "id": "stroke-1",
                "points": [
                    {"x": 12.5, "y": 24, "t": 0, "pressure": 0.5},
                    {"x": 13, "y": 25, "t": 10},
                ],
            }
        ],
        "canvas": {"width": 800, "height": 600},
    }


def response_metadata() -> dict:
    return {
        "success": True,
        "request_id": "request-1",
        "object_id": "object-1",
        "object_version": 0,
    }


@pytest.mark.parametrize("request_model", REQUEST_MODELS)
def test_each_request_model_parses_shared_input(request_model: type[RecognitionRequest]):
    request = request_model.model_validate(valid_request_data())

    assert request.request_id == "request-1"
    assert request.strokes[0].points[0].pressure == 0.5


@pytest.mark.parametrize("request_model", REQUEST_MODELS)
def test_request_requires_all_fields(request_model: type[RecognitionRequest]):
    data = valid_request_data()
    del data["object_id"]

    with pytest.raises(ValidationError, match="object_id"):
        request_model.model_validate(data)


@pytest.mark.parametrize("request_model", REQUEST_MODELS)
def test_request_rejects_empty_strokes(request_model: type[RecognitionRequest]):
    data = valid_request_data()
    data["strokes"] = []

    with pytest.raises(ValidationError, match="at least 1 item"):
        request_model.model_validate(data)


def test_request_rejects_empty_points() -> None:
    data = valid_request_data()
    data["strokes"][0]["points"] = []

    with pytest.raises(ValidationError, match="at least 1 item"):
        HandwritingRecognitionRequest.model_validate(data)


def test_request_rejects_unrecognized_fields_instead_of_discarding_them() -> None:
    data = valid_request_data()
    data["unexpected"] = "value"

    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        HandwritingRecognitionRequest.model_validate(data)


def test_request_rejects_duplicate_stroke_ids() -> None:
    data = valid_request_data()
    data["strokes"].append(deepcopy(data["strokes"][0]))

    with pytest.raises(ValidationError, match="Stroke IDs must be unique"):
        HandwritingRecognitionRequest.model_validate(data)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("request_id", ""),
        ("request_id", "   "),
        ("object_id", ""),
        ("object_id", "   "),
    ],
)
def test_request_rejects_empty_identifiers(field: str, value: str) -> None:
    data = valid_request_data()
    data[field] = value

    with pytest.raises(ValidationError):
        HandwritingRecognitionRequest.model_validate(data)


@pytest.mark.parametrize("field", ["request_id", "object_id"])
def test_request_rejects_overlong_identifiers(field: str) -> None:
    data = valid_request_data()
    data[field] = "x" * (MAX_IDENTIFIER_LENGTH + 1)

    with pytest.raises(ValidationError, match="at most 128 characters"):
        HandwritingRecognitionRequest.model_validate(data)


def test_request_rejects_empty_and_overlong_stroke_ids() -> None:
    for stroke_id in ("", "  ", "x" * (MAX_IDENTIFIER_LENGTH + 1)):
        data = valid_request_data()
        data["strokes"][0]["id"] = stroke_id
        with pytest.raises(ValidationError):
            HandwritingRecognitionRequest.model_validate(data)


def test_request_rejects_negative_object_version() -> None:
    data = valid_request_data()
    data["object_version"] = -1

    with pytest.raises(ValidationError, match="greater than or equal to 0"):
        HandwritingRecognitionRequest.model_validate(data)


def test_request_rejects_non_integer_object_version() -> None:
    data = valid_request_data()
    data["object_version"] = True

    with pytest.raises(ValidationError):
        HandwritingRecognitionRequest.model_validate(data)


def test_identifiers_reject_control_characters() -> None:
    data = valid_request_data()
    data["request_id"] = "request\nforged-log-entry"

    with pytest.raises(ValidationError, match="control characters"):
        HandwritingRecognitionRequest.model_validate(data)


@pytest.mark.parametrize(
    "timestamps",
    [[1, 0], [-1, 0], [0, float("nan")], [0, float("inf")]],
)
def test_request_rejects_invalid_timestamps(timestamps: list[float]) -> None:
    data = valid_request_data()
    data["strokes"][0]["points"] = [
        {"x": 1, "y": 2, "t": timestamps[0]},
        {"x": 3, "y": 4, "t": timestamps[1]},
    ]

    with pytest.raises(ValidationError):
        HandwritingRecognitionRequest.model_validate(data)


@pytest.mark.parametrize(
    "pressure",
    [-0.01, 1.01, float("nan"), float("inf"), float("-inf")],
)
def test_stroke_rejects_pressure_outside_unit_interval(pressure: float) -> None:
    data = valid_request_data()
    data["strokes"][0]["points"][0]["pressure"] = pressure

    with pytest.raises(ValidationError):
        HandwritingRecognitionRequest.model_validate(data)


@pytest.mark.parametrize("coordinate", [float("nan"), float("inf"), float("-inf")])
@pytest.mark.parametrize("axis", ["x", "y"])
def test_request_rejects_non_finite_coordinates(coordinate: float, axis: str) -> None:
    data = valid_request_data()
    data["strokes"][0]["points"][0][axis] = coordinate

    with pytest.raises(ValidationError):
        HandwritingRecognitionRequest.model_validate(data)


@pytest.mark.parametrize("dimension", [0, -1, MAX_CANVAS_DIMENSION + 1])
def test_canvas_dimensions_must_be_positive_and_bounded(dimension: float) -> None:
    data = valid_request_data()
    data["canvas"]["width"] = dimension

    with pytest.raises(ValidationError):
        HandwritingRecognitionRequest.model_validate(data)


@pytest.mark.parametrize("dimension", [float("nan"), float("inf"), float("-inf")])
def test_canvas_dimensions_must_be_finite(dimension: float) -> None:
    data = valid_request_data()
    data["canvas"]["height"] = dimension

    with pytest.raises(ValidationError):
        HandwritingRecognitionRequest.model_validate(data)


def test_request_rejects_stroke_count_above_limit() -> None:
    data = valid_request_data()
    data["strokes"] = [
        {"id": f"stroke-{index}", "points": [{"x": 0, "y": 0, "t": 0}]}
        for index in range(MAX_STROKES_PER_REQUEST + 1)
    ]

    with pytest.raises(ValidationError, match="at most 100 items"):
        GeometryRecognitionRequest.model_validate(data)


def test_request_rejects_points_per_stroke_above_limit() -> None:
    data = valid_request_data()
    data["strokes"][0]["points"] = [
        {"x": 0, "y": 0, "t": index}
        for index in range(MAX_POINTS_PER_STROKE + 1)
    ]

    with pytest.raises(ValidationError, match="at most 2000 items"):
        EquationRecognitionRequest.model_validate(data)


def test_request_rejects_total_points_above_limit() -> None:
    data = valid_request_data()
    points = [{"x": 0, "y": 0, "t": index} for index in range(2_000)]
    stroke_count = MAX_POINTS_PER_REQUEST // len(points) + 1
    data["strokes"] = [
        {"id": f"stroke-{index}", "points": deepcopy(points)}
        for index in range(stroke_count)
    ]

    with pytest.raises(ValidationError, match="cannot contain more than 20000 points"):
        RecognitionRequest.model_validate(data)


def test_successful_handwriting_response_allows_unavailable_cleaned_strokes() -> None:
    response = HandwritingRecognitionResponse.model_validate(
        {
            **response_metadata(),
            "result": {
                "text": "Hello",
                "confidence": 0.95,
                "cleaned_strokes": None,
            },
        }
    )

    assert response.success is True
    assert response.result is not None
    assert response.result.cleaned_strokes is None


@pytest.mark.parametrize(
    "response_model",
    [
        HandwritingRecognitionResponse,
        GeometryRecognitionResponse,
        EquationRecognitionResponse,
    ],
)
def test_each_response_supports_unsuccessful_recognition(response_model) -> None:
    response = response_model.model_validate(
        {
            **response_metadata(),
            "success": False,
            "result": None,
            "error": "Input could not be recognized.",
        }
    )

    assert response.success is False
    assert response.result is None
    assert response.error == "Input could not be recognized."


@pytest.mark.parametrize(
    ("shape_type", "geometry"),
    [
        (
            "line",
            {"start": {"x": 0, "y": 0}, "end": {"x": 10, "y": 10}},
        ),
        ("circle", {"center": {"x": 5, "y": 5}, "radius": 4}),
        (
            "ellipse",
            {
                "center": {"x": 5, "y": 5},
                "semi_major_axis": 6,
                "semi_minor_axis": 3,
                "rotation": 0.25,
            },
        ),
        (
            "triangle",
            {
                "vertices": [
                    {"x": 0, "y": 0},
                    {"x": 4, "y": 0},
                    {"x": 2, "y": 3},
                ]
            },
        ),
        (
            "square",
            {
                "vertices": [
                    {"x": 0, "y": 0},
                    {"x": 2, "y": 0},
                    {"x": 2, "y": 2},
                    {"x": 0, "y": 2},
                ]
            },
        ),
        (
            "rectangle",
            {
                "vertices": [
                    {"x": 0, "y": 0},
                    {"x": 4, "y": 0},
                    {"x": 4, "y": 2},
                    {"x": 0, "y": 2},
                ]
            },
        ),
    ],
)
def test_geometry_response_supports_each_shape(shape_type: str, geometry: dict) -> None:
    response = GeometryRecognitionResponse.model_validate(
        {
            **response_metadata(),
            "result": {
                "shape_type": shape_type,
                "confidence": 0.9,
                "geometry": geometry,
            },
        }
    )

    assert response.success is True
    assert response.result is not None
    assert response.result.shape_type == shape_type


def test_equation_response_parses_graph_data() -> None:
    response = EquationRecognitionResponse.model_validate(
        {
            **response_metadata(),
            "result": {
                "latex": "y = x^2",
                "expression": "x**2",
                "function_type": "quadratic",
                "confidence": 0.98,
                "is_graphable": True,
            },
        }
    )

    assert response.result is not None
    assert response.result.function_type == "quadratic"
    assert response.result.is_graphable is True


@pytest.mark.parametrize(
    ("response_model", "result"),
    [
        (HandwritingRecognitionResponse, {"text": "Hello", "confidence": 1.1}),
        (
            GeometryRecognitionResponse,
            {
                "shape_type": "circle",
                "confidence": -0.1,
                "geometry": {"center": {"x": 0, "y": 0}, "radius": 1},
            },
        ),
        (
            EquationRecognitionResponse,
            {
                "latex": "x",
                "expression": "x",
                "function_type": "other",
                "confidence": float("inf"),
                "is_graphable": False,
            },
        ),
    ],
)
def test_responses_reject_invalid_confidence(response_model, result) -> None:
    with pytest.raises(ValidationError):
        response_model.model_validate({**response_metadata(), "result": result})


def test_response_rejects_success_without_result() -> None:
    with pytest.raises(ValidationError, match="must include a result"):
        HandwritingRecognitionResponse.model_validate(response_metadata())


def test_response_rejects_result_on_failure() -> None:
    with pytest.raises(ValidationError, match="cannot include a result"):
        HandwritingRecognitionResponse.model_validate(
            {
                **response_metadata(),
                "success": False,
                "result": {"text": "not allowed"},
            }
        )
