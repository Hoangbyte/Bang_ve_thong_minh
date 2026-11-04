# Smart Whiteboard Backend API

This document describes the API implemented by the current backend. Recognition
requests use JSON stroke data; the backend does not receive images, render a
canvas, or return sampled graph points.

## Base URL and content type

For local development, the base URL is `http://127.0.0.1:8000`.
Recognition endpoints accept JSON with `Content-Type: application/json` and
return JSON. Their request schemas reject unknown fields.

The three recognition endpoints are grouped under the `Recognition` tag in
OpenAPI and are available in Swagger UI at `/docs`.

## Shared request fields

All three endpoints use the same request fields:

| Field | Type | Required | Meaning and constraints |
|---|---|---:|---|
| `request_id` | string | Yes | Identifier for this recognition operation. Must contain a non-whitespace printable character and be at most 128 characters. |
| `mode` | string | Yes | One of `manual` or `automatic`. The API validates and forwards this value; the current adapters do not define different behavior for the two modes. |
| `object_id` | string | Yes | Frontend drawing-object identifier. Must contain a non-whitespace printable character and be at most 128 characters. |
| `object_version` | integer | Yes | Non-negative version of the drawing object. Booleans and non-integers are rejected. |
| `strokes` | array of `Stroke` | Yes | At least one and at most 100 strokes. There may be at most 20,000 points across the request. |
| `canvas` | `CanvasSize` | Yes | Canvas `width` and `height` as finite numbers greater than zero and at most 100,000. |

Each `Stroke` has:

| Field | Type | Required | Meaning and constraints |
|---|---|---:|---|
| `id` | string | Yes | Non-empty, non-whitespace stroke identifier, at most 128 characters. Stroke IDs must be unique within the request. |
| `points` | array of `StrokePoint` | Yes | At least one and at most 2,000 points per stroke. |

Each `StrokePoint` has:

| Field | Type | Required | Meaning and constraints |
|---|---|---:|---|
| `x` | number | Yes | Finite horizontal coordinate. |
| `y` | number | Yes | Finite vertical coordinate. |
| `t` | number | Yes | Finite, non-negative timestamp in milliseconds from the start of this stroke. Timestamps must be non-decreasing within a stroke. |
| `pressure` | number or `null` | No | Optional pen pressure in the inclusive range 0 to 1. If omitted, it is `null`. |

Coordinates are interpreted in the coordinate system supplied by the Frontend.
The API does not document or apply a coordinate transformation, and does not
reject coordinates for falling outside the canvas bounds; transformed or
cropped coordinate spaces may be valid. The `canvas` dimensions describe the
request canvas and do not imply that the backend rescales stroke points.

The Frontend should retain `request_id`, `object_id`, and `object_version`
alongside the operation. The service returns those values unchanged from the
request. They let the Frontend associate a response with the right drawing
object and decide whether its version is still current. The backend does not
manage canvas state or decide whether a result is stale.

### Shared request example

The following body is valid for each recognition endpoint:

```json
{
  "request_id": "recognition-2026-001",
  "mode": "manual",
  "object_id": "canvas-object-42",
  "object_version": 3,
  "strokes": [
    {
      "id": "stroke-a",
      "points": [
        { "x": 120.5, "y": 80, "t": 0, "pressure": 0.6 },
        { "x": 124, "y": 84.5, "t": 16 },
        { "x": 130, "y": 91, "t": 32, "pressure": 0.7 }
      ]
    }
  ],
  "canvas": {
    "width": 1280,
    "height": 720
  }
}
```

The example's numeric coordinates are illustrative and are not restricted to
the canvas rectangle by the backend.

## Response envelope

Recognition responses are not wrapped in the general `data` envelope. Each
feature returns:

