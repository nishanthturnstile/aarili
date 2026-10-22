# Reusable prompt: versioned garment design specifications with REA

Prepared 22 October 2026 for roadmap **1.3.1**, ORD-07 and
DES-01/02/03/04/05/10; applicable contributions to AC-07 and AC-08.
This brief preserves product scope, approval requirements and activation gates.

Copy the complete prompt below into an Aarili agent session:

~~~text
Prepare roadmap 1.3.1: Capture a Versioned Design Specification. Use REA to
understand relevant competitor workflows, then design and implement Aarili's
independent solution against our approved requirements. Start with controlled
design choices and a garment-linked versioned specification, followed by private
references and their version-preserving replacement.

1. Read authority and establish the current baseline.
Read AGENTS.md; docs/agents/Development_Workflow.md and issue-tracker.md;
docs/Boutique_Business_Management_Final_Product_Plan.md, especially sections
3, 7, 9-10, 13-15, 24-25, 27, 29.1, 30.1, 32-33;
docs/Architecture_and_Technology_Decisions.md, especially sections 6-11 and 15;
roadmap 1.1.2, 1.2.1-1.2.4, 1.3.1-1.3.4 and 1.4.3;
docs/aarili-design-system.md. Product governs behaviour; architecture governs
technology. Report conflicts instead of silently revising either baseline.

Read existing service-template, customer/wearer, grouped-booking, small-service
and repeat-order designs/evidence in docs/agents. Read Issue_57_Private_Uploads_Evidence.md
and Issue_58_Media_Processing_Evidence.md, and inspect their actual implementations.
Recheck current issues, comments, native blockers, merge state, CI and source.
Verify 1.1.2, 1.2.1 and technical prerequisites 0.2.3, 0.4.1 and 0.4.3 are merged.
Do not infer readiness from an old evidence heading or a locally passing branch.

Reuse existing service category identities, catalogue/manifests, form/checklist/task
definitions, garment/piece identifiers, accepted-order history, durable drafts,
private uploads, media processing, audit and typed clients. Avoid a competing
category library, upload stack or order engine. Identify the actual extension seams.
Inspect git status before mutations; preserve unrelated changes and branches.
Use the existing checkout, focused branches from updated origin/development and
the repository issue workflow. No worktree without explicit scenario approval.
Prepare the full design/ticket packet first if unapproved; implementation requires
a selected approved issue and merged direct blockers. Reuse existing approvals.
No implicit publication, push/PR, merge, deployment, spending or live-data activation.

2. Conduct bounded web-first REA research.
Apply reverse-engineer-anything and its browser runtime guide. Primary target:
Nool at https://app.nooltech.com/login, using our existing synthetic research account.
Public context: https://nooltech.com/docs/, Job Sheets and Attachments sections.
The docs describe garment-specific design options, construction notes and order
attachments; these are documented claims until verified on the accessible runtime.
Inspect Order -> garment item -> View Job Sheet where available. Look for design
options, component-level notes, reference attachments, save/reopen and edit history.
Secondary candidate: TailorMan at https://tailorman.in/product-tour/, item-type
configuration and bill/item detail, solely for exposed category/field organisation.
Do not confuse tailorman.in software with the separate tailorman.com clothing brand.
Do not claim a public sample persists edits, or that either app has immutable design
versions, component annotations, private rights controls or approval history without
observed evidence. Record missing capability as a gap.

Use T3 preview for ordinary browser navigation where available. REA runtime evidence
needs its supported explicit browser target/CDP connection; preview is not itself
proof of a connectable endpoint. Reuse the dedicated research profile, rediscover
the current endpoint/target and protect unfinished drafts. Use installed schemas.
Do not reinstall/diagnose REA unless an actual blocker requires it. No APK or emulator
is needed initially. If mobile-only controls block research, document the gap before
proposing another acquisition route. Request private sign-in only when necessary;
never collect credentials, cookies or tokens in chat or committed files.

