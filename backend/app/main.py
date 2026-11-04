from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.equation_adapter import MockEquationAdapter
from app.adapters.geometry_adapter import MockGeometryAdapter
from app.adapters.handwriting_adapter import MockHandwritingAdapter
from app.api.router import router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.middleware import RequestBodyLimitMiddleware
from app.schemas.common import SuccessResponse
from app.services.recognition_service import RecognitionService

settings = get_settings()


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    if settings.ai_provider != "mock":
        raise RuntimeError(f"Unsupported AI provider: {settings.ai_provider}")

    application.state.recognition_service = RecognitionService(
        handwriting_adapter=MockHandwritingAdapter(),
        geometry_adapter=MockGeometryAdapter(),
        equation_adapter=MockEquationAdapter(),
        settings=settings,
    )
    yield
    del application.state.recognition_service


app = FastAPI(
    title=settings.app_title,
    description=settings.app_description,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    RequestBodyLimitMiddleware,
    max_body_size=settings.max_request_body_bytes,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=settings.allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(router, prefix="/api")


@app.get("/", response_model=SuccessResponse, tags=["Application"])
def read_root() -> SuccessResponse:
    """Return basic information about the application."""
    return SuccessResponse(
        message="Smart Whiteboard Backend is running!",
        data={"name": settings.app_title, "version": settings.app_version},
    )
