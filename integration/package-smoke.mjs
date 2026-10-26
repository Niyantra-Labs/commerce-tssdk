/**
 * Consumer smoke for the packed tarball: installs it into a fresh project and
 * checks ESM import, CommonJS require (Node 20.19+/22.12+ require(esm)), and a
 * TypeScript consumer under both `nodenext` and `bundler` resolution, using
 * only the published files. Run with `npm run test:package`.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'sdk-package-'));
const run = (command, args, cwd = work) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

try {
  run('npm', ['pack', '--pack-destination', work], root);
  const tarball = readdirSync(work).find((name) => name.endsWith('.tgz'));
  assert.ok(tarball, 'npm pack produced no tarball');
  const listing = run('tar', ['-tzf', tarball]).trim().split('\n');
  const unexpected = listing.filter(
    (path) => !/^package\/(dist\/.+|LICENSE|README\.md|package\.json)$/.test(path),
  );
  assert.deepEqual(unexpected, [], 'tarball contains files outside dist/, LICENSE, README.md');
  console.log(`PASS tarball contents (${listing.length} files)`);

  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'consumer', private: true }));
  run('npm', ['install', '--no-audit', '--no-fund', `./${tarball}`]);
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
const client = new Client({ baseUrl: 'https://commerce.example.com', auth: { apiKey: 'k' } });
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
