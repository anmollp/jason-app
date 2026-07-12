# 0001: Use GCP Cloud Run With Terraform For First Production Deploy

## Status

Accepted

## Context

Jason needs public hosting that is:

- close to industry-standard production patterns.
- inexpensive for an individual project.
- manageable through Terraform.
- friendly to containerizing the backend with the Jason Rust CLI binary.

The app has two deployable services:

- `frontend`: Next.js web app.
- `backend`: NestJS API that shells out to the Jason CLI through
  `JASON_CLI_PATH`.

## Decision

Use **Google Cloud Run** as the first production runtime and manage it with
Terraform.

The target infrastructure shape is:

```text
GitHub Actions
  -> build frontend container
  -> build backend container with Jason CLI
  -> push images to Artifact Registry

Terraform
  -> enable required GCP APIs
  -> create Artifact Registry repository
  -> create Cloud Run frontend service
  -> create Cloud Run backend service
  -> configure service accounts, IAM, env vars, and budget alerts
```

## Why Cloud Run

Cloud Run fits this project because it supports containers, scales down for low
traffic, and has a usage-based pricing model with a free tier. Google Cloud's
pricing page says Cloud Run charges only for resources used after free tier, and
the request-based service free tier includes requests, CPU, and RAM allowances:
https://cloud.google.com/run/pricing

For this project, the most important cost-control setting is `min_instances = 0`.
That avoids paying for an always-warm instance while the app is mostly idle.

## Alternatives Considered

### AWS App Runner

App Runner is a clean managed container service, but it keeps provisioned
container memory warm by default. AWS's own pricing examples show a lightweight
latency-sensitive API at about $25.50/month when provisioned for 24 hours/day:
https://aws.amazon.com/apprunner/pricing/

That is reasonable for a business service, but high for an individual portfolio
project.

### AWS Lightsail

Lightsail gives predictable small fixed-cost servers and has cheap entry-level
bundles: https://aws.amazon.com/lightsail/pricing/

It is a viable fallback if we want AWS and fixed monthly cost, but it is more
server-like and less aligned with a modern serverless container learning path.

### ECS/Fargate

ECS/Fargate is industry standard and powerful, but it would introduce more
infrastructure surface area too early: VPC, load balancer, target groups,
security groups, IAM roles, and container orchestration details.

It is a good future learning step, not the first deploy.

## Cost Controls

The Terraform plan should default to:

- Cloud Run `min_instances = 0`.
- Cloud Run `max_instance_count = 1` for dev.
- request-based billing.
- no database.
- no VPC connector.
- modest memory and CPU.
- budget alert variables included from the beginning.

## Consequences

Positive:

- Low-cost production path.
- Real container-based deployment.
- Strong Terraform learning value.
- Easy to split frontend/backend services.
- Backend can package the Rust CLI binary inside its container.

Tradeoffs:

- Cold starts are possible with `min_instances = 0`.
- GCP-specific Terraform and IAM knowledge required.
- Custom domains and CI/CD deploys should be added in later PRs.

## Next Steps

1. Scaffold Terraform project and dev environment.
2. Add backend Dockerfile that includes the Jason CLI binary.
3. Add frontend Dockerfile.
4. Add Terraform resources for APIs, Artifact Registry, service accounts, and
   Cloud Run.
5. Add GitHub Actions workflow for image builds and deploys.
6. Add custom domain and DNS only after the basic deployment is stable.
