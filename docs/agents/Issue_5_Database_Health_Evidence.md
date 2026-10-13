# Issue #5 — typed PostgreSQL health and disposable verification

Slice **0.1.2a**, runnable/local portion of roadmap 0.1.2. Implementation
starts from integrated main `cf1da74`; direct blockers #3 (PR #8, `46a812d`)
and #4 (PR #9, `cf1da74`) were merged before branching. Issue #5 has the
approved `ready-for-agent` label and no comments. Work uses the existing
Windows checkout and branch `codex/0.1.2a-database-health`.

Sources: architecture §§6.4, 12.2–12.3, 15.1; product USE-08/09 foundations.
This implements operational readiness, not tenant repositories or business
commands. AC-38 RLS, AC-55 command semantics and pilot gates remain later
foundations. CI, repository protection and dependency automation belong to #6.

## Health path and configuration

The Node-runtime Next catch-all mounts the Hono module. Its health handler
calls a server-only platform probe that connects as `app_user`, executes
`SELECT 1::integer AS ready`, checks the integer result and ends the connection
in `finally`. It reads no tables and writes no data. Each request owns one
short-lived connection; there is no retained pool or idle database socket.

The entire connect/query operation has a **1,500 ms deadline** in addition to
pg connection, query and server statement timeouts. The timeout is a readiness
probe limit, not an invented business rate or policy. Ending an active pg query
destroys its connection; tests check both sockets and PostgreSQL activity.
Failures expose no driver diagnostics or configuration values.

`DATABASE_URL` is server-only, normally in `apps/web/.env.local`. Use
`postgresql://app_user:<local runtime password>@127.0.0.1:55432/aarili` after
the separately documented `infra:init`/`infra:up`. Keep this file ignored.
The host/database and `app_user` identity are required. Only the optional
`sslmode` URL query parameter is accepted: pg otherwise allows URL parameters
to override identity/timeouts. A missing, invalid, privileged or unavailable
configuration yields 503. No fallback to the development database exists in
tests. Build and page rendering do not connect to PostgreSQL.

| HTTP | Wire body | Meaning |
|---|---|---|
| 200 | `{"status":"ok","service":"aarili-web"}` | App and database readiness query succeeded |
| 503 | `{"error":{"code":"DATABASE_UNAVAILABLE","message":"Database is unavailable"}}` | Unconfigured, connection/query failure or timeout |

Both responses use `Cache-Control: no-store` and explicit OpenAPI schemas.
The existing unknown-route/method error remains intact. Hono's module client
passes external JSON through strict Zod schemas for both statuses. There are
no DTO copies in the UI: it accepts `Awaited<ReturnType<typeof readHealth>>`.
The wire integer is checked explicitly; no PostgreSQL value is serialized
into a new client DTO. No dates, money or other wire conversions are introduced.

The existing home page uses the canonical Button/Status components and tokens
with TanStack Query. It announces checking/ready/unavailable/request failure,
offers manual retry and rejects malformed responses without displaying their
contents. The query cache is memory-only with immediate inactive collection;
no persistence, business data, shop switching or auth state is introduced.
The later auth/shop shell must implement its own cache clearing policies.

## Pins and current documentation

- `@testcontainers/postgresql@12.2.0` (and locked `testcontainers@12.2.0`),
  matching the architecture baseline. Native Windows discovers Docker
  Desktop through Testcontainers' named-pipe strategy without global overrides.
- Runtime `pg@8.23.1` and development `@types/pg@8.23.1`; React Query
  `@tanstack/react-query@5.104.2`, matching the documented baseline.
- Disposable PostgreSQL uses the same reviewed image/digest as issue #4:
  `postgres:18.6-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c`.
- Existing Node 24.21.0, pnpm 12.11.2 and approved TypeScript 7.0.2 remain.
  No generator applies to these hand-written operational modules/tests.
- Context7 CLI resolve/docs reviewed Testcontainers 12.2.0 lifecycle/runtime
  discovery, node-postgres timeout/end behavior, Hono client inference and
  TanStack Query's provider/retry handling. The installed Next route-handler
  guide was read before changing the web entry point.
