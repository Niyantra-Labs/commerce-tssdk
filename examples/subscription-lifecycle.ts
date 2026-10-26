import { Client, CommerceApiError } from '@niyantra/commerce';

const client = new Client({
  baseUrl: process.env.COMMERCE_URL ?? 'http://localhost:9094',
  auth: { apiKey: process.env.COMMERCE_API_KEY ?? '' },
});

const customerId = process.env.CUSTOMER_ID ?? '';
const productId = process.env.PRODUCT_ID ?? '';

// Plans start as drafts; only active subscription plans can be sold.
const created = await client.subscriptions.create({
  customer_id: customerId,
  product_id: productId,
  plan_id: process.env.BASIC_PLAN_ID ?? '',
  quantity: 1,
});
const subscription = created.subscription;
if (!subscription) throw new Error('server returned no subscription');

await client.subscriptions.pause(subscription.id, { reason: 'customer request' });
await client.subscriptions.resume(subscription.id, {});

// Upgrades return the new state plus the proration the server computed.
const upgrade = await client.subscriptions.changePlan(subscription.id, {
  plan_id: process.env.PRO_PLAN_ID ?? '',
  proration_behavior: 'create_prorations',
});
if (upgrade.proration) {
  console.log(`prorated ${upgrade.proration.amount_cents} ${upgrade.proration.currency}`);
}

try {
  await client.subscriptions.updateSeats(subscription.id, {
    quantity: 5,
    proration_behavior: 'create_prorations',
  });
} catch (error) {
  // 400 for business-rule failures such as seats outside the plan's range;
  // 409 invalid_transition where the server refuses an action from the current state.
  if (error instanceof CommerceApiError) console.error(error.status, error.code, error.message);
  else throw error;
}

await client.subscriptions.cancel(subscription.id, { at_period_end: true, reason: 'not renewing' });
