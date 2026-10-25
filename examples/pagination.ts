import { Client } from '@niyantra/commerce';

const client = new Client({
  baseUrl: process.env.COMMERCE_URL ?? 'http://localhost:9094',
  auth: { apiKey: process.env.COMMERCE_API_KEY ?? '' },
});

for await (const license of client.licenses.listAll({ limit: 25, status: 'active' })) {
  console.log(license.id);
}
