# Jason Backend

The backend is a NestJS API that powers the Jason playground. It validates web
requests, calls the Jason Rust CLI, and returns structured responses that the
frontend can render.

## Responsibilities

- Accept JSON operation requests from the frontend.
- Run the Jason CLI with stdin-based payloads.
- Normalize successful CLI output into API responses.
- Convert CLI and validation failures into useful `400` responses.
- Restrict browser access with a configurable CORS origin.

## Local development

```bash
cp .env.example .env
pnpm install
pnpm run start:dev
```

The API defaults to `http://localhost:3000`.

## Jason CLI dependency

The backend shells out to the Jason Rust CLI. By default it runs `jason`, which
means the binary must be available on `PATH`.

For local development or deployment, set `JASON_CLI_PATH` to an explicit binary
path:

```bash
JASON_CLI_PATH=/absolute/path/to/jason
```

## Container image

The backend Docker image builds the Jason Rust CLI from
`https://github.com/anmollp/jason` and copies the compiled binary into the
runtime image at `/usr/local/bin/jason`.

By default the image pins the CLI build to `v1.7.0`:

```bash
docker build -t jason-backend ./backend
```

To test another CLI tag or commit:

```bash
docker build \
  --build-arg JASON_CLI_REF=v1.7.0 \
  -t jason-backend \
  ./backend
```

The runtime image sets:

```bash
JASON_CLI_PATH=/usr/local/bin/jason
```

## Environment variables

- `PORT`: API server port. Defaults to `3000`.
- `FRONTEND_ORIGIN`: comma-separated allowed CORS origin list. Defaults to
  `http://localhost:3001`.
- `JASON_CLI_PATH`: Jason CLI executable path. Defaults to `jason`.

## Endpoints

- `GET /`: API health metadata.
- `GET /health`: API health metadata for deployment probes.
- `POST /format`: format a JSON string.
- `POST /diff`: compare two JSON strings and return JSON Patch operations.
- `POST /patch`: apply JSON Patch operations to a JSON document.
- `POST /pointer`: resolve a JSON Pointer path against a JSON document.

## Useful scripts

- `pnpm run start:dev`: run the API in watch mode.
- `pnpm run build`: compile the NestJS app.
- `pnpm run start:prod`: run the compiled app.
- `pnpm run test`: run unit tests.
- `pnpm run test:e2e`: run e2e tests.
- `pnpm run lint`: run ESLint with fixes.

## Deployment note

Production hosting must include both the Node API and the Jason CLI binary.
The frontend also needs `NEXT_PUBLIC_API_BASE_URL` set to this API's public URL.
