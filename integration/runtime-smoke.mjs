/**
 * Runtime compatibility smoke: runs integration/runtime/checks.mjs against the
 * live Compose server in every runtime available on this machine.
 *
 *   node (current)   process.execPath
 *   node 20          docker node:20-alpine, sharing the app container's network
 *   bun / deno       from PATH (deno gets only --allow-net for the server)
 *   browser          headless Chrome (CHROME_PATH or the macOS default), cross-origin
 *   workerd          Miniflare from MINIFLARE_DIR (a directory with miniflare installed)
 *
 * A runtime that is not installed is reported as SKIP; any failing check in an
 * available runtime fails the run. Requires `npm run build` and the Compose stack.
 */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile, spawn } from 'node:child_process';
import console from 'node:console';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { promisify } from 'node:util';
import { Client, generateMachineFingerprint } from '../dist/index.js';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.COMMERCE_TEST_URL ?? 'http://127.0.0.1:19094';
const runId = randomUUID().slice(0, 12);

function withIdentity(headers) {
  return (input, init = {}) => {
    const merged = new globalThis.Headers(init.headers);
    for (const [key, value] of Object.entries(headers)) merged.set(key, value);
    return globalThis.fetch(input, { ...init, headers: merged });
  };
}

const operator = new Client({
  baseUrl,
  auth: { apiKey: 'runtime-smoke-operator' },
  fetch: withIdentity({ 'X-User-ID': 'runtime-smoke', 'X-Roles': 'commerce:admin' }),
});
const anonymous = new Client({ baseUrl, auth: { apiKey: 'none' } });

/** Creates the tenant, credentials, and server-signed material every runtime checks. */
async function bootstrap() {
  const org = await operator.organizations.create({
    name: `Runtime smoke ${runId}`,
    slug: `runtime-${runId}`,
    currency: 'USD',
    timezone: 'UTC',
  });
  const product = await operator.products.create({
    org_id: org.id,
    name: `Runtime product ${runId}`,
    slug: `runtime-product-${runId}`,
    product_type: 'saas',
  });
  const customer = await operator.customers.create({
    org_id: org.id,
    name: `Runtime customer ${runId}`,
    email: `runtime-${runId}@example.test`,
    currency: 'USD',
  });
  const app = await operator.applications.create({
    org_id: org.id,
    product_id: product.id,
    name: `Runtime app ${runId}`,
    environment: 'sandbox',
  });
  const key = await operator.apiKeys.create({
    application_id: app.id,
    name: `Runtime key ${runId}`,
    scopes: ['*'],
    environment: 'sandbox',
  });
  const keyed = new Client({ baseUrl, auth: { apiKey: key.secret_key } });
  const license = await keyed.licenses.create({
    product_id: product.id,
    customer_id: customer.id,
    license_type: 'perpetual',
    max_activations: 5,
    perpetual: true,
  });
  const featureKey = `runtime_calls_${runId}`;
  await keyed.usageMeters.create({
    product_id: product.id,
    feature_key: featureKey,
    name: 'Runtime calls',
    meter_type: 'counter',
    unit_name: 'calls',
    reset_period: 'monthly',
    billing_model: 'postpaid',
  });
  const fingerprintInput = { namespace: 'runtime-smoke', components: { machine: runId } };
  const fingerprint = await generateMachineFingerprint(fingerprintInput);
  const activated = await anonymous.activations.activate({
    license_key: license.license_key,
    fingerprint,
  });
  const issued = await keyed.offlineCertificates.issue({
    license_id: license.id,
    machine_id: activated.machine.id,
  });

  let webhookSecret;
  const delivered = new Promise((resolveDelivery) => {
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        res.end('ok');
        server.close();
        resolveDelivery({ headers: req.headers, body: Buffer.concat(chunks) });
      });
    });
    server.listen(0, '0.0.0.0', async () => {
      const endpoint = await keyed.webhookEndpoints.create({
        org_id: org.id,
        url: `http://host.docker.internal:${server.address().port}/webhook`,
        events: ['webhook.test'],
      });
      webhookSecret = endpoint.secret;
      await keyed.webhookEndpoints.test(endpoint.endpoint.id);
    });
    setTimeout(() => resolveDelivery(undefined), 15000).unref();
  });
  const delivery = await delivered;
  assert.ok(delivery, 'webhook delivery timed out');

  return {
    baseUrl,
    runId,
    apiKey: key.secret_key,
    licenseKey: license.license_key,
    featureKey,
    fingerprint,
    fingerprintInput,
    certificate: issued.certificate.certificate,
    signature: issued.signature,
    webhook: {
      secret: webhookSecret,
      headers: Object.fromEntries(
        Object.entries(delivery.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
      ),
      body: delivery.body.toString('base64'),
    },
  };
}

async function onPath(command) {
  try {
    await execFileAsync(command, ['--version']);
    return true;
  } catch {
    return false;
  }
}

