import type { OfflineLocalVerifyResult } from './models/contracts.js';
import { OfflineVerifier } from './offline-verifier.js';

/** The signed certificate bytes stored by an offline cache. Treat them as sensitive. */
export interface CachedOfflineCertificate {
  readonly certificate: string;
  readonly signature: string;
}

/** Plug in durable or platform-specific storage; the SDK has no storage dependency. */
export interface OfflineCertificateStorage {
  get(key: string): Promise<CachedOfflineCertificate | undefined>;
  set(key: string, value: CachedOfflineCertificate): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Volatile storage for one process. For offline persistence, supply your own storage. */
export class MemoryOfflineCertificateStorage implements OfflineCertificateStorage {
  readonly #entries = new Map<string, CachedOfflineCertificate>();

  get(key: string): Promise<CachedOfflineCertificate | undefined> {
    return Promise.resolve(this.#entries.get(key));
  }

  set(key: string, value: CachedOfflineCertificate): Promise<void> {
    this.#entries.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.#entries.delete(key);
    return Promise.resolve();
  }
}

/**
 * Verifies the Ed25519 signature, fingerprint, and expiry on every read.
 * It never treats storage contents as trusted. A local cache cannot discover
 * server-side revocation; check online when connectivity returns.
 *
 * @example
 * ```ts
 * const cache = new OfflineCertificateCache(
 *   new OfflineVerifier(publicKey),
 *   new MemoryOfflineCertificateStorage(),
 * );
 * await cache.put(machineId, { certificate, signature }, fingerprint);
 * const result = await cache.get(machineId, fingerprint);
 * ```
 */
export class OfflineCertificateCache {
  constructor(
    private readonly verifier: OfflineVerifier,
    private readonly storage: OfflineCertificateStorage,
  ) {}

  async put(
    key: string,
    value: CachedOfflineCertificate,
    fingerprint: string,
    now = new Date(),
  ): Promise<OfflineLocalVerifyResult> {
    const result = await this.verifier.verify(value.certificate, value.signature, fingerprint, now);
    if (result.valid) await this.storage.set(key, value);
    return result;
  }

  async get(
    key: string,
    fingerprint: string,
    now = new Date(),
  ): Promise<OfflineLocalVerifyResult | undefined> {
    const value = await this.storage.get(key);
    if (!value) return undefined;
    const result = await this.verifier.verify(value.certificate, value.signature, fingerprint, now);
    if (!result.valid && result.errorCode === 'expired') await this.storage.delete(key);
    return result;
  }

  delete(key: string): Promise<void> {
    return this.storage.delete(key);
  }
}
