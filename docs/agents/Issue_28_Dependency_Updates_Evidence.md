# Issue #28 dependency maintenance

On 23 October 2026 the owner requested a separate branch from development and
selected **all listed dashboard updates, including major upgrades**. Scope is the
[dashboard](https://github.com/nishanthturnstile/aarili/issues/28) read during this
session, not unlisted future releases. No native blockers were returned.
Branch: `codex/issue-28-dependency-updates`, base `824304b` from origin/development.
Unrelated review files were preserved in the named local stash
`preserve unrelated review changes before issue 28`; the pre-existing autostash
also remains. Both delivery-log sections were retained when resolving its
autostash conflict. No worktree, protected-branch push, merge or deployment.

## Approved update coverage

- Runtime/tooling: Node 24.22.1, pnpm 12.15.0, Turbo 2.11.10, Biome 2.6.2
  (including schema URL), Knip 6.42.1, Vitest 5.0.5, Testcontainers 12.2.1.
- Web/contracts: Next 16.4.2, React/React DOM 19.3.1, Zod 4.6.7,
  TanStack Query 5.104.5, resolvers 6.0.0, PostCSS 8.5.31, lucide-react 1.61.0.
- Services: both AWS S3 packages 3.1156.0, Better Auth 1.7.12, bun-types 1.4.4,
  Sentry 11.8.0, rate-limiter-flexible 11.2.3, pg-boss 12.38.0.
- Browser/PDF: Playwright Test/core 1.64.1 and axe 4.14.0; PDF resource manifest
  updated, original seccomp provenance retained.
- Transitive override: esbuild 0.28.2 for esbuild-kit/core-utils; regenerated
  exact lockfile and ran recursive lock-only maintenance. pnpm added three
  exact release-age exceptions for the selected AWS and bun-types releases;
  existing disabled build-script controls remain.
- CI: Ubuntu 26.04; checkout 7.0.1, setup-node 7.1.0 and pnpm/action-setup 6.1.0,
  each resolved to its upstream commit SHA (including annotated tag resolution).
- Containers: Node 24.22.1 Bookworm slim index digest `55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205`;
  PostgreSQL 18.6 Bookworm refreshed index digest `bbf83594798e144bff365a9c191c5d779f181fb3135902064ab8ff11918020fc`.
  Both obtained with Docker buildx from the registry; fixture and infra pins agree.

Renovate's approval/schedule configuration stays in force. Dashboard #28 is a
persistent bot-owned issue and should remain open; Renovate will refresh its
contents after integration. No approval checkboxes or bot settings were changed.

## Compatibility and migration

Context7 resolved/fetched pnpm workspace/patch docs, resolver migration docs and
pg-boss migration-plan docs. Tagged resolver 6.0.0 release notes identify its
breaking change as the Effect v4 adapter; Aarili uses Zod. Upstream action
READMEs/releases and Ubuntu 26.04 runner manifest were checked. setup-node v7's
removed dummy NODE_AUTH_TOKEN does not affect this workflow, which supplies no
registry credentials. Context7's pg-boss static-method example is stale for
12.38.0: the installed package exports named `getMigrationPlans`; its actual
source/API was used. No compiler compatibility workaround was removed.

The pg-boss declaration patch restores exactly the same two interfaces present
in upstream tag 12.38.0; both were compared against that tag. Only the patch
version and end-of-file hunk position changed; no library runtime code is patched.

Production smoke initially failed because pg-boss now requires schema 46.
Migration `0046_pgboss_12_38.sql` exports upstream's 45→46 plan, adds nullable
retention metadata, replaces create_queue and builds four indexes. BEGIN/COMMIT
are removed because Aarili owns the transaction/advisory lock/checksum. Indexes
build synchronously inside that transaction instead of concurrently outside it.
The four reviewed queues share job_common; an explicit guard rejects unexpected
private partitions instead of silently missing their indexes. No old migration
is edited and no job, tenant row or immutable business history is removed.
CREATE OR REPLACE retains existing function grants. Runtime still uses app_user
with migrate/createSchema disabled, and the worker starts after provisioning.
The isolation catalog now requires schema 46; all existing table/role/function
grant/RLS checks remain. A targeted document test exposed the old hardcoded 45
pin; its original drift failure is retained. Final integration includes the
complete tenant-isolation file and the new upgrade test calls that catalog.

Before applying to a populated environment, take a backup and schedule a
maintenance window for index locks; this work authorizes no live migration.
Deploy schema and matching library together. A code-only rollback to pg-boss
12.37.1 is incompatible with schema 46; recovery requires reviewed coordinated
schema/library recovery or a compatible backup, not editing migration history.

## Verification ledger

Native Windows, Node 24.22.1, pnpm 12.15.0, synthetic disposable infrastructure.
Raw logs are local `.scratch/issue-28/` artifacts, not committed credentials/data.

- Frozen installation and recursive lock maintenance: exit 0.
- `pnpm audit --audit-level moderate`: exit 0, no known vulnerabilities.
- `pnpm verify:fast`: exit 0; lint/boundaries/tokens, Knip, strict/negative types,
  OpenAPI, **311/311 unit tests**, production build. Initial Biome run found one
  newly formatted blank line in an existing surface brief; corrected. Five
  non-failing performance warnings remain in existing tests.
- Scoped clean native copy: frozen install, all ten package builds, production
  web build, 29-artifact private-canary scan, unchanged lockfile: exit 0; copy
  removed by the existing path-checked harness. Uses the repository clean-copy
  harness with its full verify step replaced only in the disposable script by
  build:packages; it is **not** a claim that verify:clean/full verify ran.
- Three-size Playwright PDF status/retry test: **3/3 passed**, English/Tamil,
  light/dark themes, accessibility and reflow (1.6m).
- Production smoke after migration: exit 0, real PostgreSQL readiness/outage,
  typed client and worker shutdown. Before-migration failure retained.
- New upgrade test: pending jobs/history preservation and worker startup passed
  on its first run. Partition-negative fixture initially omitted required queue
  policy; corrected. Both upgrade tests pass in the final run below.
- A later fast run hit two existing five-second property-test timeouts during
  Docker image export. Controlled rerun `pnpm test --maxWorkers=2` passed all
  **311 tests** in **37.96s** without changing test timeouts or policy. The
  standard `pnpm verify:fast` rerun subsequently passed (311 units, 15.78s;
  production build, 21.202s) after image construction finished.
- `pnpm test:pdf`: exit 0; non-root namespace/seccomp sandbox, 50 synthetic
  strings, four embedded font faces and all five A4/A3 PDF page goldens passed.
- Final changed-source Biome check and 29-artifact scan: exit 0.
- Final production smoke after rebuilding the catalog pin: exit 0.
- Final targeted integration: **exit 0, 61/61 tests in 11 files, 753.63s**,
  started **04:02:16 UTC**. Covers tenant-isolation catalog/negative policies,
  transactional queue commit/rollback/retry/concurrency, worker runtime,
  owner bootstrap/Google/recovery, media/storage/processing, private documents
  and sharing, plus schema upgrade/job preservation and partition rejection.
- Review-ready checkpoint: **04:15 UTC, 23 October 2026**. Final source changes
  were frozen before this integration run; only evidence text changed afterward.

Full repository integration/browser suites, physical-device/Tamil human review,
hosted Ubuntu 26.04 CI and owner merge review have not been run/accepted here.
No new user workflow is introduced: manual review focuses on the dependency,
action and migration diff and the recorded evidence, followed by CI before merge.

Traceability: architecture §§4–5 (approved pins), 8.1–8.5 (isolation/history),
10–13 (jobs/recovery) and 15 (verification); product TRU-01/TRU-06, AC-38 and
§33.1. No product requirement or release allocation changed, so no roadmap scope
change is needed. The upgrade/partition tests expose #28 in their names, and
existing tenant/job/document tests retain their requirement IDs.
