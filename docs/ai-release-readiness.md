# AskJason AI release readiness

This is the evidence index and operator checklist for the AskJason AI copilot.
It does not authorize model spend, infrastructure changes, deployment, feature
enablement, quota changes, or release.

**Last verified:** 2026-08-22 against production smoke evidence from `master`
`c233888` and the repository state linked below.

## Current verdict

**Ten-session pilot active; seven-day review in progress.** The implementation,
local failure controls, paid Luna evaluation, infrastructure apply, disabled
smoke, all-tool workspace approval correction, and enabled Formatter, Diff,
Patch, and Pointer production smoke are complete. The pilot observation window
and final release review remain open.

The deterministic Formatter, Diff, Patch, and Pointer paths remain independent
of the AI feature and retain their 5 MiB request support.

## Evidence status

| Release requirement                                                                | Evidence                                                                                                                            | Status                                                                 |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 60-case matrix, ten cases in each approved category                                | [Fixtures](../backend/src/agent/evals/routing-fixtures.ts) and [fixture tests](../backend/src/agent/evals/routing-fixtures.spec.ts) | Implemented and CI-validated                                           |
| At least 90% correct tool routing                                                  | Hash-bound final Luna report                                                                                                        | 100% on the final paid run                                             |
| 100% schema-valid tool calls                                                       | Fail-closed scorer and final Luna report                                                                                            | 100% on the final paid run                                             |
| 100% Jason-valid Patch proposals                                                   | Every Patch call matched by call ID to a successful Jason result                                                                    | 100% on the final paid run                                             |
| Zero unapproved workspace changes                                                  | Proposal-only backend plus explicit Apply/Discard tests for all four tools                                                          | CI validated; all-tool production proposal-boundary smoke complete     |
| Measured p95 Luna session cost below $0.03                                         | Twenty measured three-turn sessions with prior transcript context                                                                   | $0.000918 on the final paid run                                        |
| Three turns, two model rounds per turn, two tools per turn, four tools per session | Contract, orchestrator, state repository, and focused tests                                                                         | Validated locally and in CI                                            |
| One concurrent request                                                             | Firestore lease transaction and concurrency test                                                                                    | Validated locally and in CI                                            |
| 60-second request timeout                                                          | Session timeout tests, provider cancellation, five-second accounting bound                                                          | Validated locally and in CI                                            |
| One account-free session per visitor or network per rolling 24 hours               | Signed visitor token plus daily rotating IP HMAC guards                                                                             | Validated locally and in CI                                            |
| 10 daily pilot; 20 daily only after review; 200 monthly                            | Transactional Firestore ledgers                                                                                                     | 10/day deployed; 20/day remains unapproved; 200/month validated        |
| $7.20 local reservation ceiling and $8 provider hard limit                         | Firestore budget ledger plus dedicated provider project configuration                                                               | Local ledger validated; $8 provider limit and alerts operator-verified |
| No application persistence of prompts, JSON, or provider responses                 | Content-field log exclusion, metadata-only AI audit logger, and private local eval reports                                          | Application behavior and production logs inspected                     |
| Standard Cloud Run request metadata retained for operations                        | Platform request logs may include raw IP and user-agent fields under project logging access and retention controls                  | Retention approved and production behavior inspected                   |
| OpenAI `store: false` and privacy-safe safety identifier                           | Provider adapter and session tests                                                                                                  | Validated locally and in CI                                            |
| AI remains disabled by default                                                     | Application tests and Terraform policy definition                                                                                   | Default validated; approved 10/day pilot currently enabled             |
| Scale-to-zero and maximum one Cloud Run instance                                   | Terraform policy and deployed Cloud Run configuration                                                                               | Deployed configuration inspected: minimum zero, maximum one            |
| Graceful deterministic operation when AI is unavailable or exhausted               | Browser coverage across failure and quota states                                                                                    | Validated locally and in CI                                            |
| Local, client-neutral MCP parity                                                   | Private MCP package and contract tests                                                                                              | Implemented and merged; publication is out of scope                    |
| Load and failure behavior under the one-instance cap                               | Local real-Jason smoke plus production pilot observation                                                                            | Local deterministic smoke passed; seven-day production review ongoing  |

