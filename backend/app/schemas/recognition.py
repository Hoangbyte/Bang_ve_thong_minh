"""Request and response models for Smart Whiteboard recognition APIs."""

from typing import Annotated, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_IDENTIFIER_LENGTH = 128
MAX_CANVAS_DIMENSION = 100_000
MAX_STROKES_PER_REQUEST = 100
MAX_POINTS_PER_STROKE = 2_000
MAX_POINTS_PER_REQUEST = 20_000
# Shared limits bound identifier, canvas, and stroke payload sizes.


class SchemaModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Point2D(SchemaModel):
    """A finite two-dimensional canvas coordinate."""

    x: float = Field(allow_inf_nan=False)
    y: float = Field(allow_inf_nan=False)


class StrokePoint(Point2D):
    """A point sampled from a stroke; time is milliseconds from stroke start."""

    t: float = Field(ge=0, allow_inf_nan=False)
    pressure: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)


class Stroke(SchemaModel):
    id: str = Field(min_length=1, max_length=MAX_IDENTIFIER_LENGTH)
    points: list[StrokePoint] = Field(
        min_length=1,
        max_length=MAX_POINTS_PER_STROKE,
    )

    @field_validator("id")
    @classmethod
    def validate_id_is_not_whitespace(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Stroke ID must contain a non-whitespace character.")
        return value

    @model_validator(mode="after")
    def validate_point_order(self) -> "Stroke":
        if any(
            current.t < previous.t
            for previous, current in zip(self.points, self.points[1:])
        ):
            raise ValueError("Stroke point timestamps must be in non-decreasing order.")
        return self


class CanvasSize(SchemaModel):
    width: float = Field(gt=0, le=MAX_CANVAS_DIMENSION, allow_inf_nan=False)
    height: float = Field(gt=0, le=MAX_CANVAS_DIMENSION, allow_inf_nan=False)


class RecognitionRequest(SchemaModel):
    """Shared input fields used by all recognition features."""

    request_id: str = Field(min_length=1, max_length=MAX_IDENTIFIER_LENGTH)
    mode: Literal["manual", "automatic"]
    object_id: str = Field(min_length=1, max_length=MAX_IDENTIFIER_LENGTH)
    object_version: int = Field(ge=0, strict=True)
    strokes: list[Stroke] = Field(
        min_length=1,
        max_length=MAX_STROKES_PER_REQUEST,
    )
    canvas: CanvasSize

    @field_validator("request_id", "object_id")
    @classmethod
    def validate_identifiers_are_not_whitespace(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Identifier must contain a non-whitespace character.")
        if any(not character.isprintable() for character in value):
            raise ValueError("Identifiers cannot contain control characters.")
        return value

    @model_validator(mode="after")
    def validate_strokes(self) -> "RecognitionRequest":
        stroke_ids = [stroke.id for stroke in self.strokes]
        if len(stroke_ids) != len(set(stroke_ids)):
            raise ValueError("Stroke IDs must be unique within a request.")

        point_count = sum(len(stroke.points) for stroke in self.strokes)
        if point_count > MAX_POINTS_PER_REQUEST:
            raise ValueError(
                f"A request cannot contain more than {MAX_POINTS_PER_REQUEST} points."
            )
        return self


class HandwritingRecognitionRequest(RecognitionRequest):
    pass


class GeometryRecognitionRequest(RecognitionRequest):
    pass


class EquationRecognitionRequest(RecognitionRequest):
    pass


class CleanedStroke(SchemaModel):
    """Beautified stroke coordinates returned by the recognition model."""

    points: list[Point2D] = Field(min_length=1)


class HandwritingRecognitionResult(SchemaModel):
    text: str = Field(min_length=1)
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    # None means the model did not return beautified strokes; none are synthesized.
    cleaned_strokes: list[CleanedStroke] | None = None


class LineGeometry(SchemaModel):
    start: Point2D
    end: Point2D


class CircleGeometry(SchemaModel):
    center: Point2D
    radius: float = Field(gt=0, allow_inf_nan=False)


class EllipseGeometry(SchemaModel):
    center: Point2D
    semi_major_axis: float = Field(gt=0, allow_inf_nan=False)
    semi_minor_axis: float = Field(gt=0, allow_inf_nan=False)
    rotation: float = Field(allow_inf_nan=False)


class TriangleGeometry(SchemaModel):
    vertices: tuple[Point2D, Point2D, Point2D]


class SquareGeometry(SchemaModel):
    vertices: tuple[Point2D, Point2D, Point2D, Point2D]


class RectangleGeometry(SchemaModel):
    vertices: tuple[Point2D, Point2D, Point2D, Point2D]


class LineRecognitionResult(SchemaModel):
    shape_type: Literal["line"]
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    geometry: LineGeometry


class CircleRecognitionResult(SchemaModel):
    shape_type: Literal["circle"]
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    geometry: CircleGeometry


class EllipseRecognitionResult(SchemaModel):
    shape_type: Literal["ellipse"]
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    geometry: EllipseGeometry


class TriangleRecognitionResult(SchemaModel):
    shape_type: Literal["triangle"]
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    geometry: TriangleGeometry


class SquareRecognitionResult(SchemaModel):
    shape_type: Literal["square"]
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    geometry: SquareGeometry


class RectangleRecognitionResult(SchemaModel):
    shape_type: Literal["rectangle"]
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    geometry: RectangleGeometry


GeometryRecognitionResult = Annotated[
    LineRecognitionResult
    | CircleRecognitionResult
    | EllipseRecognitionResult
    | TriangleRecognitionResult
    | SquareRecognitionResult
    | RectangleRecognitionResult,
    Field(discriminator="shape_type"),
]


class EquationRecognitionResult(SchemaModel):
    latex: str = Field(min_length=1)
    expression: str = Field(min_length=1)
    function_type: Literal[
        "linear",
        "quadratic",
        "cubic",
        "polynomial",
        "trigonometric",
        "other",
    ]
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    is_graphable: bool


ResultT = TypeVar("ResultT")


class RecognitionResponse(SchemaModel, Generic[ResultT]):
    """Common envelope for successful and unsuccessful recognition results."""

    success: bool
    request_id: str = Field(min_length=1)
    object_id: str = Field(min_length=1)
    object_version: int = Field(ge=0)
    # Optional to preserve compatibility with responses created before source tracking.
    source: Literal["mock", "model"] | None = None
    result: ResultT | None = None
    error: str | None = None

    @model_validator(mode="after")
    def validate_result_status(self) -> "RecognitionResponse[ResultT]":
        if self.success and self.result is None:
            raise ValueError("A successful recognition response must include a result.")
        if not self.success and self.result is not None:
            raise ValueError("An unsuccessful recognition response cannot include a result.")
        if self.error is not None and not self.error.strip():
            raise ValueError("Error reason must not be empty.")
        if self.success and self.error is not None:
            raise ValueError("A successful recognition response cannot include an error.")
        return self


class HandwritingRecognitionResponse(
    RecognitionResponse[HandwritingRecognitionResult]
):
    pass


class GeometryRecognitionResponse(RecognitionResponse[GeometryRecognitionResult]):
    pass


class EquationRecognitionResponse(RecognitionResponse[EquationRecognitionResult]):
    pass
