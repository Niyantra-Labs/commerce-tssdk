import { http } from 'msw';
import { routes } from './routes.mjs';

export { routes };

/** Build route-specific MSW handlers. Callers must supply their own response fixtures. */
export function createCommerceHandlers({ baseUrl, respond }) {
  if (!baseUrl || typeof respond !== 'function')
    throw new TypeError('baseUrl and respond are required');
  const origin = new globalThis.URL(baseUrl);
  if (origin.search || origin.hash)
    throw new TypeError('baseUrl must not contain query or fragment');
  const prefix = origin.href.replace(/\/$/, '');
  return routes.map((route) => {
    const pattern = `${prefix}${route.path.replace(/\{([^}]+)\}/g, ':$1')}`;
    const factory = http[route.method.toLowerCase()];
    if (!factory) throw new TypeError(`Unsupported route method: ${route.method}`);
    return factory(pattern, async ({ request, params }) => {
      const response = await respond(route, { request, params });
      if (!(response instanceof globalThis.Response))
        throw new TypeError(`Fixture for ${route.key} must return a Response`);
      return response;
    });
  });
}
