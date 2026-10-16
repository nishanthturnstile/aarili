# Aarili issue tracker

Implementation tickets live in [nishanthturnstile/aarili GitHub Issues](https://github.com/nishanthturnstile/aarili/issues). Use the authenticated `gh` CLI with explicit `--repo nishanthturnstile/aarili`; the connected GitHub App has separate repository access and is not required for this workflow.

## Scope and approval

- Do not create implementation issues until the owner approves the roadmap and asks for the selected phase's tickets. Generate one phase at a time, beginning with Wave 0 / Phase 0.1.
- Follow the installed `to-tickets` skill: present the proposed ticket titles, complete vertical outcomes and blockers; obtain approval of that concrete breakdown before publishing. Installation and repository configuration do not approve either the roadmap or ticket publication.
- Preserve roadmap slice IDs, product requirement/AC IDs, source sections, release qualifications and activation gates. Infrastructure tickets have independently executable verification outcomes. Split a broad slice if it exceeds one fresh implementation context; retain the parent slice ID on each resulting ticket.
- Product terminology comes from product §3; technical decisions come from the single architecture document. No additional glossary or ADR tree is required.

## Labels

- `ready-for-agent`: approved implementation ticket. A ticket with open blockers must not be started.
- Reuse `bug`, `documentation` or `enhancement` when applicable. Do not invent a label per requirement or install triage solely for ticket generation.

The `ready-for-agent` label exists on GitHub. Approved Wave 0 Phase 0.1 tickets
are published as issues #2–#6. The label approves the definition; it does not
override open prerequisites or authorise implementation without a request.

## Operations

- Read/list issues using `gh issue view` / `gh issue list` with JSON output and an explicit repository.
- Write exact multiline issue/PR content to a temporary UTF-8 file and pass `--body-file`; do not interpolate content into shell commands.
- Publish approved issues in dependency order. Use GitHub native issue dependencies where available; retrieve the blocker's numeric database ID using the REST API rather than confusing it with its issue number. If native edges are unavailable, include explicit `Blocked by: #…` references. Re-read each issue and relationship after creation.
- If the source is an existing issue, make the new tickets its sub-issues when supported; otherwise include a parent link/task list. Do not modify or close the parent without authorisation.
- Do not create a parent/map issue just to group a phase unless the owner requests one. Stable slice IDs and phase references in each issue are sufficient.
- Work the frontier: only tickets whose direct blockers are merged may start. PRs link their ticket, include verification and traceability, and use focused `codex/…` branches.
- Default to one local Aarili checkout and one implementation branch at a time. Start every new issue branch from the latest `origin/development`; feature PRs target `development`. Only the promotion PR targets `main`. Worktrees require explicit owner approval for the specific scenario; preserve unrelated edits and follow the coordination and integration rules in [Development_Workflow.md](Development_Workflow.md).

**PRs as a triage request surface: no.**

## Repository safeguards

Both `development` and `main` require PRs, including administrators; force pushes and branch deletion are disabled. Feature PRs to `development` use squash merge and require `Scaffold verification` plus `Dependency audit`. The `development` → `main` promotion uses a merge commit and requires all three checks, including browser smoke/accessibility. Unresolved review conversations block merge. Zero required approving reviews accommodates the solo maintainer; the owner still reviews deliberately before merging. GitHub Actions uses read-only workflow tokens, cannot approve PRs and requires full commit SHA pins for actions.
