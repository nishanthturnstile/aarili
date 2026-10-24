# Reusable prompt: itemised estimates and quotations with REA

Prepared 24 October 2026 for roadmap **1.4.1**, FIN-01/02/03/04;
requirement-derived acceptance checks under product §33.1. This brief preserves
Phase 1 owner-only, INR, non-tax scope. Payments, approval/change agreements and
billing retain their named later slices and approval gates.

Copy the complete prompt below into an Aarili agent session:

~~~text
Prepare roadmap 1.4.1: Prepare Itemised Estimates and Quotations. Use REA to
investigate relevant observable workflows, then build Aarili's independent
implementation against our approved product and architecture. Start with an
effective-dated rate catalogue and recoverable garment-level estimate; follow
with consolidated booking quotations, immutable revisions and non-tax quote PDFs.

1. Read authority and verify the integrated baseline.
Read AGENTS.md; docs/agents/Development_Workflow.md and issue-tracker.md;
docs/Boutique_Business_Management_Final_Product_Plan.md, especially sections
3, 6, 9-10, 16-17, 19, 24-25, 27, 29.1, 30.1, 32-33;
docs/Architecture_and_Technology_Decisions.md, especially sections 6-11 and 15;
roadmap 1.1.1-1.1.2, 1.2.2-1.2.3, 1.3.1, 1.3.4 and 1.4.1-1.4.5;
docs/aarili-design-system.md. Product governs behaviour/release scope; architecture
governs technology. Report conflicts rather than silently changing either baseline.

Read Shop_Settings_Design.md, Shop_Policies_Implementation_Evidence.md,
Service_Templates_Design.md, Quick_Order_Design.md, Grouped_Bookings_Design.md,
the small-service/service-addition designs and evidence, Design_Specification_Design.md,
Job_Slips_Labels_Design.md and its delivery evidence; Issue_34_Balanced_Journal_Evidence.md,
Issue_59_Versioned_PDF_Evidence.md and Issue_60_Private_PDF_Sharing_Evidence.md.
Inspect actual money utilities, pricing snapshots, catalogue/package line identities,
commercial policy readiness, order acceptance, durable drafts and document issuance.
Reuse them; do not introduce a competing order/pricing/ledger/PDF engine.

Recheck current issues/comments/native blockers, merge/CI and source. Dependencies:
1.1.1, 1.2.2-1.2.3 and 1.3.1; technical prerequisites 0.2.3, 0.4.1, 0.3.1 and
0.4.4. Job-slip/label PRs #171/#172 previously merged; verify current state where
reusing their feature integration. Historical in-progress headings are not current
authority. A merged prerequisite does not prove live policies/rates are approved.
Inspect git status; preserve unrelated edits and branches. Use the existing checkout
and focused branches from updated origin/development. No reset/discard/automatic
stash or unrelated commit to switch; no worktree without explicit scenario approval.
Research/design can proceed first. Implementation requires a selected approved issue
with merged direct blockers; reuse existing authorisation without asking again.
No implicit issue publication, push/PR, merge, deployment, spending or live data.

2. Research quotation behaviour with bounded REA observation.
Focused quotation reference: Zoho Invoice's Quotes (formerly Estimates), public
India help at https://www.zoho.com/in/invoice/help/estimate/. It documents quote
creation, terms, revisions/editing, PDF/print and manual acceptance. This is a
focused comparison candidate, not an assertion about the historical shortlist or
an existing authenticated account. Use an already authorised synthetic account/demo
if available; otherwise retain documented-only evidence and record the runtime gap.
Do not create a new organisation/account, start a trial, enable email or obtain API
credentials just to complete research. No Zoho integration is part of our feature.

Tailoring context: our existing permitted Nool account at https://app.nooltech.com/login,
public guide https://nooltech.com/docs/. Observe garment/service items, quantity,
price, discount and package context where exposed. An order/bill editor is not proof
of a quotation, effective-dated rate book or immutable revision workflow. Do not
claim either vendor's internal costing, rounding, RLS or transaction behaviour from UI.

