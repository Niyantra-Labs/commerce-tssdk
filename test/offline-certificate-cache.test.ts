import { describe, expect, it } from 'vitest';
import {
  MemoryOfflineCertificateStorage,
  OfflineCertificateCache,
  OfflineVerifier,
} from '../src/index.js';

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

async function fixture() {
  const keys = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const publicKey = base64(new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey)));
  const payload = {
    certificate_id: 'cert_1',
    license_id: 'lic_1',
    license_key: 'ABCD-1234-0000-FFFF-9A9A-B0B0-C1C1-D2D2',
    machine_id: 'm_1',
    fingerprint: 'fingerprint_1',
    product_id: 'p_1',
    customer_id: 'c_1',
    issued_at: '2026-10-25T00:00:00Z',
    expires_at: '2026-10-27T00:00:00Z',
    grace_expires_at: '2026-10-28T00:00:00Z',
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const signature = base64(
    new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, keys.privateKey, bytes)),
  );
  return { publicKey, value: { certificate: base64(bytes), signature } };
}

describe('OfflineCertificateCache', () => {
  const now = new Date('2026-10-26T00:00:00Z');

  it('verifies before storing and on every read', async () => {
    const { publicKey, value } = await fixture();
    const storage = new MemoryOfflineCertificateStorage();
    const cache = new OfflineCertificateCache(new OfflineVerifier(publicKey), storage);
    expect((await cache.put('machine', value, 'fingerprint_1', now)).valid).toBe(true);
    expect((await cache.get('machine', 'fingerprint_1', now))?.valid).toBe(true);
    await storage.set('machine', { ...value, signature: btoa('forged') });
    expect((await cache.get('machine', 'fingerprint_1', now))?.errorCode).toBe('invalid_signature');
  });

  it('does not store invalid values and removes expired entries', async () => {
    const { publicKey, value } = await fixture();
    const storage = new MemoryOfflineCertificateStorage();
    const cache = new OfflineCertificateCache(new OfflineVerifier(publicKey), storage);
    expect((await cache.put('wrong', value, 'other', now)).valid).toBe(false);
    expect(await cache.get('wrong', 'fingerprint_1', now)).toBeUndefined();
    await cache.put('machine', value, 'fingerprint_1', now);
    expect(
      (await cache.get('machine', 'fingerprint_1', new Date('2026-10-29T00:00:00Z')))?.errorCode,
    ).toBe('expired');
    expect(await storage.get('machine')).toBeUndefined();
  });
});
