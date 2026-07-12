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

## Current Scaffold

This PR intentionally does not create cloud resources yet. It establishes:

- the provider/version structure.
- the dev environment entry point.
- naming and label conventions.
- cost-control variables.
- budget-alert variables for the next resource PR.

## Planned Resource PRs

1. Enable GCP APIs and create service accounts.
2. Create Artifact Registry repository.
3. Add backend Cloud Run service.
4. Add frontend Cloud Run service.
5. Add budget alert and IAM tightening.
6. Add GitHub Actions image build/deploy workflow.

## State

Use local state while learning. Before applying shared or production
infrastructure, move state to a remote backend such as GCS with state locking
strategy documented in a follow-up PR.
