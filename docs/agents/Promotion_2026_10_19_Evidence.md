# Services and templates promotion, 19 October 2026

The owner validated #100 and authorized publication, passing checks and merge
to main. Deployment, live migrations, production business inputs and live-data
activation remain separate gates.

## Published feature and initial promotion

[PR #107](https://github.com/nishanthturnstile/aarili/pull/107) passed Fast
verification and Dependency audit on `916d29f` and squash-merged to development
at **2026-10-19T07:50:31Z**, producing `125b173`; issue #100 closed.
The existing checkout was fast-forwarded to that integrated development.
PR #108 then proposed development → main with the five configuration slices
#97–#101 and their source/evidence records.

## Retained failure and narrow correction

[Run 39218672677](https://github.com/nishanthturnstile/aarili/actions/runs/39218672677)
on `125b173`: Scaffold verification failed its real-PostgreSQL stage. Unit tests
passed **227/227**. PostgreSQL completed **144 passing / 5 failing** across
35 files; the five failures are not counted as a pass. Raw completed-job output
is retained locally at `.scratch/promotion-108-scaffold-job.log`.

All five failures come from two explicit integration-test inventories:

- The draft fixture's exact production registry assertion omitted
  `shop.presentation`. That assertion throws inside the test owner adapter,
  producing 503 instead of the expected 200 in four synthetic draft/API cases.
- The bootstrap isolation test's exact tenant-table list omitted measurement
  forms, operating templates, commitment bindings and presentation tables added
  by the configuration slices. Actual PostgreSQL tables therefore exceeded the
  expected list.

Correction branch `codex/promotion-108-integration-inventories` starts at latest
development `125b173` in the existing checkout. It adds the missing workflow and
all 17 missing table identities to those exact inventories. No assertion is
removed or weakened: every listed tenant table still undergoes ENABLE/FORCE
RLS checks, and the draft registry remains an exact match. No application,
schema, dependency, compiler or runtime behaviour changes.

Unrelated roadmap edits and the untracked order-intake research document in the
checkout are preserved and excluded from this correction's commit/PR.

Fresh correction verification:

- `pnpm exec vitest run --config vitest.integration.config.ts tests/drafts.integration.test.mjs tests/owner-bootstrap.integration.test.mjs`:
  exit 0, **18/18** across both affected files, **174.98s**, starting 13:35:56
  IST. All five previously failing cases now pass. Log:
  `.scratch/promotion-108-inventories-postgres.log`.
- `pnpm lint`: exit 0, 512 files, architecture boundaries and token/PWA checks.
  Log `.scratch/promotion-108-inventories-lint.log`.
- Focused diff check passes. Only two test inventories and this promotion
  evidence enter the commit. Runtime build/unit/browser evidence is reused only
  for unchanged inputs; hosted feature CI and the final promotion still run
  their required complete gates. No dependency, packaging or portability input
  changed, so no clean-install extension is triggered locally.

## Main ancestry and final release gates

Main `13ae373` contains the prior promotion's main-only merge ancestry and
isolated browser-matrix correction. Strict protection reports direct #108 as
behind main. Follow the documented prior promotion approach: after the narrow
correction merges into development, prepare a promotion branch containing both
current main and integrated development, preserve the reviewed main workflow,
and target main with a merge commit. No direct protected-branch push, history
rewrite, protection change or skipped-check exemption is authorized or needed.

The final exact candidate must pass Scaffold verification, Dependency audit and
the required Browser smoke and accessibility aggregate, with all three device
jobs succeeding. No passing result on the earlier failed head proves the final
candidate. Owner review/merge authorization is already supplied; release CI,
merge, local main/development synchronization and integrated-main confirmation
remain pending until observed.

## Corrected candidate preparation

Correction PR #109 passed Fast verification and Dependency audit on `4d1232a`
and squash-merged at **2026-10-19T08:13:20Z**, producing development `9759cbe`.
Before that merge, #108 was closed as superseded so it would not launch another
duplicate full run. Its already-failed run was cancelled while the three browser
jobs were still running; those incomplete device results are not passes.

The same checkout was fast-forwarded, then promotion branch
`codex/promote-services-main-20261019` was created from `9759cbe`. Merging main
`13ae373` is conflict-free and brings only the existing reviewed browser-matrix
workflow, its workflow documentation and the earlier promotion evidence.
The workflow remains byte-equivalent to current main. Application/package/test
files remain identical to corrected development. The two unrelated research
edits stay unstaged and are excluded from the merge commit.

The replacement promotion will run all required full checks against this
main-inclusive candidate. No protection, timeout, assertion or retry policy is
changed by this synchronization. Final promotion merge and integrated-main
verification remain pending.
