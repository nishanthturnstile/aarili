# Job slips and material labels: design for owner review

24 October 2026. Roadmap **1.3.4**, ORD-10, USE-07 and the **job-slip portion
only** of AC-64. **Owner approved JS-D01–09 and the A → B software packet on
24 October 2026, authorised publication/merge and selected A to proceed.**
Physical-device, production template and live-data acceptance remain separate.
[Research](Job_Slips_Labels_REA_Evidence.md),
[ticket packet](Job_Slips_Labels_Ticket_Packet.md),
[preparation evidence](Job_Slips_Labels_Implementation_Evidence.md).

## Authority and readiness

Product §§3/7/9–10/13–15/19/24–25/27/29.1/30.1/32–33 govern behaviour;
architecture §§6–11/15 govern technology. The [REA brief](Job_Slips_Labels_REA_Prompt.md),
[workflow](Development_Workflow.md), [tracker](issue-tracker.md) and
[design system](../aarili-design-system.md) apply. Keep Phase 1 owner-only,
online-only and synthetic until its independent activation gates close.

**Scope discrepancy:** architecture's package table lists QR on slips as P1
Should; product §29.1 explicitly commits ORD-10 without QR. The roadmap also
retains QR-Should wording in its summary/register. Follow the product: this
slice introduces no QR/barcode dependency, lookup or public endpoint. Record the
discrepancy here without silently amending either authoritative baseline.
No automated messages, customer portal, pattern geometry, calibration or A4
tiling. AC-64's later true-scale pattern portion remains unfulfilled.

Fresh origin/development is `7bdeebc3db8ccb3a81d5d118c0e44d6df2123c29`.
All software prerequisites are merged: #16; shell #51–#54; PDF/share #59/#60;
grouping #118–#120; design #146–#148; measurement #153–#155; manual pattern
#164/#165. PRs #166/#167 are merged, superseding dated in-progress records.
Small-service #124–#126 is also merged. See preparation evidence for ancestry,
CI and checkout limitations; merge is not human, privacy or pilot acceptance.

## Existing implementation and work still needed

Source review is bounded to the listed files and current Git comparison. The
checkout's runtime files match origin/development; documentation differs.
Codebase Memory has no index for this canonical root and graphify-out is absent;
rooted source inspection was used without installing or indexing anything.

| Source seam | Reuse | Required extension in this slice |
| --- | --- | --- |
| `contracts/documents.ts`, `core/documents.ts`, `db/repositories/documents.ts`, `db/document-repository.ts` | Frozen model, template/font hashes, revision uniqueness, attempts, durable replay, private artifacts, status, verified bytes and share events | Server-built job-slip/label model; explicit tenant-bound source/audience associations; revision-history query; source-selection concurrency checks |
| `documents/src/index.ts` | Registered static HTML/CSS, safe escaping, four local hash-checked fonts, font readiness, A4 15 mm margins, serialization, restricted Chromium lifecycle | Trusted template definitions; continuation identifiers; bounded approved image embedding if critical instructions require images. Current CSP is `img-src 'none'`: image rendering is **not already supported** |
| `auth/src/index.ts` `withOwnerDocument`; `jobs/document-runtime.ts`, `jobs/production.ts`, `jobs/documents.ts` | Owner/member transaction and shared processing/runtime seams, restore/lease fencing | Real business template/policy/storage/queue composition for both job modes. Default document adapters deny; do not enable generic browser-supplied models |
| `api/documents.ts`, `api/document-client.ts`, web `document-status.tsx`, `document-sharing.tsx` | Status/retry, same-origin bounded file delivery, SHA-256 validation, actual-PDF preview, prepared/marked-sent, capability/cancel/download fallback | Garment/piece host, source review and deliberate audience selection. Bind preparation to exact document/revision/hash/audience and clear it on every selection change |
| Design specifications, measurement sessions/access, manual-pattern repositories/policies | Explicit immutable versions, independent garment/native-piece selection, current wearer/guardian/media authority, source/review warnings | Typed transaction-bound readers and frozen provenance; no latest-version fallback or nested independent transactions |
| Grouped orders/pieces; small-service/add-on contracts and repositories | Accepted garment/piece identity and applicability; separate service instructions/completion | Identification projection for these exact scopes; never fabricate physical pieces from quantity or force custom sources onto a service |
| Existing privacy functions, source purge jobs, migrations `0014`/`0015` | Tombstones, governed erasure and private processing conventions | Document snapshot redaction/revocation and retained-object purge coverage. `0014` revokes app_privacy rights and guards history: personal frozen document models are **not proved erasable by the foundation**. A must extend the narrow audited mechanism, never grant ordinary history edits |

