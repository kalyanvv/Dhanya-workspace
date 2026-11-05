---
name: dhanya-project
description: "Dhanya is the rice ordering web app for shops and mills; workspace layout, repos, and the plan-on-Opus then build-on-cheaper-models workflow"
metadata:
  node_type: memory
  type: project
  originSessionId: 65f816fd-9cce-4d38-9053-97d0a6d8256d
  modified: 2026-11-05T04:29:13.838Z
---

Dhanya connects shopkeepers with local rice mills, replacing phone calls for rates and discounts. Workspace: `Projects/workspace` with `main-project` (repo kalyanvv/Dhanya, production), `sandbox` (repo kalyanvv/Dhanya-sandbox, where all development happens first), `api`, `ai-tools`. GitHub account is kalyanvv; the old rupendrashata login was removed at the user's request.

**Why:** The user wants all planning done on Opus first, then cheaper models build from the plan, story by story. Pilot-ready MVP target of 8 to 12 weeks from November 2026.

The owner chose Vercel's free plan for staging and production for now, knowing its terms limit it to non-commercial use, with the choice revisited before real mills go live. The workspace stays in OneDrive for now (2026-11-04).

**How to apply:** The plan is in `sandbox/docs/plan/`, starting at `00-START-HERE.md`, and our own connectors, skills and agents are in `ai-tools/`. Build only in sandbox and promote to main after tests pass. Use the apple-design skill for all UI and BMad skills for planning and delivery. Explain things simply, see [[plain-language-explanations]].
