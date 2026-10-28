# Changelog

All notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Typed Commerce services for licensing, activations, subscriptions, metering, orders, payments, invoices, webhooks, referrals, affiliates, gateways, notifications, payment methods, and releases.
- Local offline certificate and webhook signature verification, signed usage reporting, pagination helpers, and binary release downloads.
- Manifest-driven contract tests, live and cross-runtime smokes, package-consumer tests, and a Node 20/22/24 CI matrix.
- Opt-in redacted request, response, and retry hooks; runtime-aware SDK identification outside browsers; and overlapping webhook secret rotation.
- Source coverage reporting and a manually dispatched release workflow with a dry-run default.
- A framework-neutral typed webhook handler with an optional durable replay store, a server-generated license-key format check, and a pluggable offline certificate cache.
- Bundle-size and tree-shaking checks, compile-time public API tests, an API declaration report, contributor and security guides, and macOS/Windows CI configuration.
- Optional redacted debug logger, metadata-only middleware, safe per-call headers, configurable retry backoff, bounded batch issuance, cross-runtime machine fingerprints, local proration previews, and browser offline-certificate storage.
- Private companion packages for OpenTelemetry hooks, read-only CLI exploration, and Node filesystem certificate storage.
- Changeset-based version planning and changelog generation, with a pull-request release-note check and token-gated Codecov upload.
- Paginated `ReadableStream` collection adapters, route-manifest-generated MSW handlers, loopback throughput and specialized bundle profiles, a Worker webhook example, and private React/Next/Hono/Express companions.
- Opt-in retries for other safe-GET 5xx responses, a bounded local rate-limit wait queue, and distinct server/client rate-limit errors.
- Final-byte validation of JSON request bodies, including custom `toJSON()` output and exact serialized bodies.
- Sanitized bearer-token supplier and request-body getter failures before network I/O.

### Changed

- Hardened transport validation, safe GET retries, error redaction, and protocol handling.
- FIFO cancellable client rate-limit waits, preservation of the final HTTP error after retries, and explicit 202/204 no-body handling.
- Documented and live-tested manual order checkout, fulfillment, refunds, and invoice lifecycle against the Commerce server.

### Security

- API keys remain scoped to trusted runtimes; credentials and signed bodies are excluded from hook events.
- Offline verification results redact license keys from JSON/inspection; webhook and offline verifiers reject invalid caller clocks.
