import type { WebhookHandlerOptions } from '@niyantra/commerce';
import type { RequestHandler } from 'express';

export declare function createExpressWebhookHandler(options: WebhookHandlerOptions): RequestHandler;
