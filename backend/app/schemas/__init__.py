"""Pydantic schema package."""

from app.schemas.recognition import (
    EquationRecognitionRequest,
    EquationRecognitionResponse,
    GeometryRecognitionRequest,
    GeometryRecognitionResponse,
    HandwritingRecognitionRequest,
    HandwritingRecognitionResponse,
)

__all__ = [
    "EquationRecognitionRequest",
    "EquationRecognitionResponse",
    "GeometryRecognitionRequest",
    "GeometryRecognitionResponse",
    "HandwritingRecognitionRequest",
    "HandwritingRecognitionResponse",
]
