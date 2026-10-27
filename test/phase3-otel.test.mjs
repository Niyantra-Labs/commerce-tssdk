import { describe, expect, it, vi } from 'vitest';
import { createOtelHooks } from '../packages/otel/index.mjs';

describe('optional telemetry adapter', () => {
  it('records only supplied redacted hook metadata', () => {
    const add = vi.fn();
    const record = vi.fn();
    const end = vi.fn();
    const startSpan = vi.fn(() => ({ end }));
    const hooks = createOtelHooks({
      tracer: { startSpan },
      meter: {
        createCounter: () => ({ add }),
        createHistogram: () => ({ record }),
      },
    });
    const event = Object.freeze({
      method: 'GET',
      path: '/api/v1/licenses',
      attempt: 1,
      durationMs: 12,
    });
    hooks.onRequest(event);
    hooks.onResponse({ ...event, status: 200 });
    hooks.onRetry({ ...event, reason: 'http_503', delayMs: 100 });
    expect(add).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenCalledWith(12, {
      'commerce.method': 'GET',
      'commerce.path': '/api/v1/licenses',
      'commerce.attempt': 1,
      'commerce.status': 200,
    });
    expect(startSpan).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
    expect(JSON.stringify([add.mock.calls, record.mock.calls])).not.toMatch(/secret|token/);
  });
});
