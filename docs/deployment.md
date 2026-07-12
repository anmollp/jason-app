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
Cloud Run frontend
  |
  | server-side proxy with Cloud Run identity token
  v
private Cloud Run backend
  |
  | execs JASON_CLI_PATH
  v
Jason Rust CLI
```

## Frontend checklist

1. Build and deploy the `frontend/` container image with a Node-compatible container host.
2. Set `JASON_API_BASE_URL` to the private backend Cloud Run service URL.
3. Confirm the production site loads `/` and `/playground`.
4. Open the browser network panel and verify playground requests go to the
   frontend `/api/*` proxy routes, not directly to the backend.

## Backend checklist

1. Deploy the `backend/` NestJS app with Node.js support.
2. Build the backend container image so it compiles the Jason CLI from
   `anmollp/jason` and copies it into the runtime image.
3. Set `JASON_CLI_PATH` to the CLI executable path, or keep the container
   default of `/usr/local/bin/jason`.
4. Keep `FRONTEND_ORIGIN` unset for the private Cloud Run backend unless a
   separate browser-facing backend deployment is intentionally created.
5. If using a browser-facing preview backend, set `FRONTEND_ORIGIN` to a
   comma-separated list, for example:

   ```text
   https://jason.example.com,https://jason-preview.example.com
   ```

6. Configure the host health check to call `GET /health`.

## Required environment variables

Frontend:

```text
JASON_API_BASE_URL=https://your-backend.example.com
JASON_API_AUDIENCE=https://your-backend.example.com
```

Backend:

```text
PORT=3000
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

## Image publish

Use the manual `Publish Container Images` GitHub Actions workflow to build and
push both containers to Artifact Registry. Use the same `image_tag` value when
running the Terraform plan and apply workflows.

Configure the workflow with:

- `GCP_PROJECT_ID`, `GCP_REGION`, `GAR_REPOSITORY`, and `BILLING_ACCOUNT_ID`
  repository variables.
- `GCP_WORKLOAD_IDENTITY_PROVIDER` from the Terraform
  `github_actions_workload_identity_provider` output.
- `GCP_PUBLISHER_SERVICE_ACCOUNT` from the Terraform
  `github_actions_service_account_email` output.

## Terraform plan

Use the manual `Terraform Plan` GitHub Actions workflow after publishing images.
Pass the published `image_tag` as the workflow input. The workflow validates
Terraform and produces a cloud plan without applying it.

Configure `GCP_TERRAFORM_SERVICE_ACCOUNT` from the Terraform
`github_actions_deploy_service_account_email` output for Terraform plan,
destroy-plan, and future apply workflows.

Set `GCS_STATE_BUCKET` to the Terraform state bucket before running Terraform
workflows in GitHub Actions.

## Terraform deploy

Use the manual `Terraform Deploy` GitHub Actions workflow after publishing
images. It creates a plan, opens a GitHub approval issue, waits for an approval
comment, and applies that exact plan.

Approve with `yes`, `lgtm`, `done`, `approve`, or `approved`. Deny with `no`,
`stop`, `deny`, `denied`, or `cancel`.

## Terraform destroy plan

Use the manual `Terraform Destroy Plan` workflow before any planned teardown.
It requires the same image inputs as the normal plan workflow plus a
`confirmation` value of `destroy-plan`. The workflow runs `terraform plan
-destroy` only; it does not apply or destroy resources.

## Budget alerts

Set `billing_account_id` in `terraform/environments/dev/terraform.tfvars` to
create the optional monthly budget alert. The default budget is `$10` and sends
alerts at 50%, 80%, 100%, and 100% forecasted spend.

## Smoke test

After deploy, verify:

1. Authenticated `GET https://your-backend.example.com/health` returns
   `status: "ok"`.
2. The frontend loads without console errors.
3. Formatter sample succeeds from `/playground`.
4. Diff sample returns patch operations.
5. Patch sample returns patched JSON.
6. Pointer sample returns the selected value.

## Known production risk

The backend depends on the Jason Rust CLI. A deployment can pass Node.js build
checks but still fail JSON operations if the CLI binary is missing or not
executable. Treat `JASON_CLI_PATH` as the critical production dependency.
