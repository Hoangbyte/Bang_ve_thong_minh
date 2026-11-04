import asyncio
from collections.abc import Awaitable, Callable
from typing import Generic, TypeVar

import pytest
from pydantic import ValidationError

from app.adapters.base import (
    AdapterError,
    AdapterTimeoutError,
    AdapterUnavailableError,
    RecognitionAdapter,
)
from app.core.config import Settings
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
    RecognitionResponse,
)
from app.services.recognition_service import (
    RecognitionProcessingError,
    RecognitionService,
    RecognitionTimeoutError,
    RecognitionUnavailableError,
)

RequestT = TypeVar("RequestT", bound=RecognitionRequest)
ResponseT = TypeVar("ResponseT", bound=RecognitionResponse)


class FakeAdapter(Generic[RequestT, ResponseT]):
    def __init__(
        self,
        response: ResponseT,
        handler: Callable[[RequestT], Awaitable[ResponseT]] | None = None,
    ) -> None:
        self.response = response
        self.handler = handler
        self.requests: list[RequestT] = []

    async def recognize(self, request: RequestT) -> ResponseT:
        self.requests.append(request)
        if self.handler is not None:
            return await self.handler(request)
        return self.response


def settings(
    *,
    timeout: float = 1.0,
    max_concurrent: int = 3,
) -> Settings:
    return Settings(
        recognition_timeout_seconds=timeout,
        max_concurrent_recognition_requests=max_concurrent,
    )


def handwriting_request() -> HandwritingRecognitionRequest:
    return HandwritingRecognitionRequest(
        request_id="request-handwriting",
        mode="manual",
        object_id="object-handwriting",
        object_version=4,
        strokes=[
            {"id": "stroke-1", "points": [{"x": 1, "y": 2, "t": 0}]}
        ],
        canvas={"width": 800, "height": 600},
    )


def geometry_request() -> GeometryRecognitionRequest:
    return GeometryRecognitionRequest(
        request_id="request-geometry",
        mode="automatic",
        object_id="object-geometry",
        object_version=5,
        strokes=[
            {"id": "stroke-1", "points": [{"x": 2, "y": 3, "t": 0}]}
        ],
        canvas={"width": 800, "height": 600},
    )


def equation_request() -> EquationRecognitionRequest:
    return EquationRecognitionRequest(
        request_id="request-equation",
        mode="manual",
        object_id="object-equation",
        object_version=6,
        strokes=[
            {"id": "stroke-1", "points": [{"x": 3, "y": 4, "t": 0}]}
        ],
        canvas={"width": 800, "height": 600},
    )


def handwriting_response() -> HandwritingRecognitionResponse:
    return HandwritingRecognitionResponse(
        success=True,
        request_id="adapter-request",
        object_id="adapter-object",
        object_version=0,
        source="mock",
        result=HandwritingRecognitionResult(text="[MOCK] recognized"),
    )


def geometry_response() -> GeometryRecognitionResponse:
    return GeometryRecognitionResponse(
        success=False,
        request_id="adapter-request",
        object_id="adapter-object",
        object_version=0,
        source="mock",
        error="Not available",
    )


def equation_response() -> EquationRecognitionResponse:
    return EquationRecognitionResponse(
        success=True,
        request_id="adapter-request",
        object_id="adapter-object",
        object_version=0,
        source="mock",
        result=EquationRecognitionResult(
            latex="x",
            expression="x",
            function_type="linear",
            is_graphable=True,
        ),
    )


def make_service(
    *,
    handwriting_adapter: RecognitionAdapter[
        HandwritingRecognitionRequest,
        HandwritingRecognitionResponse,
    ]
    | None = None,
    geometry_adapter: RecognitionAdapter[
        GeometryRecognitionRequest,
        GeometryRecognitionResponse,
    ]
    | None = None,
    equation_adapter: RecognitionAdapter[
        EquationRecognitionRequest,
        EquationRecognitionResponse,
    ]
    | None = None,
    config: Settings | None = None,
) -> RecognitionService:
    return RecognitionService(
        handwriting_adapter=handwriting_adapter
        or FakeAdapter(handwriting_response()),
        geometry_adapter=geometry_adapter or FakeAdapter(geometry_response()),
        equation_adapter=equation_adapter or FakeAdapter(equation_response()),
        settings=config or settings(),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method_name", "request_factory", "response_factory", "adapter_field"),
    [
        (
            "recognize_handwriting",
            handwriting_request,
            handwriting_response,
            "handwriting_adapter",
        ),
        (
            "recognize_geometry",
            geometry_request,
            geometry_response,
            "geometry_adapter",
        ),
        (
            "recognize_equation",
            equation_request,
            equation_response,
            "equation_adapter",
        ),
    ],
)
async def test_feature_method_calls_its_adapter_and_preserves_metadata(
    method_name: str,
    request_factory: Callable[[], RecognitionRequest],
    response_factory: Callable[[], RecognitionResponse],
    adapter_field: str,
) -> None:
    input_request = request_factory()
    adapter = FakeAdapter(response_factory())
    service = make_service(**{adapter_field: adapter})

    result = await getattr(service, method_name)(input_request)

    assert adapter.requests == [input_request]
    assert result.request_id == input_request.request_id
    assert result.object_id == input_request.object_id
    assert result.object_version == input_request.object_version
    assert result is not adapter.response
    assert type(result) is type(adapter.response)
    assert result.success == adapter.response.success
    assert result.source == adapter.response.source
    assert result.result == adapter.response.result
    assert result.error == adapter.response.error


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("adapter_error", "service_error"),
    [
        (AdapterTimeoutError("adapter timeout"), RecognitionTimeoutError),
        (AdapterUnavailableError("adapter offline"), RecognitionUnavailableError),
        (AdapterError("adapter failure"), RecognitionProcessingError),
    ],
)
async def test_known_adapter_errors_are_mapped_and_chained(
    adapter_error: AdapterError,
    service_error: type[Exception],
) -> None:
    class FailingAdapter(FakeAdapter):
        async def recognize(self, request):
            raise adapter_error

    service = make_service(handwriting_adapter=FailingAdapter(handwriting_response()))

    with pytest.raises(service_error) as error:
        await service.recognize_handwriting(handwriting_request())

    assert error.value.__cause__ is adapter_error