Inspect item selection, units/quantity, draft/incomplete estimate, missing versus zero
price, inclusions, line/overall discounts, terms/validity, review, save/reopen, copy/
revision and PDF where supported. Use only our synthetic test records. Do not send
email/WhatsApp, mark accepted, convert to invoice, confirm payments, collect tax or
make external financial effects. Do not persist changes in a shared public demo.
Vendor tax/portal/automation features are observations outside Aarili Phase 1 scope.
Do not import competitor code, templates, graphics, price lists or policy defaults.

Apply reverse-engineer-anything and its browser guide. Use T3 preview for ordinary
browser work when available; REA requires its supported explicit target/CDP
connection. Preview login does not prove REA access. Reuse research profiles and
rediscover endpoint/target IDs, protect unfinished drafts and use installed schemas.
Diagnose actual blockers with bounded recovery, not routine reinstall/setup. Web
access is enough initially; no APK/emulator/new subscription is needed. Use private
sign-in only when necessary; no passwords/OTP/cookies/tokens in chat or Git.
Capture minimal UI/request evidence with unnecessary headers/bodies/storage off;
keep raw captures outside Git. Write docs/agents/Quotations_REA_Evidence.md with
target/time/actions, sources/evidence IDs and observed/documented/inferred/unknown
claims. Continue useful design if access fails; never invent successful REA results.

3. Design rates and recoverable estimates.
Write docs/agents/Quotations_Design.md with FIN-01/02/03/04 mappings and explicit
policy decisions. Reuse category/service/add-on/package definitions and exact stable
source IDs. Rates cover garment labour, lining, additional fabric, trims, alteration,
Aari/craft and approved rush work with units, effective dates, owner permissions
and version history. Do not seed real rates, complexity mappings, discount limits,
expiry durations or formulas without the relevant owner approval. Synthetic fixtures
remain synthetic. Reuse commercial policy draft/review/activation state.

Define applicable pricing date, timezone/date semantics, effective-range ambiguity,
backdated/future rates, unavailable categories and owner overrides concretely in the
packet. Do not silently choose among overlapping rates or reprice existing work.
Catalogue changes preserve historical rates/snapshots; explicit refresh shows a
reviewable diff. Freeze exact rate/definition/policy references at quotation issue.
Incomplete draft estimates may retain unanswered rates/quantities and visible
assumptions; a partial known sum is not a confirmed total. Unknown never becomes
zero or complimentary. Define issue-readiness and any permitted provisional
quotation behaviour against product/policy; do not invent it to bypass unknowns.

Each commercial line has a stable identity, garment/booking/service association,
description, quantity/unit, rate, charge, inclusions/exclusions and price source.
Respect existing fabric integer millimetres and exact quantity semantics. Reuse
integer-paise money arithmetic and safe serialization; PostgreSQL bigint does not
justify unsafe JavaScript numbers. Fractional quantity/rate multiplication and
percentage discounts need explicit reviewed rounding/precision; never binary-float
money or silent rounding. Rate x quantity and conversions retain their exact basis.

Customer-supplied fabric/material is not charged as shop stock. Any agreed handling
service is a separate disclosed line, not an invented material sale. Quoting material
does not receive/reserve/consume stock or establish custody. Bundled/included and
deliberately complimentary lines keep zero selling price and their real known cost;
do not infer cost zero, invent actual costs, double-charge included services or turn
an unknown price into a free item. Inspect already accepted package/service snapshots
and reasoned overrides instead of overwriting their commercial history.

4. Separate price, internal cost, booking consolidation and discounts.
Customer selling prices are distinct from internal estimated and actual fulfilment
costs. Preserve known/unknown status and provenance; actual cost comes only from
existing authoritative cost events. Do not build purchase/payroll/vendor settlement
or fabricate actual costs to fill later module gaps. An internal estimate is not an
expense posting. Hide cost/margin fields from customer-facing DTOs, PDF models,
metadata and sharing payloads, not just CSS. Use reviewed audience projections.

A booking quotation consolidates selected garment/piece/service charges once.
Define ownership for package-level and shared lines, display-only breakdown rows,
standalone alteration/service lines and revised additions. Garment quote views and
booking totals reference the same commercial facts; they are not additional revenue.
Prevent overlapping current quote scopes from presenting contradictory totals as
one agreement; define alternative/superseded revisions and explicit scope selection.
Use stable ordering, not incidental database row order, for deterministic ties.

