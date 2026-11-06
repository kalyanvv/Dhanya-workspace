#!/usr/bin/env node
// Saves ALL Dhanya work to GitHub so nothing is lost when a Claude usage limit hits.
//
//   node ai-tools/save-work.mjs          save everything now
//   node ai-tools/save-work.mjs --quiet  print only problems (used by the scheduled task)
//   node ai-tools/save-work.mjs --workspace-only  update only Dhanya-workspace
//
// 1. Every working folder (the sandbox and every git worktree) gets a snapshot commit of its
//    CURRENT files, including uncommitted and new files, pushed to a backup branch
//    `backup/<branch>` in the same GitHub repo. It never touches the real branch, the index or
//    the files, so it is safe to run while helpers are working.
// 2. Our own tooling (agents, skills, connectors list, progress files, the progress panel mod,
//    AGENTS.md, shared context and small Claude memory notes) is copied onto main in the separate
//    Dhanya-workspace repo. Generated Codex skill projections are rebuilt from their sources.
//
// Secrets: the real .env file is never copied. Every snapshot is scanned for token-looking
// text first, and anything that looks like a secret stops that push.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, appendFileSync, readFileSync, realpathSync, lstatSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname, basename, resolve, sep, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const quiet = process.argv.includes('--quiet');
const workspaceOnly = process.argv.includes('--workspace-only');
const workspace = dirname(dirname(fileURLToPath(import.meta.url)));
const sandbox = join(workspace, 'sandbox');
const home = homedir();
const logFile = join(home, '.dhanya', 'save-work.log');
const backupClone = join(home, 'dhanya-backup');

const problems = [];
const copiedFiles = new Map();

const SECRET_PATTERN =
  'ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|xkeysib-[a-f0-9]{40,}|npg_[A-Za-z0-9]{10,}|napi_[a-z0-9]{40,}|sbp_[a-f0-9]{30,}|sk-(proj|ant)-[A-Za-z0-9_-]{20,}|vcp_[A-Za-z0-9_-]{20,}|Bearer [A-Za-z0-9._-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----';

function log(message) {
  const line = `${new Date().toISOString()} ${message}`;
  try {
    mkdirSync(dirname(logFile), { recursive: true });
    appendFileSync(logFile, `${line}\n`);
  } catch {
    // The log is a convenience only.
  }
  if (!quiet) console.log(message);
}

function git(cwd, args, options = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  }).trim();
}

function tryGit(cwd, args, options = {}) {
  try {
    return git(cwd, args, options);
  } catch {
    return null;
  }
}

function findSecrets(cwd, args) {
  try { return git(cwd, args); }
  catch (error) {
    if (error.status === 1) return null; // git grep: no matches
    throw new Error('Secret scan failed; refusing to push');
  }
}

// ---- 1. snapshot every working folder --------------------------------------------------------
function worktrees() {
  const out = git(sandbox, ['worktree', 'list', '--porcelain']);
  const list = [];
  let current = null;
  for (const line of out.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice(9).trim(), branch: null, detached: false };
      list.push(current);
    } else if (line.startsWith('branch ') && current) {
      current.branch = line.slice(7).trim().replace('refs/heads/', '');
    } else if (line === 'detached' && current) {
      current.detached = true;
    }
  }
  return list.filter((w) => existsSync(w.path));
}

