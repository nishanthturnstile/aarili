# Phase 0.3 closeout acceptance

Evidence date: 15 October 2026. The six approved Phase 0.3 implementations
merged through PRs #38–#43 and are present in integrated main `935b8b9`.
Issues #32–#37 are closed. All three required checks passed on each merged PR
and on the [latest integrated-main workflow](https://github.com/nishanthturnstile/aarili/actions/runs/38605187032).

Fresh local review found a calendar-dependent scheduler test and an unapplied
retained local database upgrade. The database preparation is complete. The
test repair and this closeout use `codex/phase-0.3-closeout`. On 15 October,
the owner authorized publication and squash merge once all checks are green.
The closeout PR records its final hosted checks and merge; integrated-main
verification follows that merge in the same checkout. Phase 0.4 implementation
has not begun.

## Requirements and implementation coverage

Sources: product FIN-05/12/13/14/21, TRU-01/06/10/12, USE-08, DAY-06 and
AC-17–20/23/38/49/55/56/58 foundations; architecture §§6, 8.1–8.5, 10.2,
12.4–12.5, 13.2 and 15; roadmap 0.3.1/0.3.2. The review checked all 44 ticket
acceptance criteria against the implementation, named tests and operational
interfaces. Full financial, material, messaging and recovery workflows retain
their later slices.

| Slice and criteria | Verified foundation | Detailed criterion mapping |
| --- | --- | --- |
| 0.3.1a, #32, A1–A6 | Exact paise/mm arithmetic; safe wire/int8 conversion; unknown versus zero; precision/range rejection; stated-basis material costs; disposable round trip and import boundaries | [Exact values](Issue_32_Exact_Value_Evidence.md) |
| 0.3.1b, #33, B1–B6 | Whole-rupee FIN-05 floors; largest-charge/earliest remainder including paise; AC-17/49; zero-charge credit; deterministic conservation and shared primitive reuse | [Allocation](Issue_33_FIN05_Allocation_Evidence.md) |
| 0.3.1c, #34, C1–C7 | Commit-time balanced journal; derived positions; pending/confirmed separation; immutable linked reversals, credits, liabilities and settlements; atomic replay, isolation and executable review | [Journal](Issue_34_Balanced_Journal_Evidence.md) |
| 0.3.2a, #35, D1–D8 | Pinned migration-only queue setup; exact same-transaction enqueue; minimal locators; current authority/state; durable deduplication; rollback/retry; catalog and disposable inspection | [Transactional jobs](Issue_35_Transactional_Jobs_Evidence.md) |
| 0.3.2b, #36, E1–E8 | Independent fail-closed controls; durable epoch quarantine; immediate effect guards; four frozen financial mutations; transition races; narrow operator history; prospective auth suppression and fake-only positive proof | [Restore guards](Issue_36_Restore_Guards_Evidence.md) |
| 0.3.2c, #37, F1–F9 | Shared runner registry; narrow scheduled authority; overlapping consumers; shop-local occurrences; bounded retries/dead letters/redrive; scrubbed operations; drain/timeout and crash recovery | [Job runtime](Issue_37_Shared_Job_Runtime_Evidence.md) |

The issue evidence files retain their historical publication-time wording.
Their draft/merge and pending-observation statements do not override the merged
PR states or the fresh observations recorded here.

## Fresh local verification

| Check | Result |
| --- | --- |
| `pnpm verify` | Exit 0: Biome/boundaries/tokens, Knip, strict types, 76 unit/property tests, negative types, OpenAPI, all 65 real PostgreSQL tests, production builds, actual Next/Hono database readiness/outage and worker shutdown smoke, 26 browser artifact scans |
| Focused scheduler regression | Failed before the repair; passed after the fixture used the latest due 06:00 date from the database clock. Exact one-effect and one-occurrence assertions remain. |
| `pnpm test:ui` | Exit 0: all 45 English/Tamil browser cases passed in 4.7 minutes at 360×800, 820×1180 and 1440×1000; setup/auth/recovery/connections, keyboard/focus/axe, composition and privacy-artifact checks |
| `pnpm audit --audit-level low` | Exit 0; no known vulnerabilities |
| `node scripts/foundation-money.mjs --demo` | Exit 0; exact values, allocation fixtures, journal sequences, failure/replay and disposable cleanup |
| `node scripts/foundation-jobs.mjs --demo` | Exit 0; atomic jobs, restore guards, shared modes/schedules, both crash barriers, timeout/restart and disposable cleanup |
| `pnpm infra:check` after local preparation | Exit 0; PostgreSQL/extensions/runtime restrictions and authenticated S3 put/read/delete with anonymous access denied |
| Retained local catalog and worker | Actual `app_user` isolation/catalog checks passed; outbound disabled and money frozen; standalone worker ready and IPC shutdown exit 0; queue row count unchanged |
| Documentation | All 28 local references in this record and the roadmap resolve; diff whitespace checks pass. Fresh phone/tablet Tamil setup, phone English owner and desktop Tamil dark-dialog captures were visually inspected. Incidental regenerated captures are preserved in ignored review storage; tracked originals are retained. |

The initial aggregate run failed because Docker Desktop was unavailable. Its
startup reported an inaccessible secrets-engine socket. A stop/start recovered
Docker; no factory reset, socket rename, volume deletion or credential rotation
was performed. A subsequent run exposed the scheduler fixture's fixed
14 October date. That run was stopped after the reproduced failure; it is not
passing evidence. The settled repaired source passed the full aggregate above.

Only the scheduler test changes executable source: its one-occurrence fixture
previously allowed the actual scheduler to catch up additional days after
14 October. It now derives the latest due shop-local occurrence from PostgreSQL.
The separate fixed-date delayed-run and UTC-boundary cases remain. No runtime
code, retry policy, timeout, dependency or business policy changed.

Fresh native checks apply to the repaired branch before publication. The prior
hosted Linux results apply to merged implementations; final hosted results for
this repair are recorded on its closeout PR after publication. A separate
clean-install or local Linux-image run was not repeated for this
test/documentation-only repair. The PR's required Linux checks are a merge gate.

## Agent-operated acceptance

The owner explicitly delegated the pending terminal exercises to the agent on
15 October. Both interactive interfaces were operated, in addition to the
asserted demonstrations and automated suites. These are agent observations,
not a new human owner or accountant attestation.

Money observations: blank remains unknown, zero persists, 0.01 INR round-trips
as one paise and 2.2 m as 2,200 mm; AC-17 gives 400/600 INR, AC-49 gives
334/333/333 INR, and the paise example gives 334.01/333/333 INR. Zero charges
retain all credit. Duplicate IDs reject and a valid retry succeeds. Lost-response
confirmation leaves 800 INR due; repeated confirmation is unchanged. Linked
reversal leaves 1,300 INR due and repeats once. Failed refund retains its
1,000 INR liability; repeated settlement leaves all five accounts at zero.
Unbalanced direct writes fail at commit; original-posting mutation is denied.

Jobs observations: uncommitted enqueue is invisible; commit exposes one job;
replay preserves counts; changed binding is 422; duplicate delivery has one
effect; rollback preserves committed counts. Old-epoch work stays quarantined
after restart/redrive; release is denied. All four frozen financial mutations
deny. Fake outbound and prospective auth suppress independently; an admitted
new fake effect executes once. Paused financial/effect transactions serialize
with freeze/restore transitions. Retry exhaustion reaches count 2 and a dead
letter with zero effects; guarded redrive applies once. In-process and standalone
registries match, overlapping delivery deduplicates, daily/nightly dates repeat
without another occurrence, and revoked schedule authority suppresses the fake
digest. Normal exit cleans each disposable database.

## Retained local preparation

Read-only inspection found migrations only through `0004_command_history.sql`
and no `app_restore_operator` role. PostgreSQL/S3 were started using the existing
credentials and retained volumes. Before schema work, a custom-format database
archive was saved under ignored `infra/.local/backups` with an owner-only Windows
ACL. `pg_restore --list` verified its archive catalog. This is not a restore drill.

The existing reviewed maintenance-role command provisioned the NOLOGIN operator
role. The existing `app_owner` migrator applied additive migrations 0005–0008
with advisory locking and checksums. Existing identity/shop/membership/audit/key
row counts were preserved. The retained database now has journal, queue,
restore-control and schedule infrastructure. Ordinary runtime remains
`app_user`; no operator login, schedule grant or provider was activated.

The retained web environment has synthetic auth enabled, Google disabled and
no setup token, migration URL or restore-operator URL. Outbound configuration
is absent and fails closed; in-process consumption is absent and leaves the
web enqueue-only. No private environment value was printed or changed.

## Remaining actions and later gates

1. Closeout gate: publish the verification repair/closeout, pass all hosted
   checks under the owner's 15 October conditional merge authorization, then
   update this checkout's main and verify integrated build/smoke. The closeout
   PR and final chat result record completion of those steps. Passing historical
   CI on 14 October does not certify the new fixture repair.
2. Phase 0.4 still needs its concrete ticket breakdown reviewed and approved
   before issue publication or implementation. No Phase 0.4 tickets were created.

There is no money, billing or jobs screen in Phase 0.3. Existing UI regression
coverage is setup/verification, sign-in, owner access, recovery/reset, recent
authentication, connections, sign-out and design-system controls in Tamil and
English. The [14 October human screen-reader, IME and responsive observations](Phase_0_Closeout_Acceptance.md#owner-reported-manual-acceptance)
remain historical evidence. Fresh automation cannot attest physical-device or
screen-reader use. No additional human terminal replay is needed to fill an
untested Phase 0.3 case after the delegated exercises above.

The following remain explicit later activation gates, not missing Phase 0.3
implementation: accountant posting mappings and product §32.2 business policies;
real payment/UTR/source locks (1.4.2), document numbering (1.4.4), real financial
corrections/refund authority (1.4.5); provider/domain/DNS setup and real Google or
email delivery; media/PDF workflows and Tamil goldens (0.4.3/0.4.4); actual
backup/PITR restore, privacy reapplication and measured RPO/RTO (0.5.1/0.5.2);
physical Android/camera/share/PWA, search recall, manual baseline and pilot
readiness (1.10.4 and product §§32–33). Live customer data remains prohibited.
