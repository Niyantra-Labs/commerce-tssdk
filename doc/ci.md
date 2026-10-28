# CI and dependency scanning

The SDK CI job runs the local static, unit, docs, package, bundle, API-report, and coverage gates on Node 20/22/24 on Ubuntu and Node 24 on macOS and Windows. `test:package` checks `npm pack --dry-run --json` and then installs the packed artifact into a fresh consumer. A separate dependency-scan job requires zero runtime vulnerabilities and rejects high or critical advisories in development dependencies. The latter currently reports two moderate Vitest development advisories (`GHSA-qxg6-89mg-rqv8` and `GHSA-xp26-3454-mjgp`); review them separately rather than calling the full dependency tree clean. The available fix requires a newer Vitest pin and its matching coverage package, subject to the repository's 14-day dependency age rule.

The opt-in live job runs only on `workflow_dispatch` with repository variable `RUN_LIVE_CONTRACT=true`. It needs `COMMERCE_REPO_TOKEN` to check out the private sibling Commerce repository. It builds the Compose stack, checks the route manifest, and runs the integration and runtime smokes. Runtimes missing on the runner report SKIP; Bun and Deno are installed by pinned setup actions. The local branch cannot prove how GitHub-hosted runners behave, so inspect their first run before relying on the matrix.

The Node 24 Ubuntu job emits `coverage/lcov.info` and uploads it to Codecov only when the repository secret `CODECOV_TOKEN` is configured. The upload action is SHA-pinned and fails the job if an enabled upload fails. Fork pull requests without access to the secret skip upload; local V8 thresholds still run. The upload has not been exercised on GitHub.

Pull requests run `changeset status --since=<base commit>` after a full checkout. A releasable change needs a `.changeset/*.md` note; for a change that should not bump the package, add an empty changeset. `doc/release.md` explains how a maintainer generates the changelog and version bump.

The release workflow is manual and `package.json` remains private. See `doc/release.md` for the human review and dry-run process. No CI workflow should remove `private` from the repository package or publish on push/PR.
