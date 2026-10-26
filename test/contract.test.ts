/**
 * Service contract tests against the Commerce route manifest.
 *
 * test/fixtures/routes.json is generated from the server's Go handlers by
 * scripts/route-manifest.py. For every SDK method this suite checks, through
 * MSW, that the request hits a registered route with the expected verb, path,
 * and query; that it sends a JSON body exactly when the handler requires one;
 * and that the SDK decodes the envelope the handler really writes. It complements
 * the live Compose smoke test, which proves behavior against a running server.
 */
import { readFileSync } from 'node:fs';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '../src/index.js';
import { cases, IN } from './contract-cases.js';

interface RouteInfo {
  envelope: 'data' | 'list' | 'status' | 'direct' | 'raw' | 'unknown';
  status?: number;
  body?: 'required' | 'optional' | 'none' | 'multipart';
}

const routes: Record<string, RouteInfo> = JSON.parse(
  readFileSync(new URL('./fixtures/routes.json', import.meta.url), 'utf8'),
) as Record<string, RouteInfo>;

const BASE = 'https://commerce.test';
const SAMPLE = { id: 'fixture_1', status: 'active' };
const DIRECT = { fixture: true, results: [] };
const RAW = 'raw-fixture-bytes';

/** The registered pattern ServeMux would pick: literal segments beat wildcards. */
function matchRoute(method: string, path: string): string | undefined {
  const segments = path.split('/').filter(Boolean);
  let best: { pattern: string; wildcards: number } | undefined;
  for (const pattern of Object.keys(routes)) {
    const [verb, template] = pattern.split(' ') as [string, string];
    if (verb !== method) continue;
    const parts = template.split('/').filter(Boolean);
    if (parts.length !== segments.length) continue;
    let wildcards = 0;
    const ok = parts.every((part, i) => {
      if (part.startsWith('{')) return ++wildcards > 0;
      return part === segments[i];
    });
    if (ok && (!best || wildcards < best.wildcards)) best = { pattern, wildcards };
  }
  return best?.pattern;
}

interface Seen {
  pattern?: string | undefined;
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  rawBody: string;
  multipart?: FormData;
}
let seen: Seen[] = [];
let respondRaw = false;

const server = setupServer(
  http.all(`${BASE}/*`, async ({ request }) => {
    const url = new URL(request.url);
    const method = request.method;
    const contentType = request.headers.get('content-type') ?? '';
    const record: Seen = {
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: undefined,
      rawBody: '',
    };
    if (contentType.startsWith('multipart/form-data')) {
      record.multipart = await request.formData();
    } else {
      record.rawBody = await request.text();
      if (record.rawBody) record.body = JSON.parse(record.rawBody) as unknown;
    }
    if (url.pathname === '/health') {
      seen.push({ ...record, pattern: 'GET /health' });
      return HttpResponse.json({ status: 'ok' });
    }
    record.pattern = matchRoute(method, url.pathname);
    seen.push(record);
    const info = record.pattern ? routes[record.pattern] : undefined;
    if (!info) return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    if (info.envelope === 'raw' || respondRaw) {
      return new HttpResponse(RAW, {
        headers: {
          'content-type': 'application/octet-stream',
          'content-disposition': 'attachment; filename="fixture.bin"',
          'x-checksum-sha256': 'abc',
        },
      });
    }
    const status = info.status ?? 200;
    switch (info.envelope) {
      case 'data':
        return HttpResponse.json({ data: SAMPLE }, { status });
      case 'list':
        return HttpResponse.json({ data: [SAMPLE], total: 1 }, { status });
      case 'status':
        return HttpResponse.json({ status: 'ok' }, { status });
      default:
        return HttpResponse.json(DIRECT, { status });
    }
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  seen = [];
  respondRaw = false;
});
afterAll(() => server.close());

// The SDK captures fetch at construction; resolve it per call so MSW's patch applies.
const client = new Client({
  baseUrl: BASE,
  auth: { apiKey: 'sk_contract' },
  fetch: (input, init) => globalThis.fetch(input, init),
});

async function expectEnvelopeDecoded(
  result: unknown,
  envelope: RouteInfo['envelope'],
  raw: boolean,
) {
  if (envelope === 'raw' || raw) {
    const response =
      result instanceof Response ? result : (result as { response?: Response }).response;
    expect(response, 'raw routes must return the Response').toBeInstanceOf(Response);
    expect(await response!.text()).toBe(RAW);
    return;
  }
  switch (envelope) {
    case 'data':
      expect(result, 'handler writes {data}; the SDK must unwrap it').toEqual(SAMPLE);
      break;
    case 'list':
      expect(result).toEqual({ data: [SAMPLE], total: 1 });
      break;
    case 'status':
      // Status-only replies may be surfaced or discarded (void methods).
      if (result !== undefined) expect(result).toEqual({ status: 'ok' });
      break;
    default:
      expect(result, 'handler writes a direct JSON value; the SDK must not unwrap it').toEqual(
        DIRECT,
      );
  }
}

describe('service contracts against the server route manifest', () => {
  it.each(cases.map((c) => [`${String(c.service)}.${c.method}`, c] as const))(
    '%s',
    async (_name, c) => {
      respondRaw = c.raw ?? false;
      const result = await c.call(client);
      expect(seen, 'exactly one HTTP request').toHaveLength(1);
      const request = seen[0]!;
      expect(request.pattern, `${request.method} ${request.path} is not a registered route`).toBe(
        c.route,
      );
      expect(request.query).toEqual(c.query ?? {});

      const info: RouteInfo =
        c.route === 'GET /health' ? { envelope: 'status', body: 'none' } : routes[c.route]!;
      if (info.body === 'multipart') {
        expect(request.multipart, 'multipart route').toBeInstanceOf(FormData);
      } else if (info.body === 'required') {
        expect(request.body, 'handler rejects an empty body with 400').toEqual(c.body ?? IN);
      } else if (info.body === 'none') {
        expect(request.rawBody, 'handler reads no body').toBe('');
        expect(request.multipart, 'handler reads no multipart body').toBeUndefined();
      } else if (c.body !== undefined) {
        expect(request.body).toEqual(c.body);
      }
      await expectEnvelopeDecoded(result, info.envelope, c.raw ?? false);
    },
  );

  it('covers every public service method', () => {
    const covered = new Set(cases.map((c) => `${String(c.service)}.${c.method}`));
    const missing: string[] = [];
    const proto = Object.getPrototypeOf(client) as object;
    for (const name of Object.getOwnPropertyNames(proto)) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      if (!descriptor?.get || name === 'usageApiKey') continue;
      const service = (client as unknown as Record<string, object>)[name]!;
      for (
        let p = Object.getPrototypeOf(service) as object | null;
        p && p !== Object.prototype;
        p = Object.getPrototypeOf(p) as object | null
      ) {
        for (const method of Object.getOwnPropertyNames(p)) {
          // listAll is shared pagination over list(), covered in transport tests.
          if (['constructor', 'item', 'action', 'listAll'].includes(method)) continue;
          if (!covered.has(`${name}.${method}`)) missing.push(`${name}.${method}`);
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it('only calls registered routes', () => {
    const unregistered = cases
      .map((c) => c.route)
      .filter((route) => route !== 'GET /health' && !(route in routes));
    expect(unregistered).toEqual([]);
  });
});
