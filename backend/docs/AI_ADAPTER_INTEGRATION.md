# AI Adapter Integration Guide

This guide describes the adapter boundary that a teammate can implement for
real recognition providers. No real model or provider integration exists yet.

## Architecture

HTTP routes depend on `RecognitionService`, not on provider SDKs. The service
coordinates feature-specific adapters, applies a shared concurrency limit and
per-operation timeout, and preserves request metadata. Adapters implement the
asynchronous `RecognitionAdapter` Protocol in `app/adapters/base.py`:

```python
class RecognitionAdapter(Protocol[RequestT, ResponseT]):
    async def recognize(self, request: RequestT) -> ResponseT:
        ...
```

The request type is a validated Pydantic request schema. The adapter returns
the matching feature-specific Pydantic response schema. Adapters should not
depend on FastAPI request or response objects.

## Feature adapter contracts

| Feature | Request | Adapter method | Response |
|---|---|---|---|
| Handwriting | `HandwritingRecognitionRequest` | `recognize(request)` | `HandwritingRecognitionResponse` |
| Geometry | `GeometryRecognitionRequest` | `recognize(request)` | `GeometryRecognitionResponse` |
| Equation | `EquationRecognitionRequest` | `recognize(request)` | `EquationRecognitionResponse` |

All request models contain `request_id`, `mode`, `object_id`,
`object_version`, `strokes`, and `canvas`. Shared fields, types, and validation
limits are documented in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

An adapter's response envelope contains `success`, `request_id`, `object_id`,
`object_version`, optional `source`, optional `result`, and optional `error`.
Successful responses must contain the feature's result; unsuccessful
recognition responses must not contain a result. Return `source="model"` for
real model results and `source="mock"` only for mock/test results. The service
also copies the three request metadata values onto the returned response if an
adapter returns mismatched metadata.

Feature result schemas:

- **Handwriting:** `text`, optional `confidence` from 0 to 1, and optional
  `cleaned_strokes`. A cleaned stroke is a non-empty list of finite `{x, y}`
  points. If a provider has no cleaned geometry, return `null`; do not
  synthesize it in the adapter.
- **Geometry:** a discriminated `shape_type` (`line`, `circle`, `ellipse`,
  `triangle`, `square`, or `rectangle`), optional confidence, and its matching
  geometry payload. The geometry parameter shapes and constraints are listed
  in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).
- **Equation:** non-empty `latex` and `expression`, `function_type` from
  `linear`, `quadratic`, `cubic`, `polynomial`, `trigonometric`, or `other`,
  optional confidence, and `is_graphable`. `expression` is data and must not be
  evaluated as Python code.

## Current mock adapters

The lifespan in `app/main.py` currently constructs one each of
`MockHandwritingAdapter`, `MockGeometryAdapter`, and `MockEquationAdapter`,
then injects them into one `RecognitionService` instance:

- `MockHandwritingAdapter` returns `success=true`, `source="mock"`, and the
  explicit placeholder text `[MOCK] Handwriting recognition is not
  implemented.` Confidence and cleaned strokes are `null`.
- `MockGeometryAdapter` returns `success=false`, `source="mock"`, no result,
  and a reason that no shape was inferred.
- `MockEquationAdapter` returns `success=false`, `source="mock"`, no result,
  and a reason that no expression was inferred.

These are predictable development responses, not AI inference.

## Replacing the mocks

The current provider setting is intentionally limited:

```python
ai_provider: Literal["mock"] = "mock"
```

`AI_PROVIDER=mock` is the only supported value. `app/main.py` checks the value
when the application lifespan starts and raises an error for an unsupported
provider. There is no model provider, SDK, model configuration, or credential
handling in this project yet.

To add a real provider in a later task:

1. Agree on provider output semantics, coordinate units, confidence meaning,
   and behavior for uncertain or unrecognized input.
2. Implement one asynchronous adapter per capability, conforming to the
   Protocol and returning the existing feature response model.
3. Translate provider-specific output into the existing Pydantic result
   schema. Validate model output before returning it; do not expose raw SDK
   objects or provider exceptions.
4. Raise `AdapterUnavailableError` when the provider is unavailable,
   `AdapterTimeoutError` for a provider timeout, and `AdapterError` for other
   known provider failures. Allow unexpected programming errors to propagate
   so they are logged and handled as internal errors.
5. Add explicit settings for provider selection and required configuration,
   validate them at startup, and inject the chosen adapter instances from the
   app lifespan. Do not create model clients inside request handlers or
   service methods.
6. Add unit and API integration tests for schema conversion, cancellation,
   timeouts, availability, and safe error responses.

Do not change the existing HTTP contract merely to mirror a provider SDK. If a
schema change is truly necessary, coordinate and document it separately.

## Execution, timeout, and concurrency

The service calls each adapter using `await adapter.recognize(request)`.
Inference is therefore asynchronous from the service's perspective. A provider
adapter may call an async SDK directly; if a provider offers only blocking
inference, its implementation must avoid blocking the event loop (for example
by using an appropriate executor) while preserving cancellation and timeout
behavior.

The current defaults are a 30-second recognition timeout and a maximum of 10
concurrent recognition operations per service instance. The timeout covers
both waiting for the shared semaphore and adapter execution. The semaphore is
shared across all three features in that service. Configure them with
`RECOGNITION_TIMEOUT_SECONDS` and
`MAX_CONCURRENT_RECOGNITION_REQUESTS`. There are no retries.

## Error mapping

Adapters report known failures with exceptions from `app/adapters/base.py`:

| Adapter failure | Service exception | HTTP status |
|---|---|---:|
| `AdapterTimeoutError` or service timeout | `RecognitionTimeoutError` | 504 |
| `AdapterUnavailableError` | `RecognitionUnavailableError` | 503 |
| Other `AdapterError` | `RecognitionProcessingError` | 502 |
| Unexpected exception | Propagates to centralized handler | 500 |

The service preserves exception chaining for server-side diagnosis. HTTP
handlers return a safe common error envelope and do not return exception
messages, tracebacks, secrets, or file paths to clients. A valid
`success=false` recognition response is not an adapter failure and remains
HTTP 200.

## Current limitations

- Only mock adapters are wired and accepted by configuration.
- Geometry and equation mock adapters intentionally do not infer results.
- The handwriting mock returns placeholder text, not recognized handwriting.
- There is no model SDK, model endpoint, credential configuration, retry
  policy, or graph sampling implementation.
- Production deployment, model-specific resource controls, and provider
  observability need separate design and testing.
