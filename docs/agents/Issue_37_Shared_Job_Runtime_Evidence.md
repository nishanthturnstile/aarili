# Issue #37 — shared guarded job runtime (0.3.2c)

Evidence date: 14 October 2026. Requested approved issue
[#37](https://github.com/nishanthturnstile/aarili/issues/37), with no comments
and one native blocker, #36. Its implementation merged into main in
[PR #42](https://github.com/nishanthturnstile/aarili/pull/42), commit
`230f8e69944a5f9361cdb6a43efd7e5abc6a4ae0`; `git merge-base --is-ancestor`
returned 0. `git pull --ff-only origin main` was already current. The clean
single Windows checkout was used; no worktree or other feature checkout exists.

Sources: product TRU-01/06/10, USE-08, DAY-06, AC-38/55/56 and §§27,
29.1/30.1/32/33; architecture §§6.2, 8.2/8.3/8.5, 10.2, 12.5, 13.2, 15;
roadmap 0.3.2. These are synthetic prerequisite proofs, not completion of the
full product requirements, backup restore, due-work panel or pilot gate.

## Implementation and authority

One registry in `packages/jobs/src/runtime.ts` drives explicit development
in-process consumption and the standalone worker. Next.js Node instrumentation
starts it only for `NODE_ENV=development` and `RUN_JOBS_INPROCESS=true`.
Absent/false flags leave web enqueue-only; production true/invalid flags and
outbound activation fail closed. The worker requires an app_user URL and real
provisioned queues/control state before readiness. Promise and shutdown wiring
registries survive module reload; stopping permits explicit restart.

Migration 0008 provisions `foundation.schedule` and `foundation.dead`, schedule
grants, immutable grant events/runs/effects/quarantine and narrow fixed SQL
functions. All five tenant tables have non-null shop-led keys, tenant foreign
keys, ENABLE/FORCE policies and catalog checks. Runtime cannot write grants,
grant history or runs directly, configure authority, create queues or own schema.
The completed installation owner is the only scheduled authorizer in Phase 1.
Private `app_restore_operator` configuration uses an expected grant version,
current verified owner/membership checks and an append-only operator event.

Grant discovery returns only due, explicitly enabled registered grants tied to
the completed bootstrap, never an unrestricted shop list. A strict queue
locator contains only shop/run IDs and schema version. The immutable run resolves
the authorizer, date, task, grant version and epoch. `withShop()` still checks
that user's own membership; no system/import/support membership bypass exists.
The transaction uses user identity for RLS and a separately validated fixed
system actor for its exact schedule audit. The audit includes the original
authorizer/grant version, without personal values. Ordinary user provenance is
preserved. A fabricated system actor/date/authorizer in payload is denied.

The PostgreSQL cursor is the schedule authority: 06:00 Asia/Kolkata daily and
01:00 nightly rehearsal. Claim, immutable occurrence, cursor advance and real
pg-boss enqueue commit together. One missed date per grant per polling cycle
(maximum 100 due grants per query) catches up rather than relabels yesterday's
work as today's. Delayed execution uses the run's intended business date.
Nightly effects record a rehearsal only; no retention/privacy deletion runs.
The application scheduler uses the pinned pg-boss enqueue/fetch APIs, while SQL
stores the intended occurrence; no runtime pg-boss schedule/supervision DDL or
additional scheduling library is enabled.

Lock order is restore shared lock → verified identity/membership locks where
needed → schedule advisory/row lock → effect/audit. Private grant changes share
the schedule lock; restore transitions hold the existing exclusive restore lock.
Old work gets durable tenant quarantine when membership exists. Removed
membership never fabricates tenant access: queue failure/dead-letter metadata
preserves the original locator with `RESTORE_QUARANTINED` instead.

Singleton admission keys are shop/entity/version for user work and shop/task/date
for schedules (60 seconds). Queue duplicate sends may return null inside the
admission window. Committed command replay returns the original result without
another send; a rejected enlisted send rolls the whole producer transaction
back. Permanent request/date uniqueness, locks, effect/audit constraints protect
effects after singleton expiry, retry, overlapping modes and redrive.

Schedule retries: two retries after the first attempt, one-second base,
exponential jitter, eight-second cap, 30-second lease and `foundation.dead`.
The interactive user fixture explicitly configures one-second backoff/four-second
cap under disposable migration authority; the inherited low-level fixture keeps
zero-delay retries for its existing deterministic tests. Runtime never changes
queue configuration. Future `pdf.render` retains architecture's three-retry
requirement; no PDF/media/import/export/provider queue is installed here.
Attempt-fenced expiry/fail/complete calls prevent an old acknowledgement from
settling a successor attempt. Scoped redrive locks one dead-letter row, checks
current owner/source/grant/epoch, preserves the original locator and appends an
audit in the same transaction. Quarantine is never released or relabelled.

Status contains counts, retry/dead/quarantine state, oldest waiting age and
actionable fixed guidance. Payloads, driver errors and personal error messages
never enter logs/status/failure outputs. The digest rehearsal reaches only a
counter in test-support, using the existing immediate restore/outbound/practice
and current authority/state checks; no email/provider transport is loaded.

Shutdown stops intake/timers, drains for ten seconds, then reports `timed-out`
honestly. Before-commit cancellation vetoes a later in-process commit; pool
closure finishes when active work relinquishes its connection. A timed-out
standalone process exits 1, rolling back its connection; the active lease is
recovered by a successor. Committed work before lost acknowledgement is delivered
again and deduplicated. Only disposable children are killed in crash tests.
Windows uses IPC; Linux exercises IPC, SIGINT and SIGTERM. No retained Docker
service is stopped as a crash simulation.

## Acceptance mapping and automated evidence

Baseline main `pnpm verify` passed: lint/boundaries/tokens, Knip, strict types,
73 unit tests, negative types, OpenAPI, 60 real PostgreSQL tests, production
build/smoke and 26 artifact scans. Baseline audit found no known vulnerabilities.

| Criterion | Automated proof / implementation |
| --- | --- |
| F1 | `job-runtime.test.ts`, shared-registry integration, simultaneous in-process startup/reload, exact server instrumentation boundary test, production worker smoke, artifact scan; no duplicated core/vendor rules |
| F2 | Registered-owner grant/version denial, payload impersonation, missing/cross-shop context, forged system audit, current grant revocation, observed concurrent revocation waiter, immutable provenance and catalog checks |
| F3 | Two concurrent modes, two actual deliveries, singleton expiry and permanent one-effect/one-audit assertions; predecessor request replay/concurrency suite retained |
| F4 | Actual polling scheduler emits daily run; SQL 06:00/01:00 and midnight/UTC date checks, delayed prior-date run, repeat occurrence, enqueue-failure rollback of run/cursor, revoked nightly grant |
| F5 | Real pg-boss bounded retry/backoff/exhaustion with scrubbed error, dead-letter provenance, cross-shop denied/current-owner admitted redrive; migration-only DDL and old-epoch denied redrive |
| F6 | Aggregate status/dead/quarantine/age, private-error exclusion, fake digest operator/practice/current-grant controls; no transport/real credentials |
| F7 | Graceful idle/active drain, separate bounded timeout rollback, Windows IPC and Linux signal child proofs, timer/pool cleanup and restart |
| F8 | Disposable pre-commit/commit-before-ack force-kill barriers, actual attempt expiry and restart, exactly one committed effect/audit |
| F9 | Runtime tests/demo/operator interface plus inherited restore suite for stale state, revoked authority, epoch quarantine, money freeze and fake outbound suppression; real worker readiness replaces keepalive |

Fresh final results from this checkout:

| Check | Observed result |
| --- | --- |
| Native `pnpm verify` | Passed: lint/boundaries/tokens, Knip, strict types, 76 unit tests, negative types, OpenAPI, all 65 real PostgreSQL tests, production build, actual queue-backed worker/Next readiness and shutdown/outage smoke, 26 browser artifact scans |
| Native `pnpm test:ui` | All 45 passed (7.8 minutes): Tamil/English phone/tablet/desktop, keyboard/focus/axe, auth/recovery/connections and privacy artifacts |
| `pnpm audit --audit-level low` | Passed; no known vulnerabilities |
| `pnpm foundation:jobs --demo` | Passed: predecessor transactions/restore guards, shared modes, schedules, both crash barriers and timeout/restart; final six user effects/six handler audits, two scheduled runs, original quarantine retained |
| Focused native runtime suite | All five real PostgreSQL/pg-boss lifecycle tests passed, also included in the final 65-test native gate |
| Linux verification image build | Passed frozen installation, lint/Knip/types, 76 unit tests, negative types, production build and private-canary artifact checks |
| Linux actual runtime suite | All five tests passed (79.82 seconds); current tests/helpers mounted read-only into the scoped verification image |
| Additional Linux shutdown/reload/in-process veto proof | Passed (33.50 seconds), including actual module reload, IPC/SIGINT/SIGTERM, active drain, standalone timeout recovery and in-process timeout rollback; the other four cases were deliberately skipped by the name filter, with their prior full-suite results retained |
| Diff / dependency graph | `git diff --check` and frozen install passed; dependency lock changes are workspace links only |

Hosted checks for the exact pushed commit are reported on the draft PR; they
remain mandatory before an owner-authorized merge. No hosted success is inferred
from the local Linux image. Regenerated captures from unchanged screens were
preserved in ignored scratch storage and excluded from the focused diff.
The existing Docker verification image now copies core/jobs/money manifests
before frozen install, so Linux installs the complete existing dependency graph;
no dependency version or compatibility baseline is changed.

Current Context7 was resolved/fetched for pg-boss worker lifecycle/retries and
Next.js Node instrumentation. The exact installed pg-boss 12.37.1 types/source
were checked for attempt fencing/redrive and stop behavior. Node 24.21.0,
pnpm 12.11.2, TypeScript 7.0.2 and all dependency pins/recorded corrections are
preserved; lock changes are workspace links only. No source conflict or new
baseline correction was adopted.

Initial focused failures: local timestamp assertion incorrectly used host-time
Node parsing; the old catalog allowed only the predecessor queue; a quarantine
test admitted a consumer before changing epoch. Repaired with PostgreSQL hour
extraction, exact queue registration and explicit stop/enqueue/restore/restart
ordering. No assertion was weakened or private error exposed.
The first full native run additionally found three obsolete inventory assertions
(zero provisioned queues, six tenant tables, and two failed jobs without the new
dead-letter copies). Updated their exact inventories and asserted both failed
sources plus both dead-letter copies retain identical locator/epoch/reason.
The complete final rerun passed; the original failures remain recorded here.

Agent-operated interactive CLI observations (distinct from human acceptance):
`runtime-two` started both modes; `runtime-fail` exhausted at retry count 2,
with one dead letter and zero effects. `runtime-clear-failure` / `runtime-redrive`
produced one effect/handler audit. `runtime-schedule` recorded the two intended
local-date runs; `runtime-repeat-date` retained those counts. `runtime-digest`
first returned `operator_disabled` with zero calls, then after disposable
`database-enable` / `fake-enable` returned `applied` with one call. After
`runtime-revoke-schedule` it returned `obsolete_state`, still one call.
`operator-disable` / `quit` stopped both consumers and cleaned up PostgreSQL.

## Exact owner manual acceptance (pending human observation)

Use a new private terminal without database/provider variables (do not print
environment values). Docker Desktop must be available. Run
`pnpm foundation:jobs --interactive`; it creates/provisions only disposable
synthetic PostgreSQL, refuses retained URLs/production/provider credentials and
cleans up on `quit`. Commands run at `jobs>`; consumers are asynchronous, so
repeat `runtime-status` until the documented state settles. Do not run the
legacy pause/rollback commands while runtime consumers are active.

1. `runtime-inprocess`, `runtime-queue`, `runtime-status`: same two registered
   handlers, two deliveries with exactly one new user effect/handler audit.
   `runtime-stop`; `runtime-worker`, `runtime-queue`, `runtime-status`: inspect
   the same outcome in standalone mode. `runtime-two`, `runtime-queue` proves
   overlap; one additional effect, despite both consumers. `runtime-stop`.
2. Fresh harness: `runtime-worker`, `runtime-fail`, `runtime-status`. Observe
   retry progression (max retry count 2), positive waiting age, then failed source
   and created dead letter with zero effects. `runtime-clear-failure`,
   `runtime-redrive`, `runtime-status`: `redriven`, one committed effect/audit and
   redrive audit. To rehearse transient failure, clear it while state is retry
   rather than after exhaustion. `runtime-stop`, `quit`.
3. Fresh harness: `runtime-schedule`, `runtime-status` before starting a runner;
   `runtime-revoke-schedule`, `runtime-worker`, `runtime-status`: no occurrence
   effects from the disabled grants. Configure again using `runtime-schedule`,
   inspect 06:00/01:00 next local times and intended business date, allow one
   effect per task/date, then `runtime-repeat-date`; run/effect/audit counts stay
   unchanged. `runtime-digest` reports operator suppression. The nightly outcome
   is a record only, with no deleted data.
4. Same disposable schedule: `database-enable`, `fake-enable`,
   `runtime-digest`: one fake counter call. `runtime-revoke-schedule`,
   `runtime-digest`: `obsolete_state`, counter unchanged. `operator-disable`.
   Real providers remain disabled throughout. Practice and restored DB denial
   are separately automated; no production bypass switch exists.
5. `runtime-stop`, `runtime-crash-before`, `runtime-status` and
   `runtime-crash-after`, `runtime-status`: only disposable children are killed;
   each restart leaves exactly one additional effect/audit. `runtime-timeout`
   reports the bounded failed exit and recovers one effect. The harness settles
   older attempts first and shifts only the new disposable lease time, avoiding
   a minute-long wait. `runtime-stop` uses Windows IPC. Linux signals are proven
   in the hosted/local Linux integration test; Windows cannot catch SIGTERM.
6. In a fresh harness, run inherited restore exercise: `guard-queue`,
   `operator-disable`, `restore`, `restart`, `quarantine`, `redrive`,
   `attempt-release`; durable old-epoch quarantine remains. `finance-confirmation`,
   `finance-allocation`, `finance-reversal`, `finance-refund` all deny while frozen.
   `auth-probe` remains suppressed. See [the complete recovery/race sequence](Issue_36_Restore_Guards_Evidence.md).
   For stale state use legacy `pause`, `commit`, `stale`, `consume` before starting
   consumers; the obsolete request gets no effect. `quit` cleans up.

Recheck the existing synthetic English/Tamil sign-in, recovery/reset,
owner/connections, sign-out and design-system flows at phone/tablet/desktop
sizes, with keyboard/focus. No jobs/business screen was introduced. Automated
Playwright/axe and agent-run CLI results do not constitute human acceptance,
screen-reader or physical-device observations; those are pending owner review.

## Migration/recovery and remaining limits

No retained-volume migration, role change, reset or live data was used. Before
an authorized retained upgrade, take/verify the required private backup, then
apply reviewed additive 0008 using the existing app_owner advisory-lock runner.
Do not give the runtime/operator migration credentials. New schedules are absent
by default; private grant configuration does not activate a real provider.
Compatible rollback must retain the new tenant/history/authority protections;
no destructive down migration or automatic quarantine release is provided.

Restore order remains kill switch/remove provider credentials/stop worker →
verified restore → new epoch/DB disabled/money freeze → integrity and privacy
revocation checks → audited reconciliation → money unfreeze → effect
reconciliation → DB flag → operator switch last. Environment changes cannot
recall an already-in-flight request; these proofs make no exactly-once external
delivery claim. No provider-effect ledger, automated customer messages, real
failed-job email, backup cron or privacy purge was added.

Physical devices, Tamil PDF goldens, search recall, live provider certification,
actual PITR/backup restoration/privacy reapplication and measured RPO/RTO are
not run and retain their later activation gates. Final delivery is a separate
draft PR for required CI and deliberate owner review; no merge/deploy or next
story is authorized here.
