---
name: model-by-difficulty
description: Choose Haiku or Sonnet by task difficulty; never Opus until the owner says
metadata:
  type: feedback
---

Pick each subagent's model by how hard the task is. Do not use Sonnet for everything (owner, 2026-11-05).

**Why:** the owner wants the cheapest model that can do the job well, to save tokens and the 5-hour limit.

**How to apply:**
- **Haiku:** easy, copy-the-pattern work: docs, simple CRUD screens that mirror an existing one, gallery/coverage guards, renaming, fixing a known failing test, merge-conflict cleanup, running and summarising checks.
- **Sonnet:** regular feature building with new tables, routes and screens that follow existing patterns.
- **Opus: DO NOT USE until the owner says to switch (owner, 2026-11-05).** Only Haiku and Sonnet for now. When the owner allows Opus later, it is for the hardest or riskiest work: money, books, orders concurrency, auth/privacy design, independent security and design reviews.
- Until then give risky work to Sonnet and add a second Sonnet or Haiku check, and keep the independent reviews queued in review-backlog.md.
Write the chosen model and the reason in the task prompt. Record it in the sprint tracker note. See [[dhanya-project]] and [[release-batches]].

**Codex model tiers (owner, 2026-11-06):** pick Codex models by usage price: `sol`, `terra` and `luna` may be used as needed; `astra` needs the owner's explicit approval before every use. (Claude has not yet confirmed what these names map to in Codex, ask the owner for the exact model ids if unsure; the bridge passes them with `--model`.) The Claude rules above still apply: Haiku and Sonnet only, no Opus until the owner says.
