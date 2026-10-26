/**
 * Keeps the README endpoint reference in sync with the verified contract.
 * The table is rendered from test/contract-cases.ts (each row is a route the
 * contract suite proves the method calls) and the server route manifest.
 * Regenerate with: UPDATE_DOCS=1 npx vitest run test/docs.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { Client } from '../src/index.js';
import { cases } from './contract-cases.js';

interface RouteInfo {
  envelope: string;
  public?: boolean;
}

const routes = JSON.parse(
  readFileSync(new URL('./fixtures/routes.json', import.meta.url), 'utf8'),
) as Record<string, RouteInfo>;
const readmeUrl = new URL('../README.md', import.meta.url);
const START = '<!-- endpoints:start -->';
const END = '<!-- endpoints:end -->';

const RESPONSE: Record<string, string> = {
  data: 'object',
  list: 'page `{ data, total }`',
  status: 'status',
  direct: 'JSON',
  raw: 'stream',
};

function render(): string {
  const client = new Client({ auth: { apiKey: 'docs' } });
  const proto = Object.getPrototypeOf(client) as object;
  const order = Object.getOwnPropertyNames(proto).filter(
    (name) => Object.getOwnPropertyDescriptor(proto, name)?.get && name !== 'usageApiKey',
  );
  const lines = [
    START,
    '<!-- prettier-ignore-start -->',
    '',
    `Generated from the contract suite (${cases.length} methods). "Public" routes take the license key, signed token, or certificate as the credential; every other route needs an API key (scoped to its organization) or an operator token.`,
    '',
  ];
  for (const service of order) {
    const rows = cases.filter((c) => c.service === service);
    if (rows.length === 0) continue;
    lines.push(`<details><summary><code>client.${service}</code> (${rows.length})</summary>`, '');
    lines.push('| Method | Route | Response | Public |', '| --- | --- | --- | --- |');
    for (const c of rows) {
      const info = routes[c.route];
      const response = c.route === 'GET /health' ? 'status' : RESPONSE[info?.envelope ?? ''];
      const isPublic = c.route === 'GET /health' || info?.public === true;
      lines.push(
        `| \`${c.method}\` | \`${c.route}\` | ${c.raw ? 'stream' : (response ?? 'JSON')} | ${isPublic ? 'yes' : ''} |`,
      );
    }
    lines.push('', '</details>', '');
  }
  lines.push('<!-- prettier-ignore-end -->', END);
  return lines.join('\n');
}

describe('README endpoint reference', () => {
  it('matches the verified contract cases', () => {
    const readme = readFileSync(readmeUrl, 'utf8');
    const start = readme.indexOf(START);
    const end = readme.indexOf(END);
    expect(start, 'README needs the endpoints markers').toBeGreaterThanOrEqual(0);
    const expected = render();
    const current = readme.slice(start, end + END.length);
    if (process.env.UPDATE_DOCS === '1' && current !== expected) {
      writeFileSync(readmeUrl, readme.slice(0, start) + expected + readme.slice(end + END.length));
      return;
    }
    expect(current, 'run UPDATE_DOCS=1 npx vitest run test/docs.test.ts').toBe(expected);
  });
});
