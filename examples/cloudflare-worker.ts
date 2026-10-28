import { defineWebhookHandler, type WebhookHandlerMap } from '@niyantra/commerce';

interface Env {
  COMMERCE_WEBHOOK_SECRET: string;
}

/** Copy this factory into a Worker and supply handlers backed by durable storage. */
export function createCommerceWorker(handlers: WebhookHandlerMap) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      if (new URL(request.url).pathname !== '/webhooks/commerce')
        return new Response(null, { status: 404 });
      return defineWebhookHandler({ secret: env.COMMERCE_WEBHOOK_SECRET, handlers })(request);
    },
  };
}
