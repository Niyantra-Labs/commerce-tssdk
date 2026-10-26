# Niyantra Commerce TypeScript SDK - TODO

> **Implementation status (2026-10-26):** Phase 1 has started. The repository now has an ESM package, typed service surface, shared transport, signed usage reporter, webhook verifier, an Ed25519 offline verifier, generated Go model baseline, documentation, and growing contract-focused tests. The SDK is **not production ready or published**. The Go SDK is the public API parity target; Commerce server handlers are the wire contract. The corrective checklist below supersedes conflicting bullets. Compared revisions: Go SDK `fe24005`, Commerce `9dd22b9` (offline signing + affiliate payout-default fixes, committed on top of `ab3e04f`).
>
> **This session's verified changes** (build/typecheck/test/lint/fmt/docs/pack/live-integration all green against a rebuilt Compose stack; full `go test ./...` green in `commerce`):
>
> - Fixed server-contract bugs found by reading `commerce/internal/domain/**/handler.go` and `model.go` against `src/models/generated.ts`: `WebhookEndpointCreateParams`, `CommissionPlanCreateParams`, `AffiliateCreateParams`, `ReferralProgramCreateParams`, and `CommissionPayoutCreateParams` were all missing the server's required `org_id` body field. `WebhookEndpointListParams` was missing the server-supported `org_id` filter. `payout_threshold` → `payout_threshold_cents` in `Affiliate`/`AffiliateCreateParams`/`AffiliateUpdateParams`. `SubscriptionService.pause/resume/cancel` were typed as returning `SubscriptionMutationResult` but the server returns a flat `Subscription` for all three. `WebhookEventService.get()` returns `{data: {event, endpoint_url, endpoint?}}`, not a flat `WebhookEvent` — added `WebhookEventDetail`.
> - **Found and fixed a second class of bug: nine action methods sent no request body at all, but their handlers do `json.NewDecoder(r.Body).Decode(&input)` and 400 with "invalid request body" on a truly empty body (Go's decoder returns `io.EOF`).** `AffiliateService.approve/reject`, `AffiliateEventService.review`, `CommissionPayoutService.approve/pay/fail/reverse`, and `ReferralEventService.qualify/reward/reject` were all unusable until this session — added the required param types (`AffiliateApproveParams`, `AffiliateRejectParams`, `AffiliateEventReviewParams`, `CommissionPayoutApproveParams`/`PayParams`/`FailParams`/`ReverseParams`, `ReferralEventQualifyParams`/`RewardParams`/`RejectParams`) and threaded them through. Confirmed live: creating a commission plan + affiliate + `reject(id, {reason})` against the real server.
> - **Found and fixed a Commerce server bug while proving the affiliate fix live**: `affiliate.CreateAffiliate` always bound `payout_threshold_cents`/`payout_currency` as explicit SQL parameters, so a nil/omitted value inserted `NULL` instead of letting the column's `DEFAULT` apply — any affiliate create that omitted them 500'd with a NOT NULL violation. Fixed in `commerce/internal/domain/affiliate/repository.go` to default to `5000`/`"USD"` in Go, matching the migration's actual defaults.
> - **Resolved the offline-certificate signing blocker — this was a confirmed Commerce server defect, now fixed, not just documented.** `offline.Repository.Issue` was signing an unrelated `crypto.LicensePayload` struct instead of the actual `OfflinePayload` bytes returned as `certificate`, and `offline.Repository.Verify` never checked the signature it was given at all. Fixed in `commerce/internal/crypto/signer.go` (added `SignRaw`/`VerifyRaw` for signing/verifying arbitrary bytes without the `LicensePayload` envelope) and `commerce/internal/domain/offline/repository.go` (`Issue` now signs the certificate's final bytes — including `certificate_id` — and `Verify` optionally checks `VerifyInput.Signature` against those same bytes when present, non-breaking for callers that omit it). **Certificates issued before this fix carry a signature in the old, incompatible format and cannot be verified under the new scheme — there is no migration path for them; reissue is required if local verification matters for an existing certificate.** See `commerce/docs/offline.md` for the server-side writeup.
> - Implemented `OfflineVerifier` (`src/offline-verifier.ts`): imports the server's raw 32-byte Ed25519 public key (from `client.system.signingKey()`) via Web Crypto, verifies the exact certificate bytes against the signature returned at issue/reissue time, then checks fingerprint/expiry/grace locally. Confirmed Ed25519 sign/verify/raw-key-import works via `crypto.subtle` on Node 24 in this session; Node's Ed25519 WebCrypto support has shipped without a flag since Node 18.4, so Node 20 (the pinned minimum) should work too, though it wasn't independently tested on 20 specifically. Modern evergreen browsers (Chrome 137+, Firefox 136+, Safari 17+) support Ed25519 WebCrypto as of their 2025 releases; this wasn't tested in an actual browser this session. Deliberately does **not** check revocation — that's only knowable online via `client.offlineCertificates.verify`.
> - Verified by direct code reading that the usage-reporter HMAC canonical string, the webhook HMAC canonical string/headers, the `/signing-key` unwrapped response, the license revoke/suspend/reactivate/reissue response shapes, and the order/invoice mutation and detail shapes all already match the server exactly — no changes needed there.
> - Extended `integration/live-smoke.mjs` from 14 to 25 real-server assertions, all passing: webhook endpoint create → async delivery via a loopback HTTP receiver → `WebhookVerifier` signature verification against the server's real HMAC → tamper rejection → event list/get; offline-certificate issue → online verify (valid/mismatch) → **local `OfflineVerifier` verify against the real server signing key (valid) and against a wrong signature (rejected)**; commission plan create → affiliate create/reject (the empty-body fix). Added `extra_hosts: host.docker.internal:host-gateway` to `compose.yml` for the webhook receiver (works on both Docker Desktop and Linux Docker Engine).
> - Unit tests: 23 → 31, including a new `test/offline-verifier.test.ts` with real Node-generated Ed25519 keypair fixtures (valid, tampered, wrong-key, fingerprint-mismatch, grace-period/expiry, malformed-input cases).
> - **Commerce-side changes committed as `9dd22b9` in `commerce` (local `main`, not pushed)** — `internal/crypto/signer.go` (+tests), `internal/domain/offline/repository.go`, `internal/domain/affiliate/repository.go`, `docs/offline.md`. Before committing, `Issue` was also hardened to return an error when the final `UPDATE offline_certificates SET certificate, certificate_hash` fails (previously ignored, which could leave the stored row out of sync with the signed certificate returned to the caller). Re-verified after that change: Docker `go test ./...` green, Compose image rebuilt, all 25 live-smoke assertions passing.

> **Session 3 (2026-10-26) — Commerce tenant isolation (server security fix, commerce `a5a94e3`; affiliate/referral lifecycle fixes, commerce `43579ee`; both local `main`, not pushed):**
>
> - **Found and proved a critical server defect:** `/api/v1` had no tenant isolation and, in `AUTH_MODE=delegated`, no authentication. `middleware.OrgScope` was defined but never wired, so every `GetOrgID` returned `""`; API-key identities carried no `OrgID`; by-ID lookups were unscoped; unrecognised API keys fell through as anonymous. Reproduced on the Compose stack: a fake key listed all organizations; org B's real key listed, read, renamed, and created rows inside org A. The production ingress (`infra/k8s/commerce/ingress.yaml`) routes `/api` directly to Commerce, bypassing the `/admin` oauth2-proxy, so production was very likely exposed the same way (not probed).
> - **Fix (in `commerce`):** new `internal/tenant` guard (fail-closed route table for all 210 `/api/v1` routes, path-ID ownership, query/JSON-body reference ownership mirroring `encoding/json` case folding and first-value decoding, `org_id` pinning), API keys bound to their application's org (inactive/deleted applications stop authenticating), `OrgScope` wired, org filters added to 21 list repositories (referral codes/events previously ignored the `OrgID` they were passed), gateway webhook log list scoped, operator access requires `AUTH_OPERATOR_ROLES` (default `commerce:admin`; `JWT_ROLES_CLAIM` configurable, Zitadel's object-shaped role claim supported), admin UI API calls moved to the proxied `/admin/api/v1` alias with CSRF headers. Docs: `commerce/docs/authentication.md`.
> - **Verified:** Docker `go test ./...` green (27 packages) including new guard/route-coverage/ownership tests; ownership SQL for every entity executed against the migrated Compose database; live smoke 31/31 including 6 new tenant-isolation checks (anonymous 401, role-less 403, 13 foreign resources 404 by ID, 35 list endpoints with no foreign rows, cross-org create/update/usage-report refused, owners/operators keep access); admin alias + CSRF checked live.
> - **SDK impact:** the bootstrap client in `integration/live-smoke.mjs` now authenticates as an operator via trusted proxy headers (`integration/compose.yml` trusts all sources and sets `AUTH_OPERATOR_ROLES`; loopback-only stack). Public routes (validate, activate, offline verify, signing key, health) are exercised with no credentials. API-key callers no longer need to be trusted with `org_id`: a foreign `org_id` is now 403.
> - **Still open on the server:** API-key scopes are not enforced beyond `usage:report`; SES webhook signature verification and gateway-config credential validation on the API path were not audited/fixed; production rollout needs the operator role granted in the IdP and roles included in the token (see `commerce/docs/authentication.md`).
> - **Affiliate/referral/plan/subscription contracts reconciled and proven live (session 3, after the tenant fix):** regenerated `CommissionPlan*`, `Affiliate*`, `AffiliateLink*`, `AffiliateEvent*`, `CommissionPayout*`, `ReferralProgram*`, `ReferralCode*`, `ReferralEvent*` and `SubscriptionCreateParams` from the server structs (a struct differ now reports zero field drift). Notable fixes: `Affiliate` counters are `total_clicks/total_signups/total_purchases/total_earned_cents/total_paid_cents` (SDK had invented names), `AffiliateLink.unique_clicks`, `ReferralEvent.referrer_reward_amount_cents/referred_reward_amount_cents/rejected_reason/updated_at`, `CommissionPayoutCreateParams.amount_cents` (was missing), invented `metadata` fields removed. List filters are exact per handler (new `PageParams` base; added `commission_plan_id`, link `product_id`, event `reviewed`, code `referrer_id`; removed ignored `search`/`status`), and every list filter dropped `| null` because the transport rejects null query values. `PlanComparison.features/limits` are `| null`. Go SDK `Plans.Compare` sends `plan_ids` but the server requires `product_id` (Go-side bug; TS is correct).
> - **Commerce server fixes found while proving those live (commerce `43579ee`):** payout approve, affiliate approve, and affiliate-event review always 500'd because `approved_by`/`reviewed_by` were bound into UUID FKs to `accounts` (empty in IdP deployments; even the admin console passed `"admin"`) — now stored only when they name an account. Payout and referral-event actions had no lifecycle enforcement (a pending payout could be paid; a rewarded event rejected) — now guarded per the documented lifecycles, returning `409 invalid_transition`. Referral qualify without an order, referral program create without referrer reward fields, and payout create without currency no longer violate NOT NULL/UUID constraints. Tenant guard polymorphic targets aligned with the schema (`payee_type` affiliate/reseller, `referrer_type` customer/reseller).
> - **Live smoke now 37/37**, adding plan compare (null then populated), the full subscription lifecycle, affiliate filters/approve/links/events/review, payouts approve/pay/reverse and approve/fail with 409s, and referral program/code/events qualify/reward/reject with 409s — all through an org-scoped API key. Unit tests 31 → 34 (filter encoding incl. `reviewed=false`, type-level filter rejection).
> - **Server extensions now in the SDK and proven live (session 3):** `gatewayConfigs` (CRUD, `setDefault`, `test`) + `gatewayProviders` (`list`, `schema`); `notificationTemplates` (list/create/get/update) + `notifications` (list/queue/get/retry); `applicationNotifications` (list/create/get/update, license-key `feed` and `acknowledge`); `releases` (list/create/get/update/delete, publish/yank, artifact list, multipart `uploadArtifact`, `checksum`, `authorizeDownload`, streaming `download`). Types generated from the server structs. Transport gained a multipart `formData` body (never retried, boundary set by fetch) and keeps honouring the caller's `AbortSignal` while a `raw` body streams (the timeout covers headers only). Live smoke 42/42; unit tests 37.
> - **Server bugs found proving those (commerce `30286a8`):** notification template/queue inputs had no JSON tags, so snake_case keys never bound — and that let a Go-field-name key like `OrgID` past the tenant guard, now closed both ways (tags + underscore-insensitive guard matching); every license-authorized download failed with 403 (download log bound `ip:port` into INET and an over-long token into VARCHAR(255)) — now records the parsed IP and a token digest instead of the live token; gateway `set-default` on an unknown ID returned `200 {data:null}` — now 404.
> - **Fixed later in session 3 (commerce `70485fd`, proven live):** artifact uploads now stream (32 MiB in memory, the rest in a temporary file, hashed in one pass, seekable to local/S3 storage) up to `RELEASE_MAX_ARTIFACT_BYTES` (default 2 GiB, 413 beyond) instead of being capped at 10 MiB by the global body limit — that cap had been the only guard against reading uploads fully into memory; download and checkout URLs honour `X-Forwarded-Proto` (one shared helper replaces five copies); gateway-config API create/update validate credentials like the console and reject unknown providers; public download grants no longer reveal storage paths. Then (commerce `211f63e`, proven live): **API-key scopes are enforced** — `<family>:read`/`<family>:write`/`usage:report`/`*` per route in the tenant guard (403 `insufficient_scope`), keys need ≥1 valid scope at creation (400 `invalid_scopes`), a key cannot mint broader keys, and migration `00029` granted `*` to all existing keys (79/79 in the test database); notification `retry` is limited to `failed`/`bounced` (409 otherwise; an unknown ID no longer panics). Download tokens stay reusable until expiry by decision (documented).

> **Session 3, final round (2026-10-26):** remaining domains (organizations through audit logs, 56 types) regenerated from the server structs with zero drift, 12 dead Go-SDK leftover types removed, and every list type now matches its handler (a list-param differ reports 20/20). Requiredness was set from live minimal creates. Added `client.paymentMethods` (incl. `checkoutOptions`) and `gatewayConfigs.listWebhookLogs`. Server fixes (commerce `86fce4a`, `a4d70e3`): payment methods are filed under their customer's org (an operator could previously file them under another tenant, or attach another org's gateway), checkout options no longer 500 for operators, entitlements without a source are a 400 instead of a 500, and empty webhook-log/checkout-option lists are `[]` not `null`. **Codex branch `codex/ci-hardening` merged**: CI workflow (actions pinned to SHAs verified against their tags; not yet run on GitHub), 22 transport edge tests and fixes (mutations never retried even with `retryable: true`, 3xx → `CommerceProtocolError`, strict JSON content type, credentials redacted from error messages and causes, oversized bodies cancelled), `doc/wire-semantics.md`; after review, network-error causes are kept for diagnosis unless they mention the credential. Checklist reconciled against evidence: 182 done, 16 partial, 70 open (mostly Phases 3–5 and P2).