Support authorised line/booking discounts without applying both twice or discounting
an already included line again. Where booking discounts/shared estimated costs
need garment attribution, reuse the approved FIN-05 function: proportional shares
floor to whole rupees; all remaining rupees AND paise go to the largest-charge line,
earliest if tied. Do not replace it with largest fractional remainder. Identify
this as the existing shared calculation dependency, not delivery of payment
allocation in 1.4.2. Zero eligible charge has no proportional basis: do not divide
by zero, invent weights or describe a quotation discount as customer credit.
Record the reviewed valid/blocked behaviour and prevent an unsupported discount
from making charges negative. Exact allocation must reconcile to its source.

5. Keep commercial events and approval boundaries truthful.
Quotation creates no obligation, payment, deposit, receivable or revenue (FIN-21).
Do not write journal/posting events merely because an estimate is saved or quote
issued. Do not show a quotation total as collectible balance or a share-sheet result
as payment/acceptance. Payment verification/allocation is 1.4.2; agreement approval/
change control is 1.4.3; bills/receipts and corrections remain their later slices.

FIN-03 requires approval/rejection attribution. Define the narrow record/integration
seam in the packet: any recorded response refers to the exact quote revision with
actor/channel/evidence where supported, without activating the later agreement or
production workflow. Pending response is not approval, owner-attested response is
not a customer digital signature, and issued/sent is not accepted. Do not silently
drop this requirement or claim full 1.4.3 coverage. New price/scope produces a new
revision and cannot rewrite prior approval or an existing accepted-order price.
Consequential agreed-price changes use the governed workflow or are blocked until
available; no update of money/capacity/production state through the estimate editor.

Phase 1 is INR and unregistered non-tax: no GSTIN, tax collection or tax lines, not
even a misleading 0% GST column. Do not copy vendor tax treatment into our UI or
derive legal rates/thresholds from research. Terms, validity, discount authority,
numbering format/reset and other business policies use the approved shop settings
and applicable owner/accountant decisions. No guessed defaults or legal claims.

6. Reuse immutable PDF issuance and manual sharing.
Use the existing worker, safe versioned HTML templates, local Tamil/Latin fonts,
stored artifacts/hashes and authorised preview/download/sharing. Clearly label
estimate/quotation and its revision, issue date, validity, line scope, assumptions,
inclusions/discounts, total and approved terms. Quote validity is not a new delivery
promise. Do not expose private fitting media or internal costs in a customer quote.
Keep core estimating usable without downloading historical images or rendering PDFs.

Freeze quote model, source versions, language/paper/template/font and selected
permitted assets when issued. Stored bytes never change on catalogue, shop-profile
or template update; explicit revision gets new provenance. Re-download verifies the
same stored hash. Reuse existing numbering/allocator primitives with reviewed per-
shop/document-type semantics, locked at issue and never reused on failure/void;
do not invent invoice numbering for quotes or recycle a cancelled identifier.
Concrete numbering decisions belong in the packet and applicable approval gate.

Queue rendering with the issued revision/audit/idempotency transaction. Retries
cannot issue a second quote or render latest prices. Rendering failure keeps the
business revision intact with visible status/retry; apply restore/privacy/revocation
controls and private media authorisation. No arbitrary HTML/URL fetch, remote fonts
or executable markup. A4 default, English/Tamil preview and printer-free download.
Reuse explicit owner-triggered native-file sharing/download and manual WhatsApp
attachment fallbacks. Prepared/marked sent is not delivered/read/accepted. Research
and automated tests never send real messages. No automated email/portal/payment links.

