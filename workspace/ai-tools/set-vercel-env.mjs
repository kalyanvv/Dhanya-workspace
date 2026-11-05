#!/usr/bin/env node
// Sets the runtime settings of a Vercel project from C:\Users\rupen\.dhanya\.env.
//
//   node ai-tools/set-vercel-env.mjs staging     (project dhanya-staging)
//   node ai-tools/set-vercel-env.mjs prod        (project dhanya-prod, story S0.7)
//
// Prints only names and results, never values. Re-running replaces existing values.
import { appendFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const target = process.argv[2];
if (!['staging', 'prod'].includes(target)) {
  console.log('Usage: node ai-tools/set-vercel-env.mjs staging|prod');
  process.exit(1);
}

const envPath = join(homedir(), '.dhanya', '.env');
let env = readFileSync(envPath, 'utf8');
const get = (key) => (env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] ?? '').trim();
const token = get('VERCEL_TOKEN');
const teamId = get('VERCEL_ORG_ID');
const projectId = get(target === 'staging' ? 'VERCEL_PROJECT_ID_STAGING' : 'VERCEL_PROJECT_ID_PROD');
const databaseUrl = get(target === 'staging' ? 'DATABASE_URL_STAGING' : 'DATABASE_URL_PROD');

// Signs and encrypts login data. One per environment, generated once and kept only in the .env file.
const secretKey = target === 'staging' ? 'BETTER_AUTH_SECRET_STAGING' : 'BETTER_AUTH_SECRET_PROD';
let authSecret = get(secretKey);
if (!authSecret) {
  authSecret = randomBytes(48).toString('base64url');
  appendFileSync(envPath, `
${secretKey}=${authSecret}
`);
  env = readFileSync(envPath, 'utf8');
  console.log(`${secretKey}: generated and saved in your .env file (not shown)`);
}
const appUrl = target === 'staging' ? 'https://dhanya-staging.vercel.app' : 'https://dhanyamart1.vercel.app';

if (!token || !projectId || !databaseUrl) {
  console.log('Missing VERCEL_TOKEN, project id or database address in the .env file.');
  process.exit(1);
}

// [name, value, type]. "sensitive" values can never be read back from Vercel.
const settings = [
  ['APP_ENV', target === 'staging' ? 'staging' : 'production', 'plain'],
  ['DATABASE_URL', databaseUrl, 'sensitive'],
  ['APP_URL', appUrl, 'plain'],
  ['BETTER_AUTH_SECRET', authSecret, 'sensitive'],
  ['BREVO_API_KEY', get('BREVO_API_KEY'), 'sensitive'],
  ['BREVO_SENDER_EMAIL', get('BREVO_SENDER_EMAIL'), 'plain'],
  ['BREVO_SENDER_NAME', 'Dhanya', 'plain'],
].filter(([, value]) => value !== '');

const query = teamId ? `?teamId=${teamId}&upsert=true` : '?upsert=true';
for (const [key, value, type] of settings) {
  const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env${query}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, type, target: ['production', 'preview'] }),
  });
  const body = await response.json().catch(() => ({}));
  const message = response.ok ? 'set' : `FAILED (${response.status}): ${String(body.error?.message ?? '').slice(0, 120)}`;
  console.log(`${target}: ${key.padEnd(14)} ${type.padEnd(9)} ${message}`);
}
