import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import {
  isKnownWebhookEvent,
  KNOWN_WEBHOOK_EVENT_TYPES,
  type WebhookEventBase,
} from '../src/webhook-events.js';

const envelope = (type: string, data: unknown): WebhookEventBase => ({
  id: 'evt_1',
  type,
  api_version: '2026-04-03',
  created_at: '2026-10-26T00:00:00Z',
  org_id: 'org_1',
  data,
});

describe('typed webhook events', () => {
  it('narrows known event types and their data', () => {
    const event = envelope('license.issued', { license: { id: 'lic_1', license_key: 'K-1' } });
    expect(isKnownWebhookEvent(event)).toBe(true);
    if (!isKnownWebhookEvent(event)) return;
    switch (event.type) {
      case 'license.issued':
        expect(event.data.license.license_key).toBe('K-1');
        // @ts-expect-error license events carry no payment
        void event.data.payment;
        break;
      case 'payment.failed':
        void event.data.payment.failure_reason;
        break;
      default:
        break;
    }
  });

  it('treats newer or malformed events as unknown instead of failing', () => {
    expect(isKnownWebhookEvent(envelope('invoice.issued', { invoice: {} }))).toBe(false);
    expect(isKnownWebhookEvent(envelope('license.issued', null))).toBe(false);
  });

  it("matches the server's KnownEventTypes when the Commerce source is available", (ctx) => {
    const source = `${process.env.COMMERCE_REPO ?? '../commerce'}/internal/domain/webhook/model.go`;
    if (!existsSync(source)) ctx.skip();
    const go = readFileSync(source, 'utf8');
    const constants = Object.fromEntries(
      [...go.matchAll(/^\s*(EventType\w+)\s*=\s*"([^"]+)"/gm)].map((m) => [m[1], m[2]]),
    );
    const list = /var KnownEventTypes = \[\]string\{([^}]*)\}/.exec(go)?.[1] ?? '';
    const serverTypes = [...list.matchAll(/(EventType\w+)/g)].map((m) => constants[m[1]!]);
    expect(serverTypes).toEqual([...KNOWN_WEBHOOK_EVENT_TYPES]);
  });
});
