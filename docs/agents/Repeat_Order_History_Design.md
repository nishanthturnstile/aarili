# Reuse orders and maintain customer history: independent design

21 October 2026. **D1–D6 and ticket packet approved; A1 selected as [#134](https://github.com/nishanthturnstile/aarili/issues/134).**
Roadmap **1.2.4**. [REA evidence](Repeat_Order_History_REA_Evidence.md),
[ticket sequence and decisions](Repeat_Order_History_Ticket_Packet.md),
[validation/status](Repeat_Order_History_Implementation_Evidence.md).

## Authority and existing implementation

Product §§3, 5.2, 7, 9, 13, 24–25, 27, 29.1, 30.1, 32–33 govern behaviour;
architecture §§6–11/15 govern technology. Primary IDs: CUS-03/05/06, ORD-08/12,
MEA-10 manual retrieval, TRU-06/12. CUS-02/07, TRU-01/03/05/13, ORD-04/05/06,
SET-08/10/11 and USE-01/02/03/04/08/09 constrain every outcome. AC-02/40/53/55/59/60
apply in part; AC-58 remains material handling, not closed by repeat intake.
No product/architecture baseline conflict was found. Existing synthetic gates
and production approvals remain in force; this preparation grants no new policy.

Fetched development/HEAD `bc23c0e770e6e5e4e0ebb13218312dc30b08f08d` includes
1.2.1–1.2.3 and promotion-evidence sync #133. Main is promotion #130 at
`63646fec497d2b11db2396df0d982afd8ad9e8c9`. #127–#129 are merged; older
pending-review wording in their evidence is historical. The original preparation
preceded publication; #134–#138 now carry this approved sequence. Preserve the
existing checkout and owner edits.

Reuse [customer/wearer](Customer_Wearer_Design.md),
[Quick Order](Quick_Order_Design.md), [grouped booking](Grouped_Bookings_Design.md),
[small service](Small_Service_Design.md),
[service additions](Service_Additions_Implementation_Evidence.md),
[line completion](Service_Line_Completion_Implementation_Evidence.md) and
[promotion](Promotion_2026_10_21_Evidence.md) contracts/evidence.

| Existing source | What it supplies / gap this design must address |
| --- | --- |
| `contracts/orders.ts` | Strict `quickOrderDraftSchema`, empty defaults, exact manifest triple, accepted snapshot/digest, original/current promise, group commercial and piece projection contracts. No repeat provenance DTO. |
| `contracts/small-services.ts` | Strict service draft with exact profile, subject identity, selected lines, source order/piece; separate `order.services-intake` and change workflows. Existing source link is service context, not a general duplicate-as-new lineage contract. |
| `core/orders.ts`, `group-intake.ts` | Current authority checks, source resolver, commitment evaluator and shared acceptance; original draft-origin uniqueness. Reuse these, never insert accepted rows through a new shortcut. |
| `core/small-services.ts`, `service-intake-addons.ts`, `service-changes.ts`, `service-line-completion.ts` | Reviewed mappings, initial/supplemental scope and independent progress. Reuse scope readers and acceptance; a completed line is not new completed work. |
| `core/drafts.ts`, `draft-recovery.ts`; registry composition in `auth/src/index.ts` | Existing durable registry, one supported schema per workflow, promotion result/replay and conflict controller. Extend through an explicit adapter, preserve strict v1 readers. |
| `db/orders-schema.ts`, `orders-repository.ts`, `small-services-schema.ts` | Immutable acceptance snapshots; native pieces, service subject/lines, original and supplemental demand. Composite tenant keys/guards remain mandatory. |
| `core/customers.ts`, `wearers.ts`; repository interfaces | Audited simple contact/wearer correction and existing search/authority. C must extend these instead of inventing a parallel correction engine. No implemented general merge/relink is assumed. |
| Existing Orders, intake, customer profile, typed clients and i18n | Entry points, saved draft recovery and reusable UI. Unified cross-domain history and repeat controls are proposed additions. |

## Owner outcome and screen sequence

Operate mode, solo owner at a phone during intake. Find the correct person and
previous work, choose exactly what to reuse, then see **Saved draft** before any
new **Order booked** outcome. Historical facts are read-only context. New price
and delivery are visibly empty until deliberately supplied/reviewed.

1. Orders/detail and customer/wearer history offer **Repeat as new** on an
   authorised accepted garment or eligible service. A1 initially uses the
   existing order list/detail and customer selector; B adds unified discovery.
   Cards identify customer code, wearer, garment/service and source order/date.
   A shared phone never collapses results. No delivered/completed prerequisite
   is invented; repeating is independent new demand, not a correction lifecycle.
2. Review source: exact accepted order/version/digest, selected garment or service
   lines, original versus currently amended scope, historic price/date context
   and available requested instructions. Nothing is selected implicitly across
   an entire booking. The owner chooses original scope or explicitly identified
   accepted supplemental lines; completion evidence is not a reusable instruction.
3. **Create draft** persists a fresh draft plus reviewed selection/provenance
   atomically. No capacity demand, accepted order/code, ledger, custody or source
   revision is created. It opens the existing intake form, adapted for repeat
   review, with a compact source summary and a clear **New order** heading.
4. Review reusable text individually; reject or edit it as needed. Resolve current
   eligible catalogue/manifest/profile revisions. A changed definition shows old
   and candidate current labels/revisions and affected requirements; the owner
   explicitly selects/reviews the replacement. Retired/unavailable or unmapped
   work remains blocked for acceptance, with the durable draft retained.
5. Enter a new price or deliberately confirm **To be quoted**; explicit quoted
   zero is allowed. Enter a fresh agreed date/slot. Run the existing commitment
   review against current calendar/rules/caps, demand and permissions. Existing
   approved override reasons/rush-waiver rules apply; no inherited acknowledgement.
   To be quoted never masquerades as an approved quote or payment agreement.
6. Accept through the existing workflow, assigning new order/code, pieces/lines
   and permitted owner defaults. Atomically freeze lineage to the new acceptance.
   New detail links **Based on [source]**; source detail queries **Repeated as
   [new]** from separate lineage records. The original row/snapshot/version is
   not rewritten to add that reverse link. Draft and accepted children are labelled
   separately; cancellation does not imply a new accepted order.

No extra mandatory Simple mode fields beyond source selection/reuse review and
existing intake groups. The six SET-10 groups and current unavailable advance
message remain. Repeat timing records actual start-to-booked and later share
readiness separately; about two minutes is a design target, not a pilot pass limit.
Sharing, execution and fit validation are not supplied by A.

## Applicability and explicit blocked cases

| Source | First supported target | Boundary |
| --- | --- | --- |
| Accepted custom garment, including one member of a booking | A1: one independent custom outfit draft | Select one order; no siblings, booking membership, package price or occasion date copied. All current outfit-required pieces are regenerated. |
| One piece of a grouped outfit | A2: source context for a reviewed standalone piece-scoped service | Requires native piece ID and compatible current service profile. Repeating only a top as a new custom outfit is blocked until a reviewed independently orderable manifest exists; never strip required bottom/dupatta silently. |
| Standalone service order | A2: new standalone service draft for explicitly selected applicable lines | New subject/line IDs; supported current profile and comparable mapping required. Old property reference/receipt state not inherited. |
| Selected accepted add-on, original or supplemental, on custom/grouped work | A2: standalone service only when its reviewed profile permits it | Exact parent/piece/line and supplemental revision pinned. Incompatible profiles/categories are separate drafts, never silently combined. |
| Draft, unsupported imported snapshot, inaccessible/redacted source | No automatic repeat | Resume the original draft or start ordinary intake. Missing reusable content remains unavailable. No source label/data leak. |
| General measurement/design/fit/private media records | Later domain integrations | Phase 1.3 values are not implemented by this slice. Manual retrieval may show only existing authorised context; no derived correction or body-value update. |

Changing customer/wearer during a repeat invalidates reusable person-specific
content and review. A1/A2 block cross-wearer reuse; the owner can start ordinary
new intake without private carryover. C's later authorised relink is not invoked
implicitly. Wearer-optional service remains optional only under the exact current
reviewed not-applicable profile; a source-bound wearer cannot be stripped to bypass
permission. Minors require current guardian order authority; no historical consent
is represented as a fresh grant. Measurement/photo consent remains a separate gate.

## Field reuse and reset matrix

**Reuse after review** means candidate input only, never an authoritative fact.
**Reconfirm** means resolve current authority/definition or enter a new decision.
**Reset** means no source value in new operative fields. **Unavailable today**
means no fabricated field or value. Rows cover both raw DTO fields and non-DTO
business facts. Prices/dates may appear only in clearly labelled source context.

| Field / fact and existing contract | Treatment | New-draft rule and source |
| --- | --- | --- |
| Source order ID, intake kind, aggregate version, snapshot digest | Reconfirm | Server loads exact authorised source; records immutable provenance. ORD-08/12, TRU-01/06. |
| Source booking/member/commercial revision | Reconfirm | Context/provenance only; select one garment, not family/package. ORD-02/03, CUS-07. |
| Source native piece ID/key/structure digest | Reconfirm | A2 selected scope must belong to source; absent native identity blocks piece-specific repeat. ORD-13, TRU-06. |
| Source service subject/line/change IDs and digests | Reconfirm | Select original/current accepted scope explicitly, including exact supplemental revision. ORD-08/12/14. |
| `customerId` / current contact code | Reconfirm | Suggest same authorised customer, load current profile; name/phone not copied into another person. CUS-01/02/07. |
| `wearerId`, relationship, service purpose | Reconfirm | Same distinct wearer only, current permission on every read/save/replay/accept. CUS-02/07, TRU-03. |
| Age/guardian order authority and consent evidence | Reconfirm | Re-read current records; do not copy grant/attestation. Minor measurement/photo purpose remains separate. TRU-05/13, AC-53. |
| Contact/wearer preferences | Reconfirm | Show current expressed preference in context; no rewrite or inferred fit recommendation. CUS-04, MEA-10. |
| `manifest.entryId/revisionId/definitionId` | Reconfirm | Historical triple retained as provenance; choose current eligible exact triple. Changed/retired source requires explicit review/replacement. SET-08, ORD-05. |
| Service `profile.entryId/revisionId`, mapping | Reconfirm | Current reviewed profile, wearer applicability and capacity basis; never inherit old mapping as current. SET-08/11, ORD-14. |
| Garment/category and reviewed requested-work choices | Reuse after review | Only choices supported by current manifest/profile; source and accepted candidate revision distinguished. ORD-08. |
| `instructions`, line `requestedWork` | Reuse after review | Individual selectable text, same authorised wearer/scope; owner edits/rejects. No completion/approval note treated as requested work. ORD-04/08, TRU-05. |
| Service `subjectDescription` | Reuse after review | Descriptive candidate; explicitly identify the new intake's garment. Description alone proves no physical identity or receipt. MAT-01/02, ORD-14. |
| `propertyReference`, `intakeContext` | Reset | Enter current reference/context afresh; source subject link stays separate. No copied received/location narrative. MAT-01/02, TRU-12. |
| New draft ID, target line IDs | Reset | Fresh UUID identities generated once and retained on retries. USE-03/08. |
| New order ID/code, `originDraftId/originLineId` | Reset | Allocate via normal acceptance; never reuse source order/code/origin. ORD-01/08. |
| New piece IDs, service `subjectId`, service line IDs | Reset | Regenerate from current scope; exact source IDs only in lineage. ORD-02/13/14. |
| `sourceOrderId/sourcePieceId` on service draft | Reconfirm | Existing field retains its service-context meaning. Separate repeat provenance identifies repeated order/line; never copy the source's ancestor as the immediate repeat source. ORD-12/14. |
| `presentation`, `presentationRevisionId` | Reconfirm | Current permitted Simple/detailed setting and exact presentation source; do not reinterpret old snapshot. SET-10. |
| `priceState`, `priceText`, per-line amounts | Reset | Start to-be-quoted / empty; owner explicitly reviews unknown or enters new exact paise amount, including zero. Old price read-only. ORD-08, FIN-03, TRU-12. |
| Package proposal, included/reference basis, discounts/rush amount | Reset | No inherited package agreement/allocation. New independent additive prices; current configured suggestions reviewed, no invented rates. FIN-03/05, SET-05/11. |
| `deliveryDate/deliveryTime` and original/current promise | Reset | Blank new intake; a fresh accepted promise after current review. ORD-04/08, SET-11. |
| `requestedDate/eventDate/occasion` | Reset | New occasion/date optional, never resurrect a past family event. ORD-04. |
| `priority` | Reset | Start normal under existing intake defaults; new rush selection/current rule evaluation only. SET-06/11. |
| `orderDate/historicalReason` | Reset | Existing new-order defaults; historical import only through supported explicit handling, no backdated creation/acceptance. ORD-04. |
| Created/accepted actor/time, intake owner | Reset | Server current actor/time and existing authorised owner defaults. Old actor/time retained only in source context. ORD-11/12. |
| `commitmentReview` / review fingerprint / exception and waiver reasons | Reset | Null review; current input/source/load fingerprint and fresh acknowledgement/reason. SET-11, AC-60. |
| Service `review` / agreement attestations | Reset | No inherited agreement; new current scope/price/date review. ORD-08/12, §27. |
| Requirement confirmations, not-required reasons/applicability | Reset | Regenerate unresolved/current-template states. Old confirmed/received/completed/not-required not asserted anew. ORD-05/06. |
| Service `lines`, `notRequired/notRequiredReason`, pending/not-required/completed state | Reset | Explicit new line selection; new requested lines pending. Not-required only via new reviewed applicability/reason; no completed work copied. ORD-06/14. |
| Task instances/checklists, assignment, QC, trial, fit acceptance | Reset | Fresh supported defaults only; execution/quality remains unresolved or unavailable. §27, ORD-08. |
| Capacity demand/coverage/contribution IDs | Reset | Zero draft demand; normal acceptance derives new current demand once. Never attach source coverage as already fulfilled. SET-11. |
| Payments, advance, UTR, allocations, credit/refund | Reset | No copied event/reference/balance; later finance flow owns any deliberate credit use. FIN-05/11, TRU-12. |
| Invoice/receipt number, quote approval, issued PDF/hash/share link | Reset | No issued document or approval inheritance; no rerender of old document. ORD-08/12, TRU-12. |
| Custody receipt/location/quantity/return, stock issue/remnant | Reset | No possession/movement facts or old stock reservation. AC-58 belongs to 1.5. MAT-01/02/05. |
| Garment/piece progress, cancellation, handover/delivery | Reset | New draft → booked only through acceptance; source lifecycle unchanged. §27, ORD-08. |
| Design-spec/measurement-version/fit correction values | Unavailable today | Manifest/form definitions exist; actual versioned personal records remain Phase 1.3/fit slices. MEA-10 is manual contextual retrieval, not automatic fit reuse. |
| Private reference photos, attachments, legacy notebook assets | Unavailable today | No implicit media transfer, especially across wearers; later exact-version access/rights/consent integration required. ORD-07, TRU-03/05/07. |
| Pattern outputs, AI recommendations | Unavailable today | No pattern engine or AI dependency. Product §29.1/31. |

## Proposed provenance and transaction contract

**Selected A1 allocation:** `order.repeat` schema version 1 is custom-only.
`order_repeat_origin` stores shop/draft/source-order IDs, actor, trusted time,
initial command key and a strict reference containing source ID/version,
snapshot digest, scope digest and explicit instruction selection. Draft ID is the
operation identity; workflow/schema version identifies the reuse policy. Exact
booking membership/version and supplemental IDs/versions/digests participate in
the scope digest; A1 does not select piece/service lines. `order_repeat_target`
binds the accepted order to that draft. Its normal immutable acceptance snapshot
stores the reviewed reference, including any explicitly refreshed version/scope.
Source kind is enforced as custom rather than duplicated as a mutable label.
Actor/key joins provide the ordinary draft audit trail. A2 needs a separately
reviewed schema for selected piece/line references; those proposed future fields
are not fabricated in A1. See implementation evidence and migration 0037.

**Selected A2 allocation (#135):** `order.repeat-service` schema version 1
extends the strict service draft through an independent adapter. Migration 0038
adds `service_repeat_origin`, typed `service_repeat_selection` rows and
`service_repeat_target`. Source kinds are standalone line, accepted supplemental
line/change, or pinned original add-on. Shop/order/piece/catalogue/line composite
references validate exact provenance. Original subject/line IDs stay in provenance;
new subject/target line IDs are distinct. Current review may explicitly refresh
source/scope/line versions, while source identity, digests and selection remain
fixed. Ordinary service acceptance, numbering, commitment and audit are reused.
Current mappings must reference the same stable catalogue entry and support the
native source piece; production-task mappings remain blocked. A1 strict readers
and workflow remain unchanged. See the [A2 field matrix and evidence](Repeat_Service_Implementation_Evidence.md).

Names below are independent implementation proposals, not competitor schema.
Keep an additive `order_repeat_origin` record tied to the durable draft. It stores
shop, repeat operation ID, draft ID, source order/kind/version/snapshot digest,
selected source piece and line/revision references, selection digest, field policy
version, reviewed candidate references, actor/time and minimal audit ID. Use
typed child references/checks for native versus supplemental lines; no unvalidated
polymorphic UUID. An immutable accepted-lineage record binds that exact origin
to the new accepted order/digest. Reverse links query it; source data stays intact.

Draft provenance is immutable; editable candidate fields and acknowledged review
belong to ordinary versioned draft payloads. A new proposed `order.repeat` v1
adapter discriminates custom/service candidates and delegates validation/review/
promotion to existing intake policies/writers. Do not loosen old strict DTOs,
silently add provenance fields to old snapshots, or create a second draft/audit
engine. A1 accepts custom only; A2 adds a separately versioned supported adapter
or explicit conversion, preserving A1 drafts. Final schema/version allocation is
reviewed when the selected ticket starts, not assumed compatible by this packet.
If the owner converts the repeat into grouped/add-on intake, the existing explicit
conversion must preserve origin lineage atomically or visibly block that conversion.

Proposed thin API queries/commands inside existing modules:

- Source discovery/search with customer/wearer and bounded cursor in POST body;
  no personal query/filter text in URLs, cache or logs. Exact-source review returns
  safe context, source ETag and candidate eligibility, with no mutation.
- Create-repeat command binds operation/draft IDs, source version/digest, explicit
  selections and review policy version, current actor/action/request hash. It
  creates draft + provenance + audit + minimal replay result in one transaction.
- Existing durable draft save/reload/cancel, commitment review and promotion paths
  are reused through the adapter. Acceptance writes new order/snapshot, demand,
  lineage, draft result, audit and applicable jobs atomically. No jobs are needed
  just to display source links; future jobs carry only IDs and re-read current state.
- Source/new relationship query authorises both ends before showing details.
  A later revoked/deleted source yields an unavailable/tombstone label without
  copying its old personal text into replay/lineage. Target order access is
  independently checked; lineage does not grant it.

All operations use membership-bound `withShop`, transaction-local user/shop/actor,
runtime `app_user`, non-null shop IDs, composite tenant/order/piece/line/draft FKs,
shop-led indexes/uniqueness, ENABLE/FORCE RLS and matching write policies. Keep
personal text in redaction-capable records; lineage/audit/replay contain minimal
IDs, digests and field names. Privacy erasure cannot leave ungoverned copied notes.

Locks follow the existing request/draft → sorted booking/order aggregates →
sorted identity authority → catalogue/forms/templates/profiles → commitments/
bindings/calendar/policies/profile → sorted category demand → code-allocation
classes. Review and current-scope queries must share the same aggregate/CAS
protocol as service additions/completion. Re-read first membership after locks;
do not lock identity then discover an earlier aggregate lock. Prove the actual
graph and revocation/publication/acceptance races with PostgreSQL.

Source preconditions and new-draft ETags are distinct. Missing required If-Match
is 428, stale source/draft version 412, changed eligibility/review 409, invalid
selection/changed idempotent payload 422; inaccessible source is non-disclosing
404. Same actor/action/hash replays only after current access checks. Durable
unique operation→draft and draft→accepted target bindings survive key expiry.
Multiple intentional repeat orders from one source are allowed under distinct
operations; do not impose global source uniqueness. Unknown-outcome recovery
freezes request/preconditions; new typing waits in memory until outcome resolution.

## History and identity outcomes

**B — unified customer/wearer history:** a paginated projection over implemented
customer/wearer corrections and authority events, accepted custom/service orders,
booking membership/commercial revisions, native pieces, service additions/progress
and repeat lineage. Show recorded actor/time/reason, exact version and original
attribution with safe current labels. Group correlated rows without dropping
meaningful revisions or counting one order twice. Drafts appear in Resume drafts,
not as accepted business events. No event-sourcing rewrite or parallel audit log.

Query uses explicit customer versus wearer scope, current access checks before
counts/pagination, deterministic ordering `(recorded_at, event-kind, event-id)`
and an opaque scope/filter-bound cursor. Define a first-page high-water boundary
so new writes cannot make later pages duplicate/skip entries. Search uses existing
Tamil/Tanglish keys and aliases; financial/property/measurement values are omitted
until authoritative domain integration exists. An absent domain says unavailable,
not paid/received/delivered or zero. Source detail remains authoritative.

**C1 — duplicate review and corrective edits:** reuse existing search and correction
commands. Candidate reasons may be exact stored identifier/normalised phone/name
matches using existing keys; no new similarity score or confidence threshold.
Shared phone alone can surface a review candidate, never a merge recommendation
that asserts identity. Show distinct codes/wearers, allow dismiss/keep separate,
and preserve an attributable review decision. Contact/age/name corrections require
reason, If-Match, current notice/authority and material revision history. Corrections
never silently relink accepted orders or rewrite their person snapshots.

**C2 — authorised merge/relink:** preview named source/survivor contacts, versions,
all relationships and affected implemented records, conflicts, financial references
and unavailable domains. Explicitly select survivor fields and each permitted
current association; reason and new reviewed confirmation required. Customer
contact merge does not merge distinct wearer/person/guardian identities. Keep old
IDs/codes as alias/tombstone references, original accepted/issued attribution and
snapshot bytes; current lookup resolves to the survivor with a visible correction
link. Never transfer purpose consent, private assets or body records by association.
Ambiguous self/wearer/guardian conflicts block rather than guessing.

Sensitive relinks are their own reviewed commands naming exact relationship,
source/destination identities, version, authority and affected records. C2 initially
blocks measurement/private-media/issued-finance relinks until those domain policies
and consumers are implemented and separately approved. It previews the exclusion
and retains existing references. It cannot mark CUS-05/06 fully complete while
those applicable domains remain unintegrated. Concurrent corrections invalidate
the preview; deterministic aggregate locks and durable alias-cycle prevention
are required. Mistakes are corrected by new reviewed events, not history deletion.

## Presentation, states and review surface

Extend the established Current light/dark, semantic tokens, Noto Sans/Noto Sans
Tamil, shared Field/Input/Button/Status/Dialog and owner shell from
[design system](../aarili-design-system.md). English startup and explicit Tamil
switching remain; preserve original entered text. The canonical project plan and
design system govern this preparation; no competing PRODUCT.md/DESIGN.md is added.

Phone: source summary, explicit selection, short reuse review and new-input form
in one readable column. One primary action per stage, Save draft and Review
commitment within reach, clear source/new heading, no dense history table. Tablet
portrait uses one pane; landscape and desktop may pair source context with new
inputs, keeping context out of the editable form. Three verification sizes:
360×800, 820×1180 and 1440×900 plus tablet landscape, both languages/themes.
Sticky controls cannot cover keyboard/focus; 44px targets, wrapping Tamil labels,
associated errors, heading focus after navigation and origin focus after cancel.
History lazily loads context without preloading private images.

| State | Visible behaviour |
| --- | --- |
| Loading / no history / no matches | Distinguish each; do not show zero balances or wrong-person previous results. |
| Source unavailable / permission revoked | Clear source data and pending responses; offer ordinary intake without hidden carryover. |
| Changed/retired definition or missing mapping | Explain specific review gap, retain draft; no stale-source acceptance or silent substitute. |
| Unsaved / Saving / Saved / Not saved | Existing IME-safe autosave/recovery; reload recovers only acknowledged values. |
| Cancel | Review unacknowledged edits; keep saved draft or explicitly discard through existing lifecycle. Never cancel the source order. |
| Checking outcome / retry | Replay same bound operation; no second draft/order/demand. |
| 412 / 409 | Compare current source/draft/scope and intended values; refresh/review explicitly, no auto-merge. |
| Accepted | New code and source relationship; production/approval/money/property remain independent. |

Preparation review is a document/wireflow review. A running implementation review
surface is required only after a selected ticket builds the capability. It must
use the existing synthetic local/test host, exact startup/route/private access,
RH-linked steps and teardown, with human Tamil/AT/Android observations separately
recorded. No hosted tunnel or live activation is implied.
