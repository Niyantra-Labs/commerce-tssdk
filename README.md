# Niyantra Commerce TypeScript SDK

A dependency-free ESM TypeScript client for the Niyantra Commerce HTTP API: licensing, activations, offline certificates, subscriptions, usage metering, orders and invoices, webhooks, referrals and affiliates, payment gateways, notifications, and binary releases.

This package is under Phase 1 development and is **not published**. Every method is contract-tested against the Commerce route handlers and exercised against a live Commerce server (Commerce `30286a8`). See [spec/todo.md](spec/todo.md) for what remains before a release.

## Quick start

```ts
import { Client } from '@niyantra/commerce';

// Keep API keys on a trusted server, never in browser JavaScript.
const client = new Client({
  baseUrl: 'https://commerce.example.com',
  auth: { apiKey: process.env.COMMERCE_API_KEY! },
});

const page = await client.licenses.list({ limit: 25 });
for (const license of page.data) console.log(license.id, license.status);
```

`baseUrl` must be HTTPS, except `localhost`/`127.0.0.1`/`[::1]` for local development. Options: `auth` (exactly one of `{ apiKey }` or `{ bearerToken }`, where `bearerToken` may be a function returning a fresh token per request), `fetch` (inject undici, a test double, or an instrumented fetch), `timeoutMs`, `maxRetries`, and an optional client-side `rateLimit`. Every method takes a final options argument with `signal`, `requestId`, and `timeoutMs`.

More examples live in `examples/`: [quick start](examples/quickstart.ts), [pagination](examples/pagination.ts), [usage reporting](examples/usage-reporting.ts), [webhook handler](examples/webhook-handler.ts), [offline verification](examples/offline-verification.ts), [release download](examples/release-download.ts), and [browser use](examples/browser.ts).

## Authentication and tenancy

- **API keys** belong to an application, and every request they make is scoped to that application's organization. Resources of another organization answer `404`; an `org_id` naming another organization answers `403`; lists only ever contain the caller's rows. Keys of a suspended or deleted application stop working.
- **Bearer tokens** come from your identity provider (Zitadel, Auth0, or any OIDC issuer the server trusts). A token carrying an org claim is scoped like an API key. A token without one is a platform operator and needs the server's operator role (`AUTH_OPERATOR_ROLES`, default `commerce:admin`) for cross-organization access.
- **Public routes** — license validation, activation, offline verification, the signing key, download authorization and download, published checksums, and the application-notification feed — authenticate with the license key, signed token, or certificate in the request. They are marked in the [endpoint reference](#endpoint-reference).

API keys are also limited by their **scopes**: `<family>:read` for GET routes and `<family>:write` for everything else (write implies read), `usage:report` for signed usage ingestion, or `*`. Families follow the namespaces (`licenses`, `subscriptions`, `affiliates` covers commission plans, links, events and payouts, `referrals`, `releases`, `gateways`, `api_keys`, …; see `APIKeyCreateParams`). A request outside the key's scopes is `403 insufficient_scope`, and a key can only create keys with scopes it holds. Keys that existed before scopes were enforced were granted `*`.

## Errors, retries, and cancellation

Failures reject with a typed error: `CommerceApiError` (HTTP error with `status`, `code`, `requestId`, `details`), `CommerceNetworkError`, `CommerceTimeoutError`, `CommerceAbortError`, `CommerceProtocolError` (malformed or unsafe JSON, missing envelope), `CommerceValidationError` (rejected before any request), and `CommerceCryptoError`. Lifecycle actions the server refuses from the current state (for example paying an unapproved payout) are `CommerceApiError` with status `409` and code `invalid_transition`.

GET requests retry 429/502/503/504 and network failures with bounded jittered backoff, honouring `Retry-After`. Mutations are never retried automatically. A timeout or the caller's `AbortSignal` cancels the request, any backoff, and — for streamed downloads — the body while it is being read. `asResult(promise)` turns a call into a `{ ok, value | error }` result for code that prefers not to throw.

For exact JSON, PATCH, integer, response-envelope, and retry rules, see [Wire semantics](doc/wire-semantics.md).

## Pagination

`list()` returns one `{ data, total }` page. `listAll()` iterates lazily across pages with the same filters and fails if the server's totals become inconsistent; `collectAll(iterable, cap)` gathers results with an explicit upper bound. List filters are exactly the ones each server handler reads.

## Usage reporting

`client.usageReporter.report(reports)` and `reportSingle(report)` HMAC-sign the exact JSON body with the API key using the server's canonical string and send it once. Each report needs a stable `idempotency_key`; the server deduplicates on it. The key needs the `usage:report` scope, and the server must have a usage meter for the `feature_key`.

## Webhooks

```ts
import { WebhookVerifier } from '@niyantra/commerce';

const verifier = new WebhookVerifier(process.env.COMMERCE_WEBHOOK_SECRET!);
const event = await verifier.verify(request.headers, new Uint8Array(await request.arrayBuffer()));
```

Pass the raw body bytes before any JSON parsing. The verifier checks the `X-Niyantra-*` v1 HMAC signature in constant time and a five-minute timestamp window. Record delivery/event IDs durably to reject replays inside that window.

## Offline certificates

`client.offlineCertificates.issue()` returns a certificate and an Ed25519 signature over its exact bytes. Installed software can verify it without network access:

```ts
import { OfflineVerifier } from '@niyantra/commerce';

const verifier = new OfflineVerifier(serverPublicKey); // from client.system.signingKey()
const result = await verifier.verify(certificate, signature, machineFingerprint);
if (!result.valid) console.error(result.errorCode);
```

Local verification checks the signature, machine fingerprint, expiry, and grace period. It cannot know about revocation — use `client.offlineCertificates.verify()` when the machine is online. Certificates issued before Commerce's 2026-10-26 signing fix must be reissued to verify locally.

## Runtime support

The built package uses only `fetch`, `AbortController`, and Web Crypto — no Node built-ins and no runtime dependencies. `npm run test:runtimes` runs the same checks (live API calls, server-signed Ed25519 and HMAC verification, signed usage reports, cancellation) in each runtime:

| Runtime            | Verified version               | Notes                                          |
| ------------------ | ------------------------------ | ---------------------------------------------- |
| Node.js            | 20.20, 24.22                   | `engines: >=20`                                |
| Bun                | 1.1.26                         |                                                |
| Deno               | 2.1.4                          | needs only `--allow-net` for the Commerce host |
| Cloudflare Workers | workerd 1.20260730 (Miniflare) |                                                |
| Browsers           | Chrome 155                     | cross-origin; see below                        |

In browsers, use a short-lived bearer token, never an API key. Usage reporting cannot run in a browser because the server's CORS policy does not allow the `X-Usage-*` signature headers, and the server does not expose `X-Request-ID` to browser JavaScript. The package is ESM-only; CommonJS code can `require()` it on Node 20.19+ or 22.12+ (Node's require(esm)). Firefox, Safari, and Vercel Edge have not been tested yet.

