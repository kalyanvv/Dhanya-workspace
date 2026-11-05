#!/usr/bin/env node
// Read GitHub state using the existing gh login. No workflow triggers, writes, or secret reads.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const repo = 'kalyanvv/Dhanya-sandbox';
const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }));
try {
  const repository = gh(['api', `repos/${repo}`]);
  const main = gh(['api', `repos/${repo}/commits/${repository.default_branch}`]);
  const runs = gh(['run', 'list', '--repo', repo, '--limit', '15', '--json', 'workflowName,headBranch,headSha,status,conclusion,createdAt,url']);
  const nightly = gh(['run', 'list', '--repo', repo, '--workflow', 'nightly.yml', '--limit', '2', '--json', 'headSha,conclusion,status,createdAt,url']);
  const workflows = gh(['api', `repos/${repo}/contents/.github/workflows?ref=${main.sha}`]).map((file) => file.name);
  const prs = gh(['pr', 'list', '--repo', repo, '--state', 'open', '--limit', '15', '--json', 'number,title,headRefName,isDraft,url']);
  let securityUpdates = 'not checked';
  try { securityUpdates = gh(['api', `repos/${repo}/automated-security-fixes`]).enabled; } catch { securityUpdates = 'unavailable'; }
  const report = { observedAt: new Date().toISOString(), repository: repo, defaultBranch: repository.default_branch, defaultBranchSha: main.sha, workflows, runs, nightly, openPullRequests: prs, dependabotSecurityUpdates: securityUpdates, limits: 'Read-only snapshot. A green run applies only to its recorded commit; skipped/cancelled runs do not establish deployment success.' };
  mkdirSync(join(root, 'context'), { recursive: true });
  writeFileSync(join(root, 'context', 'ci-snapshot.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error('GitHub snapshot unavailable. Check gh is installed and authenticated; no settings were changed.');
  process.exitCode = 1;
}
