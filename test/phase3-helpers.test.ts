import { describe, expect, it } from 'vitest';
import {
  calculateProration,
  CommerceValidationError,
  generateMachineFingerprint,
  LocalOfflineCertificateStorage,
  settleBatch,
} from '../src/index.js';

describe('phase 3 helpers', () => {
  it('settles a batch in input order with a concurrency bound', async () => {
    let active = 0;
    let peak = 0;
    const results = await settleBatch(
      [1, 2, 3, 4, 5],
      async (number) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, number % 2 ? 2 : 1));
        active--;
        if (number === 3) throw new Error('item failed');
        return number * 2;
      },
      { concurrency: 2 },
    );
    expect(peak).toBe(2);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
    ]);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 2 });
    await expect(settleBatch([], async () => 1, { concurrency: 0 })).rejects.toBeInstanceOf(
      CommerceValidationError,
    );
  });

  it('hashes sorted normalized machine inputs without probing the platform', async () => {
    const first = await generateMachineFingerprint({
      namespace: 'app',
      components: { device: 'machine-1', region: 'east' },
    });
    const reordered = await generateMachineFingerprint({
      namespace: 'app',
      components: { region: 'east', device: 'machine-1' },
    });
    const changed = await generateMachineFingerprint({
      namespace: 'other-app',
      components: { region: 'east', device: 'machine-1' },
    });
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
    await expect(
      generateMachineFingerprint({ namespace: '', components: {} }),
    ).rejects.toBeInstanceOf(CommerceValidationError);
  });

  it('mirrors Go proration, including negative half-cent rounding', () => {
    const current = {
      name: 'Current',
      currency: 'USD',
      price_cents: 1,
      seat_based: false,
      seat_price_cents: 0,
      min_seats: 1,
    };
    const next = { ...current, name: 'Next', price_cents: 0 };
    const input = {
      currentPlan: current,
      nextPlan: next,
      currentQuantity: 1,
      nextQuantity: 1,
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-01-03T00:00:00Z',
      now: '2026-01-02T00:00:00Z',
    };
    expect(calculateProration(input)).toMatchObject({
      amount_cents: -1,
      remaining_fraction: 0.5,
      currency: 'USD',
    });
    expect(calculateProration({ ...input, behavior: 'none' })).toBeUndefined();
    expect(calculateProration({ ...input, now: '2026-01-04T00:00:00Z' })).toBeUndefined();
    expect(() => calculateProration({ ...input, now: 'bad-date' })).toThrow(
      CommerceValidationError,
    );
  });

  it('treats malformed browser storage as absent', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    } as Storage;
    const cache = new LocalOfflineCertificateStorage(storage);
    await cache.set('machine', { certificate: 'signed', signature: 'sig' });
    await expect(cache.get('machine')).resolves.toEqual({
      certificate: 'signed',
      signature: 'sig',
    });
    values.set('niyantra:offline:machine', 'not-json');
    await expect(cache.get('machine')).resolves.toBeUndefined();
    await cache.delete('machine');
    await expect(cache.get('machine')).resolves.toBeUndefined();
  });
});
