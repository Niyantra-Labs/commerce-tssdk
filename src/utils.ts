import { CommerceError, CommerceValidationError } from './errors.js';

/** Kept in sync with package.json by the SDK identification test. */
export const SDK_VERSION = '0.1.0';

const INSPECT = Symbol.for('nodejs.util.inspect.custom');
export const SECRET_FIELD =
  /^(?:secret|secret_key|license_key|license_keys|signature|certificate|token|access_token|refresh_token|api_key|password|credentials|client_secret|idempotency_key|download_url|signed_url)$/i;

/** Internal safe representation for JSON and runtime inspection. */
export function redactedView(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === 'string')
    return secrets.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), value);
  if (Array.isArray(value)) return value.map((item) => redactedView(item, secrets));
  if (!value || typeof value !== 'object') return value;
  const safe: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    Object.defineProperty(safe, key, {
      value: SECRET_FIELD.test(key) ? '[REDACTED]' : redactedView(item, secrets),
      enumerable: true,
      configurable: true,
    });
  }
  return safe;
}

/** Keep explicit field access while protecting accidental JSON/inspect logging. */
export function protectSecretView<T>(value: T, secrets: readonly string[] = []): T {
  if (!value || typeof value !== 'object') return value;
  Object.defineProperty(value, 'toJSON', {
    value: () => redactedView(value, secrets),
    configurable: true,
  });
  Object.defineProperty(value, INSPECT, {
    value: () => redactedView(value, secrets),
    configurable: true,
  });
  for (const child of Object.values(value)) protectSecretView(child, secrets);
  return value;
}

/** Convert an ISO-8601 server timestamp to a Date, rejecting invalid input. */
export function toDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new CommerceValidationError('Invalid ISO-8601 timestamp');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new CommerceValidationError('Invalid ISO-8601 timestamp');
  return date;
}

/** A non-throwing adapter for consumers who prefer result values. */
export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: CommerceError };

/** Settle a promise into `{ ok: true, value }` or `{ ok: false, error }` instead of throwing. */
export async function asResult<T>(operation: Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await operation };
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof CommerceError
          ? cause
          : new CommerceError('Unexpected SDK failure', { cause }),
    };
  }
}
