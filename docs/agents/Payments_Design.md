# Payments: independent design for 1.4.2

24 October 2026. **Owner approved PD-01–08 and the A–C packet; A / #181 selected
for implementation.** [Research](Payments_REA_Evidence.md), [concrete packet](Payments_Ticket_Packet.md),
[verification/status](Payments_Implementation_Evidence.md), [brief](Payments_REA_Prompt.md).
This design does not approve business policies, accounting mappings or live use.

## Authority and baseline

Product §§3, 6–7, 9, 17, 19, 24–25, 27, 29.1, 30.1, 32–33 govern behaviour;
architecture §§6–11, 13 and 15 govern technology. FIN-05/10/11/12/13 are primary.
The roadmap's 0.2.3, 0.4.1, 0.3.1 and 1.4.1 dependencies remain unchanged.
Receipt PDFs/bills (1.4.4), general agreements (1.4.3), refunds/adjustments (1.4.5)
and day-close reconciliation retain their own gates. No baseline amendment.

Development `94d6dfa` includes quotation PRs #177–#180, all freshly confirmed
merged. The preparation inventory originally contained only Dependency Dashboard #28.
After owner approval, #181–#183 were published with native blockers; A is the
selected issue. Old pending headings
in prerequisite evidence are historical, not current merge authority.

Reuse [quotation design](Quotations_Design.md), [quotation evidence](Quotations_Implementation_Evidence.md),
[shop settings](Shop_Settings_Design.md), [receiving directory](Shop_Directory_Implementation_Evidence.md),
[commercial policy authority](Shop_Policies_Implementation_Evidence.md),
[Quick Order](Quick_Order_Design.md), [grouped bookings](Grouped_Bookings_Design.md),
[service additions](Service_Additions_Implementation_Evidence.md),
[FIN-05](Issue_33_FIN05_Allocation_Evidence.md), [journal](Issue_34_Balanced_Journal_Evidence.md)
and [restore](Issue_36_Restore_Guards_Evidence.md). Current source was inspected
directly: Codebase Memory has no index matching this checkout, and no graphify
graph exists here. No new index, tool, package or worktree was created.

## PD-01 — Financial identity and exact values

A receipt belongs to one shop and one explicit customer credit owner. Payer may
be a different identified contact; wearer and guardian remain separate. Optional
booking/order scope describes intent, not allocation or authority. Initial shared
booking support uses existing same-contact membership. No family-wide balance,
shared-phone inference, cross-customer allocation or automatic transfer on merge.
Existing relinks must block unsupported financial ownership changes, preserving
original attribution. Reject another shop/customer's guessed source IDs.

Record recipient business separately from receiving destination, amount, enabled
method, payment local date, recorder, source reference, evidence pointers and
server UTC recording/confirmation instants. Pin shop timezone revision for dates.
Cash requires enabled cash configuration; UPI/bank requires an active matching
configured destination. Historical inactive/unapproved-account confirmation is
blocked in the first delivery pending a separate historical-recording decision.
It never substitutes today's destination. Configuration is not receipt proof.

Use `packages/money/src/index.ts`: `parseRupees`, checked bigint arithmetic,
`fromBigint`, safe wire/PostgreSQL converters and `allocateFin05`. Each component
is positive exact integer paise within the existing safe wire range; reject
overflow of a command/batch total before writing. Empty stays unknown, zero is
invalid for a receipt, and no floating arithmetic or invented UTR is allowed.
Derived cumulative amounts use exact serialization consistent with existing
service scope readers, not unsafe JavaScript number sums.

## PD-02 — Receipt state and deliberate confirmation

An unsaved form or durable draft is not a payment. Promotion creates an immutable
reported/pending component and its history. It creates no journal receipt.
Pending can transition once to confirmed or failed with reason/evidence. Correct
pending facts by a reasoned successor linked to the original; no silent rewrite.
Failed is terminal in this slice: a correction must remain linked and cannot
escape duplicate-reference review. Confirmed amount, method, owner, destination
snapshot and date are immutable. Confirmation adds actor/time/attestation and one
journal source; a repeated confirmation returns the original confirmation fact.

Cash has two deliberate actions: **Record as pending**, or **Cash received —
record and confirm** with an unchecked receipt attestation. Selecting Cash alone
does not confirm. UPI uses **I saw this payment in the configured UPI/bank account**
after safely displaying its destination label/masked identity and exact revision.
Screenshots, customer statements, QR codes and upload success never confirm.
Bank/other enabled methods may be reported pending; their confirmation remains
blocked until the method-specific owner/accountant policy is approved. No
automatic verification, provider call, OCR or bank application automation.