## Testing

| Command                    | What it proves                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                 | Unit tests plus the MSW contract suite: every method against a manifest generated from the server's Go handlers (route, query, required body, response envelope) |
| `npm run contract:check`   | The route manifest still matches the Commerce source (`COMMERCE_REPO`, default `../commerce`)                                                                    |
| `npm run test:integration` | The SDK against a live Commerce server, including cross-tenant isolation                                                                                         |
| `npm run test:runtimes`    | The runtime matrix above against the live server                                                                                                                 |
| `npm run test:package`     | The packed tarball installed into a fresh project: contents, ESM import, CommonJS `require`, and strict TypeScript consumers (`nodenext` and `bundler`)          |

Start the live server with `docker compose -f integration/compose.yml up -d --build` from this repository (it builds the adjacent `commerce` checkout and binds only `127.0.0.1:19094`); stop it with `docker compose -f integration/compose.yml down`. The [developer guide](doc/developer-guide.md) covers the test layers and the request pipeline.

## Endpoint reference

<!-- endpoints:start -->
<!-- prettier-ignore-start -->

Generated from the contract suite (210 methods). "Public" routes take the license key, signed token, or certificate as the credential; every other route needs an API key (scoped to its organization) or an operator token.

<details><summary><code>client.organizations</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/organizations` | page `{ data, total }` |  |
| `create` | `POST /api/v1/organizations` | object |  |
| `get` | `GET /api/v1/organizations/{id}` | object |  |
| `update` | `PATCH /api/v1/organizations/{id}` | object |  |
| `delete` | `DELETE /api/v1/organizations/{id}` | status |  |

</details>

<details><summary><code>client.products</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/products` | page `{ data, total }` |  |
| `create` | `POST /api/v1/products` | object |  |
| `get` | `GET /api/v1/products/{id}` | object |  |
| `update` | `PATCH /api/v1/products/{id}` | object |  |
| `delete` | `DELETE /api/v1/products/{id}` | status |  |

