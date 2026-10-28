import type {
  Client,
  License,
  ListResponse,
  ServerSubscriptionDetail,
  UsageSummary,
} from '@niyantra/commerce';
import type { QueryFunctionContext, UseQueryResult } from '@tanstack/react-query';

export interface CommerceQueryOptions<T> {
  readonly queryKey: readonly [string, number, string, string | undefined];
  readonly enabled: boolean;
  readonly queryFn: (context: QueryFunctionContext) => Promise<T>;
}

export declare function licenseQueryOptions(
  client: Client,
  id: string | undefined,
): CommerceQueryOptions<License>;
export declare function subscriptionQueryOptions(
  client: Client,
  id: string | undefined,
): CommerceQueryOptions<ServerSubscriptionDetail>;
export declare function usageQueryOptions(
  client: Client,
  licenseId: string | undefined,
): CommerceQueryOptions<ListResponse<UsageSummary>>;
export declare function useLicense(
  client: Client,
  id: string | undefined,
): UseQueryResult<License, Error>;
export declare function useSubscription(
  client: Client,
  id: string | undefined,
): UseQueryResult<ServerSubscriptionDetail, Error>;
export declare function useUsage(
  client: Client,
  licenseId: string | undefined,
): UseQueryResult<ListResponse<UsageSummary>, Error>;
