# Developer guide

## Source of truth

The Commerce server routes and handlers define the HTTP wire contract. The Go SDK supplies the desired public service breadth but has known drift. Compared revisions: Commerce `715ff7c`, Go SDK `fe24005`. Recheck on every new implementation pass.

## Request pipeline

`Transport` builds a URL under `/api/v1`, encodes dynamic IDs, adds exactly one auth mode, sends JSON through an injectable fetch, and parses the endpoint's response kind (`data`, `list`, direct JSON, raw binary, or ignored status body). It treats 422 license validation and offline verification as domain results. Unknown, malformed, or unsafe JSON numbers fail as protocol errors.

GET requests alone retry 429/502/503/504 or network failures by default, with bounded jitter and `Retry-After`. Mutations are not repeated automatically. A timeout and caller signal cancel fetch and backoff. The current client has no tenant override because `X-Org-ID` authorization semantics need confirmation.

## Cryptography

Usage reports use an RFC3339 timestamp, API key as HMAC key, and `timestamp + '\nPOST\n/api/v1/usage/reports\n' + hex(SHA256(body))`. The JSON body is serialized once and sent byte-for-byte after signing. Webhook v1 uses `unixSeconds + '.' + hex(SHA256(rawBody))`, signed with the endpoint secret. Both use Web Crypto.

The server exports a standard-base64 raw Ed25519 public key. The current offline issue operation returns a base64 payload and separate signature whose signed-message relationship requires a server contract fix. Local verification is unavailable until that contract is proven with a server-issued certificate.

## Release work

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Phase 1 still needs complete server fixture coverage, model field reconciliation, and browser/edge integration checks. Consult [the plan](../spec/todo.md) before declaring the SDK production ready.
