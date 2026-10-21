# Group garments and track outfit pieces: independent design

19 October 2026; status updated 20 October. Roadmap **1.2.2**.
**A–C software packet approved; A/B merged; C (#120) in draft PR #123 for owner review.
Production commercial policy remains separately gated.** [Research](Grouped_Bookings_REA_Evidence.md),
[vertical tickets](Grouped_Bookings_Ticket_Packet.md),
[delivery status](Grouped_Bookings_Implementation_Evidence.md).

Primary traceability: **ORD-02, ORD-03, ORD-13, ORD-14; AC-01 and AC-63's
structural contribution**. GB-01–GB-10 below define the bounded proof obligations.

## Authority and inspected baseline

Product §§3–9, 13, 15, 17, 24–25, 27, 29.1, 30.1, 32–33 govern behaviour;
architecture §§6–11 and 15 govern technology. The
[development workflow](Development_Workflow.md), [tracker](issue-tracker.md),
[Quick Order design](Quick_Order_Design.md),
[acceptance evidence](Quick_Order_Acceptance_Implementation_Evidence.md),
[service templates](Service_Templates_Design.md) and
[design system](../aarili-design-system.md) remain authoritative inputs.
No baseline conflict requiring a scope or technology change was found. The
incumbent draft and presentation commands agree with architecture §8.5:
changed-key payload/actor/action returns **422 IDEMPOTENCY_MISMATCH**;
409 is a domain/source conflict. Preserve that distinction.

Fresh fetch found clean `development` at `68d07ed` equal to origin, including
planning PR #117 and acceptance #116. #113/#114 are closed; #115 merged at
`c6ab32d`, #116 at `c375a5a`. No 1.2.2 implementation issue was published in the
authenticated all-issue inventory. Work is on `codex/grouped-bookings-design`
in the existing checkout; no worktree, stash or discarded edits.

## Model and scope

Owner clarification after packet review: initial payments are manually recorded
and owner-confirmed in the later payment slice. Payment gateways, automated UPI
collection/verification and bank/provider integration are deferred. This booking/
piece work records quote basis only, with no payment or posting mutation.

A booking optionally groups independent garment orders. A blouse and a salwar
are two orders, with separate readable QO identifiers, wearers, instructions,
promises, prices and progress. Top, bottom and dupatta are piece instances inside
the salwar, according to its exact reviewed definition. They are not three more
orders, three extra capacity units, pattern panels or implicit priced lines.
Bridal is booking occasion/package context, never a catalogue category or a
priority override. A single Quick Order continues without a booking screen.

Shared context includes contact, optional payer reference, visit/occasion,
optional event date and bounded notes. Customer, payer, wearer and guardian
identities remain distinct. Proposed initial linking restricts garments to the
same authorised booking contact; different wearers remain supported. Multi-contact
commercial consolidation is outside this initial slice. A different payer never
changes a wearer. No shared phone, booking or payer grants service, measurement
or media permission. Recheck every member on list/detail/history, save, command,
conflict and exact-key replay before returning private content. Fail the whole
private response on denied member access; do not leak its labels/counts through
an otherwise authorised summary. Minor order authority is required; later
measurement/photo capture still requires its own guardian purpose consent.

The scope is custom and permitted service/alteration orders. Grouping preserves
service kind and its own requirements, never coerces an alteration into stitching.
Dedicated standalone fall/pico/alteration intake remains **1.2.3**. Add-on prices
and execution stay with their owning slices; this does not introduce retail,
actual measurement entry (1.3.2), production (1.7), custody (1.5), payment allocation
(1.4.2), issued customer summaries (1.4.3) or partial handover (1.8.3).

## Owner journey and presentation

Operate surface for the solo owner recording a family visit at the counter.
Extend Orders and its incumbent form/detail composition, Current light/dark
tokens, local Noto Sans/Noto Sans Tamil and Base UI controls. No visual identity
replacement, new shell, font, raster asset or component library. Existing body
size/Tamil line-height, heading weights and semantic colours remain unchanged.

1. New order follows the existing Quick Order path. Optional **Add another
   garment** explicitly opens a grouped draft. Preserve the original form and
   its stable draft line identity; do not auto-promote or abandon it. Conversion
   is one server command with exact origin uniqueness and a recoverable target
   draft result, so two tabs cannot import it twice or keep two active copies.
2. Shared context precedes a list of garments. Each garment repeats wearer,
   exact service, own delivery promise and **Quoted / To be quoted** state.
   New lines may explicitly copy a common date/context; show the copied value
   for review. Subsequent group changes do not propagate to existing promises.
3. Select a garment to see its exact pieces and missing requirements. Simple
   shows each piece and a concise unresolved explanation; Detailed reveals form,
   task/dependency and source references. Both render the same canonical values.
4. Save draft remains distinct from **Review all garments** and **Book all new
   garments**. The review enumerates independent commitments, warning reasons,
   unknowns and price basis. One failed garment leaves the entire group draft
   recoverable; no other garment is accidentally booked.
5. A booking detail lists member identifiers and separate promises, wearer cues,
   price basis and unresolved pieces. Open a member in the existing order detail.
   An accepted ungrouped order can instead be linked once through a separate
   reviewed command. That action says **Group existing orders**, never Book again.

Phone (360×800): shared context, garment cards and one active editor in a single
column; piece disclosures stay attached to their garment. Reachable save/review
actions clear the keyboard and bottom navigation. Tablet (820×1180 and landscape):
list/detail where width permits, one pane otherwise. Desktop (1440×900): member
list beside the active garment, with a readable booking summary. Avoid a wide
spreadsheet as the phone form. The first viewport identifies draft versus booked,
the active wearer and unsaved state. Preserve focus on add/remove/reorder and
return from detail; provide keyboard Move up/down, not drag-only ordering.

Long Tamil names, labels and amounts wrap. Targets are at least 44px; status has
text, not colour alone. Associate errors with the exact garment/piece and focus
the first invalid field or request-feedback region. No fabricated progress bar.
Empty state offers Add garment; permission denial, unavailable source, checking
outcome and stale comparison remain distinct. Unsupported future actions have
plain guidance, not enabled controls or fake successful states.

## Piece identity, requirements and readiness

Materialise a stable `(shop, order, piece)` identity from the **pinned acceptance
manifest**, retaining its stable piece key, exact catalogue/form/template
references, bilingual labels, applicability/reason and source digest. Do not use
array position or the current catalogue as identity. Required applicable pieces
are instantiated; reviewed not-applicable pieces retain their scoped reason in
the structural snapshot without pretending they were completed. Unresolved
applicability remains visible and cannot silently remove work.

Inspect the incumbent projection carefully: its flattened requirement items do
not currently expose piece scope, although the pinned definition contains scope.
Resolve `(section, source key)` through that exact definition into piece/add-on
scope; reject missing, ambiguous, foreign or inconsistent mappings. Order-wide
requirements remain order-wide and appear as shared prerequisites where relevant.
A linked requirement never migrates to a sibling because its label matches.
Keep source keys, task edges, default owner, optional/unresolved/not-required
distinctions and current projection engine; do not create another template engine.

Initial piece state is Booked with unresolved requirements, not Ready. Separate
progress, assignment, requirements, approval, money, custody and handover. A pure
read projection accepts typed future execution facts and exposes the least-advanced
unresolved piece plus all blockers under product §27; it cannot write execution
facts. Optional undecided is not completed; not-required needs an explicit reviewed
source. A bottom blocker must remain visible when a top is ahead. No task counts
or percentage establish readiness. In this slice, persisted execution remains
unavailable and summaries say so. Future-state unit fixtures are labelled
projection tests, never evidence that a top was physically delivered.

Existing accepted orders are not silently regenerated. Ticket A provides a
versioned read adapter deriving legacy pieces from the stored manifest and stable
keys, and an explicit idempotent materialisation command when relational IDs are
needed. The command takes the order precondition, verifies exact source digest,
and appends provenance without editing acceptance snapshot, promise or demand.
Missing historical content fails closed with an explicit unsupported state; never
substitute current definitions. New acceptance writes piece records in its original
transaction. Future execution references require the materialised piece ID, not a
transient label or index. Privacy redaction remains a separate audited boundary.

## Price basis and commercial authority

All amounts use existing exact paise parsing/safe serialization and database bigint.
An intake quote is neither a customer approval nor an invoice, receivable, deposit
or revenue. Group creation/linking creates no financial event or job.

| Basis | Visible meaning | Authority and unknowns |
| --- | --- | --- |
| Garment prices | Each garment has its own quoted amount or To be quoted. | Aggregate only when every included amount is known; otherwise show known subtotal and count of unquoted garments, never a complete total. Explicit zero stays zero. |
| Package price | One explicit package quote covers an enumerated frozen set of garments and inclusions. | Package amount is the commercial headline; do not add garment reference amounts again. Per-garment allocation basis is separately recorded as unresolved or explicitly reviewed. No automatic split. |

A package version records scope/member identities, price state/amount, included
versus separately chargeable scope, actor/time/reason and predecessor. Never
infer that a blank line is free, bundled, or proportionally priced. Any separately
chargeable scope must be explicit and enumerated; the initial package UI can
restrict all listed garments to included scope to avoid ambiguous totals.
Synthetic package examples have invented demonstration amounts, not approved rates.
Owner-reviewed full line breakdown must exactly reconcile to the package amount;
partial/unknown breakdown stays unresolved. For no positive line charge FIN-05
leaves credit unallocated. **1.4.1/1.4.2** own actual approval/terms and the canonical
allocation routine, including whole-rupee floors and largest-charge remainder.
Until reviewed charges exist, later allocation/partial settlement must block
with an explanation; booking intake can still preserve the package proposal.

Initial linking of already accepted orders supports **garment-price aggregate
only**. Their immutable quoted prices remain unchanged. Repricing those orders
as a package requires the later reviewed commercial-change workflow, not a grouping
shortcut. New grouped intake can record a package proposal; its per-order snapshot
explicitly references that package version and distinguishes included reference
amounts from independently chargeable amounts. Unknown included allocations are
not encoded as quoted zero. Do not broaden old v1 price semantics silently:
introduce an additive versioned commercial-basis contract at the consumer boundary.
Package approval, cancellation charges, discounts, rates and partial-piece price
breakdowns require product §32 inputs; this packet invents none of them.

## Linking and acceptance transaction

Proposed initial scope: one active booking per garment; create booking from
ungrouped accepted orders or attach an ungrouped accepted order to an existing
booking with explicit review/reason and versions. No unlink, transfer, merging
bookings, wearer correction or silent reparenting. Those corrective operations
remain **1.2.4** with commercial-history review. Retain immutable membership history
and original commitments. Cross-shop, duplicate, unauthorised, wrong-contact and
already-grouped targets fail the entire command. Concurrent attach races yield
one membership; the loser receives conflict after authority checks.

For new garments, propose **all-or-nothing acceptance**. Partial acceptance would
need a separately approved command/outcome and explicit remaining draft semantics;
it is not a fallback after a failed group command. Draft line UUIDs are stable
through edits/reordering, and durable `(shop, origin group draft, line ID)`
uniqueness outlives request-key expiry. A line is one garment, never a quantity
multiplier hiding separate wearers or promises. Existing linked orders are not
accepted again, and their demand is counted exactly once from existing rows.

Reuse the command/draft machinery and `evaluateCommitment`. The current
`resolveOrderAcceptance` is private and interleaves source/capacity resolution;
do not call single-order promotion repeatedly or nest transactions for a group.
Refactor only the necessary reusable preparation/evaluation seam, preserving its
single-order behaviour and failure tests. In one membership-checked transaction:

1. Lock request key and group draft, then involved booking/order targets and
   identity authorities in a documented deterministic order. For multiple
   customers/wearers sort canonical UUIDs within each lock class. Recheck
   permissions, versions, origins and membership after locks.
2. Acquire catalogue → forms → templates → commitments → bindings → calendar →
   policies → shop/profile publication locks in the incumbent publisher-compatible
   order. Resolve every line before taking a later lock class; never interleave
   one line's capacity lock with another line's earlier source/identity lock.
3. Acquire distinct stable `(shop, canonical category)` capacity locks sorted by
   canonical category ID, matching current `lockCapacity` granularity. Different
   promised weeks do not create a new incompatible lock scheme. Lock readable
   code allocation after capacity locks, as incumbent acceptance does.
4. Read current server clock, policies, source authority and demand under those
   locks. Evaluate deterministic line order, adding earlier candidate demand in
   the same category/week to the in-transaction effective load. Two new garments
   cannot both consume the same last slot. Review binds the whole candidate set,
   its stable ordering, current load/source versions, warnings and decisions.
5. If every line passes explicit current authority/review, write booking/context
   version, orders, exact intake/acceptance and package references, pieces,
   requirements, one demand per new garment, memberships, promoted draft/result,
   audit and request result atomically. Enqueue only an actually required job;
   this slice needs no financial/outbound/production job. Failure after any write
   rolls everything back. Never return a partially committed success.

Grouping accepted orders omits capacity evaluation/writes and code reallocation
for those orders. Keep their retained demand after later completion under the
approved #114 convention. Pieces add zero demand; garment-count basis is reused.
Effort-point acceptance stays blocked without reviewed comparable mapping.
Client totals, approved flags, timestamps, load and fingerprints do not authorise
acceptance; the server recomputes and compares the complete review.

## Storage, interfaces and recoverability

Proposed records, allocated only when the selected ticket starts: `order_piece`
and scoped requirement links/provenance; `booking`, immutable `booking_revision`,
membership/current uniqueness plus immutable membership history; immutable
package quote versions/scope and group-origin mappings. Every tenant table has
non-null shop_id, composite tenant FKs, shop-led indexes/uniqueness, matching
read/write ENABLE/FORCE RLS and app_user grants. Include composite order/piece
ownership checks so a same-shop piece from another garment is also rejected.
Preserve original and current commitments in existing order snapshots.

Keep contracts, framework-free core, transaction-bound repository interfaces/DB
adapters, thin Hono routes and typed clients in existing modules/packages. Proposed
operations are grouped draft save/list/resume/review/promote, booking read/history,
link ungrouped orders and piece read/materialise. Use versioned strict DTOs,
not vendor routes/contracts or generic JSON mutations. Node Next route mounts
remain unchanged; no business Server Actions. Allocate a human-readable booking
code only after owner review of prefix; existing QO numbering is unchanged and
booking numbers never become invoice numbers.

Reuse durable drafts, IME-aware autosave, exact-key promotion and current recovery
controller. Each group line retains its own canonical Quick Order input plus
piece annotations and price-basis reference. Mode/language/viewport changes must
preserve every hidden field, unknown value, line identity, ordering, source and
dependency. A booking-wide display toggle is a projection; changing a saved
per-order mode still uses that order's versioned audited command. Bulk business
edits are never implied by a display toggle.

Saving/Saved/Not saved/Checking outcome/Conflict have incumbent meanings. Freeze
key/action/payload/If-Match for uncertain commands; preserve newer typing in memory.
Lost group acceptance recovers via the promoted draft's durable result after
restart. Check origin uniqueness even after key expiry. 428 missing precondition,
412 stale version, 409 domain/source conflict and 422 malformed input or
idempotency mismatch follow
the incumbent contract; authorised current comparison never exposes a denied
member. No automatic merge of membership, piece scope, approvals or money.
No business data in browser storage, service-worker cache, URLs or logs. Search
uses existing Tamil/Tanglish/English vocabulary and body-based queries; cache/form
memory clears on sign-out, shop switch and access revocation.

Review additive SQL under the advisory-lock migration runner. Do not reserve a
migration number now, backfill current catalogue over old orders, change runtime
role or use destructive down migrations. Test upgrade with populated Quick
Orders and a legacy manifest. Compatible rollback retains new identities/history
and hides unsupported commands. Back up before non-disposable schema application;
restore quarantine/epoch, money freeze, privacy/retention and pilot gates remain.

## Acceptance ownership

GB identifiers below are stable packet checks, not new product requirements or
claims of completed software acceptance.

| ID | Requirement/scenario | Proof required; ownership |
| --- | --- | --- |
| GB-01 | ORD-02/03, AC-01 structure | Optional shared booking, two QO IDs/wearers, independent instructions/promises/status and exact service kind. B/C; standalone service intake 1.2.3, retail 2.5.2. |
| GB-02 | ORD-13, AC-63 structure | Stable top/bottom/dupatta identity from exact reviewed definition; scoped forms/requirements, unresolved bottom remains visible. A/C. Measurement/task/custody execution and actual partial handover remain later. |
| GB-03 | ORD-14, FIN-02/04/21, AC-01 | Explicit aggregate/package basis, unknown versus zero, known subtotal, frozen package scope; zero postings/allocations/revenue duplication. B/C; actual commercial approval/allocation 1.4.1/1.4.2. |
| GB-04 | SET-11, AC-60 integration | Linking accepted orders and pieces add zero demand; new multi-line candidates count once and cumulatively under stable locks. B/C with real PostgreSQL. |
| GB-05 | CUS-02/07, TRU-01/03/05/13, AC-02/38/53 | Membership and every wearer reauthorised; missing context, cross-shop and wrong-order piece, payer/guardian denial and permission withdrawal races. Every ticket. |
| GB-06 | USE-08, AC-55 | Concurrent duplicate linking, first/last capacity slot, opposite line/category orders, publisher/guardian races, actual-write rollback, exact-key replay and changed payload/stale/missing preconditions. Every affected command in PostgreSQL. |
| GB-07 | USE-03/04, AC-40 | Server drafts reload/second session, uncertain save/promotion/recovery, IME/newer typing, dirty navigation, source drift and exact origin conversion. B/C; A keeps Quick Order regression. |
| GB-08 | SET-08/10, ORD-12, AC-07/59 contribution | Historical source snapshots survive rename/disable; legacy adapter/materialisation is exact, one-time and attributable; lossless modes/language/layout and source provenance. Every ticket. Full history/repeat 1.2.4. |
| GB-09 | USE-01/02/09, TRU-07 | English/Tamil, both themes, 360×800/820×1180/1440×900, keyboard/axe/reflow/IME, long labels and sign-out clearing. Every ticket. Physical Android/fluent Tamil/AT remain human gates. |
| GB-10 | §27 lifecycle; §33 readiness | No measurement values, payment/bill/production/custody/handover mutation; typed future projection tests do not complete AC-63. Every ticket; 1.8.3 owns real partial handover. |

Review proposals requiring explicit selection are enumerated in the ticket packet.
No future execution module is a blocker for base booking or piece identity.
