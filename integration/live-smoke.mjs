import assert from 'node:assert/strict';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { Client } from '../dist/index.js';

const baseUrl = process.env.COMMERCE_TEST_URL ?? 'http://127.0.0.1:19094';
const suffix = randomUUID().slice(0, 12);
const client = new Client({ baseUrl, auth: { apiKey: 'sdk-smoke-bootstrap' } });

function passed(name) {
  console.log(`PASS ${name}`);
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
}

try {
  await main();
} catch (error) {
  console.error('FAIL', error.name, error.message, error.status ?? '', error.code ?? '');
  process.exitCode = 1;
}
