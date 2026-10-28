import { describe, expect, it } from 'vitest';
import { createNextWebhookRoute } from '../packages/frameworks/next.mjs';
import { createHonoWebhookHandler } from '../packages/frameworks/hono.mjs';
import { createExpressWebhookHandler } from '../packages/frameworks/express.mjs';

async function signedDelivery() {
  const body = JSON.stringify({ id: 'evt_1', type: 'webhook.test', data: { message: 'hi' } });
  const bytes = new globalThis.TextEncoder().encode(body);
  const hex = (value) =>
    Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const digest = hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new globalThis.TextEncoder().encode('whsec_framework'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = hex(
    await globalThis.crypto.subtle.sign(
      'HMAC',
      key,
      new globalThis.TextEncoder().encode(`${timestamp}.${digest}`),
    ),
  );
  return new globalThis.Request('https://commerce.test/webhook', {
    method: 'POST',
    headers: {
      'X-Niyantra-Signature-Version': 'v1',
      'X-Niyantra-Timestamp': timestamp,
      'X-Niyantra-Signature': signature,
    },
    body: bytes,
  });
}

describe('private framework webhook adapters', () => {
  it('passes raw signed bytes through Next, Hono, and Express shapes', async () => {
    const seen = [];
    const options = {
      secret: 'whsec_framework',
      handlers: { 'webhook.test': (event) => seen.push(event.id) },
    };
    expect((await createNextWebhookRoute(options)(await signedDelivery())).status).toBe(204);
    expect(
      (await createHonoWebhookHandler(options)({ req: { raw: await signedDelivery() } })).status,
    ).toBe(204);

    const delivery = await signedDelivery();
    const status = { code: 0 };
    const response = {
      status(code) {
        status.code = code;
        return this;
      },
      setHeader() {},
      end() {},
    };
    await createExpressWebhookHandler(options)(
      {
        method: 'POST',
        url: '/webhook',
        headers: Object.fromEntries(delivery.headers),
        body: new Uint8Array(await delivery.arrayBuffer()),
      },
      response,
      (error) => {
        throw error;
      },
    );
    expect(status.code).toBe(204);
    expect(seen).toEqual(['evt_1', 'evt_1', 'evt_1']);
  });

  it('rejects an already-parsed Express body', async () => {
    let status = 0;
    const response = {
      status(code) {
        status = code;
        return this;
      },
      end() {},
    };
    await createExpressWebhookHandler({ secret: 'whsec_framework', handlers: {} })(
      { method: 'POST', headers: {}, body: { parsed: true } },
      response,
      () => {},
    );
    expect(status).toBe(415);
  });
});
