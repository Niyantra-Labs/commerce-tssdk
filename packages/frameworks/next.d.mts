import type { WebhookHandlerOptions } from '@niyantra/commerce';

export declare function createNextWebhookRoute(
  options: WebhookHandlerOptions,
): (request: Request) => Promise<Response>;
