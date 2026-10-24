# Reusable prompt: job slips and material labels with REA

Prepared 23 October 2026 for roadmap **1.3.4**, ORD-10 and USE-07;
AC-64 job-slip contribution only. Pattern tiling/calibration, QR lookup and
automated messages remain later scope. This brief changes no approval gates.

Copy the complete prompt below into an Aarili agent session:

~~~text
Prepare roadmap 1.3.4: Produce Job Slips and Material Labels. Use REA to understand
relevant observable workflows, then build Aarili's independent implementation.
Start with a garment/piece job-slip preview and immutable A4 PDF download through
the existing document pipeline, then add minimal bag/material labels and integrate
owner-triggered manual sharing. Printing must never be required.

1. Read authority and establish current readiness.
Read AGENTS.md; docs/agents/Development_Workflow.md and issue-tracker.md;
docs/Boutique_Business_Management_Final_Product_Plan.md, especially sections
3, 7, 9-10, 13-15, 19, 24-25, 27, 29.1, 30.1, 32-33;
docs/Architecture_and_Technology_Decisions.md, especially sections 6-11 and 15;
roadmap 0.4.4, 1.2.2, 1.3.1-1.3.4 and later QR/pattern allocations;
docs/aarili-design-system.md. Product governs behaviour/release scope;
architecture governs technology. Report conflicts rather than silently editing
baselines. In particular, the architecture package table lists QR on slips as
P1 Should, while the product Phase 1 register commits ORD-10 without QR and
allocates QR lookup later. Follow the product release scope and record this
discrepancy; do not add a QR dependency or public lookup in this slice.

Read Issue_59_Versioned_PDF_Evidence.md and Issue_60_Private_PDF_Sharing_Evidence.md,
plus grouped-booking, design-specification, measurement-version/private-fit and
manual-pattern designs/evidence under docs/agents. Inspect the actual document
contracts, worker renderer, templates, immutable storage, private access, preview,
language/font handling, sharing UI, jobs, privacy and restoration controls.
Extend these proven foundations; do not build another renderer or sharing stack.

Recheck issues/comments/native blockers, merge/CI and source state. Verify 1.2.2,
1.3.1-1.3.3 and technical prerequisites 0.2.3, 0.4.1 and 0.4.4 are merged.
Earlier records show manual-pattern PRs #166/#167 merged; verify present state
instead of treating old in-progress text as current authority. Synthetic foundation
proof does not establish business job-slip or human/physical-device acceptance.
Inspect git status and preserve unrelated work, including pending measurement
evidence/timing edits. Use the existing checkout and focused branches from updated
origin/development; no reset/discard/automatic stash or unrelated commit to switch.
Worktrees require explicit scenario approval. Research/design may proceed first;
implementation needs a selected approved issue with merged blockers. Reuse existing
authorisation. No implicit issue publication, push/PR, merge, deployment or live data.

2. Conduct bounded web-first REA research.
Apply reverse-engineer-anything and its runtime-observation guide. Primary target:
Nool at https://app.nooltech.com/login, our existing synthetic research account.
Public context: https://nooltech.com/docs/, Job Sheets. Inspect Order -> garment
item -> View Job Sheet, design/measurement/notes organisation, preview and any
actually exposed download/print/share actions. The guide documents a garment-level
job sheet; general PDF/export claims elsewhere do not prove that this exact screen
exports PDFs. Record observed capability, documented claims and gaps separately.
Secondary: https://tailorman.in/product-tour/, bill/item detail and any actually
exposed print/production-card view. Do not assume a bill is a production slip or
that bag labels exist. This is tailorman.in software, not tailorman.com clothing.

Use only synthetic fixtures in our permitted account. Observe one garment and a
multi-piece order, long bilingual instructions, missing reference, preview and
cancel. Save/download only our permitted synthetic documents; never copy competitor
templates, graphics, code or real records. Do not open a real WhatsApp conversation,
send messages, print on hardware or mutate shared demos. No APK, emulator, new
subscription or account is required initially. Record inaccessible/mobile-only flows
as gaps rather than inventing successful observation.

Use T3 preview for ordinary browser work where available. REA observation needs
its own supported explicit target/CDP endpoint; preview login alone does not
establish one. Rediscover current targets, reuse the dedicated research profile,
protect unsaved forms and use installed schemas. Diagnose actual blockers with
bounded recovery rather than reinstalling tools. Request private sign-in only if
needed; no passwords/OTP/tokens/cookies in chat or Git. Keep unnecessary headers,
bodies and storage capture off; raw captures remain outside Git. Browser evidence
cannot prove private schema, RLS, issuance immutability or transactional job guarantees.
Write docs/agents/Job_Slips_Labels_REA_Evidence.md with source links, time/target,
actions, evidence IDs and observed/documented/inferred/unknown claims. Continue
supported design work if access fails without claiming a successful REA run.

