# Aarili GitHub setup

**Configured:** 13 October 2026, after owner authorisation to configure GitHub and install to-tickets.

Repository: [nishanthturnstile/aarili](https://github.com/nishanthturnstile/aarili). GitHub CLI is authenticated as `nishanthturnstile` with administrator permission. CLI access works independently of the previously inspected GitHub App connection.

## Applied settings

| Setting | Configuration |
|---|---|
| Main branch | Pull requests required, including administrators |
| Required approving reviews | Zero: the owner is the only maintainer; deliberate owner review remains the workflow |
| Existing approvals | Dismissed when new commits change the PR |
| Review conversations | Must be resolved before merge |
| History | Linear; squash merge only, with PR title/body as the commit message |
| Force push / delete main | Disabled |
| Automatic merge | Disabled |
| Merged topic branches | Automatically deleted |
| GitHub Actions | Enabled; actions must use full commit SHAs |
| Workflow token | Read-only default; workflow cannot approve PRs |
| Issue readiness label | `ready-for-agent`, meaning approved ticket with all blockers checked before starting |
| Required CI checks | `Scaffold verification`, `Browser smoke and accessibility`, `Dependency audit`; GitHub Actions App 15368; strict/up-to-date branches (issue #6) |
| Dependency vulnerability alerts | Enabled and read back HTTP 204 (issue #6); hosted Renovate activation remains owner confirmation |

The initial setup deliberately required no nonexistent check names. Issue #6
added the verification workflow and demonstrated real failure/success on a
branch before configuring the three observed check names above. Existing
protections were preserved by REST read-back. See
[the CI gate evidence](agents/Issue_6_CI_Gates_Evidence.md) for actual runs,
snapshots and remaining hosted Renovate activation. Workflow schedules activate
after owner review/merge; this does not authorize a live release.

Settings were checked against current [GitHub branch-protection](https://docs.github.com/en/rest/branches/branch-protection) and [repository settings](https://docs.github.com/en/rest/repos/repos) documentation, retrieved through Context7. REST read-back is the evidence for their applied state.

## Installed skill and tracker

The [to-tickets skill](https://github.com/mattpocock/skills/tree/49dd158d1076134a641b33efb035946536778336/skills/engineering/to-tickets) is installed in the owner's Codex skill directory at `C:/Users/Nishanth Murugan/.codex/skills/to-tickets`. Installation used the Codex skill-installer helper and pinned upstream commit `49dd158d1076134a641b33efb035946536778336`. It includes SKILL.md and its agent metadata and will be available on the next turn. No other skill pack was installed.

Final verification also found a project copy at `.agents/skills/to-tickets` and a corresponding `skills-lock.json` entry pointing to `mattpocock/skills`. Its SKILL.md matches the installed user-level copy byte for byte and the pinned upstream source. Those project files were preserved. The precise upstream commit for the verified user-level installation is recorded here; no fabricated lock hash was inserted.

[Tracker instructions](agents/issue-tracker.md) provide the GitHub repository, ready-for-agent vocabulary, blocking-edge handling and phase-by-phase publication rules. The generic setup-matt-pocock-skills wizard was not invoked; the owner's chosen repository and existing source documents already settle its relevant choices.

## Original setup handoff (historical)

1. Owner reviews/approves the proposed root AGENTS.md and implementation roadmap.
2. Use to-tickets to draft Wave 0 / Phase 0.1: reproducible workspace/compatibility setup, then a runnable health path and CI. Narrow tickets further if needed; show blockers and acceptance checks for approval before publishing.
3. Publish only the approved phase's tickets, then implement the first unblocked ticket on a `codex/…` branch when requested.
4. After the first real CI workflow passes, add its required check names to main protection. Keep development synthetic and all live-data gates intact.

No implementation issue, commit, push, PR, workflow or application code was created by this setup. The local planning/setup documents and project skill files remain uncommitted for owner review. GitHub App installation access remains a separate optional follow-up; authenticated CLI is sufficient for the intended issue/PR workflow.
