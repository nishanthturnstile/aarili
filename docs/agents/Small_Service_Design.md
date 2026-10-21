# Alteration and small-service intake: independent design

20 October 2026. Roadmap **1.2.3**. **A–C/D1–D6 approved and published as
#124–#126; A/B merged and C (#126) selected. Production content/activation remain unapproved.**
[REA observations and limits](Small_Service_REA_Evidence.md),
[vertical tickets and decisions](Small_Service_Ticket_Packet.md),
[delivery/check status](Small_Service_Implementation_Evidence.md).

## Authority and integrated baseline

Product §§3, 6–9, 11, 13, 15, 17, 24–25, 27, 29.1, 30.1, 32–33 govern behaviour;
architecture §§6–11 and 15 govern technology and integrity. Read the
[workflow](Development_Workflow.md), [tracker](issue-tracker.md),
[design system](../aarili-design-system.md),
[Quick Order design](Quick_Order_Design.md),
[Quick Order acceptance evidence](Quick_Order_Acceptance_Implementation_Evidence.md),
[grouped design](Grouped_Bookings_Design.md),
[grouped intake evidence](Grouped_Bookings_Intake_Implementation_Evidence.md) and
[service-template design](Service_Templates_Design.md). Do not treat their historical
pending-review wording as current tracker status.

Integrated development **63d5123** contains Quick Order #113/#114 via #115/#116,
catalogue/forms/templates/presentation/bindings #97–#101 and grouped #118–#120
via #121–#123. #123 merged 20 October 09:47:12 UTC; its fast/audit gates passed.
At research baseline only Dependency Dashboard #28 was open. The subsequent owner
approval published #124–#126 and selected A. A/B subsequently merged through
#127/#128; the owner selected C on updated development `8e708e8`.
[C implementation evidence](Service_Line_Completion_Implementation_Evidence.md)
records verification and remaining owner/merge gates. Historical planning
observations do not override those approvals.
Existing production-authority, privacy, restore and pilot gates remain unchanged.

This contributes **ORD-14**, **JOB-09 intake** and the future **JOB-08** connection,
plus ORD-01/02/04/05/06/08/11/12, SET-03/04/08/10/11, CUS-02/07,
TRU-01/03/05/06/10/12/13 and USE-01–04/08/09. **AC-50 remains partial.**
Trials, correction causes/cost/fit outcomes are 1.8.1; execution 1.7.1;
quality/readiness 1.8.2; custody receipt/movement/return 1.5.1 and later material
slices; actual handover 1.8.3; money/agreements/documents their 1.4/1.6 slices.
No conflict with either authoritative baseline was found. The wearer/count
limitations described below were baseline implementation gaps; A addresses the
standalone path without changing custom-order policy.

## Selected A implementation boundary

`service.intake-profile` and `order.service` schema-v1 workflows reuse durable
draft publication and exact-key recovery. A reviewed profile pins the manifest,
wearer applicability and per-line capacity coverage. The existing order allocator,
commitment evaluator and positive accepted-demand rows remain shared; custom
readers explicitly select custom intake. Four new tenant tables hold profile
history/head, property subjects and independent immutable intake lines.

Explicit no-measurement forms now support both alteration and small-service
definitions. Alteration profiles still require an authorised wearer; only reviewed
non-fit small services with explicit no-body forms may omit one. Each accepted
line's `sourceRevisionId` is the exact intake-profile revision; that revision pins
the manifest and its exact base/add-on catalogue revisions. Labels, prices, selected
applicability and requested work are frozen separately per line. Unselected optional
add-on requirements become not-required; selected task requirements remain unresolved.
This projection supplies no execution or completion evidence.

All new acceptance remains synthetic-only behind the existing configuration gates.
The [implementation ledger](Small_Service_Implementation_Evidence.md) records fresh
verification and human acceptance still owed. B/C and full AC-50 remain open.

## Owner journeys and information hierarchy

**Existing kurti:** Orders → New alteration or small service → existing customer →
reviewed alteration service → minimal garment description and requested work →
applicable wearer/guardian → price or To be quoted → agreed delivery → Save draft
or Review commitment → Confirm booking → reopen durable service detail. Example
synthetic text: “Blue kurti, shorten hem; preserve border.” No full measurement or
pattern form. A request such as shortening by a stated distance remains a garment
instruction; it never updates a body-measurement version.

