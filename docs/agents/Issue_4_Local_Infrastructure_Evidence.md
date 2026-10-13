# Issue #4 — dedicated synthetic local infrastructure

Slice **0.1.1b**, part of roadmap 0.1.1. Approved issue #4 depends on #2,
merged by PR #7 (`ac2b456`); implementation starts from integrated main
`46a812d`. Issue #3/PR #8 is also integrated. No capability allocation changes.

Sources: architecture §§5.1, 8.1–8.2, 12.3.1; product TRU-01/TRU-10 and
USE-09 foundations. These checks establish isolated local resources and
understandable failures, not business shop isolation or the live recovery gate.
No tenant/business tables, auth, queue, media authorization or deployment.

## Pins and upstream review

- Official `postgres:18.6-bookworm` pinned to digest
  `sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c`.
  PostgreSQL 18 uses `/var/lib/postgresql/18/docker` within the named volume
  mounted at **`/var/lib/postgresql`**, not the older `/data` mount.
- Garage `dxflrs/garage:v2.4.1` pinned to digest
  `sha256:9c96caa2612d3411acc5b0e6701fb238dbfba33e533a6d7d3d811a4b12d0d020`.
  Single binary, SQLite metadata, one node; no admin/web/RPC host ports.
  Persist `/var/lib/garage/meta` and `/var/lib/garage/data` independently.
  Upstream documents automatic single-node layout/default private bucket
  creation since 2.3.0. This is a local S3 substitute, not production storage.
- Root development-only probes use exact `pg@8.23.1` and
  `@aws-sdk/client-s3@3.1150.0`; npm metadata supports Node 24
  (`>=16` and `>=20` respectively). No application runtime imports them.
  pnpm recorded specific AWS release-age exceptions alongside existing
  exceptions; exact transitive versions remain in the lockfile. No install
  scripts or allowed-build entries were added.
