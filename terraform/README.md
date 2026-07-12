# Jason Terraform

This directory contains the Terraform plan for deploying Jason on GCP Cloud Run.

The first target is a low-cost `dev` environment that can become the public
portfolio deployment once the container images are ready.

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
|-- service_accounts.tf
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

- required GCP APIs for Artifact Registry, IAM, and Cloud Run.
- an Artifact Registry Docker repository.
- separate Cloud Run runtime service accounts for frontend and backend.
- a public Cloud Run frontend service.
- a private Cloud Run backend service invoked by the frontend service account.
- cost-control defaults with `min_instance_count = 0` and
  `max_instance_count = 1`.

The browser calls relative frontend API routes. The Next.js server then calls
the backend using `JASON_API_BASE_URL` and a Cloud Run identity token. This keeps
the backend URL out of the browser path, avoids granting `allUsers` invoke
access to the backend, and removes the need for browser CORS on the deployed
backend.

## IAM Model

The first deployment keeps permissions intentionally narrow:

- `allUsers` receives `roles/run.invoker` only on the frontend service, so the
  portfolio site is public.
- the frontend runtime service account receives `roles/run.invoker` on the
  backend service, so only frontend server-side code can call the backend.
- the backend runtime service account has no project-level roles in this PR
  because it only executes the packaged Jason CLI.
- Artifact Registry writer permissions for CI belong to the GitHub Actions
  publishing identity.

## Planned Resource PRs

1. Add Terraform-managed GitHub Actions deploy identity.
2. Add Terraform apply workflow.
3. Add budget alert and IAM tightening.
4. Add custom domain and DNS after the basic deployment is stable.

## Publishing Images

The `Publish Container Images` workflow builds and pushes both service images to
Artifact Registry. It is manual by design, so publishing images is explicit
while the project is still cost-conscious and learning-focused.

Required GitHub repository variables:

- `GCP_PROJECT_ID`: GCP project ID.
- `GCP_REGION`: Artifact Registry region, for example `us-central1`.
- `GAR_REPOSITORY`: Artifact Registry repository ID, for example
  `jason-dev-containers`.

Required GitHub repository secrets:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: Workload Identity provider resource name.
- `GCP_SERVICE_ACCOUNT`: service account email used by GitHub Actions.

The GitHub Actions service account needs Artifact Registry write access:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_GITHUB_ACTIONS_SERVICE_ACCOUNT" \
  --role="roles/artifactregistry.writer"
```

After the workflow finishes, copy its printed image URIs into
`terraform/environments/dev/terraform.tfvars`:

```hcl
frontend_image = "us-central1-docker.pkg.dev/YOUR_PROJECT_ID/jason-dev-containers/frontend:latest"
backend_image  = "us-central1-docker.pkg.dev/YOUR_PROJECT_ID/jason-dev-containers/backend:latest"
```

## State

Use local state only while learning and before the first real apply. Before any
shared or production apply, move state to a GCS backend.

Suggested setup:

```bash
gcloud storage buckets create gs://YOUR_PROJECT_ID-jason-terraform-state \
  --project YOUR_PROJECT_ID \
  --location us-central1 \
  --uniform-bucket-level-access

gcloud storage buckets update gs://YOUR_PROJECT_ID-jason-terraform-state \
  --versioning
```

Then copy `terraform/environments/dev/backend.tf.example` to
`terraform/environments/dev/backend.tf`, update the bucket name, and run:

```bash
cd terraform/environments/dev
terraform init -migrate-state
```
