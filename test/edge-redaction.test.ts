import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { Client, CommerceApiError, Transport, WebhookVerifier } from '../src/index.js';

describe('secret-safe debug representations', () => {
  it('does not expose configured credentials or webhook secrets when inspecting instances', () => {
    expect(inspect(new Client({ auth: { apiKey: 'credential-secret' } }))).not.toContain(
      'credential-secret',
    );
    expect(inspect(new WebhookVerifier(['current-secret', 'previous-secret']))).not.toMatch(
      /current-secret|previous-secret/,
    );
  });
  it('keeps one-time secrets readable but redacts JSON and inspect output', async () => {
    const transport = new Transport({
      auth: { apiKey: 'credential-secret' },
      fetch: async () =>
        new Response(
          JSON.stringify({
            data: {
              id: 'key-1',
              secret_key: 'once-only-secret',
              nested: { license_key: 'license-secret' },
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    });
    const result = await transport.request<{
      id: string;
      secret_key: string;
      nested: { license_key: string };
    }>({
      method: 'POST',
      path: '/api-keys',
      kind: 'data',
    });
    expect(result.secret_key).toBe('once-only-secret');
    expect(result.nested.license_key).toBe('license-secret');
    for (const output of [JSON.stringify(result), inspect(result)]) {
      expect(output).not.toContain('once-only-secret');
      expect(output).not.toContain('license-secret');
      expect(output).toContain('[REDACTED]');
    }
  });

  it('redacts credential echoes and secret fields from API error inspection', async () => {
    const transport = new Transport({
      auth: { apiKey: 'credential-secret' },
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'bad_key',
              message: 'credential-secret denied',
              details: { secret_key: 'once-only-secret', reason: 'credential-secret was rejected' },
            },
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json', 'x-request-id': 'credential-secret' },
          },
        ),
    });
    const error = (await transport
      .request({ method: 'GET', path: '/items' })
      .catch((cause: unknown) => cause)) as CommerceApiError;
    expect(error).toBeInstanceOf(CommerceApiError);
    for (const output of [JSON.stringify(error), inspect(error)]) {
      expect(output).not.toContain('credential-secret');
      expect(output).not.toContain('once-only-secret');
    }
  });

  it('redacts a license key echoed outside a named error field', async () => {
    const transport = new Transport({
      auth: { apiKey: 'credential-secret' },
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'invalid_license',
              message: 'license-secret was rejected',
              details: { reason: 'license-secret belongs to another tenant' },
            },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    });
    const error = (await transport
      .request({
        method: 'POST',
        path: '/licenses/validate',
        body: { license_key: 'license-secret' },
      })
      .catch((cause: unknown) => cause)) as CommerceApiError;
    expect(inspect(error)).not.toContain('license-secret');
    expect(JSON.stringify(error)).not.toContain('license-secret');
  });
});
