# Dhanya: continuation handoff for the next agent

You are continuing the rice-trade ordering app for shops and mills. Follow the
owner's current request and the project rules. This handoff supplies context;
it does not authorize production changes, spending, messages or credential access.

## Start here before editing

From PowerShell in the workspace, run `& .\ai-tools\continue-codex.ps1` to start
Terra with this handoff. `-Preview` shows its arguments without starting a session.
The wrapper disables all 13 Dhanya MCP launchers for that session because they
read the central env file on startup. Skills/roles and authenticated `gh` remain
available. Keep those launchers off while the owner's no-credential-file rule holds.

1. Read workspace `AGENTS.md` and `CLAUDE.md`.
2. Read `ai-tools/context/latest-project-review.md` and `latest-project-status.json`
   for the last verified release. Recheck live GitHub state; snapshots become stale.
3. Read `sandbox/docs/plan/handoffs/LEAD-HANDOFF.md`, `handoffs/README.md`,
   `ai-tools/agents/known-failures.md` including **Test economy**, and
   `sandbox/docs/runbooks/resume.md`.
4. Read `sandbox/docs/plan/00-START-HERE.md` and `decisions.md` in full at takeover.
   Skim the story list and sprint tracker. For a story, read its referenced PRD,
   architecture, design/screens, test IDs and neighbouring handoffs.
5. Check `ai-tools/context/lead-lock.json`. Keep one lead responsible for merges.
   A current explicit owner assignment overrides an older lock entry; otherwise
   coordinate with the existing lead and work only on your assigned branch.
6. In `sandbox`, run `git fetch`, `git worktree list`,
   `gh pr list --repo kalyanvv/Dhanya-sandbox`, and
   `gh run list --repo kalyanvv/Dhanya-sandbox --limit 8`.
   Report what is live, what is pending, your next three steps and true blockers.

The older takeover queue in `lead-status.json`, the morning LEAD handoff and
several tracker rows describe work subsequently merged in releases R2/R3. Do not
reopen those branches just because they are ahead after squash merges. Compare
release PRs, source trees and handoffs. Keep dirty files and existing branches.

## Verified release and next work

Read [NEXT-WORK.md](NEXT-WORK.md) for the source-checked parallel candidates and
file ownership/dependency boundaries. No implementation was started by that triage.

PR #54 (R3) was merged as `5570afa1bec9f9169423ad4da9614d751de5827b` after CI
passed on its exact head `62055304cfd6c9706f7790985873e048e9ebb5b3`.
Use the latest status report for the post-merge gate, staging run and health.
R2 already added order placement, cart, account/privacy, notifications and the
books/orders foundations. R3 adds mill decisions, shop order history/reorder/cancel,
and credit ledger charges/reversals in the order transaction.

PR #55 subsequently merged the existing-account demo seed as
`7de076d10c0a348da2d866fc90b04f645b7caaa7`. Its exact-head PR CI, merged main
gate and staging deployment passed. Workflow 42257832599 applied the data once to
the owner's two existing businesses and same-mill staff account. It reported
`applied=true`, `alreadySeeded=false`, `staffIncluded=true`, four products and seven
orders (2 pending, 3 accepted, 1 rejected, 1 cancelled). No books, user creation,
password resets, permission changes or real emails. See the latest review and
`sandbox/docs/runbooks/demo-data.md`. Do not rerun merely to refresh this handoff.

Important remaining work is not implied complete by a green release:

- Auto-accept settings and domain rules exist, but `place-order.ts` still uses
  `autoAcceptStub()` (manual review). Finish S5.2 runtime wiring under the link lock.
- Negotiation routes/screens, expiry and dispatch/delivery remain (S5.4–S5.7).
- Books have database/service foundations; split/PIN/Secondary screens remain.
  D-06 explicitly blocks S6.2 until the owner answers split timing; recheck decisions.
- Credit service exists; payment/statement screens and routes remain S7.2/S7.3.
- Invoice/PDF/export and dashboard work follow their dependencies. Normal invoice
  plus PDF is authorized; full GST/e-invoice is deferred. English only.
