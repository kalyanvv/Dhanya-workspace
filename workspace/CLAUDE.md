# Workspace

- `main-project/` – production. Only reviewed code from sandbox is pushed here.
- `api/` – API sub-project used by main-project.
- `ai-tools/` – tool repos (ECC, apple-design-skill). Source clones; do not edit.
- `sandbox/` – all development happens here first.

## UI work
For any UI/UX design, layout, or design-decision task, use the `apple-design` skill
(`.claude/skills/apple-design/SKILL.md`) and follow its HIG references before implementing or reviewing.

## Tooling
ECC (developer profile, no hooks) is installed in `.claude/`.

## Planning & delivery
BMad Method (v6.12, `bmm` module) is installed in `_bmad/` with skills in `.claude/skills/`.
Use `bmad-help` to see the next step; use BMad skills for planning (PRD, architecture, stories) and implementation. Plans and outputs go to `sandbox/docs/plan/` (set in `_bmad/custom/config.toml`).

## Dhanya build plan
Start every build session with `sandbox/docs/plan/00-START-HERE.md`. Work one story at a time, on a branch in `sandbox/`, and never commit to `main` directly or edit `main-project/` by hand. Explain things to the owner in plain language with exact steps.

## AI tools
MCP connectors, our own skills and agents live in `ai-tools/`. After changing them, run `node ai-tools/install.mjs` and restart VS Code. Browser tests use Playwright through the `dhanya-e2e` skill and `dhanya-qa` agent; Selenium is not used.

## Secrets
All tokens live in `C:\Users\rupen\.dhanya\.env` (outside OneDrive and git). Read a value only inside the command that needs it. Never print, echo, log or paste a value, and never commit it. `ai-tools/secrets.example.env` lists the names. If a command prints a secret by accident, reset it straight away.

## Coding style
Follow the `karpathy-guidelines` skill (source clone in `ai-tools/andrej-karpathy-skills/`, installed copy in `ai-tools/skills/karpathy-guidelines/`): think before coding and ask when unclear, minimum code, surgical changes, verifiable success checks. The plan in `sandbox/docs/plan/` wins on any clash.

## How we work: build first, review in batches
Builders build with their own tests; the lead re-runs the checks and merges when GitHub CI is green. Deep independent reviews (security, UI, money) are done in batches at the end of each area and before real data, and every skipped review is listed in `sandbox/docs/plan/review-backlog.md`.
