# Codex handoff — `codex/observability`

Worktree: `../commerce-tssdk-codex`. This branch has not been merged, rebased, pushed, or published.

## Commits

- `b1555e2` **Add redacted transport hooks and runtime identification**: adds frozen attempt events, an SDK User-Agent only in permitted runtimes, and a version synchronization test. Exports hook types from `src/index.ts` and documents ordering in `doc/wire-semantics.md`.
- `30ab5c2` **Verify webhook signatures across rotating secrets**: accepts a single secret or an ordered list and checks every secret without early exit, preserving the single-secret constructor and `v1` requirement.
- `97084dd` **Measure source coverage in the Node 24 CI leg**: pins `vitest` and `@vitest/coverage-v8` to 4.1.11, adds `npm run coverage`, V8 thresholds, and a Node 24 CI step. Version 4.1.11 was published 2026-08-18; 4.1.12 was published 2026-10-15 and did not meet the 14-day rule on 2026-10-26.
- `dde088d` **Document version policy and add gated release dry run**: adds `CHANGELOG.md`, `doc/release.md`, and a manual-only release workflow. The workflow runs local, contract, live, runtime, and package gates, previews the packed artifact with `npm publish --dry-run --provenance`, and conditionally publishes only when `dry_run` is false and `NPM_TOKEN` exists. The temporary preview copy has its private flag removed; the repository package stays private.
- The final handoff commit adds this report.

## Bugs and user-visible changes

No pre-existing transport or verifier bug was found. Tests establish the new behavior: `emits frozen redacted events for each HTTP attempt and retry`, `ignores a throwing or rejecting hook and returns a raw response`, `emits onRequest before a caller aborts fetch and before a fetch timeout`, `sets User-Agent for node/bun/deno/workerd`, `does not add User-Agent or another identification header in browsers`, and `accepts a previous secret during rotation and rejects it after removal`.

`ClientOptions.hooks` now accepts `onRequest`, `onResponse`, and `onRetry`. Events carry safe metadata only, with one-based attempt numbers and collection-level paths; callbacks run synchronously after serialization and authentication, are never awaited, and cannot fail the request. Node/Bun/Deno/workerd requests now include `User-Agent: niyantra-commerce-ts/0.1.0 (<runtime>)`; browser requests add no identification header. Custom `User-Agent` overrides are rejected. `WebhookVerifier` now accepts `string | readonly string[]` (current secret first), rejects empty lists/secrets, and verifies against all configured secrets while requiring `v1`. The reviewed `CommerceNetworkError` cause behavior was preserved.

## Exact edits for Claude-owned files

Add this paragraph to `README.md` after **Errors, retries, and cancellation**:

> Optional `hooks` on `new Client()` accepts `onRequest`, `onResponse`, and `onRetry` callbacks. Each receives a frozen event with method, collection-level path, attempt number, elapsed milliseconds, and request ID when available; response events add status, and retry events add delay and reason. Events contain no headers, bodies, query values, or credentials. Callbacks run synchronously after serialization and authentication, must be fast, and cannot change or fail a request; returned promises are not awaited. With no hooks, the SDK remains silent. See [Wire semantics](doc/wire-semantics.md#identification-and-observability).

Add this sentence under `README.md` **Runtime support**:

> Node, Bun, Deno, and workerd requests send `User-Agent: niyantra-commerce-ts/<version> (<runtime>)`; browser requests omit it and add no replacement header, so this feature creates no new CORS preflight requirement.

Add this sentence under `README.md` **Webhooks**:

> For secret rotation, construct `new WebhookVerifier([currentSecret, previousSecret])`, then remove the previous secret after the overlap period. Every configured secret is checked, and deliveries still require signature version `v1`.

Add this sentence under `README.md` **Testing**:

> `npm run coverage` reports V8 source coverage and enforces aggregate thresholds; CI runs it on Node 24. Release policy and the manual dry-run workflow are documented in [Release process](doc/release.md), and release notes are in the [Changelog](CHANGELOG.md).

In `spec/todo.md` §1.3, replace the two open lines with:

> - [x] Default SDK identification only in runtimes where the header is permitted; browsers cannot set `User-Agent` — Node/Bun/Deno/workerd use `niyantra-commerce-ts/<version> (<runtime>)`; browser omits it; version is test-checked against package.json.
> - [x] Debug hook — optional `onRequest` / `onResponse` / `onRetry` callbacks with frozen, redacted attempt metadata; callback failures are swallowed and default logging stays silent.

In §F, replace “multi-secret rotation is not supported yet” at the end of the webhook verifier bullet with “ordered multi-secret rotation is implemented; current and previous secrets are each checked, and `v1` remains required”. The rest of that bullet can remain partially checked until Claude reviews replay guidance and typed payloads.

In §G, mark the opt-in observability bullet `[x]` and append “— frozen redacted metadata hooks run after serialization/auth and before fetch, with response and retry events; no request mutation or default logger.”

In §4.1, keep “Test coverage reporting via `@vitest/coverage-v8` → codecov” open because Codecov upload was not requested or added. Append “— V8 coverage and aggregate thresholds run on the Node 24 CI leg; Codecov upload remains open.” In §4.2, keep changesets, autogenerated changelog, tagged publishing, and published-package items open. Add a note: “Manual-only release dry-run workflow, 0.x semver policy, and a hand-maintained Keep a Changelog file are in place; `private: true` still blocks a real publish.”

## Verification and limits

- Passed: clean `npm ci`; `npm run build`; `npm run typecheck`; `npm run lint`; `npm run fmt:check`; `npm test` (288 tests); `npm run docs`; `npm run test:package` (39-file tarball, ESM/CommonJS/TypeScript consumer checks); `npm run coverage`; `npm audit --omit=dev` (zero vulnerabilities); `npm pack --dry-run --json` plus allowed-path assertion (39 files, none unexpected); `git diff --check`; and actionlint v1.7.12 on both workflows.
- Measured aggregate coverage: **92.05% statements (579/629), 86.65% branches (357/412), 98.38% functions (244/248), 93.83% lines (533/568)**. Configured thresholds: 90%, 84%, 96%, and 91% respectively.
- Verified action pins with `git ls-remote`: `actions/checkout` v4.2.2 → `11bd71901bbe5b1630ceea73d27597364c9af683`; `actions/setup-node` v4.4.0 → `49933ea5288caeca8642d1e84afbd3f7d6820020`; `oven-sh/setup-bun` v2.2.0 → `0c5077e51419868618aeaa5fe8019c62421857d6`; `denoland/setup-deno` v2.0.5 → `22d081ff2d3a40755e97629de92e3bcbfa7cf2ed`.
- Neither workflow has run on GitHub. Contract/live/runtime smokes and the release workflow's npm dry-run were not run here. No `npm publish` command was run. The shared stack was not touched or queried. `private: true` remains in `package.json` and blocks real publishing until a maintainer removes it.
