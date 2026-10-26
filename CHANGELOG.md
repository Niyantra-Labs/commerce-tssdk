# Changelog

All notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Typed Commerce services for licensing, activations, subscriptions, metering, orders, payments, invoices, webhooks, referrals, affiliates, gateways, notifications, payment methods, and releases.
- Local offline certificate and webhook signature verification, signed usage reporting, pagination helpers, and binary release downloads.
- Manifest-driven contract tests, live and cross-runtime smokes, package-consumer tests, and a Node 20/22/24 CI matrix.
- Opt-in redacted request, response, and retry hooks; runtime-aware SDK identification outside browsers; and overlapping webhook secret rotation.
- Source coverage reporting and a manually dispatched release workflow with a dry-run default.

### Changed

- Hardened transport validation, safe GET retries, error redaction, and protocol handling.

### Security

- API keys remain scoped to trusted runtimes; credentials and signed bodies are excluded from hook events.
