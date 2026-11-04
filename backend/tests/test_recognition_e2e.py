"""End-to-end recognition API tests using only local mock/test adapters."""

import asyncio
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Any

import httpx2
import pytest
from pydantic import BaseModel

from app.main import app
from app.adapters.base import AdapterError, AdapterTimeoutError, AdapterUnavailableError
from app.core.config import Settings
from app.schemas.recognition import (
    CircleGeometry,
    CircleRecognitionResult,
    CleanedStroke,
    EllipseGeometry,
    EllipseRecognitionResult,
    EquationRecognitionResponse,
    EquationRecognitionResult,
    GeometryRecognitionResponse,
    HandwritingRecognitionRequest,
    HandwritingRecognitionResponse,
    HandwritingRecognitionResult,
    LineGeometry,
    LineRecognitionResult,
    Point2D,
    RecognitionRequest,
    RectangleGeometry,
    RectangleRecognitionResult,
    SquareGeometry,
    SquareRecognitionResult,
    TriangleGeometry,
    TriangleRecognitionResult,
)
from app.services.recognition_service import RecognitionService

HANDWRITING_PATH = "/api/recognition/handwriting"
GEOMETRY_PATH = "/api/recognition/geometry"
EQUATION_PATH = "/api/recognition/equation"


def request_body(
    *,
    request_id: str = "e2e-request",
    object_id: str = "e2e-object",
    object_version: int = 12,
) -> dict[str, Any]:
    return {
        "request_id": request_id,
        "mode": "manual",
        "object_id": object_id,
        "object_version": object_version,
        "strokes": [
            {
                "id": "stroke-1",
                "points": [
                    {"x": 10, "y": 20, "t": 0, "pressure": 0.6},
                    {"x": 15, "y": 25, "t": 10},
                ],
            }
        ],
        "canvas": {"width": 800, "height": 600},
    }


@asynccontextmanager
async def api_client(
    service: RecognitionService | None = None,
) -> AsyncIterator[httpx2.AsyncClient]:
    async with app.router.lifespan_context(app):
        if service is not None:
            app.state.recognition_service = service
        transport = httpx2.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx2.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            yield client


class ResultAdapter:
    """Local deterministic adapter for exercising successful response contracts."""

    def __init__(
        self,
        response_factory: Callable[[RecognitionRequest], BaseModel],
        *,
        started: asyncio.Event | None = None,
        release: asyncio.Event | None = None,
        fail_once: Exception | None = None,
        failure_detail: str | None = None,
    ) -> None:
        self.response_factory = response_factory
        self.started = started
        self.release = release
        self.fail_once = fail_once
        self.failure_detail = failure_detail
        self.calls: list[RecognitionRequest] = []
        self.active = 0
        self.max_active = 0
        self._failure_used = False

    async def recognize(self, request: RecognitionRequest) -> Any:
        self.calls.append(request)
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            if self.started is not None:
                self.started.set()
            if self.fail_once is not None and not self._failure_used:
                self._failure_used = True
                raise self.fail_once
            if self.failure_detail is not None:
                raise RuntimeError(self.failure_detail)
            if self.release is not None:
                await self.release.wait()
            return self.response_factory(request)
        finally:
            self.active -= 1


def handwriting_result(request: RecognitionRequest) -> HandwritingRecognitionResult:
    return HandwritingRecognitionResult(
        text="[MOCK TEST] text is not actual handwriting recognition",
        confidence=0.8,
        cleaned_strokes=[
            CleanedStroke(
                points=[
                    Point2D(x=point.x, y=point.y)
                    for point in stroke.points
                ]
            )
            for stroke in request.strokes
        ],
    )


def handwriting_response(
    request: RecognitionRequest,
) -> HandwritingRecognitionResponse:
    return HandwritingRecognitionResponse(
        success=True,
        request_id=request.request_id,
        object_id=request.object_id,
        object_version=request.object_version,
        source="mock",
        result=handwriting_result(request),
    )