**Saree fall/pico/pre-pleating:** one physical saree subject, multiple stable service
lines selected from reviewed definitions, each with requested work and price
state. No body/wearer form where the reviewed service declares it inapplicable.
No fabricated person is created to satisfy a foreign key. One shared delivery
commitment belongs to this independently traceable service order; a different
physical garment is another order. A draft can remain incomplete.

**Custom-order add-ons:** at intake, select exact applicable add-ons and show
separate price/state rows beside the existing custom requirements. After acceptance,
Add service opens a recoverable change draft against that exact order version.
Review original scope, added work, supplemental price basis and capacity impact;
then explicitly accept the additional work. Reopen shows original acceptance and
each subsequent addition, rather than a rewritten original manifest/price.

**Follow-up correction:** an optional authorised source order/piece reference can
identify the earlier garment on a newly created alteration intake. New work has
its own identifier/date/price and no inherited approvals or cleared balances.
It does not reopen or erase the old order, manufacture a trial/delivery state,
classify avoidable rework, decide chargeability or settle a complaint. Full
trial-to-correction and governed lifecycle reopening stay 1.8.1/1.8.4. A walk-in
with no Aarili source order never needs an invented source or delivered state.

## Presentation and accessibility

The scoped [surface brief](Small_Service_Surface_Brief.md) records the incumbent
Operate extension and the finish-review capture matrix; it introduces no new
visual-system authority.

This is an **Operate** extension of the existing Orders surface for the solo
owner at the counter. Retain Current light/dark, existing semantic UI roles,
Base UI controls, Noto Sans/Noto Sans Tamil, 16px body, Tamil line height and
44px targets. Reference roles are page `#faf6ed`, text `#282323`, card `#fffdf8`,
primary `#751f3d`, primary text `#fff9f1`, boundary `#89796b`; actual code uses
`packages/ui/src/globals.css`. No replacement identity, extra font, component
library, animation scheme or separate intake application.

The user-supplied brief and these committed sources already settle audience,
purpose, visual authority and preservation constraints. Apply frontend-design and
impeccable as scoped design guidance; do not create competing PRODUCT.md/DESIGN.md
baselines or require another brand interview. A extends the incumbent application UI.

The heading identifies the service and nearby server save status. Group related
customer/property/request fields, then the selected line rows, then delivery and
review. Disclose source-order reference, optional context and detailed requirements
progressively. Do not show a second full custom-order wizard under a service title.
Use “Service work recorded complete” for the bounded completion action; garment
ready/collected labels require their later facts. Mark property as “Customer-owned
garment; receipt not recorded” while no physical receipt exists.

Phone 360×800: one form column, wrapping line labels, labelled amount and state per
line, reachable Save draft and Review commitment above bottom navigation/keyboard.
Tablet 820×1180 and landscape: related fields may pair; detail/review can sit beside
the form when space permits. Desktop 1440×900: form and readable review column.
No compressed desktop table, clipped Tamil, hover-only actions or colour-only
meaning. Keyboard order follows the task, errors link to inputs, dialogs contain
and restore focus, IME composition is preserved and live save announcements are
polite. English starts per incumbent owner convention; explicit Tamil switching,
Simple/Detailed, themes and viewport changes retain canonical inputs unchanged.

## Reuse seams and the changes they actually require