Use only permitted synthetic fixtures: a blouse with separate neckline shape and
decoration, a sleeve construction choice, lining/fastening notes and a synthetic
shop-owned sketch. Inspect selecting, editing, cancelling, saving and reopening;
where supported inspect reference replacement and the old reference's visibility.
Use only our test account for permitted saves. Do not mutate shared demos, submit
payments, send messages, upload real customer/minor images or mark work approved.
Keep body/header/storage capture off initially; capture only necessary UI and
request evidence. Raw captures stay outside Git. Do not copy code or competitor
assets. Browser observation cannot establish private backend/schema guarantees.

Write docs/agents/Design_Specification_REA_Evidence.md with target, time, actions,
tool/evidence identifiers, public source links and limitations. Separate observed,
documented, inferred and unknown claims. If access fails, continue requirements
and design work without pretending REA execution succeeded.

3. Define our controlled vocabulary and specification model.
Write docs/agents/Design_Specification_Design.md, mapping each decision to ORD-07,
DES-01/02/03/04/05/10, architecture and applicable scenarios. Reuse existing category
IDs and exact template links. Define category/subcategory names, descriptions,
relevant forms/checklists/tasks and reference examples using existing conventions.
No invented approved catalogue or business policy: examples are synthetic fixtures.
Owner-reviewed supported choices and compatibility decisions remain explicit.

Keep neck type, neck design, sleeve type and sleeve design distinct. Questions
depend on garment and selected construction: fit preference, neckline/depth,
sleeve construction/length, fastening/opening, lining, decoration, placement,
finishing and restrictions. Do not force blouse fields onto all garments or services.
Unknown, not applicable and explicitly selected none must remain distinguishable.
Define structured values/units where needed without introducing authoritative body
measurements, guessed defaults, unapproved tolerances or pattern formulas.

Libraries have Available for New Orders controls. Inactive choices remain readable
in history but cannot silently enter new work through intake or repeat-as-new.
Require a supported replacement or authorised reactivation; never overwrite the old
snapshot. Reuse bilingual English/Tamil labels and version labels where referenced.
Changing catalogue labels/templates cannot rewrite existing specifications.

A saved specification version has exact order/garment/piece identity, author,
timestamp, revision reason where applicable, selected definition versions and
reference associations. Distinguish an editable draft from an immutable saved
version. Define explicit current-version selection and concurrent edit behaviour;
avoid accidental last-write-wins or replacing an old version in place.
Separate inspiration from a confirmed instruction. Confirmed instruction is not
customer approval: no fabricated approval timestamp/person/signature. Customer
approval and change-impact workflow belongs to 1.4.3. Preserve any existing approved
snapshot; if editing would require later governed agreement changes, block/route
that case explicitly rather than bypassing the gate with a new specification.

4. Define private, versioned component references.
Support the ORD-07 asset classes (images, documents, sketches and voice notes)
through the existing approved media pipeline, identifying supported formats and
any explicit delivery split. No silent omission of a required asset class.
Link each asset to the neckline, sleeve, embellishment or instruction it supports;
record source/uploader/date, caption, annotation and exact specification version.
Define a bounded useful annotation representation; no full drawing editor unless
the selected approved ticket needs one. Replacing an asset/caption/annotation
creates a new version and preserves the prior instruction/reference association.

Distinguish shop-owned reusable references from private customer references.
Record applicable rights/source and enforce permitted reuse. A private image must
not become a shop template, public gallery asset or another wearer's reference by
copying/repeating/merging an order. Revalidate identity, guardian consent and access;
minor/private fitting images cannot be published. Do not build gallery publishing.
Historical integrity coexists with audited privacy erasure, retention and tombstones.
Never make ordinary users able to bypass privacy restrictions to view erased assets.

