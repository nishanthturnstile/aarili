# 1.3.4 job slips and material labels: concrete ticket packet

24 October 2026. **Draft for owner review; unpublished and unselected.**
[Design and field/audience matrix](Job_Slips_Labels_Design.md),
[REA evidence](Job_Slips_Labels_REA_Evidence.md),
[readiness/verification](Job_Slips_Labels_Implementation_Evidence.md).
No GitHub issue is created by this packet. Reuse existing approvals only when
they actually cover this breakdown and selection.

## Sequence and common contract

| Draft slice | Complete owner outcome | Direct proposed blockers |
| --- | --- | --- |
| **A / 1.3.4a** | Review exact garment/native-piece sources → request immutable private A4 job slip → queued render → actual private PDF preview/download/manual share → retained revisions and privacy-safe recovery | #16, #51, #59, #60, #120, #126, #148, #155, #165; all currently merged, recheck before start |
| **B / 1.3.4b** | Select authorised garment/piece labels → review minimal fields and A4 sheet → immutable label PDF → private preview/download and deliberate owner-triggered sharing | A must merge; #118/#120 and #124–#126 already merged; owner approval of JS-D01/06 label fields/layout |

This split keeps privacy, Tamil, reference fidelity and failure recovery in the
first complete delivery. A includes sharing its own document; B does not defer
that AC-64 capability. B remains necessary to close labels/overall 1.3.4.
Do not split security, transactional issuance, asset readiness or erasure into
optional follow-up tickets. If implementation reveals that A exceeds one fresh
context, return a revised concrete vertical breakdown before publication.

Common sources: product ORD-01/02/06/07/10/12/13/14, DES-03/04 where applicable,
MEA-03/04/07/11, PAT-01/03, COM-04/06, TRU-01/03/05/06/07/08/10/13,
USE-01/02/03/07/08/09; AC-06/38/40/52/53/55/56 and **AC-64 job-slip only**.
Check exact requirement meanings against the product before publishing; do not
claim all of a broad requirement from this slice. Architecture §§6.1–6.4,
7.1–7.3, 8.1–8.5, 9.2–9.3, 10–11, 13 and 15; roadmap 1.3.4.
Development_Workflow.md stages, actual repository tooling and manual acceptance
packet apply. No new renderer/sharing stack, SDK or package boundary.

Every new tenant association has non-null shop_id, shop-led keys/indexes,
composite tenant FKs and forced read/write RLS. Runtime app_user uses a single
membership-bound withShop transaction per command; core stays framework-free
behind transaction-bound repository interfaces. Thin Node Hono routes use
strict commands, typed clients, ETag/If-Match and actor/action/hash idempotency.
Exact request, business/source binding, document revision, audit and queued job
commit together. No ordinary history update or source auto-merge.

## A — Review exact sources and issue a private garment/piece job-slip PDF

**Proposed title:** `[W1 1.3.4a] Review exact garment sources and issue an immutable private job slip`

**Problem/outcome:** The owner can read exact selected garment instructions but
cannot issue that selection as a stored, printer-free production slip. Deliver
one end-to-end garment/native-piece workflow using existing PDF/status/share
foundations. Later corrections cannot rewrite the original PDF or its sources.

**Scope:** JS-D01–05 and JS-D07–09; A4 production-slip template from JS-D06.
Support accepted custom garment/native-piece scope, grouped member context and
applicable standalone/add-on service work. Service output retains separate work
and recorded completion facts without inventing measurement/pattern requirements
or tasks. Do not pretend current custom-only source readers handle every service
or multi-form combination; provide the typed applicable adapter or explicitly
block unsupported source-bearing contexts. Minimal labels remain B.

**Implementation:**

- Add strict business request/read/revision-history contracts; client submits
  identifiers, exact source/selection expectations, explicit language/purpose and
  reviewed omissions, never arbitrary document models or executable markup.
- Build the allowlisted model in core from exact authorised design/measurement/
  manual-pattern selections and permitted instructions. Preserve input/review/
  source/units/version and unverified pattern warnings. Current authority is
  rechecked at issue, retry, processing, preview and download.
- Add tenant-bound document/source/audience/asset associations and predecessor
  provenance using the existing document identity/revision. Lock source selection
  through issuance; stale changes yield an explicit comparison. Resolve unknown
  or not-applicable according to existing scope decisions.
- Freeze required/optional image and annotation manifests with exact accepted
  hashes. Extend the existing renderer narrowly for necessary permitted image
  bytes; retain all network/script/path denials and bounds. Missing critical or
  unsupported instruction assets block. Optional omissions are visible and
  authorised. Exclude fitting photos and do not embed uploaded pattern PDFs.
