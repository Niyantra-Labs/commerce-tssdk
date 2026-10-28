import assert from 'node:assert/strict';
import console from 'node:console';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { once } from 'node:events';
import process from 'node:process';
import { Client } from '../dist/index.js';

const requests = 200;
const server = createServer((request, response) => {
  assert.equal(request.url, '/api/v1/products?limit=1');
  assert.equal(request.headers['x-api-key'], 'sk_loopback_benchmark');
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end('{"data":[],"total":0}');
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert.ok(address && typeof address !== 'string');
const client = new Client({
  baseUrl: `http://127.0.0.1:${address.port}`,
  auth: { apiKey: 'sk_loopback_benchmark' },
});

async function measure(concurrency) {
  let cursor = 0;
  const durations = [];
  const started = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor++ < requests) {
        const before = performance.now();
        const page = await client.products.list({ limit: 1 });
        assert.equal(page.total, 0);
        durations.push(performance.now() - before);
      }
    }),
  );
  durations.sort((a, b) => a - b);
  const elapsedMs = performance.now() - started;
  return {
    concurrency,
    requests,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    requestsPerSecond: Number(((requests * 1000) / elapsedMs).toFixed(2)),
    p50Ms: Number(durations[Math.floor(durations.length * 0.5)].toFixed(2)),
    p95Ms: Number(durations[Math.floor(durations.length * 0.95)].toFixed(2)),
  };
}

try {
  await client.products.list({ limit: 1 });
  const results = [];
  for (const concurrency of [1, 4, 16, 32]) results.push(await measure(concurrency));
  console.log(JSON.stringify({ runtime: process.version, results }, null, 2));
} finally {
  server.close();
  await once(server, 'close');
}
