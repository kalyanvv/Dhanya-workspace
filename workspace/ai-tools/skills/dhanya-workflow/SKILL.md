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

Run commands inside the selected application checkout:

| Work | Relevant checks |
|---|---|
| Code/config changes | `npm run check` — static checks only |
| Domain or utility logic | `npm run test:unit:tz`; domain changes also `npm run coverage` |
| Database/auth/service work | `npm run test:integration`, using the isolated local test database |
| User flow | Targeted Playwright spec, then appropriate smoke/a11y checks |
| Intentional visual change | Compare Linux-container screenshots; inspect differences before updating |
| Performance | Size/Lighthouse on the affected route, respecting what the current scripts actually measure |

Integration and browser setups share `dhanya_test`. Do not run them concurrently
across worktrees. Builders and reviewers must coordinate that resource.
`npm run check:all` includes static, unit and integration checks; browser,
visual and performance checks remain separate. Never infer a pass from a command
appearing in a transcript. Never update baselines, skip tests or weaken assertions
just to produce a green run.

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
