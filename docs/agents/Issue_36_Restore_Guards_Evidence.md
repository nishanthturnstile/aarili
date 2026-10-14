# Issue #36 — restore quarantine, suppression and money freeze

Wave 0, 0.3.2b (parent 0.3.2). Sources: product TRU-01/06/10/12, BIZ-01,
AC-56 and prospective AC-36 rehearsal; architecture §§6.5, 8.5, 10.2, 13.2,
15. These are synthetic guards, not a completed restore, live reconciliation,
provider ledger, messaging capability or pilot gate.

Read the complete approved issue, empty comment list and native blockers using
`gh`. Direct prerequisite #35 merged in PR #41 at integrated main `e6e5534`.
The existing checkout was clean; `git pull --ff-only origin main` was current.
Work uses only `codex/0.3.2b-restore-guards` in that checkout. No source conflict
or version correction was needed. Context7 resolved/fetched PostgreSQL 18
transaction locks/definer grants and Zod v4.6.5 strict optional object metadata;
the approved installed pins, including Zod 4.6.6, remain unchanged.

## Controls, authority and ordering

Additive reviewed migration `0007_restore_controls.sql` adds non-null
`shop.is_practice` and explicitly classified installation metadata tables
`system_state`/append-only `system_control_event`. These contain no customer
content. Initial state: outbound disabled, money frozen, fresh epoch.
Missing state, invalid inputs and database errors fail closed.

Runtime can read required state; it cannot write controls, read operator history,
transition safeguards or become `app_restore_operator`. That separately
provisioned NOLOGIN/non-owner/non-BYPASSRLS role has SELECT/EXECUTE only.
Private commands require a separately scoped login; runtime never receives its
credential. Transitions compare expected epoch, change controls and append
history atomically, using database-generated epoch/time and `session_user`
provenance. Reasons are the closed action vocabulary: restore, freeze,
reconcile, disable, enable. No free text/secrets enter history. `reconcile` is
an explicit operator assertion of completed reconciliation, not an exception
that allows money while frozen.

Private interface, in a terminal with separately scoped
`RESTORE_OPERATOR_DATABASE_URL` and `OUTBOUND_EFFECTS=disabled`:

```text
node scripts/restore-control.mjs --status
node scripts/restore-control.mjs --restore <expected-epoch>
node scripts/restore-control.mjs --freeze <expected-epoch>
node scripts/restore-control.mjs --reconcile <expected-epoch>
node scripts/restore-control.mjs --disable <expected-epoch>
```

Narrowly authorized `--enable <expected-epoch>` changes only the database flag;
it never overrides the environment and was exercised only in disposable
fixtures. No provider exists. Status shows the latest 100 transitions. There
is no HTTP operator route or quarantine release command. Environment custody
is outside the restored database: set the real kill switch/remove credentials
before restore. The harness's `fake-enable` changes only its private disposable
counter configuration, never `process.env.OUTBOUND_EFFECTS` or a real transport.

Protected producers, handlers and money commands acquire shared transaction
advisory lock `120036` before command/entity locks. Operator transitions acquire
the exclusive form and no tenant/entity locks. Locks last through commit.
Acquisition/read use separate statements with existing READ COMMITTED
transactions: waiters see completed transitions. An active transaction commits
before a transition finishes, or waits and denies under the new state.
Identity/membership/practice row locks also serialize revocation/practice
changes. The context-bound practice lock function preserves SELECT-only shop
grants and forced RLS. Later compositions must preserve this ordering.

Producer binds authoritative epoch in the immutable shop-scoped job request.
Attributable old/missing-epoch jobs get an append-only quarantine row with
original/observed epoch, timestamp and reason. Queue failure output is
`RESTORE_QUARANTINED`, never success. Restart/retry cannot relabel/release it.
If tenant membership is removed, the handler cannot manufacture context to write
a tenant row: original request/queue locator and epoch remain durable, and the
queue retains an explicit failed/retry quarantine reason. An authorized later
attempt can record the tenant quarantine, but cannot execute or relabel the old
request. Revoked verification with a remaining own membership can immediately
record quarantine as a denial; it never admits an effect. Other denied jobs use
`SYNTHETIC_JOB_DENIED` failure state instead of silently completing successfully.
`guard-status` shows both tenant quarantine and denied/quarantined queue state.
Cross-shop references, altered locators and unauthorized deletion fail. The
fixture effect trigger also checks epoch/quarantine to reject direct bypass.
Requests/effects/quarantine remain synthetic-only, absent from product migrations;
shared queue lifecycle remains #37.

