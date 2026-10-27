import { CommerceAbortError, CommerceValidationError } from './errors.js';
import type { License, LicenseCreateParams } from './models/generated.js';
import type { LicenseService } from './services/index.js';
import type { RequestOptions } from './transport.js';

export interface BatchOptions {
  /** Maximum simultaneous operations (default 4). */
  concurrency?: number;
  /** Stops launching new operations; in-flight operations may also use this signal. */
  signal?: AbortSignal;
}

/**
 * Settle every operation in input order while bounding concurrent work.
 *
 * @example
 * ```ts
 * const results = await settleBatch(ids, (id) => client.licenses.get(id), { concurrency: 4 });
 * ```
 */
export async function settleBatch<T, R>(
  inputs: readonly T[],
  worker: (input: T, index: number) => Promise<R>,
  options: BatchOptions = {},
): Promise<PromiseSettledResult<R>[]> {
  const concurrency = options.concurrency ?? 4;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 100)
    throw new CommerceValidationError('Batch concurrency must be between 1 and 100');
  const results = new Array<PromiseSettledResult<R>>(inputs.length);
  let cursor = 0;
  const run = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= inputs.length) return;
      const input = inputs[index];
      if (options.signal?.aborted) {
        results[index] = { status: 'rejected', reason: new CommerceAbortError('Batch cancelled') };
        continue;
      }
      try {
        results[index] = { status: 'fulfilled', value: await worker(input as T, index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.allSettled(Array.from({ length: Math.min(concurrency, inputs.length) }, run));
  return results;
}

/**
 * Issue licenses concurrently without retrying mutations; settled results preserve input order.
 *
 * @example
 * ```ts
 * const results = await createLicensesBatch(client.licenses, inputs, { concurrency: 4 });
 * ```
 */
export function createLicensesBatch(
  service: LicenseService,
  inputs: readonly LicenseCreateParams[],
  options: RequestOptions & BatchOptions = {},
): Promise<PromiseSettledResult<License>[]> {
  return settleBatch(inputs, (input) => service.create(input, options), options);
}
