# Reusable prompt: repeat orders and customer history with REA

Prepared 21 October 2026 for roadmap **1.2.4**, CUS-03/05/06, ORD-08/12,
MEA-10 and TRU-06/12; applicable contributions to AC-02, AC-58 and AC-59.
This brief preserves existing scope, approval requirements and activation gates.

Copy the complete prompt below into an Aarili agent session:

~~~text
Prepare roadmap 1.2.4: Reuse Orders and Maintain Customer History. Investigate
relevant competitor workflows with REA, design our own behaviour from Aarili's
requirements, and implement the selected approved vertical ticket once its
direct blockers have merged. Start with repeat-order intake.

1. Establish authority and current state.
Read AGENTS.md; docs/agents/Development_Workflow.md and issue-tracker.md;
docs/Boutique_Business_Management_Final_Product_Plan.md, especially sections
3, 5.2, 7, 9, 13, 24-25, 27, 29.1, 30.1, 32-33;
docs/Architecture_and_Technology_Decisions.md, especially sections 6-11 and 15;
roadmap 1.2.1-1.2.4 and Phase 1.3; docs/aarili-design-system.md.
Read the existing customer/wearer, Quick Order, grouped-booking and small-service
designs and evidence under docs/agents, including service additions/completion
and Promotion_2026_10_21_Evidence.md. Inspect actual source and current contracts.
Product governs behaviour; architecture governs technology. Report conflicts.

Recheck git status, current GitHub issues, native blockers, merge and CI state.
PRs #127-#129 implemented 1.2.3 and #130 promoted the integrated work; verify
current state rather than treating old pending-review text as current authority.
Reuse the approved catalogue, exact manifests, draft persistence, commitment
review, acceptance, grouped pieces, services and customer/wearer identity modules.
Do not create a second intake or audit engine.

Use the existing checkout. Preserve unrelated edits and branches. New feature
branches start from updated origin/development after blockers merge. No worktree
without explicit scenario approval. This prompt authorises preparation; issue
publication and implementation selection follow the existing project gates.
Reuse approvals already given. No implicit push, merge, deployment or live data.

2. Research these specific web workflows with REA.
Primary: Nool, https://app.nooltech.com/login. Public documentation:
https://www.nooltech.com/docs/ describes Repeat Order and Clone Order, as well
as customer order history. Treat these as documented candidates until observed.
Secondary: TailorMan, https://tailorman.in/product-tour/, customer list/profile
and bill detail. Compare discovery of earlier orders and history navigation.
Do not claim either product supports identity merges without direct evidence.

Apply the reverse-engineer-anything skill and browser runtime guide. Use our
existing permitted research account/profile and synthetic fixtures. A web session
is sufficient initially; no APK, emulator, paid plan or new account is required.
Use T3 preview for ordinary browser work when available; REA observation requires
its own supported explicit target/CDP connection. Rediscover endpoint and target
IDs rather than reusing historical values. Protect unfinished drafts. Use installed
tool schemas; do not reinstall or run diagnostics unless an actual blocker occurs.
Ask for private sign-in only when needed; never request credentials in chat.

Inspect an existing synthetic order, the repeat/clone entry point, copied and
cleared fields, item selection, new dates/prices, review, cancel, draft persistence,
acceptance and the resulting source link/history. Observe only permitted mutations
in our own test account. Do not mark orders delivered or fabricate payments merely
to unlock a button. If completed-order fixtures or functionality are unavailable,
record the gap and continue with supported evidence; do not invent a successful flow.

Capture minimal UI/accessibility and necessary request evidence, with raw headers,
cookies, tokens, bodies and storage capture off initially. Keep raw captures outside
Git. Never copy competitor code, assets or private data. Browser evidence establishes
observable behaviour, not their private schema, transactions or tenancy controls.
Separate observed, documented, inferred and unknown claims. Record target/time,
tool evidence IDs, scenario actions, synthetic fixture and limitations in
docs/agents/Repeat_Order_History_REA_Evidence.md. Cite public sources there.

3. Design Aarili's repeat-as-new rules before coding.
Write docs/agents/Repeat_Order_History_Design.md and a field-by-field matrix:
reusable after review / must be reconfirmed / must be reset / unavailable today.
Map each choice to requirement IDs and existing contracts. Establish exact source
order/garment/service identifiers and versions, authorised customer/wearer identity,
and clear provenance without changing the original accepted record.

Create a new durable draft with new identities. Reuse relevant supported requested
work and specifications as reviewable inputs. Resolve current catalogue/manifests
and eligibility; retired or changed definitions must produce an explicit review,
not silent substitution or use of a stale price. Preserve unknown versus zero.
Require new price confirmation and a fresh commitment/capacity evaluation using
existing approved policies. Treat historic prices and dates as context only.

Never inherit current approval, payment/credit/allocation, invoice numbering,
delivery promise, completion, assignment, QC, handover, custody receipt or stock
movement from the source. Repeating a customer's garment does not mean their
physical garment/material has been received again. New demand occurs only through
normal acceptance; opening/cancelling/retrying a repeat draft cannot double-count.
Source order and its demand/history remain unchanged under their existing policies.

