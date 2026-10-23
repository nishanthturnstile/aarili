# Manual and external pattern references: independent design

23 October 2026. Roadmap **1.3.3**, PAT-01/03; AC-07/08 contributions.
**Owner approved MP-D01–12 and the A → B packet on 23 October 2026.**
Published [A #164](https://github.com/nishanthturnstile/aarili/issues/164) merged
through #166 into development `96b3e54`. The owner selected
[B #165](https://github.com/nishanthturnstile/aarili/issues/165) after all eight
blockers merged; [B implementation/evidence](Manual_Pattern_Outputs_Implementation_Evidence.md)
records its delivery. Approval covers this independent software design, not
production policy, privacy activation, cutting approval or full feature closure.
[Research](Manual_Pattern_REA_Evidence.md), [ticket packet](Manual_Pattern_Ticket_Packet.md),
[baseline and verification](Manual_Pattern_Implementation_Evidence.md).

## Authority and implementation baseline (before A)

Product §§3, 7, 9–10, 13–15, 24–25, 27, 29.1, 30.1, 32–33 govern behaviour;
architecture §§6–11/15 govern technology. Follow the [brief](Manual_Pattern_REA_Prompt.md),
[workflow](Development_Workflow.md), [tracker](issue-tracker.md) and
[design system](../aarili-design-system.md). No product/technology baseline change
or production configuration approval is proposed. The roadmap's future automated
availability category is represented as unavailable in Phase 1, without a
selectable automated method. This is consistent with PAT-01 and §29.1.

Latest fetched development is `c04020a01c909915cd43751e68ec48e0e2215ba8`.
Design #146–#148 and measurements #153–#155 are closed through merged PRs
#149/#150/#151 and #156/#161/#163. The technical prerequisites #16, #51–#54,
#57/#58 are merged. All 13 merge commits are ancestors of this preparation base.
These facts supersede dated in-progress headings in earlier designs; human
acceptance and privacy/recovery/pilot activation remain separate.

| Existing source seam | Reuse and missing work |
| --- | --- |
| `contracts/service-catalogue.ts`, `service-templates.ts`, corresponding core/repositories | Exact category/subcategory/service/type and native-piece definitions, accepted manifests and availability. No parallel garment catalogue or inferred pattern capability. |
| `contracts/design-specifications.ts`, `core/design-specifications.ts`, `db/design-specifications-repository.ts` | Immutable exact design versions, explicit scope selection and governed-work checks. Do not rewrite accepted intake or use a current profile revision as historical provenance. |
| `contracts/measurement-sessions.ts`, `core/measurement-sessions.ts`, `measurement-access.ts` | Wearer/session/version identities, exact form and garment/piece selection, source/context review, current relationship/guardian authority. A form definition is not a person's measurement version. |
| `contracts/media.ts`, `core/media.ts`, `jobs/media.ts`, `api/media-client.ts`, web `media-upload*` | `manual-pattern` purpose already exists, with private immutable keys and processing. This enum alone supplies no pattern record, ownership or exact-version route. |
| `core/design-media-policy.ts`, `measurement-media-policy.ts`, `measurement-fit*.ts`, migration `0048` | Concrete subject authorization, exact reference reads, original/derivative hashes and governed purge precedents. Their design/fitting subjects cannot be repurposed as pattern ownership. |
| `core/drafts.ts`, draft repository, recovery/controller and schema registry | Recoverable versioned server drafts, frozen retry and private replay. Register bounded pattern workflows; preserve older strict schemas. |
| `core/repeat-orders.ts`, `repeat-services.ts`, customer history and contact-merge/relink consumers | Deliberate source retrieval and privacy generation. Extend typed consumers; no implicit reference/review transfer and no payer-based wearer reassignment. |
| Existing privacy SQL/functions and purge handlers | Audited redaction, tombstones and processing fencing. Extend every new private store and association; the fitting purge is not already a general pattern purge or proof of approved retention. |

**Scope gap found in actual code:** current design and measurement target
readers accept custom orders only; measurement selection additionally requires
one exact form binding per scope. A must respect these supported boundaries.
Do not advertise service-order or multi-form input compatibility merely because
the catalogue can name such work. Existing no-pattern small services remain
usable. If pattern-bearing alterations or multi-form targets are needed for
1.3.3 acceptance, their concrete scope/input adapter and governed authority need
a separately reviewed ticket; A+B cannot claim that missing coverage is complete.

Related authority: [design specifications](Design_Specification_Design.md),
[measurement versions](Measurement_Versions_Design.md),
[fitting implementation](Measurement_Fit_Implementation_Evidence.md),
[repeat/history](Repeat_Order_History_Design.md),
[uploads](Issue_57_Private_Uploads_Evidence.md),
[processing](Issue_58_Media_Processing_Evidence.md).

## Proposed decisions

**MP-D01 — Capability is explicit configuration (PAT-01, AC-07/08).** Attach a
finite manual/external capability revision to the existing exact service/type
and applicable piece definition. Each path is `available`, `unavailable` or
`not-recorded`, with owner, time and reason. No automatic inheritance from an
orderable type, measurement form, visual silhouette or design question profile.
No production capabilities are seeded. Synthetic fixtures are conspicuously
synthetic. An unconfigured path has a setup action, not an invented supported
method. New selection requires a currently available type and path. Configuration
changes append revisions and never rewrite old garment selections. Historical
inactive types remain readable; new/repeat use needs an explicit supported
replacement or authorized reactivation. Unsupported mappings remain blocked.
An approved no-pattern service retains its existing not-required decision;
it does not need a dummy pattern, wearer or measurement session.

**MP-D02 — Five separate facts.** Show orderability, available preparation path,
reference recorded, reference reviewed and production/cutting release separately.
The only selectable methods are `manual` and `external`. A method can be recorded
while its reference is pending; the UI must say so. A physical locator describes
where to find something, not receipt, custody, stock, vendor work acceptance or
payment. Reference review does not create any approval or cutting release.
No release action or `readyToCut` flag is introduced.

**MP-D03 — One garment/native-piece scope.** A reference root belongs to one
shop and exact order/piece; wearer is taken from authorized order scope where
applicable. A booking/customer/contact is not a substitute owner. Use native
piece IDs and accepted service/manifest revisions; do not manufacture a piece
from its label. Define whole-garment versus piece applicability using existing
manifest rules, without implicitly applying one reference to every piece.
Initially support existing exact custom garment/piece contexts. Unsupported
service scope is explained and blocked; existing fall/pico work stays fileless
and pattern-free. No service requirement is invented by this slice.

**MP-D04 — Reference contents and honest unknowns (PAT-03).** Save a reference
with at least one physical locator, shop-owned sketch or accepted uploaded output.
Ticket A supplies the physical path; B supplies images/PDFs. Method-only pending
preparation is not falsely labelled a saved reference. Source kind is
`shop-created`, `customer-provided`, `external-supplier`, `other` or `unknown`;
record source/author/supplier text and source date where known. Link an existing
vendor identity only where authorized, without creating vendor transactions.
Keep the supplier's revision label separate from Aarili's immutable version ID
and sequence. Unknown source/date/revision remains explicit, never a fake default.
Record descriptive notes and rights as private fulfilment, shop-owned,
licensed-reuse or unknown. Unknown reuse rights cannot become library rights.
Physical-only saving needs no upload, printer, CAD viewer or body photograph.

**MP-D05 — Exact input provenance.** For design and measurement inputs, store a
tagged state: `known` with the exact authorized immutable version ID(s),
`unknown` with an explanation, or `not-applicable` with an existing approved
applicability reference and reason. Unknown is allowed for archival/reference
recording; it is not permission to bypass a required input. Known measurement
bindings include wearer/session, exact form, source order/piece where relevant
and any recorded reuse lineage. If a garment uses several applicable input
versions, each would need an exact scope binding; the current single-form target
contract must not be broadened by inference. Unsupported multi-form targets
remain blocked pending a reviewed adapter. Never resolve a missing input as
“latest,” backfill old text as measured values, or force a measurement onto an
approved service that does not require one. Validate scope, shop and wearer at
save, review, selection and read, not just while rendering options.

**MP-D06 — Saved history and current selection.** Drafts remain editable through
the established ETag workflow. Saving creates an immutable reference version
with root/predecessor, method, contents, exact input facts, actor/time, reason
and origin draft. Revising locator/source/input declarations or replacing a
file appends another version. It never edits the earlier version or its keys.
Selection is a separate attributable event pointing to one exact version and
the reviewed target scope; save/revision does not silently select a successor.
Both root-head revision and scope selection require expected versions. Retain
the old selected ID and its selection history even after an explicit replacement.
Show “Recorded version” and “Selected reference” separately.

**MP-D07 — Bounded reference review.** Each immutable version starts
`unreviewed`. Append `reviewed`, `changes-required` or `withdrawn` events; a
later correction records a new event, never edits the prior reviewer/time.
Events contain authenticated reviewer, server time, exact reference version,
input/context digest, reason, checklist findings and evidence text; B may add
authorized private evidence references. `reviewed` requires an explicit
acknowledgement of known/unknown inputs and outstanding assumptions. It means
the reference and its recorded limitations were examined. It does not mean
expert rule approval, customer design approval, validated fit, calibrated print
or permission to cut. Revisions do not inherit a review.

Selection can be `reference-only` when inputs remain unknown, mismatched or
required facts are unresolved; label it **“Reference only — input review needed.”**
`inputs-reviewed` requires authorized exact known inputs matching the target's
current selections, or supported not-applicable decisions, plus a current
reference review bound to that comparison. This is a reference-use assessment,
not production release. Changes-required/withdrawn references remain readable
in history but cannot be newly selected. Recording a pending/unknown reference
does not require inventing measurements or granting broader access.

**MP-D08 — Scale, units and formula assumptions.** Keep source-declared units,
source-declared print scale, free-text formula/allowance assumptions and any
check observations separate from validated facts. Units may be unknown; external
claims are labelled “Supplier-stated,” never app-confirmed. No expression is
parsed or evaluated. Phase 1 provides no scale/formula approval operation.
Show **“Print scale unverified”**, **“Formula assumptions unverified / not supplied”**
and **“Reference review does not authorize cutting”** on detail, review and
selection, including history/reuse. For physical-only references show
**“No print output linked; scale not assessed”** rather than a green pass.
For a sketch show that it is not a calibrated cutting output. Preserve
failed/unknown observations and documentary evidence. A 1:1 filename, PDF page
box, embedded unit, thumbnail or successful upload cannot clear a warning.
PAT-13 tolerances and later rule/print validation are not adopted here.

**MP-D09 — Input changes and consequential work.** Derive `input-review-needed`
from the saved bindings versus current exact design/measurement selections.
Keep original bindings and reviews intact; display differences and require a
fresh review/explicit selection decision. An acknowledgement cannot manufacture
compatibility: retain reference-only use or create a reasoned new version with
truthful provenance. Recheck the digest transactionally on submit. Reuse the
existing governed-work barrier and extend its consumer inventory: imported or
unknown approval, irreversible cutting, external dispatch or affected downstream
work blocks consequential replacement when its governed correction workflow is
unavailable. Keep read/history and ordinary archival recording available where
authorized. Do not build 1.4.3 change agreements or the production task engine.

**MP-D10 — Private file integration.** B registers a concrete pattern subject
root/order/piece with composite ownership links. Reuse `manual-pattern` admission,
completion, processing, status and immutable storage, composing the same domain
policy in web/API and worker. Accepted JPEG/PNG/WebP sketches and the existing
bounded PDF profile are the supported output classes. Preserve current technical
limits; no native CAD/SVG/ZIP import, formula parser, remote URL fetch or new file
decoder. Do not turn an existing design/fitting asset into a pattern by guessing
its purpose. Explicitly authorized same-subject linkage must pass the concrete
consumer's policy; otherwise require a new permitted upload.

Pending/processing/quarantined/failed/expired/deleted assets cannot be saved as
ready references. A replacement failure preserves the earlier selected version.
Ready images use existing sanitized display/thumbnail variants. PDFs remain
private untrusted downloads, with attachment disposition; no embedded PDF/HTML
execution. Image re-encoding/resizing can change dimensions: the image is a
reference sketch, never a scale-preserving pattern output. Store accepted
asset identity and hashes. Sign bytes only through an authorized exact
reference route, rechecking current source/subject rights and readiness.
Generic signing, a cached URL or an asset ID alone cannot bypass these checks.

**MP-D11 — Privacy from the first ticket.** A fileless locator, source name,
assumption note and review reason can be personal data. Use existing current
wearer/relationship/purpose checks; measurement-derived content requires
measurement authority and minors' current guardian authority. Photos require
the separate applicable private-media/photo permission. Unknown age, declined
authority, erasure or revoked permission fails closed. A household/payer link
does not grant another wearer's rights. Do not create new legal notice or
production consent defaults; current synthetic-only activation stays enforced.

Separate immutable provenance from redactable private values. Extend audited
privacy functions, generation invalidation, tombstones, drafts, replay snapshots,
history/merge/relink consumers and later B media associations. Redact every copy;
ordinary runtime cannot rewrite saved history. B adds fenced idempotent purge
intents/receipts for all owned objects and derivatives, with restore-epoch and
outbound guards. A valid old signed link cannot be recalled from a recipient;
stop new access immediately and preserve existing short expiry semantics.
Approved retention, processor/backup erasure and recovery activation remain gates;
technical orphan cleanup is not a retention policy.

**MP-D12 — Repeat and rights.** B extends the current versioned repeat source
adapter, preserving old drafts. Old references can appear as authorized context
only. New order acceptance does not auto-select them or copy review, scale/fit
validity, receipt, approval or custody. Selecting for a new order creates a new
target association, pins exact source lineage and requires current type/path,
input, wearer and rights review. Private reuse initially requires the same wearer
and existing authorization; cross-wearer private reuse remains blocked. Shop-owned
or licensed references may be independently selected only under their recorded
rights and current target authority. Payer merge never promotes private content
to a shop library. Erased/unavailable sources remain tombstones, not empty copies.

## Transaction and storage contract

Proposed module files are `contracts/manual-patterns.ts`, `core/manual-patterns.ts`,
`db/manual-patterns-repository.ts`, a repository interface under `db/repositories`,
thin `api/manual-patterns.ts` and a typed client. These are proposed additions,
not existing commands. No new package/runtime boundary is needed. Core stays
framework/vendor-free; Node Hono validates, authorizes and maps results.

Use ordinary current-state rows plus append-only revisions/reviews/selections,
not a new event-sourcing system. Proposed relations: capability head/revision;
pattern reference root/version; redactable private values; scope selection head
and immutable selection/review records; private draft/result retention. B adds
typed media ownership/reference/evidence and purge records. Allocate actual
migration numbers only after the selected issue starts from updated development.

Every tenant row has non-null `shop_id`, shop-led indexes/uniqueness, composite
FKs to scope, predecessor, inputs, assets and actor/audit where applicable,
ENABLE/FORCE RLS and matching read/write policies. Missing context denies. Runtime
uses `app_user` and membership-verified transaction-local `withShop()` throughout.
Maintain established aggregate/identity/guardian/reference/media lock ordering
with sorted multi-source IDs; do not introduce inverse locks in jobs or erasure.

Every mutation binds idempotency to actor/action/request hash. Commit key,
business rows, audit, protected replay and applicable jobs atomically; exact
lost-response retry replays only after current private authority checks. Changed
payload returns 422. Editable heads/drafts/selections require If-Match: 428
missing, 412 stale, 409 domain conflict, 422 invalid command. Concurrent changes
must not silently merge locators, measurements, reviews or selections.
Review digests include target/input selection revisions, availability and private
generation; stale context needs a new comparison before command admission.

Use additive reviewed SQL with the existing advisory-locked runner. No backfill
of fabricated provenance or approvals. Once pattern private drafts/results exist,
the minimum compatible reader must retain their policy and redaction consumers;
rollback to a pre-consumer reader is incompatible. Roll forward with schema and
tombstones retained, restore quarantine active, no destructive downgrade.

## Owner surface and acceptance

Extend the accepted garment/native-piece detail with a **Pattern preparation**
section. Reuse the established shell, form/field/status/button components,
design tokens and self-hosted Tamil fonts. The owner sees scope and type first,
then available method, selected reference, exact inputs, review and warnings.
Use a short physical-locator path; optional source/version detail progressively
discloses unknowns. B adds an optional upload path without changing the fileless
journey. History exposes exact versions and selection events with attributable
reasons; it does not default to the newest version or a success-coloured review.

Phone uses one stacked flow and full-width review; tablet may pair context and
form; desktop may use a context column. Preserve the same facts at 360×800,
tablet portrait/landscape and desktop. Warnings stay adjacent to the reference
and remain visible before save/review/select. Long Tamil/source/locator text
wraps; controls have persistent labels, field errors, keyboard/focus handling
and screen-reader descriptions. User notes are never auto-translated. English
and Tamil labels belong in existing message catalogues; fluent Tamil acceptance
is human evidence, not inferred from automated rendering.

Provide loading/empty, path unconfigured/unavailable, reference pending,
unreviewed/changes-required, unavailable/erased source, mismatch, unsaved,
save-failed, lost-response retry, stale comparison and access-ended states.
B adds preparation/upload/processing/quarantine/exhausted-retry states. Retain
form input on recoverable failure; uncertain commands preserve their exact key,
payload and preconditions. Access loss clears private memory and late responses;
no private values in URLs, logs, browser persistence or service-worker caches.

Acceptance is enumerated in the packet. PAT-01 requires capability availability
and inactive historical reading; PAT-03 requires all physical/sketch/upload paths,
source/version/review and visible assumptions. A alone cannot close 1.3.3.
No PAT-02/04–17 implementation, automated drafting, seam presets, generation,
calculated sheet, fabric estimation, calibration/tiling/true-scale export, cutting
approval, task engine, public gallery or 1.3.4 job slip is included.