SHAPE_CASES = [
    (
        "line",
        LineRecognitionResult(
            shape_type="line",
            confidence=0.91,
            geometry=LineGeometry(
                start=Point2D(x=0, y=0),
                end=Point2D(x=10, y=10),
            ),
        ),
        {"start": {"x": 0, "y": 0}, "end": {"x": 10, "y": 10}},
    ),
    (
        "circle",
        CircleRecognitionResult(
            shape_type="circle",
            confidence=0.91,
            geometry=CircleGeometry(center=Point2D(x=5, y=5), radius=3),
        ),
        {"center": {"x": 5, "y": 5}, "radius": 3},
    ),
    (
        "ellipse",
        EllipseRecognitionResult(
            shape_type="ellipse",
            confidence=0.91,
            geometry=EllipseGeometry(
                center=Point2D(x=5, y=5),
                semi_major_axis=6,
                semi_minor_axis=3,
                rotation=0.25,
            ),
        ),
        {
            "center": {"x": 5, "y": 5},
            "semi_major_axis": 6,
            "semi_minor_axis": 3,
            "rotation": 0.25,
        },
    ),
    (
        "triangle",
        TriangleRecognitionResult(
            shape_type="triangle",
            confidence=0.91,
            geometry=TriangleGeometry(
                vertices=(
                    Point2D(x=0, y=0),
                    Point2D(x=4, y=0),
                    Point2D(x=2, y=3),
                )
            ),
        ),
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
        SquareRecognitionResult(
            shape_type="square",
            confidence=0.91,
            geometry=SquareGeometry(
                vertices=(
                    Point2D(x=0, y=0),
                    Point2D(x=2, y=0),
                    Point2D(x=2, y=2),
                    Point2D(x=0, y=2),
                )
            ),
        ),
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
        RectangleRecognitionResult(
            shape_type="rectangle",
            confidence=0.91,
            geometry=RectangleGeometry(
                vertices=(
                    Point2D(x=0, y=0),
                    Point2D(x=4, y=0),
                    Point2D(x=4, y=2),
                    Point2D(x=0, y=2),
                )
            ),
        ),
        {
            "vertices": [
                {"x": 0, "y": 0},
                {"x": 4, "y": 0},
                {"x": 4, "y": 2},
                {"x": 0, "y": 2},
            ]
        },
    ),
]


def equation_response(request: RecognitionRequest) -> EquationRecognitionResponse:
    return EquationRecognitionResponse(
        success=True,
        request_id=request.request_id,
        object_id=request.object_id,
        object_version=request.object_version,
        source="mock",
        result=EquationRecognitionResult(
            latex=r"y = x^2",
            expression="x**2",
            function_type="quadratic",
            confidence=0.94,
            is_graphable=True,
        ),
    )


def make_service(
    *,
    handwriting_adapter: Any | None = None,
    geometry_adapter: Any | None = None,
    equation_adapter: Any | None = None,
    timeout: float = 30,
    max_concurrent: int = 10,
) -> RecognitionService:
    return RecognitionService(
        handwriting_adapter=handwriting_adapter or ResultAdapter(handwriting_response),
        geometry_adapter=geometry_adapter
        or ResultAdapter(unavailable_geometry_response),
        equation_adapter=equation_adapter or ResultAdapter(equation_response),
        settings=Settings(
            recognition_timeout_seconds=timeout,
            max_concurrent_recognition_requests=max_concurrent,
        ),
    )


def unavailable_geometry_response(
    request: RecognitionRequest,
) -> GeometryRecognitionResponse:
    return GeometryRecognitionResponse(
        success=False,
        request_id=request.request_id,
        object_id=request.object_id,
        object_version=request.object_version,
        source="mock",
        error="No shape was inferred.",
    )


