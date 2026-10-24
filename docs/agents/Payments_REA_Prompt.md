# Reusable prompt: payment recording, verification and allocation with REA

Prepared 24 October 2026 for roadmap **1.4.2**, FIN-05/10/11/12/13;
AC-03/04/17/18/49/60/61/62 contributions as applicable. Phase 1 remains owner-only,
online-only, INR and non-tax. Receipt PDFs, governed agreements, billing and full
financial corrections retain their named later slices and approval gates.

Copy the complete prompt below into an Aarili agent session:

~~~text
Prepare roadmap 1.4.2: Record, Verify and Allocate Payments. Use REA to observe
relevant competitor workflows, then implement Aarili's independent requirements.
Start with recoverable payment recording and explicit owner confirmation through
the existing balanced journal, followed by exact booking allocations and transparent
derived balances. Prevent duplicate confirmation/posting under retries and races.

1. Establish authority, prerequisites and the source of agreed charges.
Read AGENTS.md; docs/agents/Development_Workflow.md and issue-tracker.md;
docs/Boutique_Business_Management_Final_Product_Plan.md, especially sections
3, 6-7, 9, 17, 19, 24-25, 27, 29.1, 30.1, 32-33;
docs/Architecture_and_Technology_Decisions.md, especially sections 6-11, 13 and 15;
roadmap 0.3.1-0.3.2, 1.1.1, 1.4.1-1.4.5 and later reconciliation/import allocations;
docs/aarili-design-system.md. Product governs behaviour/release scope; architecture
governs technology. Report conflicts rather than silently amending either baseline.

Read Quotations_Design.md and Quotations_Implementation_Evidence.md;
Shop_Settings_Design.md, Shop_Directory_Implementation_Evidence.md and current
commercial-policy evidence; grouped-booking, accepted intake/package and service-
addition designs/evidence; Issue_33_FIN05_Allocation_Evidence.md,
Issue_34_Balanced_Journal_Evidence.md and Issue_36_Restore_Guards_Evidence.md.
Inspect actual money arithmetic, allocation, journal, actor/idempotency, receiving
accounts, source charges, private uploads and restore guards. Reuse these foundations;
do not build another ledger, allocation algorithm or receiving-account directory.

Recheck git status, current issues/comments/native blockers, merge/CI and source.
Dependency is 1.4.1; technical prerequisites 0.2.3, 0.4.1 and 0.3.1. Verify the
reused receiving-account/restore/media prerequisites too. Earlier records show
quotation PRs #177-#180 merged; confirm current authority, not old pending text.

Critically, 1.4.1 quotations are proposals and cannot establish agreed order value.
Inspect existing accepted-order/package/attested service charges as possible
authoritative allocation sources. Define exact eligible source IDs/versions and
discount basis. Never allocate against a draft, alternative or merely issued quote
as if the customer had agreed. If no supported agreed-charge source exists, preserve
the genuinely received funds as explicit unallocated customer credit and explain
the allocation gate; do not block truthful recording or fabricate approval. Governing
new quote acceptance/price changes remains 1.4.3. Record this dependency seam in
the design and ticket packet instead of bypassing it with a payment command.

Preserve unrelated edits and branches. Use the existing checkout with focused
branches from updated origin/development after blockers merge. No reset/discard,
automatic stash or unrelated commit to switch. Worktrees need explicit scenario
approval. Research/design can proceed first; application changes need a selected
approved issue. Present a concrete packet if unapproved; reuse already granted
authorisation. No implicit issue publication, push/PR, merge, deployment or live data.

2. Conduct bounded web-first REA research.
Apply reverse-engineer-anything and its browser runtime guide. Primary target:
our existing synthetic Nool account at https://app.nooltech.com/login, public guide
https://nooltech.com/docs/, Finances -> Payments -> Record Payment and order balances.
Inspect amount, method, date, reference, order association, advance/instalment display,
pending/confirmed distinction where exposed and save/reopen/retry behaviour.
The public guide documents entry, not proof of independent receipt verification,
booking allocation, UTR uniqueness or immutable journal transactions.

Focused secondary reference: Zoho Invoice's offline/partial payment and credit UI,
https://www.zoho.com/in/invoice/help/invoice/payments-received.html. Use an existing
authorised synthetic account/demo only; otherwise retain documented-only evidence.
Do not create an organisation/account, enable a gateway or obtain API credentials.
Invoice-based payment collection is a comparison, not our advance/deposit model.
Vendor edit/delete, automatic invoice changes or instant paid status must not be
copied where they conflict with Aarili's append-only and owner-verification rules.

