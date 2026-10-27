import type * as M from '../models/generated.js';
import type * as C from '../models/contracts.js';
import type { RequestOptions } from '../transport.js';
import { pathSegment, Transport } from '../transport.js';
import { CollectionService, ResourceService } from './base.js';

/** Pricing plans of a product. New plans are drafts; set `status: "active"` to sell or compare them. */
export class PlanService extends ResourceService<
  M.Plan,
  M.PlanCreateParams,
  M.PlanUpdateParams,
  M.PlanListParams
> {
  constructor(http: Transport) {
    super(http, '/plans');
  }
  /** Feature/limit/pricing matrix across the product's active plans. `features` and `limits` are null when no plan defines any. */
  compare(productId: string, options?: RequestOptions): Promise<C.PlanComparison> {
    return this.http.request(
      { method: 'GET', path: '/plans/compare', query: { product_id: productId }, kind: 'data' },
      options,
    );
  }
}

/** Contacts attached to a customer. */
export class ContactService {
  constructor(private readonly http: Transport) {}
  /** All contacts of a customer (not paginated). */
  listContacts(customerId: string, options?: RequestOptions): Promise<ReadonlyArray<M.Contact>> {
    return this.http.request(
      { method: 'GET', path: `/customers/${pathSegment(customerId)}/contacts`, kind: 'data' },
      options,
    );
  }
  /** Add a contact to a customer. */
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
  /** Delete a contact by its own ID. */
  deleteContact(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request(
      { method: 'DELETE', path: `/contacts/${pathSegment(id)}`, kind: 'none' },
      options,
    );
  }
}

/** Licenses: issuance, lifecycle, validation, add-ons, usage, and entitlement overrides. */
export class LicenseService extends CollectionService<M.License, M.LicenseListParams> {
  constructor(http: Transport) {
    super(http, '/licenses');
  }
  /** Issue one license. */
  create(input: M.LicenseCreateParams, options?: RequestOptions): Promise<M.License> {
    return this.http.request(
      { method: 'POST', path: '/licenses', body: input, kind: 'data' },
      options,
    );
  }
  /** Issue 1–100 licenses from one template; returns `{ data, count }`. */
  bulkCreate(
    input: M.LicenseBulkCreateParams,
    options?: RequestOptions,
  ): Promise<M.LicenseBulkCreateResponse> {
    return this.http.request({ method: 'POST', path: '/licenses/bulk', body: input }, options);
  }
  /** Validate a license key (public route: the key is the credential). An invalid license is a result with `valid: false` (HTTP 422), not an error. */
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
  /** Permanently revoke a license; returns `{ status }`. */
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
  /** Suspend a license. The server records no reason for suspensions. */
  suspend(id: string, options?: RequestOptions): Promise<C.StatusResult> {
    return this.http.request({ method: 'POST', path: `${this.item(id)}/suspend` }, options);
  }
  /** Reactivate a suspended license; returns `{ status }`. */
  reactivate(id: string, options?: RequestOptions): Promise<C.StatusResult> {
    return this.http.request({ method: 'POST', path: `${this.item(id)}/reactivate` }, options);
  }
  /** Issue a replacement license with a new key and revoke this one. */
  reissue(id: string, options?: RequestOptions): Promise<M.License> {
    return this.action(id, 'reissue', undefined, options);
  }
  /** Resolved feature entitlements for a license (plan, add-ons, and overrides combined). */
  features(id: string, options?: RequestOptions): Promise<Record<string, M.ResolvedFeature>> {
    return this.http.request(
      { method: 'GET', path: `${this.item(id)}/features`, kind: 'data' },
      options,
    );
  }
  /** Add-ons purchased for a license. */
  listAddons(id: string, options?: RequestOptions): Promise<M.ListResponse<M.LicenseAddon>> {
    return this.http.request(
      { method: 'GET', path: `${this.item(id)}/addons`, kind: 'list' },
      options,
    );
  }
  /** Attach an add-on to a license. */
  purchaseAddon(
    id: string,
    input: M.LicenseAddonPurchaseParams,
    options?: RequestOptions,
  ): Promise<M.LicenseAddon> {
    return this.action(id, 'addons/purchase', input, options);
  }
  /** Usage summaries per meter for a license. */
  getUsage(id: string, options?: RequestOptions): Promise<M.ListResponse<M.UsageSummary>> {
    return this.http.request(
      { method: 'GET', path: `${this.item(id)}/usage`, kind: 'list' },
      options,
    );
  }
  /** Create or replace the license's override for one feature; returns the saved override. */
  upsertEntitlementOverride(
    id: string,
    input: M.EntitlementOverrideParams,
    options?: RequestOptions,
  ): Promise<M.EntitlementOverride> {
    return this.action(id, 'entitlement-overrides', input, options);
  }
}

