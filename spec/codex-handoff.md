# Codex handoff — `codex/next`

SDK worktree: `/Users/tirumalrao/workspace/niyantra/commerce-tssdk-next`. The branch was not merged, rebased, pushed, or published. The continuation below also has a Commerce server branch at `/Users/tirumalrao/workspace/niyantra/commerce-next`; the Go SDK was not edited.

## Commits and reasons

1. `ff0973f` Reconcile stale checklist claims against current tests — credited existing hooks, request IDs, typed events, package checks, and coverage only where evidence existed.
2. `182445f` Harden status handling, rate fairness, and secret-safe inspection — covered 202/204/empty success, final 429/5xx preservation, FIFO cancellable rate waits, and redacted debug/error views.
3. `4b709e2` Document namespace scopes and close evidenced P0 items — mapped namespace auth/scope, error, and retry rules from the server guard.
4. `1504b7e` Enforce strict type-aware lint on SDK source — applied strict type-checked rules to production source with zero warnings.
5. `d76e606` Gate bundle size and service tree shaking — pinned esbuild and added a 25 KiB gzip budget plus a one-service bundle assertion.
6. `7c013bf` Add verified webhook dispatch with durable replay hook — added typed Request-to-Response dispatch, an atomic `WebhookDedupe` interface, replay guidance, and a real-delivery smoke.
7. `592b46d` Add server-derived license format and verified offline cache — checked generated-key shape and re-verified signed certificates before storing and on read.
8. `e9d6e9c` Track exported API report and compile-time type contracts — pinned API Extractor, `ajv`, and `expect-type`; committed the declaration report and type assertions.
9. `253a8d1` Redact offline verification debug views and document crypto review — shared redacted JSON/inspect views, removed parser causes that could quote secrets, and compared HMAC/Ed25519 logic with Go source.
10. `a27029f` Reject invalid verification clocks before signature window checks — prevented NaN clocks from bypassing webhook tolerance and offline expiry checks.
11. `2c52029` Run portable quality gates and dependency scans in CI — added Ubuntu/macOS/Windows jobs, made package checks independent of Unix `tar`, and added an npm audit job.
12. `1fc8b3e` Document contributor workflow and reconciled quality evidence — added CONTRIBUTING, TSDoc examples, release/CI links, and evidence-based checklist updates.
13. The final handoff commit records this report and corrects additional stale checklist text.

## Bugs, tests, and user-visible behavior

- A no-body response kind now accepts empty 202/204 success (`test/edge-pipeline.test.ts`: “accepts 202 with no-body response kind” and “accepts 204 with no-body response kind”). A 202 with a valid `data` envelope decodes normally; an empty typed success rejects as `CommerceProtocolError` (“decodes a 202 data response and rejects empty typed success”).
- A final 429/503 remains a `CommerceApiError` with its status/code after safe GET retries run out (`test/edge-pipeline.test.ts`: “retains the final HTTP 429 envelope after GET retries” and the 503 case). Mutations and multipart remain single-attempt.
- Client rate-limit waits are FIFO, bounded, and cancellable under an injected clock (`test/edge-pipeline.test.ts`: “serves queued requests in arrival order and releases an aborted turn”). The clock is an optional advanced `ClientOptions.rateLimit.clock` field.
- HTTP and offline results keep explicit secret field access while JSON/Node inspection redact those fields. API errors redact credentials and secret input values. Invalid signed JSON has no parser cause that could quote a license key (`test/edge-redaction.test.ts`, `test/offline-certificate-cache.test.ts`, `test/webhook-handler.test.ts`). `CommerceNetworkError` still preserves the underlying fetch cause unless it mentions an active secret.
- `defineWebhookHandler` verifies raw bytes, routes known typed events, accepts rotated secrets, returns 204 for handled/duplicate/unhandled valid events, 401 for invalid signatures, 405 for non-POST, and 500 when handling fails. Its dedupe store must atomically claim signed `event.id` and roll back failed callbacks. The live smoke replayed a real `license.issued` delivery through the handler and observed one dispatch.
- `OfflineCertificateCache` accepts async pluggable storage and re-verifies signature, fingerprint, and expiry on each read. Its memory adapter is volatile. `isGeneratedLicenseKeyFormat` checks shape only; it cannot establish validity. Both used live server-issued values.
- Invalid caller clocks now reject in both verifiers (`test/webhook.test.ts`: “rejects a non-finite verification clock”; `test/offline-verifier.test.ts`: “rejects an invalid caller clock before checking expiry”).