| Field | Type | Meaning |
|---|---|---|
| `success` | boolean | `true` when the response contains a recognition result; `false` when valid input could not be recognized. |
| `request_id` | string | The request's `request_id`. |
| `object_id` | string | The request's `object_id`. |
| `object_version` | integer | The request's `object_version`. |
| `source` | `mock`, `model`, or `null` | Adapter source metadata. Optional; current mock adapters set it to `mock`. |
| `result` | feature result or `null` | Present for successful recognition and `null` for an unsuccessful recognition outcome. |
| `error` | string or `null` | Optional reason for an unsuccessful recognition outcome. This is not an operational HTTP error. |

`success=true` requires a non-null `result` and no `error`. `success=false`
cannot include a `result`. A valid but unrecognized input is a normal HTTP 200
response; it is different from an unavailable provider, timeout, or processing
failure.

## Handwriting

### Endpoint

- **Method and path:** `POST /api/recognition/handwriting`
- **Purpose:** Submit strokes for handwriting recognition.
- **Content-Type:** `application/json`
- **Request:** Shared request fields above; no additional handwriting-specific
  request fields.
- **Adapter today:** `MockHandwritingAdapter`. It returns an explicit
  `[MOCK]` placeholder, not recognized user handwriting. It sets confidence
  and cleaned strokes to `null`.

### Success response fields

`result` is a `HandwritingRecognitionResult`:

| Field | Type | Meaning |
|---|---|---|
| `text` | non-empty string | Recognized text. The current mock value is explicitly a placeholder. |
| `confidence` | number or `null` | Optional confidence in the inclusive range 0 to 1. `null` means no confidence was returned. |
| `cleaned_strokes` | array of `CleanedStroke` or `null` | Optional beautified stroke points. Each cleaned stroke contains a non-empty `points` array of finite `{ "x": number, "y": number }` coordinates. The current mock returns `null`. |

When a real provider returns cleaned strokes, the Frontend can use those
coordinates to redraw the beautified handwriting. Otherwise it should retain
the original strokes. The backend does not draw the canvas.

### Request example

Use the shared request example above.

### Success response example (current mock behavior)

```json
{
  "success": true,
  "request_id": "recognition-2026-001",
  "object_id": "canvas-object-42",
  "object_version": 3,
  "source": "mock",
  "result": {
    "text": "[MOCK] Handwriting recognition is not implemented.",
    "confidence": null,
    "cleaned_strokes": null
  },
  "error": null
}
```

### Unsuccessful recognition example

An adapter may report an unsuccessful recognition outcome with HTTP 200:

```json
{
  "success": false,
  "request_id": "recognition-2026-001",
  "object_id": "canvas-object-42",
  "object_version": 3,
  "source": "mock",
  "result": null,
  "error": "No handwriting could be recognized."
}
```

The reason in this example is illustrative; the current handwriting mock
returns its placeholder success response.

## Geometry

### Endpoint

- **Method and path:** `POST /api/recognition/geometry`
- **Purpose:** Submit strokes for geometric shape recognition.
- **Content-Type:** `application/json`
- **Request:** Shared request fields above; no additional geometry-specific
  request fields.
- **Adapter today:** `MockGeometryAdapter`. It does not infer a shape and
  returns `success=false`, `source=mock`, and an explanatory `error`.

### Success response fields

`result` is one of the following discriminated geometry result types. Each
contains `shape_type`, optional `confidence` (number or `null`, from 0 to 1),
and `geometry`. `geometry` is the structured shape data that a Frontend can
use to redraw the recognized shape. The backend does not draw it.

| `shape_type` | `geometry` fields |
|---|---|
| `line` | `start` and `end`, each a finite `{ "x": number, "y": number }` point. |
| `circle` | `center` point and finite `radius` greater than zero. |
| `ellipse` | `center` point, finite positive `semi_major_axis` and `semi_minor_axis`, and finite `rotation`. |
| `triangle` | `vertices`: exactly 3 points. |
| `square` | `vertices`: exactly 4 points. |
| `rectangle` | `vertices`: exactly 4 points. |

Geometry examples below show the response contract for a hypothetical
successful adapter; they are not results emitted by the current mock.

