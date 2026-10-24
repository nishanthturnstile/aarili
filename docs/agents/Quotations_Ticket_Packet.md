# 1.4.1 — Concrete quotation ticket packet

24 October 2026. **Approved and published after the owner's “approved and
proceed”. A1 #173 merged in PR #177; the owner selected A2 #174 after pulling
development. A2 is implemented in [draft PR #178](https://github.com/nishanthturnstile/aarili/pull/178), pending CI/owner review. B/C wait for their direct blockers.** [Design/QD-01–12/Q-01–14](Quotations_Design.md),
[research](Quotations_REA_Evidence.md),
[preparation verification](Quotations_Implementation_Evidence.md).

## Scope, dependency frontier and approval

FIN-01/02/03/04 are Phase 1 Must. Product §§3/6/9–10/16–17/19/24–25/27/
29.1/30.1/32–33 and architecture §§6–11/15 govern every ticket. Reuse the
existing rates' source catalogue, orders, drafts, money and PDF foundations.
FIN-05 is a shared calculation dependency; payments stay 1.4.2, governed
agreements 1.4.3, bills/receipts 1.4.4 and financial corrections 1.4.5.

Approved sequential vertical outcomes in the owner's existing checkout:

1. **A1 / 1.4.1a — Review effective-dated selling rates and quotation policy
   authority.** Owner saves, reviews and reopens an exact rate schedule and
   quotation-only policy binding in Settings. Blocked by merged #97 (catalogue),
   #87 (policy drafts), #84 (profile/timezone), #16 (commands), #55 (durable
   drafts). No order/PDF feature prerequisite.
2. **A2 / 1.4.1b — Prepare and recover a garment estimate with private estimated
   costs.** Owner completes as much as known, sees price assumptions, saves and
   resumes without changing accepted prices. Blocked by A1, #118 (pieces),
   #124/#125 (service subjects/additions), #147 (exact specifications), #32
   (exact arithmetic), #51 (shell) and #56 (draft UI recovery).
3. **B / 1.4.1c — Review a consolidated booking quotation with exact discounts.**
   Owner selects scope, sees each package/service charge once, reviews an exact
   discount allocation and saves an immutable **not-issued** proposal. Blocked
   by A2, #119/#120 (booking/package sources) and #33 (FIN-05). Does not depend
   on payment allocation, agreement changes or a new renderer.
4. **C / 1.4.1d — Issue immutable non-tax quotations, record exact responses and
   manually share Tamil/A4 PDFs.** Owner issues one reviewed garment/booking
   proposal, recovers the same PDF and records a revision-specific response
   without activating an agreement. Blocked by B, #59/#60 (PDF/share), #169
   (domain document authorization/privacy barrier), #84 (profile) and #34
   (journal boundary regression). #170 labels are useful regression coverage,
   not a direct functional blocker.

