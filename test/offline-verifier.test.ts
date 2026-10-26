import { describe, expect, it } from 'vitest';
import { CommerceCryptoError, CommerceValidationError, OfflineVerifier } from '../src/index.js';

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function generateKeyPair() {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const publicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { pair, publicKeyBase64: base64(publicKeyRaw) };
}

function certificatePayload(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-10-25T00:00:00Z');
  const expiresAt = new Date(now.getTime() + 720 * 60 * 60 * 1000);
  const graceExpiresAt = new Date(expiresAt.getTime() + 48 * 60 * 60 * 1000);
  return {
    certificate_id: 'cert_1',
    license_id: 'lic_1',
    license_key: 'LIC-KEY-1',
    machine_id: 'machine_1',
    fingerprint: 'fp_abc123',
    product_id: 'prod_1',
    customer_id: 'cust_1',
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    grace_expires_at: graceExpiresAt.toISOString(),
    ...overrides,
  };
}

async function signPayload(privateKey: CryptoKey, payload: Record<string, unknown>) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, bytes),
  );
  return { certificateBase64: base64(bytes), signatureBase64: base64(signature) };
}

describe('OfflineVerifier', () => {
  it('verifies a certificate signed over its own exact bytes', async () => {
    const { pair, publicKeyBase64 } = await generateKeyPair();
    const payload = certificatePayload();
    const { certificateBase64, signatureBase64 } = await signPayload(pair.privateKey, payload);

    const verifier = new OfflineVerifier(publicKeyBase64);
    const result = await verifier.verify(
      certificateBase64,
      signatureBase64,
      'fp_abc123',
      new Date('2026-10-25T01:00:00Z'),
    );
    expect(result.valid).toBe(true);
    expect(result.inGracePeriod).toBe(false);
    expect(result.payload?.license_id).toBe('lic_1');
  });

  it('rejects a tampered certificate payload', async () => {
    const { pair, publicKeyBase64 } = await generateKeyPair();
    const payload = certificatePayload();
    const { signatureBase64 } = await signPayload(pair.privateKey, payload);
    const tamperedBase64 = base64(
      new TextEncoder().encode(JSON.stringify({ ...payload, fingerprint: 'fp_other' })),
    );

    const verifier = new OfflineVerifier(publicKeyBase64);
    const result = await verifier.verify(tamperedBase64, signatureBase64, 'fp_other');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('invalid_signature');
  });

  it('rejects a certificate signed by a different key', async () => {
    const { publicKeyBase64 } = await generateKeyPair();
    const { pair: otherPair } = await generateKeyPair();
    const payload = certificatePayload();
    const { certificateBase64, signatureBase64 } = await signPayload(otherPair.privateKey, payload);

    const verifier = new OfflineVerifier(publicKeyBase64);
    const result = await verifier.verify(certificateBase64, signatureBase64, 'fp_abc123');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('invalid_signature');
  });

  it('reports a machine fingerprint mismatch after a valid signature check', async () => {
    const { pair, publicKeyBase64 } = await generateKeyPair();
    const payload = certificatePayload();
    const { certificateBase64, signatureBase64 } = await signPayload(pair.privateKey, payload);

    const verifier = new OfflineVerifier(publicKeyBase64);
    const result = await verifier.verify(certificateBase64, signatureBase64, 'fp_wrong');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('machine_mismatch');
  });

  it('reports the grace period and expiry window correctly', async () => {
    const { pair, publicKeyBase64 } = await generateKeyPair();
    const payload = certificatePayload();
    const { certificateBase64, signatureBase64 } = await signPayload(pair.privateKey, payload);
    const verifier = new OfflineVerifier(publicKeyBase64);

    const expiresAt = new Date(payload.expires_at);
    const graceExpiresAt = new Date(payload.grace_expires_at);

    const inGrace = await verifier.verify(
      certificateBase64,
      signatureBase64,
      'fp_abc123',
      new Date(expiresAt.getTime() + 60_000),
    );
    expect(inGrace.valid).toBe(true);
    expect(inGrace.inGracePeriod).toBe(true);

    const expired = await verifier.verify(
      certificateBase64,
      signatureBase64,
      'fp_abc123',
      new Date(graceExpiresAt.getTime() + 60_000),
    );
    expect(expired.valid).toBe(false);
    expect(expired.errorCode).toBe('expired');
  });

  it('throws on a malformed public key and on a non-JSON signed payload', async () => {
    const verifier = new OfflineVerifier('not-base64!!');
    await expect(verifier.verify('', '', '')).rejects.toBeInstanceOf(CommerceValidationError);

    const { pair, publicKeyBase64 } = await generateKeyPair();
    const bytes = new TextEncoder().encode('not json');
    const signature = base64(
      new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, pair.privateKey, bytes)),
    );
    const verifier2 = new OfflineVerifier(publicKeyBase64);
    await expect(verifier2.verify(base64(bytes), signature, 'fp_abc123')).rejects.toBeInstanceOf(
      CommerceCryptoError,
    );
  });

  it('rejects an invalid caller clock before checking expiry', async () => {
    const { pair, publicKeyBase64 } = await generateKeyPair();
    const { certificateBase64, signatureBase64 } = await signPayload(
      pair.privateKey,
      certificatePayload(),
    );
    await expect(
      new OfflineVerifier(publicKeyBase64).verify(
        certificateBase64,
        signatureBase64,
        'fp_abc123',
        new Date(NaN),
      ),
    ).rejects.toThrow('Invalid verification clock');
  });
});
