import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CommerceAbortError,
  CommerceApiError,
  CommerceNetworkError,
  CommerceProtocolError,
  CommerceTimeoutError,
  CommerceValidationError,
} from '../src/errors.js';
import { pathSegment, Transport, type Authentication } from '../src/transport.js';
import { toDate } from '../src/utils.js';

const json = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'application/json', ...headers } });
const client = (
  fetcher: typeof fetch,
  extras: Partial<ConstructorParameters<typeof Transport>[0]> = {},
) => new Transport({ auth: { apiKey: 'private-key' }, fetch: fetcher, ...extras });
const get = { method: 'GET', path: '/items', kind: 'list' } as const;

afterEach(() => vi.useRealTimers());

describe('retry and cancellation edges', () => {
  it.each([429, 503])(
    'does not repeat a mutation after HTTP %i even with retryable set',
    async (status) => {
      const fetcher = vi.fn(async () => json('{"error":{"code":"failed"}}', status));
      await expect(
        client(fetcher, { maxRetries: 2 }).request({
          method: 'POST',
          path: '/items',
          retryable: true,
        }),
      ).rejects.toMatchObject({ status, code: 'failed' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it('does not repeat a mutation after a network failure', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(
      client(fetcher).request({ method: 'PATCH', path: '/items/1' }),
    ).rejects.toBeInstanceOf(CommerceNetworkError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(['2', 'Sun, 25 Oct 2026 00:00:02 GMT'])(
    'honours Retry-After %s for GET',
    async (retryAfter) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-25T00:00:00Z'));
      const fetcher = vi.fn(async () =>
        fetcher.mock.calls.length === 1
          ? json('{"error":{}}', 429, { 'retry-after': retryAfter })
          : json('{"data":[],"total":0}'),
      );
      const result = client(fetcher, { timeoutMs: 5000 }).request(get);
      await vi.advanceTimersByTimeAsync(1999);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toEqual({ data: [], total: 0 });
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );

  it('rejects a pre-aborted signal without fetching', async () => {
    const fetcher = vi.fn(async () => json('{}'));
    const signal = AbortSignal.abort();
    await expect(client(fetcher).request(get, { signal })).rejects.toBeInstanceOf(
      CommerceAbortError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('aborts during retry backoff', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => json('{}', 503, { 'retry-after': '10' }));
    const controller = new AbortController();
    const result = client(fetcher).request(get, { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await expect(result).rejects.toBeInstanceOf(CommerceAbortError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts during the client rate wait', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => json('{"data":[],"total":0}'));
    const transport = client(fetcher, { rateLimit: { requestsPerSecond: 1 } });
    await transport.request(get);
    const controller = new AbortController();
    const result = transport.request(get, { signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toBeInstanceOf(CommerceAbortError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reports a timeout during fetch', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
        ),
    );
    const result = client(fetcher as typeof fetch, { timeoutMs: 20 }).request(get);
    const assertion = expect(result).rejects.toBeInstanceOf(CommerceTimeoutError);
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
  });
});

describe('response and input edges', () => {
  it.each(['<html>secret</html>', 'x'.repeat(5000)])(
    'limits non-JSON or huge error bodies',
    async (body) => {
      const error = await client(
        async () => new Response(body, { status: 400, headers: { 'x-request-id': 'req-7' } }),
      )
        .request(get)
        .catch((cause: unknown) => cause);
      expect(error).toBeInstanceOf(CommerceApiError);
      expect(error).toMatchObject({ status: 400, code: 'http_400', requestId: 'req-7' });
      expect(JSON.stringify(error)).not.toContain(body);
    },
  );

  it.each([
    ['missing data', '{"other":1}', 'data'],
    ['invalid list', '{"data":{},"total":0}', 'list'],
    ['unsafe integer', '{"data":9007199254740993}', 'data'],
    ['wrong content type', '{"data":1}', 'data'],
  ])('rejects %s as a protocol error', async (_name, body, kind) => {
    const fetcher = async () =>
      kind === 'data' && body === '{"data":1}'
        ? new Response(body, { headers: { 'content-type': 'text/plain' } })
        : json(body);
    await expect(
      client(fetcher).request({ method: 'GET', path: '/items', kind: kind as 'data' | 'list' }),
    ).rejects.toBeInstanceOf(CommerceProtocolError);
  });

  it('rejects a manual redirect as a protocol error', async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.redirect).toBe('manual');
      return new Response(null, { status: 302, headers: { location: 'https://elsewhere.test' } });
    });
    await expect(client(fetcher).request(get)).rejects.toBeInstanceOf(CommerceProtocolError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects a misleading content type', async () => {
    await expect(
      client(
        async () =>
          new Response('{"data":1}', { headers: { 'content-type': 'application/jsonish' } }),
      ).request({ method: 'GET', path: '/items', kind: 'data' }),
    ).rejects.toBeInstanceOf(CommerceProtocolError);
  });

  it('encodes an ID as one segment and rejects conflicting or empty credentials', async () => {
    expect(pathSegment('a/b?#')).toBe('a%2Fb%3F%23');
    expect(
      () => new Transport({ auth: { apiKey: 'a', bearerToken: 'b' } as unknown as Authentication }),
    ).toThrow(CommerceValidationError);
    const fetcher = vi.fn(async () => json('{}'));
    await expect(
      new Transport({ auth: { bearerToken: () => '' }, fetch: fetcher }).request(get),
    ).rejects.toBeInstanceOf(CommerceValidationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not expose credentials in API messages or network causes', async () => {
    const api = (await client(async () =>
      json('{"error":{"code":"bad","message":"private-key denied"}}', 401),
    )
      .request(get)
      .catch((cause: unknown) => cause)) as CommerceApiError;
    expect(api.message).not.toContain('private-key');
    const network = (await client(
      async () => {
        throw new Error('private-key leaked');
      },
      { maxRetries: 0 },
    )
      .request(get)
      .catch((cause: unknown) => cause)) as CommerceNetworkError;
    expect(network.message).not.toContain('private-key');
    expect(String(network.cause)).not.toContain('private-key');
  });

  it('preserves null, false, zero, empty values, and prunes undefined JSON properties', async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.body).toBe('{"clear":null,"enabled":false,"count":0,"tags":[],"name":""}');
      return json('{"data":{}}');
    });
    await client(fetcher).request({
      method: 'PATCH',
      path: '/items/1',
      kind: 'data',
      body: { missing: undefined, clear: null, enabled: false, count: 0, tags: [], name: '' },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects null queries and unsafe outbound integers before fetch', async () => {
    const fetcher = vi.fn(async () => json('{}'));
    const transport = client(fetcher);
    await expect(
      transport.request({ ...get, query: { id: null } as never }),
    ).rejects.toBeInstanceOf(CommerceValidationError);
    await expect(
      transport.request({ method: 'POST', path: '/items', body: { cents: 9007199254740992 } }),
    ).rejects.toBeInstanceOf(CommerceValidationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects unsafe numbers introduced by toJSON before fetch', async () => {
    const fetcher = vi.fn(async () => json('{"data":{}}'));
    const transport = client(fetcher);
    await expect(
      transport.request({
        method: 'POST',
        path: '/items',
        body: { toJSON: () => ({ amount_cents: 9007199254740992 }) },
        kind: 'data',
      }),
    ).rejects.toBeInstanceOf(CommerceValidationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects unsafe or malformed exact JSON before fetch', async () => {
    const fetcher = vi.fn(async () => json('{"data":{}}'));
    const transport = client(fetcher);
    for (const serializedBody of ['{"amount":9007199254740992}', '{invalid']) {
      await expect(
        transport.request({ method: 'POST', path: '/items', serializedBody }),
      ).rejects.toBeInstanceOf(CommerceValidationError);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not expose a toJSON exception or silently omit its body', async () => {
    const fetcher = vi.fn(async () => json('{"data":{}}'));
    const transport = client(fetcher);
    const secret = 'sk_private_from_serializer';
    const thrown = transport.request({
      method: 'POST',
      path: '/items',
      body: {
        toJSON: () => {
          throw new Error(secret);
        },
      },
    });
    await expect(thrown).rejects.toBeInstanceOf(CommerceValidationError);
    await expect(thrown).rejects.not.toThrow(secret);
    await expect(
      transport.request({ method: 'POST', path: '/items', body: { toJSON: () => undefined } }),
    ).rejects.toBeInstanceOf(CommerceValidationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('converts ISO-8601 timestamps explicitly', () => {
    expect(toDate('2026-10-25T00:00:00Z').toISOString()).toBe('2026-10-25T00:00:00.000Z');
    expect(() => toDate('2026-10-25')).toThrow(CommerceValidationError);
  });
});
