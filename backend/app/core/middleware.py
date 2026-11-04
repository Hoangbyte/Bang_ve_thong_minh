"""HTTP middleware for limiting recognition request bodies."""

import json
import logging
from collections.abc import Awaitable, Callable
from time import perf_counter
from typing import Any

from app.schemas.common import ErrorDetail, ErrorResponse

ASGIMessage = dict[str, Any]
ASGIReceive = Callable[[], Awaitable[ASGIMessage]]
ASGISend = Callable[[ASGIMessage], Awaitable[None]]
RECOGNITION_PATHS = {
    "/api/recognition/handwriting",
    "/api/recognition/geometry",
    "/api/recognition/equation",
}

logger = logging.getLogger(__name__)


class RequestBodyLimitMiddleware:
    """Buffer bounded recognition bodies before passing them to JSON parsing."""

    def __init__(self, app: Any, *, max_body_size: int) -> None:
        self.app = app
        self.max_body_size = max_body_size

    async def __call__(
        self,
        scope: dict[str, Any],
        receive: ASGIReceive,
        send: ASGISend,
    ) -> None:
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
            or scope["path"] not in RECOGNITION_PATHS
        ):
            await self.app(scope, receive, send)
            return

        started_at = perf_counter()
        content_length = self._content_length(scope)
        if content_length is not None and content_length > self.max_body_size:
            await self._reject(scope, send, started_at)
            return

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return

            body.extend(message.get("body", b""))
            if len(body) > self.max_body_size:
                await self._reject(scope, send, started_at)
                return
            if not message.get("more_body", False):
                break

        body_bytes = bytes(body)
        has_replayed_body = False

        async def replay_body() -> ASGIMessage:
            nonlocal has_replayed_body
            if not has_replayed_body:
                has_replayed_body = True
                return {
                    "type": "http.request",
                    "body": body_bytes,
                    "more_body": False,
                }
            return await receive()

        await self.app(scope, replay_body, send)

    @staticmethod
    def _content_length(scope: dict[str, Any]) -> int | None:
        for name, value in scope.get("headers", []):
            if name.lower() == b"content-length":
                try:
                    return int(value)
                except ValueError:
                    return None
        return None

    async def _reject(
        self,
        scope: dict[str, Any],
        send: ASGISend,
        started_at: float,
    ) -> None:
        duration_ms = (perf_counter() - started_at) * 1_000
        logger.warning(
            "Recognition request rejected: request_id=%s endpoint=%s "
            "category=request_body_too_large duration_ms=%.2f",
            self._request_id(scope),
            scope["path"],
            duration_ms,
        )
        response = ErrorResponse(
            error=ErrorDetail(
                code="REQUEST_BODY_TOO_LARGE",
                message="Request body exceeds the allowed size.",
            )
        )
        response_body = json.dumps(response.model_dump()).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(response_body)).encode("ascii")),
                ],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": response_body,
            }
        )

    @staticmethod
    def _request_id(scope: dict[str, Any]) -> str:
        for name, value in scope.get("headers", []):
            if name.lower() == b"x-request-id":
                request_id = value.decode("latin-1")[:128]
                return "".join(
                    character if character.isprintable() else "?"
                    for character in request_id
                )
        return "unavailable"
