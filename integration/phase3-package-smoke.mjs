import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import console from 'node:console';
import http from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';
import { FileOfflineCertificateStorage } from '../packages/node-storage/index.mjs';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../packages/cli/bin/niyantra-commerce.mjs', import.meta.url));
const server = http.createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  if (request.url === '/health') {
    response.end('{"status":"ok"}');
  } else if (request.url?.startsWith('/api/v1/products')) {
    response.end('{"data":[],"total":0}');
  } else {
    response.statusCode = 404;
    response.end('{"error":{"code":"not_found","message":"not found"}}');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const health = await exec(process.execPath, [cli, '--base-url', baseUrl, 'health']);
  assert.deepEqual(JSON.parse(health.stdout), { status: 'ok' });
  const listed = await exec(process.execPath, [cli, '--base-url', baseUrl, 'list', 'products'], {
    env: { ...process.env, NIYANTRA_API_KEY: 'loopback-only' },
  });
  assert.deepEqual(JSON.parse(listed.stdout), { data: [], total: 0 });
  console.log('PASS private CLI health/list on loopback');
} finally {
  server.close();
}

const directory = await mkdtemp(join(tmpdir(), 'niyantra-offline-'));
try {
  const storage = new FileOfflineCertificateStorage(directory);
  await storage.set('../machine/key', { certificate: 'signed', signature: 'sig' });
  assert.deepEqual(await storage.get('../machine/key'), {
    certificate: 'signed',
    signature: 'sig',
  });
  const files = await import('node:fs/promises').then((fs) => fs.readdir(directory));
  assert.equal(files.length, 1);
  if (process.platform !== 'win32')
    assert.equal((await stat(join(directory, files[0]))).mode & 0o777, 0o600);
  assert.equal(
    await readFile(join(directory, files[0]), 'utf8'),
    '{"certificate":"signed","signature":"sig"}',
  );
  await storage.delete('../machine/key');
  assert.equal(await storage.get('../machine/key'), undefined);
  console.log('PASS Node offline storage roundtrip and private file mode');
} finally {
  await rm(directory, { recursive: true, force: true });
}
