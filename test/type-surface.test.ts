import { expectTypeOf } from 'expect-type';
import { describe, it } from 'vitest';
import {
  Client,
  calculateProration,
  createLicensesBatch,
  defineWebhookHandler,
  isKnownWebhookEvent,
  type Authentication,
  type MiddlewareRequest,
  type CachedOfflineCertificate,
  type TypedWebhookEvent,
  type TransportMiddleware,
  type WebhookEventBase,
} from '../src/index.js';

describe('public type surface', () => {
  it('keeps exclusive credentials and typed webhook payloads', () => {
    expectTypeOf<Authentication>().toMatchTypeOf<
      { apiKey: string } | { bearerToken: string | (() => string | Promise<string>) }
    >();
    expectTypeOf<
      Extract<TypedWebhookEvent, { type: 'license.issued' }>['data']['license']['license_key']
    >().toEqualTypeOf<string>();
    expectTypeOf<CachedOfflineCertificate>().toEqualTypeOf<{
      readonly certificate: string;
      readonly signature: string;
    }>();
    expectTypeOf(isKnownWebhookEvent).guards.toEqualTypeOf<TypedWebhookEvent>();
  });

  it('accepts a Request and returns a Promise<Response>', () => {
    expectTypeOf(defineWebhookHandler).returns.toEqualTypeOf<
      (request: Request) => Promise<Response>
    >();
    expectTypeOf<Client['licenses']['validate']>().returns.toMatchTypeOf<
      Promise<{ readonly valid: boolean }>
    >();
    expectTypeOf<WebhookEventBase['data']>().toEqualTypeOf<unknown>();
  });

  it('keeps phase 3 middleware and helper contracts typed', () => {
    expectTypeOf<Client['use']>().parameter(0).toEqualTypeOf<TransportMiddleware>();
    expectTypeOf<MiddlewareRequest['path']>().toEqualTypeOf<string>();
    expectTypeOf(createLicensesBatch).returns.toEqualTypeOf<
      Promise<PromiseSettledResult<Awaited<ReturnType<Client['licenses']['create']>>>[]>
    >();
    expectTypeOf(calculateProration).returns.toMatchTypeOf<{ amount_cents: number } | undefined>();
  });
});
