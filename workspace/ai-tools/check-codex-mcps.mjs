#!/usr/bin/env node
// Read-only MCP initialization and tools/list probes. No cloud mutations or secret output.
import { Client } from './codex-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from './codex-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(root, 'mcps', 'servers.json'), 'utf8')).servers;
const names = process.argv.slice(2);
const queue = names.length ? names : [...Object.keys(catalog).filter((name) => catalog[name].enabled), 'openai-docs'];
const results = [];
const secrets = Object.values(parseEnv(readFileSync(join(homedir(), '.dhanya', '.env'), 'utf8'))).filter((v) => v.length >= 8);
const scrub = (value) => secrets.reduce((text, secret) => text.split(secret).join('[REDACTED]'), String(value));
async function check(name) {
  const client = new Client({ name: 'dhanya-connection-check', version: '1.0.0' }, { capabilities: {} });
  const transport = new StdioClientTransport({
    command: process.execPath, args: [join(root, 'codex-mcp.mjs'), name],
    cwd: dirname(root), stderr: 'pipe',
  });
  let timer;
  let stderr = '';
  try {
    const connecting = client.connect(transport);
    transport.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    await Promise.race([connecting, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 90000); })]);
    clearTimeout(timer);
    const tools = await client.listTools({}, { timeout: 45000 });
    const result = { name, status: 'connected', tools: tools.tools.length, toolNames: tools.tools.map((tool) => tool.name), readOnlyTools: tools.tools.filter((tool) => tool.annotations?.readOnlyHint === true).map((tool) => tool.name) };
    results.push(result);
    console.log(`${name}: connected (${result.tools} tools)`);
  } catch (error) {
    clearTimeout(timer);
    // Never report a raw HTTP response, stack trace or auth header.
    const text = `${error.message} ${stderr}`;
    const reason = /401|403|unauthorized|authentication|oauth/i.test(text) ? 'authentication needed or rejected'
      : /timeout/i.test(text) ? 'connection timed out'
      : /Missing credential/.test(text) ? 'credential missing'
      : /Cannot find|ENOENT|not found/i.test(text) ? 'runtime dependency missing'
      : 'connection failed';
    const diagnostic = scrub(error.message).slice(0, 240);
    results.push({ name, status: 'failed', reason, diagnostic });
    console.log(`${name}: ${reason} (${diagnostic})`);
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}
// Browser and package startup are resource-heavy; three concurrent handshakes are enough.
let index = 0;
await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
  while (index < queue.length) await check(queue[index++]);
}));
const reportPath = join(root, 'codex-runtime', 'connection-status.json');
const previous = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')).results : [];
const combined = new Map(previous.map((result) => [result.name, result]));
for (const result of results) combined.set(result.name, result);
const report = { checkedAt: new Date().toISOString(), results: [...combined.values()] };
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Connected: ${results.filter((r) => r.status === 'connected').length}/${results.length}`);
process.exitCode = results.some((r) => r.status !== 'connected') ? 1 : 0;
