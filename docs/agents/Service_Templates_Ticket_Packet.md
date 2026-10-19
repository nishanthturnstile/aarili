# Services, templates and Simple mode: approved ticket packet

18 October 2026. Parent slice **1.1.2**. The owner said **“approved and proceed”**
after reviewing this concrete A–E packet and the proposed A selection. Published
issues: [A #97](https://github.com/nishanthturnstile/aarili/issues/97),
[B #98](https://github.com/nishanthturnstile/aarili/issues/98),
[C #99](https://github.com/nishanthturnstile/aarili/issues/99),
[D #100](https://github.com/nishanthturnstile/aarili/issues/100),
[E #101](https://github.com/nishanthturnstile/aarili/issues/101).
Bodies, existing labels and native blocking edges were read back. **A is selected**
and implemented for owner review on `codex/service-catalogue`; all ten direct blockers have verified
merged closing PRs. B–E require their direct blockers to merge before implementation.
Production content/policy approval, merge, deployment and live-data activation
remain separate gates. See [A implementation evidence](Service_Catalogue_Implementation_Evidence.md).

Sources: owner-supplied research brief,
[evidence](Service_Templates_REA_Evidence.md),
[design and ST acceptance matrix](Service_Templates_Design.md), product
§§3/6/9–15/24–25/27/29.1/30.1/32–33, architecture §§6–11/15, roadmap
1.1.1–1.1.3/1.2.1/1.3.2, [workflow](Development_Workflow.md),
[tracker](issue-tracker.md) and [visual authority](../aarili-design-system.md).

## Concrete vertical outcomes and blockers

| Proposed ticket | Owner-visible outcome | Direct blockers |
| --- | --- | --- |
| A — 1.1.2a: Maintain a versioned service catalogue, pieces and add-ons | Create/reopen/review catalogue definitions, disable new selection and read exact history | Merged 1.1.1 #84–#88; foundations #16/#51/#53/#55/#56 already integrated |
| B — 1.1.2b: Define garment- and piece-specific measurement forms | Edit, preview and review bilingual form definitions without entering wearer measurements | A; existing private-media #57/#58 if method illustrations are included |
| C — 1.1.2c: Review operating templates and generated requirements | Publish complete service manifests with materials, tasks/dependencies, quality, instructions and confirmation wording; preview unresolved requirements | A and B |
| D — 1.1.2d: Preview lossless Simple and detailed workflows | Choose versioned shop mode; switch one sample projection with owner assignment and complete retained detail | C |
| E — 1.1.2e: Bind real catalogue categories to commitment rules | Review exact category/rule versions, implement the existing resolver and preview bound configuration with unknown live load | A and merged #88; #85/#87 already prerequisites of #88 |

A is the approved first selection. E is not a second
catalogue or evaluator; it owns the existing explicit integration seam. D does
not depend on E because presentation preview does not commit a delivery promise.
The complete slice requires all five outcomes. 1.2.1 retains its existing
1.1.1–1.1.3 dependency and completes real intake, per-order switching, live-load
acceptance and consumer pinning. No circular requirement for orders to start A–E.

Once publication is approved, use the installed `to-tickets` workflow if available,
existing labels (`enhancement`, `ready-for-agent`) and native issue blockers;
read back bodies and relationships. Do not invent issue numbers or publish a map
issue. If the required skill is unavailable, report it before publication.
Select one approved issue at a time, verify actual merged blocker commits and
refresh `development` in this checkout before branching. No worktree approval
is implied by independent dependency edges.

## Shared contract for every ticket

Every ticket includes thin typed Hono API, framework-free core, transaction-bound
DB adapter, typed browser client and owner UI for its entire outcome. Use existing
durable drafts/command recovery, vocabulary, private media and Base UI patterns.
Do not introduce another catalogue, evaluator, form engine, browser persistence,
business Server Action or speculative package. Follow the design's data model,
authority, publication and migration rules.

Every ticket must prove ST-07 and ST-10–12: exact historical revisions;
tenant-composite references, forced RLS and missing-context denial; owner checks;
ETag 428/412, domain 409 and validation 422; actor/action/hash-bound idempotency;
concurrent publication/replay; changed-payload denial; atomic rollback after actual
revision/pointer/audit/draft/result writes. Retain original failures and name
corrections. Mocks do not establish isolation/history guarantees.

Bilingual phone/tablet/desktop Playwright/axe covers normal, invalid, cancel,
lost-response/exact-key retry, reload/resume, conflict, unavailable/read-only
history, language/IME, reflow and sign-out. Preserve customer/wearer/guardian and
Settings functionality. Match current tokens/fonts; no visual identity replacement.
Human fluent Tamil, physical Android and AT observations remain separately pending.

Run actual `pnpm lint`, `pnpm knip`, `pnpm typecheck`, relevant unit/property and
real PostgreSQL integration suites and `pnpm build`. `pnpm verify:fast` covers
lint/boundaries/tokens, Knip, types, unit/negative tests, OpenAPI and build; do
not repeat its successful components without changed inputs. Run focused browser
checks during each UI delivery. Full `pnpm verify`, PDF/smoke and full browser
suite remain promotion requirements unless an issue's checks explicitly require
them locally. Package export/dependency/runtime changes trigger clean-install/
portability checks under the workflow. Inspect installed Turbo docs and use ctx7
library→docs when implementation needs library-specific details.

Record fresh tested revision/dirty scope, commands, exit codes, relevant counts,
logs and requirement mapping. Record delivery timestamps in
[Delivery_Measurements.md](Delivery_Measurements.md) when implementation actually
starts. Add issue-local implementation evidence, source/roadmap traceability,
migration/recovery notes and the running owner-review packet before handoff.
Feature PRs target development after applicable publication authorization and
must be T3-linked. Required CI/owner review precedes separately authorized merge;
production promotion, live data and deployment remain separate gates.

## A — Maintain a versioned service catalogue, pieces and add-ons

Sources: SET-03/08/09; DES-01/03; ORD-13/14 definitions; product §§3/6/9/10/32;
architecture §§6–9/11/15. ST-01/07/10–12; AC-07 partial.

Scope: one canonical module with category/subcategory/service/piece/add-on kinds,
parent-kind restrictions, bilingual labels and description, service kind,
versioned piece composition/add-on applicability, review, availability and exact
history. Category revisions also author/review the nullable warning-window
override; null means no category extension and no production value is guessed.
Support incomplete drafts and explicit production-versus-synthetic
authority. No approved stock catalogue shipped by assumption. Catalogue
publication is not full intake readiness until C's manifest is reviewed.

Acceptance:

1. Owner creates a labelled synthetic blouse type, salwar outfit with independently
   defined candidate pieces, an alteration and standalone small-service definition;
   saves/reopens, reviews a diff and publishes attributable revisions.
2. Invalid parent kinds/cycles, cross-shop links, duplicate keys and an attempted
   Bridal garment category or retail activation are rejected with specific errors.
3. Revise names/composition; old revision content stays exact. Disable a type or
   component and verify new selection eligibility changes while history remains
   readable. Reactivation requires explicit review; content changes do not inherit
   approval. No hard-delete command for published definitions.
4. Versioned vocabulary snapshots do not drift when current labels change. Test
   Tamil edits and saved-history rendering, draft recovery and common integrity.
5. Search by Tamil, Tanglish and English using existing search keys; cross-shop
   results remain absent. The pilot's full recall corpus/target remains pending.
   Save/revise/reopen null and explicit valid category warning windows; reject
   fractional/negative/out-of-bound input and preserve historical values.

Migration/recovery: additive identity/revision/reference/availability schema with
forced policies and protected provenance; empty initial production catalogue.
Retain schema/history on rollback. No order, price or measurement value created.
Deliver running review route and ST-01/07/10–12 evidence.

## B — Define garment- and piece-specific measurement forms

Sources: SET-04/08; MEA-01/02 definition contribution; DES-01; product §§6/13/32;
architecture §§6–9/11/15. ST-02/07/10–12.

Scope: form editor with bilingual groups/labels/hints, stable base-length field
keys, order, explicit supported units, required/optional and reviewed precision;
garment/type/piece links; optional authorized method-illustration references.
No wearer values, conversions, formula engine, range guessing or measurement
approval. Distinguish body measurements from construction/decorative questions.

Acceptance:

1. Different synthetic blouse/top/bottom forms save/reopen/publish independently;
   a reviewed standalone small service can explicitly require no measurements.
2. Reordering/renaming preserves identity/history; changed field meaning requires
   new identity. Old form revisions retain bilingual labels and exact field order.
3. Missing unit/precision/label decisions prevent authoritative eligibility;
   duplicate keys, incompatible kinds and missing/foreign/disabled references fail.
   No inferred zero, threshold or required flag comes from a competitor example.
4. Preview clearly says definition-only; keyboard move controls and Tamil IME
   work across three sizes. Optional media follows private row authorization;
   no image publication or minor/wearer data is introduced.

Migration/recovery: immutable form/field/group revisions and composite links;
reuse media foundation, retain old definitions on application rollback.
Deliver ST-02/07/10–12 evidence. Actual measurement sessions remain 1.3.2.

## C — Review operating templates and generated requirements

Sources: SET-04/08; ORD-05/06; DES-02; JOB-01/02/10 definitions; product
§§6/9–11/15/27/32. Architecture §§6–9/11/15. ST-03/04/07/10–12; AC-11/12 partial.

Scope: bounded material, task dependency, quality, instruction and confirmation
editors; exact service manifest publication; generated requirement preview with
visible applicability/unresolved state and pinned versions. No workflow scripts,
real task transitions, stock/custody, customer approval or sending.

Acceptance:

1. Owner creates/reopens/revises one complete synthetic service manifest with all
   applicable sections; not-applicable decisions have scoped reasons. Missing
   sections stay unresolved and cannot silently become approved empty templates.
2. Required/optional and unresolved/not-required/completed are distinct. Every
   applicable required item begins unresolved; preview does not claim ready work.
3. Two garment templates independently allow craft-before-cutting and craft-after-
   cutting plus parallel work. Reject cycles, self/missing/cross-shop edges and
   optional-dependency bypasses. Preserve task keys and exact revision references.
4. Construction and decoration questions are separate. Confirmation placeholders
   are allowlisted; unsupported tokens/scripts/private internal content in customer
   wording are rejected. Missing illustrative price/date tokens stay unresolved.
5. Review/publication pins exact form/piece/add-on/template revisions under current
   eligibility checks. Later edits/disable do not mutate old manifests; common
   retry/concurrency/rollback and bilingual checks pass.

Migration/recovery: additive template/child/edge/manifest schema, relational FKs
for referenced records, immutable publication; keep definitions on rollback.
Deliver ST-03/04/07/10–12 evidence and a labelled preview route.

## D — Preview lossless Simple and detailed workflows

Sources: SET-10/08; JOB-01/04 presentation; product §§6/15/27; architecture
§§6–9/15. ST-05/06/07/10–12; AC-59 configuration contribution.

Scope: Simple default, versioned shop presentation preference, temporary sample
override, one canonical configuration preview rendered as checklist/milestones
or full per-piece/task detail. Owner assignment is a preview using trusted owner
context. No actual quick-order fields, per-order records, approvals, money or share.

Acceptance:

1. Simple displays relevant checklist and product milestones with honest
   applicability; required blockers remain visible. Every generated task defaults
   to the authenticated owner without requiring a worker record or login.
2. Repeated Simple/Detailed, English/Tamil and responsive switches preserve exact
   canonical data, histories, dependencies, unresolved values and revision IDs.
   Use equality/property checks, not just screenshot similarity.
3. Editing definitions invalidates the preview. Shop mode preference appends actor/
   effective history; sample override does not persist a business command and
   changing shop preference does not bulk-edit any existing work.
4. Booked/Handed over display milestones do not become fake production states;
   unavailable template/reference and retry/conflict/access-loss states remain
   clear. Browser checks prove no order, measurement, charge, approval or job side
   effect. The two-minute real intake claim remains unmeasured and later.

Migration/recovery: only required versioned shop preference/pointer storage;
preview stays transient. Keep previous preference/history on rollback.
Deliver ST-05/06/07/10–12 evidence and owner walkthrough.

## E — Bind real catalogue categories to commitment rules

Sources: SET-08/11 and SET-03 integration; product §§6/27/32; architecture
§§6/8/15; existing #88 contracts. ST-07–12; AC-60 configuration contribution.

Scope: implement the existing `ApprovedCategoryResolver.resolve(id)` adapter
against canonical eligible category revisions in the current transaction; replace
the null adapter in `packages/auth/src/index.ts`. Add explicit reviewed bindings
to existing immutable commitment rule revisions and binding history/readiness UI.
Extend the single evaluator with a server-derived bound-preview contract while
retaining unbound v1 behaviour. See design for exact inspected contracts.

Acceptance:

1. Production preview resolves a real eligible same-shop category version; foreign,
   missing, disabled, draft and unreviewed identities return unresolved. Browser
   supplied eligibility/approval/load is rejected, never treated as authority.
2. Owner reviews exact category and existing rule versions/conventions. Publish a
   binding with tenant-composite FKs, actor/effective time, provenance/digest and
   reviewed authority. Prior `authorityScope: unbound-preview` rows remain byte-
   equivalent; no SQL relabel/backfill or copied rule evaluator.
3. Synthetic sources cannot become production policy. A new reviewed binding may
   authorize an owner-proposal's complete values; absent business review or
   conventions remains unknown. Publication re-reads/locks pointers; races fail
   stale rather than bind a different version. Category edits require new review.
4. Retire a category and preserve old binding/history reads; new selection fails.
   Fingerprints include binding/category/rule/calendar/availability references.
   Unknown load and demand remain unknown; no synthetic load leaks to production.
5. Bound configuration preview still has `activation: unavailable`, `effects: none`.
   Existing unbound and synthetic tests remain valid. Real PostgreSQL proves
   cross-shop binding rejection, stale writes, replay, concurrent changes and all
   rollback points. UI shows both known warnings and unknowns in both languages.
6. Server derives exact category/rule revisions from the binding; reject a supplied
   different same-shop rule source or category/version with 409. Test after
   either current pointer changes, while explicit historical reads remain safe.
   A longer reviewed category window uses max(shop, category); null contributes
   no extension, shorter values never reduce the shop window and missing shop
   configuration stays unknown. Old bindings retain their original window.

Migration/recovery: additive binding revision/current-pointer schema; do not alter
old rule provenance or create orders. Rollback retains immutable bindings; old
clients continue the supported unbound path. Live-load reads, capacity bucket
locking, atomic booking acceptance and final AC-60 remain 1.2.1.

## Owner-review packet and next gate

Current review surface is this documentation packet in the existing checkout.
Open [independent design](Service_Templates_Design.md), inspect ST-01–12 and
the [sanitized evidence ledger](Service_Templates_REA_Evidence.md). There is no
running Aarili Services screen yet, and the existing Settings review host does
not demonstrate this feature.

Review in one session:

1. Check A–E outcomes and blocker edges, especially catalogue eligibility before
   complete manifests and the unchanged unbound-rule versus reviewed-binding split.
2. Check proposed category/piece/add-on content and name missing business inputs.
   Decide separately whether labelled synthetic fixtures are allowed for delivery;
   production content approval must name exact definitions, not this candidate list.
3. Check Simple preview boundaries and the deferred quick-order/measurement/
   production/capacity consumers. Approving the packet does not close those ACs.
4. Return `A–E packet — approve/change — observation; selected ticket — A/other`.
   Publication authorization and content/fixture approval should be explicit.

This review gate comes from repository AGENTS.md, [tracker](issue-tracker.md)
and workflow (“propose a concrete breakdown for approval before publishing new
tickets”), and the explicit supplied brief. No skill-inferred permission is added.

For each later implementation, prepare its production-built local synthetic host
before owner acceptance: exact URL/route/start command, isolated seeded scenario,
private access-file location, ST-linked steps/expected results, copyable
`ST-ID — pass/fail — observation`, automated evidence, pending human checks and
exact stop/cleanup command. Credentials never enter chat/Git; no tunnel, paid
service or live shop. Owner reviews business wording/usability/Tamil/device/AT,
not terminal checks already evidenced. Merge/deployment remain separately controlled.
