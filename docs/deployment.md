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

1. Build and deploy the `frontend/` container image with a Node-compatible container host.
2. Set `NEXT_PUBLIC_API_BASE_URL` to the public backend URL.
3. Confirm the production site loads `/` and `/playground`.
4. Open the browser network panel and verify playground requests go to the
   deployed backend, not `localhost`.

For the current Next.js client bundle, `NEXT_PUBLIC_API_BASE_URL` must be set
when the frontend image is built. Setting it only as a Cloud Run runtime
environment variable will not update already-built browser JavaScript.

## Backend checklist

1. Deploy the `backend/` NestJS app with Node.js support.
2. Build the backend container image so it compiles the Jason CLI from
   `anmollp/jason` and copies it into the runtime image.
3. Set `JASON_CLI_PATH` to the CLI executable path, or keep the container
   default of `/usr/local/bin/jason`.
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

```bash
cd terraform/environments/dev
terraform fmt -recursive
terraform validate
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
