import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.dependencies import get_recognition_service
from app.core.config import Settings
from app.main import app
from app.schemas.recognition import (
    EquationRecognitionRequest,
    EquationRecognitionResponse,
    EquationRecognitionResult,
    GeometryRecognitionRequest,
    GeometryRecognitionResponse,
    HandwritingRecognitionRequest,
    HandwritingRecognitionResponse,
    HandwritingRecognitionResult,
    RecognitionRequest,
)
from app.services.recognition_service import (
    RecognitionProcessingError,
    RecognitionTimeoutError,
    RecognitionUnavailableError,
)

REQUEST_DATA = {
    "request_id": "api-request-1",
    "mode": "manual",
    "object_id": "board-object-1",
    "object_version": 2,
    "strokes": [
        {
            "id": "stroke-1",
            "points": [
                {"x": 1, "y": 2, "t": 0, "pressure": 0.5},
                {"x": 3, "y": 4, "t": 10},
            ],
        }
    ],
    "canvas": {"width": 800, "height": 600},
}


class FakeRecognitionService:
    def __init__(self) -> None:
        self.calls: list[tuple[str, RecognitionRequest]] = []
        self.failure: Exception | None = None

    def _record(self, method_name: str, request: RecognitionRequest) -> None:
        self.calls.append((method_name, request))
        if self.failure is not None:
            raise self.failure

    async def recognize_handwriting(
        self,
        request: HandwritingRecognitionRequest,
    ) -> HandwritingRecognitionResponse:
        self._record("recognize_handwriting", request)
        return HandwritingRecognitionResponse(
            success=True,
            request_id=request.request_id,
            object_id=request.object_id,
            object_version=request.object_version,
            source="mock",
            result=HandwritingRecognitionResult(text="[MOCK] result"),
        )

    async def recognize_geometry(
        self,
        request: GeometryRecognitionRequest,
    ) -> GeometryRecognitionResponse:
        self._record("recognize_geometry", request)
        return GeometryRecognitionResponse(
            success=False,
            request_id=request.request_id,
            object_id=request.object_id,
            object_version=request.object_version,
            source="mock",
            error="Mock geometry recognition is unavailable.",
        )

    async def recognize_equation(
        self,
        request: EquationRecognitionRequest,
    ) -> EquationRecognitionResponse:
        self._record("recognize_equation", request)
        return EquationRecognitionResponse(
            success=True,
            request_id=request.request_id,
            object_id=request.object_id,
            object_version=request.object_version,
            source="mock",
            result=EquationRecognitionResult(
                latex="x",
                expression="x",
                function_type="linear",
                is_graphable=True,
            ),
        )


@pytest.fixture
def api_service():
    service = FakeRecognitionService()
    app.dependency_overrides[get_recognition_service] = lambda: service
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client, service
    app.dependency_overrides.pop(get_recognition_service, None)


@pytest.mark.parametrize(
    ("path", "method_name", "response_type", "expected_success"),
    [
        (
            "/api/recognition/handwriting",
            "recognize_handwriting",
            HandwritingRecognitionResponse,
            True,
        ),
        (
            "/api/recognition/geometry",
            "recognize_geometry",
            GeometryRecognitionResponse,
            False,
        ),
        (
            "/api/recognition/equation",
            "recognize_equation",
            EquationRecognitionResponse,
            True,
        ),
    ],
)
def test_recognition_endpoints_call_correct_service_and_return_schema(
    api_service,
    path: str,
    method_name: str,
    response_type: type,
    expected_success: bool,
) -> None:
    client, service = api_service
    response = client.post(path, json=REQUEST_DATA)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    parsed_response = response_type.model_validate(response.json())
    assert parsed_response.success is expected_success
    assert parsed_response.source == "mock"
    assert (
        parsed_response.request_id,
        parsed_response.object_id,
        parsed_response.object_version,
    ) == ("api-request-1", "board-object-1", 2)
    assert len(service.calls) == 1
    assert service.calls[0][0] == method_name
    assert isinstance(service.calls[0][1], {
        "recognize_handwriting": HandwritingRecognitionRequest,
        "recognize_geometry": GeometryRecognitionRequest,
        "recognize_equation": EquationRecognitionRequest,
    }[method_name])
    assert service.calls[0][1].model_dump(exclude_unset=True) == REQUEST_DATA


def test_valid_unrecognized_geometry_returns_http_200(api_service) -> None:
    client, _ = api_service

    response = client.post("/api/recognition/geometry", json=REQUEST_DATA)

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["result"] is None
    assert response.json()["error"]


def test_invalid_request_returns_common_422_error(api_service) -> None:
    client, service = api_service
    invalid_data = {**REQUEST_DATA, "strokes": []}

    response = client.post("/api/recognition/handwriting", json=invalid_data)

    assert response.status_code == 422
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert service.calls == []


def test_recognition_body_under_limit_is_processed(api_service) -> None:
    client, service = api_service

    response = client.post(
        "/api/recognition/handwriting",
        json=REQUEST_DATA,
        headers={"content-type": "application/json"},
    )

    assert response.status_code == 200
    assert len(service.calls) == 1


