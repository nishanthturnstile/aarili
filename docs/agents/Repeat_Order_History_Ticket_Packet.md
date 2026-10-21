# Repeat orders and customer history: approved ticket packet

21 October 2026. **Owner approved D1–D6, publication and A1 implementation.**
[Design and field matrix](Repeat_Order_History_Design.md),
[REA observations/gaps](Repeat_Order_History_REA_Evidence.md),
[current evidence](Repeat_Order_History_Implementation_Evidence.md).

Published through the configured tracker/to-tickets workflow, with native blockers
read back: [A1 #134](https://github.com/nishanthturnstile/aarili/issues/134),
[A2 #135](https://github.com/nishanthturnstile/aarili/issues/135),
[B #136](https://github.com/nishanthturnstile/aarili/issues/136),
[C1 #137](https://github.com/nishanthturnstile/aarili/issues/137),
[C2 #138](https://github.com/nishanthturnstile/aarili/issues/138).
**Only A1 is selected.** Its direct blockers #114/#120/#125/#126 are closed
with merged PRs #116/#123/#128/#129. A2–C2 retain their dependency gates.
Approval covers a focused branch and draft PR to development; owner merge,
deployment and production activation remain separate.

## Sequence and outcomes

| Stable slice | Proposed issue title | Complete vertical result | Direct prerequisites to publish/check |
| --- | --- | --- | --- |
| **1.2.4a / A1** | Repeat a selected custom garment as a new recoverable order | Existing source discovery → reviewed reusable text/current manifest → durable new draft → fresh price/date review → existing acceptance → visible source/new relationship | #114 Quick acceptance, #120 grouped acceptance, #125 current service scope, #126 progress/source concurrency. All closed with merged PRs #116/#123/#128/#129 at preparation. |
| **1.2.4b / A2** | Repeat selected service work with explicit garment and piece scope | Select standalone service or supported piece/add-on lines → current compatible service profile → new subject/lines/draft → ordinary service acceptance and lineage | A1; #124 service intake, #125 additions, #126 completion, #118 native piece identity. Existing PRs #127/#128/#129/#121 merged. |
| **1.2.4c / B** | Browse authorised customer and wearer history across implemented records | Customer/wearer search → identity-scoped paginated history → exact event/source detail → repeat action | A2; #78/#79/#80 identity/guardian access (merged #81/#82/#83). |
| **1.2.4d / C1** | Review possible duplicate contacts and correct identity details with history | Review candidate pair → dismiss/keep separate or correct through existing reasoned versioned commands → visible history | B. Existing customer/wearer correction commands reused. |
| **1.2.4e / C2** | Preview and apply an authorised contact merge or supported relink | Select pair/association → conflict/impact preview → explicit survivor/scope/reason → atomic correction → aliases and original attribution readable | C1 and B; sensitive domain integrations additionally required before those relinks activate. |

A1 is the **approved first selection (#134)**. A1/A2
together deliver outcome A. A1 alone intentionally does not complete service
repeat, customer-wide history, duplicate review, merge, or all of ORD-08/CUS-03.
No ticket implementation starts from an unmerged local prerequisite.

## Decisions for this packet's approval

| Decision | Proposed bounded behaviour | Existing authority versus new choice |
| --- | --- | --- |
| D1 | Start A1 with one selected whole custom outfit, including a member of a booking; no whole-booking clone | New delivery split; ORD-02/08 and product §5.2 already require independent orders. |
| D2 | Prices start empty/to-be-quoted; owner explicitly confirms a new quoted value or unknown. Dates blank; normal priority and current intake defaults | Existing unknown/zero and fresh-commitment rules retained; reset defaults are the proposed reuse policy. No new rate or pilot limit. |
| D3 | A2 supports native piece context only for a currently reviewed standalone service profile. No arbitrary piece-only custom cloning | Respects existing outfit granularity/current manifest support. Unsupported cases remain actionable drafts or ordinary intake. |
| D4 | Preserve original scope and exact selected accepted additions as distinct candidates. Never select completed add-ons, siblings or package price implicitly | Explicit selection required; completed requested work can be chosen anew with pending state, not copied completion. |
| D5 | Add minimal lineage and an explicit versioned repeat adapter to the existing durable engine; reverse links never mutate the source | Proposed implementation seam; exact DTO/migration versions reviewed in selected ticket. |
| D6 | B projects implemented domains only; C1 uses existing search keys with no new confidence threshold; C2 merges contacts without merging wearers | Prevents invented financial/property/fit facts or identity policy. Sensitive future relinks remain blocked until separately reviewed. |

Already approved: owner-only online operation, exact paise/unknown semantics,
Simple mode, current code allocator/count/week/retained-demand conventions,
grouped acceptance, service profile/mapping mechanisms, non-tax billing and
manual WhatsApp/manual patterns. No repeat approval of those is requested.
Production catalogue, prices, service mapping values, privacy/restore/pilot and
later-domain gates remain unchanged.

## A1 — repeat a custom garment (1.2.4a)

**Sources:** ORD-08/12, CUS-02/07, TRU-01/03/05/06/12/13, ORD-01/04/05/06,
SET-08/10/11, USE-01/02/03/04/08/09; product §§3/5.2/7/9/24–25/27/32–33;
architecture §§6–11/15. AC-40/53/55/59/60 contributions, no full AC-59 share closure.

**In scope:** discovery from the existing order context with authorised customer/
wearer disambiguation; one accepted custom outfit, including a grouped member;
explicit reviewed instruction reuse; exact original/current-supplemental provenance
read and visible eligibility; current manifest review; fresh durable draft/identities;
new price/unknown confirmation, new date and commitment review; ordinary custom
acceptance and bidirectional authorised lineage. No second acceptance/audit engine.
Do not automatically copy selected service additions in A1; show them as source
context and explain A2's separate selection path. Conversion into grouped/add-on
intake must retain lineage atomically or be explicitly blocked for repeat drafts.

**Not in scope:** whole family booking/package duplication, standalone service
repeat, piece-only custom intake without an orderable manifest, identity changes,
measurements/design/fit capture, payments, custody, delivery or sharing.

**Acceptance:** RH-01–RH-10/RH-14/RH-15 below. Empty/retired/changed-source,
same-phone wearers, minors, cancel/reload, retry/stale and source immutability
are required, not optional polish. A repeat source can remain active; source
demand is retained. Source and target may legitimately both contribute demand.

**Migration/recovery:** additive same-shop origin/lineage and conditional guards;
register explicit repeat workflow without changing strict historical quick/group/
services DTOs. Immutable source snapshots/requirements/demand survive populated
upgrade. New lineage tables enter both isolation and bootstrap inventories.
Back up before non-disposable schema work. Disable repeat writes for rollback;
reader must recognise/reject repeat drafts safely and preserve historical target
orders. No destructive down migration or old-binary compatibility assumption.

**Verification:** unit/property reset and selector tests; negative DTO tests;
real PostgreSQL source/order/draft/line FK, FORCE RLS, authority revocation,
atomic rollback after writes, current-source publication and concurrent acceptance
tests. UI workflow at three sizes, English/Tamil and both themes, recovery/axe/
keyboard/IME. Regress existing quick/grouped acceptance and service scope reads.
Run `pnpm verify:fast` plus affected PostgreSQL/browser commands below. Activation
remains synthetic-only and requires no live policy changes.

## A2 — repeat selected service work (1.2.4b)

**Sources:** A1 sources plus ORD-13/14, MAT-01/02 context and AC-50 intake/63
structure; actual custody/handover remains later. Prerequisites as in sequence.

**In scope:** standalone service line selection, original/supplemental add-ons and
native piece-scoped source selection; exact source subject/line/change/piece
versions/digests. Current compatible profile and comparable mapping required.
New subject/line/draft identities, descriptive candidate review, new work pending,
new additive prices or explicit unknown, fresh promise/capacity review, ordinary
service acceptance, and lineage to exact source scope. A whole source service
order is never repeated merely because one line was selected. Completed source
lines can supply requested-work text only after explicit choice.

**Blocked cases:** unmapped/incompatible profiles/categories, absent native piece
identity, stripping a source wearer to evade access, package-included price reuse,
unsupported task/custom-only add-on as standalone service. Retain draft and explain
the precise gap; no inferred capacity, price allocation or source coverage reuse.

**Acceptance:** RH-01–RH-10 plus RH-11/RH-14/RH-15. Same physical garment not
assumed: subject description/source relationship does not record receipt or reuse
an old custody identity as current possession. No source state is changed.

**Migration/recovery:** explicit new supported adapter/version preserving A1
drafts; typed composite references distinguish service initial versus supplemental
lines and source piece membership. No reuse of old line/subject IDs. Extend
lineage/privacy guards and inventories. Read compatibility and write-disable
rollback must be demonstrated against populated A1 and 0036-era source records.

**Verification:** A1 controls plus real service/piece wrong-parent attacks,
partial-line selection, unknown/zero included prices, current mapping changes,
completion/repeat races and duplicate demand tests; existing standalone/additions/
completion/grouped browser and PostgreSQL regressions. Synthetic-only; no service
mapping or cost/rate value becomes production approved.

## B — unified history (1.2.4c)

**Sources:** CUS-03, ORD-12, TRU-01/03/05/06/12, MEA-10 manual-only and
USE-01/02/09; product §§5.2/7/9/13/24–25/27; architecture §§8/9/11/15.

**In scope:** current authorised customer versus wearer scope; corrections and
authority changes, accepted orders, booking/member/commercial revisions, piece
structure, service additions/progress and repeat relationships. Exact source
links, original attribution, actor/time/reason, meaningful field metadata and
redaction-aware display. Search/pagination run in tenant transaction; return no
unauthorised count/snippet. Stable cursor ordering/high-water semantics specified
in the design; deduplicate a logical event represented by audit and domain rows.

**Unavailable:** enquiries/appointments, shared documents, money position,
custody, actual designs/measurements/fit until their authoritative features exist.
Display clear availability without mock tabs/paid/received/delivered facts. This
is a partial CUS-03 projection with explicit future contributors, not full closure.

**Acceptance:** RH-07/RH-08/RH-12/RH-14/RH-15; history discovery leads into A1/A2.
Original and current identity labels are distinguishable. Search covers same-phone
wearers, Tamil/Tanglish/name/ID, deterministic pagination under insertion/correction,
revocation between pages, empty/no-match and redacted source.

**Migration/recovery:** prefer direct authoritative projection and shop-led indexes;
any materialised index is rebuildable and not authority. No duplicated personal
audit payload or event-sourced migration. Index expansion must not rewrite source
history; rollback removes new read capability, retains business history.

**Verification:** real-PG cross-domain pagination/visibility and deduplication tests,
recorded fixture recall expectations, query-plan/latency measurements on a bounded
synthetic history corpus. Record corpus size and environment; do not invent a
performance pass threshold. Pilot architecture §9.1's consented/anonymised recall
gate remains pending. Three-size bilingual browser navigation and axe tests.

## C1 — duplicate review and corrective identity edits (1.2.4d)

**Sources:** CUS-05/06, CUS-01/02/07, TRU-03/05/06/12/13, USE-08/09;
AC-02/53/55; product §§7/24/27; architecture §§8/9/11/15.

**In scope:** explicit duplicate candidate review using existing search keys and
human-readable match reasons; pair preview with different customer codes,
wearers and authority, keep separate/dismiss with history, and reasoned simple
contact/wearer corrective edits through existing commands. Add missing material
revision evidence rather than duplicate the existing correction engine. Search
can suggest a same-phone pair; it cannot assert that the people are the same.

**Excluded:** actual merge/relink, automatic name/phone matching action, new scoring
threshold, consent transfer or rewriting accepted snapshots/documents. Changing
a payer must not reassign wearer or guardian authority. Existing privacy purpose
and guardian checks remain action-specific.

**Acceptance:** RH-07/RH-08/RH-12/RH-13/RH-14/RH-15. Both candidates stay distinct
after dismissal; deliberate correction has actor/time/reason/version; stale concurrent
edit fails 412 and changed key fails 422; prior accepted snapshots retain old labels.

**Migration/recovery:** versioned review decisions and correction provenance with
tenant pair FKs, minimal metadata and privacy-redactable text. Prevent duplicate
decision replay. Disable review writes on rollback; retain existing corrections
and source links. No contact deletion or destructive merge migration.

**Verification:** current customer/wearer unit/PG/UI regressions plus same phone
different people, ambiguous name, repeated/dismissed candidate, withdrawn authority,
material edits and concurrent correction cases; real-PG rollback/RLS/replay proof.
Human review verifies understandable matching reasons without misleading confidence.

## C2 — authorised merge and supported relink (1.2.4e)

**Sources:** CUS-05/06, ORD-12, TRU-01/03/05/06/08/12/13, USE-08/09;
AC-02/53/55 and later domain-specific acceptance. Product §§7/24/27/32–33;
architecture §§8/11/15.

**In scope:** review pair, survivor fields, immutable original identities and exact
association consequences; explicit reason/confirmation and current version-bound
preview. Contact alias/tombstone resolution, attributable correction overlays and
per-association supported current relink. Old IDs/codes and business/financial
references remain resolvable; no accepted snapshot or document rewrites. Merge
customer contacts only; wearer/person/guardian conflicts fail closed. Sensitive
links cannot be selected through a broad “move everything” checkbox.

**Release gate:** before mutation, enumerate every implemented identity consumer
and its access/correction policy. Measurements/private assets/issued financial
references remain unavailable for relink until those domain integrations and
authority are reviewed. Retain those original references; preview makes exclusions
explicit. No placeholder financial record or policy to pretend these tests passed.
C2's bounded implementation does not close future-domain CUS-05/06 coverage.

**Acceptance:** RH-07/RH-08/RH-12–RH-15. Preview invalidates on any relevant identity/
association change; exact retry returns one effect; conflicting survivor changes
cannot create alias chains/cycles or lose provenance. Same-phone names alone
never authorise it. A reasoned correction after a mistaken merge appends a new
reviewed event, retaining the original merge and snapshots.

**Migration/recovery:** expand alias/current-attribution tables and typed same-shop
links; SQL uniqueness/cycle/immutable provenance guards, privacy functions where
personal fields persist. No bulk FK rewrite of accepted history. Concurrency locks
cover sorted contacts, wearers and affected aggregates under the documented global
order. Disable merge/relink writes for recovery; compatible readers resolve aliases
and preserve original attribution. No destructive unmerge/down migration.

**Verification:** real PostgreSQL duplicate-key, alias-cycle, wrong-shop, wrong-
wearer, reason/precondition, rollback after actual relinks, merge-versus-repeat/
correction/permission races and original-byte preservation tests. Browser preview,
conflict, cancel/retry and corrected-history navigation at three sizes/languages.
Future finance/media integration tests remain explicitly pending rather than mocked.

## Requirement-by-requirement acceptance inventory

All rows are **future required proof**, not passing acceptance. Packet-level IDs
remain stable in issue bodies/test names and implementation evidence.

| ID | Required evidence | Tickets / requirements |
| --- | --- | --- |
| RH-01 | Correct source customer/wearer/order selected; fresh draft/order/code/origin/piece/line IDs; one grouped member chosen, siblings/package untouched | A1/A2; ORD-01/02/08/13/14, CUS-02/07 |
| RH-02 | Field matrix covers every serialized field; reuse explicitly reviewed; price unknown versus zero; fresh date/priority/occasion and current catalogue/manifest/mapping. Retired/changed source produces review gap, not substitution | A1/A2; ORD-04/05/06/08, SET-08 |
| RH-03 | New current commitment/fingerprint, capacity/cut-off/rush/override checks; no source coverage or approval copied | A1/A2; SET-11, AC-60 |
| RH-04 | Source snapshot/digest/promise/requirements/line progress/booking proposal and demand byte-identical after create/save/cancel/accept, reverse lineage visible without source mutation | A1/A2; ORD-12, TRU-06/12 |
| RH-05 | No copied approval, payment/credit/UTR/allocation, bill/PDF/share, assignment/QC/completion/handover, stock/custody; no “received again” inference | A1/A2; ORD-08, §27, TRU-12; AC-58 not closed |
| RH-06 | Save/reload/reopen/cancel, IME/dirty navigation, failed/unknown save, lost acceptance response, same-key replay, changed-payload rejection, durable uniqueness after expiry, 428/412/409/422 | A1/A2; USE-03/04/08, AC-40/55 |
| RH-07 | Same-phone distinct wearers, current source/destination/guardian/purpose authority on read/replay/accept; revoked access clears labels and cache; sensitive cross-wearer reuse denied | All; CUS-02/07, TRU-03/05/13, AC-02/53 |
| RH-08 | Real-PG app_user FORCE RLS/missing context/pool reuse, wrong-shop/order/piece/line FK attacks, transactional audit/key/lineage/target rollback and concurrent identity/source/mapping/acceptance races | All; TRU-01/06/12, AC-38/55 |
| RH-09 | Draft/review contributes zero; acceptance once; two deliberate repeat operations allowed; source demand retained; concurrent load at capacity cannot bypass current evaluator | A1/A2; SET-11, AC-60 |
| RH-10 | Simple mode English/Tamil, both themes, phone/tablet/desktop/landscape; keyboard/focus/axe, IME/reflow/enlargement, clear source/new fields; actual timing reported | A1/A2; SET-10, USE-01/02/09, AC-59 partial |
| RH-11 | Explicit service subset and completed-source-line reuse yields new pending lines; compatible current profile, unknown/zero additive amounts, new subject and native piece context; incompatible cases blocked | A2; ORD-13/14, AC-50 intake/63 structure |
| RH-12 | History projection preserves original/current attribution, meaningful revisions and links; authoritative deduplication; scoped counts/cursor/search stable across pages and revocation; absent domain unavailable | B/C1/C2; CUS-03, ORD-12, MEA-10 manual, TRU-06/12 |
| RH-13 | Manual candidate review/keep separate, reasoned versioned correction; reviewed survivor/conflicts/aliases; no automatic identity or sensitive asset merge; concurrency conflicts surface | C1/C2; CUS-05/06, AC-02/55 |
| RH-14 | Populated upgrade preserves prior strict readers/drafts/snapshot bytes; isolation inventory updated; write-disable recovery and compatible reader behaviour demonstrated | All; architecture §§8/12/15 |
| RH-15 | Privacy redaction/retention boundaries, no personal data in URLs/logs/jobs/replay; no later-domain closure or policy/live-data activation claim | All; TRU-03/05/08/12/13, product §§29/32–33 |

## Required checks and manual handoff for a selected ticket

Run actual `pnpm verify:fast` (lint/boundaries/tokens, Knip, types, unit/negative
types, OpenAPI and production build), affected real PostgreSQL tests and focused
browser workflows. Existing relevant files include `orders.integration.test.mjs`,
`order-acceptance.integration.test.mjs`, `small-services.integration.test.mjs`,
`customers.integration.test.mjs`, `wearers.integration.test.mjs` and their UI
counterparts; add meaningful RH-named cases rather than duplicating implementation.
Use the actual Vitest integration config and `scripts/test-ui.mjs` harness.
Exact new test filenames/commands are established during implementation, never
represented as already existing here. Full `pnpm verify`/`pnpm test:ui` remain
required if the published issue explicitly requires them. Dependency/toolchain/
runtime packaging changes require the workflow's portability checks.

Feature PR: Fast verification and Dependency audit; promotion: full Scaffold,
nine browser shards and successful aggregate. Owner review/merge stays separate.
Register only authorised PR work with T3. Record revision/dirty files, commands,
results, failures/diagnoses, integration/rollback evidence and source hashes.
Time implementation/local verification/CI/review/rework as they happen in
Delivery_Measurements.md; this preparation is not an implementation delivery.

Before human acceptance, prepare the running synthetic review host, exact URL/
startup/private access, seeded source/target cases, RH-linked try/observe steps,
report format `RH-ID — pass/fail — observation` and teardown. Human Tamil,
screen-reader and physical Android acceptance is distinct from automation.
All product §32.2/restore/privacy/pilot gates remain pending where not already
approved. This packet supplies no new legal wording, rate, tolerance, confidence
threshold, time limit or production mapping value.
