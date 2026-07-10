# Architecture Notes

Jason is a small full-stack developer tool with one core idea: make common JSON
operations fast enough to use during real API debugging, while keeping the
implementation easy to inspect.

## Product problem

JSON work often happens in scattered tools: one tab for formatting, another for
diffing, another for JSON Patch, and another for JSON Pointer lookups. Jason
pulls those workflows into one focused playground so a user can paste data,
inspect it, and copy the useful result without changing context.

## System overview

```text
Next.js frontend
  |
  | JSON operation requests
  v
NestJS backend
  |
  | stdin payloads
  v
Jason Rust CLI
```

The UI is intentionally thin around the core data operations. It handles editor
state, loading/error states, examples, copy actions, and readable summaries.
The backend owns request validation and response shaping. The Rust CLI remains
the operation engine.

## Frontend

The frontend is a Next.js app with two main surfaces:

- Landing page: product explanation and entry point.
- Playground: Formatter, Diff, Patch, and Pointer tools.

Key implementation choices:

- CodeMirror provides a real editor surface instead of plain textareas.
- Each playground tool has a hook that owns its input, output, status, and
  stats.
- Shared shell logic handles tool switching, copying, clearing, and sample
  loading.
- The UI keeps examples loaded by default so a first-time visitor can run the
  app immediately.

## Backend

The backend is a NestJS API that exposes these relevant routes:

- `GET /`
- `GET /health`
- `POST /format`
- `POST /diff`
- `POST /patch`
- `POST /pointer`

The JSON operation endpoints validate request shape, call the Jason CLI, and
convert CLI output into responses that are easy for the UI to render.

## CLI boundary

The backend calls the Rust CLI through `execFile`, not shell string execution.
That keeps argument handling explicit and avoids shell interpolation concerns.

The backend passes operation input through stdin:

- `format`: one JSON document.
- `diff`: before and after documents separated by a null byte.
- `patch`: document and patch operations separated by a null byte.
- `pointer`: document and pointer path separated by a null byte.

The tradeoff is deployment complexity: production must include the CLI binary
and configure `JASON_CLI_PATH`. The upside is that the JSON engine can remain
reusable outside the web app.

## Error handling

The backend converts validation and CLI failures into `400` responses with
stable high-level messages. Where possible, it includes a `field` value so the
frontend can highlight the relevant input panel.

Examples:

- invalid formatter input maps to the formatter editor.
- invalid diff input can identify `before` or `after`.
- invalid patch input can identify `document` or `patch`.
- invalid pointer input can identify `document` or `path`.

## Deployment considerations

The app is designed to deploy as two services:

- frontend host for the Next.js app.
- backend host for the NestJS API plus Jason CLI binary.

Important production settings:

- `NEXT_PUBLIC_API_BASE_URL` points the frontend at the backend.
- `FRONTEND_ORIGIN` configures backend CORS and supports comma-separated
  origins.
- `JASON_CLI_PATH` points at the executable CLI binary.

The backend exposes `GET /health` for hosting probes.

## Testing strategy

Current coverage focuses on the backend API boundary:

- unit tests for controller behavior and response shaping.
- e2e tests for root health and formatter routes.
- build and lint checks for frontend and backend.

The highest-value next testing step is browser-level coverage for the
playground happy paths: load sample, run tool, see output, copy result.

## Notable tradeoffs

- The frontend and backend are separate apps rather than a single Next.js API
  app. This makes the CLI boundary and API layer explicit, which is useful for
  demonstrating full-stack architecture.
- The backend shells out to the CLI instead of linking to Rust directly. This is
  simple and portable, but deployment must include the binary.
- The UI favors focused JSON workflows over account systems, persistence, or
  collaboration. That keeps the product usable without turning it into a larger
  SaaS project too early.

## Future improvements

- Add Playwright smoke tests for the four playground tools.
- Add production Dockerfiles or host-specific deployment manifests.
- Add screenshots or a short demo GIF to the README.
- Expose CLI version in the health response once the Rust binary supports it.
- Add request size limits and clearer payload-too-large errors.
