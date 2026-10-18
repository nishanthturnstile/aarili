# Shop settings: approved implementation tickets

17 October 2026. Stable parent slice **1.1.1**. **Owner approved A–E publication
and proceeding; selected first implementation: A (#84).** Published issues:
[A #84](https://github.com/nishanthturnstile/aarili/issues/84),
[B #85](https://github.com/nishanthturnstile/aarili/issues/85),
[C #86](https://github.com/nishanthturnstile/aarili/issues/86),
[D #87](https://github.com/nishanthturnstile/aarili/issues/87),
[E #88](https://github.com/nishanthturnstile/aarili/issues/88).
Bodies, existing labels and native blocking edges were read back after creation.
Merge, deployment, production policy values and live activation remain gated.
Ticket A's delivered outcome, commands and owner-review route are tracked in
[implementation evidence](Shop_Profile_Implementation_Evidence.md).
The initial research inventory found no selected approved settings issue: authenticated
open-issue inventory returned only #28 Dependency Dashboard; searching all
issues for 1.1.1 returned customer tickets mentioning it, not a settings ticket.
Earlier customer/privacy synthetic-fixture approval does not approve commercial
or commitment policy values.

Sources: [brief](Shop_Settings_REA_Prompt.md), [evidence](Shop_Settings_REA_Evidence.md),
[independent design and acceptance matrix](Shop_Settings_Design.md), product
§§2/6/17/24–25/27/29.1/30.1/32–33, architecture §§6–11/15, roadmap
1.1.1–1.1.3/1.2.1, [workflow](Development_Workflow.md),
[tracker](issue-tracker.md), [design system](../aarili-design-system.md).

## Concrete breakdown and direct edges

| Ticket | Complete owner outcome | Direct blockers |
| --- | --- | --- |
| A — 1.1.1a | Edit/reopen existing shop identity and branding with attributable revision history | Merged 0.2.3 #16, responsive shell #51, vocabulary/version pattern #53, media #57/#58; integrated onboarding #77 and existing registration baseline through #83 |
| B — 1.1.1b | Maintain distinct customer/production calendar and appointment availability | A; server draft/recovery foundations #55/#56 |
| C — 1.1.1c | Configure receiving methods/accounts and minimal external vendors safely | A; existing recent-authentication foundation #13 |
| D — 1.1.1d | Review commercial policies and see action-specific missing configuration | A; server draft/recovery foundations #55/#56 |
| E — 1.1.1e | Configure delivery warnings and preview commitment rules without creating orders | B and D; C is not an evaluator dependency |

These approved edges are now native GitHub relationships. Foundation PRs are
reported merged in the repository evidence; re-read actual closing PRs and
native relationships at implementation start. A closed issue alone is not proof.
Latest integration check: PR #83 merged 17 October 09:36:40Z to development at
`1cf572416b1cfb0cb1a696448a9dc4b144d0d13f`, matching fresh remote head.

Publish only after approval, using existing labels and native blockers in A–E
order. No map issue or new labels. Implement one selected issue at a time on
`codex/<topic>` from latest integrated origin/development in the existing checkout.
Merge each direct blocker and update development before its dependant. B/C/D
have independent outcomes but do not imply parallel checkout permission.

History starts in A and is required in B–E. No extra “integration ticket” merely
repeats their verification. 1.1.2 continues to depend on the completed 1.1.1
contract/outcomes; actual category binding is accepted in 1.1.2, preserving the
roadmap without a cycle. Its executable start gate is merged approved A–E
prerequisite issues. Pending integrated category acceptance is carried into
1.1.2 and cannot block that slice's own start or prerequisite ticket E closure.
Track full integrated SET-11/AC-60 acceptance separately; synthetic fixture
acceptance does not declare that whole owner scenario complete.

## Common definition of done for each issue

- Carry stable slice, requirement/SS/AC IDs, source sections and direct blockers.
  No competitor API/code/assets are imported. Missing competitor coverage never
  weakens Aarili acceptance.
- Framework-free core commands/policies; transaction-bound db repositories;
  thin authorised Node Hono/Zod routes and typed browser clients. No business
  Server Actions, new dependency pins or package boundaries without need.
- Non-null shop IDs, composite tenant references, shop-led uniqueness/indexes,
  ENABLE/FORCE RLS, matching policies, runtime grants and append-only revision
  guards. Membership-checked owner withShop transaction for every operation.
- Immutable revision/effective-time/actor history, new activity by default,
  action-specific readiness and server validation of release eligibility.
  No rewriting existing customer, wearer, guardian, order or issued document data.
- Actor/action/request-hash-bound idempotency; same-key replay, changed payload
  or actor rejection; If-Match 428/422/412 and domain 409. Revision, pointer,
  audit, key/result and any required jobs commit or roll back together.
- Real PostgreSQL negative isolation/missing-context/reference tests, immutable
  history guards, concurrent version writes, simultaneous retry and injected
  rollback. Mocks cannot establish these claims.
- Preserve values on failed save, honest pending/unsaved states, server draft
  recovery where applicable, dirty cancel and original-key lost-response retry.
  No private browser persistence/URLs/logs. Clear memory on owner invalidation,
  sign-out/shop change and safe back/forward re-entry.
- Focused phone 360px/tablet/desktop English/Tamil browser workflows, keyboard,
  axe, IME and usable errors. Physical Android, screen-reader and fluent Tamil
  acceptance remain separately recorded human gates, never inferred from emulation.
- Review additive SQL and recovery notes; no destructive migration or production
  push. Back up before approved schema changes; preserve compatible rollback,
  existing restore controls and synthetic-only development.
- Run the actual `pnpm lint`, `pnpm knip`, `pnpm typecheck`, relevant tests and
  `pnpm build` (or `pnpm verify:fast`, which includes these plus unit/negative
  types/OpenAPI). Run focused real PostgreSQL and browser suites; issue-explicit
  full `pnpm verify`/`pnpm test:ui` checks remain required when selected. Hosted
  feature PR needs Fast verification and Dependency audit; promotion retains full
  scaffold/browser checks. Do not repeat passing checks without changed inputs.
- Fetch current library/tool docs through ctx7 library then docs when selecting
  syntax/configuration; inspect installed Turbo docs before changing its commands.
  Do not migrate tooling. Record requirement-by-requirement evidence, actual
  delivery timings where applicable and the running manual review packet.
- Review isolation, immutable history, media/privacy and rollback in the PR.
  Register every worked PR with T3 once publication is authorised. Owner review,
  merge, promotion, deployment and real-data activation stay separate.

## A — [W1 1.1.1a] Edit the existing shop profile with revision history

**Purpose:** Owner updates the existing shop's business/document identity and
reopens it without repeating onboarding or losing old identity versions.

**Mapping:** SET-01, SET-08, SET-09; SS-01, SS-07–SS-10; AC-44 profile/readiness
part only. Product §§6/24–25/32; architecture §§6–11/15.

**Scope:** Settings overview/profile navigation, shop display and legal/trading
details, relevant address/contact, tagline/document footer and presentation,
fixed INR/Asia-Kolkata/unregistered non-tax regime. Establish revision/current
pointer, history UI, server-assigned immediate effective time and no-backdate
publication. Include optional private logo upload through explicit shop-branding
purpose/subject authorisation and existing validation/processing/read pipeline;
do not use external URL fetching or gallery publication as a shortcut.

**Prerequisites:** A's direct blockers above, actual merged integration and
selected issue approval. Business/document text and identity supplied by owner;
synthetic examples must be labelled and separately authorised. No fabricated
registration number, tax terms or branding asset. Existing empty optional fields
remain unknown; document issuance readiness stays incomplete where appropriate.

**Acceptance:**

1. Existing owner opens profile from workspace, edits a synthetic name/contact
   and identity text, reviews scope, publishes and reopens the committed revision.
   Canonical shop.name and shell cache update atomically; no new shop created.
2. Old revision remains readable with actor/time; publish another revision and
   verify original content/hash does not change. No existing document is rewritten.
3. Locked pilot fields and ineligible module activation reject direct API payloads;
   missing identity is explicit and does not stop customer/wearer registration.
4. Logo pending/ready/rejected/error states work; foreign shop asset and unready
   attachment are rejected. Immutable private media keys/authorised reads apply.
   Minor/private-fitting publication protections remain unchanged.
5. Real database replay/CAS/rollback/isolation and UI recovery checks meet common
   definition of done. Rerun owner-entry/customer/adult/minor flows affected by
   canonical identity/cache/media changes; preserve separate guardian evidence.

**Migration/recovery:** Add configuration aggregates/revisions/pointers and
branding subject support with reviewed RLS/grants. Existing shops get no assumed
policy; preserve old shop.name and all customer references. Test upgrading a
populated synthetic shop. A mistaken profile is corrected by a new revision;
media retention uses existing lifecycle. Rollback only with compatible schema.

**Owner review:** On the seeded host, edit profile, reopen, inspect old/new
revisions, try unsupported pilot options and a failed/retried logo upload. Check
phone/Tamil wrapping and header coherence. Report SS-01/07/08/10 separately.

## B — [W1 1.1.1b] Configure customer hours and production availability

**Purpose:** Owner records a usable working calendar without equating open doors
with sewing capacity or inventing a standard work week.

**Mapping:** SET-02, SET-08; SS-02, SS-07, SS-09–SS-10; DAY-06 calendar seam.
Product §§6/20/25/32; architecture §§7–9/15.

**Scope:** Weekly customer/production intervals, breaks, closed days, dated
holidays/exceptions and owner-defined appointment-availability slots. Preview
effective week and exception dates in shop-local time. Server drafts/recovery,
review/publish and old calendar version reads use A's revision model. This is
availability configuration, not appointment booking, staff assignment or capacity
analytics. No default opening hours or appointment duration.

**Prerequisites/inputs:** A merged; #55/#56 merged. Owner supplies hours, break,
holiday and slot conventions. Approve supported interval limits: initial design
rejects overnight ranges with an explanation to split by date; it does not
silently wrap the time. Review exception precedence and customer versus production
holiday distinctions. Missing calendar must stay unresolved.

**Acceptance:**

1. Save/reopen different customer and production hours; a customer closure need
   not imply production closure. Closed/unconfigured states are visibly distinct.
2. Reject duplicate/overlapping/inverted intervals, out-of-range break and slot,
   impossible dates and unsupported overnight input. Date exceptions and breaks
   affect only their approved calendar domain.
3. Show effective weekly and dated views with Tamil/English labels; saving one
   section cannot erase a different calendar. Server draft resumes across reload
   and a second synthetic session; stale edits require review.
4. Pure tests cover local midnight, leap day, year/week boundary, holiday and
   no-working-day cases. Working-day calculation uses an explicit calendar
   revision and returns unknown/error for absent or impossible availability.
5. Publish a change and read the old calendar unchanged; meet common SQL,
   concurrent retry/rollback and responsive accessibility checks.

**Migration/recovery:** Add typed calendar/exception revision content and required
tenant child references/indexes; no mass creation of 9–5 schedules. Calendar
publication creates a new revision, not rewritten historical hours. Retain draft
schema compatibility or explicit incompatible-draft recovery. No automatic job
rescheduling or messages from this ticket.

**Owner review:** Configure a synthetic split working day, holiday, appointment
slot and production-only day; try an overlap and reopen a previous revision.
Review phone keyboard/date entry and Tamil error clarity. Report SS-02/07/10.

## C — [W1 1.1.1c] Configure receiving accounts and external vendors

**Purpose:** Owner selects how money may be received and identifies external
artisans/suppliers without introducing payments, staff access or payroll.

**Mapping:** Scoped SET-07, SET-08, SET-09; SS-03, SS-07–SS-11. AC-61/AC-62
integration references only. Product §§4/6/16–17/32; architecture §§8/11/15.

**Scope:** Enabled cash/UPI/bank methods; named receiving accounts with relevant
non-secret identifiers and owner/family recipient label; minimal vendor identity,
contact/capability and external-artisan/supplier distinction. Lists/detail/create/
edit/deactivate/history are complete owner flows. Link manual communication
capability only; no integration credentials, bank verification, transaction,
settlement/rate ledger, staff login or message send. Mask account details in
overview; no account identifiers in URLs or audit diff values.

**Prerequisites/inputs:** A and recent-auth foundation #13 merged. Owner approves
receiving list and which identifiers/contact data are necessary. Prototype uses
clearly synthetic identifiers only. Recent-authentication applies to account
creation/change/deactivation/reactivation; stale-auth retry preserves the command
and checks again server-side before publishing.

**Acceptance:**

1. Configure and reopen methods/accounts/vendors, revise labels and deactivate;
   inactive identities cannot be selected for new work but old revision references
   remain readable. No deleting historical references to remove obligations.
2. Require recent authentication for receiving-account changes, including direct
   API and stale-auth retry. Membership and tenant context remain necessary even
   with fresh sign-in. Foreign vendor/account references fail closed.
3. Missing enabled receiving account is an explicit payment-recording readiness
   reason, not a blanket block on customers, calendars or preliminary work.
4. No balance changes, payment-provider call, staff invitation, wage calculation,
   outgoing message, UTR uniqueness or reconciliation completion is claimed.
5. Meet common history/replay/concurrency/rollback/privacy and three-size bilingual
   checks. Test duplicate command response loss without duplicate account/vendor.

**Migration/recovery:** Stable tenant identities plus append revisions/active
pointer, FORCE RLS/composite references and restricted grants. Reuse a compatible
model if one lands before implementation; do not duplicate it. No opening balances
or receiving accounts seeded from observed competitors. Corrections append
revisions; sensitive values follow approved privacy/retention paths.

**Owner review:** Add synthetic owner/family UPI and vendor, expire authentication,
attempt a change, reauthenticate and retry, deactivate and inspect history. Verify
no payment/message was sent. Report SS-03/07/10; AC-61/62 remain pending later.

## D — [W1 1.1.1d] Review commercial policies and missing-action gates

**Purpose:** Owner sees exactly which policy decisions are missing and can record
reviewed terms without accepting invented legal or financial defaults.

**Mapping:** SET-05, SET-08, SET-09; SS-04, SS-07–SS-10; AC-44 configuration
and readiness portions. Product §§6/17/27/32; architecture §§6.5/8–9/15.

**Scope:** Advance expectations, quote validity, discount authority, cancellation,
change charges, trial/rework, credit-handover and refund approval. Store bilingual
terms and approved typed values where required; separate draft/reviewed/not
applicable with authority and effective version. Action-specific readiness query
explains missing configuration. Overview describes manual Phase 1 communication
and release-ineligible retail returns/exchanges without irrelevant mandatory
questions. No commercial calculation/enforcement or money movement here.

**Prerequisites/inputs:** A and #55/#56 merged. Owner must supply production policy
values/terms and confirm their authority/customer presentation. Until then only
explicitly authorised labelled synthetic drafts can be used; no production
review flag on fixtures. Missing advance percentage/refund period is not zero.

**Acceptance:**

1. Save/recover draft terms; review/publish attributable revisions; read the exact
   earlier version. Missing and explicitly reviewed zero differ where zero is
   valid. Not-applicable cannot bypass a mandatory supported action prerequisite.
2. Readiness query distinguishes draft quote versus binding quote, payment account
   readiness, credit handover/refund policy and later bill format. It reports
   unsupported/not-yet-integrated actions honestly, not “ready to issue”.
3. Unconfigured cancellation/refund does not block profile save or customer/wearer
   registration. Direct publication of malformed/unapproved required values fails;
   no assumed legal/tax rule completes AC-44.
4. Old consent evidence, quote approvals, prices and issued documents are never
   rebound to latest policy. Test immutable revision reads with fixtures; actual
   consumer enforcement remains their later implementation acceptance.
5. Common transactional failure/isolation and bilingual recovery/accessibility
   checks pass; no retail/module activation or external effect.

**Migration/recovery:** Versioned policy content and readiness reason vocabulary;
initial policy state unresolved. Drafts are not authoritative. No mass update of
existing consent/customer records. Privacy audit excludes full free-text terms
where they contain personal details; controlled redaction retains provenance.

**Owner review:** Inspect missing policies, draft one synthetic term, see its
affected actions, publish only an approved fixture, change it and compare history.
Review Tamil wording separately from automation. Report SS-04/07/10 and the
limited AC-44 mapping; production terms remain an activation gate.

## E — [W1 1.1.1e] Preview delivery and commitment rules with explicit unknowns

**Purpose:** Owner understands configured delivery risk and missing information
before the later booking workflow exists; preview cannot create orders/charges.

**Mapping:** SET-06, SET-08, SET-09, SET-11; SS-05–SS-10; AC-60 evaluator part,
AC-28 warning seam and AC-44 commitment configuration part. Product §§6/20/27/32;
architecture §§6–9/15.

**Scope:** Initial three-day local-calendar warning setting, reviewed working-day
basis/escalation options, normal/rush priority, category-neutral evaluator and
unbound rule drafts. Configure lead-time basis/value, weekly cap/unit/convention,
peak ranges/last-booking cut-offs, rush suggestion and explicit exception/waiver
review. Show configuration/evaluator/source versions and unknown load. Use only
labelled approved synthetic category/load fixtures until 1.1.2 supplies real
category resolver/bindings. No order, charge, capacity reservation or daily panel.

**Prerequisites/inputs:** B and D merged. Owner approves test fixtures and confirms
production lead-time/count basis, capacity week/allocation basis, caps/units,
peak overlap/cut-off semantics and rush charges before real use. Product supplies
no values for these. Approve the noncircular seam in the design. C is independent;
payment readiness comes from C when consumers need it, not evaluator coupling.

**Acceptance:**

1. Configure/reopen warning window/basis; missing working calendar is unresolved.
   Occasion alone does not change priority. Category windows cannot silently
   shorten the required shop policy; validate the approved longer-window rule.
2. A clearly synthetic AC-60 fixture exceeds its known cap and cut-off and requests
   delivery sooner than configured lead time. Preview shows cap/current+candidate
   load, cut-off and dates, rush explanation and configured paise suggestion.
   Applicable acceptance review requires nonblank reason; explicit waiver records
   its decision/reason without creating money or removing rush risk.
3. Empty/zero/missing rules, category, calendar and load stay distinguishable.
   Reject unit mismatch and impossible dates. Known warning plus unknown input
   shows both. Boundary/property tests cover cap equality, cut-off equality,
   lead-time equality, local midnight/year, zero and all-closed calendars under
   explicitly documented fixture conventions; no conventions silently go live.
4. Synthetic preview fixtures cannot be activated through the production API;
   unbound drafts cannot declare category readiness. No second catalogue or
   import of future catalogue implementation. Tests exercise resolver denial,
   foreign-category rejection and old rule/calendar version selection.
5. Acknowledgement and waiver remain separate decisions from unresolved warning
   facts. Re-evaluation on a changed config/load explains stale inputs. Actual
   booking acceptance/reservation concurrency is explicitly deferred to 1.2.1.
6. Common immutable history, PostgreSQL retry/CAS/isolation and responsive
   bilingual/keyboard/axe recovery checks pass. No money event, job send or
   future-feature activation occurs.

**Migration/recovery:** Add rule draft/revision structures and preview DTOs; no
real category table, arbitrary category FK or load table pretending orders exist.
1.1.2 adds actual composite-tenant bindings and resolver; 1.2.1 pins snapshots and
rechecks live load atomically. Preview content is transient or server-draft data,
never a financial/booking acceptance event. Correct rules by new revision.

**Owner review:** Run a labelled synthetic peak/cap/rush case, omit inputs, enter
exception and waiver reasons, then inspect unchanged risk and no created order or
charge. Check Tamil explanations on phone. Report SS-05/06/07/10; full AC-60 and
real category binding remain pending their existing integration slices.

## Review and remaining gates

Owner packet review: approve or amend A–E granularity/direct edges, category seam,
immediate effective dates and calendar restrictions; identify selected first
ticket and whether labelled synthetic settings fixtures are authorised. Only
then publish the reviewed concrete issue bodies. Actual production policies,
receiving accounts and capacity decisions remain product §32.2 gates.

For each implementation delivery prepare an actual running local/test URL,
startup/access method, synthetic scenario and short SS-ID try/observe steps.
Provide `SS-ID — pass/fail — observation` reporting and targeted cleanup. Do not
ask the owner to repeat automated terminal checks. No Settings review route
exists from this documentation packet. Physical device/fluent Tamil review,
owner software acceptance, CI, merge, promotion/deployment, restore/privacy and
live-pilot gates are still outstanding.