## Proposed field and audience policy

The following **JS-D01–09** are owner-approved software decisions. They do not
configure production rules, retention periods or activate live-data use.

**JS-D01 — Two document purposes.** The private production slip is for the owner
and a deliberately chosen authorised production recipient. The bag/material
label is a minimal identification document that may leave the shop. Neither is
a customer specification summary, invoice, release, assignment or custody event.
Sharing a private slip requires a separate recipient-purpose acknowledgement
after viewing the actual PDF. Selecting an external print-shop purpose offers
the minimal label; the private slip is not the default. Do not claim downloaded
copies can be recalled by revoking an app link.

| Field/source | Private production slip | Minimal bag/material label | External sharing rule |
| --- | --- | --- | --- |
| Readable accepted order/garment identifier | Required | Required | Allowed; no phone-derived identifiers |
| Native piece identifier and controlled piece name | Required for piece scope | Required for piece scope | Preserve exact identity; never enumerate pieces from a quantity |
| Booking identifier | Optional existing context; not the identity root | Excluded by default | Avoid revealing other garments in the booking |
| Garment/service type from accepted catalogue snapshot | Include | Include bounded structured name | No raw notes or arbitrary label editor |
| Customer/payer/wearer name, phone, address, guardian details | Excluded by default; use authorised source screen for disambiguation | Excluded | No contact in metadata, filenames, text-share payloads or label model |
| Requested work and separate service instructions | Include relevant reviewed instructions | Controlled service names only | Private notes never flow through label projection |
| Exact design root/version/selection and relevant choices | Include exact reference and permitted production choices | Excluded | Unselected or successor designs cannot replace it |
| Measurement session/version, form, units, method/source and selected values | Include only applicable production fields with current authority | Excluded | Private slip warning and deliberate recipient choice; no values in share text |
| Fitting photos and general private fit history | Excluded, including thumbnails | Excluded | No fitting-photo attachment or marketing/public reuse |
| Relevant construction instruction derived from fit review | Only if separately recorded as an authorised production instruction | Excluded | Never automatically copy a private fit-note feed |
| Manual/external pattern exact version, method, physical locator, recorded source and review | Include relevant facts; retain unknown/input mismatch and unverified scale/formula warnings | Excluded | No inference of cutting approval, expert validation or 1:1 scale |
| Exact permitted design/sketch reference images and annotations | Include only expressly selected production assets | Excluded | Current subject authority and exact digests; required annotation cannot be silently omitted |
| Uploaded external pattern PDF | Textual exact-version reference/locator and limitations; no pages auto-embedded | Excluded | Independently authorised private view; no pattern-print claim. If essential instructions cannot be conveyed in the slip, issuance is blocked |
| Material identification | Existing structured type/colour only when reviewed; no inferred receipt/stock | Optional reviewed structured type/colour, otherwise omit | No free-text extraction from custody, supplier or fitting notes |
| Money, price, costs, margins, payment state, UTR | Excluded | Excluded | Exclude from PDF body, hidden text, metadata and filenames |
| Assignee, signature, approval, progress, handover/custody | No invented fields; this template excludes them | Excluded | Producing/sharing a document changes none of these dimensions |
| Document revision, language, generated time and continuation identity | Required | Revision and label identity; generated time on sheet footer | No invoice allocator; generic document identity/revision remains authoritative |

**JS-D02 — Source review, never latest.** Owner opens one accepted garment or
native piece, chooses document purpose and document language independently of UI
language, and sees exact selected design/measurement/pattern references. Display
root/version, source/method, units and selection state. Use existing known,
unknown and approved not-applicable semantics. Missing required source or
ambiguous multi-form scope blocks issuance; approved no-measurement/no-pattern
small services omit those sections. Do not turn an unknown into zero, a fake
version or a new requirement. Unreviewed/mismatched pattern references remain
visibly reference-only; the slip is never permission to cut.

