import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { TextDecoder } from 'node:util';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const options = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  minify: true,
  treeShaking: true,
  write: false,
};

async function bundle(input) {
  const result = await build({
    ...options,
    stdin: { contents: input, resolveDir: process.cwd(), loader: 'js' },
  });
  const bytes = result.outputFiles[0]?.contents;
  assert.ok(bytes, 'esbuild produced no output');
  return { text: new TextDecoder().decode(bytes), gzipBytes: gzipSync(bytes).length };
}

const full = await bundle("export * from './src/index.ts';");
assert.ok(full.gzipBytes < 25 * 1024, `Full bundle exceeds 25 KiB: ${full.gzipBytes} bytes`);

const plan = await bundle(
  "import { PlanService } from './src/index.ts'; console.log(PlanService);",
);
assert.match(plan.text, /\/plans/);
for (const unrelatedRoute of ['/payment-methods', '/gateway-configs', '/webhook-endpoints']) {
  assert.ok(!plan.text.includes(unrelatedRoute), `Plan-only bundle contains ${unrelatedRoute}`);
}
assert.ok(plan.gzipBytes < full.gzipBytes / 3, 'Plan-only bundle is unexpectedly large');

console.log(
  `Full SDK: ${full.gzipBytes} gzip bytes; PlanService only: ${plan.gzipBytes} gzip bytes`,
);
