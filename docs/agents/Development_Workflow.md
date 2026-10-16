# Aarili development workflow

Owner decision, updated 16 October 2026: use one local Aarili checkout and the
long-lived `development` branch as the only base for new implementation
branches. Feature PRs target `development`; one promotion PR carries its tested
state to `main`. Create, restore or use Git worktrees only with explicit owner
approval for the specific scenario. Approval does not carry over to later
scenarios. Existing branches and remote PRs preserve work when switching tasks.

The owner approved worktrees for the independent Phase 0.4 issues #53, #54 and
#55 on 16 October 2026. Those branches predate this base-branch policy; all new
branches start from `development`. Implementation starts only when requested,
with direct blockers merged. Later tickets require their own applicable
worktree approval. Merge and deployment remain separately controlled.

## Local workspace and branches

- The development checkout is the owner's existing native Windows Aarili
  workspace. PowerShell, Node and pnpm run there; Docker Desktop supplies Linux
  infrastructure and verification containers.
- Fetch `origin`, update local `development` from `origin/development`, then
  create a focused `codex/<slice-or-topic>` branch from `development` for each
  implementation. Push it and open its PR against `development`. Never start
  new implementation branches from `main`. Keep work in its assigned checkout
  throughout review.
- Standard start commands are `git fetch origin`, `git switch development`,
  `git pull --ff-only origin development`, then
  `git switch -c codex/<slice-or-topic>`.
- Inspect status before switching branches. Preserve unrelated edits; never
  reset, discard or automatically commit them to make a switch succeed.
  Finish or deliberately preserve pending changes before switching.
- Do not run concurrent mutations of the same checkout. Without explicit owner
  approval, no agent or automation may create another worktree as a workaround.
- For approved parallel worktrees, assign one issue and branch per worktree from
  verified integrated development. Coordinate shared contracts, migration filenames and
  lockfile changes before editing; isolate test databases, ports and build outputs.
  Run focused checks during development and schedule heavy final suites to avoid
  resource contention. Each PR needs its own acceptance evidence and owner review.
  Integrate PRs sequentially, reconcile overlaps and verify affected checks against
  updated development before merge. Preserve work and obtain approval before cleanup that
  would discard changes. Worktrees do not bypass dependency or activation gates.
- Official scaffold generators may run in disposable temporary directories
  for output review; clean-install tests may use disposable install directories.
  These are scoped verification steps, not feature workspaces or Git worktrees.
- Creating a PR does not complete its issue. The topic branch remains available
  for fixes, even when the owner switches the checkout to another branch.

## Implement an issue

1. Read the complete issue, comments and native blocking relationships,
   AGENTS.md, tracker rules, and the relevant product/architecture/roadmap
   sections. The product governs behaviour; the architecture governs technology.
2. Confirm the issue is approved, requested and unblocked, with every direct
   prerequisite merged. Do not start from an unmerged prerequisite PR merely
   because its local checks passed.
3. Inspect the checkout and establish baseline evidence using the verification
   stages below. Start the focused branch from the latest `origin/development`
   in the existing checkout or an explicitly approved worktree, preserving
   unrelated changes and existing branches.
4. Implement only the selected outcome. Fetch current Context7 documentation
   when required, verify supported exact versions and review official generator
   output before copying intended files. Honour native Windows/Linux boundaries,
   shared contracts/tokens and synthetic-only data.
5. Verify normal and relevant failure paths using actual lint, Knip, typechecks,
   tests and production builds. Map every acceptance criterion to evidence and
   identify checks not run. Database claims require real PostgreSQL evidence.
6. Self-review scope, security, isolation, immutable history, recovery and
   portability. Update documentation and traceability when needed.
7. When the implementation request authorises publication, commit and push only
   the focused change and open a draft PR linking `Closes #<issue>`. Report its
   evidence and remaining risks. Do not merge or deploy.

## Review, merge and the next issue

Review the actual PR diff, issue acceptance coverage, checks and failure paths.
Feature PRs target `development` and require `Scaffold verification` and
`Dependency audit`; the full browser suite is not a gate on these PRs. Run
focused browser validation during UI development when the changed behavior needs
it. The PR that promotes `development` to `main` runs all three checks,
including `Browser smoke and accessibility`, against the release candidate.

The owner explicitly authorises merge after review. Feature PRs to `development`
use squash merge. Promotion PRs from `development` to `main` use a merge commit
so the long-lived development history remains an ancestor of main; do not squash
the promotion. Never push directly to either protected branch or deploy
automatically. After a feature merge, update `development` in this same checkout
before starting the next issue. After promotion, update `main` and `development`
and inspect the passing promotion CI; do not rerun the full local suite unless
the integrated tree differs or a check failed. Confirm the issue closed and its
dependants are unblocked before creating the next topic branch.

Keep later-phase drafting, review and publication separate: propose a concrete
breakdown for approval before publishing new tickets. Honour existing approval
for already-published tickets. Phase completion is verified against integrated
main; it does not permit live data before the product's pilot/recovery gates.

## Verification stages and evidence reuse

Owner-approved workflow improvement, 16 October 2026. Preserve the existing
implementation sequence, acceptance criteria, required CI checks and owner merge
review. Reduce repetition around those gates rather than removing coverage.