| Existing implementation | Reuse and necessary extension |
| --- | --- |
| `contracts/service-catalogue.ts` | Existing serviceKind alteration/small-service and exact add-on revisions. Never identify applicability from an English label. |
| `contracts/measurement-forms.ts`, `core/service-templates.ts` | Existing explicit not-required forms and requirement projection. New versioned intake applicability pins reviewed service/manifest/form sources; absence of a form is not authority. |
| `contracts/orders.ts`, `core/orders.ts` | QuickOrder command requires wearer; readReferences flags omission; acceptance fixes candidate=1 and blocks effort points. Extract shared verified identity/source/commitment seams, then add a discriminated service contract. Preserve strict historical accepted readers, v1 custom behaviour and v2 package commercial meaning. |
| `db/orders-schema.ts`, migrations 0030/0033 | wearer_id NOT NULL, accepted snapshot and demand immutable, SQL provenance accepts only quick/group drafts. Explicit expand/constraint/guard changes are required; merely making a browser field optional is invalid. |
| `core/order-pieces.ts`, migration 0031 | Exact piece/addonKey requirement scope exists. Reuse pinned identities/projection; multiple service lines need their own relational IDs, prices and states. An empty piece set must not create a fake garment component. |
| `core/group-intake.ts`, `core/bookings.ts` | Same-contact optional membership, sorted capacity locks and package proposal semantics. Adapt supported service records explicitly; preserve atomic all-or-nothing grouped custom intake and frozen included scope. |
| `core/drafts.ts`, `draft-recovery.ts`, typed draft clients | New versioned workflows in the existing registry; same autosave, ETags, work guard, exact-key outcome recovery and durable promotion result. No second draft engine. |
| `db/orders-repository.ts`, commitment evaluator/bindings | Same tenant transaction, publisher-compatible lock order, authoritative source/load re-read and evaluator. Add reviewed demand mapping and immutable incremental demand; never edit old demand. |

Use module files inside existing contracts/core/db/api/i18n/UI boundaries, never
a speculative package. Thin Hono Node routes validate/authorise/call/map; typed
clients carry strict Zod DTOs. No business Server Actions or vendor SDK in core.
Application dependency/toolchain pins do not change.

## Canonical identity, snapshots and commercial facts

Approved model, adopted only through each selected approved ticket:

- Reuse the order identity/code allocator and acceptance lifecycle. Add an explicit
  intake kind to distinguish custom and lightweight service contracts. Existing
  custom rows remain wearer-required. Expand nullable wearer only with a checked
  service branch that references exact reviewed not-applicable authority. Existing
  personal relationships remain composite tenant references; never default a
  missing wearer to payer/self or create a placeholder profile.
- Pin a reviewed service intake profile to exact catalogue/manifest/form revisions,
  wearer applicability, minimal subject requirements and capacity mapping. Record
  actor/time/reason, predecessor and synthetic/production authority. Source edits
  cannot rewrite accepted work. Production content stays unavailable until review.
- A stable service subject identifies one customer-owned kurti/saree: opaque ID,
  minimal description, optional owner reference and declared intake context.
  No received quantity, receipt time, location/custodian, stock valuation or return
  fact. A source order/piece link is tenant-composite and independently authorised.
  At 1.5.1, an explicit receipt links to this subject rather than identifying the
  physical garment again from free text. Subject identity alone is not custody.
- Each selected service line has stable UUID/order/subject/piece scope, exact
  catalogue/manifest/add-on source, frozen bilingual definition, requested work,
  owner, optional exact task reference, price basis and initial explicit state.
  Preserve source keys even if labels/availability change. Requested/not-required
  lines retain their applicability reason; omitted work is not secretly completed.
- Quoted amounts use exact integer paise. To be quoted is null, explicit quoted
  zero remains zero. Standalone sums include additive lines once and expose an
  incomplete total if any charge is unknown. An included/bundled reference is
  visibly included with unknown allocation, never a zero charge or another total.
  No invented rates, taxes, costs, receivables, balance or payment events.
- Freeze original acceptance (including line versions), original/current promise,
  authority snapshot, reviewed capacity facts, sources and digest. An evolving
  current view combines explicit accepted supplemental revisions and line-state
  events with that original snapshot. It never changes the original digest.

## Wearer and guardian applicability

Reviewed saree finishing that collects no wearer-specific information may omit
wearer. A fit-specific kurti alteration identifies its wearer using existing
permissions. A declared source garment with a wearer retains that relationship;
not-applicable cannot be used to strip its privacy boundary. Changes in service
selection that require wearer information invalidate prior review and expose only
the relevant identity fields, not a full body form.

If a minor-specific record is collected, retain the under-18 flag and verified
parent/legal guardian order authority. Payer status/family phone is insufficient.
Minor measurements/photos are unsupported here, including numeric body values
disguised as an intake feature; no attachment/body-measurement controls are added.
Requested garment work is stored against the order, never an authoritative body
measurement. Future measurement/photo capture must additionally check purpose
consent. Draft/replay/read/accept/change/completion recheck current membership,
relationship/service permission and guardian authority where applicable. Revocation
must not expose stale labels through lists, errors or stored replay results.

