import { Client, OfflineVerifier } from '@niyantra/commerce';

// Online, once: issue a certificate for this machine and keep it with the
// server's public key. Both are safe to store on the device.
const client = new Client({
  baseUrl: process.env.COMMERCE_URL ?? 'http://localhost:9094',
  auth: { apiKey: process.env.COMMERCE_API_KEY ?? '' },
});
const { public_key: publicKey } = await client.system.signingKey();
const { certificate, signature } = await client.offlineCertificates.issue({
  license_id: process.env.COMMERCE_LICENSE_ID ?? '',
  machine_id: process.env.COMMERCE_MACHINE_ID ?? '',
});

// Offline, at every launch: verify the signature, machine, expiry, and grace
// period locally. Revocation is only known online (offlineCertificates.verify).
const verifier = new OfflineVerifier(publicKey);
const result = await verifier.verify(
  certificate.certificate,
  signature,
  process.env.MACHINE_FINGERPRINT ?? '',
);
if (result.valid) {
  console.log('licensed until', result.payload?.expires_at);
} else {
  console.error('offline license rejected:', result.errorCode);
}