External prerequisites are currently closed with merged source in development;
recheck each direct edge, full issue/comments, merge ancestry and current CI
when the corresponding issue is selected. Native blocking edges were installed
and read back: [A1 #173](https://github.com/nishanthturnstile/aarili/issues/173)
→ [A2 #174](https://github.com/nishanthturnstile/aarili/issues/174)
→ [B #175](https://github.com/nishanthturnstile/aarili/issues/175)
→ [C #176](https://github.com/nishanthturnstile/aarili/issues/176).
All carry `enhancement` and `ready-for-agent`. A1's five direct blockers were
closed with merged commits in development before implementation. Each issue
retains its own development-targeted PR and owner review. No later issue starts
before its direct blockers merge; no parent/map issue was created.

The split keeps A1 independently reviewable as configuration, A2 as a usable
recoverable estimate, B as a reviewable booking proposal and C as issuance.
Only C issues a quotation: number/model/business revision/audit/key/job are
atomic from the first issued quote. B does not create an issued document that
C would later enqueue in a separate transaction.

## Common acceptance and delivery requirements

These requirements form part of **each** issue, not a later hardening ticket.

- Membership/subject-authorized reads/writes/history/drafts/replays under the
  same withShop transaction and app_user; non-null shop_id, shop-led indexes,
  composite tenant/source FKs, ENABLE/FORCE matching RLS on every new relation.
- Existing actor/action/hash-bound request engine and durable origin uniqueness;
  exact retry replays, changed payload/actor/action fails, rollback leaves no
  partial business/audit/key/job effect. ETags: 428 missing, 412 stale, 409 domain
  conflict, 422 validation. Explicit price/source/scope comparison; no auto-merge.
- Strict separate incomplete draft and command schemas; existing durable
  workflow/recovery and typed Hono API clients. Framework-free core/repository
  boundaries. No Server Actions or browser business storage/cache/URL/log data.
- Preserve immutable source history and accepted prices/promises/package terms;
  published changes apply to new activity. Legitimate privacy redaction remains
  narrowly audited. No real rates, terms, costs, formulas or approvals seeded.
- English/Tamil, Current light/dark, phone/tablet/desktop, keyboard/focus/axe,
  IME-safe save, reflow, retained failed input and access-loss memory clearing.
  Record physical Android/fluent Tamil/screen-reader acceptance separately.
- Prove zero quotation-induced journal/payment/revenue/receivable/deposit,
  capacity/stock/custody/production effects using real transaction assertions.
  Customer property is never sold as shop stock; complimentary price never
  erases cost. No retail, tax, AI, portal or automated communication.
- Reviewed expand SQL under the advisory-locked runner; no historical migration
  edits or automatic approval backfill. Test upgrade with populated incumbent
  data. Back up before non-disposable schema work; retain histories/artifacts
  and compatible read/write gates on rollback, no destructive down migration.
- Run actual lint, Knip, strict types, relevant units/property and real PostgreSQL
  concurrency/negative/rollback tests, production build and focused browser/axe
  workflows. Use `pnpm verify:fast` for its existing component checks; real PG,
  PDF/browser checks are additional where specified. Full promotion verification
  remains the workflow gate. Do not silently substitute mocks or old evidence.
- Update this packet's status, design/roadmap traceability and implementation
  evidence with requirement-by-requirement proof, exact commands/environment/
  revision/dirty files, failures, exclusions and the manual-review packet.
  Record delivery timestamps prospectively in Delivery_Measurements. No PR,
  push, merge, deployment or live activation without applicable authorization.

## A1 — [W1 1.4.1a] Review effective-dated selling rates and quote policy authority

**What to build:** In Settings, the owner authors a recoverable rate draft,
reviews its exact catalogue/units/effective dates and publishes a versioned
schedule. The owner also reviews saved quotation-policy proposals through a
scoped binding, without turning on another financial capability.

**Requirements/sources:** FIN-01, SET-01/03/05/08/09, TRU-01/06/12, USE-03/08/09;
Q-01/07/10/11/13; QD-01/06/10–12. AC-40/44/55 contributions only.
**Blocked by:** #97, #87, #84, #16, #55.

**Scope and decisions:** Adopt reviewed local-date half-open schedules and
explicit pricing-date resolution, today/future publication, no retroactive
backfill, exact source identity/component/unit/basis, explicit override authority
and unavailable-history semantics. No executable pricing formulas. Add the
quote-only authority binding against exact saved owner-proposal version/hash
with immutable reviewed content, not a broad change to synthetic publication.
Initial live policy values remain absent; synthetic examples are conspicuous.

**Acceptance criteria:**

- [ ] A1-01: Save/reopen an incomplete rate with unknown amount/unit/date;
  publish only after strict owner review. Labour/material/trim/alteration/craft/
  rush components select real catalogue identities and units, not copied names.
- [ ] A1-02: Today, end-exclusive boundary, leap/year boundary, future schedule,
  gaps and unavailable definitions resolve predictably. Missing/ambiguous rates
  never choose a winner or zero. Reject overlap and incompatible unit/basis.
- [ ] A1-03: Concurrent first publication/replacement/retirement has one valid
  serialized schedule outcome. New schedule revisions retain old immutable
  entries/actor/date/hash; explicit history reads remain authorized after disable.
- [ ] A1-04: Quote policy binding pins reviewed owner content, source version/
  hash, actor/time/action scope. Changed draft/source needs new review; fixture
  rebinding, foreign references, arbitrary approved flags and unrelated-action
  activation are denied. Old policy DTOs/guards and synthetic-only history remain.
- [ ] A1-05: UI separates unconfigured/draft/reviewed/not-applicable and current/
  future/historical rates. Unknown values, invalid typed drafts, 412 comparison,
  lost-response replay, reload/second-session/IME and access loss work honestly.
- [ ] A1-06: Real PG proves RLS/missing context/pool reuse, source integrity,
  direct history mutation denial, actor/key mismatch and injected rollback after
  actual revision/binding/audit writes. Configuration produces no financial or
  order effects. Three-size bilingual/axe and prior policy/catalogue regressions pass.

**Migration/recovery:** Add immutable rate/schedule/binding relations with exact
source/draft provenance and CAS pointers; allocate migration at selection. Test
populated settings/catalogue upgrade, no production seeds, retain rows on rollback.
History correction is a new reviewed schedule/binding, never rewriting an old rate.

**Verification:** Common checks plus existing shop-policy/catalogue regressions,
new interval/property tests, real PG publish races/rollback, rate-history and
policy authoring browser tests. No quote PDF or accepted-order mutation yet.
**Review demonstration:** A synthetic blouse-labour schedule, future replacement,
gap/overlap rejection, scoped policy binding, then reload and inspect old rate.

## A2 — [W1 1.4.1b] Prepare recoverable garment estimates with private costs

**What to build:** From a draft garment, accepted order or standalone service,
the owner builds an itemised estimate, sees unanswered prices and assumptions,
keeps estimated costs private, saves and resumes, and explicitly compares a rate
refresh. It is usable without order acceptance, images or PDF rendering.

**Requirements/sources:** FIN-01/02/03/04, ORD-02/08/12/13/14, CUS-02/07,
TRU-01/03/05/06/12, USE-01–04/08/09; Q-02/03/04/06/08/10/11/13;
QD-02/03/04/10/11. AC-40/53/55; AC-50 quote contribution.
**Blocked by:** A1, #118, #124, #125, #147, #32, #51, #56.

**Scope and decisions:** Stable estimate/line identity and exact source snapshots;
draft-local components until explicit real-order mapping, no fake pieces. Selling
unknown/known/included/complimentary/excluded states distinct from private cost.
Exact integer counts/mm/rate bases and safe integer paise; fractional paise blocked.
No order acceptance/repricing, customer response or provisional issued PDF.

**Acceptance criteria:**

- [ ] A2-01: An unattached incomplete garment estimate saves before body values,
  receipt or commitment. An existing order/service estimate reopens with exact
  authorized native scope/source IDs; explicit attachment creates reviewed
  provenance and does not mutate intake or generate an order.
- [ ] A2-02: Blank price/quantity remains unknown, explicit zero remains known,
  included references name their covering charge, and complimentary price has
  a reason. Known subtotal and unknown count never become a confirmed total.
- [ ] A2-03: Customer-supplied main fabric/lining/trims carry no stock-sale charge;
  a separately authorized handling service is disclosed independently. A quote
  creates no receipt/reservation/consumption or custody event.
- [ ] A2-04: Known/nonzero or unknown internal cost survives zero/included selling
  price. Estimated and actual cost provenance stays distinct. Actual cost has
  no editable/fabricated event entry; absent authoritative consumer shows
  unavailable. Strict customer projection rejects cost/margin/production fields.
- [ ] A2-05: Count/fabric basis calculation, safe maximum/overflow and invalid
  decimal/unit/fractional-paise cases reuse existing money utilities. No hidden
  rounding or float conversion. Reviewed fixed override retains exact source,
  reason and authority. Partial known sums preserve their incomplete status.
- [ ] A2-06: Source/schedule/design/definition changes produce an explicit old/new
  diff and stale review. Refresh/revise creates a new estimate version; opening,
  UI language/mode, policy edit or catalogue disable cannot change history.
  Existing accepted prices/package terms/promises/digests remain byte-identical.
- [ ] A2-07: Same-base edits, concurrent refresh/retirement, stale source, replay
  mismatch, uncertain save, reload and second-session recovery preserve typed
  input and exact history. Real PG proves isolation, wearer/guardian revocation,
  composite source/line links, no direct history mutation and rollback.
- [ ] A2-08: Phone/tablet/desktop English/Tamil/axe/IME tests demonstrate the
  unknown subtotal, separate private panel/customer review, conflict/retry and
  memory clearing. Current custom/group/service and draft regressions pass.

**Migration/recovery:** Add estimate/version/source/line and separate private
cost/component/source records. No accepted-price update or actual-cost backfill.
Upgrade existing packages/services; rollback retains estimates and gates older
unsupported readers without deleting their immutable versions.

**Verification:** Common checks, new exact arithmetic/unknown-state properties,
real PG estimate/source/guardian/CAS tests, existing money/Quick/group/small-service
regressions and focused estimate browser/axe. Poison customer DTOs with private
fields and prove they are absent by construction. PDFs remain C acceptance.
**Review demonstration:** An unknown blouse labour rate, customer fabric,
complimentary hook work with known cost, saved/reopened estimate and rate-change diff.

## B — [W1 1.4.1c] Review booking quotations with exact consolidated discounts

**What to build:** Select a booking's exact garment/service scope, review one
canonical price graph, apply authorized discounts and inspect garment attribution.
Save an immutable reviewed quotation proposal that is clearly not issued and
cannot overwrite an existing agreement.

**Requirements/sources:** FIN-02/03/04, shared FIN-05 arithmetic, ORD-02/12/13/14,
SET-05/08, TRU-01/03/06/12, USE-08/09; Q-03–08/10/11/13;
QD-03–07/10/11. AC-01/07/50/63 quote contributions, AC-40/55.
**Blocked by:** A2, #119, #120, #33.

**Scope and decisions:** One canonical charge/inclusion graph, exact package
and accepted-addition IDs; stable sequence. Discount order is line then booking
on remaining eligible charges; fixed paise or whole bps with exact result only.
Default attribution is existing FIN-05 with explicit caps and zero-base handling.
Reasoned manual attribution must be policy-authorized, exact and nonnegative.
One selected current proposal per overlapping scope, explicit alternatives/
supersession; agreement application unavailable until 1.4.3.

**Acceptance criteria:**

- [ ] B-01: Garment-only and selected multi-garment/service proposals derive from
  the same line facts. Package amount replaces covered garment reference totals;
  outside-package accepted services count once. Piece breakdown sums to parent
  price and is display-only when not independently charged.
- [ ] B-02: Duplicate source/charge IDs, overlap, cross-order pieces, partially
  selected indivisible packages, inclusion cycles/multiple parents and unknown
  selling amounts block complete review. Identical labels on distinct subjects
  remain distinct; display sorting does not change allocation tie order.
- [ ] B-03: Fixed/percentage line and booking discounts apply exactly once, meet
  the exact current authority/eligibility/stacking policy, never discount an
  included/zero row twice and never make a charge negative. Retain exact bases,
  amount, policy and owner reason. Invalid fractional paise blocks, no rounding.
- [ ] B-04: FIN-05 whole-rupee floors and largest-charge/earliest remainder match
  properties and examples including paise. Positive zero-base discount is
  blocked; zero is a no-op. Over-cap remainder (three one-paise lines/two-paise
  discount) is blocked unless explicitly replaced by a reasoned valid manual
  allocation. No silent cap/alternate remainder algorithm or customer credit.
- [ ] B-05: Optional shared estimated-cost attribution reconciles to source and
  retains private provenance. Zero selling base leaves private cost unattributed;
  no fabricated weight/actual expense. Customer projections include no costs.
- [ ] B-06: Two garment/booking proposal writers for overlapping scope serialize.
  Immutable proposal revisions keep their base and reason; alternatives and
  explicit predecessor lists never present contradictory totals as one agreement.
  Same-key/lost-response/reload and expired-key uniqueness preserve one result.
- [ ] B-07: Comparison to accepted package/service/intake price is visible. Saving
  a different proposal never applies it to an order, date, demand, approval or
  journal. Unsupported existing agreement state cannot bypass a governed change.
- [ ] B-08: Real PG RLS/source/CAS/inclusion guards and fault rollback pass;
  generated graphs reconcile exact totals without duplicate charges. Three-size
  bilingual/axe tests show package/reference/extra rows, discount attribution,
  alternatives, unknowns, stale comparison and recoverable drafts.

**Migration/recovery:** Add proposal/version/scope/inclusion/discount/attribution
and scope-selection history with relational guards; reference incumbent package/
service records without rewriting them. No quotation number/document job yet.
Compatible rollback retains unissued proposals, historical source digests and costs.

**Verification:** Common checks plus FIN-05/money unit properties, generated
commercial graphs, real PG overlapping scope/package/service races and rollback,
existing grouped/service-addition regressions and booking-review browser/axe.
**Review demonstration:** Synthetic package with two reference garment amounts,
one outside service, a line discount and booking discount; switch garment and
booking views, inspect exact attribution, save/reopen an alternative.

## C — [W1 1.4.1d] Issue, recover and manually share immutable non-tax quotations

**What to build:** From one complete reviewed proposal, the owner chooses Tamil
or English and issues an immutable numbered quotation with an A4 PDF. Failed
rendering is visible and retryable without a new issue. Private preview/download/
manual sharing use stored bytes. Record a revision-specific owner-attested
customer response without creating an agreement or financial event.

**Requirements/sources:** FIN-01–04, FIN-21 exclusion boundary, SET-05/08/09,
ORD-12, TRU-01/03/05/06/07/08/12, USE-01/02/07/08/09, COM-04/06/07/08;
Q-06–14; QD-06–11. AC-07 historical, AC-38/40/44/53/55; AC-56 controls reused.
**Blocked by:** B, #59, #60, #169, #84, #34.

**Scope and decisions:** C is the first issued quotation. Approve QD-08's
quotation-only numbering convention; live sequence/format/template decisions
remain gated. Freeze source/customer projection and enqueue rendering in the
same issue transaction. Reuse trusted renderer/fonts/worker/private authorization
and extend audited document erasure/purge. Response evidence is exact-revision
owner attestation; no customer signature, payment, general change control or
production approval. No unknown-price provisional issued quotation.

**Acceptance criteria:**

- [ ] C-01: Issue rechecks all exact source/availability/price/policy/profile/
  scope versions, known quantities/prices, assumptions, non-tax status, validity,
  discount attribution and current rights. Source changes invalidate review;
  receiving accounts, material receipt and payment verification are not quote gates.
- [ ] C-02: Per-shop/type locked number, immutable quote revision/customer model,
  predecessor/family/scope binding, document revision, audit/key and locator-only
  render job commit together. Real same/different-key/concurrent issues create
  one issue per proposal; changed payload or stale scope fails. Transaction
  rollback creates no issued result; committed number survives render failure,
  withdrawal/void and request-key expiry without recycling.
- [ ] C-03: Pending/rendering/failed/ready states and safe retry use exact frozen
  data/assets, not latest rates. Worker reauthorization, restore epoch, privacy
  barrier, lease/fence and acceptance checks deny stale/revoked work. Test queue
  rollback, lost commit response, storage outage/partial failure and retry races.
- [ ] C-04: Old quote content and stored PDF hash/bytes survive rate/policy/profile/
  template/font edits. Historical retrieval is exact and current-rights checked;
  missing bytes show unavailable, not rerender. New revision/number has explicit
  reason and predecessor. Source erasure revokes/fences/purges exact artifacts
  while keeping required nonpersonal provenance and tombstones.
- [ ] C-05: Approval/rejection records bind exact issued revision/hash, respondent,
  owner recorder/time, response time/channel and minimal evidence. Correcting/
  withdrawing appends history. Pending/shared is never approved; old/expired/
  superseded responses cannot approve a new revision. No response mutates accepted
  prices/design/date/production or creates a payment/receivable/revenue event.
- [ ] C-06: Strict customer model/template/hidden text/metadata/filename/share
  scans exclude private costs/margins, actual-cost sources, measurements/fitting
  media, production notes, GSTIN/tax/0% GST, due balance and payment links.
  Customer-supplied materials and inclusions are clear; discounts and total
  reconcile with B. Document is visibly a quotation, not a bill/receipt.
- [ ] C-07: Actual English and Tamil A4 PDFs cover single/multiple garments,
  package plus extras, long descriptions/names/terms, zeros/paise/large supported
  amounts and multiple pages. Render every variant to images; inspect all pages
  for Tamil shaping, readable arithmetic, headers/page breaks and 210×297 mm
  geometry. Preserve existing goldens; approve new references only after review.
- [ ] C-08: Prepared private PDF opens/previews/downloads; explicit native file
  gesture cancellation/failure never marks sent. Desktop/unsupported path offers
  manual download/attachment and separate optional WhatsApp text action. Actual
  bytes/hash are reused; marked sent is owner-attested, never delivery/read/approval.
  Automated research/tests send no real messages.
- [ ] C-09: Real PG/app_user/RLS/foreign subject/missing context, privacy revocation
  before read/replay/render/share and race/rollback tests pass. Poison source
  fields cannot enter customer outputs. Quote response/issue effects leave
  journal/payment/stock/custody/capacity/production counts and balances unchanged.
- [ ] C-10: Phone/tablet/desktop English/Tamil and both themes pass browser/axe,
  IME/conflict/lost-response/retry/status/access-clearing flows. Record fluent
  Tamil, physical Android/low-memory/Web Share and owner template review as
  pending until actually performed, with usable review URL and cleanup steps.

**Migration/recovery:** Add quotation number/issue/document binding/response and
audited privacy intent relations, with composite FKs/forced RLS/immutable guards.
Document pipeline remains canonical. Upgrade populated jobs/documents/orders;
rollback compatible source only, retaining numbers, bytes, frozen models and
response/audit history. No live migration, generic retention implementation or
backup privacy compliance claimed by this slice alone.

**Verification:** Common checks plus real queue/PG/storage/renderer integration,
domain document erasure/retry/restore races, accepted-price regressions, response
properties, all-page PDF visual/golden/font inspection, customer-content artifact
scans and focused private-sharing browser/axe. Reuse #34 as a no-posting baseline,
not a reason to add quotation journal accounts. Full pilot/restore/human gates remain.
**Review demonstration:** Issue Tamil package quotation, simulate render failure,
retry/download same hash, cancel share, record rejection of exact revision,
issue a revised proposal and show unchanged old PDF and prior response.

## Review response and next authorized step

Review QD-01–12 and the four outcomes above. In particular confirm the exact-only
arithmetic restriction, date/no-backdating convention, discount cap/manual
attribution behaviour, overlapping-scope handling, policy binding, no provisional
issued prices, numbering and response/agreement seam. Production rates/terms/
discount limits/expiry/complexity values are deliberately not proposed as defaults.

Suggested response: `QD-xx — approve/change — observation; packet — approve/
split/merge — observation; publish — yes/no; select — A1 or issue number`.
The [tracker](issue-tracker.md) and [workflow](Development_Workflow.md) require
concrete breakdown approval before publication and a selected approved issue
with merged direct blockers before implementation. No old feature approval is
reused as approval of these new decisions. Granularity/edges can be revised
without publishing placeholder issues or starting speculative code.
