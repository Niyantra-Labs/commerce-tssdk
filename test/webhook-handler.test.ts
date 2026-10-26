import { describe, expect, it } from 'vitest';
import {
  CommerceCryptoError,
  WebhookVerifier,
  defineWebhookHandler,
  type WebhookDedupe,
} from '../src/index.js';

const secret = 'whsec_test';

async function delivery(
  body: string,
  key = secret,
  timestamp = String(Math.floor(Date.now() / 1000)),
) {
  const bytes = new TextEncoder().encode(body);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const hmac = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = Array.from(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', hmac, new TextEncoder().encode(`${timestamp}.${digest}`)),
    ),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  return new Request('http://localhost/webhook', {
    method: 'POST',
    headers: {
      'X-Niyantra-Signature-Version': 'v1',
      'X-Niyantra-Timestamp': timestamp,
      'X-Niyantra-Signature': signature,
    },
    body,
  });
}

describe('defineWebhookHandler', () => {
  const known = JSON.stringify({ id: 'evt_1', type: 'webhook.test', data: { message: 'hi' } });

  it('dispatches a signed known event and ignores invalid signatures', async () => {
    const seen: string[] = [];
    const handle = defineWebhookHandler({
      secret,
      handlers: {
        'webhook.test': (event) => {
          seen.push(event.data.message);
        },
      },
    });
    expect((await handle(await delivery(known))).status).toBe(204);
    expect((await handle(await delivery(known, 'wrong'))).status).toBe(401);
    expect(seen).toEqual(['hi']);
  });

  it('routes unknown types to the fallback and accepts rotated secrets', async () => {
    const seen: string[] = [];
    const handle = defineWebhookHandler({
      secrets: ['current', secret],
      handlers: {
        '*': (event) => {
          seen.push(event.type);
        },
      },
    });
    const body = JSON.stringify({ id: 'evt_future', type: 'future.event', data: {} });
    expect((await handle(await delivery(body))).status).toBe(204);
    expect(seen).toEqual(['future.event']);
  });

  it('uses an atomic dedupe store and returns 500 when handling fails', async () => {
    const handled = new Set<string>();
    const dedupe: WebhookDedupe = {
      async runOnce(id, callback) {
        if (handled.has(id)) return false;
        await callback();
        handled.add(id);
        return true;
      },
    };
    let calls = 0;
    const handle = defineWebhookHandler({
      secret,
      dedupe,
      handlers: {
        '*': () => {
          calls++;
          if (calls === 1) throw new Error('transient');
        },
      },
    });
    expect((await handle(await delivery(known))).status).toBe(500);
    expect((await handle(await delivery(known))).status).toBe(204);
    expect((await handle(await delivery(known))).status).toBe(204);
    expect(calls).toBe(2);
  });

  it('rejects non-POST requests and conflicting or missing secrets', async () => {
    const handlers = {};
    expect(() => defineWebhookHandler({ handlers })).toThrow('exactly one');
    expect(() => defineWebhookHandler({ secret, secrets: [secret], handlers })).toThrow(
      'exactly one',
    );
    const handle = defineWebhookHandler({ secret, handlers });
    expect((await handle(new Request('http://localhost/webhook'))).status).toBe(405);
  });

  it('does not expose license keys through malformed JSON causes', async () => {
    const key = 'ABCD-1234-5678-9876';
    const request = await delivery(`{"id":"evt_1","license_key":"${key}",`);
    const verifier = new WebhookVerifier(secret);
    await expect(
      verifier.verify(request.headers, await request.arrayBuffer().then((b) => new Uint8Array(b))),
    ).rejects.toSatisfy(
      (error: CommerceCryptoError) =>
        error instanceof CommerceCryptoError &&
        !JSON.stringify(error).includes(key) &&
        error.cause === undefined,
    );
  });
});
