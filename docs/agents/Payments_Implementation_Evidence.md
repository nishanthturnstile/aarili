# Payments 1.4.2a / #181: implementation and verification

24 October 2026. Owner approved PD-01 through PD-08 and the complete A-C packet,
then selected A. [A / #181](https://github.com/nishanthturnstile/aarili/issues/181)
is implemented on `codex/payment-receipts-a`; it awaits review and merge.
[B / #182](https://github.com/nishanthturnstile/aarili/issues/182) waits for A's
merge; [C / #183](https://github.com/nishanthturnstile/aarili/issues/183) waits for B.
This is not full 1.4.2 completion. [Design](Payments_Design.md),
[approved packet](Payments_Ticket_Packet.md), [REA observations and documentation
claims](Payments_REA_Evidence.md) remain distinct authorities.

## Admission and implementation

The existing checkout was clean before switching from preserved/pushed preparation
work to updated development **94d6dfaff12537b065c3ec3b171b4402ebf154fc**. No worktree.
Preparation commits were carried as `a0ab515` and `e390460`. Fresh issue/comment,
native-blocker, merged-PR ancestry and required-CI reads admitted all nine direct
blockers: #176, #32, #33, #34, #16, #55, #56, #86 and #36. PR #180's required
checks passed in [run 40108148608](https://github.com/nishanthturnstile/aarili/actions/runs/40108148608).
Issues #181-#183 were published only after approval, with native dependencies
installed and read back. No direct development/main push, merge or deployment.

A adds a recoverable owner payment journey at `/payments`: distinct customer
credit owner/payer, exact positive paise, local payment date, optional scoped
order/booking intent, receiving revision and recipient profile snapshot. Each
record is one method/component; multiple receipts support advances/instalments.
Explicit split batches remain C. Incomplete drafts are server-side; browser state
is memory-only. Cash selection stays pending until a separate cash-received
attestation. UPI is first reported pending, then confirmed only after the owner
attests seeing it in the reviewed configured account. Bank confirmation is gated.
Screenshots are not accepted as confirmation and private uploads remain C.

Confirmed receipt postings debit cash/electronic clearing and credit the existing
deposit liability, never revenue. Pending/failed records have no journal posting.
Receipt/source uniqueness, immutable events, UTR claims and atomic result mappings
share the owner's `withShop` transaction with audit and both idempotency results.
The deterministic inner journal key has its own namespace; sorted prelocking and
the shared restore lock precede draft/identity/directory/receipt/subject locks.
Same-key replay checks current access; different-key repeat confirmation resolves
the original event. Conflicting references return 409, and original resolution
requires the same customer and shop. Raw UTRs stay private; only surrounding ASCII
whitespace is trimmed for claims, with case/interior characters preserved. Claims
survive failed reports and corrections, rather than releasing duplicate protection.

Migration **0057_payment_receipts.sql** adds four tenant tables with composite
shop references, FORCE RLS, app_user insert/read only and immutable/deferred
provenance guards; extends the journal's electronic asset vocabulary. No mutable
balance, legacy advance backfill or destructive down migration. Existing journal
corrections remain usable for their original sources; new payment reversals are
explicitly denied pending governed adjustment/refund workflows. Pending corrections
and failure require reasons, append history and retain source ownership. Contact
merge with payment associations is blocked rather than silently transferring money.

## Acceptance coverage

| Criterion | Implemented evidence |
| --- | --- |
| A1 / FIN-10 | Strict separate schemas, safe paise, exact identities/date/config snapshots, durable draft recovery, typed API/client, 428/412/409/422 semantics. Unit/property + real PostgreSQL payment tests. |
| A2 / FIN-11 | Pending/default cash, explicit cash attestation, account-bound UPI attestation, no bank policy inference, inactive-revision denial. PostgreSQL and bilingual browser journeys. |
| A3 / FIN-12 / AC-61 | Unique per-shop UTR claims across accounts/customers, failed-history retention, absent-reference legitimate repeats, same-customer original resolution, merge guard. Real PostgreSQL races and isolation negatives. |
| A4 / FIN-12 | One transaction for audit/source/journal/events/results/keys, original-key recovery and repeat-confirmation resolution. Write-boundary fault matrix, actor/action/payload binding and lost-response browser test. |
| A5 / FIN-13 / limited AC-18 | Explicit pending versus confirmed/unallocated credit, allocated zero, agreed charges unknown, unavailable financial corrections. Restore freeze/epoch/practice guards, immutable history, populated predecessor upgrade. |
| A6 | English/Tamil phone/tablet/desktop, keyboard, axe, retained input, original-key recovery and no business browser persistence. Automated review is not physical-device or owner acceptance. |

B retains exact FIN-05 against authoritative attested charge sources, locked source
availability/target capacity and reasoned immutable reallocation. Quotations alone
and initial/package reference amounts are not accepted agreements. A shows all
confirmed funds as unallocated credit; it does not fabricate remaining amounts.
Receipt PDFs, governed agreement changes and full refunds retain later slices.

## Fresh verification

Final environment uses the already-installed **Node 24.22.1**, pnpm **12.15.0**,
native Windows/PowerShell and disposable PostgreSQL **18.6** Docker fixtures.
PATH was scoped per command; no toolchain installation or baseline change.
Earlier development runs used 24.20.0 and are not pin-conformance evidence.
Fresh verification applies to the implementation working tree based on `e390460`;
no dependency or lockfile changed. Final verification exited 0 at review-ready observation **18:24:41 UTC**.
Final PR head and hosted checks follow separately.

| Command | Result |
| --- | --- |
| Package build at exact Node | 10/10 successful, no cached tasks, 31.9s. |
| Payment and payment-transactions PG tests | 2 files / 5 tests passed, 120.29s: confirmation/UTR concurrency, rollback at every journal/payment/audit/key boundary, restore ordering. |
| Payment populated 0056 upgrade | 1 test passed, 22.25s; preserved old journal, zero inferred receipts, governed payment reversal guard. |
| `node scripts/test-ui.mjs tests/ui/payments.spec.mjs` | 3/3 passed, 2.7m: phone 34.0s, tablet 31.0s, desktop 30.7s; English/Tamil axe, keyboard, pending/cash/UPI, lost committed response, no overflow/private browser persistence. |
| `pnpm exec node scripts/verify-payment-exports.mjs` | Frozen clean install, 10 package builds and all new exports imported; lockfile unchanged, path with spaces, 46.965s build. Exact temporary directory safely removed. |
| Impeccable mechanical detector | Empty findings array on payment screen/canonical CSS. One spacing fix batch used existing control/page tokens; desktop English and phone Tamil inspected after the change. No new visual system. |
| `pnpm verify:fast` before the final recipient-profile UI edge | Passed: lint/boundaries/tokens (6 existing warnings/6 infos), Knip, 23 strict-type tasks, 342 tests / 74 files (30.96s), negative types, OpenAPI and production build 39.899s (12 tasks, 10 cached). |
| Post-visual-fix `pnpm lint` and `pnpm build` | Passed; 500 boundary sources / 106 UI token sources, 12 build tasks (11 cached), 21.665s. |
| Final post-fix browser confirmation | 3/3 passed, 2.2m: phone 34.9s, tablet 34.0s, desktop 35.2s, same bilingual/keyboard/axe/lost-response journey. |
| Final local fast components, current source | Last ordinary fast attempt passed lint/Knip and all 23 type tasks (43.827s), then default unit workers timed out. `pnpm exec vitest run --maxWorkers=1` passed **342/342 / 74 files, 116.38s** with unchanged tests/timeouts/isolation. Explicit `pnpm test:negative`, `pnpm openapi` (**148 paths**) and `pnpm build` passed; build **42.439s**, 12 tasks / 11 cached. Default parallel fast-command success is not claimed. |
| Expanded PostgreSQL regressions | 8 files / 80 tests, 2133.25s: 74 non-draft tests passed across 7 files; stale inventory caused 4 failures in the 6-test draft file (2 passed). Corrected full draft rerun: **6/6 passed, 143.56s**. Together all 80 distinct selected cases passed on their current inputs; no other regression failure. |
| Final recipient-profile browser edge | 3/3 passed, 5.4m (phone 1.7m, tablet 1.3m, desktop 1.2m); includes pending correction after recipient-profile change, exact appended version/profile and unchanged journal count. |

Development failures were diagnosed, not hidden: initial PG fixture overwrote the
foreign tenant identity with a customer result (fixed helper naming); the first
desktop assertion matched the label 'Confirmed receipts' before the status commit
(fixed exact status locator). Final verification found a missing explicit typed
browser-client allowlist entry, an unused exported fixture helper, and an unsafe
optional-selected narrowing; corrected each before rerunning the affected checks.
The expanded regression run exposed an exact workflow-inventory expectation that
omitted the new payment adapter and four existing pricing adapters; the first
narrow inventory correction was insufficient. Updating the complete explicit list
made the targeted journey pass (37.73s), then the full six-test file passed. Self-review also corrected current recipient-profile
selection for a pending correction after a profile change, while confirmations
retain the original profile; the browser journey now checks this append-only edge.
Later default-worker fast runs hit five unchanged five-second test timeouts
(command/draft/jobs/runtime-cleanup), including a run after heavy checks ended.
The documented `--maxWorkers=4` CLI reduced this to one API inventory timeout
(341/342 passed). A serial unit run was then used to separate worker scheduling
from assertion failures; no assertion, timeout, isolation or CI configuration was
relaxed. [Vitest's documented maxWorkers](https://github.com/vitest-dev/vitest/blob/main/docs/config/maxworkers.md)
was fetched through Context7 before this local verification adjustment. The final
lint/Knip/types result comes from the last ordinary fast attempt; remaining fast
components are run explicitly after the serial units. Do not describe the latest
default `pnpm verify:fast` invocation itself as passing.
The preview twice timed out on the live host with `Preview automation snapshot
timed out after 15000ms.`; agent-browser was the bounded visual fallback. The first
review harness omitted `/owner`, yielding a sign-in redirect 404; added the real
OwnerFlow entry route and restarted only that owned host.

Ignored local logs: `.scratch/payment-pg-final.log`, `payment-upgrade.log`,
`payment-browser-final.log`, `payment-clean-exports.log`, `payment-regressions.log`
and `payment-fast-final-4.log`, `payment-final-visual-lint.log`,
`payment-final-visual-build.log`, `payment-browser-confirmation.log`,
`payment-browser-profile.log`, `payment-drafts-final.log` and
`payment-fast-final-6.log`, `payment-fast-bounded.log` and
`payment-fast-serial.log`. These are supporting raw logs, not committed data.

Expanded regression command (native PowerShell, pinned Node in PATH):

```text
pnpm exec vitest run --config vitest.integration.config.ts tests/payments.integration.test.mjs tests/journal.integration.test.mjs tests/restore.integration.test.mjs tests/shop-directory.integration.test.mjs tests/drafts.integration.test.mjs tests/contact-merge.integration.test.mjs tests/quotation-issues.integration.test.mjs tests/order-acceptance.integration.test.mjs
```

Only the corrected inventory file was repeated with the same command prefix and
`tests/drafts.integration.test.mjs`; unchanged successful files were not repeated.
The two new payment-transaction tests and one populated-upgrade test are additional
to these 80 cases: **83 distinct PostgreSQL cases** covered across all scoped runs.

## Manual review and activation gates

The running synthetic review host is **http://127.0.0.1:52148/payments**.
Sign in using `.scratch/payments-review-host/private.json`; credentials are
synthetic, local-only and deliberately absent from this document. Restart with
pinned Node and `node scripts/review-payments.mjs`; its newly printed port wins.
Stop only this host with `node scripts/review-payments.mjs stop`.

1. Open Payments from the dashboard. Record a positive cash report for a synthetic
   customer, save/reopen its draft, review and record pending. Verify zero received
   credit and no confirmation inferred from method selection.
2. Open the pending receipt, choose confirmation, explicitly attest cash received,
   review and confirm. Verify immutable confirmed history and unallocated credit;
   allocations remain zero and agreed charges remain unknown.
3. Record UPI pending using the configured masked account. Reopen it, confirm only
   after the explicit 'seen in configured account' check. Reuse its UTR in another
   report and verify the conflict/original-resolution flow. Missing UTR may repeat.
4. Correct/fail an unconfirmed report with a reason; verify appended history. Repeat
   in Tamil and phone/tablet/desktop. Review focus, labels, totals and narrow layout.

Owner review, hosted required CI, full promotion scaffold/browser suites, physical
phone/screen-reader acceptance, real-device review and live activation remain
outstanding. No receipt PDF exists, so no new PDF golden claim. Existing PDF paths
are unchanged; their full checks remain promotion gates. Synthetic-only admission
remains enforced. Accountant approval of mappings, approved privacy/UTR tombstone
retention and audited erasure, receiving-account confirmation, restore drill and
pilot gates are prerequisites before live money. No claim that this synthetic
receipt slice completes privacy erasure or 1.4.2 allocation/split/refund workflows.

---

The following is the retained preparation-stage record. Its then-pending approval
and implementation wording is historical; the current status is above.

# Historical preparation checkpoint

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
