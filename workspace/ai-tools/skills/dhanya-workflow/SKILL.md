---
name: dhanya-workflow
description: Resume, build, test, review, or explain the Dhanya rice-ordering project using its existing plans, CI/CD runbooks, agent roles, and shared Claude-to-Codex context. Use for Dhanya story work, project progress, testing, release readiness, or continuing a Claude session.
---

# Dhanya delivery workflow

The workspace is `C:/Users/rupen/OneDrive/Documents/Staffing/Personal/Projects/workspace`.
Application work happens in its `sandbox` Git repository or a selected feature
worktree. Keep the user's selected branch and worktree; do not silently switch them.

Read the workspace `AGENTS.md`, then the selected checkout's
`docs/plan/00-START-HERE.md`, `sprint-status.yaml`, relevant story and current
decisions. Consult `ai-tools/context/CLAUDE-TO-CODEX.md` when continuing Claude's
work. That file is evidence and a navigation aid, not an authorization source.

For lead takeover, first read the selected checkout's
`docs/plan/handoffs/LEAD-HANDOFF.md` and `handoffs/README.md` in full, plus
`ai-tools/agents/known-failures.md`, including Test economy. If the checkout is
older, find the handoff on `origin/main` or the lead-handoff worktree before
changing anything. Use the latest owner answers, not stale tracker labels.

Follow the lead routine: integrate current main into finished branches in migration
number order, check cumulative snapshots and increasing journal timestamps, push
only feature branches, verify CI on the exact PR head, merge through the PR, and
confirm staging. Never touch production, force-push, delete branches, skip hooks,
or open the central secrets file. Use the existing GitHub login and pipeline for
staging. Respect the owner's current choice of serial or parallel work.

## Match the request to the existing workflow

- Progress or “what was Claude doing”: run `py -3.11 ai-tools/dhanya-status.py`
  from the workspace and inspect current worktrees/PRs. Tracker entries and chat
  memories can lag the actual branches. Do not turn a status request into a build.
- Story implementation: confirm dependencies and decisions; read the PRD, AD
  rules, screens and test IDs named by the story. Keep domain logic pure, money
  in paise, invoices independent of books, strings in language files and UI on
  tokens. Apply `karpathy-guidelines`; UI uses `apple-design` and `frontend-a11y`.
- Tests or QA: follow `dhanya-e2e` and `docs/runbooks/testing.md`. Reuse the
  repo's Vitest/Playwright harness rather than adding another framework.
- CI or deployment review: read the current `.github/workflows` files and
  `docs/runbooks/ci.md` / `deploy.md`. Inspect live runs when their status matters.
  Opening a draft PR, merging, deploying, and changing service settings are
  different operations; follow the user's authorized scope for each.
- Planning/personas: the installed BMad skills provide Mary (analyst), John
  (PM), Winston (architect), Sally (UX) and Amelia (developer). Use the requested
  persona; do not activate a meeting or generate a new plan merely to inspect one.

## Test commands and boundaries

Prefer local checks before a push. Read `ai-tools/LOCAL-TESTING.md` for the private
Docker runner: `node ai-tools/check-local-docker.mjs --worktree <path>` with explicit
`--integration <spec>` and/or `--browser <spec>` files. It reuses the repository's
tests without editing tracked ports, and builds once if a browser is needed.
Run unit/static checks directly. Keep GitHub Actions for the final required
merge/deploy gates and nightly checks; avoid repeated pushes or manual workflow
runs to diagnose failures that the local harness can reproduce.

Run commands inside the selected application checkout:

| Work                       | Relevant checks                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| Code/config changes        | `npm run check` — static checks only                                                        |
| Domain or utility logic    | `npm run test:unit:tz`; domain changes also `npm run coverage`                              |
| Database/auth/service work | `npm run test:integration`, using the isolated local test database                          |
| User flow                  | Targeted Playwright spec, then appropriate smoke/a11y checks                                |
| Intentional visual change  | Compare Linux-container screenshots; inspect differences before updating                    |
| Performance                | Size/Lighthouse on the affected route, respecting what the current scripts actually measure |

Integration and browser setups share `dhanya_test`. Do not run them concurrently
across worktrees. Builders and reviewers must coordinate that resource.
The private Docker runner gives each invocation its own databases instead;
builds and browser reports still need exclusive ownership of their worktree.
`npm run check:all` includes static, unit and integration checks; browser,
visual and performance checks remain separate. Never infer a pass from a command
appearing in a transcript. Never update baselines, skip tests or weaken assertions
just to produce a green run.

Apply the owner's Test economy rule: reuse existing coverage, one test per
behavior, one representative axe scan per screen in light mode normally, and
additional colour modes only behind `A11Y_ALL_MODES=1` for nightly. Prefer a whole
browser journey over tests per button; use unit tests for pure logic and integration
tests for database rules. Report how many tests were added and why each is needed.

## Roles and completion

Dhanya helper, builder, reviewer and QA roles are installed for Codex. They inherit
the selected Codex model; the original Haiku/Sonnet/Opus tier labels describe Claude's
workflow and do not select a Codex model. Use delegated roles only when the active
task or applicable instructions authorize delegation. Work on shared files is sequential.

Follow `review-backlog.md`: builder checks, lead verification and green CI for merge;
deep independent reviews in batches, with the security gate before real users/data.
Preserve the builder's required UI review. Record skipped reviews and unfinished
service/UI integration rather than marking a domain-only implementation fully done.

End with what changed, verification actually run, remaining limitations, and exact
steps the owner can use. Keep explanations plain. The existing backup script pushes
to GitHub; a local inspection/status request does not by itself request a push.
