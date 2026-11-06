---
name: codex-setup
description: Claude can run Codex tasks through ai-tools/codex-bridge.mjs like subagents; Codex is signed in via the VS Code extension
metadata:
  type: reference
---

Codex (OpenAI) is installed as a VS Code extension, signed in (`~/.codex`), configured with the Dhanya MCP tools and agent roles (ai-tools/CODEX-SETUP.md). Its CLI is `codex.exe` inside the extension folder (`~/.vscode/extensions/openai.chatgpt-*/bin/windows-x86_64/`), not on PATH.

**Bridge (built 2026-11-06):** `node ai-tools/codex-bridge.mjs run --name <id> --worktree C:\Users\rupen\dhanya-wt\<w> --prompt-file <file> [--sandbox workspace-write|read-only] [--npm-ci] [--timeout-min 90]`. Start it with Bash `run_in_background` and wait for the completion notice (like a subagent). Also `list`, `status --name`, `result --name`. Logs in `~/.dhanya/codex-runs/<name>/`. Built-in guards: worktree must be under dhanya-wt and not on main, sandbox only (never full access), prompt scanned for tokens, secret env vars stripped, Codex told never to push or read .env. First test: 20 s, ~81k input tokens.

**How to use:** treat Codex like a Sonnet builder on its own OpenAI budget: one story per worktree/branch, a free migration number, handoff file at the end. Claude merges main into its branch, pushes, opens the PR and merges. Good for taking load when the Claude 5-hour limit is near. See [[dhanya-project]], [[model-by-difficulty]].
