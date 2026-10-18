# Main promotion, 18 October 2026

Owner authorized creating the main promotion, resolving conflicts and merging
after all required checks pass. This does not authorize deployment, production
migrations, real data or policy activation.

## Candidate and protected history

Development `964b863` includes merged #75–#77, #81–#83 and #89–#93. Main
`4eab791` is the previous promotion merge. Direct promotion #94 was conflict-free
but behind main under strict protection. Reverse synchronization #95 was
superseded, and #94 was closed. No protected branch was pushed directly.

[PR #96](https://github.com/nishanthturnstile/aarili/pull/96) uses the promotion
branch `codex/sync-main-ancestry-20261018`, with both main and development as
ancestors. Its original application tree exactly matched development
(`f5fc87798fd5040497fba844340f7e2bb41934e1`). The initial merge attempt into
development was rejected because development requires linear history; repository
merge commits were already enabled. No GitHub setting was changed. The PR was
retargeted to main, where merge commits preserve development ancestry without
relaxing either branch's protection. Commit `67cfae4` triggered fresh promotion CI.

## Retained CI failure and correction

[Run 39108745304](https://github.com/nishanthturnstile/aarili/actions/runs/39108745304)
on `67cfae4`: Scaffold verification and Dependency audit passed. Scaffold includes
full repository/PostgreSQL/PDF/build/smoke/artifact checks and the private
configuration canary. The serial browser job was cancelled at its 20-minute job
budget, 07:43:40–08:03:53 UTC including cleanup. It listed 150 tests and completed
39 phone cases before cancellation; no test failure was reported before that
cancellation. This is incomplete browser evidence, not a pass or a flaky-test retry.

The CI-only correction runs all three viewport projects in separate isolated
jobs, with `fail-fast: false`, one worker and zero retries unchanged. Each job
has a 40-minute execution budget; individual test timeouts, waits, assertions,
domain rate limits and fixtures are unchanged. The existing required status name
`Browser smoke and accessibility` becomes an `always()` aggregate with a `needs`
dependency and a strict success comparison. Any failed/cancelled/skipped matrix
result fails that aggregate. No `continue-on-error` or missing-device exemption.
Feature PR behavior and full promotion scaffold/audit gates remain unchanged.

Current official GitHub Actions guidance was resolved/fetched with Context7:
[matrix failure behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations)
and [dependent jobs/always](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs).

Local validation: `pnpm lint` exited 0 (Biome, boundaries and tokens). Installed
Playwright enumeration exited 0 for the whole suite and each project: 150 total,
50 phone, 50 tablet and 50 desktop, each across 25 files. Enumeration does not
prove test execution; final correctness and aggregate status require fresh hosted
promotion CI. The previous cancellation/log is retained in ignored
`.scratch/promotion96-browser-cancelled.log`. No application/dependency/lockfile
change, local full-browser rerun or production action was performed for this
workflow correction.

Required final hosted checks, merge commit, both local branch updates and
integrated-main verification remain pending. Preserve the initial failed run;
do not merge until the current revision passes all required gates.
