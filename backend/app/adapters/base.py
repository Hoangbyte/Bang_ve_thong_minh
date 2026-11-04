"""Shared contracts and errors for recognition adapters."""

from typing import Protocol, TypeVar

from app.schemas.recognition import RecognitionRequest, RecognitionResponse

RequestT = TypeVar(
    "RequestT",
    bound=RecognitionRequest,
    contravariant=True,
)
ResponseT = TypeVar(
    "ResponseT",
    bound=RecognitionResponse,
    covariant=True,
)


class RecognitionAdapter(Protocol[RequestT, ResponseT]):
    """Contract implemented by asynchronous recognition providers."""

    async def recognize(self, request: RequestT) -> ResponseT:
        """Recognize a validated request without depending on an HTTP framework."""
        ...


class AdapterError(Exception):
    """Base exception for errors raised while interacting with a recognition adapter."""


class AdapterTimeoutError(AdapterError):
    """Raised when a recognition provider exceeds its allowed execution time."""


class AdapterUnavailableError(AdapterError):
    """Raised when a recognition provider is unavailable."""
