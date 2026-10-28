import { describe, expect, it, vi } from 'vitest';
import { Client, CommerceAbortError } from '../src/index.js';

describe('paginated ReadableStream adapter', () => {
  it('fetches the next page only when the reader needs it', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const offset = Number(new URL(String(input)).searchParams.get('offset') ?? 0);
      const data = [{ id: `item-${offset}` }, { id: `item-${offset + 1}` }].slice(0, 3 - offset);
      return Response.json({ data, total: 3 });
    });
    const client = new Client({ auth: { apiKey: 'sk_stream' }, fetch: fetcher as typeof fetch });
    const reader = client.products.streamAll({ limit: 2 }).getReader();

    expect((await reader.read()).value?.id).toBe('item-0');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await reader.read()).value?.id).toBe('item-1');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await reader.read()).value?.id).toBe('item-2');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await reader.read()).done).toBe(true);
  });

  it('stops page fetches after reader cancellation', async () => {
    const fetcher = vi.fn(async () => Response.json({ data: [{ id: 'first' }], total: 10 }));
    const client = new Client({ auth: { apiKey: 'sk_stream' }, fetch: fetcher as typeof fetch });
    const reader = client.products.streamAll({ limit: 1 }).getReader();
    expect((await reader.read()).value?.id).toBe('first');
    await reader.cancel();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('propagates caller cancellation to an active page request', async () => {
    const signal = new AbortController();
    const fetcher = vi.fn((_input: URL | RequestInfo, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    });
    const client = new Client({ auth: { apiKey: 'sk_stream' }, fetch: fetcher as typeof fetch });
    const reader = client.products.streamAll(undefined, { signal: signal.signal }).getReader();
    const reading = reader.read();
    signal.abort();
    await expect(reading).rejects.toBeInstanceOf(CommerceAbortError);
  });
});
