# Delivery measurements

## Supplemental delivery: shop calendar (#85 / 1.1.1b)

- At the publication follow-up, owner authorized commit, PR and conditional merge,
  then the next unblocked issue. Fresh pre-publication fast verification passed:
  45 files/182 tests plus lint, Knip, types, declarations, OpenAPI and build.
  Completion observed 2026-10-17T20:12+05:30; exact active preparation time unknown.
  The first launcher returned 1 despite successful stages; the unchanged-source
  installed `pnpm.cmd` diagnostic rerun confirmed exit 0 at 20:14 IST.
- Owner requested implementation, confirming same-date ranges and independent
  domain replacements. Branch `codex/shop-calendar` uses the existing checkout
  from merged development `549955b`; #55/#56/#84 blockers are merged. No worktree,
  publication or deployment was performed.
- Actual implementation start and active coding time were not captured. First
  retained timed checkpoint: 2026-10-17T18:54:28.9564175+05:30; this is not the
  initial implementation start. Final review host was observed available at
  2026-10-17T19:48:04+05:30, http://127.0.0.1:59499/settings. Initial first-try
  preview timing is unknown.
- Fast verification passed 182 unit tests, lint, Knip, strict declarations,
  OpenAPI and production build. Focused calendar/draft PostgreSQL checks passed
  eight tests in 53.95s. Full native clean verification reached 111/116 integration
  passes in 1174.45s after successful clean install, unit and Linux PDF stages.
  Four inventory expectations and one transaction-timestamp ordering assumption
  failed; corrected targeted runs passed (bootstrap 10.09s, tenant/auth suites
  138.92s, adjusted auth case 9.96s). The failed full command remains recorded.
- Final scoped clean frozen-install/export/declaration check confirmed process
  exit 0 and unchanged lockfile. An incongruent earlier wrapper exit prompted
  that bounded diagnostic rerun. Production smoke and all 29 artifact scans
  passed. Final UI corrections received refreshed lint/Knip/types and build.
- Calendar browser cases: three size projects with English/Tamil and axe passed
  in 4.3 minutes. Four existing customer/wearer/guardian/profile regression cases
  passed in 5.1 minutes. All sixteen final responsive/error-state captures were
  refreshed and inspected. Independent finish review returned scoped `ship`:
  all three prior findings resolved. Earlier failures/rework are retained in the
  [implementation evidence](Shop_Calendar_Implementation_Evidence.md).
- Largest measured stage was broad PostgreSQL integration (19 minutes 34s;
  full clean command approximately 26 minutes). Checking table/registry inventories
  before the broad run would have avoided four expectation failures. No active
  duration or benchmark improvement is inferred.
- Owner review, physical Android, fluent Tamil, assistive technology, hosted CI,
  publication, merge and deployment remain pending. Local review packet ready:
  2026-10-17T19:49:31+05:30, after the scoped independent review. No CI or
  merge-wait interval exists yet; active implementation duration remains unknown.

## Delivery 5: existing shop profile and history (#84 / 1.1.1a)

- Implementation branch start observed 2026-10-17T15:46:59.4580104+05:30,
  `codex/shop-profile-history` from integrated `origin/development` `1cf5724`.
  Local development was subsequently fast-forwarded to the same revision.
  Dirty roadmap/planning files were carried with Git's merge checkout; no
  reset, stash, unrelated commit or worktree. The previous branch is preserved.
- Owner approved the concrete A–E packet and proceeding; issues #84–#88 were
  published and native blocker edges read back. #84 blockers #16/#51/#53/#57/#58
  all closed through freshly verified merged PRs #21/#61/#64/#67/#69. Onboarding
  #77 and minor registration #83 also merged. Baseline #83 Fast verification
  and Dependency audit passed (run 39021313403); full promotion-only checks skipped.
- Implementation and final local verification are complete for review. Hosted
  CI/publication, owner acceptance and merge were pending at the local-ready
  checkpoint below. Active durations remain unknown; no future timing is reconstructed.
- First production review host observed by collaborative browser at
  2026-10-17T16:15:24+05:30, `http://127.0.0.1:59636/settings` (redirected to the
  normal private sign-in page before synthetic authentication). Disposable
  access is kept in the ignored private host file. This is first-try availability,
  not finished-product acceptance or the final refreshed host.