@pytest.mark.asyncio
async def test_existing_mock_adapters_complete_all_three_http_flows() -> None:
    async with api_client() as client:
        handwriting = await client.post(HANDWRITING_PATH, json=request_body())
        geometry = await client.post(GEOMETRY_PATH, json=request_body())
        equation = await client.post(EQUATION_PATH, json=request_body())

    handwriting_response = HandwritingRecognitionResponse.model_validate(
        handwriting.json()
    )
    geometry_response = GeometryRecognitionResponse.model_validate(geometry.json())
    equation_response = EquationRecognitionResponse.model_validate(equation.json())

    assert handwriting.status_code == 200
    assert handwriting_response.success is True
    assert handwriting_response.source == "mock"
    assert handwriting_response.result is not None
    assert handwriting_response.result.text.startswith("[MOCK]")
    assert handwriting_response.result.cleaned_strokes is None

    assert geometry.status_code == 200
    assert geometry_response.success is False
    assert geometry_response.source == "mock"
    assert geometry_response.result is None
    assert "no shape was inferred" in (geometry_response.error or "").lower()

    assert equation.status_code == 200
    assert equation_response.success is False
    assert equation_response.source == "mock"
    assert equation_response.result is None
    assert "no expression was inferred" in (equation_response.error or "").lower()


@pytest.mark.asyncio
async def test_handwriting_success_flow_returns_schema_and_input_derived_strokes() -> None:
    adapter = ResultAdapter(handwriting_response)
    service = make_service(handwriting_adapter=adapter)
    body = request_body()

    async with api_client(service) as client:
        response = await client.post(HANDWRITING_PATH, json=body)

    parsed = HandwritingRecognitionResponse.model_validate(response.json())
    assert response.status_code == 200
    assert parsed.success is True
    assert parsed.source == "mock"
    assert parsed.request_id == body["request_id"]
    assert parsed.object_id == body["object_id"]
    assert parsed.object_version == body["object_version"]
    assert parsed.result is not None
    assert parsed.result.text.startswith("[MOCK TEST]")
    assert parsed.result.confidence == 0.8
    assert 0 <= parsed.result.confidence <= 1
    assert [
        point.model_dump()
        for point in parsed.result.cleaned_strokes[0].points
    ] == [{"x": 10, "y": 20}, {"x": 15, "y": 25}]
    assert len(parsed.result.cleaned_strokes) == len(body["strokes"])
    assert set(response.json()) == {
        "success",
        "request_id",
        "object_id",
        "object_version",
        "source",
        "result",
        "error",
    }
    assert "traceback" not in response.text.lower()
    assert adapter.calls[0].request_id == body["request_id"]


@pytest.mark.asyncio
@pytest.mark.parametrize(("shape_type", "result", "expected_geometry"), SHAPE_CASES)
async def test_geometry_success_flow_uses_schema_for_each_supported_shape(
    shape_type: str,
    result: BaseModel,
    expected_geometry: dict[str, Any],
) -> None:
    def geometry_response(request: RecognitionRequest) -> GeometryRecognitionResponse:
        return GeometryRecognitionResponse(
            success=True,
            request_id=request.request_id,
            object_id=request.object_id,
            object_version=request.object_version,
            source="mock",
            result=result,
        )

    adapter = ResultAdapter(geometry_response)
    service = make_service(geometry_adapter=adapter)
    body = request_body()

    async with api_client(service) as client:
        response = await client.post(GEOMETRY_PATH, json=body)

    parsed = GeometryRecognitionResponse.model_validate(response.json())
    assert response.status_code == 200
    assert parsed.success is True
    assert parsed.source == "mock"
    assert (
        parsed.request_id,
        parsed.object_id,
        parsed.object_version,
    ) == (body["request_id"], body["object_id"], body["object_version"])
    assert parsed.result is not None
    assert parsed.result.shape_type == shape_type
    assert parsed.result.confidence == 0.91
    assert 0 <= parsed.result.confidence <= 1
    assert response.json()["result"]["geometry"] == expected_geometry
    assert set(response.json()) == {
        "success",
        "request_id",
        "object_id",
        "object_version",
        "source",
        "result",
        "error",
    }