- Compose the real template/policy/private storage/queue adapters for web and
  both production job modes, retaining default denial for unknown templates.
  Reuse existing attempt/lease/restore/storage-intention and hash-verified delivery.
- Extend audited privacy functions/purge coverage for frozen personal models,
  bindings and outputs. Denial is immediate; governed redaction/deletion and
  tombstones cover in-flight jobs, orphan outputs and restored copies. Record a
  compatible minimum reader; never roll back to a reader that exposes redacted
  or revoked snapshots through generic document access.
- Add garment/piece source review, asynchronous states, actual stored-PDF preview,
  revision history, download and existing manual-share host with explicit private
  audience acknowledgement. No change to production, money, assignment or custody.

**Acceptance and verification:**

| ID | Observable outcome | Required proof |
| --- | --- | --- |
| JS-A01 | Correct readable garment/piece scope; applicable small services omit irrelevant sections; quantity cannot create imaginary piece IDs | Normal/custom/grouped/native-piece/service fixtures; negative ambiguous scope and another-wearer selection tests |
| JS-A02 | Exact selected design, measurement/form/source/units and pattern version/limitations appear; no latest substitution | Source-update race and later source correction tests; inspect frozen model and extracted PDF references |
| JS-A03 | Missing critical images/annotations fail clearly; reviewed optional omissions remain visible; no fitting photos | Missing/processing/quarantined/revoked/erased/digest-changed/oversize asset cases; inspect actual PDF figures/annotation captions |
| JS-A04 | One frozen revision/audit/job/replay result commits or rolls back together; request retries replay | Real PostgreSQL app_user tests, forced-RLS inventory, concurrent same-key and changed-payload tests; rollback after enqueue/audit failure |
| JS-A05 | Worker retries/crashes/duplicate delivery cannot accept newer assets or duplicate revision; failures preserve order | Real PostgreSQL/private storage/queue tests; crash before/after upload and before acceptance; lease successor and orphan cleanup |
| JS-A06 | Stored bytes/hash remain identical on re-download after shop/source/template changes; revised issuance is separate | SHA-256 equality and predecessor checks; existing font/template mismatch tests; no old-artifact rerender |
| JS-A07 | Policy/consent loss, guessed other-shop IDs, erasure and restore/quarantine deny all paths, including in-flight acceptance | Real membership/RLS tests for status/history/file/access/media/retry/job; privacy snapshot redaction and tombstone/purge assertions; restore race |
| JS-A08 | Actual A4 PDFs render Tamil/English/mixed long text, fractions, units, reference images and multipage continuation IDs legibly | Existing Tamil golden suite plus new template fixture pages; render every page to PNG and inspect; programmatic A4/font/hash/page checks, no unreviewed golden updates |
| JS-A09 | Owner previews/downloads exact file and explicitly shares it manually; failure/cancel/fallback remain honest | Phone/tablet/desktop Playwright + axe, keyboard/focus, native share user-activation stub, capability/cancel/failure and desktop attach guidance; no real conversation/send |
| JS-A10 | Source/conflict/loading/queued/failed/retry/unavailable states and history remain usable without eager image fetch | Three-size English/Tamil tests; late-response clearing, access loss, source-change comparison and uncertain-request reconciliation |

**Migrations/recovery:** reviewed additive migration only, advisory-locked runner,
no live data; include RLS/FK/index/provenance guards and explicit privacy routines.
No new invoice numbering. Roll forward with source/document-aware readers once
personal snapshots exist; preserve original artifacts except audited privacy
actions. Existing restore kill switch/epoch/quarantine stays in force. Schema/
storage and erasure coverage require two-shop and failure evidence before review.

**Commands:** actual `pnpm verify:fast`, focused document/source unit and real
PostgreSQL integration suites, `pnpm test:pdf`, relevant three-size browser/axe
cases through `scripts/test-ui.mjs`, and existing artifact scan. Where this ticket
is published with `pnpm verify`/`pnpm test:ui` in its explicit checks, run those
full commands; do not waive them using the fast feature-PR convention. Final
lint/Knip/types/build evidence may come from one successful enclosing command.

**Manual review:** open the implementation's actual route/test-host (record exact
URL and startup command when implemented), synthetic garment/piece and language.
Review JS-A01/02/03/08/09 in one session: verify selected versions and private
scope; inspect all A4 pages and warnings; prepare/download; cancel share then
retry through a deliberate tap. Report `ID — pass/fail — observation`. Fluent
Tamil and physical Android/3–4 GB device sharing remain separate from automation.

