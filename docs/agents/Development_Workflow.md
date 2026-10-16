# Aarili development workflow

Owner decision, updated 16 October 2026: default to one local Aarili checkout
and sequential topic branches. Create, restore or use Git worktrees only with
explicit owner approval for the specific scenario. Approval does not carry over
to later scenarios. Existing branches and remote PRs preserve work when switching
tasks.

The owner approved worktrees for the independent Phase 0.4 issues #53, #54 and
#55 on 16 October 2026. This records the workspace exception; implementation
starts only when requested, with direct blockers merged. Later tickets require
their own applicable worktree approval. Merge and deployment remain separately
controlled.

## Local workspace and branches

- The development checkout is the owner's existing native Windows Aarili
  workspace. PowerShell, Node and pnpm run there; Docker Desktop supplies Linux
  infrastructure and verification containers.
- Use a focused `codex/<slice-or-topic>` branch for each implementation and
  push that branch to GitHub. Keep work in its assigned checkout throughout review.
- Inspect status before switching branches. Preserve unrelated edits; never
  reset, discard or automatically commit them to make a switch succeed.
  Finish or deliberately preserve pending changes before switching.
- Do not run concurrent mutations of the same checkout. Without explicit owner
  approval, no agent or automation may create another worktree as a workaround.
- For approved parallel worktrees, assign one issue and branch per worktree from
  verified integrated main. Coordinate shared contracts, migration filenames and
  lockfile changes before editing; isolate test databases, ports and build outputs.
  Run focused checks during development and schedule heavy final suites to avoid
  resource contention. Each PR needs its own acceptance evidence and owner review.
  Integrate PRs sequentially, reconcile overlaps and verify affected checks against
  updated main before merge. Preserve work and obtain approval before cleanup that
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
3. Inspect the checkout and run the baseline checks that exist. Start the
   focused branch from integrated main in the existing checkout or an explicitly
   approved worktree, preserving unrelated changes and existing branches.
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
Fix accepted findings in the same checkout and topic branch, then rerun affected
checks. Before CI exists, local evidence and deliberate owner review are
required; later require the actual CI checks established by the CI ticket.

The owner explicitly authorises merge after review. Main always requires a PR;
use squash merge and never push implementation directly to main or deploy
automatically. After merge, update main in this same checkout and verify the
integrated build and smoke checks. Confirm the issue closed and its dependants
are unblocked before creating the next topic branch.

Keep later-phase drafting, review and publication separate: propose a concrete
breakdown for approval before publishing new tickets. Honour existing approval
for already-published tickets. Phase completion is verified against integrated
main; it does not permit live data before the product's pilot/recovery gates.

## Reusable implementation prompt

~~~text
Implement Aarili GitHub issue <ISSUE URL>.

Read its full body/comments/blockers, AGENTS.md, docs/agents/issue-tracker.md,
docs/agents/Development_Workflow.md and the relevant product, architecture and
roadmap sections. Verify direct blockers are merged and preserve unrelated edits.

Default to the existing local Aarili checkout and sequential implementation.
Use worktrees only when the owner explicitly approved this scenario; record the
scope and follow the worktree coordination rules. Use one focused codex/ topic
branch per issue from integrated main and push that branch to GitHub.

Implement the complete scoped outcome with required failure handling and
integrity controls. Use current Context7 docs, exact supported pins and reviewed
official CLI output. Keep native Windows/Linux conventions, shared contracts
and canonical visual tokens; do not add future-only dependencies.

Run applicable checks and map acceptance criteria to fresh evidence. Self-review
and update documentation. Commit and push the focused change, then open a draft
PR linked to the issue. Report checks, limitations and genuine blockers.
Do not merge, deploy, touch live data, spend money or perform destructive resets.
~~~
