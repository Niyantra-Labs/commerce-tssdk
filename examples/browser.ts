import { Client } from '@niyantra/commerce';

// Browsers never hold an API key. Your backend mints a short-lived token from
// your identity provider; the SDK asks for a fresh one on every request.
const client = new Client({
  baseUrl: 'https://commerce.example.com',
  auth: {
    bearerToken: async () => {
      const response = await fetch('/session/commerce-token', { credentials: 'include' });
      if (!response.ok) throw new Error('not signed in');
      return response.text();
    },
  },
});

const controller = new AbortController();
document.querySelector('#cancel')?.addEventListener('click', () => controller.abort());

const subscriptions = await client.subscriptions.list({ limit: 10 }, { signal: controller.signal });
console.log(subscriptions.total);
