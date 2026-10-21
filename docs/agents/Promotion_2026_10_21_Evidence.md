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