def test_recognition_body_over_limit_returns_413_without_service_call(api_service) -> None:
    client, service = api_service

    response = client.post(
        "/api/recognition/handwriting",
        content=b" " * (1_048_576 + 1),
        headers={"content-type": "application/json"},
    )

    assert response.status_code == 413
    assert response.json() == {
        "success": False,
        "error": {
            "code": "REQUEST_BODY_TOO_LARGE",
            "message": "Request body exceeds the allowed size.",
        },
    }
    assert response.headers["content-type"].startswith("application/json")
    assert service.calls == []


def test_oversized_body_response_includes_cors_for_allowed_frontend(api_service) -> None:
    client, _ = api_service

    response = client.post(
        "/api/recognition/handwriting",
        content=b"x" * (1_048_576 + 1),
        headers={
            "content-type": "application/json",
            "origin": "http://localhost:5173",
        },
    )

    assert response.status_code == 413
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_allows_configured_frontend_origin(api_service) -> None:
    client, _ = api_service

    response = client.post(
        "/api/recognition/handwriting",
        json=REQUEST_DATA,
        headers={"origin": "http://localhost:5173"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_cors_rejects_wildcard_origin_when_credentials_enabled() -> None:
    with pytest.raises(ValidationError, match="Wildcard CORS origins"):
        Settings(allowed_origins=["*"], allow_credentials=True)

    settings = Settings(allowed_origins=["*"], allow_credentials=False)
    assert settings.allowed_origins == ["*"]


def test_cors_allowed_origins_can_be_configured_from_environment(monkeypatch) -> None:
    monkeypatch.setenv(
        "ALLOWED_ORIGINS",
        '["http://localhost:5173","http://localhost:3000"]',
    )
    monkeypatch.setenv("ALLOW_CREDENTIALS", "true")

    configured = Settings(_env_file=None)

    assert configured.allowed_origins == [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    assert configured.allow_credentials is True


def test_request_body_size_setting_is_validated() -> None:
    with pytest.raises(ValidationError):
        Settings(max_request_body_bytes=1_023)

    with pytest.raises(ValidationError):
        Settings(max_request_body_bytes=16_777_217)


@pytest.mark.parametrize(
    ("service_exception", "status_code", "error_code", "message"),
    [
        (
            RecognitionUnavailableError("sensitive provider details"),
            503,
            "RECOGNITION_UNAVAILABLE",
            "Recognition service is temporarily unavailable.",
        ),
        (
            RecognitionTimeoutError("secret timeout context"),
            504,
            "RECOGNITION_TIMEOUT",
            "Recognition request timed out.",
        ),
        (
            RecognitionProcessingError("private model details"),
            502,
            "RECOGNITION_PROCESSING_ERROR",
            "Recognition service could not process the request.",
        ),
    ],
)
def test_service_errors_map_to_safe_http_errors(
    api_service,
    service_exception: Exception,
    status_code: int,
    error_code: str,
    message: str,
) -> None:
    client, service = api_service
    service.failure = service_exception

    response = client.post("/api/recognition/handwriting", json=REQUEST_DATA)

    assert response.status_code == status_code
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {
        "success": False,
        "error": {
            "code": error_code,
            "message": message,
        },
    }
    assert str(service_exception) not in response.text


def test_default_lifespan_provides_configured_mock_service() -> None:
    with TestClient(app) as client:
        handwriting = client.post(
            "/api/recognition/handwriting",
            json=REQUEST_DATA,
        )
        geometry = client.post("/api/recognition/geometry", json=REQUEST_DATA)
        equation = client.post("/api/recognition/equation", json=REQUEST_DATA)

    assert handwriting.status_code == 200
    assert handwriting.json()["source"] == "mock"
    assert handwriting.json()["result"]["text"].startswith("[MOCK]")
    assert geometry.status_code == 200
    assert geometry.json()["success"] is False
    assert equation.status_code == 200
    assert equation.json()["success"] is False


def test_unexpected_error_is_logged_and_hidden_from_client(api_service, caplog) -> None:
    client, service = api_service
    service.failure = RuntimeError("internal token or stack detail")

    response = client.post("/api/recognition/handwriting", json=REQUEST_DATA)

    assert response.status_code == 500
    assert response.json() == {
        "success": False,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred.",
        },
    }
    assert "internal token or stack detail" not in response.text
    assert "Unhandled exception" in caplog.text


def test_openapi_documents_recognition_routes_and_error_responses() -> None:
    with TestClient(app) as client:
        openapi = client.get("/openapi.json").json()

    expected_paths = {
        "/api/recognition/handwriting",
        "/api/recognition/geometry",
        "/api/recognition/equation",
    }
    assert expected_paths <= openapi["paths"].keys()

    for path in expected_paths:
        operation = openapi["paths"][path]["post"]
        assert operation["tags"] == ["Recognition"]
        assert operation["summary"]
        assert "application/json" in operation["requestBody"]["content"]
        assert "application/json" in operation["responses"]["200"]["content"]
        for status_code in ("413", "422", "500", "502", "503", "504"):
            assert status_code in operation["responses"]
            assert (
                "application/json"
                in operation["responses"][status_code]["content"]
            )


def test_root_health_readiness_and_swagger_still_work() -> None:
    with TestClient(app) as client:
        assert client.get("/").status_code == 200
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/ready").status_code == 200
        assert client.get("/docs").status_code == 200