## Checklist and deployment notes

`spec/todo.md` now credits §3.3 webhook handler, CONTRIBUTING, and type tests; §3.4 generated-key format and webhook routing; §4.1 dependency scanning; §4.3 zero-warning lint, bundle budget, API report, and crypto review; and §5.2 tree shaking. It marks storage adapters, Codecov upload, cross-platform runner proof, and method-level TSDoc examples partial. Corrective §B/§C/§F items were updated only after their tests. Remaining live workflow gaps are order create/checkout/fulfill, payment/refund, and invoice lifecycle; gateway provider connectivity was deliberately not sent to a third party.

No server migrations or environment changes are needed for the SDK changes. The opt-in live CI job still needs `RUN_LIVE_CONTRACT=true` and `COMMERCE_REPO_TOKEN`. Codecov stays disabled until a maintainer configures `CODECOV_TOKEN` and adds a pinned upload step. `package.json` remains `"private": true`; no publishing was attempted. The package stays ESM-only with zero runtime dependencies.

The fingerprint helper was skipped because Commerce treats the fingerprint as an opaque client-supplied string and has no server generation algorithm. The proration calculator was skipped because `internal/domain/subscription/billing.go` has internal arithmetic but no stable public preview contract or cross-language rounding fixture; server `change-plan`/`seats` results remain authoritative. Separate framework packages, CLI, OpenAPI codegen, gRPC, GraphQL, SSE, and multi-region work stayed out of scope. Changesets were not added because the hand-maintained changelog and private/manual release flow have no publish path to wire them into.

## Verification and limits

- The final full local gate passed: build, typecheck, 320 unit/contract tests, lint with zero warnings, fmt:check, docs, contract:check, package smoke (51 allowed tarball files and ESM/CommonJS/TypeScript consumers), coverage, bundle check, API report, and `npm audit --omit=dev` (zero vulnerabilities). Latest coverage: **92.39% statements, 86.77% branches, 97.45% functions, 93.87% lines**. Latest bundle: **9,687 gzip bytes full SDK; 678 bytes PlanService only**.
- The last wire/crypto full gate also passed `npm run test:integration` (**48 live assertions**) and `npm run test:runtimes` (**48 assertions** across Node 20/24, Bun, Deno, Chrome, and workerd). Chrome's signed usage report remains blocked by server CORS because `X-Usage-*` request headers are not allowed; the smoke reports this expected limit.
- `npm audit --audit-level=high` passed but reported **two moderate Vitest development advisories**, `GHSA-qxg6-89mg-rqv8` and `GHSA-xp26-3454-mjgp`. The available fix did not meet the 14-day pin rule when reviewed. Runtime audit reported zero vulnerabilities.
- `actionlint` v1.7.7 passed both workflows. `git ls-remote` matched action SHAs to tags: checkout v4.2.2 `11bd71901bbe5b1630ceea73d27597364c9af683`, setup-node v4.4.0 `49933ea5288caeca8642d1e84afbd3f7d6820020`, setup-bun v2.2.0 `0c5077e51419868618aeaa5fe8019c62421857d6`, setup-deno v2.0.5 `22d081ff2d3a40755e97629de92e3bcbfa7cf2ed`.
- GitHub Actions did not run here. macOS, Windows, and Node 22 legs remain unverified on their actual runners. The manual release workflow and Codecov upload were not run. No `npm publish` command was run. At the time of this first report no server files had changed; the continuation below includes server verification.

## Continuation — manual billing live proof (2026-10-28)

### Commits and behavior

