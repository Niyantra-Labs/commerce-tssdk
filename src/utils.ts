import { CommerceError, CommerceValidationError } from './errors.js';

/** Kept in sync with package.json by the SDK identification test. */
export const SDK_VERSION = '0.1.0';

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
