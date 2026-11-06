#!/usr/bin/env node
// Bridge from Claude to Codex: runs one Codex task non-interactively in a git worktree, the same way
// Claude runs a subagent. Start it in the background and you are told when it finishes.
//
//   node ai-tools/codex-bridge.mjs run --name s5-8 --worktree C:\Users\rupen\dhanya-wt\s5-8 --prompt-file task.md
//        [--sandbox workspace-write|read-only] [--model <name>] [--timeout-min 90] [--npm-ci]
//   node ai-tools/codex-bridge.mjs list
//   node ai-tools/codex-bridge.mjs status --name s5-8
//   node ai-tools/codex-bridge.mjs result --name s5-8
//
// Safety rules built in (they cannot be switched off here):
//   - the worktree must be under C:\Users\<you>\dhanya-wt and must NOT be on the main branch;
//   - Codex runs inside its own sandbox (workspace-write or read-only), never "full access";
//   - Codex is told never to push, never to touch main, never to read the secrets file;
//   - a prompt that contains something that looks like a token or password is refused;
//   - nothing from ~/.dhanya/.env is passed on: secret-looking environment variables are removed.
// Everything it writes goes to ~/.dhanya/codex-runs/<name>/ (outside git and OneDrive).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync, createWriteStream } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

const home = homedir();
const runsRoot = join(home, '.dhanya', 'codex-runs');
const worktreesRoot = join(home, 'dhanya-wt');

function findCodex() {
  if (process.env.CODEX_BIN && existsSync(process.env.CODEX_BIN)) return process.env.CODEX_BIN;
  const extDir = join(home, '.vscode', 'extensions');
  if (!existsSync(extDir)) return null;
  const found = readdirSync(extDir)
    .filter((d) => d.startsWith('openai.chatgpt-'))
    .map((d) => ({ d, bin: join(extDir, d, 'bin', 'windows-x86_64', 'codex.exe') }))
    .filter((x) => existsSync(x.bin))
    .sort((a, b) => b.d.localeCompare(a.d, undefined, { numeric: true }));
  return found[0]?.bin ?? null;
}

const SECRET_PATTERN = /(ghp_|github_pat_|xkeysib-|npg_|napi_|vcp_|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY|password\s*[:=]\s*\S{6,})/i;
const SECRET_ENV = /(TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|DATABASE_URL|CREDENTIAL)/i;

const PREAMBLE = `You are working for the Dhanya project as a builder, started by Claude through a bridge.
Hard rules, in addition to the repository's CLAUDE.md and AGENTS.md:
- Work ONLY inside the current working directory (a git worktree on a feature branch). Never touch the main branch, never run git push, never delete branches, never rewrite history.
- Never read, print or copy the secrets file C:\\Users\\rupen\\.dhanya\\.env, any .env file with real values, or any token. Never connect to Neon, Vercel or other cloud services.
- First read ai-tools/agents/known-failures.md (in the workspace folder next to the sandbox repository) and sandbox docs/plan/handoffs/README.md, then follow them: plain-language reports, tests first, token-saving rules, English only.
- Do NOT try to commit or run git write commands: the sandbox protects the main repository, so the lead commits your finished files afterwards. Just leave your finished changes in the working folder (new and edited files).
- Windows line endings: write files with LF line endings if you can; the lead normalises them.
- If a check cannot run in your sandbox (browser tests, drizzle-kit generate), say exactly which one in your report so the lead runs it.
- When finished, write docs/plan/handoffs/<story>.md as the handoff README describes and finish with a SHORT plain-language report: what you built, how to check it, test results with real numbers, what you could not verify, owner questions.
`;

function fail(msg) {
  console.error(`codex-bridge: ${msg}`);
  process.exit(2);
}

