#!/usr/bin/env node
// Small local-only functional checks after MCP handshake verification.
import { Client } from './codex-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from './codex-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
for (const name of ['postgres-dev', 'playwright', 'chrome-devtools']) {
  const client = new Client({ name: 'dhanya-local-smoke', version: '1.0.0' }, { capabilities: {} });
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, 'codex-mcp.mjs'), name], stderr: 'pipe' });
  try {
    await client.connect(transport);
    let result;
    if (name === 'postgres-dev') {
      result = await client.callTool({ name: 'execute_sql', arguments: { sql: "SELECT current_user AS role, current_setting('default_transaction_read_only') AS read_only" } }, undefined, { timeout: 45000 });
      if (result.isError || !JSON.stringify(result.content).includes('on')) throw new Error('read-only database check failed');
      console.log('postgres-dev: read-only SQL query passed');
    } else if (name === 'playwright') {
      result = await client.callTool({ name: 'browser_navigate', arguments: { url: 'about:blank' } }, undefined, { timeout: 45000 });
      if (result.isError) throw new Error('browser launch failed');
      await client.callTool({ name: 'browser_close', arguments: {} });
      console.log('playwright: headless browser opened and closed');
    } else {
      result = await client.callTool({ name: 'list_pages', arguments: {} }, undefined, { timeout: 45000 });
      if (result.isError) throw new Error('browser debugging failed');
      console.log('chrome-devtools: headless browser page listing passed');
    }
  } catch {
    console.log(`${name}: functional check failed; handshake verification alone is not sufficient`);
    process.exitCode = 1;
  } finally { await client.close().catch(() => {}); await transport.close().catch(() => {}); }
}
