# Measurement sessions, immutable versions and garment selection

22 October 2026; status updated 23 October. Roadmap **1.3.2**. **Software packet
approved. Tickets [#153](https://github.com/nishanthturnstile/aarili/issues/153),
[#154](https://github.com/nishanthturnstile/aarili/issues/154),
[#155](https://github.com/nishanthturnstile/aarili/issues/155) published; selected A
owner-merged in [PR #156](https://github.com/nishanthturnstile/aarili/pull/156)
after required CI passed. B merged in [PR #161](https://github.com/nishanthturnstile/aarili/pull/161)
on 23 October. [B implementation evidence](Measurement_History_Implementation_Evidence.md)
records the final full verification and 243-case browser pass, retained failures
and human/pilot qualifications. C remains unselected; its B prerequisite is merged.** [Research](Measurement_Versions_REA_Evidence.md),
[concrete tickets](Measurement_Versions_Ticket_Packet.md),
[baseline and validation](Measurement_Versions_Implementation_Evidence.md).

## Authority and scope

Product §§3, 7, 9–10, 13–15, 24–25, 27, 29.1, 30.1, 32–33 govern behaviour;
architecture §§6–11/15 govern technology. The [prompt](Measurement_Versions_REA_Prompt.md),
[development workflow](Development_Workflow.md), [tracker](issue-tracker.md) and
[design system](../aarili-design-system.md) apply. This document proposes software
behaviour, not production form, precision, tolerance, privacy or pilot approval.
No product/technology baseline amendment is proposed.

### Selected A implementation boundary

The approved issues are #153/#154/#155; A and B are merged. C remains unselected.
The following records the original A boundary, extended by B's reviewed
lineage/reuse contract and minimum-reader decision. A uses a
new immutable first-version event ID as the session's first saved version.
Corrections and predecessor/lineage extension remain B. An observation may be
saved independently of an order. Its first explicit selection is limited to one
compatible, unselected garment/native-piece scope; the database also enforces
one first use per version. Reusing an already selected version remains blocked
until B supplies the contextual review and history contract. A never copies old
values into a new observation.

The current writer records `synthetic-review` form-use evidence only. Review
requires each zero decision, the exact existing form precision and an explicit
validation explanation; there is no production policy seed. Bounded finite
minimum/maximum/cross-field rules and warning-reason policy can be recorded and
enforced. The initial review UI starts with explicitly unconfigured plausibility
rules and no thresholds; it presents any supplied approved rules. All source,
date, unit and measurer fields start unknown. Exact display does not mutate entry.

**Minimum compatible reader/recovery decision:** once migration 0045 contains
measurement drafts or values, retain a measurement-aware A-or-later reader and
its current wearer/guardian/private replay checks. Rolling back to the pre-A
generic draft reader is incompatible and forbidden. Roll forward with compatible
code, retain additive schema/provenance, restore erasure tombstones before
reopening admission, and keep the existing restore controls. This is a software
compatibility constraint, not approval for a populated/live rollout or evidence
that backup-retention/restore activation gates have closed.

Updated `development` to **2aa1b1246213845f1dcaa55d7505051219aedecd**, then created
`codex/1.3.2-measurement-versions-design` in the owner's existing checkout.
The pre-existing roadmap brief and untracked prompt are preserved. No worktree.
The initial switch and pull were blocked by that roadmap edit; a deliberate
outside-Git backup/patch preservation allowed a fast-forward and exact restoration.
Current issue/merge evidence, including the completed 1.3.1 prerequisites and
remaining activation gates, is recorded in the validation document.

The committed outcome is wearer-specific base-value entry and review, immutable
history and deliberate order/piece selection. MEA-08/09 trial and verified-fit
records remain 1.8.1; MEA-10 contributes only permitted manual retrieval here.
Manual/external patterns remain 1.3.3, job slips/PDFs 1.3.4. No generated patterns,
ease rules, AI/body inference, customer portal or automated messages. AC-06 covers
measurement versions now; AC-07/08 contributions do not close pattern workflows.

## Existing source compatibility

Rooted source inspection covered tracked source/contracts/migrations and these
named documents; ordinary rg exclusions for ignored/generated/vendor/binary files
apply. It is not an exhaustive forensic audit of every file. Codebase Memory's
project inventory had no matching checkout; no graphify graph exists here. Local
source is the basis below; no index was installed or built.

**Authenticated research update:** after the owner privately signed in, REA
observed new/save/reopen, cancellation, edit/compare and explicit per-item version
selection in Nool. An edit changed 36.25 to 36.75 while the label remained V2;
adding another adult label produced V3 in the same garment history. Source-order
inspection did not prove preserved structured values. See MV-R05–18 in the
[research ledger](Measurement_Versions_REA_Evidence.md). These observations
reinforce stable wearer/session identities, immutable corrections and explicit
selection here; they supply no authority for Aarili precision/privacy policies.

| Existing seam | Reuse / actual change |
| --- | --- |
| `contracts/measurement-forms.ts`, `core/measurement-forms.ts`, `db/measurement-forms-repository.ts`, migration `0026_measurement_forms.sql` | Reuse exact form entry, revision, definition and content hash; group/field UUIDs, stable keys, meaning, order, English/Tamil labels/hints, `base-length`, allowed/default units, required status, `precision.unit/increment/review`, optional method illustration, service/piece references. This is the only form editor. |
| `contracts/service-templates.ts`, `core/service-templates.ts` | Existing exact manifest and piece/form bindings determine applicable entry. `measurement` prerequisite/checklist metadata is not a personal measurement version. |
| `contracts/orders.ts`, `core/orders.ts`, `core/order-pieces.ts`, order repositories | Reuse accepted order snapshot/digest and native piece IDs. Quick Order has `instructions`, not structured confirmed measurements. Preserve this text; do not parse/backfill it into a version. Add selection alongside accepted snapshots. |
| `contracts/small-services.ts`, `core/small-services.ts`, `service-changes.ts` | Preserve property/intake narrative and reviewed not-required services. A service subject or hem instruction is not a body session. Required alteration forms use their exact supported wearer/piece/line scope; unsupported bindings fail visibly. |
| `core/drafts.ts`, `db/draft-repository.ts`, browser draft recovery | Reuse versioned server drafts, schema registry, frozen retry/preconditions, CAS and uncertainty recovery. Add a named measurement workflow and privacy consumer, not a second save mechanism. |
| `contracts/wearers.ts`, `core/wearers.ts`, `core/guardians.ts`, `core/wearer-policy.ts` | Reuse independent person/wearer/contact, relationship, age and current purpose evidence. Guardian scopes include measurement/private-photo; a verified scope and matching eligible purpose event are distinct. Existing notice/verification is synthetic-only. |
| `core/design-specifications.ts`, `contracts/design-specifications.ts`, migrations `0043`/`0044` | Reuse explicit scope/selection conventions and current design references for context. Design intended-garment length answers are not body values and must not be imported as them. Saving/selecting measurements does not change a design version or approval. |
| `core/repeat-orders.ts`, `core/customer-history.ts`, corresponding repositories and typed clients | Extend reviewed source retrieval and history with authorised measurement events. Existing repeat v1 does not carry measurement versions; a new versioned adapter must opt into explicit review. No new history engine. |
| `core/contact-merge.ts` and identity/relink consumers | Existing preview lists measurements/private media as unavailable. Add concrete measurement associations and hard relink blocks in A, before storing values. Payer merge/alias cannot reassign a wearer, grant purpose or copy measurements. |
| `core/media.ts`, `core/design-media-policy.ts`, `jobs/media.ts`, migration `0044` | Reuse upload/status/processing/private signed-read infrastructure. Existing design ownership cannot stand in for a measurement-session subject. C adds typed ownership/policy composition; no duplicate media stack. |
| Privacy functions in migrations `0036`/`0040`/`0044` | Reuse audited maintenance-only redaction patterns, tombstones and generation invalidation. Extend coverage to every new value/draft/result/media link; general retention/object/backup purge is not proven by existing access redaction. |

Read with [forms evidence](Measurement_Forms_Implementation_Evidence.md),
[template design](Service_Templates_Design.md), [wearer design](Customer_Wearer_Design.md),
[privacy draft](Customer_Wearer_Privacy_Draft.md),
[design specifications](Design_Specification_Design.md),
[repeat/history design](Repeat_Order_History_Design.md) and their implementation
evidence. Their original pending-review statements are dated history; fresh PR
state wins for dependency readiness, not for production activation.

## Domain decisions for review

**MV-D01 — Three separate records.** A durable draft is editable/incomplete.
A saved measurement session version is immutable and attributable. An order or
native piece selects an exact saved version through a separate append-only
selection event. A newer version never rewrites another selection. A session
can exist before an order, anchored to an authorised wearer/contact interaction;
the initial A workflow may begin inside a compatible garment detail.

**MV-D02 — Person and source first.** Select the wearer explicitly; show the
contact/payer separately. Record the session's shop-local measurement date,
measurer (explicit person/recorded identity, independent of saving actor), source
kind `body`, `sample-garment`, `customer-provided` or `other`, and documented
method/context. `other` needs an explanation. A sample can link an existing
authorised source garment/property reference without asserting custody receipt.
Unknown source date/measurer belongs in an incomplete draft, never a fabricated
today/owner value. Server `recordedAt`/actor are distinct from stated date/measurer.

If sources differ by field, record a `mixed` session with an explicit source
record for every populated field. Do not label sample/customer-supplied numbers
as body measurements. Initial UI offers a single source and an explicit mixed
mode; source changes with entered values require review of affected fields.
Each source record retains its stated source date and measurer/provider; the
session's compilation date cannot stand in for older source observations. A
missing required source attribution remains unresolved in the draft.
Measurer's personal display/source text is redactable; durable actor/identity
references follow the incumbent provenance rules. No mandatory external worker
login, phone, DOB or body photo.

**MV-D03 — Freeze field meaning.** Every version pins the exact form definition,
revision, content hash and ordered field snapshot, plus exact service/piece and
manifest bindings. Values key by field UUID within that form revision, never
label or array position. Rename/reorder preserves historical labels and identity;
new meaning/key requires a new identity. Removed fields stay readable in old
versions. Optional method illustrations remain exact authorised references and
can be unavailable without hiding textual method hints or entered values.

A form's `owner-proposal` or `configurationEligible` status is not permission for
authoritative production entry. A adds a bounded immutable **measurement-use
approval** record pinning the form definition and entry/validation policy, with
reviewer/time/effective state and separate withdrawal. Reuse the current Settings
review pattern; do not add a form editor. Synthetic fixtures remain visibly
synthetic. Until actual §32 approval is recorded, production measurement use
fails closed. Revoking availability/approval does not delete history.

## Exact entry, units and precision

**MV-D04 — Original entry is authoritative source data.** Propose a field value
with `state` (missing, entered, or supported not-applicable), `rawText`, explicit
`unit`, exact decimal string `numericText` where representable, and exact reduced
integer-string numerator/positive-denominator. Keep these strings through API,
core and DB; no JSON number or JavaScript Number for measurement arithmetic.
PostgreSQL stores `numeric` without a rounding typmod, plus raw text/unit and
exact integer components; constraints verify their agreement. This retains the
architecture's numeric-in-entered-unit representation. Arithmetic/parsing is a
framework-free module inside core, not a new package or guessed formula engine.

The proposed input grammar accepts explicit base-10 whole/decimal values and
proper/mixed fractions such as `1/2`, `12 1/4`; optional UI shortcuts may insert
quarter fractions without rounding. Preserve the exact original characters;
normalised parsing is a separate representation. Negative values, exponent
notation, mixed unit text, ranges, zero denominators, unsupported separators and
ambiguous numbers get a precise error; no guessed fix. Negative base length is
a type incompatibility, not a bodily plausibility threshold. Zero stays distinct
from blank and is subject to the field's reviewed rule, not silently rejected or
invented. Unicode fraction/localised separator support must be explicitly tested
and approved before accepted input grammar expands. These are proposals, not
authority to silently reinterpret historical text.

| Example (synthetic arithmetic only) | Exact meaning / behaviour |
| --- | --- |
| `12 1/4` in | `49/4` in; numeric `12.25`; raw remains `12 1/4`. Exact cm is `6223/200` = `31.115`. |
| `2.54` cm | `127/50` cm = exactly `1` in. Display switching does not replace the original cm entry. |
| `1` cm | Exactly `50/127` in. Show that exact fraction until an approved decimal-display rule exists; a rounded decimal must be labelled approximate. |
| Blank; `0` | Missing versus explicitly entered zero; no coercion between them. |
| `1/3` in | Exact rational can be parsed in a draft but has no finite decimal numeric representation. Under the current finite-decimal form precision model it cannot pass authoritative save. Keep raw input with explanation; never round to `0.33` or a quarter. Supporting such authoritative values needs an explicitly approved representation/precision decision. |

Conversion uses exact rational **1 in = 127/50 cm** and its inverse. Do not
convert through integer fabric millimetres; their storage rule serves a different
domain. Visible conversion is derived display only. Display-unit toggle says
“Display in …” and leaves raw/numeric/unit unchanged. Changing an **entry unit**
with populated input is a separate deliberate action: show old entry, exact
conversion and resulting precision eligibility before confirming. Preserve the
original as provenance; after save this action creates a revision. Never merely
relabel a number, or use a rounded display value as new source input.

**MV-D05 — Precision is not tolerance.** Evaluate each field against the exact
approved `precision.unit`/decimal `increment`: convert the rational exactly into
that precision unit and test exact integer divisibility by the increment. A
quarter-inch precision does not imply rounding every cm or inch field to quarters.
An incompatible increment produces an explainable save error while preserving
the input; no automatic quantisation. Different increments/units are permitted
only by reviewed field definitions. Display decimal places, rounding mode,
fraction presentation, zero admissibility and unusual-value override semantics
remain named owner decisions in the ticket packet. Until display rounding is
approved, show the exact rational, avoiding an invented number of places.

**MV-D06 — Validation and applicability.** Draft validation preserves bounded
incomplete/malformed strings. Command validation requires authorised source,
form/approval, explicit units, exact parse, approved precision and required
applicable values. Optional missing fields remain missing. Current form contracts
have form-level not-required and field required/optional, but no conditional
field not-applicable rule. Do not introduce per-field N/A as a bypass: initially
reject it for required fields; add only after an approved exact applicability
definition is available. Not-required forms retain the lightweight workflow.

Plausibility and cross-field rules are finite, versioned approved definitions
pinned by the measurement-use approval. Their review must explicitly distinguish
error, warning, reasoned override and not-configured. No vendor ranges or universal
body limits. A policy with unreviewed required rules blocks authoritative use;
synthetic fixtures may explicitly exercise reviewed test rules labelled synthetic.
Warnings name the affected field/context and concern with neutral wording, permit
unusual valid values under approved override rules, and never suggest guessed
measurements. Record warning acknowledgement/rule version in redactable evidence.

**MV-D07 — Base/target/derived stay distinct.** This workflow records entered
base lengths and source context only. Read-only adjacent design targets, chosen
ease and future calculations need explicit labels and exact source links. They
cannot populate base fields by label match. Derived outputs show unavailable
unless an independently approved formula/reference/version exists; this slice
does not create one. No claims of verified fit or production/cutting approval.

## Versions, selection and integration

**MV-D08 — Attributable history.** Session identity belongs to one wearer and
exact form context. Saving a fresh observation creates a new session/version;
correcting that observation appends a version within its lineage with previous
ID and reason. A new date/body session is not falsely labelled a typo correction.
Every version records server actor/time and stated source/date/measurer. Forked
corrections require expected lineage head; 412 compares differences without merge.
Show paginated immutable version detail/diff and what garments explicitly use
each version. No runtime UPDATE/DELETE to saved content/provenance.

**MV-D09 — Review before use.** Review identifies wearer, garment/piece/type,
exact form/version, date/age, source garment if recorded, source/method, measurer,
incomplete/erased/unavailable state and compatibility. Age is elapsed context,
not an expiry judgement. Selection requires a deliberate suitability confirmation
bound to the source version, target scope/revision, authority and review digest;
no default latest, automatic expiry or copied confirmation. Show “Saved version”
and “Used by this garment” separately. Saving a session alone does not select it.

An initial save→review→select can be a short contiguous user journey but keeps
the two command results clear. If selection fails, the saved version remains
available for a freshly authorised retry; never show it as already used. A uses
this initial selection for an unselected compatible target; B adds existing
version reuse, deliberate replacement and repeat integration.

**MV-D10 — Exact compatibility.** A target must be the same wearer, an existing
order/native piece/service scope in the current shop, and have a supported exact
form/service/piece binding. Pin accepted manifest context and current scope
version. Whole-garment and piece selections cannot conflict or implicitly cover
each other; resolved manifest applicability determines which scope owns a field.
Each composed piece is selected independently; no Apply to all family members.
A booking is a navigation/grouping context, never a shared measurement owner.

Historical reading uses saved definitions, including retired ones. New/repeat
use requires current availability/approval and exact compatibility. A changed
meaning, replacement field/form or retired service requires an explicitly reviewed
mapping/replacement/reactivation; no label-only migration. Initial implementation
supports exact identity compatibility only; unsupported mapping remains blocked
with ordinary new entry available. Keeping an old order's existing selection
does not require retroactive replacement merely because a form was retired.

**MV-D11 — Respect downstream consequences (DES-11).** Creating a new measurement
version never changes a garment. First selection and replacement are distinct.
For B, permit a replacement only in the supported booked/pre-work boundary, after
re-reading order/scope and every implemented dependent reference under locks and
reviewing an explicit owner statement about physical cutting/dispatch. A statement
is evidence of what was reported, not a system-verified physical fact. Unknown,
imported or in-progress/irreversible-work state blocks replacement. Cancellation
and unsupported/different wearer changes block selection.

Measurement change supersedes **no approval automatically**. If a recorded size
band/price basis would change, price approval requires its governed review; an
unknown relevant commercial effect cannot be treated as none. Current code must
return a clear unsupported-impact conflict where it cannot prove eligibility.
Once patterns/cutting exist, unused outputs must become stale and affected cutting
held; already-cut work needs an agreed correction route. These are later consumer
contracts, not engines built here. Preserve exact prior design/measurement
references, price, dates, work, custody and prior selections on every denial.

**MV-D12 — Repeat/history/identity.** B adds a versioned repeat review carrying
source IDs and explicit new target suitability evidence, not a source approval.
New target IDs and order commitments follow the existing intake engine. Existing
repeat schemas remain readable without implicit measurement copying. Source
garment context can be shown only if separately authorised; absence is labelled,
not fabricated. History uses the existing body-based query, authorises before
filtering/pagination, and exposes minimal events; opening values requires current
measurement permission. No measurement values in global search snippets.

A registers measurement dependencies in merge/relink guards. Contact merges may
only retain their already-approved contact attribution semantics; measurement
wearer/original references stay unchanged. Wearer relinking with measurement
records is blocked until an explicit reviewed domain policy exists. Duplicate
phones, names, family labels or payer changes never merge measurement identities.

## Consent, privacy and private fit assets

**MV-D13 — Recheck current permission everywhere.** Owner-only access still needs
membership plus the selected wearer's relationship/service authority. Adult service
permission cannot be inferred from payer identity; optional private-media consent
is separate. Unknown age blocks sensitive measurement recording until reviewed.
For a minor, require current verified guardian authority covering measurement and
an eligible measurement-purpose grant, matching wearer/guardian/notice evidence.
Order authority alone and private-photo consent alone do not suffice. Check
before any sensitive draft is persisted, not just final save; repeat at reload,
value/history reads, save, selection and replay. No new checkbox can bypass the
existing evidence module. Current synthetic notice/verification cannot authorise
real records. Serialise against withdrawal/age/relationship changes and erasure.

On access loss clear business caches, fields, signed capabilities and pending
results; do not surface a comparison containing inaccessible values. On ordinary
network/save failure preserve typed values in the open page with honest unsaved
status. Memory-only cache clears on sign-out/shop switch; no values or search
terms in URLs, browser storage, service-worker caches, analytics, logs or traces.
Errors identify safe field keys, not the submitted values or raw request bodies.

**MV-D14 — Audited privacy from A.** Separate provenance (version existed,
actor/time, exact form/order references) from raw/numeric values, personal source/
measurer text, fit notes and personal correction/override explanations. Narrow
`app_privacy` functions redact those values, all durable draft payloads and
recoverable draft/result copies, add rights-request-linked audit/tombstones,
advance privacy/draft generations and invalidate history cursors. Do not leave
personal values in idempotency responses; prefer IDs/version only and authorise
before replay. Content digests/fingerprints need privacy classification; do not
expose low-entropy value hashes in search, diagnostics or erased responses.

Erased versions remain attributable tombstones but are unavailable for reuse,
even through old selection/history/repeat/draft endpoints. Erasure serialises
with save/select/correction and must prevent post-erasure resurrection. Track
related exports, originals, derivatives, backup tombstone replay and processors.
Use approved retention periods only. Existing object/backup purge and general
retention activation gaps remain live-data blockers, not completed by redaction.
Synthetic A still needs real PostgreSQL redaction/rollback/race proof.

**MV-D15 — Optional private fit assets, ticket C.** Useful private text notes
are in A and never require an image. C introduces typed session/wearer ownership
and exact version attachments using existing private media and immutable
shop-prefixed keys. Keep fit photos outside design inspiration and reusable shop
libraries. Recheck separate private-photo/optional-media authority at admission,
completion, worker processing, association and every signed read; bind exact asset
and accepted variant/digest. Never publish private fitting or minor images,
including via generic media, gallery, repeat, share or merge consumers.

A measurement version's references are immutable; attachment/replacement creates
a new attributable version/reference history. Reuse across versions is an
explicit same-wearer authorised association; different-wearer transfer is blocked.
Processing failure/quarantine leaves text work usable. Do not copy the design
policy unchanged: its order/library subject and purposes differ. Compose a
measurement policy with incumbent media policies in web and worker. Deny general
signing that bypasses exact measurement/version ownership. C must provide
measurement-owned erasure/retention handoff including retained objects; no claim
that existing orphan cleanup removes retained personal assets.

## Proposed storage and commands

Names are proposals; allocate actual migration numbers at implementation start
(current last migration is `0044`). No SQL/schema is created by this packet.

| Relation | Purpose and integrity |
| --- | --- |
| `measurement_use_approval` plus withdrawal events | Exact form/precision/finite validation policy, reviewer/time and synthetic versus approved authority; no new editor. References the existing form definition. |
| `measurement_session` | Stable wearer identity and exact form context; lineage head/CAS for correction, never a cross-wearer latest pointer. |
| `measurement_version` | Immutable ID/sequence/previous ID, form snapshot references, source-date/actor provenance, origin draft and audit IDs. Same-session predecessor and uniqueness are DB-enforced. |
| `measurement_value` / version personal-context row | Per-field exact numeric/raw/unit/rational/state/source; source/measurer/fit/reason text separately redactable. Same-shop/version/field identity and state consistency enforced. |
| `measurement_scope` / `measurement_selection` | Typed order/native-piece or supported service scope, versioned current pointer and append-only chosen version/review/reason/actor/time history. Composite wearer/scope FKs and DB checks prevent foreign/wrong-wearer selection. |
| Measurement draft private values / privacy tombstones | Existing durable workflow plus explicit private draft/result coverage and rights-request association. No sensitive data in generic audit/job/replay payloads. |
| C: typed measurement media subject/version references | Session/wearer ownership, exact version and media/variant linkage, immutable reference history and redaction-capable captions. |

Every tenant row has non-null `shop_id`, shop-led keys/indexes/uniqueness, composite
FKs and ENABLE/FORCE RLS with matching read/write policies. Runtime is `app_user`.
Add database history guards rejecting ordinary UPDATE/DELETE, content/value
mismatch and direct insert without matching draft/audit/idempotency provenance;
the only content-erasure exception is the existing audited maintenance role.
RLS alone does not establish wearer permission. Repository interfaces live at the
existing DB interface seam; implementations receive the caller's transaction.

Request flow: typed browser client → Node Hono validation/authorisation →
framework-free core policies → transaction-bound repositories via membership-
verified `withShop()` → atomic business mutation/audit/idempotency/real jobs.
No Next imports in API/core, business Server Actions, browser core/DB imports,
vendor SDK in core, new package, queue or service. Add no artificial notification
job for a local save. Future jobs carry IDs and recheck current authority/state.

Proposed private body-based reads: measurement context/list/search/history/detail
and target review; mutation operations: create/resume draft, save initial session,
append correction, explicitly select version. Reuse existing draft paths and
ETag conventions; publish actual OpenAPI/client names with the selected ticket.
No personal query in URLs; opaque route identifiers alone are permissible.

Editable draft and selection/lineage preconditions are distinct. Missing required
If-Match → **428**, stale → **412**, domain/compatibility/impact conflict → **409**,
invalid input or changed idempotent payload → **422**, inaccessible IDs → safe
**404**. Same actor/action/hash replays the original minimal result after current
permission checks, before rejecting already-consumed original preconditions.
Frozen request/key/preconditions survive uncertain responses; changed typing
waits in page memory until resolution. Durable origin-draft/version and
selection-operation uniqueness prevent duplicate effects after key expiry.

Follow incumbent lock classes: command/draft → sorted booking/order aggregates
→ sorted customer/wearer/guardian authority → catalogue/form/use-approval barrier
→ measurement session/scope → media where applicable. The design-media barrier
from `0044` can precede aggregates; use its existing entry convention when
composing C, never acquire it late. Discover full aggregate classes before
locking; re-read membership/scope under locks. Resolve exact ordering against
actual auth composition at implementation and prove save/select/form withdrawal,
guardian revocation, contact merge and privacy races in PostgreSQL. Do not claim
this proposed ordering is a tested implementation.

## Owner interface and recovery

An Operate extension to the incumbent garment/wearer detail, not a new dashboard.
Use Current light/dark, self-hosted Noto Sans/Tamil, shared Base UI controls,
semantic tokens, 44px targets and the existing responsive shell. English startup
and explicit Tamil switching preserve input; future Tamil-default preference
remains the documented baseline tension, not silently resolved here. Planning
used Impeccable's Operate guidance; no PRODUCT.md/design-system replacement.

1. Open a garment's Measurements section or an authorised wearer session. Show
   wearer, native piece and form/service separately. Not-required work says so;
   unresolved/unsupported configuration explains the missing decision.
2. Start a session with date, measurer and source/method. Show saved draft state
   and applicable guardian authority before sensitive values can be saved.
3. Render exact bilingual groups/fields with persistent entry unit, required/
   optional hint, precision and separate converted display. Use a text input that
   supports fraction characters and whitespace; a decimal-only keypad cannot be
   the only entry route. Offer accessible fraction shortcuts, never forced values.
4. Review original inputs, source/age/context, exact form and any approved warnings.
   Save immutable version; success identifies the saved version without claiming
   selection. Explicitly review suitability and select for the named scope.
5. B: choose historical version, compare source values/units and changed fields,
   record correction or deliberate reuse/reselection. Old orders show their exact
   selected version, even when another one is newer. Show unsupported downstream
   impact before any selection write.

Phone: one group/task at a time with reachable save/review actions and visible
wearer/unit context. Tablet portrait remains one pane; landscape/desktop may pair
entry with context/history. Avoid dense compare tables on phone; stack original
and proposed values per field. Text/Tamil labels wrap without hiding unit/version.
Use keyboard-accessible history and comparison, associated errors, focused first
invalid field/feedback and polite status updates. Language/theme/display-unit
changes cannot clear or reinterpret the draft. No body-image illustration copied
from competitors; method hints can remain text-only.

Required states: loading; no approved form; no saved sessions; missing consent;
incomplete draft; saving/saved/not-saved; ordinary network failure retaining typed
input; lost-response resolving/retry; source unavailable/erased; stale conflict
with authorised comparison; cancelled edit; consent/age loss with memory clear;
unsupported impact; C upload/processing/quarantine/read failure. A saved version
with failed selection has a separate persistent status and explicit retry.
No running measurement review route exists in this preparation. Each implemented
ticket must supply a synthetic review host and manual packet before acceptance.

## Migration, recovery and requirement ownership

Expand through reviewed SQL and advisory-lock runner. Back up before applying to
a non-disposable DB. Do not backfill unknown historical measurements, raw notes,
units, dates, measurers or approvals. Preserve accepted snapshots and all existing
design/measurement-form versions. Register new draft/history/identity/privacy
consumers and every tenant table in isolation checks. Test populated upgrade and
migration reapplication. Roll back compatible application code while retaining
new immutable records; never destructive down-migrate or permit old clients to
misread new selected state. Document any minimum reader version before rollout.

Restore uses existing epoch/quarantine/kill-switch controls and reapplies subject
tombstones before exposing measurements or running jobs. Erasure invalidates
pending drafts and replay/detail/history reads. C queues actual purge work
atomically under existing restore safeguards; retained objects and backups need
explicit evidence before live activation. No synthetic validation permits live data.

| Requirement / scenario | Design decisions / delivery |
| --- | --- |
| MEA-01 | D03/D06, exact existing forms and approval; A. |
| MEA-02 | D04/D05, exact grammar/storage/conversion/precision; A. |
| MEA-03 / CUS-02 | D01/D02/D10/D13, independent wearer/source/date/measurer; A. |
| MEA-04 / AC-06 | D01/D08/D09; initial immutable save/selection A, correction/history/reselection B. |
| MEA-05 | D07, base versus target/derived separation; A; later formula capabilities excluded. |
| MEA-06 | D05/D06 and approved policy; A, revised-value regression B. |
| MEA-07 / ORD-08 | D09/D10/D12, explicit contextual reuse and repeat B; no universal expiry/latest. |
| MEA-11 | Private values/text D13/D14 in A; private image ownership/access D15 in C. |
| CUS-03/05/06/07, AC-02 | D10/D12/D13; A guards, B integrated retrieval/history. |
| TRU-01/03/05/06/07/08/10/13, AC-38/40/52/53/55/56 | D13–D15, storage/transaction/recovery; acceptance from first ticket, C extends media. |
| USE-01/02/03/08/09 | Responsive bilingual, accessible entry/recovery states and per-ticket browser evidence. |
| DES-11 / partial AC-07/08 | D11 safe impact boundary; no closure of later approval/pattern/cutting workflows. |

The [packet](Measurement_Versions_Ticket_Packet.md) contains concrete owner decisions
and acceptance IDs. The [evidence record](Measurement_Versions_Implementation_Evidence.md)
distinguishes design coverage from tests not yet possible without implementation.