- Development verification: initial focused profile PostgreSQL 3/3 and contract/
  policy unit 2/2 passed. `pnpm verify:fast` passed with 174 unit tests, OpenAPI,
  production build, lint, Knip and types before the finish corrections. Broader
  customer/guardian/profile/isolation selection had 12 passes and three outdated
  table/registry inventory failures; corrected tenant-isolation rerun passed 6/6.
- First private-logo browser run failed on all three sizes: StrictMode disposed
  the state-owned controller. Effect-owned scopes corrected it; fresh configured
  logo upload/process/attach/remove/history passed 3/3 in 2.1 minutes.
- The first clean-native attempt stopped on formatting in the new browser test.
  The next clean copy passed fast checks and Linux PDF checks, then exposed an
  additional outdated bootstrap table inventory. The corrected full clean run
  started at 2026-10-17T16:28:48.9016951+05:30; its result remains pending.
- Finish corrections cover concise phone navigation, unavailable-feature copy
  and meaningful current-owner attribution with secondary stable reference.
  A case-sensitive accessible-name containment check initially appended redundant
  short labels and broke exact profile navigation assertions; corrected to
  compare case-insensitively. Final production recaptures/review remain pending.
- Broad browser regression command finished at observed 2026-10-17T16:44:08+05:30:
  15 customer/adult/guardian cases passed across all three sizes; three profile
  cases failed at the already-corrected exact navigation-name assertion. Total
  Playwright wall time 28.5 minutes. The complete command failed and is retained.
- The full clean-copy PostgreSQL run reported 112/113 passes, 1422.07 seconds;
  the sole failure was the stale bootstrap table inventory, now corrected. The
  intermediate corrected run failed one existing five-second job property timeout
  (173/174 unit passes); its isolated unmodified rerun passed 2/2 in 2.13 seconds.
  Intermediate run: 16:28:48.9016951 → 16:31:29.3324689+05:30, exit 1.
- Final source clean run started 2026-10-17T16:45:05.4417245+05:30. Browser work
  was paused for its unit stage; all 174 unit tests passed. All 470 source/config
  inputs matched the final clean copy. Full final result remains pending.
- Corrected production build passed. Fresh profile browser command:
  2026-10-17T16:47:14.3405255 → 16:48:40.4920139+05:30, exit 0, 3/3; Playwright
  reported 1.3 minutes. Six captures received the scoped finish-review verdict
  “ship the reviewed corrections”; all three original findings resolved.
- Refreshed production review host: http://127.0.0.1:63238/settings, observed
  ready by 2026-10-17T16:47:39+05:30. Prior host was stopped and removed before
  rebuilding. Synthetic sign-in and host data remain private/disposable.
- Final clean-native gate: 2026-10-17T16:45:05.4417245 →
  17:07:09.3069322+05:30, exit 0 (22 minutes 4 seconds). All 174 unit and 113
  integration tests passed; integration reported 1124.61 seconds. Frozen install,
  Linux PDF sandbox/50 strings/five page goldens, strict types, lint, Knip,
  negative checks, OpenAPI, production build/smoke and 29 artifact scans passed.
- Final owner-entry/bilingual phone-shell checks:
  2026-10-17T16:48:58.4088243 → 16:50:08.1793013+05:30, exit 0, 3/3;
  Playwright reported 1.0 minute. Browser and clean source inputs stayed unchanged.
- Efficiency observation: checking every static tenant-table inventory before
  the first full run would have avoided its inventory-only failure. Separating
  the final unit stage from browser work avoided repeating the observed
  five-second property timeout. This is an observed process opportunity, not a
  promised benchmark improvement. Merge/review waits remain pending; compare
  the five deliveries only after this fifth entry is actually merged.
- Local review packet ready at 2026-10-17T17:07:50.9385660+05:30; review host
  remained available. Initial-to-ready elapsed is 1 hour 20 minutes 51 seconds,
  not active coding time. Physical-device/fluent-Tamil/assistive-technology,
  owner review, hosted CI, merge and deployment remain pending at this checkpoint.
