# Issue #16 — atomic commands, replay, conflicts and protected history

Slice W0 / 0.2.3; product TRU-06/TRU-12, USE-08, AC-55, TRU-01/AC-38,
§27, §§29.1, 30.1, 33; architecture §§6.1–6.4, 7.3, 8.1–8.3, 8.5,
11.4, 12.4, 15; roadmap 0.2.3. TRU-08/AC-52 constrain the future
privacy exception. This is a synthetic infrastructure proof, not completion
of orders, measurements, money, stock, custody, approval or privacy workflows.

Issue #16 has no comments. Its complete native direct dependency list contains
only #15, closed by merged PR #20 at
`8d79f1d7762add0ac0ac9e97e37e7fe96a4c9492` on 14 October 2026.
The clean existing native Windows checkout was already on that integrated main.
Fresh `pnpm verify` passed there before creating
`codex/0.2.3-command-contract`. No worktree or feature checkout was created.
The approved Node/pnpm/TypeScript 7.0.2 and Drizzle declaration corrections remain.

Context7 CLI resolved and fetched official Hono/Zod OpenAPI and RPC docs,
Zod 4.6.5 validation docs (installed 4.6.6), Drizzle transaction/raw SQL and
schema/constraint docs, PostgreSQL 18 locks/triggers/grants docs, node-postgres
error-event docs, and fast-check property docs. The installed declarations,
strict builds and real PostgreSQL establish pinned compatibility. The only
new external dependency is exact `fast-check@4.10.2`, used by real properties.

## Command and transaction boundary

The existing Node-runtime Next mount passes the validated server environment
to `createApi`. Only development/test mounts the `/api/dev/shops/{shopId}/records`
exemplar. The default API factory environment is production. Production does
not mount the routes or document them, including when synthetic owner auth is
configured. No product screen, Server Action, queue or outbound effect is added.

Handlers use `@hono/zod-openapi` request/response schemas, delegate to
`withOwnerCommand`, and map core results/errors. That auth composition reuses
`withShop`, live verified session locking and membership admission, then binds
`commandRepository` to that exact transaction and server-resolved user/shop.
Core sees framework-free contracts and repository interfaces, never driver,
framework, vendor SDK, pool or independently nested transaction. The existing
owner/shop and health clients continue to use their original schemas.

Validation order is explicit: exact unsafe Origin and PostgreSQL-backed abuse
admission; path/header/body validation; session and shop membership; core key
and precondition validation; serialized key lookup; then authorized current
state/version/domain checks. The command bucket reuses the existing approved
owner sign-in admission count/window in its own PostgreSQL installation bucket.
Forged forwarding headers cannot partition it. Admission counters are outside
the business transaction, as in earlier auth boundaries; they are not business
effects. Command middleware applies only to exemplar paths.

| Outcome | Status / common error code |
| --- | --- |
| Missing/invalid session | 401 / UNAUTHENTICATED |
| Unauthorized requested shop | 403 / SHOP_ACCESS_DENIED |
| Unsafe/missing Origin | 403 / UNSAFE_ORIGIN |
| Record missing in the authorized shop, including foreign IDs | 404 / NOT_FOUND |
| Missing command key | 422 / IDEMPOTENCY_REQUIRED |
| Malformed DTO, JSON, UUID key or ETag; unexpected fields | 422 / VALIDATION_FAILED |
| Changed actor/action/request for an existing key | 422 / IDEMPOTENCY_MISMATCH; no stored data returned |
| Update missing If-Match | 428 / PRECONDITION_REQUIRED |
| Stale If-Match | 412 / VERSION_STALE, current authorized state and ETag |
| Finalized edit/finalize or invalid/duplicate correction | 409 / RECORD_FINALIZED or REQUEST_CONFLICT |
| Admission rate rejection | 429 / RATE_LIMITED and Retry-After |
| Transaction/service failure | 503 / SERVICE_UNAVAILABLE; retry the same key |

DTOs are schema-derived. Incomplete synthetic draft validation is separate
from complete commands. The fixture uses only alpha/beta/gamma values, not
amounts, measurements, personal fields or a business entity; no coercion or
empty-to-zero conversion exists. Per-module compiled Hono clients validate
outgoing commands, incoming state, ETags and errors. A 412 preserves current
state for a future UI; there is no automatic merge. Late responses are discarded
after sign-out/shop invalidation, with no persistent browser storage.
`pnpm openapi`, included in `pnpm verify`, generates an offline health/command
OpenAPI 3.1 document at ignored `test-results/openapi.json`. No interactive docs
or spec-serving route is exposed in production.

## Replay and protected storage

Migration `0004_command_history.sql` adds only `idempotency_key` and
`audit_event`. Both have shop-led keys/indexes, non-null tenant IDs, ENABLE/FORCE
RLS, restrictive read/write context guards and narrow INSERT/SELECT runtime
grants. Audit source references are composite `(shop_id, source_event_id)`.
Drizzle module declarations describe those reviewed tables. Runtime cannot
assume owner/backup/privacy, own tables, disable triggers, update/delete audit,
or purge keys. Existing bootstrap and auth connection provenance is retained.

