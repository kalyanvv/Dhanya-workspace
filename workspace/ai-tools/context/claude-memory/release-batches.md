---
name: release-batches
description: Every release must bundle at least 3-4 finished stories
metadata:
  type: feedback
---

From 2026-11-05: each release must contain at least 3-4 completed stories before it ships.

**Why:** the owner said "for every release let's atleast complete 3-4 tasks minimum for next release". It also saves CI minutes and review effort.

**How to apply:** keep 3-4 stories in flight at the same time (separate worktrees, separate migration numbers). Merge them to main (staging deploys automatically); promote to production (story S0.7, once built) only when a batch of at least 3-4 stories is done and checked. Name the release batch in `docs/plan/sprint-status.yaml` notes. Do not promote a release with fewer. See [[build-first-review-in-batches]] and [[dhanya-project]].

**Production gate (2026-11-05):** never push or promote anything to production (the Dhanya repo / production Vercel project) until the owner says so explicitly. Staging is fine. The owner also wants all in-flight stories (S2.4, S3.1, S2.5/S2.6, owner-answers) to finish first.

**One release PR (owner, 2026-11-06):** do not run CI for each story in parallel. Merge the ready story branches (in migration-number order) into ONE release branch, open ONE pull request and run CI once; then merge it (squash with a message listing the stories) and let staging deploy. Cancel redundant CI runs of the individual story PRs and close them ("folded into the release PR"). Stories without a migration can go in any position. Keep the individual branches for history.
