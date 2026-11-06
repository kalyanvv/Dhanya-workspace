#!/usr/bin/env node
// Rebuilds the Dhanya workspace on a new PC.  Run from an empty folder:
//   git clone https://github.com/kalyanvv/Dhanya-workspace.git tooling
//   node tooling/setup-new-pc.mjs <target-folder>
// It never handles secrets. You create C:\Users\<you>\.dhanya\.env yourself (see secrets.example.env).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] ?? 'workspace');
const run = (cmd, args, cwd) => {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) console.log(`  (step failed or skipped, status ${r.status})`);
};

mkdirSync(join(target, 'ai-tools'), { recursive: true });
cpSync(join(here, 'workspace'), target, { recursive: true });
for (const d of ['api', 'main-project', 'sandbox']) mkdirSync(join(target, d), { recursive: true });
if (existsSync(join(here, 'bmad-custom'))) cpSync(join(here, 'bmad-custom'), join(target, '_bmad', 'custom'), { recursive: true });

if (!existsSync(join(target, 'main-project', '.git'))) run('git', ['clone', 'https://github.com/kalyanvv/Dhanya.git', 'main-project'], target);
if (!existsSync(join(target, 'sandbox', '.git'))) run('git', ['clone', 'https://github.com/kalyanvv/Dhanya-sandbox.git', 'sandbox'], target);
const tools = join(target, 'ai-tools');
for (const [dir, url] of [
  ['ECC', 'https://github.com/affaan-m/ECC.git'],
  ['apple-design-skill', 'https://github.com/dickwu/apple-design-skill.git'],
  ['BMAD-METHOD', 'https://github.com/bmad-code-org/BMAD-METHOD.git'],
  ['andrej-karpathy-skills', 'https://github.com/multica-ai/andrej-karpathy-skills.git'],
]) if (!existsSync(join(tools, dir))) run('git', ['clone', '--depth', '1', url, dir], tools);

run('npm', ['ci'], join(target, 'sandbox'));
console.log(`
Done. Still to do by hand:
 1. Create ~/.dhanya/.env from ai-tools/secrets.example.env and paste your tokens (never commit it).
 2. Install Docker Desktop, then in sandbox: npm run db:up, node scripts/create-app-role.mjs --local, npm run db:migrate.
 3. Reinstall BMad/ECC/apple-design with the commands in THIRD-PARTY.md; install the progress mod from mods/.
 4. For Codex, from workspace: npm ci --prefix ai-tools/codex-runtime, py -3.11 -m pip install PyYAML,
    node ai-tools/install.mjs, py -3.11 ai-tools/install-codex.py, node ai-tools/check-codex-mcps.mjs.
 5. gh auth login (GitHub), then open the workspace folder in VS Code and start a new Claude or Codex session.
`);
