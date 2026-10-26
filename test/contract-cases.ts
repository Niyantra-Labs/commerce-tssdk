/**
 * One contract case per public SDK method: the route it must call and how to
 * call it. Shared by the MSW contract suite and the README endpoint table.
 */
import type { Client } from '../src/index.js';

/** Sample input; required-body routes must receive exactly this JSON. */
export const IN = { sample: 'input' } as never;

export type Call = (c: Client) => Promise<unknown>;
export interface Case {
  service: keyof Client;
  method: string;
  route: string;
  call: Call;
  query?: Record<string, string>;
  /** Override the expected request body (default: IN for required bodies). */
  body?: unknown;
  /** The handler can answer raw (e.g. CSV export) for this request. */
  raw?: boolean;
}

const crud = (service: keyof Client, base: string, extra: Partial<Record<string, string>> = {}) => {
  const svc = (c: Client) =>
    c[service] as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const cases: Case[] = [
    {
      service,
      method: 'list',
      route: `GET /api/v1/${base}`,
      call: (c) => svc(c).list!({ limit: 5 }),
      query: { limit: '5', ...extra },
    },
    { service, method: 'create', route: `POST /api/v1/${base}`, call: (c) => svc(c).create!(IN) },
    { service, method: 'get', route: `GET /api/v1/${base}/{id}`, call: (c) => svc(c).get!('id_1') },
    {
      service,
      method: 'update',
      route: `PATCH /api/v1/${base}/{id}`,
      call: (c) => svc(c).update!('id_1', IN),
    },
    {
      service,
      method: 'delete',
      route: `DELETE /api/v1/${base}/{id}`,
      call: (c) => svc(c).delete!('id_1'),
    },
  ];
  return cases;
};

const report = {
  license_key: 'LIC-1',
  feature_key: 'calls',
  quantity: 1,
  period_start: '2026-10-01T00:00:00Z',
  period_end: '2026-10-01T00:00:01Z',
  idempotency_key: 'idem-1',
};

