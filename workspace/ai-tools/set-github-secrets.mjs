#!/usr/bin/env node
// Copies the STAGING secrets from C:\Users\rupen\.dhanya\.env into GitHub Actions secrets
// of the sandbox repo, so the staging deploy workflow can use them.
//
// Run it yourself:   node ai-tools/set-github-secrets.mjs
// It prints only the names it set, never the values.
//
// Production secrets are NOT set here. They go into the Dhanya repo later (story S0.7).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const repo = 'kalyanvv/Dhanya-sandbox';
const env = readFileSync(join(homedir(), '.dhanya', '.env'), 'utf8');
const get = (key) => (env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] ?? '').trim();

// [GitHub secret name, line in the .env file]
const secrets = [
  ['VERCEL_TOKEN', 'VERCEL_TOKEN'],
  ['VERCEL_ORG_ID', 'VERCEL_ORG_ID'],
  ['VERCEL_PROJECT_ID', 'VERCEL_PROJECT_ID_STAGING'],
  ['DATABASE_URL', 'DATABASE_URL_STAGING'],
];

for (const [name, key] of secrets) {
  const value = get(key);
  if (!value) {
    console.log(`${name.padEnd(20)} skipped (${key} is empty)`);
    continue;
  }
  try {
    execFileSync('gh', ['secret', 'set', name, '-R', repo], {
      input: value,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(`${name.padEnd(20)} set`);
  } catch (error) {
    console.log(`${name.padEnd(20)} FAILED: ${String(error.stderr ?? error.message).slice(0, 100)}`);
  }
}

const list = execFileSync('gh', ['secret', 'list', '-R', repo], { encoding: 'utf8' });
console.log(`\nSecrets now in ${repo}: ${list.replace(/\t.*$/gm, '').trim().split('\n').join(', ')}`);
