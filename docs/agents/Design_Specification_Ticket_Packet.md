# Design specifications: concrete ticket packet

22 October 2026. **Software packet approved; A1 and A2 merged; owner selected
[B #148](https://github.com/nishanthturnstile/aarili/issues/148), implementation and verification underway.** Roadmap 1.3.1;
[design](Design_Specification_Design.md), [research](Design_Specification_REA_Evidence.md),
[baseline/checks](Design_Specification_Implementation_Evidence.md).

## Approval and sequence

The suggested A/B split is refined into **A1 → A2 → B**. Configuration review is
a useful complete outcome before garment editing; separating it keeps each
implementation context focused. A1 alone is not a garment-specification feature.
A2 alone is not full 1.3.1: ORD-07's required asset classes and DES-05/10's media
behaviour remain in B. Approved publication created
[A1 #146](https://github.com/nishanthturnstile/aarili/issues/146),
[A2 #147](https://github.com/nishanthturnstile/aarili/issues/147) and
[B #148](https://github.com/nishanthturnstile/aarili/issues/148). A1 #146 merged in
PR #149. The owner then selected A2 #147; all seven direct blockers are merged.
B was selected after A2 / PR #150 merged at 10:13:32 UTC. All six B direct blockers are merged. This approval
does not authorise merge, deployment, production policy or live data.

| Published ticket | Reviewable owner outcome | Native direct dependencies |
| --- | --- | --- |
| **A1 / 1.3.1a — Maintain controlled design choices and preview garment-specific questions** | Owner publishes/revises bilingual choices and their exact garment/piece profile, previews resulting questions and controls new-order availability. | #97 catalogue, #98 forms, #99 manifests, #53 vocabulary, #55 durable drafts, #16 command history. All currently merged. |
| **A2 / 1.3.1b — Save, select and revise a garment's exact specification** | Owner reopens an accepted garment/piece, saves a versioned specification, chooses which version is current, and deliberately reviews reuse into new work. | #146 A1, #114 accepted order, #118 native pieces, #120 grouped acceptance, #134 repeat, #138 identity/merge boundary, #56 draft recovery. All merged and rechecked on selection. |
| **B / 1.3.1c — Attach private component references and preserve replacement history** | Owner adds image/document/sketch/voice references with source/rights/intent, captions and bounded annotations; replacement creates a successor while old permitted history remains exact. | #147 A2, #57 private uploads, #58 processing, #79 adult wearer, #80 guardian, #138 sensitive-relink exclusions. Existing prerequisites merged; A2 must merge first. |

Transitive infrastructure requirements include 0.2.3 and 0.4.1/0.4.3. The current
native issue edges and merged ancestry were inspected and the published edges
were read back after creation. Re-read issue bodies/comments/native blockers
and CI on selection. Start each selected issue in this same checkout from updated
origin/development, after the previous direct blocker merges. Preserve unrelated
edits. No worktree or automatic continuation across merges.

The owner approved the concrete software design: exact source/profile model;
four independent neck/sleeve dimensions; inactive historical retention only in
unchanged same-scope revisions; explicit current-version selection; reset intent/
approval during repeat; rights/private-media subject model; bounded annotations
and resource caps. Production garment choices, compatibility content, Tamil
wording, precision, consent/rights and retention periods are separate approvals.

## Common contract for every ticket

Sources: product ORD-07, DES-01/02/03/04/05/10 as allocated below; ORD-02/05/06/
08/12/13, CUS-02/06/07, TRU-01/03/04/05/06/07/08/12/13, USE-01/02/03/04/08/09;
product §§3, 7, 9–10, 13–15, 24–25, 27, 29.1, 30.1, 32–33. Architecture
§§6.1–6.4, 7, 8.1–8.5, 9.1–9.3, 10.1–10.2, 11.2/11.4/11.5 and 15.

Reuse core/repository boundaries, Hono Node handlers, strict draft/command schemas,
typed module clients and existing server-draft controller. Browser state is memory
only; clear query caches/late private results on sign-out/shop or identity change.
Every operation uses membership-verified withShop and current subject authority.
Every tenant child/reference table needs non-null shop_id, shop-led keys/indexes,
composite FKs, ENABLE/FORCE RLS and least app_user grants. No business Server
Actions, parallel catalogue/upload/order/audit engine, new infrastructure or
future-only dependency. Fetch ctx7 library→docs only when syntax/setup/library
behaviour is actually needed, respecting the three-command budget per question.

Exact actor/action/request hash, expected versions, audit, durable draft result
and jobs commit atomically. Same request replays once after current authority
checks; changed payload/actor/action is 422. Missing If-Match 428; stale 412;
domain conflict 409; validation 422; private missing/denied non-disclosing 404.
Never make replay a private-content or signed-link cache. Database immutability
covers UPDATE/DELETE **and late child INSERT**. Implement concurrency/failure
proof, not just UI disabling.

No measurement session, pattern generation, pricing/change-agreement engine,
customer portal, AI, automated message, gallery publishing or job-slip/PDF output.
No implicit accepted-price/promise/task/progress/custody/payment changes. No live
activation. Customer approval is 1.4.3, measurement sessions 1.3.2, manual/external
path recording 1.3.3, job slips 1.3.4. AC-08 remains partial.

## A1 / 1.3.1a

**Title:** Maintain controlled design choices and preview garment-specific questions.

**Requirements:** DES-01/02/03/04 configuration; ORD-05/06 configuration; AC-07's
library half, AC-08's no-automatic-pattern implication. Design D1–D4, D13–D18.

**Scope:** Services and templates gains Design choices/profile editing and
history. Reuse existing category/subcategory/service/piece identities, exact
forms/manifests/checklist/task keys, bilingual vocabulary and publication/
availability conventions. Publish finite choice groups and question profiles
with exact compatibility/applicability, descriptions and pending reference-example
section. Preview expected questions and unresolved/not-applicable/none states
for synthetic blouse, salwar pieces, alteration and no-design small service.
Drafts can be incomplete; publication validates complete supported links/rules.
No wearer answers or saved garment specifications yet.

**Acceptance cases (planned test IDs):**

1. **DS-A1-01 / DES-01:** Create, save, reload, revise and publish a bilingual
   profile tied to existing category/service/piece and exact form/manifest/
   construction/decoration/task/checklist revisions. No duplicate garment
   catalogue, fabricated approved content or live configuration activation.
2. **DS-A1-02 / DES-02:** Four independent neck/sleeve type/design groups; sleeve
   length/depth remain separately typed intended dimensions. A shape selection
   never becomes a decorative answer. Unknown, supported not-applicable and
   explicit none are visibly distinct. No guessed default/tolerance/formula.
3. **DS-A1-03 / DES-04:** The blouse's applicable questions differ from salwar
   top/bottom/dupatta and no-body fall/pico. Construction changes disclose
   incompatible dependent answers in preview; no silent question loss or
   unsupported compatibility. Reject duplicate keys, wrong kinds, cycles in
   dependency rules, missing/foreign references and changed-meaning reuse.
4. **DS-A1-04 / DES-03:** Disable/re-enable with an attributable reason and
   immutable availability event; new selection excludes inactive parents/choices/
   sources, exact history preserves prior bilingual labels and definition links.
   Concurrent definition/availability/profile publication produces one reviewed
   current result or a surfaced conflict, never lost updates.
5. **DS-A1-05 / TRU-01, AC-55:** Real app_user PG evidence for missing/foreign
   context, composite FK failures, forced policies, runtime update/delete/late
   insert denial, stale/missing ETags, exact retry and mismatch, failure after
   append/pointer/audit/draft-result writes with full rollback.
6. **DS-A1-06 / USE:** English/Tamil, both themes, three sizes and tablet landscape,
   keyboard/focus/IME/axe/reflow, saved/not-saved/unknown-outcome/cancel recovery;
   Tamil/Tanglish/English lookup uses current search-key infrastructure.

**Migration/recovery:** Add choice/profile/typed-source/compatibility history and
current pointers using the incumbent publication/draft provenance guards. Allocate
SQL filename at selection. No seeded approved catalogue, order backfill or edits
to historical manifests. Reviewed additive migration under advisory lock; back up
before non-disposable use. Compatible rollback disables new writers and retains
schema/history. Demonstrate upgrade over populated existing catalogue/forms/
templates/orders and no incompatible old-reader changes.

**Isolation/history review:** Every profile/choice dependency tenant-composite;
exact old labels and source revisions remain readable after disable/rename.
Personal customer examples must not enter global vocabulary. No asset access is
granted by the placeholder example section.

**Verification:** Actual `pnpm verify:fast`, `pnpm test:integration`, `pnpm test:ui`;
focused new DS-A1 PG/property/browser tests while iterating. Regress catalogue,
forms, manifests, presentation and repeat-source eligibility. Real PG proves
invariants; mocks cannot. Follow common manual packet and delivery evidence below.

## A2 / 1.3.1b

**Title:** Save, select and revise a garment's exact specification.

**Requirements:** DES-02/03/04; DES-05 text/intent/version foundations; ORD-02/06/
08/12/13; AC-07, AC-40/55 contributions; AC-08 partial. Design D2–D7, D13–D18.

**Scope:** Existing order detail exposes explicit garment/piece scope, current
saved version, recoverable draft and exact history. Save partial but honest
specifications with four independent dimensions and all applicable question
types, immutable definitions/labels and author/time/reason. Save-only differs
from save-and-use; selecting an older version is reasoned and governed. Add a
strict new repeat-design adapter with explicit selected fields, current profile
mapping and fresh target identity. Existing v1 intake/repeat readers stay valid.
Add authorised design events to existing customer/wearer history without leaking
new private content through counts/cursors. Media controls remain explicitly
unavailable until B; no claim to complete ORD-07 or 1.3.1.

**Acceptance cases:**

1. **DS-A2-01 / DES-04:** Save/reload a blouse with distinct neck type/design and
   sleeve type/design plus applicable fit/depth/length/opening/lining/decoration/
   placement/finishing/restrictions. No authoritative body measurements. Unresolved
   values remain unresolved; explicit none and not-applicable retain their source.
2. **DS-A2-02 / ORD-13:** Exact garment and native piece scope, correct wearer;
   multi-piece salwar fields cannot attach to another piece/order/shop. Whole
   garment scope is explicit. No duplicate current row through null scope keys.
   No-body services retain their existing no-design path; fit-relevant unsupported
   service scopes report unavailable instead of inventing piece/wearer IDs.
3. **DS-A2-03 / DES-03, AC-07:** Old snapshot stays byte/semantically exact after
   label/profile changes and inactive choices. Same-scope unchanged inactive
   retention requires explicit historical-retained review; newly selected/repeated
   work requires supported replacement or authorised reactivation. Atomic
   publication/disable-versus-save races cannot admit an unreviewed new use.
   A disabled original category/manifest remains the accepted garment's exact
   context; finishing it must not rewrite intake or invent a replacement category.
   New design choices/profile compatibility are still checked explicitly.
4. **DS-A2-04 / DES-05:** Version v2 preserves v1 and all immutable children.
   Save-only does not advance current; save-and-use does so atomically; selecting
   an older version appends a selection event. Concurrent revisions/selection
   yield one CAS winner; cancellation/retry never modifies the predecessor.
5. **DS-A2-05 / §27:** Inspiration and owner-confirmed instruction are separate.
   Neither creates customer approval/person/time/signature. Existing governed
   approved/irreversible scope blocks effective changes until 1.4.3; no current,
   agreed price/date/progress/allocation rewrite. Unsupported approval state
   fails closed, including when reselecting an older saved version.
6. **DS-A2-06 / ORD-08:** Explicit exact-version/field reuse into new supported
   scope maps current choices, fresh IDs and reset intent/approval/commitment.
   Inactive/foreign/stale sources block selected reuse; ordinary intake remains
   possible without it. Existing custom/service/grouped repeat regressions and
   sensitive merge/relink exclusions hold. No private media copying.
7. **DS-A2-07 / TRU/USE:** PG forced RLS/FKs/append-only/late-child guards;
   authority revocation versus save, stale current versus saved base, actor/hash
   mismatch, concurrent first save, exact unknown-outcome replay and injected
   rollback after each business/audit/result write. Authorised history projection
   retains original identities and invalidates stale private cursors.
8. **DS-A2-08 / USE:** Three-size bilingual/theme/keyboard/axe/IME matrix,
   conflict comparison, source-unavailable/permission-loss/cancel/reload recovery,
   no URL/storage/private-cache leakage and no image-loading prerequisite.

**Migration/recovery:** Add exact-scope/version/answer/selection history and
typed definition links. Personal values/reasons separate from durable provenance;
provide narrowly audited app_privacy redaction/tombstone seams for new text.
No rewrite of accepted snapshots, old drafts, original promises or code counters.
Save version + optional current selection + audit + promoted result commit
together. Upgrade populated custom/grouped/service/repeat fixtures. Additive
schema-aware rollback retains versions and new draft schema awareness.

**Isolation/history review:** No assumed approval inheritance or wearer relink.
Composite order/piece/wearer/profile/field FKs; current access applies to exact
history and replay as well as editing. Audit/replay store minimal IDs/digests;
personal text is redactable, including draft-derived text.

**Verification:** `pnpm verify:fast`, `pnpm test:integration`, `pnpm test:ui`;
new DS-A2 unit/property/real-PG/browser cases plus existing Quick Order,
grouped/service/repeat/identity/history/draft regressions. Test migrations and
real concurrency/rollback as above. No UI-only immutability claims.

## B / 1.3.1c

**Title:** Attach private component references and preserve replacement history.

**Requirements:** ORD-07; DES-01 examples, DES-05/10; TRU-01/03/04/05/06/07/08/13;
AC-07/40/53/55 contributions; AC-08 remains partial. Design D8–D18.

**Scope:** Deliver every required asset class through existing private admission/
processing/status/read clients: supported images, PDF documents/sketches, raster
sketches and MP3/M4A/WAV voice notes. Bind typed domain subjects and current
purpose/guardian/rights policy at web and worker composition. Attach multiple
ready references to exact component/instruction/spec version with source,
uploader/date, inspiration/confirmed intent, caption and bounded annotation v1.
Provide shop-owned reusable examples and distinct private customer references.
Replacing asset/caption/annotation/intent creates a successor; preserve old
associations and explicit selection semantics. No drawing editor, transcription,
public gallery or arbitrary URL fetch. Existing technical validation profiles and
limits apply; proposed annotation/resource caps require software approval.

**Acceptance cases:**

1. **DS-B-01 / ORD-07:** Each supported asset class can be selected, admitted,
   processed, attached and reopened. A sketch is PNG/JPEG/WebP or supported PDF,
   not an unimplemented new asset engine. Audio input is exposed; unsupported
   HEIC/SVG/PDF/audio profiles fail with honest guidance. Never count a pending
   or quarantined file as ready. Preserve #58 parser/codec limitations.
2. **DS-B-02 / DES-05:** Two component references with distinct captions and
   intent, exact specification version and stable instruction/field target.
   Source/uploader/server time and rights basis retained; unknown source date
   stays unknown. Caption/annotation text is plain and bounded; keyboard/text
   annotation works without a full image/PDF/audio preview.
3. **DS-B-03 / DES-05:** Replace asset, caption, note, geometry or intent → v2;
   v1 still resolves its exact old permitted reference/caption/annotation. Old
   geometry is not silently applied to different bytes. Remove in successor
   retains predecessor. Duplicate attach/replacement/retry creates one result;
   stale concurrent replacements surface conflict, no late child insert.
4. **DS-B-04 / DES-10:** Reusable shop examples require source/rights evidence;
   private customer/fitting/minor assets cannot be reclassified or copied via
   repeat, alias, booking, payer change or merge. New same-wearer association is
   separately authorised; different-wearer private reuse denied. Confirmed
   instruction never fabricates customer approval. Existing approved snapshots
   and 1.4.3 effective-change block survive media revisions.
5. **DS-B-05 / AC-53:** Before image admission/storage, identify actual wearer,
   age and current recorded authority. A non-guardian payer is insufficient.
   Recheck purpose/private-photo guardian consent at completion, worker final
   acceptance, association and signed read. Race revocation/age/identity change
   against those operations. Unknown authority and wrong-shop media IDs fail
   closed. Worker uses the same policy, not an environment consent flag.
6. **DS-B-06 / TRU-07:** Authorise row and association before signing; immutable
   shop-prefixed keys never enter product UI. Expired read requests reauthorise;
   revoked/erased access cannot get a fresh link. Test wrong shop/wearer/version,
   pending/quarantined/expired/deleted states, safe downloads and no public key/
   source-URL ingestion. Previously issued capabilities remain bounded by their
   existing short expiry; do not promise remote deletion of downloaded copies.
7. **DS-B-07 / TRU-08:** Scoped app_privacy-only audited redaction and tombstones
   hide all new personal captions/notes/history/replay paths; ordinary runtime
   cannot recover them. Enumerate retained bytes/derivatives/drafts/exports/
   backups/processor handoff. General retained-media purge/retention is absent
   today: document its explicit live gate and fail closed on erased subjects;
   never mislabel orphan cleanup as retention completion.
8. **DS-B-08 / AC-40/55:** Real PG/S3/job failures: reference insertion versus
   cleanup lock, rejected content, partial write, expired lease, worker retry,
   wrong epoch/restore quarantine, permission loss at final acceptance, duplicate
   queue delivery, transaction rollback and unknown response. No dangling current
   reference or second accepted media set/usage effect. Old saved refs survive.
9. **DS-B-09 / USE:** English/Tamil and phone/tablet/desktop, both themes,
   keyboard/axe/IME/320px reflow, source/rights/intent/conflict/failure feedback,
   lazy thumbnails and core editing with every historical image unavailable.
   Test existing upload/image preprocessing and intake/repeat/identity regressions.

**Migration/recovery:** Typed design media subjects/ownership, library revisions,
exact spec-reference and annotation/value child relations. Reuse media_asset,
media_reference locks, media.process, accepted variants and restore-aware runner.
Prevent late children after parent sealing and cross-shop/subject references.
Back up and apply reviewed additive SQL under the migration lock; no object
overwrite or accepted-byte rewrite. Rollback to a compatible writer-disabled
build retains all accepted history/tombstones, queue/catalog compatibility and
existing technical staging/orphan cleanup. No destructive down or new retention
schedule. Missing retained-media rights/purge integration remains explicit.

**Isolation/history review:** A signed URL is a bounded capability, not a saved
reference. History retains association provenance while current policy can deny
the bytes. No reusable-library path bypasses wearer consent; separate shop subject
does not legalise customer content. No claim to full privacy or 1.4.3 completion.

**Verification:** `pnpm verify` (already includes lint/Knip/types/unit/negative/
OpenAPI/PDF/integration/build/smoke/artifact gates), `pnpm test:ui`; focused
DS-B PG/S3/worker/browser cases and existing media failure/retry tests. No immediate
repeat of covered commands after successful full verification without changed
inputs. Installed Chrome codec/physical device checks remain distinct.

## Review packet, evidence and completion

For each selected ticket write fresh requirement-by-requirement results in
`Design_Specification_Implementation_Evidence.md`, with actual revision/dirty
files, command/exit/count/duration/logs and hosted CI when publication is
authorised. Planned test IDs above do not assert files/commands already exist.
Use existing package scripts, inspect installed Turbo docs before changes and
preserve pinned tooling. No installation/native portability rerun is automatic
unless dependencies/exports/runtime packaging change or the selected issue
requires it. Feature PRs require fast/audit CI; promotion retains full CI/browser
gates. Record real human review separately from emulation.

Manual packet must be prepared before acceptance: existing synthetic local/test
host startup command and exact route, private sign-in method without credentials,
named synthetic shop/order/pieces, device/browser/language and these steps:

1. A1: publish a four-dimension profile, inspect blouse versus no-body preview,
   disable a choice, reopen exact old revision (**DS-A1-01–04**).
2. A2: save v1, revise v2 without using it, deliberately select v2, inspect v1,
   exercise stale-tab conflict and repeat with inactive choice (**DS-A2-01–06**).
3. B: attach each permitted asset class, distinguish inspiration from instruction,
   replace a caption/asset/annotation, inspect v1, test denied/quarantined and
   unavailable-media recovery (**DS-B-01–09**). No approval or real minor photo.
4. Return `acceptance ID — pass/fail — observation`; request fluent Tamil,
   screen-reader and physical Android findings only where human judgment is
   needed. Link automation and provide review-host teardown. No hosted tunnel.

Record observed implementation start/review-ready/first-tryable/PR/merge times
and separate coding/verification/CI/wait/rework in [Delivery_Measurements.md](Delivery_Measurements.md)
for each selected delivery. The implementation evidence contains dated A1 results
and the A2 review instructions and verification ledger. B is now selected and in verification;
software approval, publication, selection, owner merge and live activation are distinct.
