import assert from 'node:assert/strict';
import { Blob, Buffer } from 'node:buffer';
import console from 'node:console';
import { createHash, randomUUID } from 'node:crypto';
import http from 'node:http';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { URL } from 'node:url';
import { TextEncoder } from 'node:util';
import { Client, OfflineVerifier, WebhookVerifier } from '../dist/index.js';

const baseUrl = process.env.COMMERCE_TEST_URL ?? 'http://127.0.0.1:19094';
const suffix = randomUUID().slice(0, 12);
/** Adds trusted-proxy identity headers, as oauth2-proxy does for the admin UI. */
function withIdentity(headers) {
  return (input, init = {}) => {
    const merged = new globalThis.Headers(init.headers);
    for (const [key, value] of Object.entries(headers)) merged.set(key, value);
    return globalThis.fetch(input, { ...init, headers: merged });
  };
}

// Platform operator: unscoped identity holding the configured operator role.
const client = new Client({
  baseUrl,
  auth: { apiKey: 'sdk-smoke-operator-has-no-key' },
  fetch: withIdentity({ 'X-User-ID': 'sdk-smoke-operator', 'X-Roles': 'commerce:admin' }),
});
// No credentials at all: only public routes may answer.
const anonymous = new Client({ baseUrl, auth: { apiKey: 'not-a-real-key' } });

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
  const health = await anonymous.system.health();
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
    scopes: ['*'],
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

  const validation = await anonymous.licenses.validate({ license_key: license.license_key });
  assert.equal(validation.valid, true);
  const invalid = await anonymous.licenses.validate({ license_key: `missing-${suffix}` });
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
  const activated = await anonymous.activations.activate({
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

  const onlineVerify = await anonymous.offlineCertificates.verify({
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

  const signingKey = await anonymous.system.signingKey();
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

  await apiKeyScopes({ api: authenticated, application, license });
  await domainLifecycles({ api: authenticated, organization, product, customer });

  await serverExtensions({ api: authenticated, organization, product, customer, license });

  await tenantIsolation({
    organization,
    authenticated,
    ownKey: key.secret_key,
    owned: {
      organizations: organization.id,
      products: product.id,
      customers: customer.id,
      applications: application.id,
      'api-keys': key.id,
      licenses: license.id,
      activations: activated.activation.id,
      machines: activated.machine.id,
      'usage-meters': meter.id,
      'webhook-endpoints': endpointResult.endpoint.id,
      'offline-certificates': issued.certificate.id,
      'commission-plans': commissionPlan.id,
      affiliates: affiliate.id,
    },
    product,
    customer,
    license,
    affiliate,
  });
}

/** API-key scopes: read vs write, usage-only keys, and no minting broader keys. */
async function apiKeyScopes({ api, application, license }) {
  const id = randomUUID().slice(0, 8);
  const mint = (scopes) =>
    api.apiKeys.create({
      application_id: application.id,
      name: `scoped ${id} ${scopes.join(' ')}`,
      scopes,
      environment: 'sandbox',
    });
  await assert.rejects(
    () => mint([]),
    (error) => error.status === 400 && error.code === 'invalid_scopes',
  );
  await assert.rejects(
    () => mint(['licenses:delete']),
    (error) => error.status === 400 && error.code === 'invalid_scopes',
  );

  const reader = new Client({
    baseUrl,
    auth: { apiKey: (await mint(['licenses:read'])).secret_key },
  });
  assert.ok((await reader.licenses.list({ limit: 1 })).data.length >= 0);
  assert.equal((await reader.licenses.get(license.id)).id, license.id);
  await assert.rejects(
    () => reader.licenses.revoke(license.id, { reason: 'should not be allowed' }),
    (error) => error.status === 403 && error.code === 'insufficient_scope',
  );
  await assert.rejects(
    () => reader.products.list(),
    (error) => error.status === 403,
  );

  const usageOnly = new Client({
    baseUrl,
    auth: { apiKey: (await mint(['usage:report'])).secret_key },
  });
  await assert.rejects(
    () => usageOnly.products.list(),
    (error) => error.status === 403,
  );

  // A key may mint keys only with scopes it already holds.
  const keyAdmin = new Client({
    baseUrl,
    auth: { apiKey: (await mint(['api_keys:write', 'licenses:read'])).secret_key },
  });
  const narrower = await keyAdmin.apiKeys.create({
    application_id: application.id,
    name: `narrower ${id}`,
    scopes: ['licenses:read'],
    environment: 'sandbox',
  });
  assert.deepEqual(narrower.scopes, ['licenses:read']);
  await assert.rejects(
    () =>
      keyAdmin.apiKeys.create({
        application_id: application.id,
        name: `escalation ${id}`,
        scopes: ['*'],
        environment: 'sandbox',
      }),
    (error) => error.status === 403 && error.code === 'insufficient_scope',
  );
  passed(
    'API-key scopes (read vs write, usage-only, no minting broader keys, invalid scopes rejected)',
  );
}

/**
 * Plan comparison, subscription, affiliate, commission payout, and referral
 * lifecycles, all through an org-scoped API key so the tenant guard is
 * exercised on every legitimate call.
 */
async function domainLifecycles({ api, organization, product, customer }) {
  const id = randomUUID().slice(0, 8);

  const basic = await api.plans.create({
    product_id: product.id,
    name: 'Basic',
    slug: `basic-${id}`,
    plan_type: 'subscription',
    billing_interval: 'monthly',
    price_cents: 1000,
    currency: 'USD',
  });
  // Plans are created as drafts; only active plans are compared or sold.
  assert.equal(basic.status, 'draft');
  assert.equal((await api.plans.update(basic.id, { status: 'active' })).status, 'active');
  let comparison = await api.plans.compare(product.id);
  assert.equal(comparison.features, null);
  assert.equal(comparison.limits, null);
  assert.equal(comparison.pricing[0]?.label, 'Price');
  const pro = await api.plans.create({
    product_id: product.id,
    name: 'Pro',
    slug: `pro-${id}`,
    plan_type: 'subscription',
    billing_interval: 'monthly',
    price_cents: 5000,
    currency: 'USD',
    seat_based: true,
    seat_price_cents: 500,
    min_seats: 1,
    max_seats: 10,
    features: { sso: true },
    limits: { api_calls: -1 },
  });
  await api.plans.update(pro.id, { status: 'active' });
  comparison = await api.plans.compare(product.id);
  assert.deepEqual(comparison.plans.map((plan) => plan.id).sort(), [basic.id, pro.id].sort());
  const sso = comparison.features?.find((row) => row.key === 'sso');
  assert.equal(sso?.values.find((cell) => cell.plan_id === pro.id)?.enabled, true);
  assert.equal(sso?.values.find((cell) => cell.plan_id === basic.id)?.enabled, false);
  const apiCalls = comparison.limits?.find((row) => row.key === 'api_calls');
  assert.equal(apiCalls?.values.find((cell) => cell.plan_id === pro.id)?.value, 'Unlimited');
  passed('plan compare (null features/limits, then populated matrix)');

  const created = await api.subscriptions.create({
    customer_id: customer.id,
    product_id: product.id,
    plan_id: basic.id,
    quantity: 1,
  });
  const subscription = created.subscription;
  assert.ok(subscription.id);
  const detail = await api.subscriptions.get(subscription.id);
  assert.equal(detail.subscription.id, subscription.id);
  assert.equal(detail.plan_name, 'Basic');
  const paused = await api.subscriptions.pause(subscription.id, { reason: 'sdk smoke' });
  assert.equal(paused.status, 'paused');
  const resumed = await api.subscriptions.resume(subscription.id, {});
  assert.equal(resumed.status, subscription.status);
  const renewed = await api.subscriptions.renew(subscription.id, { periods: 1 });
  assert.ok(
    Date.parse(renewed.subscription.current_period_end) >
      Date.parse(subscription.current_period_end),
  );
  const changed = await api.subscriptions.changePlan(subscription.id, {
    plan_id: pro.id,
    proration_behavior: 'create_prorations',
  });
  assert.equal(changed.subscription.plan_id, pro.id);
  const seats = await api.subscriptions.updateSeats(subscription.id, {
    quantity: 3,
    proration_behavior: 'create_prorations',
  });
  assert.equal(seats.subscription.quantity, 3);
  const canceled = await api.subscriptions.cancel(subscription.id, {
    at_period_end: false,
    reason: 'sdk smoke',
  });
  assert.ok(canceled.canceled_at);
  passed('subscription lifecycle (create/get/pause/resume/renew/change-plan/seats/cancel)');

  const planA = await api.commissionPlans.create({
    org_id: organization.id,
    name: `Plan A ${id}`,
    commission_type: 'percentage',
    commission_value: 10,
  });
  const planB = await api.commissionPlans.create({
    org_id: organization.id,
    name: `Plan B ${id}`,
    commission_type: 'percentage',
    commission_value: 20,
  });
  const affiliate = await api.affiliates.create({
    org_id: organization.id,
    name: `Affiliate A ${id}`,
    email: `aff-a-${id}@example.test`,
    commission_plan_id: planA.id,
  });
  const otherAffiliate = await api.affiliates.create({
    org_id: organization.id,
    name: `Affiliate B ${id}`,
    email: `aff-b-${id}@example.test`,
    commission_plan_id: planB.id,
  });
  const byPlan = await api.affiliates.list({ commission_plan_id: planB.id });
  assert.deepEqual(
    byPlan.data.map((item) => item.id),
    [otherAffiliate.id],
  );
  const approved = await api.affiliates.approve(affiliate.id, {});
  assert.equal(approved.status, 'approved');
  assert.equal(typeof approved.total_clicks, 'number');
  passed('affiliate list filter (commission_plan_id) and approve');

  const link = await api.affiliateLinks.create({
    affiliate_id: affiliate.id,
    product_id: product.id,
    destination_url: 'https://example.test/product',
  });
  const genericLink = await api.affiliateLinks.create({
    affiliate_id: affiliate.id,
    destination_url: 'https://example.test/home',
  });
  const productLinks = await api.affiliateLinks.list({ product_id: product.id });
  assert.ok(productLinks.data.some((item) => item.id === link.id));
  assert.ok(!productLinks.data.some((item) => item.id === genericLink.id));
  assert.equal(typeof link.unique_clicks, 'number');

  const event = await api.affiliateEvents.create({
    affiliate_id: affiliate.id,
    link_id: link.id,
    event_type: 'click',
  });
  const unreviewed = await api.affiliateEvents.list({
    affiliate_id: affiliate.id,
    reviewed: false,
  });
  assert.ok(unreviewed.data.some((item) => item.id === event.id));
  const reviewed = await api.affiliateEvents.review(event.id, { reviewed_by: 'sdk-smoke' });
  assert.equal(reviewed.reviewed, true);
  const reviewedList = await api.affiliateEvents.list({
    affiliate_id: affiliate.id,
    reviewed: true,
  });
  assert.ok(reviewedList.data.some((item) => item.id === event.id));
  passed('affiliate links (product_id filter) and events (reviewed filter, review)');

  const newPayout = () =>
    api.commissionPayouts.create({
      org_id: organization.id,
      payee_type: 'affiliate',
      payee_id: affiliate.id,
      period_start: '2026-09-01T00:00:00Z',
      period_end: '2026-10-01T00:00:00Z',
      amount_cents: 2500,
      currency: 'USD',
      total_orders: 1,
      total_revenue_cents: 25000,
    });
  const payout = await newPayout();
  assert.equal(payout.status, 'pending');
  await assert.rejects(
    () => api.commissionPayouts.pay(payout.id, { payment_method: 'bank_transfer' }),
    (error) => error.status === 409 && error.code === 'invalid_transition',
  );
  assert.equal((await api.commissionPayouts.approve(payout.id, {})).status, 'approved');
  const paid = await api.commissionPayouts.pay(payout.id, {
    payment_method: 'bank_transfer',
    payment_reference: `ref-${id}`,
  });
  assert.equal(paid.status, 'paid');
  assert.equal(paid.payment_reference, `ref-${id}`);
  assert.equal(
    (await api.commissionPayouts.reverse(payout.id, { reason: 'sdk smoke' })).status,
    'reversed',
  );
  const failedPayout = await newPayout();
  await api.commissionPayouts.approve(failedPayout.id, {});
  assert.equal(
    (await api.commissionPayouts.fail(failedPayout.id, { reason: 'bank rejected' })).status,
    'failed',
  );
  await assert.rejects(
    () => api.commissionPayouts.reverse(failedPayout.id, { reason: 'too late' }),
    (error) => error.status === 409,
  );
  const reversedPayouts = await api.commissionPayouts.list({
    payee_id: affiliate.id,
    status: 'reversed',
  });
  assert.deepEqual(
    reversedPayouts.data.map((item) => item.id),
    [payout.id],
  );
  passed('commission payouts (approve/pay/reverse, approve/fail, 409 on invalid transitions)');

  const program = await api.referralPrograms.create({
    org_id: organization.id,
    name: `Referral ${id}`,
    reward_type: 'credit',
    reward_value: 500,
  });
  assert.equal(program.referrer_reward_type, 'credit');
  const code = await api.referralCodes.create({
    program_id: program.id,
    referrer_id: customer.id,
    referrer_type: 'customer',
  });
  assert.equal(code.code.length, 8);
  const codes = await api.referralCodes.list({ referrer_id: customer.id });
  assert.ok(codes.data.some((item) => item.id === code.id));

  const referred = await api.customers.create({
    org_id: organization.id,
    name: `Referred ${id}`,
    email: `referred-${id}@example.test`,
    currency: 'USD',
  });
  const first = await api.referralEvents.create({
    code_id: code.id,
    referred_customer_id: referred.id,
  });
  assert.equal(first.status, 'pending');
  assert.equal((await api.referralEvents.qualify(first.id, {})).status, 'qualified');
  const rewarded = await api.referralEvents.reward(first.id, {
    referrer_reward_amount_cents: 500,
    referred_reward_amount_cents: 250,
  });
  assert.equal(rewarded.status, 'rewarded');
  assert.equal(rewarded.referrer_reward_amount_cents, 500);
  await assert.rejects(
    () => api.referralEvents.reject(first.id, { reason: 'too late' }),
    (error) => error.status === 409,
  );
  // A customer can be referred only once per program.
  const secondReferred = await api.customers.create({
    org_id: organization.id,
    name: `Referred two ${id}`,
    email: `referred-two-${id}@example.test`,
    currency: 'USD',
  });
  const second = await api.referralEvents.create({
    code_id: code.id,
    referred_customer_id: secondReferred.id,
  });
  const rejected = await api.referralEvents.reject(second.id, { reason: 'duplicate' });
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.rejected_reason, 'duplicate');
  await assert.rejects(
    () => api.referralEvents.qualify(second.id, {}),
    (error) => error.status === 409,
  );
  const rewardedEvents = await api.referralEvents.list({ code_id: code.id, status: 'rewarded' });
  assert.deepEqual(
    rewardedEvents.data.map((item) => item.id),
    [first.id],
  );
  passed('referral program/code/events (qualify/reward/reject, 409 on invalid transitions)');
}

/**
 * Server routes beyond Go SDK parity: gateway configs, notifications,
 * application notifications, and releases with a streamed download.
 */
async function serverExtensions({ api, organization, product, customer, license }) {
  const id = randomUUID().slice(0, 8);

  const override = await api.licenses.upsertEntitlementOverride(license.id, {
    feature_key: `sso_${id}`,
    enabled: true,
    value: 'on',
    reason: 'sdk smoke',
  });
  assert.equal(override.license_id, license.id);
  assert.equal(override.feature_key, `sso_${id}`);
  assert.equal(override.value, 'on');
  const spare = await api.licenses.create({
    product_id: product.id,
    customer_id: customer.id,
    license_type: 'perpetual',
    max_activations: 1,
    perpetual: true,
  });
  assert.deepEqual(await api.licenses.suspend(spare.id), { status: 'suspended' });
  assert.deepEqual(await api.licenses.reactivate(spare.id), { status: 'active' });
  const csv = await api.auditLogs.exportCsv({ limit: 5 });
  assert.match(csv.headers.get('content-type') ?? '', /csv/);
  assert.match((await csv.text()).split('\n')[0] ?? '', /action/);
  passed('license override (returns the saved override), suspend/reactivate, audit CSV export');

  const providers = await api.gatewayProviders.list();
  assert.ok(providers.some((provider) => provider.id === 'stripe'));
  const schema = await api.gatewayProviders.schema('stripe');
  assert.ok(schema.schema.fields?.some((field) => field.key === 'secret_key' && field.required));
  // Credentials are validated against the provider schema, as in the console.
  await assert.rejects(
    () =>
      api.gatewayConfigs.create({
        org_id: organization.id,
        provider: 'stripe',
        environment: 'sandbox',
        credentials: {},
      }),
    (error) =>
      error.status === 400 &&
      error.code === 'invalid_credentials' &&
      typeof error.details?.secret_key === 'string',
  );
  await assert.rejects(
    () =>
      api.gatewayConfigs.create({
        org_id: organization.id,
        provider: 'not-a-provider',
        credentials: {},
      }),
    (error) => error.status === 400 && error.code === 'unsupported_provider',
  );
  // Format-valid but fake keys. gatewayConfigs.test is not called live: it would
  // contact Stripe with them (the contract suite covers that route).
  const gateway = await api.gatewayConfigs.create({
    org_id: organization.id,
    provider: 'stripe',
    environment: 'sandbox',
    credentials: {
      secret_key: `sk_test_${'0'.repeat(24)}`,
      publishable_key: `pk_test_${'0'.repeat(24)}`,
    },
  });
  assert.equal(gateway.display_name, 'Stripe');
  assert.ok(!('credentials' in gateway));
  await assert.rejects(
    () => api.gatewayConfigs.update(gateway.id, { credentials: { secret_key: 'not-a-key' } }),
    (error) => error.status === 400 && error.code === 'invalid_credentials',
  );
  assert.equal((await api.gatewayConfigs.setDefault(gateway.id)).is_default, true);
  assert.equal(
    (await api.gatewayConfigs.update(gateway.id, { display_name: 'Stripe sandbox' })).display_name,
    'Stripe sandbox',
  );
  assert.ok(
    (await api.gatewayConfigs.list({ provider: 'stripe' })).data.some((g) => g.id === gateway.id),
  );
  await api.gatewayConfigs.delete(gateway.id);
  passed(
    'gateway configs (providers/schema, credential validation, create/set-default/update/list/delete)',
  );

  const template = await api.notificationTemplates.create({
    org_id: organization.id,
    name: `Welcome ${id}`,
    slug: `welcome-${id}`,
    channel: 'email',
    subject: 'Welcome {{.name}}',
    body_template: 'Hello {{.name}}',
    variables: ['name'],
  });
  assert.equal(template.org_id, organization.id);
  assert.equal(template.body_template, 'Hello {{.name}}');
  const templateDetail = await api.notificationTemplates.get(template.id);
  assert.equal(templateDetail.template.id, template.id);
  assert.ok(templateDetail.org_name);
  assert.equal(
    (await api.notificationTemplates.update(template.id, { status: 'archived' })).status,
    'archived',
  );
  await api.notificationTemplates.update(template.id, { status: 'active' });
  // SMTP points at the container's own localhost, so delivery fails without leaving the stack.
  const queued = await api.notifications.queue({
    org_id: organization.id,
    template_id: template.id,
    channel: 'email',
    recipient: `notify-${id}@example.test`,
    variables: { name: 'SDK' },
    max_attempts: 1,
  });
  assert.equal(queued.template_id, template.id);
  assert.match(queued.subject ?? '', /Welcome SDK/);
  const notificationDetail = await api.notifications.get(queued.id);
  assert.equal(notificationDetail.notification.id, queued.id);
  assert.ok(
    (await api.notifications.list({ channel: 'email' })).data.some((n) => n.id === queued.id),
  );
  // Only failed or bounced notifications can be retried, so a retry never
  // resends a delivered message. SMTP is unreachable here: the single attempt fails.
  let conflicts = 0;
  const retryOrConflict = async () => {
    try {
      return await api.notifications.retry(queued.id);
    } catch (error) {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'invalid_transition');
      conflicts += 1;
      return undefined;
    }
  };
  await retryOrConflict(); // still queued unless the worker already failed it
  let current = queued;
  for (let i = 0; i < 40 && current.status !== 'failed'; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    current = (await api.notifications.get(queued.id)).notification;
  }
  assert.equal(current.status, 'failed', 'notification never reached failed');
  const retried = await api.notifications.retry(queued.id);
  assert.equal(retried.status, 'queued');
  assert.equal(retried.attempt_count, 0);
  await retryOrConflict(); // queued again, so normally a conflict
  assert.ok(conflicts >= 1, 'a retry of a non-failed notification must be refused with 409');
  passed(
    'notification templates and notifications (create/get/update, queue/get/list, retry only after failure)',
  );

  const announcement = await api.applicationNotifications.create({
    org_id: organization.id,
    product_id: product.id,
    title: `Maintenance ${id}`,
    message: 'Scheduled maintenance tonight.',
    severity: 'warning',
    message_type: 'maintenance_notice',
    status: 'active',
  });
  assert.equal(announcement.status, 'active');
  assert.equal(announcement.audience.platforms, undefined);
  const feed = await anonymous.applicationNotifications.feed({
    license_key: license.license_key,
    installation_id: `install-${id}`,
  });
  assert.ok(feed.some((item) => item.notification.id === announcement.id));
  const ack = await anonymous.applicationNotifications.acknowledge(announcement.id, {
    license_key: license.license_key,
    installation_id: `install-${id}`,
  });
  assert.equal(ack.state, 'acknowledged');
  const afterAck = await anonymous.applicationNotifications.feed({
    license_key: license.license_key,
    installation_id: `install-${id}`,
  });
  assert.equal(
    afterAck.find((item) => item.notification.id === announcement.id)?.state?.state,
    'acknowledged',
  );
  assert.equal(
    (await api.applicationNotifications.update(announcement.id, { status: 'archived' })).status,
    'archived',
  );
  passed('application notifications (create/update, license-key feed and ack)');

  const release = await api.releases.create({
    product_id: product.id,
    version: '1.2.3',
    channel: 'stable',
    release_notes: 'SDK smoke release',
  });
  assert.equal(release.status, 'draft');
  const bytes = new TextEncoder().encode(`sdk smoke artifact ${id}\n`);
  const artifact = await api.releases.uploadArtifact(release.id, {
    file: new Blob([bytes], { type: 'application/octet-stream' }),
    filename: `app-${id}.bin`,
    os: 'linux',
    arch: 'amd64',
  });
  const expectedSha = createHash('sha256').update(bytes).digest('hex');
  assert.equal(artifact.checksum_sha256, expectedSha);
  assert.equal(artifact.file_size_bytes, bytes.length);
  assert.equal((await api.releases.listArtifacts(release.id)).total, 1);
  assert.equal((await api.releases.publish(release.id)).status, 'published');
  const releaseDetail = await api.releases.get(release.id);
  assert.equal(releaseDetail.release?.id, release.id);
  assert.equal(releaseDetail.artifacts?.[0]?.id, artifact.id);
  assert.equal((await anonymous.releases.checksum(artifact.id)).checksum_sha256, expectedSha);

  const grant = await anonymous.releases.authorizeDownload({
    license_key: license.license_key,
    artifact_id: artifact.id,
  });
  assert.equal(grant.artifact.storage_path, '', 'public grant must not reveal storage paths');
  const token = new URL(grant.url).pathname.split('/').pop();
  const download = await anonymous.releases.download(token);
  assert.equal(download.filename, `app-${id}.bin`);
  assert.equal(download.checksumSha256, expectedSha);
  const downloaded = new Uint8Array(await download.response.arrayBuffer());
  assert.equal(createHash('sha256').update(downloaded).digest('hex'), expectedSha);
  // Behind a TLS-terminating proxy the download URL must be https.
  const proxied = await globalThis.fetch(`${baseUrl}/api/v1/downloads/authorize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Forwarded-Proto': 'https' },
    body: JSON.stringify({ license_key: license.license_key, artifact_id: artifact.id }),
  });
  assert.match((await proxied.json()).data.url, /^https:\/\//);

  // Uploads stream past the old 10 MiB global body cap, up to the configured
  // RELEASE_MAX_ARTIFACT_BYTES (16 MiB in the test stack).
  const big = new Uint8Array(12 * 1024 * 1024).map((_, i) => i % 251);
  const bigArtifact = await api.releases.uploadArtifact(release.id, {
    file: new Blob([big]),
    filename: `big-${id}.bin`,
    os: 'darwin',
    arch: 'arm64',
  });
  assert.equal(bigArtifact.file_size_bytes, big.length);
  assert.equal(bigArtifact.checksum_sha256, createHash('sha256').update(big).digest('hex'));
  await assert.rejects(
    () =>
      api.releases.uploadArtifact(release.id, {
        file: new Blob([new Uint8Array(17 * 1024 * 1024)]),
        filename: `too-big-${id}.bin`,
        os: 'windows',
        arch: 'amd64',
      }),
    (error) => error.status === 413 && error.code === 'artifact_too_large',
  );

  assert.equal((await api.releases.yank(release.id, { reason: 'sdk smoke' })).status, 'yanked');
  assert.ok(
    (await api.releases.list({ product_id: product.id })).data.some((r) => r.id === release.id),
  );
  passed(
    'releases (create/upload/publish/get/checksum, streamed download, https URL behind a proxy, 12 MiB upload, 413 over the limit, yank)',
  );
}

/** Every collection GET on the server; each must answer 200 for an org-scoped key. */
const listRoutes = [
  'activations',
  'addons',
  'affiliate-events',
  'affiliate-links',
  'affiliates',
  'api-keys',
  'application-notifications',
  'applications',
  'audit-logs',
  'commission-payouts',
  'commission-plans',
  'customers',
  'entitlements',
  'gateway-configs',
  'gateway-webhook-logs',
  'invoices',
  'licenses',
  'machines',
  'notification-templates',
  'notifications',
  'offline-certificates',
  'orders',
  'organizations',
  'payment-methods',
  'payments',
  'plans',
  'products',
  'referral-codes',
  'referral-events',
  'referral-programs',
  'releases',
  'subscriptions',
  'usage-meters',
  'webhook-endpoints',
  'webhook-events',
];

/** GET with the server's per-key rate limit honoured via Retry-After, as the SDK does. */
async function rawGet(path, apiKey) {
  for (let attempt = 0; ; attempt++) {
    const response = await globalThis.fetch(`${baseUrl}/api/v1/${path}`, {
      headers: { 'X-API-Key': apiKey },
    });
    const text = await response.text();
    if (response.status !== 429 || attempt === 3) return { status: response.status, text };
    const seconds = Number(response.headers.get('retry-after')) || 1;
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}

function hasStatus(status) {
  return (error) => error.status === status;
}

/** Proves org A's data is invisible and immutable to org B's credentials. */
async function tenantIsolation({
  organization,
  authenticated,
  ownKey,
  owned,
  product,
  customer,
  license,
  affiliate,
}) {
  await assert.rejects(() => anonymous.organizations.list(), hasStatus(401));
  const noRole = new Client({
    baseUrl,
    auth: { apiKey: 'unused' },
    fetch: withIdentity({ 'X-User-ID': 'sdk-smoke-no-role' }),
  });
  await assert.rejects(() => noRole.organizations.list(), hasStatus(403));
  passed('tenant isolation: anonymous and role-less identities are refused');

  const otherSuffix = randomUUID().slice(0, 12);
  const otherOrg = await client.organizations.create({
    name: `SDK other ${otherSuffix}`,
    slug: `sdk-other-${otherSuffix}`,
    currency: 'USD',
    timezone: 'UTC',
  });
  const otherProduct = await client.products.create({
    org_id: otherOrg.id,
    name: `SDK other product ${otherSuffix}`,
    slug: `sdk-other-product-${otherSuffix}`,
    product_type: 'saas',
  });
  const otherApp = await client.applications.create({
    org_id: otherOrg.id,
    product_id: otherProduct.id,
    name: `SDK other app ${otherSuffix}`,
    environment: 'sandbox',
  });
  const otherKey = await client.apiKeys.create({
    application_id: otherApp.id,
    name: `SDK other key ${otherSuffix}`,
    scopes: ['*'],
    environment: 'sandbox',
  });
  const other = new Client({ baseUrl, auth: { apiKey: otherKey.secret_key } });

  const visibleOrgs = await other.organizations.list();
  assert.deepEqual(
    visibleOrgs.data.map((org) => org.id),
    [otherOrg.id],
  );
  passed('tenant isolation: an org-scoped key lists only its own organization');

  for (const [resource, id] of Object.entries(owned)) {
    const response = await rawGet(`${resource}/${id}`, otherKey.secret_key);
    assert.equal(response.status, 404, `GET ${resource}/{id} from another org: ${response.text}`);
  }
  passed(`tenant isolation: ${Object.keys(owned).length} foreign resources are 404 by ID`);

  const ownedIds = [organization.id, ...Object.values(owned)];
  for (const route of listRoutes) {
    const mine = await rawGet(route, otherKey.secret_key);
    assert.equal(mine.status, 200, `GET ${route} as org-scoped key: ${mine.text}`);
    const leaked = ownedIds.filter((id) => mine.text.includes(id));
    assert.deepEqual(leaked, [], `GET ${route} leaked another org's IDs`);
    const own = await rawGet(route, ownKey);
    assert.equal(own.status, 200, `GET ${route} as the owning org's key: ${own.text}`);
  }
  passed(`tenant isolation: ${listRoutes.length} list endpoints return no foreign rows`);

  await assert.rejects(
    () =>
      other.commissionPlans.create({
        org_id: organization.id,
        name: 'cross-tenant write',
        commission_type: 'percentage',
        commission_value: 1,
      }),
    hasStatus(403),
  );
  await assert.rejects(
    () =>
      other.licenses.create({
        product_id: product.id,
        customer_id: customer.id,
        license_type: 'perpetual',
        max_activations: 1,
        perpetual: true,
      }),
    hasStatus(404),
  );
  await assert.rejects(
    () => other.affiliates.update(affiliate.id, { name: 'renamed' }),
    hasStatus(404),
  );
  await assert.rejects(
    () =>
      other.usageReporter.reportSingle({
        license_key: license.license_key,
        feature_key: 'cross_tenant',
        quantity: 1,
        period_start: new Date(Date.now() - 1000).toISOString(),
        period_end: new Date().toISOString(),
        idempotency_key: `cross-${otherSuffix}`,
      }),
    hasStatus(404),
  );
  passed('tenant isolation: cross-org create, update, and usage report are refused');

  assert.equal((await authenticated.affiliates.get(affiliate.id)).id, affiliate.id);
  assert.ok(
    (await authenticated.licenses.list({ limit: 100 })).data.some((l) => l.id === license.id),
  );
  assert.equal((await client.affiliates.get(affiliate.id)).id, affiliate.id);
  passed('tenant isolation: owners and operators keep access');
}

try {
  await main();
} catch (error) {
  console.error('FAIL', error.name, error.message, error.status ?? '', error.code ?? '');
  process.exitCode = 1;
}