function runProcess(command, args, env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      const line = stdout.trim().split('\n').pop();
      try {
        resolveRun(JSON.parse(line));
      } catch {
        reject(new Error(`${command} exited ${code}: ${stderr || stdout}`));
      }
    });
  });
}

async function runNode20(config) {
  const { stdout } = await execFileAsync('docker', [
    'compose',
    '-f',
    join(root, 'integration/compose.yml'),
    'ps',
    '-q',
    'app',
  ]);
  const container = stdout.trim();
  if (!container) throw new Error('Compose app container is not running');
  const inner = { ...config, baseUrl: 'http://localhost:9094' };
  return runProcess(
    'docker',
    [
      'run',
      '--rm',
      '--network',
      `container:${container}`,
      '-v',
      `${root}:/sdk:ro`,
      '-w',
      '/sdk',
      '-e',
      'RUNTIME_CONFIG',
      'node:20-alpine',
      'node',
      'integration/runtime/run.mjs',
    ],
    { RUNTIME_CONFIG: JSON.stringify(inner) },
  );
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.map': 'application/json',
};

async function runBrowser(config, chromePath) {
  let resolveResults;
  const results = new Promise((r) => (resolveResults = r));
  const server = http.createServer((req, res) => {
    if (req.url === '/config') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(config));
    }
    if (req.url === '/results' && req.method === 'POST') {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        res.end('ok');
        resolveResults(JSON.parse(body));
      });
      return undefined;
    }
    const file = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(root) || !existsSync(file)) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream');
    return res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const profile = mkdtempSync(join(tmpdir(), 'sdk-chrome-'));
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      `--user-data-dir=${profile}`,
      `http://127.0.0.1:${server.address().port}/integration/runtime/browser.html`,
    ],
    { stdio: 'ignore' },
  );
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('browser checks timed out')), 60000).unref(),
  );
  try {
    return await Promise.race([results, timeout]);
  } finally {
    const exited = new Promise((r) => chrome.once('exit', r));
    chrome.kill();
    await exited;
    server.close();
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function runWorkerd(config, miniflareDir) {
  const { Miniflare } = await import(
    pathToFileURL(join(miniflareDir, 'node_modules/miniflare/dist/src/index.js')).href
  );
  const modules = [
    { type: 'ESModule', path: join(root, 'integration/runtime/worker.mjs') },
    { type: 'ESModule', path: join(root, 'integration/runtime/checks.mjs') },
  ];
  const walk = (dir) => {
    for (const name of readdirSyncSafe(dir)) {
      const full = join(dir, name);
      if (name.endsWith('.js')) modules.push({ type: 'ESModule', path: full });
      else if (!name.includes('.')) walk(full);
    }
  };
  walk(join(root, 'dist'));
  const mf = new Miniflare({
    modules,
    modulesRoot: root,
    compatibilityDate: '2025-01-01',
  });
  try {
    const response = await mf.dispatchFetch('http://worker/', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return await response.json();
  } finally {
    await mf.dispose();
  }
}

function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

const chromePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const config = await bootstrap();
console.log(`bootstrapped run ${runId}`);
const runtimes = [
  [
    'node (current)',
    async () =>
      runProcess(process.execPath, ['integration/runtime/run.mjs'], {
        RUNTIME_CONFIG: JSON.stringify(config),
      }),
  ],
  ['node 20', async () => ((await onPath('docker')) ? runNode20(config) : null)],
  [
    'bun',
    async () =>
      (await onPath('bun'))
        ? runProcess('bun', ['integration/runtime/run.mjs'], {
            RUNTIME_CONFIG: JSON.stringify(config),
          })
        : null,
  ],
  [
    'deno',
    async () =>
      (await onPath('deno'))
        ? runProcess(
            'deno',
            [
              'run',
              `--allow-net=${new URL(baseUrl).host}`,
              '--allow-env=RUNTIME_CONFIG',
              'integration/runtime/run.mjs',
            ],
            { RUNTIME_CONFIG: JSON.stringify(config) },
          )
        : null,
  ],
  ['browser', async () => (existsSync(chromePath) ? runBrowser(config, chromePath) : null)],
  [
    'workerd',
    async () => (process.env.MINIFLARE_DIR ? runWorkerd(config, process.env.MINIFLARE_DIR) : null),
  ],
];

let failed = 0;
for (const [label, run] of runtimes) {
  let report;
  try {
    report = await run();
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${label}: could not run (${error.message})`);
    continue;
  }
  if (!report) {
    console.log(`SKIP ${label}: not available on this machine`);
    continue;
  }
  for (const result of report.results) {
    if (!result.ok) failed += 1;
    const note = result.note ? ` (${result.note})` : '';
    console.log(
      `${result.ok ? 'PASS' : 'FAIL'} [${report.runtime}] ${result.name}${note}${result.ok ? '' : `: ${result.error}`}`,
    );
  }
}
process.exitCode = failed ? 1 : 0;
