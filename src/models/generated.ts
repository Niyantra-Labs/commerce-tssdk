// Generated once from commerce-gosdk model declarations (fe24005).
// Review against Commerce server JSON before claiming contract parity.
export type Metadata = Record<string, unknown>;
export type Address = Record<string, unknown>;
/** Pagination accepted by every list endpoint. */
export interface PageParams {
  limit?: number;
  offset?: number;
}

/** Pagination plus the `search`/`status` filters most list handlers accept. */
export interface ListParams extends PageParams {
  search?: string;
  status?: string;
}
export interface ListResponse<T> {
  readonly data: ReadonlyArray<T>;
  readonly total: number;
}
export interface Activation {
  readonly id: string;
  readonly license_id: string;
  readonly machine_id: string;
  readonly status: string;
  readonly ip_address?: string | null;
  readonly user_agent?: string | null;
  readonly environment?: string | null;
  readonly activated_at: string;
  readonly deactivated_at?: string | null;
  readonly deactivation_reason?: string | null;
  readonly last_check_in_at?: string | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ActivateParams {
  license_key: string;
  fingerprint: string;
  hostname?: string | null;
  os?: string | null;
  os_version?: string | null;
  arch?: string | null;
  cores?: number | null;
  memory_mb?: number | null;
  environment?: string | null;
}

export interface ActivateResponse {
  readonly activation?: Activation | null;
  readonly machine?: Machine | null;
  readonly license?: License | null;
  readonly error?: string;
}

export interface DeactivateByKeyParams {
  license_key: string;
  fingerprint: string;
  reason?: string;
}

/** Filters the activations list handler reads. */
export interface ActivationListParams extends PageParams {
  license_id?: string;
  machine_id?: string;
  status?: string;
}

export interface Addon {
  readonly id: string;
  readonly product_id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
  readonly price_cents: number;
  readonly currency: string;
  readonly addon_type: string;
  readonly billing_mode: string;
  readonly entitlements: Metadata | null;
  readonly compatible_plan_ids: ReadonlyArray<string> | null;
  readonly sort_order: number;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AddonCreateParams {
  product_id: string;
  name: string;
  slug: string;
  description?: string | null;
  price_cents?: number;
  currency?: string;
  addon_type?: string;
  billing_mode?: string;
  entitlements?: Metadata;
  compatible_plan_ids?: ReadonlyArray<string>;
  sort_order?: number;
}

export interface AddonUpdateParams {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  price_cents?: number | null;
  currency?: string | null;
  addon_type?: string | null;
  billing_mode?: string | null;
  entitlements?: Metadata;
  compatible_plan_ids?: ReadonlyArray<string>;
  sort_order?: number | null;
  status?: string | null;
}

export interface AddonListParams extends ListParams {
  product_id?: string;
}

export interface LicenseAddon {
  readonly id: string;
  readonly license_id: string;
  readonly addon_id: string;
  readonly quantity: number;
  readonly status: string;
  readonly purchased_at: string;
  readonly expires_at?: string | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly addon?: Addon | null;
}

export interface LicenseAddonPurchaseParams {
  addon_id: string;
  quantity?: number;
  expires_at?: string | null;
}

export interface CommissionPlan {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly commission_type: string;
  readonly commission_value: number;
  readonly commission_currency?: string | null;
  readonly tiers?: Metadata;
  readonly recurring: boolean;
  readonly recurring_months?: number | null;
  readonly recurring_cap_cents?: number | null;
  readonly applicable_products?: ReadonlyArray<string>;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CommissionPlanCreateParams {
  org_id: string;
  name: string;
  description?: string | null;
  commission_type: string;
  commission_value?: number;
  commission_currency?: string | null;
  tiers?: Metadata;
  recurring?: boolean;
  recurring_months?: number | null;
  recurring_cap_cents?: number | null;
  applicable_products?: ReadonlyArray<string>;
  status?: string;
}

export interface CommissionPlanUpdateParams {
  name?: string | null;
  description?: string | null;
  commission_type?: string | null;
  commission_value?: number | null;
  commission_currency?: string | null;
  tiers?: Metadata;
  recurring?: boolean | null;
  recurring_months?: number | null;
  recurring_cap_cents?: number | null;
  applicable_products?: ReadonlyArray<string>;
  status?: string | null;
}

export type CommissionPlanListParams = ListParams;

export interface Affiliate {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly email: string;
  readonly phone?: string | null;
  readonly company_name?: string | null;
  readonly website?: string | null;
  readonly account_id?: string | null;
  readonly commission_plan_id?: string | null;
  readonly status: string;
  readonly approved_at?: string | null;
  readonly approved_by?: string | null;
  readonly rejected_at?: string | null;
  readonly rejection_reason?: string | null;
  readonly payout_threshold_cents?: number | null;
  readonly payout_currency?: string | null;
  readonly payout_method?: string | null;
  readonly payout_details?: Metadata;
  readonly promotional_assets?: Metadata;
  readonly total_clicks: number;
  readonly total_signups: number;
  readonly total_purchases: number;
  readonly total_earned_cents: number;
  readonly total_paid_cents: number;
  readonly restricted_products?: ReadonlyArray<string>;
  readonly restricted_geos?: ReadonlyArray<string>;
  readonly notes?: string | null;
  readonly metadata?: Metadata;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at?: string | null;
}

export interface AffiliateCreateParams {
  org_id: string;
  name: string;
  email: string;
  phone?: string | null;
  company_name?: string | null;
  website?: string | null;
  account_id?: string | null;
  commission_plan_id?: string | null;
  payout_threshold_cents?: number | null;
  payout_currency?: string | null;
  payout_method?: string | null;
  payout_details?: Metadata;
  promotional_assets?: Metadata;
  restricted_products?: ReadonlyArray<string>;
  restricted_geos?: ReadonlyArray<string>;
  notes?: string | null;
  metadata?: Metadata;
}

export interface AffiliateUpdateParams {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  website?: string | null;
  account_id?: string | null;
  commission_plan_id?: string | null;
  payout_threshold_cents?: number | null;
  payout_currency?: string | null;
  payout_method?: string | null;
  payout_details?: Metadata;
  promotional_assets?: Metadata;
  restricted_products?: ReadonlyArray<string>;
  restricted_geos?: ReadonlyArray<string>;
  notes?: string | null;
  metadata?: Metadata;
}

/**
 * `approved_by` is stored only when it is the ID of a built-in-auth account;
 * identities from an external IdP leave it empty.
 */
export interface AffiliateApproveParams {
  approved_by?: string;
}

export interface AffiliateRejectParams {
  reason: string;
}

export interface AffiliateListParams extends ListParams {
  commission_plan_id?: string;
}

export interface AffiliateLink {
  readonly id: string;
  readonly affiliate_id: string;
  readonly product_id?: string | null;
  readonly slug: string;
  readonly destination_url?: string | null;
  readonly campaign?: string | null;
  readonly source?: string | null;
  readonly medium?: string | null;
  readonly click_count: number;
  readonly unique_clicks: number;
  readonly signup_count: number;
  readonly purchase_count: number;
  readonly status: string;
  readonly metadata?: Metadata;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AffiliateLinkCreateParams {
  affiliate_id: string;
  product_id?: string | null;
  slug?: string;
  destination_url?: string | null;
  campaign?: string | null;
  source?: string | null;
  medium?: string | null;
  metadata?: Metadata;
}

export interface AffiliateLinkUpdateParams {
  product_id?: string | null;
  destination_url?: string | null;
  campaign?: string | null;
  source?: string | null;
  medium?: string | null;
  metadata?: Metadata;
}

export interface AffiliateLinkListParams extends ListParams {
  affiliate_id?: string;
  product_id?: string;
}

export interface AffiliateEvent {
  readonly id: string;
  readonly affiliate_id: string;
  readonly link_id?: string | null;
  readonly customer_id?: string | null;
  readonly order_id?: string | null;
  readonly event_type: string;
  readonly ip_address?: string | null;
  readonly user_agent?: string | null;
  readonly referrer_url?: string | null;
  readonly country_code?: string | null;
  readonly session_id?: string | null;
  readonly order_amount_cents?: number | null;
  readonly commission_cents?: number | null;
  readonly is_suspicious: boolean;
  readonly fraud_flags?: ReadonlyArray<string>;
  readonly reviewed: boolean;
  readonly reviewed_by?: string | null;
  readonly metadata?: Metadata;
  readonly created_at: string;
}

export interface AffiliateEventCreateParams {
  affiliate_id: string;
  link_id?: string | null;
  customer_id?: string | null;
  order_id?: string | null;
  event_type: string;
  ip_address?: string | null;
  user_agent?: string | null;
  referrer_url?: string | null;
  country_code?: string | null;
  session_id?: string | null;
  order_amount_cents?: number | null;
  commission_cents?: number | null;
  is_suspicious?: boolean;
  fraud_flags?: ReadonlyArray<string>;
  metadata?: Metadata;
}

/** The affiliate-events handler accepts no `search` or `status` filter. */
export interface AffiliateEventListParams extends PageParams {
  affiliate_id?: string;
  link_id?: string;
  event_type?: string;
  reviewed?: boolean;
}

export interface AffiliateEventReviewParams {
  reviewed_by: string;
}

export interface CommissionPayout {
  readonly id: string;
  readonly org_id: string;
  readonly payee_type: string;
  readonly payee_id: string;
  readonly period_start: string;
  readonly period_end: string;
  readonly amount_cents: number;
  readonly currency: string;
  readonly line_items?: Metadata;
  readonly total_orders: number;
  readonly total_revenue_cents: number;
  readonly status: string;
  readonly approved_at?: string | null;
  readonly approved_by?: string | null;
  readonly paid_at?: string | null;
  readonly payment_method?: string | null;
  readonly payment_reference?: string | null;
  readonly payment_details?: Metadata;
  readonly failed_at?: string | null;
  readonly failure_reason?: string | null;
  readonly reversed_at?: string | null;
  readonly reversal_reason?: string | null;
  readonly notes?: string | null;
  readonly metadata?: Metadata;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CommissionPayoutCreateParams {
  org_id: string;
  payee_type: string;
  payee_id: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  currency?: string;
  line_items?: Metadata;
  total_orders?: number;
  total_revenue_cents?: number;
  notes?: string | null;
  metadata?: Metadata;
}

/** The commission-payouts handler accepts no `search` filter. */
export interface CommissionPayoutListParams extends PageParams {
  status?: string;
  payee_type?: string;
  payee_id?: string;
}

/**
 * `approved_by` is stored only when it is the ID of a built-in-auth account;
 * identities from an external IdP leave it empty.
 */
export interface CommissionPayoutApproveParams {
  approved_by?: string;
}

export interface CommissionPayoutPayParams {
  payment_method?: string | null;
  payment_reference?: string | null;
}

export interface CommissionPayoutFailParams {
  reason: string;
}

export interface CommissionPayoutReverseParams {
  reason: string;
}

export interface Application {
  readonly id: string;
  readonly org_id: string;
  readonly product_id?: string | null;
  readonly name: string;
  readonly description?: string | null;
  readonly environment: string;
  readonly status: string;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ApplicationCreateParams {
  org_id: string;
  product_id?: string | null;
  name: string;
  description?: string | null;
  environment?: string;
}

export interface ApplicationUpdateParams {
  name?: string | null;
  description?: string | null;
  product_id?: string | null;
  environment?: string | null;
  status?: string | null;
}

/** Filters the applications list handler reads. */
export interface ApplicationListParams extends PageParams {
  product_id?: string;
  environment?: string;
  status?: string;
  search?: string;
}

export interface APIKey {
  readonly id: string;
  readonly application_id: string;
  readonly name: string;
  readonly public_key: string;
  readonly key_prefix: string;
  readonly scopes: ReadonlyArray<string> | null;
  readonly rate_limit_per_minute?: number | null;
  readonly environment: string;
  readonly status: string;
  readonly last_used_at?: string | null;
  readonly expires_at?: string | null;
  readonly revoked_at?: string | null;
  readonly revoked_reason?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/**
 * API-key creation. `scopes` needs at least one of `*`, `usage:report`, or
 * `<family>:read` / `<family>:write` (write implies read), where family is one
 * of: organizations, products, plans, customers, licenses, activations,
 * machines, subscriptions, entitlements, addons, usage, orders, payments,
 * invoices, webhooks, applications, api_keys, offline_certificates, referrals,
 * affiliates, audit_logs, gateways, releases, notifications,
 * application_notifications. A key can only grant scopes it holds itself.
 */
export interface APIKeyCreateParams {
  application_id: string;
  name: string;
  scopes: ReadonlyArray<string>;
  environment?: string;
  rate_limit_per_minute?: number | null;
  expires_at?: string | null;
}

/** Filters the api-keys list handler reads. */
export interface APIKeyListParams extends PageParams {
  application_id?: string;
  environment?: string;
  status?: string;
}

export interface APIKeyRevokeParams {
  reason: string;
}

export interface AuditLog {
  readonly id: string;
  readonly org_id?: string | null;
  readonly actor_id?: string | null;
  readonly actor_type: string;
  readonly actor_display?: string | null;
  readonly action: string;
  readonly target_type?: string | null;
  readonly target_id?: string | null;
  readonly target_display?: string | null;
  readonly changes?: Metadata;
  readonly previous_state?: Metadata;
  readonly metadata?: Metadata;
  readonly ip_address?: string | null;
  readonly user_agent?: string | null;
  readonly correlation_id?: string | null;
  readonly request_id?: string | null;
  readonly severity: string;
  readonly category?: string | null;
  readonly created_at: string;
}

/** Filters the audit-logs list handler reads. */
export interface AuditLogListParams extends PageParams {
  action?: string;
  category?: string;
  severity?: string;
  actor_type?: string;
  actor_id?: string;
  target_type?: string;
  target_id?: string;
  correlation_id?: string;
  request_id?: string;
  search?: string;
  /** RFC 3339 lower bound on created_at. */
  created_from?: string;
  /** RFC 3339 upper bound on created_at. */
  created_to?: string;
}

export interface Customer {
  readonly id: string;
  readonly org_id: string;
  readonly account_id?: string | null;
  readonly external_id?: string | null;
  readonly name: string;
  readonly email: string;
  readonly phone?: string | null;
  readonly company_name?: string | null;
  readonly billing_address?: Metadata;
  readonly shipping_address?: Metadata;
  readonly tax_id?: string | null;
  readonly currency: string;
  readonly locale: string;
  readonly status: string;
  readonly churned_at?: string | null;
  readonly churn_reason?: string | null;
  readonly notes?: string | null;
  readonly tags: ReadonlyArray<string> | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CustomerCreateParams {
  org_id: string;
  external_id?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  company_name?: string | null;
  billing_address?: Metadata;
  shipping_address?: Metadata;
  tax_id?: string | null;
  currency?: string;
  notes?: string | null;
  tags?: ReadonlyArray<string>;
}

export interface CustomerUpdateParams {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  billing_address?: Metadata;
  shipping_address?: Metadata;
  tax_id?: string | null;
  currency?: string | null;
  status?: string | null;
  notes?: string | null;
  tags?: ReadonlyArray<string>;
}

export type CustomerListParams = ListParams;

export interface Contact {
  readonly id: string;
  readonly customer_id: string;
  readonly name: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly role?: string | null;
  readonly is_primary: boolean;
  readonly notes?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ContactCreateParams {
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  is_primary?: boolean;
  notes?: string | null;
}

export interface Entitlement {
  readonly id: string;
  readonly product_id: string;
  readonly plan_id?: string | null;
  readonly license_id?: string | null;
  readonly addon_id?: string | null;
  readonly feature_key: string;
  readonly enabled: boolean;
  readonly value?: string | null;
  readonly config_payload: Metadata | null;
  readonly seat_limit?: number | null;
  readonly usage_cap?: number | null;
  readonly source: string;
  readonly expires_at?: string | null;
  readonly version_constraint?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Set exactly one source: plan_id, license_id, or addon_id. */
export interface EntitlementCreateParams {
  product_id: string;
  plan_id?: string | null;
  license_id?: string | null;
  addon_id?: string | null;
  feature_key: string;
  enabled?: boolean;
  value?: string | null;
  config_payload?: Metadata;
  seat_limit?: number | null;
  usage_cap?: number | null;
  source?: string;
  expires_at?: string | null;
  version_constraint?: string | null;
}

export interface EntitlementUpdateParams {
  enabled?: boolean | null;
  value?: string | null;
  config_payload?: Metadata;
  seat_limit?: number | null;
  usage_cap?: number | null;
  expires_at?: string | null;
  version_constraint?: string | null;
}

/** Filters the entitlements list handler reads. */
export interface EntitlementListParams extends PageParams {
  product_id?: string;
  plan_id?: string;
  license_id?: string;
  addon_id?: string;
  feature_key?: string;
  source?: string;
}

export interface EntitlementOverrideParams {
  feature_key: string;
  enabled?: boolean;
  value?: string | null;
  config_payload?: Metadata;
  seat_limit?: number | null;
  usage_cap?: number | null;
  reason?: string | null;
  expires_at?: string | null;
  version_constraint?: string | null;
}

export interface Invoice {
  readonly id: string;
  readonly org_id: string;
  readonly customer_id: string;
  readonly order_id?: string | null;
  readonly subscription_id?: string | null;
  readonly invoice_number: string;
  readonly line_items: ReadonlyArray<InvoiceLineItem> | null;
  readonly subtotal_cents: number;
  readonly discount_cents: number;
  readonly tax_cents: number;
  readonly tax_details: Metadata | null;
  readonly total_cents: number;
  readonly amount_due_cents: number;
  readonly amount_paid_cents: number;
  readonly currency: string;
  readonly status: string;
  readonly due_date?: string | null;
  readonly issued_at?: string | null;
  readonly paid_at?: string | null;
  readonly voided_at?: string | null;
  readonly pdf_url?: string | null;
  readonly pdf_generated_at?: string | null;
  readonly billing_details: Metadata | null;
  readonly notes?: string | null;
  readonly footer?: string | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Filters the invoices list handler reads. */
export interface InvoiceListParams extends PageParams {
  customer_id?: string;
  status?: string;
  search?: string;
}

export interface License {
  readonly id: string;
  readonly product_id: string;
  readonly customer_id: string;
  readonly plan_id?: string | null;
  readonly subscription_id?: string | null;
  readonly license_key: string;
  readonly license_type: string;
  readonly signed_payload?: string | null;
  readonly signature?: string | null;
  readonly status: string;
  readonly issued_at: string;
  readonly expires_at?: string | null;
  readonly maintenance_expires_at?: string | null;
  readonly max_activations: number;
  readonly current_activations: number;
  readonly perpetual: boolean;
  readonly perpetual_fallback_version?: string | null;
  readonly seat_limit?: number | null;
  readonly current_seats: number;
  readonly last_validated_at?: string | null;
  readonly validation_count: number;
  readonly revoked_at?: string | null;
  readonly revoke_reason?: string | null;
  readonly notes?: string | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LicenseCreateParams {
  product_id: string;
  customer_id: string;
  plan_id?: string | null;
  license_type?: string;
  expires_at?: string | null;
  maintenance_expires_at?: string | null;
  max_activations?: number;
  perpetual?: boolean;
  perpetual_fallback_version?: string | null;
  seat_limit?: number | null;
  notes?: string | null;
}

export interface LicenseBulkCreateParams extends LicenseCreateParams {
  count: number;
}

export interface LicenseBulkCreateResponse {
  readonly data: ReadonlyArray<License>;
  readonly count: number;
}

export interface LicenseListParams extends ListParams {
  product_id?: string;
  customer_id?: string;
}

export interface LicenseRevokeParams {
  reason: string;
}

export interface LicenseValidateParams {
  license_key: string;
  product_version?: string | null;
}

export interface LicenseValidationResponse {
  readonly valid: boolean;
  readonly license?: License | null;
  readonly features?: Record<string, ResolvedFeature>;
  readonly maintenance_active: boolean;
  readonly days_until_expiry?: number | null;
  readonly activations_remaining: number;
  readonly error_code?: string;
  readonly error_message?: string;
}

export interface ResolvedFeature {
  readonly enabled: boolean;
  readonly value?: unknown;
  readonly config_payload?: Metadata;
  readonly seat_limit?: number | null;
  readonly usage_cap?: number | null;
  readonly expires_at?: string | null;
}

export interface Machine {
  readonly id: string;
  readonly fingerprint: string;
  readonly hostname?: string | null;
  readonly os?: string | null;
  readonly os_version?: string | null;
  readonly arch?: string | null;
  readonly ip_address?: string | null;
  readonly cores?: number | null;
  readonly memory_mb?: number | null;
  readonly metadata: Metadata | null;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface MachineCreateParams {
  fingerprint: string;
  hostname?: string | null;
  os?: string | null;
  os_version?: string | null;
  arch?: string | null;
  cores?: number | null;
  memory_mb?: number | null;
}

export interface MachineUpdateParams {
  hostname?: string | null;
  os?: string | null;
  os_version?: string | null;
  arch?: string | null;
  cores?: number | null;
  memory_mb?: number | null;
}

/** Filters the machines list handler reads. */
export interface MachineListParams extends PageParams {
  search?: string;
  arch?: string;
}

export interface OfflineCertificate {
  readonly id: string;
  readonly license_id: string;
  readonly machine_id: string;
  readonly certificate: string;
  readonly certificate_hash: string;
  readonly policy_duration_hours: number;
  readonly grace_hours: number;
  readonly status: string;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly last_verified_at?: string | null;
  readonly requires_approval: boolean;
  readonly approved_by?: string | null;
  readonly approved_at?: string | null;
  readonly revoked_at?: string | null;
  readonly revoked_by?: string | null;
  readonly revoke_reason?: string | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Filters the offline-certificates list handler reads. */
export interface OfflineCertificateListParams extends PageParams {
  license_id?: string;
  machine_id?: string;
  status?: string;
}

export interface OfflineCertificateRevokeParams {
  reason: string;
}

export interface Order {
  readonly id: string;
  readonly org_id: string;
  readonly customer_id: string;
  readonly product_id?: string | null;
  readonly plan_id?: string | null;
  readonly subscription_id?: string | null;
  readonly addon_id?: string | null;
  readonly coupon_id?: string | null;
  readonly order_number: string;
  readonly order_type: string;
  readonly line_items: ReadonlyArray<LineItem> | null;
  readonly subtotal_cents: number;
  readonly discount_cents: number;
  readonly tax_cents: number;
  readonly total_cents: number;
  readonly currency: string;
  readonly tax_details: Metadata | null;
  readonly gateway?: string | null;
  readonly gateway_order_id?: string | null;
  readonly status: string;
  readonly fulfilled: boolean;
  readonly fulfilled_at?: string | null;
  readonly reseller_id?: string | null;
  readonly notes?: string | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface LineItem {
  readonly type: string;
  readonly reference_id?: string;
  readonly description: string;
  readonly quantity: number;
  readonly unit_amount_cents: number;
  readonly total_cents: number;
  readonly metadata?: Metadata;
}

/** Filters the orders list handler reads. */
export interface OrderListParams extends PageParams {
  customer_id?: string;
  product_id?: string;
  status?: string;
  gateway?: string;
  search?: string;
}

export interface Organization {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly logo_url?: string | null;
  readonly website?: string | null;
  readonly billing_email?: string | null;
  readonly billing_address?: Metadata;
  readonly tax_id?: string | null;
  readonly currency: string;
  readonly timezone: string;
  readonly status: string;
  readonly settings: Metadata | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at?: string | null;
}

export interface OrganizationCreateParams {
  name: string;
  slug: string;
  logo_url?: string | null;
  website?: string | null;
  billing_email?: string | null;
  billing_address?: Metadata;
  tax_id?: string | null;
  currency?: string;
  timezone?: string;
}

export interface OrganizationUpdateParams {
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  website?: string | null;
  billing_email?: string | null;
  billing_address?: Metadata;
  tax_id?: string | null;
  currency?: string | null;
  timezone?: string | null;
  status?: string | null;
}

export type OrganizationListParams = ListParams;

export interface Payment {
  readonly id: string;
  readonly order_id: string;
  readonly subscription_id?: string | null;
  readonly gateway: string;
  readonly gateway_payment_id?: string | null;
  readonly method?: string | null;
  readonly amount_cents: number;
  readonly currency: string;
  readonly status: string;
  readonly authorized_at?: string | null;
  readonly captured_at?: string | null;
  readonly paid_at?: string | null;
  readonly failed_at?: string | null;
  readonly failure_reason?: string | null;
  readonly failure_code?: string | null;
  readonly refunded_amount_cents: number;
  readonly refunded_at?: string | null;
  readonly disputed: boolean;
  readonly disputed_at?: string | null;
  readonly dispute_reason?: string | null;
  readonly receipt_url?: string | null;
  readonly attempt_count: number;
  readonly next_retry_at?: string | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Filters the payments list handler reads. */
export interface PaymentListParams extends PageParams {
  order_id?: string;
  customer_id?: string;
  status?: string;
  gateway?: string;
  search?: string;
}

export interface PaymentRefundParams {
  amount_cents?: number;
  reason?: string;
  metadata?: Metadata;
}

export interface PaymentReconcileParams {
  status: string;
  gateway_payment_id?: string | null;
  failure_reason?: string | null;
  failure_code?: string | null;
  receipt_url?: string | null;
  metadata?: Metadata;
}

export interface Plan {
  readonly id: string;
  readonly product_id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
  readonly plan_type: string;
  readonly billing_interval?: string | null;
  readonly price_cents: number;
  readonly currency: string;
  readonly setup_fee_cents: number;
  readonly seat_based: boolean;
  readonly seat_price_cents: number;
  readonly min_seats: number;
  readonly max_seats?: number | null;
  readonly trial_days: number;
  readonly max_activations?: number | null;
  readonly features: Metadata | null;
  readonly limits: Metadata | null;
  readonly is_popular: boolean;
  readonly sort_order: number;
  readonly gateway_config_id?: string | null;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Plans are created as drafts; set status to "active" to sell and compare them. */
export interface PlanCreateParams {
  product_id: string;
  name: string;
  slug: string;
  description?: string | null;
  plan_type?: string;
  billing_interval?: string | null;
  price_cents?: number;
  currency?: string;
  setup_fee_cents?: number;
  seat_based?: boolean;
  seat_price_cents?: number;
  min_seats?: number;
  max_seats?: number | null;
  trial_days?: number;
  max_activations?: number | null;
  features?: Metadata;
  limits?: Metadata;
  is_popular?: boolean;
  sort_order?: number;
  gateway_config_id?: string | null;
}

export interface PlanUpdateParams {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  plan_type?: string | null;
  billing_interval?: string | null;
  price_cents?: number | null;
  currency?: string | null;
  setup_fee_cents?: number | null;
  seat_based?: boolean | null;
  seat_price_cents?: number | null;
  min_seats?: number | null;
  max_seats?: number | null;
  trial_days?: number | null;
  max_activations?: number | null;
  features?: Metadata;
  limits?: Metadata;
  is_popular?: boolean | null;
  sort_order?: number | null;
  status?: string | null;
  gateway_config_id?: string | null;
}

export interface PlanListParams extends ListParams {
  product_id?: string;
}

export interface Product {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
  readonly product_type: string;
  readonly logo_url?: string | null;
  readonly website_url?: string | null;
  readonly support_email?: string | null;
  readonly status: string;
  readonly default_license_type?: string | null;
  readonly max_activations_default?: number | null;
  readonly maintenance_duration_months?: number | null;
  readonly signing_key_id?: string | null;
  readonly default_gateway_config_id?: string | null;
  readonly allowed_gateways?: ReadonlyArray<string>;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ProductCreateParams {
  org_id: string;
  name: string;
  slug: string;
  description?: string | null;
  product_type?: string;
  logo_url?: string | null;
  website_url?: string | null;
  support_email?: string | null;
  default_license_type?: string | null;
  max_activations_default?: number | null;
  maintenance_duration_months?: number | null;
  default_gateway_config_id?: string | null;
  allowed_gateways?: ReadonlyArray<string>;
}

export interface ProductUpdateParams {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  product_type?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  support_email?: string | null;
  status?: string | null;
  default_license_type?: string | null;
  max_activations_default?: number | null;
  maintenance_duration_months?: number | null;
  default_gateway_config_id?: string | null;
  allowed_gateways?: ReadonlyArray<string>;
}

export type ProductListParams = ListParams;

export interface ReferralProgram {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly reward_type: string;
  readonly reward_value: number;
  readonly reward_currency?: string | null;
  readonly reward_max_amount_cents?: number | null;
  readonly referrer_reward_type?: string | null;
  readonly referrer_reward_value?: number | null;
  readonly referrer_reward_currency?: string | null;
  readonly max_uses_per_referrer?: number | null;
  readonly max_total_uses?: number | null;
  readonly total_uses: number;
  readonly applicable_products?: ReadonlyArray<string>;
  readonly min_order_cents?: number | null;
  readonly require_purchase: boolean;
  readonly cooldown_days?: number | null;
  readonly rules?: Metadata;
  readonly valid_from?: string | null;
  readonly valid_until?: string | null;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ReferralProgramCreateParams {
  org_id: string;
  name: string;
  description?: string | null;
  reward_type?: string;
  reward_value?: number;
  reward_currency?: string | null;
  reward_max_amount_cents?: number | null;
  referrer_reward_type?: string | null;
  referrer_reward_value?: number | null;
  referrer_reward_currency?: string | null;
  max_uses_per_referrer?: number | null;
  max_total_uses?: number | null;
  applicable_products?: ReadonlyArray<string>;
  min_order_cents?: number | null;
  require_purchase?: boolean;
  cooldown_days?: number | null;
  rules?: Metadata;
  valid_from?: string | null;
  valid_until?: string | null;
  status?: string;
}

export interface ReferralProgramUpdateParams {
  name?: string | null;
  description?: string | null;
  reward_type?: string | null;
  reward_value?: number | null;
  reward_currency?: string | null;
  reward_max_amount_cents?: number | null;
  referrer_reward_type?: string | null;
  referrer_reward_value?: number | null;
  referrer_reward_currency?: string | null;
  max_uses_per_referrer?: number | null;
  max_total_uses?: number | null;
  applicable_products?: ReadonlyArray<string>;
  min_order_cents?: number | null;
  require_purchase?: boolean | null;
  cooldown_days?: number | null;
  rules?: Metadata;
  valid_from?: string | null;
  valid_until?: string | null;
  status?: string | null;
}

/** The referral-programs handler accepts no `search` filter. */
export interface ReferralProgramListParams extends PageParams {
  status?: string;
}

export interface ReferralCode {
  readonly id: string;
  readonly program_id: string;
  readonly referrer_id: string;
  readonly referrer_type: string;
  readonly code: string;
  readonly landing_url?: string | null;
  readonly uses_count: number;
  readonly max_uses?: number | null;
  readonly status: string;
  readonly expires_at?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ReferralCodeCreateParams {
  program_id: string;
  referrer_id: string;
  referrer_type: string;
  code?: string;
  landing_url?: string | null;
  max_uses?: number | null;
  expires_at?: string | null;
}

/** The referral-codes handler accepts no `search` or `status` filter. */
export interface ReferralCodeListParams extends PageParams {
  program_id?: string;
  referrer_id?: string;
}

export interface ReferralEvent {
  readonly id: string;
  readonly code_id: string;
  readonly referred_customer_id: string;
  readonly attributed_order_id?: string | null;
  readonly status: string;
  readonly referrer_reward_issued: boolean;
  readonly referrer_reward_amount_cents?: number | null;
  readonly referred_reward_issued: boolean;
  readonly referred_reward_amount_cents?: number | null;
  readonly qualified_at?: string | null;
  readonly rewarded_at?: string | null;
  readonly rejected_at?: string | null;
  readonly rejected_reason?: string | null;
  readonly ip_address?: string | null;
  readonly user_agent?: string | null;
  readonly metadata?: Metadata;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ReferralEventCreateParams {
  code_id: string;
  referred_customer_id?: string;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Metadata;
}

/** The referral-events handler accepts no `search` filter. */
export interface ReferralEventListParams extends PageParams {
  code_id?: string;
  status?: string;
}

export interface ReferralEventQualifyParams {
  attributed_order_id?: string | null;
}

export interface ReferralEventRewardParams {
  referrer_reward_amount_cents?: number | null;
  referred_reward_amount_cents?: number | null;
}

export interface ReferralEventRejectParams {
  reason: string;
}

export interface Subscription {
  readonly id: string;
  readonly customer_id: string;
  readonly product_id: string;
  readonly plan_id: string;
  readonly license_id?: string | null;
  readonly status: string;
  readonly gateway?: string | null;
  readonly gateway_subscription_id?: string | null;
  readonly gateway_customer_id?: string | null;
  readonly current_period_start?: string | null;
  readonly current_period_end?: string | null;
  readonly trial_start?: string | null;
  readonly trial_end?: string | null;
  readonly quantity: number;
  readonly cancel_at_period_end: boolean;
  readonly canceled_at?: string | null;
  readonly cancel_reason?: string | null;
  readonly grace_period_end?: string | null;
  readonly paused_at?: string | null;
  readonly resumed_at?: string | null;
  readonly proration_behavior: string;
  readonly billing_anchor?: string | null;
  readonly next_invoice_at?: string | null;
  readonly metadata?: Metadata;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface SubscriptionDetail extends Subscription {
  readonly customer_name: string;
  readonly product_name: string;
  readonly plan_name: string;
  readonly plan_slug: string;
  readonly license_keys?: ReadonlyArray<string>;
}

export interface SubscriptionCreateParams {
  customer_id: string;
  product_id: string;
  plan_id: string;
  quantity?: number;
  trial_days?: number | null;
  gateway?: string | null;
  gateway_subscription_id?: string | null;
  gateway_customer_id?: string | null;
  proration_behavior?: string;
  billing_anchor?: string | null;
  bundle_product_ids?: ReadonlyArray<string>;
  grace_days?: number;
}

export interface SubscriptionUpdateParams {
  gateway?: string | null;
  gateway_subscription_id?: string | null;
  gateway_customer_id?: string | null;
  proration_behavior?: string | null;
  metadata?: Metadata;
}

/** Filters the subscriptions list handler reads. */
export interface SubscriptionListParams extends PageParams {
  customer_id?: string;
  product_id?: string;
  status?: string;
  search?: string;
}

export interface SubscriptionRenewParams {
  periods: number;
  effective_at?: string | null;
}

export interface SubscriptionPauseParams {
  reason?: string | null;
}

export interface SubscriptionResumeParams {
  effective_at?: string | null;
}

export interface SubscriptionCancelParams {
  at_period_end: boolean;
  reason?: string | null;
}

export interface SubscriptionChangePlanParams {
  plan_id: string;
  quantity?: number | null;
  proration_behavior?: string | null;
  bundle_product_ids?: ReadonlyArray<string>;
}

export interface SubscriptionSeatParams {
  quantity: number;
  proration_behavior?: string | null;
}

export interface SubscriptionMutationResult {
  readonly subscription?: Subscription | null;
  readonly proration?: ProrationPreview | null;
  readonly license_ids?: ReadonlyArray<string>;
}

export interface ProrationPreview {
  readonly amount_cents: number;
  readonly currency: string;
  readonly remaining_fraction: number;
  readonly description: string;
}

export interface UsageMeter {
  readonly id: string;
  readonly product_id: string;
  readonly feature_key: string;
  readonly name: string;
  readonly description?: string | null;
  readonly meter_type: string;
  readonly unit_name: string;
  readonly reset_period: string;
  readonly soft_limit?: number | null;
  readonly hard_limit?: number | null;
  readonly overage_allowed: boolean;
  readonly overage_rate_cents: number;
  readonly overage_currency: string;
  readonly billing_model: string;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UsageMeterCreateParams {
  product_id: string;
  feature_key: string;
  name: string;
  description?: string | null;
  meter_type?: string;
  unit_name?: string;
  reset_period?: string;
  soft_limit?: number | null;
  hard_limit?: number | null;
  overage_allowed?: boolean;
  overage_rate_cents?: number;
  overage_currency?: string;
  billing_model?: string;
}

export interface UsageMeterUpdateParams {
  feature_key?: string | null;
  name?: string | null;
  description?: string | null;
  meter_type?: string | null;
  unit_name?: string | null;
  reset_period?: string | null;
  soft_limit?: number | null;
  hard_limit?: number | null;
  overage_allowed?: boolean | null;
  overage_rate_cents?: number | null;
  overage_currency?: string | null;
  billing_model?: string | null;
  status?: string | null;
}

export interface UsageMeterListParams extends ListParams {
  product_id?: string;
  billing_model?: string;
  reset_period?: string;
}

export interface UsageSummary {
  readonly license_id: string;
  readonly license_key?: string;
  readonly product_id?: string;
  readonly meter: UsageMeter;
  readonly period_start: string;
  readonly period_end: string;
  readonly aggregate_total: number;
  readonly adjustment_total: number;
  readonly effective_total: number;
  readonly remaining_balance?: number | null;
  readonly soft_limit_state: string;
  readonly hard_limit_state: string;
  readonly overage_quantity: number;
  readonly latest_report_at?: string | null;
}

/** Adjustments apply to counter meters only. */
export interface UsageAdjustmentParams {
  license_id: string;
  meter_id: string;
  period_start: string;
  period_end: string;
  quantity_delta: number;
  reason: string;
  metadata?: Metadata;
}

export interface UsageAdjustment {
  readonly id: string;
  readonly license_id: string;
  readonly meter_id: string;
  readonly period_start: string;
  readonly period_end: string;
  readonly quantity_delta: number;
  readonly reason: string;
  readonly actor_account_id?: string | null;
  readonly effective_at: string;
  readonly metadata: Metadata | null;
  readonly created_at: string;
}

/** Credits apply to prepaid meters only; entry_type defaults to "grant". */
export interface UsageCreditParams {
  license_id: string;
  meter_id: string;
  entry_type?: string;
  quantity: number;
  expires_at?: string | null;
  source_ref?: string | null;
  metadata?: Metadata;
}

export interface UsageCredit {
  readonly id: string;
  readonly license_id: string;
  readonly meter_id: string;
  readonly entry_type: string;
  readonly quantity: number;
  readonly expires_at?: string | null;
  readonly source_ref?: string | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
}

export interface WebhookEndpoint {
  readonly id: string;
  readonly org_id: string;
  readonly url: string;
  readonly description?: string | null;
  readonly secret_prefix?: string | null;
  readonly events: ReadonlyArray<string> | null;
  readonly api_version?: string | null;
  readonly status: string;
  readonly consecutive_failures: number;
  readonly last_success_at?: string | null;
  readonly last_failure_at?: string | null;
  readonly disabled_at?: string | null;
  readonly disabled_reason?: string | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at?: string | null;
}

export interface WebhookEndpointCreateParams {
  org_id: string;
  url: string;
  description?: string | null;
  events?: ReadonlyArray<string>;
  api_version?: string | null;
  metadata?: Metadata;
}

export interface WebhookEndpointCreateResult {
  readonly endpoint?: WebhookEndpoint | null;
  readonly secret: string;
}

export interface WebhookEndpointUpdateParams {
  url?: string | null;
  description?: string | null;
  events?: ReadonlyArray<string>;
  api_version?: string | null;
  status?: string | null;
  disabled_reason?: string | null;
  metadata?: Metadata;
}

export interface WebhookEndpointListParams extends ListParams {
  org_id?: string;
}

export interface WebhookEvent {
  readonly id: string;
  readonly endpoint_id: string;
  readonly event_type: string;
  readonly event_id: string;
  readonly payload: Metadata | null;
  readonly headers?: Metadata;
  readonly status: string;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly next_retry_at?: string | null;
  readonly last_attempted_at?: string | null;
  readonly last_response_code?: number | null;
  readonly last_response_body?: string | null;
  readonly last_response_time_ms?: number | null;
  readonly delivered_at?: string | null;
  readonly last_error?: string | null;
  readonly idempotency_key?: string | null;
  readonly created_at: string;
}

export interface WebhookEventListParams extends ListParams {
  endpoint_id?: string;
  event_type?: string;
}

export interface WebhookEventEnvelope {
  readonly id: string;
  readonly type: string;
  readonly api_version: string;
  readonly created_at: string;
  readonly org_id: string;
  readonly data: unknown;
}

/** A payment gateway configuration. Credentials are stored encrypted and never returned. */
export interface GatewayConfig {
  readonly id: string;
  readonly org_id: string;
  readonly provider: string;
  readonly display_name: string;
  readonly environment: string;
  readonly is_default: boolean;
  readonly status: string;
  readonly supports_subscriptions: boolean;
  readonly supports_refunds: boolean;
  readonly supports_saved_cards: boolean;
  readonly supports_checkout_sessions: boolean;
  readonly supports_webhooks: boolean;
  readonly supported_currencies?: ReadonlyArray<string>;
  readonly webhook_endpoint_url?: string | null;
  readonly last_health_check_at?: string | null;
  readonly last_health_status?: string | null;
  readonly consecutive_failures: number;
  readonly metadata?: Metadata;
  readonly created_at: string;
  readonly updated_at: string;
}

/** `credentials` are provider secrets: send them only from a backend, never a browser. */
export interface GatewayConfigCreateParams {
  org_id: string;
  provider: string;
  display_name?: string;
  environment?: string;
  credentials?: Metadata;
  is_default?: boolean;
  metadata?: Metadata;
}

export interface GatewayConfigUpdateParams {
  display_name?: string | null;
  environment?: string | null;
  credentials?: Metadata;
  is_default?: boolean | null;
  status?: string | null;
  metadata?: Metadata;
}

export interface GatewayCapabilities {
  readonly supports_subscriptions: boolean;
  readonly supports_refunds: boolean;
  readonly supports_saved_cards: boolean;
  readonly supports_checkout_sessions: boolean;
  readonly supports_webhooks: boolean;
  readonly supported_currencies?: ReadonlyArray<string>;
}

/** One credential input a provider requires; `pattern` is an anchored regular expression. */
export interface GatewayCredentialField {
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly required: boolean;
  readonly placeholder?: string;
  readonly help?: string;
  readonly pattern?: string;
  readonly pattern_message?: string;
  readonly min_length?: number;
  readonly max_length?: number;
}

export interface GatewayConfigListParams extends PageParams {
  provider?: string;
  status?: string;
}

export interface NotificationTemplate {
  readonly id: string;
  readonly org_id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
  readonly channel: string;
  readonly subject?: string | null;
  readonly body_template: string;
  readonly body_html?: string | null;
  readonly variables: ReadonlyArray<string> | null;
  readonly from_name?: string | null;
  readonly from_address?: string | null;
  readonly reply_to?: string | null;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface NotificationTemplateCreateParams {
  org_id: string;
  name: string;
  slug: string;
  description?: string | null;
  channel: string;
  subject?: string | null;
  body_template: string;
  body_html?: string | null;
  variables?: ReadonlyArray<string>;
  from_name?: string | null;
  from_address?: string | null;
  reply_to?: string | null;
}

export interface NotificationTemplateUpdateParams {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  subject?: string | null;
  body_template?: string | null;
  body_html?: string | null;
  variables?: ReadonlyArray<string>;
  from_name?: string | null;
  from_address?: string | null;
  reply_to?: string | null;
  status?: string | null;
}

/** An email or SMS notification and its delivery state. */
export interface Notification {
  readonly id: string;
  readonly org_id: string;
  readonly template_id?: string | null;
  readonly channel: string;
  readonly recipient: string;
  readonly recipient_name?: string | null;
  readonly subject?: string | null;
  readonly body: string;
  readonly body_html?: string | null;
  readonly provider: string;
  readonly provider_message_id?: string | null;
  readonly status: string;
  readonly queued_at: string;
  readonly sent_at?: string | null;
  readonly delivered_at?: string | null;
  readonly failed_at?: string | null;
  readonly opened_at?: string | null;
  readonly clicked_at?: string | null;
  readonly failure_reason?: string | null;
  readonly failure_code?: string | null;
  readonly attempt_count: number;
  readonly max_attempts: number;
  readonly next_retry_at?: string | null;
  readonly trigger_type?: string | null;
  readonly trigger_id?: string | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
}

/** Queue a notification from a template (`template_id` + `variables`) or from an explicit `subject`/`body`. */
export interface NotificationQueueParams {
  org_id: string;
  template_id?: string | null;
  channel: string;
  recipient: string;
  recipient_name?: string | null;
  subject?: string | null;
  body?: string | null;
  body_html?: string | null;
  from_name?: string | null;
  from_address?: string | null;
  reply_to?: string | null;
  variables?: Metadata;
  max_attempts?: number;
  trigger_type?: string | null;
  trigger_id?: string | null;
  metadata?: Metadata;
}

export interface NotificationTemplateListParams extends PageParams {
  org_id?: string;
  channel?: string;
  status?: string;
  search?: string;
}

export interface NotificationListParams extends PageParams {
  org_id?: string;
  channel?: string;
  status?: string;
  provider?: string;
  search?: string;
}

/** Who sees an application notification; empty lists match everyone. */
export interface ApplicationNotificationAudience {
  readonly application_ids?: ReadonlyArray<string>;
  readonly release_channels?: ReadonlyArray<string>;
  readonly platforms?: ReadonlyArray<string>;
  readonly architectures?: ReadonlyArray<string>;
  readonly min_version?: string | null;
  readonly max_version?: string | null;
  readonly customer_ids?: ReadonlyArray<string>;
  readonly license_ids?: ReadonlyArray<string>;
  readonly maintenance_required?: boolean | null;
}

/** An in-app announcement delivered to installed software through the feed. */
export interface ApplicationNotification {
  readonly id: string;
  readonly org_id: string;
  readonly product_id: string;
  readonly release_id?: string | null;
  readonly title: string;
  readonly message: string;
  readonly severity: string;
  readonly message_type: string;
  readonly call_to_action: Metadata | null;
  readonly audience: ApplicationNotificationAudience;
  readonly priority: number;
  readonly pinned: boolean;
  readonly dismissible: boolean;
  readonly starts_at?: string | null;
  readonly expires_at?: string | null;
  readonly status: string;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ApplicationNotificationReadState {
  readonly id: string;
  readonly notification_id: string;
  readonly org_id: string;
  readonly customer_id?: string | null;
  readonly license_id?: string | null;
  readonly machine_id?: string | null;
  readonly application_id?: string | null;
  readonly identity_key: string;
  readonly state: string;
  readonly acknowledged_at: string;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ApplicationNotificationCreateParams {
  org_id: string;
  product_id: string;
  release_id?: string | null;
  title: string;
  message: string;
  severity?: string;
  message_type?: string;
  call_to_action?: Metadata;
  audience?: ApplicationNotificationAudience;
  priority?: number;
  pinned?: boolean;
  dismissible?: boolean;
  starts_at?: string | null;
  expires_at?: string | null;
  status?: string;
  metadata?: Metadata;
}

export interface ApplicationNotificationUpdateParams {
  product_id?: string | null;
  release_id?: string | null;
  title?: string | null;
  message?: string | null;
  severity?: string | null;
  message_type?: string | null;
  call_to_action?: Metadata;
  audience?: ApplicationNotificationAudience | null;
  priority?: number | null;
  pinned?: boolean | null;
  dismissible?: boolean | null;
  starts_at?: string | null;
  expires_at?: string | null;
  status?: string | null;
  metadata?: Metadata;
}

export interface ApplicationNotificationFeedItem {
  readonly notification: ApplicationNotification;
  readonly state?: ApplicationNotificationReadState | null;
}

/** Authenticate with the client's API key, or pass `license_key` from installed software. */
export interface ApplicationNotificationFeedParams {
  application_id?: string;
  license_key?: string;
  installation_id?: string;
  machine_id?: string;
  version?: string;
  channel?: string;
  os?: string;
  arch?: string;
  release_id?: string;
}

/** Identify the installation the same way as the feed request; `state` defaults to "acknowledged". */
export interface ApplicationNotificationAckParams {
  application_id?: string;
  license_key?: string;
  installation_id?: string;
  machine_id?: string;
  state?: string;
  metadata?: Metadata;
}

export interface ApplicationNotificationListParams extends PageParams {
  org_id?: string;
  product_id?: string;
  status?: string;
  search?: string;
}

/** A versioned binary release of a product; artifacts hang off it. */
export interface Release {
  readonly id: string;
  readonly product_id: string;
  readonly version: string;
  readonly version_major?: number | null;
  readonly version_minor?: number | null;
  readonly version_patch?: number | null;
  readonly channel: string;
  readonly release_notes?: string | null;
  readonly changelog?: string | null;
  readonly min_os_version?: string | null;
  readonly requires_license_type?: string | null;
  readonly status: string;
  readonly published_at?: string | null;
  readonly yanked_at?: string | null;
  readonly yank_reason?: string | null;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ReleaseArtifact {
  readonly id: string;
  readonly release_id: string;
  readonly os: string;
  readonly arch: string;
  readonly filename: string;
  readonly file_size_bytes: number;
  readonly content_type: string;
  readonly checksum_sha256: string;
  readonly checksum_md5?: string | null;
  readonly storage_backend: string;
  readonly storage_path: string;
  readonly storage_bucket?: string | null;
  readonly signed: boolean;
  readonly signature?: string | null;
  readonly signing_key_id?: string | null;
  readonly download_count: number;
  readonly metadata: Metadata | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ReleaseCreateParams {
  product_id: string;
  version: string;
  channel?: string;
  release_notes?: string | null;
  changelog?: string | null;
  min_os_version?: string | null;
  requires_license_type?: string | null;
  metadata?: Metadata;
}

export interface ReleaseUpdateParams {
  version?: string | null;
  channel?: string | null;
  release_notes?: string | null;
  changelog?: string | null;
  min_os_version?: string | null;
  requires_license_type?: string | null;
  status?: string | null;
  yank_reason?: string | null;
  metadata?: Metadata;
}

export interface ReleaseDetail {
  readonly release?: Release | null;
  readonly product_name?: string;
  readonly artifacts: ReadonlyArray<ReleaseArtifact> | null;
}

export interface ReleaseArtifactChecksum {
  readonly artifact_id: string;
  readonly filename: string;
  readonly checksum_sha256: string;
  readonly checksum_md5?: string | null;
  readonly signed: boolean;
  readonly signature?: string | null;
}

export interface DownloadAuthorizeParams {
  license_key: string;
  artifact_id: string;
}

/** A short-lived download grant; `url` embeds a signed token usable until `expires_at`. */
export interface AuthorizedDownload {
  readonly artifact: ReleaseArtifact;
  readonly release: Release;
  readonly url: string;
  readonly expires_at: string;
  readonly license_key: string;
}

export interface ReleaseListParams extends PageParams {
  product_id?: string;
  channel?: string;
  status?: string;
  search?: string;
}

/** Multipart fields for `POST /releases/{id}/artifacts`. */
export interface ReleaseArtifactUploadParams {
  /** The artifact bytes, streamed to storage; the server rejects files over `RELEASE_MAX_ARTIFACT_BYTES` (default 2 GiB) with 413. */
  file: Blob;
  filename: string;
  os?: string;
  arch?: string;
}

/** A per-license override of one entitled feature. */
export interface EntitlementOverride {
  readonly id: string;
  readonly license_id: string;
  readonly feature_key: string;
  readonly enabled: boolean;
  readonly value?: string | null;
  readonly config_payload: Metadata | null;
  readonly seat_limit?: number | null;
  readonly usage_cap?: number | null;
  readonly reason?: string | null;
  readonly overridden_by?: string | null;
  readonly expires_at?: string | null;
  readonly version_constraint?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface InvoiceLineItem {
  readonly type: string;
  readonly reference_id?: string;
  readonly description: string;
  readonly quantity: number;
  readonly unit_amount_cents: number;
  readonly total_cents: number;
  readonly metadata?: Metadata;
}

/** A customer's saved payment method: a gateway token plus display details (never raw card data). */
export interface PaymentMethod {
  readonly id: string;
  readonly customer_id: string;
  readonly org_id: string;
  readonly gateway_config_id: string;
  readonly provider: string;
  readonly gateway_customer_id?: string | null;
  readonly gateway_method_id?: string | null;
  readonly method_type: string;
  readonly display_name: string;
  readonly last_four?: string | null;
  readonly brand?: string | null;
  readonly exp_month?: number | null;
  readonly exp_year?: number | null;
  readonly is_default: boolean;
  readonly status: string;
  readonly metadata?: Metadata;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Save a tokenized payment method. org_id is the customer's organization and may be omitted; the gateway must belong to it. */
export interface PaymentMethodCreateParams {
  customer_id: string;
  org_id?: string;
  gateway_config_id: string;
  provider: string;
  gateway_customer_id?: string | null;
  gateway_method_id?: string | null;
  method_type?: string;
  display_name?: string;
  last_four?: string | null;
  brand?: string | null;
  exp_month?: number | null;
  exp_year?: number | null;
  is_default?: boolean;
  metadata?: Metadata;
}

/** A gateway a customer can pay with, and their saved method for it if any. */
export interface CheckoutOption {
  readonly config_id: string;
  readonly provider: string;
  readonly display_name: string;
  readonly saved_method_id?: string | null;
  readonly saved_method_name?: string | null;
}

/** One inbound payment-provider webhook and how it was processed. */
export interface GatewayWebhookLog {
  readonly id: string;
  readonly org_id?: string | null;
  readonly provider: string;
  readonly gateway_config_id?: string | null;
  readonly event_id: string;
  readonly event_type: string;
  readonly normalized_type: string;
  readonly status: string;
  readonly http_status?: number | null;
  readonly error_message?: string | null;
  readonly processing_ms?: number | null;
  readonly ip_address?: string | null;
  readonly metadata?: Metadata;
  readonly created_at: string;
}

/** Filters the payment-methods list handler reads. */
export interface PaymentMethodListParams extends PageParams {
  customer_id?: string;
  provider?: string;
  status?: string;
}

/** Filters for gateway webhook logs; the server returns the 50 most recent. */
export interface GatewayWebhookLogListParams {
  provider?: string;
  status?: string;
}