Authorise the media row before signed access, use immutable shop-prefixed keys,
and preserve processing/quarantine/readiness restrictions. Do not fetch arbitrary
source URLs server-side or make private storage public. Handle rejected/failed
upload, retry, missing asset and safe preview states; pending assets must not look
ready. Reuse cleanup, retention and processing jobs rather than inventing a queue.
Inspect actual architecture for permitted limits/formats; do not copy competitor
upload limits or expose raw storage keys as product UI.

5. Prepare concrete vertical tickets and implement only the selected outcome.
Write docs/agents/Design_Specification_Ticket_Packet.md. Suggested sequence:
A: controlled vocabulary and garment-specific specification create/read/revise,
including exact historical snapshots, availability enforcement and repeat-order seam.
B: component-linked private assets, source/rights metadata, captions/annotations
and version-preserving replacement, using existing upload/processing foundations.
Refine boundaries around complete reviewable user outcomes, real prerequisites and
required ORD-07 formats. Each ticket needs requirement IDs, acceptance cases,
migrations/recovery, isolation/history consequences and verification. Show the
concrete packet for approval before publishing unapproved issues. Do not call A
alone full 1.3.1 completion. If approval/selection already exists, proceed accordingly.

Use framework-free core policies/repository interfaces, thin Hono Node handlers,
strict draft/command contracts, typed clients and memory-only query caching.
Every tenant query/mutation/media access uses membership-verified withShop(),
composite shop foreign keys, shop-led indexes and forced RLS. Commit business change,
audit, request-bound idempotency and applicable jobs atomically. Repeated identical
requests replay their result; changed payload fails. Use existing If-Match semantics:
428 missing, 412 stale, 409 domain conflict, 422 validation. Enforce immutable
version history at the database seam, including annotation/reference relationships.

No pattern generator, measurement-session feature, pricing/change-agreement engine,
customer portal, AI, automated messages or job-slip/PDF implementation in this slice.
AC-08 here means orderable does not imply automatically draftable; retain the manual/
external path and later 1.3.3 dependency, without claiming full AC-08 closure.
Selections may identify relevant existing cost/task/pattern requirements but must
not silently change accepted price, promise, progress or allocations.
Use the project design system and relevant frontend skills. Support English/Tamil,
phone/tablet/desktop, keyboard/screen readers, clear draft/saved/version states,
conflict recovery and media failure states. Do not require every historical image
to load for core editing. No business data in URLs, browser storage or PWA caches.
Use current ctx7 documentation when library-specific details are needed.

6. Verify scope, security and historical behaviour.
Test distinct neck/sleeve type/design fields; garment-specific applicability;
unknown/not-applicable values; inactive choices hidden for new work but readable
historically; repeat-as-new replacement/reactivation; exact old versions after
library and reference edits; original specification unchanged by retry/cancellation.
Test multi-piece association, cross-wearer source rejection, guardian applicability,
private versus reusable assets, failed/quarantined upload, expired signed access,
wrong-shop media IDs, duplicate attach/replacement, stale edits, atomic rollback
and concurrent revisions. Use real PostgreSQL for RLS, immutable constraints,
idempotency and transaction evidence; mocks do not prove these properties.
Run existing intake/repeat/service regressions relevant to touched seams.

Follow staged Development_Workflow.md verification and verification-before-completion.
Before completion run actual repository lint, Knip, typecheck, relevant unit/property,
real PostgreSQL integration, browser/axe tests and production build. Verify English/
Tamil at all three screen sizes. Test applicable media worker/failure/retry paths.
Record exact commands/results and checks not run; do not substitute stale evidence
or invent command names. Do not rerun unchanged checks without a reason.
Write docs/agents/Design_Specification_Implementation_Evidence.md, update roadmap
traceability and prescribed Delivery_Measurements.md entries/manual review packet.
Report each requirement's coverage and later dependency, remaining owner decisions
and live-activation gates. Register authorised PR work with T3. No implicit merge
or deployment, no claiming full approval/measurement/pattern workflows are complete.
~~~
