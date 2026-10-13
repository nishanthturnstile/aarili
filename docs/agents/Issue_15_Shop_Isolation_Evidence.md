# Issue #15 — transaction-local shop context and forced RLS

Slice W0 / 0.2.2; product §4, TRU-01, AC-38, §§29.1, 30.1, 33;
architecture §§6.1–6.4, 8.1–8.2, 11.2, 11.4, 12.4, 15.1–15.2;
roadmap 0.2.2 and §9. Direct blocker #14 merged in PR #19, commit
`c36fb6f26fe3d395588ca137f875bbdbd2bba2e9`; issue #15 has no comments
or other native direct blockers. The existing checkout's integrated main at
that commit passed `pnpm verify`, all 45 UI tests and the low-level audit before
implementation. An initial overlapping web build caused a missing standalone
server during smoke; separating builds and repeating verification passed.

The approved Node/pnpm/TypeScript 7.0.2 corrections remain. Dependencies added
here are workspace links only. Context7 resolved PostgreSQL 18 and Drizzle ORM,
then fetched policies/role/catalog semantics, column-grant inspection,
schema-policy/composite-key declarations and official Hono middleware's route
parameter validation. Pinned installed declarations and actual PostgreSQL 18.6 establish
compatibility; FORCE/grants/functions remain reviewed SQL. No activation changes.

## Request and policy boundary

`GET /api/shops/{shopId}` resolves a real Better Auth session; supplied user,
shop and actor headers establish no authority. The path UUID is an untrusted
selection. `withShop()` validates identifiers, checks the actual runtime role
on the transaction's connection, clears prior shop/actor context, sets local
user context, reads only that user's membership and then sets shop/actor.
The auth composition rechecks and locks the live verified session inside that
transaction. API calls framework-free core with a transaction-bound repository.
The existing `/owner/shop` also uses that core/repository read. All responses
remain no-store, and no shop switcher or business write endpoint is added.

Statement timeout (10 seconds) and idle transaction timeout (15 seconds) are
technical transaction bounds, not approved business rates/policies. Server SQL
timeout or callback failure rolls back before the connection returns to the
pool. Callbacks must await their work; no detached promises, independent pool
queries, session-level GUCs or nested connections are supported.

The invoker-rights `shop_context_allows()` function checks selected shop,
matching user/actor and that user's membership. A restrictive ALL policy with
explicit matching USING/WITH CHECK cannot be bypassed by an additional
permissive policy. Own-membership SELECT is the deliberate pre-shop-context
exception, with its own restrictive user guard; it never recursively checks
itself. Runtime still has only SELECT on shops/memberships. Initial creation
remains confined to `complete_owner_bootstrap()` and its immutable provenance.

## Acceptance-to-evidence map

All new executable cases are in `tests/tenant-isolation.integration.test.mjs`;
their names expose 0.2.2 / D1–D9 / TRU-01 / AC-38. Privileged setup never counts
as runtime RLS proof.

| Criterion | Fresh executable evidence |
| --- | --- |
| D1 authenticated bootstrap | D1/D2/D6 uses actual native credential sign-in and sessions for two synthetic verified owners. Own shop succeeds; foreign/guessed shops, missing session, malformed UUID and revoked membership/session fail. Forged identity/actor/shop headers cannot replace authority. Raw membership reads see only the current user's entries. |
| D2 one transaction | API → core → bound `shopRepository.read`, plus `/owner/shop`; transaction-local context and backend PID assertions. Core has type-only repository interfaces; parsed import-boundary/strict type/build gates reject driver/framework/client leakage. |
| D3 runtime privilege | Real role/catalog checks reject owner, superuser, BYPASSRLS, role creation/replication, relation ownership (including inherited ownership) and transitive privileged membership. Runtime SET ROLE fails for migration/backup/privacy; deliberate grants and an unexpected BYPASSRLS role are rejected, then restored. Backup SELECT sees both shops but DELETE fails; privacy SELECT fails. No maintenance LOGIN or credentials are created. Existing auth/web operations call the same runtime guard. |
| D4 schema constraints | Production shop/membership Drizzle declarations and actual non-null UUID/shop-led keys; fixture parent/child composite PK/unique/FKs. Runtime cross-links fail. Elevated fixture insert/update/move cross-links and null tenant fail at PostgreSQL. |
| D5 forced reads/writes | Catalog inspects ENABLE/FORCE and effective policies/grants. Bidirectional real runtime reads/writes; omitted-filter lists remain isolated; foreign INSERT/moves fail, foreign UPDATE/DELETE affect zero rows. Empty/missing settings and forged actor/selected shop deny reads/writes. Root and membership writes have no runtime grant. |
| D6 two shops and paths | Two independently authorised synthetic owners, actual API sessions, own writes, guessed IDs and parent/child reads, update/delete denial in both directions. `tenantPaths` in `scripts/test-support/tenant-isolation.mjs` and the checklist below identify implemented paths. |
| D7 reuse/failure/switching | One-connection pool proves identical backend for A → no context → B after commit and after rollback/SQL timeout. Insert-before-failure leaves no row or context. Concurrent transactions on two physical connections keep separate settings/rows. Fixture-only explicit dual membership proves authorised switching. |
| D8 CI drift gate | `assertIsolationCatalog()` discovers all application tables across application schemas using PostgreSQL catalogs. Tenant guards, effective operation coverage, table and column grants, non-null UUID, shop-led unique key and tenant FK alignment are checked. Tests remove FORCE, remove/change write check, remove permissive write coverage, add an unclassified table, grant TRUNCATE, backup UPDATE (table or column), privacy SELECT on a column, bootstrap-only INSERT, and privileged membership; each must fail and the valid state is restored. Runs inside required Scaffold verification via `pnpm verify`. |
| D9 migration/local reuse | Clean migrations plus retained 0.2.1 schema containing completed bootstrap, shops, memberships and real sessions. Missing maintenance roles cause an atomic migration rejection; explicit privileged provisioning can repeat safely before upgrade. Concurrent migration runners take the existing advisory transaction lock. Upgrade/re-run preserves provenance and memberships. Existing health/outage/cleanup and UI tests exercise the native Windows path with spaces; hosted Linux runs the same integration gate. |

