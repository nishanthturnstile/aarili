# Issue #35 — atomic tenant commands and durable jobs

Evidence date: 14 October 2026. Wave 0 / 0.3.2a, subdivision of roadmap
0.3.2. Sources: product TRU-01/06, USE-08, AC-38/55; architecture §§6,
8.2/8.5, 10.2, 12.4, 15. This proves a synthetic database-only job, not
full business workflows, external delivery or recovery/pilot readiness.

## Admission and integrated baseline

The complete issue body, comments (none), ready-for-agent label and native
blocking relationship were read with authenticated `gh`. Only #16 blocks #35.
PR #21 merged that implementation at
`abd67edd491be5a1dc46661750a3c138f57a1dce`, verified as an ancestor of main.
The existing checkout was clean. Main fast-forwarded to `a455689` (including
#32–#34); the previous local topic branch was preserved. Work uses
`codex/0.3.2a-transactional-jobs`; no worktree or second feature checkout.

AGENTS.md, issue tracker, development workflow, foundation closeout and relevant
product/architecture/roadmap sections were read. No product scope conflict was
found. Integrated baseline `pnpm verify` passed: 67 unit/property and 44 real
PostgreSQL tests, lint/boundaries/tokens, Knip, strict types, negative types,
OpenAPI, production build/readiness/outage/worker smoke and 26 artifact scans.
Baseline `pnpm test:ui` passed 45 English/Tamil phone/tablet/desktop cases;
baseline audit found no known vulnerabilities. Browser tests regenerate
historical captures; incidental binary differences are excluded from this slice.

## Compatibility and current verification status

Context7 CLI resolved pg-boss, Drizzle ORM, PostgreSQL and Zod, then fetched
transaction adapter/startup options, node-postgres transaction/execute,
PostgreSQL 18 grants and Zod 4 strict payload documentation. The indexed Zod
4.6.5 docs were used alongside installed 4.6.6 declarations; the pin is unchanged.
The actual pg-boss 12.37.1 tarball/exported SQL/API declarations were inspected.
Node 24.21.0, pnpm 12.11.2, TypeScript 7.0.2, strict declarations and the existing
Drizzle/typed-route corrections remain. pg-boss is exactly 12.37.1 in jobs and
the lockfile. Its mandatory OpenTelemetry API peer adds a resolved peer to
existing snapshots; no exporter/provider or telemetry configuration is enabled.

The published pg-boss declarations omit `CompatibilityFlags` and
`ResolvedConstructorOptions` while other shipped declarations still reference
them. The first strict build failed with five TS2724 errors. An isolated
verification copy restored the exact two interfaces from upstream tag
`12.37.1` and passed strict TypeScript without altering runtime JavaScript,
the pin or `skipLibCheck=false`. This is a proposed declaration-only pnpm
patch, currently awaiting owner approval before baseline adoption. The
[reviewable proposed patch](../../patches/proposed-pg-boss@12.37.1.patch)
restores those exact definitions from
[upstream tag 12.37.1](https://github.com/timgit/pg-boss/blob/12.37.1/src/types.ts).
It is deliberately not registered in pnpm patchedDependencies. Until that
decision, D1 and the complete strict verification gate remain open; the draft
PR reports this failure and requests the decision without adopting a correction.

Independent runtime evidence: nine new real PostgreSQL/pg-boss tests
passed, three new unit/property/harness tests passed, lint and Knip passed,
four compiled payload/writer negatives failed for their intended reasons, and
the disposable API/queue demonstration passed. Full independent integration
regression passed 52 tests (including the then-eight jobs tests), followed by
all nine final jobs tests after adding distinct-key/version/correction and
missing-audit coverage. The complete unit suite passed 70 tests. Independent
production web build, OpenAPI and browser artifact checks passed. Both required
`pnpm verify` and `pnpm test:ui` were run and failed during build:packages on the
same five vendor TS2724 errors; their later gates did not run through those
commands. `pnpm audit --audit-level low` passed with no known vulnerabilities.
The browser regression runner was separately invoked after the successful web
build: 45 English/Tamil phone/tablet/desktop Playwright/axe cases passed in
6.1 minutes. `node scripts/smoke.mjs` passed production Next/Hono/real PostgreSQL
readiness/outage and worker shutdown. Frozen installation passed. These
independent results do not turn the failed aggregate commands into passes.
Hosted Linux checks are pending with the draft; scaffold/browser cannot pass
their build gate until the owner approves and the declaration correction is
adopted and verified. No hosted Linux queue outcome is claimed yet.

## Transaction, authority and durable history

`@aarili/jobs` is the real vendor/runtime boundary. Only that package imports
pg-boss. Framework-free core accepts a synthetic transaction-bound writer and
repository interfaces; it sees no vendor, driver, pool or queue object.
Server composition uses the existing verified-session owner transaction;
production composition never supplies the synthetic writer. There is no new
business route, UI, worker entry point, outbound adapter or scheduled authority.

Queue participation is bound into the canonical request hash; a key originally
committed without a writer cannot falsely replay as an enqueued command.
Core commits record, audit, replay response, authoritative job request and actual
pg-boss job together. `send()` uses `fromDrizzle(tx, sql)` on the exact authorized
transaction. Real xmin/backend evidence proves the common transaction; an
independent app_user fetch returns no job while it is paused. No after-commit
callback, alternate connection for writes, fake queue or outbox substitutes.

The strict payload contains only request/shop/initiator/entity UUIDs and version.
The request ID is the original command audit ID, also used as the queue job ID.
The handler resolves the same-shop authoritative request, compares every payload
locator and re-reads the current record/version/event. The payload cannot grant
authority. Current verified identity and owner membership are rechecked inside
`withShop()`; unknown, foreign, revoked, malformed and obsolete inputs return
the same non-disclosing ignored outcome with no effect/audit.

Identity and membership row locks serialize revocation with handling. Runtime
membership grants remain SELECT-only. PostgreSQL needs UPDATE authority/policy
for a row lock, so the reviewed migration supplies only a parameterless,
context-bound `lock_job_membership()` function owned by app_owner with a fixed
search path. Owner still obeys FORCE RLS/own-membership SELECT. A narrowly scoped
owner UPDATE USING policy permits the lock; WITH CHECK false rejects actual
updates. No supplied shop/user parameter, write, dynamic SQL, role assumption,
privacy bypass or arbitrary membership admission is available.

`synthetic_job_request` and `synthetic_job_effect` exist only in dev/test fixtures.
They have non-null shop_id, shop-led unique keys, composite tenant references,
ENABLE/FORCE RLS, restrictive matching policies, append-only grants/triggers and
actor/context provenance. The effect is unique per durable request and requires
a matching linked audit at commit. Its trigger also checks current record/version.
Request/effect/audit references have no FK to short-lived command keys. Effects
survive queue singleton expiry and 30-day command-key purging; queue state is
mutable transport metadata, not authoritative business history. Duplicate
delivery commits one effect and one audit. There is no exactly-once external
delivery claim or active key purge worker.

## Provisioning and catalog

`0006_pgboss.sql` contains the reviewed pg-boss 12.37.1 construction SQL (schema
45). Its BEGIN/COMMIT wrapper alone is removed so the existing migrator's
app_owner transaction, advisory lock and checksum include every schema/grant
write. The vendor advisory lock remains. Only fixtures provision
`foundation.synthetic`, using the existing `job_common` relation; production
migrations install no synthetic tenant tables or queue.

Runtime disables schema creation, migrations, supervision, schedules, instance
registration, statistics/warning persistence and LISTEN/NOTIFY. Startup checks
schema/version and the provisioned queue; missing setup produces a clear scrubbed
failure. No migration credential enters jobs runtime.

The catalog enumerates version, queue, schedule, subscription, bam, job,
job_common, warning, queue_stats, job_dependency and instance. The construction
plan's two UTC statistics partitions are identified by their exact dates from
read-only migration name/timestamp metadata, and parent relationships are checked.
Unknown queue relations fail; no schema or prefix is exempted wholesale.

| Runtime operation | Exact grants |
| --- | --- |
| Schema/startup/queue lookup | USAGE pgboss; SELECT version and queue |
| Send/fetch/complete/fail/retry | SELECT/INSERT/UPDATE/DELETE job and job_common |
| Dependency lookup | SELECT job_dependency only |
| Job clock | EXECUTE job_now() only |
| Provisioning/maintenance | No CREATE, TRUNCATE, REFERENCES, TRIGGER, metadata writes or DDL-helper execution |

DELETE on those two mutable job relations is required by pg-boss's atomic
failure/retry delete-and-reinsert statement. It is denied on immutable tenant
history and all other queue metadata. Backup is SELECT-only, privacy has no
queue/table access, and ownership remains app_owner. Catalog drift exercises
unknown relations, unsafe grants, DDL-function execution and tenant FORCE drift.
The later lifecycle slice must deliberately expand this catalog/grant inventory
when schedules, maintenance or per-queue relations are added.

## Acceptance map

| Criterion | Evidence and remaining gate |
| --- | --- |
| D1 | Exact manifest/lockfile and schema-45 SQL; real concurrent migration serialization; runtime startup fails for missing schema/queue and cannot create either. Declaration packaging repair is proposed and awaiting owner approval; final strict suite open. |
| D2 | Real barriers and independent app_user fetch prove no visibility before commit; five relation xmin values equal the command transaction ID; commit exposes one runnable job, rollback after actual enqueue exposes none. |
| D3 | Strict UUID/version DTO plus seeded canonicalization properties and four declaration negatives; queue row contains only the five allow-listed fields. Foreign actor/entity/request/version and extra content are ignored, never trusted as authority. |
| D4 | Real sessions authorize the synthetic API. Handler rechecks verified user/current membership, resolves authoritative request/current entity under withShop, ignores foreign/unknown/revoked/unverified/stale inputs; membership revocation waits on a genuine handler row lock. Missing context and pool reuse fail closed. |
| D5 | Concurrent same-key commands return one response/job; changed bindings have one winner/422. Concurrent delivery yields applied/duplicate with one effect/audit. A new real queue delivery after key removal/singleton-window simulation cannot repeat the durable effect. |
| D6 | Injected failures after record/audit/key/job and at commit boundary preserve counts; backend termination before commit permits same-key retry. Discarded committed response replays. Handler audit failure rolls back the effect, and actual queue failure/retry subsequently completes one effect. |
| D7 | Existing catalog gate covers every fixture tenant table and the exact queue relation/grant inventory; runtime/maintenance negatives and drift checks pass. Boundary scanner restricts pg-boss to jobs; production composition never binds the exemplar and browser artifact scan rejects jobs code. Independent production web build, smoke and 26 browser artifact checks passed. Aggregate strict build remains blocked as described under D1. |
| D8 | Disposable API/queue --demo runs pause/commit/replay/changed/consume/duplicate/rollback with scrubbed counts and cleanup. Target/outbound guard tests pass. Agent operated the interactive CLI: pause/inspect/commit/stale/consume/consume/quit proved obsolete/current version handling; a fresh pause/commit/revoke/consume/quit proved zero effects after revocation. Both fixtures cleaned up. Owner observations remain pending. |

## Exact owner/manual acceptance

Docker Desktop must be running with Linux containers and the existing pinned
PostgreSQL image available. Use the existing checkout and exact Node/pnpm pins.
Do not load the retained web/db private environment into this shell. The harness
rejects database target variables, PG variables, production mode, unknown/target
arguments and outbound activation; it does not accept a target URL or secret.

After the compatibility gate is resolved, run:

```powershell
pnpm foundation:jobs --interactive
```

These are commands at the `jobs>` prompt (no colon). Counts below are
records / command_audit / handler_audit / keys / requests / jobs / effects.

| Prompt command | Expected observation in a fresh harness |
| --- | --- |
| `pause` | API paused after its writes; separate app_user fetch sees zero runnable jobs; all seven visible counts zero. Use commit/rollback within 10 minutes. |
| `inspect` | Still all zero; uncommitted writes are invisible. |
| `commit` | 1 / 1 / 0 / 1 / 1 / 1 / 0. |
| `replay` | 200, original response; same seven counts. |
| `changed` | 422, changed binding rejected; same seven counts. |
| `consume` | applied; 1 / 1 / 1 / 1 / 1 / 1 / 1. |
| `duplicate` | duplicate; same seven counts. |
| `pause`, then `rollback` | Second actual enqueue rolled back; all counts stay at the preceding committed totals. |
| `quit` | Only this disposable PostgreSQL is removed; zero exit. |

Run two separate fresh harnesses for current-state/authority negatives:

1. `pause`, `commit`, `stale`, `consume`: the first job is ignored, effects and
   handler_audit stay zero. The edit has version 2 and its own command/job:
   1 / 2 / 0 / 2 / 2 / 2 / 0. A second `consume` may apply the current version's
   job once, yielding effects/handler_audit 1. `quit` cleans the disposable DB.
2. `pause`, `commit`, `revoke`, `consume`: ignored, no effect/audit; original
   record/request/key/job counts persist. `quit`; never revoke the retained owner.

`pnpm foundation:jobs --demo` runs the asserted normal/replay/rollback sequence
without prompts. Agent execution and test results are not owner human validation.
Owner should also manually recheck existing sign-in/recovery/reset/owner/
connections/sign-out/design-system flows; there is no jobs or money screen.
Physical devices, Tamil PDF goldens, search recall and privacy execution remain
their named later gates.

## Recovery, risks and handoff

Only disposable databases are migrated in this work. Retained infrastructure,
credentials, customer data and volumes are untouched. Any separately authorized
retained migration needs the required private backup and reviewed app_owner
migrator. No destructive down migration or production drizzle-kit push. Old
application code may ignore additive schema while all protections stay intact.

Before-commit failure is rollback/retry; after-commit response loss replays.
Restore must preserve authoritative request IDs, effect uniqueness, audit links
and command bindings. A database restore can rewind those records; this proof
does not make external effects safe after restoration. Restore epoch/quarantine,
outbound kill switch and money freeze remain #36 / 0.3.2b. Shared worker/dev
lifecycle, schedules, supervision, maintenance grants and retry/dead-letter
operations remain #37 / 0.3.2c. No outbound provider is enabled; no live money,
media, PDF, import/export/retention or autonomous system handler is introduced.

Publication is a separate draft PR with Closes #35, explicitly reporting the
unresolved declaration correction and failed aggregate verification commands.
Merge requires complete verification, the three hosted gates and deliberate
owner review. No merge/deployment or next
story is authorized. After an explicit owner merge decision, update main in
this same checkout and run integrated checks before branching again.
