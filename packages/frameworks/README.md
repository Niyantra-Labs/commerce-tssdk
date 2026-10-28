# Webhook framework adapters

These private adapters call the core `defineWebhookHandler`, which verifies the original request bytes and dispatches typed events. Supply a durable atomic dedupe store for replay protection.

- **Next.js App Router:** `export const POST = createNextWebhookRoute({ secret, handlers, dedupe })` from `@niyantra/commerce-frameworks/next`.
- **Hono:** `app.post('/webhooks/commerce', createHonoWebhookHandler({ secret, handlers, dedupe }))` from `@niyantra/commerce-frameworks/hono`.
- **Express:** mount `express.raw({ type: 'application/json' })` before `createExpressWebhookHandler({ secret, handlers, dedupe })` from `@niyantra/commerce-frameworks/express`. A parsed body returns 415 because reserializing it would break signature verification.

The adapters preserve the core handler's 204/401/405/500 responses. They are not published or included in the core SDK tarball. Framework runner integration remains to be verified before publishing these adapters.
