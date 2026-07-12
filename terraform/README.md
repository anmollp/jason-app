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
  | NEXT_PUBLIC_API_BASE_URL
  v
Cloud Run backend
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
- public Cloud Run services for the frontend and backend.
- cost-control defaults with `min_instance_count = 0` and
  `max_instance_count = 1`.

The frontend image must be built with the production backend URL in
`NEXT_PUBLIC_API_BASE_URL`. The Terraform runtime environment cannot rewrite
that browser bundle after the image is built. The backend service receives the
frontend Cloud Run URL as `FRONTEND_ORIGIN` for CORS.

## Planned Resource PRs

1. Add GitHub Actions image build/push workflow.
2. Add Terraform apply workflow.
3. Add runtime frontend API config or a frontend API proxy.
4. Add budget alert and IAM tightening.
5. Add custom domain and DNS after the basic deployment is stable.

## State

Use local state while learning. Before applying shared or production
infrastructure, move state to a remote backend such as GCS with state locking
strategy documented in a follow-up PR.
