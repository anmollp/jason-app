# AskJason AI release readiness

This is the evidence index and operator checklist for the AskJason AI copilot.
It does not authorize model spend, infrastructure changes, deployment, feature
enablement, quota changes, or release.

## Current verdict

**Not ready for production enablement.** The implementation and local failure
controls are validated, but the paid model evaluation, infrastructure plan and
apply, production smoke test, pilot observation, and final rollout approvals
remain outstanding.

The deterministic Formatter, Diff, Patch, and Pointer paths remain independent
of the AI feature and retain their 5 MiB request support.

## Evidence status

| Release requirement                                                                | Evidence                                                                                                                            | Status                                                                   |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 60-case matrix, ten cases in each approved category                                | [Fixtures](../backend/src/agent/evals/routing-fixtures.ts) and [fixture tests](../backend/src/agent/evals/routing-fixtures.spec.ts) | Implemented and CI-validated                                             |
| At least 90% correct tool routing                                                  | Hash-bound final Luna report                                                                                                        | Pending paid evaluation                                                  |
| 100% schema-valid tool calls                                                       | Fail-closed scorer and final Luna report                                                                                            | Scorer validated; live evidence pending                                  |
| 100% Jason-valid Patch proposals                                                   | Every Patch call matched by call ID to a successful Jason result                                                                    | Scorer validated; live evidence pending                                  |
| Zero unapproved workspace changes                                                  | Proposal-only backend plus explicit frontend Apply/Discard tests                                                                    | Validated locally and in CI                                              |
| Measured p95 Luna session cost below $0.03                                         | Twenty measured three-turn sessions with prior transcript context                                                                   | Runner validated; live evidence pending                                  |
| Three turns, two model rounds per turn, two tools per turn, four tools per session | Contract, orchestrator, state repository, and focused tests                                                                         | Validated locally and in CI                                              |
| One concurrent request                                                             | Firestore lease transaction and concurrency test                                                                                    | Validated locally and in CI                                              |
| 60-second request timeout                                                          | Session timeout tests, provider cancellation, five-second accounting bound                                                          | Validated locally and in CI                                              |
| One anonymous session per visitor or network per rolling 24 hours                  | Signed visitor token plus daily rotating IP HMAC guards                                                                             | Validated locally and in CI                                              |
| 20 daily and 200 monthly global sessions                                           | Transactional Firestore ledgers                                                                                                     | Validated locally and in CI                                              |
| $7.20 local reservation ceiling and $8 provider hard limit                         | Firestore budget ledger plus provider project configuration                                                                         | Local ledger validated; provider configuration pending operator evidence |
| No prompt, JSON, response, raw IP, or user-agent persistence                       | Metadata-only audit logger and private local eval reports                                                                           | Application behavior validated; production log inspection pending        |
| OpenAI `store: false` and privacy-safe safety identifier                           | Provider adapter and session tests                                                                                                  | Validated locally and in CI                                              |
| AI remains disabled by default                                                     | Application tests and Terraform policy definition                                                                                   | Application and Terraform policy test validated; plan pending            |
| Scale-to-zero and maximum one Cloud Run instance                                   | Terraform policy                                                                                                                    | Terraform plan and apply pending                                         |
| Graceful deterministic operation when AI is unavailable or exhausted               | Browser coverage across failure and quota states                                                                                    | Validated locally and in CI                                              |
| Local, client-neutral MCP parity                                                   | Private MCP package and contract tests                                                                                              | Implemented and merged; publication is out of scope                      |
| Load and failure behavior under the one-instance cap                               | Local real-Jason smoke plus controlled preproduction result                                                                         | Local deterministic smoke passed; preproduction run pending approval     |

## Threat model results

