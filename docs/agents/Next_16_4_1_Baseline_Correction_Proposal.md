# Proposed baseline correction: Next.js 16.4.1

23 October 2026 IST. **Proposed, not adopted.** No dependency or lockfile change.
Discovered during [measurement A / PR #156](https://github.com/nishanthturnstile/aarili/pull/156).

## Concrete trigger and evidence

[Dependency audit, run 39844058655](https://github.com/nishanthturnstile/aarili/actions/runs/39844058655/job/120052513819)
failed on pinned `next@16.4.0`: two critical and one high advisory, each reporting
`>=16.4.1` as patched. The paths include web → Next, next-intl → Next and
Better Auth → Next; the feature did not change dependencies or the lockfile.
Fast verification on `369419a46bfcd0240f57a74f0763042e133b6756` passed.

The [official 16.4.1 release](https://github.com/vercel/next.js/releases/tag/v16.4.1)
lists fixes for these three advisories:

- [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw): image optimization/SVG, critical.
- [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr): cache functions/typed arrays, critical.
- [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r): App Router server actions, high.

These are dependency advisory findings, not a claim that Aarili's individual
runtime paths have been exploitability-tested. The CLI's development/build
reminder can terminate a server after readiness; disposable component hosts use
fresh directories, so their one-use retry receipt cannot survive a new fixture.
No reminder suppression or package patch is proposed as the solution.

## Proposed approved work

Publish/select a separate baseline-correction issue and focused PR to development,
using the existing checkout and a `codex/next-16.4.1-security` branch from updated
development. Retain the committed measurement branch. No worktree or merge is
authorised by this proposal.

1. Pin direct `next` to **16.4.1**, resolve its required transitive graph with the
   pinned pnpm, review the lockfile/peer changes and update the exact technology
   baseline references. Add no unrelated upgrades or runtime feature changes.
2. Run dependency audit, actual fast verification/production build and affected
   startup/component-host checks. Complete the broad browser validation against
   the corrected baseline; preserve previous failures and interrupted attempts.
3. Open a separate draft PR with immutable-history/isolation impact stated as
   unchanged, no database migration, recovery as the reviewed compatible package
   graph and the prior known-vulnerable pin retained only in Git history.
4. Require successful CI and owner review/merge. After that merge, update local
   development, integrate the merged baseline into measurement A and record fresh
   evidence. B/C remain blocked and unselected. No deployment/live activation.

## Approval boundary

[AGENTS.md](../../AGENTS.md), Technology conventions, says:
“propose any new baseline correction before adoption.” It also limits work to a
selected approved issue. Approval of measurement A does not silently change the
technology baseline. The proposed scope above is ready for that separate decision;
PR #156 remains a draft and its dependency-audit merge gate remains failed.