function snapshot(wt) {
  const name = wt.branch ?? `detached-${basename(wt.path)}`;
  const safe = name.replace(/[^A-Za-z0-9._-]/g, '-');
  const ref = `backup/${safe}`;
  const index = join(tmpdir(), `dhanya-save-${process.pid}-${safe}.idx`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    git(wt.path, ['read-tree', 'HEAD'], { env });
    git(wt.path, ['add', '-A'], { env });
    const tree = git(wt.path, ['write-tree'], { env });

    const secrets = findSecrets(wt.path, ['grep', '-I', '-l', '-E', SECRET_PATTERN, tree]);
    if (secrets) {
      const files = secrets.split(/\r?\n/).map((f) => f.replace(/^[0-9a-f]{40}:/, '')).slice(0, 5);
      problems.push(`${name}: NOT saved, it contains text that looks like a secret in ${files.join(', ')}`);
      return;
    }

    // Parent: the previous backup commit, so every snapshot is a plain fast-forward.
    let parent = null;
    const remote = tryGit(wt.path, ['ls-remote', 'origin', `refs/heads/${ref}`]);
    if (remote) {
      parent = remote.split(/\s+/)[0];
      tryGit(wt.path, ['fetch', '-q', 'origin', `refs/heads/${ref}`]);
      const parentTree = tryGit(wt.path, ['rev-parse', `${parent}^{tree}`]);
      if (parentTree === tree) {
        log(`unchanged  ${name}`);
        return;
      }
    }
    if (!parent) {
      // Nothing worth saving if the folder is exactly its last commit and that is already on origin.
      const headTree = git(wt.path, ['rev-parse', 'HEAD^{tree}']);
      const onOrigin = tryGit(wt.path, ['branch', '-r', '--contains', 'HEAD']);
      if (headTree === tree && onOrigin) {
        log(`on GitHub  ${name}`);
        return;
      }
      parent = git(wt.path, ['rev-parse', 'HEAD']);
    }
    const commit = git(
      wt.path,
      ['commit-tree', tree, '-p', parent, '-m', `WIP snapshot of ${name} at ${new Date().toISOString()}\n\nAutomatic backup by ai-tools/save-work.mjs. Not reviewed.`],
      { env: { ...process.env, GIT_AUTHOR_NAME: 'save-work', GIT_AUTHOR_EMAIL: '98587135+kalyanvv@users.noreply.github.com', GIT_COMMITTER_NAME: 'save-work', GIT_COMMITTER_EMAIL: '98587135+kalyanvv@users.noreply.github.com' } },
    );
    git(wt.path, ['push', '-q', 'origin', `${commit}:refs/heads/${ref}`]);
    log(`SAVED      ${name} -> ${ref} (${commit.slice(0, 7)})`);
  } catch (error) {
    problems.push(`${name}: ${String(error.stderr ?? error.message).split('\n')[0].slice(0, 160)}`);
  } finally {
    try {
      rmSync(index, { force: true });
    } catch {
      // Temporary file.
    }
  }
}

// ---- 2. back up our own tooling to the separate workspace repo -------------------------------
function copyTree(from, to, filter) {
  if (!existsSync(from)) return;
  cpSync(from, to, { recursive: true, filter: (source, destination) => {
    if (lstatSync(source).isSymbolicLink() || (filter && !filter(source))) return false;
    if (statSync(source).isFile()) copiedFiles.set(destination, source);
    return true;
  } });
}

