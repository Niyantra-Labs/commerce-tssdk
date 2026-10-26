# Cryptography and secret handling review

Reviewed against the SDK source and Commerce server source on 2026-10-26. This is a source review and test record, not an external audit.

## Signed usage reports

`UsageReporter` JSON-serializes once and sends those same bytes. Its canonical string is `RFC3339 timestamp + "\\nPOST\\n/api/v1/usage/reports\\n" + lowercase hex SHA-256(body)`, HMAC-SHA256 with the API key. This matches `commerce/internal/domain/usage/hmac.go`; the server accepts five minutes of clock skew and compares decoded MACs with `hmac.Equal`. The SDK uses Web Crypto with a nonextractable imported key and never retries the POST. `test:integration` and `test:runtimes` exercise signed ingestion against Commerce. Callers must supply stable per-report idempotency keys; this is separate from transport retry safety.

## Webhook deliveries

Commerce signs `Unix seconds + "." + lowercase hex SHA-256(raw body)` with HMAC-SHA256 (`commerce/internal/domain/webhook/util.go`). `WebhookVerifier` requires `v1`, a decimal Unix timestamp within its configured tolerance (default five minutes), and exactly 32 hex-decoded signature bytes. It computes every configured secret's MAC and compares all 32 bytes per candidate without an early match exit. Length and format rejection occur before comparison because the required MAC length is public. The raw bytes are verified before UTF-8 decoding or JSON parsing. Invalid JSON errors carry no parser cause because parser text can quote a license key from the signed payload. Rotation accepts an ordered current/previous secret list without accepting another signature version. Unit tests cover tampering, skew, rotation, malformed headers, and JSON; live and runtime smokes verify real Commerce deliveries.

A valid signature can be replayed within the timestamp window. `defineWebhookHandler` offers `WebhookDedupe.runOnce(event.id, callback)` for a durable, atomic event-ID claim, with rollback when the callback fails. Keep claims longer than the signature window. A process-local set protects neither restarts nor replicas. If the effect and claim cannot share a transaction, make the effect idempotent too. The SDK supplies no persistent store or automatic replay policy.

## Offline certificates

Commerce signs the exact certificate bytes with Ed25519 (`commerce/internal/crypto/signer.go:SignRaw`). `OfflineVerifier` imports the raw 32-byte public key as a nonextractable Web Crypto key, verifies the signature over decoded bytes, and only then parses the payload and checks fingerprint, expiry, and grace expiry. It reports signature failure without exposing decoded contents. Signed but malformed JSON errors omit the parser cause. `OfflineCertificateCache` re-verifies on every read and stores only a valid certificate. Its pluggable storage contains a license key and must be protected. Local verification cannot detect revocation; check `offlineCertificates.verify` online when possible. Certificates from server builds before the signing fix must be reissued.

The public key comes from `system.signingKey()`. An application that needs protection from an untrusted server or network path should pin its expected key through a trusted channel and use TLS for key retrieval. Key rotation requires refreshing the verifier with the new trusted key; the current SDK does not maintain a key ring.

## Debug output and residual limits

HTTP responses and offline verification results retain explicit field access but redact named secrets in `JSON.stringify` and Node inspection. The transport also removes active credentials and known secret input values from API error text/details and hook events. The raw response mode intentionally returns the browser `Response`, so callers control logging of streamed bytes. Cryptographic checks do not make sensitive data safe to log through arbitrary direct property access, custom serializers, or caller-owned storage.

The review found no mismatch in the SDK HMAC canonical strings, no early match exit in fixed-length webhook comparisons, and no parse-before-verify path for offline certificates. It prompted the parser-cause and offline-result redaction fixes tested in `test/webhook-handler.test.ts` and `test/offline-certificate-cache.test.ts`.