</details>

<details><summary><code>client.plans</code> (6)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/plans` | page `{ data, total }` |  |
| `create` | `POST /api/v1/plans` | object |  |
| `get` | `GET /api/v1/plans/{id}` | object |  |
| `update` | `PATCH /api/v1/plans/{id}` | object |  |
| `delete` | `DELETE /api/v1/plans/{id}` | status |  |
| `compare` | `GET /api/v1/plans/compare` | object |  |

</details>

<details><summary><code>client.customers</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/customers` | page `{ data, total }` |  |
| `create` | `POST /api/v1/customers` | object |  |
| `get` | `GET /api/v1/customers/{id}` | object |  |
| `update` | `PATCH /api/v1/customers/{id}` | object |  |
| `delete` | `DELETE /api/v1/customers/{id}` | status |  |

</details>

<details><summary><code>client.contacts</code> (3)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `listContacts` | `GET /api/v1/customers/{id}/contacts` | object |  |
| `addContact` | `POST /api/v1/customers/{id}/contacts` | object |  |
| `deleteContact` | `DELETE /api/v1/contacts/{id}` | status |  |

</details>

<details><summary><code>client.licenses</code> (14)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/licenses` | page `{ data, total }` |  |
| `create` | `POST /api/v1/licenses` | object |  |
| `bulkCreate` | `POST /api/v1/licenses/bulk` | JSON |  |
| `get` | `GET /api/v1/licenses/{id}` | object |  |
| `revoke` | `POST /api/v1/licenses/{id}/revoke` | status |  |
| `suspend` | `POST /api/v1/licenses/{id}/suspend` | status |  |
| `reactivate` | `POST /api/v1/licenses/{id}/reactivate` | status |  |
| `reissue` | `POST /api/v1/licenses/{id}/reissue` | object |  |
| `features` | `GET /api/v1/licenses/{id}/features` | object |  |
| `validate` | `POST /api/v1/licenses/validate` | object | yes |
| `listAddons` | `GET /api/v1/licenses/{id}/addons` | page `{ data, total }` |  |
| `purchaseAddon` | `POST /api/v1/licenses/{id}/addons/purchase` | object |  |
| `getUsage` | `GET /api/v1/licenses/{id}/usage` | page `{ data, total }` |  |
| `upsertEntitlementOverride` | `POST /api/v1/licenses/{id}/entitlement-overrides` | object |  |

</details>

<details><summary><code>client.activations</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `activate` | `POST /api/v1/activations` | object | yes |
| `deactivateByKey` | `POST /api/v1/activations/deactivate` | status | yes |
| `list` | `GET /api/v1/activations` | page `{ data, total }` |  |
| `get` | `GET /api/v1/activations/{id}` | object |  |
| `deactivate` | `POST /api/v1/activations/{id}/deactivate` | status |  |

</details>

<details><summary><code>client.machines</code> (6)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/machines` | page `{ data, total }` |  |
| `create` | `POST /api/v1/machines` | object |  |
| `get` | `GET /api/v1/machines/{id}` | object |  |
| `update` | `PATCH /api/v1/machines/{id}` | object |  |
| `delete` | `DELETE /api/v1/machines/{id}` | status |  |
| `decommission` | `POST /api/v1/machines/{id}/decommission` | status |  |

</details>

<details><summary><code>client.subscriptions</code> (10)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/subscriptions` | page `{ data, total }` |  |
| `create` | `POST /api/v1/subscriptions` | object |  |
| `get` | `GET /api/v1/subscriptions/{id}` | object |  |
| `update` | `PATCH /api/v1/subscriptions/{id}` | object |  |
| `renew` | `POST /api/v1/subscriptions/{id}/renew` | object |  |
| `pause` | `POST /api/v1/subscriptions/{id}/pause` | object |  |
| `resume` | `POST /api/v1/subscriptions/{id}/resume` | object |  |
| `cancel` | `POST /api/v1/subscriptions/{id}/cancel` | object |  |
| `changePlan` | `POST /api/v1/subscriptions/{id}/change-plan` | object |  |
| `updateSeats` | `POST /api/v1/subscriptions/{id}/seats` | object |  |

</details>

<details><summary><code>client.entitlements</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/entitlements` | page `{ data, total }` |  |
| `create` | `POST /api/v1/entitlements` | object |  |
| `get` | `GET /api/v1/entitlements/{id}` | object |  |
| `update` | `PATCH /api/v1/entitlements/{id}` | object |  |
| `delete` | `DELETE /api/v1/entitlements/{id}` | status |  |