3. Design document purpose, audience and permitted fields.
Write docs/agents/Job_Slips_Labels_Design.md, mapping ORD-10/USE-07 and the AC-64
job-slip portion. Define a reviewed field/audience matrix for:
A. Private production slip: readable order/garment/piece identifier, relevant
requested work, exact selected design/measurement/manual-pattern versions and only
the production details permitted for that intended use. Show units/source/version
and retained unverified pattern-scale/formula warnings where relevant. Do not
replace explicit source versions with latest values or claim a reviewed reference
is approved/calibrated for cutting. Unknown/not applicable stays explicit.
B. Bag/material label: minimal readable garment/piece/order identifiers and reviewed
safe identification details. Exclude private body measurements, fitting photos,
personal contact data, internal notes, costs and margins by default. Prefer safe
projection from structured fields, not a free-text field that leaks private notes.

Make internal/private production content clearly distinguishable from minimal labels
and any externally shared output. A signed URL is not sufficient protection after
a PDF has been downloaded. Require a deliberate document/audience choice and preview
before manual external sharing; do not send a full private fitting sheet to a print
shop by default. Record concrete field/policy decisions for owner review. No
customer portal, anonymous public document endpoint or automatically shared URL.

Support individual garments and grouped pieces with stable identifiers; quantities
must not create ambiguous or fabricated piece IDs. Reuse existing small-service
applicability: omit irrelevant measurement/pattern sections, preserve separate
service instructions and completion facts without inventing tasks. Labels identify
physical items but do not record receipt, stock, custodian, dispatch or handover.
They do not approve design, confirm money, release cutting or change progress.
No invented production assignment or signature/approval evidence on the slip.

4. Reuse immutable issuance and asynchronous rendering.
Define preview versus issued/stored artifact semantics using existing document
contracts. Freeze the intended source version selection, permitted field snapshot,
language, paper, template/font versions and asset associations for issuance.
Creating a new design/measurement/pattern version later cannot change an old PDF.
Explicit revised issuance creates a new revision with provenance; re-download
serves the same stored verified bytes/hash rather than rerendering current data.
Do not add invoice/receipt numbering or a second document identity allocator.

Use the existing worker's HTML/CSS/Chromium templates, local embedded Tamil/Latin
fonts and font readiness checks, concurrency/lifecycle limits, private immutable
storage and verified delivery. No remote font/image fetch, arbitrary HTML/URL
rendering or executable user markup. Reuse safe escaping and tenant-scoped asset
loading; never traverse arbitrary supplied file paths. Applicable exact media
version/digests must be pinned so a worker retry cannot substitute a newer asset.

Write the authorised document request, idempotency/audit and queued job atomically.
The worker rechecks current membership/policy/consent and restore/quarantine state
while preserving the frozen business snapshot. If authorised source/media is erased
or revoked, follow privacy policy and fail closed; do not resurrect historical
private values to reproduce a PDF. Rendering/upload failure leaves the business
order intact, exposes a failed/pending status and retries the same requested result.
Handle retry, duplicate delivery, worker crash and storage/DB partial failure through
existing outbox/queue/artifact recovery conventions; no duplicate issued revision
or orphaned publicly accessible artifact. State exactly what exists in source.

Define required versus optional asset readiness in the review packet. Missing or
quarantined critical instructions must not produce a falsely complete slip; optional
omissions need a visible warning/placeholder under the approved policy. Do not
silently drop an annotation or reference needed to understand the instruction.
Core order/detail/form work must remain usable without fetching every historical
image or rendering a PDF. Load preview/selected permitted assets lazily.

5. Make A4, labels and manual sharing usable.
A4 is default. Define readable margins, wrapping, page breaks, repeated identifiers
on continuation pages and label cut boundaries without requiring a label printer
or proprietary adhesive stock. Agree label layout as a concrete owner-reviewed
template, not an invented hardware requirement. Job slips are ordinary production
documents, not true-scale pattern outputs. No A4 tiling, calibration ruler, pattern
geometry or A3 requirement is introduced by AC-64's later pattern portion.