Use the accepted native piece IDs and supported readable order context. Repeated
copies of one label repeat the **same** identity and are labelled copies, not new
pieces. If a physical unit has no distinct identity, offer an order-level label
with explicit quantity and no claim that it identifies an individual unit.
Grouped requests enumerate each authorised member/scope independently; a
booking ID cannot grant access to another wearer's data.

**JS-D03 — Required and optional assets.** Freeze an explicit asset manifest:
exact association/version, subject, purpose, original and permitted derivative
digests, annotation version, required/optional classification and omission
decision. Default a selected instruction-bearing asset/annotation to required.
Critical unavailable, erased, quarantined or unsupported assets block issue
with a specific repair action. Do not guess that an asset is merely decorative.
Optional omission requires an explicit owner decision under the reviewed policy;
the source-review model and PDF retain an omission warning. No global
"continue anyway" for critical references. Pattern PDFs are references, not
executable HTML, arbitrary embed paths or pattern geometry.

A's shared-renderer extension may accept only bounded, server-authorised image
bytes with exact digest/format checks, embedded locally under a narrow CSP;
retain denial of remote URLs, file URLs, scripts and user markup. Do not enable
arbitrary `data:` content or paths supplied in a browser command. Test oversized
and malformed images plus annotation placement. If a required asset exceeds the
supported bound, fail visibly rather than shrink/drop it until meaningless.
Keep total frozen JSON within the existing 100,000-byte command bound; store
exact asset associations separately rather than base64-copying images into it.

**JS-D04 — Review versus issuance.** Before issuance, show a privacy-filtered
source review, explicitly not a PDF. On Create PDF, freeze the server-built
projection, source selection tokens, audience/purpose, language, A4, template
revision/hash, fonts, assets and applicable authority provenance. Never accept
arbitrary client JSON/HTML as the business document model. The request includes
exact source IDs and expected scope/selection revisions; validate them together
under locks in one membership-bound transaction. Stale selection returns 412;
missing required If-Match 428; domain blocker 409; invalid command 422. Expose
an honest conflict comparison, never automatic source merging.

Append a purpose-bound association from existing document identity/revision to
order/piece, exact sources and predecessor; no second allocator or billing
number. Source binding, frozen model, actor/action/hash-bound idempotency, audit
and `pdf.render` enqueue commit atomically using the **same transaction**.
Same request replays; changed payload fails. Durable revision constraints
survive replay-key expiry. Initial render failure leaves the request and order
intact. Retry uses the same frozen revision and asset digests. A changed source
selection needs a deliberate revised issuance, with reason and predecessor.

**JS-D05 — Stored artifact and current authority.** PDF preview and download use
the accepted stored bytes verified by hash, not a fresh HTML rendering. Later
source, shop, font or template changes cannot modify the original bytes or
source references. History distinguishes requested, pending, failed, ready and
unavailable/revoked artifacts; the last is an access outcome, not a new generic
render-state enum already present in source. Historical authorized retrieval
does not require a source to remain the current selection. It still requires
current subject membership/relationship/guardian and purpose authority.

The worker rechecks policy/consent, restore epoch/quarantine, lease and exact
asset availability around I/O and acceptance. Never substitute a newer asset.
Access denial/revocation is not a retryable render fault. Privacy erasure blocks
reads and retries immediately, redacts personal snapshot values through narrow
audited functions, fences in-flight acceptance, tombstones and schedules exact
private artifact/media deletion across retained outputs/backups/processors under
approved retention. Keep nonpersonal provenance. Erasure is the explicit privacy
exception to ordinary history retention, not permission to rerender old values.
Reuse existing storage-intention/lease/orphan cleanup; test DB/storage partial
failure and restore replay, not just happy-path upload.

**JS-D06 — A4 layout proposal.** Production slip: portrait 210 × 297 mm,
existing 15 mm margins, 12 pt body with Tamil-appropriate 1.7+ leading, 600-weight
section labels and high-contrast monochrome content. First block is purpose,
readable order/piece and document revision; then requested work, exact source
summary, measurement table, relevant construction/pattern warnings and permitted
asset figures. Repeat order/piece/revision on continuation pages using a tested
table header or reviewed renderer header mechanism. Never split a label/figure
from its identifier/caption or make an entire long note an unbreakable row.
Wrap notes naturally, preserve fractions/units, avoid clipping and boundedly
fail oversize content. No fit-to-page scale assertion or calibration ruler.

