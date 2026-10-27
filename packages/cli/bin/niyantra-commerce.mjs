#!/usr/bin/env node
import process from 'node:process';

const help = `Usage: niyantra-commerce [--base-url URL] <health|list|get> [namespace] [id]

Set NIYANTRA_API_KEY or NIYANTRA_BEARER_TOKEN for list/get.
Examples:
  niyantra-commerce --base-url http://127.0.0.1:19094 health
  niyantra-commerce list products
  niyantra-commerce get licenses LICENSE_ID`;

const listable = new Set([
  'organizations',
  'products',
  'plans',
  'customers',
  'licenses',
  'machines',
  'subscriptions',
  'orders',
  'payments',
  'invoices',
  'webhookEndpoints',
]);

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    process.stdout.write(`${help}\n`);
    return;
  }
  let baseUrl = process.env.NIYANTRA_BASE_URL;
  const option = args.indexOf('--base-url');
  if (option >= 0) {
    baseUrl = args[option + 1];
    if (!baseUrl) throw new Error('--base-url needs a URL');
    args.splice(option, 2);
  }
  const [command, namespace, id] = args;
  if (
    !['health', 'list', 'get'].includes(command) ||
    (command !== 'health' && !listable.has(namespace))
  )
    throw new Error(help);
  const apiKey = process.env.NIYANTRA_API_KEY;
  const bearerToken = process.env.NIYANTRA_BEARER_TOKEN;
  if (apiKey && bearerToken) throw new Error('Set only one credential variable');
  if (command !== 'health' && !apiKey && !bearerToken)
    throw new Error('Set NIYANTRA_API_KEY or NIYANTRA_BEARER_TOKEN');
  // The relative fallback lets maintainers run this private package before publishing.
  let sdk;
  try {
    sdk = await import('@niyantra/commerce');
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    sdk = await import('../../../dist/index.js');
  }
  const client = new sdk.Client({
    ...(baseUrl ? { baseUrl } : {}),
    auth: apiKey ? { apiKey } : { bearerToken: bearerToken ?? 'public-health' },
  });
  let result;
  if (command === 'health') result = await client.system.health();
  if (command === 'list') result = await client[namespace].list({ limit: 25 });
  if (command === 'get') {
    if (!id) throw new Error('get needs an ID');
    result = await client[namespace].get(id);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Command failed'}\n`);
  process.exitCode = 1;
});
