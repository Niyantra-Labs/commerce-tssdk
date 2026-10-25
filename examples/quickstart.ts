import { Client } from '@niyantra/commerce';

const client = new Client({
  baseUrl: process.env.COMMERCE_URL ?? 'http://localhost:9094',
  auth: { apiKey: process.env.COMMERCE_API_KEY ?? '' },
});

const licenses = await client.licenses.list({ limit: 25 });
console.log(licenses.data.map((license) => license.id));