| Stage | Required evidence | Avoidable repetition |
| --- | --- | --- |
| Baseline | Inspect status and the latest `development` CI result; retain successful promotion CI for `main`. Investigate relevant failures or local drift. | Do not run the entire suite again solely to start a branch from the same verified `development`. Historical baseline evidence never proves the new change. |
| Development | Run focused checks for the affected behavior and meaningful failure paths while iterating. | Do not run full verification after each small edit. |
| Final local verification | Run actual lint, Knip, strict types, relevant tests and production build. Implementation tickets requiring `pnpm verify`, `pnpm test:ui`, audit or other commands retain those requirements. | A successful `pnpm verify` already covers its component commands; do not immediately repeat lint, Knip, types, tests or build separately without a reason. |
| Hosted feature PR verification | `Scaffold verification` and `Dependency audit` must pass on PRs to `development`. Draft PRs run these checks too. | The full browser suite waits for the promotion PR. Feature pushes do not trigger duplicate push runs. |
| Hosted promotion verification | All three checks, including browser smoke/accessibility, must pass on the `development` → `main` PR revision. | Do not dispatch another full run when the promotion PR already has current passing results. |
| Integrated main | After an authorized promotion, update the checkout and inspect the successful promotion checks. | Main pushes do not repeat the full suite; investigate tree differences or failures rather than rerunning without cause. |

Clean-install/native-portability and additional Linux checks run when the ticket
explicitly requires them, or when dependencies, lockfiles, package exports,
toolchains, install/build scripts, runtime packaging or platform-sensitive paths
change. Feature PRs use the required fast hosted Linux checks; the full browser
suite runs at promotion. An additional local Linux verification image is not an
automatic extra gate.
Record why supplementary checks were required or not applicable. Do not broaden
this rule into an exemption from an issue's explicit verification requirements.

Evidence records name the command, result, tested revision (and any dirty files),
environment and CI run URL where applicable. Reuse a result only while its inputs
remain unchanged; edits, dependency/base changes, failures or uncovered acceptance
criteria require affected checks to run again. Repeated failures need diagnosis,
not reruns until green; retain the original failure and explain any retry.
Keep real PostgreSQL isolation/transaction tests, financial concurrency/retry
tests, security checks, PDF goldens and physical-device acceptance where required.
Never describe unrun checks or earlier evidence as fresh verification.

CI triggers are PRs targeting `development` or `main`, manual dispatch and the
daily dependency audit. PRs to `development` run scaffold verification and the
dependency audit; the browser job is skipped. PRs from `development` to `main`
run all three checks. Main and development pushes do not start duplicate runs.
A feature branch without a PR has no automatic hosted run: open a draft PR once
publication is authorized and hosted feedback is needed. Manual dispatch runs
all checks. Existing cancellation of superseded runs remains in place.

## Manual review packet

Before requesting human acceptance, prepare a running review surface and the
synthetic records needed for it. Use the existing approved local/test-host path;
do not add a production demo, hosted tunnel or external activation for review.
Provide one concise packet in the implementation evidence/PR:

1. **Open and prepare:** exact URL/route, startup command if needed, synthetic
   scenario and required device/browser/language. Keep credentials outside Git
   and chat; point to the established private access method.
2. **Try and observe:** a short numbered sequence with expected visible results,
   each linked to its acceptance ID. Include material failure/recovery behavior
   when human judgment is needed. Group related observations into one session.
3. **Report:** a copyable `acceptance ID — pass/fail — observation` response;
   request device/RAM/browser or fluent Tamil observations only where required.
4. **Evidence and cleanup:** link automated results, state exactly which human
   findings remain pending, and provide teardown steps for temporary access.

The agent runs automatable setup, checks and diagnostics. Do not ask the owner
to replay terminal tests already evidenced. Human review focuses on business
policy, usability, language, assistive technology and actual-device behavior.
Screenshots/emulation cannot replace required physical Android, Tamil or
screen-reader observations. Record human reports separately from automation;
pending acceptance remains pending. Owner merge authorization stays separate.

## Measure the next five implementation deliveries

Use [Delivery_Measurements.md](Delivery_Measurements.md) for the next five
implementation PRs opened after this workflow change merges. Record timestamps
as work happens; do not reconstruct active time from commit or PR timestamps.
Keep measurement lightweight and use the implementation evidence/CI links
already collected. No telemetry service, scheduler or tracking dependency is
required.

Record implementation start, review-ready time, merge time and the first time
the owner could try the new behavior. Measure implementation, local verification,
CI queue/execution, review waiting and rework separately. Mark unavailable values
unknown and unfinished phases pending. Timers can overlap: do not add CI elapsed
time to active implementation time to claim total delivery time. PR-to-merge
time is elapsed review/integration time, not coding time.

After five completed entries, compare medians, repeated failures and the largest
waits, including time until usable behavior. Propose the next improvement from
that evidence; do not promise a speedup before measurement. This is a manual
delivery record, not a scheduled follow-up or permission to change scope/gates.

## Reusable implementation prompt

~~~text
Implement Aarili GitHub issue <ISSUE URL>.

Read its full body/comments/blockers, AGENTS.md, docs/agents/issue-tracker.md,
docs/agents/Development_Workflow.md and the relevant product, architecture and
roadmap sections. Verify direct blockers are merged and preserve unrelated edits.

Default to the existing local Aarili checkout and sequential implementation.
Use worktrees only when the owner explicitly approved this scenario; record the
scope and follow the worktree coordination rules. Start one focused `codex/`
topic branch per issue from the latest `origin/development`, push it and open a
PR to `development`. Only the reviewed promotion PR targets `main`.

Implement the complete scoped outcome with required failure handling and
integrity controls. Use current Context7 docs, exact supported pins and reviewed
official CLI output. Keep native Windows/Linux conventions, shared contracts
and canonical visual tokens; do not add future-only dependencies.

Run applicable checks and map acceptance criteria to fresh evidence. Self-review
and update documentation. Follow the verification stages, prepare the concise
manual-review packet, and record delivery timings where applicable. Avoid
repeating successful checks without changed inputs or another stated reason.
Commit and push the focused change, then open a draft
PR linked to the issue. Report checks, limitations and genuine blockers.
Do not merge, deploy, touch live data, spend money or perform destructive resets.
~~~