## B — Minimal bag/material labels and deliberate sharing

**Proposed title:** `[W1 1.3.4b] Produce minimal A4 bag/material label PDFs and share selected outputs manually`

**Problem/outcome:** The owner needs identifiers on physical garment/material
bags and a PDF usable without any printer. Deliver the reviewed structured safe
projection and eight-label A4 sheet, with explicit label purpose and exact stored
PDF preview/download/manual sharing. A private production slip cannot accidentally
be reused as the label sent to a print shop.

**Sources/prerequisites:** A must be merged and B explicitly selected; grouping/
service prerequisites above must still be integrated. JS-D01/02/06/08 label
matrix and geometry require owner approval. Reuse A's document provenance,
composition, asset/privacy/recovery infrastructure and common source authority.

**Implementation/scope:**

- Separate strict label projection/contract/template; permit only readable
  order/native-piece IDs, bounded accepted garment/service name, optional
  reviewed structured material type/colour and copy/quantity identification.
  No private fields are fetched into its model and then merely hidden by CSS.
- Multi-selection validates each garment/piece/member under current authority
  atomically for the requested sheet. One inaccessible/missing scope prevents
  a falsely complete sheet; identify the failed selection safely for review.
  Stable order of labels and copies is frozen with sheet provenance.
- Use JS-D06's A4 15 mm margins, 87 × 63 mm labels, two columns/four rows,
  6 mm horizontal/5 mm vertical gaps and 12 pt minimum. Fail long overflow
  explicitly; test boundaries. No label printer, adhesive-stock or hardware API.
- Require purpose/document selection and actual stored-file preview before
  manual sharing. Changing from slip to label clears prepared File/object URL,
  acknowledgement and stale asynchronous results. Print-shop purpose defaults
  to labels. Reuse reviewed text/recipient actions and prepared/marked-sent only.
- Persist new revisions for changed sheet selection/layout; old sheet bytes stay
  unchanged. Labels identify items without recording receipt, stock, custodian,
  dispatch, delivery, task completion or cutting release.

| ID | Acceptance | Required verification |
| --- | --- | --- |
| JS-B01 | Only allowlisted fields appear in body/hidden text/metadata/filename; unrelated private values never enter the label model | Poison all excluded source fields with unique sentinels; inspect model, extracted text, metadata, links, annotations and filename; no fitting image objects; unit and integration tests |
| JS-B02 | Grouped garment/native-piece/service labels preserve IDs; quantities/copies never invent physical IDs | One/eight/nine-label pagination; mixed service/piece fixtures; repeat-copy and unknown unit-identity cases |
| JS-B03 | A4 sheet/cut boundaries remain readable in both languages, long identifiers and empty/partial last page | All new PDF pages visually inspected plus dimensions/fonts, no split label, no clipped/overlapping content; existing Tamil golden suite retained |
| JS-B04 | Actual selected label file is shared/downloaded; switching purpose cannot leak an earlier private slip | Three-size English/Tamil browser/axe, late responses, cancellation, unsupported share and desktop manual-attach tests; controlled targets only |
| JS-B05 | Isolation, immutability, transactional replay, retry and privacy/restore controls cover labels as well as slips | Real PostgreSQL two-shop and mixed-selection rollback; stored hash equality; guessed IDs, permission loss and restore/erasure cases |
| JS-B06 | A+B requirement map closes only implemented 1.3.4 outcomes | ORD-10, USE-07, AC-64 job-slip portion separately evidenced; QR, automated messaging, true-scale pattern and human/pilot gates explicitly pending |

**Migrations/recovery:** reuse A tables where their typed purpose supports labels;
add a reviewed expansion only if needed. New template revision, never change an
old registered revision. Same source-bound revocation/purge and minimum-reader
constraint; no destructive down migration or artifact overwrite.

**Verification/manual packet:** same actual commands/evidence standards as A,
with label-specific unit/property, real PostgreSQL, PDF page/metadata/privacy
inspection and three-size share workflows. Owner reviews eight-label geometry,
long Tamil names and a nine-label overflow sheet, then prepares/downloads the
minimal file for a hypothetical print-shop recipient. Physical A4 review is
recorded separately where available; printer-free download/share is mandatory.

## Approval and publication gate

The owner reviews both complete outcomes, JS-D01–09 and the field matrix, then
approves/amends the packet and authorises publication. Publish in A→B dependency
order with native blockers and `ready-for-agent` only under that approval. No
parent/map issue is needed. Selection of A is an additional explicit outcome;
begin it from updated development only after rechecking merged blockers.
Push/PR, merge, deployment and real-data activation retain applicable authority.
