# Shop calendar implementation plan

17 October 2026. Proposed implementation for
[#85, W1 1.1.1b](https://github.com/nishanthturnstile/aarili/issues/85):
configure customer hours and production availability. This plan covers one
focused implementation PR to `development`. Implementation was subsequently
requested and is recorded in the [delivery evidence](Shop_Calendar_Implementation_Evidence.md);
merge, business configuration and deployment retain their owner gates.

## Authority and prerequisites

- Product SET-02 and SET-08 govern calendar configuration and history; DAY-06
  supplies the later working-day warning seam. Product sections 6, 20, 25 and
  32 govern behaviour and approved business inputs.
- [Architecture](../Architecture_and_Technology_Decisions.md) sections 7–9 and
  15 govern durable drafts, local dates, isolation, immutable history and tests.
- Reuse the [independent Settings design](Shop_Settings_Design.md),
  [acceptance and ticket packet](Shop_Settings_Ticket_Packet.md),
  [research evidence](Shop_Settings_REA_Evidence.md), and
  [design system](../aarili-design-system.md). Competitor observations remain
  evidence, inferences and unknowns as recorded there; they do not set policy.
- Direct blockers are merged: #55 through PR #65, #56 through PR #68, and
  #84 through [PR #89](https://github.com/nishanthturnstile/aarili/pull/89).
  All three merge commits are ancestors of integrated `development` at
  `549955b8faa079019d8a9ce68bd4b6dca843df66`. Refresh this evidence before coding.
- Follow the [development workflow](Development_Workflow.md) and
  [product plan](../Boutique_Business_Management_Final_Product_Plan.md).
  No baseline or release-scope change is proposed.

## Confirmed owner decisions

1. A time range stays within one shop-local date. Overnight work is entered as
   two ranges split at midnight.
2. A dated exception replaces only the selected calendar domain for that date.
   Customer closure can coexist with open production availability.

These decisions approve representation rules, not real opening hours,
appointment durations, holiday dates or production capacity values.

## Calendar contract

Use one independently versioned calendar aggregate per shop, separate from the
shop-profile revision. Each immutable snapshot contains customer and production
domains. Editing one domain preserves the other exactly at publication.

| Element | Proposed first-version behaviour |
| --- | --- |
| Missing configuration | No initial hours or inferred standard week. No published calendar is an explicit unconfigured state. |
| Weekly rules | Seven local weekdays per domain; each day is unconfigured, explicitly closed, or open with nonempty ranges. |
| Open ranges | Half-open local-minute intervals; adjacent ranges are valid, duplicates and overlaps are rejected. `00:00` is valid; `24:00` is an end boundary only. Zero-length, inverted and cross-date ranges are invalid. |
| Breaks | Explicitly none or defined; defined breaks must fit within an opening range and must not overlap. Incomplete input stays unknown. Effective availability subtracts breaks. |
| Appointment availability | Customer-domain slots only, explicitly unconfigured, none or defined. Each slot fits wholly inside net customer availability and slots do not overlap. No booking, occupancy or default duration. |
| Dated exceptions | A unique local date per domain replaces that domain's entire weekly day, including breaks and customer slots. A holiday is an explicitly closed exception. Removing an exception restores the weekly rule in a new reviewed revision. |
| Effective time and history | Record author and server-assigned publication timestamp, displayed in Asia/Kolkata and retained in UTC. Default applicability is new activity; future consumers pin a revision. Prior revisions remain readable. No rewriting existing commitments. |

Validate actual Gregorian dates rather than accepting date rollover. Use
`Asia/Kolkata` local dates and minute values for business calendar rules; store
publication/audit instants in UTC. Display an exception's source and effective
revision in previews. A partially configured calendar can be saved and published
with a clear unresolved-state review; consumers must receive unknown results
where configuration is insufficient.

Follow the existing Settings history contract: publication assigns the effective
timestamp, visible only after the transaction commits; this is not an exact
PostgreSQL commit timestamp. No backdating, owner-selected future effective
time or activation scheduler in this version. Dated exceptions are business
calendar dates within the snapshot, distinct from its effective timestamp.
Historical consumers use explicit revisions rather than applying today's head
to an older activity.

## Pure policies and downstream boundary

Provide framework-free resolution for an explicit revision, domain and local
date. Resolve the dated replacement before the weekly rule, subtract breaks,
and return configured intervals, explicitly closed, or unconfigured with a
reason. Historical resolution uses the supplied revision, never today's head.

Provide bounded working-day calculation over caller-supplied local dates and
an explicit domain/revision. A working date has positive net availability;
an entirely configured closed range counts zero, while unresolved dates produce
unknown. Any search for a next working date requires a finite horizon and
returns a distinct no-working-date result when exhausted. Calendar arithmetic
must not assume that adding 24 hours advances a business date.

This is the calendar seam for #88 and later delivery-warning work. Those
consumers decide warning thresholds, inclusion of today, due-slot precedence,
lead times, capacity, rush approvals and festival cut-offs. #85 supplies no
invented values and performs no order rescheduling or messaging.

There is no dependency on 1.1.2 service catalogue. Calendar definitions do not
contain category IDs, service rates or category lead times. Later catalogue and
commitment rules may reference stable calendar revision IDs; #85 never imports
their modules. No circular prerequisite is introduced.

## Durable editing and publication

Reuse the existing draft endpoints, repository, recovery scope and promotion
transaction. Register a `shop.calendar` workflow in `withOwnerDraft` with the
verified shop transaction, as the wearer and guardian adapters already do.
Do not enable customer privacy workflows as a prerequisite for shop settings.

Each domain draft pins its base calendar version/revision and contains the
proposed domain. Keep draft schema versioning separate from calendar snapshot
schema versioning. Existing unsupported draft versions need an explicit
recoverable incompatibility state; do not discard them silently.

Publication validates the complete proposed domain and compares the pinned
calendar base under a lock/CAS. It then copies the untouched domain from that
exact current snapshot and atomically commits revision, current pointer, draft
promotion, audit and actor/action/request-hash idempotency result. First
publication handles an absent current row safely; one origin draft can produce
only one revision. Same-key lost-response retries replay the original result.

Two concurrency checks remain distinct:

- Draft ETag protects edits to the same draft. Reuse its existing 428/412
  behaviour and recovery controller.
- Calendar base version protects publication against another draft's newer
  publication, including a change to the other domain. Return a stale-version
  failure and fetch both the current draft and published calendar for review.
  Do not put a calendar DTO in the generic draft error's `current` field, which
  is a draft record. Do not silently rebase or merge disjoint-domain edits.

After comparison, the owner explicitly reapplies chosen changes to a draft
bound to the latest calendar. Preserve unsaved values during conflict handling.
Autosave uses the existing server-backed recovery flow and opaque draft ID;
values stay out of browser storage and URLs. Retention/deletion remains gated.

## Implementation sequence within issue 85

| Step | Concrete change | Exit evidence |
| --- | --- | --- |
| 1. Contracts and policies | Add calendar command/draft/read schemas and pure validation, exception resolution and bounded working-day helpers in contracts/core. Keep draft validation permissive enough for incomplete form recovery; publish validation enforces valid configured states. | Unit/property cases cover boundaries, unknowns and deterministic history. |
| 2. Database history | Add reviewed next-numbered SQL migration, schema and repository for current calendar plus immutable snapshots. Include shop-led keys/indexes, composite tenant references, origin-draft uniqueness, FORCE RLS and restricted grants. Use the #84 history pattern without coupling profile updates. | Real PostgreSQL isolation, immutability, first-publication and concurrent-publication checks. |
| 3. Transactional workflow | Implement calendar queries and draft promotion adapter; compose it in auth using the same transaction. Maintain separate draft and aggregate versions. | Retry, changed-payload, stale-version and injected-failure rollback evidence across all writes. |
| 4. API and typed client | Add thin authorised Hono reads for current/effective/explicit historical revision and preview as needed. Use existing draft save/promote APIs. Keep pagination/filter payloads consistent with repository conventions. | Contract/status tests and cross-shop negative reads; no business logic in handlers. |
| 5. Settings UI | Add Working calendar to existing Settings. Build separate domain editors, weekly/date previews, breaks/slots, explicit unknown/closed states, draft resume, review/publish and history. Use existing tokens/components and effect-owned recovery lifecycle. | Bilingual responsive flows, conflict review, recovery and accessibility evidence. |
| 6. Acceptance and review | Update traceability, evidence and delivery measurements; execute staged verification and prepare the manual-review packet. | Every acceptance row below has evidence or an explicitly pending human gate. |

Expected seams: new `shop-calendar` modules in `packages/contracts`,
`packages/core`, `packages/db`, `packages/api` and its typed client;
`packages/auth/src/index.ts` workflow composition; a calendar screen beside the
existing Settings screen in `apps/web`; translation messages and focused tests.
Confirm exact exports and the next migration number against integrated source.
No new package, dependency, calendar widget or general configuration framework
is needed. If an origin-draft database guard checks promoted lifecycle, make
its timing compatible with the existing outer draft promotion transaction.

## Acceptance matrix and verification

| Issue scenario | Required evidence |
| --- | --- |
| SS-02 and SET-02: independent calendars | Save/reopen different customer and production weeks; customer closed while production open; preserve the untouched domain. Distinguish unknown, closed and zero net availability. |
| Validation | Reject duplicate/overlapping/inverted ranges, misplaced breaks/slots, invalid dates and unsupported overnight input. Accept adjacency and an explicit midnight split. |
| SS-07: recovery and review | Reload and second synthetic session resume a server draft; lost-response retry; draft-stale and calendar-stale comparisons retain local values and require explicit resolution. |
| SS-09–10 and SET-08: history | New revision per publish, author/effective time visible, previous revision readable and deterministic; later configuration never changes historical resolution. |
| DAY-06 seam | Local midnight, leap day, invalid leap date, week/year boundary, holiday precedence, all-closed horizon and missing configuration; no fabricated working-day answer. |
| Isolation and atomicity | Real PostgreSQL: missing context, foreign shop/draft/revision, runtime grants, immutable history, simultaneous first publish, same-key concurrency, changed-payload retry, stale CAS and rollback after each material write. |
| Owner workflow | Synthetic split day, holiday, appointment slot, production-only day, overlap error, preview, publish and prior version; Tamil/English, phone/tablet/desktop, both themes, keyboard and axe. |
| Regression | Existing shop profile and customer/wearer/guardian workflows, generic draft recovery and sign-out/shop-scope invalidation remain valid. |

Run the repository's actual lint, Knip, typecheck, relevant unit/property and
real PostgreSQL suites, selected Playwright/axe flows and production build using
the [staged verification workflow](Development_Workflow.md). Run compatibility
checks when package exports change. Collect fresh command evidence and avoid
repeating successful expensive stages without a new reason. Document actual
device, fluent-Tamil and assistive-technology review as separate human gates.

The migration must add no default hours, backfill no owner policy and alter no
existing customer data. Record forward recovery and schema compatibility before
publication; do not activate draft retention or bypass backup/pilot gates.
Prepare one focused draft PR only under applicable publication authorisation;
require CI and owner review before squash merge to `development`. Promotion and
deployment remain separate. Record implementation timing in
[Delivery Measurements](Delivery_Measurements.md).