## Threat model results

| Threat                                                        | Control                                                                                                                      | Verification                                                                   | Residual risk                                                                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Prompt injection in an instruction                            | Instruction is untrusted user content, moderation runs before provider access, and the prompt permits only four strict tools | Prompt, moderation, injection fixtures, and tool-contract tests                | A model can still produce a poor explanation; semantic review remains required                                               |
| Instructions embedded in JSON                                 | JSON is serialized as untrusted request data and never placed in developer instructions                                      | Injection fixtures include delimiter, role, tool-result, and approval spoofing | Final paid run passed all ten injection and abuse cases                                                                      |
| Arbitrary tool, shell, file, network, URL, or database access | AgentProvider receives exactly four static JSON tool definitions; Jason is invoked with fixed arguments and `shell: false`   | Architecture, orchestrator, runner, and MCP security tests                     | The trusted Jason executable inherits its OS permissions                                                                     |
| Malformed or extra tool arguments                             | Strict schemas and shared validation reject unknown, missing, extra, and oversized fields without echoing input              | Tool-contract and eval scorer tests                                            | Provider SDK/schema regressions require continued contract testing                                                           |
| Workspace mutation without consent                            | Tools return proposals only; the browser changes any tool workspace state only after Apply                                   | Formatter, Diff, Patch, and Pointer Apply/Discard browser tests                | Users can still deliberately apply an incorrect proposal after reviewing its deterministic summary                           |
| Cookie editing or clearing to obtain more quota               | HMAC-signed visitor cookie plus daily rotating IP HMAC; either active guard rejects a second session                         | Identity and Firestore tests                                                   | Shared NATs can produce conservative false positives; distributed attackers remain bounded by global caps                    |
| Concurrent quota races                                        | Session issuance, turn reservation, tool reservation, and completion use Firestore transactions and leases                   | State repository concurrency and limit tests                                   | Production Firestore contention and retry latency require pilot observation                                                  |
| Provider or state outage causing unaccounted spend            | Quota reservation precedes moderation/provider access; state, moderation, and spend failures fail closed                     | Session service failure tests                                                  | A provider request accepted immediately before a network partition can still bill; provider hard limit is the final backstop |
| Provider billing or quota exhaustion                          | Local session reservation ceiling, provider spend-limit mapping, and paid-eval circuit breaker                               | State, session, and eval policy tests                                          | Provider hard-limit configuration must be evidenced outside the repository                                                   |
| Secret or untrusted-content leakage in logs/errors            | Metadata-only AI audit records, content-field exclusion, and normalized public errors; eval status is JSON-escaped           | Audit, executor, session, HTTP-contract, and command tests                     | Cloud Run request logs intentionally retain standard request metadata; access and retention require production inspection    |
| Oversized payload denial of service                           | AI context is capped at 16 KiB and instructions at 500 characters; deterministic path has its separate 5 MiB contract        | HTTP-contract, frontend, and backend E2E tests                                 | Cloud Run memory/latency under 5 MiB deterministic traffic requires production observation                                   |
| Stalled provider, moderation, state, or CLI operation         | Abort propagation, 60-second request deadline, five-second final accounting bound, and CLI kill backstop                     | Session, provider, orchestrator, and CLI runner tests                          | A pathological OS process that never closes intentionally holds the MCP lease fail-closed                                    |
| Eval evidence approved for a different response               | Paid run reserves a private report before spend; response/result and full evidence hashes bind offline judgments             | Eval report and command tests                                                  | SHA-256 detects mismatch, not a malicious same-user rewrite and re-hash                                                      |

No unresolved high-severity finding remains from the independent read-only
reviews performed on these implementation slices. This is not a substitute for
production validation. Security/privacy risk was accepted for the current
10-session pilot; any material control change, subsequent infrastructure apply,
or wider rollout requires renewed review and approval.

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

### Paid Luna evaluation

Four explicitly approved Luna runs were completed with no Terra run. The third
and fourth runs were one-time exceptions to the normal two-iteration limit to
resolve two narrow semantic clarification failures.

