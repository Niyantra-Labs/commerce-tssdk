import { expectTypeOf } from 'expect-type';
import { it } from 'vitest';
import type {
  Client,
  License,
  ServerSubscriptionDetail,
  UsageSummary,
  ListResponse,
} from '../src/index.js';
import {
  useLicense,
  useSubscription,
  useUsage,
  licenseQueryOptions,
} from '../packages/react/index.mjs';

it('exposes typed React hooks and query options', () => {
  expectTypeOf<ReturnType<typeof useLicense>['data']>().toEqualTypeOf<License | undefined>();
  expectTypeOf<ReturnType<typeof useSubscription>['data']>().toEqualTypeOf<
    ServerSubscriptionDetail | undefined
  >();
  expectTypeOf<ReturnType<typeof useUsage>['data']>().toEqualTypeOf<
    ListResponse<UsageSummary> | undefined
  >();
  expectTypeOf<Parameters<typeof licenseQueryOptions>[0]>().toEqualTypeOf<Client>();
});
