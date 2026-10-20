# Grouped bookings and outfit pieces: approved vertical tickets

19 October 2026; updated 20 October. **A–C approved; A merged in #121;
B (#119) selected for implementation.**
Roadmap **1.2.2**; [independent design and GB matrix](Grouped_Bookings_Design.md),
[REA evidence](Grouped_Bookings_REA_Evidence.md),
[verification status](Grouped_Bookings_Implementation_Evidence.md).

## Approval and dependency frontier

The owner approved this concrete A–C packet, publication and proceeding with A.
The five proposed decisions below are accepted, including all-or-nothing new
acceptance, one-time same-contact linking and `BK-000001` booking numbering.
B's #118/#114 direct blockers are merged. C waits for #119's merge. Merge, deployment,
paid plans and live activation remain separately controlled.

**Payment clarification:** manual payment recording/owner confirmation is the
initial payment approach in the later 1.4.2 slice. No payment gateway, automated
UPI collection/verification, bank integration or provider SDK is added here.
This slice creates no payment, allocation or posting; garment/package quote
information and unknown allocation remain as specified. Manual recording of an
externally received UPI payment later is distinct from automated UPI integration.

Inspected integrated base: `68d07ed` on development, equal to fetched origin.
Required predecessor outcomes are already merged:

| Outcome | Closed issue / merged PR |
| --- | --- |
| Quick Order draft / acceptance | #113 / #115; #114 / #116 |
| Private customer / adult wearer / minor guardian | #78 / #81; #79 / #82; #80 / #83 |
| Catalogue / piece forms / reviewed manifest | #97 / #102; #98 / #104; #99 / #105 |
| Lossless presentation / commitment binding | #100 / #107; #101 / #106 |

Published: **A [#118](https://github.com/nishanthturnstile/aarili/issues/118)**,
**B [#119](https://github.com/nishanthturnstile/aarili/issues/119)**,
**C [#120](https://github.com/nishanthturnstile/aarili/issues/120)**. Native blockers
were read back: #118 → #114/#99 (merged); #119 → #118/#114; #120 → #119/#114/#101.

Approved order: **A → B → C**. Each is a usable vertical outcome through
contracts/core/DB/API/client/UI and required tests, not a frontend/backend split.
The owner selected A, whose blockers were rechecked as merged. B waits for A's PR merge; C waits for B's PR merge (and
therefore A). Use native blocker edges and read them back when publication is
authorised. Recheck all closing PRs at the selected ticket's start; this dated
table is not a substitute for a fresh merged-prerequisite check.

## A — Reopen an outfit with exact pieces and visible unresolved work

Stable slice **1.2.2a**. Owner outcome: accept a single salwar through the existing
Quick Order path, reopen top/bottom/dupatta and understand each piece's missing
requirements; existing single-garment orders still work.

**Direct blockers:** #114 and #99 (their catalogue/form/presentation/identity
prerequisites are integrated). **Sources:** ORD-02/13, AC-63 structural part;
product §§3, 9, 13, 15, 24–25, 27, 32; architecture §§6–9, 11, 15.

**Complete outcome:** materialise stable applicable piece identities from exact
reviewed service snapshots during new acceptance; persist tenant-composite links
from requirements to the correct piece/order scope. Resolve flattened projection
keys through pinned definitions; never infer scope from labels. Reuse the current
projection and default owner, retaining section/required/applicability semantics.
Display independent piece details and unresolved blockers in Simple/Detailed,
with no execution command or extra capacity demand. Keep actual measurement,
task, quality, custody and handover mutations unavailable.

Support historical Quick Orders using an exact pinned-manifest read adapter and
an explicit versioned/idempotent materialisation command before future consumers
need relational IDs. Preserve snapshot digest and original/current promises.
One-time source/digest provenance is appended; no current-catalogue backfill.
Unresolvable legacy scope is visibly unsupported and cannot become ready.

**Migration/recovery:** additive reviewed piece/scoped-link/provenance tables,
non-null shop_id, composite order/source FKs, shop-led identity/source-key
uniqueness, ENABLE/FORCE matching RLS and app_user grants. Allocate filename at
implementation start. No destructive down migration; older compatible readers
retain original acceptance history and hide unsupported commands. Back up before
non-disposable application; synthetic disposable upgrade is the test path.

**Acceptance and negative tests:** GB-02/05/06/08/09/10 and affected GB-04.
Real PostgreSQL proves two-shop isolation, missing context/pool reuse, wrong-order
piece reference, denied/revoked wearer/guardian access, duplicate materialisation
race and stale/missing precondition, changed-key payload and rollback after actual
piece/link/audit writes. Snapshot edits/disable/rename do not change existing piece
IDs, labels, form versions, dependencies or digest. One salwar still contributes
one demand; legacy materialisation contributes zero. New acceptance fault after
piece insert leaves no accepted order/demand/orphan piece. Replay checks authority
and returns the same result. Unit/property tests cover scoped projection, unknown
applicability, order-wide blockers, exact repeated-mode equality and synthetic
future top-ready/bottom-correction input without claiming an execution workflow.

**Manual review:** on the actual local host's Orders route, use the existing
private synthetic access. Create one reviewed salwar draft with an unresolved
bottom requirement, save/reload, accept under configured synthetic commitments,
open each piece and switch modes/languages. Expect one QO ID, unchanged original
promise and one demand, visible bottom blocker and no Ready/Hand over action.
Repeat with an old order and the explicit structural materialisation review.
Provide actual URL, startup command, fixture IDs and automated evidence when
implementation exists; do not fabricate a running A screen in this design packet.

## B — Group accepted garments without changing their commitments

Stable slice **1.2.2b**. Owner outcome: find an already accepted blouse and salwar
for the same contact/two authorised wearers, group them for one visit/Bridal
occasion, and reopen their independent promises and missing pieces.

**Direct blockers:** approved/published A after merge; #114. **Sources:**
ORD-02/03/14, AC-01 structure/no duplication; product §§3, 5.3, 9, 17, 24–25,
27, 29.1/30.1, 32; architecture §§6–9, 11, 15.

**Complete outcome:** server-backed grouping draft/list/resume and review; create
optional booking from ungrouped accepted orders, or explicitly attach ungrouped
orders to an existing booking. Independent garment IDs, wearer, instructions,
dates, requirements and progress remain visible. Shared context never rewrites
orders. Retain same-contact restriction and separate payer/wearer/guardian
authority. Unique active membership prevents double grouping; no transfer/unlink
or corrective relinking. Every supported attach/context change appends history
with version, actor/time and reason. Show aggregate garment prices: known subtotal
plus unknown count, explicit zero intact. Package repricing of already accepted
orders requires later commercial revision; no package switch overwrites prices.

**Migration/recovery:** additive booking/current pointer, immutable context
revisions, membership and membership-history tables plus origin draft uniqueness.
Tenant-composite customer/order/actor links, forced policies and shop-led indexes.
Keep membership source order versions/digests for historical review without copying
private wearer labels into configuration records. Restore/rollback retains links
and history; no code that silently ungroups or deletes records on downgrade.

**Acceptance and negatives:** GB-01/03/04/05/06/07/08/09/10. Before/after database
assertions prove identical order snapshots, demands, financial-event counts and
job counts on grouping/retry. Test same-order duplicate, wrong contact, foreign
shop, revoked member, competing bookings attaching one order, stale booking or
source order, concurrent context edits, key expiry/origin uniqueness and faults
after each real write. Same key/actor/action/request replays once; changed payload
fails. Authorised stale comparison only. Rollback must leave neither membership
nor group/audit/result fragments. Server draft reload/second session, lost response,
IME/newer typing, dirty navigation and sign-out clearing are browser checks.
Reopen historical context after changed shop preferences/templates without
changing member snapshots. Retail/additional capacity/financial effects absent.

**Manual review:** group synthetic accepted blouse (self, quoted 120000 paise)
and salwar (another authorised adult, To be quoted), with different promises.
These are demonstration amounts, not business rates. Expect known subtotal
₹1,200 and one unquoted garment, not a false total. Change booking event date;
confirm original garment promises remain unchanged. A second tab's duplicate
attach fails clearly. A payer without guardian authority cannot add the minor's
garment or gain measurement permission. Run on all three sizes/languages.

## C — Save and atomically accept a new multi-garment package

Stable slice **1.2.2c**. Owner outcome: add a blouse for self and salwar for another
adult in one recoverable intake, review independent dates and exact pieces, choose
explicit price basis, then book all new garments once or retain the whole draft.

**Direct blockers:** approved/published B after merge, #114 and #101; A is
transitive through B. **Sources:** ORD-02/03/13/14, AC-01, AC-63 structure,
AC-40/55/60 integration; product §§3–9, 13, 15, 17, 24–25, 27, 32–33;
architecture §§6–11, 15.

**Complete outcome:** grouped draft uses stable UUID line identities, bounded
incomplete input and existing draft recovery. Add another garment preserves all
single-order fields. Explicit conversion of a Quick Order draft atomically binds
origin to one grouped draft and a durable replay result; no duplicate active draft
or accidental promotion. Copying common defaults to new lines is explicit; later
context changes do not change garment promises. Reorder and Simple/Detailed are
lossless. Every line owns its wearer, manifest, instructions, dates and price basis.

Support garment-price aggregate and new package proposal with frozen scope and
explicit included-line semantics. Package amount is not added to reference line
amounts. Unknown allocations remain unknown; zero remains deliberate zero.
Add versioned commercial-basis DTO/snapshot references rather than changing v1
Quick Order price meaning. A package is not a customer approval or a financial
posting. Line allocation, discounts, payments, bills, partial settlement and
execution remain later. New package proposal review requires owner decisions
below; no invented equal/proportional distribution.

Prepare/evaluate the whole candidate set in one transaction. Reuse current
acceptance logic via the minimal shared seam; do not promote multiple independent
Quick Order drafts and hope for compensation. Acquire all identity/source locks
in the incumbent class order, then distinct canonical-category capacity locks in
sorted order, then code allocation. Resolve current authority and demand under
locks; include earlier candidate demand in each category/week. Review fingerprint
binds complete membership/line inputs/sources/load/warnings/package basis.
Atomically write group, member orders, snapshots, pieces, requirements, one demand
per new garment, history, draft/result and audit. Existing orders may only use B's
linking path, without another acceptance. Failure anywhere leaves no new commitment.

**Migration/recovery:** additive group-origin line uniqueness, package-scope
versions/commercial references and any required draft workflow registration.
Use existing tenant guarantees; test populated upgrade from A/B. Request-key
expiry cannot duplicate a line or reconvert a draft. Older contract readers show
unsupported package basis, never reinterpret included/unknown as zero charge.
Compatible application rollback retains structural and commercial history.

**Acceptance and negatives:** all GB-01–GB-10. Real PostgreSQL races for last slot
with two candidates, different categories/week boundaries, opposite category
orders, single-versus-group acceptance, changed rule/binding/template/calendar,
guardian/service permission withdrawal, competing conversion and duplicate line
origins. Record timeout/deadlock outcomes without unbounded retries. Actual-write
fault injection after each order/snapshot/piece/demand/membership/audit/key/draft
stage proves zero partial group. Lost committed response exact replay returns the
same group/member IDs and one demand each; changed payload, 428/412/409/422,
unknown authority/load/effort mapping and stale review remain visible. Unit/property
tests cover order/paise arithmetic, scope consistency, null/zero/package totals,
stable line order and exact mode equality. No financial/custody/production job.

**Manual review:** create the primary two-wearer journey with different dates,
unknown salwar price and unresolved bottom; save/reload/second session; try stale
review and recover. Book all, drop the successful response in the controlled
local test, retry exactly and reopen one group/two orders. Separate synthetic
case demonstrates package amount versus reference amounts and unresolved allocation.
Separate minor case demonstrates denied payer/guardian consent. Inspect both
languages/themes at every size, keyboard focus, reflow and all hidden detailed
values after switching. Do not mark a top handed over to claim AC-63.

## Required checks for each implementation ticket

Apply [verification-before-completion](../../.agents/skills/verification-before-completion/SKILL.md)
and workflow evidence reuse. Run repository lint (Biome/boundaries/tokens), Knip,
strict typecheck, relevant unit/property/negative types/OpenAPI, production build
and focused real-PostgreSQL integration. A complete `pnpm verify:fast` covers its
components; do not repeat them without changed inputs. Select four Vitest workers
when reproducing the documented resource-concurrency issue, without weakening
assertions/timeouts. Run ticket-specific browser/axe checks in English/Tamil,
both themes at 360×800, 820×1180 and 1440×900 plus tablet landscape and enlarged
text. Match current repository script argument conventions at implementation.

All three tickets change relational/history/isolation surfaces: include the
forced-policy inventory, grant/negative tests, upgrade/recovery and actual-write
rollback cases. Full promotion `pnpm verify` and complete browser CI remain the
development→main gates; feature PRs need Fast verification and Dependency audit.
Run additional full suites only when the selected ticket's changed inputs or
uncovered risks justify them. Record source revision/dirty inputs, commands,
results/limits and actual manual host in implementation evidence; record delivery
timings as they happen in [Delivery_Measurements.md](Delivery_Measurements.md).

Human physical Android, fluent Tamil and assistive-technology review remain
pending until actual reports. No new issued PDF is implemented here; retain
unchanged PDF goldens and explicitly schedule customer-summary/piece-handover
document integration in 1.4.3/1.8.3. Pilot search-recall, privacy/content/rates,
restore drill and all product §32/33 activation gates remain separate.

## Approved owner decisions

The owner approved the concrete packet and all five decisions, with manual-only
initial payment handling clarified above:

1. Approve A/B/C and their sequence; select **A** as the first implementation.
2. Choose all-or-nothing acceptance for new garments. Partial acceptance is a
   separate future command, not automatic salvage after an error.
3. Permit initial one-time linking of ungrouped accepted same-contact orders;
   no detach/reassignment in this slice. Keep existing quoted amounts unchanged.
4. Accept package proposal semantics for new grouped intake: included scope,
   frozen package version, no second charge, unknown line allocation preserved;
   actual agreement/allocation needs the later financial workflow and reviewed
   inputs. Owner must supply any desired line-charge breakdown; no guessed split.
5. Use booking-code prefix `BK-000001`, distinct from existing QO identifiers
   and bill numbers. Booking identifiers are implemented in B, not A.

Product §32 catalogue/piece definitions, bilingual labels, forms/task applicability,
rates/caps/terms and production/privacy/live gates are not approved by approving
software tickets. Do not seed the demonstration salwar composition as universal.

For implementation review, read the design's journey, price table and GB matrix,
then the selected ticket. Report `ticket or GB ID — pass/fail — observation`.
Each implementation review packet must supply the
actual running synthetic route, private access method, concise steps/expected
results, automated evidence and cleanup, as required by the development workflow.
No running grouped-bookings application is claimed at this gate.
