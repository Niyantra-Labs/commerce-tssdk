# Release process

The package is currently a private `0.2.0` release candidate. A maintainer must remove `"private": true` from `package.json` after the release blockers in `spec/todo.md` are closed. No workflow can publish while that flag remains. The candidate has passed the local package and live gates, but the GitHub release workflow has not run.

## Version policy

- `0.x.patch`: compatible bug fixes, documentation, and internal tooling.
- `0.x` minor: added public APIs or breaking changes, with the breaking change called out in the changelog. Before `1.0`, minor versions are the compatibility boundary.
- `1.0.0`: first stable public contract. From then on, use SemVer major for breaking changes, minor for backward-compatible features, and patch for compatible fixes.

Each releasable pull request adds a Markdown file under `.changeset/` with a patch or minor bump and a user-facing summary. `npm run changeset:status` previews the pending bump; CI checks for a changeset relative to the pull request base commit. A documentation-only change can use an empty changeset. A release pull request that consumes the notes must instead contain a versioned `CHANGELOG.md` section; `npm run release-note:check -- <base-sha>` checks both paths. A maintainer runs `npm run changeset:version` on a release branch to update `package.json` and the versioned section of `CHANGELOG.md`, then runs `npm install --package-lock-only` to sync the lockfile. Review and commit those changes. The first `0.2.0` candidate consolidated the historical Unreleased entries under its version. Changesets versions this private package without tagging or publishing it.

`src/utils.ts` holds the runtime SDK version constant. Update it to match the versioned `package.json` before the full gate; `test/hooks-observability.test.ts` checks the match. Review generated declarations and the package smoke before tagging.

## Release checklist

1. Reconcile the server route manifest: `npm run contract:check` against the intended Commerce commit.
2. Run `npm ci`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run fmt:check`, `npm test`, `npm run coverage`, `npm run docs`, `npm run test:bundle`, and `npm run test:api`. Review intentional changes to `etc/commerce.api.md` before accepting the API report.
3. Run the live server and execute `npm run test:integration` and `npm run test:runtimes`; review reported SKIPs. Run `npm run test:package` and `npm audit --omit=dev`.
4. Run `npm pack --dry-run --json` and confirm every path is under `dist/` or is `LICENSE`, `README.md`, or `package.json`. Confirm zero runtime dependencies.
5. Run `npm run changeset:status`, then `npm run changeset:version` and `npm install --package-lock-only` on the release branch. Review the generated `CHANGELOG.md` entry, reconcile the historical Unreleased text, update `SDK_VERSION` in `src/utils.ts`, and rerun the full gate. Review the README and API declarations before committing the version bump.
6. Dispatch the release workflow with `dry_run: true` and inspect its gates and npm dry-run output. The workflow needs `COMMERCE_REPO_TOKEN` for the Commerce checkout. Its dry-run step unpacks the verified tarball into a temporary directory and removes the `private` flag **only in that temporary copy** so npm can preview publishing; the repository stays private.
7. After approval and after removing `private: true`, configure the `NPM_TOKEN` secret and dispatch with `dry_run: false`. The job grants OIDC `id-token: write` and publishes with npm provenance. Check the published package, provenance, and tarball contents on npm before announcing the release.

The release workflow is manual only. It never runs on a tag or push. Its real publish step requires both `dry_run: false` and a configured `NPM_TOKEN`.