| Iteration | Prompt | Jason CLI             | Routing | Schema | Jason-valid Patch | p95 three-turn session | Human semantic review | Ready |
| --------- | ------ | --------------------- | ------- | ------ | ----------------- | ---------------------- | --------------------- | ----- |
| 1         | v1     | `1a889e66`            | 85%     | 100%   | 85.714%           | $0.001797              | Not finalized         | No    |
| 2         | v2     | `1a889e66`            | 93.333% | 100%   | 100%              | $0.001653              | 54/60                 | No    |
| 3         | v3     | `a47a1266` (`v1.7.1`) | 100%    | 100%   | 100%              | $0.001512              | 59/60                 | No    |
| 4         | v4     | `a47a1266` (`v1.7.1`) | 100%    | 100%   | 100%              | $0.000918              | 60/60                 | Yes   |

The final run passed all automatic and semantic gates across 60 cases and twenty
measured three-turn sessions. In particular, `ambiguous-patch-date` requested
the unresolved target, operation, and value without assuming a field. The
response-free final report is `ready: true`. Estimated full-run model spend was
$0.027194, $0.026173, $0.025238, and $0.012710 respectively, or $0.091315
combined. Two initial iteration-four attempts stopped on provider HTTP 500s
with zero tokens and usage records. A bounded diagnostic opened a stream and
was aborted at `response.created`; the conservative iteration-four upper bound,
including that diagnostic, is $0.014001 against the approved $0.03 cap.

The private reports and judgments remain local with mode `0600`; no response
text or credential is committed. Evidence hashes:

- Iteration 1 private report SHA-256: `cd63a1796eb825394bbb03431b633f459c4b5763a89bc75a1c4ca47bad37bbc4`.
- Iteration 2 private report SHA-256: `c640c6d5866a101a191c795d639f94da50e18b547258fe464436d19d2d212a7e`.
- Iteration 2 judgments SHA-256: `92d2c585ac9625576101200a3eae4897ecbdb2d65d9817eec68b79c58892168c`.
- Iteration 2 response-free final report SHA-256: `1209997a9b672d62238e5acacf731724cb2889c1ff57a5de0e8d758c4296671e`.
- Iteration 3 private report SHA-256: `758b4ee15f09e1ff16194ad9088cd459cd3cb6995e6c89f66628262b09305f78`.
- Iteration 3 judgments SHA-256: `79391830f71c14c3ab5735d620603dce1d093ed5e393b4ec0cd719032ea0f292`.
- Iteration 3 response-free final report SHA-256: `593616ffc7863ddd68a0ad40e747b8b05d2085eb6003e6e9e9640c8b4eb93916`.
- Iteration 3 completed manifest SHA-256: `880aa29d9d18ea4d8b0ff1c69bd0550bd525a358e13072cdfb1e4a4b6510c6ca`.
- Iteration 4 private report SHA-256: `4c07f33f61233a9b4dda377455536f8024277b3dc0d242f0cac975ca5decaf80`.
- Iteration 4 judgments SHA-256: `589896a56ffc07f450c0c16c79126af47227e51981d4a3eeb7a2040387801c22`.
- Iteration 4 response-free final report SHA-256: `0fb02f3d1609cda36f22c4e7213061deb1e3608c53248b68fe7fe5a8b3aca2d6`.
- Iteration 4 completed manifest SHA-256: `3a1a54470f08baf5f6140a7009d18fbbd688b1720e6991dfcfdb0b3661d89da3`.

The dedicated provider project has auto-reload disabled, an enforced $8 hard
limit, and alerts at $4, $6, and $7.20. No secret value is part of this evidence.

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

The all-tool workspace approval correction and final exhausted-turn label fix
are merged in this green sequence:

