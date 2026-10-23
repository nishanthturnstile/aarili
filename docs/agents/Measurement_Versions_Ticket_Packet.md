# Measurement versions: concrete ticket packet

22 October 2026. Roadmap **1.3.2**. **Software packet approved. Published
A [#153](https://github.com/nishanthturnstile/aarili/issues/153),
B [#154](https://github.com/nishanthturnstile/aarili/issues/154),
C [#155](https://github.com/nishanthturnstile/aarili/issues/155).
A selected and owner-merged in [PR #156](https://github.com/nishanthturnstile/aarili/pull/156)
on 23 October 2026, after required CI passed on the corrected baseline.
Full-browser and human/pilot qualifications remain separate; see
[current recovery](Measurement_Versions_Validation_Recovery.md).
B merged in [PR #161](https://github.com/nishanthturnstile/aarili/pull/161) on
23 October; [implementation evidence](Measurement_History_Implementation_Evidence.md)
records full verification and all 243 browser passes with remaining human/pilot
qualifications. The owner selected C #155 on 23 October after all direct blockers
merged; [C implementation evidence](Measurement_Fit_Implementation_Evidence.md)
records the current work and remaining gates.**
[Design](Measurement_Versions_Design.md), [REA evidence](Measurement_Versions_REA_Evidence.md),
[validation and baseline](Measurement_Versions_Implementation_Evidence.md).

## Sequence and authority

Approved sequence: **A / #153 / 1.3.2a → B / #154 / 1.3.2b → C / #155 / 1.3.2c**.
A gives a complete first-session→saved-version→explicit-garment-selection outcome.
B adds correction, contextual reuse and existing history/repeat integration.
C adds optional private fit photos through existing media. Private text, consent,
exact values, immutable storage and privacy erasure are acceptance from A.
A alone does not close 1.3.2; neither does A+B while C's required private-fit
access outcome remains outstanding. Trial/verified fit stays 1.8.1.

**Research follow-up:** authenticated REA entry/save/edit/order selection is now
observed (MV-R05–18). A changed value retained Nool's V2 badge; member labels
appear as garment versions, and old-order structured values remain unproven.
The acceptance below requires actual immutable, wearer-bound version references;
vendor badges or comparison UI cannot substitute. The A/B/C sequence and policy
approval gates are unchanged; private sign-in alone did not approve implementation.
The later explicit owner approval selected A and authorised publication/proceeding.

Software review/publication/selection, production business policy approval,
merge and live activation are distinct. The owner approved proceeding with this
software packet. All three issues were published with `enhancement` and
`ready-for-agent` using the installed to-tickets workflow; native blockers were
read back. A and B were selected and merged. C is selected and in implementation. Deployment,
production policy and live activation remain separate. A/B/C retain their stable
local ticket identities.

Every ticket cites product §§3/7/9–10/13/24–25/27/29.1/30.1/32–33;
architecture §§6–11/15 and the relevant MV-D decisions. Use focused sequential
branches from newly updated `origin/development` in this same checkout, one
issue/PR each. Re-read actual issue/comments/native blockers before implementation.
Existing prerequisites were verified merged; A's merge now satisfies B's A edge.
B merged in #161, satisfying C's B edge. C still needs its own explicit selection.

| Ticket | Proposed direct blockers (not just related context) |
| --- | --- |
| A | #98 exact forms; #99 manifest/form bindings; #79/#80 wearer/guardian authority; #147/#148 current garment/specification/media/privacy seams; #138 merge/relink guard; #16 atomic commands/history; #55/#56 durable drafts/recovery; #51/#53 bilingual shell/vocabulary. 1.1.3 customer registration #78 is covered through the wearer prerequisites. All existing blockers are closed/merged. |
| B / #154 | #153 (merged via #156), #134/#135 repeat intake, #136 history, #137/#138 identity corrections/merge. All direct prerequisites verified merged; B merged via #161. |
| C / #155 | #154 (must merge for correction/reference history), #57/#58 media admission/processing, #148 typed private reference ownership/rights/privacy composition. Existing issues and B are merged. C remains unselected. |

The roadmap's technical prerequisite 0.4.3 is verified through #57/#58 even
though A has no fitting-photo admission. Keep all transitive prerequisites in
traceability without replacing real native direct edges with phase names.

## Owner decisions to review with the software packet

These inputs have **no invented production defaults**. Approving a synthetic
software ticket does not approve the production values below.

| Decision | Concrete proposed treatment / owner input needed |
| --- | --- |
| MV-P01 Form authority | Approve exact existing form/service/piece revisions for measurement use, with reviewer/time and withdrawal. `owner-proposal`/configuration eligibility is insufficient. Confirm bounded approval evidence and review UI proposed in A. |
| MV-P02 Per-field precision | Approve each existing precision unit/increment and required/optional/applicability meaning. Confirm exact increment validation versus a separately reasoned override; never universal quarter-inch rounding. |
| MV-P03 Input grammar | Proposed: whole/decimal, proper/mixed fractions, explicit in/cm. Confirm accepted fraction/Unicode/localised notation and zero handling. A preserves unsupported/ambiguous raw text in drafts without authoritative save. Nonterminating decimals require a separate approved representation decision, not silent rounding. |
| MV-P04 Converted display | Proposed until reviewed: exact rational display. If decimal approximation is wanted, supply display places and rounding mode per relevant context, with an approximation label; original entry never changes. |
| MV-P05 Validation | Supply finite plausibility/cross-field rules, severity, applicability and warning override/reason policy, or explicitly review a rule as not configured. No thresholds copied from vendors or invented from examples. |
| MV-P06 Source/applicability | Confirm mixed-source per-field capture, supported sample/context references and whether conditional N/A needs a future form definition extension. Default proposal rejects required-field N/A without such a rule. |
| MV-P07 Suitability and changes | Confirm review evidence and reason for version reuse/replacement, exact-only compatibility, and blocking unsupported in-progress/price-band/irreversible changes. No universal age expiry or blanket approval reset. |
| MV-P08 Privacy and guardian evidence | Approve final notice, proportionate guardian verification, purposes, withdrawal/access policy, grievance procedure and retention periods with appropriate advice. Current draft notices and `synthetic-review-v1` remain synthetic-only. |
| MV-P09 Media | Confirm optional fit-photo workflow/visibility and existing supported media profile; no mandatory photo, publication, cross-wearer transfer or copied shop-library right. C requires retained-object erasure/retention evidence. |

Production measurement activation remains blocked by product §32.2 and §§33/TRU-10
regardless of approval of A–C. Independent second review is required before any
derived output; no derivation is included here. Fluent-Tamil/privacy and physical
device review remain real human checks.

## A / 1.3.2a — Record a wearer session and explicitly select its saved version

**Outcome:** From an authorised wearer and exact existing form, the owner records
source/date/measurer and exact unit-bearing values, recovers a durable draft,
reviews an immutable saved version and deliberately selects it for one compatible
unselected garment/native-piece scope. Text fit notes work without photographs.

**Traceability:** MEA-01/02/03/05/06/11, initial MEA-04/07, CUS-02/06/07,
SET-04/08, TRU-01/03/05/06/08/13, USE-01/02/03/08/09;
AC-02/06/38/40/52/53/55, partial AC-07/08. MV-D01–07/09–10/13–14.

**Scope:**

- Exact form/field reuse and measurement-use approval evidence/policy pins.
  Preserve existing definition editor, semantics and historical authority labels.
- Explicit wearer, shop-local date, measurer identity/source, source kind/method
  and mixed-source attribution. No fabricated dates, units or measurer.
- New registered durable workflow, strict incomplete versus authoritative schemas,
  exact decimal/fraction parser, rational conversions, original raw/unit/numeric
  storage, precision checks and approved rule presentation. No floating point.
- Immutable session/version/value schema and DB protection, minimal audit/replay,
  membership-bound core/repository/Hono/typed client and responsive bilingual UI.
- Review save independently from explicit first selection. Native composed-piece
  identity is respected from A; a booking never owns common family measurements.
  Not-required small services retain their current lightweight flow.
- Guardian checks before sensitive draft storage and at every read/save/select,
  consent/age/privacy races, audited saved/draft/result redaction and tombstones.
- Measurement associations in identity/merge/relink guards before any personal
  record exists. Old intake instructions/design target lengths remain unchanged
  and unconfirmed; no conversion/backfill from free text.

**Excluded:** correction/history comparison and changing an existing selection
(B); repeating a source version (B); fit-photo admission (C); trial/verified fit,
patterns, formulas, approval/change engines, PDF/share/export UI or live activation.
An initial selection is blocked for unsupported consequential work; no app status
or owner statement is fabricated to pass that gate.

| Acceptance ID | Concrete scenario and required evidence |
| --- | --- |
| MV-A01 | Same phone, two independent adult wearers; select the correct one and exact garment/piece/form. Same-name/foreign-form/foreign-piece/wrong-wearer IDs fail without disclosing values. Lightweight not-required service needs no fabricated session. Real PG + UI. |
| MV-A02 | Save/reopen explicit body, sample, customer-provided, other and mixed contexts with stated date and measurer independent of actor. Missing source/unit/date/measurer remains a draft; command rejects unknowns. No sample value is relabelled body. |
| MV-A03 | `12 1/4 in` saves raw text and exact `12.25`, converts to `31.115 cm`; `2.54 cm` converts to exactly `1 in`; `1 cm` retains exact `50/127 in`. Repeated display switching/reload never changes raw/unit/numeric. Property checks prove round trips and exact increment divisibility. |
| MV-A04 | Blank differs from zero; malformed/ambiguous/zero-denominator/incompatible unit and unapproved precision fail without replacing text. Optional missing works; required missing fails. Nonterminating numeric case stays unconfirmed. Tests use labelled synthetic policy, never production limits. |
| MV-A05 | Save version without selection, review original/form/source and explicitly choose it for a compatible target. A failed selection leaves the version saved and target unselected. Other garments remain unchanged. Direct SQL UPDATE/DELETE and provenance-free INSERT fail. |
| MV-A06 | Form rename/reorder does not reinterpret saved fields. Changed key/meaning, retired/inactive/unapproved form and mismatched manifest cannot silently select. History/detail uses exact saved labels; unsupported mappings explain the gap. |
| MV-A07 | Minor cannot persist even an incomplete value draft without current verified measurement authority and grant. Payer-only, photo-only grant, unknown age, withdrawn grant and changed relationship fail. Real grant/withdraw/age races serialize; adult private-media choice is separate. |
| MV-A08 | Same-key lost-response retry returns the original minimal result once; changed actor/action/payload returns incumbent denial/422; missing/stale draft or selection If-Match yields 428/412, domain 409. Inject rollback after each real write; no partial version/selection/audit/key/job. |
| MV-A09 | `app_privacy` redacts saved values/context, draft/result copies and notes atomically, preserves non-personal provenance/tombstone and invalidates ETags/cursors. Runtime and wrong-shop erasure fail. Save/select/replay after erasure cannot restore values. Exact IDs do not bypass current consent/RLS. |
| MV-A10 | English/Tamil at phone/tablet/desktop: visible units/source/version, fraction entry, optional missing, keyboard/errors/axe, theme/language switching, reload, cancellation, offline/save failure and exact retry. Failed save retains inputs; access loss clears them. No private values in URL/storage/cache/log/error/artifact. |
| MV-A11 | Populated migration/reapplication preserves accepted orders/form/design/privacy history byte-for-byte. Every new tenant table has forced matching RLS; missing context and pooled rollback fail closed. Contact merge/relink cannot move measurement ownership. |

**Migration/recovery:** Reviewed additive SQL using the next available number;
composite shop/wearer/form/order/piece references, immutable DB guards, privacy
functions and isolation catalogue registration. No legacy value backfill, schema
push, destructive downgrade or data activation. Recovery follows MV-D14 and the
existing restore epoch/kill-switch/tombstone flow. A minimum-compatible reader
decision must be documented before a populated rollout.

**Verification:** Use actual root `pnpm verify` and `pnpm test:ui`, with focused
Vitest/fast-check, real PostgreSQL and browser/axe checks during development.
Add the new focused filenames/commands when scaffolded; none exist yet. Regress
measurement forms/templates, custom/grouped/service intake, design selection,
draft recovery, identity/guardian/merge and isolation. Record original failures,
fresh tested revision and source fingerprint. Baseline CI is not change evidence.

**Manual review deliverable:** Running synthetic loopback host, exact route/start
command/private sign-in method, two same-phone adults and a synthetic minor with
explicit test consent states, an approved synthetic fraction form and no-measurement
service. Try start→fail save→retry→reload→save→review→select and revoke/erase in
each language/device class; provide expected outcomes, reversible cleanup and
decisions remaining. Do not claim synthetic review is human/live acceptance.

## B / 1.3.2b — Correct history and deliberately reuse an exact version

**Outcome:** The owner corrects a saved observation with attributable lineage,
compares versions, reviews prior garment context and explicitly reuses or changes
a compatible target selection, including repeat-as-new and grouped navigation,
while earlier orders continue to reference their original versions.

**Traceability:** MEA-04/07, continued MEA-01/02/03/05/06/11; CUS-03/05/06/07,
ORD-08/12/13, DES-11, TRU/USE safeguards from A; AC-02/06/40/52/53/55/59,
partial AC-07/08. MV-D08–14. **Direct blocker:** A must merge first, plus the
existing repeat/history/identity blockers in the sequence table.

**Scope:** Revision versus new session distinction, prior/current diff, expected
lineage-head CAS, explicit selection event history and current pointer CAS;
exact-form compatibility and unavailable mapping states; authorised history
projection, reviewed repeat adapter and current-identity/erasure handling. Do not
broaden contact merge to private wearer relinking. No generated output or later
production/change-agreement engine.

| Acceptance ID | Concrete scenario and required evidence |
| --- | --- |
| MV-B01 | Order O1 uses V1; correction appends V2 with actor/time/reason and untouched V1. O1 still shows V1 after reload; O2 explicitly selects V2 after review. New observation/date starts a new session, not a disguised correction. Real PG and UI. |
| MV-B02 | Two concurrent corrections from the same head yield one success and one stale comparison, with no silent merge. Concurrent target changes preserve every committed selection and cannot overwrite a newer ETag. Same-key replay creates no extra history. |
| MV-B03 | Reuse displays wearer, exact source garment when authorised, date/age, method, form/type and context. Suitability is never preselected. No universal expiry/latest. Inactive, incompatible, erased or another wearer's source fails; unavailable source context never leaks. |
| MV-B04 | Repeat creates fresh independent order/draft IDs, carries only an explicitly reviewed exact measurement reference through its new adapter, and rechecks permission/compatibility at acceptance/selection. Old v1 repeat drafts keep incumbent behaviour. Neither source approvals nor dates are carried as new facts. |
| MV-B05 | Grouped garments/native pieces retain independent selections and wearers. History filters current private access before search/pagination and detail authorisation. Payer merge/relink does not move personal versions or disclose same-phone wearers. |
| MV-B06 | Measurement revision changes no approval automatically. Unsupported in-progress, physical cutting/dispatch, unknown commercial effect, output-staleness or held-cutting handling blocks replacement atomically with clear reason. Price, date, design, work, custody and old references remain intact. Future impact handling is not claimed complete. |
| MV-B07 | Correction/reuse/form retirement/privacy/guardian revocation races and injected rollback leave no partial selection, provenance, audit or replay. Erasure covers all revision/source/repeat/draft copies and exact-history endpoints; minimal tombstones persist. |
| MV-B08 | Bilingual three-size comparison/reuse/repeat/conflict/retry/erasure UI + axe/keyboard; relevant A and existing history/repeat/design/identity regressions pass. Current manual packet demonstrates O1/V1 and O2/V2 with no real data. |

**Migration/recovery:** Additive selection/lineage/repeat workflow extensions,
versioned readers and old-draft compatibility, populated upgrade with existing
V1 selections, DB and app_privacy protections. Old code cannot silently resolve
new history as latest. Retain data on compatible rollback and restore tombstones
before reuse. No broad rewrite of accepted intake snapshots.

**Verification and review:** `pnpm verify`, `pnpm test:ui`, focused exact-arithmetic
properties, PostgreSQL concurrency/RLS/erasure/failure tests and current three-size
manual packet. Review initial V1/O1, correction V2 and separate O2, stale competing
selection, same-phone wearer denial and unsupported impact. Report human review
and production approvals separately. B alone does not close MEA-11 media outcome.

## C / 1.3.2c — Attach and privately retrieve exact-version fitting references

**Outcome:** An authorised owner optionally attaches private fit images to a
wearer/session version, retrieves them through exact-version permission checks,
and replaces them with attributable history while text entry remains usable.

**Traceability:** MEA-11, continued MEA-03/04/07; TRU-01/03/05/06/07/08/10/13,
USE-01/03/07/08/09; AC-06/38/40/52/53/55/56. MV-D13–15.
**Direct blockers:** B merged, #57/#58 and #148 merged. Actual retained-media
purge/backup/processor gaps must be recorded; no implicit production activation.

**Scope:** Concrete measurement media subjects, composite session/wearer/version/
asset ownership and immutable variant references; existing upload/processing/
signed access policy composed in web and worker; exact-version reference history,
private captions, redaction and measurement-owned deletion/retention handoff.
Use the existing supported image profile and limits; no new image editor,
public bucket, raw remote URL ingestion, reusable library or public share.

| Acceptance ID | Concrete scenario and required evidence |
| --- | --- |
| MV-C01 | Optional ready image associates with exact wearer/session/version and accepted asset variant; replacement appends a version/reference while old authorised history retains its exact reference. Text save/select succeeds without any body image. |
| MV-C02 | Separate photo authority rechecked at upload, completion, processing, association and signing. Consent/age revocation between steps denies access; a measurement grant alone cannot authorise a minor photo. Unknown age/guardian/foreign/cross-wearer assets fail. |
| MV-C03 | Generic media/design/gallery/repeat/merge routes cannot sign or publish measurement fit assets; both private-fitting and minor publication are refused by policy and DB seam. Immutable private shop keys are never overwritten or exposed publicly. |
| MV-C04 | Processing failure/quarantine/read outage has safe bilingual retry/error state and leaves values/text intact. Lost-response association retry is exact once; stale reference correction does not erase prior provenance. |
| MV-C05 | Audited erasure removes captions/private draft/result values, invalidates signing and enumerates original/accepted variants/derivatives plus retained references for governed purge. Actual queued effects use transactional jobs, restore epoch/quarantine and recheck authority; no orphan-cleanup-as-retention claim. Real PG/S3/worker tests cover rollback/retry/withdrawal/erasure races. |
| MV-C06 | Three-size bilingual keyboard/axe/manual scenarios cover optional upload, failed processing/read, private old/new reference, consent loss and erased history; existing design-media workers/signing remain correct. No screenshots with real/minor body data. |

**Migration/recovery:** Expand typed subjects/links and privacy functions using
the current media ownership conventions; register RLS/catalogue/worker/policy
consumers. No reuse of design-library ownership for fitting subjects. Enumerate
object deletion, exports, backups and processor outcomes under approved policy;
retain pending/unimplemented gates explicitly. Compatible rollback denies reads
without deleting immutable history. No irreversible external effects in review.

**Verification and review:** `pnpm verify`, `pnpm test:ui`, focused real
PostgreSQL/media/job tests, relevant design-media regression and a running
synthetic review host. Use non-body synthetic images labelled private research
fixtures. Demonstrate text-only success, optional attachment, failed read,
reference replacement, denied public/foreign signing and erased-source denial.

## Publication and handoff checklist

1. Review/approve software design and A/B/C breakdown; separately record which
   business inputs remain unresolved and whether synthetic implementation is
   selected. Do not infer production approval from a ticket label.
2. On authorised publication, generate full issue bodies from this packet, retain
   MV-A/B/C acceptance IDs, real direct blockers and source links; read back all
   native relationships. Select a specific approved issue before application work.
3. Implement only that issue after every direct blocker merges; update roadmap,
   implementation evidence and delivery timings from actual work. Register every
   authorised PR with T3, target development, await CI and owner review.
4. Claim full 1.3.2 only after all applicable approved tickets and requirement
   checks pass. Preserve later trial/pattern/PDF, human, privacy, restore and pilot
   gates. No merge, deployment or live data follows automatically.
