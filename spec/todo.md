# Niyantra Commerce TypeScript SDK - TODO

> **Implementation status (2026-10-25):** Phase 1 has started. The repository now has an ESM package, typed service surface, shared transport, signed usage reporter, webhook verifier, generated Go model baseline, documentation, and initial contract-focused tests. The SDK is **not production ready or published**. The Go SDK is the public API parity target; Commerce server handlers are the wire contract. The corrective checklist below supersedes conflicting bullets. Compared revisions: Go SDK `fe24005`, Commerce `715ff7c`.

**Phase 1 work still required:** Reconcile every generated model and endpoint result with server JSON, add full route fixture and real-server tests, verify browser/edge runtime behavior and CORS, finish package/API documentation, and resolve offline certificate signing with the server. Do not mark an endpoint complete from mocked responses alone.

Parallel to [`commerce-gosdk`](https://github.com/Niyantra-Labs/commerce-gosdk)
and [`commerce-rustsdk`](https://github.com/Niyantra-Labs/commerce-rustsdk).
The surface area mirrors the Go SDK one-to-one; package/idiom choices are
TypeScript-native. Track the Go SDK's TODO when adding new endpoints so all
SDKs stay in sync.

## Phase 1: Core SDK

### 1.1 Project Setup
- [x] Initialize npm package — scoped name `@niyantra/commerce`
- [ ] `package.json`: author, license = "MIT", description, repository, homepage, keywords, bugs
- [ ] Set up `src/` module layout — one file per domain (`customer.ts`, `license.ts`, …) + a `services/` folder for HTTP surfaces
- [ ] Choose ESM-only or dual ESM/CJS from tested consumer needs; for dual output, emit format-correct declarations and verify both import and require
- [x] `tsconfig.json` — ES2022, NodeNext module resolution, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, declarations
- [x] `tsconfig.build.json` extending the root with `rootDir: src`, `outDir: dist`, tests excluded
- [x] `exports` map in `package.json` matching ESM output and declarations for the root export
- [ ] Set Node engine minimum only after runtime smoke tests; `crypto.subtle` has no `timingSafeEqual` method
- [ ] Browser / edge runtime support (Cloudflare Workers, Vercel Edge, Deno) — zero Node-only built-ins in the hot path
- [x] Runtime dependencies kept minimal: platform `fetch` and `crypto.subtle`; no runtime dependencies
- [ ] Dev dependencies: `typescript`, `tsup`, `vitest`, `@vitest/coverage-v8`, `msw` (mock service worker for integration tests), `@types/node`, `eslint`, `@typescript-eslint/*`, `prettier`, `typedoc`
- [x] npm scripts: `fmt`, `lint`, `typecheck`, `test`, `build`, `docs`, `audit`
- [x] `LICENSE` (MIT, same text as Go SDK)
- [x] `.gitignore` (node_modules/, dist/, coverage/, *.tsbuildinfo, .env*)
- [x] `.prettierrc.json` — single quotes, trailing commas, 100-char width
- [ ] `eslint.config.js` (flat config) — `@typescript-eslint/strict-type-checked` + `eslint-plugin-import` + `eslint-plugin-unicorn`
- [x] `.editorconfig`
- [x] `.nvmrc` pinning Node 20

### 1.2 Type System & Models
- [ ] Shared: `ListParams`, `ListResponse<T>`, `ApiError`, `DataResponse<T>`, `Metadata`, `Address`
- [ ] `ListParams` type with `limit`, `offset`, `search`, `status` and a `buildQuery(params)` helper; add only endpoint-specific query fields accepted by the server (there is no general `sort` contract)
- [ ] Error hierarchy — `CommerceError` base class with subclasses: `CommerceApiError`, `CommerceHttpError`, `CommerceRateLimitError`, `CommerceValidationError`, `CommerceCryptoError`, `CommerceTimeoutError`. Each carries `code`, `status`, `requestId`, `cause`.
- [x] Discriminated union `Result<T>` and `asResult` helper for consumers that prefer non-throwing APIs
- [ ] `Organization` interface + `CreateOrganizationParams` / `UpdateOrganizationParams` / `ListOrganizationsParams`
- [ ] `Product` interface + create/update/list params
- [ ] `Plan` interface + create/update/list/compare params
- [ ] `Customer` interface + create/update/list params
- [ ] `Contact` interface + create params
- [ ] `License` interface + create/bulk-create/validate/revoke/suspend params
- [ ] `LicenseValidationResponse` + `ResolvedFeature`
- [ ] `Activation` interface + activate/deactivate params
- [ ] `Machine` interface + create/update/list params
- [ ] `Subscription` interface + create/update/renew/pause/resume/cancel/change-plan/seats params
- [ ] `SubscriptionMutationResult` + `ProrationPreview`
- [ ] `Entitlement` interface + create/update/list/override params
- [ ] `Addon` interface + create/update/list params
- [ ] `LicenseAddon` + purchase params
- [ ] `UsageMeter` interface + create/update/list params
- [ ] `UsageReport`, `UsageReportBatch`, `UsageSummary`
- [ ] `UsageAdjustment` + `UsageCredit` interfaces
- [ ] `Order` interface + `LineItem` + create/update/list params
- [ ] `Payment` interface + refund/reconcile params
- [ ] `Invoice` interface + list params
- [ ] `WebhookEndpoint` + `WebhookEvent` interfaces + create/update/list params
- [ ] `WebhookEventEnvelope` + event-type string-literal union (`'license.issued' | 'license.revoked' | ...`) wired to a typed event-payload map (`WebhookEventPayloadMap`)
- [ ] `Application` + `ApiKey` interfaces + create/list/revoke params
- [ ] `OfflineCertificate` interface + create/verify/list/revoke params
- [ ] `ReferralProgram`, `ReferralCode`, `ReferralEvent` interfaces + params
- [ ] `CommissionPlan`, `Affiliate`, `AffiliateLink`, `AffiliateEvent` interfaces + params
- [ ] `CommissionPayout` interface + create/list params
- [ ] `AuditLog` interface + list params
- [ ] `SigningKeyResponse` and the actual `/health` response shape
- [ ] Optional fields use `field?: T` (omitted ⇒ serialiser drops them, matching Go's `omitempty`)
- [ ] Dates kept as ISO-8601 `string` at the public JSON boundary, including nullable timestamp fields; Go actually uses `time.Time` for many model fields. Document any accepted `Date` inputs and normalization.
- [ ] Define a safe-integer policy for all Go `int64` money/usage/count fields; validate outbound values and handle or reject unsafe inbound integers without silent precision loss
- [ ] `readonly` on response-side fields so consumers can't accidentally mutate server state
- [ ] Re-export every model from `src/models/index.ts` and surface at package root

### 1.3 HTTP Client
- [ ] `Client` class holding base URL, auth config, org id, rate limiter, retry policy, `fetch` implementation
- [ ] Constructor signature: `new Client(options: ClientOptions)` with a discriminated API-key/bearer auth option, base URL, injectable fetch, optional timeout/rate/retry settings, and only verified org/header options
- [ ] Service namespaces exposed as readonly getters (e.g. `client.customers`, `client.licenses`) that lazily construct thin wrapper objects sharing the client instance
- [ ] API key auth — `X-API-Key` header
- [ ] JWT bearer auth — `Authorization: Bearer <token>` header; require an explicit auth mode and reject ambiguous simultaneous API key and bearer credentials
- [ ] Org scoping — verify the server's actual `X-Org-ID` authorization behavior before exposing it as a scoping feature; this is also a trusted-proxy identity header
- [ ] Per-request org override via an options bag on every service method (`{ orgId?: string; signal?: AbortSignal; idempotencyKey?: string }`)
- [ ] Cancellation through native `AbortSignal` — each request honors `options.signal` and composes with an internal timeout controller
- [ ] Client-side rate limiting via a hand-rolled token-bucket (no external deps) that exposes `acquire(): Promise<void>`
- [ ] Automatic bounded retry for safe requests on 429 and transient failures, with backoff/jitter; retry mutations only after confirming server-side idempotency and preserving key/body bytes
- [ ] Respect `Retry-After` header (seconds or HTTP-date)
- [ ] JSON request body via `JSON.stringify` with omitted `undefined`; preserve explicit `null` where PATCH clearing is supported, and preserve `false`, `0`, and empty arrays
- [ ] JSON response decoding with graceful fallback to `CommerceHttpError` on non-JSON bodies
- [ ] Error response parsing — decode `{ error: { code, message, details } }` into `CommerceApiError` with the original envelope attached as `apiError.raw`
- [ ] Query param helpers (`buildQuery(base, extras)`) returning a `URLSearchParams` instance
- [ ] `fetch` injection so consumers can plug in `undici`, a test double, or a wrapped fetch with credential-redacted logging
- [ ] Default SDK identification only in runtimes where the header is permitted; browsers cannot set `User-Agent`
- [ ] Debug hook — optional `onRequest` / `onResponse` callbacks for logging / tracing integration
- [ ] `unprefixed` path support for `/health` (same carveout as rustsdk)

### 1.4 Service Implementations
Each service is a class (or object literal with methods) that shares a reference to the `Client` instance. All list methods return `Promise<ListResponse<T>>`. Single-item fetches return `Promise<T>` with 404 → `CommerceApiError`.

- [ ] `OrganizationService`: list, create, get, update, delete
- [ ] `ProductService`: list, create, get, update, delete
- [ ] `PlanService`: list, create, get, update, delete, compare
- [ ] `CustomerService`: list, create, get, update, delete
- [ ] `ContactService`: listContacts, addContact, deleteContact
- [ ] `LicenseService`: list, create, bulkCreate, get, revoke, suspend, reactivate, reissue, features, validate, listAddons, purchaseAddon, getUsage, upsertEntitlementOverride
- [ ] `ActivationService`: activate, deactivateByKey, list, get, deactivate
- [ ] `MachineService`: list, create, get, update, delete, decommission
- [ ] `SubscriptionService`: list, create, get, update, renew, pause, resume, cancel, changePlan, updateSeats
- [ ] `EntitlementService`: list, create, get, update, delete
- [ ] `AddonService`: list, create, get, update, delete
- [ ] `UsageMeterService`: list, create, get, update, delete
- [ ] `UsageService`: createAdjustment, grantCredits
- [ ] `OrderService`: list, create, get; reconcile Go `update`/`pay` with current server `checkout`/`fulfill` routes before naming methods
- [ ] `PaymentService`: list, refund, reconcile
- [ ] `InvoiceService`: list, get; reconcile Go `send` with current server `issue`, `void`, `pdf`
- [ ] `WebhookEndpointService`: list, create, get, update, test; Go `delete` has no matching server route
- [ ] `WebhookEventService`: list, get, retry
- [ ] `ApplicationService`: list, create, get, update, delete
- [ ] `ApiKeyService`: list, create, get, rotate, revoke, delete
- [ ] `OfflineCertificateService`: issue, verify, list, get, approve, revoke, reissue
- [ ] `ReferralProgramService`: list, create, get, update, delete
- [ ] `ReferralCodeService`: list, create, get, disable
- [ ] `ReferralEventService`: list, create, get, qualify, reward, reject
- [ ] `CommissionPlanService`: list, create, get, update, delete
- [ ] `AffiliateService`: list, create, get, update, delete, approve, reject, suspend, terminate
- [ ] `AffiliateLinkService`: list, create, get, update, disable
- [ ] `AffiliateEventService`: list, create, get, review
- [ ] `CommissionPayoutService`: list, create, get, approve, pay, fail, reverse
- [ ] `AuditLogService`: list
- [ ] `SystemService`: signingKey, health (health bypasses `/api/v1` prefix)

### 1.5 Specialized Features
- [ ] `UsageReporter`: HMAC-SHA256 signed usage ingestion using the **current server canonical format** documented in the corrective checklist; the Go implementation is incompatible
- [ ] `WebhookVerifier`: HMAC-SHA256 verification of the **current server delivery headers and canonical format**, using a constant-time comparison after strict hex decoding
- [ ] Framework-agnostic input — accept `{ headers: Record<string, string>; body: string | Uint8Array }` so the same verifier works in Express, Fastify, Hono, Next.js route handlers, Cloudflare Workers, etc.
- [ ] `OfflineVerifier`: gate local verification on reconciling the issued server payload and signature; server public key is standard-base64 **raw Ed25519 bytes**, not SPKI
- [ ] Certificate format: verify against the server's actual issued format; current Go two-part format does not match the server's single base64 payload plus separate signature
- [ ] Async iterator pagination — `for await (const item of client.licenses.listAll(params)) { ... }` returning an `AsyncIterableIterator<T>` that fetches pages on demand
- [ ] `collectAll(iterable, { cap })` helper that drains an async iterator into `T[]` with an optional hard cap

### 1.6 Documentation
- [ ] `README.md` with badge row, install snippet, quick-start, full endpoint table
- [ ] `doc/developer-guide.md` with architecture notes, retry semantics, auth flows, runtime compatibility matrix (Node / Bun / Deno / browser / Workers / Vercel Edge)
- [ ] TSDoc `/** */` on every exported class, interface, and method with at least one usage example per major surface
- [x] `typedoc` configuration + generated HTML docs under `.typedoc/` (opt-in via `npm run docs`, excluded from the npm tarball)
- [ ] `examples/quickstart.ts` — license management
- [ ] `examples/usage-reporting.ts` — HMAC-signed batches
- [ ] `examples/webhook-handler-express.ts` — Express middleware with signature verification
- [ ] `examples/webhook-handler-hono.ts` — edge-runtime Hono handler
- [ ] `examples/offline-verification.ts` — Ed25519
- [ ] `examples/pagination.ts` — async iterator consumption
- [ ] `examples/subscription-lifecycle.ts`

---

## Phase 2: Testing

### 2.1 Unit Tests (vitest)
- [x] Initial transport and crypto regression suite: auth selection, HTTPS requirement, query omission, Retry-After, no mutation retry, shared token bucket, abort/timeout (including bearer callback), malformed responses, pagination consistency/cap, webhook timestamp/signature/JSON boundaries.
- [ ] Client construction and option validation tests
- [ ] Request building tests — assert final URL, headers, body via a fetch mock
- [ ] Error decoding tests (malformed JSON, missing fields, non-JSON bodies, HTML error pages)
- [ ] Retry logic tests — fake fetch returning 429, 500, then 200; assert attempt count and backoff timing via `vi.useFakeTimers()`
- [ ] Rate limiter tests — verify spacing, burst allowance, fairness under `vi.useFakeTimers()`
- [ ] Query parameter building tests (undefined pruning, array serialisation, nested values)
- [ ] AbortSignal propagation tests — verify cancelling aborts the underlying fetch and rejects with `CommerceTimeoutError` / `AbortError`

### 2.2 Service Tests (with MSW)
- [ ] Organization CRUD
- [ ] Product CRUD
- [ ] Plan CRUD + Compare
- [ ] Customer CRUD + Contact
- [ ] License CRUD + Validate + BulkCreate
- [ ] Activation Activate/Deactivate
- [ ] Machine CRUD + Decommission
- [ ] Subscription lifecycle (create, renew, pause, resume, cancel, change-plan, seats)
- [ ] Entitlement CRUD + Override
- [ ] Addon CRUD + Purchase
- [ ] UsageMeter CRUD
- [ ] Usage Adjustment + Credit
- [ ] Order CRUD + Pay
- [ ] Payment List + Refund + Reconcile
- [ ] Invoice List + Get + Send
- [ ] Webhook Endpoint CRUD
- [ ] Webhook Event List + Get + Retry
- [ ] Application + ApiKey CRUD
- [ ] OfflineCertificate lifecycle
- [ ] Referral Program/Code/Event
- [ ] Affiliate/Link/Event/Payout
- [ ] AuditLog List
- [ ] System SigningKey + Health

### 2.3 Specialized Feature Tests
- [ ] `UsageReporter` HMAC signature generation tests with golden vectors shared across gosdk/rustsdk/tssdk
- [ ] `UsageReporter` retry behaviour tests
- [ ] `WebhookVerifier` signature verification tests (known-good + known-bad vectors)
- [ ] `WebhookVerifier` timestamp tolerance tests (within / outside skew window)
- [ ] `WebhookVerifier` edge cases (missing headers, expired, tampered body, length-mismatched signatures, case-insensitive header lookup)
- [ ] `OfflineVerifier` Ed25519 verification tests with keypair fixtures
- [ ] `OfflineVerifier` expiry + grace-period tests
- [ ] `OfflineVerifier` machine fingerprint matching tests
- [ ] Async iterator pagination tests (empty, single page, multi-page, error on later page)
- [ ] `collectAll` cap tests

### 2.4 Integration Tests
- [x] Docker Compose live smoke: isolated Commerce/Postgres/Redis on loopback port 19094; organization, product, customer, application, API key, authenticated list, license validation, signed usage ingestion, contacts, and pagination. Run with `npm run test:integration`.
- [ ] Fixture helpers — spin up an MSW handler set and return a pre-configured `Client`
- [x] End-to-end license lifecycle (create → validate → activate → deactivate) against the Compose server
- [ ] End-to-end subscription lifecycle
- [x] End-to-end usage reporting (signing → ingestion) against the Compose server
- [ ] End-to-end webhook delivery

### 2.5 Runtime Compatibility Tests
- [ ] Node matrix based on the published supported engine range, including its oldest and latest supported versions
- [ ] Bun smoke test (`bun test` on a minimal suite)
- [ ] Deno smoke test (`deno test` via `npm:` specifier import)
- [ ] Cloudflare Workers integration test via `wrangler dev` or `@cloudflare/vitest-pool-workers`
- [ ] Browser smoke test in a real browser for fetch, Web Crypto, CORS, and webhook verification; gate offline verification on the server certificate contract

---

## Phase 3: Enhancements

### 3.1 Observability
- [ ] Pluggable logger interface (`{ debug, info, warn, error }`) — defaults to no-op
- [ ] Request/response debug events gated behind a `debug: true` option
- [ ] Request timing metrics exposed via `onResponse` callback (`durationMs`, `attempt`, `retries`)
- [ ] Retry attempt events
- [ ] OpenTelemetry integration via a thin adapter in a separate `@niyantra/commerce-otel` package so the core stays dependency-free

### 3.2 Advanced Client Features
- [ ] Middleware chain — `client.use((req, next) => next(req))` for request/response interception
- [ ] Custom header injection per-request via the method options bag
- [ ] Proxy support through fetch injection (`undici.Agent` / `https-proxy-agent` examples in docs, not a hard dep)
- [ ] Configurable keep-alive via the injectable `fetch`
- [ ] Configurable `maxRetries`, `backoffMultiplier`, and jitter strategy
- [ ] Idempotency-Key auto-generation only if the server is verified to honor that header for the specific operation; otherwise do not present it as retry safety
- [ ] Request ID propagation (`X-Request-ID` in + out, exposed on errors as `error.requestId`)

### 3.3 Developer Experience
- [ ] TSDoc examples for all major types and methods
- [ ] Typed webhook event handling — `onWebhookEvent('license.issued', event => event.data)` with narrowed event data via mapped types
- [ ] `defineWebhookHandler({ secret, handlers })` factory returning a framework-agnostic request handler
- [ ] Batch operation helpers (parallel license creation via `Promise.allSettled` with a concurrency limit)
- [ ] CLI tool (`npx @niyantra/commerce-cli`) for SDK exploration / quick REPL-style calls
- [ ] `CONTRIBUTING.md` with setup, build, and PR guidelines
- [ ] Type-level tests using `expect-type` or `tsd` to lock in the public API shape

### 3.4 Additional Helpers
- [ ] Machine fingerprint generation utility (cross-runtime — hashes stable machine inputs, documents what differs per platform)
- [ ] License key format validator
- [ ] Offline certificate caching helper (pluggable storage: in-memory, `localStorage`, `fs`)
- [ ] Webhook event router (type-safe dispatch table)
- [ ] Subscription proration calculator (client-side preview mirroring server math)

---

## Phase 4: CI/CD & Release

### 4.1 CI Pipeline
- [ ] GitHub Actions workflow: install, typecheck, lint, test, build on the published supported Node versions
- [ ] Bun + Deno jobs for runtime compatibility
- [ ] Test coverage reporting via `@vitest/coverage-v8` → codecov
- [ ] `npm audit --production` on every PR
- [ ] `socket.dev` or `snyk` dependency vulnerability scanning
- [ ] Cross-platform matrix: ubuntu, macos, windows

### 4.2 Release Management
- [ ] Semantic versioning with `changesets` (`.changeset/` directory + CI check)
- [ ] `CHANGELOG.md` auto-generated from changesets
- [ ] `npm publish` automation on tagged releases (with `NPM_TOKEN` secret)
- [ ] Provenance publishing (`npm publish --provenance`) for supply-chain trust
- [ ] Publish `@niyantra/commerce` to npm, verify the published tarball contains only `dist/`, `README.md`, `LICENSE`, `package.json`
- [ ] Verify `types` / `exports` resolution via `@arethetypeswrong/cli`

### 4.3 Quality Gates
- [ ] Minimum 80% test coverage
- [ ] Zero ESLint warnings with `--max-warnings 0`
- [ ] `tsc --noEmit` clean on the root tsconfig
- [ ] `publint` clean to catch common packaging mistakes
- [ ] `@arethetypeswrong/cli` clean (ESM + CJS + types dual-module resolution)
- [ ] Bundle-size budget tracked via `size-limit` (initial: < 25 KB gzipped for `@niyantra/commerce`)
- [ ] API extractor / API report diffing between releases (breaking change detection)
- [ ] Security audit of crypto operations (review HMAC, Ed25519, constant-time compare paths)

---

## Phase 5: Advanced Features

### 5.1 Code Generation
- [ ] OpenAPI spec-driven codegen via `openapi-typescript` or a custom pipeline
- [ ] Auto-generate models from the Commerce server's OpenAPI schema
- [ ] Sync SDK types with server schema changes on a scheduled CI job
- [ ] Generated MSW mocks for consumer testing

### 5.2 Performance
- [ ] Tree-shaking verification — importing a single service should not pull every other service into the bundle
- [ ] Concurrent request throughput benchmarks
- [ ] Bundle size profiling for the specialized feature surface
- [ ] Large batch operation optimisation
- [ ] Response streaming for large lists via `ReadableStream`

### 5.3 Ecosystem
- [ ] React hooks package (`@niyantra/commerce-react`) with `useLicense`, `useSubscription`, `useUsage` wrappers over TanStack Query
- [ ] Next.js App Router helpers — server actions + route handler factories
- [ ] Hono middleware package
- [ ] Express middleware package (webhook handler + auth)
- [ ] Cloudflare Workers template repo
- [ ] gRPC client support via `@connectrpc/connect` (when Commerce adds gRPC / Connect)
- [ ] GraphQL client support (when Commerce adds GraphQL)
- [ ] SSE / event streaming client for real-time updates
- [ ] Multi-region client with failover
- [ ] Admin SDK variant (higher-level abstractions layered over the core client)

---

## TypeScript-specific notes

**Parity policy**: every public Go SDK method and helper needs an equivalent or an explicit documented server blocker here. Track new Commerce server routes independently; the Go SDK TODO is not a wire-contract source.

**Idiom translations (Go → TypeScript)**:
- Go's `*T` optional request fields → TS `field?: T`; the serialiser strips
  `undefined` keys so they never hit the wire (equivalent to `omitempty`).
- Go's pointer helpers (`String(s)`, `Int(i)`) → unnecessary in TS; pass
  values directly.
- Go's `context.Context` → native `AbortSignal` passed via the per-call
  options bag; internal timeouts compose signals with `AbortSignal.any`
  (Node 20.3+) or a manual composer for older runtimes.
- Go's `ListResponse[T]` generic → TS `ListResponse<T>` with the same shape.
- Go's iterator struct → `AsyncIterableIterator<T>` consumed via `for await`.
- Go's `errors.Is` / `errors.As` → TS `instanceof CommerceApiError` plus a
  narrowed `error.code` literal type.
- Go's `time.Time` → ISO-8601 `string` at the TypeScript JSON boundary, with an opt-in `toDate` helper. Model absent and explicit `null` separately.
- Go's `json.RawMessage` metadata → `Record<string, unknown>`.
- Go's `sync.Mutex` for org-id swap → plain assignment on the `Client`
  instance (JS is single-threaded per event loop — no lock needed).
- Go's `httptest` → `msw` (mock service worker) for integration, and
  fetch-injection for unit tests.

**Error design**: a hierarchy of classes extending a single `CommerceError`
base so consumers can `instanceof`-check the broad family or narrow to a
specific subclass. All errors carry `code`, `status`, `requestId`, and a
`cause` chain (Error `cause` option introduced in ES2022).

**Runtime targets**: Establish a tested support matrix for Node, Bun, Deno, modern browsers, and edge workers before publishing exact minimum versions.
The core client uses only platform `fetch`, `crypto.subtle`, and
`AbortController` — no Node-only built-ins in the hot path. Node-specific
escape hatches (e.g. `node:crypto.timingSafeEqual`) are loaded via dynamic
`import()` only when the runtime exposes them.

**Module format**: choose ESM-only or dual ESM/CJS based on tested consumer needs. For dual output, publish format-correct declarations for both sides of the `exports` map and verify with `publint` and `@arethetypeswrong/cli`.

**MSRV-equivalent**: TypeScript 5.4+ for `NoInfer`, `const` type params, and
stable `exactOptionalPropertyTypes` ergonomics. Review every six months.

---

## Corrective release checklist (supersedes conflicting items above)

**Priority:** P0 blocks a secure first release; P1 completes Go parity and current server API coverage; P2 is optional. A checkbox requires the method, types, documentation, and a meaningful contract test. The Go SDK method names are parity targets, but the server's registered routes and handlers define what can actually work.

### A. Reconcile wire contracts before implementation — P0

- [ ] Inventory each server route in `commerce/internal/domain/*/handler.go` and `commerce/internal/server/server.go`: method, path, auth/scope, query and body, success status/envelope, error envelope, pagination, and Go counterpart. Include routes registered with both `mux.Handle` and `mux.HandleFunc`.
- [ ] **Usage signing blocker:** `commerce-gosdk/usage_reporter.go` signs `apiKey|unixSeconds|POST|path|rawBody` with a separate secret. Server `internal/domain/usage/hmac.go` expects `X-Usage-Timestamp` as RFC3339 and `HMAC-SHA256` keyed by the `X-API-Key` value over `timestamp + "\n" + uppercaseMethod + "\n" + path + "\n" + hex(SHA256(rawBody))`. Use the server protocol, create cross-language golden vectors, and record the Go incompatibility for upstream correction. The server requires API-key auth and `usage:report` scope; report batch size is 1–100 and body read limit is 2 MiB.
- [ ] **Webhook verification blocker:** Go expects `X-Webhook-Timestamp`/`X-Webhook-Signature` and signs `timestamp.rawBody`. Server delivery sets `X-Niyantra-Timestamp`, `X-Niyantra-Signature`, `X-Niyantra-Signature-Version: v1`; it signs `unixSeconds + "." + hex(SHA256(rawBody))`. Implement the current server format and vectors. Any older format must be explicit opt-in, not silent fallback.
- [ ] **Offline verification blocker:** Go assumes `base64(payload).base64(signature)` with `grace_end_at`. Server stores a single standard-base64 JSON payload with `grace_expires_at` and returns a separate signature on issue. Confirm exactly what bytes that signature covers and whether it verifies the stored payload. Do not expose an allegedly trusted offline verifier until server-issued certificates pass a local signature test. Record a server change if needed. `/offline-certificates/verify` is a separate online operation that can consult database revocation state.
- [ ] Reconcile absent routes: Go `orders.update` (`PATCH /orders/{id}`), `orders.pay` (`POST /orders/{id}/pay`), `invoices.send` (`POST /invoices/{id}/send`), and `webhookEndpoints.delete` have no matching current server route. Decide on upstream server changes or accurately named SDK alternatives; never ship calls that predictably return 404/405.
- [ ] Reconcile response drift: server `GET /api/v1/signing-key` returns `{algorithm, public_key}` directly, while Go expects `{data:...}`; license revoke/suspend/reactivate/reissue return status objects, while Go expects `License`; offline issue returns `{data:{certificate,signature}}`, while Go expects `OfflineCertificate`; online offline verification needs `certificate` and `fingerprint` and returns `payload`/`in_grace_period`, unlike Go types. Audit every mutation, bulk create, API-key create/rotate, webhook endpoint create, subscription detail/mutation, plan compare, and usage ingestion result similarly.
- [ ] Verify what `X-Org-ID` means for API-key/JWT auth. It is also a trusted-proxy identity header; do not imply an API caller can select arbitrary tenant scope. Confirm CORS and permission behavior with server tests.

### B. Public API, models, and packaging — P0

- [ ] Separate server response, create input, PATCH input, list filter, detail response, action result, and one-time secret types. Never type every mutation as returning the resource. Include status-only responses, `{data,total}`, `{data,count}`, direct JSON, binary responses, and partial ingestion results.
- [ ] Map all Go model fields against server JSON tags, marking required, optional, and nullable precisely. Use `unknown` rather than `any` for unverified metadata/event payloads. Add extensible string unions for server enums and type-level tests for representative calls.
- [ ] Preserve `undefined` as omitted and `null` as explicit clear only where PATCH permits it. Preserve `false`, `0`, empty arrays, and valid empty strings. Reject `NaN`, infinities, cyclic data, invalid dates, and unsupported `BigInt` before network I/O.
- [ ] Use ISO-8601 string dates at the JSON boundary and document `Date` input conversion. For Go `int64` cents, usage totals, and counters, validate outbound safe integers and choose a lossless inbound policy (parser/string mode or an explicit error) so large JSON integers are not silently rounded.
- [ ] Distinguish API-key create/rotate and webhook endpoint create results, which contain secrets shown once, from ordinary list/get models. Avoid secrets in inspect/debug output, errors, and docs. `readonly` response types do not imply runtime immutability.
- [ ] Choose the module layout and supported runtime versions from smoke tests. If publishing dual ESM/CJS, emit correct separate declarations and verify both module modes; if not needed, prefer ESM. Check `exports`, `types`, tree shaking, source maps, `sideEffects`, and `npm pack` with `publint` and Are the Types Wrong.
- [ ] Keep browser/edge entry points free of Node built-ins. Use injectable `fetch`, Web Crypto, and only tested optional Node adapters. Browser code cannot set `User-Agent`; a runtime header policy must respect forbidden headers. Keep privileged API keys and gateway credentials out of browser bundles and examples.
- [ ] Validate base URL: preserve an intended base path, reject credentials/query/fragment and unsupported schemes, require HTTPS except explicit local HTTP, and avoid accidental double `/api/v1`. Encode every dynamic path segment; IDs must not inject `/`, `?`, or fragments.
- [ ] Define explicit API-key versus bearer authentication. Reject missing or conflicting credentials except for confirmed unauthenticated endpoints. If supporting expiring bearer credentials, provide a per-request token supplier. Never send credentials in URL/query parameters.
- [ ] Make per-call `signal`, request ID, and verified org context consistent. Prevent custom header overrides of auth, host, content type, and signatures. Prefer immutable per-call scoping; if retaining `setOrgId`, specify snapshot behavior for concurrent requests.

### C. Transport, errors, retries, and pagination — P0

- [ ] Use one request pipeline for JSON, status/no-body, raw/binary, and signed requests. Handle 200/201/202/204, empty success, malformed or missing `data`, unexpected content type, non-JSON error pages, redirects, truncation, and size-limited error bodies. Never return `undefined` as a typed resource after a malformed 200 response.
- [ ] Define typed errors for API/HTTP (status, code, message, details if present, request ID, sanitized response), network, caller abort, timeout, decode/protocol, and crypto; retain `cause`. Preserve the final 429/5xx response when retries are exhausted. Do not log raw sensitive responses.
- [ ] Encode only query parameters each handler supports. Retain `0`/`false`, reject invalid pagination, preserve domain filters, and follow server array encoding (for example plan comparison). No global `sort` unless the endpoint implements it.
- [ ] Retry 429/502/503/504 and transient network failures by default only for safe methods, with bounded exponential backoff/full jitter, `Retry-After` seconds or HTTP-date, total deadline, and cancellation during limiter wait/backoff/fetch. Make other 5xx retry opt-in. Do not blindly retry POST/PATCH/DELETE actions such as issuance, subscription renewal, payment/refund, or usage reporting. Retry a mutation only after verifying server idempotency and reusing exact key/body/timestamp. Do not auto-generate `Idempotency-Key` until the server honors it for that route.
- [ ] If implementing a local rate limiter, make it optional, bounded, fair, and cancellable; define per-client versus server behavior and avoid duplicate waits across attempts. Inject clock/sleep for deterministic tests.
- [ ] Capture/request `X-Request-ID` where supported; expose it on errors. Current CORS does not expose this response header. Redact API keys, bearer tokens, signatures, webhook secrets, license keys, customer PII, and signed bodies from debug hooks, traces, and error messages. Hooks must not alter signed bytes after signing.
- [ ] Implement lazy sequential async pagination using the actual offset/limit/total contract, retaining caller filters and cancellation. Stop on empty/repeated pages and guard against changing totals/infinite loops. Surface errors on later pages. Define early-break behavior and provide capped `collectAll` with explicit unbounded opt-in.

### D. Complete Go parity — P1

For **every** listed method: verify exact verb/path, filter map, request and return shape, error/status behavior, auth, path encoding, per-call options, and contract test.

- [ ] Organizations, products: list/create/get/update/delete. Plans: list/create/get/update/delete/compare.
- [ ] Customers: list/create/get/update/delete. Contacts: listContacts/addContact/deleteContact, preserving customer ID scoping.
- [ ] Licenses: list/create/bulkCreate/get/revoke/suspend/reactivate/reissue/features/validate/listAddons/purchaseAddon/getUsage/upsertEntitlementOverride. Enforce server bulk limit and represent `{valid:false}` as a domain validation result where returned with HTTP 200.
- [ ] Activations: activate/deactivateByKey/list/get/deactivate. Machines: list/create/get/update/delete/decommission; document decommission side effects.
- [ ] Subscriptions: list/create/get detail/update/renew/pause/resume/cancel/changePlan/updateSeats; type proration and mutation results accurately.
- [ ] Entitlements and addons: list/create/get/update/delete. Usage meters: list/create/get/update/delete. Usage: createAdjustment/grantCredits and signed report/reportSingle with per-report ingestion result.
- [ ] Orders: list/create/get plus server checkout/fulfill in place of unresolved Go update/pay. Payments: list/refund/reconcile. Invoices: list/get plus server issue/void/pdf in place of unresolved Go send.
- [ ] Webhook endpoints: list/create/get/update plus server test, with Go delete unresolved. Webhook events: list/get/retry.
- [ ] Applications: list/create/get/update/delete. API keys: list/create/get/rotate/revoke/delete with one-time secret handling.
- [ ] Offline certificates: issue/onlineVerify/list/get/approve/revoke/reissue with corrected request/result shapes; local verification is gated above.
- [ ] Referral programs: list/create/get/update/delete; codes: list/create/get/disable; events: list/create/get/qualify/reward/reject.
- [ ] Commission plans: list/create/get/update/delete; affiliates: list/create/get/update/delete/approve/reject/suspend/terminate; links: list/create/get/update/disable; events: list/create/get/review; payouts: list/create/get/approve/pay/fail/reverse.
- [ ] Audit logs: list. System: unwrapped signing key and unprefixed unauthenticated `/health`.

### E. Current server routes absent from Go SDK — P1 coverage extension

- [ ] Maintain a one-row-per-registered-route coverage table with disposition: typed method, specialized helper, intentional internal/provider callback, or server blocker. Include server-only payment `get`, audit `get`/CSV `export`, webhook endpoint `test`, order `checkout`/`fulfill`, and invoice `issue`/`void`/binary `pdf`.
- [ ] Releases: list/create/get/update/delete, publish/yank, artifact list/upload, checksum, download authorization, token download. Support multipart upload, streaming/binary download, checksum validation, content disposition, redirects, and aborts without buffering a large artifact.
- [ ] Gateway configurations/providers: list/create/get/update/delete, setDefault/test, provider list/schema. Treat gateway credentials as backend-only sensitive data.
- [ ] Payment methods and checkout options: list/create/get/delete/setDefault and checkout-options retrieval; model token/reference fields without collecting raw card data in the SDK.
- [ ] Notifications/templates: list/create/get/update where actually routed, retry. Application notifications: list/create/get/update/feed/ack; confirm registration, auth, and payloads before exporting methods.
- [ ] Add a route-drift check from a generated route manifest or OpenAPI source once the server provides one. Keep this server extension separate from claims of Go parity.

### F. Security, crypto, compatibility, and release proof — P0

- [ ] Usage reporter: serialize once, hash/sign/send identical UTF-8 bytes, use RFC3339 timestamp and hex digests, validate 1–100 reports, required per-report idempotency keys, period ordering, safe integer quantities, and 2 MiB limit. Preserve signed bytes on any permitted retry.
- [ ] Webhook verifier: accept case-insensitive `Headers` or record plus **raw** body bytes, require `v1`, strictly parse Unix-second timestamp and hex signature, enforce configurable past/future skew, compare fixed-length signature bytes in constant time, then parse typed envelope. Support secret rotation without silent downgrade; provide replay guidance using delivery/event ID plus durable deduplication.
- [ ] Offline verification, when server contract is fixed: import the server's standard-base64 **raw 32-byte Ed25519 public key** as a Web Crypto `raw` key, verify exact signed bytes, then check expiry/grace/fingerprint/approval and key rotation. Document that purely offline checks cannot know current DB revocation. Never treat an unsigned decoded payload as verified.
- [ ] Test every parity route with request/response fixtures from current handlers: direct versus wrapped JSON, null fields, status-only actions, 204, binary, 4xx/5xx, non-JSON, request IDs, and `Retry-After`. Generate crypto golden vectors from server code and run integration tests against a real server/test harness for license, subscription, usage, webhook, order, invoice, and offline workflows; mocks alone cannot prove compatibility.
- [ ] Test unsafe retries (write not repeated), safe idempotent retries, abort before/during fetch/backoff/rate wait, timeout, malformed URL/ID, credential collision, unsafe integers, huge error bodies, missing `data`, signature tampering, webhook replay, clock skew, and secrets redaction.
- [ ] Run Node module-format, browser, and edge-worker smoke tests for package resolution, fetch, abort, crypto, and forbidden headers. Current server CORS allows `Content-Type`, `Authorization`, `X-Request-ID`, `X-API-Key` but omits `X-Org-ID` and `X-Usage-*`, and does not expose response `X-Request-ID`; document and/or fix server-side requirements before claiming browser support for those features.
- [ ] Document each namespace's actual server semantics, auth/scope, response shape, errors, retry behavior, pagination, date/integer policy, unsupported Go methods, and server compatibility. Use backend-only API-key examples and short-lived browser bearer examples only where supported. State offline-verification status honestly.
- [ ] CI gate: lint, strict typecheck, contract and integration tests, supported runtime smoke tests, build, `npm pack`, package/type resolution, dependency audit, and route/parity diff. Publish with semver and provenance only after P0 blockers close and tarball contents/exports are verified.

### G. Optional enhancements — P2

- [ ] Add opt-in observability with redacted metadata and attempt/duration metrics; default logger stays silent. Specify middleware ordering relative to signing/auth/retry/timeout before exposing interceptors.
- [ ] Add type-safe webhook payload mapping only for server-confirmed events while permitting unknown future event types. Keep framework adapters, React hooks, CLI, and OpenTelemetry separate if demand warrants.
- [ ] Use schema code generation after the server publishes a trustworthy OpenAPI spec; generated types still need contract tests. Defer client-side proration, fingerprint generation, certificate caching, automatic idempotency keys, multi-region failover, gRPC, GraphQL, and streaming APIs until corresponding server semantics exist.
