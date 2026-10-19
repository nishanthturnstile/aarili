# Create and Recover a Quick Order: independent design

19 October 2026. Roadmap **1.2.1**. **A-B approved; A merged in #115.
The owner selected #114 (B) and approved the count/week/code conventions below.
Production policy remains unapproved.**
[Research evidence and gaps](Quick_Order_REA_Evidence.md),
[vertical tickets](Quick_Order_Ticket_Packet.md),
[current delivery status](Quick_Order_Implementation_Evidence.md).

Primary traceability: **ORD-01, ORD-04, ORD-05, ORD-06, ORD-11, USE-03,
USE-04, USE-08**; intake/recovery scenarios **AC-40, AC-55, AC-59** and
**SET-11 / AC-60** acceptance integration. QO checks below identify partial scope.

## Authority, current state and scope

Product §§3–9, 15, 17, 24–25, 27, 29.1, 30.1, 32–33 govern behaviour;
architecture §§6–11/15 govern boundaries and integrity. The
[workflow](Development_Workflow.md), [tracker](issue-tracker.md),
[design system](../aarili-design-system.md),
[template design](Service_Templates_Design.md),
[presentation evidence](Workflow_Presentation_Implementation_Evidence.md) and
[binding evidence](Commitment_Bindings_Implementation_Evidence.md) are reused.
Competitor observations do not supply policy values or implementation contracts.

