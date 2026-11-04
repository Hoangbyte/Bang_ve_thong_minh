from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest

from app.core.config import Settings
from app.core.exceptions import register_exception_handlers
from app.main import app

client = TestClient(app)


def test_root_returns_application_information() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "message": "Smart Whiteboard Backend is running!",
        "data": {
            "name": "Smart Whiteboard Backend",
            "version": "1.0.0",
        },
    }


def test_health_endpoint_returns_healthy_status() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["data"] == {"status": "healthy"}


def test_readiness_endpoint_returns_ready_status() -> None:
    response = client.get("/api/ready")

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["data"] == {"status": "ready"}


def test_not_found_uses_common_error_response() -> None:
    response = client.get("/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {
        "success": False,
        "error": {"code": "HTTP_404", "message": "Not Found"},
    }


def test_unexpected_error_does_not_expose_internal_details() -> None:
    test_app = FastAPI()
    register_exception_handlers(test_app)

    @test_app.get("/error")
    def raise_error() -> None:
        raise RuntimeError("sensitive internal details")

    test_client = TestClient(test_app, raise_server_exceptions=False)
    response = test_client.get("/error")

    assert response.status_code == 500
    assert response.json() == {
        "success": False,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred.",
        },
    }
    assert "sensitive internal details" not in response.text


def test_wildcard_cors_origin_is_rejected_with_credentials() -> None:
    with pytest.raises(ValidationError, match="Wildcard CORS origins"):
        Settings(allowed_origins=["*"], allow_credentials=True)

    settings = Settings(allowed_origins=["*"], allow_credentials=False)
    assert settings.allow_credentials is False