The framework-free effect boundary rechecks control state, operator state,
current authority/entity and practice immediately before invoking the adapter.
Positive adapters exist only in disposable test-support and increment counters;
no provider package/credential is loaded. Confirmation/allocation/reversal/refund
rehearsals use the same authoritative freeze policy and existing synthetic
command actor/action/hash binding, replay, audit and rollback. They add no
business money table or financial screen. Ordinary reads remain possible.

Prospective auth delivery guards the reserved bootstrap identity before
membership and the installed owner's verified-user resets. After a shop exists,
it uses `withShop`, current locked membership/identity and the shop's practice
flag. The bootstrap snapshot is checked again under lock; a transition between
installation and shop context cannot inherit a bypass. Unapproved identities
and revoked membership deny delivery. No real auth provider adapter exists.
Existing verification/reset capture remains private local I/O, neither outbound
delivery nor queued work. Queue payloads contain no raw verification code,
reset token or email content. Existing auth browser/integration gates continue.

Environment/lock changes cannot recall an already-invoked provider request.
A future external invocation followed by database failure can leave an ambiguous
outcome; provider reconciliation/effect ledger remains Phase 2. No exactly-once
provider claim is made.

## Acceptance and fresh evidence

| Criterion | Automated evidence and limit |
| --- | --- |
| E1 | `restore.test.ts` strict missing/invalid environment/control inputs and seeded combined matrix; real PostgreSQL independently disabled operator, disabled/missing DB, practice, denied producer with missing controls; old enabled DB cannot override operator. |
| E2 | Producer epoch, atomic restore, durable old/missing quarantine, queue retry reason, client restart, original/altered redrive and denied release in `restore.integration.test.mjs`. Existing jobs exact payload expectation includes epoch. |
| E3 | Real current-version/identity/membership revocation, practice row, immediate operator recheck and backend termination between checks; zero calls on denial. One positive fake call has durable synthetic handler provenance, repeated delivery suppressed. |
| E4 | All four mutation kinds denied frozen; reads, action-bound replay/conflict, thawed synthetic mutations, rollback, independently denied practice money. No real financial workflow certified. |
| E5 | Explicit blocking-PID barriers prove active financial/effect commit before freeze/epoch completion and operator-first shared-lock waiter denial under newly committed freeze. Interactive pause/resume uses the same transactions. |
| E6 | Scoped non-owner operator login, audited transitions, stale epoch rejection, runtime SQL/SET ROLE/private-command denial, nonexistent HTTP route, history/quarantine edit denial; catalog checks control ACLs/role and forced tenant policies. |
| E7 | Installation verification before membership, reset authority/suppression via counters, real prospective boundary suppressed; queue/history have no auth content. Existing capture flows covered by auth regressions. |
| E8 | Disposable positive/negative proofs, harness rejects retained targets/production/provider credentials; real process environment unchanged. Demo and operational command/pause-resume regression; human observations pending. |

Baseline main: `pnpm verify` passed (70 unit tests, 53 real PostgreSQL tests,
lint/Knip/types/negative/OpenAPI/build/smoke/artifact checks); audit found no
known vulnerabilities. Initial browser run passed 44/45 with a desktop English
Google status-focus failure while overlapping the verification build in `.next`.
Final build/browser checks run sequentially. Generated baseline capture changes
were restored; the checkout was initially clean. Final results follow after
verification.

Final native evidence, 14 October 2026:

