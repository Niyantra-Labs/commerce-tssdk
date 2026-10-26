import { describe, expect, it, vi } from 'vitest';
import {
  asResult,
  Client,
  CommerceApiError,
  CommerceProtocolError,
  toDate,
  WebhookVerifier,
} from '../src/index.js';

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('Phase 1 server contracts', () => {
  it('encodes IDs and keeps request credentials in headers', async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.headers && new Headers(init.headers).get('X-API-Key')).toBe('sk_test');
      return json({ data: { id: 'x' } });
    });
    const client = new Client({ auth: { apiKey: 'sk_test' }, fetch: fetcher as typeof fetch });
    await client.products.get('a/b');
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/api/v1/products/a%2Fb');
  });

  it('returns a status response from license revoke without expecting a data envelope', async () => {
    const client = new Client({
      auth: { apiKey: 'sk_test' },
      fetch: async () => json({ status: 'revoked' }),
    });
    await expect(client.licenses.revoke('lic_1', { reason: 'test' })).resolves.toEqual({
      status: 'revoked',
    });
  });

  it('returns domain invalidation from HTTP 422', async () => {
    const client = new Client({
      auth: { apiKey: 'sk_test' },
      fetch: async () => json({ data: { valid: false, error_code: 'expired' } }, 422),
    });
    await expect(client.licenses.validate({ license_key: 'bad' })).resolves.toMatchObject({
      valid: false,
      error_code: 'expired',
    });
  });

  it('preserves API errors and rejects unsafe JSON numbers', async () => {
    const bad = new Client({
      auth: { apiKey: 'sk_test' },
      fetch: async () => json({ error: { code: 'not_found', message: 'missing' } }, 404),
    });
    await expect(bad.products.get('missing')).rejects.toBeInstanceOf(CommerceApiError);
    const unsafe = new Client({
      auth: { apiKey: 'sk_test' },
      fetch: async () =>
        new Response('{"data":{"amount":9007199254740993}}', {
          headers: { 'content-type': 'application/json' },
        }),
    });
    await expect(unsafe.products.get('id')).rejects.toBeInstanceOf(CommerceProtocolError);
  });

  it('signs usage with the server canonical form and sends identical body bytes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T12:00:00.000Z'));
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const bytes = new TextEncoder().encode(String(init?.body));
      const hash = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
      const canonical = `${headers.get('X-Usage-Timestamp')}\nPOST\n/api/v1/usage/reports\n${hash}`;
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode('sk_test_123'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const signature = Buffer.from(
        await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical)),
      ).toString('hex');
      expect(headers.get('X-Usage-Signature')).toBe(signature);
      expect(headers.get('X-Usage-Signature')).toBe(
        'e4010c4946ced0c01d79ab27fa885980221a2afea90e55ec3588f4f34461ecce',
      );
      return json({ results: [] });
    });
    const client = new Client({ auth: { apiKey: 'sk_test_123' }, fetch: fetcher as typeof fetch });
    await client.usageReporter.reportSingle({
      license_key: 'LIC-1',
      feature_key: 'api_calls',
      quantity: 10,
      period_start: '2026-04-03T00:00:00Z',
      period_end: '2026-04-03T01:00:00Z',
      idempotency_key: 'abc',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('verifies the server webhook v1 signature and rejects tampering', async () => {
    const body = new TextEncoder().encode('{"id":"evt_1","type":"license.issued"}');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const hash = Buffer.from(await crypto.subtle.digest('SHA-256', body)).toString('hex');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('whsec_test'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = Buffer.from(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${hash}`)),
    ).toString('hex');
    const headers = {
      'X-Niyantra-Signature-Version': 'v1',
      'X-Niyantra-Timestamp': timestamp,
      'X-Niyantra-Signature': signature,
    };
    const verifier = new WebhookVerifier('whsec_test');
    await expect(verifier.verify(headers, body)).resolves.toMatchObject({ id: 'evt_1' });
    await expect(
      verifier.verify(headers, new TextEncoder().encode('{"id":"tampered"}')),
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('does not retry a POST after a transient server failure', async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: 'unavailable', message: 'retry later' } }, 503),
    );
    const client = new Client({
      auth: { apiKey: 'sk_test' },
      fetch: fetcher as typeof fetch,
      maxRetries: 3,
    });
    await expect(
      client.licenses.create({ product_id: 'p', customer_id: 'c', license_type: 'perpetual' }),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('paginates using server total even when the server caps page size', async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      const offset = Number(new URL(String(url)).searchParams.get('offset') ?? 0);
      return json({ data: [{ id: String(offset) }], total: 3 });
    });
    const client = new Client({ auth: { apiKey: 'sk_test' }, fetch: fetcher as typeof fetch });
    const ids: string[] = [];
    for await (const item of client.products.listAll({ limit: 50 })) ids.push(item.id);
    expect(ids).toEqual(['0', '1', '2']);
  });

  it('normalizes an empty server list encoded as null', async () => {
    const client = new Client({
      auth: { apiKey: 'sk_test' },
      fetch: async () => json({ data: null, total: 0 }),
    });
    await expect(client.orders.list()).resolves.toEqual({ data: [], total: 0 });
  });

  it('sends org_id on webhook endpoint create (server requires it)', async () => {
    const fetcher = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.org_id).toBe('org_1');
      return json({ data: { endpoint: { id: 'ep_1' }, secret: 'whsec_x' } }, 201);
    });
    const client = new Client({ auth: { apiKey: 'sk_test' }, fetch: fetcher as typeof fetch });
    const result = await client.webhookEndpoints.create({
      org_id: 'org_1',
      url: 'https://example.test/hook',
    });
    expect(result.secret).toBe('whsec_x');
  });

  it('unwraps the nested event/endpoint_url shape from webhook event get', async () => {
    const client = new Client({
      auth: { apiKey: 'sk_test' },
      fetch: async () =>
        json({
          data: {
            event: { id: 'evt_1', status: 'delivered' },
            endpoint_url: 'https://example.test/hook',
          },
        }),
    });
    await expect(client.webhookEvents.get('evt_1')).resolves.toMatchObject({
      event: { id: 'evt_1', status: 'delivered' },
      endpoint_url: 'https://example.test/hook',
    });
  });

  it('provides strict date and result helpers', async () => {
    expect(toDate('2026-04-03T12:00:00Z').toISOString()).toBe('2026-04-03T12:00:00.000Z');
    expect(() => toDate('April 3, 2026')).toThrow();
    expect(await asResult(Promise.resolve(42))).toEqual({ ok: true, value: 42 });
  });
});

describe('affiliate and referral list filters', () => {
  const capture = () => {
    const urls: string[] = [];
    const client = new Client({
      auth: { apiKey: 'sk_test' },
      fetch: async (url) => {
        urls.push(String(url));
        return json({ data: [], total: 0 });
      },
    });
    return { client, urls };
  };

  it('sends reviewed=false instead of dropping a false boolean filter', async () => {
    const { client, urls } = capture();
    await client.affiliateEvents.list({ affiliate_id: 'aff_1', reviewed: false });
    const query = new URL(urls[0] ?? '').searchParams;
    expect(query.get('reviewed')).toBe('false');
    expect(query.get('affiliate_id')).toBe('aff_1');
  });

  it('sends the server-supported affiliate filters', async () => {
    const { client, urls } = capture();
    await client.affiliates.list({ commission_plan_id: 'cp_1', status: 'approved' });
    await client.affiliateLinks.list({ product_id: 'prod_1' });
    expect(new URL(urls[0] ?? '').searchParams.get('commission_plan_id')).toBe('cp_1');
    expect(new URL(urls[1] ?? '').searchParams.get('product_id')).toBe('prod_1');
  });

  it('only accepts filters the handlers read', async () => {
    const { client } = capture();
    // These handlers ignore search/status, so the types reject them.
    // @ts-expect-error referral codes accept no search filter
    await client.referralCodes.list({ search: 'x' });
    // @ts-expect-error affiliate events accept no status filter
    await client.affiliateEvents.list({ status: 'x' });
    // A null filter is a type error and, if forced through, fails before any request.
    // @ts-expect-error list filters are never null
    await expect(client.licenses.list({ product_id: null })).rejects.toThrow(/cannot be null/);
  });
});

describe('public type exports', () => {
  it('names every service result type from the package root', () => {
    type Results = [
      import('../src/index.js').GatewayProvider,
      import('../src/index.js').GatewayProviderSchema,
      import('../src/index.js').GatewayConfigTestResult,
      import('../src/index.js').NotificationTemplateDetail,
      import('../src/index.js').NotificationDetail,
      import('../src/index.js').ReleaseDownload,
      import('../src/index.js').EntitlementOverride,
      import('../src/index.js').ReleaseDetail,
    ];
    const count: Results['length'] = 8;
    expect(count).toBe(8);
  });
});
