# Latest Dhanya feature and CI review

Observed 2026-11-06 after staging demo application. Main is `7de076d10c0a348da2d866fc90b04f645b7caaa7`. Release R3 ([PR #54](https://github.com/kalyanvv/Dhanya-sandbox/pull/54)) and existing-account demo tooling ([PR #55](https://github.com/kalyanvv/Dhanya-sandbox/pull/55)) are merged.

## CI and staging

- Latest demo PR head: `f8824b9b0ae5e8a7cba96501e760b5022a77bd47`; CI [42255125529](https://github.com/kalyanvv/Dhanya-sandbox/actions/runs/42255125529) passed before merge.
- Main deployment gate: [passed](https://github.com/kalyanvv/Dhanya-sandbox/actions/runs/42255828041), exact merged SHA. It covers static/secret/dependency checks, unit and full integration tests in UTC and Asia/Kolkata, production build/size and core phone journeys.
- Staging deployment: [passed](https://github.com/kalyanvv/Dhanya-sandbox/actions/runs/42257383848), same SHA; commit status `staging-verified=success`.
- Live `/api/health`, `/api/health/deep` (database ok), and `/sign-in`: HTTP 200.
- Latest Nightly was cancelled on an older commit; the last successful Nightly is also older. A complete Nightly suite is not verified on this release. No new Nightly was dispatched.

## What is on main/staging

Demo data was applied once through [staging workflow 42257832599](https://github.com/kalyanvv/Dhanya-sandbox/actions/runs/42257832599): `applied=true`, `alreadySeeded=false`, `staffIncluded=true`. Existing owner memberships determined the mill/shop sides; staff belonged to that same mill. Four products (one inactive), sixteen history rows over four days, private rice type, settings and pending display-only invitations were added. Seven orders cover 2 pending, 3 accepted with charges, 1 rejected and 1 shop-cancelled. Credit limit Rs 200,000, opening Rs 15,000 and payment Rs 20,000 use the credit service. Both sides and the existing staff login have read/unread notices; normal order/credit audit history is present. No users, passwords, memberships or permissions were changed. Books were skipped under the current owner decision. Existing pricing rules and unrelated rows were preserved. No real mail was sent.

Local verification: `npm run check`, 564 unit tests from the normal push hook, and two focused private-Docker integration cases passed. Those include the real CLI preview rollback, full apply, ledger allocation, repeat safety, staff scoping and refusal/rollback paths. The order-completeness constraint is checked between placement and transition; it is never disabled. Security review covered scoped parameterized writes, target guards, safe output and no credential-file reads. Fresh real-user authenticated UI inspection was not performed.

| Area | Current behavior | Remaining boundary |
|---|---|---|
| Accounts and network | Sign-in/reset/verification, mill access-code signup, staff controls, mill invites and shop joining, permissions/audit | Independent reviews before real users/data |
| Catalog and prices | Products/bag sizes, mill daily rates/history, shop comparison and mill rates, discount tiers, transport rule and live ladder | English only; tax settings do not establish full GST compliance |
| Cart and placement (R2) | Device cart per shop/mill, stale/unavailable blocking, server repricing, PRICE_CHANGED flow, idempotent placement and copied order terms | Real auto-accept runtime still not wired |
| Mill inbox and decisions (R3) | Grouped inbox/detail, Accept/Reject with reason, version conflict handling and shop notifications | Offers, split flow, dispatch/delivery remain |
| Shop orders (R3) | Paged order list, timeline, reorder with current availability, cancellation before a mill decision with optional reason, mill notice | Offers and payment-status UI remain |
| Credit ledger (R3) | Append-only service for opening/charges/payments/allocations/voids/limits; acceptance/cancellation update dues transactionally; mill detail gets owed/status | Payment/statement screens and routes remain S7.2/S7.3 |
| Books foundation (R2) | Append-only postings/status view and sale/reversal/correction services | Split/PIN/Secondary screens remain; D-06 gates S6.2 |
| Auto-accept settings (R2) | Stored versioned rules, summary and preview | Source still calls autoAcceptStub in place-order.ts, returning manual review |
| Notifications (R2/R3) | Scoped list/count/read, unread bell, 60-second visible-only polling; order/decision/cancel callers | Future offer/payment callers remain with those stories |
| Account/privacy and shell (R2) | Profile/data-copy requests/closure, preserved money records, account menu/sign-out, redirects and error pages | Privacy text professional review, operator completion tools and later exports remain |
| Later product areas | Pure/shared foundations exist where documented | Negotiation/expiry/dispatch, books/credit UI, dashboard, invoices/PDF/export and release hardening are not all complete |

## Documentation and takeover

Several tracker rows and individual handoffs still describe pre-release work (for example cart placement disabled, credit wiring pending, old migration order). Use current source and merged PRs; do not reopen old worktree branches based only on those notes.
Read [CONTINUE-WORK.md](CONTINUE-WORK.md) for the restart prompt, Karpathy/other skill map, roles, Docker commands, merge rules and remaining work.
Read [NEXT-WORK.md](NEXT-WORK.md) for parallel recommendations: S2.7 shop management, S7.3 shop dues and S5.4 negotiation backend. No new builds were started by that read-only triage. S5.2 runtime follows the missing trusted-status schema; S7.2 shares the mill detail screen with S2.7. Books has an explicit owner question.
Third-party source revisions are recorded in [tool-sources.json](tool-sources.json). The initial queue in lead-status.json is historical.

Codex structure was refreshed and validated: 350 skills, 80 roles, 50 worktrees, all five BMad personas and 13 configured MCPs; 350 skill compatibility checks had zero errors. Connector launchers were not probed because they read credentials. Use `continue-codex.ps1` to start Terra with those launchers disabled for the session; its dry-run arguments were checked without starting Codex.

## Open work

- [#21: chore(deps): Bump glob and @sentry/node](https://github.com/kalyanvv/Dhanya-sandbox/pull/21)

Verification scope: current GitHub checks, migration journal/snapshot chain, source and handoffs, and public staging health. Authenticated journeys are represented by CI; this was not a fresh manual real-user login, exhaustive review or production deployment.
