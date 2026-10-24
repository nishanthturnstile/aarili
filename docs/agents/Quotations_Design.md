# Itemised estimates and quotations: independent design

24 October 2026. Roadmap **1.4.1**, **FIN-01–04**. **Owner-approved design and
four-ticket packet; A1 (#173) merged, A2 (#174) selected for implementation.** [Research](Quotations_REA_Evidence.md),
[concrete tickets](Quotations_Ticket_Packet.md),
[fresh preparation evidence](Quotations_Implementation_Evidence.md).

## Authority and integrated baseline

The [product plan](../Boutique_Business_Management_Final_Product_Plan.md)
§§3/6/9–10/16–17/19/24–25/27/29.1/30.1/32–33 governs behaviour and release;
[architecture](../Architecture_and_Technology_Decisions.md) §§6–11/15 governs
technology. The [brief](Quotations_REA_Prompt.md),
[workflow](Development_Workflow.md), [tracker](issue-tracker.md) and
[design system](../aarili-design-system.md) apply. This proposal does not change
either baseline. It supplies requirement-derived Q acceptance checks under §33.1;
there is no invented product AC number for quotation arithmetic.

Fresh fetch found origin/development at `941806755e9de0cb6fd8a0f204a8f54420dadb66`.
The current topic checkout's runtime source matches that tree. Job-slip/label
PRs #171/#172 are merged with successful Fast verification and Dependency audit.
Earlier in-progress headings in their evidence are historical. Merged code is
not approved live content, policy, privacy or pilot activation. No 1.4.1 issue
existed at preparation. The owner's subsequent “approved and proceed” authorized
publication of #173–#176 and selected the first ready issue, A1 #173. Only A1 is
implemented in this change; full quotation issuance remains later work.

Reuse [shop settings](Shop_Settings_Design.md) and
[policy authority evidence](Shop_Policies_Implementation_Evidence.md),
[service templates](Service_Templates_Design.md), [Quick Order](Quick_Order_Design.md),
[grouped bookings](Grouped_Bookings_Design.md), [small services](Small_Service_Design.md),
[accepted additions](Service_Additions_Implementation_Evidence.md),
[design specifications](Design_Specification_Design.md),
[job slips](Job_Slips_Labels_Design.md),
[journal](Issue_34_Balanced_Journal_Evidence.md),
[PDF issuance](Issue_59_Versioned_PDF_Evidence.md) and
[private sharing](Issue_60_Private_PDF_Sharing_Evidence.md).

## Existing implementation seams

Paths below are verified source discovery, not proposed new packages.
The codebase-memory inventory has no index for this checkout; source was read
directly. No new index, skill, dependency or runtime was installed.

| Source | Existing behaviour and required extension |
| --- | --- |
| `packages/money/src/index.ts` | `parseRupees`, `parseMetres`, checked bigint arithmetic, safe wire conversion, `checkedMultiplyDivide`, `materialCost`, `allocateFin05`, `formatPaise`. Fractional results are rejected; no generic rounding policy exists. Reuse these functions. |
| `contracts/service-catalogue.ts`, `service-templates.ts`; corresponding core/repositories | Stable category/service/piece/add-on IDs, exact revisions, availability and manifest references. Add rate references to these identities; no second garment catalogue or pricing expression language. |
| `contracts/orders.ts`, `core/group-intake.ts`, `db/orders-repository.ts` | Quoted/null intake paise, immutable acceptance, `groupCommercialSchema`, package-included `referencePaise` with null allocation and exact packageVersionId/lineId. These are preserved source facts, not approved quotations. |
| `core/service-changes.ts`, `service-intake-addons.ts`, `contracts/small-services.ts` | Stable supplemental service scope, additional-charge/outside-package semantics, known subtotal and unknown count. Current scope readers already avoid adding included amounts twice. Reuse their source identities and commercial versions. |
| `contracts/shop-policies.ts`, `core/shop-policies.ts` | Draft owner proposals; only synthetic-fixture publications. `bindingQuote` has pending production authority and action-not-implemented reasons. Never relabel old fixtures or remove all readiness gates. |
| `core/drafts.ts`, `db/draft-repository.ts`, web `draft-recovery.ts` | Durable workflow registry, distinct incomplete/command schemas, immutable promotion result, exact-key recovery, ETags and memory-only unsaved edits. Register new versioned workflows here. |
| `core/documents.ts`, `db/repositories/documents.ts`, `core/job-slips.ts`, `job-slip-sources.ts` | Document model/attempt/output/job atomicity, trusted template, current authorization, stored hashes, privacy barrier and audited source/document purge precedent. Add quotation audience and binding adapters. No competing PDF engine. |
| `db/orders-repository.ts`, `bookings-repository.ts` | Stable tenant advisory locks and retained readable-code allocation. Generic documents have revision IDs but no commercial quote number allocator. Extend the existing lock/allocation pattern for quote numbers; do not claim a ready-made invoice sequence exists. |
| `core/journal.ts` and journal repositories | Posting infrastructure only. Quotation commands must never call `postJournal`; totals are proposals, with no receivable, revenue, deposit, payment, stock or custody effects. |

## Approved design decisions

### QD-01 — Effective-dated owner-controlled rate schedules

Settings → Rates lists current, future, ended and unavailable rate revisions.
A rate identity binds an exact catalogue definition/manifest, charge component,
unit and basis quantity. Components cover garment labour, lining, additional
fabric, trims, alteration, Aari/craft and approved rush service. Existing craft
choice/complexity/coverage IDs may be selected where reviewed; never infer a
complexity grade, fabricate a mapping or multiply guessed factors.

Use a recoverable rate draft and explicit owner review/publication. Freeze
description, bilingual unit label, nonnegative selling-rate paise, positive
integer basis, applicable source IDs, effective interval, actor, reason and hash.
Blank rate is a draft unknown; published rates require a value, including an
explicitly justified zero. Estimated cost is a separate private fact (QD-04).

Proposed date convention: the estimate's **pricing date** is explicitly reviewed,
initially today's server-derived shop-local date. It is neither delivery date
nor intake acceptance date. Store ISO date plus the shop-profile timezone
revision; founding timezone remains Asia/Kolkata. Rate intervals are local dates
`[validFrom, validUntil)` with an optional open end. Publication has a separate
server UTC recorded time. Future schedules need no activation job: selection
resolves the date, reviewed schedule version and current availability.

For each exact source/component/unit identity, at most one approved schedule
entry covers a date. Publishing a replacement appends a **new schedule revision**
that closes/replaces entries in that schedule; the earlier schedule and rate
rows remain immutable. Validate interval overlap under a stable identity lock,
including first publication, and back it with database guards. Never select the
latest timestamp or most-specific-looking overlapping row. Ambiguity is blocked.
No silent wildcard category fallback or conversion between unrelated units.

Proposed first-delivery limit: no retroactive effective start before publication's
shop-local date. Allow today/future intervals; a historical pricing date may use
an already recorded historical schedule/rate. A gap stays unknown. Corrections
append today's/future schedule; historical import/backfill requires a later
reviewed decision. This is a proposed implementation limit, not a claim that
FIN-01 prohibits backdating. Retiring a definition/rate blocks new selection but
preserves exact historical reads and issued documents. A stale existing draft
shows the prior selection and a blocker until explicit review/override.

Owner override is a separate exact amount/rate with reason, authority and
predecessor/source reference. It never edits the catalogue. Refresh prices is
explicit: show old/new source IDs, rates, quantities and totals, then save a new
estimate version. Opening a draft, changing language or issuing a PDF cannot
refresh prices. A schedule edit invalidates an outstanding review fingerprint.

### QD-02 — Recoverable garment estimates and exact scope

An estimate can be prepared before commitment: choose an existing customer/wearer
when known, catalogue garment/service and draft scope; no accepted order, full
body form, payment or material receipt is needed. Unattached draft components
have draft-local IDs, not fake garment/piece IDs. Later attachment to a real
order/piece requires exact mapping/review and produces new provenance; it does
not accept an order or reuse an old approval. Standalone wearerless finishing
retains the existing reviewed applicability; fit-specific/minor scope retains
current wearer/guardian authorization.

Open Estimate from an order, native piece's parent commercial scope, service
subject or standalone draft. A real order link pins acceptance digest, aggregate
version, specification selection, supplemental and package commercial versions.
Per-piece breakdown is optional; it partitions the parent charge and cannot
create a second charge for that order. No piece identity from quantity alone.

Each line has immutable commercial identity, stable display sequence, source
order/service/subject/piece association, component, bilingual customer-safe
description, quantity and unit, rate basis, exact source or override provenance,
selling-price state, inclusions/exclusions and assumptions. Same service on two
different subjects is distinct; the same source line reached through two views
is one fact. Do not deduplicate using names.

Draft states are unknown, known charge, included reference, complimentary or
explicitly excluded with reason. Unknown quantity/rate/price stays null and
visible. Included reference means covered by another named charge, **not** a
known zero allocation. Complimentary means an explicit zero selling amount and
reason; its cost remains known/unknown independently. Exclusion never silently
removes accepted scope. Incomplete material-source choice blocks price readiness.

Show **Known subtotal — incomplete**, unanswered line count, assumptions and
issue blockers. A sum of known lines is never called total when any charge is
unknown. Save incomplete/invalid typed inputs in the existing durable workflow;
the strict review/issue schema rejects unresolved commercial facts. Proposed
initial scope allows internal incomplete estimates, but **no provisional issued
quotation with unknown selling amounts/quantities**. Narrative assumptions may
remain if explicit and do not hide missing price/scope. No guessed expiry.

### QD-03 — Exact quantities, discounts and supported arithmetic

Use integer counts for pieces/jobs, integer millimetres for fabric and a positive
integer rate basis in the same unit. No floating money/quantity multiplication.
For a rate in paise per basis unit, calculate `ratePaise × quantity / basis`
through `checkedMultiplyDivide`; sum/subtract through checked utilities.
For percentages store whole basis points, with 10,000 = 100%, using exact
`basePaise × bps / 10,000`. Rate/quantity precision is part of the reviewed unit
definition; unsupported fractional counts or excess decimal precision fail.

**Proposed initial arithmetic decision: exact paise only.** Fractional-paise
products/discounts are retained as unsupported in drafts and block quote review/
issue. The owner can explicitly enter a separately reasoned exact fixed-price
or fixed-discount proposal where policy permits; never silently round the
calculation. Adding rounding later requires a separately reviewed policy/version.
This keeps the existing utility contract and installs no guessed rule.

All input/output amounts fit the existing safe-integer paise contract; SQL uses
bigint and checked decimal-string conversion. Existing cumulative current-scope
readers may expose larger exact decimal strings: preserve those source displays,
but block unsupported quotation calculations/issue rather than coerce to Number.
Check every line, subtotal, discount and final result. Bigint intermediates are
allowed; final wire values must be safe. Format with the incumbent money formatter.

Line discount applies once to a charge line's gross price. Booking discount
applies once to the eligible **post-line-discount** charge base. Store selected
scope, authority, calculation basis, source/policy version and resulting amount.
Included/display-only/complimentary/excluded rows are not additional eligible
bases. Reject negative amounts, discounts over policy authority or charges,
duplicate discount IDs and stale bases. No unrestricted adjustment/round-off line.

Use existing `allocateFin05` with stable persisted sequence (tie-break by stable
ID only if sequences collide, which validation normally rejects) for booking
discount attribution and optional shared estimated-cost attribution. Floor each
proportional share to whole rupees; give every remaining rupee **and paise** to
the largest-charge line, earliest when tied. Never replace it with largest
fractional remainder or re-sort by the UI. This reuses #33; it does not deliver
payment allocation in 1.4.2.

After allocation, require every discount share ≤ its eligible charge. FIN-05
alone does not guarantee that: three one-paise lines with a two-paise discount
give all two paise to the first line. Block that proportional result; offer a
policy-authorized, reasoned explicit allocation whose nonnegative shares sum
exactly to the source and respect all caps. No silent cap/redistribution. A
positive booking discount on zero eligible charge is blocked, never labelled
customer credit. A zero discount has zero effect. Positive shared estimated cost
on zero selling charge remains **unattributed private cost**, with reason and
completeness warning; it is not a deposit/expense or fabricated proportional split.

Synthetic arithmetic examples, not production rates/policies:

| Input | Exact expected proposal |
| --- | --- |
| 2,200 mm × 10,000 paise / 1,000 mm | 22,000 paise; basis retained |
| 1 mm × 1 paise / 1,000 mm | Fractional paise; blocked, not zero |
| 10,001 paise × 125 bps / 10,000 | Fractional paise; no silent rounding |
| 100,001-paise shared amount; three equal 100,000-paise bases | 33,401 / 33,300 / 33,300 paise; earliest gets all remainder |
| 30,000-paise discount; same three bases | 10,000 each; total reconciles |
| One unknown line plus known 10,000 paise | Known subtotal 10,000; confirmed total absent |

### QD-04 — Private estimated and authoritative actual cost

Selling amount, estimated fulfilment cost and actual fulfilment cost are separate
typed records with independent completeness, source/basis, date, actor and
provenance. Optional private cost components cover owner labour, purchased
materials and external craft estimates where the owner knows them. Cost is not
derived by subtracting a guessed margin or copied from selling rates.
No new purchase/payroll/vendor settlement or stock-cost engine is introduced.
Actual cost comes only from implemented authoritative cost events, deduplicated
by source identity; where no consumer exists show **Actual cost unavailable**.
Do not seed actuals or convert an estimate into an expense posting. Internal
estimated margin is labelled a proposal, incomplete if either side is unknown;
it is never reported as realized revenue/contribution/profit.

Keep private cost rows/projections separate from customer quotation content.
Customer DTO, immutable customer model, PDF, PDF metadata/hidden text, filename,
share text and audit payloads have strict allowlists with no cost/margin fields.
Do not spread an owner model then hide columns. Poison-field and artifact scans
must prove exclusion. The owner screen labels the private panel explicitly;
review mode uses the same customer projection that issuance will freeze.

Customer-supplied fabric/trims may appear as supplied-by-customer scope, with no
shop-stock sale charge. Any agreed handling service is a separate disclosed
charge with its own source/policy. A customer-owned material cannot be relabelled
shop stock to price it. A quote neither receives/reserves/consumes stock nor
records custody. Complimentary or included work retains real known costs (or
unknown cost warnings) when selling price is zero/covered; changing price cannot
delete cost history or imply cost zero.

### QD-05 — Booking/package/service consolidation

Choose the exact current booking revision and selected garment/service scopes.
Build one canonical commercial graph from stable charge identities and inclusion
edges, then project garment and booking views from it. Repeated source/line IDs,
cross-booking/tenant/piece references, inclusion cycles, multiple charging parents
or partially selected indivisible packages are blocked.

For garment-price basis, count each base garment once and each independently
priced supplemental service once. An estimate breakdown replaces the view of
its parent amount; it is not added to it. For package basis, use one package
charge owned by the exact package commercial version and frozen included set.
Garment amounts remain reference/display-only unless an explicit reviewed split
exactly reconciles. Append outside-package services once using their native
accepted addition IDs. Show package plus extras, never package plus reference
garment amounts plus extras. Standalone services use their own line identities.

A newly prepared proposal can differ from an intake proposal, but never becomes
the agreed order value from this editor. Show the comparison explicitly. Frozen
accepted/package terms and previously attested additional-service prices remain
unchanged. Binding against an already agreed price/scope requires 1.4.3; until
that consumer exists, only clearly labelled alternatives may be saved/issued and
**Apply to order** remains unavailable. Unsupported/imported agreement state
fails closed. No new booking acceptance, capacity or production update.

Maintain a quote family and explicit scope manifest. Only one selected current
proposal for any overlapping commercial scope; lock actual member identities
as well as the booking so garment and booking editors cannot race around it.
Other proposals are labelled alternatives and are never aggregated as a single
agreement. Supersede requires an exact predecessor and reason. A replacement
covering several current families lists each predecessor; do not silently mark
unselected scopes superseded. Disjoint scopes may coexist with clear scope
labels, but their PDF totals are not implicitly added to an agreement.

### QD-06 — Policy readiness without invented authority

Reuse shop policy authoring/review/history. Add a versioned **quotation policy
review binding** to exact owner-proposal content/hash, using the existing
configuration binding precedent. It records actual reviewer, reviewed terms,
review time, decision, reason and the finite quotation action scope. It does
not mutate synthetic-only historical revisions or make payments/bills/refunds
available. Editing a bound proposal invalidates new selection until a new review.
Synthetic fixtures can never acquire production authority through rebinding.

Rate publication and quote policy review are distinct from customer response.
Software approval permits building this binding, not inserting real approved
values. A production owner-proposal must be recoverably saved and reviewed
without weakening existing synthetic publication guards. Extend via a versioned
binding target to the durable saved proposal/digest; keep old v1 readers strict.

Preliminary estimate save/calculation requires neither receiving account nor
advance/cancellation approval. Quotation issuance checks exact current rate or
authorized override, selected scope, material ownership, all selling amounts,
discount authority (including stacking/eligibility), validity and approved
bilingual customer terms, shop identity/non-tax status and document settings.
The existing binding-quote prerequisite set (advance, validity, discount,
cancellation, change charges) remains explicit when presenting those terms;
unreviewed mandatory content blocks issuance. Scoped not-applicable must be
reviewed, cannot replace a required validity/authority decision, and is never a
generic bypass. No check of material *receipt* or payment *verification* for a quote.

Proposed validity semantics: explicit local expiry date, inclusive through that
shop-local day; derived expiry uses the reviewed calendarDays convention,
`issueDate + calendarDays`, and displays both dates for review. Never default a
duration. Issue time/date is server-derived now; no backdated issuance. Expiry
is derived at read time, with no outbound reminder job. It never changes a
delivery promise. An expired/superseded response stays historical and cannot
activate an agreement.

### QD-07 — Immutable proposal, issue and response boundaries

Estimate draft → saved immutable estimate version → reviewed immutable quotation
proposal → issued immutable quotation revision. B provides the reviewed booking
proposal and comparison, labelled **Not issued**. C alone supplies quotation
issuance, number, queued PDF and response recording. There is no earlier issue
that would later attach a render job non-atomically. Garment-only issuance uses
the same proposal path with a one-garment scope.

Freeze exact rate/schedule/definition/policy, scope/identity versions, calculation
algorithm, ordered charge/discount attribution, assumptions, customer projection,
language, A4, profile, template/font manifests and permitted branding at issue.
No fitting media, body values, production notes or pattern assets in the quote.
Core estimating remains usable without PDF rendering or historical images.

FIN-03 response recording is included in C: append owner-attested approval or
rejection against **exact issued revision and model hash**, respondent identity
where authorized, server recorder/time, reported response time, channel
(verbal/manual message/written), bounded evidence note/reference and reason.
Evidence must not require accessing private WhatsApp history. No signature claim.
Corrections/withdrawal append linked events; no overwrite. No response means
pending, never approved. Superseding a quotation never carries its response.
Responses to expired/withdrawn/superseded versions are recorded as historical,
with an ineligible-for-agreement warning. A response can be recorded without a
false marked-sent event, for example an in-shop verbal review.

Record response is not **Confirm agreement**. 1.4.3 must explicitly consume the
revision/digest, exact scope, current response/evidence and price/date/design
impact under its own gates. Until then no accepted order price/promise,
production approval or capacity mutation follows. Payment evidence/allocation
is 1.4.2; bills/receipts 1.4.4; financial corrections 1.4.5.

### QD-08 — Quote numbering and artifact lifecycle

Proposed synthetic review format: per-shop **quotation** sequence `QT-000001`,
no reset, monotonically increasing; each new issued commercial revision gets a
new number and points to its predecessor/family. Print both revision and number.
This convention needs owner approval; live document format/reset/correction
approval remains separately required. It does not allocate invoice numbers or
inherit `QO-`/`BK-` sequences. A language reissue is explicit and traceable, never
an overwrite of the prior artifact.

Reuse the tenant allocator locking pattern, with a retained quote-number record
and shop/type uniqueness. Issue locks sources and the counter in a documented
order; number, exact business revision, document binding/model, audit,
idempotency result and `pdf.render` job commit together. Before commit there is
no issued number; an aborted transaction has no advertised identifier. Once
committed, render failure, retry, void or withdrawal cannot reuse that number.
Cancelled numbers retain reasons. No independent nontransactional reservation
flow is introduced. Expired request keys cannot create a second issue for the
same proposal/revision: durable origin uniqueness remains.

Use the trusted registered quotation template through existing document jobs,
render/storage/lease/output-intention paths. Payload carries locators, not prices
or personal text. Retry reads the frozen model; rendering failure retains the
issued revision and number and displays failed/retry status. Source/policy
authorization, restore epoch/quarantine, privacy barrier and revocation are
rechecked around I/O and final acceptance. Do not gate unrelated internal draft
saves on money freeze. Apply existing document controls to issue/render; do not
invent a posting just to inherit a financial gate.

Stored artifacts are downloaded by exact revision and verified hash. No rerender
with latest profile, rates, terms, template or fonts. Missing historical bytes
show unavailable/recovery action, never silent reconstruction. Authorized privacy
redaction/tombstones/purge must extend to quotations, customer notes/identity,
models, artifacts and queued/in-flight work through existing audited functions.
Retain nonpersonal provenance; current rights can deny access without pretending
bytes never existed. Existing technical orphan cleanup is not a full retention
or backup-erasure implementation; live retention/recovery gates remain open.

### QD-09 — Bilingual A4 PDF and deliberate manual sharing

Customer projection includes shop identity, document title **Quotation — not a
bill**, number/revision, issue/pricing/expiry dates, customer-safe scope and
garment identifiers, supplied-material declaration, ordered quantity/unit/rate/
charge rows, inclusions/exclusions, disclosed discounts/attribution, assumptions,
complete total and reviewed terms. No GSTIN, GST/0% GST column, tax amount,
balance due, payment QR/link, deposit confirmation or receipt wording.

Use existing local Noto Latin/Tamil regular/600 fonts, A4 portrait, existing
15 mm margins and readable 12 pt body with Tamil leading. Repeat document/scope
and column headers on continuation pages, preserve long descriptions and mixed
Tamil/English/rupee values, keep total/terms labels with their values and never
shrink text to conceal overflow. English/Tamil are explicitly selected per
document, independent of current UI language. Owner template review is required.

Reuse private preview/prepare/download and the established native-file gesture.
Prepare bytes first; owner then deliberately opens the share sheet. Desktop/
unsupported browser downloads for manual attachment; separate explicit text
action opens WhatsApp where supported. Mark sent is an owner statement only;
cancelled/failed share does not mark sent. Prepared/shared/marked-sent is not
delivered/read/approved/paid. Tests never send real messages. No portal, automated
mail/message, provider credentials, stock reservation or retail scope.

### QD-10 — Transactions, API, privacy and migration

Add modules within existing core/contracts/db/API/UI boundaries, not new packages.
Core stays framework/vendor-free; repository interfaces stay transaction-bound.
Thin Node Hono routes validate/authorize/call/map, typed module clients serve
client-rendered UI. Browser imports no core/db/server auth. No business Server
Actions. Proposed workflows `pricing.rate`, `pricing.estimate` and
`pricing.quotation` are versioned registrations in the existing draft engine;
names are finalized at implementation, not silently added to old strict schemas.

Proposed relational entities: stable rate identity; immutable rate and schedule
revision/entries; exact policy-review binding; estimate identity/version/line;
separate private cost version/component/source; proposal/version and scope/line/
inclusion/discount/attribution links; quote-family current-scope selection;
issued quote/number/document binding; append-only response events. Use bounded
JSON for frozen values, composite relational FKs for cross-record integrity.
Every tenant table, child, binding/history/pointer has non-null shop_id,
shop-led indexes/uniqueness and ENABLE/FORCE RLS with read/write policies.

Every list/read/search/history/draft/replay/worker/PDF/share uses current verified
membership and subject rights through withShop under app_user. Current wearer/
guardian authority is checked independently of payer/booking membership. Replays
must not return private content after access loss. No source ID establishes
permission. Private cost remains owner-only even in audience projection APIs.

Record a concrete lock protocol before SQL: request/draft → privacy barrier →
sorted booking/order/scope aggregates → current identity/guardian authority →
catalogue/design/rate schedules → policy/profile → quote family → numbering →
document locks. Source editors, privacy functions and issuance must agree with
existing aggregate lock classes; inspect/test the combined graph, not just this
proposal. Serialization covers empty identities and overlapping scope. Job
enqueue, audit, mutation and actor/action/request-hash-bound key/result commit
atomically. Replay precedes current version rejection after reauthorization.
If-Match: 428 absent, 412 stale, 409 domain/source conflict, 422 invalid/changed
key payload. Never auto-merge pricing, scope or approvals.

Reviewed expand migrations allocated only when the selected ticket starts.
No seeded real rates, auto-approved policies or backfill rewriting accepted
prices/documents. Test upgrade with existing quick/group/package/service and
document history. Backup before non-disposable migration. Compatible application
rollback retains all new rows/artifacts and gates unsupported writers/readers;
no destructive down migration or live restore into development. Current privacy,
restore drill and §32/33 pilot gates remain applicable.

### QD-11 — Owner experience and recovery

Use existing Current light/dark tokens and bilingual controls; English startup
follows the recorded design-system decision. No redesign or new UI dependency.
Rates is a settings task. Estimate is an Orders/workspace task with **Save
estimate**, **Review prices** and an explicit customer projection. Private costs
are disclosed in an owner panel, never mixed with the customer's total.

Phone: one line editor at a time, readable scope header and persistent known/
unknown summary. Tablet landscape: line list and selected editor; portrait one
pane. Desktop: ordered line table and review panel. No horizontal money truncation.
All modes retain the same commercial graph and amounts. Explicit source refresh
shows old/new values and blockers. Warn clearly when a proposal differs from an
existing accepted price and no agreement-change consumer exists.

Show Unsaved/Saving/Saved/Not saved/Checking outcome/Conflict/Source changed;
defer autosave through Tamil IME composition. Preserve typed input on failure.
Resolve uncertain operations with the exact key/action/body/precondition before
saving later typing. Reload recovers acknowledged server revisions only. Flush
autosave before review/issue; changed inputs invalidate review. Dirty navigation
offers stay/save/explicit discard. Clear form/query/PDF/share memory on access
loss, sign-out and shop switch. No business content in browser storage, URLs,
service-worker caches or logs; opaque IDs alone may identify routes.

Minimum 44px targets, semantic error/unknown labels, keyboard/focus restoration,
screen-reader summary, Tamil wrapping, 320px reflow and enlarged text are required.
Three automated sizes cannot substitute for physical Android, fluent Tamil or
assistive-technology owner acceptance.

### QD-12 — Acceptance and activation decisions

Approve this software convention set and the four-ticket packet separately from
real rate values, complexity mappings, units/precision, policy terms, discount
limits/stacking, validity duration, numbering/template and live-use approval.
Synthetic fixtures remain clearly synthetic. No vendor amount, policy, template,
asset or implementation is imported. New rounding, backdating, arbitrary formulas,
actual-cost event entry and governed agreement changes remain outside this packet.

## Requirement-derived acceptance map

These are required future implementation checks, **not passed feature tests**.
Every ticket includes isolation/history/recovery checks applicable to its writes.

| ID | Requirement/scenario contribution | Required proof / ticket |
| --- | --- | --- |
| Q-01 | FIN-01, SET-08 | Exact identities/units, owner publication, date boundary/gap/future/overlap/disable, no historical rewrite; A1. |
| Q-02 | FIN-03, USE-03/08, AC-40/55 | Incomplete garment/service estimate, unknown vs zero, typed failure/IME/reload/second-session recovery, stale source and explicit diff; A2. |
| Q-03 | FIN-02/04 | Customer material no stock charge; separate handling; included/complimentary nonzero or unknown cost; A2/B/C. |
| Q-04 | FIN-02; shared FIN-05 function | Fractional fabric, percent precision, paise/fixed discounts, safe bounds/overflow, no rounding, caps/zero-base/tie/remainder reconciliation; A2/B. |
| Q-05 | FIN-02, ORD-02/13/14; AC-01/50/63 quote portions | Package/base/reference/extra/service/piece charges count once; duplicate/scope/inclusion negatives, overlapping proposals; B. No fulfilment claim. |
| Q-06 | FIN-04, TRU-03/07 | Private cost provenance, actual-cost unavailable/read-only authoritative seam, customer DTO/model/metadata/file/share poison-field scans; A2/B/C. |
| Q-07 | FIN-01–03, SET-05/09, AC-44 partial | Versioned policy binding and readiness, fixture authority cannot promote, no guessed rates/validity/discounts; A1 configuration, B review, C issue enforcement. |
| Q-08 | FIN-03, SET-08, ORD-12; AC-07 historical portion | Immutable estimates/proposals/issued revisions and exact source snapshot; catalogue/terms/shop/template/font updates preserve history/bytes; A2/B/C. |
| Q-09 | FIN-03; §27 approval boundary | Exact-revision owner-attested response, correction/rejection/pending/expired/superseded cases; no acceptance/payment effects or changed approved price; C. 1.4.3 remains. |
| Q-10 | FIN-21 boundary, §27 | Before/after table/event assertions prove zero journal/payment/revenue/receivable/capacity/stock/custody/production effects; all tickets. |
| Q-11 | TRU-01/06/12, USE-08; AC-38/55 | Real PG/app_user FORCE RLS, missing context/pool reuse, foreign refs, concurrent schedule/scope/issue, replay mismatch, expiry-resistant uniqueness and injected rollback; all writes. |
| Q-12 | FIN-03, USE-07/08; architecture §§8.4/9.3 | Locked unique numbers, one issue/job/audit, failure/retry/restore/privacy fencing, immutable stored hash and no silent reconstruction; C. |
| Q-13 | USE-01/02/09; AC-40/55 | English/Tamil both themes at 360×800/820×1180/1440×900 and tablet landscape, keyboard/axe/IME/reflow, memory clearing and conflict comparison; each UI ticket. |
| Q-14 | USE-07, COM-04/06/07/08 | Actual English/Tamil A4 PDF all-page visual/golden/font proof; cancelled native share/manual-download, marked-sent distinction, no private cost/tax; C. No real messages. |

Q-01–14 plus ticket criteria define whole 1.4.1 readiness. AC-17/49 contribute
existing arithmetic regression examples only; this feature does not deliver
their deposit/payment workflow. AC-25 is a later retail scenario, not a Phase 1
retail activation through complimentary estimates. Full AC-50/63/64 and §33 pilot
acceptance remain with their named later workflows.
