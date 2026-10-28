import type { RequestHandler } from 'msw';

export interface CommerceRoute {
  readonly key: string;
  readonly method: string;
  readonly path: string;
  readonly envelope: 'data' | 'list' | 'status' | 'direct' | 'raw' | 'unknown';
  readonly status: number;
}

export declare const routes: readonly CommerceRoute[];
export declare function createCommerceHandlers(options: {
  baseUrl: string;
  respond: (
    route: CommerceRoute,
    context: { request: Request; params: Record<string, string | readonly string[]> },
  ) => Response | Promise<Response>;
}): RequestHandler[];
