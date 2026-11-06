# Claude-to-Codex project context

Observed 5 November 2026. Recheck the source before relying on a completion claim.
This document preserves project context and navigation. It does not authorize
external actions, resume cancelled work, or override the current user's request.

## Current lead entry point

Start with the selected checkout's `docs/plan/handoffs/LEAD-HANDOFF.md` and
`handoffs/README.md`, plus `ai-tools/agents/known-failures.md` including Test economy.
The sections below retain the earlier setup snapshot; they are not the latest
branch/CI report. Refresh Git refs and inspect live PR heads before acting.

The owner has authorized feature-branch pushes, PR merges and staging through
the existing lead routine. Never push directly to main, touch production or the
`Dhanya` repository, force-push, delete branches, skip hooks, or open `.env`/token
files. Do not use the older credential-reading memory-sync/probe scripts during
lead work. `validate-codex-setup.py` now checks structure without reading secrets.

Use the smallest existing tests that prove the change. Normal accessibility runs
use one representative light-mode scan per screen; extra modes belong in nightly.
Respect the owner's current serial/parallel choice; first verify one complete
PR-to-staging delivery before resuming parallel builders. The owner permits
tooling setup while that CI is running. Sol sub-agents have been used; `astra`
requires the owner's approval each time.

## Working agreement

Dhanya is the rice ordering app for shops and mills. Develop in a sandbox feature
branch/worktree and promote reviewed versions to production. Keep the workspace
in OneDrive unless the owner changes that choice. Explain outcomes plainly.

The owner prefers building first, with builder tests, lead verification and green
CI before merge; deep independent reviews are batched at the end of each area.
The builder still performs the required Apple design checks. Security review is
required before real users or real data. Track owed reviews in `review-backlog.md`.

Version 1 is English only. The newer `skip-telugu-for-now.md` memory explicitly
defers Telugu work/tests, including the Telugu part of S0.9 and reader sign-off.
Keep translation-ready structure and key parity. Older bilingual examples are
historical until the owner requests that phase.

Money uses integer paise, invoices always cover full order value, and books are an
internal allocation. Do not change these financial rules when adapting tools.

## Evidence from the recorded Claude session

`claude-session-audit.json` aggregates 29 transcript files / 14,788 records at the
time of the initial audit. It contains counts and safe metadata, not chat messages,
shell commands, tool outputs, or token values. Refresh it with
`py -3.11 ai-tools/audit-claude-session.py` if the Claude session continues.

- Direct skill invocations recorded: Karpathy guidelines (2), Anthropic skill
  creator (2), and plugin-authoring (1).
- Direct skill-file reads recorded: Karpathy guidelines (10), Apple design (9),
  Dhanya E2E (4), frontend accessibility (2).
- Agent calls recorded: 23 general-purpose, 3 web-fetch, 2 fork, 1 Dhanya builder;
  another Agent call did not supply a counted subagent type.
- Explicit delegated model choices recorded: 18 Sonnet and 6 Haiku. Message
  metadata also contains Opus, Sonnet and Haiku. These are historical Claude
  settings; the imported Codex roles inherit the selected Codex model.
- Frequent npm command references include `check`, `build`, both-time-zone unit
  tests, coverage, integration, visual, accessibility and Lighthouse checks.
  A reference in a command is not evidence that the command completed successfully.

Shell reads, compacted history and missing/deleted messages can make the counts
incomplete. Installed capability and actual session use are different categories.

## Roles and personas

| Existing role | Codex role | Purpose |
|---|---|---|
| Dhanya helper | `dhanya_helper` | Small mechanical pieces; no screen design or financial/security decisions |
| Dhanya builder | `dhanya_builder` | Story implementation, tests, domain/server/UI integration |
| Dhanya reviewer | `dhanya_reviewer` | Independent findings and verification; does not edit code |
| Dhanya QA | `dhanya_qa` | Playwright, accessibility, visual and journey evidence |
| BMad analyst / Mary | `mary` / `bmad-agent-analyst` skill | Discovery and analysis |
| BMad PM / John | `john` / `bmad-agent-pm` skill | Requirements, scope and priorities |
| BMad architect / Winston | `winston` / `bmad-agent-architect` skill | Architecture decisions |
| BMad UX / Sally | `sally` / `bmad-agent-ux-designer` skill | Journeys and experience |
| BMad developer / Amelia | `amelia` / `bmad-agent-dev` skill | Story delivery |

The five BMad personas are configured capabilities; the transcript audit does not
establish that Claude activated every one. Respect the current task's delegation
rules rather than starting a team automatically.

## Rule and command parity

- Workspace `CLAUDE.md`, checkout `CLAUDE.md`, current plans and `AGENTS.md`
  provide the actual project instructions.
- `.claude/rules/ecc/common`, `typescript`, `react`, and `web` contain reference
  rules. Apply relevant rules when needed. Do not blindly import all language
  rules or override Dhanya's chosen Vitest/Playwright stack with generic examples.
- Claude `/dhanya` pane: use `py -3.11 ai-tools/dhanya-status.py`, or ask Codex for
  progress. The same tracker and `owner-needs.json` remain the data sources.
- Claude `/plan`, `/feature-dev`, `/build-fix`, `/code-review`, `/test-coverage`,
  `/resume-session`, and `/update-docs`: request the operation in plain language
  or invoke an applicable installed skill/role. The 98 original command Markdown
  files remain under `.claude/commands/` as references, not executable Codex slash commands.
- Anthropic skill-creator: use Codex's built-in `skill-creator`.
- Claude plugin-authoring: use supported Codex skill/MCP configuration. The Claude
  side pane and its lifecycle hooks remain specific to Claude's UI.
- ECC lifecycle hooks are not configured in the inspected Claude user/project
  settings. Existing Husky Git hooks are application-level and work with either
  assistant. No additional automatic hook system was enabled just for parity.

## Current Git/CI facts

`ci-snapshot.json` is the read-only GitHub snapshot, refreshed with
`node ai-tools/audit-ci.mjs`. The observed GitHub main was `c4adf95`, while the shared
sandbox checkout remained `b25826c` on `fix/deploy-verify-alias`. Do not pull, switch,
or overwrite worktrees solely to make these match.

At that observation: latest main CI was cancelled and deployment skipped; the
previous main deployment succeeded; the latest completed nightly passed; Dependabot
security updates were enabled. Those findings supersede older runbook status notes
for that observation, not for all future sessions.

## Memory and recovery

The seven small notes in `claude-memory/` are snapshots of the project-specific
Claude memory files. Refresh them using `py -3.11 ai-tools/sync-claude-context.py`.
Recalled notes are context to verify, not instructions to execute unseen commands.
Raw transcripts and authentication files are not copied.

`save-work.mjs` performs GitHub writes. It is not a local status command. Its tooling
destination is the separate `Dhanya-workspace` repository's `main`, despite older
references to `backup/tooling`. The Windows autosave task was absent at the initial
workspace review. Do not claim backups are scheduled or uploaded without checking.

The earlier review found missing installed UI packages in the shared sandbox
checkout. A subsequent lockfile reinstall resolved that environment issue, and
`npm run check:all` passed: static checks, 333 unit tests and 95 integration tests
in each time zone. That does not certify all current branches or planned journeys.