## Reviewed capacity without duplicate demand

Retain owner-approved custom conventions: one accepted outfit/garment contributes
one to its promised-delivery week; pieces/tasks do not multiply it; drafts/reviews
contribute zero; completed demand is not released. Existing count rules, code
format and synthetic gates are reused without another approval request.

Small services need a **new reviewed mapping**, not the custom default. Proposed
versioned mapping pins exact service/add-on/profile, canonical category, existing
unit (`garments` or `effort-points`), integer quantity/basis, coverage group,
applicability, reason and authority. One garment-count coverage group contributes
once per physical subject/order even if it contains fall+pico. A separately
reviewed incremental service may contribute its own demand; do not infer either
zero or one from “small.” All supported lines on one service order map to the
same canonical category/unit; incompatible categories remain blocked and can be
separate orders. Existing grouped orders may span categories via sorted locks.

For effort points, each included line/group needs comparable reviewed demand;
unknown mapping blocks acceptance. Existing custom effort acceptance remains
blocked unless its own reviewed mapping is supplied; this is not global effort
activation. Mixed historical count/effort demand is incomparable and fails closed;
do not convert past counts or change the active unit silently. No actual production
mapping values are proposed as approved data. Synthetic fixtures are conspicuous.

At acceptance, server derives unique covered components, sums each once, locks the
canonical category and current source pointers, reads authoritative load and calls
the real evaluator. Positive initial demand is recorded atomically with order,
lines, snapshot, audit, promotion and idempotency. Unmapped or zero-total standalone
work cannot bypass the capacity guard; draft is retained with an actionable gap.

For later additions, preserve original immutable `order_capacity_demand`. Persist
an append-only supplemental-demand record keyed to the accepted change/line/coverage
and same category/week; include both original and supplemental sources in the
shared load query. An explicit reviewed already-covered addition records its
coverage link and zero incremental effect, not another base demand row. It does
not fabricate a positive quantity to satisfy the current `quantity > 0` check.
Reevaluate the new current demand; link accepted coverage to original sources so
retry, attachment and grouping cannot count it twice. Line completion never releases
capacity. Rescheduling, cancellation/release and unit conversion stay later.

Preserve lock class order: request key/draft and relevant aggregate revisions;
sorted customer/wearer authority; catalogue → forms → templates/intake profiles;
commitments → bindings/mappings → calendar → policies → profile;
sorted canonical-category capacity locks; then code allocation. New mapping
publishers follow the same prefix. Aggregate-change and presentation commands must
share a documented order/CAS protocol; test the actual lock graph, not this prose.

## Governed additional work on accepted orders

Ticket B proposes a narrow additive amendment, not the general design-change,
cancellation or settlement engine. Recoverable change draft stores exact parent
order/version/digest, stable line IDs, requested scope and reason. Re-read customer,
wearer/guardian, sources, package membership/commercial revision, existing line
coverage, load and original/current promise under transaction locks.

Review freezes added definitions/instructions, quoted/to-be-quoted price and its
additive/included basis, original/current date, affected task scope, capacity delta
and exact agreement evidence. Confirmation is a new owner-recorded attestation
for this scope/version/date and quoted price where known; it never reuses an old
approval. Unknown price stays unresolved, not an approved zero. No general customer
approval service is claimed. Later 1.6 approval consumers reference the exact
supplemental revision/evidence and must not treat an old approval as covering it.
This bounded addition keeps the existing delivery promise unchanged. If extra
work requires another date or its agreement impact is unknown, retain the draft
and block acceptance until the later governed promise/change capability applies.

Atomically append accepted supplemental revision, lines, requirement-scope links,
capacity components, minimal audit and exact-key result; CAS the order aggregate.
Missing/stale preconditions return 428/412. Source/review/membership changes return
409; invalid/changed-key payload returns 422. Original lines, prices, dates, promises,
measurements, snapshots and any issued documents remain byte-identical. Do not
delete/reinsert the parent's old requirements to append work.