- Published commit `fe47344` on `codex/shop-profile-history` and opened
  [draft PR #89](https://github.com/nishanthturnstile/aarili/pull/89) to development;
  T3 registration was confirmed immediately after creation. At observed
  2026-10-17T17:08:50.6839533+05:30, Fast verification and Dependency audit were
  running; full/pilot browser jobs were skipped under the feature-PR workflow.
  CI execution/queue durations remain pending, not inferred as coding time.

## Delivery 4: minor registration and guardian evidence (#80 / 1.1.3c)

- Start observed 2026-10-17T14:17:02.9563564+05:30. Clean checkout updated
  development to `5d00a68`, #79/PR #82 merged 08:45:15Z. Selected approved #80
  has its native blocker closed. Branch `codex/minor-guardian-registration`.
- Backend, UI and browser preparation use disjoint files in the same checkout;
  no worktree or concurrent Git mutations. Active coding/rework durations are
  unknown; verification overlaps implementation and is not additive coding time.
- Initial package builds passed after typed repository mapping correction. The
  first web typecheck found an incorrect recovery method name and an unbuilt
  i18n export; corrected, affected web types passed by 14:27+05:30.
- Review identified historical-notice withdrawal binding and UUID textual lock
  normalization. Affected fixes/checks and final evidence remain in progress.
- Hosted CI and human review/merge are pending; local checks and seeded host
  observations follow. [Evidence and A–C mapping](Minor_Guardian_Implementation_Evidence.md).
- Fast gate passed 14:30:53.3527700 to 14:32:43.7170184+05:30, including 172
  unit tests across 43 files, lint/boundaries/tokens, Knip, strict types, negative
  types, OpenAPI and all production builds.
- Focused guardian/catalog PostgreSQL selection passed 9/9 (85.37s from
  14:30:15+05:30). Test-only refinements then exercised actual two-connection
  same-key case-variant replay (1/1, 9.22s from 14:32:15) and age/grant races
  (1/1, 12.58s from 14:32:50). The full PostgreSQL run started
  14:32:48.2038834+05:30; the last test-only strengthening has its own fresh result.
- Six-run guardian browser matrix started 14:32:48.2312869+05:30. Both phone
  scenarios passed; remaining results are pending.
- Seeded synthetic review host started 14:33:35.2843681+05:30 and was observed
  ready 14:33:54.2817602+05:30 at
  http://127.0.0.1:50872/customers/01a1491a-5411-74cb-b21b-e8df0277ffc4.
  Start to observed first usable behavior: 16m 51s elapsed, not coding time.
  Private synthetic sign-in succeeded in the dedicated review tab at 14:34+05:30;
  passwords remain outside chat/Git. Review does not require repeating setup.
- Production readiness/outage, worker shutdown and artifact scan started
  14:36:54.1804386+05:30; results pending.
- That production smoke/artifact stage passed through 14:37:10.2011932+05:30;
  29 browser artifacts were scanned. Final rebuild artifact scan passed again.
- Guardian browser matrix passed 6/6 (10.5m) through
  14:43:28.1143880+05:30. Bounded visual review inspected phone Tamil dark and
  desktop English light; actual device/language acceptance remains pending.
- Prepared review exposed a saved-draft resume URL omission; the form reopened
  without restoring its reload address. The isolated UI correction restores the
  opaque ID, with a new three-size reload regression. Adult-only purpose copy is
  now omitted on new minor profiles; any historical records remain qualified.
- Final affected lint/Knip/i18n/web types/build passed 14:43:45.0235878 to
  14:44:13.3604985+05:30. The 12-run resume + existing wearer/owner-entry matrix
  started 14:44:39.9768302+05:30; phone resume and entry passed, final result pending.
- Final host started 14:44:40.0014356+05:30 and was observed ready
  14:45:04.3689316+05:30:
  http://127.0.0.1:54687/customers/01a14924-ae95-761c-bdfa-61ba5dd2abea.
  It now uses the same existing parent identity in the saved claim draft. Private
  review sign-in and explicit resume succeeded, including the named parent and
  opaque reload address; no real data or affirmative consent was created.
- Full `pnpm test:integration` passed 110/110 across 24 files (934.42s), ending
  14:48:24.1778369+05:30. The final 474 source inputs were independently rechecked
  unchanged at 14:49:29+05:30; the initial/final snapshot delta is explicitly
  identified in the evidence packet. Remaining tablet/desktop regressions and
  publication are pending.
- Final resume + preserved wearer/onboarding matrix passed 12/12 (12.1m), ending
  14:56:59.4226085+05:30. Together with the first guardian matrix, 18 browser
  executions passed across phone/tablet/desktop. No unresolved local failure.
- Local review-ready/source confirmation observed 14:57:42.4243000+05:30:
  all 474 final hashes match; documentation-only publication metadata follows.
  Start to this point is 40m 39s elapsed, not active coding time. Required hosted
  CI, owner review/merge and human/policy acceptance remain pending.
- Draft [PR #83](https://github.com/nishanthturnstile/aarili/pull/83) published,
  observed 14:58:33.3346325+05:30, implementation `9119554` against development.
  Fast verification and Dependency audit were queued; documentation-only metadata
  follows. No #80 owner review/merge authorization is assumed.

## Delivery 3: adult wearer registration (#79 / 1.1.3b)

- Start observed 2026-10-17T13:03:13.7925010+05:30 after updating development
  to `ac98740` (customer PR #81 merged). Branch codex/adult-wearer-registration.
  All native blockers #55/#56/#78 are closed with merged prerequisites.
- Implementation, active verification and rework time overlap; active coding
  duration remains unknown. Backend and browser work use assigned disjoint
  files in the same checkout; no worktree or concurrent Git mutations.
- Early web typecheck rejected undefined partial preference defaults; normalization
  corrected it and the affected typecheck passed. Initial web production build
  passed, before a shared draft recovery correction required affected revalidation.
- Read-only review identified unknown-outcome → 429 losing the original draft
  command. The fix and two regressions passed in the 16-test recovery file
  (420ms, 13:13:41+05:30). Source/authority gaps found during review are resolved
  before final checks rather than recorded as completed acceptance.
- Hosted CI, PR/merge and human acceptance are pending; local component
  verification and final seeded host are recorded below.
- First usable synthetic review host: 13:17:54+05:30, then stopped for rebuilding.
  The ephemeral access file remained outside Git/chat. Start to this first
  usable behavior: 14m 40s elapsed; not active coding time.
- Development fast gate: 13:19:41.0076871 to 13:21:37.5407171+05:30, passed,
  including 165 unit tests across 42 files. Later source corrections require
  final affected verification.
- Browser development run: 13:17:06.0401700 to 13:19:35.8657178+05:30;
  interrupted after the first phone case found 320px/200% text overflow. Scoped
  grid minimum sizing fixed the observed defect. No claim that the matrix passed.
- Final clean/native verification began 2026-10-17T13:24:29.5837643+05:30.
  It is required because package exports changed. The 461 inputs are fingerprinted
  in [Clean_Source.sha256](adult-wearer-registration/Clean_Source.sha256).
- Final-build seeded review host observed ready at 13:26:15+05:30:
  http://127.0.0.1:62222/customers/01a148dc-5abf-7a74-9506-8da8cf125e8c.
  Final wearer browser confirmation started at 13:25:30.4168923+05:30;
  results and human acceptance remain pending.
- Wearer matrix passed 6/6, 13:25:30.4168923 to 13:36:55.4355850+05:30
  (Playwright 11.2m). The later UI-only correction has its own focused check;
  prior backend and unchanged browser-path results are retained.
- After the clean source copy, a UI-only refresh guard and rejected-save feedback
  correction required focused browser regressions and fresh lint/Knip/web
  typecheck/build. Backend, database and PDF inputs did not change; their
  clean-run evidence remains applicable. Both source snapshots are retained.
- UI delta verification passed 13:37:30.2049705 to 13:37:58.4004850+05:30
  (lint/Knip/web types/build). Refresh/known-rejection browser regression passed
  3/3, 13:38:06.2078166 to 13:39:28.1438372+05:30 (1.2m). The preserved customer
  and onboarding matrix started 13:39:38.7056877+05:30.
- The clean run ended 13:48:16.8820621+05:30, exit 1. Frozen install, fast stages,
  166 unit tests and Linux PDF goldens passed; PostgreSQL was 104/105 (1128.99s).
  Existing E8 incorrectly assumed audit wall-clock sorting guarantees save then
  promote order. A test-only correction requires exactly one of each event while
  preserving exact audit binding, counts, replay and rollback checks. Its full
  five-test draft file passed 33.18s from 13:49:53+05:30. Unchanged passing stages
  are reused and missing build/smoke/artifact stages run separately; the original
  clean command remains a recorded failure, not relabelled as passing.
- Preserved customer/onboarding browser matrix passed 12/12 (6.8m), ending
  13:46:37.0871415+05:30. An actual corrupted Tamil synthetic name in two test
  literals was corrected; the affected three-size registration matrix started
  13:46:40.6210523+05:30. Strict UTF-8 review found no other corruption in the
  19 new wearer-related files. No runtime source change from this correction.
- Corrected Tamil registration matrix passed 3/3 (4.2m), ending
  13:50:57.6977368+05:30. Final production build/smoke/artifact stages started
  13:51:06.5448923+05:30 after stopping the review host for rebuilding.
- Production build (all 12 tasks), real PostgreSQL readiness/outage and worker
  shutdown smoke, and 29-browser-artifact scan passed through
  13:52:18.6212981+05:30. Final host after rebuilding:
  http://127.0.0.1:55706/customers/01a148f4-b4b6-7c4e-8d2b-3d5877b0a599.
  All 462 final source hashes matched after verification; only documentation
  finalization follows. Staged evidence covers all 105 distinct integration cases;
  it does not turn the original failed clean command into a passing command.
- Local review-ready evidence observed 13:53:44.0814914+05:30, 50m 30s elapsed
  from the owner-request start; this includes overlapping verification/rework,
  not active coding time. Embedded preview navigation twice timed out; the direct
  running URL and private local access file remain the review path. Actual-device,
  language, accessibility and business-policy acceptance remain pending.
- Draft [PR #82](https://github.com/nishanthturnstile/aarili/pull/82) published,
  observed 13:54:36.9762870+05:30, implementation `39be40e` against development.
  Fast verification and Dependency audit are running; no owner review or merge
  authorization exists for #79. Only documentation metadata follows this source.
- Subsequent hosted checks on documentation head `cc9f82e` passed: Fast
  verification 13:55:39 to 13:56:50+05:30 (71s), Dependency audit through
  13:55:58+05:30. Owner merged PR #82 at 14:15:15+05:30 as `5d00a68`.
  The next issue began from updated development; human/policy acceptance remains
  separate from the owner's integration decision.
- [Acceptance and manual review packet](Adult_Wearer_Implementation_Evidence.md).

## Delivery 2: customer registration (#78 / 1.1.3a)

- Branch: codex/customer-registration from 2ea55ac, onboarding PR #77's squash
  merge. Preparation/start observed 2026-10-17T11:43:48.2900105+05:30; work resumed
  on the owner's explicit #78 implementation request. Active implementation time
  is unknown; do not infer it from Git timestamps.
- Focused backend/entry verification: five unit tests passed at 12:01:12
  (577ms); comprehensive PostgreSQL test at 12:01:13 (25.64s), after the
  mixed-query regression and stronger context/invalid-body checks. Initial
  focused backend checks also passed; later changed inputs required this rerun.
- Strict typecheck, lint/boundaries/tokens, Knip and production web build passed.
  Initial lint found the new typed client absent from the explicit browser
  admission list; adding that exact client retained transitive boundary checking.
- Local delivery gates passed; hosted CI, merge and human acceptance remain
  pending. Test times overlap implementation; they are not additive coding-time
  measurements. Active implementation/rework durations remain unknown.
- Evidence/manual review: [customer registration](Customer_Registration_Implementation_Evidence.md).
- First clean-native verification started at
  2026-10-17T12:11:40.5399321+05:30. Frozen installation completed in 2m 9.7s;
  the complete repository gate follows in the temporary path containing spaces.
- Final synthetic customer review host observed ready at
  2026-10-17T12:13:57+05:30, http://127.0.0.1:63304/customers. It includes a
  ready shop and two separate shared-phone people; private sign-in stays in the
  ignored local access file. Automated setup makes customer behavior immediately
  available without repeating onboarding. This does not record human acceptance.
- First clean-native attempt: 12:11:40.5399321 → 12:15:40.0746564+05:30,
  failed before PDF verification because the helper omitted infra/pdf. Frozen
  install, lint/Knip/types/unit/negative/OpenAPI stages passed. The scoped copy-set
  correction requires a new complete attempt. No product/PDF runtime change.
- First three-size customer browser matrix: 12:11:29.5293932 →
  12:17:41.6079115+05:30, three passes (Playwright 6.1m). Final confirmation
  passed all three projects (5.3m), ending 12:31:51.238606+05:30 after the
  target-size/validation-feedback correction. Preserved owner-entry
  and shell regression: 12:19:01.5970139 → 12:22:59.5863645+05:30, nine passes
  (3.8m). The shell inventory now expects Customers as its third destination.
- Final affected fast gate: 12:24:24.8789367 → 12:26:26.2988836+05:30, passed.
  A later full-integration attempt found an old exact tenant-table inventory;
  the corresponding current/legacy inventories were corrected without weakening
  catalog checks. Four focused checks passed in 46.15s. Full clean gate restarted
  12:28:42.1570394+05:30; earlier known-failing attempts were interrupted.
- Updated final review host ready by 12:28:59+05:30 at
  http://127.0.0.1:55074/customers; the previous host was stopped for rebuilding.
- Complete final `pnpm verify:clean`: 12:28:42.1570394 to
  12:49:36.3681302+05:30, exit 0 (20m 54.21s). All 159 unit tests and 100
  PostgreSQL integration tests passed (integration stage 997.04s), with frozen
  installation, lint/Knip/types/negative/OpenAPI, PDF golden checks, production
  builds, smoke, private-artifact scan, lockfile equality and cleanup.
- Tested source identity: 446 inputs in
  [Tested_Source.sha256](customer-registration/Tested_Source.sha256), independently
  rechecked unchanged at 12:48:50+05:30. Documentation-only finalization followed.
- Review-ready local evidence completed after the full gate at 12:49:36+05:30;
  owner-request start to this point was 65m 48s elapsed, including overlapping
  verification and rework. First usable synthetic host was available after
  30m 9s elapsed. Neither span measures active coding time.
- Candidate improvement: review all exact tenant-table inventory fixtures when
  introducing a tenant table, and include required runtime inputs in clean-copy
  reviews. Preserve full verification and owner acceptance requirements.
- [Draft PR #81](https://github.com/nishanthturnstile/aarili/pull/81) opened
  2026-10-17T07:22:03Z (12:52:03+05:30), targeting development. Tested
  implementation commit: `c73555a3dd4a21fd460bb799145fee6e07dc7e17`.
  Fast verification and Dependency audit were queued at 07:22:06Z in
  [initial CI run](https://github.com/nishanthturnstile/aarili/actions/runs/39013368434).
  Final hosted results on `e62804e`: Fast verification and Dependency audit
  passed in [run 39013390645](https://github.com/nishanthturnstile/aarili/actions/runs/39013390645).
  Fast execution: 07:23:16 to 07:24:48Z (92s); audit: 07:23:16 to 07:23:34Z
  (18s). Queue duration is unknown. PR #81 merged at 2026-10-17T07:32:07Z
  as `ac98740`; PR-open to merge elapsed was 10m 4s. Physical-device, fluent
  Tamil and final policy acceptance remain pending.

Owner-approved process improvement, 16 October 2026. Follow the
[development workflow](Development_Workflow.md). Record the next five
implementation PRs opened after the workflow improvement merges, one entry per
PR. An implementation entry follows below. This log does not change release scope
or acceptance gates.

Use ISO 8601 timestamps with an explicit offset (for example, `+05:30`) or UTC.
Record observed spans as work happens. Use `unknown` for missing measurements
and `pending` for unfinished phases; never substitute zero. Add links to existing
issue/PR evidence rather than duplicating command logs. Exclude secrets, customer
data and private URLs.

Copy this template for each delivery:

~~~markdown
## Delivery <1–5>: <issue/slice and short outcome>

- Issue / PR / tested revision: <links and SHA; identify dirty verification>
- Implementation started: <timestamp>
- Review ready: <timestamp; implementation and required evidence prepared>
- Merged: <timestamp or pending>
- First usable behavior available for owner review: <timestamp and route/scenario,
  or pending; identify an isolated test host where used>

| Activity | Observed span(s) and elapsed minutes | Evidence / overlap / limitation |
| --- | --- | --- |
| Implementation | <start/end spans and minutes, or unknown> | <exclude verification and rework; record pauses> |
| Local verification | <start/end spans and minutes, or unknown> | <commands/results; required supplementary checks and reasons> |
| CI queue and execution | <queue and execution minutes separately, or unknown> | <run URLs, attempts, failures; overlapping jobs use workflow wall time> |
| Review waiting | <ready/request to feedback/authorization spans, or pending> | <separate overnight pauses and agent response time where observed> |
| Rework | <start/end spans and minutes, or none/unknown> | <cause: defect, flaky infrastructure, integration or changed requirement> |

- Implementation start → review-ready elapsed: <minutes or pending>
- PR opened → merged elapsed: <minutes or pending; not implementation time>
- Implementation start → first usable behavior elapsed: <minutes or pending>
- Human acceptance: <acceptance IDs, reported results and pending observations>
- Largest delay and candidate improvement: <observation, not an assumed cause>
~~~

After five completed deliveries, record the median elapsed measures and observed
activity durations (with known sample counts), the largest waits and repeated
failure causes. Overlapping activity durations are not additive. Recommend any
further process change separately; retain the required verification and review.

## Delivery 1: owner access and shop onboarding (ACCESS-01–12)

- Issue / PR / tested revision: no issue or PR requested; codex/owner-access-onboarding
  from 7096a8c, implementation working tree. Existing AGENTS.md edit excluded.
- Implementation started: exact initial timestamp unknown; first recorded observation
  2026-10-16T23:05:35+05:30, after branch creation and initial inspection.
- Review ready: 2026-10-17T00:45:37+05:30. Merged: pending owner review/authorization.
- First usable owner review: 2026-10-16T23:57:16+05:30, synthetic
  http://127.0.0.1:58941/setup; private access file supplied locally.
- Final-build preview offered 2026-10-17T00:38:41+05:30 at
  http://127.0.0.1:50615/setup. The first disposable host was stopped and cleaned up.
- Active implementation/rework durations: unknown; do not infer active time from
  Git timestamps. Local verification observations are recorded below; CI is not
  applicable and human review waiting remains pending. Spans overlap.
- Rework: empty-JSON compatibility, feedback/dialog selectors, Tamil progress,
  completion focus, and scoped audit/key/expiry fixture assertions. One media
  assertion now identifies immutable intents by ID rather than timestamp order.
- Human acceptance: pending; no CI/publication/merge/deployment performed.

- Final repository verification: pnpm verify exit 0, observed complete at
  2026-10-17T00:37:07+05:30 (152 unit/property, 98 integration, Linux Tamil PDF
  goldens, build, production smoke and 29 artifact scans). Final integration
  duration: 404.19 seconds. Earlier attempts and reruns remain documented.
- Broad browser sweep: 96 passed / 6 failed in 32.2 minutes. Five failures used
  old shell/PWA selectors; the remaining draft pagination case observed a database
  clock regression. Its unchanged diagnosed rerun passed in 1.4 minutes. Final
  owner/shell/PWA browser checks passed: 27 tests in 7.1 minutes, observed complete
  2026-10-17T00:44:58+05:30. The original full command remains recorded as failed;
  unaffected successful cases were reused under the staged verification workflow.
- Supplemental shop review: 40 English/Tamil and light/dark width states and
  eight axe scans passed. First observation to first usable preview: 51 minutes
  41 seconds, including implementation, verification and rework; active time and
  actual initial implementation start remain unknown.
- Largest measured window: the 32.2-minute broad browser sweep. Candidate
  improvement: run one shell/PWA representative early when access/navigation
  changes, retaining the required security, migration and final matrix coverage.
- CI queue/execution: not applicable (no publication). Review waiting and merge
  remain pending. First observation to review-ready: 100 minutes 2 seconds,
  including implementation, verification and rework; this is not active coding
  time or the unknown actual implementation-start interval.

### Owner-requested entry-flow revision, 17 October 2026

- The owner rejected the first presentation and requested authentication,
  dedicated onboarding and dashboard as distinct surfaces. This is rework of
  Delivery 1, not an additional published delivery. No issue/PR was created.
- Invite-only registration was explicitly retained. The owner approved the
  clickable revised visual direction with “Keep this direction”; finished-product
  review remains separate. Exact reply timestamp and active rework duration are
  unknown.
- Observed verification at 2026-10-17T07:54:24+05:30: 20 focused entry-policy,
  query-invalidation and boundary tests passed in 0.958 seconds. Production build
  included the new routes and Node Proxy. Focused browser work initially exposed
  a relative-URL test-helper assumption; this was corrected without changing the
  authorization policy. Fresh final gates and review-ready timestamp are pending.
- Revision scope, compatibility, acceptance matrix and human review instructions:
  [Owner Entry Onboarding Evidence](Owner_Entry_Onboarding_Evidence.md).
- Revision repository gate observed complete at 2026-10-17T08:21:22+05:30:
  `pnpm verify` exit 0; 156 unit and 99 integration tests, Linux PDF goldens,
  production build/smoke and 29 artifact scans. Integration duration reported
  by Vitest: 861.33 seconds. The first full attempt stopped on an old translation
  expectation; the corrected full rerun passed. Browser timing/result and
  finished-product review-ready time remain pending.
- Fresh synthetic production review host observed ready at
  2026-10-17T08:22:17+05:30, `http://127.0.0.1:52202/sign-in`; this is the revised
  implemented flow, separate from the approved clickable prototype. Full browser
  verification started immediately after the repository gate; its timing is
  retained in `.scratch/owner-entry-preview/ui-final-timing.json` on completion.
- First revision full browser run: 2026-10-17T08:21:22.9605792+05:30 →
  2026-10-17T08:43:17.9457160+05:30; 21 minutes 55 seconds including command
  startup/build. Playwright reported 21.6 minutes, 99 passes and six Tamil
  enlarged-text/spacing failures. All owner entry journeys passed, but the full
  command failed. Preserve that result rather than treating completed case
  numbers as passes.
- Rework: password-control wrapping and bounded narrow-screen nested gutters
  resolve the measured 325px document at a 320px viewport. Exact active rework
  span is unknown. Final focused checks: 15 passes in 48.2 seconds; five fresh
  normal/enlarged captures received a scoped visual ship verdict. Both full gates
  are rerunning after the final CSS correction; final timing/result remains pending.

- Final corrected-source repository gate: 2026-10-17T08:45:48.1291301+05:30 →
  2026-10-17T08:59:11.5727551+05:30 (13 minutes 23 seconds), exit 0. All 156 unit
  and 99 integration tests passed; integration reported 669.82 seconds and
  production build 17.605 seconds. Both earlier runs remain recorded above.
- Refreshed synthetic production host observed ready at
  2026-10-17T09:00:08+05:30, http://127.0.0.1:49774/sign-in. The previous host was
  stopped before rebuilding and its disposable data removed. Final browser gate
  follows the repository pass; final result/review-ready timestamp remain pending.

- Final browser gate: 2026-10-17T08:59:11.6257288+05:30 →
  2026-10-17T09:21:30.2538896+05:30, exit 0; 105 passed, zero failures, retries
  disabled. Command wall time 22 minutes 19 seconds; Playwright reported 22.0
  minutes. Source fingerprint remained unchanged after both final gates.
- Revision review packet ready: 2026-10-17T09:21:59.948323+05:30. Owner finished-flow/visual,
  actual Android, fluent Tamil, assistive-technology and shop-lighting observations
  remain pending. No CI, publication, merge or deployment was performed. Initial
  active revision implementation duration and initial-to-ready elapsed are unknown.
  Largest measured final gate: browser command (22 minutes 19 seconds). The early
  enlarged-text failure suggests running the representative Tamil zoom check before
  the full matrix while retaining the required final gates.

- Owner authorized check-in and publication on 17 October. Existing source
  committed as `78127b6`; [draft PR #77](https://github.com/nishanthturnstile/aarili/pull/77)
  targets development. Fresh `pnpm verify:fast` passed; manifest comparison proved
  all 476 source files unchanged from the recorded full PostgreSQL/browser gates,
  so those expensive unchanged-input checks were reused. Check-in preparation
  active duration is unknown. Review host HTTP 200 was rechecked at
  `http://127.0.0.1:49774/sign-in`. Hosted CI, owner review/merge and finished-product
  human observations remain pending. No customer implementation timer is started
  for publication of its research/ticket packet.
