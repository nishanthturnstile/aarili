# Reusable prompt: measurement sessions, versions and selection with REA

Prepared 22 October 2026 for roadmap **1.3.2**, MEA-01/02/03/04/05/06/07/11;
AC-06 and applicable contributions to AC-07/08. Trial/verified-fit workflows,
pattern preparation and production documents remain their named later slices.
This brief changes no product scope, policy approvals or activation gates.

Copy the complete prompt below into an Aarili agent session:

~~~text
Prepare roadmap 1.3.2: Record and Select Measurement Versions. Use REA to observe
relevant competitor workflows, then build our independent implementation against
Aarili's requirements. Start with an approved garment-specific measurement form,
a wearer-linked session, immutable saved values and explicit selection for a garment.

1. Establish the baseline and implementation authority.
Read AGENTS.md; docs/agents/Development_Workflow.md and issue-tracker.md;
docs/Boutique_Business_Management_Final_Product_Plan.md, especially sections
3, 7, 9-10, 13-15, 24-25, 27, 29.1, 30.1, 32-33;
docs/Architecture_and_Technology_Decisions.md, especially sections 6-11 and 15;
roadmap 1.1.2-1.1.3, 1.2.4, 1.3.1-1.3.4 and 1.8.1;
docs/aarili-design-system.md. Product behaviour and architecture constraints
remain authoritative. Report conflicts; do not silently revise either baseline.

Read Service_Templates_Design.md, Measurement_Forms_Implementation_Evidence.md,
Customer_Wearer_Design.md, Customer_Wearer_Privacy_Draft.md, and the current
design-specification, repeat-order and customer-history designs/evidence under
docs/agents. Inspect the existing media/privacy foundations and actual contracts.
Existing 1.1.2b form definitions do not prove measurement entry/versioning exists.
Reuse their exact field identities, meaning, bilingual labels, required status,
precision metadata and service/piece bindings. Do not create another form editor.

Check git status, current issues/comments/native blockers, source and merge/CI
state. Verify direct dependencies 1.1.3 and 1.3.1, plus technical prerequisites
0.2.3, 0.4.1 and 0.4.3. PRs #149-#151 previously merged the design slices; verify
current authority rather than trusting historical pending-review text. Identify
existing intake measurement placeholders or free text before introducing new records.
Never silently promote old unverified input into a measured/confirmed version.

Use the existing checkout and focused branches from updated origin/development.
Preserve unrelated edits and existing branches; no reset, automatic stashing or
unrelated commits to make a branch switch succeed. Worktrees need explicit scenario
approval. Prepare a complete design/ticket packet if none is approved. Application
changes require a selected approved issue with merged direct blockers. Reuse prior
authorisation; do not request it again. No implicit issue publication, push/PR,
merge, deployment, paid account or live-data activation.

2. Conduct bounded web-first REA research.
Apply reverse-engineer-anything and its browser runtime guide. Primary target:
Nool, https://app.nooltech.com/login, using our existing permitted synthetic account.
Public context: https://nooltech.com/docs/, Measurements and order-selection flows.
The public guide describes garment-specific fields, family-member context, unit
switching, saved version history and selection for orders. These are documented
claims until observed in the accessible runtime; do not equate a version label
with proven immutable storage or stable historical order references.
Secondary: https://tailorman.in/product-tour/, Add Measurement, customer profile
and item-type template screens, for entry/grouping and history discovery only.
This is tailorman.in software, not the separate tailorman.com clothing brand.

Inspect synthetic adult wearer -> garment form -> values/units -> save/reopen;
correct a value -> inspect previous/current values -> select an exact version on
a synthetic order -> inspect the earlier order after revision where supported.
Check separate wearers sharing a phone, required/optional fields, missing values,
source/method/date, decimal/fraction entry, conversion display, cancel and failed
save. Record unsupported or inaccessible cases rather than inventing successful
behaviour. Do not fabricate guardian consent, delivery, approval or payment to
unlock a feature. Only our permitted test account may receive synthetic saves;
do not persist changes in a shared public demo or send messages.

Use T3 preview for ordinary browser work where available. REA observation needs
its own supported explicit target/CDP connection. Reuse the research profile and
rediscover current endpoints/targets; historical IDs or preview authentication do
not prove REA access. Protect unsaved forms from connect-mode navigation. Use
installed tool schemas and bounded recovery for actual blockers, not routine
reinstallation. No APK/emulator/new subscription is needed initially. If a workflow
is mobile-only, document the gap before proposing another acquisition route.
Use private sign-in when needed; never collect passwords/OTP/tokens in chat or Git.