/** Machine activations of licenses. */
export class ActivationService {
  constructor(private readonly http: Transport) {}
  /** Activate a license on a machine by license key and fingerprint (public route). Creates the machine record if needed. */
  activate(input: M.ActivateParams, options?: RequestOptions): Promise<M.ActivateResponse> {
    return this.http.request(
      { method: 'POST', path: '/activations', body: input, kind: 'data' },
      options,
    );
  }
  /** Deactivate by license key and fingerprint (public route), freeing an activation slot. */
  deactivateByKey(input: M.DeactivateByKeyParams, options?: RequestOptions): Promise<void> {
    return this.http.request(
      { method: 'POST', path: '/activations/deactivate', body: input, kind: 'none' },
      options,
    );
  }
  /** List activations, optionally by license or machine. */
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
  /** Get one activation. */
  get(id: string, options?: RequestOptions): Promise<M.Activation> {
    return this.http.request(
      { method: 'GET', path: `/activations/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  /** Deactivate an activation by ID. */
  deactivate(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request(
      { method: 'POST', path: `/activations/${pathSegment(id)}/deactivate`, kind: 'none' },
      options,
    );
  }
}

/** Machine records. Machines are shared across organizations by fingerprint; an org-scoped key sees only machines its licenses use and cannot update, delete, or decommission them. */
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
  /** Deactivate the machine's activations, revoke its offline certificates, and release the license activation slots. */
  decommission(id: string, options?: RequestOptions): Promise<void> {
    return this.action(id, 'decommission', undefined, options, 'none');
  }
}

/** Recurring subscriptions and their lifecycle. */
export class SubscriptionService extends CollectionService<
  M.Subscription,
  M.SubscriptionListParams,
  C.SubscriptionDetail
> {
  constructor(http: Transport) {
    super(http, '/subscriptions');
  }
  /** Start a subscription on an active subscription or trial plan; returns the subscription and any license IDs created. */
  create(
    input: M.SubscriptionCreateParams,
    options?: RequestOptions,
  ): Promise<M.SubscriptionMutationResult> {
    return this.http.request(
      { method: 'POST', path: '/subscriptions', body: input, kind: 'data' },
      options,
    );
  }
  /** Update gateway references, proration behavior, or metadata. */
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
  /** Extend the current period by `periods` billing intervals. */
  renew(
    id: string,
    input: M.SubscriptionRenewParams,
    options?: RequestOptions,
  ): Promise<M.SubscriptionMutationResult> {
    return this.action(id, 'renew', input, options);
  }
  /** Pause billing and access; returns the subscription. */
  pause(
    id: string,
    input: M.SubscriptionPauseParams,
    options?: RequestOptions,
  ): Promise<M.Subscription> {
    return this.action(id, 'pause', input, options);
  }
  /** Resume a paused subscription; returns the subscription. */
  resume(
    id: string,
    input: M.SubscriptionResumeParams,
    options?: RequestOptions,
  ): Promise<M.Subscription> {
    return this.action(id, 'resume', input, options);
  }
  /** Cancel now, or at the period end with `at_period_end: true`; returns the subscription. */
  cancel(
    id: string,
    input: M.SubscriptionCancelParams,
    options?: RequestOptions,
  ): Promise<M.Subscription> {
    return this.action(id, 'cancel', input, options);
  }
  /** Move to another plan of the same product; the result includes the proration the server computed. */
  changePlan(
    id: string,
    input: M.SubscriptionChangePlanParams,
    options?: RequestOptions,
  ): Promise<M.SubscriptionMutationResult> {
    return this.action(id, 'change-plan', input, options);
  }
  /** Change the seat quantity of a seat-based plan within its min/max. */
  updateSeats(
    id: string,
    input: M.SubscriptionSeatParams,
    options?: RequestOptions,
  ): Promise<M.SubscriptionMutationResult> {
    return this.action(id, 'seats', input, options);
  }
}

/** Manual usage adjustments and credits (metered usage itself goes through `usageReporter`). */
export class UsageService {
  constructor(private readonly http: Transport) {}
  /** Record a correction to a license's metered usage. */
  createAdjustment(
    input: M.UsageAdjustmentParams,
    options?: RequestOptions,
  ): Promise<M.UsageAdjustment> {
    return this.http.request(
      { method: 'POST', path: '/usage-adjustments', body: input, kind: 'data' },
      options,
    );
  }
  /** Grant usage credits to a license for a meter. */
  grantCredits(input: M.UsageCreditParams, options?: RequestOptions): Promise<M.UsageCredit> {
    return this.http.request(
      { method: 'POST', path: '/usage-credits', body: input, kind: 'data' },
      options,
    );
  }
}

/** Orders and their checkout and fulfillment. The server has no order update or pay route. */
export class OrderService {
  constructor(private readonly http: Transport) {}
  /** List orders, optionally by customer or product. */
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
  /** Create an order with its line items. */
  create(input: C.OrderCreateInput, options?: RequestOptions): Promise<C.OrderCreateResult> {
    return this.http.request(
      { method: 'POST', path: '/orders', body: input, kind: 'data' },
      options,
    );
  }
  /** Order detail with line items. */
  get(id: string, options?: RequestOptions): Promise<C.OrderDetail> {
    return this.http.request(
      { method: 'GET', path: `/orders/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  /** Create or reuse checkout instructions. Manual orders return offline collection instructions with no hosted URL. */
  checkout(id: string, options?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.request(
      { method: 'POST', path: `/orders/${pathSegment(id)}/checkout`, kind: 'data' },
      options,
    );
  }
  /** Mark the order fulfilled; issues the licenses it grants. Returns `{ status }`. */
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

/** Payments recorded against orders. */
export class PaymentService {
  constructor(private readonly http: Transport) {}
  /** List payments, optionally by order or customer. */
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
  /** Get one payment. */
  get(id: string, options?: RequestOptions): Promise<M.Payment> {
    return this.http.request(
      { method: 'GET', path: `/payments/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  /** Refund all or part of a captured payment. Manual refunds record the offline action; the operator must return funds separately. */
  refund(id: string, input: M.PaymentRefundParams, options?: RequestOptions): Promise<M.Payment> {
    return this.http.request(
      { method: 'POST', path: `/payments/${pathSegment(id)}/refund`, body: input, kind: 'data' },
      options,
    );
  }
  /** Record a payment state reported by the gateway. */
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

/** Invoices. The server has no invoice send route; use `issue`. */
export class InvoiceService {
  constructor(private readonly http: Transport) {}
  /** List invoices, optionally by customer or subscription. */
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
  /** Invoice detail with line items. */
  get(id: string, options?: RequestOptions): Promise<C.InvoiceDetail> {
    return this.http.request(
      { method: 'GET', path: `/invoices/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  /** Mark an invoice issued; order-created invoices are already issued. Returns `{ status }`. */
  issue(id: string, options?: RequestOptions): Promise<C.StatusResult> {
    return this.http.request(
      { method: 'POST', path: `/invoices/${pathSegment(id)}/issue` },
      options,
    );
  }
  /** Void an invoice; returns `{ status }`. */
  void(id: string, options?: RequestOptions): Promise<C.StatusResult> {
    return this.http.request(
      { method: 'POST', path: `/invoices/${pathSegment(id)}/void` },
      options,
    );
  }
  /** The invoice PDF as a raw `Response`. */
  pdf(id: string, options?: RequestOptions): Promise<Response> {
    return this.http.request(
      { method: 'GET', path: `/invoices/${pathSegment(id)}/pdf`, kind: 'raw' },
      options,
    );
  }
}

/** Outbound webhook endpoints. The server has no delete route; disable an endpoint with `update`. */
export class WebhookEndpointService extends CollectionService<
  M.WebhookEndpoint,
  M.WebhookEndpointListParams
> {
  constructor(http: Transport) {
    super(http, '/webhook-endpoints');
  }
  /** Create an endpoint; the result carries the signing `secret`, shown only once. */
  create(
    input: M.WebhookEndpointCreateParams,
    options?: RequestOptions,
  ): Promise<M.WebhookEndpointCreateResult> {
    return this.http.request(
      { method: 'POST', path: '/webhook-endpoints', body: input, kind: 'data' },
      options,
    );
  }
  /** Update an endpoint's URL, events, or status. */
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
  /** Queue a `webhook.test` delivery to the endpoint. */
  test(id: string, options?: RequestOptions): Promise<M.WebhookEvent> {
    return this.action(id, 'test', undefined, options);
  }
}

/** Webhook deliveries and their attempts. */
export class WebhookEventService {
  constructor(private readonly http: Transport) {}
  /** List deliveries, optionally by endpoint, event type, or status. */
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
  /** One delivery with its endpoint URL. */
  get(id: string, options?: RequestOptions): Promise<C.WebhookEventDetail> {
    return this.http.request(
      { method: 'GET', path: `/webhook-events/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  /** Re-queue a delivery. */
  retry(id: string, options?: RequestOptions): Promise<M.WebhookEvent> {
    return this.http.request(
      { method: 'POST', path: `/webhook-events/${pathSegment(id)}/retry`, kind: 'data' },
      options,
    );
  }
}

/** API keys of applications. Secrets are returned only by `create` and `rotate`. */
export class ApiKeyService {
  constructor(private readonly http: Transport) {}
  /** List keys, optionally by application, environment, or status. Secrets are never listed. */
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
  /** Create a key for an application; the result carries `secret_key`, shown only once. */
  create(input: M.APIKeyCreateParams, options?: RequestOptions): Promise<C.ApiKeySecretResult> {
    return this.http.request(
      { method: 'POST', path: '/api-keys', body: input, kind: 'data' },
      options,
    );
  }
  /** Get key metadata (never the secret). */
  get(id: string, options?: RequestOptions): Promise<M.APIKey> {
    return this.http.request(
      { method: 'GET', path: `/api-keys/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  /** Issue a new secret and revoke the previous one immediately. */
  rotate(id: string, options?: RequestOptions): Promise<C.ApiKeySecretResult> {
    return this.http.request(
      { method: 'POST', path: `/api-keys/${pathSegment(id)}/rotate`, kind: 'data' },
      options,
    );
  }
  /** Revoke a key; returns `{ status }`. */
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
  /** Delete a key. */
  delete(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request(
      { method: 'DELETE', path: `/api-keys/${pathSegment(id)}`, kind: 'none' },
      options,
    );
  }
}

/** Offline certificates for machines that cannot reach the server. See `OfflineVerifier` for local verification. */
export class OfflineCertificateService {
  constructor(private readonly http: Transport) {}
  /** Issue a certificate for a license on a machine; returns the certificate and an Ed25519 signature over its exact bytes. */
  issue(input: C.OfflineIssueInput, options?: RequestOptions): Promise<C.OfflineIssueResult> {
    return this.http.request(
      { method: 'POST', path: '/offline-certificates', body: input, kind: 'data' },
      options,
    );
  }
  /** Verify online (public route), including revocation. An invalid certificate is a result with `valid: false` (HTTP 422). */
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
  /** List certificates, optionally by license or machine. */
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
  /** Get one certificate. */
  get(id: string, options?: RequestOptions): Promise<M.OfflineCertificate> {
    return this.http.request(
      { method: 'GET', path: `/offline-certificates/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  /** Approve a certificate that requires approval; returns `{ status }`. */
  approve(id: string, options?: RequestOptions): Promise<C.StatusResult> {
    return this.http.request(
      { method: 'POST', path: `/offline-certificates/${pathSegment(id)}/approve` },
      options,
    );
  }
  /** Revoke a certificate; returns `{ status }`. Devices verifying locally learn this only when next online. */
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
  /** Revoke the certificate and issue a replacement. */
  reissue(id: string, options?: RequestOptions): Promise<C.OfflineIssueResult> {
    return this.http.request(
      { method: 'POST', path: `/offline-certificates/${pathSegment(id)}/reissue`, kind: 'data' },
      options,
    );
  }
}

/** The audit trail of changes made through the API and console. */
export class AuditLogService {
  constructor(private readonly http: Transport) {}
  /** List audit entries with filters. */
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
  /** Get one audit entry. */
  get(id: string, options?: RequestOptions): Promise<M.AuditLog> {
    return this.http.request(
      { method: 'GET', path: `/audit-logs/${pathSegment(id)}`, kind: 'data' },
      options,
    );
  }
  /** Stream the matching audit logs as CSV (the server answers JSON without `format=csv`). */
  exportCsv(params?: M.AuditLogListParams, options?: RequestOptions): Promise<Response> {
    return this.http.request(
      {
        method: 'GET',
        path: '/audit-logs/export',
        query: { ...(params as Record<string, string | number | undefined>), format: 'csv' },
        kind: 'raw',
        headers: { Accept: 'text/csv' },
      },
      options,
    );
  }
}

/** Server metadata endpoints. */
export class SystemService {
  constructor(private readonly http: Transport) {}
  /** The server's Ed25519 public key (standard-base64 raw bytes) for verifying offline certificates. Public. */
  signingKey(options?: RequestOptions): Promise<C.SigningKey> {
    return this.http.request({ method: 'GET', path: '/signing-key' }, options);
  }
  /** Liveness check at `/health` (outside `/api/v1`, unauthenticated). */
  health(options?: RequestOptions): Promise<Record<string, unknown>> {
    return this.http.request(
      { method: 'GET', path: '/health', unprefixed: true, unauthenticated: true },
      options,
    );
  }
}

/** Shareable referral codes issued to referrers. */
export class ReferralCodeService extends CollectionService<
  M.ReferralCode,
  M.ReferralCodeListParams
> {
  constructor(http: Transport) {
    super(http, '/referral-codes');
  }
  /** Issue a code; an 8-character code is generated when `code` is omitted. */
  create(input: M.ReferralCodeCreateParams, options?: RequestOptions): Promise<M.ReferralCode> {
    return this.http.request(
      { method: 'POST', path: '/referral-codes', body: input, kind: 'data' },
      options,
    );
  }
  /** Disable a code so it can no longer be used. */
  disable(id: string, options?: RequestOptions): Promise<void> {
    return this.action(id, 'disable', undefined, options, 'none');
  }
}
/** Referral conversions and their lifecycle: pending → qualified → rewarded, or rejected before being rewarded. Disallowed transitions reject with 409 `invalid_transition`. */
export class ReferralEventService extends CollectionService<
  M.ReferralEvent,
  M.ReferralEventListParams
> {
  constructor(http: Transport) {
    super(http, '/referral-events');
  }
  /** Record a referral; a customer can be referred only once per program. */
  create(input: M.ReferralEventCreateParams, options?: RequestOptions): Promise<M.ReferralEvent> {
    return this.http.request(
      { method: 'POST', path: '/referral-events', body: input, kind: 'data' },
      options,
    );
  }
  /** Qualify a pending referral, optionally attributing an order. */
  qualify(
    id: string,
    input: M.ReferralEventQualifyParams,
    options?: RequestOptions,
  ): Promise<M.ReferralEvent> {
    return this.action(id, 'qualify', input, options);
  }
  /** Reward a qualified referral and queue the reward issuance. */
  reward(
    id: string,
    input: M.ReferralEventRewardParams,
    options?: RequestOptions,
  ): Promise<M.ReferralEvent> {
    return this.action(id, 'reward', input, options);
  }
  /** Reject a pending or qualified referral. */
  reject(
    id: string,
    input: M.ReferralEventRejectParams,
    options?: RequestOptions,
  ): Promise<M.ReferralEvent> {
    return this.action(id, 'reject', input, options);
  }
}
/** Affiliates and their approval lifecycle. */
export class AffiliateService extends ResourceService<
  M.Affiliate,
  M.AffiliateCreateParams,
  M.AffiliateUpdateParams,
  M.AffiliateListParams
> {
  constructor(http: Transport) {
    super(http, '/affiliates');
  }
  /** Approve a pending affiliate. */
  approve(
    id: string,
    input: M.AffiliateApproveParams,
    options?: RequestOptions,
  ): Promise<M.Affiliate> {
    return this.action(id, 'approve', input, options);
  }
  /** Reject an affiliate application with a reason. */
  reject(
    id: string,
    input: M.AffiliateRejectParams,
    options?: RequestOptions,
  ): Promise<M.Affiliate> {
    return this.action(id, 'reject', input, options);
  }
  /** Suspend an affiliate. */
  suspend(id: string, options?: RequestOptions): Promise<M.Affiliate> {
    return this.action(id, 'suspend', undefined, options);
  }
  /** Terminate an affiliate. */
  terminate(id: string, options?: RequestOptions): Promise<M.Affiliate> {
    return this.action(id, 'terminate', undefined, options);
  }
}
/** Affiliate tracking links. */
export class AffiliateLinkService extends CollectionService<
  M.AffiliateLink,
  M.AffiliateLinkListParams
> {
  constructor(http: Transport) {
    super(http, '/affiliate-links');
  }
  /** Create a tracking link; a slug is generated when omitted. */
  create(input: M.AffiliateLinkCreateParams, options?: RequestOptions): Promise<M.AffiliateLink> {
    return this.http.request(
      { method: 'POST', path: '/affiliate-links', body: input, kind: 'data' },
      options,
    );
  }
  /** Update a link's destination, product, or campaign fields. */
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
  /** Disable a tracking link. */
  disable(id: string, options?: RequestOptions): Promise<void> {
    return this.action(id, 'disable', undefined, options, 'none');
  }
}
/** Affiliate clicks, signups, purchases, and refunds. */
export class AffiliateEventService extends CollectionService<
  M.AffiliateEvent,
  M.AffiliateEventListParams
> {
  constructor(http: Transport) {
    super(http, '/affiliate-events');
  }
  /** Record an affiliate event. */
  create(input: M.AffiliateEventCreateParams, options?: RequestOptions): Promise<M.AffiliateEvent> {
    return this.http.request(
      { method: 'POST', path: '/affiliate-events', body: input, kind: 'data' },
      options,
    );
  }
  /** Mark an event (typically a fraud-flagged one) as reviewed. */
  review(
    id: string,
    input: M.AffiliateEventReviewParams,
    options?: RequestOptions,
  ): Promise<M.AffiliateEvent> {
    return this.action(id, 'review', input, options);
  }
}
/** Commission payouts: pending → approved → processing → paid, with on_hold, failed, and reversed branches. Disallowed transitions reject with 409 `invalid_transition`. */
export class CommissionPayoutService extends CollectionService<
  M.CommissionPayout,
  M.CommissionPayoutListParams
> {
  constructor(http: Transport) {
    super(http, '/commission-payouts');
  }
  /** Create a pending payout for a payee and period. */
  create(
    input: M.CommissionPayoutCreateParams,
    options?: RequestOptions,
  ): Promise<M.CommissionPayout> {
    return this.http.request(
      { method: 'POST', path: '/commission-payouts', body: input, kind: 'data' },
      options,
    );
  }
  /** Approve a pending or on-hold payout. */
  approve(
    id: string,
    input: M.CommissionPayoutApproveParams,
    options?: RequestOptions,
  ): Promise<M.CommissionPayout> {
    return this.action(id, 'approve', input, options);
  }
  /** Mark an approved or processing payout as paid. */
  pay(
    id: string,
    input: M.CommissionPayoutPayParams,
    options?: RequestOptions,
  ): Promise<M.CommissionPayout> {
    return this.action(id, 'pay', input, options);
  }
  /** Mark an approved or processing payout as failed. */
  fail(
    id: string,
    input: M.CommissionPayoutFailParams,
    options?: RequestOptions,
  ): Promise<M.CommissionPayout> {
    return this.action(id, 'fail', input, options);
  }
  /** Reverse a paid payout. */
  reverse(
    id: string,
    input: M.CommissionPayoutReverseParams,
    options?: RequestOptions,
  ): Promise<M.CommissionPayout> {
    return this.action(id, 'reverse', input, options);
  }
}

/**
 * Payment gateway configurations. Credentials are provider secrets: call these
 * from a backend only. Responses never include stored credentials.
 */
export class GatewayConfigService extends ResourceService<
  M.GatewayConfig,
  M.GatewayConfigCreateParams,
  M.GatewayConfigUpdateParams,
  M.GatewayConfigListParams
> {
  constructor(http: Transport) {
    super(http, '/gateway-configs');
  }
  /** Make this the organization's default gateway. */
  setDefault(id: string, options?: RequestOptions): Promise<M.GatewayConfig> {
    return this.action(id, 'set-default', undefined, options);
  }
  /** The 50 most recent inbound provider webhooks for the caller's organization (not paginated). */
  async listWebhookLogs(
    params?: M.GatewayWebhookLogListParams,
    options?: RequestOptions,
  ): Promise<ReadonlyArray<M.GatewayWebhookLog>> {
    const logs: ReadonlyArray<M.GatewayWebhookLog> | null = await this.http.request(
      {
        method: 'GET',
        path: '/gateway-webhook-logs',
        query: params as Record<string, string | undefined>,
        kind: 'data',
      },
      options,
    );
    return logs ?? []; // servers before 2026-10-26 encode an empty list as null
  }
  /** Check the stored credentials against the provider and record the health result. */
  test(id: string, options?: RequestOptions): Promise<C.GatewayConfigTestResult> {
    return this.http.request({ method: 'POST', path: `${this.item(id)}/test` }, options);
  }
}

/** Supported payment providers and the credentials each one needs. */
export class GatewayProviderService {
  constructor(private readonly http: Transport) {}
  /** Supported providers with their capabilities. */
  list(options?: RequestOptions): Promise<ReadonlyArray<C.GatewayProvider>> {
    return this.http.request({ method: 'GET', path: '/gateway-providers', kind: 'data' }, options);
  }
  /** The credential fields a provider requires. */
  schema(provider: string, options?: RequestOptions): Promise<C.GatewayProviderSchema> {
    return this.http.request(
      {
        method: 'GET',
        path: `/gateway-providers/${pathSegment(provider)}/schema`,
        kind: 'data',
      },
      options,
    );
  }
}

/** Binary releases, their artifacts, and license-gated downloads. */
export class ReleaseService extends CollectionService<
  M.Release,
  M.ReleaseListParams,
  M.ReleaseDetail
> {
  constructor(http: Transport) {
    super(http, '/releases');
  }
  /** Create a draft release. */
  create(input: M.ReleaseCreateParams, options?: RequestOptions): Promise<M.Release> {
    return this.http.request(
      { method: 'POST', path: '/releases', body: input, kind: 'data' },
      options,
    );
  }
  /** Update release fields. */
  update(id: string, input: M.ReleaseUpdateParams, options?: RequestOptions): Promise<M.Release> {
    return this.http.request(
      { method: 'PATCH', path: this.item(id), body: input, kind: 'data' },
      options,
    );
  }
  /** Delete a release. */
  delete(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request({ method: 'DELETE', path: this.item(id), kind: 'none' }, options);
  }
  /** Publish a release so licensed customers can download it. */
  publish(id: string, options?: RequestOptions): Promise<M.Release> {
    return this.action(id, 'publish', undefined, options);
  }
  /** Withdraw a published release. */
  yank(id: string, input: { reason?: string } = {}, options?: RequestOptions): Promise<M.Release> {
    return this.action(id, 'yank', input, options);
  }
  /** Artifacts uploaded for a release. */
  listArtifacts(id: string, options?: RequestOptions): Promise<M.ListResponse<M.ReleaseArtifact>> {
    return this.http.request(
      { method: 'GET', path: `${this.item(id)}/artifacts`, kind: 'list' },
      options,
    );
  }
  /** Upload an artifact as multipart form data. Not retried. */
  uploadArtifact(
    id: string,
    input: M.ReleaseArtifactUploadParams,
    options?: RequestOptions,
  ): Promise<M.ReleaseArtifact> {
    const form = new FormData();
    if (input.os !== undefined) form.set('os', input.os);
    if (input.arch !== undefined) form.set('arch', input.arch);
    form.set('file', input.file, input.filename);
    return this.http.request(
      { method: 'POST', path: `${this.item(id)}/artifacts`, formData: form, kind: 'data' },
      options,
    );
  }
  /** Published checksums for an artifact; callable without credentials. */
  checksum(artifactId: string, options?: RequestOptions): Promise<M.ReleaseArtifactChecksum> {
    return this.http.request(
      { method: 'GET', path: `/artifacts/${pathSegment(artifactId)}/checksum`, kind: 'data' },
      options,
    );
  }
  /** Exchange a license key for a short-lived download URL. */
  authorizeDownload(
    input: M.DownloadAuthorizeParams,
    options?: RequestOptions,
  ): Promise<M.AuthorizedDownload> {
    return this.http.request(
      { method: 'POST', path: '/downloads/authorize', body: input, kind: 'data' },
      options,
    );
  }
  /**
   * Stream an authorized download by its token (the last path segment of
   * `AuthorizedDownload.url`). The request timeout covers the response
   * headers; abort with `options.signal` or `body.cancel()` while streaming.
   */
  async download(token: string, options?: RequestOptions): Promise<C.ReleaseDownload> {
    const response: Response = await this.http.request(
      {
        method: 'GET',
        path: `/downloads/${pathSegment(token)}`,
        kind: 'raw',
        unauthenticated: true,
        headers: { Accept: '*/*' },
      },
      options,
    );
    const disposition = response.headers.get('content-disposition') ?? '';
    const filename = /filename="([^"]*)"/.exec(disposition)?.[1];
    const contentType = response.headers.get('content-type') ?? undefined;
    const checksumSha256 = response.headers.get('x-checksum-sha256') ?? undefined;
    return {
      response,
      body: response.body,
      ...(contentType !== undefined && { contentType }),
      ...(filename !== undefined && { filename }),
      ...(checksumSha256 !== undefined && { checksumSha256 }),
    };
  }
}

/** Email/SMS templates rendered by the notification service. */
export class NotificationTemplateService extends CollectionService<
  M.NotificationTemplate,
  M.NotificationTemplateListParams,
  C.NotificationTemplateDetail
> {
  constructor(http: Transport) {
    super(http, '/notification-templates');
  }
  /** Create a template; bodies use Go `text/template` syntax (`{{.name}}`). */
  create(
    input: M.NotificationTemplateCreateParams,
    options?: RequestOptions,
  ): Promise<M.NotificationTemplate> {
    return this.http.request(
      { method: 'POST', path: '/notification-templates', body: input, kind: 'data' },
      options,
    );
  }
  /** Update a template, or archive it with `status: "archived"`. */
  update(
    id: string,
    input: M.NotificationTemplateUpdateParams,
    options?: RequestOptions,
  ): Promise<M.NotificationTemplate> {
    return this.http.request(
      { method: 'PATCH', path: this.item(id), body: input, kind: 'data' },
      options,
    );
  }
}

/** Outbound email/SMS notifications and their delivery state. */
export class NotificationService extends CollectionService<
  M.Notification,
  M.NotificationListParams,
  C.NotificationDetail
> {
  constructor(http: Transport) {
    super(http, '/notifications');
  }
  /** Queue a notification for asynchronous delivery. Not retried. */
  queue(input: M.NotificationQueueParams, options?: RequestOptions): Promise<M.Notification> {
    return this.http.request(
      { method: 'POST', path: '/notifications', body: input, kind: 'data' },
      options,
    );
  }
  /** Re-queue a `failed` or `bounced` notification; any other status rejects with 409 `invalid_transition`. */
  retry(id: string, options?: RequestOptions): Promise<M.Notification> {
    return this.action(id, 'retry', undefined, options);
  }
}

/** In-app announcements and the feed installed software polls. */
export class ApplicationNotificationService extends CollectionService<
  M.ApplicationNotification,
  M.ApplicationNotificationListParams
> {
  constructor(http: Transport) {
    super(http, '/application-notifications');
  }
  /** Create an announcement; it reaches the feed once `status` is `active` (or `scheduled` and started). */
  create(
    input: M.ApplicationNotificationCreateParams,
    options?: RequestOptions,
  ): Promise<M.ApplicationNotification> {
    return this.http.request(
      { method: 'POST', path: '/application-notifications', body: input, kind: 'data' },
      options,
    );
  }
  /** Update or archive an announcement. */
  update(
    id: string,
    input: M.ApplicationNotificationUpdateParams,
    options?: RequestOptions,
  ): Promise<M.ApplicationNotification> {
    return this.http.request(
      { method: 'PATCH', path: this.item(id), body: input, kind: 'data' },
      options,
    );
  }
  /** Active notifications for one installation, with its read state. */
  feed(
    input: M.ApplicationNotificationFeedParams,
    options?: RequestOptions,
  ): Promise<ReadonlyArray<M.ApplicationNotificationFeedItem>> {
    return this.http.request(
      { method: 'POST', path: '/application-notifications/feed', body: input, kind: 'data' },
      options,
    );
  }
  /** Record that an installation saw or dismissed a notification (public route; same identity rules as `feed`). */
  acknowledge(
    id: string,
    input: M.ApplicationNotificationAckParams,
    options?: RequestOptions,
  ): Promise<M.ApplicationNotificationReadState> {
    return this.action(id, 'ack', input, options);
  }
}

/**
 * Customers' saved payment methods (gateway tokens and display details only;
 * the SDK never handles raw card data). Backend use only.
 */
export class PaymentMethodService extends CollectionService<
  M.PaymentMethod,
  M.PaymentMethodListParams
> {
  constructor(http: Transport) {
    super(http, '/payment-methods');
  }
  /** Save a tokenized payment method for a customer. */
  create(input: M.PaymentMethodCreateParams, options?: RequestOptions): Promise<M.PaymentMethod> {
    return this.http.request(
      { method: 'POST', path: '/payment-methods', body: input, kind: 'data' },
      options,
    );
  }
  /** Make this the customer's default payment method; returns `{ status }`. */
  setDefault(id: string, options?: RequestOptions): Promise<C.StatusResult> {
    return this.http.request({ method: 'POST', path: `${this.item(id)}/set-default` }, options);
  }
  /** Delete a saved payment method. */
  delete(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request({ method: 'DELETE', path: this.item(id), kind: 'none' }, options);
  }
  /**
   * Gateways the customer can pay with — limited to the product's allowed
   * gateways when `productId` is given — with their saved method for each.
   */
  async checkoutOptions(
    customerId: string,
    productId?: string,
    options?: RequestOptions,
  ): Promise<ReadonlyArray<M.CheckoutOption>> {
    const found: ReadonlyArray<M.CheckoutOption> | null = await this.http.request(
      {
        method: 'GET',
        path: '/checkout-options',
        query: { customer_id: customerId, product_id: productId },
        kind: 'data',
      },
      options,
    );
    return found ?? []; // servers before 2026-10-26 encode no options as null
  }
}