- Current Context7 resolution/docs reviewed Docker Compose, official PostgreSQL
  image, Garage, node-postgres and AWS SDK v3. Upstream
  [Garage quick start](https://garagehq.deuxfleurs.fr/documentation/quick-start/)
  confirms the exact 2.4.1 command/configuration; the official
  [PostgreSQL image](https://github.com/docker-library/postgres) confirms mounts.
  Generator scaffolding does not apply to this hand-reviewed Compose/bootstrap.

## Commands and credential handling

Run the README `infra:*` commands in this checkout (PowerShell or native Node
on Linux/macOS). Prerequisites are the repository Node/pnpm pins, Docker CLI
with Compose `up --wait` support, and a reachable Linux Docker engine.
Windows verification used Docker 29.8.1, Compose 5.5.1 and `desktop-linux`.
Doctor reports transport kind, override presence, runtime versions, Linux
engine, loopback listeners and Windows excluded ranges. Context/daemon values
are withheld. Every lifecycle mutation requires a local named pipe/Unix socket
and Linux engine; remote/TCP contexts are rejected. Unencrypted TCP overrides
are also rejected by doctor; no daemon TCP
workaround is needed. Standalone scripts are not Turbo tasks, so their Biome
environment-dependency rule is disabled only for this script.

`infra:init` writes random hex passwords, S3 credentials and RPC secret to
ignored `infra/.local`, refusing to overwrite even partial state. Never display
or commit that directory. `.dockerignore` excludes it from verification builds.
Files use restrictive POSIX modes; Windows uses the user's inherited directory
ACLs. Local Docker administrators can inspect the Garage environment and read
mounted secrets; this is dedicated synthetic development, not a secret vault.
Avoid raw Compose config, container environment inspection and debug logs when
sharing diagnostic evidence. Normal commands suppress raw subprocess/SDK errors.

PostgreSQL admin password uses a Compose file secret. Two separate secret files
initialize `app_owner` and `app_user`; initialization runs only on an empty
PostgreSQL volume. Both roles are NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE.
`app_owner` owns the database/public schema; `app_user` has CONNECT/USAGE but no
CREATE or membership in the owner role. No default business-table grants are
introduced. `pg_trgm` and `pgcrypto` are installed by bootstrap. Backup/privacy
roles, forced RLS, membership and runtime transaction context remain slice 0.2.2.
Scaffold web/worker do not yet connect; a later runtime must use `app_user`.

Host ports default to 55432/53900 and bind `127.0.0.1`; process overrides beat
`infra/.env`. Only those two variables are accepted in that file. Port 5432 is
explicitly refused. Do not use host endpoints inside a container. Credentials
remain separate from these port settings and never enter app/browser builds.

## Normal shutdown, failures and explicit reset

`infra:down` uses the fixed project/file and removes only that project's
containers/network. It never removes volumes or credentials. `infra:up` waits
up to 90 seconds for container health and then checks actual native endpoints.
Repeated up is supported. Health failure preserves state for diagnosis.
Occupied/excluded ports fail before up; choose a free override without stopping
other listeners. Missing Docker or an invalid context produces a scrubbed
actionable error; select Docker Desktop Linux containers and rerun doctor.

Do not rerun init or replace passwords when existing volumes contain state:
init scripts do not run again. Preserve `infra/.local` across restart; losing
it requires deliberate local credential recovery or a synthetic-only reset.
No automated destructive command exists.

**Explicit destructive reset**, only after deciding all Aarili synthetic data
can be lost: first `pnpm infra:down`; inspect the three named volumes below
with `docker volume inspect` and confirm their Compose project label is
`aarili-local`. Then explicitly remove only:

~~~powershell
docker volume rm aarili-local_postgres_data aarili-local_garage_meta aarili-local_garage_data
~~~

Keep the credential directory and run `pnpm infra:up` to reinitialize. Never
prune globally, reset unrelated Compose projects or remove Windows directories
as a side effect. To abandon this implementation, stop its containers and
switch branches; preserve named volumes/credentials for later use.

## Acceptance evidence (13 October 2026)

| Issue acceptance | Fresh evidence |
|---|---|
| Own PostgreSQL/database/network/named volume; local-infra preserved | `infra:verify` compares every unrelated container ID/state/start time/mount/network before and after down/up. Existing `local-infra-postgres-1` ID starts `769da56b1402`, loopback 5432. |
| Port 55432 configurable, listener/reservation checks, loopback endpoints | Native `infra:doctor`: 55432 and 53900 available, IPv4/IPv6 reservation checks pass; repeat on running resources reports owned listeners. Actual up/check passed on overrides 55433/53901, followed by down and restored-default doctor. Occupied listener diagnostic failed without touching it. Unit tests cover excluded-range boundaries and invalid/duplicate/5432 overrides. |
| Supported image/extensions; separate runtime and ownership | `infra:check`: PostgreSQL major 18; pg_trgm/pgcrypto present and callable, native UUIDv7 available; app_user restricted flags and rejected CREATE/SET ROLE; app_owner ownership/non-superuser verified. |
| Cross-platform secret-safe environment diagnostic | Node script uses argument-vector subprocesses/no shell. Native Windows doctor passes; invalid override canary never appears. Missing-context probe fails with scrubbed Docker guidance; TCP override refused. Linux unit/build checks exercise script imports and listener probes. |
| Native database and authenticated S3 API | `infra:check`: native pg connection and AWS SDK signed PUT/GET/DELETE; exact content comparison; anonymous GET denied; GET after DELETE returns NoSuchKey. |
| Persistent state, correct mount paths | `infra:verify`: unique empty catalog schema and synthetic object bytes survive full down/up; both probes cleaned afterward. No tenant/business tables created. |
| Health/startup and clear failures, scoped lifecycle | Compose health wait and actual endpoint checks pass; occupied-port/missing-context failures exercised; unrelated identity comparison passes. |
| Reset separated from normal lifecycle | Only explicit documented volume-rm removes data. Up/down/verify contain no volume removal, prune or unrelated reset. |

`pnpm verify` passed on native Windows: lint/boundaries/tokens, Knip, strict
typecheck, 19 tests in four files, negative contract/UI fixtures, production
web/worker build, actual HTTP/worker smoke and browser artifact secret check.
`Dockerfile.verify` also passed a clean Linux frozen-lockfile install and the
same suite, executable negative fixture and secret-canary production rebuild.
`pnpm infra:verify` passed the real service checks/restart rehearsal above.
`pnpm verify:clean` passed a frozen native Windows install and full verification
in a disposable path with spaces, plus the secret-canary rebuild; lockfile
unchanged. Generated infrastructure credentials were absent from the staged
patch and all 20 browser artifacts. Final `infra:down` preserved all three
named volumes/credentials; existing local-infra remains running on port 5432.
Real local PostgreSQL/Garage checks use these dedicated containers, not mocks.
Testcontainers/CI/API database health are issue #5; no live data or production
restore drill, recovery SLA, RLS, or transactional queue claim is made here.
UI/PDF/device checks are not relevant to this infrastructure-only change.
