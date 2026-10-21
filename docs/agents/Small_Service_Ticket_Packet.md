# Alteration and small-service intake: approved vertical tickets

20 October 2026. **A–C and D1–D6 approved; published as #124–#126. A (#124)
merged through #127; B (#125) merged through #128. The owner selected C (#126)
after its direct blocker merged. [C implementation and owner review](Service_Line_Completion_Implementation_Evidence.md)
record the bounded completion outcome; C owner acceptance and merge remain
pending. Production values and activation remain gated.**
Roadmap **1.2.3**, ORD-14, JOB-08/JOB-09 intake contribution; **AC-50 partial**.
Cross-cutting scenarios: **AC-40, AC-53, AC-55 and AC-60**; SS rows state the
applicable ticket proof and remaining full-scenario integrations.
[Independent design and SS matrix](Small_Service_Design.md),
[actual REA evidence](Small_Service_REA_Evidence.md),
[verification and owner-review status](Small_Service_Implementation_Evidence.md).

## Approval and dependency frontier

Research/design is authorised by the current request. The brief states:
“Present the concrete packet before publication; implement only selected approved
tickets after blockers merge.” [Tracker rules](issue-tracker.md) and
[development workflow](Development_Workflow.md) require the same concrete review.
The owner subsequently replied “approved and proceed” to the concrete request
for A–C/D1–D6 approval, ticket publication and A selection. Those approvals are
reused. The later explicit #125 selection is recorded below. Production values,
C selection, merge and deployment remain separate.

