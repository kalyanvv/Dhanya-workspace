---
name: skip-telugu-for-now
description: Owner decided on 2026-11-05 to skip Telugu for now; build English only
metadata:
  type: project
---

Telugu is skipped for now. Build and test English only.

**Why:** The owner said "we can skip telugu for now" on 2026-11-05, after we were about to start the PDF and Telugu spike (S0.9) that needs a Telugu reader.

**How to apply:** Do not add Telugu work to stories, reviews or tests. Keep `messages/te.json` as English placeholder text so the i18n key check still passes. Drop the Telugu part of S0.9 and any Telugu-reader sign-off. Revisit when the owner brings it back. See [[dhanya-project]].