Use synthetic saved records only where the test account is ours, clearly isolated
and notifications/external effects are disabled. Prefer read-only observation where
a save might send a receipt/email or change a real invoice. Do not move real money,
open/automate a personal UPI/bank app, scan a payable QR, initiate transfers, send
messages, import real statements or mark a real payment confirmed. Synthetic
fixture creation never proves bank verification. No mutation of shared demos.
Record unsupported/inaccessible verification/allocation flows as evidence gaps.

Use T3 preview for normal browser work where available. REA needs its supported
explicit browser target/CDP connection; preview login doesn't establish access.
Reuse dedicated research profiles, rediscover endpoints/targets, protect unfinished
drafts and use installed tool schemas. Diagnose actual blockers with bounded recovery,
not routine reinstall/setup. Web access is sufficient initially; no APK/emulator,
new trial or paid subscription. Use private sign-in only when necessary; no passwords,
OTP, bank details, cookies or tokens in chat or Git. Keep unnecessary headers/bodies/
storage capture off; raw captures stay outside Git. Do not copy code, assets, rounding
or business policies. Browser evidence cannot establish RLS, locking or atomicity.
Write docs/agents/Payments_REA_Evidence.md with targets/time/actions, sources,
evidence IDs and observed/documented/inferred/unknown claims. Continue supported
design when access fails without claiming a successful REA run.

3. Define payment records and truthful confirmation states.
Write docs/agents/Payments_Design.md mapping FIN-05/10/11/12/13 and scenario coverage.
Separate payer/customer, wearer, booking/garment scope, recipient business and
receiving account. Record amount, enabled method, payment date, recorder, source
reference/evidence and status. Support advances, instalments, split methods, shared
booking payments and unallocated customer credit. No universal charge-all-wearers
or transfer of credit on a contact merge. Resolve ownership through existing identity
and reviewed relinking rules; a shared phone isn't payment authority.

An editable unsaved/durable form is not received money. Define recorded reported/
pending, confirmed, failed and linked reversal states plus correction boundaries.
Refund states remain distinct from reversing a payment; full refund liability and
settlement workflow belongs to 1.4.5. Don't silently omit history consequences or
implement a real refund/provider action to simulate a state transition.
Cash is confirmed when the owner attests actual receipt; record-and-confirm can be
one deliberate atomic action with clear receipt wording. Choosing Cash alone must
not turn a customer report into received money. Daily till reconciliation is later.
UPI is confirmed by the owner's explicit "seen in my UPI/bank app" action against
a configured receiving account. Bank transfer/other enabled methods need their
applicable reviewed confirmation policy; don't invent automatic verification.
Receiving-account configuration or a screenshot never proves receipt. Show the
receiving account identity safely and preserve its version/snapshot on confirmation.
An inactive/unapproved account needs an explicit historical-recording decision,
not an unnoticed substitution of a current account or the shop's personal owner.

UTR is optional but recommended for UPI. When supplied, apply the approved per-shop
UPI reference uniqueness at the database seam, independent of booking/payer/account.
Reusing the same UTR on another receiving account cannot evade duplicate detection.
Inspect existing constraint conventions and define reviewed normalization while
preserving raw evidence; don't arbitrarily reject valid references with invented
format/length assumptions. Distinguish UPI UTR from references for other methods.
Never manufacture a UTR for cash/missing input. Failed/reversed history must not
permit the same transaction to be confirmed again as a new receipt unnoticed.
Absent a reference, identical amount/date isn't proof of a duplicate; flag ambiguity
for review if supported without automatically merging legitimate payments. Distinct
keys with no external identifier cannot provide perfect real-world deduplication;
state that limitation while making retries and explicit confirmation exactly-once
within our transactional model. Do not claim bank-side verification or exactly-once
external receipt from local idempotency alone.

Split payments have explicit component amounts/methods/accounts and confirmation
states. Derive the total without double-posting a parent plus its components.
Define which operation is atomic and how partial confirmation/retry is represented;
pending components must never settle a confirmed balance. Show the complete review
before committing a batch. Use positive exact integer-paise amounts, existing safe
wire/storage serialization and range checks; no floating-point arithmetic or blank
to zero conversion. Keep dates, confirmation instants and shop-local dates distinct.

4. Use the balanced journal and enforce transactional integrity.
Confirmation creates the applicable receipt/deposit postings through existing core
journal interfaces in the same transaction as source state, audit and idempotency.
Pending/failed evidence does not create received funds. Advances are deposits/
customer liabilities, not revenue or collectible receivables. Allocation alone
doesn't recognise revenue or pretend a bill exists. Actual posting mappings follow
the approved architecture/existing foundation; any new mappings need the applicable
review and accountant approval before live use. Never edit stored balances.