| Slice                       | Merged commit                              | Pull request                                          | CI run                                                                       |
| --------------------------- | ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Proposal payload validation | `a1587177990dd1df6025c495d9d08a988c49731c` | [#135](https://github.com/anmollp/jason-app/pull/135) | [32575008256](https://github.com/anmollp/jason-app/actions/runs/32575008256) |
| Workspace result adapters   | `abf36425e284b775da27a7b0c8e39d459edfed22` | [#136](https://github.com/anmollp/jason-app/pull/136) | [32575008256](https://github.com/anmollp/jason-app/actions/runs/32575008256) |
| Apply/Discard result flow   | `24ec120189079d21926b73744e2f1655bf789ecd` | [#137](https://github.com/anmollp/jason-app/pull/137) | [32575008256](https://github.com/anmollp/jason-app/actions/runs/32575008256) |
| Exhausted-turn label        | `64ff7689aab26c67684c01b9ee89bef8a309b969` | [#140](https://github.com/anmollp/jason-app/pull/140) | [32577935573](https://github.com/anmollp/jason-app/actions/runs/32577935573) |

The backend recovery run built and pushed the image and updated Cloud Run
successfully. This proved the Docker deployment failure was resolved;
production health and user-flow behavior were later validated under separate
approvals in the pilot observations below.

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

The private live-eval reports are intentionally not repository artifacts. The
hashes above bind the local private evidence and response-free final reports;
model responses remain excluded from the repository.

The automated failure suite covers moderation rejection and outage, Firestore
outage, provider spend limit, provider 429 and 5xx classification, malformed
provider streams, unknown and duplicate tools, invalid arguments, request and
CLI timeouts, cancellation, accounting timeout, concurrency, session/turn/tool
quotas, oversized context, secret-safe errors, and AI-disabled behavior.

These tests and the local load smoke prove control behavior and local
deterministic execution, not production capacity. No representative or p95
production claim is made about throughput, cold-start latency, CPU/memory
headroom, Firestore contention, provider latency, or cost beyond the bounded
pilot observations below.

## Pilot observations

Read-only production inspection on 2026-08-21 confirmed:

- Evidence was inspected at `master` `f41aa02` after deployment run
  [32494522470](https://github.com/anmollp/jason-app/actions/runs/32494522470),
  with backend revision `jason-dev-backend-00020-kqw` and frontend revision
  `jason-dev-frontend-00016-8dq` serving traffic.
- The backend and frontend revisions were healthy with AI enabled for the
  approved 10-session-per-day pilot.
- Cloud Run remained configured for zero minimum and one maximum instance.
- The first Formatter request completed through the live provider in 7,235 ms
  using 2,456 input, 1,120 cached-input, and 173 output tokens. The local
  pricing estimator recorded $0.000498.
- A second session recorded completed turns with Formatter, Diff, and Patch
  selected. Across both sessions, metadata-only audit records contain four
  completed turns and no failed model request.
- Firestore reconciled two sessions, four accepted turns, three deterministic
  tool calls, 8,926 input, 5,514 cached-input, and 751 output tokens. It records
  a $0.06 reserved allowance and $0.001697 of locally estimated usage.
- Six later session attempts from an identity or network with an active guard
  returned the expected HTTP 429 without increasing counters or contacting the
  provider.
- The current serving backend revision had no warning-or-higher application
  log. Its request warnings were the six expected 429s; unrelated frontend
  requests included favicon 404s.

After the workspace approval correction and exhausted-turn label were merged,
read-only production inspection on 2026-08-22 confirmed:

- Master `64ff768` passed frontend, backend, MCP, and Terraform CI in
  [32577935573](https://github.com/anmollp/jason-app/actions/runs/32577935573).
  Frontend deployment
  [32577935568](https://github.com/anmollp/jason-app/actions/runs/32577935568)
  moved 100% of traffic to `jason-dev-frontend-00021-d7v`; backend revision
  `jason-dev-backend-00020-kqw` remained healthy.
- One three-turn session exercised Formatter Discard, Diff Apply, and Patch
  Apply. Each workspace stayed unchanged while its proposal was pending;
  Discard preserved Formatter state, while the approved Diff and Patch results
  changed only their selected workspaces.
- A fresh visitor/network session exercised Pointer Apply on the bundled
  synthetic sample. The user-observed workspace remained unresolved before
  approval and showed the expected resolved scalar only after Apply. The
  metadata-only audit records one successful `pointer` turn and tool call in
  5,201 ms using 2,542 input, 1,162 cached-input, and 157 output tokens at an
  estimated $0.000488.
- Firestore reconciled four sessions, eight accepted turns, seven deterministic
  tool calls, 19,540 input, 12,301 cached-input, and 1,691 output tokens. It
  records a $0.12 reserved allowance and $0.003728 of locally estimated usage.
- The all-tool smoke produced no warning-or-higher application log. The only
  frontend request warnings were unrelated favicon 404s. A rejected attempt
  from an already guarded browser produced no model audit event and did not
  change counters or spend.

Together, these observations verify live provider requests, the rolling
visitor/network guard, and counter reconciliation. They do not prove the global
ten-session cap under load, instance saturation behavior, or representative
production latency. No prompt, JSON document, model response, secret, raw IP
address, user-agent string, cookie, or session identifier is included in this
evidence.

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
   Do not normally exceed two prompt iterations. The 2026-08-21 Luna evaluation
   used explicitly approved third and fourth iterations; these exceptions do
   not change the default policy for future evaluations.
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
   fault hook. Verify fail-closed responses, content-free AI audit logs,
   and the approved standard Cloud Run request metadata.
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

## Deployment and production smoke checklist

The initial apply, disabled smoke, approved pilot enablement, all-tool correction
deployment, and bounded production smoke established the live evidence above.
The checklist remains the operator reference for any later deployment.

### Before the next apply

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

### After the next apply, feature still disabled

- [ ] Verify frontend and backend health endpoints.
- [ ] Verify Formatter, Diff, Patch, and Pointer with AI disabled.
- [ ] Verify a deterministic payload near 5 MiB succeeds.
- [ ] Verify `/api/agent/session` fails safely while disabled.
- [ ] Inspect logs for secret values, prompts, JSON, and provider responses.
- [ ] Confirm Cloud Run request logs retain the expected IP and user-agent
      metadata and verify the configured access and retention controls.
- [ ] Confirm no unexpected minimum instances or additional Cloud Run revisions serve traffic.

### Ten-session pilot re-smoke

- [ ] Enable only after explicit approval.
- [ ] Issue one session and confirm the signed HttpOnly, SameSite, Secure cookie.
- [ ] Exercise all four tools and verify the chat shows only a deterministic
      safe summary before Apply, never the full result body.
- [ ] Verify Apply and Discard, clarification, quota exhaustion, and deterministic
      fallback states. Verify induced moderation, timeout, and provider failures
      only through the controlled preproduction procedure above; production smoke
      testing must not alter credentials or disrupt the provider.
- [ ] Attempt a second visitor session and a second IP-bound session inside 24 hours.
- [ ] Send concurrent turns and confirm one is rejected.
- [ ] Confirm remaining turns and tools decrement correctly.
- [ ] Confirm AI audit logs contain only the approved metadata fields and that
      standard Cloud Run request metadata is retained separately.
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
These are the accepted stop and pause thresholds for the active pilot. Do not
increase to 20 sessions per day until the seven-day evidence is reviewed and
approved.

## Release notes draft

AskJason adds an optional AI-guided drawer to Formatter, Diff, Patch, and
Pointer. Jason can explain formatting errors, summarize diffs, propose JSON
Patch operations, and resolve JSON Pointers through the same deterministic Rust
engine used by the existing tools. Each validated result remains a proposal:
the chat presents a deterministic safe summary, and only an explicit Apply
action changes the corresponding workspace. Discard leaves it unchanged.
Account-free guided sessions are intentionally limited;
when AI is unavailable or exhausted, every deterministic JSON tool remains
available.

The release also documents its provider-neutral agent contract, strict tool
schemas, privacy boundaries, moderation, transactional quotas, budget controls,
evaluation method, and local client-neutral MCP server. A hash-bound paid Luna
report now passes every automatic and semantic gate; its measured cost remains
internal release evidence during the bounded production pilot.

## Remaining approval boundaries

- Review seven days of pilot evidence.
- Approve any increase to 20 sessions per day.
- Approve any hosted-model switch, quota/budget increase, release, or publication.