- The install reproduced `ERR_PNPM_IGNORED_BUILDS` for cpu-features, ssh2 and
  protobufjs. Their installed scripts were reviewed: optional native CPU/SSH
  acceleration and a protobuf version-scheme warning hook. They are unnecessary
  for local Docker socket testing. Current [pnpm build settings](https://pnpm.io/settings/build)
  and [pnpm 11 changes](https://pnpm.io/blog/releases/11.0) confirm the legacy
  `onlyBuiltDependencies`/`ignoredBuiltDependencies` fields are ignored.
  `allowBuilds: false` now explicitly denies these and the existing sharp,
  esbuild and unrs-resolver scripts. Frozen installs passed with no new scripts
  enabled. No unrelated version or tooling migration was made.

## Disposable fixture and commands

`scripts/test-support/postgres.mjs` starts a fresh container, waits through
the PostgreSQL module's readiness strategy, then verifies real SQL. A generated
random password and fixture-only administrator create `app_user` with
NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS. Only the restricted runtime URL
is passed to the app. URLs/passwords are never logged; endpoint/container IDs
are logged for evidence. No business/customer data is seeded.

The fixture uses `getHost()` and `getMappedPort(5432)`, never a fixed host
port, development credentials, volume or reuse. Its `finally` stops/removes
the container and its anonymous volumes and verifies the mapped port is
closed. Testcontainers' Ryuk stays enabled to handle abnormal process exits.
The browser runner gives the disposable URL to its own Next dev server and
waits for Playwright to exit before stopping the fixture. Production smoke
starts standalone Next and worker processes, tests ready, stops only its
database to test 503, then waits for both child processes to exit.

~~~powershell
pnpm test                 # Unit, runtime contract and existing scaffold checks
pnpm test:negative        # Six request/response errors + five UI errors
pnpm test:integration     # Real PostgreSQL and silent-handshake failure fixture
pnpm verify              # Lint, boundaries/tokens, Knip, types, tests, build, smoke
pnpm verify:clean         # Frozen native install/full verify in a temp path with spaces
pnpm test:ui              # All existing preview + new health browser checks
pnpm test:ui --grep 0.1.2a # Health checks only at phone/tablet/desktop
docker build --progress plain -f Dockerfile.verify -t aarili-issue-5-verify:local .
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aarili-issue-5-verify:local
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aarili-issue-5-verify:local pnpm test:ui --grep 0.1.2a
~~~

Docker Desktop must run its Linux engine. Normal commands stay native Windows.
The Linux verification image installs its own dependencies and Chromium; it
never copies Windows binaries. Build-time checks need no daemon; runtime
Testcontainers accesses the mounted **local** Unix socket and automatically
discovers the bridge gateway. No TCP daemon, host override, fixed WSL address,
privileged test runner or disabled reaper is needed. Native Linux runners can
run the same pnpm commands directly with their local Docker daemon.
There are no migration commands in this slice; fixture setup is native Node
and the existing clean-install script checks a path with spaces.

## Acceptance evidence — 13 October 2026

| Issue criterion | Evidence |
|---|---|
| Actual bounded web/Hono/database health | `pnpm smoke` traverses production standalone Next/Hono/PostgreSQL with the typed client; 200 before fixture stop, 503 afterward; no existing DB is stopped |
| Success/failure/timeout and connection/process release | 10 health unit tests; 3 real integration tests cover slow `pg_sleep(5)` with a 100 ms budget, zero remaining `aarili-health` PostgreSQL sessions, failed callback cleanup, silent handshake timeout/closed sockets; smoke finally waits for web/worker exits |
| Native Windows Docker discovery | Testcontainers 12.2.0 ran from PowerShell/Node 24 against Docker Desktop 4.93.0 / engine 29.8.1 without runtime overrides |
| Disposable database and dynamic endpoints | Observed native smoke `localhost:32778`, UI `localhost:32779`, clean-install smoke `localhost:32787`, final native UI `localhost:32791`; each emitted its matching cleanup message |
| Cleanup and Ryuk | Integration throws while the fixture is running and confirms cleanup; normal smoke/UI cleanup verifies closed ports. Final `docker ps` showed only the pre-existing `local-infra-postgres-1` on 5432; no test database/reaper remained |
| Linux and actual paths | Linux image frozen install/lint/Knip/types/unit/negative/build passed. Linux real integration observed `172.17.0.1:32782` / `:32784` and matching closed-port cleanup; Windows `pnpm verify:clean` completed in `.../Temp/aarili issue 2 clean p596ek` |
| Three-size smoke/axe | Native `pnpm test:ui`: **24 passed**, including 6 health cases at 360×800, 820×1180 and 1440×1000; no axe violations in healthy/unavailable states; keyboard retry and no horizontal overflow. Existing English/Tamil and light/dark preview tests passed |
| Reproducible commands and deferred safeguards | README, scripts and this guide describe actual fixtures/checks; roadmap records #5/#6 split without changing scope |
| Schema-derived Hono → Query/UI and invalid input rejection | Unit tests validate 200/503 and reject wrong status shapes, extra fields, altered messages, invalid JSON and 500. Negative TypeScript fixtures require exactly six request/response diagnostics and five UI diagnostics, including incompatible health data; browser invalid/network responses become recoverable states |

Final Linux `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock
aarili-issue-5-verify:local sh -c 'pnpm verify && pnpm test:ui --grep 0.1.2a'`
passed with **29 unit/scaffold tests**, **3 integration tests**, both negative
type fixtures, production readiness/outage smoke and **6 health browser tests**
with axe. Final endpoints were `172.17.0.1:32808` and `:32809` (integration),
`:32810` (production smoke), and `:32811` (browser); all emitted cleanup checks.
The final native verification also passed with smoke on `localhost:32806`;
the final integration fixture passed after improving assertion error reporting.

Windows `pnpm verify` and clean verification passed: **29 unit/scaffold tests**,
**3 integration tests**, negative fixtures, production builds and smoke. Browser
captures are [phone](health/captures/phone.png), [tablet](health/captures/tablet.png)
and [desktop](health/captures/desktop.png). Phone/desktop captures were visually
reviewed; the mechanical design detector returned no findings. These are review
captures, not business-workflow or PDF goldens.

The first silent-handshake assertion failed because the synthetic server did
not consume its startup packet, preventing its own observation of peer EOF.
Draining that fixture socket fixed the test; real probe timeout/cleanup then
passed. A later Linux run intermittently exceeded Vitest's default one-second
polling window for the backend session to disappear. A separate 20-probe Linux
diagnostic returned unavailable in 100–107 ms and observed every backend gone
in 107–164 ms, with no remaining session. The cleanup assertion now allows
2.5 seconds for asynchronous server teardown, still below the injected five-second
sleep so it detects lost cancellation. VM scheduling/teardown latency is the
suspected cause; a persistent connection leak was not reproduced. The install
policy failure above was resolved explicitly. Final native/Linux affected
checks passed as recorded above; there are no outstanding verification failures.

## Isolation, history, recovery and limits

No tenant tables, RLS claims, migrations, business mutations, idempotency keys,
audit/history records, jobs, media or auth were added. The only administrator
connection belongs to disposable setup; the ordinary web path uses `app_user`.
Browser boundary enforcement still excludes platform/pg/server code. Secret
canary production builds and browser-artifact checks passed.

Rollback is an application commit rollback with no schema compatibility issue;
stop only scoped test processes/containers. The independent development database
and its volumes are unaffected. The readiness URL requirement is intentional:
unconfigured apps now report unavailable, not healthy.

CI/check-run/protection evidence, tenant RLS, command retry/concurrency/history,
transactional pg-boss, finance/property checks, Tamil PDF goldens, physical-device
and real-IME review, search recall, restore drill/privacy/pilot gates are not
performed or claimed by this issue. No merge, deployment, live data or paid/cloud
resource is involved.
