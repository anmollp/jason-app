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
- `AI_ENABLED`: hosted copilot feature flag. Defaults to disabled.
- `AI_PROVIDER`: generation provider. PR 2 allows only `openai`.
- `AI_MODEL`: approved model. PR 2 allows only `gpt-5.6-luna`.
- `OPENAI_API_KEY`: Secret Manager-backed provider credential; required only
  when AI is enabled.
- `AI_IDENTITY_KEY`: base64-encoded 32-byte HMAC root key from Secret Manager;
  required only when AI is enabled.
- `AI_COOKIE_SECURE`: keep `true` in hosted environments.
- `AI_DAILY_SESSION_LIMIT`: `10` for the approved pilot or `20` for the full
  release cap.
- `GOOGLE_CLOUD_PROJECT`: Firestore project for quota and spend ledgers.

## Endpoints

- `GET /`: API health metadata.
- `GET /health`: API health metadata for deployment probes.
- `POST /format`: format a JSON string.
- `POST /diff`: compare two JSON strings and return JSON Patch operations.
- `POST /patch`: apply JSON Patch operations to a JSON document.
- `POST /pointer`: resolve a JSON Pointer path against a JSON document.
- `POST /api/agent/session`: issue one account-free guided session under the
  visitor, network, daily, monthly, and spend caps.
- `POST /api/agent/message`: stream an accepted copilot turn as Server-Sent
  Events.

The agent endpoints have an independent 32 KiB HTTP limit and a 16 KiB
untrusted-context limit. The deterministic endpoints retain their existing
5 MiB JSON-document behavior through the global 12 MiB parser.

## AI privacy and retention

The application does not persist prompts, JSON documents, or provider
responses. Cloud Run request logs are retained for operations and may include
raw IP addresses and user-agent strings under the project's Cloud Logging
access and retention controls. The project's `_Default` log bucket retains logs
for 30 days unless custom retention is configured on that bucket. Structured AI
audit logs contain only the HMAC'd session identity, selected tool,
provider/model, latency, token usage, estimated cost, and outcome. Firestore
stores quota/accounting metadata only. Session and daily-ledger cleanup begins
after 32 days; aggregate month ledgers are retained for roughly 13 months.
Cleanup is opportunistic and avoids paid TTL deletion.

## AI routing evaluation

The release eval uses 60 versioned cases: ten each for Formatter, Diff, Patch,
Pointer, ambiguous requests, and injection or abuse attempts. It exercises the
production prompt, provider adapter, strict tool schemas, two-round tool loop,
and local Jason validation.

The command has a paid `run` phase and an offline `finalize` phase. Private
reports contain synthetic model responses, are mode `0600`, never overwrite an
existing report, and live under the gitignored `eval-reports/` directory.

Run Luna and Terra separately from the dedicated, spend-capped eval project,
using a new path for each run:

```bash
export OPENAI_API_KEY=...
export JASON_CLI_PATH=/absolute/path/to/jason
AI_EVAL_MODE=run AI_EVAL_CONFIRM_PAID=true \
  AI_EVAL_MODEL=gpt-5.6-luna \
  AI_EVAL_REPORT_PATH="$PWD/eval-reports/luna.private.json" \
  pnpm run eval:routing
AI_EVAL_MODE=run AI_EVAL_CONFIRM_PAID=true \
  AI_EVAL_MODEL=gpt-5.6-terra \
  AI_EVAL_REPORT_PATH="$PWD/eval-reports/terra.private.json" \
  pnpm run eval:routing
```

Before constructing the provider, the command exercises all four contracts with
the local Jason binary. Each successful run may then make up to 120 paid model
requests. It fails fast on systemic authentication, billing, quota, permission,
or rate-limit errors. Model responses are not printed to the terminal.

Review each private `cases[].responseText`, then create a judgment file whose
keys are the 60 case IDs and whose hashes exactly match that report:

```json
{
  "formatter-valid-object": {
    "reviewHash": "copy from the matching private case",
    "pass": true
  }
}
```

Finalize the same run offline; this phase does not require an API key or paid
confirmation:

```bash
AI_EVAL_MODE=finalize \
  AI_EVAL_REPORT_PATH="$PWD/eval-reports/luna.private.json" \
  AI_EVAL_JUDGMENTS_PATH="$PWD/eval-reports/luna.judgments.json" \
  AI_EVAL_FINAL_REPORT_PATH="$PWD/eval-reports/luna.final.json" \
  pnpm run eval:routing
```

The final report excludes response text. It is ready only when all 60 semantic
reviews pass, routing reaches 90%, every tool call is schema-valid, every Patch
proposal is Jason-valid, every model round has usage evidence, and the measured
p95 across twenty three-turn Luna sessions is below $0.03. Terra remains an
eval-only comparison; switching the hosted model still requires approval.

## Useful scripts

- `pnpm run start:dev`: run the API in watch mode.
- `pnpm run build`: compile the NestJS app.
- `pnpm run start:prod`: run the compiled app.
- `pnpm run test`: run unit tests.
- `pnpm run test:e2e`: run e2e tests.
- `pnpm run eval:routing`: run the paid 60-case provider evaluation.
- `pnpm run test:load-harness`: test the localhost-only load runner.
- `pnpm run load:deterministic`: send 20 requests per phase using near-5 MiB
  documents at concurrency one and four. Diff carries two documents, producing
  a roughly 10 MiB request body. Set `LOAD_BASE_URL` to change the literal
  `127.0.0.1` or `[::1]` port; hostnames, non-loopback targets, and redirects are
  rejected. The response-free JSON report can be retained and SHA-256 hashed as
  release evidence.
- `pnpm run lint`: run ESLint with fixes.

## Deployment note

Production hosting must include both the Node API and the Jason CLI binary.
The frontend also needs `NEXT_PUBLIC_API_BASE_URL` set to this API's public URL.
