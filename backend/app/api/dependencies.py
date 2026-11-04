"""FastAPI dependencies for application-level components."""

from fastapi import Request

from app.services.recognition_service import RecognitionService


def get_recognition_service(request: Request) -> RecognitionService:
    """Return the service instance initialized for this application lifespan."""
    service = getattr(request.app.state, "recognition_service", None)
    if service is None:
        raise RuntimeError("Recognition service was not initialized.")
    return service
