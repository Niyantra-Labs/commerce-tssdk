import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Client,
  collectAll,
  CommerceAbortError,
  CommerceApiError,
  CommerceProtocolError,
  CommerceTimeoutError,
  CommerceValidationError,
  type Authentication,
  type ListParams,
} from '../src/index.js';

const page = (headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ data: [], total: 0 }), {
    headers: { 'content-type': 'application/json', ...headers },
  });

afterEach(() => vi.useRealTimers());

describe('transport behavior', () => {
  it('rejects ambiguous credentials, insecure remote URLs, and invalid settings', () => {
    expect(
      () =>
        new Client({
          auth: { apiKey: 'secret', bearerToken: 'token' } as unknown as Authentication,
        }),
    ).toThrow(CommerceValidationError);
    expect(
      () => new Client({ baseUrl: 'http://commerce.example.test', auth: { apiKey: 'secret' } }),
    ).toThrow(CommerceValidationError);
    expect(
      () => new Client({ auth: { apiKey: 'secret' }, rateLimit: { requestsPerSecond: 0 } }),
    ).toThrow(CommerceValidationError);
  });

  it('sends a fresh bearer token and prunes omitted query values', async () => {
    let token = 0;
    const fetcher = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer token-${++token}`);
      expect(new URL(String(url)).searchParams.toString()).toBe('limit=1&offset=0');
      return page();
    });
    const client = new Client({
      auth: { bearerToken: () => `token-${token + 1}` },
      fetch: fetcher as typeof fetch,
    });
    await client.products.list({ limit: 1, offset: 0, search: undefined } as unknown as ListParams);
    await client.products.list({ limit: 1, offset: 0 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('respects Retry-After for GET and does not repeat mutations', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T00:00:00Z'));
    const fetcher = vi.fn(async () =>
      fetcher.mock.calls.length === 1
        ? new Response(JSON.stringify({ error: { code: 'limited', message: 'slow down' } }), {
            status: 429,
            headers: { 'content-type': 'application/json', 'retry-after': '2' },
          })
        : page(),
    );
    const client = new Client({
      auth: { apiKey: 'secret' },
      fetch: fetcher as typeof fetch,
      maxRetries: 2,
      timeoutMs: 5000,
    });
    const result = client.products.list();
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ data: [], total: 0 });
    expect(fetcher).toHaveBeenCalledTimes(2);

    fetcher.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { code: 'limited', message: 'slow down' } }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(
      client.products.create({
        org_id: 'org',
        name: 'product',
        slug: 'product',
        product_type: 'saas',
      }),
    ).rejects.toMatchObject({ status: 429, code: 'limited' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('enforces a shared token bucket without over-releasing after a burst', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T00:00:00Z'));
    const sentAt: number[] = [];
    const client = new Client({
      auth: { apiKey: 'secret' },
      fetch: async () => {
        sentAt.push(Date.now());
        return page();
      },
      rateLimit: { requestsPerSecond: 1, burst: 2 },
      timeoutMs: 5000,
    });
    const requests = Array.from({ length: 4 }, () => client.products.list());
    expect(sentAt).toEqual([Date.now(), Date.now()]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sentAt).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all(requests);
    expect(sentAt).toEqual([
      Date.parse('2026-10-25T00:00:00Z'),
      Date.parse('2026-10-25T00:00:00Z'),
      Date.parse('2026-10-25T00:00:01Z'),
      Date.parse('2026-10-25T00:00:02Z'),
    ]);
  });

  it('cancels a rate wait and an in-flight fetch', async () => {
    vi.useFakeTimers();
    const client = new Client({
      auth: { apiKey: 'secret' },
      fetch: async () => page(),
      rateLimit: { requestsPerSecond: 1, burst: 1 },
    });
    await client.products.list();
    const controller = new AbortController();
    const waiting = client.products.list(undefined, { signal: controller.signal });
    controller.abort();
    await expect(waiting).rejects.toBeInstanceOf(CommerceAbortError);

    const hanging = new Client({
      auth: { apiKey: 'secret' },
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
      timeoutMs: 100,
      maxRetries: 0,
    });
    const timed = hanging.products.list();
    const timedAssertion = expect(timed).rejects.toBeInstanceOf(CommerceTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await timedAssertion;
  });

  it('applies the timeout while resolving a bearer token', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => page());
    const client = new Client({
      auth: { bearerToken: () => new Promise<string>(() => {}) },
      fetch: fetcher as typeof fetch,
      timeoutMs: 100,
    });
    const assertion = expect(client.products.list()).rejects.toBeInstanceOf(CommerceTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('handles non-JSON errors and rejects malformed success envelopes', async () => {
    const html = new Client({
      auth: { apiKey: 'secret' },
      fetch: async () => new Response('<h1>down</h1>', { status: 502 }),
      maxRetries: 0,
    });
    await expect(html.products.list()).rejects.toMatchObject({
      status: 502,
      code: 'http_502',
    } satisfies Partial<CommerceApiError>);
    const malformed = new Client({
      auth: { apiKey: 'secret' },
      fetch: async () =>
        new Response('{"data":{}}', { headers: { 'content-type': 'application/json' } }),
    });
    await expect(malformed.products.list()).rejects.toBeInstanceOf(CommerceProtocolError);
  });

  it('rejects impossible pagination totals and later-page failures', async () => {
    const negativeTotal = new Client({
      auth: { apiKey: 'secret' },
      fetch: async () =>
        new Response('{"data":[],"total":-1}', {
          headers: { 'content-type': 'application/json' },
        }),
    });
    await expect(negativeTotal.products.list()).rejects.toBeInstanceOf(CommerceProtocolError);

    const missingPage = new Client({
      auth: { apiKey: 'secret' },
      fetch: async (url) =>
        new Response(
          JSON.stringify(
            new URL(String(url)).searchParams.get('offset') === '0'
              ? { data: [{ id: 'first' }], total: 2 }
              : { data: [], total: 2 },
          ),
          { headers: { 'content-type': 'application/json' } },
        ),
    });
    await expect(collectAll(missingPage.products.listAll({ limit: 1 }))).rejects.toBeInstanceOf(
      CommerceProtocolError,
    );
  });

  it('stops collectAll at its cap', async () => {
    async function* items() {
      yield 1;
      yield 2;
    }
    await expect(collectAll(items(), 1)).rejects.toThrow('Pagination cap exceeded');
  });
});