Capture current active destination revision under the directory lock at
confirmation; if it differs from the reviewed revision, require explicit review.
Account deactivation before confirmation denies; deactivation afterward does not
rewrite confirmed history. Upload failure/quarantine does not invalidate an
independently attested receipt. Missing lining/trims/material/capacity requirements
must not block truthful receipt; payment cannot release those other gates.

Reversed/refunded are distinct eventual linked facts. First delivery exposes no
receipt reversal, confirmed edit/delete, refund liability or settlement command.
Do not present an unperformed reversal/refund as completed. Until 1.4.5 supplies
its authority, explain that confirmed correction is unavailable. Ticket B permits
allocation reversal/replacement only; this is not reversal of received money.

## PD-03 — Duplicate references and durable retries

Proposed UPI normalization for approval: preserve the raw private reference;
remove surrounding ASCII whitespace for the comparison key only, with exact
case-sensitive comparison. Do not strip punctuation/interior characters, fold
case, require a guessed UTR digit count or apply UPI uniqueness to other-method
references. Blank is absent, not a shared empty key. Review this conservative
rule before implementing it; more normalization requires a separate decision.

Use a non-partial database unique key `(shop_id, upi_reference_key)` on durable
reference claims linked to one receipt component. Scope includes all bookings,
payers and destination accounts. Failed, reversed, archived and redacted history
must not release the claim. Any legitimate correction keeps the original identity
and review link; it cannot mint a second receipt. Privacy erasure needs an approved
non-reversible keyed duplicate marker/tombstone strategy, never a plain UTR hash
assumed to be anonymous. Retention approval is required before live use.

The same actor/action/key/canonical request hash replays its exact durable result;
changed actor/action/payload returns existing **422 IDEMPOTENCY_MISMATCH**. Binding
includes attestation, account/source versions, amounts and intended restore epoch.
Different keys confirming the same component return its existing confirmation,
without another journal batch or reapplying allocations. Another component with
the claimed UTR conflicts (409) and offers authorized original-record resolution.
Never disclose another customer's details through the duplicate response.

After a lost response, resolve/replay the existing command key. Keep detached
pending requests and input in memory using existing draft recovery. Reload resumes
the server draft/origin result; never invite another receipt to recover a timeout.
Missing UTR permits legitimate repeated amounts/dates: show possible ambiguity
without merging or blocking solely on those fields. Local idempotency cannot
deduplicate two distinct unidentified real-world receipts or prove bank settlement.

## PD-04 — Existing journal composition and restore boundaries

Reuse `core/journal.ts::postJournal` and `db/journal-repository.ts`, their source
uniqueness, deferred balancing/immutability guards and audit. Confirmation posts
asset debit and customer deposit credit; allocation alone posts no revenue,
receivable or second receipt. An advance stays a liability even when allocated.
The current account vocabulary is only cash/receivable/revenue/deposit/refund.
Proposed additive electronic-clearing asset account needs schema/type/position
extensions and reviewed posting mapping; do not mislabel bank receipts as physical
cash or build a second ledger. Accountant approval remains a live activation gate.

The payment command has its own actor/action/hash result. `postJournal` also
persists an idempotency binding: **do not pass it the outer payment key**. Persist
a distinct server-created inner journal command key with the confirmation intent;
retries use that same key and stable component source ID. Both keys, receipt,
journal, audit and applicable jobs commit in the same `withShop` transaction.
No success before commit; faults after each write leave none of these effects.

Acquire restore shared lock through `requireUnfrozenMoney` before financial
entity locks; missing/frozen controls and practice money deny. Existing
`effectDenial`/`guardedEffect` cover outbound kill switch, epoch and quarantine,
not a substitute for money freeze. No outbound job is needed for receipt entry.
Bind new confirmation/allocation commands to authoritative epoch under that lock;
an obsolete uncommitted intent requires review after restore. An already committed
exact-key readback may return its original result after authorization while frozen,
but cannot insert a new key, confirmation or allocation. Any future jobs use the
existing epoch/quarantine mechanism and reread current state.

Proposed lock contract for all payment writers: restore shared lock; outer/inner
command locks in stable key order; directory aggregate when required; existing
booking and ordered order aggregates; customer financial scope; ordered receipt
sources and agreed-charge scopes; journal subject. Reuse existing lock namespaces,
and pre-acquire the inner key before entering `postJournal` so its internal key
lock cannot invert the order. No other path may enter these classes backward.
Ticket tests must prove compatibility with current directory/order/identity locks;
future agreement/billing commands must take the same financial source locks.
Recheck membership/identity/current versions, account, charge authority, available
source and line capacity inside the locked transaction. Database uniqueness plus
append/foreign-key/aggregate guards back service checks; mocks are insufficient.
Retry an aborted deadlock/serialization transaction with the same intent/key,
bounded by existing retry conventions; stale/conflicting business state needs
review, never auto-merge or another payment key.

