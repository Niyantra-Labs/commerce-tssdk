# Developer guide

## Source of truth

The Commerce server's route registrations and handlers define the wire contract; the Go SDK supplies the intended public breadth but has known drift (for example its `Plans.Compare` sends `plan_ids`, which the server ignores, and its usage and webhook signing schemes differ from the server). Verified against Commerce `30286a8` and Go SDK `fe24005`.

Models for most domains are generated from the server's Go structs (pointer fields become `?: T | null`, `omitempty` value fields optional, nil-able slices and maps `T | null`) and then checked by the contract suite and the live smoke. Request types mark a field required only where the handler or a NOT NULL column without a default requires it.

## Test layers

| Layer          | Command                                                                      | Source of truth                                             | Catches                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | `npm test` (`test/transport.test.ts`, `test/phase1.test.ts`, verifier tests) | Hand-written expectations                                   | Transport behavior: auth, retries, timeouts, abort, pagination, multipart, streaming, crypto vectors                                     |
| Contract       | `npm test` (`test/contract.test.ts`)                                         | `test/fixtures/routes.json`, generated from the Go handlers | Wrong verb/path/query, a missing body the handler requires, a body the handler ignores, mis-decoded envelopes, any method without a case |
| Manifest drift | `npm run contract:check`                                                     | Commerce source (`COMMERCE_REPO`, default `../commerce`)    | Server routes or envelopes changed since the fixture was generated; regenerate with `npm run contract:manifest` and review the diff      |
| Docs           | `npm test` (`test/docs.test.ts`)                                             | Contract cases + manifest                                   | README endpoint table out of date; regenerate with `UPDATE_DOCS=1 npx vitest run test/docs.test.ts`                                      |
| Live smoke     | `npm run test:integration`                                                   | A running Commerce server                                   | Real behavior: lifecycles, signatures, webhook delivery, downloads, tenant isolation                                                     |
| Runtimes       | `npm run test:runtimes`                                                      | A running Commerce server                                   | Runtime differences in fetch, Web Crypto (Ed25519, HMAC), streams, and CORS                                                              |
| Package        | `npm run test:package`                                                       | The packed tarball                                          | Wrong `exports`/`types`, files missing from or leaking into the tarball, ESM/CJS resolution, consumer typechecking                       |

Adding a service method means adding a contract case in `test/contract-cases.ts` (the coverage meta-test fails otherwise), regenerating the README table, and — for anything beyond a plain CRUD shape — a live smoke assertion. Do not mark an endpoint complete from mocked responses alone.

### Live server

`integration/compose.yml` builds the adjacent `commerce` checkout and serves it on `127.0.0.1:19094` only. After changing Commerce, rebuild with `docker compose -f integration/compose.yml build app && docker compose -f integration/compose.yml up -d app`. The smoke tests act as a platform operator through trusted proxy headers (`X-User-ID`, `X-Roles: commerce:admin`), the way the production auth proxy does; the stack trusts every source only because it is loopback-bound. Org-scoped work then uses real API keys, so the server's tenant guard is exercised on every call. The server rate-limits each API key at 120 requests per minute; the smoke helpers honour `Retry-After`.

### Runtime matrix

`integration/runtime-smoke.mjs` bootstraps a tenant, issues a real offline certificate, captures a real webhook delivery, and then runs `integration/runtime/checks.mjs` — web-standard globals and the built package only — in each runtime:

- **Node (current)** — `process.execPath`.
- **Node 20** — `node:20-alpine` in Docker, joined to the app container's network namespace so `localhost:9094` is the server and the SDK's HTTPS rule needs no exception.
- **Bun, Deno** — from `PATH`; Deno runs with `--allow-net=<server>` and `--allow-env=RUNTIME_CONFIG` only.
- **Browser** — headless Chrome (`CHROME_PATH`, default macOS location) loading `integration/runtime/browser.html` from a local server on another port, so every call is cross-origin.
- **Cloudflare Workers** — Miniflare/workerd from `MINIFLARE_DIR`, a directory where `miniflare` is installed (`npm install --save-exact miniflare@<version>`); it is deliberately not a project dependency.

Unavailable runtimes report `SKIP`. Verified: Node 20.20 and 24.22, Bun 1.1.26, Deno 2.1.4, Chrome 155, workerd 1.20260730.

## Request pipeline

`Transport` builds the URL under `/api/v1` (except `/health`), encodes every dynamic path segment, attaches exactly one auth mode (a bearer function is awaited per request), and sends either JSON serialized once, exact pre-signed bytes, or multipart `FormData` (whose boundary `fetch` sets). It decodes the endpoint's response kind — `data`, `list`, direct JSON, `raw` (the `Response`, for CSV/PDF/artifact streams), or `none` — and rejects malformed envelopes and JSON numbers outside the safe-integer range rather than returning silently wrong values. HTTP 422 from license validation and offline verification is a domain result, not an error.

Implementation rules learned the hard way:

- **Call `fetch` unbound.** Browsers throw "Illegal invocation" when `window.fetch` runs as a method of another object; Node, Bun, Deno, and workerd do not, so only a real browser catches it.
- **Never await `body.cancel()`.** Some fetch implementations never settle it (MSW 2.15 reproduces this); unread bodies are discarded without blocking.
- **Raw responses outlive the call.** The timeout covers the response headers; the caller's `AbortSignal` stays attached while a streamed body is read.

GET requests alone retry 429/502/503/504 and network failures, with bounded full-jitter backoff and `Retry-After`. Multipart and other mutations are never repeated automatically; the server does not yet honour idempotency keys outside usage reports.

## Cryptography

- **Usage reports**: RFC3339 timestamp; HMAC-SHA256 keyed by the raw API key over `timestamp + "\n" + "POST" + "\n" + "/api/v1/usage/reports" + "\n" + hex(SHA256(body))`; the body is serialized once and sent byte-for-byte after signing; 1–100 reports, 2 MiB.
- **Webhooks**: `X-Niyantra-Timestamp` (Unix seconds), `X-Niyantra-Signature` (hex HMAC-SHA256 with the endpoint secret over `unixSeconds + "." + hex(SHA256(rawBody))`), `X-Niyantra-Signature-Version: v1`; compared in constant time after strict hex decoding.
- **Offline certificates**: the server exports a standard-base64 raw Ed25519 public key (`GET /signing-key`) and signs the certificate's exact bytes, including `certificate_id`. `OfflineVerifier` imports the raw key with Web Crypto, verifies before decoding, then checks fingerprint, expiry, and grace. It cannot check revocation.

All three are proven in every runtime above against server-produced signatures.

## Server-side behavior to know

The tenant guard (`commerce/internal/tenant`) authenticates every `/api/v1` route except the public ones, binds API keys to their application's organization, resolves every path ID and every reference in the query and JSON body to its owning organization, and pins `org_id`. Platform operators are identities without an org claim that hold an `AUTH_OPERATOR_ROLES` role. Remaining server limitations are listed at the end of the README and in `spec/todo.md`.

## Release work

Before reporting work done: `npm run build`, `npm run typecheck` (source, tests, and examples), `npm test`, `npm run lint`, `npm run fmt:check`, `npm run docs` (HTML under `.typedoc/`, outside the package), `npm run contract:check`, `npm run test:integration`, `npm run test:runtimes`, `npm run test:package`, and `npm pack --dry-run --json` (the tarball must contain only `dist/`, `LICENSE`, `README.md`, and `package.json`). Do not publish until the P0 items in [the plan](../spec/todo.md) are closed.