| Threat                                                        | Control                                                                                                                      | Verification                                                                   | Residual risk                                                                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Prompt injection in an instruction                            | Instruction is untrusted user content, moderation runs before provider access, and the prompt permits only four strict tools | Prompt, moderation, injection fixtures, and tool-contract tests                | A model can still produce a poor explanation; semantic review remains required                                               |
| Instructions embedded in JSON                                 | JSON is serialized as untrusted request data and never placed in developer instructions                                      | Injection fixtures include delimiter, role, tool-result, and approval spoofing | Live-model behavior must pass the injection eval category                                                                    |
| Arbitrary tool, shell, file, network, URL, or database access | AgentProvider receives exactly four static JSON tool definitions; Jason is invoked with fixed arguments and `shell: false`   | Architecture, orchestrator, runner, and MCP security tests                     | The trusted Jason executable inherits its OS permissions                                                                     |
| Malformed or extra tool arguments                             | Strict schemas and shared validation reject unknown, missing, extra, and oversized fields without echoing input              | Tool-contract and eval scorer tests                                            | Provider SDK/schema regressions require continued contract testing                                                           |
| Workspace mutation without consent                            | Tools return proposals only; the browser changes Patch workspace state only after Apply                                      | Patch Apply/Discard browser test                                               | Users can still deliberately apply an incorrect proposal after reviewing it                                                  |
| Cookie editing or clearing to obtain more quota               | HMAC-signed visitor cookie plus daily rotating IP HMAC; either active guard rejects a second session                         | Identity and Firestore tests                                                   | Shared NATs can produce conservative false positives; distributed attackers remain bounded by global caps                    |
| Concurrent quota races                                        | Session issuance, turn reservation, tool reservation, and completion use Firestore transactions and leases                   | State repository concurrency and limit tests                                   | Production Firestore contention and retry latency require pilot observation                                                  |
| Provider or state outage causing unaccounted spend            | Quota reservation precedes moderation/provider access; state, moderation, and spend failures fail closed                     | Session service failure tests                                                  | A provider request accepted immediately before a network partition can still bill; provider hard limit is the final backstop |
| Provider billing or quota exhaustion                          | Local session reservation ceiling, provider spend-limit mapping, and paid-eval circuit breaker                               | State, session, and eval policy tests                                          | Provider hard-limit configuration must be evidenced outside the repository                                                   |
| Secret or untrusted-content leakage in logs/errors            | Metadata-only structured audit records and normalized public errors; eval status is JSON-escaped                             | Audit, executor, session, HTTP-contract, and command tests                     | Production log sinks and access policy must be inspected after deployment                                                    |
| Oversized payload denial of service                           | AI context is capped at 16 KiB and instructions at 500 characters; deterministic path has its separate 5 MiB contract        | HTTP-contract, frontend, and backend E2E tests                                 | Cloud Run memory/latency under 5 MiB deterministic traffic requires production observation                                   |
| Stalled provider, moderation, state, or CLI operation         | Abort propagation, 60-second request deadline, five-second final accounting bound, and CLI kill backstop                     | Session, provider, orchestrator, and CLI runner tests                          | A pathological OS process that never closes intentionally holds the MCP lease fail-closed                                    |
| Eval evidence approved for a different response               | Paid run reserves a private report before spend; response/result and full evidence hashes bind offline judgments             | Eval report and command tests                                                  | SHA-256 detects mismatch, not a malicious same-user rewrite and re-hash                                                      |

No unresolved high-severity finding remains from the independent read-only
reviews performed on these implementation slices. This is not a substitute for
production validation. Security/privacy risk acceptance is still required
before infrastructure apply and production enablement.

## Automated results

Validated on 2026-08-13 from the committed Gate 6 stack:

- Backend unit: 23 suites, 113 tests passed.
- Backend E2E: 1 suite, 12 tests passed.
- Backend ESLint: passed.
- Backend Prettier check: passed.
- Backend TypeScript/Nest build: passed.
- Git diff whitespace validation: passed.
- Eval-stack GitHub CI: frontend and backend checks passed on all five stacked
  PRs, which are now merged.
- Terraform 1.15.8 policy test: 1 passed, 0 failed against the pinned Google
  7.39.0 provider; root and dev deployment configurations both validated.
- Local deterministic load smoke: 40 of 40 real-Jason requests passed using
  5,241,856-byte documents across Formatter, Diff, Patch, and Pointer.
