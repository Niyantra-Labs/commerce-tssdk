import { useQuery } from '@tanstack/react-query';

const clientIds = new WeakMap();
let nextClientId = 1;

function clientId(client) {
  let id = clientIds.get(client);
  if (id === undefined) {
    id = nextClientId++;
    clientIds.set(client, id);
  }
  return id;
}

function query(client, resource, id, load) {
  return {
    queryKey: ['commerce', clientId(client), resource, id],
    enabled: typeof id === 'string' && id.length > 0,
    queryFn: ({ signal }) => {
      if (!id) throw new TypeError(`${resource} ID is required`);
      return load(id, signal);
    },
  };
}

export function licenseQueryOptions(client, id) {
  return query(client, 'license', id, (value, signal) => client.licenses.get(value, { signal }));
}

export function subscriptionQueryOptions(client, id) {
  return query(client, 'subscription', id, (value, signal) =>
    client.subscriptions.get(value, { signal }),
  );
}

export function usageQueryOptions(client, licenseId) {
  return query(client, 'usage', licenseId, (value, signal) =>
    client.licenses.getUsage(value, { signal }),
  );
}

export function useLicense(client, id) {
  return useQuery(licenseQueryOptions(client, id));
}

export function useSubscription(client, id) {
  return useQuery(subscriptionQueryOptions(client, id));
}

export function useUsage(client, licenseId) {
  return useQuery(usageQueryOptions(client, licenseId));
}
