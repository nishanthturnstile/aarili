# Services, templates and Simple mode: independent design

18 October 2026. Roadmap **1.1.2**; SET-03, SET-04, SET-10 and category/version
contributions to SET-08/11. **A–E implementation breakdown approved; A selected
as #97. This is not production business-configuration approval.** [Evidence](Service_Templates_REA_Evidence.md),
[ticket packet](Service_Templates_Ticket_Packet.md),
owner-supplied research brief.

## Authority, baseline and executable gate

Product §§3, 6, 9–15, 24–25, 27, 29.1, 30.1, 32–33 govern behaviour;
architecture §§6–11/15 govern technology and integrity. Read alongside the
[development workflow](Development_Workflow.md), [tracker](issue-tracker.md),
[design system](../aarili-design-system.md),
[Shop Settings design](Shop_Settings_Design.md) and
[commitment implementation](Shop_Commitments_Implementation_Evidence.md).
No source baseline or release allocation is changed.

Fresh `git fetch origin`: local `development` and `origin/development` both
`964b863336a5f666df6b8a0f282cff71846ee57f`. Issues #84–#88 are closed with
merged PRs #89–#93, including #93 at that head. Registration through #83 is
also integrated. The authenticated all-issue inventory has no 1.1.2 ticket;
only #28 Dependency Dashboard is open. Existing approval of 1.1.1 A–E is
reused as prerequisite approval, not extended to these new tickets.