A implementation baseline (rechecked at its start on 19 October): development `ca6aad0`
includes all A prerequisites, #111 and #112. Promotion #110 merged at `29c4975`;
[run 39231567178](https://github.com/nishanthturnstile/aarili/actions/runs/39231567178)
passed scaffold, all three browser projects, audit and aggregate checks.
The owner approved/published A-B as #113/#114 and selected A. Earlier planning
status and failed promotion heads are retained in the historical preparation
ledger, not treated as current state.

A supplies the draft portions of AC-40/55/59. Atomic booking, accepted snapshots
and AC-60 stay in B; sharing, agreements, advances and later execution remain in
their slices. English startup remains the recorded convention; fluent Tamil and
physical-device review remain human acceptance gates.

## Owner outcome and presentation

Operate surface, for the solo owner taking a repeat-customer blouse order at
the counter. Success means locating the right wearer, preserving incomplete
work and seeing exactly whether a delivery commitment was accepted. The main
visible distinction is **Saved draft** versus **Order booked**.

Use Current light/dark, canonical UI token roles and local Noto Sans/Noto Sans
Tamil. Reference palette: page `#faf6ed`, text `#282323`, card `#fffdf8`, primary
`#751f3d`, primary text `#fff9f1`, boundary `#89796b`; actual styling consumes
`packages/ui/src/globals.css`, never a copied palette. Use existing 16px body,
Tamil line height, 600 headings, radii, fields, dialogs, buttons and status.
No visual redesign, extra font/component library or new application shell.

Workspace → Orders offers New order and Resume drafts. Dashboard can link to
the same draft list without pretending the operational dashboard is complete.
Orders shows accepted records and clearly separated recoverable drafts. Search
terms stay in request bodies; only opaque record/draft IDs enter URLs. Empty
states invite starting intake; no sample orders appear as real work.

Simple intake uses the plan's six groups, with the sixth unavailable until its
capability exists:

1. **Customer:** search existing shop customers by supported name/phone/ID
   methods. Display distinct same-phone matches. Reuse registration for a new
   customer; do not add email, unique phone or identity-document requirements.
2. **Wearer:** default only to the server-resolved self wearer for this customer.
   If no eligible self profile exists, expose the existing registration/linking
   route; do not silently create a second person. Other authorised wearer
   choices visibly name their relationship. Never infer permission from payer
   or shared phone. Recheck authority server-side on reads, draft actions and
   acceptance. A minor order requires the recorded authorising parent/guardian;
   measurement/photo purpose consent remains separately required when those
   later capabilities store values.
3. **Garment/service:** select an eligible reviewed service manifest and see
   its generated unresolved requirements. Exact source versions are pinned.
   No automatic measurements, fabric receipt, approval or ready task.
4. **Agreed delivery:** shop-local date and optional slot, visibly distinct
   from requested/event date. Normal priority is the starting point; owner can
   explicitly choose rush. Occasion alone changes no priority.
5. **Price:** choose quoted amount in exact paise or To be quoted. Empty is
   unknown; explicit zero is a quoted zero. A quoted intake amount is not an
   approved quote, invoice, receivable or payment. No advance/balance arithmetic.
6. **Advance:** short text “Advance recording is available in the payment
   workflow later.” No editable paid flag, placeholder ledger or dead action.

Optional details disclose occasion/event date, requested date, order date,
instructions and intake owner. Capture order creation time from the server.
An intentionally historical order date needs an explicit label/reason and
never backdates acceptance, bypasses a festival cut-off or impersonates an
imported financial event. The existing evaluator's date consistency rules apply;
do not invent universal event-date restrictions. Unsupported historical-import
cases point to the later migration workflow while preserving the draft.

Phone: one readable form column, associated identity summary and reachable Save
draft/Review commitment actions above bottom navigation and keyboard. Tablet:
related fields can pair; portrait remains one task pane, landscape can show the
requirements beside intake. Desktop: form plus readable requirements/review
column, not a spreadsheet booking screen. Long names, amounts and Tamil wrap.
At 360px and enlarged text, actions stack rather than cover fields.

Save status is near the form heading. Review commitment opens a focused summary
of identity, exact service, date, unresolved checklist, price state and current
capacity/cut-off/rush facts. Confirm booking is the consequential action. An
accepted result opens the durable order detail with identifier, original/current
promise, owner, unresolved blockers and next useful action. No success toast
alone substitutes for a durable read.

## One canonical record, exact sources and history

Reuse `serviceTemplatesReferencesEligible`, catalogue/form eligibility and
`previewServiceRequirements`; extract shared projection logic only if needed.
Do not add another template engine or evaluator. Projection today is explicitly
configuration-only, so accepted order instances require real persistent rows.
Persist task/requirement instances with stable source keys, dependencies,
applicability and initial unresolved states. Default each task to the verified
owner. Simple milestones summarize those same instances and retain blockers.
Booked reflects acceptance; Ready and Handed over do not follow from creation.

The draft retains chosen identity IDs, raw incomplete date/amount inputs,
schema version, exact references and its per-order presentation. Source lists
are validated against the current tenant before returning private labels. A
stale reference may remain in a recoverable draft with unavailable/stale feedback;
it cannot authorise acceptance or reveal a foreign record.

Accepted order storage lives inside the existing orders module folders in core,
contracts and db, not a new package. Proposed relational records:

- Order identity/current state: shop-led UUIDv7 and readable order code,
  immutable origin-draft reference, customer/wearer, intake/coordinator owner,
  created time, order date provenance, original/current promise, price state,
  presentation and version. Accepted-origin uniqueness survives request-key
  expiry. No complicated booking entity is required for a single order.
- Immutable intake/commitment snapshot: exact catalogue category/service and
  availability revisions, piece/add-on references, each form and operating
  manifest/template revision, presentation origin (including implicit Simple),
  binding/rule/calendar/profile-timezone/relevant policy versions, evaluator
  version, authoritative demand/load facts, reasons and rush decision. Store
  content/schema digests and minimal frozen bilingual source content needed for
  history. Do not copy private wearer values into configuration snapshots.
- Requirement/task instances and relational source links, plus append-only
  acceptance/presentation history. Explicit reviewed not-applicable decisions
  retain their source/reason; optional undecided stays unresolved. No execution
  command is included.
- Accepted capacity demand associated with the exact acceptance and sources;
  initial readable-code allocation uses a tenant-scoped locked counter. Use
  owner-approved shop-scoped `QO-000001` onward; this is not bill numbering.
  Committed identifiers are never recycled. UUIDs remain the opaque route IDs.

Cross-record links use composite shop foreign keys, including draft origin,
snapshots, requirements, demand, source revisions and owner membership. Bounded
JSON is for typed frozen values, not a replacement for cross-record integrity.
Every tenant row has non-null shop_id, shop-led uniqueness/indexes, matching
read/write policies and ENABLE/FORCE RLS. Runtime stays `app_user` through the
existing membership-checked `withShop` transaction. Personal text is minimised
in audit; legitimate erasure uses the existing privacy boundary and tombstones.

Presentation initializes once from the shop preference. Simple/Detailed changes
disclosure, never the checklist, dates, money state, dependencies or assignments.
A saved per-order override is versioned/audited using the existing command
infrastructure; transient expansion is not a business update. Shop preference or
template edits never bulk-rewrite orders. Repeated mode/language/viewport switches
must preserve exact canonical equality, apart from the explicit presentation
field/history. Historical detail reads exact pinned sources even after disable.

## Draft lifecycle and honest recovery

Register a versioned Quick Order workflow in the existing draft registry and
transaction composition. Reuse `DraftWorkflow`, `mutateDraft`, draft repository,
`draft-recovery.ts`, form/work guard and existing typed draft client. Separate
incomplete draft and complete acceptance command schemas. Do not make a second
autosave API, browser persistence layer or command engine.

Use the existing UUIDv7 draft identity at form open, pause-aware server autosave
and IME protection. Add the opaque draft URL only after acknowledged save.
Save draft keeps the lifecycle active; Review creates no reservation. Confirm
booking promotes that saved draft and writes its exact result once. Explicit
abandonment applies only to a draft. Cancelling the editor is not cancellation
of an accepted order or silent deletion of a server draft.

| Visible state | Required meaning and action |
| --- | --- |
| Unsaved / Saving | Current typed version is not yet acknowledged. Preserve it in this form. Never mark new typing Saved when only an older revision was acknowledged. |
| Saved | Server acknowledged this version. It can be resumed by authorised shop sessions or another device. |
| Not saved | Definitive failure/offline state; preserve typed values and offer Retry. Never promise recovery after reload of values that never reached the server. |
| Checking outcome | Response may have been lost after commit. Reuse exact key, action, payload and version header until resolved. Do not create a replacement action or duplicate order. |
| Conflict | 412 supplies authorised current state; keep the local form and show an explicit comparison. No automatic measurement/money/approval/reference merge. |
| Source changed | 409 identifies stale/disabled/ineligible source or changed commitment review. Show old/current sources and require an explicit draft revision/review. |

Flush or resolve outstanding autosave before reviewing/promoting. Freeze the
request envelope for an uncertain operation; typing made afterwards stays in
memory until the prior outcome is known, then becomes a distinct save. The
server hash binds the actual action/actor/request including its precondition.
Same-key changed payload or wrong actor/action is rejected; exact replay precedes
current-state checks as in the incumbent engine. Lost acceptance responses can
also recover the promoted draft's durable result after a new session; do not
depend on recovering a browser-only pending key after restart.

Resume lists are server-backed and filter the Quick Order workflow; merge only
acknowledged records, paginate/deduplicate by ID/version, remove promoted or
abandoned entries and show retention/stale notices under existing approved
policy. Never invent deletion timing or activate unapproved retention. Old
schema content remains labelled/read-only until explicitly supported migration.
Sign-out, shop change, access revocation and page exit clear private memory and
query cache. Dirty navigation gives Stay, save-and-leave when online, or explicit
discard-unsaved choices. No business content enters storage, caches or URLs.

428 means missing update precondition, 412 stale version, 409 domain/source
conflict and 422 invalid request. Authentication/permission/outage retain their
existing distinct states. A retry after rollback reruns the same request; a new
owner decision after a definitive rejection uses a new request envelope/key.

## Authoritative commitment acceptance

`previewBoundShopCommitments` deliberately supplies null demand/load and returns
effects none/activation unavailable. Keep both existing v1/v2 preview contracts
unchanged. Extend the existing commitment module's server acceptance consumer,
reuse `ApprovedCategoryResolver` and `evaluateCommitment`, and introduce a
distinct accepted-order result. Never relabel a preview result as accepted.

The server chooses the current binding for the selected canonical category,
validates its current exact category/availability/rule, and resolves current
calendar, shop timezone and applicable policy authority. Client source IDs or
review digests are compatibility assertions only. The reviewed binding permits
using its original owner-proposal rule as designed; it does not transform every
owner-proposal definition or a synthetic fixture into approved production data.
Use existing eligibility/review gates and an explicit reviewed production-content
decision where required. Synthetic fixtures stay permanently synthetic.

**Owner-approved authoritative load model (19 October 2026, #114 selection):** count accepted demand
assigned to the promised-delivery week of each canonical category. Drafts and
risk previews contribute zero. For garment-count policy, one outfit order
contributes one, not the number of template pieces/tasks. Effort-point policy
requires an exact reviewed server-side demand value and provenance within the
existing commitment/configuration module; no browser number or guessed default.
Reject acceptance as unresolved when that mapping or existing comparable demand
is unavailable. The owner approved garment-count intake, delivery-week allocation and retained booked demand. Effort mapping and production weights/caps remain unapproved.

Demand facts preserve allocation date, unit, quantity and source. Recompute
current bucket load from accepted contributions under the current reviewed
week/allocation convention. Do not partition load by binding/rule revision;
otherwise changing a cap would reset apparent load. Changed units need explicit
reviewed comparable mappings; missing mappings are unknown, not zero. Completion
does not silently release historical weekly booked demand. Later cancellation
or rescheduling appends a linked adjustment and locks both old/new categories
and buckets in deterministic order; this slice exposes no ungoverned release.
That future adjustment protocol is a contract, not an implemented lifecycle.

**Lock scope:** transaction advisory lock on stable `(shop, canonical category)`
capacity identity, even for the first booking with no demand row. This deliberately
serializes all weeks of one category initially; no lock is based on a revision
or absent bucket row. Take existing source-publication locks too, using the same
identities as their writers, so a category/template/calendar/rule/permission
change cannot race an acceptance check. Do not invent unrelated lock keys that
publishers never acquire. Retain locks through commit.

Preserve the established outer idempotency-key → draft locking. Within acceptance,
reuse identity/guardian writer locks, then a globally documented source order
compatible with existing catalogue → forms → templates and catalogue → rule →
binding paths, followed by calendar/policy locks, sorted capacity categories and
identifier allocation. Before implementation, audit the complete publisher lock
graph and correct any inversion; deterministic tests must exercise it. A lock
timeout/deadlock is a rolled-back retryable failure, never a successful booking.

Within that one membership-checked transaction:

1. Resolve exact-key replay first; lock draft and validate its expected version.
   Recheck current customer/wearer/guardian authority and private-data policy.
2. Lock and re-read current sources. Verify the pinned manifest remains eligible.
   If changed, require explicit draft revision and review; never swap references.
3. Lock stable capacity scope, then re-read all accepted demand. Derive candidate
   demand, shop-local server now and acceptance date. A historical order date
   cannot supply an earlier festival booking time. Resolve current calendar/rules.
4. Evaluate with the existing evaluator using those exact sources/load. Unknown
   required inputs block acceptance. A reason overrides a supported capacity or
   cut-off warning, never missing identity, authority, load or policy.
5. Compare the review assertions to the freshly evaluated facts. If new material
   warnings/source changes appear, return 409 for review with no writes. Owner
   acknowledgement/reason and optional rush waiver apply to this current result.
   A client fingerprint does not authorise acceptance. An unchanged inspected
   fingerprint is not sufficient without server resolution and locking.
6. Persist order/identifier, immutable snapshots, unresolved instances/assignment,
   accepted demand, exception and waiver reasons, audit, promoted draft and
   idempotency result together. Enqueue only a concrete needed job through the
   same transaction; ordinary acceptance needs no message/payment/production job.

Capacity excess and festival cut-off are overridable warnings under SET-11.
Zero cap follows its explicitly configured convention. Rush is flagged from
current lead-time rules and/or explicit priority, with the configured charge
suggested. Never automatically add it to the intake amount. Capture an explicit
accepted suggestion or reasoned waiver when selected; To be quoted can retain
unapproved price requirements while recording the date decision. Date acceptance
is not customer price/design approval. No missing value is softened to “within
capacity,” and owner override is not a universal bypass.

Immutable first acceptance sets original/current promised date/slot together.
Later governed date/price revisions belong to the agreement/change consumers;
they must append history, preserve original snapshots and adjust demand atomically.
No generic PATCH of an accepted commitment is allowed in this slice. An audited
presentation-only change cannot alter commitment or financial facts.

## Acceptance matrix

QO identifiers below are ticket-local checks, not new product requirement IDs.
Rows below define the required proof. Execution status and remaining human
acceptance are recorded per row in the [A evidence](Quick_Order_Implementation_Evidence.md)
and [B evidence](Quick_Order_Acceptance_Implementation_Evidence.md).

| Check | Product / scenario contribution | Required proof |
| --- | --- | --- |
| QO-01 | ORD-01/04, SET-10, AC-59 partial | Existing-customer blouse intake, eligible self/other wearer, minimum groups only; quoted zero differs from unknown; deferred advance honest; accepted readable ID reopens once. |
| QO-02 | CUS-02/07, TRU-03/05/13, AC-02/53 partial | Same-phone people remain distinct; payer is not wearer authority; missing/withdrawn/revoked relationship and minor guardian authority denied server-side; no measurements/photos captured. |
| QO-03 | SET-08, ORD-04/05/06, AC-07 partial | Exact manifest/catalogue/forms/templates/presentation and relevant policy/timezone sources; generated unresolved items, scope/dependencies and owner assignment; disabled/drifted source requires explicit review; old order stays readable. |
| QO-04 | USE-03/04, AC-40 | Partial durable draft save/list/reload/new session/resume; IME-safe autosave; lost connectivity retains current typed text; Saved matches acknowledged revision; no unsaved reload promise or browser storage. |
| QO-05 | USE-08, AC-40/55 | Lost response after actual draft/order commit, same-key replay, changed actor/action/hash denial, repeated clicks, promoted-origin duplicate prevention after key expiry; 428/412/409/422 and explicit conflict choices. |
| QO-06 | SET-10, ORD-05/06, AC-59 partial | Repeated Simple/Detailed/language/viewport switching preserves canonical source keys, values, dependencies, blockers, unresolved states and assignment; order override audited; preference updates leave old orders unchanged. |
| QO-07 | SET-11, AC-60 | Current server-resolved category/binding/rule/calendar/policy/demand; cap and cut-off warning with required reason; rush suggestion and reasoned waiver; unknown/synthetic source cannot authorise production. |
| QO-08 | SET-11, USE-08, AC-60/55 | Real PostgreSQL simultaneous first bookings, last slot, same-key concurrent retry, rule/availability/demand drift; no stale-cap bypass or revision-based zeroing; different-shop isolation and deterministic lock order. |
| QO-09 | TRU-01/06/12, architecture §§8/10/11 | Real app_user FORCE RLS, missing/wrong context, composite FK negatives, pooled reuse, cross-shop drafts/search/detail; injected failures after each actual write roll back order/demand/instances/audit/draft/key/jobs together. |
| QO-10 | ORD-04/11, §27, AC-27 partial | Creation/order/acceptance/original/current/requested/event dates distinct; historical date cannot evade current cut-off; visible owner/blocker/next action; no synthetic receipt, approval, execution or ready state. |
| QO-11 | USE-01/02/09, architecture §15 | English/Tamil, both themes, 360×800/820×1180/1440×900 plus tablet landscape, keyboard/focus/axe/200% reflow/IME, outage/retry/conflict/sign-out clearing; real intake timing recorded. Device/fluent-Tamil/AT separate. |
| QO-12 | §29.1/30.1/32/33 boundaries | No new payment, ledger, tax, custody, measurement, live message, production or capacity effect from draft/preview. Existing customer/guardian/settings/catalogue/binding/presentation paths regressions pass. |

AC-58 material costing and AC-61 duplicate UTR are **not covered**. AC-59 covers
intake/checklist/owner and measured task time here; actual approved customer
summary/PDF/WhatsApp completion stays its document/agreement consumer. AC-60
requires real accepted-order evidence, not merely configuration preview. No
automation closes physical-device, fluent-Tamil, restore, privacy or pilot gates.

## Migration, verification and owner decisions

Allocate migration filenames only when approved tickets start. Use additive
order/snapshot/requirement/demand/history tables with reviewed grants, immutable
guards and relational provenance. No production backfill, assumed load zero,
approved seed or destructive down migration. Exercise populated-foundation
upgrade. Compatible rollback retains new records/schema and returns unsupported
new commands as unavailable; older code must not reinterpret accepted data.
Back up before non-disposable schema application. Restore epoch/quarantine,
kill switch, money freeze and privacy/retention paths remain in force.

Unit/property tests cover draft/command schemas, source/demand resolution,
dates, safe paise serialization and lossless projection. Real PostgreSQL tests
prove concurrency/isolation/history/rollback. Browser tests cover each complete
owner flow with faults at the client transport boundary, never vendor servers.
Repository lint, Knip, strict types, relevant tests, production build and each
ticket's explicit full checks are required; reuse unaffected baseline evidence.
No new document renderer is needed here; existing Tamil PDF goldens remain a
promotion/pilot check and must run when their inputs change.

The owner approved A-B and selected both sequentially, including QO numbering
and the retained garment-count delivery-week model recorded below. Effort mapping
remains unapproved and blocked. Production category caps, lead-time/counting
basis, cut-offs, exceptions and rush wording still require review. Initial production
catalogue/form/template/privacy/retention approvals remain separate. Labelled
synthetic fixtures can test proposed semantics without approving production.
The two-minute figure remains a design target until measured in actual intake.

## B implementation selection and lock audit

A merged through #115 at `c6ab32d`; all #114 direct blockers were rechecked.
The owner then selected #114 and approved one accepted garment in its promised-
delivery week, retained booked demand after completion, shop-scoped QO-000001
onward and blocked effort-point acceptance until a reviewed mapping exists.
Production caps/lead/rush/content/privacy activation remain separate.
[Acceptance implementation evidence](Quick_Order_Acceptance_Implementation_Evidence.md)
records the publisher-compatible lock audit, current verification and review packet.
