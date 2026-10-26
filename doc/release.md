# Release process

The package is currently `0.x` and private. A maintainer must remove `"private": true` from `package.json` after the release blockers in `spec/todo.md` are closed. No workflow can publish while that flag remains.

## Version policy

- `0.x.patch`: compatible bug fixes, documentation, and internal tooling.
- `0.x` minor: added public APIs or breaking changes, with the breaking change called out in the changelog. Before `1.0`, minor versions are the compatibility boundary.
- `1.0.0`: first stable public contract. From then on, use SemVer major for breaking changes, minor for backward-compatible features, and patch for compatible fixes.

Update `package.json` and `CHANGELOG.md` together. Review generated declarations and the package smoke before tagging. This repository does not currently use changesets or automatic changelog generation.

## Release checklist

1. Reconcile the server route manifest: `npm run contract:check` against the intended Commerce commit.
2. Run `npm ci`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run fmt:check`, `npm test`, `npm run coverage`, and `npm run docs`.
3. Run the live server and execute `npm run test:integration` and `npm run test:runtimes`; review reported SKIPs. Run `npm run test:package` and `npm audit --omit=dev`.
4. Run `npm pack --dry-run --json` and confirm every path is under `dist/` or is `LICENSE`, `README.md`, or `package.json`. Confirm zero runtime dependencies.
5. Update the Unreleased section of `CHANGELOG.md` into a dated version, add a new Unreleased section, and review the README, API declarations, and version constant in `src/utils.ts`.
6. Dispatch the release workflow with `dry_run: true` and inspect its gates and npm dry-run output. The workflow needs `COMMERCE_REPO_TOKEN` for the Commerce checkout. Its dry-run step unpacks the verified tarball into a temporary directory and removes the `private` flag **only in that temporary copy** so npm can preview publishing; the repository stays private.
7. After approval and after removing `private: true`, configure the `NPM_TOKEN` secret and dispatch with `dry_run: false`. The job grants OIDC `id-token: write` and publishes with npm provenance. Check the published package, provenance, and tarball contents on npm before announcing the release.

The release workflow is manual only. It never runs on a tag or push. Its real publish step requires both `dry_run: false` and a configured `NPM_TOKEN`.
