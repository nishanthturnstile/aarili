# Shop settings and commitment policies: independent design

17 October 2026. Design for roadmap **1.1.1**. The owner approved the A–E
breakdown and proceeding; A is selected as #84. This is not implementation acceptance, business-policy approval or pilot
acceptance. [Research brief](Shop_Settings_REA_Prompt.md),
[evidence](Shop_Settings_REA_Evidence.md), and [ticket packet](Shop_Settings_Ticket_Packet.md).

## Authority and current integration

Product §§2, 6, 17, 24–25, 27, 29.1, 30.1, 32–33 govern behaviour and release
scope. Architecture §§6–11 and 15 govern boundaries, integrity and verification.
The roadmap's 1.1.1–1.1.3 and 1.2.1 retain their existing dependencies.
No baseline change is proposed. [Development workflow](Development_Workflow.md)
and [design system](../aarili-design-system.md) apply.

Current registration is already delivered through merged PRs #77, #81, #82 and
#83; #83 merged into development as `1cf572416b1cfb0cb1a696448a9dc4b144d0d13f`.
Do not rebuild owner onboarding, customers, adult wearers or minor/guardian
authority. The inspected local branch is `codex/minor-guardian-registration`,
HEAD `e69a18e`, with pre-existing roadmap and brief edits. Implementation must
refresh integrated development in this same checkout after approval, preserving
those edits. No worktree or branch switch was used for this packet.

The existing ShopRepository exposes only shop ID/name. Generic vocabulary
revisions are reusable patterns, not a service catalogue. No compatible vendor
or category settings model was found in the inspected source paths. The media
pipeline does not currently have a shop-branding purpose; branding upload needs
an explicit purpose/subject-authority extension, not an arbitrary external URL.

## Owner flow and visual direction

The owner edits the existing shop from a Settings destination in the protected
workspace. Configuration must not reopen onboarding or block customer/wearer
registration because an unrelated business policy is missing. The overview
shows five task groups: Shop profile, Working calendar, Payment methods and
vendors, Commercial policies, Delivery and commitments. Each group shows its
current effective revision and specific unresolved inputs. History is available
from each group; it is not a final ticket bolted onto mutable settings.

Use the established Operate surface: Current light/dark semantic tokens, Noto
Sans/Noto Sans Tamil, 16px body, 600-weight headings, existing geometry and Base
UI controls. Page/text/card/primary roles remain the canonical stylesheet's
`#faf6ed` / `#282323` / `#fffdf8` / `#751f3d` light and corresponding dark roles.
No new palette, font, raster asset, component library or decorative dashboard.

Desktop has a narrow section list and a readable, left-aligned form with a
revision summary. Tablet uses a single form with the existing collapsible rail;
phone uses a section list followed by one full-width editing task. Avoid wide
tables for schedules: each day has separately labelled customer and production
intervals, breaks and exceptions. Save action follows the task; a sticky phone
action must leave focused fields and the on-screen keyboard usable.

The focal interaction is reviewing **what this change will govern** before
publication: changed values, missing inputs, effective time and “New activity”.
Actions use “Save draft”, “Review changes”, and “Apply to new activity” where
those states exist. Previewing a commitment says “Preview only — no order or
charge is created”. Inactive vendors/accounts are visibly retained in history.

Preserve English initial UI and explicit Tamil selection from the current owner
decision. Shop document/date presentation does not silently change UI language
on reload. Persisted Tamil-first UI preference needs its own explicit decision;
do not silently resolve that tension by changing the entry behaviour. Entered
Tamil names/text remain as entered; validation must respect IME composition.

## State and version model

Use a stable, shop-scoped configuration aggregate per section, an integer
concurrency version, append-only revisions, and a compare-and-swap current
pointer. Each revision has ID, shop, section/schema version, predecessor,
actor, recorded-at, effective-at and reviewed content. Read history by explicit
revision ID, never reinterpret an old revision using current values. Stable
vendor/account identities have append-only revisions and active/inactive state.

Initial effective-time rule: use the server-assigned publication timestamp,
visible only when the transaction commits. This is not an exact PostgreSQL
commit timestamp. Display it in Asia/Kolkata, retain UTC on the wire.
No backdating or future scheduler in the first delivery. Effective-time history
is required; future scheduling is not inferred from SET-08. A later approved
scheduled-effective feature can extend this without rewriting past revisions.

Keep `unconfigured`, `draft`, `reviewed`, and `not-applicable` distinct per policy
or rule. Not-applicable requires a scoped reason/authority and cannot bypass a
mandatory prerequisite. Empty numbers are null/unknown. Explicit zero is a
value only when valid under the approved rule; no truthiness fallback to zero.
Drafts cannot grant readiness. Server drafts use existing workflow/schema
versioning and recovery; publication revalidates current records and authority.

