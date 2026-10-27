import { CommerceValidationError } from './errors.js';
import type { ProrationPreview } from './models/generated.js';

/** Fields used by Commerce's subscription billing calculation. */
export interface ProrationPlan {
  readonly name: string;
  readonly currency: string;
  readonly price_cents: number;
  readonly seat_based: boolean;
  readonly seat_price_cents: number;
  readonly min_seats: number;
}

export interface ProrationInput {
  readonly currentPlan: ProrationPlan;
  readonly nextPlan: ProrationPlan;
  readonly currentQuantity: number;
  readonly nextQuantity: number;
  readonly periodStart: string | Date | null;
  readonly periodEnd: string | Date | null;
  readonly now?: string | Date;
  readonly behavior?: 'none' | 'create_prorations' | 'always_invoice';
}

function milliseconds(value: string | Date | null | undefined): number | undefined {
  if (value == null) return undefined;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(time)) throw new CommerceValidationError('Invalid proration date');
  return time;
}

function subtotal(plan: ProrationPlan, quantity: number): number {
  for (const value of [plan.price_cents, plan.seat_price_cents, plan.min_seats, quantity])
    if (!Number.isSafeInteger(value) || value < 0)
      throw new CommerceValidationError('Invalid proration amount or quantity');
  const total = plan.seat_based
    ? plan.price_cents + Math.max(quantity, plan.min_seats) * plan.seat_price_cents
    : plan.price_cents;
  if (!Number.isSafeInteger(total)) throw new CommerceValidationError('Unsafe proration subtotal');
  return total;
}

/**
 * Local preview of Commerce's `calculateProration`; the mutation response remains authoritative.
 *
 * @example
 * ```ts
 * const preview = calculateProration({
 *   currentPlan, nextPlan, currentQuantity: 1, nextQuantity: 2,
 *   periodStart: subscription.current_period_start,
 *   periodEnd: subscription.current_period_end,
 * });
 * ```
 */
export function calculateProration(input: ProrationInput): ProrationPreview | undefined {
  const start = milliseconds(input.periodStart);
  const end = milliseconds(input.periodEnd);
  const now = milliseconds(input.now) ?? Date.now();
  const current = subtotal(input.currentPlan, input.currentQuantity);
  const next = subtotal(input.nextPlan, input.nextQuantity);
  if (
    input.behavior === 'none' ||
    start === undefined ||
    end === undefined ||
    end <= start ||
    now >= end
  )
    return undefined;
  const fraction = now < start ? 1 : Math.max(0, Math.min(1, (end - now) / (end - start)));
  if (fraction <= 0) return undefined;
  const value = (next - current) * fraction;
  // Go's math.Round moves half cents away from zero; JavaScript Math.round does not.
  const amount = value < 0 ? -Math.floor(-value + 0.5) : Math.floor(value + 0.5);
  if (!Number.isSafeInteger(amount)) throw new CommerceValidationError('Unsafe proration result');
  if (amount === 0 && input.behavior !== 'always_invoice') return undefined;
  return {
    amount_cents: amount,
    currency: input.nextPlan.currency,
    remaining_fraction: fraction,
    description: `Proration for switching from ${input.currentPlan.name} to ${input.nextPlan.name} with ${(fraction * 100).toFixed(2)}% of the period remaining`,
  };
}
