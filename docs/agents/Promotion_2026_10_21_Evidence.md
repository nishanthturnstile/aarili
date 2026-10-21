# Order intake promotion, 21 October 2026

The owner authorized promotion to main, fixes for failed checks and merge after
all required checks pass. Deployment, production migrations, live data and pilot
activation remain separate gates.

Development `9646e01` contains merged Quick Order, grouped-booking and small-service
slices, including closed #124–#126 through #127–#129. All three service feature
PRs passed Fast verification and Dependency audit with no review threads. The
final #129 source tree equals integrated development. The only open issue at
promotion preparation was the unrelated Dependency Dashboard #28.

Promotion [#130](https://github.com/nishanthturnstile/aarili/pull/130) starts from
development and merges current main ancestry. Candidate `8070349` retains main's
approved isolated browser matrix and earlier promotion evidence; its application,
package, script, test and lockfile contents equal development.

## Retained failure and correction

[Run 39534636928](https://github.com/nishanthturnstile/aarili/actions/runs/39534636928)
failed Scaffold verification: PostgreSQL completed **215 passing / 1 failing**
across 38 files. The bootstrap exact tenant-table inventory omitted
`service_line_current`, `service_line_evidence` and `service_line_transition`.
The separate tenant-isolation inventory already included all three. Raw job
output is retained locally in `.scratch/promotion130-scaffold.log`.

The correction adds only those three identities to the bootstrap inventory.
Its exact-match assertion and per-table ENABLE/FORCE RLS checks remain intact.
No runtime, migration, permission, dependency or CI policy changes are made.

The first native focused verification could not create any PostgreSQL fixture:
Docker Desktop's Linux engine was stopped after the environment restart. All
12 setup failures are infrastructure failures, not passing evidence. Docker was
started before retrying the affected RLS case.

Fresh native `pnpm verify:fast` passed (exit 0, **149.278s**, **260/260** unit
tests), including lint, Knip, strict types, negative types, OpenAPI and production
build. The formerly failing bootstrap A5 case passed against real PostgreSQL
(**1 passed / 11 filtered**, **13.06s**). The complete bootstrap file then passed
**12/12**, **128.61s**. Biome on the changed test and `git diff --check` also
passed. Final exact-candidate hosted results remain required.

Native Tamil, physical-device and assistive-technology acceptance,
policy/restore/live-data gates and full AC-50 remain outside this promotion's
automated intake/completion claims.

## Browser cancellation and conflict recovery

Correction #131 passed Fast verification and Dependency audit in
[run 39536628550](https://github.com/nishanthturnstile/aarili/actions/runs/39536628550)
on `bf806b4`, then squash-merged to development as `11e7930` at
**2026-10-21T03:07:59Z**. Promotion `9caf9eb` merges that development revision.
Its [run 39536912521](https://github.com/nishanthturnstile/aarili/actions/runs/39536912521)
passed full Scaffold verification and Dependency audit. All three browser jobs
reached the **40-minute** job limit before finishing **70 tests per device**;
the required aggregate correctly failed. These cancelled results are not passes.
Raw logs are retained locally as `.scratch/promotion130-{phone,tablet,desktop}.log`.

Before cancellation, each device reported a presentation-preview failure and two
owner-shell failures. Native desktop reproduction confirmed the shell's exact
navigation count expected four destinations although Orders adds the fifth.
The corrected assertion checks all five exact destinations and Orders visibility.

The presentation test timed out waiting for Compare after a stale preference
promotion. Shared draft recovery's service-addition stale-target behavior applied
to every workflow, leaving preference status Saved and hiding Compare. An
explicit `editableTargetConflict` option now defaults off; only service additions,
which have their own target reload/review flow, opt in. Settings retain locked
comparison. Competing draft revisions stay locked even with the option enabled.
No automatic merge, force write, API, schema, permission or capacity change occurs.

The new ST-06/AC-55 unit regression failed before the correction (Saved instead
of Conflict). Updated recovery tests cover default locked comparison, the
service-addition editable target and competing-draft locking. An initial test
assumed the controller prevents local edits while in Conflict; the existing UI
owns that disabled-field behavior, so the test now checks preserved rejected
values, blocked repeat promotion and explicit reload. No runtime behavior was
changed to satisfy that mistaken test assumption.

Each device now uses three file-level shards in isolated jobs, retaining the
40-minute budget, one worker, zero retries and existing individual timeouts.
Fail-fast remains false; the required aggregate demands all nine jobs succeed.
Installed Playwright enumeration verified **70 tests per device**, distributed
**25/23/22**, with no omissions or duplicates. Enumeration proves coverage
selection, not execution. No fixture, assertion, rate-limit or acceptance gate
is skipped to fit CI.

Current documentation was resolved/fetched through Context7 for
[Playwright file-level sharding](https://playwright.dev/docs/test-sharding) and
[GitHub matrix failure behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations).
Final exact-promotion hosted results remain required.

Fresh correction verification on the native Windows checkout:

- `pnpm verify:fast`: **exit 0, 81.552s**, **262 unit passes**, actual lint,
  Knip, strict types, negative types, OpenAPI and production build.
- `vitest run tests/draft-recovery.test.ts`: **23 passed, 1.10s**.
- `node scripts/test-ui.mjs owner-shell.spec.mjs shop-presentation.spec.mjs`:
  **exit 0, 12 passed, 5.9m**, all three device classes, English/Tamil,
  navigation, keyboard/focus, axe, theme/reflow, lost-response replay, saved
  preference recovery and stale comparison.
- `git diff --check`: passed. No database, dependency, packaging or toolchain
  input changed; the final hosted promotion retains full PostgreSQL/PDF/smoke
  and canary verification rather than repeating unchanged database checks locally.
- `node scripts/test-ui.mjs service-additions.spec.mjs --project desktop`:
  **exit 0, 1 passed, 5.0m** (workflow **4.8m**), including bilingual accessible
  recovery, stale targets, competing drafts, exact retries, conversion and history.

| Correction acceptance | Evidence |
| --- | --- |
| ST-06/AC-55 stale settings keep explicit comparison and preserve rejected values | Red/green recovery unit plus presentation browser workflow on all devices |
| SS-B/AC-55 service targets retain explicit re-review without merging competing drafts | Opt-in and competing-draft units; supplemental browser regression |
| USE-01/02/09 owner navigation includes Orders and retains accessibility/logout clearing | Exact five-destination assertion; six bilingual device browser cases |
| Complete release browser coverage remains mandatory | Installed-runner enumeration: 210 total; nine shards; unchanged success-only aggregate; final hosted execution required |