@pytest.mark.asyncio
async def test_equation_success_flow_returns_normalized_graph_metadata() -> None:
    service = make_service(equation_adapter=ResultAdapter(equation_response))
    body = request_body()

    async with api_client(service) as client:
        response = await client.post(EQUATION_PATH, json=body)

    parsed = EquationRecognitionResponse.model_validate(response.json())
    assert response.status_code == 200
    assert parsed.success is True
    assert parsed.source == "mock"
    assert (
        parsed.request_id,
        parsed.object_id,
        parsed.object_version,
    ) == (body["request_id"], body["object_id"], body["object_version"])
    assert parsed.result is not None
    assert parsed.result.latex == r"y = x^2"
    assert parsed.result.expression == "x**2"
    assert parsed.result.function_type == "quadratic"
    assert parsed.result.is_graphable is True
    assert parsed.result.confidence == 0.94
    assert 0 <= parsed.result.confidence <= 1
    assert "traceback" not in response.text.lower()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("exception", "status_code", "error_code", "sensitive_detail"),
    [
        (
            AdapterUnavailableError("private provider endpoint"),
            503,
            "RECOGNITION_UNAVAILABLE",
            "private provider endpoint",
        ),
        (
            AdapterTimeoutError("secret upstream timeout"),
            504,
            "RECOGNITION_TIMEOUT",
            "secret upstream timeout",
        ),
        (
            AdapterError("private model payload"),
            502,
            "RECOGNITION_PROCESSING_ERROR",
            "private model payload",
        ),
    ],
)
async def test_adapter_failures_follow_http_error_contract(
    exception: Exception,
    status_code: int,
    error_code: str,
    sensitive_detail: str,
) -> None:
    service = make_service(
        handwriting_adapter=ResultAdapter(
            handwriting_response,
            fail_once=exception,
        )
    )

    async with api_client(service) as client:
        response = await client.post(HANDWRITING_PATH, json=request_body())

    assert response.status_code == status_code
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == error_code
    assert sensitive_detail not in response.text
    assert "Traceback" not in response.text


@pytest.mark.asyncio
async def test_unexpected_adapter_exception_is_hidden_by_http_error_handler() -> None:
    service = make_service(
        handwriting_adapter=ResultAdapter(
            handwriting_response,
            failure_detail="private token and filesystem path",
        )
    )

    async with api_client(service) as client:
        response = await client.post(HANDWRITING_PATH, json=request_body())

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"
    assert "private token" not in response.text
    assert "filesystem" not in response.text
    assert "Traceback" not in response.text


@pytest.mark.asyncio
async def test_slow_handwriting_does_not_block_unrelated_geometry_request() -> None:
    handwriting_started = asyncio.Event()
    release_handwriting = asyncio.Event()
    handwriting_adapter = ResultAdapter(
        handwriting_response,
        started=handwriting_started,
        release=release_handwriting,
    )
    geometry_adapter = ResultAdapter(unavailable_geometry_response)
    service = make_service(
        handwriting_adapter=handwriting_adapter,
        geometry_adapter=geometry_adapter,
        max_concurrent=2,
    )

    async with api_client(service) as client:
        slow_request = asyncio.create_task(
            client.post(HANDWRITING_PATH, json=request_body(request_id="slow"))
        )
        try:
            await asyncio.wait_for(handwriting_started.wait(), timeout=1)
            fast_response = await asyncio.wait_for(
                client.post(GEOMETRY_PATH, json=request_body(request_id="fast")),
                timeout=1,
            )
            assert fast_response.status_code == 200
            assert fast_response.json()["success"] is False
            assert not slow_request.done()
        finally:
            release_handwriting.set()
        slow_response = await asyncio.wait_for(slow_request, timeout=1)

    assert slow_response.status_code == 200
    assert slow_response.json()["request_id"] == "slow"


