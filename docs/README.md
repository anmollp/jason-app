# AskJason documentation

This directory separates current operating guidance from historical decisions
and dated release evidence.

## Current source of truth

- [Architecture](architecture.md): runtime components, deterministic and AI
  request paths, trust boundaries, deployment shape, and local MCP surface.
- [Deployment runbook](deployment.md): production configuration, Terraform and
  application workflows, health checks, and smoke tests.
- [AI release readiness](ai-release-readiness.md): dated evaluation evidence,
  active pilot status, stop conditions, and approval boundaries. Last verified:
  2026-08-22.
- [Terraform README](../terraform/README.md): module-specific variables,
  resources, IAM, state, and workflow details.
- [Backend README](../backend/README.md), [frontend README](../frontend/README.md),
  and [MCP README](../backend/mcp/README.md): package-level setup and contracts.

## Decisions

Architecture decision records describe the context and choice at the time they
were accepted. Later ADRs amend earlier decisions without erasing their history.

- [0001: GCP Cloud Run with Terraform](decisions/0001-gcp-cloud-run-terraform.md)
- [0002: Approval-gated AI backend](decisions/0002-approval-gated-ai-backend.md)

## Maintainer guidance

- Update architecture and deployment documentation in the same pull request as
  a contract, environment variable, endpoint, or infrastructure change.
- Treat release-readiness measurements as dated evidence. Add a new observation
  or explicitly update its verification date instead of silently rewriting old
  results.
- Refresh `assets/landing.png`, `assets/playground.png`, and
  `assets/ai-case-study.png` from the deployed application when visible product
  surfaces materially change.
- Keep generated reports, credentials, Terraform state, and private evaluation
  responses out of Git.
