# Deployment Runbook

This runbook captures the production shape for Jason App. The frontend and
backend can be hosted separately as long as their environment variables point at
each other and the backend can execute the Jason Rust CLI.

## Production shape

```text
Browser
  |
  | opens the Next.js app
  v
Frontend host
  |
  | POST /format, /diff, /patch, /pointer
  v
Backend host
  |
  | execs JASON_CLI_PATH
  v
Jason Rust CLI
```

## Frontend checklist

1. Deploy the `frontend/` app with a Node-compatible Next.js host.
2. Set `NEXT_PUBLIC_API_BASE_URL` to the public backend URL.
3. Confirm the production site loads `/` and `/playground`.
4. Open the browser network panel and verify playground requests go to the
   deployed backend, not `localhost`.

## Backend checklist

1. Deploy the `backend/` NestJS app with Node.js support.
2. Ensure the Jason CLI binary is present in the runtime image or server.
3. Set `JASON_CLI_PATH` to the CLI executable path, or put `jason` on `PATH`.
4. Set `FRONTEND_ORIGIN` to the deployed frontend origin.
5. If using preview deployments, set `FRONTEND_ORIGIN` to a comma-separated
   list, for example:

   ```text
   https://jason.example.com,https://jason-preview.example.com
   ```

6. Configure the host health check to call `GET /health`.

## Required environment variables

Frontend:

```text
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com
```

Backend:

```text
PORT=3000
FRONTEND_ORIGIN=https://your-frontend.example.com
JASON_CLI_PATH=/app/bin/jason
```

## Health checks

The backend exposes JSON health metadata at both `GET /` and `GET /health`.
Use `/health` for hosting probes.

Expected response:

```json
{
  "name": "jason-api",
  "status": "ok",
  "version": "0.0.1"
}
```

## Preflight commands

Run these checks before deploying a new version:

```bash
cd backend
pnpm run lint
pnpm run test
pnpm run test:e2e
pnpm run build
```

```bash
cd frontend
pnpm run lint
pnpm run build
```

## Smoke test

After deploy, verify:

1. `GET https://your-backend.example.com/health` returns `status: "ok"`.
2. The frontend loads without console errors.
3. Formatter sample succeeds from `/playground`.
4. Diff sample returns patch operations.
5. Patch sample returns patched JSON.
6. Pointer sample returns the selected value.

## Known production risk

The backend depends on the Jason Rust CLI. A deployment can pass Node.js build
checks but still fail JSON operations if the CLI binary is missing or not
executable. Treat `JASON_CLI_PATH` as the critical production dependency.