Capture only necessary UI/request evidence; keep raw headers, bodies and storage
values off initially. Raw captures stay outside Git. Use synthetic numbers and no
body/minor photos. Do not copy competitor code, graphics, measurement illustrations,
validation thresholds or formulas. UI evidence does not prove backend/RLS guarantees.
Write docs/agents/Measurement_Versions_REA_Evidence.md with source links, target/time,
scenario, evidence IDs, observed versus documented/inferred/unknown claims and gaps.
Continue supported design work if access fails; never claim REA execution succeeded.

3. Design the domain and exact measurement representation.
Write docs/agents/Measurement_Versions_Design.md with requirement mappings,
data-flow/command boundaries, source-field compatibility and migration/recovery.
Separate editable durable drafts, immutable saved session versions, and an order/
piece's explicit selected measurement version. Identify wearer independently of
payer/customer/guardian. A session records date, measurer, source/method and context:
body, sample garment, customer-provided or another documented method. Mixed sources
must be explicit where supported, not falsely labelled as one body session.
Save the exact form/field revision and meaning; later field rename, reorder, removal
or replacement cannot reinterpret stored values. Do not map fields by label alone.
For composed outfits, preserve piece-specific applicability and wearer identity.
Services with measurements not required must retain their lightweight workflow.

Follow architecture storage: numeric value in its entered unit plus raw entered
text and explicit unit. Preserve exact decimal/fraction semantics across API/DB;
avoid floating-point drift, destructive rounding and round-trip conversion loss.
Support inches/centimetres, decimal and familiar fractional entry. Pilot default
is inches with quarter-inch fractions; it is not permission to round every field
to a quarter inch. Per-field entry precision and conversion display/rounding rules
need approved definitions. Use exact unit conversion, label display approximations
where applicable and retain the original entry. Unit switching must clearly say
whether it changes display or interprets input; never silently relabel a number.
Blank remains unknown, never zero. Do not invent a missing unit or interpret an
ambiguous entry as a confirmed measurement. Drafts may be incomplete; authoritative
save uses the approved required-field/applicability rules and clear error/warning
semantics. Explicit not-applicable and missing must remain distinct if supported.

Separate entered body/sample values, garment-target dimensions, ease choices,
derived values and pattern parameters. Only calculate outputs with an approved
formula/reference/version; otherwise show unavailable and preserve source input.
No guessed measurements, body-size inference, automatic ease or pattern generation.
Validate malformed input and unit compatibility. Plausibility/cross-field rules,
hard limits and override policies need business approval; do not invent thresholds
or copy vendor rules. Warnings must explain the concern and allow unusual valid
measurements under the reviewed policy without shaming language or guessed fixes.
Record any outstanding policy decisions concretely in the review packet.

4. Preserve history and make version selection explicit.
Saving a new session/revision appends an attributable immutable version with actor,
time, source/context and revision lineage/reason where appropriate. Never update
saved values in place. An order references an exact version ID, never latest.
Creating version 2 must leave an order using version 1 unchanged. Keep selection
history when an authorised command deliberately changes a garment's selected
version; immutable prior references and dependent snapshots remain attributable.

Reuse UI shows wearer, source garment if available, session date/age, method,
form/type compatibility and context. Require explicit suitability confirmation,
including repeat-as-new. No universal expiry period, automatic latest selection
or assertion that old measurements remain accurate. A new compatible form still
needs reviewed mapping if field meanings differ. Inactive/retired definitions remain
historically readable; new use follows the existing replacement/reactivation policy.
Two wearers sharing a contact cannot share private measurements by default.
Customer merge/relink cannot silently reassign versions or expose another wearer.

Inspect the seam for a changed selection on an accepted/in-progress garment.
Preserve exact design/measurement references; do not silently reset design approval,
price, dates, work or custody. Product DES-11 requires downstream impact handling:
define the current safe boundary and block unsupported consequential changes
until their governed workflow exists. Do not build production/change-agreement
engines to fill later dependencies or claim the later impact rules are complete.

5. Enforce consent and private fit access.
Guardian authority/consent precedes minor measurement recording and photos; reuse
must also satisfy current applicable authorisation. Recheck permission at save,
selection and asset access, not merely when a draft opens. Use existing consent
and identity modules; never invent a consent checkbox that bypasses their evidence.
Textual fit notes work without body images. Separate private fit assets from design
inspiration, reusable shop libraries and public/gallery media. Minor and private
fitting images cannot publish or leak through repeat, share, history or merge flows.
If assets are included, reuse authorised private upload/processing and signed access
with immutable shop-prefixed keys; no duplicate pipeline or public buckets.

