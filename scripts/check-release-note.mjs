import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const base = process.argv[2];
if (!base || !/^[0-9a-f]{40}$/.test(base)) {
  throw new Error('Pass the pull request base commit SHA');
}

const previous = JSON.parse(execFileSync('git', ['show', `${base}:package.json`], { encoding: 'utf8' }));
const current = JSON.parse(readFileSync('package.json', 'utf8'));

if (previous.version !== current.version) {
  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  if (!changelog.includes(`## [${current.version}]`)) {
    throw new Error(`The ${current.version} release needs a versioned CHANGELOG.md section`);
  }
  console.log(`Release ${current.version} has a versioned changelog section`);
} else {
  const cli = fileURLToPath(new URL('../node_modules/@changesets/cli/bin.js', import.meta.url));
  execFileSync(process.execPath, [cli, 'status', `--since=${base}`], { stdio: 'inherit' });
}