</details>

<details><summary><code>client.addons</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/addons` | page `{ data, total }` |  |
| `create` | `POST /api/v1/addons` | object |  |
| `get` | `GET /api/v1/addons/{id}` | object |  |
| `update` | `PATCH /api/v1/addons/{id}` | object |  |
| `delete` | `DELETE /api/v1/addons/{id}` | status |  |

</details>

<details><summary><code>client.usageMeters</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/usage-meters` | page `{ data, total }` |  |
| `create` | `POST /api/v1/usage-meters` | object |  |
| `get` | `GET /api/v1/usage-meters/{id}` | object |  |
| `update` | `PATCH /api/v1/usage-meters/{id}` | object |  |
| `delete` | `DELETE /api/v1/usage-meters/{id}` | status |  |

</details>

<details><summary><code>client.usage</code> (2)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `createAdjustment` | `POST /api/v1/usage-adjustments` | object |  |
| `grantCredits` | `POST /api/v1/usage-credits` | object |  |

</details>

<details><summary><code>client.usageReporter</code> (2)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `report` | `POST /api/v1/usage/reports` | JSON |  |
| `reportSingle` | `POST /api/v1/usage/reports` | JSON |  |

</details>

<details><summary><code>client.orders</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/orders` | page `{ data, total }` |  |
| `create` | `POST /api/v1/orders` | object |  |
| `get` | `GET /api/v1/orders/{id}` | object |  |
| `checkout` | `POST /api/v1/orders/{id}/checkout` | object |  |
| `fulfill` | `POST /api/v1/orders/{id}/fulfill` | status |  |

</details>

<details><summary><code>client.payments</code> (4)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/payments` | page `{ data, total }` |  |
| `get` | `GET /api/v1/payments/{id}` | object |  |
| `refund` | `POST /api/v1/payments/{id}/refund` | object |  |
| `reconcile` | `POST /api/v1/payments/{id}/reconcile` | object |  |

</details>

<details><summary><code>client.invoices</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/invoices` | page `{ data, total }` |  |
| `get` | `GET /api/v1/invoices/{id}` | object |  |
| `issue` | `POST /api/v1/invoices/{id}/issue` | status |  |
| `void` | `POST /api/v1/invoices/{id}/void` | status |  |
| `pdf` | `GET /api/v1/invoices/{id}/pdf` | stream |  |

</details>

<details><summary><code>client.webhookEndpoints</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/webhook-endpoints` | page `{ data, total }` |  |
| `create` | `POST /api/v1/webhook-endpoints` | object |  |
| `get` | `GET /api/v1/webhook-endpoints/{id}` | object |  |
| `update` | `PATCH /api/v1/webhook-endpoints/{id}` | object |  |
| `test` | `POST /api/v1/webhook-endpoints/{id}/test` | object |  |

</details>

<details><summary><code>client.webhookEvents</code> (3)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/webhook-events` | page `{ data, total }` |  |
| `get` | `GET /api/v1/webhook-events/{id}` | object |  |
| `retry` | `POST /api/v1/webhook-events/{id}/retry` | object |  |

</details>

<details><summary><code>client.applications</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/applications` | page `{ data, total }` |  |
| `create` | `POST /api/v1/applications` | object |  |
| `get` | `GET /api/v1/applications/{id}` | object |  |
| `update` | `PATCH /api/v1/applications/{id}` | object |  |
| `delete` | `DELETE /api/v1/applications/{id}` | status |  |

</details>

<details><summary><code>client.apiKeys</code> (6)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/api-keys` | page `{ data, total }` |  |
| `create` | `POST /api/v1/api-keys` | object |  |
| `get` | `GET /api/v1/api-keys/{id}` | object |  |
| `rotate` | `POST /api/v1/api-keys/{id}/rotate` | object |  |
| `revoke` | `POST /api/v1/api-keys/{id}/revoke` | status |  |
| `delete` | `DELETE /api/v1/api-keys/{id}` | status |  |

</details>

<details><summary><code>client.offlineCertificates</code> (7)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `issue` | `POST /api/v1/offline-certificates` | object |  |
| `verify` | `POST /api/v1/offline-certificates/verify` | object | yes |
| `list` | `GET /api/v1/offline-certificates` | page `{ data, total }` |  |
| `get` | `GET /api/v1/offline-certificates/{id}` | object |  |
| `approve` | `POST /api/v1/offline-certificates/{id}/approve` | status |  |
| `revoke` | `POST /api/v1/offline-certificates/{id}/revoke` | status |  |
| `reissue` | `POST /api/v1/offline-certificates/{id}/reissue` | object |  |

</details>

<details><summary><code>client.referralPrograms</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/referral-programs` | page `{ data, total }` |  |
| `create` | `POST /api/v1/referral-programs` | object |  |
| `get` | `GET /api/v1/referral-programs/{id}` | object |  |
| `update` | `PATCH /api/v1/referral-programs/{id}` | object |  |
| `delete` | `DELETE /api/v1/referral-programs/{id}` | status |  |

