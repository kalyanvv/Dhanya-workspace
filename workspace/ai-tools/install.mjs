#!/usr/bin/env node
// Copies Dhanya's own AI tools to where Claude Code looks for them.
// Run from anywhere: node ai-tools/install.mjs
//   ai-tools/mcps/servers.json  ->  workspace/.mcp.json (enabled servers only)
//   ai-tools/skills/*           ->  workspace/.claude/skills/*
//   ai-tools/agents/*.md        ->  workspace/.claude/agents/*.md
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = dirname(fileURLToPath(import.meta.url));
const workspace = dirname(tools);

const { servers } = JSON.parse(readFileSync(join(tools, 'mcps', 'servers.json'), 'utf8'));
const mcpServers = {};
for (const [name, server] of Object.entries(servers)) {
  if (server.enabled) mcpServers[name] = server.config;
}
writeFileSync(join(workspace, '.mcp.json'), `${JSON.stringify({ mcpServers }, null, 2)}\n`);
console.log(`MCP connectors on: ${Object.keys(mcpServers).join(', ')}`);

for (const kind of ['skills', 'agents']) {
  const from = join(tools, kind);
  if (!existsSync(from)) continue;
  const to = join(workspace, '.claude', kind);
  mkdirSync(to, { recursive: true });
  for (const item of readdirSync(from)) {
    cpSync(join(from, item), join(to, item), { recursive: true });
    console.log(`Copied ${kind}/${item}`);
  }
}