The initial research inventory found no 1.1.2 issue. The owner subsequently
approved this packet and proceeding; #97–#101 were published with native blockers,
and A (#97) is selected after merged prerequisites. Application work remains
limited to that selected issue. E (#101) owns the resolver integration and cannot
start until A merges. Do not implement the resolver as an isolated unapproved patch.
After selection, refresh development and branch in this checkout; no new
worktree, reset, stash or automatic inclusion of unrelated edits.

## Owner flow and interface

Extend Settings with **Services and templates**, using the incumbent Current
light/dark tokens, local Noto Sans/Noto Sans Tamil and shared Base UI controls.
This is an Operate surface for an owner preparing repeatable garment work.
The distinctive interaction is seeing exactly what a selected template will
ask, keep unresolved and assign before publication. It is not a dashboard.

1. Choose a category and service/type, or create a draft. See publication,
   availability, author, effective time and missing setup separately.
2. Define pieces and applicable add-ons. Choose a piece to configure its form,
   material checklist, task sequence, quality checks and instructions.
3. Preview the generated requirements and owner-assigned milestones. Switch
   Simple/Detailed within the same labelled configuration preview.
4. Review the exact content diff, referenced versions and unresolved decisions.
   Save draft or publish the reviewed revision for new activity.
5. Separately review category commitment binding against an existing rule
   revision. See which source and conventions are being approved and which
   live-load inputs remain unknown. This creates no booking.
6. Disable new selection or reopen history by explicit revision. Changing a
   template never changes an old reference or silently reapproves it.

Phone: one editing task at a time, service cards followed by a full-width
editor, persistent breadcrumb/back action and reachable save/review actions.
Tablet: category/service list with detail where width permits, otherwise the
same single pane. Desktop: compact list and readable detail/preview, with
history on demand. Use existing navigation; avoid a second nested application
shell. Long Tamil labels wrap; 44px targets, visible focus, field-associated
errors and a focused request-feedback region are required. No drag-only reorder:
provide Move up/down controls. Keyboard opening/closing restores sensible focus.

English remains the initial interface; Tamil is explicitly selected and preserves
draft values. Product USE-02's Tamil-first preference remains an acknowledged
future preference decision, as recorded in the incumbent design system. This
slice's shop Simple/Detailed preference must not change language behaviour.

Empty state invites creating a draft; no fabricated catalogue ships as approved.
Loading, permission denial, missing reference, draft saved/saving/not saved,
uncertain response, explicit retry, stale conflict, publish validation and
unavailable historical content all have distinct feedback. Cancel confirms only
when dirty, and never silently publishes. Resuming server drafts uses the existing
draft controller; no business data enters browser storage or query strings.

## Proposed catalogue content and approval inputs

The following are product-derived candidates for owner review, **not seeded
production definitions**. Names, exact variants, membership and bilingual wording
are approved as versioned data before use.

| Candidate | Definition and unresolved input |
| --- | --- |
| Blouse family | Approved types can include front-dart and princess-cut examples from DES-01. Owner chooses supported variants, piece structure and attached forms/templates. |
| Salwar/Chudidhar family | Owner approves variants and which outfit pieces apply; top, bottom and dupatta are candidate pieces, not a mandatory universal three-piece set. |
| Alteration services | Stitching versus alteration is an explicit service kind linked to its garment family where relevant. Exact alteration types and their applicable requirements need approval. |
| Small standalone services | Fall, pico, pre-pleating, tassels and hooks are product examples. A lightweight standalone service must explicitly declare no measurement/pattern requirement where appropriate. |
| Optional work/add-ons | Aari, embroidery, stone work and patchwork may contribute material/tasks/quality checks; the owner approves applicability and sequence. No price or complexity grade is invented. |
| Bridal | Occasion/package grouping for later bookings, never a garment category. No package/order execution in this slice. |
| Retail | Unavailable in Phase 1 at both command and selection boundaries. No stock/sale model or activation switch. |

Use **one canonical catalogue module** with stable tenant identities. Categories,
subcategories, service types, physical piece definitions and add-on definitions
are distinguishable record kinds in that module, not competing catalogues.
Root categories group garment families or an explicitly approved standalone
service group. A service has stitching/alteration/small-service kind and a
category reference. Subcategories have one approved parent; constrain the
hierarchy to category → subcategory rather than arbitrary recursive taxonomies.
Piece composition and add-on applicability pin explicit revisions. A piece is
not a pattern panel, worker, charge or garment order. Add-ons remain definitions
for later priced-line consumers; no rate, money event or stock effect is created.

Catalogue search reuses the existing vocabulary/search-key foundation for Tamil,
Tanglish and English. Preserve entered labels; keep normalization keys separate.
Search requests carry terms in a body and execute under the current shop context.
Test cross-script category/service retrieval and cross-shop negative matches;
the full pilot recall target still requires its reviewed corpus and measurement.

Neck type and sleeve type are construction decisions; neck design and sleeve
decoration are separate supported choices. Templates may ask for their resolution
but do not build the full design library, combinations engine or pattern engine.

## Definition and template semantics

Measurement-form definitions contain stable field keys, bilingual labels/hints,
group identity and labels, explicit ordering, supported base-length field type,
permitted inches/centimetres, default entry unit, required/optional flag and
owner-approved precision. Default inches/quarter-inch entry is product context,
not permission to invent per-field precision or tolerances. Unapproved precision
is unresolved and prevents authoritative form eligibility. There are no wearer
values, conversion calculations, derived formulas, universal ranges or measurement
session dates in this slice. Text/design/yes-no requirements live in their own
bounded checklist fields, not disguised as body measurements. Optional approved
method illustrations reuse private authorized media and explicit version links.
No illustration is required for initial manual use.

Forms attach to exact service/type and piece revisions. Alteration forms may
be different from new stitching; a no-measurement service has an explicit
not-required form decision rather than an empty accidentally approved form.
Field renaming keeps its identity; changing its meaning/unit semantics requires
a new field identity and explicit mapping review. Removal affects new revisions
only. Never resolve old values using current field names or order positions.

Supported templates use typed, finite structures:

| Template | Supported configuration and preview |
| --- | --- |
| Materials | Main fabric, lining, extra/net/contrast fabric, trims/accessories and craft consumables; piece/work applicability; required/optional; source choice unresolved/customer/shop/artisan where applicable; explanatory instructions. No received stock, quantities guessed from a garment, custody or procurement. |
| Production | Stable task keys, bilingual labels, required/optional, piece/work applicability, predecessor edges, milestone mapping and owner assignment role. Supported prerequisite kinds reference design/measurement/manual-method/material/quality decisions; no executable expressions. |
| Quality | Garment/piece-specific construction, finishing, closures/accessories, visible defects and approved dimension-check definitions; required/optional and applicable task references. No guessed tolerance or passed check. |
| Instructions | Bilingual bounded plain text with audience (owner/internal versus customer summary); no HTML/scripts or arbitrary embedded code. |
| Confirmation | Supported design/scope, price-basis and date topics plus inclusions/exclusions and supplied-material wording; explicit allowed placeholders only. Missing tokens show unresolved; no real customer or price is required for configuration preview. No signature, customer approval or message send. |

Publication rejects duplicate field/task keys, missing references, foreign tenant
references, invalid kinds, unsupported placeholders, self-edges and dependency
cycles. An approved optional task does not silently satisfy a required predecessor.
When work is unselected, mark its applicability explicitly; unresolved applicability
remains unresolved. Reject configurations in which a mandatory dependent could
become ready only by treating an unresolved/optional predecessor as completed.
Permit parallel tasks and independently approved craft-before-cutting and
craft-after-cutting sequences; do not force one garment-wide embroidery order.

Required/optional is configuration. Unresolved/confirmed/not-required/completed
is the later instance's state. In preview, required and applicable items begin
unresolved; optional undecided items also remain undecided, not “not required”.
Only an explicit supported applicability decision can produce not-required,
with its source visible. Preview never marks a material received, a task done,
quality passed or approval granted. Unconfigured sections differ from reviewed
not-applicable sections with reasons.

## Simple and detailed presentation

Simple is the shop default. Store a versioned shop presentation preference;
the sample preview may temporarily override it. Both render one canonical
preview model derived from the exact selected service, pieces, forms and template
revisions. Switching changes only presentation and disclosure, not that model.

Simple displays the generated checklist and Booked, Cutting, Work/Stitching,
Trial, Ready, Handed over milestones. Label these as illustrative milestones;
Booked/Handed over remain separate later lifecycle dimensions, never synthetic
production task states. Non-applicable milestones say not applicable rather
than pretending completion. Work-only services can omit irrelevant cutting/trial
through approved applicability. Every generated task previews the authenticated
shop owner as default assignee, never an arbitrary client actor or a required
new staff record. Detailed reveals each piece, task dependency, instruction,
unresolved decision and source version. A blocked required task must remain
visible in Simple's milestone summary.

Acceptance invariant: serialize the canonical preview before Simple → Detailed
→ Simple, and compare identities, values, unresolved states, assignment targets,
dependency edges and version references for exact equality. Switching language
and layout must preserve the same data. Changing draft content invalidates the
old preview fingerprint; explicitly regenerate rather than show a current-looking
stale preview. Shop preference changes append history and do not bulk-edit
existing orders. Per-order mode override and its audit are implemented in 1.2.1;
this slice supplies the contract and labelled demonstration, not real orders.

## Data model and publication

Proposed names below are implementation targets, not claims of existing tables.
Use existing draft/vocabulary/media/command foundations and repository patterns.

- `service_catalogue_entry`: `(shop_id,id)`, kind, current revision pointer,
  concurrency version; stable identities never reused. Parent-kind and service
  references are tenant-composite and validated by core.
- `service_catalogue_revision`: identity, revision ID/version, predecessor,
  bilingual label/description snapshot, supported definition content, actor,
  effective/recorded time, draft and audit provenance, content hash/schema version,
  reviewed authority classification. Ordinary runtime cannot update/delete it.
  Category revisions also own a nullable `warningDays` override, authored in the
  category editor and reviewed with that exact revision. Null means no category
  extension, not zero days or missing shop configuration. Use the existing
  commitment integer resource bound (0–3,660); the shared evaluator takes the
  maximum of shop and category windows, so an override cannot shorten the shop
  warning. Do not supply a production value automatically. Show the effective
  window in E's binding review and preserve old category-window references.
- `service_form_revision` and `service_template_revision`: exact owner-reviewed
  immutable definitions linked to a catalogue identity/piece. Their referenced
  fields, rows, task edges and media use tenant-composite child/reference tables;
  do not hide cross-record reference integrity only in JSON. Bounded typed
  content may use JSON where it does not replace relational foreign keys.
- A published service revision pins a complete definition manifest: exact piece,
  add-on, form and operating-template revision IDs or reviewed not-applicable
  decisions. Drafts may be incomplete; publication/readiness reports specific
  unresolved sections. Catalogue identity publication in ticket A does not imply
  intake eligibility before the complete manifest is reviewed in C.
- Append-only availability decisions and a CAS current availability pointer
  govern new selections independently of historical revision content. Disable
  requires explicit scope/reason; re-enable is an explicit reviewed action against
  an eligible unchanged revision. Editing content creates a new revision requiring
  review; it does not borrow approval from its predecessor. Disabled parents or
  referenced pieces/add-ons make new selection ineligible until explicitly resolved.
- A versioned shop mode preference uses the established section-history pattern.
  There are no orders or per-order mode rows yet.

All new tenant tables, including child/edge/history/current-pointer/binding tables,
have non-null shop_id, shop-led uniqueness/indexes and ENABLE/FORCE RLS with
matching reads/writes. FKs include shop_id; runtime `app_user` is not owner or
BYPASSRLS. Provenance triggers protect revisions and same-transaction pointer
publication as in existing settings. Exact actor, reviewed content hash and
draft-result linkage are checked. No client-supplied approved flag is authority.

Vocabulary is reused for editable bilingual terminology/search keys, but a
published definition freezes its labels and references. Later vocabulary changes
must not rewrite historical specifications. Current selection excludes unavailable
entries; explicit authorized revision reads remain possible. “Duplicate as new”
later requires replacement/reactivation for unavailable definitions and cannot
copy approvals, dates, payments or source authority. No hard-delete UI for
published definitions; legitimate personal-data erasure remains confined to
audited privacy functions. Avoid customer names in configuration and audit payloads.

Publish immediately at a server-assigned effective time, consistent with existing
settings. No backdating, future-effective scheduler or automatic change to existing
work. Database timestamps are not described as exact commit timestamps.
Production content review and `synthetic-fixture` authority are separate and
non-interchangeable. Fixtures can exercise the whole path in an isolated synthetic
shop, with clear labels; they cannot be promoted by changing a client flag.

## Existing category resolver and commitment integration

Inspected source at the baseline:

- `packages/core/src/commitment-evaluator.ts`: `ApprovedCategoryResolver.resolve(id)`
  returns `ApprovedCategoryRef | null`; the ref contains shopId, id, version,
  nullable warningDays, eligible and synthetic. `evaluateCommitment` is the one
  shared evaluator.
- `packages/core/src/shop-commitments.ts`: context injects that resolver; production
  preview resolves the supplied category ID server-side, synthetic mode uses its
  server-owned fixture. Load remains null outside the fixture.
- `packages/auth/src/index.ts`, `commitmentContext`: currently injects
  `categories: { resolve: async () => null }` inside the owner transaction.
- `packages/contracts/src/shop-commitments.ts`: immutable rule revisions have
  literal `authorityScope: unbound-preview`; responses have `binding: unbound`,
  `activation: unavailable`, `effects: none`. Configuration authority is
  owner-proposal or synthetic-fixture. The evaluator unconditionally retains
  productionAuthorityPending for production scenarios.
- `packages/db/migrations/0024_shop_commitments.sql` enforces those immutable
  revisions and their promoted draft/audit provenance. They must remain unchanged.

Ticket E implements a DB repository adapter **at this seam** and injects it from
the existing transaction composition. It reads canonical category identity,
reviewed eligible revision and current availability under the same withShop
transaction; returns null for foreign/missing/unreviewed/disabled categories.
Its string version is the immutable catalogue revision identity/version, not a
browser label. Synthetic provenance and nullable warningDays come from trusted
records. Existing historical revision reads bypass current-selection eligibility
only for authorized history, never through this resolver.

Add `service_commitment_binding_revision` and a current binding pointer with
composite FKs to `(shop_id,category_revision_id)` and
`(shop_id,shop_commitments_revision_id)`. A binding records exact source rule,
category identity/revision, predecessor, actor/effective time, reason, reviewed
conventions/content digest and authority classification. Explicit review may
approve a complete owner-proposal's values **in this new binding**, leaving the
original unbound-preview revision untouched. A synthetic source cannot acquire
production authority by rebinding it. Incomplete conventions/rates stay unknown.
The UI reviews both sources and the exact new-binding consequence. The server
re-reads and locks relevant pointers on publication; a changed category/rule
requires fresh review, not an automatic rebind. Retiring a category retains every
binding and source revision historically.

A bound-preview request identifies its binding; the server derives the approved
category and rule revisions from that record. If compatibility inputs also supply
a category or rule source, require an exact match to the binding or reject the
request as a 409 domain conflict. A latest category/rule pointer must never
substitute for a pinned revision. Changed current sources require explicit new
review for current selection; historical binding inspection remains labelled
historical and cannot authorize new activity. Test deliberate same-shop source
mismatches as well as cross-shop references.

Rule edits continue through the existing commitment draft/publication service.
No new rule editor with separate publication rules and no second evaluator.
Settings core depends only on neutral interfaces; the DB adapter may structurally
satisfy the core interface without importing core at runtime into db. Auth composes
catalogue/commitment repositories in the same membership-checked transaction.

E must add an additive, explicitly versioned bound-preview response/authority
contract and server-side binding input to the existing evaluator. Keep the v1
unbound path and its tests; do not simply broaden literal approval values and
remove the pending gate. A reviewed bound source may resolve category/policy
authority, while `loadMissing`, unknown candidate demand and other missing facts
remain unknown. Both preview variants retain `activation: unavailable` and
`effects: none`. Fingerprints include exact binding/category/rule/calendar
references and availability versions. Distinguish configuration readiness from
booking acceptance. No zero-load fallback or client-provided authoritative load.

1.2.1 must re-read eligible versions, live load and binding in its transaction,
serialize the capacity bucket, evaluate and atomically record decisions plus
order/checklist/assignment/audit/idempotency. This slice neither reads live demand
nor reserves capacity. It cannot fully close SET-11 or AC-60.

## Commands, API and repository boundaries

Core modules implement catalogue/form/template/mode/binding commands and pure
preview validation/projection. DB holds repository interfaces and transaction-bound
SQL adapters. Hono handlers authorize/validate/call/map; Node-runtime Next route
mounting remains unchanged. Browser imports only typed module clients, contracts,
i18n and UI. No new package/runtime boundary or speculative dependency.

Proposed typed routes under the existing API: catalogue list/detail/revision/history;
form/template explicit revision/history; preview; availability command; shop mode
read/history/command; category binding read/review/history. Use existing durable
draft PUT/promote for authoring/publication rather than a second autosave protocol.
Opaque IDs are allowed in routes; labels, filters containing business text,
template content and previews stay in request bodies/memory, not URLs or logs.
Strict command DTOs do not accept actor, effective time, eligibility, approval,
authoritative load or shop membership assertions from the client.

Each business mutation uses membership-checked withShop and the same transaction
for revision, CAS pointer, audit, draft promotion, idempotency result and any job.
No background/outbound job is needed for preview. Bind keys to actor/action/hash;
same request replays, changed payload/actor cannot reuse the result. Require
ETag/If-Match on editable targets: 428 missing, 412 stale, 409 domain conflict,
422 invalid content. Compare-and-swap version/base identity prevents first-publish
and edit races. Never merge approvals/definitions automatically. Error screens
retain unsaved memory and use the established exact-key recovery path. Clear
all private query/form/preview memory on sign-out, access loss and shop change.

## Migration, rollback and recovery

Allocate migration names only when each approved ticket begins; 0024 is the
inspected current commitment migration, not permission to reserve a future number.
Expand with catalogue/history first, forms/templates then bindings. Do not backfill
an approved catalogue or relabel existing commitment revisions. Empty catalogue
and unbound rules remain valid current states. Review SQL, grants, RLS, provenance,
indexes and tenant-composite links; run under the existing advisory-lock runner.
Back up before non-disposable schema application. No production migration here.

Test upgrade from populated customer/wearer/settings history. Rollback compatible
application code while retaining additive tables and immutable records; no destructive
down migration or bulk rewrite. Hide unavailable new UI safely on an older reader;
version contracts and never reinterpret unknown schemas as approved defaults.
Restore drill, restore epoch/quarantine, privacy/retention and live-data gates
remain prerequisites to pilot use. Templates do not enqueue messages, payments,
production or measurements, either during preview or restore.

## Acceptance matrix

Every row below defines **parent-slice acceptance**; it is not whole-slice
implementation acceptance. A's fresh results are tracked separately in
[catalogue evidence](Service_Catalogue_Implementation_Evidence.md). ST IDs are stable for this
packet; ticket-local verification must link fresh output to each applicable row.

| ID | Requirement/scenario contribution | Required proof and remaining consumer |
| --- | --- | --- |
| ST-01 | SET-03, DES-01, USE-02 | Create/reopen/revise tenant categories/subcategories/service types, pieces and add-ons; explicit kind/parent restrictions; Tamil/Tanglish/English search with foreign-shop negatives; reviewed nullable category warning override; Bridal occasion and retail gates. A. |
| ST-02 | SET-04, MEA-01 definition part | Per-piece/type bilingual field groups/order/units/required flags/precision; no values/formulas; reviewed not-required small-service form; foreign and missing references denied. B. Measurement entry stays 1.3.2. |
| ST-03 | SET-04, ORD-05/06 configuration part | Complete material/task/quality/instruction/confirmation manifest; optional differs from unresolved/not-required; unsupported tokens/kinds rejected. C. |
| ST-04 | AC-11/12 partial, JOB-02 | Reject cycles/self/missing/cross-shop edges; two independently reviewed craft sequences and parallel tasks; optional predecessor cannot bypass required work. C. Task execution/gates remain 1.7.1. |
| ST-05 | SET-10, AC-59 partial | Simple default and versioned shop preference; owner assignment preview; honest milestone applicability and blockers; no real order/approval/advance/share. D. Quick intake and time target stay 1.2.1/1.4.2. |
| ST-06 | SET-10 lossless switching | Canonical model exact equality across repeated mode/language/viewport switches; edited draft invalidates preview; no business-state command on preview toggle. D. Per-order audit stays 1.2.1. |
| ST-07 | SET-08, AC-07 partial | Immutable exact versions, actor/effective time, availability/history; disable hides new selection, old explicit revision readable; changed content requires new approval. A–E. Real old-order/PDF proof remains later consumers. |
| ST-08 | SET-08/11, AC-60 partial | Actual ApprovedCategoryResolver adapter; trusted category version/window; max(shop, category) and null-window behaviour/history; composite bindings to unchanged rule revisions; exact binding/source mismatch rejection; reviewed authority separated from fixtures; no duplicate evaluator. E. |
| ST-09 | SET-11 unknowns | Missing/foreign/disabled category fails closed; unknown load/demand/conventions remain unknown; source changes stale fingerprint; no activation, reservation or zero-load inference. E. Atomic acceptance stays 1.2.1. |
| ST-10 | TRU-01/06/12, USE-08, AC-55 | Real PostgreSQL FORCE RLS, app_user/missing context, cross-shop refs, tenant pooling, publication race, same-key replay/changed payload/actor/action, stale CAS and fault-injected rollback after actual writes. Every ticket. |
| ST-11 | USE-01–04/09, TRU-03/07 | English/Tamil and both themes, 360×800/820×1180/1440×900, keyboard/axe/IME/reflow; lost response retry, reload/resume, dirty cancel and private memory clearing. Every UI ticket. Human fluent Tamil/physical Android/AT acceptance separate. |
| ST-12 | §27/§33 boundaries | Preview produces zero orders, wearer measurements, approvals, money, custody, production jobs/messages or capacity reservations. Regression keeps onboarding, customer/adult/minor/guardian and settings paths usable. Every ticket. |

## Owner decisions and review

Approval of the ticket breakdown is separate from production content approval.
The owner must supply/review the initial category/type list, piece composition,
add-on applicability, bilingual terminology, per-piece measurement fields and
precision, material requirements, task/Aari sequences, quality checks and
confirmation wording. Lead times, warning overrides, caps, units, allocation/week
conventions, peaks/cut-offs and rush terms require the existing §32 policy review.
No candidate table, competitor value or synthetic fixture substitutes for it.

Review the five concrete tickets and ST matrix in the packet. It includes the
current documentation review path and the required later running-software packet.
Physical-device, language, assistive technology, PDF golden/issued-document and
search-recall gates stay explicit; no evidence in this design closes them.
