import type * as Go from './generated.js';

/** Current server status response for actions that do not return the resource. */
export interface StatusResult {
  readonly status: string;
}

export interface SigningKey {
  readonly algorithm: 'Ed25519';
  readonly public_key: string;
}

export interface OfflineVerifyInput {
  certificate: string;
  fingerprint: string;
  signature?: string;
}
export interface OfflineIssueInput {
  license_id: string;
  machine_id: string;
  product_version?: string;
  policy_duration_hours?: number;
  grace_hours?: number;
  requires_approval?: boolean;
}
export interface OfflineIssueResult {
  readonly certificate: Go.OfflineCertificate;
  readonly signature: string;
}
export interface OfflineVerifyResult {
  readonly valid: boolean;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly in_grace_period: boolean;
  readonly error_code?: string;
  readonly error_message?: string;
}

/** The decoded contents of an offline certificate's signed bytes. */
export interface OfflineCertificatePayload {
  readonly certificate_id: string;
  readonly license_id: string;
  readonly license_key: string;
  readonly machine_id: string;
  readonly fingerprint: string;
  readonly product_id: string;
  readonly customer_id: string;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly grace_expires_at: string;
  readonly features?: Readonly<Record<string, Go.ResolvedFeature>>;
}

/** Result of a fully local (no network round-trip) offline certificate check. */
export interface OfflineLocalVerifyResult {
  readonly valid: boolean;
  readonly payload?: OfflineCertificatePayload;
  readonly inGracePeriod: boolean;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface WebhookEventEnvelope {
  readonly id: string;
  readonly type: string;
  readonly api_version: string;
  readonly created_at: string;
  readonly org_id: string;
  readonly data: unknown;
}

export interface UsageReportInput {
  license_key: string;
  feature_key: string;
  quantity: number;
  period_start: string;
  period_end: string;
  idempotency_key: string;
  client_version?: string;
}

export interface UsageIngestResult {
  readonly results: ReadonlyArray<{
    readonly license_key: string;
    readonly feature_key: string;
    readonly status: string;
    readonly error_code?: string;
    readonly warning_code?: string;
    readonly aggregate_total: number;
    readonly remaining_balance?: number | null;
    readonly overage_quantity: number;
  }>;
}

export interface OrderCreateInput {
  customer_id: string;
  product_id: string;
  plan_id?: string;
  subscription_id?: string;
  addon_id?: string;
  order_type: string;
  quantity: number;
  gateway: string;
  coupon_code?: string;
  notes?: string;
  metadata?: Go.Metadata;
  create_checkout?: boolean;
  return_base_url?: string;
}
export interface OrderCreateResult {
  readonly order: Go.Order;
  readonly checkout?: Readonly<Record<string, unknown>>;
  readonly invoice_id?: string | null;
  readonly payment_id?: string | null;
}
export interface OrderFulfillInput {
  method?: string;
  note?: string;
  receipt_url?: string;
}
export interface OrderDetail {
  readonly order: Go.Order;
  readonly customer_name?: string;
  readonly product_name?: string | null;
  readonly plan_name?: string | null;
  readonly subscription?: string | null;
  readonly payments?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly invoice_id?: string | null;
}
export interface SubscriptionDetail {
  readonly subscription: Go.Subscription;
  readonly customer_name?: string;
  readonly product_name?: string;
  readonly plan_name?: string;
  readonly plan_slug?: string;
  readonly license_keys?: ReadonlyArray<string>;
}
export interface InvoiceDetail {
  readonly invoice: Go.Invoice;
  readonly customer_name?: string;
  readonly order_number?: string | null;
  readonly credit_notes: ReadonlyArray<Readonly<Record<string, unknown>>>;
}
export interface WebhookEventDetail {
  readonly event: Go.WebhookEvent;
  readonly endpoint_url: string;
  readonly endpoint?: Go.WebhookEndpoint | null;
}
export interface MachineDetail extends Go.Machine {
  readonly active_activations: number;
  readonly total_activations: number;
  readonly active_certificates: number;
  readonly total_certificates: number;
}
/** The server returns a flattened API key with a one-time secret. */
export type ApiKeySecretResult = Go.APIKey & { readonly secret_key: string };
/**
 * `GET /plans/compare` matrix over a product's active plans. `features` and
 * `limits` are `null` (not `[]`) when no compared plan defines any; `pricing`
 * always contains at least the "Price" row.
 */
export interface PlanComparison {
  readonly plans: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly is_popular: boolean;
  }>;
  readonly features: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly values: ReadonlyArray<{
      readonly plan_id: string;
      readonly enabled: boolean;
      readonly value: string;
    }>;
  }> | null;
  readonly limits: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly unit?: string;
    readonly values: ReadonlyArray<{ readonly plan_id: string; readonly value: string }>;
  }> | null;
  readonly pricing: ReadonlyArray<{
    readonly label: string;
    readonly values: ReadonlyArray<string>;
  }>;
}
