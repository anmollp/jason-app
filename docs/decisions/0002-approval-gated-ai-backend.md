# 0002: Add an approval-gated AI backend around deterministic JSON tools

## Status

Accepted for the bounded ten-session pilot. Wider rollout, quota increases,
model changes, and release remain separate approval decisions.

## Context

AskJason adds natural-language guidance to Formatter, Diff, Patch, and Pointer.
The feature must not weaken the existing deterministic path, silently edit a
workspace, expose arbitrary tools, persist user content, or create unbounded
provider spend.

The initial Cloud Run decision deliberately had no application database. The AI
feature requires small amounts of shared state for account-free visitor guards,
concurrency leases, daily and monthly quotas, and cost accounting. It also needs
provider and identity secrets that must not enter Terraform configuration or
state.

## Decision

Keep the deterministic tools authoritative and place a constrained agent behind
the existing private NestJS backend:

- The browser submits selected JSON context and a short instruction through a
  same-origin Next.js proxy.
- The backend exposes only four static, strict-schema tools. It provides no
  shell, filesystem, URL, dynamic network, or database tool access to the model.
- Moderation runs before provider generation. The OpenAI Responses call uses
  `store: false`, a privacy-safe identifier, bounded rounds, and bounded output.
- Every proposed tool call is schema-validated and executed through the Jason
  Rust CLI. The browser receives a deterministic safe summary rather than an
  automatically applied result.
- Apply and Discard remain explicit browser actions. A model response alone
  cannot mutate workspace state.
- Firestore stores quota, lease, identity-HMAC, and cost-accounting metadata but
  not prompts, JSON documents, or provider responses.
- Secret Manager stores the OpenAI API key and the base64-encoded identity root
  key. Terraform creates secret containers only and attaches explicitly pinned
  numeric versions.
- The hosted feature fails closed and is disabled by default. The deterministic
  endpoints remain available when AI is disabled, exhausted, or unavailable.
- The local stdio MCP server reuses the four deterministic contracts but has no
  hosted AskJason, provider, quota, or workspace-mutation capability.

## Cost and rollout controls

- Cloud Run remains at zero minimum and one maximum instance.
- The approved pilot uses ten sessions per day, one session per visitor or
  network per rolling 24 hours, three turns per session, and 200 sessions per
  month.
- The application reserves usage against a local `$7.20` ceiling, backed by an
  operator-verified `$8` provider project hard limit.
- Enabling the feature requires an explicit Terraform input and both pinned
  secret versions. Increasing the daily limit to 20 requires a separate review.
- Evaluation, production smoke, stop conditions, and remaining approvals are
  maintained in [AI release readiness](../ai-release-readiness.md).

## Consequences

Positive:

- Natural-language help stays inside a small, reviewable tool boundary.
- Deterministic validation and explicit user approval remain authoritative.
- Shared quotas and leases work across scale-to-zero Cloud Run instances.
- Provider and identity secrets stay outside repository and Terraform state.

Tradeoffs:

- Firestore, Secret Manager, moderation, and provider availability add runtime
  dependencies to the optional AI path.
- Account-free identity controls can conservatively reject users behind shared
  networks and cannot prevent every distributed attacker.
- Cloud Run request logs retain standard operational metadata under project
  access and retention controls.
- Operator-reviewed provider limits and pilot observations remain necessary;
  repository tests alone cannot prove the complete production boundary.