## PD-05 — Exact agreed-charge source, not quotation status

Inspected `contracts/orders.ts`, `core/group-intake.ts` and the approved Quick
Order/group designs: `pricePaise` is quoted intake, `packagePaise` is a package
proposal, included rows have `allocationPaise: null` and `referencePaise`. Acceptance
of work or grouping does not establish customer price agreement. Issuing an
immutable 1.4.1 quotation also does not establish it. No payment action may add
an agreement flag, accept a quote or silently turn these prices into weights.

A bounded supported source exists for **post-acceptance service changes**:
`core/service-changes.ts` requires fresh `reason`/`agreement`, binds the reviewed
line prices/scope into a fingerprint and persists `ServiceChangeContent` with
digest and immutable lines. Small_Service_Design's accepted-addition attestation
explicitly covers the quoted price where known. Ticket B's adapter may admit
only those exact accepted, attested, known-price additional/outside-package
lines, after checking recorded agreement and complete review provenance. Source
tuple: shop/customer/order, service-change ID and digest, original/previous scope
digest, stable accepted line ID, pinned profile revision, review fingerprint,
commercial/membership revision and stable sequence. Unknown prices, missing
attestation, initial-intake add-ons, included reference prices and drafts fail
closed. Completion attestation is not price-agreement authority.

No existing discount is inferred on these supplemental sources: their frozen
accepted `pricePaise` is the exact charge (explicit zero remains zero). Any later
agreed discount must have its own governing revision before becoming a net weight.
No estimate/quote discount or percentage is copied into payment calculations.
General base-order/package agreement and package member weights remain 1.4.3.
Show unsupported base amounts separately as proposals with **Agreed amount not
established**; never show a fully settled booking when only an agreed extra is paid.
If no eligible charges exist, preserve the entire confirmed receipt as credit.

## PD-06 — Allocation without hidden capacity changes

The owner reviews the explicit eligible source set, frozen net agreed-charge
weights, stable persisted order, existing funding, proposed allocations and credit.
Default calls existing `allocateFin05` on that stable sequence, never UI sorting.
Floor proportional shares to multiples of 100 paise; ALL remaining rupees AND
paise go to the largest-charge line, earliest stable line if tied. Required
examples: charges 100000/150000 paise, source 100000 -> 40000/60000; three 70000
lines, source 100000 -> 33400/33300/33300. For source 100001 on the latter,
result 33401/33300/33300. Zero total charges leaves everything unallocated.

`allocateFin05` distributes the entire input and does not cap line charges. The
orchestrator separately checks source availability and remaining line capacity.
Proposed default amount is at most source availability and total remaining
eligible capacity; retain excess as credit. Use **original agreed weights**, not
remaining-balance weights. If the exact default exceeds any line's remaining
capacity, reject that allocation preview/commit; do not clip, iterate redistributing
or silently substitute another rule. Preserve credit and offer explicit lower
amount review or a manual allocation with reason. Even full-value proportional
allocation can exceed a small line by rounding; this guard applies there too.
This bounded conflict policy needs packet approval; no invented new FIN-05 rule.

Manual allocation requires reason, explicit nonnegative per-line amounts, exact
sum to the selected allocated amount and the same source/capacity checks. Every
confirmed paise is allocated once or remains source-owned credit. Parent package
and included members cannot both be targets. A source can fund several eligible
lines/bookings for the same authorized customer, never another credit owner.
Future package/member adapters must supply agreed weights before use.

Pre-bill reallocation appends a reasoned reversal of the prior allocation set and
a replacement set atomically, preserving both and the underlying receipt.
Reserve/release capacity only through linked append-only events; prevent a second
reversal of the same set. Lock old/new sources and targets together. Any issued
bill affecting an old or new target denies ordinary reallocation. Before 1.4.4
exists, add/test a source-bound billing-status repository seam using real
foundation fixtures; missing/unknown status denies, never assume unbilled.
After issue, only later governed adjustments may act. Quote/scope revisions cannot
automatically refresh weights or move money.

## PD-07 — Split batches and private evidence

