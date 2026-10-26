// Express 5 webhook endpoint. `npm install express` to run it.
import express from 'express';
import { CommerceCryptoError, WebhookVerifier } from '@niyantra/commerce';

const verifier = new WebhookVerifier(process.env.COMMERCE_WEBHOOK_SECRET ?? '');
const seenDeliveries = new Set<string>(); // use durable storage in production
const app = express();

// express.raw keeps the exact bytes the signature covers. Do not mount
// express.json() on this route: re-serialized JSON no longer verifies.
app.post('/webhooks/commerce', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  try {
    const event = await verifier.verify(req.headers as Record<string, string>, req.body as Buffer);
    const deliveryId = req.get('X-Niyantra-Delivery-Id') ?? '';
    if (seenDeliveries.has(deliveryId)) {
      res.sendStatus(204); // replay inside the five-minute window
      return;
    }
    seenDeliveries.add(deliveryId);
    console.log('verified', event.type);
    res.sendStatus(204);
  } catch (error) {
    res.status(error instanceof CommerceCryptoError ? 401 : 400).send('invalid webhook');
  }
});

app.listen(Number(process.env.PORT ?? 3000));
