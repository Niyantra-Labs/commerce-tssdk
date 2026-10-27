/**
 * Runtime-neutral SDK checks. Uses only web-standard globals (fetch, crypto,
 * TextEncoder, atob) plus the built package, so the same module runs in Node,
 * Bun, Deno, Cloudflare Workers (workerd), and browsers. The config is produced
 * by integration/runtime-smoke.mjs against the live Compose server.
 */
/* global atob, AbortController -- web-standard globals present in every target runtime */
import {
  Client,
  CommerceAbortError,
  CommerceApiError,
  CommerceNetworkError,
  generateMachineFingerprint,
  OfflineVerifier,
  WebhookVerifier,
} from '../../dist/index.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function base64Bytes(value) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

/**
 * @param {Record<string, any>} config
 * @param {{ name: string, browser?: boolean }} runtime
 */
export async function runChecks(config, runtime) {
  const results = [];
  const check = async (name, fn) => {
    try {
      const note = await fn();
      results.push({ name, ok: true, ...(note && { note }) });
    } catch (error) {
      results.push({ name, ok: false, error: `${error?.name}: ${error?.message}` });
    }
  };
  const anonymous = new Client({ baseUrl: config.baseUrl, auth: { apiKey: 'no-credentials' } });
  const keyed = new Client({ baseUrl: config.baseUrl, auth: { apiKey: config.apiKey } });

  await check('health over fetch (unprefixed, unauthenticated)', async () => {
    assert((await anonymous.system.health()).status === 'ok', 'health is not ok');
  });

  await check('machine fingerprint matches server-issued certificate across runtimes', async () => {
    const fingerprint = await generateMachineFingerprint(config.fingerprintInput);
    assert(fingerprint === config.fingerprint, 'fingerprint differs by runtime');
  });

  await check('license validation (public route)', async () => {
    const result = await anonymous.licenses.validate({ license_key: config.licenseKey });
    assert(result.valid === true, `license invalid: ${JSON.stringify(result)}`);
  });

  await check('API-key list and listAll pagination', async () => {
    const page = await keyed.products.list({ limit: 1 });
    assert(page.data.length === 1, 'expected one product on the first page');
    let seen = 0;
    for await (const product of keyed.products.listAll({ limit: 1 })) {
      assert(product.id, 'product without an id');
      seen += 1;
    }
    assert(seen === page.total, `listAll yielded ${seen} of ${page.total}`);
  });

  await check(
    'offline certificate: server Ed25519 signature verified with Web Crypto',
    async () => {
      const key = await anonymous.system.signingKey();
      const verifier = new OfflineVerifier(key.public_key);
      const valid = await verifier.verify(config.certificate, config.signature, config.fingerprint);
      assert(valid.valid === true, `expected valid: ${JSON.stringify(valid)}`);
      const wrongMachine = await verifier.verify(
        config.certificate,
        config.signature,
        'other-machine',
      );
      assert(wrongMachine.valid === false, 'fingerprint mismatch accepted');
    },
  );

  await check('webhook: real server delivery HMAC verified with Web Crypto', async () => {
    const verifier = new WebhookVerifier(config.webhook.secret);
    const body = base64Bytes(config.webhook.body);
    const envelope = await verifier.verify(config.webhook.headers, body);
    assert(envelope.type === 'webhook.test', `unexpected event ${envelope.type}`);
    body[0] ^= 0xff;
    let rejected = false;
    try {
      await verifier.verify(config.webhook.headers, body);
    } catch {
      rejected = true;
    }
    assert(rejected, 'tampered body accepted');
  });

  await check('signed usage report (HMAC over the exact body)', async () => {
    const now = Date.now();
    const report = () =>
      keyed.usageReporter.reportSingle({
        license_key: config.licenseKey,
        feature_key: config.featureKey,
        quantity: 1,
        period_start: new Date(now - 1000).toISOString(),
        period_end: new Date(now).toISOString(),
        idempotency_key: `${config.runId}-${runtime.name}`,
      });
    if (runtime.browser) {
      // Server CORS does not allow the X-Usage-* signature headers, so the
      // preflight fails before any request is sent.
      try {
        await report();
      } catch (error) {
        assert(
          error instanceof CommerceNetworkError,
          `expected a CORS failure, got ${error?.name}`,
        );
        return 'blocked by server CORS (X-Usage-* headers not allowed), as expected';
      }
      throw new Error('usage report unexpectedly passed CORS');
    }
    const result = await report();
    assert(result.results[0]?.status === 'accepted', JSON.stringify(result));
  });

  await check('API errors carry the server request ID (exposed through CORS)', async () => {
    try {
      await keyed.products.get('00000000-0000-0000-0000-000000000000');
    } catch (error) {
      assert(error instanceof CommerceApiError, `expected CommerceApiError, got ${error?.name}`);
      assert(error.status === 404, `expected 404, got ${error.status}`);
      assert(typeof error.requestId === 'string' && error.requestId.length > 0, 'no requestId');
      return;
    }
    throw new Error('missing product resolved');
  });

  await check('caller AbortSignal cancels before the request', async () => {
    const controller = new AbortController();
    controller.abort();
    try {
      await keyed.products.list({}, { signal: controller.signal });
    } catch (error) {
      assert(
        error instanceof CommerceAbortError,
        `expected CommerceAbortError, got ${error?.name}`,
      );
      return;
    }
    throw new Error('aborted request resolved');
  });

  return results;
}
