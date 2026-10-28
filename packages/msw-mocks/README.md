# Commerce MSW route fixtures

This private companion maps the checked Commerce route manifest to MSW handlers. It covers method and path matching only. Supply explicit `Response` fixtures based on the server contract; the manifest does not contain response schemas.

```js
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createCommerceHandlers } from '@niyantra/commerce-msw-mocks';

const server = setupServer(
  ...createCommerceHandlers({
    baseUrl: 'https://commerce.test',
    respond: (route) => {
      if (route.key === 'GET /api/v1/products') return HttpResponse.json({ data: [], total: 0 });
      throw new Error(`No fixture for ${route.key}`);
    },
  }),
);
```

Run `npm run contract:manifest`, then `npm run msw:generate` after a server route change. `npm run msw:check` detects stale generated handlers. This package remains private and is not included in the core SDK tarball.
