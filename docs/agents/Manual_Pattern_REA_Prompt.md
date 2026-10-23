# Reusable prompt: manual and external pattern references with REA

Prepared 23 October 2026 for roadmap **1.3.3**, PAT-01 and PAT-03;
applicable AC-07/08 coverage. Phase 1 remains manual/external: no pattern engine,
calculated drafting sheet, seam presets, true-scale export or cutting release.
This brief changes no product scope, dependencies, policy or approval gates.

Copy the complete prompt below into an Aarili agent session:

~~~text
Prepare roadmap 1.3.3: Record a Manual or External Pattern Path. Investigate
relevant observable workflows with REA, then build Aarili's independent solution
against our requirements. Start with declaring the manual/external method and
linking a physical or uploaded reference to a garment with exact input provenance.

1. Read authority and verify current prerequisites.
Read AGENTS.md; docs/agents/Development_Workflow.md and issue-tracker.md;
docs/Boutique_Business_Management_Final_Product_Plan.md, especially sections
3, 7, 9-10, 13-15, 24-25, 27, 29.1, 30.1, 32-33;
docs/Architecture_and_Technology_Decisions.md, especially sections 6-11 and 15;
roadmap 1.3.1-1.3.4 and later pattern allocations; docs/aarili-design-system.md.
Product governs behaviour and release scope; architecture governs technology.
Report conflicts rather than silently amending either baseline.

Read the design-specification, measurement-versions/history/private-fit and
repeat-order designs/evidence under docs/agents, plus private upload/processing
and privacy foundations. Inspect actual existing contracts and source seams.
Recheck issues/comments/native blockers, merge state and relevant CI. Dependencies
are 1.3.1-1.3.2; technical prerequisites are 0.2.3, 0.4.1 and 0.4.3. Earlier records
show design PRs #149-#151 and measurement PRs #156/#161/#163 merged; verify current
authority and do not mistake historical in-progress headings for present status.
Reuse catalogue/type identities, garment/piece ownership, explicit design and
measurement versions, private media, audit, idempotency and typed clients.

Inspect git status. Preserve unrelated edits, including existing measurement
closeout/evidence changes. Use the existing checkout and focused branches from
updated origin/development. No reset/discard/automatic stash or unrelated commit
to clear a branch switch. Worktrees need explicit scenario approval. Application
changes require a selected approved issue and merged direct blockers. Research/
design may proceed first. Reuse existing authorisation; do not ask again. No
implicit issue publication, push/PR, merge, deployment, spending or live data.

2. Conduct bounded, evidence-led REA research.
Apply reverse-engineer-anything and its runtime-observation guide. Primary
candidate: Nool, https://app.nooltech.com/login, our existing synthetic account.
Public guide: https://nooltech.com/docs/. Observe item-level job-sheet notes and
order image/PDF attachment behaviour for reference discovery, attachment, preview,
save/reopen and replacement. These are partial UX references: the public guide
does not establish physical-pattern IDs, input-version binding, manual/external
availability, scale checks or immutable pattern history. Investigate a dedicated
pattern feature only if actually exposed; otherwise explicitly record it absent
from the observed surface, not proven absent from the entire product.
Secondary candidate: https://tailorman.in/product-tour/, item-type configuration
and bill/item detail, solely for exposed capability/garment context. Do not claim
it provides manual/external pattern tracking without observed evidence. This is
tailorman.in software, not the separate tailorman.com clothing brand.
Do not add a CAD/drafting product, download executable pattern software or inspect
an APK merely to imitate an automated engine outside our scope.

Use T3 preview for ordinary browsing where available. REA needs a supported explicit
target/CDP connection; preview login does not establish one. Reuse our dedicated
research profile and rediscover current endpoint/target IDs. Protect unsaved forms
from connect-mode navigation. Follow installed schemas, use bounded recovery for
actual blockers, and do not routinely reinstall REA. Browser/SaaS access is enough
initially; no APK, emulator, new account or paid subscription is needed.
Request private sign-in only when necessary; never collect credentials in chat/Git.

Use only permitted synthetic fixtures: a shop-owned sketch, a synthetic PDF
explicitly marked SAMPLE / SCALE UNVERIFIED, and a physical locator such as
"Cabinet B / folder 12" in our own test records. No customer fitting photos or
third-party proprietary pattern uploads. Do not persist changes in shared demos,
send messages, fabricate approvals/delivery/payments or purchase anything.
Keep unnecessary headers/bodies/storage capture off; raw captures stay outside Git.
Do not copy vendor code, assets, formulas or validation policies. Browser evidence
cannot prove their backend schema, transactions, version immutability or RLS.