Development `63d5123` includes #123; Quick Order #113/#114 and grouped #118–#120
are CLOSED with merged #115/#116/#121/#122/#123. The approved to-tickets publication
created **A [#124](https://github.com/nishanthturnstile/aarili/issues/124)**,
**B [#125](https://github.com/nishanthturnstile/aarili/issues/125)** and
**C [#126](https://github.com/nishanthturnstile/aarili/issues/126)**. All have
`ready-for-agent` and enhancement labels. Native blocker edges were read back:
#124 → #114/#99/#101/#118/#80/#56; #125 → #124/#120; #126 → #125.
Recheck direct blockers and their merge ancestry when each selected ticket starts.

| Candidate | Complete owner outcome | Direct blockers / selection gate |
| --- | --- | --- |
| A / 1.2.3a / #124 | Save, recover, accept and reopen a standalone kurti alteration or saree service order with independent priced lines | #114, #99, #101, #118, #80, #56; all merged. A selected; D1/D2/D5/D6 implementation conventions approved. |
| B / 1.2.3b / #125 | Add independent services during supported custom/group intake and through governed accepted-order additions | Merged through #128 on 20 October. D2/D4/D6 reused. [Implementation evidence](Service_Additions_Implementation_Evidence.md) records the delivery. |
| C / 1.2.3c / #126 | Record and correct one eligible service line's completion with attributable evidence and sibling independence | #125 merged; C explicitly selected on 20 October. D3 approval reused. [Implementation evidence and owner packet](Service_Line_Completion_Implementation_Evidence.md); C owner review/merge pending. |

These are sequential vertical outcomes spanning contracts/core/DB/API/typed
clients/UI/tests. Each gets its own branch/PR to `development` after publication
and selection. No worktree shortcut, implicit PR publication, merge or deployment.
Missing production rates/caps/terms do not prevent conspicuously synthetic testing;
they do prevent production activation or unsupported acceptance.

## Decisions for this packet

The following are **approved implementation conventions**, accepted with the
ticket breakdown. They supply no production business-policy values. Production
content is reviewed separately, as recorded in the last column.

| ID | Proposed decision | Unresolved production input / reviewer |
| --- | --- | --- |
| D1 — wearer applicability | Exact reviewed intake profile may declare no wearer for non-fit saree finishing with no wearer-specific data. Fit-specific alteration and a linked known wearer retain existing identity/guardian gates. No placeholder/self profile. No body measurement/photo capture. | Owner reviews services and bilingual wording; privacy reviewer retains notice/guardian gates before live use. |
| D2 — demand mapping | Versioned exact service/add-on → canonical category/unit/coverage/quantity mapping. One physical subject's reviewed garment-count coverage counts once; effort needs comparable reviewed integer mapping. Added work records only reviewed incremental demand; unknown is blocked. Initial standalone demand must be positive. Keep existing custom one-garment policy unchanged. | Owner supplies category, combination coverage, units and quantities, caps/lead times/rush/cut-offs. No numeric production mapping is approved by this document. |
| D3 — line completion | Owner may attest completion of an accepted, reviewed taskless service line with evidence/note; append actor/server time. Correct via linked completed → pending reason. Not-required comes from explicit applicability; required work cannot be removed by a status toggle. Task-linked execution stays unavailable until 1.7.1 integration. | Owner reviews which lines are attestable and sufficient evidence wording. No garment ready/quality/handover inference. |
| D4 — additive accepted changes | A recoverable draft and explicit review create immutable supplemental scope/price/date evidence plus aggregate CAS. New agreement attestation is scoped to exact additional work; old approval never covers it. Keep delivery promise unchanged; if new work requires another date, preserve draft and defer to governed promise change. Package extras are explicitly outside its frozen amount; package repricing/removal is unavailable. | Owner reviews allowed attestation/evidence, extra-charge versus included applicability and alteration terms. Rates/chargeability are not invented. Unknown approval impact blocks acceptance. |
| D5 — customer-property identity | Stable subject per physical kurti/saree, minimal description, optional owner reference and declared intake context. Optional authorised source order/piece link. No physical receipt, quantity, custodian, dispatch/return or inventory effect. | Owner checks whether descriptions distinguish actual counter garments; future 1.5.1 receipt links the same identity. |
| D6 — compatibility and scope | New `order.service` and `order.service-change` schema-v1 workflows reuse the draft engine. Preserve existing quick/group v1 drafts and strict accepted readers through explicit discriminated service contracts. Add-on-capable quick/group entry uses explicit versioned conversion/adapters, not silent reinterpretation. One order's supported services use one reviewed canonical capacity category/unit. | Concrete contract/SQL guard review in selected ticket; unsupported shapes fail visibly with draft retained. |

**Already approved; no repeat approval needed:** Phase 1 owner-only/online-only,
non-tax billing/manual WhatsApp/manual patterns; one outfit order with independent
pieces; fall/pico/pre-pleating as add-ons/lightweight standalone service; guardian
authorisation for minors; existing `QO-000001` allocator; accepted promised-week
custom count, retained demand after completion; all-or-nothing grouped acceptance,
same-contact grouping, frozen package-reference semantics and manual payments in
their later slice. None of those approvals supplies new service-capacity quantities,
completion semantics, prices or a production/live-data release.

## A — Accept a lightweight standalone service order

Stable slice **1.2.3a**. A customer brings a kurti for alteration, or a saree for
fall/pico/pre-pleating. The owner enters materially fewer irrelevant fields,
retains a draft, reviews commitment and reopens the exact accepted order.

**Sources:** product §§3, 6–9, 11, 13, 15, 17, 24–25, 27, 29.1, 30.1, 32–33;
ORD-14, JOB-09 intake, ORD-01/04/05/06/08/11/12, SET-03/04/08/10/11,
TRU-01/03/05/06/13, USE-01–04/08/09; AC-50 intake, AC-40/53/55/60.
Architecture §§6–11/15. Direct blockers are in the frontier table; #99 already
integrates catalogue/form definitions and #80 the guardian dependency chain.

**Complete scope:**

1. Add exact reviewed intake applicability/capacity-profile authoring/review to
   existing catalogue/template/commitment presentation, including synthetic versus
   production authority, unknown mapping and stale-source feedback. Reuse current
   draft publication/version machinery; no second configuration engine or rates.
2. Introduce strict service draft/accept/read contracts with stable subject and
   service-line IDs, minimal property/work instructions, relevant identity,
   owner, date/priority, price/to-be-quoted, optional authorised source link and
   exact manifests. Separate draft and complete command validation. One saree
   supports at least fall+pico as independent selected lines; no full form/pattern.
3. Register `order.service` in existing durable drafts; implement pause/IME-aware
   autosave, resume/list/reload, explicit abandon, exact-key recovery and dirty
   navigation. Unacknowledged typing remains only in memory. No capacity booking
   from save/review. Maintain readable order IDs from the existing allocator.
4. Extend shared acceptance source/authority/demand resolution without relaxing
   custom v1 requirements. Reviewed count/effort mapping supplies comparable server
   demand; single-order atomic acceptance persists original snapshot, line sources,
   prices/states, customer-property subject, applicable requirements and positive
   demand, audit/idempotency and durable promotion result.
5. Reopen accepted service details with original/current date, exact line prices,
   pending/not-required states, unresolved work and “receipt not recorded.”
   Conditional wearer is governed by the exact reviewed profile; preserve current
   guardian checks on every relevant command/read/replay. No fake body facts.

**Migration/recovery:** reviewed expand migration for intake kind/conditional
wearer checks, profile/mapping revisions, property subjects, line/price/provenance
records and exact source references. Retain custom non-null behaviour with checked
branches and narrowly update quick/group/service deferred guards. Every tenant
table has non-null shop_id, composite tenant FKs, shop-led indexes/uniqueness,
matching ENABLE/FORCE RLS and app_user grants. Preserve existing snapshots and
0033 populated upgrade semantics; allocate migration number at start. No backfill
approval or production migration. Compatible service-aware rollback gates writes
and unsupported reads, retains history and does not pretend old custom-only
readers can parse nullable-wearer service records. Backup before non-disposable use.

**Acceptance/negative tests:** SS-01/02/03/05/06/07/09/10/11/12/13/14.
Unit/property: definition applicability, exact source keys, stable line identity,
missing/zero money, deterministic coverage, unknown/mismatched units and no false
state effects. Real PostgreSQL: missing/foreign customer/wearer/guardian/profile/
source order/piece/line; RLS context and pooled reuse; direct SQL fake custom null
wearer and forged service exemptions; source/guardian changes versus acceptance;
two same-week acceptances serialise; exactly-once origin after key expiry;
changed actor/action/hash/ETag; rollback after subject/line/demand/audit writes.
Upgrade historical Quick Order and grouped fixtures without changing digests or
commercial facts. Browser journeys cover both standalone cases, unknown mapping,
conditional identity, stale sources, reload/retry/conflict and all SS-12 checks.

**Explicit exclusions:** completion commands wait C; attaching new work to accepted
orders waits B. No money, custody, production, trials/quality or actual handover.
An existing accepted source link is contextual, not reopening/correction settlement.
Unsupported mixed-category service combinations retain a draft or use distinct orders.

**Review packet:** synthetic taskless kurti alteration and saree fall+pico profiles,
unknown-capacity profile, authorised adult and minor/aunt/guardian fixtures, and
a second tenant. Open Orders → new service, show fewer fields, save/reload,
review/accept and inspect line states/unknowns/property label; compare old custom
and grouped fixtures. Provide exact local URL/startup/private access and cleanup
after implementation, not a fabricated route today.

## B — Add services without rewriting accepted custom or grouped work

Stable slice **1.2.3b**. The owner adds two small services to a custom garment,
including one already accepted inside a booking, and can see what changed and
what was originally promised/quoted.

**Direct blockers:** A merged and #120 merged. **Sources:** ORD-14, ORD-02/03/12/13,
SET-08/11, TRU-01/03/05/06/12/13, FIN-03/04 intake, USE-03/08/09;
AC-01/07/40/50/53/55/60/63 contributions; product §§6–9, 11, 13, 15, 17, 24–25,
27, 32–33; architecture §§6–11/15. D2/D4/D6 must be settled for implementation.

**Complete scope:**

1. Reuse A's line instances for selected add-ons in supported new custom and grouped
   intake. Existing quick/group v1 drafts/readers remain usable. Introduce explicit
   conversion into supported add-on-capable workflows/adapters, preserving every
   raw field/line ID and closing the original draft atomically where conversion is
   necessary. Clear stale reviews/attestations; never auto-convert saved payloads.
2. Accepted order Add service saves `order.service-change`, bound to exact target
   aggregate/digest and current service scope. Persist stable IDs through retry and
   reordering. Review scope, price basis, unchanged promise, permission and capacity
   delta. Confirmation captures a new exact-scope attestation/reason; unknown price
   remains price-pending. No earlier approval is reused as authority for added work.
3. Append immutable supplemental revisions/line requirements/current-view links,
   positive incremental demand or reviewed already-covered zero-effect evidence,
   audit and result together. Coordinate aggregate CAS with existing presentation,
   membership and concurrent service changes. Update the shared load query exactly
   once; retain original demand rows and accepted snapshots byte-for-byte.
4. For garment-price booking totals, count new additive charges once. For package
   proposals, show immutable original package plus explicitly supplemental outside-
   package charges, never reference-price arithmetic or a split allocation. Inclusion
   that changes the frozen package, date changes, removal/repricing and uncertain
   agreement impact stay blocked with draft preserved. Grouping alone adds no demand.
5. Read original versus current scope/history with exact source labels/definitions,
   per-line prices/states and relevant garment/piece/property identity. Legacy
   addonKey scopes are not automatically priced or completed from latest catalogue.
   Any supported legacy materialisation has explicit exact-source provenance and
   unknown/inclusion-unresolved commercial facts, not invented supplemental charges.

**Migration/recovery:** additive service-change draft/provenance/revision/current
pointer, supplemental line requirements/price facts and positive capacity-contribution
tables; zero effect stays evidence, not an invalid zero legacy demand. Narrowly
extend order-version guards for these specific events or use a separate CAS with
an explicit shared aggregate contract; test presentation/membership interaction.
Immutable source/piece sets are never reopened for inserts. Composite tenant and
same-order links, durable unique origin line/change/coverage keys, FORCE RLS,
transactional audit/result/deferred integrity and privacy boundaries apply. Upgrade
populated A/custom/group/package history; retain additive tables on compatible
rollback, gate unsupported readers. No destructive down migration or production SQL.

**Acceptance/negative tests:** SS-03/05/06/07/08/09/10/11/12/13/14 and SS-02 where
new service records join optional bookings. Real PostgreSQL: accepted snapshot,
original price/promise and package revision hashes unchanged; wrong-tenant/wrong-
order piece/source and permission revocation denied; missing/stale ETag;
same-key changed payload; two different keys adding same source line; request
replay after key expiry; source/mapping/approval-impact change invalidates review;
concurrent add-on versus grouped acceptance sees each other's demand; same target
change/presentation/membership race has explicit conflict and no deadlock or lost
update; rollback after supplemental line/contribution/audit writes. Verify task/
price/garment independence and package extras unknown/zero math. Existing Quick
Order conversion, grouped pending candidates and all-or-nothing failure remain.
Browser covers change-draft reload/lost result, review conflict, original/current
scope and multi-add-on rows in English/Tamil/three sizes, SS-12 keyboard/axe/IME.

**Review packet:** synthetic custom garment with original digest/price/promise,
same-contact two-garment booking and frozen package, plus two added lines with
separate sample prices (clearly synthetic), one already-covered mapping and one
unmapped case. Owner observes unchanged historical original, explicit supplemental
charges, no phantom property receipt and blocked unsupported package/date changes.
No payment or change-settlement engine and no general approval/lifecycle capability.

## C — Record independent service completion and its correction

Stable slice **1.2.3c**. The owner records fall complete while pico remains pending,
then corrects a mistaken completion without losing the original event or affecting
prices, other garments or retained capacity.

**Direct blocker:** B merged. **Sources:** ORD-14, JOB-05 bounded/09 intake,
ORD-06/12, TRU-01/03/05/06, USE-08/09; AC-50 partial, AC-53/55;
product §§9, 15, 24–25, 27, 32–33; architecture §§6–11/15. D3 is required.

**Complete scope:** bounded owner-attested taskless-line completion and linked
correction command, strict transition/evidence schemas, typed Hono/client UI,
line ETag, immutable transition/audit/idempotency and server actor/time. Only
reviewed accepted line revisions are eligible. Show independent pending/not-required/
completed with evidence/history and outstanding summary in Simple/Detailed.
Explicitly deny required → not-required scope removal, completing not-required,
unreviewed/unknown/task-linked execution and stale line versions. An erroneous
completion appends reasoned completed → pending; never delete/rewrite the first
event. Do not mutate legacy requirement rows or add a production state engine.

**Migration/recovery:** tenant-composite immutable service-line transitions and
CAS current state, source/evidence references and durable command uniqueness.
FORCE RLS and audited transaction guards enforce valid transition provenance.
Old pending line views remain compatible; unsupported state versions fail visibly.
Retain history on rollback and use existing privacy redaction for personal notes.

**Acceptance/negative tests:** SS-04/05/07/09/10/11/12/13/14. Real PostgreSQL:
two independent line prices/states; complete only fall, pico still pending;
completion-correction history; no event on missing evidence/illegal transition;
task prerequisites cannot be bypassed; wrong tenant/order/line/source;
guardian/relationship revocation; concurrent two-key completion/correction and
parent scope change; 428/412/409/422; lost-response replay returns one transition;
failure after state/transition/audit writes rolls all back. Count original and
supplemental demand before/after: identical. Assert no garment-ready/quality/
handed-over/payment/custody/booking-fulfilled event. Bilingual three-size browser
tests include focus, status announcements, retry/conflict, IME notes, reflow/axe.

**Review packet:** accepted taskless fall+pico, a not-required optional service,
task-linked work and minor-authority fixture. Owner completes/corrects one eligible
line, checks the sibling and both prices/history and sees blocked task-linked work.
Physical-device/fluent-Tamil/AT review remains human acceptance; automation cannot
sign it off. Full garment completion/quality/custody/billing/handover remain later.

## Required verification and delivery for every selected ticket

Read the actual issue/comments/native blockers and latest integrated development
before branching. Run actual repository lint/boundaries/tokens, Knip, strict types,
unit/property and negative DTO/UI tests, OpenAPI and production build through
`pnpm verify:fast`. Run affected real-PostgreSQL integration and focused browser
checks for the SS rows above; explicit published-ticket checks remain required.
Use `pnpm verify`/`pnpm test:ui` when required by the approved ticket or changed
coverage, not as a substitute for targeted new acceptance tests. Do not assert
isolation, transactionality, concurrency or history from mocks.

Feature PR gates are Fast verification and Dependency audit; full Scaffold
verification and Browser smoke/accessibility run at promotion, with owner merge
review. Dependency/toolchain/runtime changes require the workflow's additional
portability checks; none is proposed here. Register any authorised PR with T3.
Capture commands/results/revision/source hashes and failure diagnoses, not repeated
unexplained reruns. Update roadmap, implementation evidence and measured delivery
times as work happens, never reconstruct active implementation time from Git.

Before asking human acceptance, prepare a running synthetic local review surface,
exact URL/startup/private access, fixtures, SS-linked try/observe steps and teardown.
Human response format: `SS-ID — pass/fail — observation`, including actual Android
device/RAM/browser, Tamil fluency or AT details only where needed. Do not ask the
owner to repeat terminal checks. The approved packet is the delivery boundary.
Current A implementation, fresh verification and the running owner-review surface
are recorded in the [implementation ledger](Small_Service_Implementation_Evidence.md);
B's selected implementation and owner packet are recorded separately in
[Service_Additions_Implementation_Evidence.md](Service_Additions_Implementation_Evidence.md).
C still requires B's merge and its own selection.

Full AC-50 also needs money/agreements, 1.5.1/property continuation, 1.7.1,
1.8.1–1.8.3 and their direct prerequisites. Full JOB-08/09 correction/fit/cost and
JOB-14 lifecycle reopening stay named later work. Restore/privacy/configuration,
production content and live-data gates remain separate. No implicit publication,
merge, deployment, paid plan, message or live-data use.