Offer repeat from the appropriate existing custom garment, grouped piece or
standalone service context, with explicit selection. Do not silently duplicate an
entire family booking, all wearers, a package price or completed add-ons. Make
supported cases and intentionally blocked cases explicit in the ticket packet.
Keep family members with shared phone numbers distinct. Revalidate guardian
authority and source access. No implicit private-media transfer between wearers.

Actual versioned designs, measurement records and fit-memory features are later
slices. Reuse only records already implemented and authorised, showing exact
provenance and requiring review where applicable. Do not implement Phase 1.3 or
AI recommendations to fill a dependency gap. MEA-10 here means permitted manual
access to existing history; AC-58 remnant handling remains its material slice.
AC-59 timing is a measured design target, not an invented pilot acceptance limit.

4. Plan history and identity work as separate vertical outcomes.
A: source discovery -> review reusable fields -> new durable draft -> existing
acceptance -> visible source/new-order relationship. Deliver this first.
B: unified customer/wearer history using existing authoritative records, meaningful
revisions and source links, with tenant-scoped pagination/search and clear identity.
Include only implemented domains; absent payments/custody/documents must not appear
as paid, received, delivered or otherwise complete. Add later domains through their
own slices. This is a projection over authoritative records, not event sourcing.
C: duplicate suggestions/manual review, audited corrective identity edits and
authorised merge/relink. Define the review preview, conflict handling, surviving
identity, aliases/tombstones and immutable original attribution before mutation.
Preserve identifiers, wearer distinctions, financial links and historical snapshots.
Never auto-merge by phone/name or silently reassign measurements/private assets.
Do not rewrite issued documents or accepted snapshots during identity correction.
Require reasons and explicit reviewed relinking for sensitive relationships.

Write docs/agents/Repeat_Order_History_Ticket_Packet.md with concrete scope,
acceptance scenarios, source requirement IDs, dependencies, migration/recovery,
verification and activation decisions for each outcome. Use the existing tracker
workflow. Present a complete packet for approval before publishing unapproved
tickets; do not begin application changes without a selected approved issue.
If implementation is already selected and authorised, proceed without asking again.

5. Implement the selected approved outcome within existing boundaries.
Use framework-free core commands/queries and repository interfaces, thin Node Hono
handlers, strict command contracts, typed clients and memory-only query caching.
All reads/search/history/repeat/merge paths require membership-bound withShop(),
shop-led keys, composite tenant references and forced RLS. Never trust source IDs.
Keep transaction-local actor context and preserve immutable snapshots/history.
Commit mutation, request-bound idempotency, audit and applicable jobs atomically.
Use existing ETag/If-Match semantics: 428 missing, 412 stale, 409 conflict,
422 validation. Never auto-merge stale edits or replay a changed request payload.
Money stays exact integer paise; reuse the current pricing and allocation policies.
No new unapproved rates, confidence thresholds, merge heuristics or business policy.
Fetch current library docs with the required ctx7 workflow when library details arise.

Apply the repository design system and relevant UI skills for implementation.
Make source context and editable new-order inputs clear on a phone. Support English
and Tamil, three screen sizes, keyboard/screen-reader use, cancellation, loading,
empty, permission, unavailable-source, conflict and retry states. No business data
in URLs, browser storage or service-worker caches. Retain existing Simple mode flow.

6. Verify and record evidence for the selected outcome.
Test repeat custom/grouped/service applicability; same-phone distinct wearers;
retired catalogue/version changes; unknown/zero price; fresh dates/capacity;
source immutability; no copied approval/payment/completion/custody; guardian rules;
draft save/reload/cancel; exact retry after lost response; changed-payload rejection;
stale edits; rollback; concurrent acceptance and no duplicate demand.
For history/merge tickets, test attribution, source links, search recall, pagination,
ambiguous candidates, deliberate review, sensitive relink rejection, retained
financial references and concurrent corrections. Verify tenant isolation and
transactional history with real PostgreSQL, including negative cross-shop cases.
Do not use mocks as proof of RLS or atomicity. Run relevant existing intake regressions.

Follow the staged Development_Workflow.md checks. Before claiming completion run
the actual repository lint, Knip, typecheck, relevant unit/property/integration and
Playwright/axe checks, and production build. Do not invent commands or repeat
unchanged checks without reason. Record fresh results, failures, checks not run,
manual review requirements and delivery timing in the prescribed evidence files.
Write docs/agents/Repeat_Order_History_Implementation_Evidence.md, update roadmap
traceability and Delivery_Measurements.md where applicable. Do not claim full
scenario closure for later payment/material/measurement/sharing dependencies.

Return the observed competitor behaviour and gaps, our independent design,
field reuse/reset matrix, ticket sequence, selected outcome and exact validation
evidence. Register any authorised PR with T3; leave owner review/merge/deployment
at their applicable gates. Do not claim the full 1.2.4 slice complete after A alone.
~~~
