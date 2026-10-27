# Phase 3 helpers and extensions

## Diagnostics and middleware

Pass `debug: true` and a logger to receive redacted attempt metadata. The SDK calls only `logger.debug` with `commerce.request`, `commerce.response`, or `commerce.retry` and a frozen event. The default remains silent. Hooks continue to work independently of debug mode. Keep logger and hook callbacks fast; thrown logger errors are ignored.

```ts
const client = new Client({
  auth: { apiKey },
  debug: true,
  logger: { debug: record, info: record, warn: record, error: record },
  backoffMultiplier: 2,
  jitter: 'equal',
});
client.use(async (request, next) => {
  const result = await next(request);
  record('completed', { method: request.method, path: request.path });
  return result;
});
await client.products.list(undefined, { headers: { 'X-Trace-Tag': traceTag } });
```

Middleware sees no URL query values, IDs, headers, or body. It cannot alter signed bytes. It may short-circuit or replace a result; register it before sending requests, and use `next(request)` at most once. The caller controls middleware failure handling. Custom per-call headers are for safe metadata; protected names are rejected. Browser requests may need a matching server CORS allow-list. The server does not honor a general `Idempotency-Key` header, so automatic generation is intentionally unavailable. POST/PATCH/DELETE remain single-attempt.

The private [`@niyantra/commerce-otel` adapter](../packages/otel/README.md) maps these redacted hooks to OpenTelemetry-compatible counters, duration histograms, and attempt spans. Supply your application's tracer and meter; the core package has no telemetry dependency.

## Batch license issuance

```ts
const results = await createLicensesBatch(client.licenses, inputs, { concurrency: 4 });
for (const result of results) {
  if (result.status === 'rejected') handleFailure(result.reason);
}
```

Results preserve input order. The helper does not retry writes or deduplicate licenses. A signal stops launching new work and also cancels in-flight SDK calls when passed as part of the options. Use the server's `/licenses/bulk` endpoint instead when all licenses share one template and its 1–100 item contract fits.

## Fingerprints and proration

`generateMachineFingerprint({ namespace, components })` hashes a versioned JSON array of the namespace and lexically sorted NFC-normalized component pairs with SHA-256. The output is lowercase hex. Choose stable, non-secret inputs yourself; no platform identifiers are read. Keep the exact input policy across installations. Commerce stores and compares the resulting string as an opaque fingerprint; it does not generate or validate this hash format. The runtime smoke uses a generated fingerprint for activation and a real server-issued offline certificate in Node, Bun, Deno, Chrome, and workerd.

`calculateProration` mirrors the current Go `calculateProration` arithmetic for plan subtotal, period fraction, and cent rounding. It is a local preview, based on the supplied plan snapshots and clock. The server's `changePlan` or `updateSeats` response is authoritative because the server uses its own clock and current database state.

## Offline storage and CLI

`OfflineCertificateCache` re-verifies signatures, fingerprint, and expiry on every read. Use `MemoryOfflineCertificateStorage` for volatile state, `LocalOfflineCertificateStorage(localStorage)` for a trusted browser, or the private [`@niyantra/commerce-node-storage` adapter](../packages/node-storage/README.md) for a private Node directory. Browser storage is readable by scripts on the same origin; the file adapter stores unencrypted bytes with mode `0600`. Neither can learn revocations while offline.

The private [`@niyantra/commerce-cli` package](../packages/cli/README.md) offers read-only `health`, `list`, and `get` exploration. It accepts credentials through environment variables, not command arguments. Publishing and `npx` use remain disabled while all packages are private.
