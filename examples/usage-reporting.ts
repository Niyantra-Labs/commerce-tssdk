import { Client } from '@niyantra/commerce';

const client = new Client({
  baseUrl: process.env.COMMERCE_URL ?? 'http://localhost:9094',
  auth: { apiKey: process.env.COMMERCE_API_KEY ?? '' },
});

const periodEnd = new Date();
const periodStart = new Date(periodEnd.getTime() - 60_000);
await client.usageReporter.reportSingle({
  license_key: process.env.COMMERCE_LICENSE_KEY ?? '',
  feature_key: 'api_calls',
  quantity: 1,
  period_start: periodStart.toISOString(),
  period_end: periodEnd.toISOString(),
  idempotency_key: crypto.randomUUID(),
});
