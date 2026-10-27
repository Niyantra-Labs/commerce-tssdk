# Contributing

The Commerce Go handlers, repositories, and migrations define the wire contract. `spec/todo.md` tracks gaps. Read `doc/developer-guide.md`, `doc/wire-semantics.md`, `doc/phase3.md`, and `doc/security.md` before changing request handling or cryptography.

## Setup

Use Node 20 or newer and run `npm ci`. The SDK is ESM-only and has no runtime dependencies. Keep development dependencies exact-pinned and at least 14 days old when adding one.

For live checks, start the sibling Commerce repository with `docker compose -f integration/compose.yml up -d --build`. The SDK expects `http://127.0.0.1:19094`. The `test:runtimes` script reports SKIP for runtimes that are not installed; set `MINIFLARE_DIR` to a Miniflare installation for workerd.

`packages/cli`, `packages/otel`, and `packages/node-storage` are private companion packages. Keep Node built-ins in those packages, never in core `src/`. The package smoke exercises the CLI on loopback and the filesystem storage adapter in a temporary directory.

## Checks before a pull request

Run these in order, joined with `&&` so a failure stops the gate:

```sh
npm run build && npm run typecheck && npm test && npm run lint && npm run fmt:check && npm run docs && npm run contract:check && npm run test:package && npm run coverage && npm run test:bundle && npm run test:api && npm audit --omit=dev
```

For transport, crypto, service, or wire changes, also run `npm run test:integration` and `npm run test:runtimes` against a live Commerce stack. Record any SKIPs. `npm run test:package` verifies the dry-run pack manifest and installs the tarball into a clean consumer project. `npm run test:api` compares generated declarations to `etc/commerce.api.md`; review the diff and update that report only for intentional public API changes.

When a server route's envelope, body requirement, or public flag changes, run `npm run contract:manifest`, review `test/fixtures/routes.json`, and keep the contract cases passing. The route fixture is generated and intentionally ignored by Prettier. Regenerate the README endpoint table with `UPDATE_DOCS=1 npx vitest run test/docs.test.ts` after changing service coverage.

Keep pull requests focused. Describe server behavior with a handler or migration reference, tests that reproduce a bug, the live proof for wire changes, and any compatibility impact. Never include credentials or signed bodies in logs, fixtures, or issue reports. Publishing remains a separate maintainer decision; `package.json` stays private during development.