Preview and download must use the actual stored PDF and its privacy-filtered model.
Reuse existing mobile file preparation then explicit native-share tap, capability
checks and cancellation/failure/download fallbacks. Desktop uses PDF download and
manual WhatsApp attachment. Do not imply a wa.me link attaches a file automatically.
Text/recipient choices follow the existing reviewed sharing rules. Record prepared
or owner-marked sent where supported, never delivered/read from opening a share
sheet or link. Tests stub share targets; do not send messages. A native-share stub
is not real Android proof. No automated WhatsApp API or external sending service.

6. Prepare concrete tickets and implement the selected outcome.
Write docs/agents/Job_Slips_Labels_Ticket_Packet.md. Suggested vertical outcomes:
A: garment/piece source review -> frozen authorised job-slip request -> queued
render -> actual private preview/download -> retained immutable revision/history.
B: minimal bag/material labels with reviewed A4 layout, grouped/small-service
applicability and owner-triggered sharing integration using existing foundations.
Refine around complete reviewable outcomes and actual dependencies. Privacy,
Tamil shaping, failure recovery and immutable artifacts are requirements from the
first delivery, not deferred hardening. Every ticket has requirement IDs, sources,
scope, prerequisites, migrations/recovery, acceptance and verification. Present
the complete packet before publishing unapproved issues; implement only a selected
approved issue once blockers merge. Reuse already granted approval. A alone does
not close all 1.3.4 requirements if labels/manual-sharing work remains outstanding.

Use framework-free core policies/repository interfaces, thin Node Hono handlers,
strict command contracts, typed clients and existing documents/worker boundaries.
Every query, render projection, job, media and file access requires membership-bound
withShop(), shop-led keys/composite foreign keys and forced RLS under app_user.
Commit actor/action/request-hash-bound idempotency, mutation, audit and jobs together.
Identical retry replays; changed payload fails. Use existing If-Match semantics for
editable selections: 428 missing, 412 stale, 409 conflict, 422 validation. Never
auto-merge changed source selection or silently render a newer revision.
Use reviewed expand migrations if needed. Preserve existing privacy erasure,
retention, document revocation, tombstones and restore controls. No business/private
values in URLs, browser storage, PWA caches, logs or committed artifacts. Memory-only
query cache clears on sign-out/shop switch/access loss. Retrieve current ctx7 docs
when library syntax/setup/debugging is involved; do not change pinned tooling casually.

Apply the design system and relevant UI skills for English/Tamil at phone/tablet/
desktop sizes, keyboard/screen-reader support and clear loading, prepared, queued,
failed, retry, unavailable and conflict states. Apply the PDF skill when creating/
inspecting PDF artifacts; preserve the repository's production renderer rather than
substituting a standalone PDF library recipe. Keep implementation details out of
product copy unless they help a user decide what to do.

7. Verify visual output, privacy and recovery.
Test normal/custom/grouped/small-service sources, exact version selection, long
Tamil/English/mixed text, fractions/units, annotations where included, page overflow,
multiple pages, label boundaries and missing/failed assets. Render actual PDFs to
page images and visually inspect every template/page variant for clipping, font
shaping, size and identifiers; text extraction alone cannot prove Tamil appearance.
Run the existing Tamil golden suite and owner template-review packet. Don't update
goldens solely to make changed output pass without reviewing the difference.
Verify programmatic page size, font/template hashes, stored-byte identity and that
later source/shop/template changes do not mutate prior artifacts.

Check public/minimal labels contain no private fitting values/photos/contact or
margins, including hidden text, metadata and filenames. Test guessed other-shop
document/media IDs, permission/consent loss, revoked/erased source, retry after
storage failure, worker crash/duplicate delivery, source-update race, stale selection
and transactional rollback. Real PostgreSQL proves RLS and atomic queue/audit/
idempotency; mocks cannot. Retain renderer network/script denial and artifact leak
checks. Test actual mobile-share capability/fallback and user activation through
controlled tests; separately report unperformed physical device/A4 print review.

Follow Development_Workflow.md and verification-before-completion. Run actual lint,
Knip, typecheck, relevant unit/property/PostgreSQL, browser/axe, document/golden
checks and production build before claiming completion. Test three screen sizes;
record exact output, failures, checks not run and manual acceptance requirements.
Do not invent commands or reuse stale results for changed code. Avoid repeated
unchanged checks without a reason. Write
docs/agents/Job_Slips_Labels_Implementation_Evidence.md and update roadmap
traceability, prescribed Delivery_Measurements.md entries and manual review packet,
preserving unrelated edits. Return research/gaps, independent field/audience matrix,
template previews, ticket sequence and requirement-by-requirement validation.
Register authorised PR work with T3; leave owner review/merge/deployment at their
gates. No full AC-64 pattern claim, proof of WhatsApp delivery or live activation.
~~~