Label sheet proposal: A4 portrait, same margins, **two columns × four rows**,
each 87 × 63 mm, eight labels per sheet. Available area is 180 × 267 mm:
**2 × 87 + 6 = 180 mm** horizontally and **4 × 63 + 3 × 5 = 267 mm**
vertically. Use **6 mm horizontal gaps and 5 mm vertical gaps**. Cut boundaries stay inside
each cell; no proprietary stock or label printer. Text is 12 pt minimum; long
controlled names wrap. If the approved label cannot fit, block with the exact
field identified; do not truncate identifiers or silently shrink text. Unused
cells stay blank. Repeated copies retain identity. Owner must approve this
specific layout and the optional material-field projection before B starts.

**JS-D07 — Owner flow and states.** Extend the existing garment detail with
Job slip / Bag or material labels. Phone: one column, scope/purpose first,
review then creation/status then actual PDF; 44 px wrapping actions clear bottom
navigation. Tablet: review beside status/preview when readable; desktop: source
summary beside the actual PDF. No business values in routes/query strings,
storage, logs or service-worker caches. UI starts English; Tamil switching
preserves selections; document language is an explicit independent choice.
Use current tokens, Noto fonts, status regions, keyboard focus and dialog return.

| State | Owner-visible action and meaning |
| --- | --- |
| Source loading | Scoped skeleton/status; order detail remains usable; lazy assets only |
| Missing required source/asset | Name affected section safely; Open selected reference / resolve missing asset; Create disabled |
| Optional omission | Explicit reviewed omission choice and visible PDF warning |
| Reviewing | Exact scope, audience, source versions, language; Create PDF |
| Request outcome uncertain | Check status using frozen request identity; no new revision until reconciled |
| Queued/rendering | Existing status; no duplicate create; safe leave/return |
| Rendering/storage failed | Safe reason; Retry same revision only when server permits |
| Conflict | Refresh and compare source choices; explicit review/reissue |
| Ready, file not prepared | Prepare PDF loads and verifies actual bytes |
| Prepared | Actual PDF preview, download, explicit share; revision/audience displayed |
| Unavailable/revoked/access lost | Clear bytes/object URLs/private fields; no share/retry bypass |
| Share cancelled/unsupported/failed | Neutral cancellation or clear download/manual-attach fallback; never mark sent automatically |

**JS-D08 — Manual WhatsApp sharing.** A includes existing owner-triggered sharing
for its private slip, guarded by actual preview and deliberate audience/recipient
purpose. B adds minimal labels and grouped label selection. Prepare verified
File first; an explicit later tap performs capability-checked native file share.
The separate reviewed bilingual text/recipient action follows existing rules;
wa.me does not attach a file. Desktop downloads and manually attaches. No
automatic conversation opening during tests, no sending service. Records say
prepared or owner-marked sent, never delivered/read. Share-file/preview state is
cleared on scope/revision/audience change, sign-out, shop change, access loss,
late response, expiry and page lifecycle per the existing component.

**JS-D09 — Acceptance is separate from implementation.** A+B together cover
ORD-10/USE-07 and the AC-64 job-slip contribution. Human policy/template review,
fluent Tamil shaping/line-break review, physical Android file sharing and
low-cost-phone usability remain explicit gates. A4 paper review is useful where
available and is not required to operate the product. No physical print or
real WhatsApp send occurs in agent verification. Existing baseline goldens do
not prove a new job-slip or label template.

## Review decision packet

Approve or amend JS-D01–09, especially: default omission of personal names and
all fitting photos; the full private-slip sharing acknowledgement; exact critical
asset/optional omission policy; eight-label A4 geometry; controlled material
fields; and source-bound erasure/retention behaviour. No retention duration,
production threshold, garment rule or cutting tolerance is invented here.
Select ticket A only after the concrete packet is approved/published and its
direct blockers are rechecked. B starts after A merges and is independently
selected. Software approval does not activate real records.

## B source availability ? 24 October 2026

The #170 source audit found no reviewed structured material type/colour value on accepted garments or services. The optional label fields remain omitted; no free-text or template material requirement is repurposed as received material. Existing native piece identities and controlled accepted garment/service names are used. See [B implementation/evidence](Material_Labels_Implementation_170.md).
