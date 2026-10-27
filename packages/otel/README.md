# Optional OpenTelemetry adapter

This unpublished adapter converts the SDK's redacted hooks into counters, a duration histogram, and attempt spans. It accepts an OpenTelemetry-compatible tracer and meter supplied by the application; the core SDK imports no telemetry library.

```ts
import { createOtelHooks } from '@niyantra/commerce-otel';

const client = new Client({ auth: { apiKey }, hooks: createOtelHooks({ tracer, meter }) });
```

The adapter records collection-level paths only. Hook callbacks run synchronously and should use a fast, nonblocking exporter. Span start/end happens when a response arrives; the measured duration is recorded separately.