The lock sequence is transaction-local advisory lock on a namespaced hash of
normalized shop/key, followed by a separate READ COMMITTED replay query. Hash
collisions can only add serialization. Keys are UUIDs normalized to lowercase.
`(shop_id,key)` remains the durable uniqueness backstop. There is no committed
in-progress reservation: a success row is inserted after mutation and audit,
and all three commit together. Any rollback or lost connection before commit
leaves no key; retry can execute. A lost response after commit replays before
current-version checks, including the original now-stale If-Match.

Request binding v1 is SHA-256 over sorted-key canonical JSON containing shop,
actor type/ID, action, normalized target, version precondition and validated
command. Arrays preserve order; JSON strings use JSON escaping; non-JSON values
are rejected. Object ordering is irrelevant. Request IDs are server-generated
per transport attempt and deliberately excluded from semantic binding.
The key stores actor/action/hash, success status and the validated response.
Response ETag derives from the stored response's version. Changed actor, action,
payload, target or precondition cannot replay a stored result.

Record updates lock the authorized row and use an explicit version predicate.
Finalization increments the version once. A correction requires a finalized
source and a reason, then appends a new finalized record/audit linked to the
original record and audit event. A shop-led unique correction reference prevents
concurrent duplicate correction; the original version/reference is untouched.
The exemplar table and trigger are installed only by
`tests/fixtures/command.sql`, outside application migrations. The fixture
trigger rejects direct app_user UPDATE/DELETE of finalized originals/corrections.
Audit triggers also reject UPDATE/DELETE even after an accidental write grant.

Insert provenance triggers require the actual transaction's shop and user
actor and set database time. User/system/import/support actor shapes are typed;
only user command admission is enabled. Callers cannot supply actor/shop in a
command, and identity/request headers cannot forge provenance. Audit stores
entity/action/time/actor/request/key, applicable correction reason and minimal
version/finalized/value-changed fields, without copying record values or auth
tokens/passwords. Future actual personal values must remain separate from
provenance. No privacy role bypass or erasure function exists here; a later
audited, narrowly scoped privacy function must redact values, preserve required
provenance and write tombstones (TRU-08/AC-52).

The architecture's lifetime is 30 days. `idempotencyCutoff` and the bound
`expiredKeys` query select shop-local keys at/before the cutoff. New key times
use millisecond precision to match JavaScript cutoff comparisons. There is no
active worker or purge operation; retained expired keys continue to replay until
later retention work purges them. Audit retains key identifiers without an FK
to short-lived keys. Future money/reference uniqueness must outlive key purging.

## Acceptance-to-evidence map

The executable names include 0.2.3/E IDs and product requirement/scenario IDs.
Real command proofs use the pinned Testcontainers PostgreSQL 18 image and
`app_user`; privileged connections only install fixtures, observe effects,
inject catalog/role drift or terminate the disposable test backend.

| Criterion | Evidence |
| --- | --- |
| E1 approved path | `command.integration.test.mjs` E1/E2/E3/E9 uses real native sessions → Hono → framework-free core → bound repository. Lint/boundaries, strict types and production builds enforce the existing package matrix and browser/server separation. |
| E2 shared contracts/errors | `command.test.ts` checks draft/full validation, strict ETags, complete OpenAPI status declarations, typed RPC execution, runtime DTO/header validation, 412 state and late-response invalidation. `test:negative` rejects five command misuse cases plus existing health/owner/component negatives. Integration checks malformed JSON/headers/DTOs, keys, 401/403/404/429 and exact origin, with no business effects. |
| E3 optimistic concurrency | API ETag/428/412-current/409/422 assertions; two distinct-key real transactions starting at version 1 produce one change/audit and one 412. Concurrent finalizations also produce one success and one 412. |
| E4 binding | Persisted response replay, uppercase UUID normalization, changed payload/action/target/precondition and a different authenticated actor in the same authorized shop; same key in two shops remains independent. Core hash properties bind every semantic field. |
| E5 retry/serialization | Two observed backend PIDs and a waiting PostgreSQL advisory lock prove real overlap. Identical requests yield one effect/audit/key; rolled-back first request lets the waiting second request succeed. A lost-response edit replays despite stale original If-Match. Backend termination before COMMIT leaves no successful key/effect/audit and permits retry. |
| E6 rollback | Failures after mutation, audit, persisted response/key and an enlisted fixture write leave all counts unchanged; safe retries commit exactly once. The additional write uses the same tx and is expressly not pg-boss/outbox evidence. Failed finalization leaves the draft's original state/version, then retries successfully. |
| E7 attributable audit | Real audit columns/actor/shop/time/request/key/minimal changes; spoofed headers ignored, injected DTO provenance rejected, forged SQL actor denied, retries add no event. Existing bootstrap remains complete; auth connection suites remain required. Runtime write grants and defensive audit triggers are exercised. |
| E8 finalized history | Normal commands reject finalized edits; direct runtime SQL cannot update/delete finalized originals or corrections. Concurrent linked corrections produce one new record/event and one 409; original state/event references remain. Runtime audit writes and SET ROLE app_privacy are denied; accidental audit grants still cannot defeat the trigger. |
| E9 isolation/negatives | All new tables pass the real catalog gate. Both shops see only own records/keys/audit even in deliberately unfiltered queries. Foreign record/event/correction references fail, missing context hides rows/denies inserts, forged actor context hides rows, forged key actor and disabled support entry point are rejected. Existing catalog-drift suite covers the expanded table inventory. |
| E10 lifetime/exposure/reproducibility | Unit cutoff calendar cases and exact database before/at-cutoff selection. Production factory with real synthetic auth excludes exemplar paths and OpenAPI entries; standalone production smoke checks absent exemplar/docs routes and browser artifact scan rejects command server code. Same reviewed SQL/suite runs in the three existing hosted Linux jobs; local full checks include existing auth/UI. |