## Repository and indirect-path checklist

| Implemented path | Coverage |
| --- | --- |
| `shopRepository.read` / core `readShop` | Own/foreign by-ID reads in both directions under one transaction |
| `/api/shops/{shopId}` / `withOwnerShop` | Actual sessions, forged headers, guessed IDs, membership/session revocation |
| `/api/owner/shop` | Protected initial-shop read; existing owner bootstrap/recovery/Google integration and UI suites |
| `shop_membership` bootstrap query / `withShop` | Own-only pre-context visibility, no/revoked/foreign membership, malformed context |
| `withRecentOwner` | Existing recovery integration suite proves freshness/revocation and transaction callbacks; uses the same `withShop` boundary |
| `complete_owner_bootstrap` | Existing bootstrap concurrency/retry/failure/immutability suite; still the sole initial tenant write exception |
| Disposable parent/child repository | Omitted-filter, list/by-ID/parent-child, own writes and both-direction negative writes |
| Search/export/media/PDF/jobs/AI | Not implemented; no passing coverage claimed. Register and repeat the two-shop matrix before each path lands; repeat the full access matrix before second-shop/shared access. |

Catalog global exceptions are exact names: auth_user, auth_account,
auth_session, auth_verification, auth_rate_limit, auth_connection_event,
owner_bootstrap, owner_verification, application_rate_limit, aarili_migration,
all in public. Auth/installation/rate-limit metadata is confined to existing
auth/platform/migration boundaries. owner_bootstrap's nullable shop reference is
singleton installation provenance, not a tenant table. No pg-boss schema exists;
enumerate its actual relations and document the jobs exception when it lands.
No prefix/schema-wide exemption silently admits unknown tables.

## Local upgrade, history and recovery

Fresh Docker volumes run explicit administrator provisioning for NOLOGIN
app_backup (read-only BYPASSRLS) and app_privacy (no runtime/table privileges).
Existing role definitions are not silently changed; invalid flags/grants fail
the gate and require deliberate correction. app_owner cannot create these roles.

For a retained synthetic development volume:

1. Keep its existing credentials and volume. Start PostgreSQL if needed; an
   old role set makes `infra:check` report the explicit upgrade requirement.
2. Run `pnpm infra:roles`. This separately selected local command uses the
   ignored local administrator configuration over loopback, refuses remote
   Docker daemons, reads the reviewed role SQL and creates only missing roles.
   It displays no credentials and does not run migrations or erase records.
3. Supply MIGRATION_DATABASE_URL as app_owner through the established private
   configuration and run `pnpm db:migrate`. Migration 0003 adds backup SELECT
   grants/default privileges and restrictive tenant guards under advisory
   locking. Ordinary web/auth DATABASE_URL remains app_user.
4. Run `pnpm infra:check` and the repository verification gates. Do not delete
   the volume to repair a failed upgrade. Disposable integration fixtures
   independently prove the old-schema upgrade and idempotent migration path.

No tenant/history data is rewritten. Bootstrap owner, reservation/completion,
shop and membership attribution survive; connection-change history remains
append-only. Fixture tables are never production migrations. No backup/privacy
execution, live credentials, outbound messages, provider activation or second
live shop is introduced. Before any later production schema migration, take the
required backup and obtain deployment authorisation. Roll back application code
only with compatible schema; retain migration 0003 and RLS, never remove guards
to make an older app run. Restore/privacy/pilot gates remain later slices.

## Verification record

Fresh native Windows verification on 13 October 2026, after the final code/test
changes, ran sequentially to keep production web output separate from UI builds:

| Command | Result |
| --- | --- |
| `pnpm verify` | Passed: Biome/boundaries/tokens, Knip, strict TypeScript, 40 unit tests, negative DTO/client/component types, 29 real PostgreSQL tests (including all six 0.2.2 cases), production build, standalone readiness/outage and worker shutdown smoke, 26 browser-artifact scans |
| `pnpm test:ui` | Passed: 45 Tamil/English phone/tablet/desktop scenarios, keyboard/focus/axe, privacy artifact handling and no browser persistence; disposable database cleanup completed |
| `pnpm audit --audit-level low` | Passed: no known vulnerabilities |
| `git diff --check` | Passed |

During implementation the synthetic account-copy fixture needed explicit
text/UUID casts, and the privacy-denial probe needed a schema-qualified relation
to distinguish schema denial from name resolution. Both were corrected; the
final full suite passed. No unresolved local check failure remains. Generated
auth-screen captures from unchanged UI were excluded from the implementation.

The published PR's required checks provide the fresh hosted Linux/frozen-install
record; they must pass on its actual commit before owner review/merge. No CI
result from the earlier main commit substitutes for this branch's checks.
Physical-device review, real provider activation,
backup/erasure execution, Tamil PDF/search targets and production restore/pilot
readiness are not established by synthetic isolation tests. Integrated main
verification after merge requires separate owner-authorised merge.
The owner's retained local volume was not upgraded by this task; the disposable
old-schema/missing-role fixture proves the procedure without altering that volume.
