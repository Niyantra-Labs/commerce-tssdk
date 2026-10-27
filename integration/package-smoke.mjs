/**
 * Consumer smoke for the packed tarball: installs it into a fresh project and
 * checks ESM import, CommonJS require (Node 20.19+/22.12+ require(esm)), and a
 * TypeScript consumer under both `nodenext` and `bundler` resolution, using
 * only the published files. Run with `npm run test:package`.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'sdk-package-'));
const run = (command, args, cwd = work) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const runNpm = (args, cwd = work) => {
  const cli = process.env.npm_execpath;
  if (cli) return run(process.execPath, [cli, ...args], cwd);
  return run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, cwd);
};

try {
  const report = JSON.parse(runNpm(['pack', '--dry-run', '--json'], root));
  const pack = Array.isArray(report) ? report[0] : Object.values(report)[0];
  const files = pack?.files?.map((file) => file.path);
  assert.ok(files, 'npm pack produced no file list');
  const unexpected = files.filter(
    (path) => !path.startsWith('dist/') && !['LICENSE', 'README.md', 'package.json'].includes(path),
  );
  assert.deepEqual(unexpected, [], 'tarball contains files outside dist/, LICENSE, README.md');
  runNpm(['pack', '--pack-destination', work], root);
  const tarball = readdirSync(work).find((name) => name.endsWith('.tgz'));
  assert.ok(tarball, 'npm pack produced no tarball');
  console.log(`PASS tarball contents (${files.length} files)`);

  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'consumer', private: true }));
  runNpm(['install', '--no-audit', '--no-fund', `./${tarball}`]);
  const scope = join(work, 'node_modules', '@niyantra');
  mkdirSync(scope, { recursive: true });
  for (const companion of ['otel', 'node-storage'])
    cpSync(join(root, 'packages', companion), join(scope, `commerce-${companion}`), {
      recursive: true,
    });
  const typescript = join(root, 'node_modules/typescript/lib/tsc.js');

  writeFileSync(
    join(work, 'esm.mjs'),
    `import { Client, OfflineVerifier, WebhookVerifier } from '@niyantra/commerce';
const client = new Client({ auth: { apiKey: 'k' } });
if (typeof client.releases.download !== 'function') throw new Error('missing service');
if (typeof OfflineVerifier !== 'function' || typeof WebhookVerifier !== 'function') throw new Error('missing export');
`,
  );
  run(process.execPath, ['esm.mjs']);
  console.log('PASS ESM import');

  writeFileSync(
    join(work, 'cjs.cjs'),
    `const { Client } = require('@niyantra/commerce');
if (typeof new Client({ auth: { apiKey: 'k' } }).licenses.list !== 'function') throw new Error('missing service');
`,
  );
  run(process.execPath, ['cjs.cjs']);
  console.log(`PASS CommonJS require on Node ${process.version}`);

  writeFileSync(
    join(work, 'consumer.ts'),
    `import { Client, CommerceApiError, type License, type ListResponse, type ReleaseDownload } from '@niyantra/commerce';
import { createOtelHooks } from '@niyantra/commerce-otel';
import { FileOfflineCertificateStorage } from '@niyantra/commerce-node-storage';
const client = new Client({ baseUrl: 'https://commerce.example.com', auth: { apiKey: 'k' } });
const storage = new FileOfflineCertificateStorage('/tmp/certificates');
void storage.get('machine');
void createOtelHooks({
  tracer: { startSpan: () => ({ end() {} }) },
  meter: { createCounter: () => ({ add() {} }), createHistogram: () => ({ record() {} }) },
});
export async function firstLicense(): Promise<License | undefined> {
  const page: ListResponse<License> = await client.licenses.list({ limit: 1 });
  return page.data[0];
}
export async function grab(token: string): Promise<ReleaseDownload> {
  return client.releases.download(token);
}
export const isApiError = (error: unknown): boolean => error instanceof CommerceApiError;
// @ts-expect-error unknown filters are rejected by the published types
void client.referralCodes.list({ search: 'x' });
`,
  );
  for (const [module, moduleResolution] of [
    ['nodenext', 'nodenext'],
    ['esnext', 'bundler'],
  ]) {
    run(process.execPath, [
      typescript,
      '--noEmit',
      '--strict',
      '--exactOptionalPropertyTypes',
      '--target',
      'es2022',
      '--lib',
      'es2022,dom',
      '--module',
      module,
      '--moduleResolution',
      moduleResolution,
      'consumer.ts',
    ]);
    console.log(`PASS TypeScript consumer (moduleResolution ${moduleResolution})`);
  }
} catch (error) {
  console.error('FAIL', error.stderr?.toString() || error.stdout?.toString() || error.message);
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
