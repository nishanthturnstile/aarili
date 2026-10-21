# Quick Order: approved vertical ticket packet

19 October 2026. Parent roadmap slice **1.2.1**. The owner approved **A-B**,
authorised publication and selected **A** for implementation. Published and read
back through authenticated `gh` using the installed `to-tickets` workflow:

- **A: [#113](https://github.com/nishanthturnstile/aarili/issues/113)**: merged through #115.
- **B: [#114](https://github.com/nishanthturnstile/aarili/issues/114)**: implemented for owner review after A merged.

Production policy, human acceptance, merge, promotion and deployment remain separate.

Sources: owner-provided local brief `Quick_Order_REA_Prompt.md`,
[observations/inferences/unknowns](Quick_Order_REA_Evidence.md),
[independent design and QO acceptance matrix](Quick_Order_Design.md),
[delivery status](Quick_Order_Implementation_Evidence.md), product
§§3–9/15/17/24–25/27/29.1/30.1/32–33; architecture §§6–11/15;
roadmap 1.1.1–1.1.3, 1.2.1–1.2.4, 1.3.2, 1.4.2–1.4.4;
[workflow](Development_Workflow.md), [tracker](issue-tracker.md) and
[design system](../aarili-design-system.md).

## Publication and selection

| Ticket | Complete owner-visible outcome | Direct blockers |
| --- | --- | --- |
| A — **1.2.1a: Save, find and resume a Quick Order draft** | Choose existing customer/authorised wearer and exact eligible service, enter partial date/price/details, inspect unresolved requirements in either mode, save/reload/list/resume honestly. No order is booked. | Merged #56 durable drafts, #78/#79/#80 identity/guardian, #99 exact manifests and #100 presentation. Their transitive foundation/catalogue/form prerequisites remain merged requirements. |
| B — **1.2.1b: Accept and reopen a Quick Order with atomic capacity and exact history** | Review current server-resolved commitment, accept with supported exceptions, receive one readable order ID, reopen its exact snapshots/checklist/owner and change presentation without losing data. | A **merged**, plus merged #84 profile/timezone, #85 calendar, #87 policies and #101 category binding (including its #88 rules prerequisite). |

Native blockers were added and read back: A -> #56/#78/#79/#80/#99/#100;
B -> #113/#84/#85/#87/#101. All A blockers and B's foundation blockers are
closed with merged closing PRs. A starts from development `ca6aad0` in the
existing checkout on `codex/quick-order-drafts`. #110 merged with successful
full CI; it was rechecked rather than assumed and was never an invented blocker.

Two tickets follow the actual coupling. A is a useful completed draft journey,
with no pretend confirmation. B must own the complete accepted-order transaction
and visible reopen/detail result; splitting its locking/snapshots into a hidden
backend ticket would leave an unproved acceptance boundary. No separate generic
order/draft/template module, evaluator or UI-only “success” ticket is proposed.

Initial publication and A selection used the owner's explicit approval. The
owner subsequently selected #114 after #115 merged, and approved the count/week/
retained-demand/QO-code conventions recorded in the design. No worktree,
production policy, merge, deployment or live-data activation is authorised.
B's feature PR targets development under the established workflow.

## Shared requirements for both tickets

Each ticket owns its contracts, framework-free core, repository interfaces,
transactional SQL, thin Node-runtime Hono routes, typed clients, bilingual owner
UI, tests and evidence. Reuse existing customer/wearer/guardian, draft workflow,
request/hash/version, manifest projection, shop presentation, commitment evaluator
and membership composition. No business Server Actions, browser persistence,
new package, copied competitor code/API or invented policy/rate.

Use app_user and membership-checked withShop, same-transaction operations,
shop-led keys/indexes, composite tenant references and forced matching RLS for
new tenant tables. Every mutation has actor/action/hash-bound idempotency and
the existing ETag/precondition meanings: 428/412/409/422. Show explicit saving,
saved, failed, uncertain and conflict states. Lost-response retries reuse the
exact request envelope, not merely its key with an edited payload.

Preserve current onboarding/customer/minor/privacy/settings/catalogue/forms/
templates/bindings and draft behaviour. Update isolation table/path inventories,
workflow registry expectations and offline OpenAPI assertions with the actual
new entries. Never weaken an inventory or runtime policy to make tests pass.
Follow existing money safe-integer/paise serialization; unknown differs from zero.
No issued billing/payment ledger is added.

All UI flows use incumbent English startup, explicit Tamil selection, both
themes, phone/tablet/desktop, 44px controls, keyboard/focus/IME/reflow and no
colour-only semantics. Clear private forms/cache on sign-out/shop change/access
loss; do not expose unauthorised labels in conflicts or draft summaries.

## Ticket A — Save, find and resume a Quick Order draft

**Stable slice:** 1.2.1a. **Outcome:** an owner can put down an incomplete blouse
intake, reopen the app and recover the last committed draft without creating an
order or reservation.

**Sources:** ORD-01/04/05/06/11, USE-03/04/08; SET-10; CUS-02/07,
TRU-01/03/05/06/13. AC-40/55 actual draft flow, AC-59 partial intake,
AC-02/53 identity-boundary contribution. Architecture §§6–9/11/15.

**In scope:**

- Orders/New order and a real shop-scoped Resume drafts list using the existing
  durable draft infrastructure. No operational dashboard metrics. Existing
  customer search/self default and other authorised wearer selection; reuse
  registration when needed, preserving any committed intake draft across return.
- One versioned incomplete draft schema and stricter future promotion shape;
  null/partial dates and price text can be saved without claiming a valid order.
  Identify missing/invalid fields, unsupported historical cases and source drift.
  Reject foreign private lookups and never store a client authority assertion.
- Eligible exact service/manifest/form/template references and preview of the
  generated canonical unresolved checklist/default owner. Save presentation
  with the draft; repeated mode changes preserve all hidden values/blockers.
- Delivery, normal/rush, optional order/requested/event dates/instructions,
  quoted-zero versus To be quoted and honest payment deferral. Pin the exact
  selected sources; do not bind a commitment or silently refresh them.
- IME-aware autosave, explicit save, saved-list refresh, opaque acknowledged-draft
  URL, reload/new-session recovery, draft abandonment and dirty navigation.
  No confirm action until B exists; text explains that this is only a draft.
- Lost/failed save recovery, current-memory retention, exact request replay,
  stale comparison, source review and access invalidation through existing seams.

**Acceptance / evidence:** QO-01–06 draft portions and QO-09–12. Browser proof
must save → close → list → resume without needing reload, and separately prove
reload and a second authenticated session. Drop a response after a real committed
save, replay the frozen envelope and assert one version/audit effect. Simulate
offline/422/412, typing during an older save and Tamil composition. Compare
canonical content through Simple → Detailed → Simple, language and resize.
Probe missing/foreign context, revoked relationship/guardian, cross-shop draft
search/resume and no private-memory leak after sign-out. Real PostgreSQL proves
tenant isolation, key/actor/action/hash rejection and actual-write rollback.

**Migration / recovery:** primarily a new registered workflow on existing draft
storage; do not add parallel draft tables. Any concrete extra relational link
must be justified and reviewed, with FORCE RLS/composite keys. Existing active
drafts/workflows survive upgrade. Unknown old schema is explicitly unsupported,
never treated as approved. No assumed retention deletion or paid/live seed.

**Owner inputs:** approve the draft flow and bilingual copy; production privacy,
catalogue/form/template review stays pending. Synthetic fixture selections are
enough for implementation verification and do not approve production content.

**Completion:** a running seeded synthetic review host, exact commands/results,
QO mapping, source revision/dirty-file manifest, review/cleanup packet and timing
ledger. No claim of order booking, atomic capacity, full AC-59 or complete 1.2.1.

## Ticket B — Accept and reopen with atomic capacity and exact history

**Stable slice:** 1.2.1b. **Outcome:** the saved blouse draft becomes exactly one
accepted order under current authority and capacity; its identifier reopens the
same historical specifications and unresolved work after reload/retry.

**Sources:** ORD-01/04/05/06/11; USE-03/04/08; SET-08/10/11,
TRU-01/03/05/06/12/13. AC-40/55 actual promotion/reopen, AC-59 partial,
AC-60 acceptance integration, AC-07/27/53 scoped history/identity contributions.
Architecture §§6–11/15. A and every direct blocker must be merged first.

**In scope:**

- Complete command schema and registered draft promotion into an accepted order.
  Current membership/identity/guardian/eligible exact manifest and configuration
  are resolved under canonical publisher locks. Client load, eligibility,
  reviewed flags and server times are rejected. Pin exact sources, snapshots,
  unresolved requirement/task instances and default owner in durable storage.
- Use the existing category resolver/binding and evaluator for current
  server-resolved category/rule/calendar/policy and demand. Implement the design's
  reviewed load model, stable category capacity lock covering absent buckets,
  re-read/re-evaluation and a tested publisher-compatible lock graph. Unit changes
  never reset apparent load or reinterpret older effort without approved mapping.
- Review/accept flow showing cap, existing/candidate/total, week, cut-offs,
  lead/rush, unknowns and exact source status. Supported excess/cut-off acceptance
  needs a recorded reason; rush waiver needs its reason. Unknown authority or
  demand cannot be overridden. Changed facts require explicit review, no silent
  reference substitution. To be quoted remains a valid price state.
- One transaction commits order/code, immutable snapshots, requirements/owner,
  accepted demand, exception/waiver, audit, draft/result and idempotency result.
  Unique shop/origin-draft link prevents a second order beyond key retention.
  No outgoing message, payment, measurement, custody or production effect.
- Durable Orders list/read/detail: correct customer/wearer, original/current
  promise versus creation/order/requested/event date, exact selected service,
  price state, owner, unresolved blocker and next action. History loads on demand.
  Current disabled definitions remain readable by explicit historical reference.
- Per-order Simple/Detailed override as an attributable versioned command.
  Shop preference changes cannot rewrite it. Losing a mode-change response is
  recovered exactly; it cannot alter the accepted snapshot or capacity.
  No generic edit/cancel of accepted price/date/demand; later agreement/lifecycle
  consumers own those governed commands.
- Lost acceptance response/checking outcome, promoted-draft recovery from another
  session, repeat clicks, stale edits and request mismatch. No second booking,
  fabricated success or automatic conflict merge.

**Acceptance / evidence:** all applicable QO-01–12, with ticket-local proof
identified per row. Real PostgreSQL scenarios must include:

1. Two simultaneous **first** acceptances in a previously empty category/week:
   one takes the last clear slot, the second sees committed load and requires
   the configured exception/review rather than both observing zero.
2. Concurrent last-slot acceptances, including a valid reasoned over-capacity
   follow-up. One is not silently accepted on a stale review. Same-key calls
   produce one order/demand/result; two keys on one draft still produce one order.
3. Category availability/rule/binding/calendar/guardian revocation racing
   acceptance. Current source locks prevent mixed snapshots and unauthorized
   acceptance. Changed rule revision never starts an empty independent load.
4. Missing/null demand, effort mapping, calendar/policy and zero-cap conventions
   remain unknown. Forged browser load, owner-reviewed flag, shop and actor fail.
5. Fail after each actual write boundary, including snapshot, demand, audit,
   promoted draft, stored key and any concrete job. All writes roll back; replay
   after rollback succeeds once and a post-commit lost response replays its result.
6. Runtime missing/foreign context, composite cross-shop inserts, pooled reuse,
   immutable snapshot UPDATE/DELETE, draft-result provenance mismatch and old
   key expiry. Search/list/detail/requirements/history cannot cross shops.

Unit/property tests cover exact amount boundaries, dates/timezone/week rules,
canonical switching and request binding. Bilingual Playwright/axe covers a
complete repeat-customer blouse intake → current warning review → acceptance →
reload/reopen flow on phone/tablet/desktop, both themes/modes, failures and
sign-out. Record actual elapsed task time, exclusions and device profile;
screenshots do not prove the two-minute target or physical-device acceptance.

**Migration / recovery:** allocate additive migration names at implementation
time after latest development. Review order, source-link/snapshot, instance,
demand, identifier and presentation-history schema/grants/guards. Verify upgrade
from populated foundations, no policy activation/backfill, snapshot immutability
and origin uniqueness. Retain schema/history on compatible application rollback;
no destructive down migration, live restore or silent conversion to a draft.
Backups/restore epoch/quarantine/kill switch remain required safeguards.

**Owner inputs:** approve the proposed authoritative demand inclusion/release
basis, count/effort mapping, capacity week/allocation and exception semantics.
Confirm readable code convention and review wording. Production lead times,
caps, cut-offs, rush values and content/privacy gates require their own recorded
approval under §32; never replace them with competitor or fixture values.

**Completion:** accepted-order runtime review packet, every applicable QO row
linked to fresh evidence, repository commands and failure corrections, measured
intake timing and clear manual acceptance. No payments, full customer summary
sharing, material costing, measurement capture, task execution or live readiness
claim. New feature PR targets development and awaits required CI/owner review.

## Required verification and review handoff

Actual root scripts exist: `pnpm lint`, `pnpm knip`, `pnpm typecheck`, `pnpm test`,
`pnpm test:negative`, `pnpm openapi`, `pnpm test:integration`, `pnpm build`,
`pnpm test:pdf`, `pnpm test:ui`, `pnpm verify:fast` and `pnpm verify`.
Resolve current library syntax through ctx7 before implementing new integrations;
read the installed Turbo docs before changing its commands/configuration. No
dependency or toolchain migration is proposed.

For each implementation, run **`pnpm verify:fast`**, the focused real PostgreSQL
suite and focused bilingual browser suites plus its explicit issue checks.
Run the full `pnpm test:integration` for B's new tenant schema/transaction boundary;
run affected upgrade/inventory suites for A. Use actual test names/paths allocated
during implementation, not invented commands in this packet. Full `pnpm verify`
and `pnpm test:ui` remain promotion gates or explicit ticket requirements.
Existing Tamil PDF goldens remain promotion evidence unless document inputs
change; any changed document input requires fresh affected goldens. No repeated
heavy clean/PDF runs solely for documentation edits. Record unrun/manual checks.

The required running packet is prepared **after implementation**, before asking
for software acceptance: exact local synthetic URL and start command, private
access method, one existing customer and permitted wearer, one eligible blouse
manifest, a partial draft and accepted-order scenario. Group owner observations:
QO-01/04 minimal intake/recovery; QO-03/06 exact checklist/modes;
QO-07 capacity exception/waiver; QO-10/11 dates/language/device usability.
Give expected visible results and copyable `QO-ID — pass/fail — observation`.
Keep fluent Tamil, actual Android/keyboard/AT, manual WhatsApp/PDF later consumer,
restore/privacy and pilot gates separate. Teardown stops only that review host
and its disposable infrastructure; never another task's host or worktree.

**Approval record:** the owner answered **“Approve A–B, publish, and implement A.”**
This satisfies the [development workflow](Development_Workflow.md) requirement
to **“propose a concrete breakdown for approval before publishing new tickets.”**
#113/#114 were published under that approval; A was selected first and merged
in #115. B is now selected as recorded below. No repeated publication approval
is needed. The research profile was restored and
authenticated investigation resumed. Production policy, human acceptance, merge,
promotion and live-data gates remain separate.

## B selection update (19 October 2026)

The owner requested implementation of #114 after #113 merged in #115 and
confirmed: one accepted garment in its promised-delivery week, retain booked
demand after completion, shop-scoped QO-000001 onward, and block effort-point
acceptance until a reviewed mapping exists. Production caps, lead times and
rush values remain separately gated. See
[acceptance delivery](Quick_Order_Acceptance_Implementation_Evidence.md).
