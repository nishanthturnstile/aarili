# Aarili

Boutique management portal, currently a workspace, design-system and local
infrastructure scaffold (Wave 0 / slice 0.1.1).
Development is synthetic-only. Read AGENTS.md and the product/architecture
documents before implementing a selected issue.

Use this single local checkout for all development, switching between focused
topic branches. Do not create Git worktrees or extra feature checkouts. Follow
[the development workflow](docs/agents/Development_Workflow.md); each issue gets
its own GitHub branch/PR after its direct blockers have merged.

## Native Windows development

Use Node **24.21.0 LTS** and pnpm **12.11.2** on Windows/PowerShell. The exact
runtime is in .node-version; packageManager and engines reject version drift.
Install the pinned pnpm with `npm install --global pnpm@12.11.2` if needed.
Quote the checkout path when changing directories.

~~~powershell
pnpm install --frozen-lockfile
pnpm dev
~~~

The web listens at http://127.0.0.1:3000; the worker logs its ready state.
`pnpm dev:web` and `pnpm dev:worker` start them separately. Ctrl+C stops
development processes. The worker also supports graceful SIGINT/SIGTERM and
an IPC shutdown message; IPC is the automated graceful shutdown path on
Windows. There are no queue consumers or database connections yet.

The web/worker scaffold requires no credentials. Their .env.example files contain only NODE_ENV.
All NEXT_PUBLIC_* variables are rejected in this increment. Server environment
validation is owned by platform, imported only at server entry points. Errors
do not print supplied configuration values. No client storage/cache exists.

## Checks and production entry points

~~~powershell
pnpm lint
pnpm knip
pnpm typecheck
pnpm test
pnpm test:negative
pnpm build
pnpm smoke
# Runs all of the preceding checks:
pnpm verify
# Installs and verifies in a disposable temporary directory with spaces:
pnpm verify:clean
# Installs Linux dependencies and runs the same checks:
docker build --progress plain -f Dockerfile.verify -t aarili-issue-2-verify:local .
~~~

`pnpm format` uses only Biome. The root config intentionally excludes existing
planning documents and skills. Typecheck uses local TypeScript 7.0.2, generates
Next route helpers, checks tests and emits strict shared declarations. Negative
fixtures must actually fail with the expected diagnostics. The import checker
parses TypeScript and follows browser imports/re-exports, including aliases,
dynamic imports and require; it checks core/API restrictions before business
modules are added. Unsupported computed imports fail closed.

After building, `pnpm --filter @aarili/worker start` starts the compiled worker.
`pnpm --filter @aarili/web start` starts Next locally. The standalone server
for later image packaging is `apps/web/.next/standalone/apps/web/server.js`;
Next's standalone output also needs the generated .next/static directory
copied into its app directory to serve client assets. This ticket does not
deploy that output. Smoke verifies actual production HTTP and worker processes
on a free loopback port, then cleans up only those processes.

Docker Desktop uses its WSL2 Linux engine for verification. Normal app/install
commands stay on native Windows. Dockerfile.verify is a disposable verification
image with a digest-pinned Node base; .dockerignore excludes credentials,
Windows dependencies and generated outputs. Dedicated local infrastructure is
managed separately below; no cloud resources are provisioned.

## Dedicated synthetic local infrastructure

Docker Desktop supplies the Linux PostgreSQL and Garage S3 containers; Node,
pnpm and the application stay native on Windows. No second WSL daemon is needed.

~~~powershell
pnpm infra:init     # Once: generate ignored random credentials; refuses overwrite
pnpm infra:doctor   # Runtime/daemon/ports/reservations; no secret values
pnpm infra:up       # Wait for health, then verify native SQL and signed S3 access
pnpm infra:check    # Repeat SQL/role/extension and S3 put/read/remove probes
pnpm infra:verify   # Synthetic persistence rehearsal across normal down/up
pnpm infra:down     # Stop/remove only Aarili containers/network; preserve volumes
~~~

The dedicated project is `aarili-local`. PostgreSQL uses
`127.0.0.1:55432`, database `aarili`, runtime `app_user` and migration `app_owner`.
Garage uses `http://127.0.0.1:53900`, region `garage`, path-style requests and
private bucket `aarili-synthetic`. Containers on `aarili-local_local` use
`postgres:5432` and `s3:3900`; native Windows uses the loopback endpoints.
Existing local-infra on port 5432 is preserved.

Optional port overrides belong in `infra/.env` copied from `infra/.env.example`,
or in `AARILI_PG_PORT` / `AARILI_S3_PORT` process variables (process wins).
Doctor checks Windows IPv4/IPv6 exclusions and listeners before startup.
See [the infrastructure guide and evidence](docs/agents/Issue_4_Local_Infrastructure_Evidence.md)
for credential handling, failure recovery and the separate explicit destructive reset.

## Package boundaries

apps/web mounts packages/api in one Node runtime route. packages/contracts
owns Zod-derived health/error DTOs; api/client exports the browser-safe typed
Hono client. packages/platform owns server-only environment validation.
packages/ui owns the canonical globals.css, Tailwind v4 tokens, locally served
Noto Sans/Noto Sans Tamil and Base UI controls. See the
[design-system guide and acceptance evidence](docs/agents/Issue_3_Design_System_Evidence.md)
for the actual shadcn preset, generator comparison and component-add procedure.

## Design-system preview

Run `pnpm dev:web`, then open
[the development preview](http://127.0.0.1:3000/dev/design-system).
Its Tamil/English and light/dark switches are temporary developer controls.
The preview uses synthetic labels only, persists nothing, and returns 404 in
production. Change colours, typography, radii, density and motion in
`packages/ui/src/globals.css`; app CSS only imports that file.

~~~powershell
pnpm tokens
pnpm exec playwright install chromium
pnpm test:ui
~~~

Browser tests start and stop their own dev server on port 3103. Chromium must
be installed separately on each host; never copy browser or node_modules
binaries between Windows and Linux. Captures in
`docs/agents/design-system/captures` are review evidence, not cross-platform
pixel-perfect goldens. `pnpm verify` runs the non-browser checks; run
`pnpm test:ui` separately when controls or tokens change.

## Outstanding safeguards

GET /api/healthz proves process liveness only. Unknown API routes and unsupported
methods return a shared error. No business routes, Server Actions, auth UI,
business database tables or empty future packages are introduced.

Auth/membership, forced tenant RLS, idempotency/versioning/history, money,
transactional queueing, private media, privacy/recovery, CI and pilot workflows
are later tickets. Playwright/axe now covers the design-system preview.
Tenant PostgreSQL integration, Tamil PDF shaping/goldens and physical-device/real-IME
checks remain later gates; simulated browser input does not complete them.
No real customer data is permitted.

See [the acceptance evidence and compatibility decisions](docs/agents/Issue_2_Workspace_Evidence.md)
for exact generator options, version checks, limitations and rollback.
