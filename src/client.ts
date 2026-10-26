import type * as M from './models/generated.js';
import { Transport, type ClientOptions } from './transport.js';
import { ResourceService } from './services/base.js';
import { UsageReporter } from './usage-reporter.js';
import {
  ActivationService,
  AffiliateEventService,
  AffiliateLinkService,
  AffiliateService,
  ApiKeyService,
  AuditLogService,
  CommissionPayoutService,
  ContactService,
  InvoiceService,
  LicenseService,
  MachineService,
  OfflineCertificateService,
  OrderService,
  PaymentService,
  PlanService,
  ReferralCodeService,
  ReferralEventService,
  SubscriptionService,
  SystemService,
  GatewayConfigService,
  GatewayProviderService,
  ReleaseService,
  NotificationTemplateService,
  NotificationService,
  ApplicationNotificationService,
  PaymentMethodService,
  UsageService,
  WebhookEndpointService,
  WebhookEventService,
} from './services/index.js';

/**
 * Main entry point for the Niyantra Commerce API.
 *
 * @example
 * ```ts
 * const client = new Client({
 *   baseUrl: 'https://commerce.example.com',
 *   auth: { apiKey },
 * });
 * const page = await client.licenses.list({ limit: 10 });
 * ```
 */
export class Client {
  private readonly http: Transport;
  constructor(options: ClientOptions) {
    this.http = new Transport(options);
  }

  /** Organizations (tenants). Org-scoped keys see only their own; creating and deleting organizations is operator-only. */
  get organizations() {
    return new ResourceService<
      M.Organization,
      M.OrganizationCreateParams,
      M.OrganizationUpdateParams,
      M.OrganizationListParams
    >(this.http, '/organizations');
  }
  /** Products sold by an organization. */
  get products() {
    return new ResourceService<
      M.Product,
      M.ProductCreateParams,
      M.ProductUpdateParams,
      M.ProductListParams
    >(this.http, '/products');
  }
  /** Pricing plans of products. */
  get plans() {
    return new PlanService(this.http);
  }
  /** Customers of an organization. */
  get customers() {
    return new ResourceService<
      M.Customer,
      M.CustomerCreateParams,
      M.CustomerUpdateParams,
      M.CustomerListParams
    >(this.http, '/customers');
  }
  /** Contacts of customers. */
  get contacts() {
    return new ContactService(this.http);
  }
  /** Licenses and their lifecycle. */
  get licenses() {
    return new LicenseService(this.http);
  }
  /** Machine activations. */
  get activations() {
    return new ActivationService(this.http);
  }
  /** Machine records. */
  get machines() {
    return new MachineService(this.http);
  }
  /** Subscriptions and their lifecycle. */
  get subscriptions() {
    return new SubscriptionService(this.http);
  }
  /** Feature entitlements of plans, licenses, and add-ons. */
  get entitlements() {
    return new ResourceService<
      M.Entitlement,
      M.EntitlementCreateParams,
      M.EntitlementUpdateParams,
      M.EntitlementListParams
    >(this.http, '/entitlements');
  }
  /** Add-ons sold on top of plans. */
  get addons() {
    return new ResourceService<
      M.Addon,
      M.AddonCreateParams,
      M.AddonUpdateParams,
      M.AddonListParams
    >(this.http, '/addons');
  }
  /** Usage meters of products. */
  get usageMeters() {
    return new ResourceService<
      M.UsageMeter,
      M.UsageMeterCreateParams,
      M.UsageMeterUpdateParams,
      M.UsageMeterListParams
    >(this.http, '/usage-meters');
  }
  /** Usage adjustments and credits. */
  get usage() {
    return new UsageService(this.http);
  }
  /** HMAC-signed usage ingestion (requires an API key with the `usage:report` scope). */
  get usageReporter() {
    return new UsageReporter(this.http);
  }
  /** Orders, checkout, and fulfillment. */
  get orders() {
    return new OrderService(this.http);
  }
  /** Payments. */
  get payments() {
    return new PaymentService(this.http);
  }
  /** Invoices. */
  get invoices() {
    return new InvoiceService(this.http);
  }
  /** Outbound webhook endpoints. */
  get webhookEndpoints() {
    return new WebhookEndpointService(this.http);
  }
  /** Webhook deliveries. */
  get webhookEvents() {
    return new WebhookEventService(this.http);
  }
  /** Applications that own API keys. */
  get applications() {
    return new ResourceService<
      M.Application,
      M.ApplicationCreateParams,
      M.ApplicationUpdateParams,
      M.ApplicationListParams
    >(this.http, '/applications');
  }
  /** API keys. */
  get apiKeys() {
    return new ApiKeyService(this.http);
  }
  /** Offline certificates. */
  get offlineCertificates() {
    return new OfflineCertificateService(this.http);
  }
  /** Referral programs. */
  get referralPrograms() {
    return new ResourceService<
      M.ReferralProgram,
      M.ReferralProgramCreateParams,
      M.ReferralProgramUpdateParams,
      M.ReferralProgramListParams
    >(this.http, '/referral-programs');
  }
  /** Referral codes. */
  get referralCodes() {
    return new ReferralCodeService(this.http);
  }
  /** Referral conversions. */
  get referralEvents() {
    return new ReferralEventService(this.http);
  }
  /** Affiliate commission plans. */
  get commissionPlans() {
    return new ResourceService<
      M.CommissionPlan,
      M.CommissionPlanCreateParams,
      M.CommissionPlanUpdateParams,
      M.CommissionPlanListParams
    >(this.http, '/commission-plans');
  }
  /** Affiliates. */
  get affiliates() {
    return new AffiliateService(this.http);
  }
  /** Affiliate tracking links. */
  get affiliateLinks() {
    return new AffiliateLinkService(this.http);
  }
  /** Affiliate events. */
  get affiliateEvents() {
    return new AffiliateEventService(this.http);
  }
  /** Commission payouts. */
  get commissionPayouts() {
    return new CommissionPayoutService(this.http);
  }
  /** Audit trail. */
  get auditLogs() {
    return new AuditLogService(this.http);
  }
  /** Health and signing key. */
  get system() {
    return new SystemService(this.http);
  }
  /** Payment gateway configurations (backend only). */
  get gatewayConfigs() {
    return new GatewayConfigService(this.http);
  }
  /** Supported payment providers. */
  get gatewayProviders() {
    return new GatewayProviderService(this.http);
  }
  /** Binary releases and downloads. */
  get releases() {
    return new ReleaseService(this.http);
  }
  /** Email/SMS templates. */
  get notificationTemplates() {
    return new NotificationTemplateService(this.http);
  }
  /** Outbound notifications. */
  get notifications() {
    return new NotificationService(this.http);
  }
  /** In-app announcements and their feed. */
  get applicationNotifications() {
    return new ApplicationNotificationService(this.http);
  }
  /** Customers' saved payment methods and checkout options (backend only). */
  get paymentMethods() {
    return new PaymentMethodService(this.http);
  }
  /** For signed usage reports; requires an API key with the usage:report scope. */
  get usageApiKey(): string | undefined {
    return this.http.apiKey;
  }
}
