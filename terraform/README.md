# Jason Terraform

This directory contains the Terraform plan for deploying Jason on GCP Cloud Run.

The current target is the low-cost public `dev` environment used by the deployed
portfolio application and bounded AskJason pilot.

## Target Architecture

```text
Artifact Registry
  | stores container images
  v
Cloud Run frontend
  | JASON_API_BASE_URL + identity token
  v
private Cloud Run backend
  | JASON_CLI_PATH
  v
Jason Rust CLI inside backend container
```

## Design Principles

- Keep idle cost low with Cloud Run `min_instances = 0`.
- Keep initial blast radius small with one GCP project and one region.
- Keep Terraform state out of git.
- Add resources in small PRs so each change can be reviewed and learned.
- Prefer managed services before VM or Kubernetes complexity.

## Directory Layout

```text
terraform/
|-- versions.tf
|-- providers.tf
|-- apis.tf
|-- artifact_registry.tf
|-- budget.tf
|-- service_accounts.tf
|-- github_actions_identity.tf
|-- cloud_run.tf
|-- variables.tf
|-- locals.tf
|-- outputs.tf
|-- terraform.tfvars.example
`-- environments/
    `-- dev/
        |-- main.tf
        |-- variables.tf
        `-- terraform.tfvars.example
```

## First-Time Setup

Install Terraform and authenticate to GCP:

```bash
gcloud auth application-default login
gcloud config set project YOUR_GCP_PROJECT_ID
```

Prepare dev variables:

```bash
cd terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars
```

Then edit `terraform.tfvars`.

## Current Resources

The dev module creates the first production-shaped resource set:

- required GCP APIs for Artifact Registry, IAM, Cloud Run, Firestore, Secret
  Manager, and Logging.
- an Artifact Registry Docker repository.
- separate Cloud Run runtime service accounts for frontend and backend.
- a public Cloud Run frontend service.
- a private Cloud Run backend service invoked by the frontend service account.
- Cloud Run startup and liveness probes for both services.
- cost-control defaults with `min_instance_count = 0` and
  `max_instance_count = 1`.
- an optional project-scoped monthly billing budget when `billing_account_id` is
  set.

The browser calls relative frontend API routes. The Next.js server then calls
the backend using `JASON_API_BASE_URL` and a Cloud Run identity token. This keeps
the backend URL out of the browser path, avoids granting `allUsers` invoke
access to the backend, and removes the need for browser CORS on the deployed
backend.

## AskJason AI secure-backend resources

The module provisions the AI backend in a disabled state by default:

- Firestore Native in `us-central1`, with deletion protection, for account-free
  quota and spend ledgers.
- Secret Manager containers for `OPENAI_API_KEY` and the base64-encoded 32-byte
  `AI_IDENTITY_KEY`.
- Least-privilege Firestore and secret-access roles for the private backend
  service account.
- A structured-log exclusion that drops accidental AI content fields while
  preserving metadata-only audit events.
- Automatic Cloud Run request logs remain enabled for operations and may include
  raw IP addresses and user-agent strings. They follow the project's Cloud
  Logging access controls and `_Default` bucket retention.
- Cloud Run limits fixed at zero minimum and one maximum instance.

Terraform creates no secret versions, so secret payloads never enter
configuration or state. After separately approved secret creation, set the
numeric `openai_api_key_secret_version` and `ai_identity_key_secret_version`
values to attach pinned, rollback-safe versions. The `latest` alias is rejected.
Keep `ai_enabled = false` until production rollout approval.

Before any pilot is enabled, the OpenAI project owner must separately verify
these provider-side controls in the OpenAI dashboard:

1. A dedicated AskJason project with alerts at $4, $6, and $7.20.
2. An enforced $8 monthly project spend limit.
3. No API keys outside Secret Manager.

Those settings are deliberately not represented as Terraform resources because
the Google provider cannot enforce OpenAI project controls. Record screenshots
or exported project settings in the release-readiness evidence; do not commit
keys or secret payloads.

## IAM Model

The first deployment keeps permissions intentionally narrow:

- `allUsers` receives `roles/run.invoker` only on the frontend service, so the
  portfolio site is public.
- the frontend runtime service account receives `roles/run.invoker` on the
  backend service, so only frontend server-side code can call the backend.
- the backend runtime service account receives `roles/datastore.user` and
  per-secret `roles/secretmanager.secretAccessor`; it remains the only runtime
  identity with AI state and credential access.
- the GitHub Actions publisher service account receives Artifact Registry writer
  access only on the Jason container repository.
- the GitHub Actions Terraform deployer service account receives the project
  roles needed to plan/apply Cloud Run, Artifact Registry, Firestore, Logging,
  Secret Manager, service account, Workload Identity, IAM, and service API
  resources in this module.
- when budget alerts are enabled, the deployer also receives
  `roles/billing.costsManager` on the configured billing account.
- GitHub Actions can impersonate these service accounts only through the
  Workload Identity provider restricted to `github_repository` and `github_ref`.

## Deliberate boundaries

- Terraform creates Secret Manager containers but never secret payloads or
  versions.
- The hosted AI feature remains disabled unless an approved apply supplies both
  pinned secret versions and explicitly enables it.
- Cloud Run services keep zero minimum and one maximum instance.
- The frontend is public; the backend remains private behind service-account
  invocation.
- Custom-domain verification and DNS ownership remain external operator steps.

## Budget Alerts

Budget alerts are optional so local validation can run without billing account
details. Set `billing_account_id` to create a monthly project-scoped budget.

Defaults:

- `budget_amount_usd = 10`
- alert at 50% current spend.
- alert at 80% current spend.
- alert at 100% current spend.
- alert at 100% forecasted spend.

The budget uses Google Cloud's default billing IAM recipients for threshold
notifications. This is meant to be an early warning system, not a hard spending
cap.

## Terraform Deploy Workflow

The `Terraform Deploy` workflow is manual and runs as three jobs:

```text
Plan -> Approval -> Apply
```

The plan job runs Terraform formatting, initialization, validation, and planning,
then uploads the plan file as a short-lived workflow artifact. The approval job
opens a GitHub approval issue. The apply job downloads and applies that exact
plan after approval:

```bash
terraform apply -auto-approve tfplan
```

Approve by commenting `yes`, `lgtm`, `done`, `approve`, or `approved` on the
issue. Deny by commenting `no`, `stop`, `deny`, `denied`, or `cancel`.
Only comments from the repository owner are considered; other commenters cannot
approve or deny either Terraform workflow.

The deploy workflow keeps `ai_enabled` false by default. Its optional AI inputs
accept the two pinned numeric Secret Manager versions as a pair. Enabling AI
without both versions fails before planning, and the selected values are bound
into the saved plan that the apply job later consumes.

Terraform deploy and destroy workflows use
`GCP_TERRAFORM_SERVICE_ACCOUNT`, which should be set from the
`github_actions_deploy_service_account_email` output. This identity is separate
from the image publisher identity.

## Terraform Destroy Workflow

The `Terraform Destroy` workflow is manual and runs as three jobs:

```text
Plan -> Approval -> Apply
```

The plan job runs the same validation steps as the deploy plan job, then writes
a destroy plan with:

```bash
terraform plan -destroy
```

The approval job opens a GitHub approval issue. The apply job downloads and
applies that exact destroy plan after approval.

It requires the `confirmation` input to be exactly `destroy` before planning
starts.

## App Image Deployments

The `Deploy Frontend` and `Deploy Backend` workflows release app changes after
they merge to `master`. Frontend path changes build and push only the frontend
image, then update `jason-dev-frontend`. Backend path changes do the same for
`jason-dev-backend`. Images are tagged with the short commit SHA and pushed to
Artifact Registry.

Terraform still needs baseline frontend and backend image tags when Cloud Run
services are first created, but Terraform ignores later image drift so an
infrastructure apply does not roll back an app revision.

The app deploy workflows push both a short-SHA tag and `latest`, while Cloud Run
is updated to the short-SHA image.

Required GitHub repository variables:

- `GCP_PROJECT_ID`: GCP project ID.
- `GCP_REGION`: Artifact Registry region, for example `us-central1`.
- `GAR_REPOSITORY`: Artifact Registry repository ID, for example
  `jason-dev-containers`.
- `BILLING_ACCOUNT_ID`: Billing account ID used by Terraform budget resources.

Required GitHub repository secrets:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: value from the Terraform
  `github_actions_workload_identity_provider` output.
- `GCP_PUBLISHER_SERVICE_ACCOUNT`: value from the Terraform
  `github_actions_service_account_email` output.
- `GCP_TERRAFORM_SERVICE_ACCOUNT`: value from the Terraform
  `github_actions_deploy_service_account_email` output. The app deployment jobs
  use this identity to update Cloud Run service images.

Terraform creates the GitHub Actions publisher service account, grants it
Artifact Registry writer access on the Jason repository, and allows GitHub OIDC
tokens from `github_repository` and `github_ref` to impersonate it.

For a first Terraform-created environment, make sure `frontend:latest` and
`backend:latest` exist before creating Cloud Run services. Override
`frontend_image` and `backend_image` in Terraform variables when you need a
different bootstrap image.

Terraform deploy and destroy workflows use:

- `GCS_STATE_BUCKET`: GCS bucket used for Terraform state.
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: value from the Terraform
  `github_actions_workload_identity_provider` output.
- `GCP_TERRAFORM_SERVICE_ACCOUNT`: value from the Terraform
  `github_actions_deploy_service_account_email` output.

The first apply that creates these identities still needs to be run by an
administrator or owner credential because GitHub cannot impersonate an identity
before it exists.

## State

Use GCS remote state before the first real apply from GitHub Actions.

Create the bucket once:

```bash
gcloud storage buckets create gs://YOUR_PROJECT_ID-jason-terraform-state \
  --project YOUR_PROJECT_ID \
  --location us-central1 \
  --uniform-bucket-level-access

gcloud storage buckets update gs://YOUR_PROJECT_ID-jason-terraform-state \
  --versioning
```

Then set the GitHub repository variable:

```text
GCS_STATE_BUCKET=YOUR_PROJECT_ID-jason-terraform-state
```

For local Terraform, copy `terraform/environments/dev/backend.tf.example` to
`terraform/environments/dev/backend.tf`, update the bucket name, and run:

```bash
cd terraform/environments/dev
terraform init -migrate-state
```
