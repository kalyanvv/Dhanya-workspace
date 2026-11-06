# Starting a new Codex session on Dhanya (pick up where Claude left off)

Plain steps. Nothing secret is in this file.

## 1. Open the right folder
Open VS Code on `C:\Users\rupen\OneDrive\Documents\Staffing\Personal\Projects\workspace` (not a worktree). Start a **new** Codex conversation (old ones keep an old tool list). Codex already reads `AGENTS.md` / `CLAUDE.md` there and has the Dhanya tools (GitHub, Playwright, docs and more; see `CODEX-SETUP.md`).

## 2. Paste this as the first message

> You are taking over as lead for the Dhanya project (a rice-trade ordering web app for shopkeepers and rice mills). Claude was the lead until its usage limit ran out. Do this, in order, and do not start building until step 4:
> 1. Read, in full: `workspace/CLAUDE.md`, `workspace/sandbox/docs/plan/handoffs/LEAD-HANDOFF.md` (the rules, the routine, the merge-order rule, the state of every branch), `workspace/sandbox/docs/plan/handoffs/README.md` (code map and handoff rule), `workspace/ai-tools/agents/known-failures.md`, `workspace/sandbox/docs/runbooks/resume.md`, `workspace/sandbox/docs/plan/00-START-HERE.md` and `docs/plan/decisions.md` (owner decisions). Skim `docs/plan/07-epics-and-stories.md` for the story list and `docs/plan/sprint-status.yaml` for status.
> 2. Find out where things stand now (the handoff goes stale): in `workspace/sandbox` run `git fetch`, `gh pr list --repo kalyanvv/Dhanya-sandbox`, `git worktree list`, and `gh run list --repo kalyanvv/Dhanya-sandbox --limit 8`. For every worktree under `C:\Users\rupen\dhanya-wt` that is ahead of `origin/main` and not yet a PR, look at `git log --oneline origin/main..HEAD` and its `docs/plan/handoffs/<story>.md`.
> 3. Tell me in plain words (no jargon, short): what is merged and live on staging, what is open or built-but-unpushed, what the next three steps are, and anything you need from me.
> 4. Then continue the routine in LEAD-HANDOFF.md: merge main into each finished branch in migration-number order, push, open the PR, read the CI result for the latest commit, merge, confirm the staging deploy is green. Then start the next stories listed there, one worktree and one branch each.
> Hard rules: never push to `main` directly, never touch production or the `Dhanya` repo, never read or print the secrets file `C:\Users\rupen\.dhanya\.env` or any token, never force-push or delete branches, never use `--no-verify`, English only, plain-language reports, ask me before using the Codex model named astra. If something is blocked, stop and tell me what you were trying to do and why.

## 2b. Who is lead right now
Read `ai-tools/context/lead-lock.json` first. If it says `claude` and it is recent, act only as a worker on the branch the owner gives you (do not merge PRs or change shared state). Also read `ai-tools/context/lead-status.json` (Codex's own last snapshot) and `ai-tools/LOCAL-TESTING.md` (the private-database test runner `node ai-tools/check-local-docker.mjs ...`: use it instead of editing ports).

## 3. What Codex needs to know that is not obvious (the short list)
- **Merge database changes in number order.** Staging skips an older migration that arrives after a newer one. After merging main into a branch, fix the migration journal and snapshots (see LEAD-HANDOFF.md) and run `npx drizzle-kit generate` (it must say "No schema changes"; check `git status` after it).
- **The shared test database on port 5433** is disturbed when several builders run tests at once. CI is the real proof; run only your own test files locally.
- **The secret scanner** flags fake-looking tokens in tests; build such strings at run time.
- **Read the CI result for the latest commit** before merging (compare the run's head SHA to the PR's head SHA). Never merge on a cancelled or stale run.
- **Every story needs a handoff file** `docs/plan/handoffs/<story>.md` and a row in that folder's `README.md`.
- **Owner's wording and decisions** are in `docs/plan/decisions.md`; do not re-ask them.
- **Visual baselines** only in the Linux container (`npm run test:visual:update`).
- **No production** until the owner says so. Production needs a green `full-suite` status on the exact commit (nightly workflow) plus `staging-verified`.

## 3b. Tests: keep them few
Read the "Test economy" section of `ai-tools/agents/known-failures.md`: the smallest set of tests that proves each requirement; axe in light mode only in the normal suite; no per-colour-mode or per-state copies.

## 4. Handing work to Codex from Claude later
Claude starts Codex runs with `node ai-tools/codex-bridge.mjs run ...` (see LEAD-HANDOFF.md). The owner can also run any story by hand in the Codex panel with the same prompt shape: story id, the spec files to read, the worktree path, the migration number, "do not push", "write the handoff file".

## 5. When Claude is back
Tell Claude "Codex was lead since <date>". Claude reads `git log`, the PR list and the handoff files again; nothing else is needed. Codex run files are in `C:\Users\rupen\.dhanya\codex-runs\`.
