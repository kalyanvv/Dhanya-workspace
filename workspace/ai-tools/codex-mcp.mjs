#!/usr/bin/env node
// Codex's stdio entry point. Secrets are loaded only in this process and never written to config.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';

const toolsRoot = dirname(fileURLToPath(import.meta.url));
const workspace = dirname(toolsRoot);
const runtime = join(toolsRoot, 'codex-runtime');
const serverName = process.argv[2];
const catalog = JSON.parse(readFileSync(join(toolsRoot, 'mcps', 'servers.json'), 'utf8')).servers;
const source = catalog[serverName];
const publicDocs = serverName === 'openai-docs';
if (!publicDocs && (!source || !source.enabled)) {
  process.stderr.write('Unknown or disabled Dhanya MCP connector.\n');
  process.exit(2);
}
const secretsPath = join(homedir(), '.dhanya', '.env');
const secrets = existsSync(secretsPath) ? parseEnv(readFileSync(secretsPath, 'utf8')) : {};
const secretValues = Object.values(secrets).filter((value) => value.length >= 8).sort((a,b) => b.length-a.length);
function scrub(text) {
  let clean = text;
  for (const value of secretValues) clean = clean.split(value).join('[REDACTED]');
  return clean.replace(/(?:github_pat_|ghp_|xkeysib-|npg_|napi_)[A-Za-z0-9_-]+/g, '[REDACTED]');
}
function getValue(name) { return secrets[name] || process.env[name] || ''; }
function interpolate(value) {
  return String(value).replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_, name, fallback) => {
    const actual = getValue(name) || fallback;
    if (!actual) throw new Error(`Missing credential ${name} in ~/.dhanya/.env`);
    return actual;
  });
}
function packageBin(name) {
  const base = join(runtime, 'node_modules', ...name.split('/'));
  const pkg = JSON.parse(readFileSync(join(base, 'package.json'), 'utf8'));
  const relative = typeof pkg.bin === 'string' ? pkg.bin : Object.values(pkg.bin)[0];
  return join(base, relative);
}

try {
  // Deliberately do not propagate the secrets file into every child. Each connector receives only
  // its own authentication header, or its explicitly requested local database URL.
  const childEnv = { ...process.env, ...source?.config?.env };
  for (const key of Object.keys(secrets)) delete childEnv[key];
  childEnv.NEXT_TELEMETRY_DISABLED = '1';
  childEnv.DO_NOT_TRACK = '1';
  let executable;
  let args;
  const config = source?.config;
  if (publicDocs || config.type === 'http') {
    const url = publicDocs ? 'https://developers.openai.com/mcp' : config.url;
    executable = packageBin('mcp-remote');
    args = [url, '--transport', 'http-only', '--silent'];
    let authorization = config?.headers?.Authorization;
    // These services support API bearer credentials as well as their browser OAuth flow.
    if (serverName === 'Neon' && getValue('NEON_API_KEY')) authorization = `Bearer ${getValue('NEON_API_KEY')}`;
    if (serverName === 'vercel' && getValue('VERCEL_TOKEN')) authorization = `Bearer ${getValue('VERCEL_TOKEN')}`;
    if (authorization) {
      childEnv.DHANYA_MCP_AUTHORIZATION = interpolate(authorization);
      args.push('--header', 'Authorization:${DHANYA_MCP_AUTHORIZATION}');
    }
  } else {
    const npxArgs = config.args ?? [];
    const packageIndex = npxArgs.findIndex((arg) => arg.startsWith('@') || arg.startsWith('chrome-devtools-mcp@') || arg.startsWith('next-devtools-mcp@'));
    if (packageIndex < 0) throw new Error('Unsupported local MCP launcher in servers.json');
    const spec = npxArgs[packageIndex];
    const packageName = spec.slice(0, spec.lastIndexOf('@'));
    executable = packageBin(packageName);
    args = npxArgs.slice(packageIndex + 1).map(interpolate);
    if (serverName === 'playwright' || serverName === 'chrome-devtools') args.push('--headless');
    if (serverName === 'playwright') {
      const outputIndex = args.indexOf('--output-dir');
      if (outputIndex >= 0) args[outputIndex + 1] = join(homedir(), '.dhanya', 'playwright-output');
    }
  }
  const child = spawn(process.execPath, [executable, ...args], {
    cwd: workspace, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  process.stdin.pipe(child.stdin);
  child.stdin.on('error', () => {});
  child.stdout.pipe(process.stdout);
  // Buffer by line so a credential split across stream chunks cannot evade redaction.
  let pending = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    pending += chunk;
    const lines = pending.split('\n');
    pending = lines.pop();
    for (const line of lines) process.stderr.write(`${scrub(line)}\n`);
  });
  child.stderr.on('end', () => { if (pending) process.stderr.write(scrub(pending)); });
  child.on('error', () => { process.stderr.write('MCP process could not start. Run install-codex.mjs again.\n'); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    child.stdin.end();
    // Give the server time to close browser sessions and sockets before a forced stop.
    setTimeout(() => { if (child.exitCode === null) child.kill(); }, 2000).unref();
  };
  process.stdin.on('end', stop);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch (error) {
  process.stderr.write(`${scrub(error.message)}\n`);
  process.exitCode = 1;
}
