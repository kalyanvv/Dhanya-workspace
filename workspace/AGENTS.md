# Dhanya instructions for Codex

Read `CLAUDE.md` and `sandbox/docs/plan/00-START-HERE.md` before work. Those contain
the existing project rules; this file adapts discovery to Codex.

- All application development happens in `sandbox/` on a feature branch. Never
  edit `main-project/` by hand or commit directly to application `main`.
- The plan is in `sandbox/docs/plan/`: requirements, architecture, design, screens,
  tests, releases, stories, decisions, review backlog, and sprint status. Read the
  relevant sections and current decisions before implementing a story.
- Follow the existing build-first, review-in-batches policy in `review-backlog.md`.
  Keep the builder's tests and design checks. Security review is required before
  real users or real data. Do not represent a whole story as finished when only
  its pure business-rule module is built.
- Money is whole paise, with shared pricing logic. Business rules in `src/domain`
  stay pure. Invoice totals cover the full order value and never depend on books.
- Every visible string comes from language files; version 1 is English only and
  Telugu is deferred, including the Telugu portion of S0.9 and reader sign-off.
  Use design tokens and the `apple-design` skill for UI work.
- Secrets remain in `C:/Users/rupen/.dhanya/.env`. While leading this project,
  never open that file or any token/authentication file, including for validation.
  Use the existing GitHub CLI login and the repository pipelines for staging.
  Do not start connector launchers or memory-sync scripts that read that file.
  Never print, paste, log, commit, or copy token values into configs.
- The `dhanya-*` MCP servers in Codex use `ai-tools/codex-mcp.mjs`. That launcher
  loads credentials when each process starts. Neon, Supabase and local Postgres
  retain their read-only connector configuration. Browser connectors are headless.
- Skill libraries are available through `C:/Users/rupen/.agents/skills`. Keep
  third-party source clones unchanged. Custom source tools live in `ai-tools/`.
- Codex-native roles mirror the installed agents. Claude model names and slash
  commands in imported material are references, not Codex settings. Inherit the
  selected Codex model and use the supported Codex tools. Follow the active
  session's delegation rules; installing roles does not authorize parallel work.
- BMad's project root is this workspace folder. Its merged configuration points
  planning to `sandbox/docs/plan` and implementation notes to `sandbox/docs/stories`.
- Run the project's checks appropriate to the work. `npm run check` performs
  static checks; unit and integration tests are separate commands. Report only
  results actually observed. Integration runs share `dhanya_test`: run only one
  database test process at a time across all worktrees.
  Prefer local checks before a push. `ai-tools/check-local-docker.mjs` runs selected
  integration/browser specs with private Docker databases and no tracked port
  edits; see `ai-tools/LOCAL-TESTING.md`. Keep GitHub CI as the final merge gate.
- Explain outcomes in simple words. State what changed, what was verified, and
  what remains. Consult the planning review for known contradictions; the review
  is a report, not a replacement for the owner's decisions or source plans.

For continuing Claude's work, read `ai-tools/context/CLAUDE-TO-CODEX.md` and the
relevant small notes under `ai-tools/context/claude-memory/`. They are timestamped
context, not a substitute for checking the current branch and live CI state.
Use the `dhanya-workflow` skill for project work and
`py -3.11 ai-tools/dhanya-status.py` for a local progress summary. Detailed CI,
testing and role mapping is in `sandbox/docs/runbooks/codex.md`.
If `uv` is not visible in an older terminal, use `py -3.11 -m uv`.

Setup guide: `ai-tools/CODEX-SETUP.md`. Reinstall with
`py -3.11 ai-tools/install-codex.py` after adding or changing agents, skills, or
connector definitions. Run `node ai-tools/check-codex-mcps.mjs` to check connections.

Taking over as lead: read sandbox/docs/plan/handoffs/LEAD-HANDOFF.md first.