Changing shop display name updates canonical `shop.name` and the profile
revision atomically, then invalidates owner-shell memory. Do not create a second
current shop name. Historical documents retain their stored identity/version,
fonts/template and hash. This slice supplies explicit revision-read contracts;
actual order/document consumers must pin them in their later slices. No command
here applies changes to existing orders or re-renders issued PDFs.

## Requirement decisions

| Requirement | Owner-visible design and boundary |
| --- | --- |
| SET-01 | Display and legal/trading names, relevant address/contact, tagline/footer/document identity, local presentation and optional validated private logo reference. Shop display name required; other incomplete fields show affected readiness. Pilot currency INR, timezone Asia/Kolkata and unregistered non-tax regime are locked. No GST tax calculation or bill sequence. |
| SET-02 | Separately edit customer opening intervals, production intervals, breaks, dated holidays/exceptions and owner-defined appointment availability slots. No customer self-booking. Validate dates, increasing endpoints, contained breaks, duplicate/overlapping intervals and slots within the applicable customer availability. Represent closed days explicitly. No guessed 9–5 schedule or appointment duration. |
| SET-05 | Reviewed advance expectations, quote validity, discount authority, cancellation/change treatment, trial/rework, credit handover and refund authority, with bilingual owner text and typed values only where semantics are approved. Retail returns/exchanges show release-inapplicable context, without forced questions or implied retail activation. Policy enforcement belongs to relevant later commands. |
| SET-06 | Normal/rush choices and product-established initial three-day calendar warning window; optional working-day basis and longer category windows, plus owner-reviewed escalation configuration. Occasion alone never changes priority. Preview acknowledgements remain separate from risk and unresolved work. Actual alert acknowledgement/snooze persistence belongs to the daily workspace. |
| SET-07 | Cash/UPI/bank method and receiving-account labels, recipient ownership label (owner/family where applicable), and minimal vendor/supplier/external artisan identity/contact/capability. Receiving-account changes require recent authentication. No credentials, payment integration, verification of funds, staff login, rates/payroll or settlement. Inactive entries remain readable by old references. Manual WhatsApp capability is descriptive, with no provider connection or send action. |
| SET-08 | Immutable revisions with actor/effective time from the first ticket; new activity by default; explicit historical reads. No global “update all old work” action. |
| SET-09 | Show only eligible capabilities. Reject direct API attempts to enable retail, GST, pattern engine, customer access, automated messaging, AI or advertising sync in Phase 1. No owner toggle can override release eligibility. Disabling a future module must preserve history/obligations; do not pretend absent module workflows exist. |
| SET-11 | Category rule drafts, approved lead-time basis, cap/unit, capacity-week convention, peak periods/cut-offs and rush-charge suggestion. Preview explains source versions, known demand and each warning, requests defined exception reasons and an explicit charge waiver. It creates neither a booking nor a financial event. Unknown category/load/rules cannot yield a reassuring “within capacity”. |

Escalation config is presentation/manual follow-through data in Phase 1, not a
background outbound messaging job. SET-12 property disposal stays in 1.8.5.
Service definitions/templates/Simple mode stay in 1.1.2. Order intake/acceptance
stays in 1.2; bill numbering in 1.4.4, payment effects in 1.4.2, reconciliation
and operational alert panels in their existing slices.

## Category boundary without a cycle

Keep `1.1.2 -> 1.1.1 -> foundations`. 1.1.1 owns rule revisions, a pure
commitment evaluator and a repository-side `ApprovedCategoryRef` resolver
interface; it does not own garment names, pieces, templates or a category list.

Before 1.1.2, category-specific owner content can be saved as visibly **unbound
rule drafts**, with an opaque draft rule ID and descriptive owner text, not a
fake category ID or another selectable catalogue. It cannot be activated as a
production category rule. Real category binding UI explicitly says it awaits
the service catalogue. Shop-wide calendar/warning settings work independently.

The pure evaluator takes an internally resolved category/version, reviewed rule
revision, availability calendar, candidate dates/quantity or effort, and known
load with its as-of/source. Test harnesses supply clearly labelled synthetic
approved-category fixtures. The production browser cannot mark an arbitrary
category approved, pass an authoritative load, or turn a fixture into policy.

1.1.2 owns stable category identities, bilingual labels, active eligibility and
catalogue versions. It implements the resolver and adds composite tenant FKs
for the binding relationship, calling the existing 1.1.1 rule publication
service. Activation requires a current eligible category and reviewed policy;
retired categories retain historical bindings. No reverse import of a future
catalogue implementation into settings core, and no dependency edge back from
1.1.1 to 1.1.2. Actual owner category binding and category-complete readiness
are explicit 1.1.2 integration acceptance, not claimed by synthetic preview.

