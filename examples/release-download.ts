import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { Client } from '@niyantra/commerce';

// Installed software can download an update with only its license key.
const client = new Client({
  baseUrl: process.env.COMMERCE_URL ?? 'http://localhost:9094',
  auth: { apiKey: 'unused-for-public-routes' },
});

const grant = await client.releases.authorizeDownload({
  license_key: process.env.COMMERCE_LICENSE_KEY ?? '',
  artifact_id: process.env.COMMERCE_ARTIFACT_ID ?? '',
});
const token = new URL(grant.url).pathname.split('/').pop() ?? '';
const download = await client.releases.download(token);
if (!download.body) throw new Error('empty download');

// Stream to disk while hashing; the SDK never buffers the artifact.
const hash = createHash('sha256');
const tee = new Transform({
  transform(chunk: Buffer, _encoding, done) {
    hash.update(chunk);
    done(null, chunk);
  },
});
await pipeline(
  Readable.fromWeb(download.body as unknown as NodeReadableStream<Uint8Array>),
  tee,
  createWriteStream(download.filename ?? grant.artifact.filename),
);
if (hash.digest('hex') !== grant.artifact.checksum_sha256) {
  throw new Error('checksum mismatch: discard the file');
}