- Independent read-only review: no remaining findings.

### Reproducible evidence manifest

The committed Gate 6 stack and its successful GitHub Actions runs are:

| Slice                            | Commit                                     | Pull request                                          | CI run                                                                       |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Fail-closed scorer               | `9502285216363610447100bf8ee65184383c0178` | [#110](https://github.com/anmollp/jason-app/pull/110) | [31721132519](https://github.com/anmollp/jason-app/actions/runs/31721132519) |
| Provider-neutral runner          | `27e6e84be40993731cfca533682c658883482f70` | [#106](https://github.com/anmollp/jason-app/pull/106) | [31721134654](https://github.com/anmollp/jason-app/actions/runs/31721134654) |
| Measured three-turn session cost | `ae5b5c8d2a43e976e7c1843f9818b0b70955d641` | [#107](https://github.com/anmollp/jason-app/pull/107) | [31721139134](https://github.com/anmollp/jason-app/actions/runs/31721139134) |
| Hash-bound offline report        | `182f0ecccc47badaf6fc171c803ff76644b77d7c` | [#108](https://github.com/anmollp/jason-app/pull/108) | [31721137933](https://github.com/anmollp/jason-app/actions/runs/31721137933) |
| Safe two-phase paid command      | `fad1862c3ebe246eaa0031a0dd7b5007020e2b0e` | [#109](https://github.com/anmollp/jason-app/pull/109) | [31721140065](https://github.com/anmollp/jason-app/actions/runs/31721140065) |

Additional release-support evidence:

| Evidence                         | Commit                                     | Pull request                                          | CI/deployment run                                                            |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Backend Docker workspace fix     | `1e244cf7112bad48ba0260fb1d34b4dd1324b474` | [#111](https://github.com/anmollp/jason-app/pull/111) | [31723609784](https://github.com/anmollp/jason-app/actions/runs/31723609784) |
| Terraform policy CI              | `4940e4fe7b83700b48c6b8a87d77b82621e418ef` | [#114](https://github.com/anmollp/jason-app/pull/114) | [31723172390](https://github.com/anmollp/jason-app/actions/runs/31723172390) |
| Local deterministic load harness | `ab1ac76a51e66be223fab455a6250624d88dd77b` | [#115](https://github.com/anmollp/jason-app/pull/115) | [31724426992](https://github.com/anmollp/jason-app/actions/runs/31724426992) |

The backend recovery run built and pushed the image and updated Cloud Run
successfully. This proves the Docker deployment failure is resolved; production
health and user-flow smoke checks remain a separate approval boundary.

The response-free local load report was generated on 2026-08-13 against
`127.0.0.1` using the real Jason CLI. It passed 20/20 requests at concurrency
one (p95 159.33 ms) and 20/20 at concurrency four (p95 201.18 ms). Its SHA-256
is `7c940a5843d250554d5cf3152c842a573107669eeedeaa475a7f7e680a534d7c`.
The artifact remains machine-local and contains only tool names, target and run
metadata, counts, timings, and safe failure classifications. This is load-smoke
evidence, not Cloud Run cold-start, CPU/memory, or capacity evidence.

The local validation commands were run from `backend/`:

```sh
node_modules/.bin/jest --runInBand
node_modules/.bin/jest --config test/jest-e2e.json --runInBand
node_modules/.bin/eslint "{src,test}/**/*.ts"
node_modules/.bin/prettier --check "src/**/*.ts" "test/**/*.ts"
node_modules/.bin/nest build
```

The private live-eval report is intentionally not a repository artifact. After
the paid run, record its SHA-256 evidence hash and link only the response-free
final report here.

The automated failure suite covers moderation rejection and outage, Firestore
outage, provider spend limit, provider 429 and 5xx classification, malformed
provider streams, unknown and duplicate tools, invalid arguments, request and
CLI timeouts, cancellation, accounting timeout, concurrency, session/turn/tool
quotas, oversized context, secret-safe errors, and AI-disabled behavior.

These tests and the local load smoke prove control behavior and local
deterministic execution, not production capacity. No claim is made yet about
production throughput, cold-start latency, CPU/memory headroom, Firestore
contention, provider latency, or real cost.

## Paid evaluation procedure

The paid command must use the dedicated spend-capped provider project. Do not
run it until the API key, provider alerts, and $8 hard limit have been verified
and model spend has been approved.

1. Build the pinned Jason CLI and set an absolute `JASON_CLI_PATH`.
2. Choose a new absolute path under `backend/eval-reports/`.
3. Run Luna with `AI_EVAL_MODE=run` and explicit paid confirmation.
4. Review every private case response and copy each exact `reviewHash` into the
   judgment file.
5. Run `AI_EVAL_MODE=finalize` offline. Preserve the private report locally and
   share only the response-free final report.
6. Before each run, record the model, report filename, prompt version, and prompt
   iteration number in a private local run manifest. After the run, add the
   private report's SHA-256 hash and hash the completed manifest. The report
   schema records `promptVersion`; the manifest supplies the iteration audit.
   Do not exceed two prompt iterations.
7. Repeat for Terra only for the approved model comparison.
8. Keep Luna if it reaches at least 90% routing accuracy. If only Terra reaches
   90%, request approval both to switch the hosted model and to reduce the
   monthly allowance from 200 sessions to 25. Never escalate models at runtime.

The run reserves a non-existing report destination before creating the provider,
preflights all four Jason tools, never overwrites evidence, and stops after the
first systemic authentication, permission, billing, quota, rate-limit, server,
or transport-timeout failure.

## Controlled load and failure procedure

Run this only in an isolated preproduction environment with non-production
Firestore data and a fake or separately spend-approved provider. Do not remove
production credentials, corrupt production counters, or deliberately disrupt
the live provider to manufacture failure states.

1. Confirm the backend has one CPU, 512 MiB memory, zero minimum instances, and
   one maximum instance.
2. From scale-to-zero, record five frontend-to-backend cold-start requests.
3. Send 20 deterministic requests with payloads just below 5 MiB at concurrency
   one, then 20 at concurrency four. Cover Formatter, Diff, Patch, and Pointer.
4. With a fake provider, run 20 three-turn AI sessions at concurrency one and
   four across distinct identities. Separately send two simultaneous turns for
   one session and verify exactly one is accepted.
5. Exercise moderation, Firestore, provider 429/5xx, timeout, malformed stream,
   and spend-limit failures through test doubles or an approved preproduction
   fault hook. Verify fail-closed responses and metadata-only logs.
6. Record request counts, status distribution, p50/p95 latency, cold-start
   latency, peak memory/CPU, instance count, restarts, Firestore retries, and
   quota/accounting reconciliation. Attach the command, build SHA, environment,
   timestamp, and response-free result artifact here. Record its SHA-256 hash
   with the evidence entry so later review cannot silently substitute a file.

The following are proposed acceptance thresholds and require explicit approval
before the run becomes release evidence:

- Zero crashes, restarts, OOMs, content/secret logging, unapproved mutations,
  quota bypasses, or accounting mismatches.
- Zero unexpected 4xx/5xx responses in deterministic traffic and 100% valid
  deterministic results.
- Warm deterministic p95 at or below 5 seconds; cold-start p95 at or below 15
  seconds; AI requests must finish or fail safely within the 60-second contract.
- Peak memory below 90% of 512 MiB and no more than one backend instance.

Do not run paid AI load as part of this procedure. Real provider latency and
cost are measured by the separately approved evaluation and ten-session pilot.

## Infrastructure and production smoke checklist

### Before apply

- [ ] Review an exact Terraform plan with `ai_enabled = false`.
- [ ] Confirm Cloud Run minimum instances remain zero and maximum instances one.
- [ ] Confirm the daily limit is 10 for the pilot, not 20.
- [ ] Confirm the monthly Luna limit is 200.
- [ ] Confirm Firestore deletion protection, no backend `allUsers` invoker, and
      authenticated frontend service-account proxy access. The current Cloud Run
      ingress setting is `INGRESS_TRAFFIC_ALL`; IAM provides the privacy boundary.
- [ ] Confirm Secret Manager references contain version identifiers, not secret values.
- [ ] Confirm the runtime service account can access only the required secrets and Firestore data.
- [ ] Confirm provider alerts at $4, $6, and $7.20 and the enforced $8 hard limit.
- [ ] Confirm the existing $10 GCP alert is unchanged.

### After apply, feature still disabled

- [ ] Verify frontend and backend health endpoints.
- [ ] Verify Formatter, Diff, Patch, and Pointer with AI disabled.
- [ ] Verify a deterministic payload near 5 MiB succeeds.
- [ ] Verify `/api/agent/session` fails safely while disabled.
- [ ] Inspect logs for secret values, prompts, JSON, responses, raw IPs, and user agents.
- [ ] Confirm no unexpected minimum instances or additional Cloud Run revisions serve traffic.

### Ten-session pilot

- [ ] Enable only after explicit approval.
- [ ] Issue one session and confirm the signed HttpOnly, SameSite, Secure cookie.
- [ ] Exercise all four tools and verify proposal-only behavior.
- [ ] Verify Apply and Discard, clarification, quota exhaustion, and deterministic
      fallback states. Verify induced moderation, timeout, and provider failures
      only through the controlled preproduction procedure above; production smoke
      testing must not alter credentials or disrupt the provider.
- [ ] Attempt a second visitor session and a second IP-bound session inside 24 hours.
- [ ] Send concurrent turns and confirm one is rejected.
- [ ] Confirm remaining turns and tools decrement correctly.
- [ ] Confirm audit logs contain only the approved metadata fields.
- [ ] Confirm Firestore daily/monthly/reserved/actual counters reconcile with usage.
- [ ] Confirm provider usage and estimated local cost reconcile within the documented pricing model.

## Seven-day pilot review

Record these values daily without storing prompt or document content:

- Sessions issued, rejected, and failed.
- Requests completed, moderated, timed out, and rejected concurrently.
- Tool selection and deterministic validation outcomes.
- p50/p95 latency and cold-start observations.
- Input, cached-input, and output tokens.
- Estimated and provider-reported cost.
- Firestore errors or transaction retries.
- Provider 429, 5xx, quota, and spend-limit failures.
- Any security, privacy, accessibility, or user-reported issue.

Stop the pilot and disable the feature for any secret/content logging,
unapproved workspace change, quota/accounting bypass, high-severity security
finding, p95 Luna session cost at or above $0.03, any accounting/state write
failure, or an OpenAI hard-limit event. Pause and review after the $4 provider
alert, two provider/time-out failures in any ten consecutive sessions, or a
provider-versus-local cost difference greater than the larger of 10% or $0.01.
These proposed pilot thresholds require explicit approval before enablement. Do
not increase to 20 sessions per day until the seven-day evidence is reviewed and
approved.

## Release notes draft

AskJason adds an optional AI-guided drawer to Formatter, Diff, Patch, and
Pointer. Jason can explain formatting errors, summarize diffs, propose JSON
Patch operations, and resolve JSON Pointers through the same deterministic Rust
engine used by the existing tools. AI changes are previews and require an
explicit Apply action. Anonymous guided sessions are intentionally limited;
when AI is unavailable or exhausted, every deterministic JSON tool remains
available.

The release also documents its provider-neutral agent contract, strict tool
schemas, privacy boundaries, moderation, transactional quotas, budget controls,
evaluation method, and local client-neutral MCP server. The measured session
cost will be published only after a hash-bound paid-evaluation report passes.

## Remaining approval boundaries

- Merge the remaining approved support PRs.
- Approve provider credentials, project limits, and paid Luna/Terra evaluation.
- Approve the exact Terraform plan and apply.
- Approve production smoke testing with the feature disabled.
- Approve the 10-session-per-day pilot enablement.
- Review seven days of pilot evidence.
- Approve any increase to 20 sessions per day.
- Approve any hosted-model switch, quota/budget increase, release, or publication.
