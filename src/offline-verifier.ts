import type { OfflineCertificatePayload, OfflineLocalVerifyResult } from './models/contracts.js';
import { CommerceCryptoError, CommerceValidationError } from './errors.js';
import { protectSecretView } from './utils.js';

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importEd25519PublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  let raw: Uint8Array;
  try {
    raw = base64ToBytes(publicKeyBase64);
  } catch (cause) {
    throw new CommerceValidationError('Ed25519 public key must be standard base64', { cause });
  }
  if (raw.byteLength !== 32) {
    throw new CommerceValidationError('Ed25519 public key must decode to exactly 32 raw bytes');
  }
  try {
    return await crypto.subtle.importKey('raw', new Uint8Array(raw), { name: 'Ed25519' }, false, [
      'verify',
    ]);
  } catch (cause) {
    throw new CommerceCryptoError(
      'This runtime does not support Ed25519 verification via Web Crypto',
      { cause },
    );
  }
}

/**
 * Verifies a server-issued offline certificate entirely locally — no network
 * round-trip, so no revocation check (use `client.offlineCertificates.verify`
 * for that). Requires a Commerce server build where certificate issuance
 * signs the certificate's own bytes (fixed alongside this verifier); older
 * servers sign an unrelated payload and certificates they issue will fail
 * signature verification here by design.
 */
export class OfflineVerifier {
  private readonly publicKeyPromise: Promise<CryptoKey>;

  /** @param publicKeyBase64 - The server's raw Ed25519 public key, standard base64 (from `client.system.signingKey()`). */
  constructor(publicKeyBase64: string) {
    if (!publicKeyBase64) {
      throw new CommerceValidationError('OfflineVerifier requires the server signing public key');
    }
    this.publicKeyPromise = importEd25519PublicKey(publicKeyBase64);
  }

  /**
   * @param certificateBase64 - The `certificate` field from an issued `OfflineCertificate`.
   * @param signatureBase64 - The `signature` returned alongside that certificate at issue/reissue time.
   * @param fingerprint - The requesting machine's fingerprint, to check binding.
   */
  async verify(
    certificateBase64: string,
    signatureBase64: string,
    fingerprint: string,
    now: Date = new Date(),
  ): Promise<OfflineLocalVerifyResult> {
    let payloadBytes: Uint8Array;
    try {
      payloadBytes = base64ToBytes(certificateBase64);
    } catch {
      return protectSecretView({
        valid: false,
        inGracePeriod: false,
        errorCode: 'invalid_certificate',
        errorMessage: 'cannot decode certificate',
      });
    }
    let signatureBytes: Uint8Array;
    try {
      signatureBytes = base64ToBytes(signatureBase64);
    } catch {
      return protectSecretView({
        valid: false,
        inGracePeriod: false,
        errorCode: 'invalid_signature',
        errorMessage: 'cannot decode signature',
      });
    }

    const publicKey = await this.publicKeyPromise;
    const signatureValid = await crypto.subtle.verify(
      { name: 'Ed25519' },
      publicKey,
      new Uint8Array(signatureBytes),
      new Uint8Array(payloadBytes),
    );
    if (!signatureValid) {
      return protectSecretView({
        valid: false,
        inGracePeriod: false,
        errorCode: 'invalid_signature',
        errorMessage: 'certificate signature does not match',
      });
    }

    let payload: OfflineCertificatePayload;
    try {
      payload = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes),
      ) as OfflineCertificatePayload;
    } catch {
      throw new CommerceCryptoError('Signed offline certificate payload is not valid JSON');
    }

    if (payload.fingerprint !== fingerprint) {
      return protectSecretView({
        valid: false,
        payload,
        inGracePeriod: false,
        errorCode: 'machine_mismatch',
        errorMessage: 'certificate not valid for this machine',
      });
    }

    const expiresAt = new Date(payload.expires_at);
    const graceExpiresAt = new Date(payload.grace_expires_at);
    if (Number.isNaN(expiresAt.getTime()) || Number.isNaN(graceExpiresAt.getTime())) {
      throw new CommerceCryptoError('Offline certificate has invalid expiry fields');
    }

    if (now.getTime() > graceExpiresAt.getTime()) {
      return protectSecretView({
        valid: false,
        payload,
        inGracePeriod: false,
        errorCode: 'expired',
        errorMessage: 'certificate has expired (past grace period)',
      });
    }

    return protectSecretView({
      valid: true,
      payload,
      inGracePeriod: now.getTime() > expiresAt.getTime(),
    });
  }
}
