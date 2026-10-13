# Aarili

Boutique management portal, currently an operational scaffold for
[issue #2](https://github.com/nishanthturnstile/aarili/issues/2) / slice 0.1.1a.
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

No credentials are required. The .env.example files contain only NODE_ENV.
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
Windows dependencies and generated outputs. No Compose project, container
database or cloud resources are provisioned here. Unrelated local infrastructure
and port 5432 are untouched.

## Boundaries and outstanding safeguards

apps/web mounts packages/api in one Node runtime route. packages/contracts
owns Zod-derived health/error DTOs; api/client exports the browser-safe typed
Hono client. packages/platform owns server-only environment validation.
packages/ui owns the canonical minimal globals.css; custom tokens, Tamil
fonts, Tailwind and Base UI components/presets belong to issue #3.

GET /api/healthz proves process liveness only. Unknown API routes and unsupported
methods return a shared error. No business routes, Server Actions, auth UI,
database schema or empty future packages are introduced.

Auth/membership, forced tenant RLS, idempotency/versioning/history, money,
transactional queueing, private media, privacy/recovery, CI and pilot workflows
are later tickets. PostgreSQL integration, Playwright/axe, Tamil PDF and real
device checks are not applicable to this boot-only increment and are not
claimed. No real customer data is permitted.

See [the acceptance evidence and compatibility decisions](docs/agents/Issue_2_Workspace_Evidence.md)
for exact generator options, version checks, limitations and rollback.