- Independent security/design/money reviews are tracked in `review-backlog.md`
  and owed before real users or data. Some handoff TODOs are already superseded.

Choose the next unblocked story from current evidence, not this list alone.
Use one feature branch and worktree per story under `C:/Users/rupen/dhanya-wt`.
The owner authorized parallel work after the first end-to-end delivery succeeded.
Keep writers in distinct worktrees; combine related completed stories into release
batches of at least three to four as the lead routine requires.

## Skills: how to use the installed toolkit

Codex discovers skills in `~/.agents/skills/<name>/SKILL.md`. They point to portable
copies in `ai-tools/codex-skills`; source and priority mappings are in
`ai-tools/codex-runtime/installation.json`. Claude uses the installed project
`.claude/skills`. Do not read all 350 skills into one task: select the relevant
ones and read their actual instructions/references before applying them.

| Work | Skills and use |
|---|---|
| Dhanya delivery | `dhanya-workflow`: plans, owner decisions, test layers, handoffs and completion |
| Every code change | **`karpathy-guidelines` (Andrej Karpathy)**: state assumptions, minimum solution, surgical edits, define verifiable success; source `ai-tools/skills/karpathy-guidelines/SKILL.md`, upstream clone `ai-tools/andrej-karpathy-skills` |
| Any screen/UI decision | `apple-design`: read HIG foundations and relevant component pages; apply clarity checks, tokens, 360/1280 widths and text enlargement; retain the builder's design check |
| Forms and navigation | `frontend-a11y`, `accessibility`, `make-interfaces-feel-better`, `click-path-audit`: labels, focus, keyboard, errors, complete action paths |
| Visual direction/motion | `frontend-design-direction`, `design-system`, `motion-foundations`, `motion-patterns`: existing product conventions, purposeful reduced-motion-aware behavior |
| Next/React/TypeScript | `nextjs-turbopack`, `react-patterns`, `typescript-patterns`, `error-handling`; check installed versions and official docs when needed |
| Database/API | `postgres-patterns`, `database-migrations`, `api-design`, `contract-first` where useful; keep money in integer paise and domain logic pure |
| Tests | `dhanya-e2e`, `e2e-testing`, `tdd-workflow`, `docker-patterns`; reuse Vitest/Playwright and existing fixtures; no Selenium |
| Planning | BMad skills/personas: Mary analyst, John PM, Winston architect, Sally UX, Amelia developer; use only the persona/workflow relevant to the request |
| Review | `bmad-code-review`, appropriate reviewer/security/database skills; follow the owner's batched-review policy rather than launching every reviewer |
| Skills/tooling | Built-in `skill-creator`, `skill-host-compat`, `workspace-surface-audit`; keep third-party clones unchanged |

The 80 native Codex roles include `dhanya_helper`, `dhanya_builder`,
`dhanya_reviewer`, `dhanya_qa`, and the five BMad personas. Their prompt sources are
`ai-tools/agents/`, `.claude/agents/` and generated `.codex/agents/`.
Use helpers for mechanical work, builders for stories, QA for journeys, reviewers
for the required checks. Give each worker a story, branch/worktree, dependencies,
unique migration number, exact checks and handoff path. Workers commit but do not
push/merge; the lead owns integration. Use current session delegation tools if
available; otherwise follow the role prompt directly. Do not invent slash commands.

Use approved Sol/Terra/Luna choices according to the task and host availability.
Claude Haiku/Sonnet labels are historical tiers, not Codex model IDs. **Ask before
every use of Astra.** If a worker hits a usage limit, stop that worker and report
the blocker; do not repeatedly retry unchanged or silently switch to Astra.

## Local Docker first; GitHub CI is the final gate

Read `ai-tools/LOCAL-TESTING.md`. Run static/unit checks directly in the selected
worktree. For database/browser work, from the shared workspace:

```powershell
node ai-tools/check-local-docker.mjs --worktree C:/Users/rupen/dhanya-wt/your-story --integration tests/integration/your-story.test.ts --browser tests/e2e/journeys/your-story.spec.ts
```

