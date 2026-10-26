import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { CommerceAbortError, CommerceTimeoutError, Transport } from '../src/index.js';
import { SDK_VERSION } from '../src/utils.js';

const success = () =>
  new Response('{"data":1}', { headers: { 'content-type': 'application/json' } });
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('opt-in hooks', () => {
  it('emits frozen redacted events for each HTTP attempt and retry', async () => {
    vi.useFakeTimers();
    const events: unknown[] = [];
    const fetcher = vi.fn(async () =>
      fetcher.mock.calls.length === 1
        ? new Response('{"error":{}}', { status: 429, headers: { 'retry-after': '1' } })
        : success(),
    );
    const transport = new Transport({
      auth: { apiKey: 'api-secret' },
      fetch: fetcher,
      hooks: {
        onRequest: (event) => {
          events.push(event);
        },
        onResponse: (event) => {
          events.push(event);
        },
        onRetry: (event) => {
          events.push(event);
        },
      },
    });
    const result = transport.request(
      {
        method: 'GET',
        path: '/licenses/license-secret/verify',
        query: { token: 'query-secret' },
        body: { license_key: 'body-secret' },
        kind: 'data',
      },
      { requestId: 'req-1' },
    );
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe(1);
    expect(events).toHaveLength(5);
    expect(events.map((e) => (e as { attempt: number }).attempt)).toEqual([1, 1, 1, 2, 2]);
    expect(events[1]).toMatchObject({ status: 429, requestId: 'req-1' });
    expect(events[2]).toMatchObject({ reason: 'http_429', delayMs: 1000 });
    for (const event of events) {
      expect(Object.isFrozen(event)).toBe(true);
      expect(JSON.stringify(event)).not.toMatch(
        /api-secret|license-secret|body-secret|query-secret/,
      );
    }
  });

  it('ignores a throwing or rejecting hook and returns a raw response', async () => {
    const response = new Response('stream');
    const onResponse = vi.fn(() => Promise.reject(new Error('hook failure')));
    const transport = new Transport({
      auth: { apiKey: 'secret' },
      fetch: async () => response,
      hooks: {
        onRequest: () => {
          throw new Error('hook failure');
        },
        onResponse,
      },
    });
    await expect(
      transport.request({ method: 'GET', path: '/download', kind: 'raw' }),
    ).resolves.toBe(response);
    expect(onResponse).toHaveBeenCalledOnce();
  });

  it('emits onRequest before a caller aborts fetch and before a fetch timeout', async () => {
    vi.useFakeTimers();
    const events: unknown[] = [];
    const fetcher = (_url: URL | RequestInfo, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
      );
    const controller = new AbortController();
    const transport = new Transport({
      auth: { apiKey: 'secret' },
      fetch: fetcher as typeof fetch,
      timeoutMs: 20,
      hooks: {
        onRequest: (event) => {
          events.push(event);
        },
      },
    });
    const aborted = transport.request(
      { method: 'GET', path: '/items' },
      { signal: controller.signal },
    );
    controller.abort();
    await expect(aborted).rejects.toBeInstanceOf(CommerceAbortError);
    expect(events).toHaveLength(1);
    const timed = transport.request({ method: 'GET', path: '/items' });
    const assertion = expect(timed).rejects.toBeInstanceOf(CommerceTimeoutError);
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    expect(events).toHaveLength(2);
  });
});

describe('SDK identification', () => {
  it('keeps the generated version equal to package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(SDK_VERSION).toBe(pkg.version);
  });

  it.each([
    ['node', undefined, undefined, undefined],
    ['bun', { version: '1.1' }, undefined, undefined],
    ['deno', undefined, { version: { deno: '2.1' } }, undefined],
    ['workerd', undefined, undefined, class WebSocketPair {}],
  ])('sets User-Agent for %s', async (runtime, bun, deno, webSocketPair) => {
    if (bun) vi.stubGlobal('Bun', bun);
    if (deno) vi.stubGlobal('Deno', deno);
    if (webSocketPair) vi.stubGlobal('WebSocketPair', webSocketPair);
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('User-Agent')).toBe(
        `niyantra-commerce-ts/${SDK_VERSION} (${runtime})`,
      );
      return success();
    });
    await new Transport({ auth: { apiKey: 'secret' }, fetch: fetcher }).request({
      method: 'GET',
      path: '/items',
      kind: 'data',
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('does not add User-Agent or another identification header in browsers', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.has('User-Agent')).toBe(false);
      expect([...headers.keys()].sort()).toEqual(['accept', 'x-api-key']);
      return success();
    });
    await new Transport({ auth: { apiKey: 'secret' }, fetch: fetcher }).request({
      method: 'GET',
      path: '/items',
      kind: 'data',
    });
  });
});