export const cases: Case[] = [
  ...crud('organizations', 'organizations'),
  ...crud('products', 'products'),
  ...crud('plans', 'plans'),
  {
    service: 'plans',
    method: 'compare',
    route: 'GET /api/v1/plans/compare',
    call: (c) => c.plans.compare('prod_1'),
    query: { product_id: 'prod_1' },
  },
  ...crud('customers', 'customers'),
  {
    service: 'contacts',
    method: 'listContacts',
    route: 'GET /api/v1/customers/{id}/contacts',
    call: (c) => c.contacts.listContacts('cus_1'),
  },
  {
    service: 'contacts',
    method: 'addContact',
    route: 'POST /api/v1/customers/{id}/contacts',
    call: (c) => c.contacts.addContact('cus_1', IN),
  },
  {
    service: 'contacts',
    method: 'deleteContact',
    route: 'DELETE /api/v1/contacts/{id}',
    call: (c) => c.contacts.deleteContact('con_1'),
  },

  {
    service: 'licenses',
    method: 'list',
    route: 'GET /api/v1/licenses',
    call: (c) => c.licenses.list({ product_id: 'p' }),
    query: { product_id: 'p' },
  },
  {
    service: 'licenses',
    method: 'create',
    route: 'POST /api/v1/licenses',
    call: (c) => c.licenses.create(IN),
  },
  {
    service: 'licenses',
    method: 'bulkCreate',
    route: 'POST /api/v1/licenses/bulk',
    call: (c) => c.licenses.bulkCreate(IN),
  },
  {
    service: 'licenses',
    method: 'get',
    route: 'GET /api/v1/licenses/{id}',
    call: (c) => c.licenses.get('lic_1'),
  },
  {
    service: 'licenses',
    method: 'revoke',
    route: 'POST /api/v1/licenses/{id}/revoke',
    call: (c) => c.licenses.revoke('lic_1', IN),
  },
  {
    service: 'licenses',
    method: 'suspend',
    route: 'POST /api/v1/licenses/{id}/suspend',
    call: (c) => c.licenses.suspend('lic_1'),
  },
  {
    service: 'licenses',
    method: 'reactivate',
    route: 'POST /api/v1/licenses/{id}/reactivate',
    call: (c) => c.licenses.reactivate('lic_1'),
  },
  {
    service: 'licenses',
    method: 'reissue',
    route: 'POST /api/v1/licenses/{id}/reissue',
    call: (c) => c.licenses.reissue('lic_1'),
  },
  {
    service: 'licenses',
    method: 'features',
    route: 'GET /api/v1/licenses/{id}/features',
    call: (c) => c.licenses.features('lic_1'),
  },
  {
    service: 'licenses',
    method: 'validate',
    route: 'POST /api/v1/licenses/validate',
    call: (c) => c.licenses.validate(IN),
  },
  {
    service: 'licenses',
    method: 'listAddons',
    route: 'GET /api/v1/licenses/{id}/addons',
    call: (c) => c.licenses.listAddons('lic_1'),
  },
  {
    service: 'licenses',
    method: 'purchaseAddon',
    route: 'POST /api/v1/licenses/{id}/addons/purchase',
    call: (c) => c.licenses.purchaseAddon('lic_1', IN),
  },
  {
    service: 'licenses',
    method: 'getUsage',
    route: 'GET /api/v1/licenses/{id}/usage',
    call: (c) => c.licenses.getUsage('lic_1'),
  },
  {
    service: 'licenses',
    method: 'upsertEntitlementOverride',
    route: 'POST /api/v1/licenses/{id}/entitlement-overrides',
    call: (c) => c.licenses.upsertEntitlementOverride('lic_1', IN),
  },

  {
    service: 'activations',
    method: 'activate',
    route: 'POST /api/v1/activations',
    call: (c) => c.activations.activate(IN),
  },
  {
    service: 'activations',
    method: 'deactivateByKey',
    route: 'POST /api/v1/activations/deactivate',
    call: (c) => c.activations.deactivateByKey(IN),
  },
  {
    service: 'activations',
    method: 'list',
    route: 'GET /api/v1/activations',
    call: (c) => c.activations.list({ license_id: 'lic_1' }),
    query: { license_id: 'lic_1' },
  },
  {
    service: 'activations',
    method: 'get',
    route: 'GET /api/v1/activations/{id}',
    call: (c) => c.activations.get('act_1'),
  },
  {
    service: 'activations',
    method: 'deactivate',
    route: 'POST /api/v1/activations/{id}/deactivate',
    call: (c) => c.activations.deactivate('act_1'),
  },

  ...crud('machines', 'machines'),
  {
    service: 'machines',
    method: 'decommission',
    route: 'POST /api/v1/machines/{id}/decommission',
    call: (c) => c.machines.decommission('m_1'),
  },

  {
    service: 'subscriptions',
    method: 'list',
    route: 'GET /api/v1/subscriptions',
    call: (c) => c.subscriptions.list({ customer_id: 'c' }),
    query: { customer_id: 'c' },
  },
  {
    service: 'subscriptions',
    method: 'create',
    route: 'POST /api/v1/subscriptions',
    call: (c) => c.subscriptions.create(IN),
  },
  {
    service: 'subscriptions',
    method: 'get',
    route: 'GET /api/v1/subscriptions/{id}',
    call: (c) => c.subscriptions.get('sub_1'),
  },
  {
    service: 'subscriptions',
    method: 'update',
    route: 'PATCH /api/v1/subscriptions/{id}',
    call: (c) => c.subscriptions.update('sub_1', IN),
  },
  {
    service: 'subscriptions',
    method: 'renew',
    route: 'POST /api/v1/subscriptions/{id}/renew',
    call: (c) => c.subscriptions.renew('sub_1', IN),
  },
  {
    service: 'subscriptions',
    method: 'pause',
    route: 'POST /api/v1/subscriptions/{id}/pause',
    call: (c) => c.subscriptions.pause('sub_1', IN),
  },
  {
    service: 'subscriptions',
    method: 'resume',
    route: 'POST /api/v1/subscriptions/{id}/resume',
    call: (c) => c.subscriptions.resume('sub_1', IN),
  },
  {
    service: 'subscriptions',
    method: 'cancel',
    route: 'POST /api/v1/subscriptions/{id}/cancel',
    call: (c) => c.subscriptions.cancel('sub_1', IN),
  },
  {
    service: 'subscriptions',
    method: 'changePlan',
    route: 'POST /api/v1/subscriptions/{id}/change-plan',
    call: (c) => c.subscriptions.changePlan('sub_1', IN),
  },
  {
    service: 'subscriptions',
    method: 'updateSeats',
    route: 'POST /api/v1/subscriptions/{id}/seats',
    call: (c) => c.subscriptions.updateSeats('sub_1', IN),
  },

  ...crud('entitlements', 'entitlements'),
  ...crud('addons', 'addons'),
  ...crud('usageMeters', 'usage-meters'),
  {
    service: 'usage',
    method: 'createAdjustment',
    route: 'POST /api/v1/usage-adjustments',
    call: (c) => c.usage.createAdjustment(IN),
  },
  {
    service: 'usage',
    method: 'grantCredits',
    route: 'POST /api/v1/usage-credits',
    call: (c) => c.usage.grantCredits(IN),
  },
  {
    service: 'usageReporter',
    method: 'report',
    route: 'POST /api/v1/usage/reports',
    call: (c) => c.usageReporter.report([report]),
    body: { reports: [report] },
  },
  {
    service: 'usageReporter',
    method: 'reportSingle',
    route: 'POST /api/v1/usage/reports',
    call: (c) => c.usageReporter.reportSingle(report),
    body: { reports: [report] },
  },

  {
    service: 'orders',
    method: 'list',
    route: 'GET /api/v1/orders',
    call: (c) => c.orders.list({ customer_id: 'c' }),
    query: { customer_id: 'c' },
  },
  {
    service: 'orders',
    method: 'create',
    route: 'POST /api/v1/orders',
    call: (c) => c.orders.create(IN),
  },
  {
    service: 'orders',
    method: 'get',
    route: 'GET /api/v1/orders/{id}',
    call: (c) => c.orders.get('ord_1'),
  },
  {
    service: 'orders',
    method: 'checkout',
    route: 'POST /api/v1/orders/{id}/checkout',
    call: (c) => c.orders.checkout('ord_1'),
  },
  {
    service: 'orders',
    method: 'fulfill',
    route: 'POST /api/v1/orders/{id}/fulfill',
    call: (c) => c.orders.fulfill('ord_1', IN),
  },
  {
    service: 'payments',
    method: 'list',
    route: 'GET /api/v1/payments',
    call: (c) => c.payments.list({ order_id: 'o' }),
    query: { order_id: 'o' },
  },
  {
    service: 'payments',
    method: 'get',
    route: 'GET /api/v1/payments/{id}',
    call: (c) => c.payments.get('pay_1'),
  },
  {
    service: 'payments',
    method: 'refund',
    route: 'POST /api/v1/payments/{id}/refund',
    call: (c) => c.payments.refund('pay_1', IN),
  },
  {
    service: 'payments',
    method: 'reconcile',
    route: 'POST /api/v1/payments/{id}/reconcile',
    call: (c) => c.payments.reconcile('pay_1', IN),
  },
  {
    service: 'invoices',
    method: 'list',
    route: 'GET /api/v1/invoices',
    call: (c) => c.invoices.list({ customer_id: 'c' }),
    query: { customer_id: 'c' },
  },
  {
    service: 'invoices',
    method: 'get',
    route: 'GET /api/v1/invoices/{id}',
    call: (c) => c.invoices.get('inv_1'),
  },
  {
    service: 'invoices',
    method: 'issue',
    route: 'POST /api/v1/invoices/{id}/issue',
    call: (c) => c.invoices.issue('inv_1'),
  },
  {
    service: 'invoices',
    method: 'void',
    route: 'POST /api/v1/invoices/{id}/void',
    call: (c) => c.invoices.void('inv_1'),
  },
  {
    service: 'invoices',
    method: 'pdf',
    route: 'GET /api/v1/invoices/{id}/pdf',
    call: (c) => c.invoices.pdf('inv_1'),
  },

  {
    service: 'webhookEndpoints',
    method: 'list',
    route: 'GET /api/v1/webhook-endpoints',
    call: (c) => c.webhookEndpoints.list({ limit: 5 }),
    query: { limit: '5' },
  },
  {
    service: 'webhookEndpoints',
    method: 'create',
    route: 'POST /api/v1/webhook-endpoints',
    call: (c) => c.webhookEndpoints.create(IN),
  },
  {
    service: 'webhookEndpoints',
    method: 'get',
    route: 'GET /api/v1/webhook-endpoints/{id}',
    call: (c) => c.webhookEndpoints.get('we_1'),
  },
  {
    service: 'webhookEndpoints',
    method: 'update',
    route: 'PATCH /api/v1/webhook-endpoints/{id}',
    call: (c) => c.webhookEndpoints.update('we_1', IN),
  },
  {
    service: 'webhookEndpoints',
    method: 'test',
    route: 'POST /api/v1/webhook-endpoints/{id}/test',
    call: (c) => c.webhookEndpoints.test('we_1'),
  },
  {
    service: 'webhookEvents',
    method: 'list',
    route: 'GET /api/v1/webhook-events',
    call: (c) => c.webhookEvents.list({ endpoint_id: 'we_1' }),
    query: { endpoint_id: 'we_1' },
  },
  {
    service: 'webhookEvents',
    method: 'get',
    route: 'GET /api/v1/webhook-events/{id}',
    call: (c) => c.webhookEvents.get('ev_1'),
  },
  {
    service: 'webhookEvents',
    method: 'retry',
    route: 'POST /api/v1/webhook-events/{id}/retry',
    call: (c) => c.webhookEvents.retry('ev_1'),
  },

  ...crud('applications', 'applications'),
  {
    service: 'apiKeys',
    method: 'list',
    route: 'GET /api/v1/api-keys',
    call: (c) => c.apiKeys.list({ application_id: 'a' }),
    query: { application_id: 'a' },
  },
  {
    service: 'apiKeys',
    method: 'create',
    route: 'POST /api/v1/api-keys',
    call: (c) => c.apiKeys.create(IN),
  },
  {
    service: 'apiKeys',
    method: 'get',
    route: 'GET /api/v1/api-keys/{id}',
    call: (c) => c.apiKeys.get('key_1'),
  },
  {
    service: 'apiKeys',
    method: 'rotate',
    route: 'POST /api/v1/api-keys/{id}/rotate',
    call: (c) => c.apiKeys.rotate('key_1'),
  },
  {
    service: 'apiKeys',
    method: 'revoke',
    route: 'POST /api/v1/api-keys/{id}/revoke',
    call: (c) => c.apiKeys.revoke('key_1', IN),
  },
  {
    service: 'apiKeys',
    method: 'delete',
    route: 'DELETE /api/v1/api-keys/{id}',
    call: (c) => c.apiKeys.delete('key_1'),
  },

  {
    service: 'offlineCertificates',
    method: 'issue',
    route: 'POST /api/v1/offline-certificates',
    call: (c) => c.offlineCertificates.issue(IN),
  },
  {
    service: 'offlineCertificates',
    method: 'verify',
    route: 'POST /api/v1/offline-certificates/verify',
    call: (c) => c.offlineCertificates.verify(IN),
  },
  {
    service: 'offlineCertificates',
    method: 'list',
    route: 'GET /api/v1/offline-certificates',
    call: (c) => c.offlineCertificates.list({ license_id: 'l' }),
    query: { license_id: 'l' },
  },
  {
    service: 'offlineCertificates',
    method: 'get',
    route: 'GET /api/v1/offline-certificates/{id}',
    call: (c) => c.offlineCertificates.get('oc_1'),
  },
  {
    service: 'offlineCertificates',
    method: 'approve',
    route: 'POST /api/v1/offline-certificates/{id}/approve',
    call: (c) => c.offlineCertificates.approve('oc_1'),
  },
  {
    service: 'offlineCertificates',
    method: 'revoke',
    route: 'POST /api/v1/offline-certificates/{id}/revoke',
    call: (c) => c.offlineCertificates.revoke('oc_1', IN),
  },
  {
    service: 'offlineCertificates',
    method: 'reissue',
    route: 'POST /api/v1/offline-certificates/{id}/reissue',
    call: (c) => c.offlineCertificates.reissue('oc_1'),
  },

  {
    service: 'referralPrograms',
    method: 'list',
    route: 'GET /api/v1/referral-programs',
    call: (c) => c.referralPrograms.list({ status: 'active' }),
    query: { status: 'active' },
  },
  ...crud('referralPrograms', 'referral-programs').filter((x) => x.method !== 'list'),
  {
    service: 'referralCodes',
    method: 'list',
    route: 'GET /api/v1/referral-codes',
    call: (c) => c.referralCodes.list({ referrer_id: 'r' }),
    query: { referrer_id: 'r' },
  },
  {
    service: 'referralCodes',
    method: 'create',
    route: 'POST /api/v1/referral-codes',
    call: (c) => c.referralCodes.create(IN),
  },
  {
    service: 'referralCodes',
    method: 'get',
    route: 'GET /api/v1/referral-codes/{id}',
    call: (c) => c.referralCodes.get('rc_1'),
  },
  {
    service: 'referralCodes',
    method: 'disable',
    route: 'POST /api/v1/referral-codes/{id}/disable',
    call: (c) => c.referralCodes.disable('rc_1'),
  },
  {
    service: 'referralEvents',
    method: 'list',
    route: 'GET /api/v1/referral-events',
    call: (c) => c.referralEvents.list({ code_id: 'rc_1', status: 'pending' }),
    query: { code_id: 'rc_1', status: 'pending' },
  },
  {
    service: 'referralEvents',
    method: 'create',
    route: 'POST /api/v1/referral-events',
    call: (c) => c.referralEvents.create(IN),
  },
  {
    service: 'referralEvents',
    method: 'get',
    route: 'GET /api/v1/referral-events/{id}',
    call: (c) => c.referralEvents.get('re_1'),
  },
  {
    service: 'referralEvents',
    method: 'qualify',
    route: 'POST /api/v1/referral-events/{id}/qualify',
    call: (c) => c.referralEvents.qualify('re_1', IN),
  },
  {
    service: 'referralEvents',
    method: 'reward',
    route: 'POST /api/v1/referral-events/{id}/reward',
    call: (c) => c.referralEvents.reward('re_1', IN),
  },
  {
    service: 'referralEvents',
    method: 'reject',
    route: 'POST /api/v1/referral-events/{id}/reject',
    call: (c) => c.referralEvents.reject('re_1', IN),
  },

  ...crud('commissionPlans', 'commission-plans'),
  ...crud('affiliates', 'affiliates').filter((x) => x.method !== 'list'),
  {
    service: 'affiliates',
    method: 'list',
    route: 'GET /api/v1/affiliates',
    call: (c) => c.affiliates.list({ commission_plan_id: 'cp' }),
    query: { commission_plan_id: 'cp' },
  },
  {
    service: 'affiliates',
    method: 'approve',
    route: 'POST /api/v1/affiliates/{id}/approve',
    call: (c) => c.affiliates.approve('af_1', IN),
  },
  {
    service: 'affiliates',
    method: 'reject',
    route: 'POST /api/v1/affiliates/{id}/reject',
    call: (c) => c.affiliates.reject('af_1', IN),
  },
  {
    service: 'affiliates',
    method: 'suspend',
    route: 'POST /api/v1/affiliates/{id}/suspend',
    call: (c) => c.affiliates.suspend('af_1'),
  },
  {
    service: 'affiliates',
    method: 'terminate',
    route: 'POST /api/v1/affiliates/{id}/terminate',
    call: (c) => c.affiliates.terminate('af_1'),
  },
  {
    service: 'affiliateLinks',
    method: 'list',
    route: 'GET /api/v1/affiliate-links',
    call: (c) => c.affiliateLinks.list({ product_id: 'p' }),
    query: { product_id: 'p' },
  },
  {
    service: 'affiliateLinks',
    method: 'create',
    route: 'POST /api/v1/affiliate-links',
    call: (c) => c.affiliateLinks.create(IN),
  },
  {
    service: 'affiliateLinks',
    method: 'get',
    route: 'GET /api/v1/affiliate-links/{id}',
    call: (c) => c.affiliateLinks.get('al_1'),
  },
  {
    service: 'affiliateLinks',
    method: 'update',
    route: 'PATCH /api/v1/affiliate-links/{id}',
    call: (c) => c.affiliateLinks.update('al_1', IN),
  },
  {
    service: 'affiliateLinks',
    method: 'disable',
    route: 'POST /api/v1/affiliate-links/{id}/disable',
    call: (c) => c.affiliateLinks.disable('al_1'),
  },
  {
    service: 'affiliateEvents',
    method: 'list',
    route: 'GET /api/v1/affiliate-events',
    call: (c) => c.affiliateEvents.list({ reviewed: false }),
    query: { reviewed: 'false' },
  },
  {
    service: 'affiliateEvents',
    method: 'create',
    route: 'POST /api/v1/affiliate-events',
    call: (c) => c.affiliateEvents.create(IN),
  },
  {
    service: 'affiliateEvents',
    method: 'get',
    route: 'GET /api/v1/affiliate-events/{id}',
    call: (c) => c.affiliateEvents.get('ae_1'),
  },
  {
    service: 'affiliateEvents',
    method: 'review',
    route: 'POST /api/v1/affiliate-events/{id}/review',
    call: (c) => c.affiliateEvents.review('ae_1', IN),
  },
  {
    service: 'commissionPayouts',
    method: 'list',
    route: 'GET /api/v1/commission-payouts',
    call: (c) => c.commissionPayouts.list({ payee_id: 'af_1' }),
    query: { payee_id: 'af_1' },
  },
  {
    service: 'commissionPayouts',
    method: 'create',
    route: 'POST /api/v1/commission-payouts',
    call: (c) => c.commissionPayouts.create(IN),
  },
  {
    service: 'commissionPayouts',
    method: 'get',
    route: 'GET /api/v1/commission-payouts/{id}',
    call: (c) => c.commissionPayouts.get('cpo_1'),
  },
  {
    service: 'commissionPayouts',
    method: 'approve',
    route: 'POST /api/v1/commission-payouts/{id}/approve',
    call: (c) => c.commissionPayouts.approve('cpo_1', IN),
  },
  {
    service: 'commissionPayouts',
    method: 'pay',
    route: 'POST /api/v1/commission-payouts/{id}/pay',
    call: (c) => c.commissionPayouts.pay('cpo_1', IN),
  },
  {
    service: 'commissionPayouts',
    method: 'fail',
    route: 'POST /api/v1/commission-payouts/{id}/fail',
    call: (c) => c.commissionPayouts.fail('cpo_1', IN),
  },
  {
    service: 'commissionPayouts',
    method: 'reverse',
    route: 'POST /api/v1/commission-payouts/{id}/reverse',
    call: (c) => c.commissionPayouts.reverse('cpo_1', IN),
  },

  {
    service: 'auditLogs',
    method: 'list',
    route: 'GET /api/v1/audit-logs',
    call: (c) => c.auditLogs.list({ action: 'x' }),
    query: { action: 'x' },
  },
  {
    service: 'auditLogs',
    method: 'get',
    route: 'GET /api/v1/audit-logs/{id}',
    call: (c) => c.auditLogs.get('al_1'),
  },
  {
    service: 'auditLogs',
    method: 'exportCsv',
    route: 'GET /api/v1/audit-logs/export',
    call: (c) => c.auditLogs.exportCsv(),
    query: { format: 'csv' },
    raw: true,
  },
  {
    service: 'system',
    method: 'signingKey',
    route: 'GET /api/v1/signing-key',
    call: (c) => c.system.signingKey(),
  },
  { service: 'system', method: 'health', route: 'GET /health', call: (c) => c.system.health() },

  ...crud('gatewayConfigs', 'gateway-configs'),
  {
    service: 'gatewayConfigs',
    method: 'setDefault',
    route: 'POST /api/v1/gateway-configs/{id}/set-default',
    call: (c) => c.gatewayConfigs.setDefault('gw_1'),
  },
  {
    service: 'gatewayConfigs',
    method: 'test',
    route: 'POST /api/v1/gateway-configs/{id}/test',
    call: (c) => c.gatewayConfigs.test('gw_1'),
  },
  {
    service: 'gatewayConfigs',
    method: 'listWebhookLogs',
    route: 'GET /api/v1/gateway-webhook-logs',
    call: (c) => c.gatewayConfigs.listWebhookLogs({ provider: 'stripe' }),
    query: { provider: 'stripe' },
  },
  {
    service: 'paymentMethods',
    method: 'list',
    route: 'GET /api/v1/payment-methods',
    call: (c) => c.paymentMethods.list({ customer_id: 'cus_1' }),
    query: { customer_id: 'cus_1' },
  },
  {
    service: 'paymentMethods',
    method: 'create',
    route: 'POST /api/v1/payment-methods',
    call: (c) => c.paymentMethods.create(IN),
  },
  {
    service: 'paymentMethods',
    method: 'get',
    route: 'GET /api/v1/payment-methods/{id}',
    call: (c) => c.paymentMethods.get('pm_1'),
  },
  {
    service: 'paymentMethods',
    method: 'setDefault',
    route: 'POST /api/v1/payment-methods/{id}/set-default',
    call: (c) => c.paymentMethods.setDefault('pm_1'),
  },
  {
    service: 'paymentMethods',
    method: 'delete',
    route: 'DELETE /api/v1/payment-methods/{id}',
    call: (c) => c.paymentMethods.delete('pm_1'),
  },
  {
    service: 'paymentMethods',
    method: 'checkoutOptions',
    route: 'GET /api/v1/checkout-options',
    call: (c) => c.paymentMethods.checkoutOptions('cus_1', 'prod_1'),
    query: { customer_id: 'cus_1', product_id: 'prod_1' },
  },
  {
    service: 'gatewayProviders',
    method: 'list',
    route: 'GET /api/v1/gateway-providers',
    call: (c) => c.gatewayProviders.list(),
  },
  {
    service: 'gatewayProviders',
    method: 'schema',
    route: 'GET /api/v1/gateway-providers/{provider}/schema',
    call: (c) => c.gatewayProviders.schema('stripe'),
  },

  ...crud('releases', 'releases'),
  {
    service: 'releases',
    method: 'publish',
    route: 'POST /api/v1/releases/{id}/publish',
    call: (c) => c.releases.publish('rel_1'),
  },
  {
    service: 'releases',
    method: 'yank',
    route: 'POST /api/v1/releases/{id}/yank',
    call: (c) => c.releases.yank('rel_1', { reason: 'x' }),
    body: { reason: 'x' },
  },
  {
    service: 'releases',
    method: 'listArtifacts',
    route: 'GET /api/v1/releases/{id}/artifacts',
    call: (c) => c.releases.listArtifacts('rel_1'),
  },
  {
    service: 'releases',
    method: 'uploadArtifact',
    route: 'POST /api/v1/releases/{id}/artifacts',
    call: (c) =>
      c.releases.uploadArtifact('rel_1', { file: new Blob(['x']), filename: 'a.bin', os: 'linux' }),
  },
  {
    service: 'releases',
    method: 'checksum',
    route: 'GET /api/v1/artifacts/{id}/checksum',
    call: (c) => c.releases.checksum('art_1'),
  },
  {
    service: 'releases',
    method: 'authorizeDownload',
    route: 'POST /api/v1/downloads/authorize',
    call: (c) => c.releases.authorizeDownload(IN),
  },
  {
    service: 'releases',
    method: 'download',
    route: 'GET /api/v1/downloads/{token}',
    call: (c) => c.releases.download('tok_1'),
  },

  {
    service: 'notificationTemplates',
    method: 'list',
    route: 'GET /api/v1/notification-templates',
    call: (c) => c.notificationTemplates.list({ channel: 'email' }),
    query: { channel: 'email' },
  },
  {
    service: 'notificationTemplates',
    method: 'create',
    route: 'POST /api/v1/notification-templates',
    call: (c) => c.notificationTemplates.create(IN),
  },
  {
    service: 'notificationTemplates',
    method: 'get',
    route: 'GET /api/v1/notification-templates/{id}',
    call: (c) => c.notificationTemplates.get('nt_1'),
  },
  {
    service: 'notificationTemplates',
    method: 'update',
    route: 'PATCH /api/v1/notification-templates/{id}',
    call: (c) => c.notificationTemplates.update('nt_1', IN),
  },
  {
    service: 'notifications',
    method: 'list',
    route: 'GET /api/v1/notifications',
    call: (c) => c.notifications.list({ provider: 'smtp' }),
    query: { provider: 'smtp' },
  },
  {
    service: 'notifications',
    method: 'get',
    route: 'GET /api/v1/notifications/{id}',
    call: (c) => c.notifications.get('n_1'),
  },
  {
    service: 'notifications',
    method: 'queue',
    route: 'POST /api/v1/notifications',
    call: (c) => c.notifications.queue(IN),
  },
  {
    service: 'notifications',
    method: 'retry',
    route: 'POST /api/v1/notifications/{id}/retry',
    call: (c) => c.notifications.retry('n_1'),
  },
  {
    service: 'applicationNotifications',
    method: 'list',
    route: 'GET /api/v1/application-notifications',
    call: (c) => c.applicationNotifications.list({ product_id: 'p' }),
    query: { product_id: 'p' },
  },
  {
    service: 'applicationNotifications',
    method: 'create',
    route: 'POST /api/v1/application-notifications',
    call: (c) => c.applicationNotifications.create(IN),
  },
  {
    service: 'applicationNotifications',
    method: 'get',
    route: 'GET /api/v1/application-notifications/{id}',
    call: (c) => c.applicationNotifications.get('an_1'),
  },
  {
    service: 'applicationNotifications',
    method: 'update',
    route: 'PATCH /api/v1/application-notifications/{id}',
    call: (c) => c.applicationNotifications.update('an_1', IN),
  },
  {
    service: 'applicationNotifications',
    method: 'feed',
    route: 'POST /api/v1/application-notifications/feed',
    call: (c) => c.applicationNotifications.feed(IN),
  },
  {
    service: 'applicationNotifications',
    method: 'acknowledge',
    route: 'POST /api/v1/application-notifications/{id}/ack',
    call: (c) => c.applicationNotifications.acknowledge('an_1', IN),
  },
];
