import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { Client, OfflineVerifier, WebhookVerifier } from '../dist/index.js';

const baseUrl = process.env.COMMERCE_TEST_URL ?? 'http://127.0.0.1:19094';
const suffix = randomUUID().slice(0, 12);
const client = new Client({ baseUrl, auth: { apiKey: 'sdk-smoke-bootstrap' } });

function passed(name) {
  console.log(`PASS ${name}`);
}

/** Starts a loopback HTTP receiver and resolves with the first request it gets. */
function createWebhookReceiver() {
  let resolveDelivery;
  const delivered = new Promise((resolve) => {
    resolveDelivery = resolve;
  });
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      res.statusCode = 200;
      res.end('ok');
      resolveDelivery({ headers: req.headers, body: Buffer.concat(chunks) });
    });
  });
  return { server, delivered };
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', resolve);
  });
  return server.address().port;
}

async function main() {
  const health = await client.system.health();
  assert.equal(health.status, 'ok');
  passed('health');

  const organization = await client.organizations.create({
    name: `SDK smoke ${suffix}`,
    slug: `sdk-smoke-${suffix}`,
    currency: 'USD',
    timezone: 'UTC',
  });
  assert.ok(organization.id);
  assert.equal((await client.organizations.get(organization.id)).id, organization.id);
  passed('organization create/get');

  const product = await client.products.create({
    org_id: organization.id,
    name: `SDK product ${suffix}`,
    slug: `sdk-product-${suffix}`,
    product_type: 'saas',
  });
  assert.ok(product.id);
  passed('product create');

  const customer = await client.customers.create({
    org_id: organization.id,
    name: `SDK customer ${suffix}`,
    email: `sdk-${suffix}@example.test`,
    currency: 'USD',
  });
  assert.ok(customer.id);
  passed('customer create');

  const application = await client.applications.create({
    org_id: organization.id,
    product_id: product.id,
    name: `SDK app ${suffix}`,
    environment: 'sandbox',
  });
  assert.ok(application.id);
  passed('application create');

  const key = await client.apiKeys.create({
    application_id: application.id,
    name: `SDK key ${suffix}`,
    scopes: ['usage:report'],
    environment: 'sandbox',
  });
  assert.ok(key.secret_key?.startsWith('sk_'));
  passed('API key create');

  const authenticated = new Client({ baseUrl, auth: { apiKey: key.secret_key } });
  const orders = await authenticated.orders.list();
  assert.ok(Array.isArray(orders.data));
  passed('authenticated orders list');

  const license = await client.licenses.create({
    product_id: product.id,
    customer_id: customer.id,
    license_type: 'perpetual',
    max_activations: 1,
    perpetual: true,
  });
  assert.ok(license.id);
  passed('license create');

  const validation = await client.licenses.validate({ license_key: license.license_key });
  assert.equal(validation.valid, true);
  const invalid = await client.licenses.validate({ license_key: `missing-${suffix}` });
  assert.equal(invalid.valid, false);
  passed('license validate');

  const featureKey = `sdk_calls_${suffix}`;
  const meter = await authenticated.usageMeters.create({
    product_id: product.id,
    feature_key: featureKey,
    name: `SDK calls ${suffix}`,
    meter_type: 'counter',
    unit_name: 'calls',
    reset_period: 'monthly',
    billing_model: 'postpaid',
  });
  assert.ok(meter.id);
  const periodEnd = new Date();
  const report = await authenticated.usageReporter.reportSingle({
    license_key: license.license_key,
    feature_key: featureKey,
    quantity: 1,
    period_start: new Date(periodEnd.getTime() - 1000).toISOString(),
    period_end: periodEnd.toISOString(),
    idempotency_key: `sdk-smoke-${suffix}`,
  });
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0].status, 'accepted');
  passed('signed usage report');

  const fingerprint = `sdk-machine-${suffix}`;
  const activated = await client.activations.activate({
    license_key: license.license_key,
    fingerprint,
    hostname: `sdk-host-${suffix}`,
  });
  assert.ok(activated.activation?.id);
  assert.ok(activated.machine?.id);
  assert.equal((await client.activations.get(activated.activation.id)).id, activated.activation.id);
  await client.activations.deactivate(activated.activation.id);
  assert.equal((await client.activations.get(activated.activation.id)).status, 'deactivated');
  passed('license activation/deactivation');

  const contact = await client.contacts.addContact(customer.id, {
    name: `SDK contact ${suffix}`,
    email: `contact-${suffix}@example.test`,
  });
  assert.ok(contact.id);
  assert.ok(
    (await client.contacts.listContacts(customer.id)).some((item) => item.id === contact.id),
  );
  passed('contact create/list');

  const allOrganizations = await client.organizations.list({ search: `sdk-smoke-${suffix}` });
  assert.ok(Array.isArray(allOrganizations.data));
  passed('organization list');

  const paged = [];
  for await (const item of client.organizations.listAll({ limit: 1 })) {
    paged.push(item);
    if (paged.length === 2) break;
  }
  assert.ok(paged.length >= 1);
  passed('organization pagination');

  const { server: webhookServer, delivered } = createWebhookReceiver();
  const webhookPort = await listen(webhookServer);
  const webhookUrl = `http://host.docker.internal:${webhookPort}/webhook`;

  const endpointResult = await authenticated.webhookEndpoints.create({
    org_id: organization.id,
    url: webhookUrl,
    events: ['webhook.test'],
  });
  assert.ok(endpointResult.secret.startsWith('whsec_'));
  assert.ok(endpointResult.endpoint?.id);
  passed('webhook endpoint create');

  await authenticated.webhookEndpoints.test(endpointResult.endpoint.id);

  const delivery = await Promise.race([
    delivered,
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error('webhook delivery timed out after 15s')), 15000),
    ),
  ]);
  webhookServer.close();

  const headerRecord = Object.fromEntries(
    Object.entries(delivery.headers).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const verifier = new WebhookVerifier(endpointResult.secret);
  const envelope = await verifier.verify(headerRecord, delivery.body);
  assert.equal(envelope.type, 'webhook.test');
  assert.equal(envelope.org_id, organization.id);
  passed('webhook delivery signature verification');

  const tamperedBody = Buffer.from(delivery.body);
  tamperedBody[0] = tamperedBody[0] ^ 0xff;
  await assert.rejects(() => verifier.verify(headerRecord, tamperedBody));
  passed('webhook tampered body rejected');

  const webhookEvents = await authenticated.webhookEvents.list({
    endpoint_id: endpointResult.endpoint.id,
  });
  assert.ok(webhookEvents.data.length >= 1);
  const webhookEventDetail = await authenticated.webhookEvents.get(webhookEvents.data[0].id);
  assert.equal(webhookEventDetail.event.id, webhookEvents.data[0].id);
  assert.ok(webhookEventDetail.endpoint_url);
  passed('webhook event list/get');

  const issued = await client.offlineCertificates.issue({
    license_id: license.id,
    machine_id: activated.machine.id,
  });
  assert.ok(issued.certificate.id);
  assert.ok(issued.signature);
  passed('offline certificate issue');

  const onlineVerify = await client.offlineCertificates.verify({
    certificate: issued.certificate.certificate,
    fingerprint,
  });
  assert.equal(onlineVerify.valid, true);
  assert.equal(onlineVerify.payload?.license_id, license.id);
  passed('offline certificate online verify (valid)');

  const mismatchVerify = await client.offlineCertificates.verify({
    certificate: issued.certificate.certificate,
    fingerprint: `wrong-${fingerprint}`,
  });
  assert.equal(mismatchVerify.valid, false);
  assert.equal(mismatchVerify.error_code, 'machine_mismatch');
  passed('offline certificate online verify (fingerprint mismatch)');

  const signingKey = await client.system.signingKey();
  assert.equal(signingKey.algorithm, 'Ed25519');
  const offlineVerifier = new OfflineVerifier(signingKey.public_key);

  const localValid = await offlineVerifier.verify(
    issued.certificate.certificate,
    issued.signature,
    fingerprint,
  );
  assert.equal(localValid.valid, true);
  assert.equal(localValid.payload?.license_id, license.id);
  passed('offline certificate local verify against the real server signing key (valid)');

  const localTampered = await offlineVerifier.verify(
    issued.certificate.certificate,
    issued.signature,
    `wrong-${fingerprint}`,
  );
  assert.equal(localTampered.valid, false);
  assert.equal(localTampered.errorCode, 'machine_mismatch');

  const localWrongSignature = await offlineVerifier.verify(
    issued.certificate.certificate,
    Buffer.from('0'.repeat(64)).toString('base64'),
    fingerprint,
  );
  assert.equal(localWrongSignature.valid, false);
  assert.equal(localWrongSignature.errorCode, 'invalid_signature');
  passed('offline certificate local verify rejects a wrong signature');

  const commissionPlan = await authenticated.commissionPlans.create({
    org_id: organization.id,
    name: `SDK plan ${suffix}`,
    commission_type: 'percentage',
    commission_value: 10,
  });
  assert.ok(commissionPlan.id);
  passed('commission plan create');

  const affiliate = await authenticated.affiliates.create({
    org_id: organization.id,
    name: `SDK affiliate ${suffix}`,
    email: `affiliate-${suffix}@example.test`,
    commission_plan_id: commissionPlan.id,
  });
  assert.equal(affiliate.status, 'pending');
  const rejected = await authenticated.affiliates.reject(affiliate.id, {
    reason: 'sdk smoke test',
  });
  assert.equal(rejected.status, 'rejected');
  passed('affiliate create/reject (requires a JSON body on the server)');
}

try {
  await main();
} catch (error) {
  console.error('FAIL', error.name, error.message, error.status ?? '', error.code ?? '');
  process.exitCode = 1;
}