Write docs/agents/Manual_Pattern_REA_Evidence.md with target/time/actions, synthetic
fixture, source links, tool/evidence IDs and limits. Distinguish observed,
documented, inferred and unknown claims. If access fails or no relevant pattern
surface exists, record the gap and continue independent requirements/design work.
Do not claim a successful REA scenario or full competitor coverage from public docs.

3. Define Phase 1 capability and reference semantics.
Write docs/agents/Manual_Pattern_Design.md with PAT-01/03 and AC-07/08 mappings,
existing module boundaries, exact provenance and lifecycle rules. Reuse existing
category/subcategory/type identities and availability controls. Distinguish
orderable garment, available manual/external preparation path, reference attached,
reference reviewed and production/cutting release. None implies the others.
Represent current supported manual/external options accurately. PAT-01's future
validated-automated category must not expose a selectable automated route or a
generation action in Phase 1. Do not label types automatically draftable merely
because orders or measurements can be created for them.

An owner records manual or externally supplied preparation, source/author or
supplier where known, descriptive reference/version, notes and a physical locator,
sketch or uploaded output as appropriate. A physical-only reference must work
without a file upload, printer, CAD viewer or mandatory body photo. It is a locator,
not proof that a pattern/material has physically been received or handed over.
Do not create vendor payments, stock/custody movements or external worker access.
Unknown source/version/review facts remain explicit; distinguish externally stated
revision labels from Aarili's immutable reference version IDs.

Bind a reference to its exact garment/piece, wearer where applicable, and the
specific design/measurement versions used when known and authorised. Do not infer
"latest" or manufacture input provenance for an imported/physical reference.
If exact inputs are unknown/not applicable, show that explicitly and define safe
review/use restrictions in the packet. Do not force measurements onto a service
whose approved policy says not required. Cross-wearer source links require the
existing reviewed authority; shared contact/phone is not sufficient.

4. Preserve versions, assumptions and review history.
Drafts may be editable. Saving/revising a recorded pattern reference preserves
the earlier version, source/input bindings and prior selection. File/physical
locator replacement creates attributable history; do not overwrite immutable media
keys or rewrite a historical garment's selected reference. Use explicit version
selection and a reasoned revision/review trail consistent with existing conventions.
Define a bounded review state model and reviewer/time/evidence fields in the packet.
Recording "reviewed" cannot imply qualified rule approval, validated fit, calibrated
print or permission to cut. Do not invent a new expert approval policy.

Display imported scale, units and formula assumptions as unverified unless the
applicable reviewed evidence exists. A PDF page size, filename, embedded metadata,
thumbnail or declared 1:1 label does not prove calibrated scale. A physical pattern
does not prove valid fit. Preserve failed/unknown checks; no automatic pass or
unapproved numeric tolerances. The proposed PAT-13 tolerances are not adopted by
this slice. Keep relevant scale/formula warnings visible on detail/review/selection,
including for externally supplied outputs and reused references.

Changing design/measurements must not silently rebind a reference to new inputs.
Show input-version mismatch and require an explicit review decision; preserve what
the old reference used. Do not auto-regenerate, assert compatibility or replace a
pattern already used for cutting. If current downstream state makes replacement
consequential and its governed workflow is unavailable, block/route that case
explicitly. Do not build the later production/change-agreement engine here.
Repeat-as-new may show old references as context, never copy review/scale validity
as a current fact or auto-select a private pattern for a different wearer.
Inactive types remain readable historically; new selection/reuse follows the
existing explicit supported replacement/reactivation policy.

5. Reuse private media and privacy controls.
Authorise referenced media rows before attachment/preview/download; use existing
processing/quarantine, readiness checks, immutable shop-prefixed keys and signed
access. Handle rejected/pending/missing files without showing them as ready. No
public bucket, arbitrary server-side URL fetch, embedded script execution or new
pattern-file parser. Store externally generated outputs as supported private assets;
unsupported native file formats need an explicit design decision, not a new engine.
Reusing a reference must not broaden customer-private rights into a shop library.
Keep rights/source classification and wearer consent/guardian requirements where
applicable. Minor/private fitting media cannot publish; no gallery or customer link.
Extend audited erasure/retention/tombstones to new personal notes and associations;
immutable provenance cannot bypass legitimate privacy erasure. No private values
in logs, URLs, browser storage, service-worker caches or committed artifacts.