const [, , command, ...rest] = process.argv;
const { values } = parseArgs({
  args: rest,
  options: {
    name: { type: 'string' },
    worktree: { type: 'string' },
    'prompt-file': { type: 'string' },
    sandbox: { type: 'string', default: 'workspace-write' },
    model: { type: 'string' },
    'timeout-min': { type: 'string', default: '90' },
    'npm-ci': { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

function runDir(name) {
  return join(runsRoot, name);
}

function readStatus(name) {
  const p = join(runDir(name), 'status.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

if (command === 'list') {
  if (!existsSync(runsRoot)) {
    console.log('No Codex runs yet.');
    process.exit(0);
  }
  for (const name of readdirSync(runsRoot)) {
    const s = readStatus(name);
    if (s) console.log(`${name.padEnd(22)} ${String(s.state).padEnd(9)} exit=${s.exitCode ?? '-'} started=${s.started}`);
  }
  process.exit(0);
}

if (command === 'status' || command === 'result') {
  if (!values.name) fail('--name is required');
  const s = readStatus(values.name);
  if (!s) fail(`no run named ${values.name}`);
  if (command === 'status') {
    console.log(JSON.stringify(s, null, 2));
  } else {
    const last = join(runDir(values.name), 'last-message.md');
    console.log(existsSync(last) ? readFileSync(last, 'utf8') : '(no final message yet)');
  }
  process.exit(0);
}

if (command !== 'run') fail('usage: run | list | status | result (see the top of this file)');

// ---- run -------------------------------------------------------------------------------------
if (!values.name || !values.worktree || !values['prompt-file']) fail('run needs --name, --worktree and --prompt-file');
if (!/^[A-Za-z0-9._-]{1,40}$/.test(values.name)) fail('--name may only contain letters, digits, dot, dash, underscore');
if (!['workspace-write', 'read-only'].includes(values.sandbox)) fail('--sandbox must be workspace-write or read-only');

const worktree = resolve(values.worktree);
if (!worktree.toLowerCase().startsWith(worktreesRoot.toLowerCase() + sep)) {
  fail(`the worktree must be inside ${worktreesRoot}`);
}
if (!existsSync(join(worktree, '.git'))) fail('the worktree is not a git checkout');
const branch = spawnSync('git', ['-C', worktree, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
if (!branch || ['main', 'master', 'HEAD'].includes(branch)) fail(`refusing to run on branch "${branch}"; use a feature branch`);

const promptText = readFileSync(resolve(values['prompt-file']), 'utf8');
if (SECRET_PATTERN.test(promptText)) fail('the prompt looks like it contains a token or password; remove it');

const codex = findCodex();
if (!codex) fail('Codex was not found. Install the OpenAI Codex extension in VS Code and sign in, or set CODEX_BIN.');

const existing = readStatus(values.name);
if (existing?.state === 'running') fail(`a run named ${values.name} is still running`);
const dir = runDir(values.name);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'prompt.md'), `${PREAMBLE}\n---\nTASK\n---\n${promptText}`);

if (values['npm-ci']) {
  console.log('Running npm ci in the worktree first (outside the Codex sandbox)...');
  const r = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: worktree, stdio: 'inherit', shell: true });
  if (r.status !== 0) fail('npm ci failed');
}

const env = {};
for (const [k, v] of Object.entries(process.env)) if (!SECRET_ENV.test(k)) env[k] = v;

const args = ['exec', '--cd', worktree, '--sandbox', values.sandbox, '--json', '--output-last-message', join(dir, 'last-message.md')];
if (values.model) args.push('--model', values.model);
args.push('-');

const started = new Date().toISOString();
const status = { name: values.name, state: 'running', started, worktree, branch, sandbox: values.sandbox, model: values.model ?? 'default', codex };
writeFileSync(join(dir, 'status.json'), JSON.stringify(status, null, 2));

const events = createWriteStream(join(dir, 'events.jsonl'));
const child = spawn(codex, args, { cwd: worktree, env, stdio: ['pipe', 'pipe', 'pipe'] });
child.stdin.end(readFileSync(join(dir, 'prompt.md'), 'utf8'));
let usage = null;
let lastText = '';
let buffer = '';
// A small live-progress file (read by the Claude progress panel): what Codex is doing right now.
const progress = { updated: started, steps: 0, files: [], lastAction: 'Starting', recent: [] };
let lastWrite = 0;
const short = (text, n) => String(text).replace(/s+/g, ' ').trim().slice(0, n);
const say = (action) => {
  progress.lastAction = action;
  progress.recent = [...progress.recent, action].slice(-6);
};
function writeProgress(force = false) {
  const now = Date.now();
  if (!force && now - lastWrite < 1500) return;
  lastWrite = now;
  progress.updated = new Date().toISOString();
  try {
    writeFileSync(join(dir, 'progress.json'), JSON.stringify(progress));
  } catch {
    /* progress is only a convenience */
  }
}
function track(e) {
  const item = e.item;
  if (e.type === 'turn.started') say('Thinking');
  if (!item) return;
  if (item.type === 'command_execution' && e.type === 'item.started') {
    progress.steps += 1;
    const cmd = String(item.command ?? '').replace(/^"[^"]*powershell.exe"s+-Commands+/i, '');
    say('Running: ' + short(cmd, 90));
  } else if (item.type === 'file_change' && e.type === 'item.started') {
    for (const c of item.changes ?? []) {
      const p = String(c.path ?? '').replace(/^.*dhanya-wt[\/][^\/]+[\/]/i, '');
      if (p && !progress.files.includes(p)) progress.files.push(p);
    }
    say('Editing: ' + short((item.changes ?? []).map((c) => String(c.path ?? '').split(/[\/]/).pop()).join(', '), 90));
  } else if (item.type === 'agent_message' && e.type === 'item.completed') {
    say('Says: ' + short(item.text ?? '', 110));
  }
}
child.stdout.on('data', (chunk) => {
  events.write(chunk);
  buffer += chunk.toString('utf8');
  let nl;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    try {
      const e = JSON.parse(line);
      track(e);
      writeProgress();
      if (e.usage) usage = e.usage;
      if (e.msg?.usage) usage = e.msg.usage;
      const t = e.item?.text ?? e.msg?.message;
      if (typeof t === 'string' && t) lastText = t;
    } catch {
      /* not JSON, ignore */
    }
  }
});
child.stderr.on('data', (chunk) => appendFileSync(join(dir, 'stderr.log'), chunk));

const timeoutMs = Number(values['timeout-min']) * 60_000;
const timer = setTimeout(() => {
  appendFileSync(join(dir, 'stderr.log'), `\nTimed out after ${values['timeout-min']} minutes; stopping.\n`);
  spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
}, timeoutMs);

child.on('close', (code) => {
  clearTimeout(timer);
  events.end();
  const ended = new Date().toISOString();
  const state = code === 0 ? 'done' : 'failed';
  say(state === 'done' ? 'Finished' : 'Stopped with an error');
  writeProgress(true);
  writeFileSync(join(dir, 'status.json'), JSON.stringify({ ...status, state, exitCode: code, ended, usage }, null, 2));
  const last = join(dir, 'last-message.md');
  if (!existsSync(last) && lastText) writeFileSync(last, lastText);
  const head = existsSync(last) ? readFileSync(last, 'utf8').split('\n').slice(0, 60).join('\n') : '(no final message)';
  const commits = spawnSync('git', ['-C', worktree, 'log', '--oneline', '-8'], { encoding: 'utf8' }).stdout.trim();
  console.log(`\ncodex-bridge: ${values.name} ${state} (exit ${code}) on branch ${branch}`);
  console.log(`Run files: ${dir}`);
  console.log(`Recent commits:\n${commits}`);
  console.log(`\n--- Codex's final message ---\n${head}`);
  process.exit(code === 0 ? 0 : 1);
});
