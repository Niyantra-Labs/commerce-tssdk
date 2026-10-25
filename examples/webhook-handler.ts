import { WebhookVerifier } from '@niyantra/commerce';

const verifier = new WebhookVerifier(process.env.COMMERCE_WEBHOOK_SECRET ?? '');

/** Framework-neutral handler: pass the unmodified request body. */
export async function handleWebhook(request: Request): Promise<Response> {
  try {
    const event = await verifier.verify(
      request.headers,
      new Uint8Array(await request.arrayBuffer()),
    );
    // Deduplicate event.id or the X-Niyantra-Delivery-Id header in durable storage.
    console.log(event.type);
    return new Response(null, { status: 204 });
  } catch {
    return new Response('Invalid webhook', { status: 401 });
  }
}