Separate personal values/media from durable provenance. Extend audited privacy
erasure, retention and tombstones to new tables/drafts/media; no ordinary runtime
exception to immutable records. An erased source is unavailable for reuse, not
recoverable through an old version/history endpoint. Redact measurement values
from logs/errors/traces. No personal values in URLs, browser storage, PWA caches,
analytics or committed screenshots. Query cache is memory-only and cleared on
sign-out/shop switch/access loss.

6. Prepare concrete vertical tickets and implement the selected one.
Write docs/agents/Measurement_Versions_Ticket_Packet.md. Suggested outcomes:
A: approved form -> wearer session -> units/values -> save/review immutable version
-> explicitly link to one compatible garment, including required consent and privacy.
B: attributable correction/history -> reviewed reuse/version selection -> repeat/
grouped/history integration and concurrent selection protection.
C if needed: private fit asset integration using existing media/rights foundations.
Refine around complete user outcomes and actual dependencies. Privacy, exact values
and immutable storage are acceptance requirements from the first ticket, not deferred
hardening. Each ticket includes IDs, selected scope, concrete scenarios, direct
blockers, migration/recovery and tests. Present a complete packet before publishing
unapproved issues; implementation needs a selected approved ticket. If already
authorised, proceed without requesting the same approval again. A alone does not
close full 1.3.2 if approved remaining requirements are outstanding.

Use framework-free core policies/repository interfaces, thin Node Hono handlers,
separate draft/command schemas, typed clients and existing durable-save recovery.
Every query/mutation/history/search/media/job uses membership-verified withShop(),
shop-led keys/composite foreign keys and forced RLS. Runtime is app_user.
Commit idempotency bound to actor/action/request hash, mutation, audit and applicable
jobs atomically. Identical retry replays; changed payload fails. Require If-Match
for editable drafts/selection: 428 missing, 412 stale, 409 conflict, 422 validation.
Never silently merge measurement conflicts. Enforce version immutability at the
database seam while retaining only the existing audited privacy exception.
Use reviewed expand migrations and actual existing tooling. Preserve old intake
history and unknowns; no fabricated backfill dates, measurers, units or confirmation.
Use the prescribed ctx7 workflow for library-specific syntax/setup/debugging.

Apply the repository design system and relevant frontend skills. Support English/
Tamil, phone/tablet/desktop, suitable fraction/decimal input, visible units and
conversions, keyboard/screen readers, clear source/date/version labels, loading,
empty, unsaved/save-failed, retry, consent-loss and stale-conflict states. Keep
typed inputs visible after a failed save. No body image is mandatory.
Do not implement MEA-08/09 trial/verified-fit workflows, AI/contextual fit advice,
seam presets, pattern formulas, customer portal or job-slip PDF generation here.
AC-06 covers measurement versions now; AC-07/08 contributions do not close later
pattern workflows. No production/pilot activation claim from synthetic checks.

7. Verify and update traceability.
Test exact decimal/fraction entry, incompatible/ambiguous units, conversion round
trips and approved precision; blank versus zero; required/optional/applicable fields;
changed field meaning; body versus sample source; distinct same-phone wearers;
guardian consent absent/revoked; original values preserved after conversion/revision;
version 2 does not change old orders; explicit reviewed selection and repeat reuse;
incompatible/retired form handling; no automatic latest/expiry; erased source denied.
Test draft recovery, lost-response exact retry, changed payload, missing/stale
preconditions, concurrent correction/selection, rollback and cross-shop guessed IDs.
Use real PostgreSQL for RLS, immutable constraints, atomic audit/idempotency and
privacy functions; mocks do not prove these. Cover private media access/processing
failures if included, and relevant existing custom/grouped/service/repeat regressions.

Follow staged Development_Workflow.md and verification-before-completion. Before
claiming completion run the actual lint, Knip, typecheck, relevant unit/property,
PostgreSQL integration, browser/axe tests and production build. Check English/Tamil
at three screen sizes. Record exact results, failures, manual review requirements
and checks not run; do not invent commands or reuse stale results for changed code.
Avoid repeating unchanged checks without a reason. Write
docs/agents/Measurement_Versions_Implementation_Evidence.md; update roadmap
traceability, Delivery_Measurements.md and the prescribed manual review packet.
Reconcile outdated prerequisite status text using current merge/CI evidence.
Return research findings/gaps, independent design, exact entry/conversion rules,
owner decisions, ticket sequence and requirement-by-requirement validation evidence.
Register authorised PR work with T3. Leave review/merge/deployment at their applicable
gates; do not claim the whole slice complete after a partial delivery.
~~~
