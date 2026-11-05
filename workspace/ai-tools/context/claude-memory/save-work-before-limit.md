---
name: save-work-before-limit
description: Save all Dhanya work to GitHub regularly so nothing is lost when the Claude 5-hour usage limit runs out
metadata:
  node_type: memory
  type: feedback
  originSessionId: 65f816fd-9cce-4d38-9053-97d0a6d8256d
  modified: 2026-11-05T08:32:43.161Z
---

Save all work often, and always before the Claude 5-hour limit could run out.

**Why:** On 2026-11-05 the owner said "Save all the work before my claude 5 hour limit runs out everytime". A usage limit already stopped two helper agents mid-task once.

**How to apply:** Run `node ai-tools/save-work.mjs` from the workspace folder: after every helper agent finishes, before starting a batch of new helpers, and whenever work has run for a while. It snapshots every worktree (including uncommitted files) to `backup/<branch>` on GitHub and copies our tooling and notes to `backup/tooling`, with a secret scan. The owner can run `ai-tools/install-autosave.ps1` once to schedule it every 20 minutes outside Claude (creating that task myself was blocked, so it needs the owner). Resuming after a limit: see [[dhanya-project]] and `sandbox/docs/runbooks/resume.md`. Explain things simply, see [[plain-language-explanations]].