- Commerce server `d5a0a39` — allow refunds for captured manual payments without a gateway payment ID, while rejecting pending manual payments and keeping the ID requirement for external providers. This fixes a live `400 refund_failed` response when refunding a fulfilled manual order. `TestMissingRefundPaymentReference` and `TestManualRefundRequiresCapture` cover the guard; the SDK live smoke proves the refund and invoice credit note end to end.
- SDK `0e3a93b` — exercise manual order create/get/list, reusable checkout instructions, fulfillment, payment refund, and invoice get/issue/PDF/void/list against the real server. Pace requests below the server's 120/minute API-key limit. The notification worker can fail a queued message before the next paced request, so its non-failed retry race is reported as SKIP when no conflict was observable; retry after failure remains checked.
- SDK `6bc6cc5` — document the manual billing path and offline refund obligation in README, namespace guidance, service TSDoc, and CHANGELOG; reconcile corrective checklist §F live workflow proof. The checklist stays partial because provider-backed checkout/refund and some route fixtures are unverified.
- The final handoff commit records these results.

Manual checkout returns offline instructions and no hosted URL. Fulfillment records collection and pays the invoice. A manual refund records the payment status and credit note, but Commerce does not transfer money; the operator must return funds separately. Pending manual payments now fail refund with 400. No migration or environment variable is required. Deploy the server fix before relying on manual refunds through the SDK.

### Verification and limits

- Rebuilt the Commerce Docker builder from `commerce-next`; `docker run --rm commerce-builder go test ./...` passed. Rebuilt and started the live app with a temporary Compose override pointing at the server worktree; the tracked Compose file and its original build context were never edited. `/health` passed.
- `npm run test:integration` passed **54 live assertions**, including pending manual refund rejection and partial refund plus credit note. One unrelated notification non-failed retry subcheck reported SKIP because the worker failed the queued message first.
- `npm run test:runtimes` passed **48 checks** across Node 20/24, Bun, Deno, Chrome, and workerd. Chrome signed usage reporting remains blocked by the documented `X-Usage-*` CORS limit.
- The SDK gate passed: build, typecheck, 320 tests, zero-warning lint, fmt:check, docs, contract:check, package consumer smoke, coverage (**92.39% statements; 86.77% branches**), bundle budget, API report, `npm audit --omit=dev` (**zero vulnerabilities**), and `git diff --check`. `npm pack --dry-run --json` contained **51 files**, all under `dist/` or the allowed LICENSE, README.md, and package.json paths.
- External provider checkout/refund was not exercised to avoid sending credentials to third parties. GitHub Actions, macOS/Windows runners, and Node 22 were not run. No npm publish, push, merge, or rebase was attempted.

## Phase 3 SDK continuation (2026-10-28)

### Commits and behavior

- SDK `b1ae479` — adds redacted debug logging, metadata-only middleware, protected per-call custom headers, configurable retry multiplier/jitter, bounded license batch issuance, cross-runtime machine fingerprint generation, proration preview, browser offline storage, tests, live/runtime checks, and the updated API report. The middleware can observe or replace a result but cannot alter a request or signed bytes. Invalid header bytes now yield a generic `CommerceValidationError` without echoing the value.
- SDK `fca8eb9` — adds private companion packages for an injected OpenTelemetry tracer/meter, a read-only CLI, and Node filesystem offline storage. The package smoke runs the CLI and file adapter on loopback and typechecks companion declarations with the packed SDK under NodeNext and bundler resolution. The core SDK retains zero runtime dependencies and web-only globals.
- SDK `97b0147` — documents the extensions in README, `doc/phase3.md`, wire/developer guides, CONTRIBUTING, and CHANGELOG, and reconciles Phase 3 checklist §3.1–§3.4 with proof.
- SDK `a06f948` — adds TSDoc examples to major billing/licensing methods and option types, closing the Phase 3 documentation item after TypeDoc and the API report passed.
- The final handoff commit records this report.

No Commerce server code or migration changed in this round. Server handlers do not read a general `Idempotency-Key` request header (the usage report key is in its signed body), so automatic header generation remains disabled and mutations remain single-attempt. The fingerprint helper hashes caller-selected stable inputs; Commerce treats the result as an opaque string. The proration helper previews current Go arithmetic, while the mutation response remains authoritative.

### Verification and remaining limits