6. Prepare concrete tickets and implement only the selected approved outcome.
Write docs/agents/Manual_Pattern_Ticket_Packet.md. Suggested sequence:
A: available manual/external path -> garment reference with physical locator and
exact/explicitly unknown provenance -> saved version/detail/review history.
B: sketch/uploaded output integration, scale/assumption evidence, explicit reference
replacement/selection and affected repeat/history flows using existing media.
Refine around complete reviewable outcomes and dependencies. Privacy, history and
honest review/scale states apply from the first ticket; do not defer them as polish.
Every ticket has sources, requirement IDs, scope, blockers, migration/recovery,
verification and acceptance cases. Present the complete packet before publishing
unapproved issues. Implement a selected approved issue once direct blockers merge;
reuse existing approvals without asking again. A alone is not full 1.3.3 closure
if other approved PAT-03 paths remain outstanding.

Use framework-free core policies/repository interfaces, thin Node Hono handlers,
separate draft/command contracts, typed clients and existing save/retry recovery.
Every read/mutation/history/media path uses membership-verified withShop(),
shop-led keys, composite tenant foreign keys and forced RLS under app_user.
Commit actor/action/request-hash-bound idempotency, business mutation, audit and
applicable jobs atomically. Same request replays; changed payload fails. Apply
If-Match to editable records/selections: 428 missing, 412 stale, 409 conflict,
422 validation. Never silently merge a reference/input conflict. Use reviewed
expand migrations, immutable saved history and existing audited privacy exceptions.
Preserve old records/unknowns; do not fabricate migration approval or scale checks.
Use prescribed ctx7 docs for library-specific syntax/setup/debugging.

Use the project design system and relevant frontend skills; support English/Tamil,
phone/tablet/desktop, keyboard/screen readers and fileless manual work. Distinguish
method, reference version, exact inputs, review and scale warnings clearly. Include
loading/empty, unsaved, save-failed, retry, stale conflict, unavailable source and
upload-processing states. Keep form input on save failure. Query cache stays
memory-only and clears on sign-out/shop switch/access loss.
No PAT-02/04-17 implementation: no formulas, seam presets, AI, pattern generation,
CAD editor, fabric estimation, tiling/calibration export or calculated drafting
sheet. No cutting authorisation, production task engine or 1.3.4 job slips here.
Ordinary authorised download of an existing uploaded file is not generated export.

7. Verify and update traceability.
Test manual reference without upload; external sketch/PDF; unknown source/input
versions; type availability; no automated action; correct garment/piece/wearer;
visible unverified scale/formula assumptions; reviewed versus cutting distinction;
reference replacement and explicit selection preserve old versions; input changes
show mismatches without rebinding; repeat-as-new reviews context and permissions.
Test wrong-shop/other-wearer IDs, unauthorized media, quarantined/failed upload,
erased source, consent loss, private versus shop-owned reuse, stale If-Match,
concurrent revision/selection, exact lost-response retry, changed-payload rejection
and atomic rollback. Real PostgreSQL proves RLS, immutable constraints and audit/
idempotency transactions; mocks cannot. Run relevant existing design, measurement,
repeat and privacy/media regressions. No destructive test against real records.

Follow Development_Workflow.md and verification-before-completion. Before completion
run actual repository lint, Knip, typecheck, relevant unit/property/PostgreSQL and
browser/axe tests plus production build. Check English/Tamil at three screen sizes,
including physical-only workflow and warning visibility. Record exact results,
failures, checks not run and manual review requirements. Do not invent commands or
reuse stale evidence for changed code; avoid repeating unchanged checks without cause.
Write docs/agents/Manual_Pattern_Implementation_Evidence.md, update roadmap
traceability and prescribed Delivery_Measurements.md/manual review entries while
preserving unrelated work. Reconcile stale prerequisite status using current evidence.
Return research findings/gaps, independent design, state/provenance rules, ticket
sequence and requirement-by-requirement evidence. Register authorised PR work with
T3. Do not claim qualified pattern validation, full later PAT scope, cutting readiness,
pilot activation or completion of the whole slice after a partial delivery.
~~~
