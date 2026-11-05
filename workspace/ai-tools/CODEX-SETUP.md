# Dhanya AI tools in Codex

Configured on 2026-11-05 for the installed Codex CLI/VS Code runtime
`0.164.0-alpha.11.1`. The application code and production repository were not changed.

## What is installed

- 350 discoverable skills, combining the ECC library, installed BMad skills,
  Apple design guidance, and Dhanya's custom skills. Existing workspace copies
  take precedence over the upstream ECC copy when a folder has the same name.
- 80 adapted agent roles: 75 from `.claude/agents`, including Dhanya's helper,
  builder, reviewer, and QA roles, plus five BMad personas. Roles inherit the selected Codex model.
- The 12 workspace MCP connectors, plus OpenAI's public documentation connector.
- `AGENTS.md` entry points in `Projects/` and `workspace/`, and a `CLAUDE.md`
  fallback for existing repository instructions.
- A pinned Node runtime in `ai-tools/codex-runtime`, independent of the app's
  `sandbox/node_modules`. The app's lockfile dependencies were reinstalled separately;
  static checks, 333 unit tests and 95 integration tests now pass in both time zones.
  All four phone/desktop browser smoke checks also passed.

## How to activate it

Completely restart VS Code, open the `workspace` folder, and start a new Codex
conversation. Existing conversations may retain their original tool inventory.
The CLI and IDE share `C:/Users/rupen/.codex/config.toml`.

Skill discovery uses `C:/Users/rupen/.agents/skills`. Each installed folder is a
directory junction to a normalized copy in `ai-tools/codex-skills`. The installer
preserves upstream/Claude sources and adapts unsupported metadata and executable
Claude substitutions. Rerun the installer after changing a source or moving the
workspace. These are user-scoped skills and therefore also available when
working in the external `dhanya-wt` checkouts.

Project agent registrations live in `workspace/.codex/config.toml`, the outer
`Projects/.codex/config.toml`, and each of the 15 existing application checkouts.
The checkout-local generated configuration is excluded from application commits.
Rerun the installer after adding a worktree. Each checkout keeps its own branch
and plan; shared tools/context do not make all checkouts the same version.

## Connections

| Codex name | Service | Authentication |
|---|---|---|
| `dhanya-github` | GitHub | `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `dhanya-playwright` | Headless Chrome browser automation | None |
| `dhanya-chrome-devtools` | Headless Chrome debugging | None |
| `dhanya-context7` | Current library documentation | Public connection |
| `dhanya-next-devtools` | Next.js tools and app diagnostics | None; app inspection needs a running dev server |
| `dhanya-neon` | Neon, retaining `?readonly=true` | `NEON_API_KEY` |
| `dhanya-brevo-senders` | Brevo sender configuration | `BREVO_MCP_TOKEN` |
| `dhanya-brevo-templates` | Brevo transactional templates | `BREVO_MCP_TOKEN` |
| `dhanya-brevo-domains` | Brevo domain configuration | `BREVO_MCP_TOKEN` |
| `dhanya-supabase` | Supabase, retaining `?read_only=true` | `SUPABASE_ACCESS_TOKEN` |
| `dhanya-postgres-dev` | Local development database | Existing read-only database login |
| `dhanya-vercel` | Vercel project and deployment tools | `VERCEL_TOKEN` |
| `dhanya-openai-docs` | Official OpenAI documentation | Public connection |

`codex mcp list` may display `auth_status: unsupported` for these stdio entries.
That means Codex itself does not perform OAuth for the stdio transport. The
launcher authenticates the remote service; the connection check verifies it.

## Credentials

The only credential source is `C:/Users/rupen/.dhanya/.env`, with existing process
environment variables used as a fallback. `codex-mcp.mjs` reads that file at server
startup and gives the child only the credential required by that connector.

Token values are not copied into TOML, agent prompts, scripts, the skills directory,
or Windows user environment variables. HTTP credentials are passed through a
temporary child-process environment variable, never expanded into process arguments.
The bridge suppresses its normal logs; the launcher redacts stderr line by line.
Do not turn on bridge debug logging while using real credentials.

After changing a token in `.env`, restart the Codex connection/session so its
connector process reads the new value. No config regeneration is needed for rotation.

Connection setup and verification do not send emails, deploy sites, or modify cloud
databases. Having a connector available is not a request to perform those actions.

## Reinstall and check

From `workspace/`:

```powershell
npm ci --prefix ai-tools/codex-runtime --no-audit --no-fund
py -3.11 ai-tools/install-codex.py
node ai-tools/check-codex-mcps.mjs
py -3.11 ai-tools/validate-codex-setup.py
node ai-tools/validate-codex-skill-compat.cjs
```

The installer requires Python 3.11+ and PyYAML (already present on this machine).
It preserves unrelated Codex settings and backs up the user config before changing
it under `~/.codex/backups/dhanya/`. It does not change your model, permission mode,
or application Git hooks. Its managed sections are marked in the config files.

Check one connector:

```powershell
node ai-tools/check-codex-mcps.mjs brevo-templates
```

The check performs MCP initialization and tool discovery. It does not certify every
tool's behavior or execute write operations. The latest combined results are stored
locally in `ai-tools/codex-runtime/connection-status.json`, without credentials.
Occasional remote connection failures should be checked individually rather than
treated as proof of an invalid token; one Brevo templates handshake succeeded on retry.

All 13 connectors passed initialization and tool discovery during setup. Brevo
senders/templates were intermittent in concurrent checks but passed individually.
The local functional checks additionally verified a read-only Postgres query,
Playwright opening/closing a headless browser, and Chrome DevTools listing pages.
Those checks can be repeated with `node ai-tools/smoke-codex-tools.mjs`.

The existing `uv` installation is version 0.13.7, in the Python user Scripts folder.
That folder is already in the saved user PATH. An older VS Code process may need a
complete restart to inherit it. `py -3.11 -m uv` also works without a PATH refresh.

The full CI/testing/session-parity guide is `sandbox/docs/runbooks/codex.md`.
Use `dhanya-workflow` for project work, `py -3.11 ai-tools/dhanya-status.py` for
local progress, and `node ai-tools/audit-ci.mjs` for a read-only GitHub snapshot.

## What does not transfer directly

Claude-specific slash commands, hooks, model names, and the `/dhanya` side pane are
not Codex-native interfaces. Their underlying skills, prompts, plans, and progress
files are available. Ask Codex to read `sandbox/docs/plan/sprint-status.yaml` and
`ai-tools/progress/owner-needs.json` for progress.

The skill installer validates the metadata, not every third-party skill's external
dependencies. Some library skills need an additional service or program when used.
No unrelated services, payment plans, or API-backed applications were provisioned.

## Official references

- Codex MCP configuration: https://developers.openai.com/codex/mcp
- Skill discovery and directory links: https://developers.openai.com/codex/skills
- Configuration settings: https://developers.openai.com/codex/config-reference
- Agent roles: https://developers.openai.com/codex/multi-agent

The installed CLI accepts the role registration format used by the local ECC
distribution. Online documentation may describe newer standalone agent formats;
verify compatibility with the installed runtime before migrating those files.