The executable start gate for 1.1.2 is the merge of the selected, approved A–E
prerequisite tickets. Pending category-binding acceptance is carried into
1.1.2 and cannot block its own start. Track integrated SET-11/AC-60 closure
separately from completion of those prerequisite tickets; do not recreate a
process cycle by requiring a real catalogue to close E.

1.2.1 must resolve those references and current load under the shop transaction,
lock/serialize the relevant capacity bucket when accepting concurrent work,
reevaluate at acceptance and pin all configuration/category/evaluator versions,
inputs, reason and waiver. A stale preview is never authority to accept work.

## Commitment evaluator and unresolved policy inputs

The evaluator returns `unknown`, `clear`, or `warning`, with structured reason
codes and facts: applicable period, cap/unit, existing plus proposed demand,
cut-off, lead-time calculation, priority explanation, rush suggestion (nullable),
and required owner decisions. It never mutates or creates a charge.

Product-established defaults: three calendar days for delivery warning;
Asia/Kolkata local-date arithmetic; normal/rush choices. For actual orders,
DAY-06 defines a passed delivery slot as overdue, otherwise working-day end,
and separates readiness lateness from delayed collection. This slice tests the
classification seam with fixtures, not a daily-work panel or real order query.

The following have **no approved production default**. Save them as unresolved
until owner review; fixtures must name their chosen values and assumptions:

- Lead-time count basis (calendar/production days), start/end inclusion and
  same-day treatment; standard duration and rush amount per category.
- Capacity unit (garment count or effort points), week start, demand allocation
  date basis, treatment of cancelled/part-complete work, and actual caps.
- Peak date ranges, cut-off date/time inclusion, overlapping-peak precedence,
  whether rules target order/booking date, and applicable categories.
- Explicit zero-cap semantics (closed capacity versus invalid), zero rush-charge
  approval, warning escalations and exception/waiver reason requirements.
- Production/customer/appointment calendars, holiday precedence, and split or
  overnight intervals. Proposed safe first implementation rejects cross-midnight
  intervals and asks for two date-specific intervals; owner must review this
  supported-input restriction in ticket B.

Missing load is unknown, not zero. Unit mismatch is invalid, not a conversion.
If warnings are known but another input is missing, show both warnings and the
unknown. Waiving a rush charge does not remove rush priority/lead-time risk.
Acknowledging a warning does not resolve it. Exception reasons cannot override
missing identity, unapproved rules or authorisation.

## Core, API and persistence

Extend existing module folders, with no new build-boundary package:

- `contracts`: separate editable-draft and reviewed-command schemas, section
  revision DTOs, readiness reasons and evaluator preview DTOs. Money uses safe
  integer paise serialization; no floating point currency or credentials.
- `core`: read/revise profile/calendar/method/vendor/policy commands, release
  eligibility, action-specific readiness, pure local-date/evaluator policies.
  Use framework/driver-free repository interfaces; never Next/Hono/React/SDKs.
- `db`: transaction-bound implementations, stable identities/current pointers,
  append-only revisions, reviewed SQL, grants, privacy boundaries and audit.
- `auth`/`api`: existing verified owner transaction, membership check, local
  tenant context, fresh-auth receiving-account boundary; thin Node Hono routes
  validate/call/map. No business Server Actions. Route names are proposals,
  e.g. section GET/revise/history and commitment preview under settings.
- `web`: typed module client, identity/shop/owner-epoch scoped memory cache,
  forms, draft recovery and conflict review. No business data in browser storage,
  query strings, telemetry or logs. Clear memory/forms on sign-out/shop change
  and current owner invalidation; revalidate back/forward cache returns.

Every tenant row has non-null shop ID, shop-led indexes/uniqueness, composite
tenant references, ENABLE/FORCE RLS and matching read/write policies. Runtime
app_user is neither owner nor BYPASSRLS. All reads, history, preview inputs and
mutations use membership-checked withShop transactions; missing context fails
closed. Client shop/category/media/account IDs never establish authority.

Reuse request-binding, request-version, RequestRepository and vocabulary's
append/CAS pattern. Lock idempotency key, check actor/action/hash binding and
replay the original result before stale-version rejection. Changed payload/key
binding returns 422. Require If-Match on edits: 428 absent, 422 malformed, 412
stale with comparison, 409 domain conflict, 422 invalid input. Commit revision,
current pointer, canonical shop update where applicable, audit, result and any
required job atomically. No new outbound effect or daily job is needed here.

## Failure, migration and recovery