- `npm run test:integration` passed **55 live assertions** against the loopback Commerce stack, including a local proration amount matching `changePlan` and two licenses issued through the bounded batch helper. The unrelated notification worker race reported one SKIP as described above.
- `npm run test:runtimes` passed **54 checks** across Node 20/24, Bun, Deno, Chrome, and workerd. Each runtime regenerated the fingerprint used for a real activation and server-signed offline certificate. Browser signed usage reporting remained blocked by the known `X-Usage-*` CORS rule.
- The final local gate passed: build, typecheck, **333 tests**, zero-warning lint, fmt:check, docs, contract:check, package consumer smoke, coverage (**91.97% statements, 85.8% branches, 96.97% functions, 93.85% lines**), bundle check (**11,145 gzip bytes full SDK; 678 PlanService-only**), API report, and `npm audit --omit=dev` (**zero vulnerabilities**). `npm pack --dry-run --json` contained **60 files**, all under `dist/` or the allowed LICENSE, README.md, and package.json paths. The API report uses CRLF; `git -c core.whitespace=cr-at-eol diff --check` passed for the updated report.
- `spec/todo.md` marks all implemented Phase 3 items complete with evidence, including TSDoc on the major public types, service classes, and key methods. The CLI remains partial as an `npx` command because all packages stay private and no publish was authorized; its local command and package smoke passed. The optional OTel adapter was tested with injected tracer/meter doubles, not a production exporter.
- GitHub Actions, external telemetry backends, macOS/Windows runners, Node 22, and a published `npx` installation were not run. No npm publish, push, merge, or rebase was attempted. No new deployment migration or environment variable is required.

## Phase 4 SDK continuation (2026-10-28)

### Commits and user-visible changes

- SDK `a7efbb6` — pins Changesets CLI 2.31.1, configures private-package version planning without tagging, adds version/status scripts, and records a minor release note for the Phase 3 public API additions. The installed version was published on 2026-07-15, more than 14 days before this work.
- SDK `e572255` — requires a changeset relative to the PR base commit in CI. The checkout fetches full history for that comparison. Documentation-only PRs can carry an empty changeset.
- SDK `ef466f9` — emits LCOV coverage and conditionally uploads it from the Node 24 Ubuntu job when `CODECOV_TOKEN` is configured. The Codecov action SHA `5975040f7f7d40edaff8d784b576fd65ae95c073` matched tag v5.5.5 via `git ls-remote`.
- SDK `7bdbe93` — documents the version/changelog process and Codecov gate, updates the changelog and Phase 4 checklist with evidence.
- The final handoff commit records this continuation.

There are no SDK runtime behavior or Commerce server changes in this continuation. The only new optional environment setting is the GitHub repository secret `CODECOV_TOKEN`; without it, coverage thresholds run and the upload step skips. No migration is needed. `private: true` remains in `package.json`; publishing remains out of scope.

### Verification and limits

- `npm run changeset:status` passed, planning a minor bump. `npm run changeset:status -- --since=main` passed after the changeset commit; before the committed note it failed for missing release notes as expected. A disposable detached worktree ran `npm run changeset:version` and generated a `0.2.0` `CHANGELOG.md` entry and package version. Changesets did not update `package-lock.json`, so the release guide requires `npm install --package-lock-only` and updating `SDK_VERSION` before the release gate.
- The full local gate passed: build, typecheck, zero-warning lint, format check, **333 tests**, docs, contract check, package smoke, coverage, bundle check, API report, and `npm audit --omit=dev` (**zero vulnerabilities**). Coverage was **91.97% statements, 85.8% branches, 96.97% functions, 93.85% lines**, and `coverage/lcov.info` was generated. The bundle measured **11,145 gzip bytes full SDK** and **678 bytes PlanService-only**. `npm pack --dry-run --json` contained **60 allowed files** under `dist/` or LICENSE, README.md, and package.json.
- `actionlint` v1.7.7 passed both workflows. `git ls-remote` matched checkout v4.2.2 and setup-node v4.4.0 to the existing pinned SHAs, and Codecov v5.5.5 to the new SHA. GitHub Actions, the Codecov upload, macOS/Windows runner legs, Node 22, the manual release workflow, and npm publishing were **not run**. No push, merge, or rebase was attempted.
- No live server or cross-runtime smoke was rerun because this continuation changed only release tooling, coverage output, CI, and documentation. The last live/runtime proof remains the Phase 3 result above.
