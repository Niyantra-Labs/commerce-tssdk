import { describe, expect, it } from 'vitest';
import { createCommerceWorker } from '../examples/cloudflare-worker.js';

describe('Cloudflare Worker example', () => {
  it('routes only Commerce webhooks and rejects invalid signatures', async () => {
    const worker = createCommerceWorker({});
    const env = { COMMERCE_WEBHOOK_SECRET: 'whsec_example' };
    const missing = await worker.fetch(new Request('https://worker.test/other'), env);
    expect(missing.status).toBe(404);
    const invalid = await worker.fetch(
      new Request('https://worker.test/webhooks/commerce', { method: 'POST', body: '{}' }),
      env,
    );
    expect(invalid.status).toBe(401);
  });
});
