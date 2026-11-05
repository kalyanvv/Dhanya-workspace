// Diagnostic read-only handshakes. Prints service names, HTTP status and error codes only.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
const root = dirname(fileURLToPath(import.meta.url));
const secrets = parseEnv(readFileSync(join(homedir(), '.dhanya', '.env'), 'utf8'));
const catalog = JSON.parse(readFileSync(join(root, 'mcps', 'servers.json'), 'utf8')).servers;
for (const [name, url] of [
  ['configured-templates', catalog['brevo-templates'].config.url],
  ['documented-templates', 'https://mcp.brevo.com/v1/brevo_transac_templates/mcp'],
  ['generic-templates', 'https://mcp.brevo.com/v1/brevo_templates/mcp'],
]) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secrets.BREVO_MCP_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'dhanya-readonly-probe', version: '1.0.0' } } }),
      signal: AbortSignal.timeout(20000),
    });
    const type = res.headers.get('content-type');
    let code = '';
    if (type?.includes('application/json')) {
      const body = await res.json().catch(() => ({}));
      code = String(body.error?.code ?? (body.result ? 'initialized' : ''));
    } else { await res.body?.cancel(); }
    console.log(`${name}: HTTP ${res.status}, ${code || type || 'no response type'}`);
  } catch (error) { console.log(`${name}: ${error.name}`); }
}