For a package, retain the frozen included member set and package proposal. A newly
charged add-on is explicitly **outside** that frozen package, with its own
supplemental proposal/attestation; current view displays base package and extra
charges distinctly. Merely grouping, selecting “included,” or changing reference
prices cannot revise package terms or allocate its amount. New included work
requiring package repricing is blocked for the later governed commercial change
capability; keep the draft. Garment-price bookings sum extra known charges once
and retain unknowns. Existing same-contact membership remains optional; grouping
alone causes no capacity or commercial mutation.

New custom/grouped intake can select independently priced add-ons through the
same line model, freezing them at acceptance and including them in whole-set
review. Existing custom paths with no selected add-ons retain exact behaviour;
legacy pinned add-on requirements are never auto-priced or auto-completed from
current catalogue. Explicit provenance-aware materialisation may initialise pending
lines with unknown prices, requiring review before any new commercial commitment.

## Independent bounded completion

Ticket C proposes owner-recorded completion for a reviewed, taskless small-service
line only. Initial states are **pending**, **not-required** (explicit reviewed
applicability/reason), and **completed**. A price of zero, missing task, hidden field,
empty checkbox or another completed line never supplies completion evidence.

`pending → completed` requires current owner authority, exact accepted line revision,
If-Match, an explicit recorded-work attestation and short completion evidence/note.
Server supplies actor/time. Append an immutable transition and advance the line
version atomically with audit/idempotency. An erroneous completion is corrected
by a linked `completed → pending` transition with reason; preserve the earlier
event. A not-required line cannot be completed without a reviewed applicable
scope addition. Required accepted work cannot become not-required as a shortcut;
scope removal/cancellation remains its later governed capability.

Where an optional task reference exists, show its exact link and unresolved state;
line completion stays blocked until the actual task-execution integration supplies
the required fact. C does not implement ready/in-progress/blocked task scheduling,
predecessor execution, cutting release or the general production engine. Taskless
line attestation does not clear material/consent/approval gates for other work.
Never advance garment/piece ready, quality, customer fit acceptance, custody,
money, booking fulfilment or handover. Display each line's own price and state;
one of two completed add-ons leaves the other pending. Summary reports counts and
outstanding work, not a false “order complete.”

## Drafts, transactions, migration and recovery

Use existing durable draft registry, schema versions, promotion results and form
work guards. Autosave after a pause, defer during IME and show Unsaved/Saving/Saved/
Not saved/Checking outcome/Conflict/Source changed honestly. Incomplete description,
date, identity, mapping or price may be saved without booking capacity. Reload
recovers acknowledged revisions only. Freeze key/action/body/precondition during
unknown outcomes; preserve subsequent typing in memory until resolution. Durable
origin/line/change uniqueness outlives key expiry; a changed payload cannot replay.
No auto-merge of price, identity, measurement, approval, property or scope.

The current registry accepts one schema version per workflow name. Register
`order.service` and `order.service-change` at schema version 1; retain existing
`order.quick`/`order.group` v1 payloads and strict historical parsers. Add-on-capable
custom/grouped entry uses explicit conversion into a supported versioned adapter/
workflow, preserving originals and durable target results. Do not add extra fields
to strict old DTOs or silently reinterpret already saved drafts/accepted snapshots.

Membership-checked `withShop`, runtime `app_user`, non-null shop_id, composite
tenant order/line/piece/source/relationship references, shop-led indexes/uniqueness,
ENABLE/FORCE RLS with matching read/write policies. Tenant checks cover lists,
drafts, history, source links, capacity mapping publication, completion and replay.
SQL guards validate the new workflow/version branches and exact atomic provenance;
never weaken the old quick/group acceptance or immutable-child guards globally.
No personal text in jobs/logs/URLs/audit deltas; keep private typed text behind the
existing privacy/redaction/tombstone boundary. Memory-only browser/query data is
cleared on sign-out, shop/access change. No service-worker/business storage cache.

Allocate migrations only when the selected ticket starts from newly integrated
development. Reviewed expand migrations add records and conditional service
constraints without fabricated backfill. Upgrade a populated 0033 database and
retain old digests/package/pieces/guard semantics. Nullable wearer makes an old
custom-only binary unsafe for service reads: rollback requires a compatible
reader/deployment gate that disables new writes and safely rejects unsupported
service versions. Do not claim arbitrary older binaries are compatible. Retain
new history/tables; no destructive down migration. Backup before non-disposable
schema work; no production migration or live restore into dev. Restore quarantine,
money freeze and privacy/pilot activation gates remain unchanged.

