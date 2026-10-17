# Parallel Settings integration

17 October 2026. Owner authorized merging both PRs and resolving conflicts.
This record supplements the issue-local [directory evidence](Shop_Directory_Implementation_Evidence.md)
and [policy evidence](Shop_Policies_Implementation_Evidence.md); it does not
replace their retained failures or human acceptance gates.

PR #92 / issue #86 squash-merged at 16:48:36Z as
`fa744dd521a7c504e8aadc0280a916422cf5c2c1`. Both required checks passed on
`ecea8b1`. The root checkout's development branch was fast-forwarded to that
revision. The first pull command reported multiple fast-forward targets; an
explicit `git merge --ff-only origin/development` completed the update without
discarding edits or changing branch settings.

PR #91 / issue #87 integrates this development revision in its already approved
worktree. Conflicts were resolved in Settings navigation/messages, auth/API
composition, package exports, CSS, boundary allowlists, OpenAPI and draft registry
expectations. Both module implementations and migrations 0022 then 0023 remain.
The shared recent-auth publication/replay hook, exact-key recovery and owner
generation protections from #86 are preserved. No dependencies or lockfile change.

All four Settings sections use one selector, retaining public section values and
opaque draft identities: directory/policies have their explicit section; existing
calendar-only `?draft=<UUIDv7>` links continue to select the calendar. Switching
sections keeps dirty guards and removes the previous section's draft reference.
No account values or policy terms enter navigation URLs.

Policy readiness now reads receiving configuration through the same verified
owner tenant transaction. It reuses the directory's existing readiness policy:
missing enabled methods and missing active receiving accounts are distinct;
configured receiving data removes those missing reasons. Payment recording still
reports `not-yet-implemented`, and policy authority remains synthetic-only.
An unavailable optional adapter remains explicitly unresolved for isolated tests;
the production composition always supplies the integrated adapter.

## Verification

- First combined fast gate: 196 tests passed, one failed because Windows shell
  insertion damaged two new Tamil readiness messages. Direct UTF-8 patching
  corrected the text; no test/policy limit was relaxed.
- Corrected `verify:fast`: explicit exit 0, 47 files / 197 tests, lint, Knip,
  strict declarations, negative type checks, OpenAPI and production build.
- Focused PostgreSQL run passed with explicit exit 0: 14 selected cases across
  seven files in 105.31s, with 24 unrelated cases intentionally excluded. Includes
  directory/policy publication and history, live receiving readiness transitions,
  drafts, calendar/profile and tenant/owner boundary checks. Retained command:
  `.scratch/integration-postgres.log`.
- Combined navigation browser run passed three projects in 1.4 minutes:
  English/light and Tamil/dark at 360, 820 and 1440px, all four section selections,
  reload, axe and horizontal reflow. Initial test-only failures incorrectly
  assumed the memory-only locale persists across reload; reselecting the locale
  after reload corrected the assertion, without changing application behavior.
  A formatting-only failure on that test edit was also corrected. Logs remain
  in `.scratch/integration-navigation{,-final}.log`.
- All six final viewport captures were opened by the implementation session and
  independently by a fresh finish reviewer. **Disposition: ship**, scoped only
  to combined navigation: incumbent type/material/ground and shell match; wrapping
  adapts to longer Tamil labels; source preserves all destinations, selected
  state, dirty guards and opaque draft routing. No material fixes identified in
  that scope. No new detector ran; prior feature results are historical.
- Full directory and policy desktop workflows both passed on the combined build
  (two scenarios, 4.0 minutes, explicit exit 0). Covers English/Tamil, axe,
  saved-draft recovery, exact-key retry/reauthentication, conflict comparison,
  history and owner-boundary clearing. Log: `.scratch/integration-owner-workflows.log`.
- Scoped frozen clean install, fresh package builds and imports of all directory
  and policy exports passed with explicit exit 0; lockfile unchanged. Package
  builds reported 21.846s. Log: `.scratch/integration-clean-exports.log`.
- Final lint and Knip passed again after the test/helper additions, explicit exit
  0. The combined offline OpenAPI contains 44 paths, with both module assertions.
  Independent conformance is recorded in
  [integration design review](Shop_Settings_Integration_Design_Review.md).

The owner-workflow test regenerated two tracked historical desktop policy PNGs.
Those fresh regression captures were copied to ignored integration evidence and
the original feature captures restored, preserving their historical review scope.
The six new navigation captures remain the reviewed integration views; no
application source changed during artifact or documentation handling.

Combined synthetic review host observed ready at 22:35:53 IST:
http://127.0.0.1:63985/settings?section=policies. Both Settings sections are present.
Generated access remains private in this worktree's ignored
`.scratch/shop-policies-review-host/private.json`. Startup and teardown use
`node scripts/review-shop-policies.mjs` and its `stop` argument. Only synthetic
data is seeded. Hosted checks must pass on the updated PR #91 head before merge.

## Scope and recovery

No SQL migration content was edited during reconciliation. Existing append-only
history, tenant grants/RLS, reference guards, restore controls and draft retention
remain. SQL runs only in disposable test databases. Compatible rollback keeps
the additive tables; no production application, destructive cleanup or deployment
is performed. Physical Android, fluent Tamil, assistive technology, real receiving
identifiers, production policy authority and pilot activation remain open gates.
