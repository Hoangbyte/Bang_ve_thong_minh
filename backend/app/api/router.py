from fastapi import APIRouter

from app.api.recognition_router import router as recognition_router
from app.schemas.common import SuccessResponse

router = APIRouter()
router.include_router(recognition_router)


@router.get("/health", response_model=SuccessResponse, tags=["Health"])
def health_check() -> SuccessResponse:
    """Report that the application process is running."""
    return SuccessResponse(message="Service is healthy", data={"status": "healthy"})


@router.get("/ready", response_model=SuccessResponse, tags=["Health"])
def readiness_check() -> SuccessResponse:
    """Report that the application is ready to receive requests."""
    return SuccessResponse(message="Service is ready", data={"status": "ready"})
