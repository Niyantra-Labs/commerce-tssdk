import { expectTypeOf } from 'expect-type';
import { describe, it } from 'vitest';
import {
  Client,
  defineWebhookHandler,
  isKnownWebhookEvent,
  type Authentication,
  type CachedOfflineCertificate,
  type TypedWebhookEvent,
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
});
