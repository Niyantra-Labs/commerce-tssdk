# Niyantra Commerce TypeScript SDK - TODO

Parallel to [`commerce-gosdk`](https://github.com/Niyantra-Labs/commerce-gosdk)
and [`commerce-rustsdk`](https://github.com/Niyantra-Labs/commerce-rustsdk).
The surface area mirrors the Go SDK one-to-one; package/idiom choices are
TypeScript-native. Track the Go SDK's TODO when adding new endpoints so all
SDKs stay in sync.

## Phase 1: Core SDK

### 1.1 Project Setup
- [ ] Initialize npm package (`npm init -y`) — scoped name `@niyantra/commerce`
- [ ] `package.json`: author, license = "MIT", description, repository, homepage, keywords, bugs
- [ ] Set up `src/` module layout — one file per domain (`customer.ts`, `license.ts`, …) + a `services/` folder for HTTP surfaces
- [ ] Dual ESM + CJS build via `tsup` (or `unbuild`) emitting `dist/index.mjs`, `dist/index.cjs`, and `dist/index.d.ts`
- [ ] `tsconfig.json` — `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `declaration: true`
- [ ] `tsconfig.build.json` extending the root with `rootDir: src`, `outDir: dist`, tests excluded
- [ ] `exports` map in `package.json` routing `import` → `.mjs` and `require` → `.cjs` with matching `.d.ts` bundles
- [ ] Node engines: `>=18.17` (native `fetch`, `crypto.webcrypto`, `crypto.subtle.timingSafeEqual` fallback via `node:crypto`)
- [ ] Browser / edge runtime support (Cloudflare Workers, Vercel Edge, Deno) — zero Node-only built-ins in the hot path
- [ ] Runtime dependencies kept minimal: prefer platform `fetch` and `crypto.subtle` over `axios` / `node-fetch` / `jsonwebtoken`
- [ ] Dev dependencies: `typescript`, `tsup`, `vitest`, `@vitest/coverage-v8`, `msw` (mock service worker for integration tests), `@types/node`, `eslint`, `@typescript-eslint/*`, `prettier`, `typedoc`
- [ ] `Makefile` (or npm scripts): `fmt`, `lint`, `typecheck`, `test`, `build`, `docs`, `audit`
- [ ] `LICENSE` (MIT, same text as Go SDK)
- [ ] `.gitignore` (node_modules/, dist/, coverage/, *.tsbuildinfo, .env*)
- [ ] `.prettierrc` — single quotes, trailing commas, 100-char width
- [ ] `eslint.config.js` (flat config) — `@typescript-eslint/strict-type-checked` + `eslint-plugin-import` + `eslint-plugin-unicorn`
- [ ] `.editorconfig`
- [ ] `.nvmrc` pinning Node 20

### 1.2 Type System & Models
- [ ] Shared: `ListParams`, `ListResponse<T>`, `ApiError`, `DataResponse<T>`, `Metadata`, `Address`
- [ ] `ListParams` type with `limit`, `offset`, `search`, `sort`, `status` and a `buildQuery(params)` helper
- [ ] Error hierarchy — `CommerceError` base class with subclasses: `CommerceApiError`, `CommerceHttpError`, `CommerceRateLimitError`, `CommerceValidationError`, `CommerceCryptoError`, `CommerceTimeoutError`. Each carries `code`, `status`, `requestId`, `cause`.
- [ ] Discriminated union `Result<T>` alternative helper for consumers that prefer non-throwing APIs
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
- [ ] `SigningKeyResponse`, `HealthResponse`
- [ ] Optional fields use `field?: T` (omitted ⇒ serialiser drops them, matching Go's `omitempty`)
- [ ] Dates kept as ISO-8601 `string` on the wire (Go SDK does the same) with a `toDate(iso)` helper exported for consumers who want `Date`
- [ ] Money fields stay as `number` (JS safe integer range covers minor-unit amounts below 2^53), matching Go SDK's `int64` for cents
- [ ] `readonly` on response-side fields so consumers can't accidentally mutate server state
- [ ] Re-export every model from `src/models/index.ts` and surface at package root

### 1.3 HTTP Client
- [ ] `Client` class holding base URL, auth config, org id, rate limiter, retry policy, `fetch` implementation
- [ ] Constructor signature: `new Client(options: ClientOptions)` with `options.apiKey`, `options.baseUrl`, `options.bearerToken?`, `options.orgId?`, `options.fetch?`, `options.userAgent?`, `options.timeoutMs?`, `options.rateLimit?`, `options.retry?`
- [ ] Service namespaces exposed as readonly getters (e.g. `client.customers`, `client.licenses`) that lazily construct thin wrapper objects sharing the client instance
- [ ] API key auth — `X-API-Key` header
- [ ] JWT bearer auth — `Authorization: Bearer <token>` header, takes precedence over API key when both set
- [ ] Org scoping — `X-Org-ID` header, overridable at runtime via `client.setOrgId(id)`
- [ ] Per-request org override via an options bag on every service method (`{ orgId?: string; signal?: AbortSignal; idempotencyKey?: string }`)
- [ ] Cancellation through native `AbortSignal` — each request honors `options.signal` and composes with an internal timeout controller
- [ ] Client-side rate limiting via a hand-rolled token-bucket (no external deps) that exposes `acquire(): Promise<void>`
- [ ] Automatic retry with exponential backoff for 429 + 5xx — configurable `maxRetries`, `initialBackoffMs`, `backoffMultiplier`, `maxBackoffMs`, `jitter`
- [ ] Respect `Retry-After` header (seconds or HTTP-date)
- [ ] JSON request body via `JSON.stringify` with `null`/`undefined` stripping for optional fields
- [ ] JSON response decoding with graceful fallback to `CommerceHttpError` on non-JSON bodies
- [ ] Error response parsing — decode `{ error: { code, message, details } }` into `CommerceApiError` with the original envelope attached as `apiError.raw`
- [ ] Query param helpers (`buildQuery(base, extras)`) returning a `URLSearchParams` instance
- [ ] `fetch` injection so consumers can plug in `undici`, a test double, or a wrapped fetch for logging
- [ ] Default `User-Agent` string derived from `package.json` version at build time (`@niyantra/commerce/<version> (<runtime>)`)
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
- [ ] `OrderService`: list, create, get, update, pay
- [ ] `PaymentService`: list, refund, reconcile
- [ ] `InvoiceService`: list, get, send
- [ ] `WebhookEndpointService`: list, create, get, update, delete
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
- [ ] `UsageReporter`: HMAC-SHA256 signed usage report ingestion using `crypto.subtle.importKey` + `crypto.subtle.sign`, signing payload format `{apiKey}|{timestamp}|POST|/api/v1/usage/reports|{body}` byte-identical to gosdk/rustsdk
- [ ] `WebhookVerifier`: HMAC-SHA256 signature verification with constant-time compare via `crypto.timingSafeEqual` (Node) or a hand-rolled constant-time compare (browser/edge)
- [ ] Framework-agnostic input — accept `{ headers: Record<string, string>; body: string | Uint8Array }` so the same verifier works in Express, Fastify, Hono, Next.js route handlers, Cloudflare Workers, etc.
- [ ] `OfflineVerifier`: Ed25519 certificate verification via `crypto.subtle.verify` with an `Ed25519` key imported from `SPKI` bytes; no network required
- [ ] Certificate format `base64url(payload).base64url(signature)` matching other SDKs
- [ ] Async iterator pagination — `for await (const item of client.licenses.listAll(params)) { ... }` returning an `AsyncIterableIterator<T>` that fetches pages on demand
- [ ] `collectAll(iterable, { cap })` helper that drains an async iterator into `T[]` with an optional hard cap

### 1.6 Documentation
- [ ] `README.md` with badge row, install snippet, quick-start, full endpoint table
- [ ] `doc/developer-guide.md` with architecture notes, retry semantics, auth flows, runtime compatibility matrix (Node / Bun / Deno / browser / Workers / Vercel Edge)
- [ ] TSDoc `/** */` on every exported class, interface, and method with at least one usage example per major surface
- [ ] `typedoc` configuration + generated HTML docs under `dist/docs/` (opt-in via `npm run docs`)
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
- [ ] Fixture helpers — spin up an MSW handler set and return a pre-configured `Client`
- [ ] End-to-end license lifecycle (create → validate → activate → deactivate)
- [ ] End-to-end subscription lifecycle
- [ ] End-to-end usage reporting (signing → ingestion)
- [ ] End-to-end webhook delivery

### 2.5 Runtime Compatibility Tests
- [ ] Node 18 / 20 / 22 matrix
- [ ] Bun smoke test (`bun test` on a minimal suite)
- [ ] Deno smoke test (`deno test` via `npm:` specifier import)
- [ ] Cloudflare Workers integration test via `wrangler dev` or `@cloudflare/vitest-pool-workers`
- [ ] Browser smoke test via `vitest --environment jsdom` for the webhook verifier + offline verifier code paths

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
- [ ] Idempotency-Key auto-generation for POST (UUID v4 via `crypto.randomUUID`)
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
- [ ] GitHub Actions workflow: install, typecheck, lint, test, build on Node 18 / 20 / 22
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

**Parity policy**: every checkbox in the Go SDK's `TODO.md` must have an
equivalent here. When adding new domains to the Commerce server, update all
three SDK TODOs simultaneously so they don't drift.

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
- Go's `time.Time` → ISO-8601 `string` on the wire, with an opt-in `toDate`
  helper for consumers who want `Date` objects (parity with gosdk, which
  also carries timestamps as strings for non-`time.Time` fields).
- Go's `json.RawMessage` metadata → `Record<string, unknown>`.
- Go's `sync.Mutex` for org-id swap → plain assignment on the `Client`
  instance (JS is single-threaded per event loop — no lock needed).
- Go's `httptest` → `msw` (mock service worker) for integration, and
  fetch-injection for unit tests.

**Error design**: a hierarchy of classes extending a single `CommerceError`
base so consumers can `instanceof`-check the broad family or narrow to a
specific subclass. All errors carry `code`, `status`, `requestId`, and a
`cause` chain (Error `cause` option introduced in ES2022).

**Runtime targets**: Node 18.17+, Bun 1.0+, Deno 1.40+, modern browsers
(Chrome 111+, Safari 16.4+, Firefox 115+), Cloudflare Workers, Vercel Edge.
The core client uses only platform `fetch`, `crypto.subtle`, and
`AbortController` — no Node-only built-ins in the hot path. Node-specific
escape hatches (e.g. `node:crypto.timingSafeEqual`) are loaded via dynamic
`import()` only when the runtime exposes them.

**Module format**: dual ESM + CJS via `tsup` with hand-curated `exports` map
and a single `.d.ts` rollup. Verified clean with `publint` and
`@arethetypeswrong/cli` on every release.

**MSRV-equivalent**: TypeScript 5.4+ for `NoInfer`, `const` type params, and
stable `exactOptionalPropertyTypes` ergonomics. Review every six months.
