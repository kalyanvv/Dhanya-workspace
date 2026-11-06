# Next parallel work after the staging demo

Read-only source/worktree triage on main `7de076d10c0a348da2d866fc90b04f645b7caaa7`.
These are recommendations, not evidence that implementation has started. Recheck
current PRs and worktrees before assigning anything. Root retains release ownership.

| Assignment | Scope and ownership | Dependencies / checks |
|---|---|---|
| S2.7 shop management | M15/M16 linked-shop list/detail; trusted status, block/unblock, credit limit. Own shop-management API/schema and mill shop pages. | Link schema currently has status but no trusted field. Preserve old orders/statements for blocked links (FR-9). Reserve migration 0021 if still free. |
| S7.3 shop dues | S9 dues and shop payment status on S6/S7. Own shop credit API and shop dues/order display. Reuse scoped credit reads. | No credit limit, staff identity or book amounts exposed to shops. Coordinate order-page ownership with later S5.5. |
| S5.4 negotiation backend | Offer/accept routes and service integration, price replacement including transport, notices, optimistic version checks. Own negotiation API/service contract. | Existing offers/domain/order foundations are already merged. Agree response contract before S5.5 screens. Avoid simultaneous edits to shared order service. |

Separate worktrees and branches; private Docker databases; few focused tests. UI
builders use Karpathy, Apple design and accessibility guidance. Reuse domain and
credit/order services instead of rebuilding them. Do not advance tracker statuses
from these recommendations alone.

S8.1 dashboard read queries are an alternative independent task: IST date filters,
cursor-paged orders, summary/index analysis, no book data. Build the screen after
its contract is stable.

S5.2 runtime auto-accept still calls a stub. Finish after S2.7 establishes trusted
status: evaluate current settings/rice type/link status/live credit/trust under the
shared link/credit lock, and create the accepted order and credit charge atomically.
Its domain/settings and order credit wiring already exist.

S7.2 mill credit screens can follow S2.7 because both touch M16. Coordinate the API
with S7.3; opening/payment/void services already exist. S5.5 negotiation screens
follow S5.4 and share shop order pages with S7.3.

Latest migration is 0020. Reserve unique 0021+ numbers, merge in number order, and
regenerate cumulative snapshots after merging main. Old branches ahead of main
may already be delivered through squash merges; none of these remaining halves
was found implemented in the inspected worktrees.

Books S6.2 still awaits the owner's explicit decision about who posts/reverses for
system acceptance and the related split timing. Do not invent a split/PIN policy.
Independent batch security/design reviews remain due; production is not authorized.
