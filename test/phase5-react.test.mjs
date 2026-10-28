import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Client } from '../src/index.ts';
import {
  licenseQueryOptions,
  subscriptionQueryOptions,
  usageQueryOptions,
  useLicense,
} from '../packages/react/index.mjs';

describe('private React Query companion', () => {
  it('keeps clients in separate caches without placing credentials in keys', async () => {
    const fetcher = vi.fn(async () =>
      globalThis.Response.json({ data: { id: 'license_1', status: 'active' } }),
    );
    const first = new Client({ auth: { bearerToken: 'secret_one' }, fetch: fetcher });
    const second = new Client({ auth: { bearerToken: 'secret_two' }, fetch: fetcher });
    const a = licenseQueryOptions(first, 'license_1');
    const b = licenseQueryOptions(second, 'license_1');
    expect(a.queryKey).not.toEqual(b.queryKey);
    expect(JSON.stringify([a.queryKey, b.queryKey])).not.toMatch(/secret_one|secret_two/);
    expect(subscriptionQueryOptions(first, undefined).enabled).toBe(false);
    expect(usageQueryOptions(first, 'license_1').queryKey).toContain('usage');
    const signal = new globalThis.AbortController().signal;
    expect((await a.queryFn({ signal })).id).toBe('license_1');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('renders an ID-disabled hook within a QueryClientProvider', () => {
    const client = new Client({ auth: { bearerToken: 'short_lived_token' } });
    function Probe() {
      const result = useLicense(client, undefined);
      return createElement('span', null, result.status);
    }
    const html = renderToString(
      createElement(QueryClientProvider, { client: new QueryClient() }, createElement(Probe)),
    );
    expect(html).toContain('pending');
  });
});
