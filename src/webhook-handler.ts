import { CommerceCryptoError } from './errors.js';
import { isKnownWebhookEvent } from './webhook-events.js';
import type {
  KnownWebhookEventType,
  TypedWebhookEvent,
  WebhookEventBase,
} from './webhook-events.js';
import { WebhookVerifier } from './webhook-verifier.js';

/**
 * Durable replay protection. `runOnce` must atomically claim `event.id`, run the
 * callback only for the winner, and release the claim if the callback rejects.
 * Return true when the callback ran, false for an already processed event.
 * Store claims for longer than the verifier's timestamp tolerance.
 */
export interface WebhookDedupe {
  runOnce(eventId: string, callback: () => Promise<void>): Promise<boolean>;
}

export type WebhookHandlerMap = Partial<{
  [K in KnownWebhookEventType]: (
    event: Extract<TypedWebhookEvent, { readonly type: K }>,
  ) => void | Promise<void>;
}> & {
  /** Handles unknown future event types as well as known types without a specific handler. */
  '*'?: (event: WebhookEventBase) => void | Promise<void>;
};

export interface WebhookHandlerOptions {
  /** Current secret first; previous secrets may follow during rotation. */
  readonly secret?: string;
  readonly secrets?: readonly string[];
  readonly handlers: WebhookHandlerMap;
  readonly dedupe?: WebhookDedupe;
  readonly toleranceSeconds?: number;
}

/**
 * Build a framework-neutral `Request` → `Response` webhook endpoint.
 * Use the raw request body; a handler failure returns 500 so Commerce can retry.
 * A valid but unhandled event returns 204.
 *
 * @example
 * ```ts
 * const handle = defineWebhookHandler({
 *   secret: process.env.WEBHOOK_SECRET!,
 *   handlers: { '*': async (event) => { await record(event.id); } },
 * });
 * const response = await handle(request);
 * ```
 */
export function defineWebhookHandler(
  options: WebhookHandlerOptions,
): (request: Request) => Promise<Response> {
  if ((options.secret === undefined) === (options.secrets === undefined)) {
    throw new TypeError('Provide exactly one of secret or secrets');
  }
  const verifier = new WebhookVerifier(
    options.secrets ?? options.secret ?? [],
    options.toleranceSeconds,
  );

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    let event: WebhookEventBase;
    try {
      event = await verifier.verify(request.headers, new Uint8Array(await request.arrayBuffer()));
    } catch (error) {
      if (error instanceof CommerceCryptoError) return new Response(null, { status: 401 });
      return new Response(null, { status: 500 });
    }

    try {
      const dispatch = async () => {
        if (isKnownWebhookEvent(event)) {
          // The map's key and event discriminant agree; the cast preserves that correlation.
          const specific = options.handlers[event.type] as
            ((value: TypedWebhookEvent) => void | Promise<void>) | undefined;
          if (specific) {
            await specific(event);
            return;
          }
        }
        await options.handlers['*']?.(event);
      };
      if (options.dedupe) await options.dedupe.runOnce(event.id, dispatch);
      else await dispatch();
      return new Response(null, { status: 204 });
    } catch {
      return new Response(null, { status: 500 });
    }
  };
}