@pytest.mark.asyncio
async def test_unexpected_adapter_errors_propagate_and_do_not_become_success() -> None:
    calls = 0

    class BrokenAdapter(FakeAdapter):
        async def recognize(self, request):
            nonlocal calls
            calls += 1
            if calls == 1:
                raise RuntimeError("unexpected programming error")
            return handwriting_response()

    service = make_service(
        handwriting_adapter=BrokenAdapter(handwriting_response()),
        config=settings(max_concurrent=1),
    )

    with pytest.raises(RuntimeError, match="unexpected programming error"):
        await service.recognize_handwriting(handwriting_request())

    response = await service.recognize_handwriting(handwriting_request())
    assert response.success is True
    assert calls == 2


@pytest.mark.asyncio
async def test_timeout_cancels_waiting_adapter_and_releases_permit() -> None:
    started = asyncio.Event()
    cancelled = asyncio.Event()
    calls = 0

    class SlowOnceAdapter(FakeAdapter):
        async def recognize(self, request):
            nonlocal calls
            calls += 1
            if calls == 1:
                started.set()
                try:
                    await asyncio.Event().wait()
                finally:
                    cancelled.set()
            return handwriting_response()

    service = make_service(
        handwriting_adapter=SlowOnceAdapter(handwriting_response()),
        config=settings(timeout=0.02, max_concurrent=1),
    )

    with pytest.raises(RecognitionTimeoutError) as error:
        await asyncio.wait_for(
            service.recognize_handwriting(handwriting_request()),
            timeout=1,
        )

    assert isinstance(error.value.__cause__, TimeoutError)
    assert started.is_set()
    assert cancelled.is_set()
    response = await service.recognize_handwriting(handwriting_request())
    assert response.success is True
    assert calls == 2


@pytest.mark.asyncio
async def test_semaphore_is_released_after_adapter_failure() -> None:
    calls = 0
    failure = AdapterUnavailableError("offline")

    class FailingOnceAdapter(FakeAdapter):
        async def recognize(self, request):
            nonlocal calls
            calls += 1
            if calls == 1:
                raise failure
            return handwriting_response()

    service = make_service(
        handwriting_adapter=FailingOnceAdapter(handwriting_response()),
        config=settings(max_concurrent=1),
    )

    with pytest.raises(RecognitionUnavailableError):
        await service.recognize_handwriting(handwriting_request())

    assert (await service.recognize_handwriting(handwriting_request())).success
    assert calls == 2


@pytest.mark.asyncio
async def test_semaphore_is_released_after_success() -> None:
    service = make_service(config=settings(max_concurrent=1))

    first = await service.recognize_handwriting(handwriting_request())
    second = await service.recognize_geometry(geometry_request())

    assert first.success is True
    assert second.success is False


@pytest.mark.asyncio
async def test_shared_concurrency_limit_allows_different_features_to_run_together() -> None:
    release_adapters = asyncio.Event()
    two_adapters_started = asyncio.Event()
    started_features: list[str] = []
    active = 0
    maximum_active = 0

    def blocking_handler(feature: str):
        async def handle(request):
            nonlocal active, maximum_active
            active += 1
            maximum_active = max(maximum_active, active)
            started_features.append(feature)
            if active == 2:
                two_adapters_started.set()
            try:
                await release_adapters.wait()
                if feature == "handwriting":
                    return handwriting_response()
                if feature == "geometry":
                    return geometry_response()
                return equation_response()
            finally:
                active -= 1

        return handle

    handwriting_adapter = FakeAdapter(
        handwriting_response(),
        blocking_handler("handwriting"),
    )
    geometry_adapter = FakeAdapter(geometry_response(), blocking_handler("geometry"))
    equation_adapter = FakeAdapter(equation_response(), blocking_handler("equation"))
    service = make_service(
        handwriting_adapter=handwriting_adapter,
        geometry_adapter=geometry_adapter,
        equation_adapter=equation_adapter,
        config=settings(max_concurrent=2),
    )
    tasks = [
        asyncio.create_task(service.recognize_handwriting(handwriting_request())),
        asyncio.create_task(service.recognize_geometry(geometry_request())),
        asyncio.create_task(service.recognize_equation(equation_request())),
    ]

    try:
        await asyncio.wait_for(two_adapters_started.wait(), timeout=1)
        await asyncio.sleep(0)
        assert set(started_features) == {"handwriting", "geometry"}
        assert maximum_active == 2
        assert not tasks[2].done()
    finally:
        release_adapters.set()
    results = await asyncio.gather(*tasks)

    assert len(results) == 3
    assert set(started_features) == {"handwriting", "geometry", "equation"}
    assert maximum_active == 2


@pytest.mark.asyncio
async def test_settings_validate_timeout_and_concurrency_values() -> None:
    with pytest.raises(ValidationError):
        Settings(recognition_timeout_seconds=0)

    with pytest.raises(ValidationError):
        Settings(recognition_timeout_seconds=float("inf"))

    with pytest.raises(ValidationError):
        Settings(max_concurrent_recognition_requests=0)