@pytest.mark.asyncio
async def test_shared_service_concurrency_limit_is_respected_across_endpoints() -> None:
    release = asyncio.Event()
    two_started = asyncio.Event()
    active = 0
    maximum_active = 0

    class GatedAdapter:
        def __init__(
            self,
            response_factory: Callable[[RecognitionRequest], BaseModel],
        ) -> None:
            self.response_factory = response_factory

        async def recognize(self, request: RecognitionRequest) -> BaseModel:
            nonlocal active, maximum_active
            active += 1
            maximum_active = max(maximum_active, active)
            if active == 2:
                two_started.set()
            try:
                await release.wait()
                return self.response_factory(request)
            finally:
                active -= 1

    service = make_service(
        handwriting_adapter=GatedAdapter(handwriting_response),
        geometry_adapter=GatedAdapter(unavailable_geometry_response),
        equation_adapter=GatedAdapter(equation_response),
        max_concurrent=2,
    )

    async with api_client(service) as client:
        tasks = [
            asyncio.create_task(
                client.post(HANDWRITING_PATH, json=request_body(request_id="h"))
            ),
            asyncio.create_task(
                client.post(GEOMETRY_PATH, json=request_body(request_id="g"))
            ),
            asyncio.create_task(
                client.post(EQUATION_PATH, json=request_body(request_id="e"))
            ),
        ]
        try:
            await asyncio.wait_for(two_started.wait(), timeout=1)
            assert maximum_active == 2
            assert active == 2
        finally:
            release.set()
        responses = await asyncio.gather(*tasks)

    assert all(response.status_code == 200 for response in responses)
    assert maximum_active == 2


@pytest.mark.asyncio
async def test_timed_out_request_releases_permit_for_another_feature() -> None:
    started = asyncio.Event()
    cancelled = asyncio.Event()

    class BlockingOnceAdapter:
        def __init__(self) -> None:
            self.calls = 0

        async def recognize(self, request: HandwritingRecognitionRequest) -> Any:
            self.calls += 1
            if self.calls == 1:
                started.set()
                try:
                    await asyncio.Event().wait()
                finally:
                    cancelled.set()
            return handwriting_response(request)

    service = make_service(
        handwriting_adapter=BlockingOnceAdapter(),
        max_concurrent=1,
        timeout=0.03,
    )

    async with api_client(service) as client:
        timed_out = asyncio.create_task(
            client.post(HANDWRITING_PATH, json=request_body())
        )
        await asyncio.wait_for(started.wait(), timeout=1)
        timeout_response = await asyncio.wait_for(timed_out, timeout=1)
        geometry_response = await asyncio.wait_for(
            client.post(GEOMETRY_PATH, json=request_body(request_id="after-timeout")),
            timeout=1,
        )

    assert cancelled.is_set()
    assert timeout_response.status_code == 504
    assert timeout_response.json()["error"]["code"] == "RECOGNITION_TIMEOUT"
    assert geometry_response.status_code == 200
    assert geometry_response.json()["request_id"] == "after-timeout"


@pytest.mark.asyncio
async def test_out_of_order_requests_keep_their_own_metadata() -> None:
    slow_started = asyncio.Event()
    release_slow = asyncio.Event()

    class MetadataAdapter:
        async def recognize(
            self,
            request: HandwritingRecognitionRequest,
        ) -> HandwritingRecognitionResponse:
            if request.request_id == "older":
                slow_started.set()
                await release_slow.wait()
            return HandwritingRecognitionResponse(
                success=True,
                request_id=request.request_id,
                object_id=request.object_id,
                object_version=request.object_version,
                source="mock",
                result=handwriting_result(request),
            )

    service = make_service(
        handwriting_adapter=MetadataAdapter(),
        max_concurrent=2,
    )

    async with api_client(service) as client:
        older_task = asyncio.create_task(
            client.post(
                HANDWRITING_PATH,
                json=request_body(
                    request_id="older",
                    object_id="object-A",
                    object_version=4,
                ),
            )
        )
        try:
            await asyncio.wait_for(slow_started.wait(), timeout=1)
            newer = await asyncio.wait_for(
                client.post(
                    HANDWRITING_PATH,
                    json=request_body(
                        request_id="newer",
                        object_id="object-B",
                        object_version=9,
                    ),
                ),
                timeout=1,
            )
            assert newer.status_code == 200
            assert newer.json()["request_id"] == "newer"
            assert newer.json()["object_id"] == "object-B"
            assert newer.json()["object_version"] == 9
        finally:
            release_slow.set()
        older = await asyncio.wait_for(older_task, timeout=1)

    assert older.status_code == 200
    assert older.json()["request_id"] == "older"
    assert older.json()["object_id"] == "object-A"
    assert older.json()["object_version"] == 4