7. Prepare concrete tickets and implement the selected approved outcome.
Write docs/agents/Quotations_Ticket_Packet.md. Suggested vertical sequence:
A: effective-dated owner-controlled rates -> garment-level recoverable estimate ->
review of exact source prices, unknowns, inclusions and private estimated costs.
B: booking/package/service consolidation -> exact discounts/attribution -> immutable
quotation revisions with explicit response/accepted-price integration boundaries.
C: non-tax quotation issue -> queued Tamil/A4 PDF -> private preview/download/manual
sharing and historical artifact recovery through the existing document pipeline.
Refine into complete reviewable outcomes with real blockers. Exact arithmetic,
privacy, historical truth and audit apply from the first ticket. Each issue needs
requirements, scope, sources, policy decisions, migrations/recovery and tests.
Present the complete packet before publishing unapproved issues. Implement only
the selected approved issue once blockers merge; reuse approval already given.
Do not claim full FIN-01-04/1.4.1 after a partial ticket.

Use framework-free core and repository interfaces, thin Node Hono handlers,
strict separate draft/command contracts, typed clients and durable-save recovery.
All reads/mutations/history/PDF/jobs use membership-verified withShop(), shop-led
indexes, composite tenant foreign keys and forced RLS under app_user. Commit actor/
action/request-hash-bound idempotency, change, audit and applicable jobs atomically.
Exact retry replays; changed payload fails. If-Match: 428 missing, 412 stale,
409 domain conflict, 422 validation. Never auto-merge pricing conflicts or choose
new source rates silently. Enforce immutable issued history and existing audited
privacy exceptions; use reviewed expand migrations and preserve old accepted prices.
Apply existing restore/freeze gates where relevant; don't invent a blanket gate
that blocks unrelated draft work. No business data in URLs/browser storage/PWA
caches/logs; query cache stays memory-only and clears on access loss/shop switch.
Use prescribed ctx7 docs for library-specific work; respect pinned tooling.
Apply the design system and relevant UI skills for phone/tablet/desktop, English/
Tamil and keyboard/screen readers. Show unknown/provisional totals, price/cost
distinction, pending changes, save failure, conflicts and issue-readiness clearly.
Retain typed input on failure. Use the PDF skill for artifact visual inspection
without replacing the repository production renderer with a different recipe.

8. Verify calculations, history and customer-safe documents.
Test effective-date boundaries/ambiguous rates, inactive definitions, explicit rate
refresh/override, unknown versus zero, fractional fabric quantities, safe large
amounts and rejected overflow, approved rounding, paise discounts and deterministic
ties. Property-test totals/allocation reconciliation, no negative charge and no
double counting across package/garment/booking/service views. Cover complimentary
work with nonzero/unknown cost and customer-supplied fabric with no stock charge.
Test zero eligible charge, duplicate scope/line IDs, repeated save/issue, stale
revision/price changes, concurrent issue/rate edits, lost-response replay, changed
payload and rollback. Prove a quote posts no payment/revenue/receivable or custody.

Use real PostgreSQL for tenant isolation, immutable revisions, numbering locks,
idempotency, atomic audit/jobs and concurrency; mocks cannot establish them.
Verify old quote/PDF bytes survive rate/term/shop/font/template changes and source
permission/erasure rules fail closed where applicable. Check customer DTOs, PDFs,
hidden text, metadata, filenames and share payloads contain no internal costs,
margins, private fitting data or tax fields. Run relevant accepted-order, grouped,
small-service, commercial policy and document regressions.

Follow staged Development_Workflow.md and verification-before-completion. Before
completion run actual lint, Knip, typecheck, relevant unit/property/PostgreSQL and
browser/axe tests, document/Tamil golden checks and production build. Render real
quote PDFs to page images and visually inspect all template variants for Tamil
shaping, long text, arithmetic display, page breaks and A4 layout; text extraction
alone isn't visual proof. Record phone/tablet/desktop and outstanding physical-
device/owner template review honestly. Never update goldens without reviewing them.
Record fresh exact results, failures and checks not run; don't invent commands or
reuse stale results for changed code. Avoid repeated unchanged checks without cause.
Write docs/agents/Quotations_Implementation_Evidence.md and update roadmap traceability,
prescribed Delivery_Measurements.md entries and manual-review packet. Preserve
unrelated edits. Return research/gaps, independent pricing model, calculation/
rounding decisions, ticket sequence and requirement-by-requirement coverage.
Register authorised PR work with T3. Leave owner review/merge/deployment at their
applicable gates; no live activation or later payment/agreement/billing claim.
~~~