Loading/outage never looks like unconfigured data. Preserve typed on-screen
values on failure, mark unsaved state, disable repeat UI submission while busy,
retry the same command key after a lost response and query its outcome. Saved
server drafts recover across reload/devices; an unsaved edit is labelled as such.
Cancel discards an editable draft after an explicit dirty-state choice; it does
not roll back a published revision. History “restore” means review and publish
a new revision, never edit/delete the old one or bypass fresh authentication.

Migrations are additive and reviewed, run with advisory locking. Seed no assumed
business policies. Existing shop creation remains valid: initialise only a
versioned baseline with fixed pilot constraints and explicit missing fields;
do not turn bootstrap into a second onboarding flow. Test idempotent upgrade
from existing synthetic shops, populated customers/wearers/guardian evidence and
existing documents. A private logo extension needs explicit shop subject checks,
quarantine/read authorization and immutable keys; no public gallery permission.

Back up before applying approved schema migrations outside disposable testing;
rollback application only against compatible additive schema. Revert a mistaken
configuration with a linked new revision. Existing restore epoch/quarantine and
money freeze still apply. Privacy redaction must use approved audited functions,
preserving nonpersonal provenance; do not copy sensitive account/vendor contact
values into append-only audit JSON. Raw research stays outside Git.

## Acceptance matrix

Rows below define the complete parent slice's acceptance. Ticket A's executed
checks and remaining human acceptance are tracked separately in
[implementation evidence](Shop_Profile_Implementation_Evidence.md). B–D have
merged with their ticket-local evidence; E implementation and remaining gates
are tracked in [commitment preview evidence](Shop_Commitments_Implementation_Evidence.md).
No whole-parent-slice acceptance is claimed.
Ticket-local SS IDs are stable within this packet.

| Check | Requirements/scenario | Evidence required / remaining integration |
| --- | --- | --- |
| SS-01 | SET-01 | Existing owner edits profile, saves/reopens; shell name changes atomically; INR/timezone/non-tax locks; private branding isolation; onboarding/customer/guardian regression. Ticket A. |
| SS-02 | SET-02 | Customer versus production hours, break/holiday/slot validation, local-date/year/week boundaries, no invented hours, recoverable save/conflict. Ticket B. |
| SS-03 | SET-07 | Configure receiving methods/accounts and vendors; fresh-auth denials, disabled historical references, cross-shop rejection; no processing/payroll. Ticket C. |
| SS-04 | SET-05, AC-44 configuration part | Unconfigured/draft/reviewed/not-applicable policies; relevant action readiness only; no invented legal/rate values; customer registration remains available. Ticket D. Actual quote/bill/refund enforcement remains later. |
| SS-05 | SET-06, DAY-06 seam / AC-28 partial | Three local-calendar-day initial window, working-day option needs calendar, longer category windows, occasion does not alter priority, acknowledgement leaves warning facts. Ticket E fixtures; actual daily panel/alerts remain 1.9.2. |
| SS-06 | SET-11, AC-60 evaluator part | Labelled synthetic category/load/peak fixture exceeds cap and cut-off; displays both facts, short lead time/rush suggestion, required exception reason and explicit waiver; missing data remains unknown. Ticket E. Real category binding 1.1.2; transactional booking acceptance 1.2.1. |
| SS-07 | SET-08 | Every ticket appends versions with author/effective time; explicit old revision unchanged after new publish; no old-work updates; direct mutation guard. Real order/PDF consumer integration later. |
| SS-08 | SET-09 | Both API and UI reject release-ineligible activation; history/obligations not hidden. All tickets. |
| SS-09 | TRU-01/03/06/07/12, USE-08, AC-55 | Real PostgreSQL FORCE RLS/missing context, cross-shop references, owner checks, concurrent CAS, same-key replay/different payload and actor, rollback after audit/result failures. All mutations. |
| SS-10 | USE-01–04/09 | Phone 360px/tablet/desktop, English/Tamil, keyboard/axe, IME, lost response/offline/retry/dirty cancel, recovery and cache invalidation. Automated results separate from physical Android/fluent Tamil/screen-reader review. All UI tickets. |
| SS-11 | AC-61, AC-62 | Settings supply receiving references only; duplicate UTR/no double balance effect remains 1.4.2; till discrepancy/append-only adjustment remains 1.9.2. No full-scenario claim. |

## Owner review before publication

Review the five vertical outcomes and edges in the packet, the category seam,
immediate-effective restriction, calendar supported-input limits and unresolved
business decisions. Packet approval may authorise labelled synthetic fixtures;
it must say so explicitly. The earlier customer/privacy fixture exception does
not approve shop policies. Human review of running software follows each approved
implementation ticket. Ticket A now has a running synthetic Settings route
and manual-review packet in its implementation evidence; this design remains
the independent specification for the complete slice.