### Request example

Use the shared request example above.

### Success response example (illustrative schema example, not current mock output)

```json
{
  "success": true,
  "request_id": "recognition-2026-001",
  "object_id": "canvas-object-42",
  "object_version": 3,
  "source": "model",
  "result": {
    "shape_type": "rectangle",
    "confidence": 0.96,
    "geometry": {
      "vertices": [
        { "x": 120, "y": 80 },
        { "x": 280, "y": 80 },
        { "x": 280, "y": 180 },
        { "x": 120, "y": 180 }
      ]
    }
  },
  "error": null
}
```

### Current mock response example

```json
{
  "success": false,
  "request_id": "recognition-2026-001",
  "object_id": "canvas-object-42",
  "object_version": 3,
  "source": "mock",
  "result": null,
  "error": "Mock geometry recognition is unavailable; no shape was inferred."
}
```

## Equation

### Endpoint

- **Method and path:** `POST /api/recognition/equation`
- **Purpose:** Submit strokes for equation recognition and return normalized
  equation metadata.
- **Content-Type:** `application/json`
- **Request:** Shared request fields above; no additional equation-specific
  request fields. Equation strings are not accepted as executable instructions.
- **Adapter today:** `MockEquationAdapter`. It does not infer or execute an
  expression and returns `success=false`, `source=mock`, and an explanatory
  `error`.

### Success response fields

`result` is an `EquationRecognitionResult`:

| Field | Type | Meaning |
|---|---|---|
| `latex` | non-empty string | LaTeX representation for display. |
| `expression` | non-empty string | Provider-normalized expression string. It is data, not permission to execute it. |
| `function_type` | string | One of `linear`, `quadratic`, `cubic`, `polynomial`, `trigonometric`, or `other`. |
| `is_graphable` | boolean | Whether the provider classifies the recognized expression as graphable. |
| `confidence` | number or `null` | Optional confidence in the inclusive range 0 to 1. |

The Frontend may display `latex` and, when `is_graphable` is true, use the
normalized expression with its own safe graphing/rendering logic. The backend
does not render a graph and does not return sampled graph points.

### Request example

Use the shared request example above.

### Success response example (illustrative schema example, not current mock output)

```json
{
  "success": true,
  "request_id": "recognition-2026-001",
  "object_id": "canvas-object-42",
  "object_version": 3,
  "source": "model",
  "result": {
    "latex": "y = x^2",
    "expression": "x**2",
    "function_type": "quadratic",
    "confidence": 0.94,
    "is_graphable": true
  },
  "error": null
}
```

### Current mock response example

```json
{
  "success": false,
  "request_id": "recognition-2026-001",
  "object_id": "canvas-object-42",
  "object_version": 3,
  "source": "mock",
  "result": null,
  "error": "Mock equation recognition is unavailable; no expression was inferred."
}
```

## Error reference

Operational and request errors use the common structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe, client-facing message."
  }
}
```

| HTTP status | Error code | Meaning |
|---:|---|---|
| 413 | `REQUEST_BODY_TOO_LARGE` | Recognition request body exceeds the configured byte limit. |
| 422 | `VALIDATION_ERROR` | Request JSON does not satisfy the endpoint schema. The response intentionally does not include raw validation values. |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error. Internal exception details and tracebacks are not returned. |
| 502 | `RECOGNITION_PROCESSING_ERROR` | A known adapter processing error prevented recognition. |
| 503 | `RECOGNITION_UNAVAILABLE` | The recognition provider is unavailable. |
| 504 | `RECOGNITION_TIMEOUT` | Adapter timeout or configured service timeout. |

For example, the current 422 response is:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed."
  }
}
```

An oversized body returns:

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_BODY_TOO_LARGE",
    "message": "Request body exceeds the allowed size."
  }
}
```

The 502, 503, 504, and 500 responses follow the same envelope with the error
codes and safe messages listed above. Detailed exception information is logged
server-side, not exposed to API clients.
