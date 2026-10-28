import { expectTypeOf } from 'expect-type';
import { it } from 'vitest';
import type { RequestHandler } from 'express';
import { createNextWebhookRoute } from '../packages/frameworks/next.mjs';
import { createHonoWebhookHandler } from '../packages/frameworks/hono.mjs';
import { createExpressWebhookHandler } from '../packages/frameworks/express.mjs';

it('exposes Request-to-Response and Express handler types', () => {
  expectTypeOf<ReturnType<typeof createNextWebhookRoute>>().toEqualTypeOf<
    (request: Request) => Promise<Response>
  >();
  expectTypeOf<ReturnType<typeof createHonoWebhookHandler>>().toEqualTypeOf<
    (context: { req: { raw: Request } }) => Promise<Response>
  >();
  expectTypeOf<ReturnType<typeof createExpressWebhookHandler>>().toEqualTypeOf<RequestHandler>();
});
