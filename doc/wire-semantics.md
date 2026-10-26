# Wire semantics

The SDK sends JSON through one transport pipeline. These rules describe values that reach Commerce, independent of the TypeScript model names.

## Values in requests

For JSON bodies, `undefined` object properties are omitted by `JSON.stringify`; `null` is transmitted as JSON `null`. A missing `body` sends no JSON body. This applies to PATCH too: omit a property to leave it unspecified; send `null` only when that endpoint's PATCH contract permits clearing it. `undefined` array elements serialize as `null`, so omit an array property rather than placing `undefined` inside an array.

The serializer preserves `false`, `0`, empty arrays, and empty strings. Individual server fields may still reject an empty value. Query parameters omit `undefined`, retain `false` and `0`, and reject `null`. Numeric query values must be safe integers; `limit` must be positive and `offset` nonnegative.

Before sending an ordinary JSON body, transport rejects non-finite numbers, integers outside JavaScript's safe range, `BigInt`, invalid `Date` objects, and cyclic objects. The exact `serializedBody` escape hatch is for already signed bytes and bypasses that ordinary body validation; callers using it must validate their own bytes. A valid `Date` in a JSON body becomes an ISO-8601 string through `Date.prototype.toJSON()`. Server timestamps are represented as ISO-8601 strings at the JSON boundary; call `toDate(value)` to convert a valid timestamp to a `Date` explicitly.

Go `int64` money amounts, usage totals, and counters can exceed JavaScript's exact integer range. Outbound ordinary JSON values must be safe integers (`Number.isSafeInteger`); no `BigInt` is sent. Inbound JSON is scanned **before** `JSON.parse`, and an integer outside the safe range raises `CommerceProtocolError` rather than returning a rounded value. The SDK does not silently switch these fields to strings.

## Responses

Endpoints choose a response kind. `data` requires a `{ data: ... }` envelope and returns its value. `list` requires an array `data` and nonnegative safe-integer `total`, returning the whole `{ data, total }` page; `{ data: null, total: 0 }` normalizes to an empty array. Direct responses have no `kind` and return parsed JSON as-is. `raw` returns the `Response` for streaming; `none` discards the body and returns `undefined`. Except for `raw` and `none`, a successful response must have a JSON content type and valid, size-limited JSON. Malformed envelopes, unsafe numbers, unexpected content types, and redirects raise `CommerceProtocolError`.

Non-success HTTP responses raise `CommerceApiError` with status, code, message, optional details, and `X-Request-ID` when present. Error bodies are read to at most 4096 bytes, then parsed if possible; an oversized or non-JSON body yields the fallback code `http_<status>` and message `HTTP <status>`. Raw error bodies are not attached to errors. License validation and online offline-certificate verification explicitly accept HTTP 422 and decode `{ valid: false, ... }` as domain results.

## Retry, timeout, and abort

Only GET requests retry automatically, for 429/502/503/504 or fetch failures, up to `maxRetries` (default 2). `retryable: false` disables a GET retry; setting it to `true` cannot enable mutation retries. Multipart requests are never retried. Retry delay uses bounded exponential full jitter unless `Retry-After` supplies seconds or an HTTP date; that delay is capped at 30 seconds. The configured timeout is one deadline covering credential resolution, rate-limit waits, fetches, response reads, and retry backoff. The caller's `AbortSignal` cancels all of those stages. A caller cancellation raises `CommerceAbortError`; the deadline raises `CommerceTimeoutError`. For a `raw` response, timeout ends after response headers, while the caller's signal stays connected during body streaming.

Dynamic path IDs are percent-encoded as individual segments. Fetch runs with `redirect: 'manual'`, so credentials are never forwarded by an automatic redirect.
