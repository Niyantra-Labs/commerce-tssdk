import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Client } from '../src/index.ts';
import { createCommerceHandlers, routes } from '../packages/msw-mocks/index.mjs';

const server = setupServer(
  ...createCommerceHandlers({
    baseUrl: 'https://commerce.test',
    respond: (route) => {
      if (route.key === 'GET /api/v1/products')
        return HttpResponse.json({ data: [{ id: 'product_1' }], total: 1 });
      if (route.key === 'GET /api/v1/products/{id}')
        return HttpResponse.json({ data: { id: 'product_1' } });
      throw new Error(`No fixture for ${route.key}`);
    },
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

describe('generated MSW routes', () => {
  it('covers the checked manifest and returns caller-supplied fixtures', async () => {
    expect(routes.length).toBeGreaterThan(200);
    const client = new Client({
      baseUrl: 'https://commerce.test',
      auth: { apiKey: 'sk_fixture' },
      fetch: (input, init) => globalThis.fetch(input, init),
    });
    expect((await client.products.list()).data[0]?.id).toBe('product_1');
    expect((await client.products.get('product_1')).id).toBe('product_1');
  });
});
