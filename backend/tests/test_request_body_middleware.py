import json

import pytest

from app.core.middleware import RequestBodyLimitMiddleware

SCOPE = {
    "type": "http",
    "method": "POST",
    "path": "/api/recognition/handwriting",
    "headers": [],
}


@pytest.mark.asyncio
async def test_streaming_body_without_content_length_is_rejected_when_over_limit() -> None:
    app_called = False
    response_messages = []
    chunks = iter(
        [
            {"type": "http.request", "body": b"a" * 700, "more_body": True},
            {"type": "http.request", "body": b"b" * 325, "more_body": False},
        ]
    )

    async def app(scope, receive, send):
        nonlocal app_called
        app_called = True

    async def receive():
        return next(chunks)

    async def send(message):
        response_messages.append(message)

    middleware = RequestBodyLimitMiddleware(app, max_body_size=1_024)
    await middleware(SCOPE, receive, send)

    assert app_called is False
    assert response_messages[0]["status"] == 413
    body = json.loads(response_messages[1]["body"])
    assert body["error"]["code"] == "REQUEST_BODY_TOO_LARGE"


@pytest.mark.asyncio
async def test_streaming_body_within_limit_is_replayed_to_application() -> None:
    app_called = False
    response_messages = []
    chunks = iter(
        [
            {"type": "http.request", "body": b"small ", "more_body": True},
            {"type": "http.request", "body": b"body", "more_body": False},
        ]
    )

    async def app(scope, receive, send):
        nonlocal app_called
        app_called = True
        request_message = await receive()
        assert request_message["body"] == b"small body"
        assert request_message["more_body"] is False

    async def receive():
        return next(chunks)

    async def send(message):
        response_messages.append(message)

    middleware = RequestBodyLimitMiddleware(app, max_body_size=1_024)
    await middleware(SCOPE, receive, send)

    assert app_called is True
    assert response_messages == []