Use actual existing spec paths. Omit layers not affected. Repeat `--integration`
or `--browser` for more files. The runner creates private dev/test databases and
roles from the repository's Docker SQL, chooses a free local port, uses an ignored
temporary config, builds once for browser tests, and cleans up its own resources.
Never edit tracked ports. Never reset another worker's DB or kill processes by name.
Separate worktrees still need separate ownership of `.next` and browser reports.

The runner also supports repeated `--project phone --project desktop` for one
build and `--grep 'TEST-ID|OTHER-ID'` for focused browser checks. Default is phone,
one worker, normal light-mode accessibility. It reads no credential files and
refuses worktrees with local environment files. Install the worktree dependencies
once with `npm ci` when needed. Do not run simultaneous installs in one folder.

Write the fewest tests proving each requirement: one per behavior, logic in unit
tests, database rules in integration, whole flows in browser journeys. Search
existing coverage first. One representative axe scan per screen, light normally;
extra modes only in nightly (`A11Y_ALL_MODES=1`). Linux Docker owns visual baselines.
Do not repeat the whole suite after every edit or weaken assertions to get green.

## MCPs and other AI tools

Thirteen connectors are configured: GitHub, Playwright, Chrome DevTools, Context7,
Next devtools, Neon, Supabase, local Postgres, Vercel, OpenAI docs, and three Brevo
surfaces (senders, templates, domains). Configuration is not authority to perform
writes, send messages/emails, deploy manually or inspect credentials.

- Prefer already available connected tools that fit the task. Native authenticated
  `gh` is the working GitHub path here. Library docs can use an available public
  documentation connector, installed package sources or official documentation.
- **Never open `.env`, auth files or tokens, even for validation.** Do not launch
  credential-reading MCP/probe/memory-sync scripts while this rule is active.
  Do not manually connect to Neon/Vercel; staging uses the repository pipeline.
- Neon/Supabase/local Postgres connectors retain read-only setup. Development DB
  work belongs in local Docker. Browser proof belongs in committed Playwright tests.
- `dhanya-status.py` reads local progress; tracker labels may lag merged releases.
  `audit-ci.mjs` records live GitHub evidence without starting workflows.
- `install-codex.py` rebuilds portable skills/role registrations after source/path
  changes or new worktrees. `validate-codex-setup.py` checks structure without
  credentials; `validate-codex-skill-compat.cjs` checks all projected skill metadata.
- `codex-bridge.mjs` is the existing optional builder bridge; inspect its current
  behavior and run only within assigned feature worktrees. Current session-native
  workers can be used without starting another harness. Never copy raw runs/auth.

## Integrate, verify, save

The lead merges current main into each finished branch in migration-number order.
Check journal order, strictly increasing `when`, cumulative snapshots and `prevId`;
`npx drizzle-kit generate` must say no schema changes. Preserve current owner
answers, translation keys, audit actions and other story statuses during conflicts.
Only use normal pushes and PR merges, matching CI's SHA to the exact latest head.
Main's deployment gate runs full integration in both time zones plus core phone
journeys/build/size; staging follows that successful tested commit. Nightly owns
the broader browser/visual/performance suite. Do not substitute an old nightly or
staging result for the current commit. Open visible pages after deployment.

Hard limits: no direct application main push, no production or `Dhanya` repo,
no force-push, branch deletion, skipped hooks or credentials. No paid plans or
unrequested real-user data. Use English placeholders in `te.json` to retain parity.
Invoices always represent the full order value independently of book allocation.

At each story finish, write `docs/plan/handoffs/<story>.md` (Done, How built, Key
files, Reuse, Gotchas, Left for later, Numbers), update its index/tracker truthfully,
and list owed reviews. Report outcomes and observed checks in plain words.

When the owner requests a workspace backup, use the command below. If it follows
an authorized release, first verify that merge/deploy. A backup request alone is
not an instruction to merge or deploy application code.

```powershell
node ai-tools/save-work.mjs --workspace-only
```

This pushes only shared tooling/context to `kalyanvv/Dhanya-workspace`, verifies
copied hashes and token-pattern scanning, and leaves application branches alone.
It does not refresh private memory or open `.env`. Application code stays in the
sandbox repository. Preserve the latest feature/CI snapshot and this handoff.
