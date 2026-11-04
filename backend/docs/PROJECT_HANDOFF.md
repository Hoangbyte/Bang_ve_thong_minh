# Smart Whiteboard Backend Handoff

## Purpose and responsibilities

The Backend accepts validated drawing stroke data, dispatches requests through
a recognition service to feature-specific adapters, and returns validated
recognition responses with request metadata. It owns request validation,
provider coordination, timeout/concurrency safeguards, and safe HTTP error
responses.

It does **not** own the Frontend canvas state, persist drawing data, render the
canvas, or render graphs.

## Team boundaries

### Frontend

- Capture and submit strokes in the agreed coordinate system.
- Send the required metadata and canvas dimensions.
- Retain `request_id`, `object_id`, and `object_version` to associate results
  with objects and decide whether a response still applies to the current
  drawing state.
- Decide how to redraw successful `cleaned_strokes` or geometry.
- Display equation LaTeX and use graphability metadata with a safe client-side
  rendering path if graphing is added.
- Handle HTTP operational errors separately from an HTTP 200
  `success=false` recognition outcome.

### Backend

- Validate the common Pydantic request contract and enforce the recognition
  body-size limit.
- Route requests through `RecognitionService` and the selected adapters.
- Preserve request metadata in responses.
- Apply configured timeout and shared concurrency controls.
- Map known service failures to safe HTTP errors.

### AI / model integration

- Implement asynchronous adapters behind the existing `RecognitionAdapter`
  Protocol.
- Convert provider output into the existing feature response schemas.
- Define and validate inference semantics, units, confidence, and
  unrecognized-input behavior with the Frontend and Backend owners.
- Keep provider SDK details and secrets out of the API and schema layers.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/recognition/handwriting` | Submit strokes for handwriting recognition. |
| `POST` | `/api/recognition/geometry` | Submit strokes for shape recognition. |
| `POST` | `/api/recognition/equation` | Submit strokes for equation recognition and graphability metadata. |

All recognition requests use `application/json` and the shared fields
`request_id`, `mode`, `object_id`, `object_version`, `strokes`, and `canvas`.
See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for field validation,
complete JSON examples, response shapes, and error codes.

## Data flow

1. The Frontend posts validated-contract JSON stroke data to the appropriate
   recognition endpoint.
2. FastAPI/Pydantic validates request fields. The middleware rejects
   recognition bodies above the configured size before invoking the endpoint.
3. The endpoint obtains `RecognitionService` through the application's
   dependency and invokes its matching feature method.
4. The service uses the injected asynchronous adapter, within its timeout and
   shared concurrency limit.
5. The adapter returns a feature response schema. The service preserves the
   request metadata; FastAPI serializes the typed response.
6. The Frontend uses the metadata to decide whether to apply the result to its
   current canvas state.

## Current implementation status

Implemented:

- FastAPI application metadata, root, health and readiness endpoints.
- Three asynchronous recognition POST endpoints with OpenAPI request,
  response, and operational error documentation.
- Pydantic v2 request and response schemas, including validation limits.
- A RecognitionService with injected adapters, timeout, shared concurrency
  limit, and service-level error types.
- CORS and configurable recognition body-size protection.
- Centralized safe HTTP error responses and server-side logging.
- Mock adapters and tests covering schemas, service behavior, API flows,
  errors, concurrency, and metadata.

Mocked/not implemented:

- `AI_PROVIDER` currently accepts only `mock`; no real AI provider can be
  selected.
- The handwriting adapter returns explicit placeholder text and no cleaned
  strokes.
- The geometry adapter returns an unsuccessful recognition outcome rather
  than guessing a shape.
- The equation adapter returns an unsuccessful recognition outcome rather
  than guessing or executing an expression.
- No database, persistent drawing storage, authentication, chat, graph
  sampling, or canvas rendering is part of this backend scope.

## Before real AI integration

1. Agree with the Frontend on coordinate space, stroke semantics, mode
   behavior, model latency expectations, and how uncertain recognition is
   represented.
2. Implement and test each provider adapter against the existing Protocol and
   Pydantic response schemas.
3. Design validated provider selection and secret configuration. The current
   settings explicitly allow only `mock`; adding a provider requires a code
   change and startup validation, not just changing `.env`.
4. Define provider timeout/cancellation behavior, resource limits, logging,
   data privacy, and deployment requirements.
5. Run full unit and API integration tests with deterministic test adapters,
   then separately validate model behavior with approved model test data.
6. Coordinate any contract change before modifying schemas or Frontend
   integration.

## Known limitations and decisions

- Current mock responses cannot demonstrate real handwriting, geometry, or
  equation quality.
- Geometry and equation successful response schemas are available, but the
  current adapters do not emit those results.
- The backend returns equation metadata only; it does not return graph samples.
- The Backend preserves version metadata but does not detect or suppress stale
  results.
- Before a model is selected, the team still needs to decide provider/runtime,
  model request format, credential handling, data retention/privacy policy,
  deployment resource limits, and whether the existing response schemas
  suffice.
