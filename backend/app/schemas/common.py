from typing import Any, Literal

from pydantic import BaseModel


class SuccessResponse(BaseModel):
    success: Literal[True] = True
    message: str
    data: dict[str, Any] | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    success: Literal[False] = False
    error: ErrorDetail
