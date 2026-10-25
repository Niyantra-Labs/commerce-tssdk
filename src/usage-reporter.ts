import type { UsageIngestResult, UsageReportInput } from './models/contracts.js';
import { CommerceValidationError } from './errors.js';
import type { RequestOptions } from './transport.js';
import { Transport } from './transport.js';

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Sends usage batches signed with the current Commerce server protocol. */
export class UsageReporter {
  constructor(private readonly http: Transport) {
    if (!http.apiKey)
      throw new CommerceValidationError('Usage reports require API-key authentication');
  }

  async report(
    reports: readonly UsageReportInput[],
    options?: RequestOptions,
  ): Promise<UsageIngestResult> {
    if (reports.length < 1 || reports.length > 100)
      throw new CommerceValidationError('Usage batch must contain 1–100 reports');
    for (const item of reports) {
      if (
        !item.idempotency_key ||
        !item.license_key ||
        !item.feature_key ||
        !Number.isSafeInteger(item.quantity) ||
        !Number.isFinite(Date.parse(item.period_start)) ||
        !Number.isFinite(Date.parse(item.period_end)) ||
        Date.parse(item.period_end) <= Date.parse(item.period_start)
      ) {
        throw new CommerceValidationError('Invalid usage report');
      }
    }
    const body = JSON.stringify({ reports });
    const bytes = new TextEncoder().encode(body);
    if (bytes.byteLength > 2 * 1024 * 1024)
      throw new CommerceValidationError('Usage batch exceeds 2 MiB');
    const timestamp = new Date().toISOString();
    const hash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
    const canonical = `${timestamp}\nPOST\n/api/v1/usage/reports\n${hash}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.http.apiKey!),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = hex(
      new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical))),
    );
    return this.http.request(
      {
        method: 'POST',
        path: '/usage/reports',
        serializedBody: body,
        headers: { 'X-Usage-Timestamp': timestamp, 'X-Usage-Signature': signature },
      },
      options,
    );
  }

  reportSingle(report: UsageReportInput, options?: RequestOptions): Promise<UsageIngestResult> {
    return this.report([report], options);
  }
}