| Command | Fresh result |
| --- | --- |
| `pnpm verify` | Exit 0 at 21:25 IST after the combined-revocation fix: Biome/boundaries/tokens, Knip, strict types, 73 unit/property tests, compiled negative types, OpenAPI, 60 real PostgreSQL tests, all production builds, Next/Hono readiness/outage, worker shutdown, 26 browser artifact scans. |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/jobs.integration.test.mjs tests/restore.integration.test.mjs` | Exit 0: 16 tests, including seven E1–E8 restore scenarios, real queue state, deterministic barriers, operational interface and combined epoch/authority denial. |
| `pnpm test:ui` | Exit 0: all 45 English/Tamil phone/tablet/desktop Playwright/axe cases; the original desktop English Google case passed. This sequential browser run covers unchanged existing auth/UI flows; the subsequent final edit affected only synthetic job denial/queue handling. No assertion or timeout was weakened. |
| `pnpm audit --audit-level low` | Exit 0: no known vulnerabilities. No dependency/lockfile was changed by this issue. |
| `pnpm foundation:jobs --demo` and native interactive exercise | Demo exit 0; agent-operated observations recorded below. Final operational-interface regression verifies the final handler/queue behavior. |
| `git diff --check` | No whitespace errors; generated historical browser captures excluded. |

Intermediate failures were corrected: SELECT FOR SHARE on SELECT-only shop
required the scoped lock function; the bootstrap fixture needed the existing
shop/completion constraint respected; the cross-shop negative test now checks
the actual 42501 provenance denial. Final self-review removed operator-credential
forwarding from Turborepo and covered revoked-authority old jobs with explicit
failure/quarantine instead of successful completion. The final gate rerun passed.
Hosted Linux checks will run on the draft's exact commit; their result is reported
with the PR, separately from these native results. Human review remains pending.

Initial targeted checks: three unit/property tests and five real PostgreSQL
scenarios passed before adding the operational-interface regression and the
final auth-context hardening.
`pnpm foundation:jobs --demo` exercised ordered synthetic recovery and one
allowed fake counter call. This is automated evidence, not owner validation.

The agent also operated `pnpm foundation:jobs --interactive` in a native
terminal on 14 October 2026, 20:41–20:43 IST. Observed zero calls while disabled,
durable A/B quarantine after restart/redrive, unauthorized release denial,
all four frozen money denials, suppressed prospective auth, one positive new
fake send with its duplicate suppressed, financial pause/freeze/resume ordering,
and effect pause/restore/resume followed by old-epoch quarantine. The final
race raised the counter to two because it deliberately admitted a second new
effect before the transition completed. `quit` exited 0 and cleaned its own
container. This was agent-operated validation, not human owner acceptance;
the later auth-context change is covered by the final automated rerun.

## Exact owner acceptance steps — human review pending

Use a private terminal without database targets, production mode or provider
credentials, with Docker Desktop running. Only the harness's disposable
PostgreSQL is created/cleaned; retained volumes are untouched.

```powershell
$env:OUTBOUND_EFFECTS = 'disabled'
pnpm foundation:jobs --interactive
```

Enter one command per prompt:

1. `guard-status`: outbound false, frozen true, operator disabled, zero fake
   calls, fresh epoch A. `guard-queue`, `database-enable`, `fake-send`:
   DB enabled but `operator_disabled`, zero calls.
2. `operator-disable`, `restore`, `restart`, `quarantine`, `guard-status`:
   epoch B, DB outbound false, frozen true, durable quarantine A/B/`old_epoch`.
   `redrive` stays quarantined. `attempt-release` reports denied runtime
   unfreeze and operator quarantine deletion.
3. `finance-confirmation`, `finance-allocation`, `finance-reversal`,
   `finance-refund`: each `FINANCIAL_MUTATION_FROZEN`. `auth-probe`: prospective
   real/fake auth suppressed; zero calls.
4. Assert synthetic reconciliation complete, then `reconcile`,
   `database-enable`, `guard-queue`, `fake-enable`, `fake-send`: new epoch-B
   work gets one fake call. Repeat `fake-send`: `obsolete_state`, same counter.
   Quarantine remains. `operator-disable`, `auth-probe`: suppressed again.
5. `pause-finance`, `freeze-queued`, `guard-status`, `resume`: financial commit
   precedes completed freeze. `finance-refund` denies. Resume within ten minutes.
6. `reconcile`, `database-enable`, `guard-queue`, `fake-enable`, `pause-effect`,
   `restore-queued`, `guard-status`, `resume`: active effect commits before
   restore transition. `redrive` then quarantines the old request.
   `operator-disable`, `quit` cleans the container.

Manually recheck existing synthetic English/Tamil setup/verification, sign-in,
recovery/reset, owner/connections, sign-out and design-system flows at
phone/tablet/desktop sizes, including keyboard/focus. Record actual human
observations separately. Automated Playwright/axe is not physical-device or
screen-reader approval. No money/jobs screen is added.

## Installation, rollback and later recovery gates

No retained database migration or role change was applied here. Before an
authorized retained-volume upgrade, take/verify the required private backup,
explicitly run `pnpm infra:roles` for the NOLOGIN role, then reviewed
`pnpm db:migrate` with migration authority/advisory locking. Runtime credentials
must never perform those steps. Provision a separate scoped/time-limited operator
login only when needed. `infra:check` verifies three maintenance roles and
explains a missing role upgrade.

Retain additive schema/history/ACL protections through compatible rollback.
Old producers omit epoch and cannot resume effects; no destructive down
migration or automatic release exists. Real recovery order: kill switch/remove
credentials/stop worker → verified restore → DB disabled/new epoch/freeze →
integrity checks → privacy tombstones/revocations → audited lost-window
reconciliation → unfreeze → effect reconciliation → DB flag → operator switch
last. Actual backup/PITR, bank/UPI reconciliation, privacy reapplication and
measured RPO/RTO remain 0.5.1/0.5.2 and live readiness gates. Physical-device
review, Tamil PDF goldens, search recall and full pilot readiness are not run.

Deliver a separate draft PR for owner review. Do not merge, deploy, activate
providers or begin #37 without its required separate authorization.