</details>

<details><summary><code>client.referralCodes</code> (4)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/referral-codes` | page `{ data, total }` |  |
| `create` | `POST /api/v1/referral-codes` | object |  |
| `get` | `GET /api/v1/referral-codes/{id}` | object |  |
| `disable` | `POST /api/v1/referral-codes/{id}/disable` | status |  |

</details>

<details><summary><code>client.referralEvents</code> (6)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/referral-events` | page `{ data, total }` |  |
| `create` | `POST /api/v1/referral-events` | object |  |
| `get` | `GET /api/v1/referral-events/{id}` | object |  |
| `qualify` | `POST /api/v1/referral-events/{id}/qualify` | object |  |
| `reward` | `POST /api/v1/referral-events/{id}/reward` | object |  |
| `reject` | `POST /api/v1/referral-events/{id}/reject` | object |  |

</details>

<details><summary><code>client.commissionPlans</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/commission-plans` | page `{ data, total }` |  |
| `create` | `POST /api/v1/commission-plans` | object |  |
| `get` | `GET /api/v1/commission-plans/{id}` | object |  |
| `update` | `PATCH /api/v1/commission-plans/{id}` | object |  |
| `delete` | `DELETE /api/v1/commission-plans/{id}` | status |  |

</details>

<details><summary><code>client.affiliates</code> (9)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `create` | `POST /api/v1/affiliates` | object |  |
| `get` | `GET /api/v1/affiliates/{id}` | object |  |
| `update` | `PATCH /api/v1/affiliates/{id}` | object |  |
| `delete` | `DELETE /api/v1/affiliates/{id}` | status |  |
| `list` | `GET /api/v1/affiliates` | page `{ data, total }` |  |
| `approve` | `POST /api/v1/affiliates/{id}/approve` | object |  |
| `reject` | `POST /api/v1/affiliates/{id}/reject` | object |  |
| `suspend` | `POST /api/v1/affiliates/{id}/suspend` | object |  |
| `terminate` | `POST /api/v1/affiliates/{id}/terminate` | object |  |

</details>

<details><summary><code>client.affiliateLinks</code> (5)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/affiliate-links` | page `{ data, total }` |  |
| `create` | `POST /api/v1/affiliate-links` | object |  |
| `get` | `GET /api/v1/affiliate-links/{id}` | object |  |
| `update` | `PATCH /api/v1/affiliate-links/{id}` | object |  |
| `disable` | `POST /api/v1/affiliate-links/{id}/disable` | status |  |

</details>

<details><summary><code>client.affiliateEvents</code> (4)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/affiliate-events` | page `{ data, total }` |  |
| `create` | `POST /api/v1/affiliate-events` | object |  |
| `get` | `GET /api/v1/affiliate-events/{id}` | object |  |
| `review` | `POST /api/v1/affiliate-events/{id}/review` | object |  |

</details>

<details><summary><code>client.commissionPayouts</code> (7)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/commission-payouts` | page `{ data, total }` |  |
| `create` | `POST /api/v1/commission-payouts` | object |  |
| `get` | `GET /api/v1/commission-payouts/{id}` | object |  |
| `approve` | `POST /api/v1/commission-payouts/{id}/approve` | object |  |
| `pay` | `POST /api/v1/commission-payouts/{id}/pay` | object |  |
| `fail` | `POST /api/v1/commission-payouts/{id}/fail` | object |  |
| `reverse` | `POST /api/v1/commission-payouts/{id}/reverse` | object |  |

</details>

