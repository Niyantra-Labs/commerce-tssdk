/** Thin adapter for an injected OpenTelemetry tracer and meter. No runtime imports. */
export function createOtelHooks({ tracer, meter }) {
  const requests = meter.createCounter('commerce.http.requests');
  const retries = meter.createCounter('commerce.http.retries');
  const duration = meter.createHistogram('commerce.http.duration', { unit: 'ms' });
  const attributes = (event) => ({
    'commerce.method': event.method,
    'commerce.path': event.path,
    'commerce.attempt': event.attempt,
  });
  return {
    onRequest(event) {
      requests.add(1, attributes(event));
    },
    onResponse(event) {
      const attrs = { ...attributes(event), 'commerce.status': event.status };
      duration.record(event.durationMs, attrs);
      const span = tracer.startSpan('commerce.http.attempt', { attributes: attrs });
      span.end();
    },
    onRetry(event) {
      retries.add(1, { ...attributes(event), 'commerce.retry_reason': event.reason });
    },
  };
}
