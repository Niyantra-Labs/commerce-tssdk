# Codex handoff — `codex/next`

SDK worktree: `/Users/tirumalrao/workspace/niyantra/commerce-tssdk-next`. The branch was not merged, rebased, pushed, or published. No Commerce server or Go SDK files changed; no server worktree was needed.

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
- GitHub Actions did not run here. macOS, Windows, and Node 22 legs remain unverified on their actual runners. The manual release workflow and Codecov upload were not run. No `npm publish` command was run. No Go build/test was needed because no server files changed.
