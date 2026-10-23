# Manual and external patterns: concrete ticket packet

23 October 2026. Roadmap **1.3.3**, PAT-01/03, AC-07/08 contributions.
**Approved A → B; published as [#164](https://github.com/nishanthturnstile/aarili/issues/164)
and [#165](https://github.com/nishanthturnstile/aarili/issues/165). A is selected.**
Native blockers were written and read back on 23 October 2026. All A
prerequisites are merged into `c04020a`. B must wait for A to merge and its own
implementation selection. The packet below preserves the approved scope.
[Independent design](Manual_Pattern_Design.md),
[research and limitations](Manual_Pattern_REA_Evidence.md),
[current prerequisites and checks](Manual_Pattern_Implementation_Evidence.md).

## Sequence and decisions for approval

| Proposed ticket | Complete reviewable owner outcome | Direct blockers |
| --- | --- | --- |
| A — `[W1 1.3.3a] Record and review a fileless manual or external pattern reference` | Configure supported manual/external paths on existing types; choose one for a garment/piece; record, reopen, revise, review and explicitly select a physical reference with exact/unknown input provenance and immutable history. | #97 catalogue; #99 manifests; #147 exact specifications; #155 integrated measurement/private-history foundation; #138 identity/relink inventory; #16 atomic commands; #55/#56 durable draft/recovery; #51/#53 bilingual shell/vocabulary. |
| B — `[W1 1.3.3b] Attach private pattern outputs and deliberately replace or reuse exact references` | Upload/reopen a permitted sketch or PDF; preserve old files/versions on explicit replacement; review previous references as context and deliberately select for fresh authorized work. | A merged; #57/#58 uploads/processing; #148 design reference/rights integration; #155 current private-media/erasure composition; #134/#135 repeat adapters; #136 customer history. |

Both tickets require source/version/review honesty, fileless operation, privacy,
immutable history and scale/formula warnings. They cannot be deferred as polish.
A includes locator revision, selection history and input-change handling from its
first version. B extends those mechanisms; it does not replace them. A alone is
not full PAT-03 or 1.3.3 closure. If implementation sizing requires a further
split, return a concrete revised packet for review before publication.

**Known integration boundary:** current design/measurement target readers are
custom-order-only, with one measurement form per scope. A+B target those existing
supported garment/piece contexts and preserve no-pattern lightweight services.
Pattern-bearing service orders or multi-form selection are not secretly enabled.
If required for the owner's Phase 1 workflows, review/publish an additional
scope/input-adapter ticket before claiming full 1.3.3 closure. This is an explicit
coverage gap for acceptance review, not a change to committed product scope.

The owner approved software decisions MP-D01–12, publication and first selection
**A**. A fresh blocker check preceded implementation. B needs A's owner-reviewed
merge and its own selection. Neither ticket authorizes
production capabilities, business/consent policies, rule/scale validation,
push/PR publication, merge, deployment, spending or live data. Use existing
authorization if the owner later provides it; do not ask again for the same act.

Common sources: product §§3/7/9–10/13–15/24–25/27/29.1/30.1/32–33;
architecture §§6–11/15; roadmap 1.3.1–1.3.4, §9 architecture cross-check and
PAT/AC traceability; MP-D01–12; [development workflow](Development_Workflow.md).
Research informs interactions only: vendor limits/defaults/policies are not
Aarili authority. In particular, neither sampled app established a dedicated
manual/external pattern workflow, immutable reference history or cutting release.

## Ticket A: fileless preparation and exact reference history

**Stable slice:** 1.3.3a. **Status:** approved and selected, issue #164.
**Primary requirements:** PAT-01/03, ORD-02/12/13, DES-03/05/11,
MEA-04/07, CUS-02/06/07/09; TRU-01/03/05/06/07/08/10/13,
USE-01/02/03/08/09. AC-07/08 plus applicable AC-06/38/40/52/53/55/56 safeguards.
**Design:** MP-D01–09/11 and the common transaction/storage/UI contract.

### Scope and delivery

1. Extend existing exact catalogue/type/piece context with reviewed manual/external
   availability and revision history. Present automated capability as unavailable;
   no automated selector or generation action. Unconfigured is not available.
2. Register separate bounded draft/command schemas and durable server workflows
   for preparation/reference, revision, review and selection. Preserve old schemas.
   Use core policies and repository interfaces, tenant SQL and typed Node Hono
   clients; no business Server Actions or additional package/runtime.
3. Support a pending method declaration and a saved physical reference with
   locator, source/date/author/supplier where known, supplier revision label,
   private notes, rights classification and exact/unknown/not-applicable inputs.
   A locator is required to save A's reference; no file is required or fabricated.
4. Save immutable versions; reasoned locator/source/input revisions preserve
   predecessor and original selection. Review events and explicit selection are
   separate. Implement MP-D07's reference-only versus inputs-reviewed distinction.
5. Compare current exact design/measurement selections without rebinding old
   references. Use a transactional review digest and governed-work barrier;
   block consequential changes whose approved correction flow is unavailable.
6. Integrate private reads/history and contact merge/relink exclusion from day
   one. Extend audited redaction, draft/private replay handling, tombstones and
   generation invalidation for all new personal values/associations.
7. Provide English/Tamil owner workflow and failure recovery using existing UI
   primitives, with visible assumptions on detail/review/selection/history.

**Excluded:** uploaded reference attachment (B), repeat selection integration (B),
new shop library authoring, vendor payments, custody/stock, expert rules, formulas,
seams/ease, drafting sheets, generation, print/export and production approvals.
Existing repeat paths must remain safe: no auto-copy or auto-selection of A's
references before B. Do not imply A offers an upload that cannot be completed.

### Acceptance cases

| ID | Required result |
| --- | --- |
| MP-A01 / PAT-01, AC-08 | On a synthetic orderable type, explicitly configure and choose manual or external. Neither ordering nor a measurement form implies automatic capability. Unconfigured/unavailable paths explain the next step; no generation control exists. |
| MP-A02 / PAT-03 | Save “Cabinet B / folder 12,” reopen it on the exact garment/native piece, with zero uploads and no printer/body photo. Pending method is distinguishable from recorded reference. Locator does not record receipt or custody. |
| MP-A03 / PAT-03 | Known source/version/date and explicitly unknown source/version can both be recorded truthfully. Supplier label differs from immutable Aarili version identity. No synthetic production defaults. |
| MP-A04 / provenance, CUS-02/07 | Bind authorized exact design and measurement version(s) to their real scope/wearer. Unknowns remain reference-only; supported not-applicable cites actual policy. Reject wrong-shop, wrong-piece, wrong-wearer and fabricated/erased version IDs. A no-measurement service is not forced into this workflow. |
| MP-A05 / DES-05, ORD-12 | Revise locator to folder 13 with a reason; version 1 retains folder 12 and its old inputs/review. Selection remains at version 1 until an explicit version 2 selection. Both selections and author/time/reason remain inspectable. |
| MP-A06 / MP-D07 | Unreviewed → reviewed/changes-required/withdrawn events record exact version, reviewer/time/evidence and reason. Revision resets review. Reviewed never implies customer approval, valid fit, scale validation or cutting release. Changes-required/withdrawn cannot be newly selected. |
| MP-A07 / PAT-03 | Detail, review, selection and history visibly show print-scale/formula limitations. Physical-only says no print output/scale not assessed. Reference review cannot clear warnings or introduce tolerances. |
| MP-A08 / DES-11 | Change a current design or measurement selection. Earlier reference retains its original input IDs; mismatch becomes visible and a stale comparison cannot submit. Consequential/unknown irreversible-work replacement blocks with a supported explanation. No silent regeneration. |
| MP-A09 / AC-07 | Deactivate type/path: historical records remain readable. New selection/reuse is unavailable until explicit supported replacement/reactivation; no name-based mapping. |
| MP-A10 / TRU-03/05/08 | Missing/currently withdrawn wearer/guardian authority denies sensitive paths, history and replay. Erasure redacts locator/source/notes/review/revision reasons and every draft/result copy while retaining minimal provenance/tombstones. Payer merge/relink grants no wearer rights. |
| MP-A11 / AC-38/55 | Under app_user, missing/wrong shop fails closed; all tenant tables have forced RLS and composite scope/input/predecessor FKs. Missing If-Match 428, stale 412, domain conflict 409, invalid/changed-key payload 422. Concurrent revision/selection cannot lose history; exact retry returns the original result after current authority checks. |
| MP-A12 / AC-40, USE-* | English/Tamil phone/tablet/desktop support keyboard/labels/focus and long text. Recoverable save failure retains form input; uncertain retry freezes key/payload/precondition; stale comparison and access loss are honest. No private storage/log/URL/service-worker leak or late-response refill. |

### Migration, recovery and verification

Use a reviewed additive migration with advisory locking, private-value separation,
immutable version/review/selection guards, shop-led uniqueness, composite tenant
FKs and forced read/write policies. Preserve existing populated order/design/
measurement snapshots and unknowns; seed no approvals. Back up before any approved
populated rollout. Keep a pattern-aware minimum reader once private drafts exist;
roll forward, retaining tombstones/restore controls rather than dropping schema.
Add redaction consumers before enabling new writes. Test migration reapplication
and a populated pre-migration fixture. Document restore/erasure replay and
compatibility; never run destructive recovery against ordinary records.

Unit/property coverage: capability/state/provenance matrix, exact scope and
digest decisions, unknown/not-applicable handling and immutable lifecycle.
Real PostgreSQL: all MP-A11 negatives, direct SQL immutability/FKs, concurrency,
lost-response replay, changed payload, atomic audit/key rollback, privacy consumer
and erasure races. Mocks cannot establish these claims. Run relevant existing
design, measurement, repeat/history, identity/merge and draft/privacy regressions.
Browser/axe: MP-A01–10/12 in both languages at three sizes, including fileless
save/reopen/revision/selection, mismatch and stale/retry failure recovery.

Before review run actual `pnpm verify` and `pnpm test:ui` with relevant tests
(including the existing feature regressions); record exact invocations/results
and any unsupported environment. `pnpm verify` includes lint, Knip, strict types,
unit/negative types, OpenAPI, PDF, real integration, build, smoke and artifact
checks. Reuse unchanged results per the workflow instead of repeating components.
Hosted feature PR requires Fast verification and Dependency audit; promotion
retains the full/browser gates. No new PDF template is created: existing Tamil
goldens are regressions, not proof of pattern scale or a calibrated export.

Prepare a real local synthetic review URL/startup command/record and concise
steps keyed to MP-A01–12. Request only human business-policy, fluent Tamil,
screen-reader and real-device judgments not established by automation. Record
implementation/review-ready/first-usable timings in Delivery_Measurements.md.

## Ticket B: private outputs, replacement and deliberate reuse

**Stable slice:** 1.3.3b. **Status:** approved packet published as #165; blocked by
unmerged A #164 and awaiting its own implementation selection.
**Primary requirements:** PAT-01/03, ORD-07/08/12/13, DES-03/05/10/11,
MEA-04/07, CUS-03/06/07/09; TRU-01/03/05/06/07/08/10/13;
USE-01/02/03/07/08/09. Applicable AC-07/08/38/40/52/53/55/56 safeguards.
**Design:** all MP-D decisions, particularly MP-D08–12.

### Scope and delivery

1. Add concrete pattern media subjects/ownership and exact reference asset/evidence
   joins, integrated into the existing API/worker policy and immutable upload
   lifecycle. JPEG/PNG/WebP sketches and the existing bounded PDF profile only.
2. Attach accepted ready output to an immutable pattern version; preserve source,
   rights, exact/unknown inputs and asset/hash identity. Images stay reference
   sketches, PDFs stay authorized private downloads. Keep A's physical-only path.
3. Replace an uploaded output or switch physical/file references through a new
   version, then explicit selection. Retain old media/version/reviews and selection
   history until audited privacy erasure/approved retention requires removal.
4. Extend versioned repeat-source review and customer history with authorized
   context. New target reference selection requires current path/type, scope,
   rights/wearer and exact-input comparison; no validity or approval inheritance.
   Same-wearer private reuse only; authorized shop-owned/licensed reuse is distinct.
5. Extend audited redaction and fenced purge to new media/association/evidence/
   draft/replay stores. Register identity/merge/relink and privacy-generation
   consumers. Preserve restore epoch, signed-PUT expiry and retry fencing.

**Excluded:** new file formats/parsers/viewers, customer/private links, public
gallery, native CAD tooling, executable formula storage, generated PDF/pattern
output, true-scale calibration/printing, vendor transactions and cutting release.

### Acceptance cases

| ID | Required result |
| --- | --- |
| MP-B01 / PAT-03 | Attach/reopen our own sketch and SAMPLE / SCALE UNVERIFIED PDF to the correct garment/piece; source/version/rights/inputs remain exact or explicitly unknown. Ordinary authorized PDF download is possible; no generated export. |
| MP-B02 / PAT-03 | No file is needed for A's manual or external physical path. Upload selection is not acceptance; pending, processing, rejected/quarantined, failed, expired, missing and erased sources cannot appear ready. |
| MP-B03 / DES-05 | Replace output A with B through an immutable successor and explicit expected-version selection. A remains historically linked/readable if authorized; failure before selecting B leaves A selected. No overwritten storage key or historical input/review rewrite. |
| MP-B04 / PAT-03 | Imported filename/page size/claimed 1:1 units and successful upload never imply calibrated scale. Supplier formula assumptions and failed/unknown checks remain visible at detail/review/selection/reuse. No tolerance default, formula evaluator or scale-approval toggle. |
| MP-B05 / TRU-01/03/07 | Wrong-shop/wrong-subject/wrong-wearer assets, design/fitting ownership substitutions, generic signing and quarantined media fail closed. Exact-reference download/preview rechecks current rows/policy/readiness; private versus shop-owned rights do not broaden silently. |
| MP-B06 / TRU-05/08 | Consent loss, erasure and source withdrawal invalidate all new reads/replay. Audited redaction/tombstone plus atomic purge intents cover originals, variants, staging and all claim prefixes; retries/fencing/restore quarantine prevent resurrection. Explain pending purge honestly. |
| MP-B07 / ORD-08 | Repeat-as-new initially shows permitted old reference context only. It copies no selected reference, review, validity, custody or cutting status. Explicit new selection pins source lineage and current target inputs. Other-wearer private reuse remains blocked. |
| MP-B08 / AC-07, DES-11 | Inactive type/path or missing/erased input/source blocks new selection. Changed inputs show mismatch without rebinding. Governed/irreversible-work changes remain blocked when correction authority is unavailable. |
| MP-B09 / AC-38/55 | Real PG/S3 tests prove forced RLS/composite ownership, immutable keys, expected-head concurrency, exact lost-response retry, changed-payload rejection, current-authority replay and atomic audit/key/job rollback. Late upload/processing completion after erasure cannot restore access. |
| MP-B10 / USE-*, AC-40 | Three-size English/Tamil/axe/keyboard workflows cover fileless and upload paths, readable warnings, source loss and replacement failure. Memory-only cache clears on sign-out/shop switch/access loss. Existing design, measurement-fit, repeat, history and media/privacy flows regress cleanly. |

### Migration, recovery and verification

Additive tenant-keyed subject/reference/evidence/purge relations extend A's
contracts. Preserve populated A versions, reviews, selection, private erasure
and old draft/readers. No reassignment of unrelated existing media. Use migration
locking/backups, current-authority processing barriers, restore quarantine and a
B-aware minimum reader after B's private media records exist. No destructive
downgrade or schema drop. A populated A→B migration and inert reapplication
fixture are required. Incomplete object purge remains observable and retryable.

Run unit/property lifecycle/reuse/rights cases; real PostgreSQL plus the existing
S3-compatible test service for MP-B03/05/06/09 and failure injection around
processing, erasure, deletion receipts, transaction rollback and current source
generation. Run existing media/processing/measurement-fit/design-reference,
repeat-service/order, customer-history, contact-merge and privacy regressions.
Browser/axe covers every MP-B acceptance path in both languages and three sizes.
Use actual `pnpm verify` and `pnpm test:ui`; retain fresh evidence and failures,
and avoid redundant component reruns once covered. Hosted/promotion checks and
human/device/Tamil gates follow A's requirements. No generated pattern/PDF golden
or physical-print validation claim can be inferred from these tests.

Provide a local synthetic manual-review record containing two physical versions,
one sketch, one PDF, deliberately unknown inputs and one mismatch/processing
failure. Give exact startup/URL and expected MP-B results when implemented.
Record B timings and requirement coverage separately; full 1.3.3 closure needs
A+B acceptance and does not close later PAT requirements or pilot activation.

## Publication and implementation handoff

After approval, use the project's to-tickets workflow, publish A then B with
existing `enhancement`/`ready-for-agent` labels and native blocker edges, and
read back each complete issue/comments/dependency relationship. The local A
reference must be replaced with A's real issue ID in B. Do not invent issue
numbers or a parent/map issue. Recheck merges/ancestry and relevant CI at selection.
Use the existing checkout, latest development base and one focused branch/PR per
selected issue; B starts after A merges. PR publication needs applicable user
authorization, T3 linking and verification; owner merge review remains separate.
