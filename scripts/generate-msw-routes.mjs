import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { format, resolveConfig } from 'prettier';

const manifest = JSON.parse(readFileSync('test/fixtures/routes.json', 'utf8'));
const routes = Object.entries(manifest).map(([key, details]) => {
  const [method, path] = key.split(' ');
  assert.ok(method && path);
  return { key, method, path, envelope: details.envelope, status: details.status ?? 200 };
});
const target = 'packages/msw-mocks/routes.mjs';
const output = await format(
  `// Generated from test/fixtures/routes.json. Run npm run msw:generate.\nexport const routes = ${JSON.stringify(routes)};\n`,
  { ...(await resolveConfig(target)), parser: 'babel' },
);
if (process.argv.includes('--check')) {
  assert.equal(readFileSync(target, 'utf8'), output, `${target} is stale`);
} else {
  writeFileSync(target, output);
}
