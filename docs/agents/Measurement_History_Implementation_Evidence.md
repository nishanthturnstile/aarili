# Measurement corrections and reviewed reuse — #154 / 1.3.2b

Implementation started 23 October 2026, 05:14:47 UTC, at the owner's explicit
selection of [#154](https://github.com/nishanthturnstile/aarili/issues/154).
Existing checkout; `development` pulled with `--ff-only` to `43fa1b3`, then
`codex/measurement-history-reuse`. No worktree, baseline upgrade, live data,
deployment or automatic merge is included.

## Authority and baseline

Product §§7/9–10/13/24–25/27/29.1/30.1/32–33; architecture §§6–11/15;
[design MV-D08–14](Measurement_Versions_Design.md) and
[ticket packet B](Measurement_Versions_Ticket_Packet.md) govern this slice.
MEA-04/07, continued MEA-01/02/03/05/06/11; CUS-03/05/06/07,
ORD-08/12/13, DES-11 and incumbent TRU/USE safeguards apply.
AC-02/06/40/52/53/55/59 and partial AC-07/08 remain the scenario references.

All native direct blockers were closed as completed, with merged closing PRs:
#153 → #156; #134 → #139; #135 → #140; #136 → #141;
#137 → #142; #138 → #143. The issue has `ready-for-agent`; its comments were empty.
The owner merged validation follow-up [#160](https://github.com/nishanthturnstile/aarili/pull/160)
at 04:59:06 UTC. Its required fast verification/audit passed on `b59ee40`.
That does not establish full verification: manual run
[39902276640](https://github.com/nishanthturnstile/aarili/actions/runs/39902276640)
ended with six successful browser shards, three failed shards and cancelled
scaffold verification. All three failures report duplicate service landmarks.
The same failure was reproduced locally during this slice, before correction.

## Implemented boundaries under verification

- Session identity is the initial saved version ID. Corrections append an exact
  form-bound predecessor/sequence with actor, time and private reason. Expected
  lineage head is checked under the session barrier; source kind/date stay the
  same. A different observation/date starts a separate session. No saved values
  are updated and no garment selection follows the new head automatically.
- Garment/piece selections append events with scope sequence CAS. The current
  pointer is a projection of the committed sequence. Earlier selections remain
  attributable. Grouping is navigation only; each wearer and native piece stays
  independent.
- Body-based review binds the exact personal version, target scope/version,
  actor/shop, current wearer authority, current form-use approval and source
  context. Suitability starts unconfirmed. Physical cutting/dispatch and known
  commercial effect require explicit review statements. Unknown or incumbent
  governed/imported impact blocks replacement atomically. This is reported
  physical evidence, not a verified production/cutting/price approval.
- Exact identity compatibility only. Retired/replaced/unapproved forms remain
  historically readable, but cannot silently map into a new selection. No expiry
  threshold, precision rule, measurement, tolerance or formula was invented.
- `order.repeat@2` carries only reviewed version/source-piece IDs and exact piece
  key. It rechecks current access, source selection and target manifest at draft
  write/read and acceptance. New order commitments and IDs remain independent;
  after acceptance the new garment still needs its own explicit selection review.
  Existing v1 repeat drafts cannot carry the new reference and retain their path.
- Customer history projects minimal measurement events behind current measurement
  authority before search/pagination. Values and private correction text remain
  in dedicated authorised detail. Contact merge/relink guards continue to block
  measurement ownership transfer.
- All personal revision values/context/reasons use the existing audited privacy
  stores and `measurement.session` private draft/replay path. Repeat references
  contain no copied values, dates, measurer, fit notes or reasons; IDs remain as
  provenance/tombstones, and current authority/erasure blocks their reuse.

## Migration and recovery

Reviewed additive `0047_measurement_history.sql` extends the existing forced-RLS
relations and provenance/immutability triggers. Existing V1 identity gets only
`session_id=id`, sequence 1 and no predecessor; no observation is fabricated.
Existing order/form/design/acceptance snapshots are not rewritten. Composite
tenant/session predecessor references and unique scope/session sequences prevent
forks and foreign lineage. No new runtime role, tenant table or queue is added.
The populated fixture exposed that FORCE RLS hid legacy rows from the migration
owner. The runner's advisory/DDL transaction now removes FORCE only for the
owner's structural `session_id=id` update, then restores it before commit;
runtime tenant policies remain enabled. The populated/reapplication test and
isolation catalogue prove the final state, rather than relying on empty fixtures.

Minimum compatible reader/writer is **1.3.2b / migration 0047**, including
multi-version sessions, selection history and repeat schema 2. Disable new writers
before application rollback; keep immutable rows and use a compatible reader.
Do not roll back to A and misread an arbitrary selection as current. Back up
before a populated rollout. Restore retains the existing epoch/kill switch and
replays wearer tombstones before access/reuse. No destructive down migration.
New restrictive policies require the repository's transaction-local
`app.measurement_history_reader=1.3.2b` marker on version/selection reads and writes.
An A-style unordered read is denied with 42501. Missing/wrong tenant context
still returns no rows; the marker confers no authority. The old-reader denial
and pooled rollback are exercised against real `app_user`, with no bypass role.
This is a coordinated maintenance cutover, not a mixed A/B binary rollout:
stop ordinary measurement access/writes, back up, apply the locked migration,
deploy the compatible reader/writer and validate before resuming. Old A access
fails closed after 0047. A compatible rollback retains the B history reader and
schema; an A-only rollback is unsupported. No rollout is performed by this issue.

## Verification ledger

Development results below are bounded to their then-current inputs; the final
fingerprinted result remains pending. The acceptance matrix below distinguishes
automated observations from the remaining human findings.

| Command / input | Observed result |
| --- | --- |
| Initial strict typecheck | Failed on a new DB type import from undeclared `zod`; replaced by an exported contracts type, without a dependency change. |
| Corrected `pnpm typecheck` | Exit 0; all 23 workspace tasks and test declarations passed. Later edits need affected verification. |
| First attempted focused PG command with extra `--` | `vitest list` proved it selected the full suite (260 tests). Stopped the owned process tree; partial execution is not counted. Correct invocation omits the extra separator. |
| Focused A+B real PG | Exit 0, 9 tests / 2 files, 114.96s. Original A, correction/history/CAS/replay/rollback/reuse/erasure checks passed before the subsequent repeat-acceptance additions. |
| Measurement values/sessions + repeat units | Exit 0, 25 tests / 3 files, 1.05s. Exact arithmetic is reused, without changed policies. |
| Broader PG development pass | 13 passed / 2 failed, 168.73s. History inventory assertion still expected measurements unavailable; repeat save compared raw JSON key order. Both corrected; the later populated-upgrade run passed repeat acceptance and history. |
| Phone root browser, B + order acceptance, before key fix | 2 failed. Both report duplicate Added services / Service line completion landmarks. Kept axe enabled. Distinct service/measurement sibling keys corrected the reproduction, as recorded below. |
| Key correction reproduction | Order acceptance phone passed, including axe. The new B case passed axe but failed reflow; bounded measurement select/grid sizing corrected the long impact controls. Full statements also render as wrapping text. |
| Populated upgrade development pass | 7 passed / 1 failed, 109.34s. The failure was the owner/RLS structural initialization described above. Repeat acceptance and customer-history regressions passed in that run. |
| New B PostgreSQL file after correction | Exit 0, **5 passed**, **93.26s**. Includes genuine pre-0047 V1 writes/selection, additive upgrade/reapplication, incompatible reader denial, 27-selection pagination, form retirement, repeat acceptance and injected rollback/erasure concurrency. |
| Original A + B + v1 repeat root browser, three sizes | Exit 0, **9 passed**, **7.9m**, both languages. Subsequent additions expanded B's stale-head and repeat-reference observations; this is bounded development evidence, not an unrun full-suite result. |
| Expanded B root browser, three sizes | Exit 0, **3 passed**, **4.6m**. English/Tamil, light/dark, axe/keyboard/reflow, retained stale input versus current head, deliberate V2 selection despite V3, reviewed schema-2 repeat creation, and access-loss clearing. |
| Full root `pnpm verify` | Started **06:18:05.449 UTC** on dirty base `43fa1b3`. Frozen **811-file** code/config/test fingerprint **`d33074580e6bab03f6bf07d6e0315f7201809526a6553d0ce012c7e9dcf30824`**; stopped for the lock-order correction described below. Metadata/logs: ignored `.scratch/measurement-history-validation/verify-2026-10-23T06-18-05.449Z.*`. Docs are excluded from this application fingerprint. |

At 06:25 UTC the full run had passed actual lint/boundaries/tokens, Knip, all
23 strict-type tasks, **311 unit tests / 67 files**, negative type checks,
OpenAPI and Linux namespace/seccomp PDF goldens (four fonts, 50 synthetic strings,
five A4/A3 pages). PostgreSQL, final build/smoke/artifact stages were still running;
these earlier stages do not establish a full pass.
That run was subsequently stopped for a concrete review-discovered lock-order
correction, rather than represented as complete. A controlled two-wearer PG
regression first reproduced **404/503** for opposed foreign-source review requests
(1 failed / 5 filtered, 14.01s). Resolving non-personal ownership before taking
another wearer barrier/hydrating values corrected it: **404/404**, no effects,
1 passed / 5 filtered, 12.54s. The repeat adapter also checks the exact selected
source reference before reading its personal version. The full command is being
restarted with this change; the earlier `d330…` fingerprint is historical.
The restarted full command began **06:37:23.580 UTC**, still on dirty base
`43fa1b3`, with **811 files** and fingerprint
**`45068efbe5680bbc29e5837a4193fa597d767c116876efa8da8d73184310e09f`**.
It finished **07:26:22.428 UTC**, **exit 1 / 2938.848s**, with the same
811-file fingerprint at the end. Raw output/start metadata
are retained in ignored `.scratch/measurement-history-validation/verify-2026-10-23T06-37-23.580Z.*`.

At approximately 06:48 UTC the restarted full run reported one failure in the
incumbent `GB-05/06 minor guardian withdrawal ... historical materialisation`
case (44-case order-acceptance file, 457.50s; failed case 57.139s). Final
diagnostics show Docker HTTP 409: that fixture container was stopped during
setup. The isolated pass below did not require an application change. A bounded isolated
reproduction, without source changes, passed **1 / 43 filtered, 14.76s** via
`pnpm test:integration tests/order-acceptance.integration.test.mjs -t "minor guardian withdrawal serializes"`.
This does not turn the failed full run into a pass. Its final integration
result was **269 passed / 7 failed, 48 passed / 4 failed files, 2880.02s**.
Production stages below were run separately because the pipeline stopped there.

Separate frozen-source `pnpm build` completed with **exit 0, 12 tasks,
23.821s**, on Next 16.4.2 with strict checks and 19 routes. `pnpm smoke` then
exited 0: production Next/Hono/real-PostgreSQL readiness, outage, typed client and
worker shutdown passed. `pnpm exec node scripts/check-artifacts.mjs` exited 0,
checking **29 browser artifacts**. These are actual separate stage results;
they do not erase the full integration failure or claim full `pnpm verify`.

### Full-run follow-up and hosted coverage

Draft [PR #161](https://github.com/nishanthturnstile/aarili/pull/161) opened
**06:57:34 UTC**, capability commit `e19bfdb`. Its required Fast verification and
Dependency audit passed. Manual full workflow
[39914719269](https://github.com/nishanthturnstile/aarili/actions/runs/39914719269)
was dispatched at **06:57:43 UTC** on that same commit:

- All **nine browser shards and their aggregate passed**. Counts are
  **27 + 29 + 25 = 81 per device**, **243 total**. Comparing every passed
  file/line/title/project against fresh `pnpm exec playwright test --list`
  proved 243 unique matches, no missing cases or extras. Each job retained one
  worker, zero retries and its existing 40-minute budget. Actual root command
  per shard was `pnpm test:ui --project=<device> --shard=<n>/3`.
- Scaffold reached its **20-minute job limit** and was cancelled at 07:18:00 UTC;
  it is not a pass. Its completed B PostgreSQL file passed **6 tests / 52.380s**;
  A/history/repeat/design/identity results remain bounded to completed stages.
  The private-configuration canary stage was not reached. No CI timeout or test
  limit was changed, and the unchanged cancelled job is not blindly rerun.
- The local full run exposed six stale fixture expectations: four API draft
  scenarios asserted the pre-B workflow registry and their assertion mapped to
  503; tenant-path inventory still described A; the historical pg-boss upgrade
  compared migration history while also applying later feature migration 0047.
  The registry/path expectations now name B explicitly. The pg-boss fixture is
  scoped through its reviewed 0046 migration while B's populated 0047 upgrade
  remains covered independently. No product handler/policy was relaxed.
- After those three test-only corrections, actual
  `pnpm test:integration tests/dependency-upgrades.integration.test.mjs tests/drafts.integration.test.mjs tests/tenant-isolation.integration.test.mjs`
  passed **14 tests / 3 files, 119.51s**, exit 0. No application, migration,
  browser helper or browser test input changed from the 243-pass candidate;
  that full browser evidence is reused rather than repeated.

A fresh frozen full `pnpm verify` is required on the corrected test inputs; its
start/end fingerprint and final outcome will be recorded before handoff. Human
review, production activation and owner merge remain separate.

Scenario sources:
[PostgreSQL](../../tests/measurement-history.integration.test.mjs),
[current browser](../../tests/ui/measurement-history.spec.mjs),
[A browser regression](../../tests/ui/measurement-sessions.spec.mjs),
[migration](../../packages/db/migrations/0047_measurement_history.sql),
[review helper](../../scripts/review-measurement-sessions.mjs).

Final bounded UI confirmation reviewed the synthetic phone Tamil/dark and desktop
English/light captures together. The final Impeccable detector on the two changed
measurement/repeat surfaces and shared CSS exited 0 with no findings. These
checks do not substitute for the human language/device findings below.

An intermediate seven-file PG development run was stopped after the compatibility
schema changed during implementation. Its mixed inputs/partial execution are not
final evidence. Final verification uses frozen inputs. Root Biome reports existing
unrelated warnings/infos; none were silently reformatted into this issue.

The duplicate service landmarks were a reconciliation defect: service and
measurement siblings shared `key={order.id}`. Distinct stable keys preserve their
instances across language/reload updates. The failure reproduced before this
two-line correction and the incumbent acceptance workflow passed afterward.
[React's sibling-key guidance](https://react.dev/learn/rendering-lists#rules-of-keys)
was fetched through Context7; the axe rule remains enabled.

## Acceptance traceability

| Acceptance | Concrete evidence and remaining qualification |
| --- | --- |
| MV-B01 | PG V1/O1 → append V2 → explicit O2, unchanged V1 values/O1 reference/accepted snapshot; a changed observation date is rejected as correction and works as a fresh session. B UI exercises the same distinction. |
| MV-B02 | PG competing lineage and selection writes yield one success and one 412; same-key replay returns the original ID; injected writes roll back audit/key/version/selection. B UI retains `12 3/4` after a competing head commits and compares without merge. |
| MV-B03 | Body-based current-authority/exact-form review exposes source/date/age/method/measurer, authorised exact-version garment context and explicit unknown impact. Suitability is unchecked. Retirement blocks pending use while historical detail and original selection stay intact. A covers foreign/same-phone wearer denial and exact arithmetic. |
| MV-B04 | Real PG schema-2 repeat creates independent draft/order IDs, carries only exact reviewed IDs/piece key, rechecks access/manifest at acceptance, and leaves the new scope unselected until its own review. v1 remains compatible; the new chooser/draft reference works in both languages at all three sizes. |
| MV-B05 | Session/wearer and target/piece keys remain independent; no Apply-all exists. Measurement history computes current private permission before filtering/pagination, with a second SQL authority check. Payer merge/relink guards remain in the incumbent event/draft paths; their full regressions are included in final verification. |
| MV-B06 | Unknown physical/commercial impact yields an explicit unsupported-impact state; governed work remains denied. Source versions, original selections, price/date/design/accepted snapshots remain unchanged on denial. No approval, cutting/dispatch, output-staleness or price-change engine is claimed. |
| MV-B07 | Populated migration/reapplication, forced RLS, incompatible-reader denial, current permission/erasure, private-copy redaction, immutable references, injected rollback and correction/erasure barrier are real PG tests. Common A guardian/age/form barriers and identity/history/repeat regressions remain required in the full run. |
| MV-B08 | Focused current bilingual three-size browser/axe/reflow/keyboard and private-capture audits passed. Full root verification/browser coverage and the running human review packet remain separately tracked; automation is not fluent-Tamil/physical-device/screen-reader acceptance. |

No physical-device, fluent-Tamil, assistive-technology or live policy acceptance
is inferred from automation. C / #155 remains unselected and blocked on B's merge;
B alone does not complete private fit media or the whole 1.3.2 feature.

## Manual review packet

Fresh host observed ready **23 October 2026, 06:56 UTC**:

- **O2 / unselected:** [http://127.0.0.1:54642/orders?order=01a1678b-4e41-72d2-a79f-e2157e54154b](http://127.0.0.1:54642/orders?order=01a1678b-4e41-72d2-a79f-e2157e54154b).
- **O1 / original V1:** [http://127.0.0.1:54642/orders?order=01a1678b-483b-7e13-b9c8-434d89cf215c](http://127.0.0.1:54642/orders?order=01a1678b-483b-7e13-b9c8-434d89cf215c).

The collaborative incognito preview reached this host's sign-in route; it has
no copied Nool session. Sign in using the private access file, then open the
exact O1/O2 link. The authenticated workflows were exercised by the synthetic
production browser tests above. Do not reuse an older stopped URL. Startup is `pnpm exec node scripts/review-measurement-sessions.mjs history`.
The synthetic email/password and fixture pointers stay only in ignored
`.scratch/measurement-history-review-host/private.json`; never copy credentials
into Git/chat. This disposable fixture does not use the Nool research account.

Review the order route in English and Tamil, light/dark, and phone/tablet/desktop.
Automated coverage uses Chromium emulation. Actual device, fluent Tamil and
assistive-technology observations remain human acceptance.

1. **MV-B01:** Open original O1 and expand its native garment's measurements.
   Its selected V1 retains entered `12 1/4 in` and the original observation date.
   Expand corrected V2: `12 1/2 in`, same session/form/date, predecessor V1,
   attribution and correction reason. Reload O1: it still selects V1.
2. **MV-B01/03/06:** Open separate O2. It starts unselected. Choose that native
   garment and review V2. Check source, method, measurer, exact form, observation
   age and available prior garment context. Unknown impact blocks selection.
   Only report physical/commercial statements that are true for this synthetic
   fixture; check suitability, enter a reason and explicitly select. O2 then
   shows V2 and O1 still shows V1. Changing display units preserves entered data.
3. **MV-B02/03:** Begin a correction, type a value, and compare prior/current
   values. A correction appends history and does not move either order pointer.
   A new observation date uses a fresh session. Stale competing-head retention
   and independent target CAS are automated real-PG/browser evidence above;
   the owner need not replay terminal tests.
4. **MV-B04/05:** From O1, review repeat-as-new and deliberately choose its exact
   selected measurement reference. Review and save a new draft with fresh
   commitments. No source approval/date becomes a new fact; after acceptance
   its new garment requires another explicit selection review. Other native
   pieces and the same-phone second adult retain independent wearer scope.
5. **MV-B07/08:** Assess the availability/conflict wording, keyboard order,
   Tamil wrapping and retained-input comparison. Guardian/private access loss,
   erasure, unsupported impact and failed-write rollback are automated negative
   cases; record any human usability or policy concern separately.

Report: `MV-Bxx ? pass/fail ? observation`, with device/browser and fluent-Tamil
or assistive-technology context when relevant. Owner review and production
configuration/form/privacy approvals remain pending, independently of CI.

Cleanup: `pnpm exec node scripts/review-measurement-sessions.mjs history stop`.
The host then stops its disposable web process/PostgreSQL and removes its private
access file. No tunnel, production demo or live data is created.
