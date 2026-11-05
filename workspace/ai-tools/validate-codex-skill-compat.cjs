#!/usr/bin/env node
// Apply ECC's actual host-compat rules to every projected skill, including directory links.
const fs = require('node:fs');
const path = require('node:path');
const { ALLOWED_CODEX_FRONTMATTER_KEYS, CLAUDE_SUBSTITUTION_PATTERNS, findExecutableFences } = require('./ECC/scripts/ci/validate-skill-host-compat.js');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'codex-runtime', 'installation.json'), 'utf8'));
const root = manifest.skill_projection_root;
const problems = [];
let count = 0;
for (const name of fs.readdirSync(root)) {
  const entry = path.join(root, name, 'SKILL.md');
  if (!fs.existsSync(entry)) continue;
  const text = fs.readFileSync(entry, 'utf8');
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) { problems.push(`${name}: missing metadata`); continue; }
  const keys = [...match[1].matchAll(/^([A-Za-z_-]+):/gm)].map((item) => item[1]);
  for (const key of keys) if (!ALLOWED_CODEX_FRONTMATTER_KEYS.has(key)) problems.push(`${name}: unsupported ${key}`);
  for (const fence of findExecutableFences(text.slice(match[0].length))) {
    for (const item of CLAUDE_SUBSTITUTION_PATTERNS) {
      item.regex.lastIndex = 0;
      if (item.regex.test(fence.content)) problems.push(`${name}: executable Claude substitution ${item.token}`);
    }
  }
  count += 1;
}
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
console.log(`Codex host compatibility: ${count} skills, ${problems.length} errors`);