Lock source payment and applicable allocation/charge state, enforce consistent lock
ordering, recheck permissions/version/available funds inside the transaction and
commit source confirmation/postings/audit/request key/applicable jobs atomically.
Unique constraints and immutable journal guards must back up service checks. Define
safe retry/deadlock/conflict behaviour; no partial confirmed source without its
balanced postings or a successful response before durable commit. Same key and
actor/action/hash replays the exact result; changed payload/actor/action rejects.
Different keys racing the same UTR or confirmation cannot produce a second posting.

Confirmed monetary facts are immutable. Reasoned corrections append linked events;
do not offer delete/edit-confirmed-amount as a shortcut. Define the minimal reversal/
allocation-reversal consequences required by selected scope; if later authority is
needed, block that mutation and show a truthful state rather than rewriting money.
Enforce restore money freeze, kill switch, restore epoch and job quarantine on the
relevant commands so a restored record cannot be confirmed/allocated twice. Don't
invent a new recovery toggle or bypass existing gates for a demo.

5. Allocate confirmed money transparently and exactly.
Reuse the existing FIN-05 pure function. Eligible weights are exact agreed charges
with their authoritative source/discount versions, never list prices, quote proposals
or undefined "latest" values. Define current remaining capacity and concurrency
checks without silently changing approved weights. Prevent source over-allocation,
cross-customer/shop links, negative available credit and duplicate parent/child or
package/add-on attribution. Customer payment identity and source remain traceable.

Default proportional shares floor to whole rupees (multiples of 100 paise). ALL
remaining whole rupees AND paise go to the largest-charge line, earliest stable
line if tied. Do not use largest fractional remainder or UI array order for ties.
Required examples:
- Charges INR 1,000/1,500; source INR 1,000 -> INR 400/600.
- Three INR 700 lines; source INR 1,000 -> INR 334/333/333.
Property-test paise sources, determinism, permutations with preserved stable order,
sum conservation and range limits. Zero total charge leaves funds as unallocated
customer credit; no division by zero, invented weights or extra sales.

Excess confirmed receipt remains customer credit. Define eligible allocable amount
and line-level remaining-charge constraints concretely. If approved default shares
would overfill a previously funded line, do not silently clamp/discard remainder or
substitute a new algorithm; use existing reviewed policy or present the concrete
case for a policy decision. Preserve funds unallocated while the issue is unresolved.
Confirmation must remain truthful even when allocation cannot be completed. Define
atomic confirm-and-allocate versus confirm-then-review behaviour in the packet so
a failed allocation cannot leave ambiguous confirmation or duplicate receipt retries.

Reallocation before billing requires owner authority and a reason, preserves the
prior set via linked reversal/new allocation and locks sources. After billing,
ordinary reallocation is forbidden: only the governed adjustment path may act.
Bills arrive in 1.4.4 and financial adjustments in 1.4.5; implement the boundary/
guard now, test relevant foundation fixtures, and block unsupported adjustment
actions rather than claiming their future workflow is complete. New quote/scope
revision cannot auto-reallocate confirmed money or rewrite a previous agreed charge.

6. Show derived balances and private evidence honestly.
Display agreed charges/discounts, confirmed receipts, allocations, unallocated credit,
pending evidence, known issued credits/refunds and remaining amounts separately.
Expected order balance and collectible billed receivable are different. If billing/
refund modules aren't present, don't invent receivables/credits/refunds or mark them
complete. Phase 1 is non-tax: no GST collection or misleading tax rows. Surface
only existing authoritative events, with appropriate no-record/not-applicable states.
Private internal costs/margins and unrelated family transactions stay hidden.
Pending INR 500 must not settle INR 500 of balance; confirming it once must reduce
the applicable derived amount once. Excess is a liability, never negative sales.

Evidence attachments reuse private upload/processing and signed access controls;
upload failure/quarantine can't auto-confirm or invalidate separately verified real
receipt. Keep UTR/account details and screenshots private, protect unrelated banking
content and apply retention/redaction/tombstones. No OCR/AI verification. Missing
lining receipt or optional trim cannot block a legitimate payment record/confirmation;
payment doesn't release material/production/handover gates (AC-03/04).
Receipt document generation is 1.4.4. A payment entry is not an issued receipt PDF;
don't reuse quotation/job-slip templates or fabricate receipt numbers. No dynamic
UPI QR, bank statement import, gateway/webhook integration or automated messages.

