import type * as M from '../models/generated.js';
import type * as C from '../models/contracts.js';
import type { RequestOptions } from '../transport.js';
import { pathSegment, Transport } from '../transport.js';
import { CollectionService, ResourceService } from './base.js';

export class PlanService extends ResourceService<
  M.Plan,
  M.PlanCreateParams,
  M.PlanUpdateParams,
  M.PlanListParams
> {
  constructor(http: Transport) {
    super(http, '/plans');
  }
  compare(productId: string, options?: RequestOptions): Promise<C.PlanComparison> {
    return this.http.request(
      { method: 'GET', path: '/plans/compare', query: { product_id: productId }, kind: 'data' },
      options,
    );
  }
}

export class ContactService {
  constructor(private readonly http: Transport) {}
  listContacts(customerId: string, options?: RequestOptions): Promise<ReadonlyArray<M.Contact>> {
    return this.http.request(
      { method: 'GET', path: `/customers/${pathSegment(customerId)}/contacts`, kind: 'data' },
      options,
    );
  }
  addContact(
    customerId: string,
    input: M.ContactCreateParams,
    options?: RequestOptions,
  ): Promise<M.Contact> {
    return this.http.request(
      {
        method: 'POST',
        path: `/customers/${pathSegment(customerId)}/contacts`,
        body: input,
        kind: 'data',
      },
      options,
    );
  }
  deleteContact(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request(
      { method: 'DELETE', path: `/contacts/${pathSegment(id)}`, kind: 'none' },
      options,
    );
  }
}

export class LicenseService extends CollectionService<M.License, M.LicenseListParams> {
  constructor(http: Transport) {
    super(http, '/licenses');
  }
  create(input: M.LicenseCreateParams, options?: RequestOptions): Promise<M.License> {
    return this.http.request(
      { method: 'POST', path: '/licenses', body: input, kind: 'data' },
      options,
    );
  }
  bulkCreate(
    input: M.LicenseBulkCreateParams,
    options?: RequestOptions,
  ): Promise<M.LicenseBulkCreateResponse> {
    return this.http.request({ method: 'POST', path: '/licenses/bulk', body: input }, options);
  }
  validate(
    input: M.LicenseValidateParams,
    options?: RequestOptions,
  ): Promise<M.LicenseValidationResponse> {
    return this.http.request(
      {
        method: 'POST',
        path: '/licenses/validate',
        body: input,
        kind: 'data',
        acceptedStatuses: [422],
      },
      options,
    );
  }
  revoke(
    id: string,
    input: M.LicenseRevokeParams,
    options?: RequestOptions,
  ): Promise<C.StatusResult> {
    return this.http.request(
      { method: 'POST', path: `${this.item(id)}/revoke`, body: input },
      options,
    );
  }
  suspend(
    id: string,
    input: M.LicenseSuspendParams,
    options?: RequestOptions,
  ): Promise<C.StatusResult> {
    return this.http.request(
      { method: 'POST', path: `${this.item(id)}/suspend`, body: input },
      options,
    );
  }
  reactivate(id: string, options?: RequestOptions): Promise<C.StatusResult> {
    return this.http.request({ method: 'POST', path: `${this.item(id)}/reactivate` }, options);
  }
  reissue(id: string, options?: RequestOptions): Promise<M.License> {
    return this.action(id, 'reissue', undefined, options);
  }
  features(id: string, options?: RequestOptions): Promise<Record<string, M.ResolvedFeature>> {
    return this.http.request(
      { method: 'GET', path: `${this.item(id)}/features`, kind: 'data' },
      options,
    );
  }
  listAddons(id: string, options?: RequestOptions): Promise<M.ListResponse<M.LicenseAddon>> {
    return this.http.request(
      { method: 'GET', path: `${this.item(id)}/addons`, kind: 'list' },
      options,
    );
  }
  purchaseAddon(
    id: string,
    input: M.LicenseAddonPurchaseParams,
    options?: RequestOptions,
  ): Promise<M.LicenseAddon> {
    return this.action(id, 'addons/purchase', input, options);
  }
  getUsage(id: string, options?: RequestOptions): Promise<M.ListResponse<M.UsageSummary>> {
    return this.http.request(
      { method: 'GET', path: `${this.item(id)}/usage`, kind: 'list' },
      options,
    );
  }
  upsertEntitlementOverride(
    id: string,
    input: M.EntitlementOverrideParams,
    options?: RequestOptions,
  ): Promise<void> {
    return this.action(id, 'entitlement-overrides', input, options, 'none');
  }
}