function backupTooling() {
  try {
    // Copy only notes already shared in the workspace. Do not invoke memory-sync:
    // it opens the central secrets file, which the owner's lead rules forbid.
    const dest = backupClone;
    if (!existsSync(join(dest, '.git'))) {
      // A separate tooling repository; never the application or production repository.
      mkdirSync(dest, { recursive: true });
      git(dest, ['init', '-q']);
      git(dest, ['remote', 'add', 'origin', 'https://github.com/kalyanvv/Dhanya-workspace.git']);
      if (tryGit(dest, ['fetch', '-q', 'origin', 'main'])) {
        git(dest, ['checkout', '-q', '-B', 'main', 'FETCH_HEAD']);
      } else {
        git(dest, ['checkout', '-q', '--orphan', 'main']);
      }
    }
    const repository = execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
      { cwd: dest, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    if (repository !== 'kalyanvv/Dhanya-workspace') throw new Error('Unexpected workspace backup repository');
    if (git(dest, ['branch', '--show-current']) !== 'main' || git(dest, ['status', '--porcelain'])) {
      throw new Error('Workspace backup clone must be clean on main before refreshing');
    }
    git(dest, ['fetch', '-q', 'origin', 'main']);
    git(dest, ['merge', '--ff-only', 'origin/main']);
    const safeRoot = realpathSync(dest);
    if (safeRoot.toLowerCase() !== resolve(backupClone).toLowerCase()) throw new Error('Backup root must not be a link');
    for (const dir of ['workspace', 'mods', 'bmad-custom']) {
      const target = resolve(dest, dir);
      if (!target.toLowerCase().startsWith((safeRoot + sep).toLowerCase())) throw new Error('Backup target escaped its root');
      if (existsSync(target)) {
        if (!realpathSync(target).toLowerCase().startsWith((safeRoot + sep).toLowerCase())) throw new Error('Backup target is an outside link');
        rmSync(target, { recursive: true, force: true });
      }
    }
    const skip = (path) => {
      if (/(node_modules|[\\/]\.git(?:[\\/]|$)|[\\/]types[\\/]claude-code|\.playwright-mcp|__pycache__|\.(jsonl|log|sqlite|pem|key)$|[\\/](auth|credentials)\.json$|config\.user\.toml$)/i.test(path)) return false;
      if (/\.env$|\.env\./i.test(path)) return /\.env\.example$|secrets\.example\.env$/i.test(path);
      return true;
    };

    // Workspace files.
    mkdirSync(join(dest, 'workspace'), { recursive: true });
    for (const file of ['CLAUDE.md', 'AGENTS.md', '.mcp.json', 'skills-lock.json']) {
      copyTree(join(workspace, file), join(dest, 'workspace', file), skip);
    }
    // Our own tooling only. The big third-party clones are re-cloned from THIRD-PARTY.md.
    const aiTools = join(workspace, 'ai-tools');
    const ours = ['agents', 'skills', 'mcps', 'progress', 'context', 'codex-runtime'];
    for (const dir of ours) copyTree(join(aiTools, dir), join(dest, 'workspace', 'ai-tools', dir), skip);
    mkdirSync(join(dest, 'workspace', 'ai-tools'), { recursive: true });
    for (const entry of readdirSync(aiTools)) {
      const full = join(aiTools, entry);
      if (statSync(full).isFile() && skip(full)) copyTree(full, join(dest, 'workspace', 'ai-tools', entry), skip);
    }
    copyTree(join(aiTools, 'setup-new-pc.mjs'), join(dest, 'setup-new-pc.mjs'), skip);
    // BMad project settings (small); the BMad program itself is reinstalled with its installer.
    copyTree(join(workspace, '_bmad', 'custom'), join(dest, 'bmad-custom'), (p) => skip(p) && !/config\.user\.toml$/.test(p));
    // The progress panel mod.
    const modRoot = join(home, '.claude', 'dev-mods');
    if (existsSync(modRoot)) {
      const mods = readdirSync(modRoot).map(session => join(modRoot, session, 'dhanya-progress'))
        .filter(path => existsSync(path)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
      if (mods[0]) copyTree(mods[0], join(dest, 'mods', 'dhanya-progress'), (p) => skip(p) && !/[\\/]\.claude-plugin[\\/]types/.test(p));
    }
    writeFileSync(
      join(dest, 'THIRD-PARTY.md'),
      [
        '# Third-party tools (not copied here; clone or install them again)',
        '',
        '- ai-tools/ECC: https://github.com/affaan-m/ECC.git (installed with `neon`-style installer: node ai-tools/ECC/scripts/install-apply.js --target claude-project --profile developer --no-hooks)',
        '- ai-tools/apple-design-skill: https://github.com/dickwu/apple-design-skill.git (copied into .claude/skills/apple-design)',
        '- ai-tools/BMAD-METHOD: https://github.com/bmad-code-org/BMAD-METHOD.git (installed with `npx bmad-method install --yes --directory . --modules bmm --tools claude-code`)',
        '- ai-tools/andrej-karpathy-skills: https://github.com/multica-ai/andrej-karpathy-skills.git (skill copied to ai-tools/skills/karpathy-guidelines)',
        '',
        'The code itself lives in kalyanvv/Dhanya-sandbox and kalyanvv/Dhanya. Secrets are NEVER saved here.',
        '',
      ].join('\n'),
    );
    writeFileSync(join(dest, 'README.md'), [
      '# Dhanya workspace kit', '',
      'Current shared tooling and project context. Application source remains in Dhanya-sandbox; credentials and raw sessions are excluded.', '',
      'Latest feature and CI review: [latest-project-review.md](workspace/ai-tools/context/latest-project-review.md).',
      'Agent continuation and skill guide: [CONTINUE-WORK.md](workspace/ai-tools/context/CONTINUE-WORK.md).',
      'Copied source hashes: [WORKSPACE-SNAPSHOT.json](WORKSPACE-SNAPSHOT.json).',
      'Exact third-party revisions: [tool-sources.json](workspace/ai-tools/context/tool-sources.json).', '',
      'On a new PC:', '',
      '    git clone https://github.com/kalyanvv/Dhanya-workspace.git tooling',
      '    node tooling/setup-new-pc.mjs workspace', '',
      'Then follow the remaining setup steps. Third-party source clones are reconstructed separately (THIRD-PARTY.md).', '',
      'To refresh only this repository from the working workspace:', '',
      '    node ai-tools/save-work.mjs --workspace-only', '',
      'This mode does not read .env or push application branches.', '',
    ].join('\n'));

    const fingerprint = path => createHash('sha256').update(readFileSync(path)).digest('hex');
    const manifest = [];
    for (const [destination, source] of copiedFiles) {
      const hash = fingerprint(source);
      if (hash !== fingerprint(destination)) throw new Error(`Source changed during backup: ${relative(workspace, source)}`);
      manifest.push({ path: relative(dest, destination).replaceAll('\\', '/'), sha256: hash });
    }
    writeFileSync(join(dest, 'WORKSPACE-SNAPSHOT.json'), JSON.stringify({ observedAt: new Date().toISOString(), repository, files: manifest.sort((a, b) => a.path.localeCompare(b.path)) }, null, 2) + '\n');
    git(dest, ['add', '-A']);
    const leaked = findSecrets(dest, ['grep', '--cached', '-I', '-l', '-E', SECRET_PATTERN]);
    if (leaked) {
      git(dest, ['reset', '-q']);
      problems.push(`tooling backup: NOT saved, a file looks like it contains a secret (${leaked.split(/\r?\n/)[0]})`);
      return;
    }
    if (git(dest, ['status', '--porcelain']) === '') {
      log('unchanged  tooling backup');
      return;
    }
    git(dest, ['-c', 'user.name=save-work', '-c', 'user.email=98587135+kalyanvv@users.noreply.github.com', 'commit', '-q', '-m', `Tooling snapshot ${new Date().toISOString()}`]);
    for (const [destination, source] of copiedFiles) {
      if (fingerprint(source) !== fingerprint(destination)) throw new Error('Workspace changed before push; backup was not pushed');
    }
    git(dest, ['push', '-q', 'origin', 'HEAD:refs/heads/main']);
    log(`SAVED      Dhanya-workspace/main (${git(dest, ['rev-parse', '--short', 'HEAD'])}); ${manifest.length} source files verified`);
  } catch (error) {
    problems.push(`tooling backup: ${String(error.stderr ?? error.message).split('\n')[0].slice(0, 160)}`);
  }
}

// ---- run -------------------------------------------------------------------------------------
if (!workspaceOnly) {
  try {
    tryGit(sandbox, ['fetch', '-q', 'origin']);
    for (const wt of worktrees()) snapshot(wt);
  } catch (error) {
    problems.push(`worktrees: ${String(error.message).split('\n')[0]}`);
  }
}
backupTooling();

if (problems.length > 0) {
  for (const problem of problems) log(`PROBLEM    ${problem}`);
  console.error(`save-work finished with ${problems.length} problem(s). See ${logFile}`);
  process.exit(1);
}
log(workspaceOnly ? 'Workspace backup finished; application branches were not pushed.' : 'save-work finished: everything is saved.');