## Acceptance matrix

All rows are **required future implementation proof**, not completed acceptance.
A/B/C refer to the [ticket packet](Small_Service_Ticket_Packet.md).

| ID | Requirement/scenario contribution | Required proof / ticket |
| --- | --- | --- |
| SS-01 | ORD-14, JOB-09, AC-50 intake | Kurti alteration draft → accept → reload, minimal garment/request, no full measurement/pattern or delivered prerequisite; distinct new identifier and optional authorised original link. A. |
| SS-02 | ORD-14, ORD-05/06 | One saree, fall+pico/pre-pleating selectable independently; inapplicable wearer/body/pattern forms absent under reviewed applicability; multiple exact line IDs. A. |
| SS-03 | ORD-14, FIN-03/04 intake | Two prices independent; missing vs quoted zero; incomplete totals, included references, package plus extras counted once; no ledger. A/B. |
| SS-04 | ORD-14, JOB-05 bounded | Complete only one taskless reviewed line, other stays pending; not-required distinct; task-linked/unreviewed completion denied; attributable correction retains old event. C. |
| SS-05 | CUS-02/07, TRU-03/05/13, AC-53 | Optional wearer only on exact not-applicable service; fit-specific adult permission; minor aunt denied guardian authority, revoked authority blocks read/replay/accept/change/complete; no body/photos stored. A–C. |
| SS-06 | MAT-01/02/04, AC-50 partial | Stable customer-owned subject and scoped link, no stock/receipt/custodian/return/handover facts; later receipt must reuse identity. A/B; physical proof remains 1.5.1. |
| SS-07 | ORD-12, SET-08, TRU-06/12, AC-07 partial | Definitions edited/disabled later do not alter old line labels/prices/requirements/digests; exact source order/piece and amendment chain remain authorised/readable. A/B/C. |
| SS-08 | ORD-14, ORD-12, FIN-03, AC-55 | Accepted add-on uses durable governed draft, exact parent/review/attestation, append-only revision; original digest/package/price/promise unchanged; stale/overlapping scope additions conflict. B. |
| SS-09 | SET-11, AC-60 | Missing mapping blocks; reviewed coverage counts once; effort comparable/unknown checks; source edit invalidates review; authoritative capacity and grouped candidates under sorted locks; added-demand retry/completion/grouping cannot duplicate or release it. A/B/C. |
| SS-10 | USE-03/04/08, AC-40/55 | Incomplete save/reload/resume, network failure, unknown-outcome exact replay, session recovery, dirty navigation/IME, missing/stale ETag, actor/action/payload mismatch and expired-key durable uniqueness. A–C. |
| SS-11 | TRU-01/06/12, AC-38/55 | Real PostgreSQL app_user FORCE RLS, missing context/pool reuse, cross-shop and wrong-order refs, direct SQL guard attacks, acceptance/source/guardian/amendment/completion races; injected failure after actual writes rolls back every row/audit/key/demand. A–C. |
| SS-12 | USE-01/02/09, SET-10 | English/Tamil, both themes, 360×800/820×1180/1440×900 plus tablet landscape; keyboard/focus/axe/IME/enlargement/reflow/recovery. Human Tamil/AT/physical Android remains separate. A–C. |
| SS-13 | ORD-02/03/13/14, AC-01/63 structure | Existing Quick Order and grouped custom paths/prices/pieces/package/conversion/recovery remain valid; optional grouping adds no demand; selected add-on changes do not affect another garment. A/B/C. |
| SS-14 | §27, AC-50 remainder | Assert no payment, bill, stock/custody move, task execution, trial/quality/ready, actual handover/message or production activation. Retain later 1.4/1.5/1.6/1.7/1.8 acceptance explicitly. A–C. |

Full AC-50 additionally needs quoting/agreements, assigned execution, physical
custody, completion/quality, billing and actual handover evidence through those
later slices. JOB-08 trials and JOB-09 cause/chargeability/direct cost/agreement
are not closed by intake or the bounded line-completion command.
