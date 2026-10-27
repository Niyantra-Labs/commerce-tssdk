import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client, CommerceValidationError, type CommerceLogger } from '../src/index.js';

const page = () =>
  new Response('{"data":[],"total":0}', { headers: { 'content-type': 'application/json' } });

afterEach(() => vi.useRealTimers());

describe('phase 3 transport extensions', () => {
  it('logs redacted frozen attempt metadata only when debug is enabled', async () => {
    const debug = vi.fn();
    const logger: CommerceLogger = {
      debug,
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const fetcher = vi.fn(async () => page());
    const client = new Client({ auth: { apiKey: 'api-secret' }, fetch: fetcher, logger });
    await client.licenses.list({ search: 'query-secret' });
    expect(debug).not.toHaveBeenCalled();

    const noisy = new Client({
      auth: { apiKey: 'api-secret' },
      fetch: fetcher,
      logger,
      debug: true,
    });
    await noisy.licenses.list({ search: 'query-secret' });
    expect(debug).toHaveBeenCalledTimes(2);
    for (const [name, event] of debug.mock.calls) {
      expect(name).toMatch(/^commerce\.(request|response)$/);
      expect(Object.isFrozen(event)).toBe(true);
      expect(JSON.stringify(event)).not.toMatch(/api-secret|query-secret/);
    }
  });

  it('runs middleware in order around the response without exposing request bytes', async () => {
    const order: string[] = [];
    const fetcher = vi.fn(async () => page());
    const client = new Client({ auth: { apiKey: 'api-secret' }, fetch: fetcher });
    client.use(async (request, next) => {
      order.push('first before');
      expect(Object.isFrozen(request)).toBe(true);
      expect(JSON.stringify(request)).not.toContain('api-secret');
      const response = await next(request);
      order.push('first after');
      return response;
    });
    client.use(async (request, next) => {
      order.push('second before');
      const response = await next(request);
      order.push('second after');
      return { ...(response as object), total: 7 };
    });
    await expect(client.products.list({ search: 'query-secret' })).resolves.toMatchObject({
      total: 7,
    });
    expect(order).toEqual(['first before', 'second before', 'second after', 'first after']);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('refuses middleware request replacement and duplicate next calls', async () => {
    const fetcher = vi.fn(async () => page());
    const client = new Client({ auth: { apiKey: 'secret' }, fetch: fetcher });
    client.use((_request, next) => next({ method: 'GET', path: '/api/v1/products' }));
    await expect(client.products.list()).rejects.toBeInstanceOf(CommerceValidationError);
    expect(fetcher).not.toHaveBeenCalled();

    const duplicate = new Client({ auth: { apiKey: 'secret' }, fetch: fetcher });
    duplicate.use(async (request, next) => {
      await next(request);
      return next(request);
    });
    await expect(duplicate.products.list()).rejects.toBeInstanceOf(CommerceValidationError);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('injects safe per-call headers and blocks protected or signed headers', async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('X-Trace-Tag')).toBe('tag-secret');
      return page();
    });
    const client = new Client({ auth: { apiKey: 'secret' }, fetch: fetcher as typeof fetch });
    await client.products.list(undefined, { headers: { 'X-Trace-Tag': 'tag-secret' } });
    for (const name of ['Authorization', 'X-API-Key', 'X-Usage-Signature', 'X-Org-ID']) {
      await expect(
        client.products.list(undefined, { headers: { [name]: 'override' } }),
      ).rejects.toBeInstanceOf(CommerceValidationError);
    }
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('redacts a custom header value echoed by an injected fetch failure', async () => {
    const client = new Client({
      auth: { apiKey: 'secret' },
      maxRetries: 0,
      fetch: async () => {
        throw new Error('trace header value: custom-secret');
      },
    });
    await expect(
      client.products.list(undefined, { headers: { 'X-Trace-Tag': 'custom-secret' } }),
    ).rejects.toMatchObject({ cause: new Error('Fetch failed') });
  });

  it('rejects invalid header bytes without echoing their value', async () => {
    const fetcher = vi.fn(async () => page());
    const client = new Client({ auth: { apiKey: 'secret' }, fetch: fetcher });
    const invalid = 'sensitive\nheader';
    await expect(
      client.products.list(undefined, { headers: { 'X-Trace-Tag': invalid } }),
    ).rejects.toThrow('Invalid request header');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses deterministic multiplier backoff and validates retry tuning', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () =>
      fetcher.mock.calls.length < 3 ? new Response(null, { status: 503 }) : page(),
    );
    const client = new Client({
      auth: { apiKey: 'secret' },
      fetch: fetcher,
      backoffMultiplier: 3,
      jitter: 'none',
      timeoutMs: 10_000,
    });
    const result = client.products.list();
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ data: [], total: 0 });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(() => new Client({ auth: { apiKey: 'x' }, backoffMultiplier: 0 })).toThrow(
      CommerceValidationError,
    );
  });
});
