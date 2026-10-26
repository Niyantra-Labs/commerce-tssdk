// Entry point for Node, Bun, and Deno: reads RUNTIME_CONFIG, prints JSON results.
/* global console -- available in every target runtime */
import { runChecks } from './checks.mjs';

const deno = globalThis.Deno;
const raw = deno ? deno.env.get('RUNTIME_CONFIG') : globalThis.process.env.RUNTIME_CONFIG;
const name = deno
  ? `deno ${deno.version.deno}`
  : globalThis.Bun
    ? `bun ${globalThis.Bun.version}`
    : `node ${globalThis.process.version}`;
const results = await runChecks(JSON.parse(raw), { name });
console.log(JSON.stringify({ runtime: name, results }));