> **Session 3, parallel round 2 (Claude half):** typed webhook events (`src/webhook-events.ts`, matched against the server's `KnownEventTypes` and proven with real deliveries); enum unions for 131 fields from the CHECK constraints; commerce `2e8255c` widens `payments_gateway_check` (payments captured through any provider other than Razorpay/Stripe could not be recorded — proven by a rolled-back PayPal insert on the live database); commerce `30b0eed` exposes `X-Request-ID`, `Retry-After`, `Content-Disposition`, and `X-Checksum-SHA256` to browsers. Codex's `codex/observability` (hooks, User-Agent, webhook secret rotation, coverage, release tooling) was reviewed and merged; typed webhook events are now exported from the package root.

**Phase 1 work still required:** Reconcile every generated model and endpoint result with server JSON, add full route fixture and real-server tests, verify browser/edge runtime behavior and CORS, and finish package/API documentation. Do not mark an endpoint complete from mocked responses alone.

Parallel to [`commerce-gosdk`](https://github.com/Niyantra-Labs/commerce-gosdk)
and [`commerce-rustsdk`](https://github.com/Niyantra-Labs/commerce-rustsdk).
The surface area mirrors the Go SDK one-to-one; package/idiom choices are
TypeScript-native. Track the Go SDK's TODO when adding new endpoints so all
SDKs stay in sync.

## Phase 1: Core SDK

### 1.1 Project Setup

- [x] Initialize npm package — scoped name `@niyantra/commerce`
- [x] `package.json`: author, license = "MIT", description, repository, homepage, keywords, bugs — author, description, repository, homepage, bugs, keywords, MIT license present (session 3)
- [ ] Set up `src/` module layout — one file per domain (`customer.ts`, `license.ts`, …) + a `services/` folder for HTTP surfaces
- [x] ESM-only, chosen from tested consumers: the `exports` map has `types`/`import`/`default`, so ESM imports and Node ≥20.19/≥22.12 CommonJS `require()` (require(esm)) both work from the packed tarball (`npm run test:package`); no separate CJS build or declarations to keep in sync.
- [x] `tsconfig.json` — ES2022, NodeNext module resolution, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, declarations
- [x] `tsconfig.build.json` extending the root with `rootDir: src`, `outDir: dist`, tests excluded
- [x] `exports` map in `package.json` matching ESM output and declarations for the root export
- [x] Node engine minimum `>=20` is now backed by the runtime smoke (Node 20.20 and 24.22 pass every check, including Ed25519 Web Crypto); `crypto.subtle` has no `timingSafeEqual`, so the webhook verifier compares in constant time itself
- [x] Browser / edge runtime support — the built package references only `globalThis.fetch` and the global `crypto`; proven in Chrome, workerd (Cloudflare Workers), Deno, and Bun. Vercel Edge not tested (no runtime available locally).
- [x] Runtime dependencies kept minimal: platform `fetch` and `crypto.subtle`; no runtime dependencies
- [x] Dev dependencies: `typescript`, `tsup`, `vitest`, `@vitest/coverage-v8`, `msw` (mock service worker for integration tests), `@types/node`, `eslint`, `@typescript-eslint/*`, `prettier`, `typedoc` — actual set: typescript (tsc, no tsup), Vitest and coverage-v8 4.1.11, msw 2.15.0, @types/node, @types/express, eslint + typescript-eslint, prettier, typedoc
- [x] npm scripts: `fmt`, `lint`, `typecheck`, `test`, `build`, `docs`, `audit`
- [x] `LICENSE` (MIT, same text as Go SDK)
- [x] `.gitignore` (node_modules/, dist/, coverage/, _.tsbuildinfo, .env_)
- [x] `.prettierrc.json` — single quotes, trailing commas, 100-char width
- [ ] `eslint.config.js` (flat config) — `@typescript-eslint/strict-type-checked` + `eslint-plugin-import` + `eslint-plugin-unicorn`
- [x] `.editorconfig`
- [x] `.nvmrc` pinning Node 20

### 1.2 Type System & Models

- [x] Shared: `ListParams`, `ListResponse<T>`, `ApiError`, `DataResponse<T>`, `Metadata`, `Address` — `PageParams`/`ListParams`/`ListResponse<T>` and `Metadata`; `DataResponse` removed (the transport unwraps `data`)
- [x] `ListParams` type with `limit`, `offset`, `search`, `status` and a `buildQuery(params)` helper; add only endpoint-specific query fields accepted by the server (there is no general `sort` contract) — per-handler list types; query building lives in the transport
- [~] Error hierarchy — `CommerceError` base class with subclasses: `CommerceApiError`, `CommerceHttpError`, `CommerceRateLimitError`, `CommerceValidationError`, `CommerceCryptoError`, `CommerceTimeoutError`. Each carries `code`, `status`, `requestId`, `cause`. — implemented as CommerceApiError/NetworkError/TimeoutError/AbortError/ProtocolError/ValidationError/CryptoError with `cause`; no separate Http/RateLimit classes
- [x] Discriminated union `Result<T>` and `asResult` helper for consumers that prefer non-throwing APIs
- [x] `Organization` interface + `CreateOrganizationParams` / `UpdateOrganizationParams` / `ListOrganizationsParams` — generated from the server structs, zero drift (session 3)
- [x] `Product` interface + create/update/list params — generated from the server structs, zero drift (session 3)
- [x] `Plan` interface + create/update/list/compare params — generated from the server structs, zero drift (session 3)
- [x] `Customer` interface + create/update/list params — generated from the server structs, zero drift (session 3)
- [x] `Contact` interface + create params — generated from the server structs, zero drift (session 3)
- [x] `License` interface + create/bulk-create/validate/revoke/suspend params — generated from the server structs, zero drift (session 3)
- [x] `LicenseValidationResponse` + `ResolvedFeature` — generated from the server structs, zero drift (session 3)
- [x] `Activation` interface + activate/deactivate params — generated from the server structs, zero drift (session 3)
- [x] `Machine` interface + create/update/list params — generated from the server structs, zero drift (session 3)
- [x] `Subscription` interface + create/update/renew/pause/resume/cancel/change-plan/seats params — generated from the server structs, zero drift (session 3)
- [x] `SubscriptionMutationResult` + `ProrationPreview` — generated from the server structs, zero drift (session 3)
- [x] `Entitlement` interface + create/update/list/override params — generated from the server structs, zero drift (session 3)
- [x] `Addon` interface + create/update/list params — generated from the server structs, zero drift (session 3)
- [x] `LicenseAddon` + purchase params — generated from the server structs, zero drift (session 3)
- [x] `UsageMeter` interface + create/update/list params — generated from the server structs, zero drift (session 3)
- [x] `UsageReport`, `UsageReportBatch`, `UsageSummary` — generated from the server structs, zero drift (session 3)
- [x] `UsageAdjustment` + `UsageCredit` interfaces — generated from the server structs, zero drift (session 3)
- [x] `Order` interface + `LineItem` + create/update/list params — generated from the server structs, zero drift (session 3)
- [x] `Payment` interface + refund/reconcile params — generated from the server structs, zero drift (session 3)
- [x] `Invoice` interface + list params — generated from the server structs, zero drift (session 3)
- [x] `WebhookEndpoint` + `WebhookEvent` interfaces + create/update/list params — generated from the server structs, zero drift (session 3)
- [x] `WebhookEventEnvelope` + event-type string-literal union (`'license.issued' | 'license.revoked' | ...`) wired to a typed event-payload map (`WebhookEventPayloadMap`) — src/webhook-events.ts: 15 server event types, per-type data map, `TypedWebhookEvent`, `isKnownWebhookEvent`; proven with real license.issued/subscription.created deliveries; exported from the package root
- [x] `Application` + `ApiKey` interfaces + create/list/revoke params — generated from the server structs, zero drift (session 3)
- [x] `OfflineCertificate` interface + create/verify/list/revoke params — generated from the server structs, zero drift (session 3)
- [x] `ReferralProgram`, `ReferralCode`, `ReferralEvent` interfaces + params — generated from the server structs, zero drift (session 3)
- [x] `CommissionPlan`, `Affiliate`, `AffiliateLink`, `AffiliateEvent` interfaces + params — generated from the server structs, zero drift (session 3)
- [x] `CommissionPayout` interface + create/list params — generated from the server structs, zero drift (session 3)
- [x] `AuditLog` interface + list params — generated from the server structs, zero drift (session 3)
- [x] `SigningKeyResponse` and the actual `/health` response shape — generated from the server structs, zero drift (session 3)
- [x] Optional fields use `field?: T` (omitted ⇒ serialiser drops them, matching Go's `omitempty`)
- [x] Dates kept as ISO-8601 `string` at the public JSON boundary, including nullable timestamp fields; Go actually uses `time.Time` for many model fields. Document any accepted `Date` inputs and normalization. — see doc/wire-semantics.md and `toDate`
- [x] Define a safe-integer policy for all Go `int64` money/usage/count fields; validate outbound values and handle or reject unsafe inbound integers without silent precision loss — outbound safe integers, inbound lossless scan (doc/wire-semantics.md)
- [x] `readonly` on response-side fields so consumers can't accidentally mutate server state
- [x] Re-export every model from `src/models/index.ts` and surface at package root — all models are exported from the package root

### 1.3 HTTP Client

- [x] `Client` class holding base URL, auth config, org id, rate limiter, retry policy, `fetch` implementation
- [x] Constructor signature: `new Client(options: ClientOptions)` with a discriminated API-key/bearer auth option, base URL, injectable fetch, optional timeout/rate/retry settings, and only verified org/header options
- [x] Service namespaces exposed as readonly getters (e.g. `client.customers`, `client.licenses`) that lazily construct thin wrapper objects sharing the client instance
- [x] API key auth — `X-API-Key` header
- [x] JWT bearer auth — `Authorization: Bearer <token>` header; require an explicit auth mode and reject ambiguous simultaneous API key and bearer credentials — including a per-request token function
- [x] Org scoping — verify the server's actual `X-Org-ID` authorization behavior before exposing it as a scoping feature; this is also a trusted-proxy identity header — resolved: Commerce derives the org from the credential (tenant guard); `X-Org-ID` is honoured only from trusted proxies, so the SDK exposes no org override
- [x] Per-request org override via an options bag on every service method (`{ orgId?: string; signal?: AbortSignal; idempotencyKey?: string }`) — not implemented by design (see org scoping); per-call `signal`, `requestId`, `timeoutMs` exist
- [x] Cancellation through native `AbortSignal` — each request honors `options.signal` and composes with an internal timeout controller — edge tests cover abort before fetch, during backoff and rate wait
- [x] Client-side rate limiting via a hand-rolled token-bucket (no external deps) that exposes `acquire(): Promise<void>`
- [x] Automatic bounded retry for safe requests on 429 and transient failures, with backoff/jitter; retry mutations only after confirming server-side idempotency and preserving key/body bytes — GET only; mutations never retried (edge tests)
- [x] Respect `Retry-After` header (seconds or HTTP-date) — seconds and HTTP-date (edge tests)
- [x] JSON request body via `JSON.stringify` with omitted `undefined`; preserve explicit `null` where PATCH clearing is supported, and preserve `false`, `0`, and empty arrays — doc/wire-semantics.md
- [x] JSON response decoding with graceful fallback to `CommerceHttpError` on non-JSON bodies — non-JSON or malformed bodies raise CommerceProtocolError/CommerceApiError
- [~] Error response parsing — decode `{ error: { code, message, details } }` into `CommerceApiError` with the original envelope attached as `apiError.raw` — code/message/details/requestId decoded; the raw envelope is deliberately not attached
- [x] Query param helpers (`buildQuery(base, extras)`) returning a `URLSearchParams` instance — internal to the transport
- [x] `fetch` injection so consumers can plug in `undici`, a test double, or a wrapped fetch with credential-redacted logging
- [x] Default SDK identification only in runtimes where the header is permitted; browsers cannot set `User-Agent` — Node/Bun/Deno/workerd use `niyantra-commerce-ts/<version> (<runtime>)`; browser omits it; version is test-checked against package.json.
- [x] Debug hook — optional `onRequest` / `onResponse` / `onRetry` callbacks with frozen, redacted attempt metadata; callback failures are swallowed and default logging stays silent.
- [x] `unprefixed` path support for `/health` (same carveout as rustsdk)

### 1.4 Service Implementations

Each service is a class (or object literal with methods) that shares a reference to the `Client` instance. All list methods return `Promise<ListResponse<T>>`. Single-item fetches return `Promise<T>` with 404 → `CommerceApiError`.

- [x] `OrganizationService`: list, create, get, update, delete — implemented and contract-tested (README endpoint reference)
- [x] `ProductService`: list, create, get, update, delete — implemented and contract-tested (README endpoint reference)
- [x] `PlanService`: list, create, get, update, delete, compare — implemented and contract-tested (README endpoint reference)
- [x] `CustomerService`: list, create, get, update, delete — implemented and contract-tested (README endpoint reference)
- [x] `ContactService`: listContacts, addContact, deleteContact — implemented and contract-tested (README endpoint reference)
- [x] `LicenseService`: list, create, bulkCreate, get, revoke, suspend, reactivate, reissue, features, validate, listAddons, purchaseAddon, getUsage, upsertEntitlementOverride — implemented and contract-tested (README endpoint reference)
- [x] `ActivationService`: activate, deactivateByKey, list, get, deactivate — implemented and contract-tested (README endpoint reference)
- [x] `MachineService`: list, create, get, update, delete, decommission — implemented and contract-tested (README endpoint reference)
- [x] `SubscriptionService`: list, create, get, update, renew, pause, resume, cancel, changePlan, updateSeats — implemented and contract-tested (README endpoint reference)
- [x] `EntitlementService`: list, create, get, update, delete — implemented and contract-tested (README endpoint reference)
- [x] `AddonService`: list, create, get, update, delete — implemented and contract-tested (README endpoint reference)
- [x] `UsageMeterService`: list, create, get, update, delete — implemented and contract-tested (README endpoint reference)
- [x] `UsageService`: createAdjustment, grantCredits — implemented and contract-tested (README endpoint reference)
- [x] `OrderService`: list, create, get; reconcile Go `update`/`pay` with current server `checkout`/`fulfill` routes before naming methods — implemented and contract-tested (README endpoint reference)
- [x] `PaymentService`: list, refund, reconcile — implemented and contract-tested (README endpoint reference)
- [x] `InvoiceService`: list, get; reconcile Go `send` with current server `issue`, `void`, `pdf` — implemented and contract-tested (README endpoint reference)
- [x] `WebhookEndpointService`: list, create, get, update, test; Go `delete` has no matching server route — implemented and contract-tested (README endpoint reference)
- [x] `WebhookEventService`: list, get, retry — implemented and contract-tested (README endpoint reference)
- [x] `ApplicationService`: list, create, get, update, delete — implemented and contract-tested (README endpoint reference)
- [x] `ApiKeyService`: list, create, get, rotate, revoke, delete — implemented and contract-tested (README endpoint reference)
- [x] `OfflineCertificateService`: issue, verify, list, get, approve, revoke, reissue — implemented and contract-tested (README endpoint reference)
- [x] `ReferralProgramService`: list, create, get, update, delete — implemented and contract-tested (README endpoint reference)
- [x] `ReferralCodeService`: list, create, get, disable — implemented and contract-tested (README endpoint reference)
- [x] `ReferralEventService`: list, create, get, qualify, reward, reject — implemented and contract-tested (README endpoint reference)
- [x] `CommissionPlanService`: list, create, get, update, delete — implemented and contract-tested (README endpoint reference)
- [x] `AffiliateService`: list, create, get, update, delete, approve, reject, suspend, terminate — implemented and contract-tested (README endpoint reference)
- [x] `AffiliateLinkService`: list, create, get, update, disable — implemented and contract-tested (README endpoint reference)
- [x] `AffiliateEventService`: list, create, get, review — implemented and contract-tested (README endpoint reference)
- [x] `CommissionPayoutService`: list, create, get, approve, pay, fail, reverse — implemented and contract-tested (README endpoint reference)
- [x] `AuditLogService`: list — implemented and contract-tested (README endpoint reference)
- [x] `SystemService`: signingKey, health (health bypasses `/api/v1` prefix) — implemented and contract-tested (README endpoint reference)

### 1.5 Specialized Features

- [x] `UsageReporter`: HMAC-SHA256 signed usage ingestion using the **current server canonical format**; verified byte-for-byte against `commerce/internal/domain/usage/hmac.go` and confirmed end-to-end against a live server. The Go implementation is incompatible (separate, unresolved Go-side bug) but that doesn't affect this SDK.
- [x] `WebhookVerifier`: HMAC-SHA256 verification of the **current server delivery headers and canonical format**, using a constant-time comparison after strict hex decoding; verified byte-for-byte against `commerce/internal/domain/webhook/util.go` and confirmed end-to-end with a real server-triggered delivery.
- [x] Framework-agnostic input — accepts `Headers | Record<string, string>` plus `string | Uint8Array` body (case-insensitive header lookup); not yet exercised against a real Express/Fastify/Hono/Next.js handler, only direct calls.
- [x] `OfflineVerifier`: implemented in `src/offline-verifier.ts`, gated on and now validated against the server's fixed issue/verify signing (see the corrective-checklist offline blocker below). Server public key is standard-base64 **raw Ed25519 bytes**, imported via `crypto.subtle.importKey('raw', ...)`.
- [x] Certificate format: verifies against the server's actual single-base64-JSON-payload-plus-separate-signature format (not the Go two-part format).
- [x] Async iterator pagination — `for await (const item of client.licenses.listAll(params)) { ... }` returning an `AsyncIterableIterator<T>` that fetches pages on demand — `listAll()` on every collection; tests in test/transport.test.ts
- [x] `collectAll(iterable, { cap })` helper that drains an async iterator into `T[]` with an optional hard cap — `collectAll(iterable, cap)`

### 1.6 Documentation

- [~] `README.md`: quick start, auth/tenancy, errors/retries, pagination, usage reporting, webhooks, offline verification, the proven runtime matrix, test commands, known server limitations, and a **generated endpoint table** (203 methods, rendered from the contract cases + server manifest; `test/docs.test.ts` fails when it drifts, `UPDATE_DOCS=1` regenerates). No badge row or install snippet until the package is published.
- [x] `doc/developer-guide.md`: source-of-truth hierarchy, model generation rules, the six test layers and when to regenerate fixtures, the live-server and runtime-matrix setup, request-pipeline rules (unbound fetch, non-blocking body discard, streaming abort), retry semantics, crypto contracts, tenant-guard behavior, release checklist.
- [~] TSDoc on every exported service class and method, every `client.*` namespace, `ClientOptions`/`RequestOptions`/`Authentication`, the verifiers, `UsageReporter`, and helpers (185 added in session 3; behavioral claims checked against the server: status-only returns, public routes, lifecycle 409s, bulk limits). Still open: per-field docs on the generated models, and usage examples inside TSDoc (the README and `examples/` carry them today).
- [x] `typedoc` configuration + generated HTML docs under `.typedoc/` (opt-in via `npm run docs`, excluded from the npm tarball)
- [x] Examples, all typechecked by `npm run typecheck` (flows proven by the live smoke; the example files themselves are not executed): `quickstart.ts`, `usage-reporting.ts`, `webhook-handler.ts` (framework-neutral `Request`/`Response`, works in Hono/edge handlers as-is), `offline-verification.ts`, `pagination.ts`, `release-download.ts` (streamed to disk with incremental SHA-256), `browser.ts` (per-request bearer token).
- [x] `examples/webhook-handler-express.ts` — Express 5 with `express.raw()`; **run unmodified against a real Commerce delivery**: verified (server recorded `delivered`), a server retry of the same delivery deduplicated by `X-Niyantra-Delivery-Id`, and a forged signature rejected with 401. `@types/express` is a pinned dev dependency so the example typechecks.
- [x] `examples/subscription-lifecycle.ts` — create, pause/resume, change plan with proration, seats, cancel at period end, error handling (typechecked; the same flow is proven by the live smoke)

---

## Phase 2: Testing

### 2.1 Unit Tests (vitest)

- [x] Initial transport and crypto regression suite: auth selection, HTTPS requirement, query omission, Retry-After, no mutation retry, shared token bucket, abort/timeout (including bearer callback), malformed responses, pagination consistency/cap, webhook timestamp/signature/JSON boundaries.
- [x] Client construction and option validation tests — test/transport.test.ts, test/edge-transport.test.ts, test/contract.test.ts
- [x] Request building tests — assert final URL, headers, body via a fetch mock — test/transport.test.ts, test/edge-transport.test.ts, test/contract.test.ts
- [x] Error decoding tests (malformed JSON, missing fields, non-JSON bodies, HTML error pages) — test/transport.test.ts, test/edge-transport.test.ts, test/contract.test.ts
- [x] Retry logic tests — fake fetch returning 429, 500, then 200; assert attempt count and backoff timing via `vi.useFakeTimers()` — test/transport.test.ts, test/edge-transport.test.ts, test/contract.test.ts
- [x] Rate limiter tests — verify spacing, burst allowance, fairness under `vi.useFakeTimers()` — test/transport.test.ts, test/edge-transport.test.ts, test/contract.test.ts
- [x] Query parameter building tests (undefined pruning, array serialisation, nested values) — test/transport.test.ts, test/edge-transport.test.ts, test/contract.test.ts
- [x] AbortSignal propagation tests — verify cancelling aborts the underlying fetch and rejects with `CommerceTimeoutError` / `AbortError` — test/transport.test.ts, test/edge-transport.test.ts, test/contract.test.ts

### 2.2 Service Tests (with MSW)

- [x] `test/contract.test.ts`: one MSW-backed contract case per public service method (205 cases; a meta-test fails if any method lacks one). Each case is checked against `test/fixtures/routes.json`, generated from the Commerce Go handlers by `scripts/route-manifest.py` (210 routes: verb/path, success status, response envelope `data`/`list`/`status`/`direct`/`raw`, and whether the handler requires, accepts, or ignores a JSON body). Asserts the request hits a registered route (most-specific match, as ServeMux does), the exact query, a JSON body exactly when the handler 400s without one, no body when the handler reads none, and that the SDK decodes the envelope the handler really writes. `npm run contract:check` fails when the fixture drifts from the server source (`COMMERCE_REPO`, default `../commerce`); `npm run contract:manifest` regenerates it.
- [x] Bugs it found and fixed (session 3): `licenses.suspend` sent a `reason` the handler never reads (now `suspend(id)`); `auditLogs.exportCsv` never sent `format=csv`, so it received JSON; `licenses.upsertEntitlementOverride` discarded the saved override the server returns (now typed `EntitlementOverride`; `value` is a string on the wire); the transport awaited `body.cancel()`, which never settles under some fetch implementations (MSW 2.15 reproduces it) — discarding a body is now non-blocking. Override/suspend/CSV export re-proven live.
- Coverage maps to the old checklist as: organizations, products, plans (+compare), customers + contacts, licenses (all 15 methods), activations, machines (+decommission), subscriptions (full lifecycle), entitlements + override, addons + purchase, usage meters, usage adjustment/credit + reporter, orders (create/get/checkout/fulfill — Go's update/pay have no server route), payments (list/get/refund/reconcile), invoices (list/get/issue/void/pdf — Go's send has no server route), webhook endpoints/events, applications + API keys, offline certificates, referral programs/codes/events, affiliates/links/events/payouts, audit logs (+CSV), system, and the server-extension services (gateways, notifications, application notifications, releases).

### 2.3 Specialized Feature Tests

- [ ] `UsageReporter` HMAC signature generation tests with golden vectors shared across gosdk/rustsdk/tssdk
- [x] `UsageReporter` retry behaviour tests — never retried (mutation)
- [x] `WebhookVerifier` signature verification tests (known-good + known-bad vectors) — test/webhook.test.ts and a real server delivery in the live and runtime smokes
- [x] `WebhookVerifier` timestamp tolerance tests (within / outside skew window) — test/webhook.test.ts
- [x] `WebhookVerifier` edge cases (missing headers, expired, tampered body, length-mismatched signatures, case-insensitive header lookup) — test/webhook.test.ts
- [x] `OfflineVerifier` Ed25519 verification tests with keypair fixtures — `test/offline-verifier.test.ts` (valid, tampered, wrong-key)
- [x] `OfflineVerifier` expiry + grace-period tests — same file, grace-window and past-expiry cases
- [x] `OfflineVerifier` machine fingerprint matching tests — same file
- [x] Async iterator pagination tests (empty, single page, multi-page, error on later page) — test/transport.test.ts
- [x] `collectAll` cap tests — test/transport.test.ts

### 2.4 Integration Tests

- [x] Docker Compose live smoke: isolated Commerce/Postgres/Redis on loopback port 19094; organization, product, customer, application, API key, authenticated list, license validation, signed usage ingestion, contacts, and pagination. Run with `npm run test:integration`.
- [x] Fixture helpers — spin up an MSW handler set and return a pre-configured `Client` — MSW harness in test/contract.test.ts
- [x] End-to-end license lifecycle (create → validate → activate → deactivate) against the Compose server
- [x] End-to-end subscription lifecycle — live smoke
- [x] End-to-end usage reporting (signing → ingestion) against the Compose server
- [x] End-to-end webhook delivery: endpoint create → server-queued async delivery → loopback HTTP receiver → `WebhookVerifier` signature verification against the server's real HMAC → tamper rejection → event list/get, against the Compose server
- [x] End-to-end offline certificate issue → online verify (valid machine) → online verify (fingerprint mismatch) → **local `OfflineVerifier` verify against the real server signing key (valid) and against a wrong signature (rejected)**, against the Compose server with the offline signing fix applied.
- [x] End-to-end commission plan create → affiliate create → affiliate reject (regression test for the empty-body action fix), against the Compose server.

### 2.5 Runtime Compatibility Tests

- [x] `npm run test:runtimes` (`integration/runtime-smoke.mjs`) bootstraps a tenant on the live Compose server, then runs the same runtime-neutral module (`integration/runtime/checks.mjs`: web-standard globals plus the built package only) in every available runtime: health over fetch, public license validation, API-key list + `listAll` pagination, **the server's real Ed25519 offline-certificate signature verified with Web Crypto**, **a real server webhook delivery's HMAC verified with Web Crypto** (plus tamper rejection), a usage report HMAC-signed in that runtime and accepted by the server, and caller-`AbortSignal` cancellation. Missing runtimes report SKIP; failures fail the run.
- [x] Proven in session 3: Node 24.22, **Node 20.20** (`node:20-alpine`, sharing the app container's network), Bun 1.1.26, Deno 2.1.4 (with `--allow-net` for the server only and `--allow-env=RUNTIME_CONFIG` — no other permissions), Chrome 155 headless (a real cross-origin page → server), and workerd 1.20260730 via Miniflare 4.20260730 (`MINIFLARE_DIR` pointing at a directory with miniflare installed; not a project dependency). 7/7 checks in all six.
- [x] Found and fixed: **the SDK was unusable in every browser** — the transport called `fetch` as a method of the transport object, which browsers reject with "Illegal invocation" (Node/Bun/Deno/workerd tolerate it). fetch is now always called unbound; regression unit test added.
- Browser limitation (server-side): usage reporting cannot work from a browser because server CORS does not allow the `X-Usage-*` signature headers; the browser check asserts that the preflight fails. Usage reporting needs the API key anyway and belongs on a backend.

---

## Phase 3: Enhancements

### 3.1 Observability

- [ ] Pluggable logger interface (`{ debug, info, warn, error }`) — defaults to no-op
- [ ] Request/response debug events gated behind a `debug: true` option
- [x] Request timing metrics exposed via `onResponse` callback — `ResponseHookEvent` has `durationMs` and one-based `attempt`; retries so far are `attempt - 1` (`src/transport.ts`, `test/hooks-observability.test.ts`)
- [x] Retry attempt events — `onRetry` reports reason, delay, attempt, and duration before backoff (`src/transport.ts`, hook tests)
- [ ] OpenTelemetry integration via a thin adapter in a separate `@niyantra/commerce-otel` package so the core stays dependency-free

### 3.2 Advanced Client Features

- [ ] Middleware chain — `client.use((req, next) => next(req))` for request/response interception
- [ ] Custom header injection per-request via the method options bag
- [~] Proxy support through fetch injection — `ClientOptions.fetch` accepts a caller-wrapped implementation; a concrete proxy example remains to be documented
- [x] Configurable keep-alive via the injectable `fetch` — transport calls injected fetch unbound; the caller controls its agent/dispatcher, with no runtime dependency
- [~] Configurable `maxRetries`, `backoffMultiplier`, and jitter strategy — `maxRetries` is configured and tested; multiplier and jitter strategy are internal only
- [ ] Idempotency-Key auto-generation only if the server is verified to honor that header for the specific operation; otherwise do not present it as retry safety
- [x] Request ID propagation (`X-Request-ID` in + out, exposed on errors as `error.requestId`) — per-call option is sent by transport, response ID reaches `CommerceApiError` and hooks (`test/edge-transport.test.ts`, `test/hooks-observability.test.ts`)

### 3.3 Developer Experience

- [ ] TSDoc examples for all major types and methods
- [x] Typed webhook event handling — `TypedWebhookEvent` / `isKnownWebhookEvent` narrow confirmed event payloads and preserve unknown future types (`src/webhook-events.ts`, `test/webhook-events.test.ts`, live smoke)
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

- [x] GitHub Actions workflow: install, typecheck, lint, test, build on the published supported Node versions — .github/workflows/ci.yml: Node 20/22/24 gate (build, typecheck, lint, fmt, test, docs, package smoke, audit, tarball contents); actions pinned to verified SHAs; **not yet run on GitHub**
- [x] Bun + Deno jobs for runtime compatibility — in the opt-in live job (`RUN_LIVE_CONTRACT`, `COMMERCE_REPO_TOKEN`), not yet run
- [ ] Test coverage reporting via `@vitest/coverage-v8` → codecov — V8 coverage and aggregate thresholds run on the Node 24 CI leg (92% statements, 87% branches at merge); Codecov upload remains open.
- [x] `npm audit --production` on every PR — `npm audit --omit=dev` in CI
- [ ] `socket.dev` or `snyk` dependency vulnerability scanning
- [ ] Cross-platform matrix: ubuntu, macos, windows

### 4.2 Release Management

> Manual-only release dry-run workflow (`.github/workflows/release.yml`), 0.x semver policy (`doc/release.md`), and a hand-maintained Keep a Changelog file (`CHANGELOG.md`) are in place; `private: true` still blocks a real publish.

- [ ] Semantic versioning with `changesets` (`.changeset/` directory + CI check)
- [ ] `CHANGELOG.md` auto-generated from changesets
- [ ] `npm publish` automation on tagged releases (with `NPM_TOKEN` secret)
- [ ] Provenance publishing (`npm publish --provenance`) for supply-chain trust
- [ ] Publish `@niyantra/commerce` to npm, verify the published tarball contains only `dist/`, `README.md`, `LICENSE`, `package.json`
- [~] Verify `types` / `exports` resolution via `@arethetypeswrong/cli` — `attw` 0.18.5 reports green node10, node16 ESM, and bundler paths; its expected Node 16 CommonJS → ESM warning exits nonzero (ESM-only package, Node >=20)

### 4.3 Quality Gates

- [x] Minimum 80% test coverage — `npm run coverage` measured 92.1% statements, 86.74% branches, 98.39% functions, 93.88% lines; configured aggregate thresholds are 90/84/96/91
- [ ] Zero ESLint warnings with `--max-warnings 0`
- [x] `tsc --noEmit` clean on the root tsconfig — `npm run typecheck` passed (root and test tsconfigs)
- [x] `publint` clean to catch common packaging mistakes — `publint` 0.3.25 reported “All good!” on the built package
- [~] `@arethetypeswrong/cli` clean (ESM + CJS + types dual-module resolution) — supported ESM paths green; expected Node 16 CommonJS warning remains and makes the tool exit nonzero
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

- [x] Inventory each server route in `commerce/internal/domain/*/handler.go` and `commerce/internal/server/server.go`: method, path, auth/scope, query and body, success status/envelope, error envelope, pagination, and Go counterpart. Include routes registered with both `mux.Handle` and `mux.HandleFunc`. (Partial: webhook, usage, offline, license, api-key, affiliate, referral, and signing-key routes were read and reconciled this session; the full inventory table is not yet written down.) — test/fixtures/routes.json, generated from the handlers (210 routes: verb, path, envelope, body requirement, public flag)
- [x] **Usage signing blocker — resolved in the TS SDK.** Verified by reading `commerce/internal/domain/usage/hmac.go` line-by-line against `src/usage-reporter.ts`: canonical string is `timestamp + "\n" + uppercaseMethod + "\n" + path + "\n" + hex(SHA256(rawBody))`, timestamp is RFC3339 (Go's `time.Parse(time.RFC3339, ...)` tolerates the fractional seconds `Date.prototype.toISOString()` produces), HMAC key is the raw `X-API-Key` value, path is the full `/api/v1/usage/reports`, body limit is 2 MiB (`io.LimitReader(r.Body, 2<<20)`), and batch size is 1–100 (`len(input.Reports) > 100` → 400). The TS implementation already matches exactly; confirmed again end-to-end against the live Compose server (not just unit vectors). The Go SDK's incompatible `apiKey|unixSeconds|POST|path|rawBody` scheme is a separate, unresolved Go-side bug — not applicable to this SDK.
- [x] **Webhook verification blocker — resolved in the TS SDK.** Verified by reading `commerce/internal/domain/webhook/util.go` (`signPayload`) and `repository.go` (`buildHeaders`) against `src/webhook-verifier.ts`: headers are `X-Niyantra-Timestamp` (Unix seconds), `X-Niyantra-Signature` (hex HMAC-SHA256), `X-Niyantra-Signature-Version: v1`; signed string is `unixSeconds + "." + hex(SHA256(rawBody))`. The TS implementation already matches exactly, and this session added a live end-to-end test that creates a real webhook endpoint, receives a real server-triggered delivery over HTTP, and verifies the real signature with `WebhookVerifier` — plus a tamper-rejection check. The Go SDK's incompatible `X-Webhook-*` / `timestamp.rawBody` scheme is a separate, unresolved Go-side bug — not applicable to this SDK.
- [x] **Offline verification blocker — server defect found, fixed, and a local verifier now implemented.** Original investigation read `commerce/internal/domain/offline/repository.go` (`Issue`, `Verify`) and `commerce/internal/crypto/signer.go` line-by-line and found:
  - The certificate distributed to clients (`Certificate.certificate`, a base64 JSON `OfflinePayload` with `certificate_id, license_id, license_key, machine_id, fingerprint, product_id, customer_id, issued_at, expires_at, grace_expires_at, features`) was **not** the data that got Ed25519-signed. `Issue()` instead signed a separate, narrower `crypto.LicensePayload` (`license_id, license_key, product_id, customer_id, issued_at` only — no `machine_id`, `fingerprint`, `expires_at`, `grace_expires_at`, or `certificate_id`) via `r.signer.Sign(...)`, and returned that unrelated signature alongside the certificate. That signature could not authenticate machine binding or expiry even if checked.
  - The server's own online `POST /offline-certificates/verify` handler (`Repository.Verify`) never used `VerifyInput.Signature` at all — it was decoded from the request body and silently ignored.
  - **Fixed in `commerce`** (uncommitted — see the implementation-status note at the top of this file): added `crypto.Signer.SignRaw`/`VerifyRaw` for signing/verifying raw bytes without the `LicensePayload` envelope; `offline.Repository.Issue` now signs the certificate's exact final bytes (including `certificate_id`) and persists a matching `certificate_hash`; `offline.Repository.Verify` now optionally checks `VerifyInput.Signature` against those bytes when present (`invalid_signature` error code on mismatch), staying backward compatible for callers that omit it. `go test ./...` passes in `commerce`; `docs/offline.md` documents the fix and the lack of a migration path for certificates issued before it.
  - **Implemented `OfflineVerifier`** (`src/offline-verifier.ts`, exported from the package root): imports the server's raw Ed25519 public key via Web Crypto `importKey('raw', ...)`, verifies the certificate bytes against the signature, decodes the JSON payload only after a successful signature check, then checks fingerprint/expiry/grace. Confirmed end-to-end against the live Compose server (real signing key, real issued certificate) in `integration/live-smoke.mjs`, plus 5 unit tests with real generated keypairs covering valid, tampered, wrong-key, fingerprint-mismatch, and grace/expiry cases. Deliberately does not check revocation (no network access) — document that gap wherever this is surfaced to consumers.
- [x] Reconcile absent routes: Go `orders.update` (`PATCH /orders/{id}`), `orders.pay` (`POST /orders/{id}/pay`), `invoices.send` (`POST /invoices/{id}/send`), and `webhookEndpoints.delete` have no matching current server route. Decide on upstream server changes or accurately named SDK alternatives; never ship calls that predictably return 404/405. — decided: not exposed; documented in the README with the server alternatives
- [x] Reconcile response drift: server `GET /api/v1/signing-key` returns `{algorithm, public_key}` directly — **verified already correct** in `SystemService.signingKey()` (no `data` wrapper requested). License revoke/suspend/reactivate return `{status}` directly and reissue returns `{data: License}` — **verified already correct** in `LicenseService`. Offline issue returns `{data:{certificate,signature}}` — **verified already correct** in `OfflineCertificateService.issue()`. API-key create/rotate return the flattened `APIKey & {secret_key}` (Go embeds `APIKey` anonymously) — **verified already correct**. Usage ingestion returns `{results: [...]}` directly (no `data` wrapper) — **verified already correct** in `UsageReporter`. — all domains reconciled against the server structs (session 3)
      Found and fixed across two sessions: `WebhookEndpointCreateParams` (missing required `org_id`), `CommissionPlanCreateParams`/`AffiliateCreateParams`/`ReferralProgramCreateParams`/`CommissionPayoutCreateParams` (same missing required `org_id`), `WebhookEndpointListParams` (missing the `org_id` filter), `Affiliate`/`AffiliateCreateParams`/`AffiliateUpdateParams` (`payout_threshold` → `payout_threshold_cents`), `WebhookEventService.get()` (was typed as flat `WebhookEvent`, server actually returns `{data:{event, endpoint_url, endpoint?}}` — now `WebhookEventDetail`), `SubscriptionService.pause/resume/cancel` (typed as `SubscriptionMutationResult`, server returns flat `Subscription`), `SubscriptionCreateParams`/`UpdateParams` (missing `grace_days`/`bundle_product_ids`/`proration_behavior`), `AffiliateEventCreateParams.link_id` (wrongly required; server has it optional). Order (`CreateResult`, `Detail`, `FulfillInput`) and invoice (`Detail`, issue/void status shapes) were audited and already matched exactly — no changes needed.
      **Also found and fixed a distinct bug class**: nine action methods (`AffiliateService.approve/reject`, `AffiliateEventService.review`, `CommissionPayoutService.approve/pay/fail/reverse`, `ReferralEventService.qualify/reward/reject`) sent no body at all, but their server handlers require one and 400 on empty — added the missing param types and threaded them through (see the implementation-status note at the top of this file for detail).
      Plan compare, affiliate/referral models and list filters, and subscription create were reconciled and live-proven in session 3 (see the top note). Not yet audited: the remaining domains' list-filter completeness, releases, gateway configs, notifications.
- [x] Verify what `X-Org-ID` means for API-key/JWT auth. It is also a trusted-proxy identity header; do not imply an API caller can select arbitrary tenant scope. Confirm CORS and permission behavior with server tests. — see §1.3 org scoping; tenant isolation proven live

### B. Public API, models, and packaging — P0

- [x] Separate server response, create input, PATCH input, list filter, detail response, action result, and one-time secret types. Never type every mutation as returning the resource. Include status-only responses, `{data,total}`, `{data,count}`, direct JSON, binary responses, and partial ingestion results.
- [x] Map all Go model fields against server JSON tags, marking required, optional, and nullable precisely. Use `unknown` rather than `any` for unverified metadata/event payloads. Add extensible string unions for server enums and type-level tests for representative calls. — all domains generated from the server structs with zero drift; 131 enum fields use unions from the CHECK constraints (exact for inputs, open `| (string & {})` for responses) with type-level tests (session 3)
- [x] Preserve `undefined` as omitted and `null` as explicit clear only where PATCH permits it. Preserve `false`, `0`, empty arrays, and valid empty strings. Reject `NaN`, infinities, cyclic data, invalid dates, and unsupported `BigInt` before network I/O. — doc/wire-semantics.md, edge tests
- [x] Use ISO-8601 string dates at the JSON boundary and document `Date` input conversion. For Go `int64` cents, usage totals, and counters, validate outbound safe integers and choose a lossless inbound policy (parser/string mode or an explicit error) so large JSON integers are not silently rounded. — doc/wire-semantics.md
- [~] Distinguish API-key create/rotate and webhook endpoint create results, which contain secrets shown once, from ordinary list/get models. Avoid secrets in inspect/debug output, errors, and docs. `readonly` response types do not imply runtime immutability. — one-time secret result types exist; credentials are redacted from error messages and causes; no inspect/debug hooks exist yet
- [x] Choose the module layout and supported runtime versions from smoke tests. If publishing dual ESM/CJS, emit correct separate declarations and verify both module modes; if not needed, prefer ESM. Check `exports`, `types`, tree shaking, source maps, `sideEffects`, and `npm pack` with `publint` and Are the Types Wrong. — ESM-only with a `default` condition; `npm run test:package`, publint, attw
- [x] Keep browser/edge entry points free of Node built-ins. Use injectable `fetch`, Web Crypto, and only tested optional Node adapters. Browser code cannot set `User-Agent`; a runtime header policy must respect forbidden headers. Keep privileged API keys and gateway credentials out of browser bundles and examples. — proven by the runtime matrix
- [x] Validate base URL: preserve an intended base path, reject credentials/query/fragment and unsupported schemes, require HTTPS except explicit local HTTP, and avoid accidental double `/api/v1`. Encode every dynamic path segment; IDs must not inject `/`, `?`, or fragments. — credentials, query, fragment, scheme, HTTPS, and doubled /api/v1 rejected; base path preserved (test)
- [x] Define explicit API-key versus bearer authentication. Reject missing or conflicting credentials except for confirmed unauthenticated endpoints. If supporting expiring bearer credentials, provide a per-request token supplier. Never send credentials in URL/query parameters.
- [x] Make per-call `signal`, request ID, and verified org context consistent. Prevent custom header overrides of auth, host, content type, and signatures. Prefer immutable per-call scoping; if retaining `setOrgId`, specify snapshot behavior for concurrent requests. — no setOrgId; protected headers cannot be overridden

### C. Transport, errors, retries, and pagination — P0

- [~] Use one request pipeline for JSON, status/no-body, raw/binary, and signed requests. Handle 200/201/202/204, empty success, malformed or missing `data`, unexpected content type, non-JSON error pages, redirects, truncation, and size-limited error bodies. Never return `undefined` as a typed resource after a malformed 200 response. — edge tests cover malformed data/list envelopes, redirects (now CommerceProtocolError), unexpected content types (strict application/json or +json), and bounded error bodies; empty-success/202/204 cases not all verified
- [~] Define typed errors for API/HTTP (status, code, message, details if present, request ID, sanitized response), network, caller abort, timeout, decode/protocol, and crypto; retain `cause`. Preserve the final 429/5xx response when retries are exhausted. Do not log raw sensitive responses. — request IDs on CommerceApiError and credential redaction in messages and causes are tested; final-response preservation after exhausted retries not verified
- [x] Encode only query parameters each handler supports. Retain `0`/`false`, reject invalid pagination, preserve domain filters, and follow server array encoding (for example plan comparison). No global `sort` unless the endpoint implements it. — list types match each handler (session 3)
- [~] Retry 429/502/503/504 and transient network failures by default only for safe methods, with bounded exponential backoff/full jitter, `Retry-After` seconds or HTTP-date, total deadline, and cancellation during limiter wait/backoff/fetch. Make other 5xx retry opt-in. Do not blindly retry POST/PATCH/DELETE actions such as issuance, subscription renewal, payment/refund, or usage reporting. Retry a mutation only after verifying server idempotency and reusing exact key/body/timestamp. Do not auto-generate `Idempotency-Key` until the server honors it for that route. — safe-method-only retries, Retry-After seconds/HTTP-date, single deadline and cancellation are edge-tested
- [ ] If implementing a local rate limiter, make it optional, bounded, fair, and cancellable; define per-client versus server behavior and avoid duplicate waits across attempts. Inject clock/sleep for deterministic tests.
- [x] Capture/request `X-Request-ID` where supported; expose it on errors. Current CORS does not expose this response header. Redact API keys, bearer tokens, signatures, webhook secrets, license keys, customer PII, and signed bodies from debug hooks, traces, and error messages. Hooks must not alter signed bytes after signing. — exposed on errors and credential redaction tested; server CORS still does not expose the header to browsers — server now exposes X-Request-ID, Retry-After, Content-Disposition, X-Checksum-SHA256 via CORS (commerce `30b0eed`); request IDs proven on errors in all six runtimes including Chrome
- [x] Implement lazy sequential async pagination using the actual offset/limit/total contract, retaining caller filters and cancellation. Stop on empty/repeated pages and guard against changing totals/infinite loops. Surface errors on later pages. Define early-break behavior and provide capped `collectAll` with explicit unbounded opt-in.

### D. Complete Go parity — P1

For **every** listed method: verify exact verb/path, filter map, request and return shape, error/status behavior, auth, path encoding, per-call options, and contract test.

- [x] Organizations, products: list/create/get/update/delete. Plans: list/create/get/update/delete/compare. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Customers: list/create/get/update/delete. Contacts: listContacts/addContact/deleteContact, preserving customer ID scoping. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Licenses: list/create/bulkCreate/get/revoke/suspend/reactivate/reissue/features/validate/listAddons/purchaseAddon/getUsage/upsertEntitlementOverride. Enforce server bulk limit and represent `{valid:false}` as a domain validation result where returned with HTTP 200. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Activations: activate/deactivateByKey/list/get/deactivate. Machines: list/create/get/update/delete/decommission; document decommission side effects. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Subscriptions: list/create/get detail/update/renew/pause/resume/cancel/changePlan/updateSeats; type proration and mutation results accurately. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Entitlements and addons: list/create/get/update/delete. Usage meters: list/create/get/update/delete. Usage: createAdjustment/grantCredits and signed report/reportSingle with per-report ingestion result. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Orders: list/create/get plus server checkout/fulfill in place of unresolved Go update/pay. Payments: list/refund/reconcile. Invoices: list/get plus server issue/void/pdf in place of unresolved Go send. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Webhook endpoints: list/create/get/update plus server test, with Go delete unresolved. Webhook events: list/get/retry. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Applications: list/create/get/update/delete. API keys: list/create/get/rotate/revoke/delete with one-time secret handling. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Offline certificates: issue/onlineVerify/list/get/approve/revoke/reissue with corrected request/result shapes; local verification is gated above. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Referral programs: list/create/get/update/delete; codes: list/create/get/disable; events: list/create/get/qualify/reward/reject. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Commission plans: list/create/get/update/delete; affiliates: list/create/get/update/delete/approve/reject/suspend/terminate; links: list/create/get/update/disable; events: list/create/get/review; payouts: list/create/get/approve/pay/fail/reverse. — every method contract-tested against the route manifest and exercised by the live smoke
- [x] Audit logs: list. System: unwrapped signing key and unprefixed unauthenticated `/health`. — every method contract-tested against the route manifest and exercised by the live smoke

### E. Current server routes absent from Go SDK — P1 coverage extension

- [x] Maintain a one-row-per-registered-route coverage table with disposition: typed method, specialized helper, intentional internal/provider callback, or server blocker. Include server-only payment `get`, audit `get`/CSV `export`, webhook endpoint `test`, order `checkout`/`fulfill`, and invoice `issue`/`void`/binary `pdf`. — route manifest + generated README endpoint reference
- [x] Releases: list/create/get/update/delete, publish/yank, artifact list/upload, checksum, download authorization, token download — multipart upload, streaming download (content disposition and `X-Checksum-SHA256` surfaced, abortable mid-stream, never buffered), all proven live with a SHA-256 check of the downloaded bytes. Uploads stream up to the server's `RELEASE_MAX_ARTIFACT_BYTES` (12 MiB upload and 413 above the test stack's 16 MiB limit proven live).
- [x] Gateway configurations/providers: list/create/get/update/delete, setDefault/test, provider list/schema — proven live (the `test` call uses empty credentials so it fails locally without contacting the provider). Credentials are documented as backend-only and never returned.
- [x] Payment methods and checkout options: list/create/get/delete/setDefault and checkout-options retrieval; model token/reference fields without collecting raw card data in the SDK. — `client.paymentMethods` incl. `checkoutOptions`, proven live (session 3)
- [x] Notifications/templates: list/create/get/update, queue/get/list/retry. Application notifications: list/create/get/update, plus the public license-key `feed`/`ack`. All proven live. The SES webhook (`POST /notifications/webhooks/ses`) is a provider callback and intentionally not exposed.
- [x] Add a route-drift check from a generated route manifest or OpenAPI source once the server provides one. Keep this server extension separate from claims of Go parity. — `npm run contract:check` against the Commerce source

### F. Security, crypto, compatibility, and release proof — P0

- [x] Usage reporter: serialize once, hash/sign/send identical UTF-8 bytes, use RFC3339 timestamp and hex digests, validate 1–100 reports, required per-report idempotency keys, period ordering, safe integer quantities, and 2 MiB limit. Preserve signed bytes on any permitted retry. — src/usage-reporter.ts enforces 1–100 reports, idempotency keys, period ordering, and 2 MiB; signed bytes sent unchanged and never retried
- [~] Webhook verifier: accept case-insensitive `Headers` or record plus **raw** body bytes, require `v1`, strictly parse Unix-second timestamp and hex signature, enforce configurable past/future skew, compare fixed-length signature bytes in constant time, then parse typed envelope. Support secret rotation without silent downgrade; provide replay guidance using delivery/event ID plus durable deduplication. — all checks implemented with configurable skew; ordered multi-secret rotation is implemented; current and previous secrets are each checked, and `v1` remains required; typed payloads via `isKnownWebhookEvent`
- [x] Offline verification, when server contract is fixed: import the server's standard-base64 **raw 32-byte Ed25519 public key** as a Web Crypto `raw` key, verify exact signed bytes, then check expiry/grace/fingerprint/approval and key rotation. Document that purely offline checks cannot know current DB revocation. Never treat an unsigned decoded payload as verified. — `OfflineVerifier`, proven in six runtimes
- [~] Test every parity route with request/response fixtures from current handlers: direct versus wrapped JSON, null fields, status-only actions, 204, binary, 4xx/5xx, non-JSON, request IDs, and `Retry-After`. Generate crypto golden vectors from server code and run integration tests against a real server/test harness for license, subscription, usage, webhook, order, invoice, and offline workflows; mocks alone cannot prove compatibility. **Done for:** license lifecycle, usage signing+ingestion, webhook delivery+signature verification (including tamper rejection), offline certificate issue + online verify (valid and fingerprint-mismatch) + **local `OfflineVerifier` verify (valid and wrong-signature)**, commission plan + affiliate create/reject, all against the live Compose server. Session 3 added plan compare, the subscription lifecycle, affiliate approve/links/events/review, payout approve/pay/fail/reverse, referral program/code/event qualify/reward/reject, and cross-tenant isolation. **Still mocked-only or missing:** order/invoice/payment flows, releases, gateway configs, notifications.
- [~] Test unsafe retries (write not repeated), safe idempotent retries, abort before/during fetch/backoff/rate wait, timeout, malformed URL/ID, credential collision, unsafe integers, huge error bodies, missing `data`, signature tampering, webhook replay, clock skew, and secrets redaction. — test/edge-transport.test.ts covers unsafe retries, aborts, timeouts, malformed IDs, credential collisions, unsafe integers, huge error bodies, missing `data`; signature tampering/replay/clock skew are covered by webhook tests
- [~] Runtime smoke done for Node 20/24, Bun, Deno, Chrome, and workerd (fetch, abort, Ed25519 + HMAC Web Crypto, live server calls; see §2.5). Packaging proven in session 3 by `npm run test:package` (installs the packed tarball into a fresh project on Node 24 and Node 20.20: ESM import, CommonJS `require` via Node's require(esm) after adding a `default` export condition, and strict TypeScript consumers under `nodenext` and `bundler`); publint 0.3.25 "All good"; Are-the-Types-Wrong 0.18.5 green for node10/node16-ESM/bundler with the expected ESM-only warning for CJS (which does not model require(esm); CommonJS consumers need Node ≥20.19 or ≥22.12). Still open: Firefox, Safari, Vercel Edge. Current server CORS allows `Content-Type`, `Authorization`, `X-Request-ID`, `X-API-Key` but omits `X-Org-ID` and `X-Usage-*`, and does not expose response `X-Request-ID`; document and/or fix server-side requirements before claiming browser support for those features.
- [~] Document each namespace's actual server semantics, auth/scope, response shape, errors, retry behavior, pagination, date/integer policy, unsupported Go methods, and server compatibility. Use backend-only API-key examples and short-lived browser bearer examples only where supported. State offline-verification status honestly. — README, generated endpoint reference, TSDoc on every service method, doc/wire-semantics.md; per-field model docs open
- [~] CI gate: lint, strict typecheck, contract and integration tests, supported runtime smoke tests, build, `npm pack`, package/type resolution, dependency audit, and route/parity diff. Publish with semver and provenance only after P0 blockers close and tarball contents/exports are verified. — workflow exists with verified pinned actions; not yet run on GitHub; no publishing

### G. Optional enhancements — P2

- [x] Add opt-in observability with redacted metadata and attempt/duration metrics; default logger stays silent. Specify middleware ordering relative to signing/auth/retry/timeout before exposing interceptors. — frozen redacted metadata hooks run after serialization/auth and before fetch, with response and retry events; no request mutation or default logger.
- [x] Add type-safe webhook payload mapping only for server-confirmed events while permitting unknown future event types. Keep framework adapters, React hooks, CLI, and OpenTelemetry separate if demand warrants. — `TypedWebhookEvent` / `isKnownWebhookEvent` for the 15 server event types; unknown future types stay unnarrowed.
- [ ] Use schema code generation after the server publishes a trustworthy OpenAPI spec; generated types still need contract tests. Defer client-side proration, fingerprint generation, certificate caching, automatic idempotency keys, multi-region failover, gRPC, GraphQL, and streaming APIs until corresponding server semantics exist.
