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
  UsageService,
  WebhookEndpointService,
  WebhookEventService,
} from './services/index.js';

/** Main entry point for the Niyantra Commerce API. */
export class Client {
  private readonly http: Transport;
  constructor(options: ClientOptions) {
    this.http = new Transport(options);
  }

  get organizations() {
    return new ResourceService<
      M.Organization,
      M.OrganizationCreateParams,
      M.OrganizationUpdateParams,
      M.OrganizationListParams
    >(this.http, '/organizations');
  }
  get products() {
    return new ResourceService<
      M.Product,
      M.ProductCreateParams,
      M.ProductUpdateParams,
      M.ProductListParams
    >(this.http, '/products');
  }
  get plans() {
    return new PlanService(this.http);
  }
  get customers() {
    return new ResourceService<
      M.Customer,
      M.CustomerCreateParams,
      M.CustomerUpdateParams,
      M.CustomerListParams
    >(this.http, '/customers');
  }
  get contacts() {
    return new ContactService(this.http);
  }
  get licenses() {
    return new LicenseService(this.http);
  }
  get activations() {
    return new ActivationService(this.http);
  }
  get machines() {
    return new MachineService(this.http);
  }
  get subscriptions() {
    return new SubscriptionService(this.http);
  }
  get entitlements() {
    return new ResourceService<
      M.Entitlement,
      M.EntitlementCreateParams,
      M.EntitlementUpdateParams,
      M.EntitlementListParams
    >(this.http, '/entitlements');
  }
  get addons() {
    return new ResourceService<
      M.Addon,
      M.AddonCreateParams,
      M.AddonUpdateParams,
      M.AddonListParams
    >(this.http, '/addons');
  }
  get usageMeters() {
    return new ResourceService<
      M.UsageMeter,
      M.UsageMeterCreateParams,
      M.UsageMeterUpdateParams,
      M.UsageMeterListParams
    >(this.http, '/usage-meters');
  }
  get usage() {
    return new UsageService(this.http);
  }
  get usageReporter() {
    return new UsageReporter(this.http);
  }
  get orders() {
    return new OrderService(this.http);
  }
  get payments() {
    return new PaymentService(this.http);
  }
  get invoices() {
    return new InvoiceService(this.http);
  }
  get webhookEndpoints() {
    return new WebhookEndpointService(this.http);
  }
  get webhookEvents() {
    return new WebhookEventService(this.http);
  }
  get applications() {
    return new ResourceService<
      M.Application,
      M.ApplicationCreateParams,
      M.ApplicationUpdateParams,
      M.ApplicationListParams
    >(this.http, '/applications');
  }
  get apiKeys() {
    return new ApiKeyService(this.http);
  }
  get offlineCertificates() {
    return new OfflineCertificateService(this.http);
  }
  get referralPrograms() {
    return new ResourceService<
      M.ReferralProgram,
      M.ReferralProgramCreateParams,
      M.ReferralProgramUpdateParams,
      M.ReferralProgramListParams
    >(this.http, '/referral-programs');
  }
  get referralCodes() {
    return new ReferralCodeService(this.http);
  }
  get referralEvents() {
    return new ReferralEventService(this.http);
  }
  get commissionPlans() {
    return new ResourceService<
      M.CommissionPlan,
      M.CommissionPlanCreateParams,
      M.CommissionPlanUpdateParams,
      M.CommissionPlanListParams
    >(this.http, '/commission-plans');
  }
  get affiliates() {
    return new AffiliateService(this.http);
  }
  get affiliateLinks() {
    return new AffiliateLinkService(this.http);
  }
  get affiliateEvents() {
    return new AffiliateEventService(this.http);
  }
  get commissionPayouts() {
    return new CommissionPayoutService(this.http);
  }
  get auditLogs() {
    return new AuditLogService(this.http);
  }
  get system() {
    return new SystemService(this.http);
  }
  /** For signed usage reports; requires an API key with the usage:report scope. */
  get usageApiKey(): string | undefined {
    return this.http.apiKey;
  }
}
