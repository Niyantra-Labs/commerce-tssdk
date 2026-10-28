import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const entries = {
  core: 'Client',
  webhook: 'WebhookVerifier',
  offline: 'OfflineVerifier',
  usage: 'UsageReporter',
  fingerprint: 'generateMachineFingerprint',
  proration: 'calculateProration',
};

const results = {};
for (const [name, symbol] of Object.entries(entries)) {
  const bundle = await build({
    stdin: {
      contents: `import { ${symbol} } from './src/index.ts'; console.log(${symbol});`,
      resolveDir: process.cwd(),
      loader: 'js',
    },
    bundle: true,
    minify: true,
    treeShaking: true,
    format: 'esm',
    platform: 'browser',
    write: false,
  });
  const bytes = bundle.outputFiles[0]?.contents;
  assert.ok(bytes);
  results[name] = { minifiedBytes: bytes.length, gzipBytes: gzipSync(bytes).length };
}
console.log(JSON.stringify(results, null, 2));