export class ActivationService {
  constructor(private readonly http: Transport) {}
  activate(input: M.ActivateParams, options?: RequestOptions): Promise<M.ActivateResponse> {
    return this.http.request(
      { method: 'POST', path: '/activations', body: input, kind: 'data' },
      options,
    );
  }
  deactivateByKey(input: M.DeactivateByKeyParams, options?: RequestOptions): Promise<void> {
    return this.http.request(
      { method: 'POST', path: '/activations/deactivate', body: input, kind: 'none' },
      options,
    );
  }
  list(
    params?: M.ActivationListParams,
    options?: RequestOptions,
  ): Promise<M.ListResponse<M.Activation>> {
    return this.http.request(
      {
        method: 'GET',
        path: '/activations',
        query: params as Record<string, string | number | undefined>,
        kind: 'list',
      },
      options,
    );
  }
  get(id: string, options?: RequestOptions): Promise<M.Activation> {
    return this.http.request(
      { method: 'GET', path: `/activations/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  deactivate(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request(
      { method: 'POST', path: `/activations/${pathSegment(id)}/deactivate`, kind: 'none' },
      options,
    );
  }
}

export class MachineService extends ResourceService<
  M.Machine,
  M.MachineCreateParams,
  M.MachineUpdateParams,
  M.MachineListParams,
  M.Machine,
  C.MachineDetail
> {
  constructor(http: Transport) {
    super(http, '/machines');
  }
  decommission(id: string, options?: RequestOptions): Promise<void> {
    return this.action(id, 'decommission', undefined, options, 'none');
  }
}

export class SubscriptionService extends CollectionService<
  M.Subscription,
  M.SubscriptionListParams,
  C.SubscriptionDetail
> {
  constructor(http: Transport) {
    super(http, '/subscriptions');
  }
  create(
    input: M.SubscriptionCreateParams,
    options?: RequestOptions,
  ): Promise<M.SubscriptionMutationResult> {
    return this.http.request(
      { method: 'POST', path: '/subscriptions', body: input, kind: 'data' },
      options,
    );
  }
  update(
    id: string,
    input: M.SubscriptionUpdateParams,
    options?: RequestOptions,
  ): Promise<M.Subscription> {
    return this.http.request(
      { method: 'PATCH', path: this.item(id), body: input, kind: 'data' },
      options,
    );
  }
  renew(
    id: string,
    input: M.SubscriptionRenewParams,
    options?: RequestOptions,
  ): Promise<M.SubscriptionMutationResult> {
    return this.action(id, 'renew', input, options);
  }
  pause(
    id: string,
    input: M.SubscriptionPauseParams,
    options?: RequestOptions,
  ): Promise<M.SubscriptionMutationResult> {
    return this.action(id, 'pause', input, options);
  }
  resume(
    id: string,
    input: M.SubscriptionResumeParams,
    options?: RequestOptions,
  ): Promise<M.SubscriptionMutationResult> {
    return this.action(id, 'resume', input, options);
  }
  cancel(
    id: string,
    input: M.SubscriptionCancelParams,
    options?: RequestOptions,
  ): Promise<M.SubscriptionMutationResult> {
    return this.action(id, 'cancel', input, options);
  }
  changePlan(
    id: string,
    input: M.SubscriptionChangePlanParams,
    options?: RequestOptions,
  ): Promise<M.SubscriptionMutationResult> {
    return this.action(id, 'change-plan', input, options);
  }
  updateSeats(
    id: string,
    input: M.SubscriptionSeatParams,
    options?: RequestOptions,
  ): Promise<M.SubscriptionMutationResult> {
    return this.action(id, 'seats', input, options);
  }
}

export class UsageService {
  constructor(private readonly http: Transport) {}
  createAdjustment(
    input: M.UsageAdjustmentParams,
    options?: RequestOptions,
  ): Promise<M.UsageAdjustment> {
    return this.http.request(
      { method: 'POST', path: '/usage-adjustments', body: input, kind: 'data' },
      options,
    );
  }
  grantCredits(input: M.UsageCreditParams, options?: RequestOptions): Promise<M.UsageCredit> {
    return this.http.request(
      { method: 'POST', path: '/usage-credits', body: input, kind: 'data' },
      options,
    );
  }
}

export class OrderService {
  constructor(private readonly http: Transport) {}
  list(params?: M.OrderListParams, options?: RequestOptions): Promise<M.ListResponse<M.Order>> {
    return this.http.request(
      {
        method: 'GET',
        path: '/orders',
        query: params as Record<string, string | number | undefined>,
        kind: 'list',
      },
      options,
    );
  }
  create(input: C.OrderCreateInput, options?: RequestOptions): Promise<C.OrderCreateResult> {
    return this.http.request(
      { method: 'POST', path: '/orders', body: input, kind: 'data' },
      options,
    );
  }
  get(id: string, options?: RequestOptions): Promise<C.OrderDetail> {
    return this.http.request(
      { method: 'GET', path: `/orders/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  checkout(id: string, options?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.request(
      { method: 'POST', path: `/orders/${pathSegment(id)}/checkout`, kind: 'data' },
      options,
    );
  }
  fulfill(
    id: string,
    input?: C.OrderFulfillInput,
    options?: RequestOptions,
  ): Promise<C.StatusResult> {
    return this.http.request(
      { method: 'POST', path: `/orders/${pathSegment(id)}/fulfill`, body: input },
      options,
    );
  }
}

export class PaymentService {
  constructor(private readonly http: Transport) {}
  list(params?: M.PaymentListParams, options?: RequestOptions): Promise<M.ListResponse<M.Payment>> {
    return this.http.request(
      {
        method: 'GET',
        path: '/payments',
        query: params as Record<string, string | number | undefined>,
        kind: 'list',
      },
      options,
    );
  }
  get(id: string, options?: RequestOptions): Promise<M.Payment> {
    return this.http.request(
      { method: 'GET', path: `/payments/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  refund(id: string, input: M.PaymentRefundParams, options?: RequestOptions): Promise<M.Payment> {
    return this.http.request(
      { method: 'POST', path: `/payments/${pathSegment(id)}/refund`, body: input, kind: 'data' },
      options,
    );
  }
  reconcile(
    id: string,
    input: M.PaymentReconcileParams,
    options?: RequestOptions,
  ): Promise<M.Payment> {
    return this.http.request(
      { method: 'POST', path: `/payments/${pathSegment(id)}/reconcile`, body: input, kind: 'data' },
      options,
    );
  }
}

export class InvoiceService {
  constructor(private readonly http: Transport) {}
  list(params?: M.InvoiceListParams, options?: RequestOptions): Promise<M.ListResponse<M.Invoice>> {
    return this.http.request(
      {
        method: 'GET',
        path: '/invoices',
        query: params as Record<string, string | number | undefined>,
        kind: 'list',
      },
      options,
    );
  }
  get(id: string, options?: RequestOptions): Promise<C.InvoiceDetail> {
    return this.http.request(
      { method: 'GET', path: `/invoices/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  issue(id: string, options?: RequestOptions): Promise<C.StatusResult> {
    return this.http.request(
      { method: 'POST', path: `/invoices/${pathSegment(id)}/issue` },
      options,
    );
  }
  void(id: string, options?: RequestOptions): Promise<C.StatusResult> {
    return this.http.request(
      { method: 'POST', path: `/invoices/${pathSegment(id)}/void` },
      options,
    );
  }
  pdf(id: string, options?: RequestOptions): Promise<Response> {
    return this.http.request(
      { method: 'GET', path: `/invoices/${pathSegment(id)}/pdf`, kind: 'raw' },
      options,
    );
  }
}

export class WebhookEndpointService extends CollectionService<
  M.WebhookEndpoint,
  M.WebhookEndpointListParams
> {
  constructor(http: Transport) {
    super(http, '/webhook-endpoints');
  }
  create(
    input: M.WebhookEndpointCreateParams,
    options?: RequestOptions,
  ): Promise<M.WebhookEndpointCreateResult> {
    return this.http.request(
      { method: 'POST', path: '/webhook-endpoints', body: input, kind: 'data' },
      options,
    );
  }
  update(
    id: string,
    input: M.WebhookEndpointUpdateParams,
    options?: RequestOptions,
  ): Promise<M.WebhookEndpoint> {
    return this.http.request(
      { method: 'PATCH', path: this.item(id), body: input, kind: 'data' },
      options,
    );
  }
  test(id: string, options?: RequestOptions): Promise<M.WebhookEvent> {
    return this.action(id, 'test', undefined, options);
  }
}

export class WebhookEventService {
  constructor(private readonly http: Transport) {}
  list(
    params?: M.WebhookEventListParams,
    options?: RequestOptions,
  ): Promise<M.ListResponse<M.WebhookEvent>> {
    return this.http.request(
      {
        method: 'GET',
        path: '/webhook-events',
        query: params as Record<string, string | number | undefined>,
        kind: 'list',
      },
      options,
    );
  }
  get(id: string, options?: RequestOptions): Promise<M.WebhookEvent> {
    return this.http.request(
      { method: 'GET', path: `/webhook-events/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  retry(id: string, options?: RequestOptions): Promise<M.WebhookEvent> {
    return this.http.request(
      { method: 'POST', path: `/webhook-events/${pathSegment(id)}/retry`, kind: 'data' },
      options,
    );
  }
}

export class ApiKeyService {
  constructor(private readonly http: Transport) {}
  list(params?: M.APIKeyListParams, options?: RequestOptions): Promise<M.ListResponse<M.APIKey>> {
    return this.http.request(
      {
        method: 'GET',
        path: '/api-keys',
        query: params as Record<string, string | number | undefined>,
        kind: 'list',
      },
      options,
    );
  }
  create(input: M.APIKeyCreateParams, options?: RequestOptions): Promise<C.ApiKeySecretResult> {
    return this.http.request(
      { method: 'POST', path: '/api-keys', body: input, kind: 'data' },
      options,
    );
  }
  get(id: string, options?: RequestOptions): Promise<M.APIKey> {
    return this.http.request(
      { method: 'GET', path: `/api-keys/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  rotate(id: string, options?: RequestOptions): Promise<C.ApiKeySecretResult> {
    return this.http.request(
      { method: 'POST', path: `/api-keys/${pathSegment(id)}/rotate`, kind: 'data' },
      options,
    );
  }
  revoke(
    id: string,
    input: M.APIKeyRevokeParams,
    options?: RequestOptions,
  ): Promise<C.StatusResult> {
    return this.http.request(
      { method: 'POST', path: `/api-keys/${pathSegment(id)}/revoke`, body: input },
      options,
    );
  }
  delete(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request(
      { method: 'DELETE', path: `/api-keys/${pathSegment(id)}`, kind: 'none' },
      options,
    );
  }
}

export class OfflineCertificateService {
  constructor(private readonly http: Transport) {}
  issue(input: C.OfflineIssueInput, options?: RequestOptions): Promise<C.OfflineIssueResult> {
    return this.http.request(
      { method: 'POST', path: '/offline-certificates', body: input, kind: 'data' },
      options,
    );
  }
  verify(input: C.OfflineVerifyInput, options?: RequestOptions): Promise<C.OfflineVerifyResult> {
    return this.http.request(
      {
        method: 'POST',
        path: '/offline-certificates/verify',
        body: input,
        kind: 'data',
        acceptedStatuses: [422],
      },
      options,
    );
  }
  list(
    params?: M.OfflineCertificateListParams,
    options?: RequestOptions,
  ): Promise<M.ListResponse<M.OfflineCertificate>> {
    return this.http.request(
      {
        method: 'GET',
        path: '/offline-certificates',
        query: params as Record<string, string | number | undefined>,
        kind: 'list',
      },
      options,
    );
  }
  get(id: string, options?: RequestOptions): Promise<M.OfflineCertificate> {
    return this.http.request(
      { method: 'GET', path: `/offline-certificates/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  approve(id: string, options?: RequestOptions): Promise<C.StatusResult> {
    return this.http.request(
      { method: 'POST', path: `/offline-certificates/${pathSegment(id)}/approve` },
      options,
    );
  }
  revoke(
    id: string,
    input: M.OfflineCertificateRevokeParams,
    options?: RequestOptions,
  ): Promise<C.StatusResult> {
    return this.http.request(
      { method: 'POST', path: `/offline-certificates/${pathSegment(id)}/revoke`, body: input },
      options,
    );
  }
  reissue(id: string, options?: RequestOptions): Promise<C.OfflineIssueResult> {
    return this.http.request(
      { method: 'POST', path: `/offline-certificates/${pathSegment(id)}/reissue`, kind: 'data' },
      options,
    );
  }
}

export class AuditLogService {
  constructor(private readonly http: Transport) {}
  list(
    params?: M.AuditLogListParams,
    options?: RequestOptions,
  ): Promise<M.ListResponse<M.AuditLog>> {
    return this.http.request(
      {
        method: 'GET',
        path: '/audit-logs',
        query: params as Record<string, string | number | undefined>,
        kind: 'list',
      },
      options,
    );
  }
  get(id: string, options?: RequestOptions): Promise<M.AuditLog> {
    return this.http.request(
      { method: 'GET', path: `/audit-logs/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  exportCsv(params?: M.AuditLogListParams, options?: RequestOptions): Promise<Response> {
    return this.http.request(
      {
        method: 'GET',
        path: '/audit-logs/export',
        query: params as Record<string, string | number | undefined>,
        kind: 'raw',
      },
      options,
    );
  }
}

export class SystemService {
  constructor(private readonly http: Transport) {}
  signingKey(options?: RequestOptions): Promise<C.SigningKey> {
    return this.http.request({ method: 'GET', path: '/signing-key' }, options);
  }
  health(options?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.request(
      { method: 'GET', path: '/health', unprefixed: true, unauthenticated: true },
      options,
    );
  }
}

export class ReferralCodeService extends CollectionService<
  M.ReferralCode,
  M.ReferralCodeListParams
> {
  constructor(http: Transport) {
    super(http, '/referral-codes');
  }
  create(input: M.ReferralCodeCreateParams, options?: RequestOptions): Promise<M.ReferralCode> {
    return this.http.request(
      { method: 'POST', path: '/referral-codes', body: input, kind: 'data' },
      options,
    );
  }
  disable(id: string, options?: RequestOptions): Promise<void> {
    return this.action(id, 'disable', undefined, options, 'none');
  }
}
export class ReferralEventService extends CollectionService<
  M.ReferralEvent,
  M.ReferralEventListParams
> {
  constructor(http: Transport) {
    super(http, '/referral-events');
  }
  create(input: M.ReferralEventCreateParams, options?: RequestOptions): Promise<M.ReferralEvent> {
    return this.http.request(
      { method: 'POST', path: '/referral-events', body: input, kind: 'data' },
      options,
    );
  }
  qualify(id: string, options?: RequestOptions): Promise<M.ReferralEvent> {
    return this.action(id, 'qualify', undefined, options);
  }
  reward(id: string, options?: RequestOptions): Promise<M.ReferralEvent> {
    return this.action(id, 'reward', undefined, options);
  }
  reject(id: string, options?: RequestOptions): Promise<M.ReferralEvent> {
    return this.action(id, 'reject', undefined, options);
  }
}
export class AffiliateService extends ResourceService<
  M.Affiliate,
  M.AffiliateCreateParams,
  M.AffiliateUpdateParams,
  M.AffiliateListParams
> {
  constructor(http: Transport) {
    super(http, '/affiliates');
  }
  approve(id: string, options?: RequestOptions): Promise<M.Affiliate> {
    return this.action(id, 'approve', undefined, options);
  }
  reject(id: string, options?: RequestOptions): Promise<M.Affiliate> {
    return this.action(id, 'reject', undefined, options);
  }
  suspend(id: string, options?: RequestOptions): Promise<M.Affiliate> {
    return this.action(id, 'suspend', undefined, options);
  }
  terminate(id: string, options?: RequestOptions): Promise<M.Affiliate> {
    return this.action(id, 'terminate', undefined, options);
  }
}
export class AffiliateLinkService extends CollectionService<
  M.AffiliateLink,
  M.AffiliateLinkListParams
> {
  constructor(http: Transport) {
    super(http, '/affiliate-links');
  }
  create(input: M.AffiliateLinkCreateParams, options?: RequestOptions): Promise<M.AffiliateLink> {
    return this.http.request(
      { method: 'POST', path: '/affiliate-links', body: input, kind: 'data' },
      options,
    );
  }
  update(
    id: string,
    input: M.AffiliateLinkUpdateParams,
    options?: RequestOptions,
  ): Promise<M.AffiliateLink> {
    return this.http.request(
      { method: 'PATCH', path: this.item(id), body: input, kind: 'data' },
      options,
    );
  }
  disable(id: string, options?: RequestOptions): Promise<void> {
    return this.action(id, 'disable', undefined, options, 'none');
  }
}
export class AffiliateEventService extends CollectionService<
  M.AffiliateEvent,
  M.AffiliateEventListParams
> {
  constructor(http: Transport) {
    super(http, '/affiliate-events');
  }
  create(input: M.AffiliateEventCreateParams, options?: RequestOptions): Promise<M.AffiliateEvent> {
    return this.http.request(
      { method: 'POST', path: '/affiliate-events', body: input, kind: 'data' },
      options,
    );
  }
  review(id: string, options?: RequestOptions): Promise<M.AffiliateEvent> {
    return this.action(id, 'review', undefined, options);
  }
}
export class CommissionPayoutService extends CollectionService<
  M.CommissionPayout,
  M.CommissionPayoutListParams
> {
  constructor(http: Transport) {
    super(http, '/commission-payouts');
  }
  create(
    input: M.CommissionPayoutCreateParams,
    options?: RequestOptions,
  ): Promise<M.CommissionPayout> {
    return this.http.request(
      { method: 'POST', path: '/commission-payouts', body: input, kind: 'data' },
      options,
    );
  }
  approve(id: string, options?: RequestOptions): Promise<M.CommissionPayout> {
    return this.action(id, 'approve', undefined, options);
  }
  pay(id: string, options?: RequestOptions): Promise<M.CommissionPayout> {
    return this.action(id, 'pay', undefined, options);
  }
  fail(id: string, options?: RequestOptions): Promise<M.CommissionPayout> {
    return this.action(id, 'fail', undefined, options);
  }
  reverse(id: string, options?: RequestOptions): Promise<M.CommissionPayout> {
    return this.action(id, 'reverse', undefined, options);
  }
}
