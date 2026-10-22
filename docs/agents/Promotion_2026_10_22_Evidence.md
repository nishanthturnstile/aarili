# Repeat orders and customer history promotion, 22 October 2026

The owner authorized promotion, correction of discovered issues, merge and
synchronization of development/main. Deployment and live activation remain
separate gates. Feature PRs #139–#143 are merged into development `7776645`.

## Candidate and branch protection

[PR #144](https://github.com/nishanthturnstile/aarili/pull/144) initially
targeted development to synchronize main ancestry. Its conflict-free merge
changed no files; Fast verification and Dependency audit passed in run
`39716594919`. GitHub rejected the merge because development requires linear
history. No protection setting was changed. The PR was retargeted to main,
following the earlier promotion-branch approach; its tree exactly matches
development, with main ancestry included. Empty commit `7c0d53a` triggers the
full release gates after retargeting. Main accepts merge commits.

## Initial release failure and correction

[Run 39716863348](https://github.com/nishanthturnstile/aarili/actions/runs/39716863348)
failed Scaffold verification: 272 unit tests passed; PostgreSQL had **238
passing / 10 failing** across 43 files. The failed tablet shard 2 had **24
passing / 1 failing**; desktop shard 2 had **23 passing / 2 failing**.
Completed-job logs are retained in `.scratch/promotion-144-*-failed.log`.
The completed phone shard 2 also had **24 passing / 1 failing**, the same
guardian 422. All six other device shards and Dependency audit passed; the
browser aggregate correctly failed.

The scaffold failures expose stale exact inventories: the draft registry lacks
the two repeat workflows; tenant path/table inventories lack history, duplicate
review and contact-merge entries. The disposable legacy-piece upgrade fixture
also omits the new service-repeat selection FK when temporarily removing and
restoring structural tables. Correction keeps exact inventory assertions and
captures/restores that FK, asserting its source table is empty and its exact
definition survives. No CASCADE or production schema change is used.

The guardian browser test's age correction omits its now-required reason.
With that reason supplied, the desktop packet passes **3/3, 5.7m**, including
the unchanged recovery case (`.scratch/promotion-144-ui-debug2.log`). The
customer scenario passed in this local packet, so its hosted failure was not
deterministically reproduced. Source review found a queued zero-delay name
focus after opening correction that can steal focus from immediate reason
entry. The correction uses a layout effect on opening the mounted form,
before paint, and asserts initial name focus, subsequent reason focus and
retention before stale-save submission. This is an inferred timing diagnosis;
the final rebuilt packet and hosted release gate must validate the correction.
No schema, authorization, business command, dependency or timeout is changed.
React's current official layout-effect documentation was fetched through
Context7; the installed Next client-boundary guide was read. The Impeccable
mechanical detector reports no findings for the changed UI file.

Correction branch `codex/promotion-144-regressions` starts from latest
development in the same checkout. Unrelated roadmap edits and
`Design_Specification_REA_Prompt.md` are preserved and excluded.

Local first focused attempts could not connect to Docker after the restart;
they failed and supply no behavior evidence. Docker Desktop was started and
both focused packets restarted after `docker info` succeeded. Local final
results follow; hosted correction/release state is recorded in the PR checks.

Fresh `pnpm verify:fast` completed with **exit 0**: lint/boundaries/tokens,
Knip, strict and negative types, **272 unit tests / 62 files**, OpenAPI and
production build (web build task **21.279s**). Unit duration **20.65s**.
Log `.scratch/promotion-144-fast.log`. No dependency, lockfile, package export,
toolchain, install/build-script or runtime-packaging input changes, so a new
clean-install portability extension is not required for this correction.

Focused real PostgreSQL validation completed with **exit 0, 68/68 across four
files, 666.46s**: `drafts`, `owner-bootstrap`, `tenant-isolation` and
`order-acceptance` integration suites. All ten previously failing cases pass,
including drift rejection, forced tenant RLS and populated legacy migration
preservation. Log `.scratch/promotion-144-pg-fixed.log`.

The final rebuilt customer/guardian packet completed with **exit 0, 6/6,
10.6m**, covering both changed scenarios at phone, tablet and desktop sizes:
`node scripts/test-ui.mjs tests/ui/customers.spec.mjs tests/ui/guardians.spec.mjs --grep 'customers save/reopen|aunt, child'`.
Log `.scratch/promotion-144-ui-final.log`. This includes the customer focus and
reason assertions, stale/offline/lost-response recovery, guardian authority and
purpose history, English/Tamil, themes, axe and reflow. The earlier unchanged
guardian recovery case also passed in the desktop packet; no redundant rerun
was added to the final six-case packet.

Frozen correction patch SHA-256 is
`a7bde0a9936cf313bd62b35e02661c7631fb1b0866123edaaa32f2c5ad55947e`,
from `git diff --binary 7776645 -- apps/web/src/app/customer-screen.tsx tests`.
This excludes documentation and the owner's unrelated edits. Traceability:
TRU-01 / AC-38 tenant isolation and drift rejection; USE-03 / AC-40 / AC-55
draft recovery; GB-05/06/08 accepted-piece history and migration preservation;
CW-01/02/07/08/09/11/12/13 contact correction, guardian eligibility, bilingual
accessibility and recovery. Architecture §§6–8 and 15 retain their boundaries,
immutable history and real-database verification requirements.

## Review and release gate

Review the exact inventories against the production registry/catalog, and the
legacy fixture's empty-table checks and FK definition restoration. For owner
review, open a synthetic customer, choose **Correct details**, move from the
initial name focus to the reason field and type immediately; focus and the
reason must remain stable. A concurrent saved correction must produce the
stale comparison while retaining the proposal. In the synthetic guardian
scenario, a reasoned age correction to unknown must retain authority history
while disabling current minor-purpose eligibility. The focused UI packet also
checks English/Tamil, themes, reflow, axe, offline and lost-response recovery.

The correction PR targets development and uses squash merge. Its integrated
revision is then merged into the promotion branch. Before merging #144 with a
merge commit, inspect its current exact head: Scaffold verification, Dependency
audit, all nine browser shards and their aggregate must succeed. Final hosted
run and merge state are authoritative in #144's checks and timeline. Update
both local long-lived branches afterward and compare their committed trees;
development's linear-history policy means its commit identity can differ from
main's promotion merge commit while content stays synchronized.
