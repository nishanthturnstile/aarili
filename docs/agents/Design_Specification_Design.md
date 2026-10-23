# Versioned garment design specifications: independent design

**Dependency status checked 22 October 2026 for 1.3.2 preparation:** A1 #146,
A2 #147 and B #148 are closed; PRs #149/#150/#151 are merged into development.
PR #151 merged at 16:42:48 UTC as `2aa1b1246213845f1dcaa55d7505051219aedecd`;
its Fast verification and Dependency audit passed. The dated selection/in-progress
notes below describe earlier work. This merge resolves the software dependency,
not human acceptance, full AC-07/08, privacy/retention or live-activation gates.
See [measurement baseline](Measurement_Versions_Implementation_Evidence.md).

22 October 2026. Roadmap **1.3.1**. **Owner-approved software design and packet;
A1 #146 / PR #149 and A2 #147 / PR #150 merged; owner selected
[B #148](https://github.com/nishanthturnstile/aarili/issues/148), implementation and verification underway.** [Research](Design_Specification_REA_Evidence.md),
[concrete packet](Design_Specification_Ticket_Packet.md),
[verification and delivery status](Design_Specification_Implementation_Evidence.md).

## Authority and baseline

Product §§3, 7, 9–10, 13–15, 24–25, 27, 29.1, 30.1, 32–33 govern behaviour;
architecture §§6–11 and 15 govern technology. The [research brief](Design_Specification_REA_Prompt.md),
[workflow](Development_Workflow.md), [tracker](issue-tracker.md) and
[design system](../aarili-design-system.md) apply. No product or technology
baseline change is proposed. English startup follows the recorded owner decision
in the design system; this does not resolve the product's later persisted
Tamil-default preference. Software approval cannot approve a production catalogue,
compatibility rule, privacy notice, rate or tolerance.

Fresh fetch: HEAD and origin/development **154a456ca6d132857216371694e5de08a661155f**;
origin/main **0f784206eca5b0d0bede91ab2be62de9b5afc77c**. Prerequisites are merged,
not merely locally passing: 1.1.2 #97–#101, 1.2.1 #113/#114, 0.2.3 #16,
0.4.1 #51–#54 and media #57/#58. Grouped bookings, small services and repeat/
identity integrations through #138 are also integrated. Exact PR/CI checks and
limitations are in the implementation-status record. The initial preparation
inventory had no 1.3.1 ticket. Following explicit owner approval, A1/A2/B were
published as #146/#147/#148 with native dependency links; only A1 is selected.

**A2 selection update:** after PR #149 merged on 22 October 2026, the owner selected
#147. Its seven direct blocker merge commits are verified in the updated
development ancestry, now `3459ec4`. Implementation uses the same checkout on
`codex/design-specifications-a2`. The original preparation baseline above remains
dated evidence. The owner selected B #148 after the A2 merge; all six direct blockers are merged. The approved decisions below are unchanged.

The existing roadmap edit and untracked REA prompt predate this work. They are
preserved. Preparation used `codex/design-specification-packet`; approved A1 work
uses `codex/design-choices-a1` in the same checkout, based on the verified current
development head. No worktree or production activation is involved. A2/B require
their own selection after direct blockers merge.

## Existing seams and gaps

| Source | Reuse and actual extension |
| --- | --- |
| `contracts/service-catalogue.ts`, `core/service-catalogue.ts`, `db/service-catalogue-repository.ts` | Existing category/subcategory/service/piece/add-on identities, bilingual labels, exact definition/availability revisions and search. Add design-choice definitions scoped to these identities; never create a second garment catalogue. |
| `contracts/service-templates.ts`, `core/service-templates.ts`, `db/service-templates-repository.ts` | Exact service manifest, piece/form references, construction/decoration/method sections, task/checklist keys and requirement preview. Extend through a separately versioned design-question profile, with typed links to those exact revisions. Do not add body values to form definitions. |
| `core/orders.ts`, `order-pieces.ts`, `db/repositories/orders.ts` | Accepted snapshot/digest, wearer identity, native order/piece IDs, current scope and aggregate locking. Add specifications alongside the acceptance snapshot; never rewrite accepted intake or create a second order engine. |
| `core/repeat-orders.ts`, `contracts/orders.ts`, `repeat-order.tsx` | Existing repeat source/version/scope digests and reset/reconfirm policy. Add explicit specification selection/mapping through a new workflow version; strict existing v1 drafts remain readable and retain their present behaviour. |
| `core/small-services.ts`, `service-intake-addons.ts`, `service-changes.ts` | Service subjects, native source-piece links and exact line scope. No-body services keep their lightweight path. Design applicability cannot create fake wearer/piece IDs or force blouse fields onto fall/pico. |
| `core/drafts.ts`, `db/draft-repository.ts`, `draft-recovery.ts` | Durable server drafts, schema registry, exact-key recovery and promotion. Register bounded design workflows, preserving old schemas; do not build another autosave system. |
| `core/media.ts`, `db/repositories/media.ts`, `db/media-repository.ts`, `api/media-client.ts`, web `media-upload.ts`/`media-photo.ts` | Admission/completion/status/read, immutable primary/derivatives, media lock and processing. `media_reference` protects cleanup but has no concrete design/version/subject FK or rights semantics. Add these domain links, not another upload stack. |
| `auth/src/index.ts`, `core/wearers.ts`/`guardians.ts` | Owner transaction composition and current relationship/purpose checks. Normal media fallback is `deniedMediaPolicy`; branding is a separate shop-only exception. Customer private references require a new explicit domain policy, also used by the worker. |
| `core/customer-history.ts`, `db/customer-history-repository.ts`, `core/contact-merge.ts` | Current history/privacy generation and merge exclusions. Add authorised design-version events to the existing feed. Keep sensitive relinks unavailable; an alias or payer merge grants no media rights. |
| Migrations `0036`/`0040`, `core/media.ts`, `jobs/media.ts` | Narrow audited text redaction precedents and technical abandoned/orphan cleanup exist. A general retained-media erasure workflow and active `retention.sweep` implementation were not found. Do not describe technical orphan cleanup as fulfilled retention. |

Related designs/evidence: [templates](Service_Templates_Design.md),
[customer/wearer](Customer_Wearer_Design.md), [Quick Order](Quick_Order_Design.md),
[grouped bookings](Grouped_Bookings_Design.md), [small services](Small_Service_Design.md),
[repeat/history](Repeat_Order_History_Design.md),
[private uploads](Issue_57_Private_Uploads_Evidence.md),
[processing](Issue_58_Media_Processing_Evidence.md) and
[merge consumer inventory](Contact_Merge_Implementation_Evidence.md).

## Decisions for review

**D1 — One controlled vocabulary, exact source links (DES-01/03).** Extend the
existing catalogue with a design module's finite choice groups and immutable
choice revisions. Category/subcategory names and descriptions remain the existing
catalogue data. A design-question profile pins service manifest, service/type,
piece definition, measurement-form definition and relevant construction,
decoration, checklist and task keys. Every link includes the exact revision.
Configuration edits use the existing durable draft/publication conventions,
owner-proposal versus synthetic-fixture authority, bilingual vocabulary/search
and separate Available for New Orders history. No approved production rows ship.
Reference examples become available in B through the same rights-controlled
reference library; A1 can preview their absence honestly.

**D2 — Four independent dimensions (DES-02/04).** `neckType`, `neckDesign`,
`sleeveType` and `sleeveDesign` have separate stable field IDs and independent
choice revisions. A neckline shape is not piping; a sleeve construction is not
its embroidery or its length. A finite question profile can additionally ask
fit preference, front/back intended neckline depth, sleeve length, opening/
fastening, lining, decorative placement, finishing and restrictions. A field
may be choice, bounded plain text or intended-garment length; no executable
formula/expression language. A field's changed meaning requires a new identity.

| Synthetic fixture only | Separate values and applicability |
| --- | --- |
| Blouse / front-dart or princess-cut example | Neck type: round; neck design: piping; sleeve type: set-in; sleeve design: border decoration; intended sleeve length entered separately. Owner must approve names, Tamil labels, supported combinations and exact existing source links. |
| Salwar top / bottom / dupatta | Only the top's reviewed profile can ask neckline questions. Bottom/dupatta use their own profiles, fields and piece IDs. No assumption that every outfit has exactly three pieces. |
| Alteration | Ask the selected work's construction/restriction questions only. An instruction to shorten a hem is not a body measurement session. |
| Fall/pico small service | Explicit reviewed no-design/not-applicable state where supported, without wearer, measurements or pattern. No universal blouse form. |

Applicability is an explicit finite table keyed by exact garment/piece and
selected construction revisions: allowed choices, dependent questions and
reviewed not-applicable decisions/reasons. No wildcard means compatibility.
Unknown combinations can remain an incomplete draft; they cannot be saved as
confirmed instructions until reviewed. Selection may identify existing cost/
task/method requirement keys for later review; it never changes charges, task
execution, allocations or promises.

**D3 — Unknown, not applicable and none differ (DES-04, ORD-06).** Each answer
is `unknown`, `not-applicable` with supported rule/reason, or `selected`.
Selected none is an explicit eligible choice revision, not null/empty text.
Pending required decisions can be saved in a specification version as visibly
unresolved; saving is not production readiness. Incompatible confirmed values
are rejected. A changed construction cannot silently discard dependent answers:
show what becomes incompatible, retain it in the draft review, then require an
explicit supported replacement/removal before saving that version.

Lengths retain raw entered text and explicit inches/centimetres with exact
decimal/fraction representation. They are labelled **intended garment dimension**,
never a body value or calculated cutting parameter. Reuse existing exact input
utilities only where semantics match; do not use floating-point rounding to
invent precision. No default depth, fit, ease, tolerance or conversion-derived
authoritative measurement. Per-field precision is reviewed configuration.

**D4 — Availability is checked at new use (DES-03, AC-07).** Hide inactive
choices from new selectors. Recheck choice, parent, profile, manifest and exact
source eligibility transactionally on first save, replacement, repeat-as-new
and any explicit application to a new scope. An existing accepted garment keeps
its exact category/manifest context even if later disabled: do not demand a
category substitution or rewrite accepted intake merely to finish its design.
New answers still need eligible choices and a reviewed profile compatible with
that pinned context; otherwise show the configuration gap. Parent availability
blocks new orders/repeat, not authorised reading of that accepted context.
Historical read resolves pinned
labels/content, even if renamed or disabled. A revision of the *same* garment
may explicitly retain an unchanged pinned inactive answer, with a visible
historical-retained marker and reason; it cannot newly introduce that answer
to another field/piece. Replacing it requires an active supported choice or
an independently authorised library reactivation. Reactivation creates an
availability event; changing content requires a reviewed definition revision.
Repeat into a new garment always requires replacement/reactivation. Never
silently upgrade an old definition to today's similarly named choice.

**D5 — Draft versus saved version versus current selection (DES-04/05, ORD-12).**
A recoverable draft is editable. A saved version freezes exact order, wearer
and piece identities, accepted source digest, profile/definition revisions,
labels, answers, intent and reference associations, with server author/time,
schema version, predecessor, origin draft and digest. Initial save records its
source; every revision requires a reason. Saves are append-only, including
captions/annotations. Read by exact ID never substitutes latest definitions.

Saving a revision does not automatically change the currently used version.
The review surface has explicit **Save version and use for this scope** and
**Save version only** actions. The first atomically appends the version and a
current-selection event/CAS update; the second leaves current untouched. A
separate Use this saved version command also appends a reasoned selection event
under If-Match, current authority and impact checks. At most one current
selection per exact order/piece scope. Whole-garment instructions are an
explicit order scope; piece-specific instructions require a real native piece.
No wildcard latest link and no null-piece uniqueness loophole: relationally
distinguish order scope from piece scope with enforced unique keys/FKs.

No branch auto-merge: drafts bind their base saved version and selection ETag.
Concurrent saves from the same base have one winner; a stale branch is preserved
as a draft for explicit reconciliation, not silently made current. A committed
but unacknowledged save replays the same frozen request/result. Later typing
waits in memory until the outcome resolves. Cancel never edits a saved version;
discard/keep draft uses the existing lifecycle.

**D6 — Instruction intent is not customer approval (DES-05, §27).** An answer
or reference association is explicitly inspiration or confirmed instruction;
unresolved intent cannot masquerade as confirmed. Confirmation here means the
owner has recorded a definite instruction, with actor/time, not customer assent.
The UI states **Customer approval not recorded here**. Do not create approver,
signature, channel or approval timestamp. Future 1.4.3 binds an agreement to an
exact version; it cannot replace the version's content.

Before changing a current selection, re-read any existing governed agreement/
irreversible-work evidence. An approved-scope construction/decoration change
routes to 1.4.3; until that workflow exists it is blocked, with the prior current
and approved snapshots intact. The same restriction applies to restoring an
older saved version. Future imported/unsupported approval state fails closed.
This slice changes no accepted price, promise, progress, custody or allocation.

**D7 — Repeat is deliberate new work (DES-03/10, ORD-08).** A2 adds an explicit
choose-source-version → choose fields → map to current supported profile →
review candidate flow. Bind source specification/version/digest and current
availability/authority to repeat review. Generate fresh target specification/
draft IDs; no carried customer approvals, confirmed intent, commitments or
execution states. Copied text starts as inspiration/unconfirmed pending review.
Unavailable choices block only the selected reuse; owner can continue ordinary
intake without it. Until the new repeat adapter is implemented, omit design
copying explicitly. Existing v1 repeats must never accidentally carry new fields.
B permits explicitly selected shop-owned references only after rights checks;
private customer assets never auto-copy, including to the same wearer. A new
same-wearer attachment requires a separate reviewed association; different-wearer
private reuse and merge-based asset transfer are rejected.

## Private component references (D8–D12)

**D8 — All ORD-07 classes use the existing pipeline.** Images and raster
sketches: JPEG/PNG/single-frame WebP, 20 MiB/40 MP; documents and PDF sketches:
the supported bounded PDF profile, 25 MiB; voice notes: MP3, nonfragmented
single-track AAC-LC M4A, PCM/float WAV, 25 MiB. Reuse the exact validation limits
in `contracts/media.ts` and the profile exclusions in #58; valid unsupported
PDF/audio profiles receive safe re-export guidance. HEIC/SVG/Office files,
recording/transcription and a drawing editor are not implied. A file picker
must expose audio as well as images/PDF. B delivers every required class in one
reviewable outcome, rather than silently deferring voice notes.

**D9 — Domain ownership precedes upload.** A server-created design media subject
belongs either to a specific order/wearer/scope or a shop-owned reusable library
entry. Typed relational subtype rows have composite FKs, not a caller-supplied
unverified polymorphic UUID. Bind `media_asset.subject_id` to that subject through
a concrete design-asset ownership relation and a database validation guard;
other existing media purposes remain separately governed. The design subject
exists before admission, so upload policy can authorise it. Choose existing
`wearer-photo`/`private-fitting`, `order-document`, `voice-note` or `manual-pattern`
purpose according to real subject/type; no purpose can disguise a customer image
as a reusable shop asset. Do not repurpose the branding exception.

Admission, completion, status, processing and signed reads re-read current owner
membership, original subject/wearer, purpose permission, age and applicable
guardian private-photo consent. Unknown age/authority blocks sensitive-image
capture; a payer/family link does not grant it. Recheck again when associating
or making a specification current. Shop ownership needs recorded source and
reuse rights; unknown rights can remain private inspiration but cannot enter
the reusable library. No remote URL ingestion, scraping or public storage.

**D10 — Association is exact and contextual.** Multiple references can support
an exact field/component (neckline, sleeve, embellishment) or a stable instruction
ID on an exact specification version. Store media ID/accepted variant identity,
content digest, uploader/server date, source kind/source text, optional stated
source date (unknown allowed), rights basis/evidence and visibility class.
Personal source text, captions and annotation text live in redaction-capable
value rows. A source URL is inert bounded text only; it is never fetched or
loaded as an external image. Author/time are server facts, not editable claims.

Caption is bounded plain text. Useful annotation v1 is a list of labelled notes,
optionally targeting an image's normalized point or rectangle, a PDF page and
note, or an audio time range and note. Coordinates are integer ten-thousandths
of the accepted display image, anchored to its immutable digest/orientation;
audio offsets are integer milliseconds. Non-image notes remain usable without
a PDF renderer or codec. Page/duration bounds are checked only where trusted
metadata exists; otherwise store a plain note, not a falsely validated anchor.
Provide keyboard/numeric controls and a textual equivalent. Proposed technical
caps for approval: 20 references per scope/version, 20 annotations per reference,
caption 1,000 characters, note/source text 2,000 characters, revision reason
1,000 characters. These are resource bounds, not garment policies. Reject
overflow visibly; never truncate instructions. No rich HTML or full drawing editor.

**D11 — Replacement creates a complete successor.** Upload a new immutable
asset; pending/processing/rejected assets never become saved usable references.
Keep it as a recoverable draft candidate until ready. Commit successor spec,
new reference associations, caption/annotation values and explicit selection
event (if requested), audit, request result and necessary jobs atomically.
The predecessor still refers to its old asset/caption/annotations. Caption-only,
intent-only or annotation-only edits also create a successor; no association
UPDATE and no destructive replace command. Duplicate attach/replacement under
one operation returns one result. A new intentional association can reuse bytes
only where rights/scope allow it; enforce unique association IDs in the version.
Changing the asset invalidates old annotation geometry; require explicit review,
not blind coordinate transfer. Removal is absence from the successor with a
reason, never deletion from old history.

**D12 — Privacy can restrict historical access.** A saved snapshot records that
an association existed, not an eternal right to view it. Every history/thumbnail/
download/replay rechecks current access and privacy tombstones. An erased asset
shows a non-revealing tombstone; ordinary users cannot recover prior values.
Provide scoped `app_privacy`-only audited redaction functions for new personal
value rows using existing precedents. Reference digests after erasure identify
the former content but are not advertised as a digest of the redacted response.
Delete bytes only through the reviewed retained-media rights/retention workflow,
not `cleanupMedia` or orphan reconciliation. That general workflow is currently
absent and remains an explicit live-activation prerequisite; B must demonstrate
read denial/tombstones and handoff coverage without claiming backup erasure is
implemented. No public gallery, publishing endpoint or permission-transfer UI.
Minor/private-fitting assets cannot become shop examples or public images.

## Data, transaction and HTTP design (D13–D15)

**D13 — Relational history and sealed child sets.** Proposed names, not existing
tables: `design_choice`/`design_choice_revision`,
choice availability history, `design_question_profile_revision` and typed source/
compatibility links; `design_spec_scope`, `design_spec_version`, `design_spec_answer`,
`design_spec_selection_event` and current pointer; `design_media_subject` with
typed ownership subtypes, `design_reference_library_revision`,
`design_spec_reference`/`design_reference_value` and annotation child rows.
Keep provenance separate from redactable values. Allocate migration numbers only
when selected against updated development. Use the existing vocabulary, durable
draft, request/audit and media tables rather than duplicating them.

Every tenant table/child has non-null shop_id, shop-led keys/indexes/uniqueness,
tenant-composite FKs, ENABLE/FORCE RLS with matching read/write policies and
least runtime grants. Exact version/choice/profile/field, order/piece/wearer and
asset links are database constraints, not JSON-only checks. Bounded answer
content can be JSON, but referential identity cannot. Immutable parent and child
sets must be sealed by the same transaction: disallow late answer/reference/
annotation insertion after a version is saved, as well as UPDATE/DELETE.
Tie publication to exact promoted draft, actor, content, audit and result through
commit-time guards. Enforce eligible selection and previous/current consistency.

**D14 — One authorised request path.** Business functions remain framework-free
in `core`, repository interfaces in
`db/src/repositories`, implementations in `db`; thin Hono Node routes and typed
module clients. Owner composition injects membership-verified withShop context.
Queries include exact-version/history/profile/search; commands include definition
publication/availability, draft promotion/save, explicit selection and reference
association/revision. Search/private filters/cursors remain in POST bodies.
Existing opaque navigation IDs are allowed; personal labels, answers, asset keys,
signed URLs and query-cache content never enter URL state/browser storage/PWA cache.

**D15 — Atomic commands and recoverable migrations.** Use request key → existing
booking/order aggregate order → design scope →
identity/guardian authority → sorted catalogue/profile sources → sorted media
locks, consistent with the existing order/repeat graph. A1 config locks cannot
later acquire an order. The selected implementation must document the actual
lock graph, re-read membership/scope after locks and prove publish/disable,
permission-revocation, attachment/cleanup and concurrent selection races in PG.
Jobs carry IDs/epoch and re-read policies; reuse `media.process`, existing runner,
usage writer, restore quarantine and fenced processing. No parallel queue.

All commands bind actor/action/request hash and expected versions; key, change,
audit and jobs commit together. Replay rechecks current authority and returns
minimal IDs/version, not cached personal notes or signed links. Missing If-Match
428, stale 412, domain conflict 409, invalid input or changed-key payload 422
(`IDEMPOTENCY_MISMATCH`), inaccessible private object non-disclosing 404.
Do not turn an authorization failure into a partial private response.

Additive migrations, reviewed SQL and advisory-locked runner only. Back up before
non-disposable application. No seeded approved policy, bulk source rewrite or
destructive down SQL. Rollback disables new writers/UI with a schema-aware
compatible build, retains all versions/references/tombstones, and leaves private
pending assets for existing cleanup rules. Old application builds must not
reinterpret new draft schemas or reject required queue catalog entries.

## Owner surface and states (D16)

**D16 — Review the exact scope and change before use.** Operate mode, owner
recording a garment at the counter. Reuse Orders → exact
garment → Design specification, with explicit piece/order scope and wearer/code
context. Header shows **Current saved version**, **Editing draft based on vN**
and **Customer approval not recorded here**. No giant universal form or visual
silhouette that implies fit validation. A compact summary keeps the four
neck/sleeve dimensions visible, followed by applicable questions and component
references. History opens exact saved versions with author/time/reason/source.
Configuration stays in Services and templates → Design choices; no new shell.

Sequence: select scope → start/reopen draft → construction choices → dependent
details → reference intent/rights (B) → compare with base → save version and
explicitly choose whether to use it. The focal review is the exact change,
affected scope and current-version consequence. References load lazily; broken
historical thumbnails do not block text editing. Display safe download controls
for PDF/audio; no autoplay, inline arbitrary document execution or forced photos.

| State | Required visible behaviour |
| --- | --- |
| No specification / no eligible profile | Start draft or explain missing configuration; never infer none/approved. |
| Saving / saved draft / not saved / checking outcome | Existing IME-safe recovery; retain unacknowledged typing in page memory, freeze uncertain command and retry exact key. |
| Inactive/missing source | Old snapshot readable; new work requires explicit replacement/reactivation; no silent substitute. |
| Pending/processing/failed/quarantined file | Separate from ready; retry/reselect with safe guidance; retain old saved reference. |
| Expired signed read / unavailable media | Reauthorise then obtain a new short-lived capability; denied/erased stays unavailable. |
| 412 / 409 | Keep the authorised draft/intended edit for explicit comparison and review; do not auto-merge. |
| Permission lost / sign-out / shop or identity change | Clear rendered private content, draft values, query caches and late responses. Recovery requires fresh authority; a minimal operation locator must reveal no personal values. |
| Cancel / discard / revision saved only | Original saved/current version unchanged; explain which draft remains recoverable. |
| Agreement-impact block | Keep current/approved version; identify later governed change route without inventing approval. |

Use Current light/dark tokens, local Noto Sans/Noto Sans Tamil, shared Field/
Input/Button/Status/Dialog and incumbent navigation. English starts; explicit
Tamil preserves typed text. Configuration supplies bilingual labels, not machine
translation. Phone 360×800: one column and reachable primary action; tablet
820×1180: one pane portrait, contextual split landscape; desktop 1440×900:
editor plus compact current-version comparison. 44px controls, wrapping Tamil,
associated errors, first-invalid focus, focus restoration, non-colour status,
keyboard annotations and 320px reflow/enlargement. No sticky bar covers focus.

## Coverage and unresolved gates (D17–D18)

**D17 — Coverage stays requirement-specific.**

| Requirement/scenario | Proposed coverage and later boundary |
| --- | --- |
| DES-01 | A1 controlled choices/profile with existing category/form/task links; B adds rights-controlled reference examples. Production catalogue needs owner approval. |
| DES-02/04 | A1 question definitions; A2 independent garment-specific fields/values, exact saved versions and explicit selection. No body measurement or formulas. |
| DES-03 / AC-07 | A1 availability; A2 historical retention, fresh selection/repeat replacement/reactivation and races. |
| DES-05 / ORD-07 | A2 immutable text intent; B all four private asset classes, component links, captions, bounded annotations and history-preserving replacement. A alone is not full 1.3.1. |
| DES-10 / AC-53 | B private/reusable distinction, rights and guardian checks, read denial/tombstones; no publication, cross-wearer copying or sensitive relink. |
| AC-08 | No automatic-drafting implication; manual/external path remains available. Actual method/reference recording is 1.3.3; full AC-08 is open. |
| AC-40/55, TRU-01/03/06/07 | Durable recovery, current authority, forced RLS, exact-key retries, CAS conflicts, immutable children and history. |
| DES-06/07/08/09/11 | 1.4.3 owns customer approval/change-impact agreements; this slice preserves/blocks governed cases. |
| MEA, PAT, ORD-10 | 1.3.2 measurement sessions; 1.3.3 manual/external records; 1.3.4 job slips/PDFs. No closure claimed. |

**D18 — Software approval and live activation are separate.** Owner review must
approve the concrete ticket boundaries, the D1–D18 software
decisions (including inactive retention, explicit current selection, repeat
behaviour and annotation/resource bounds), then select one issue. Actual
production choice content, bilingual terminology/compatibility and precision,
rights/notice/retention policy, physical Android/Tamil/assistive-technology review,
restore drill and all product §32.2/33 pilot gates remain separate. Retained-media
erasure/backup/processor handling is an identified implementation gap, not solved
by a design document. Synthetic-only operation remains mandatory.
