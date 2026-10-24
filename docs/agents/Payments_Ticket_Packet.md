# Payments 1.4.2: concrete ticket packet

24 October 2026. **Owner approved PD-01–08 and this complete packet; published
[A / #181](https://github.com/nishanthturnstile/aarili/issues/181),
[B / #182](https://github.com/nishanthturnstile/aarili/issues/182) and
[C / #183](https://github.com/nishanthturnstile/aarili/issues/183). A selected.**
Read [PD-01–08](Payments_Design.md), [research](Payments_REA_Evidence.md) and
[verification/status](Payments_Implementation_Evidence.md). Native blockers were
installed and read back. A's nine prerequisites are merged into development.
B waits for A's merge and C waits for B's merge; no merge/deployment/live approval.

## Proposed sequence and decisions

1. **A / 1.4.2a — Record and explicitly confirm a receipt with recoverable credit.**
2. **B / 1.4.2b — Allocate confirmed credit against agreed charges and review reallocation.**
3. **C / 1.4.2c — Record split-method batches and attach private payment evidence.**

Each is a complete owner journey through contracts/core/repositories/API/client/UI,
not a horizontal schema-only ticket. Start A only after approval/selection and
fresh blocker checks; B waits for A's merge, C waits for B's merge. Each retains
its own PR to development from that checkout's refreshed development branch.
Use enhancement and ready-for-agent only after approval; install native blocker
relationships and read them back at authorized publication. Do not create a parent
issue merely to group this packet.

Approval must explicitly cover PD-01–08, especially conservative UTR normalization,
electronic-clearing posting vocabulary, inactive-account restriction, service-change
charge eligibility and rejection rather than silent clipping of infeasible FIN-05
shares. Bank/other receipt-confirmation policies and live accountant/retention
approval remain separate gates. Generic quote acceptance/base/package repricing
is not smuggled into B: its adapter waits for 1.4.3's approved exact source.

## A — Record and explicitly confirm a receipt with recoverable credit

**Traceability:** FIN-10/11/12/13, FIN-05 zero-source/no-agreement boundary;
P-01/02/03/07/10/11/12; AC-61, limited AC-18 and AC-03/04/60/62 contributions.
Sources: product §§6–7, 9, 17, 24–25, 27, 29.1, 30.1, 32–33;
architecture §§6–11, 13, 15; roadmap 1.4.2 and PD-01–05/08.

**Direct blockers to publish:** #176 (quotation dependency), #32/#33/#34 (money,
FIN-05 and journal), #16 (command/idempotency), #55/#56 (draft/recovery), #86
(receiving directory), #36 (restore guards). All are currently closed; recheck
their actual merge ancestry and CI/comments before starting. Read current native
dependencies, not historical evidence headings. A / #181 is selected; admission verified every prerequisite merge in ancestry.

**Outcome:** owner saves an incomplete server draft, records a pending report or
deliberately confirms actual cash/UPI receipt, resolves lost responses, reopens
immutable facts and sees confirmed customer credit separately from pending.
Booking/garment intent does not establish agreed charges or auto-allocate.

**Scope and acceptance:**

- A1: distinct draft/command schemas, versioned durable workflow and typed owner
  surface. Positive safe paise, date/timezone provenance, explicit customer credit
  owner/payer/recipient/scope, enabled method and reviewed destination identity.
  Missing/stale preconditions are 428/412; invalid input 422; domain conflict 409.
- A2: pending produces no posting; failed has reason/history. Cash selection alone
  stays pending; deliberate cash receipt action and account-bound UPI attestation
  post one deposit receipt. Bank/other confirmation shows its policy blocker.
  Screenshots/QR/account setup cannot confirm. Account changed/deactivated since
  review requires fresh review or denies; historical inactive confirmation blocked.
- A3: database UTR claim covers the shop across accounts/bookings; raw/private
  comparison provenance, absent-reference behaviour, terminal-history retention
  and duplicate-original resolution follow PD-03. Never reject solely on identical
  amount/date. No financial ownership transfer through contact merge/relink.
- A4: one membership-bound transaction contains state/history, source-unique balanced
  posting, audit and outer/inner idempotency results. Distinct stable inner journal
  key prevents collision with outer actor/action binding. Same-key exact replay,
  changed payload/actor/action, different-key same-component confirmation and UTR
  races cannot create another posting. A lost committed response reopens the result.
- A5: freeze/epoch/practice controls and lock order are in effect from the first
  money command. Confirmed fields cannot be edited/deleted. Reads still distinguish
  pending, confirmed and unavailable reversal/refund actions. Entire receipt is
  explicit unallocated credit before B; no revenue or fictitious receivable.
- A6: English/Tamil phone/tablet/desktop, keyboard/axe, full money/status labels,
  retained input after failure and original-key recovery. No business browser
  persistence, URLs/logs with references, private costs or automated messages.

**Migrations/recovery:** next available reviewed additive migration at admission
(do not reserve a stale number now): receipt identity/revisions/events, confirmation,
UPI claims and source references; additive journal electronic asset vocabulary and
position reader extension. Every tenant row has shop-led keys/indexes, composite
FKs, matching FORCE RLS and app_user constraints. Add database immutability,
source/confirmation uniqueness and balanced-posting guards. No legacy advance
backfill, status inference or destructive down migration. Upgrade a populated
predecessor; preserve old readers or block incompatible application rollback.
Backup before authorized retained-volume schema/money migration; none in development.

**Verification:** focused unit/property and real PostgreSQL app_user tests for all
A1–A6, cash/UPI/no UTR, cross-account duplicates, account deactivation, stale versions,
membership revocation/pool reuse/cross-shop/customer guesses; confirm/confirm,
same-UTR inserts, missing controls, freeze/epoch transition races, lost response
before/after commit and failure injection after each audit/journal/key write.
Existing money/journal/restore/directory/draft/customer-history/quote/order regressions.
Run repository lint, Knip, types, relevant tests, negative types/OpenAPI and build;
browser/axe in English/Tamil at three sizes. No mock-only atomicity/RLS claims.

## B — Allocate confirmed credit and review reasoned pre-bill replacement

**Traceability:** FIN-05/12/13, FIN-10/11 continuity; P-04/05/06/07/10/11/12;
AC-17/49, AC-18 with a real foundation billing fixture, AC-61 regression;
limited AC-03/04/60/62. Same source sections as A plus PD-05–06/08.

**Direct blockers:** A merged; #125 accepted service additions, #119/#120 booking/
package provenance and #34 journal, #33 FIN-05. Existing prerequisites are closed;
A / #181 is on its review branch, not merged. 1.4.3 is a **capability gate for base/package agreed charges**,
not an excuse to prevent supported service-addition allocation or receipt entry.
Recheck source evidence/merge/CI and native relationships before admission.

**Outcome:** select confirmed customer credit, see authoritative known charges and
unsupported proposals separately, review default or reasoned manual allocation,
commit once and reopen exact line funding/remaining/credit with immutable history.

**Scope and acceptance:**

- B1: exact service-change source adapter admits only the attested known-price
  supplemental lines described in PD-05. Pins IDs/digests/line/profile/review/
  commercial/discount basis and persisted stable order. Unknown, initial intake,
  merely accepted work, quotation/issued quote and package reference amounts do
  not become agreed charges. No eligible source leaves all money as credit.
- B2: unchanged FIN-05 function proves 400/600, 334/333/333, paise/tie examples,
  zero-total credit, determinism and input immutability. Review uses frozen agreed
  weights, never remaining weights/UI sort. Excess remains customer credit.
  A share beyond remaining capacity rejects without clipping/redistribution;
  manual reasoned selection may be reviewed separately. Package/add-on count once.
- B3: confirmed source availability and target capacity checked under locks with
  SQL backstops; no negative credit or cross-customer/shop target. Persist immutable
  allocation set/lines with source and agreement provenance, audit and key together;
  no new receipt/revenue journal posting. Concurrent allocate/allocate cannot spend
  the same credit or line capacity twice; exact lost-response replay is readback.
- B4: pre-bill manual replacement requires reason; linked old-set reversal and
  new set commit atomically and reserve/release capacity once. Preserve old records
  and weights. Any old/new issued or unknown billing status denies. Billing status
  repository contract is real source-bound data, tested with foundation fixtures;
  do not invent a billing product or a UI toggle to assert unbilled.
- B5: explicit agreed/proposed/unknown charges and discounts, pending reports,
  confirmed receipts, allocations, remaining amounts and unallocated source credit.
  INR 2,000 billing fixture + INR 700 confirmed + INR 500 pending stays INR 1,300;
  confirmation/allocation gives INR 800 once. No full-booking Paid from paying an
  extra while the base agreement is unknown. No new tax/refund/receipt PDF workflow.
- B6: every source/target/history read is currently authorized, including replay;
  payment doesn't waive production/material/approval gates. Quote revisions don't
  refresh historical weights or trigger reallocation. Freeze/epoch guards apply.

**Migrations/recovery:** additive agreed-source bindings and append-only allocation
sets/lines/reversal links; tenant/source/target FKs, source-set uniqueness, immutable
history and capacity enforcement. Persist stable sequence and available/billing
guard seam. Test upgrade with prior receipts, partial funding and mixed unknown
charges; never fabricate agreements or allocated legacy amounts. Compatible rollback
retains history; halt incompatible writers rather than erase financial events.

**Verification:** unit/property invariants plus real PostgreSQL allocate/allocate,
source/target over-allocation, different-key retries, reallocation/reallocation,
allocation/reversal where supported, allocation/agreement change and reallocation/
billing-issue guard races; pending/failed/excess/zero/partial prior funding, package
parent/member duplicates, ownership/isolation, rollback and freeze/epoch. Reproduce
AC-17/49 and fixture AC-18 with exact paise readback. Quote/order/package/addition/
customer-history/journal regressions; repository final checks and three-size
bilingual browser/axe. Boundary fixtures do not claim later billing UI is delivered.

## C — Split-method batches and private evidence

**Traceability:** FIN-10/11/12/13; P-08/09/10/11/12, AC-61 and relevant AC-18
continuity, USE/TRU privacy/recovery. Same authority as A plus PD-07–08.

**Direct blockers:** B merged; #57/#58 private uploads/processing, #136 customer
history. Recheck merged source and current native blockers at admission. C keeps
A/B invariants; no separate duplicate detector or account directory.

**Outcome:** review cash/UPI/etc. components once, record a recoverable batch,
confirm supported components deliberately and reopen accurate mixed confirmation,
allocation/credit and authorized evidence/history from payments/customer surfaces.

**Scope and acceptance:**

- C1: stable component identities and exact derived batch total; parent never posts
  or supplies funds. Batch + selected initial cash receipts all commit or all roll
  back; UPI pending until explicit account-bound confirmation. Later confirmations
  are component commands; an explicit selected-subset batch command is atomic.
- C2: partly confirmed totals count only confirmed components. Retry/reload cannot
  create another component or parent posting; duplicate UTR within/across batches
  denies without partial writes. Distinct legitimate instalments remain separate.
- C3: payment evidence purpose binds authorized receipt subject and shop key;
  processing/quarantine, revocation, signed access, privacy purge/tombstones and
  retention use existing infrastructure. Upload failure never proves/disproves
  bank receipt and never confirms automatically. No OCR or reference extraction.
- C4: customer/booking/garment/payment views reconcile to A/B sources and allocation
  history with proposed base charge uncertainty retained. Payment/contact ownership
  cannot silently follow a contact merge. Screenshots/UTRs/account identifiers never
  enter persistent client caches, URLs, logs or committed research fixtures.

**Migrations/recovery:** additive batch/component relations, purpose-authorized
private evidence links with composite tenant FKs/FORCE RLS, registry/privacy
allowlist extensions and immutable origin uniqueness. No historical grouping or
automatic evidence-to-receipt backfill. Compatible readers must retain independent
components if the batch surface is rolled back; no deletion of posted sources.

**Verification:** real PostgreSQL batch atomicity, same/different-key component
races, duplicate claims, partial confirmation, allocation of confirmed subset,
injected upload/processing/commit faults, epoch/freeze and other-shop/denied media
access; private processing/purge/history regressions. Three sizes, English/Tamil,
keyboard/axe and lost response before/after component commit. Repository final
checks, relevant money/media/quote/order regressions and production build.

## Common publication, review and completion contract

Before each issue: full body/comments/native blockers; merge ancestry and required
CI; source/policy authority, current migration number and populated upgrade plan.
Recheck current docs with ctx7 for library-specific implementation; no baseline
upgrade, redundant ledger or financial Server Action. API is thin Node Hono,
framework-free core and existing membership-bound withShop repositories. Register
new workflows and restrictions in existing registries and CI tenant catalog.

Each delivery updates requirement-by-requirement evidence, roadmap traceability,
Delivery_Measurements timing and a running synthetic manual-review packet: startup/
URL/private access, exact P/A/B/C steps and expected result, pass/fail observation
format, evidence links and owned-host teardown. Human policy, Tamil/physical Android,
screen-reader/accountant and recovery/pilot acceptance stay explicit. No full
1.4.2 completion after A or B. No issue publication, PR, merge or live activation
is implicit in preparing or pushing this packet.
