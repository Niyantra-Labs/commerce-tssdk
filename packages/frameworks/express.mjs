import { defineWebhookHandler } from '@niyantra/commerce';

/** Express adapter. Mount after express.raw(); parsed JSON cannot be signature-verified. */
export function createExpressWebhookHandler(options) {
  const handle = defineWebhookHandler(options);
  return async (request, response, next) => {
    if (request.method !== 'POST') {
      response.status(405).end();
      return;
    }
    if (!(request.body instanceof Uint8Array)) {
      response.status(415).end();
      return;
    }
    try {
      const headers = new globalThis.Headers();
      for (const [name, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') headers.set(name, value);
        else if (Array.isArray(value)) headers.set(name, value.join(', '));
      }
      const url = new globalThis.URL(request.originalUrl ?? request.url, 'http://localhost');
      const input = new globalThis.Request(url, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      });
      const result = await handle(input);
      response.status(result.status);
      result.headers.forEach((value, name) => response.setHeader(name, value));
      response.end(new Uint8Array(await result.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  };
}
