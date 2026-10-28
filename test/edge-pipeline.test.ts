import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CommerceApiError,
  CommerceLocalRateLimitError,
  CommerceProtocolError,
  CommerceRateLimitError,
  Transport,
} from '../src/index.js';

afterEach(() => vi.useRealTimers());

const transport = (fetcher: typeof fetch, maxRetries = 0) =>
  new Transport({ auth: { apiKey: 'test-key' }, fetch: fetcher, maxRetries });

describe('status and retry boundaries', () => {
  it('retries other 5xx only when opted in for a safe GET', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () =>
      fetcher.mock.calls.length === 1
        ? new Response('{"error":{"code":"internal"}}', {
            status: 500,
            headers: { 'content-type': 'application/json' },
          })
        : new Response('{"data":1}', { headers: { 'content-type': 'application/json' } }),
    );
    const spec = { method: 'GET', path: '/items', kind: 'data' } as const;
    await expect(transport(fetcher, 1).request(spec)).rejects.toMatchObject({ status: 500 });
    expect(fetcher).toHaveBeenCalledOnce();
    fetcher.mockClear();
    const pending = new Transport({
      auth: { apiKey: 'test-key' },
      fetch: fetcher,
      maxRetries: 1,
      retryOther5xx: true,
      jitter: 'none',
    }).request(spec);
    await vi.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not retry a mutation when other 5xx retries are enabled', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('{"error":{"code":"internal"}}', {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(
      new Transport({
        auth: { apiKey: 'test-key' },
        fetch: fetcher,
        retryOther5xx: true,
      }).request({ method: 'POST', path: '/items', body: {}, kind: 'data' }),
    ).rejects.toMatchObject({ status: 500 });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('classifies a final 429 as a rate-limit API error', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('{"error":{"code":"rate_limited"}}', {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const result = transport(fetcher).request({ method: 'GET', path: '/items', kind: 'data' });
    await expect(result).rejects.toBeInstanceOf(CommerceRateLimitError);
    await expect(result).rejects.toBeInstanceOf(CommerceApiError);
  });

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
  it('rejects beyond its configured wait-queue cap', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fetcher = vi.fn(
      async () => new Response('{"data":1}', { headers: { 'content-type': 'application/json' } }),
    );
    const client = new Transport({
      auth: { apiKey: 'test-key' },
      fetch: fetcher,
      rateLimit: { requestsPerSecond: 1, burst: 1, maxQueue: 1 },
      timeoutMs: 5000,
    });
    const spec = { method: 'GET', path: '/items', kind: 'data' } as const;
    const first = client.request(spec);
    const second = client.request(spec);
    await expect(client.request(spec)).rejects.toBeInstanceOf(CommerceLocalRateLimitError);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(Promise.all([first, second])).resolves.toEqual([1, 1]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

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
