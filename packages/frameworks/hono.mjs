import { defineWebhookHandler } from '@niyantra/commerce';

/** Hono handler; pass c.req.raw without parsing or reserializing its body. */
export function createHonoWebhookHandler(options) {
  const handle = defineWebhookHandler(options);
  return (context) => handle(context.req.raw);
}
