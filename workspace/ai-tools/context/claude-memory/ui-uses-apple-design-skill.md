---
name: ui-uses-apple-design-skill
description: "All Dhanya screens and key UI elements must be built and reviewed with the apple-design skill, with clarity as an explicit check"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 65f816fd-9cce-4d38-9053-97d0a6d8256d
  modified: 2026-11-05T05:37:50.486Z
---

Use the `apple-design` skill for every screen and key UI element, and check clarity (one job per screen, biggest thing is the most important, labels say what happens, errors say what to do).

**Why:** The owner asked for this twice (2026-11-04 and 2026-11-05): "Use apple design skill while key UI elements and clarity". The product is for busy shopkeepers on budget phones, so clarity matters most.

**How to apply:** Applies to every story that adds or changes a screen. The rule lives in `ai-tools/agents/dhanya-builder.md` and `dhanya-reviewer.md`, and in the plan's Definition of Done. Run an `apple-design` review before a PR, fix Critical and High findings, and put the summary in the PR. See [[dhanya-project]].
