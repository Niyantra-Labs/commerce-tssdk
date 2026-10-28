import { defineWebhookHandler } from '@niyantra/commerce';

/** A Next.js App Router POST export can use this Request-to-Response handler directly. */
export function createNextWebhookRoute(options) {
  return defineWebhookHandler(options);
}
