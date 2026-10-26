import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommerceApiError, CommerceProtocolError, Transport } from '../src/index.js';

afterEach(() => vi.useRealTimers());

const transport = (fetcher: typeof fetch, maxRetries = 0) =>
  new Transport({ auth: { apiKey: 'test-key' }, fetch: fetcher, maxRetries });

describe('status and retry boundaries', () => {
  it.each([202, 204])('accepts %i with no-body response kind', async (status) => {
    const fetcher = vi.fn(async () => new Response(null, { status }));
    await expect(
      transport(fetcher).request({ method: 'POST', path: '/items', kind: 'none' }),
    ).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('decodes a 202 data response and rejects empty typed success', async () => {
    await expect(
      transport(
        async () =>
          new Response('{"data":{"id":"queued"}}', {
            status: 202,
            headers: { 'content-type': 'application/json' },
          }),
      ).request({ method: 'POST', path: '/items', kind: 'data' }),
    ).resolves.toEqual({ id: 'queued' });
    for (const status of [200, 204]) {
      await expect(
        transport(async () => new Response(status === 200 ? '' : null, { status })).request({
          method: 'GET',
          path: '/items/1',
          kind: 'data',
        }),
      ).rejects.toBeInstanceOf(CommerceProtocolError);
    }
  });

  it.each([429, 503])('retains the final HTTP %i envelope after GET retries', async (status) => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: `final_${status}`,
              message: 'last response',
              details: { attempt: fetcher.mock.calls.length },
            },
          }),
          {
            status,
            headers: {
              'content-type': 'application/json',
              'retry-after': '1',
              'x-request-id': 'last-id',
            },
          },
        ),
    );
    const pending = transport(fetcher, 2).request({ method: 'GET', path: '/items' });
    const assertion = expect(pending).rejects.toMatchObject({
      status,
      code: `final_${status}`,
      message: 'last response',
      requestId: 'last-id',
      details: { attempt: 3 },
    } satisfies Partial<CommerceApiError>);
    await vi.advanceTimersByTimeAsync(2000);
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe('client limiter ordering', () => {
  it('serves queued requests in arrival order and releases an aborted turn', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const seen: string[] = [];
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      seen.push(String(url).split('/').at(-1)!);
      return new Response('{"data":1}', { headers: { 'content-type': 'application/json' } });
    });
    const sleep = vi.fn(
      (ms: number, signal: AbortSignal) =>
        new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, ms);
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(signal.reason);
            },
            { once: true },
          );
        }),
    );
    const client = new Transport({
      auth: { apiKey: 'test-key' },
      fetch: fetcher,
      rateLimit: { requestsPerSecond: 1, burst: 1, clock: { now: () => Date.now(), sleep } },
      timeoutMs: 5000,
    });
    const request = (id: string, signal?: AbortSignal) =>
      client.request(
        { method: 'GET', path: `/items/${id}`, kind: 'data' },
        signal ? { signal } : {},
      );
    const first = request('first');
    const controller = new AbortController();
    const second = request('second', controller.signal);
    const third = request('third');
    controller.abort();
    await expect(second).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([first, third]);
    expect(seen).toEqual(['first', 'third']);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it('does not add a limiter delay after a Retry-After delay replenishes the bucket', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const sentAt: number[] = [];
    const fetcher = vi.fn(async () => {
      sentAt.push(Date.now());
      return sentAt.length === 1
        ? new Response('{"error":{"code":"limited"}}', {
            status: 429,
            headers: { 'content-type': 'application/json', 'retry-after': '1' },
          })
        : new Response('{"data":1}', { headers: { 'content-type': 'application/json' } });
    });
    const result = new Transport({
      auth: { apiKey: 'test-key' },
      fetch: fetcher,
      maxRetries: 1,
      rateLimit: { requestsPerSecond: 1 },
      timeoutMs: 5000,
    }).request({ method: 'GET', path: '/items', kind: 'data' });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe(1);
    expect(sentAt).toEqual([0, 1000]);
  });
});
