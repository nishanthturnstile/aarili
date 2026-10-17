# Delivery measurements

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
  Final hosted results and owner review/merge are pending; subsequent commits
  only record delivery metadata. CI queue/execution time is not yet known.

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
