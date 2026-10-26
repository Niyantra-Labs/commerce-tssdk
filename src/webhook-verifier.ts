import { CommerceCryptoError, CommerceValidationError } from './errors.js';
import type { WebhookEventEnvelope } from './models/contracts.js';

/** Request headers as a `Headers` object or a plain record (lookups are case-insensitive). */
export type HeaderSource = Headers | Readonly<Record<string, string>>;
function header(source: HeaderSource, name: string): string | undefined {
  if (source instanceof Headers) return source.get(name) ?? undefined;
  return Object.entries(source).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}
function decodeHex(value: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new CommerceCryptoError('Malformed webhook signature');
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (part) => Number.parseInt(part, 16));
}
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Verifies current `v1` Niyantra webhook deliveries before JSON parsing. */
export class WebhookVerifier {
  private readonly secrets: readonly string[];

  constructor(
    secret: string | readonly string[],
    private readonly toleranceSeconds = 300,
  ) {
    const secrets = typeof secret === 'string' ? [secret] : secret;
    if (
      !secrets.length ||
      secrets.some((value) => !value) ||
      !Number.isSafeInteger(toleranceSeconds) ||
      toleranceSeconds < 0
    )
      throw new CommerceValidationError('Invalid webhook verifier configuration');
    this.secrets = [...secrets];
    Object.defineProperty(this, 'secrets', { enumerable: false });
  }

  /** Verify a delivery's v1 signature and timestamp over the raw body, then parse the event envelope. Rejects with `CommerceCryptoError`. */
  async verify(
    headers: HeaderSource,
    body: Uint8Array | string,
    now = Date.now(),
  ): Promise<WebhookEventEnvelope> {
    const version = header(headers, 'X-Niyantra-Signature-Version');
    const timestamp = header(headers, 'X-Niyantra-Timestamp');
    const signature = header(headers, 'X-Niyantra-Signature');
    if (version !== 'v1' || !timestamp || !signature || !/^\d+$/.test(timestamp))
      throw new CommerceCryptoError('Missing or invalid webhook signature headers');
    const epoch = Number(timestamp);
    if (!Number.isSafeInteger(epoch) || Math.abs(now / 1000 - epoch) > this.toleranceSeconds)
      throw new CommerceCryptoError('Webhook timestamp outside tolerance');
    const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
    const digest = hex(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))),
    );
    const actual = decodeHex(signature);
    const signed = new TextEncoder().encode(`${timestamp}.${digest}`);
    let matched = 0;
    for (const secret of this.secrets) {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, signed));
      matched |= Number(equal(expected, actual));
    }
    if (!matched) throw new CommerceCryptoError('Invalid webhook signature');
    let event: unknown;
    try {
      event = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (cause) {
      throw new CommerceCryptoError('Invalid webhook JSON', { cause });
    }
    if (
      !event ||
      typeof event !== 'object' ||
      typeof (event as { id?: unknown }).id !== 'string' ||
      typeof (event as { type?: unknown }).type !== 'string'
    ) {
      throw new CommerceCryptoError('Invalid webhook event envelope');
    }
    return event as WebhookEventEnvelope;
  }
}
