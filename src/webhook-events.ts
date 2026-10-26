/**
 * Typed webhook events. Commerce publishes the event types below
 * (`webhook.KnownEventTypes` on the server), each with one `data` shape.
 * Future server versions may add types, so narrow with `isKnownWebhookEvent`
 * before switching on `event.type`:
 *
 * ```ts
 * const event = await verifier.verify(headers, body);
 * if (isKnownWebhookEvent(event)) {
 *   switch (event.type) {
 *     case 'license.issued':
 *       console.log(event.data.license.license_key);
 *       break;
 *     case 'payment.failed':
 *       console.log(event.data.payment.failure_reason);
 *       break;
 *   }
 * }
 * ```
 */
import type { License, Order, Payment, Subscription } from './models/generated.js';

/** Every event type the server publishes, in its own order. */
export const KNOWN_WEBHOOK_EVENT_TYPES = [
  'webhook.test',
  'order.created',
  'order.fulfilled',
  'payment.pending',
  'payment.captured',
  'payment.failed',
  'payment.refunded',
  'payment.disputed',
  'subscription.created',
  'subscription.renewed',
  'subscription.canceled',
  'subscription.paused',
  'subscription.resumed',
  'license.issued',
  'license.revoked',
] as const;

export type KnownWebhookEventType = (typeof KNOWN_WEBHOOK_EVENT_TYPES)[number];

/** The `data` object of each known event type. */
export interface WebhookEventDataMap {
  'webhook.test': {
    readonly message: string;
    readonly endpoint_id: string;
    readonly url: string;
    readonly sent_at: string;
  };
  'order.created': { readonly order: Order };
  'order.fulfilled': { readonly order: Order };
  'payment.pending': { readonly payment: Payment };
  'payment.captured': { readonly payment: Payment };
  'payment.failed': { readonly payment: Payment };
  'payment.refunded': { readonly payment: Payment };
  'payment.disputed': { readonly payment: Payment };
  'subscription.created': { readonly subscription: Subscription };
  'subscription.renewed': { readonly subscription: Subscription };
  'subscription.canceled': { readonly subscription: Subscription };
  'subscription.paused': { readonly subscription: Subscription };
  'subscription.resumed': { readonly subscription: Subscription };
  'license.issued': { readonly license: License };
  'license.revoked': { readonly license: License };
}

/** The envelope every delivery carries, before its type is narrowed. */
export interface WebhookEventBase {
  readonly id: string;
  readonly type: string;
  readonly api_version: string;
  readonly created_at: string;
  readonly org_id: string;
  readonly data: unknown;
}

/** A known event: `switch (event.type)` narrows `event.data`. */
export type TypedWebhookEvent = {
  [K in KnownWebhookEventType]: WebhookEventBase & {
    readonly type: K;
    readonly data: WebhookEventDataMap[K];
  };
}[KnownWebhookEventType];

const known: ReadonlySet<string> = new Set(KNOWN_WEBHOOK_EVENT_TYPES);

/**
 * Whether a verified event has a type this SDK knows, narrowing it to
 * `TypedWebhookEvent`. Events of newer types return false; handle or ignore
 * them rather than failing the delivery.
 */
export function isKnownWebhookEvent(event: WebhookEventBase): event is TypedWebhookEvent {
  return known.has(event.type) && typeof event.data === 'object' && event.data !== null;
}
