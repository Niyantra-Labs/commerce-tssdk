# Codex handoff — `codex/ci-hardening`

Worktree: `../commerce-tssdk-codex`. These commits are on this branch only; they have not been merged or pushed.

## Commits

- `9190a74` **Prevent unsafe retries and sanitize transport failures**: adds 22 injected-fetch edge tests and fixes the transport failures those tests reproduced.
- `32614d4` **Add pinned CI matrix and gated live checks**: adds Node 20/22/24 local gates and an opt-in contract/live job, using full action SHAs and read-only repository permissions.
- `7a7275a` **Document wire behavior and complete package metadata**: adds `doc/wire-semantics.md` and the missing `author` field. Homepage, bugs URL, keywords, repository URL, and MIT license were already present; no scripts, exports, engines, files, or runtime dependencies changed.
- The final commit adds this handoff file so Claude can apply the requested edits in owned files.

## Bugs reproduced and user-visible changes

- `does not repeat a mutation after HTTP 429/503 even with retryable set`: the low-level `RequestSpec.retryable: true` previously repeated POST requests. Mutations now never retry; the flag can only disable GET retries. Multipart behavior is unchanged.
- `rejects a manual redirect as a protocol error`: a 302 previously became `CommerceApiError`; all 3xx responses now raise `CommerceProtocolError`, with manual redirect mode retained.
- `does not expose credentials in API messages or network causes`: an API response could echo the active API key in its error message, and a fetch error could carry it in `cause`. API messages now replace the active credential with `[REDACTED]`; network and JSON protocol errors retain a generic `Error` cause without untrusted raw text. This reduces cause detail visible to callers.
- `rejects a misleading content type`: `application/jsonish` was accepted because content type matching used substring search. Success JSON now requires `application/json` or a `+json` media type.
- Oversized response reads now discard/cancel the unread body without awaiting cancellation. The error still carries status and fallback code, never the raw body.

Additional edge tests cover GET `Retry-After` seconds and HTTP dates, mutation network failures, abort before fetch and during backoff/rate wait, fetch timeout, huge and non-JSON errors, malformed envelopes, unsafe integers, encoded IDs, credential validation, JSON omission/null/empty values, null queries, and `toDate`.

## Changes needed in Claude-owned files

- `README.md`, after **Errors, retries, and cancellation**: add `For exact JSON, PATCH, integer, response-envelope, and retry rules, see [Wire semantics](doc/wire-semantics.md).` The existing retry sentence remains accurate. No root export in `src/index.ts` is needed; all error classes and `toDate` were already exported.
- `spec/todo.md` §C, first bullet: record that malformed data/list envelopes, redirects, unexpected content types, and bounded error bodies now have edge tests; retain the checkbox until every listed status/empty-success case is verified.
- `spec/todo.md` §C, second and fourth bullets: record that request IDs, credential redaction in messages/causes, and safe-method-only retries are covered; retain the checkboxes because those bullets include wider release requirements.
- `spec/todo.md` §F, “Test unsafe retries ...” bullet: record this edge-test coverage; retain the checkbox because signature tampering, webhook replay, and clock skew belong to Claude's work.
- For the opt-in CI live job, configure repository variable `RUN_LIVE_CONTRACT=true` and secret `COMMERCE_REPO_TOKEN` with read access to `Niyantra-Labs/commerce`, then start it via `workflow_dispatch`. Keep the gate off until the branch is ready.

## Verification and limits

- Passed here: `npm ci`; `npm run build`; `npm run typecheck`; `npm run lint`; `npm run fmt:check`; `npm test` (267 tests); `npm run docs`; `npm run test:package` (39-file tarball, ESM, CommonJS, and TypeScript consumers); `npm audit --omit=dev` (zero vulnerabilities); `npm pack --dry-run --json` plus an allowed-path assertion (39 files, none unexpected); `git diff --check`; and `actionlint` v1.7.12 plus Prettier on `.github/workflows/ci.yml`.
- The workflow has **not run on GitHub**. The opt-in contract/live job, including Docker Compose, Bun, and Deno, has not run here. The shared live stack was not touched or queried. Runtime checks for browser/workerd can report SKIP on a runner that lacks them.