Ticket C groups stable component IDs; the parent has no journal posting or
independently spendable funds. Persist the reviewed batch/components atomically
or none. An explicitly selected initial cash-confirm subset posts atomically
with batch creation; UPI/unapproved-method components remain pending. Thereafter
confirm each component with its own key/attestation; one failure does not undo an
already committed sibling. Derive mixed/partly confirmed/fully confirmed totals;
do not call a partly confirmed batch Paid. A selected multi-component confirmation
command is all-or-nothing within that command. Duplicate UTR in/between batches
denies before any partial posting. Instalments are separate traceable receipts.

Evidence uses existing private upload/processing, immutable shop-prefixed keys,
purpose-bound receipt subject authorization, signed links, retention and audited
purge/tombstones. Extend the purpose registry only in C. Quarantined/revoked media
cannot be opened; its status never changes money. Protect unrelated banking
content; no UTR/account/screenshot values in logs, URLs, browser storage, analytics
or committed screenshots. No real data, messages, transfers, receipt numbers or PDFs.

## PD-08 — Owner surface and transparent derived position

Extend the existing owner shell with Payments and entry points from customer,
booking and garment detail. Use Current light/dark tokens, Base UI controls,
self-hosted Noto Sans/Tamil and memory-only query cache invalidation on access
loss/sign-out/shop switch. Start English; explicit Tamil switching retains input.
No shell/identity redesign. Initial view leads with **Needs confirmation** and
separate confirmed credit; avoid a combined collected/revenue headline.

Form: customer credit owner/payer and intended scope; exact amount/date/method;
configured destination and optional private reference; review; distinct pending
versus explicit receipt confirmation. Readback always shows saved state, account
snapshot, original receipt and immutable confirmation/history. Stale 412 prompts
comparison, missing If-Match is 428, domain conflict 409, invalid data 422. Failed
saves preserve input and focus; uncertain saves resolve the original command.

Allocation review shows proposal-only charges separately from exact agreed charges
and discount provenance, prior confirmed funding, each new allocation, remaining
agreed amount and source credit. Pending evidence has its own amount and never
reduces confirmed remaining. Aggregate known/unknown counts instead of a fake
complete total. Issued credits/refunds show existing authoritative events or
explicit unavailable/no-record state. No GST row in Phase 1. Expected order balance
is not a collectible billed receivable; no negative sales or internal margin data.

Phone 360×800: one task per pane, component/target cards, persistent labelled review
action. Tablet 1024×768: list/detail and adjacent source review. Desktop 1440×900:
filterable list and detail; tabular target comparison only where space permits.
At every size: full amount labels, 44px controls, wrapping Tamil, keyboard order,
visible focus, dialog restoration, semantic status text/live save feedback and
no colour-only meaning. Browser/axe plus human Tamil/physical Android review are
implementation acceptance; this document is not evidence those screens exist.

## Requirement checks and limited scenario contributions

| Check | Required outcome | Delivery |
| --- | --- | --- |
| P-01 FIN-10/11 | Pending is not money; cash/UPI explicit confirmation; account/config/version gate | A |
| P-02 FIN-12, AC-61 | Same UTR across accounts/bookings conflicts; exact replay and confirm race posts once | A |
| P-03 FIN-10/13 | Receipt/credit is exact deposit liability, never revenue; no eligible charge still records | A |
| P-04 FIN-05, AC-17, AC-49 | Authoritative sources, stable weights/paise/ties, exact sum and capacity guards | B |
| P-05 FIN-12 | Source/line limits, duplicate package attribution, concurrent allocation, ownership isolation | B |
| P-06 FIN-05 | Reasoned linked pre-bill replacement; post-bill/unknown guard; frozen historical weights | B |
| P-07 FIN-13, AC-18 | Pending excluded, one confirmation reduces applicable remaining once; real billing fixture only | A+B |
| P-08 FIN-10 | Split component states, parent never posts, partial confirmation and retry recovery | C |
| P-09 FIN-11, privacy | Private evidence/revocation/retention independent of receipt proof | C |
| P-10 integrity | App_user RLS, composite tenant references, append history, atomic audit/key/journal, restore races | Each |
| P-11 USE | English/Tamil three sizes, axe, lost-response and stale-state recovery | Each UI delivery |
| P-12 AC-03/04/60/62 | Receipt unaffected by material/rush; no gate release, capacity or day-close completion claim | Each |

Review decisions PD-01–08, normalization, electronic posting map, historical
account restriction, agreed-addition adapter and capacity-conflict behaviour
before issue publication. Software approval does not activate real accounts,
production policy, accountant mapping, privacy retention or restore/pilot gates.
