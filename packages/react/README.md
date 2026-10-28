# Commerce React hooks

This private companion wraps TanStack Query v5. `useLicense`, `useSubscription`, and `useUsage` use the SDK's `AbortSignal` support and disable their query until an ID is supplied. Query keys contain an opaque per-client number, so a shared QueryClient does not reuse cached data from another Commerce client.

```tsx
import { Client } from '@niyantra/commerce';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLicense } from '@niyantra/commerce-react';

const client = new Client({ auth: { bearerToken: () => getShortLivedToken() } });
const queryClient = new QueryClient();

function LicenseView({ id }: { id: string }) {
  const license = useLicense(client, id);
  return <span>{license.data?.status}</span>;
}

// Render LicenseView inside <QueryClientProvider client={queryClient}>.
```

Use short-lived bearer tokens in browsers. Keep API keys on trusted servers. The package is private and not part of the core SDK tarball.
