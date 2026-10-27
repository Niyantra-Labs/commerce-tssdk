import { CommerceValidationError } from './errors.js';

/** Stable caller-selected machine attributes. Commerce treats the digest as an opaque string. */
export interface FingerprintInput {
  /** Application-specific domain; prevents identical inputs in different apps from sharing a digest. */
  namespace: string;
  /** Stable, non-secret attributes selected by the application. No hardware probing occurs. */
  components: Readonly<Record<string, string>>;
}

/**
 * SHA-256 of a versioned, sorted UTF-8 representation of caller-selected attributes.
 *
 * @example
 * ```ts
 * const fingerprint = await generateMachineFingerprint({
 *   namespace: 'desktop-app',
 *   components: { installation: stableInstallationId },
 * });
 * ```
 */
export async function generateMachineFingerprint(input: FingerprintInput): Promise<string> {
  if (!input.namespace || Object.keys(input.components).length === 0)
    throw new CommerceValidationError('Fingerprint namespace and components are required');
  const entries = Object.entries(input.components)
    .map(([key, value]) => {
      if (!key || typeof value !== 'string' || !value)
        throw new CommerceValidationError('Fingerprint components must be non-empty strings');
      return [key.normalize('NFC'), value.normalize('NFC')] as const;
    })
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  const canonical = JSON.stringify([
    'niyantra-machine-v1',
    input.namespace.normalize('NFC'),
    entries,
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
