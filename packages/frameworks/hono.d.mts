import type { WebhookHandlerOptions } from '@niyantra/commerce';

export declare function createHonoWebhookHandler(
  options: WebhookHandlerOptions,
): (context: { req: { raw: Request } }) => Promise<Response>;