<details><summary><code>client.auditLogs</code> (3)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/audit-logs` | page `{ data, total }` |  |
| `get` | `GET /api/v1/audit-logs/{id}` | object |  |
| `exportCsv` | `GET /api/v1/audit-logs/export` | stream |  |

</details>

<details><summary><code>client.system</code> (2)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `signingKey` | `GET /api/v1/signing-key` | JSON | yes |
| `health` | `GET /health` | status | yes |

</details>

<details><summary><code>client.gatewayConfigs</code> (8)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/gateway-configs` | page `{ data, total }` |  |
| `create` | `POST /api/v1/gateway-configs` | object |  |
| `get` | `GET /api/v1/gateway-configs/{id}` | object |  |
| `update` | `PATCH /api/v1/gateway-configs/{id}` | object |  |
| `delete` | `DELETE /api/v1/gateway-configs/{id}` | status |  |
| `setDefault` | `POST /api/v1/gateway-configs/{id}/set-default` | object |  |
| `test` | `POST /api/v1/gateway-configs/{id}/test` | JSON |  |
| `listWebhookLogs` | `GET /api/v1/gateway-webhook-logs` | object |  |

</details>

<details><summary><code>client.gatewayProviders</code> (2)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/gateway-providers` | object |  |
| `schema` | `GET /api/v1/gateway-providers/{provider}/schema` | object |  |

</details>

<details><summary><code>client.releases</code> (12)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/releases` | page `{ data, total }` |  |
| `create` | `POST /api/v1/releases` | object |  |
| `get` | `GET /api/v1/releases/{id}` | object |  |
| `update` | `PATCH /api/v1/releases/{id}` | object |  |
| `delete` | `DELETE /api/v1/releases/{id}` | status |  |
| `publish` | `POST /api/v1/releases/{id}/publish` | object |  |
| `yank` | `POST /api/v1/releases/{id}/yank` | object |  |
| `listArtifacts` | `GET /api/v1/releases/{id}/artifacts` | page `{ data, total }` |  |
| `uploadArtifact` | `POST /api/v1/releases/{id}/artifacts` | object |  |
| `checksum` | `GET /api/v1/artifacts/{id}/checksum` | object | yes |
| `authorizeDownload` | `POST /api/v1/downloads/authorize` | object | yes |
| `download` | `GET /api/v1/downloads/{token}` | stream | yes |

</details>

<details><summary><code>client.notificationTemplates</code> (4)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/notification-templates` | page `{ data, total }` |  |
| `create` | `POST /api/v1/notification-templates` | object |  |
| `get` | `GET /api/v1/notification-templates/{id}` | object |  |
| `update` | `PATCH /api/v1/notification-templates/{id}` | object |  |

</details>

<details><summary><code>client.notifications</code> (4)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/notifications` | page `{ data, total }` |  |
| `get` | `GET /api/v1/notifications/{id}` | object |  |
| `queue` | `POST /api/v1/notifications` | object |  |
| `retry` | `POST /api/v1/notifications/{id}/retry` | object |  |

</details>

<details><summary><code>client.applicationNotifications</code> (6)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/application-notifications` | page `{ data, total }` |  |
| `create` | `POST /api/v1/application-notifications` | object |  |
| `get` | `GET /api/v1/application-notifications/{id}` | object |  |
| `update` | `PATCH /api/v1/application-notifications/{id}` | object |  |
| `feed` | `POST /api/v1/application-notifications/feed` | object | yes |
| `acknowledge` | `POST /api/v1/application-notifications/{id}/ack` | object | yes |

</details>

<details><summary><code>client.paymentMethods</code> (6)</summary>

| Method | Route | Response | Public |
| --- | --- | --- | --- |
| `list` | `GET /api/v1/payment-methods` | page `{ data, total }` |  |
| `create` | `POST /api/v1/payment-methods` | object |  |
| `get` | `GET /api/v1/payment-methods/{id}` | object |  |
| `setDefault` | `POST /api/v1/payment-methods/{id}/set-default` | status |  |
| `delete` | `DELETE /api/v1/payment-methods/{id}` | status |  |
| `checkoutOptions` | `GET /api/v1/checkout-options` | object |  |

</details>

<!-- prettier-ignore-end -->
<!-- endpoints:end -->

## Known server limitations

These are Commerce-side behaviors the SDK documents rather than works around:

- Download tokens are deliberately reusable until they expire (`RELEASE_DOWNLOAD_URL_TTL_SECONDS`, default 15 minutes) so interrupted downloads and download managers can retry; treat download URLs as short-lived secrets.
- The Go SDK's `orders.update`, `orders.pay`, `invoices.send`, and `webhookEndpoints.delete` target routes the server does not have and are deliberately absent; use `orders.checkout`/`fulfill` and `invoices.issue`/`void`/`pdf`.
