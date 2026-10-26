import { describe, expect, it } from 'vitest';
import { CommerceCryptoError, CommerceValidationError, WebhookVerifier } from '../src/index.js';

async function signed(body: Uint8Array, timestamp: string, secret = 'whsec_test') {
  const digest = Buffer.from(await crypto.subtle.digest('SHA-256', new Uint8Array(body))).toString(
    'hex',
  );
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = Buffer.from(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${digest}`)),
  ).toString('hex');
  return {
    'x-niyantra-signature-version': 'v1',
    'X-Niyantra-Timestamp': timestamp,
    'X-Niyantra-Signature': signature,
  };
}

describe('webhook verification boundaries', () => {
  const now = Date.parse('2026-10-25T00:00:00Z');
  const body = new TextEncoder().encode('{"id":"evt_1","type":"license.issued"}');

  it('accepts case-insensitive records and Headers at the timestamp boundary', async () => {
    const timestamp = String(now / 1000 - 300);
    const headers = await signed(body, timestamp);
    const verifier = new WebhookVerifier('whsec_test');
    await expect(verifier.verify(headers, body, now)).resolves.toMatchObject({ id: 'evt_1' });
    await expect(verifier.verify(new Headers(headers), body, now)).resolves.toMatchObject({
      type: 'license.issued',
    });
  });

  it('rejects stale and future signatures', async () => {
    const verifier = new WebhookVerifier('whsec_test');
    for (const seconds of [-301, 301]) {
      const headers = await signed(body, String(now / 1000 + seconds));
      await expect(verifier.verify(headers, body, now)).rejects.toThrow(
        'Webhook timestamp outside tolerance',
      );
    }
  });

  it('rejects a non-finite verification clock', async () => {
    const headers = await signed(body, String(now / 1000));
    await expect(new WebhookVerifier('whsec_test').verify(headers, body, NaN)).rejects.toThrow(
      'Invalid verification clock',
    );
  });

  it('rejects wrong versions, malformed signatures, and tampered bytes', async () => {
    const headers = await signed(body, String(now / 1000));
    const verifier = new WebhookVerifier('whsec_test');
    await expect(
      verifier.verify({ ...headers, 'x-niyantra-signature-version': 'v2' }, body, now),
    ).rejects.toBeInstanceOf(CommerceCryptoError);
    await expect(
      verifier.verify({ ...headers, 'X-Niyantra-Signature': 'abc' }, body, now),
    ).rejects.toThrow('Malformed webhook signature');
    await expect(
      verifier.verify(headers, new TextEncoder().encode('{"id":"changed"}'), now),
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('rejects invalid JSON and missing event identity after valid signing', async () => {
    const verifier = new WebhookVerifier('whsec_test');
    for (const [text, message] of [
      ['{', 'Invalid webhook JSON'],
      ['{"type":"license.issued"}', 'Invalid webhook event envelope'],
    ] as const) {
      const bytes = new TextEncoder().encode(text);
      const headers = await signed(bytes, String(now / 1000));
      await expect(verifier.verify(headers, bytes, now)).rejects.toThrow(message);
    }
  });

  it('accepts a previous secret during rotation and rejects it after removal', async () => {
    const headers = await signed(body, String(now / 1000), 'whsec_old');
    await expect(
      new WebhookVerifier(['whsec_current', 'whsec_old']).verify(headers, body, now),
    ).resolves.toMatchObject({ id: 'evt_1' });
    await expect(new WebhookVerifier(['whsec_current']).verify(headers, body, now)).rejects.toThrow(
      'Invalid webhook signature',
    );
  });

  it('rejects empty rotation lists and empty secrets without downgrading version checks', async () => {
    expect(() => new WebhookVerifier([])).toThrow(CommerceValidationError);
    expect(() => new WebhookVerifier(['whsec_current', ''])).toThrow(CommerceValidationError);
    const headers = await signed(body, String(now / 1000));
    await expect(
      new WebhookVerifier(['whsec_test']).verify(
        { ...headers, 'x-niyantra-signature-version': 'v0' },
        body,
        now,
      ),
    ).rejects.toBeInstanceOf(CommerceCryptoError);
  });
});
