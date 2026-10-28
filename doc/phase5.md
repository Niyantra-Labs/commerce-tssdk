# Phase 5 advanced features

## Performance and paginated streams

`npm run benchmark:throughput` builds the SDK and sends 200 GET requests per concurrency level to a disposable loopback HTTP server. It measures SDK and local HTTP overhead, not Commerce throughput or a production service-level objective. One Node 24.22.0 run on 2026-10-28 measured:

| Concurrent requests | Requests/s | p50 ms | p95 ms |
| ------------------- | ---------- | ------ | ------ |
| 1                   | 2,832.85   | 0.30   | 0.71   |
| 4                   | 4,809.69   | 0.67   | 1.80   |
| 16                  | 5,716.42   | 2.24   | 5.75   |
| 32                  | 7,082.22   | 2.89   | 13.17  |

`npm run profile:bundles` builds minified browser bundles of individual surfaces. The same run measured 7,826 gzip bytes for `Client`, 1,032 for `WebhookVerifier`, 1,227 for `OfflineVerifier`, 746 for `UsageReporter`, 451 for `generateMachineFingerprint`, and 648 for `calculateProration`. These measurements vary by runtime, bundler, and source revision. `npm run test:bundle` is the enforced size and tree-shaking gate.

`client.products.streamAll({ limit: 25 })` returns a `ReadableStream` of items. It calls the existing `list()` page route as the consumer reads, applies stream backpressure between items, and aborts an active request when the reader is cancelled. The caller's `AbortSignal` also cancels it. A successful live Commerce product-list read was verified. Each page is still a whole JSON response; Commerce has no HTTP list-stream endpoint, so memory use remains proportional to one server page.

`createLicensesBatch` already bounds concurrent writes and preserves individual outcomes. The server's `POST /api/v1/licenses/bulk` creates licenses sequentially and can return an error after issuing some without returning their IDs. Automatically replacing individual requests with that endpoint would hide partial issuance and make safe recovery impossible. Keep individual writes until the server exposes an atomic or itemized bulk contract.

## Generated route fixtures

`packages/msw-mocks` is a private optional MSW companion. `npm run msw:generate` builds its route list from `test/fixtures/routes.json`; `npm run msw:check` detects drift. Callers supply an explicit `Response` fixture per route. The manifest has verbs, paths, envelopes, and status hints but no response schemas, so these handlers do not claim schema-valid payloads. The weekly CI drift job checks the Commerce route manifest and this generated route list when `COMMERCE_REPO_TOKEN` is configured.

The server has no published OpenAPI specification. Its own integration checklist still leaves a suitable API spec open. `scripts/generate-go-models.py` is a one-time bootstrap from Go SDK declarations, not a server-schema generator. OpenAPI-driven model generation and automatic model-field drift checks remain blocked until a trustworthy schema exists.

## Optional ecosystem companions

- `packages/react` is a private TanStack Query v5 companion with `useLicense`, `useSubscription`, and `useUsage`. Queries forward cancellation, stay disabled without an ID, and include an opaque per-client number in keys to avoid cross-client cache reuse. Browser clients should use short-lived bearer tokens; never embed API keys.
- `packages/frameworks` provides private Next.js App Router, Hono, and Express webhook adapters over `defineWebhookHandler`. Express requires `express.raw()` before the adapter; a parsed body is rejected. Signed-byte and type tests pass, but actual Next/Hono/Express runner integration is still needed before publication.
- `examples/cloudflare-worker.ts` shows a web-only webhook Worker factory; its browser-platform bundle and route behavior are tested. Durable webhook deduplication must be supplied by the application.

These packages and the Worker example are not in the core npm tarball. No ecosystem package was published. An admin SDK cannot grant operator access by itself: the server authorizes that through trusted bearer claims or proxy identity. A separate admin variant needs a distinct, documented server contract to add value safely.

The server has no gRPC/Connect, GraphQL, or SSE endpoint. Multi-region failover also lacks a server contract for region discovery, consistency, and safe mutation replay. The SDK does not synthesize those protocols or retry mutations across regions.
