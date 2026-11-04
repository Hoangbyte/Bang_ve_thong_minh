# Backend Development Guide

## Requirements

- Python **3.14.7** (the version used by this project's current virtual
  environment).
- Git (to clone or update the project).

Run commands below from the backend directory:

```powershell
cd E:\Bang_thong_minh\backend
```

## Create and activate a virtual environment

If `.venv` does not already exist:

```powershell
py -3.14 -m venv .venv
```

Activate it in PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell prevents activation, use the interpreter directly instead, for
example `.venv\Scripts\python.exe -m pip install -r requirements.txt`.
Do not change the Python version used by this project.

## Install dependencies

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Runtime dependencies listed in `requirements.txt` are FastAPI, Uvicorn, and
Pydantic Settings. Test dependencies are pytest, httpx2 (used by the
project's TestClient setup), and pytest-asyncio.

## Configure the environment

Create a local `.env` from the example:

```powershell
Copy-Item .env.example .env
```

`.env` is ignored by Git. The checked-in `.env.example` contains development
defaults and no secrets. Current settings:

| Variable | Default | Description |
|---|---|---|
| `APP_TITLE` | `Smart Whiteboard Backend` | FastAPI application title. |
| `APP_DESCRIPTION` | `Backend API for the Smart Whiteboard application.` | Application description. |
| `APP_VERSION` | `1.0.0` | Application version. |
| `AI_PROVIDER` | `mock` | Only `mock` is currently supported. Other values fail settings validation/startup. |
| `RECOGNITION_TIMEOUT_SECONDS` | `30` | Positive per-request timeout, including time waiting for a concurrency permit. |
| `MAX_CONCURRENT_RECOGNITION_REQUESTS` | `10` | Positive maximum number of recognition operations concurrently executing through a service instance. |
| `MAX_REQUEST_BODY_BYTES` | `1048576` | Recognition body size limit; allowed range is 1,024 to 16,777,216 bytes. |
| `ALLOWED_ORIGINS` | `["http://localhost:5173"]` | JSON array of allowed frontend origins. |
| `ALLOW_CREDENTIALS` | `true` | Whether CORS credentials are allowed. Wildcard origin is rejected when true. |

For another local frontend origin, set `ALLOWED_ORIGINS` to a JSON array, for
example:

```dotenv
ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:5173"]
ALLOW_CREDENTIALS=true
```

Do not put real API keys or secrets in this file. No AI provider credentials
are used by the current implementation.

## Start the server

From the backend directory, with the virtual environment active:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Or without activation:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Swagger UI: <http://127.0.0.1:8000/docs>
- OpenAPI JSON: <http://127.0.0.1:8000/openapi.json>
- Root information: <http://127.0.0.1:8000/>
- Health: <http://127.0.0.1:8000/api/health>
- Readiness: <http://127.0.0.1:8000/api/ready>

The recognition service and mock adapters are initialized in the FastAPI
lifespan. Starting the app with an unsupported provider value fails rather
than silently switching providers.

## Test the API

### Swagger UI

Open `/docs`, expand each `POST /api/recognition/...` operation, select
**Try it out**, paste the matching request body from
[API_DOCUMENTATION.md](./API_DOCUMENTATION.md), and select **Execute**.

The three operation paths are:

- `POST /api/recognition/handwriting`
- `POST /api/recognition/geometry`
- `POST /api/recognition/equation`

The current handwriting mock returns an explicit `[MOCK]` placeholder. The
geometry and equation mocks return a normal HTTP 200 response with
`success=false`; they do not infer shapes or expressions.

### PowerShell and curl

With the server running, this is a valid request body for any of the three
features. Change the URL path to select a feature:

```powershell
$body = @'
{
  "request_id": "dev-request-1",
  "mode": "manual",
  "object_id": "dev-object-1",
  "object_version": 0,
  "strokes": [
    {
      "id": "stroke-1",
      "points": [
        { "x": 10, "y": 20, "t": 0, "pressure": 0.5 },
        { "x": 15, "y": 25, "t": 12 }
      ]
    }
  ],
  "canvas": { "width": 800, "height": 600 }
}
'@

curl.exe -i -X POST http://127.0.0.1:8000/api/recognition/handwriting `
  -H "Content-Type: application/json" `
  --data-raw $body
```

To try geometry or equation, replace `handwriting` in the URL with `geometry`
or `equation`.

### Run the complete test suite

From the backend directory:

```powershell
python -m pytest -q
```

For asynchronous tests, install the declared test dependencies first using
`requirements.txt`. Tests use local mocks and test adapters; they do not call
external AI services.

## Troubleshooting

- **The `uvicorn` command fails after moving the project folder:** run it as a
  module with the active environment's Python:
  `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.
  The existing virtual environment's generated command launchers may retain
  the old absolute project path; the Python module invocation avoids those
  launchers without reinstalling or recreating `.venv`.
- **Missing dependency:** confirm the virtual environment is active and rerun
  `python -m pip install -r requirements.txt`.
- **Unsupported `AI_PROVIDER`:** only `mock` is implemented and accepted today.
- **CORS origin is not allowed:** include the exact frontend origin (scheme,
  host, and port) in the JSON `ALLOWED_ORIGINS` array. Do not configure `*`
  while `ALLOW_CREDENTIALS=true`.
- **HTTP 413:** reduce the JSON body or deliberately raise
  `MAX_REQUEST_BODY_BYTES` within the supported 1 KiB to 16 MiB range.
- **HTTP 422:** check required shared metadata, mode, unique stroke IDs,
  timestamp order, finite coordinates, pressure, canvas dimensions, and stroke
  or point-count limits in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).
- **Recognition response has `success=false`:** this is a valid recognition
  outcome, not a server error. The current geometry/equation mocks always
  report that no result was inferred.