7. Prepare concrete tickets and implement the selected approved outcome.
Write docs/agents/Payments_Ticket_Packet.md. Suggested vertical outcomes:
A: payment form/durable recovery -> pending or cash receipt -> explicit account-bound
owner confirmation -> journal/audit -> exact retry-safe readback and derived position.
B: confirmed source -> default allocation/review -> reasoned pre-bill reallocation
-> transparent booking/garment balances and post-bill adjustment guard.
C if warranted: split-method batches/private evidence integration and completion of
related customer-history/balance surfaces, without duplicating A/B invariants.
Refine around complete reviewable outcomes and dependencies. Payment-source/UTR
locking, exact values, tenant isolation, immutable postings and recovery are required
from the first relevant delivery, not deferred hardening. Each ticket has IDs,
authority decisions, direct blockers, scope, acceptance, migrations/recovery and tests.
Present the complete packet before publishing unapproved issues; implement only a
selected approved ticket after blockers merge, reusing approval already given.

Use framework-free core commands/policies and repository interfaces, thin Node
Hono handlers, strict draft/command schemas, typed clients and existing save recovery.
Every read/mutation/history/evidence/job uses membership-bound withShop(), shop-led
keys, composite tenant foreign keys and forced RLS under app_user. No direct UI/
route journal writes or business Server Actions. ETag/If-Match for editable state:
428 missing, 412 stale, 409 conflict, 422 validation. Do not auto-merge money.
Use reviewed expand migrations and existing privacy/restore guards; no fabricated
historical receipt backfill or confirmed status inferred from an old advance field.
Use prescribed ctx7 docs for library-specific work; preserve pinned tooling.

Apply the design system and relevant UI skills for English/Tamil, phone/tablet/
desktop, keyboard/screen readers, explicit pending/confirmed/failed states and
clear source/account/allocation review. Don't rely on colour alone or invite the
owner to record another payment after a lost response: resolve the existing key.
Retain input after save failure and explain stale conflicts. Memory-only caches
clear on sign-out/shop switch/access loss. No money/account/UTR/evidence values in
URLs, browser storage, PWA caches, logs, analytics or committed screenshots.

8. Verify money, isolation, concurrency, retries and failure recovery.
Run normal/negative/property tests for cash, UPI owner confirmation, optional UTR,
enabled bank methods, exact split components, duplicate UTR across bookings/accounts,
no-reference ambiguity, pending/failed isolation from confirmed funds, excess credit,
zero charges, stable FIN-05 ties/paise and authoritative charge selection. Test
reallocation reasons, allocation/source limits, package count-once, partial previous
funding, post-bill rejection and frozen historical charges. Prove total postings
balance and derived positions reconcile to confirmed sources and allocation history.

Use real PostgreSQL with app_user for concurrent confirm/confirm, record same UTR,
allocate/allocate, confirm/reverse where in scope, allocation/price-change and
reallocation/billing guard races. Test lost response before/after commit, process
failure, exact-key replay, actor/action/hash mismatch, different-key duplicates,
stale versions, lock conflict, rollback, missing shop context, pooled-connection reuse,
other-shop/customer guessed IDs, account deactivation, evidence revocation and restore
freeze/epoch controls. Mocks don't prove RLS, locking, journal or atomic queue/audit.
No test transfers real money, opens a bank account or sends an actual message.

Trace scenarios explicitly: AC-17/49 allocation and AC-61 duplicate receipt; AC-18
pending/confirmed settlement with a real foundation billing fixture where applicable,
without claiming product billing UI. AC-03/04 contribute payment-versus-material
gating, not full custody/production closure. AC-60 capacity/rush and AC-62 day-close
reconciliation have separate dependencies; preserve their existing behaviour and
identify limited contributions, not invent a new reconciliation/capacity module.
Test unrelated advance/material conditions don't block legitimate receipt. Run
relevant existing quote/order/package/service/directory/journal regressions.

Follow staged Development_Workflow.md and verification-before-completion. Before
claiming completion run actual lint, Knip, typecheck, relevant unit/property/real
PostgreSQL, browser/axe and production build checks. Verify English/Tamil at three
screen sizes. Record exact commands/results, failures, checks not run and remaining
manual/owner/accountant/live gates; no stale evidence for changed code or invented
commands. Avoid repeated unchanged checks without cause. Write
docs/agents/Payments_Implementation_Evidence.md; update roadmap traceability,
prescribed Delivery_Measurements.md entries and manual-review packet, preserving
unrelated edits. Return research/gaps, independent state/transaction design, charge
source and rounding rules, ticket sequence and requirement-by-requirement evidence.
Register authorised PR work with T3. No full 1.4.2 claim after a partial ticket,
no live activation and no later receipt/refund/agreement/reconciliation claim.
~~~
