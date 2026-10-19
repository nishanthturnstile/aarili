# Quick Order B: acceptance implementation and owner review

19 October 2026. **#114 / 1.2.1b implemented for owner review. Local scoped
verification passed; no merge, promotion, deployment or live-data activation.**
[REA ledger](Quick_Order_REA_Evidence.md), [independent design/QO matrix](Quick_Order_Design.md),
[approved tickets](Quick_Order_Ticket_Packet.md), [A delivery](Quick_Order_Implementation_Evidence.md).

## Authority and baseline

The owner selected #114 after A merged through [PR #115](https://github.com/nishanthturnstile/aarili/pull/115)
at `c6ab32d676d87f2da103a587e00f3c5c0d5f00c9` (13:36:15Z). Its feature fast/audit
checks passed; full/browser checks were correctly skipped on the feature PR.
Direct blockers #113/#84/#85/#87/#101 were rechecked, including merged PRs
#115/#89/#90/#91/#106. Promotion #110 was rechecked independently: merge
`29c4975`, successful scaffold/three browser projects/audit/aggregate in run
[39231567178](https://github.com/nishanthturnstile/aarili/actions/runs/39231567178).

Existing checkout, branch `codex/quick-order-acceptance`, based on fetched
development `c6ab32d`. Local development was advanced to that same commit.
No worktree. The owner's 14-line roadmap readiness note and untracked readiness/
REA prompt documents remain outside this change's staging scope.

The owner explicitly approved these conventions in this session:

- One accepted garment contributes one to its promised-delivery week, under
  the current configured week convention; drafts/reviews contribute zero.
- Retain booked demand after completion. No cancellation/rescheduling/release
  command is introduced here. Future adjustments must lock both source/destination.
- Shop-scoped `QO-000001` onward, distinct from bill/document numbering.
- Effort-point acceptance stays blocked until a reviewed comparable mapping exists.

Caps, lead times, peak cut-offs, rush values, production content, privacy,
retention and live/pilot activation still need their separate approvals. Fixtures
remain synthetic. No competitor screen supplies backend guarantees or policy.

## Implemented boundary

The existing Quick Order workflow promotes the saved draft using the existing
actor/action/hash-bound key, draft lock, ETag, audit and result transaction.
Complete input and current authority are checked again. Exact-key replay checks
private authority without rerunning acceptance against later configuration;
new decisions always re-resolve current eligibility. The origin-draft unique
constraint survives request-key expiry. Promoted drafts reopen their durable
order from another session, including after a lost acceptance response.

The current binding/category resolver and `evaluateCommitment` are reused;
unbound v1 and bound v2 configuration previews remain unchanged. Browser load,
approved flags, quantities and server dates/times are rejected. Review fingerprints
bind material intake, source versions, requirement projection, authority, day,
demand and evaluated facts/warnings. Volatile query timestamps alone do not
invalidate review. Actual load-query time is retained in the snapshot.

The publisher-compatible lock order is:

1. Existing request key → draft; customer-person share lock → wearer authority.
2. Existing catalogue → forms → templates publication locks.
3. Existing commitments → bindings → calendar → policies publication locks.
4. Existing profile/shop row lock → stable `(shop, canonical category)` advisory
   capacity lock → tenant code-allocation lock. Retain every lock through commit.

Template publishers use the catalogue/forms/template prefix; binding publishers
use catalogue/commitments/bindings; other source publishers take their own named
lock. Guardian mutations share the wearer lock. No acceptance path takes a later
source lock before its publisher's predecessor. Capacity identity contains no
rule revision or absent demand row. Demand is read after locking and selected by
canonical category and promised date under the current week bounds. Rule revisions
cannot reset load; incompatible units and missing mappings remain unresolved.

Server clock after capacity locking supplies booking date/time and cut-off
evaluation. Historical order dates require a reason and never backdate acceptance.
Capacity/cut-off exceptions require reasons; rush waiver requires its reason.
Rush charges are suggestions and are never added to price automatically. Unknown
authority/configuration/demand cannot be overridden; to-be-quoted is valid.

## Storage, isolation and recovery

Additive migration **0030_quick_order_acceptance.sql** creates `garment_order`,
`order_acceptance_snapshot`, `order_requirement`, `order_capacity_demand` and
`order_presentation_event`. Each has shop-led keys, non-null shop IDs, tenant
composite foreign keys and ENABLE/FORCE matching RLS. Runtime remains app_user
through membership-checked withShop. There is no backfill or policy activation.

Intake prices use constrained PostgreSQL bigint paise; null differs from zero.
Immutable snapshots pin manifest/catalogue/forms/pieces, presentation origin,
binding/rules/calendar/profile timezone/policy, authority references, evaluator,
load, reasons and unresolved instances. Personal identity labels are read through
current authorised identity modules rather than copied into configuration history.
Task assignment defaults to the verified owner. Stored source/instance/demand
provenance and deferred promotion/key guards prevent partial acceptance.

Only presentation/version may update on the accepted parent. Each change uses
the existing request repository and version parser, appends attributable history
and cannot edit snapshot, price, promise or demand. A 412 returns authorised current
state with its ETag; the UI compares requested/current modes and requires reload.
Lost responses freeze/replay the exact command. After uncertain replay, a durable
read checks for later changes. Initial rate rejection is distinct from unknown
outcome. Acceptance-read outages retain an explicit Open booked order action.

Rollback is application-only and compatible: retain all additive tables, accepted
rows, origins, identifiers and snapshots; disable unsupported new commands instead
of converting accepted work into drafts. No destructive down migration or live
restore. Back up before non-disposable schema application. Restore epoch,
quarantine, kill switch and money-freeze boundaries remain unchanged. Privacy
erasure/retention and production activation are still gated; no real data is used.

## Verification ledger

Windows, pinned Node 24.21.0/pnpm 12.11.2, real disposable PostgreSQL 18.6.
Logs/captures are ignored `.scratch/quick-order-b-*`; no credentials enter Git.
Tested base: c6ab32d plus this implementation. Runtime/test inputs are recorded
in [the SHA-256 manifest](Quick_Order_Acceptance_Verified_Files.sha256), digest
`a7e5dc1fbba64d73f342175d34bb24903df3115eefe372045dafe86813593ede`.
The full integration command began before the final UUID/conflict refinements;
the focused command below reran every B case with those refinements. The final
binding race was added afterward and run independently. Final review then
added a UI-only navigation guard while an accepted-mode
response is unknown. Affected lint, Knip, strict types, production build and
B browser cases rerun for that guard; framework-free unit/PG inputs are unchanged.

- Initial focused PostgreSQL: 2/2. Expanded transaction/publication suite: 10/10,
  104.44s. Covers actual-write fault injection at order/snapshot/instance/demand/
  presentation/draft/audit/key stages, rollback and exact retry, key-expiry origin
  uniqueness, first/last slot, rule revision load continuity, source publisher races,
  cross-shop reads and protected history. Further missing-source/guardian/upgrade
  cases were subsequently added and verified below.
- Initial migration run caught a PL/pgSQL CASE expression needing parentheses;
  corrected before the passing focused runs. An early negative assertion was
  corrected to inspect the wrapped PostgreSQL 42501 cause, not the wrapper text.
- Initial full integration exposed an older exact bootstrap table inventory;
  both bootstrap and isolation inventories were extended in sorted order without
  weakening RLS/grant checks. Superseded runs were interrupted while the price
  column, truthful load timestamp and conflict contracts were completed; they
  are not evidence for the final candidate.
- Default `pnpm verify:fast` hit existing 5s command/jobs property deadlines under
  54 workers (232/234). Same assertions/timeouts with four workers passed 235/235
  after adding exact currency round-trip coverage (31.75s). A complete
  `VITEST_MAX_WORKERS=4 pnpm verify:fast` then passed lint, Knip, strict types,
  unit/property tests, negative checks, 70-path OpenAPI and 12/12 production build
  (38.12s). Later conflict/UI changes are covered by the final checks below.
- Current Context7 lookups: Zod strict/optional object contracts and Drizzle
  PostgreSQL bigint/date mapping. No dependency/toolchain change.
- Final `VITEST_MAX_WORKERS=4 pnpm verify:fast`: passed lint/boundaries/tokens,
  Knip, strict types, 235 unit/property tests, negative DTO/UI checks, 70-path
  offline OpenAPI and 12/12 production build (30.455s build, 32.95s unit command).
  Log: `.scratch/quick-order-b-fast-final.log`.
- Final `pnpm exec vitest run --config vitest.integration.config.ts
  tests/order-acceptance.integration.test.mjs`: 17/17 passed, 345.67s, including
  uppercase-wearer guardian locking, bigint price and authorised-current 412.
  Follow-up `-t 'service.commitment-bindings publisher race'`: 1 passed / 17
  skipped, 29.35s. The combined 18 cases cover every scoped B transaction scenario.
  Logs: `.scratch/quick-order-b-pg-focused-final.log` and `...binding-final.log`.
- `node scripts/verify-quick-order-exports.mjs`: passed fresh frozen install,
  10/10 package builds and seven public imports in a native Windows path with
  spaces (37.605s build). Export mappings did not subsequently change;
  later core/UI changes are covered by final fast and focused checks.
  Log: `.scratch/quick-order-b-clean-exports.log`.
- Browser test setup initially called native Response.status as a function;
  corrected the test-only fixture bridge. Two later runs exposed test timing
  that treated known admission rejection as lost success. The final transport
  fixture waits for an actual 200 before dropping the response and uses a response
  barrier for 429, retaining real runtime rate limits and duplicate assertions.
- Final review found New order draft could unmount an accepted detail during an
  unknown mode response. The action now observes the existing work guard; the
  browser test asserts it is disabled until exact recovery succeeds.
- Full `pnpm test:integration`: **37 files / 170 tests passed**, 2464.74s
  (41m 4.74s), exit 0. This includes the exact tenant inventories, pooled
  isolation and existing customer/guardian/settings/catalogue/draft/command
  foundations. See the input/refinement qualification above; final B focused
  reruns cover the later changes. Log: `.scratch/quick-order-b-integration-candidate.log`.
- `node scripts/test-ui.mjs tests/ui/order-acceptance.spec.mjs
  tests/ui/orders.spec.mjs`: **6/6 passed**, 12.6m. English/Tamil, both themes,
  real accepted-response loss/replay, mode loss/replay and stale-current reload,
  persisted exception reason, two accepted orders/one demand each, axe, overflow,
  canonical draft recovery/outage/IME/landscape/200% zoom and sign-out. Before the
  final UI navigation guard; affected B cases rerun below. Automated intake to
  acceptance, including recovery/admission waits: phone **5989ms**, tablet
  **5477ms**, desktop **4819ms**. Profiles: 360x800, 820x1180, 1440x1000;
  A landscape/reflow 1180x820. Excludes owner reading, real devices and customer
  conversation; these timings do not prove AC-59's physical owner target.
  Log: `.scratch/quick-order-b-browser-final.log`.
- After navigation guard: `pnpm lint`, `pnpm knip`, `pnpm typecheck` passed,
  23/23 type tasks, 29.43s. Final `pnpm build`: 12/12 passed, 22.493s.
  `node scripts/test-ui.mjs tests/ui/order-acceptance.spec.mjs
  tests/ui/orders-access.spec.mjs --workers=3`: **6/6 passed**, 2.7m, exit 0.
  Covers the final navigation guard while response is unknown, exact recovery,
  landscape/200% reflow and cross-tab sign-out/history clearing in every profile.
  Final accepted-intake automation timings: 7773ms phone, 7372ms tablet, 4478ms
  desktop (same exclusions above). Logs: `.scratch/quick-order-b-navigation-*`.
  Final detector again returned `[]`. No runtime/test input changed afterward.

## Owner review packet

Running review URL: **http://127.0.0.1:54496/orders** (final build ready 20:32:18 IST).
The T3 preview is privately signed in and has reopened QO-000001. Its direct
route is `/orders?order=01a154af-4f08-79a7-a17e-250d1f35d7db`; the incomplete
intake is `/orders?draft=89595293-94f2-762c-b0e9-99874a37c615`. Suggested synthetic
delivery date: **2026-11-18**. The host must remain running for these records.

Use the existing local synthetic host path. Private access stays in
`.scratch/quick-order-review-host/private.json`; never send its credentials.
Start: `node scripts/review-quick-orders.mjs`; stop only this host with the same
command plus `stop`. The host prepares one accepted zero-price order and one
incomplete draft for the same authorised synthetic customer/wearer and blouse.

1. QO-01/03/04: resume the incomplete draft, inspect customer/wearer and exact
   blouse-stitching service (manifest label `SYNTHETIC before-craft`), and
   customer/wearer `SYNTHETIC Meena` (self). Enter its suggested delivery date.
   Save/reload preserves raw details.
2. QO-07/08: review shows existing demand 1 and candidate 1 against synthetic cap
   1. Confirm stays unavailable until acknowledgement and an exception reason.
   Accepting produces the next unique readable code and a durable order detail.
3. QO-03/06/10: reopen QO-000001, distinguish draft-start/creation/acceptance/
   original/current dates, zero versus to-be-quoted, unresolved items and owner.
   Change Simple/Detailed and inspect history; no checklist/date/price/capacity
   changes. No payments, received material, measurement values or ready work.
4. QO-11: repeat the review/detail in Tamil and both themes on actual phone,
   tablet and desktop. Assess terminology, keyboard/focus, long copy and 200%
   reflow. Fluent Tamil, physical Android/IME/AT reports remain human acceptance.

Report: `QO-ID — pass/fail — observation (device/browser/language)`. Automated
timing excludes owner reading and cannot prove the physical two-minute target.
Sharing/PDF/WhatsApp, measurement capture, payments and later execution consumers
retain their own gates. Owner acceptance and merge authorisation remain separate.

## Ticket-local acceptance traceability

The command/result ledger above determines execution status. These are scoped
contributions, not closure of later product consumers or pending human gates.

| Check | Concrete evidence |
| --- | --- |
| QO-01 | `tests/order-acceptance.integration.test.mjs` accept/read/zero/to-be-quoted cases; `tests/ui/order-acceptance.spec.mjs` repeat customer, permitted wearer, exact service, actual acceptance and reopened QO code. |
| QO-02 | A identity/guardian foundation regressions plus B minor revocation race; uppercase UUID spelling uses the same authority lock. No measurement/photo capture. |
| QO-03 | Snapshot/source/instance assertions; category/template/rule/binding/calendar/policy publisher barriers; historical read after source disabling. |
| QO-04 | Existing `tests/ui/orders.spec.mjs` save/resume/outage/IME tests; B persists exception/waiver review intent in the canonical draft, reloads it and requires fresh acknowledgement. |
| QO-05 | Concurrent exact-key promotions, changed request/action refusal, retained origin uniqueness after key expiry; UI drops an actual committed acceptance and presentation response, retries their frozen requests and checks one effect. |
| QO-06 | PostgreSQL immutable snapshot/requirements assertions across attributable mode changes; UI mode/history, lost response and stale-current comparison. Canonical source/input data remain shared with A. |
| QO-07 | Existing evaluator reused with server-resolved rules/demand/clock; missing configuration, incomparable effort, zero-cap unknown, historical cut-off, exception and waiver reason cases; Tamil capacity review. |
| QO-08 | Simultaneous empty first/last slot, reasoned follow-up, same-key concurrency, rule revision preserving counted demand; deterministic publisher/guardian lock barriers. |
| QO-09 | New-table forced RLS/grant inventory, missing/foreign context and composite FK negatives; eight actual-write fault boundaries roll back order/snapshot/instances/demand/audit/draft/result/key. Full integration covers existing pooled reuse/private paths. |
| QO-10 | Server acceptance clock defeats historical backdating; detail distinguishes original/current/order/creation/draft/acceptance/requested/event dates and unresolved next action. |
| QO-11 | Three Playwright profiles, English/Tamil, both themes, axe, focus and horizontal overflow assertions; A retains IME/viewport/reflow coverage. B timing includes admission/transport recovery and excludes owner reading. Physical Android, fluent Tamil, keyboard/AT and two-minute target remain human acceptance. |
| QO-12 | Draft/review still have no booking effect; acceptance adds only its scoped order/demand/history. No payment, document issue, receipt, custody, measurement, execution, messaging or live activation. Existing foundations remain in the full integration gate. |

A batched visual inspection used phone Tamil/light and desktop English/dark
captures against incumbent tokens/fonts and the running reopened record. No
material layout defect was found; no aesthetic rewrite was introduced.
Impeccable detector on both order screens and shared CSS returned `[]`.
No document-renderer/font/template input changed, so Tamil PDF goldens and the
full `pnpm verify`/full browser suite remain promotion gates. Additional Linux
clean verification is not required by a toolchain/dependency change; the changed
exports were exercised by the scoped clean native-Windows frozen-install probe.

## Delivery state

Local software review-ready observed **20:35:19 IST**, after the final 6/6
browser results. Required feature CI and owner review remain pending until the
PR readback. No full promotion `pnpm verify`, full browser suite or PDF run is
claimed for this feature delivery. These retain the documented promotion gates;
no document rendering input changed. No merge/deployment/live data operation.