Implemented tenant paths are registered in
`scripts/test-support/tenant-isolation.mjs`: existing shop/membership reads,
all command record methods, key lock/replay/persist/cutoff/audit and exemplar API.
Search/export/media/PDF/jobs/AI are absent and have no passing coverage claim.
Register and repeat bidirectional isolation when each such path lands.

## Migration, recovery and development operation

The existing app_owner migration runner applies 0004 under its advisory
transaction lock. The additive tables/constraints/grants/triggers preserve
existing auth, memberships and history. The retained-schema isolation migration
test and repeated migrations exercise upgrades and immutable migration hashes.
No owner volume is reset or upgraded by this task. Before a later live schema
migration, take the required backup and obtain deployment authorization.
Application rollback requires compatible schema; retain protections and history,
never delete finalized records or remove RLS to make an old build work.

For synthetic local operational testing only: explicitly set NODE_ENV to
development/test, provide the existing private loopback app_owner migration URL,
and run `pnpm db:command-fixture`. This separately selected script first applies
reviewed application migrations, then installs the fixture under advisory
locking. It refuses production or non-loopback configuration and preserves an
existing fixture. The ordinary web credential stays app_user. Development auth
still uses its existing synthetic loopback configuration; no new provider,
email delivery or product activation is introduced.

The real connection-loss probe initially exposed an uncaught pg client error
between queries. Runtime pools now handle both idle and checked-out client
error events with a constant redacted message; driver queries/COMMIT still
reject and broken clients are discarded. No driver error/credential/parameter
is logged, and no success is returned for an uncommitted transaction.

Committed replay addresses network loss, not restored-database external effects.
0.3.2 still owns real transaction-enlisted queue commit/rollback, restore epoch,
quarantine, money freeze, kill switch and outbound suppression. Scheduled purge,
privacy/retention execution, live restore drill and every product pilot gate
remain inactive. No merge, deployment, live data or external service activation
is authorized by this implementation.

## Verification record

Fresh final native Windows results on 14 October 2026 are recorded below.
Verification uses this one checkout with its path
containing spaces; web builds run sequentially to avoid output contention.

| Command | Result |
| --- | --- |
| `pnpm verify` | Passed: Biome (no warnings), boundaries/tokens, Knip, strict types, 48 unit/property/guard tests, all negative client/DTO/component cases, offline OpenAPI generation, 36 real PostgreSQL tests, production build/standalone readiness/outage/worker shutdown and 26 browser-artifact scans. |
| `pnpm test:ui` | Passed: all 45 existing Tamil/English phone/tablet/desktop auth/health/design-system smoke, keyboard/focus and axe cases; disposable database cleanup completed. Application/UI code did not change after this run; the subsequent changes were installer diagnostics and integration-test assertions. |
| `pnpm audit --audit-level low` | Passed twice, including immediately before final publication: no known vulnerabilities. |
| `git diff --check` | Passed after final source changes; repeated before commit. |

Initial targeted failures (timestamp precision, an incorrectly doubled offline
OpenAPI prefix, a production unsafe request lacking Origin, and the real
connection-loss event) were repaired without weakening assertions. The earlier
bootstrap inventory assertion now names all four production tenant tables,
retaining its FORCE/read/write checks. A repeat full run exposed the existing
renewal test's wall-clock comparison after HTTP delivery. It now checks the
stored expiry-minus-updated_at duration with the same two-second tolerance and
requires both instants to advance; all cookie/security assertions remain.
The targeted renewal case and final complete verify run passed. Fixture CLI
production/remote/malformed/unspecified-environment rejection is a black-box
unit test, including a diagnostic canary; no connection is made by those cases.
No unresolved local failure remains. Regenerated captures from unchanged
screens were excluded from the focused change.

Physical-device review, Tamil PDF/search workflows, actual backup/privacy/restore
execution and live provider activation are not performed and are not claimed
by this synthetic foundation. Linux results require the published head's actual
hosted checks. Owner review, CI and separate explicit merge authorization remain
required; integrated-main verification after merge cannot be performed here.
The pre-existing tracked `.scratch/drizzle-compat` dependency artifact remains
outside the pnpm audit graph; its separate GitHub alerts are not remediated by
this issue.
