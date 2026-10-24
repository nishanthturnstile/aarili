# Payments 1.4.2: preparation and verification status

24 October 2026. **Research/design/ticket preparation only. No payment application
implementation, migration, issue publication or full 1.4.2 completion claim.**
[Design](Payments_Design.md), [ticket packet](Payments_Ticket_Packet.md),
[REA ledger](Payments_REA_Evidence.md), [source brief](Payments_REA_Prompt.md).

## Checkout, authorization and baseline

The owner's request to push all changes authorized preserving the starting dirty
roadmap and untracked Payments_REA_Prompt. Diff/whitespace review preceded commit
`41de578` on `codex/quotation-issuance-c`; the local quotation closeout `d8c4dcd`
and that brief were pushed to the matching remote branch. No unrelated edit was
discarded, stashed or folded into implementation. The old branch remains intact.

Fetched origin; switched the clean existing checkout to development; fast-forward
pulled `f062de2` → **94d6dfa**; created `codex/payments-preparation` and cherry-picked
only the payment brief as `39d18b8`. No worktree or direct protected-branch push.
The current runtime source is exactly integrated development; subsequent edits
are payment planning/evidence and roadmap/delivery documentation only.

Fresh GitHub reads confirmed quotation PRs #177/#178/#179/#180 MERGED. PR #180
merged 24 October at **16:21:19 UTC**; its merge commit is `94d6dfa`. Required Fast verification and
Dependency audit passed in [run 40108148608](https://github.com/nishanthturnstile/aarili/actions/runs/40108148608).
Full scaffold/browser jobs were skipped by the approved development workflow,
not passed. Open issue inventory returned only #28 Dependency Dashboard. The
broader payment search found prerequisite closed issues, not a payment ticket.
Native blockers of #176 returned closed #175/#59/#60/#169/#84/#34. The new A–C
blockers are proposed in the packet; publication-time ancestry/comments/CI checks
remain required before any issue starts.

No selected approved payment issue exists. The [brief](Payments_REA_Prompt.md)
requires **“Present the complete packet before publishing unapproved issues;
implement only a selected approved ticket after blockers merge.”** The repository
workflow likewise retains concrete later-phase drafting/review/publication gates.
The complete packet is prepared for that review; implementation awaits approval
and selection, not a speculative code branch or an invented agreed-charge flag.

## Fresh local verification

Environment: native Windows/PowerShell, Node **24.20.0**, pnpm **12.15.0**, existing
pinned dependencies, Docker Desktop Linux PostgreSQL fixtures. Node is older than
package.json's **24.22.1** pin; no runtime or baseline correction was adopted.
Successful commands here do not certify exact pinned-Node portability.

| Command / input | Result and limit |
| --- | --- |
| `git diff --check` on starting roadmap; reviewed prompt | Passed before preserving initial docs; final planning whitespace checked again after edits. |
| `pnpm verify:fast` at `39d18b8`, unchanged runtime source, draft design added during run | Exit 0: Biome/boundaries/tokens, Knip, strict types, **73 test files / 339 tests passed**, negative-type checks, OpenAPI and production build. Unit duration **56.18s**; build **39.539s**, 12 successful tasks, 11 cached. Existing task cache use is reported, not fresh recompilation of every package. |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/journal.integration.test.mjs tests/restore.integration.test.mjs` | Exit 0: **2 files / 13 tests passed, 253.60s**. Real disposable PostgreSQL tests cover existing balanced journal, source uniqueness, immutable history, app_user isolation, rollback, concurrent/retry/lost-response and restore/freeze/epoch guards. No new payment composition is proved. |
| Final `pnpm lint` | Exit 0 after all substantive planning edits; 835 files checked, 6 existing warnings/6 infos, 491 source boundary checks, 104 UI token sources and 8 PWA assets. No fixes applied. Biome does not validate Markdown prose. |

Raw local verification logs are ignored `.scratch/payments-verify-fast.log` and
`.scratch/payments-foundation-pg.log`. They are not committed evidence artifacts.
The first REA doctor command failed because PowerShell blocked npx.ps1; npx.cmd
completed selected checks. REA scenario failure and T3 snapshot failures are
preserved in the research ledger. Two source lookups used nonexistent plural
allocation paths; discovery corrected that assumption: FIN-05 is the existing
pure money function, not an existing product allocation repository to reuse.

Not run: new payment-specific tests/screens (not implemented), full `pnpm verify`,
all integration regressions, `pnpm test:ui`/axe, PDF goldens, real-device/Tamil/
screen-reader acceptance, fresh hosted CI for this documentation branch, clean
install or additional Linux image. No code/dependency/toolchain/build configuration
changed; no new financial/RLS/concurrency implementation claim needs those
additional gates at this preparation stage. They remain explicit implementation
ticket requirements. No dependency audit or successful historical check is relabelled
as fresh local payment verification.

## Requirement-by-requirement preparation disposition

| Requirement | Concrete design and ticket coverage | Current proof / outstanding work |
| --- | --- | --- |
| FIN-10 advances/instalments | PD-01/02/04, A1–A6 | Exact source/money/journal seams inspected; receipt UI/composition unimplemented. |
| FIN-10 split methods/shared booking/credit | PD-01/06/07, B and C | Component/parent invariant and ownership rules specified; batch implementation pending C. |
| FIN-11 owner cash/UPI confirmation | PD-02, A2 | Explicit wording/account version boundary defined; no screenshot confirmation. Method policies remain gated. |
| FIN-12 duplicates/retry/concurrency | PD-03/04/06, A3–A5/B3/C2 | Existing journal/restore PG tests passed; new UTR/confirmation/allocation races remain mandatory. |
| FIN-05 exact allocation | PD-05/06, B1–B4 | Pure allocateFin05 source and existing unit suite checked. Known attested additions distinguished from unagreed base/package quotations. New adapter/capacity/reallocation not implemented. |
| FIN-13 transparent derived position | PD-06/08, A5/B5/C4 | Pending/credit/remaining/proposal uncertainty specified. No fake complete total/revenue/billed receivable. New read models pending. |
| AC-17/49 | P-04, B2 | Exact 400/600 and 334/333/333 cases specified; production payment integration not claimed. |
| AC-18/61 | P-02/07, A/B | Real existing journal retry/settlement fixtures verified; future payment duplicate and pending-to-allocated fixture tests required. |
| AC-03/04/60/62 | P-12, all tickets | Non-interference specified; no custody/production/capacity/day-close completion claim. |
| Privacy/isolation/history/restore | PD-01/03/04/07, each ticket | Existing foundations inspected/tested; all new tables/paths need independent app_user/negative/race evidence. |

## Concrete review packet at preparation stage

Review [PD-01–08](Payments_Design.md) and the complete [A–C packet](Payments_Ticket_Packet.md).
No Aarili payment route or running payment implementation exists yet; no unrelated
quotation screen is represented as a payment prototype. The research ledger gives
the exact synthetic Nool actions and captures; browser is left with no open editor
or payment modal, no saved financial change and no teardown of the owner's login.

Owner review sequence:

1. Confirm the receipt state/attestation, conservative UTR rule and cash versus
   electronic posting proposal (P-01/02/03).
2. Review service-change-only agreed sources versus unagreed base/package charges,
   FIN-05 infeasible-capacity handling and post-bill boundary (P-04/05/06/07).
3. Review component atomicity, private evidence and A → B → C ordering (P-08/09).
4. Reply with `decision ID — approve/change — observation`, approve publication
   of the concrete packet and select A if desired. This is software-scope approval;
   real policy/accountant/privacy/restore/pilot approval remains separate.

Each selected implementation must supply its own running synthetic URL/startup,
three-size bilingual acceptance steps, private access/owned-host teardown and
fresh tests before human acceptance. No request to repeat automated terminal tests.

## Final planning checks

Relative-link check initially passed 28 links but the literal traceability check
flagged the shorthand `AC-17/49`; expanded it to explicit `AC-17, AC-49` in the
design matrix. This was a documentation discoverability correction, not a missing
allocation scenario. Final rerun passed **28 relative links**, all **9 required
financial/scenario ID literals**, and `git diff --check`. The inline packet
overview was previewed at 728px and 360px with no console errors; this is a
planning visualization, not an Aarili payment screen/browser acceptance test.

The authorized publication action is commit/push of the focused documentation
branch `codex/payments-preparation`; terminal push and remote-HEAD readback are
reported in the delivery response. The earlier preserved branch is also pushed.
No PR was created by this preparation request; pushing a branch does not open
hosted CI automatically. Do not infer an authorized implementation/publication
from this evidence filename.
