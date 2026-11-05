---
name: build-first-review-in-batches
description: Finish building the work first; do deep independent reviews in batches at the end of each area, not on every story
metadata:
  type: feedback
---

Build and merge first. Do the deep independent reviews (security, UI, money) in batches at the end of each area (epic) and before real data or launch, not before every merge.

**Why:** On 2026-11-05 the owner said "you are doing a very thorough review first itself before completing all the work first". Per-story reviews were eating the 5-hour usage limit and slowing the build.

**How to apply:** For each story: the builder builds with its own tests, the lead re-runs the checks, GitHub CI must be green, then merge. Log every skipped review in `sandbox/docs/plan/review-backlog.md`. Run the batch reviews at the end of E2, E5, E6, E7, E9 and before the pilot. Reviews already done (S1.2, S3.2, orders, books and credit) stay done. Still keep tests and the Apple design review by the builder. Never skip the security review before real users or real data. See [[dhanya-project]] and [[save-work-before-limit]].
