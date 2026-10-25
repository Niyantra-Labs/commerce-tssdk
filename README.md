# Niyantra Commerce TypeScript SDK

An ESM TypeScript client for the Niyantra Commerce HTTP API. This package is under Phase 1 development and is **not published**. Its contracts were compared with Commerce `715ff7c` and Go SDK `fe24005`.

## Quick start

```ts
import { Client } from '@niyantra/commerce';

// Keep API keys on a trusted server, never in browser JavaScript.
const client = new Client({
  baseUrl: 'https://commerce.example.com',
  auth: { apiKey: process.env.COMMERCE_API_KEY! },
});

const page = await client.licenses.list({ limit: 25, offset: 0 });
for (const license of page.data) console.log(license.id);
```

The client accepts `auth: { bearerToken }` as an alternative. `fetch`, `timeoutMs`, and `maxRetries` are configurable. Every service method accepts a final request options argument with `signal`, `requestId`, and `timeoutMs`.

See the [quick start example](examples/quickstart.ts) for server-side setup. The `examples/` directory also covers usage reporting, webhook handling, and pagination.

## Live integration test

From this repository, start the adjacent Commerce checkout with `docker compose -f integration/compose.yml up -d --build`. The stack binds only the app to `127.0.0.1:19094`; Postgres and Redis stay inside the Compose network. Run `npm run test:integration` to exercise the SDK against that server. Override the URL with `COMMERCE_TEST_URL` if needed. The smoke test creates disposable records in the integration database and does not print the API secret. Stop the stack with `docker compose -f integration/compose.yml down` when finished.

## Namespaces

`organizations`, `products`, `plans`, `customers`, `contacts`, `licenses`, `activations`, `machines`, `subscriptions`, `entitlements`, `addons`, `usageMeters`, `usage`, `orders`, `payments`, `invoices`, `webhookEndpoints`, `webhookEvents`, `applications`, `apiKeys`, `offlineCertificates`, `referralPrograms`, `referralCodes`, `referralEvents`, `commissionPlans`, `affiliates`, `affiliateLinks`, `affiliateEvents`, `commissionPayouts`, `auditLogs`, and `system`.

Methods follow the current server routes. For example, orders expose `checkout` and `fulfill`, invoices expose `issue`, `void`, and `pdf`, and webhook endpoints expose `test`. The Go SDK's `orders.update`, `orders.pay`, `invoices.send`, and `webhookEndpoints.delete` target absent routes and are deliberately not exposed.

## Signed usage reports

`client.usageReporter.reportSingle(report)` signs the exact JSON body with the current server canonical string and requires an API key with the `usage:report` scope. It does not automatically retry POST operations. Each report needs a stable `idempotency_key`.

## Webhooks

```ts
import { WebhookVerifier } from '@niyantra/commerce';

const verifier = new WebhookVerifier(process.env.COMMERCE_WEBHOOK_SECRET!);
const event = await verifier.verify(request.headers, new Uint8Array(await request.arrayBuffer()));
```

Pass raw body bytes before JSON parsing. The verifier checks the current `X-Niyantra-*` v1 signature and a five minute timestamp window. Store delivery/event IDs in a durable deduplication table to prevent replay within that window.

## Compatibility and limitations

- Uses platform `fetch`, `AbortController`, and Web Crypto without runtime Node imports. Node 20+ is the current package baseline; browser and edge runtime compatibility still needs smoke tests.
- Browser use requires a short-lived credential and server CORS support. The current server does not allow `X-Usage-*` or `X-Org-ID` in CORS preflight and does not expose `X-Request-ID` to browser JavaScript.
- The offline certificate endpoint works online. A local `OfflineVerifier` is intentionally absent because the server-issued certificate payload and separate signature do not yet form a verified local certificate contract.
- Types generated from the Go SDK are being reconciled with server JSON. Do not treat untested model fields as a final public compatibility guarantee. See [spec/todo.md](spec/todo.md) for remaining Phase 1 work.
