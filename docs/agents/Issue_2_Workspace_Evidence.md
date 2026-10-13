# Issue #2 — workspace implementation evidence

Source slice 0.1.1a; architecture §§4–6, 11.4, 12.3.1–12.4.
USE-01/08/09 are foundation references; no product acceptance scenario is
completed by this operational bootstrap. No business scope is changed.

## Compatibility decisions recorded before adoption

- Node 24.21.0 LTS, pnpm 12.11.2, TypeScript 7.0.2, Next 16.4.0,
  React/DOM 19.3.0, Turbo 2.11.7 were verified against registry metadata.
  Next's current documentation confirms project-local native CLI checking.
  No preview compiler, compiler downgrade or ignoreBuildErrors is used.
- Zod metadata advertised 4.6.7, but a real pnpm install rejected that version
  and reported 4.6.6 as the available stable release. Use exact 4.6.6 pending
  consistent registry availability. This changes no required major or API.
- Reproduction with skipLibCheck=false and typedRoutes=true: Next 16.4.0
  generates link.d.ts return types using global JSX.Element; React 19.3.0
  exposes the element through React.JSX.Element. Retain typed routes and
  declaration checking with one exact type alias in next-jsx-compat.d.ts.
  It does not add permissive intrinsic elements, any or ignored diagnostics.
  Remove when the pinned generator uses React.JSX.Element. ES2024 library
  definitions supply PromiseWithResolvers, required by Next declarations and
  supported by the pinned Node runtime; emitted target remains ES2022.
- Native compiler incremental state retained stale diagnostics after adding
  the compatibility type/library. Re-running with --incremental false passes;
  web incremental checking is disabled so each invocation checks fresh source.
  This disables a cache, not any type or declaration check.
- A real dev-then-check cycle reproduced duplicate typed-route globals when
  native tsc reads both .next/dev/types and .next/types. Next's documented
  alternate tsconfigPath separates dev and build checks: both check the same
  complete source with strict declarations, but include one authoritative
  generated route set. next typegen selects the production configuration.
  next-env.d.ts is generated/ignored, as Next recommends.
- Base UI 1.9.0 peers accept React 19; Table 9.3.1 is stable and requires
  React >=18. Neither is installed before the design-system/table features.
- pnpm added exact minimum-release-age exceptions for Vitest 5.0.4 and its
  matching mocker/spy during install. These stable versions are explicitly
  pinned and tested here; no blanket age-policy disable is used.

## Official generator composition

Generate outside the repository under a fresh temporary directory:

~~~powershell
npx create-turbo@2.11.7 "<temporary-directory>/turbo" --package-manager pnpm --skip-install --no-git
npx create-next-app@16.4.0 "<temporary-directory>/web" --ts --app --src-dir --empty --biome --no-tailwind --no-react-compiler --no-cache-components --use-pnpm --skip-install --disable-git --no-agents-md --no-agent-feedback --import-alias '@/*' --yes
~~~

Both pinned CLIs' help was read before generation. The Turbo template supplies
the workspace globs/task structure; the separate Next template supplies the
minimal App Router/layout/tsconfig shape. No generators run over the existing
checkout or one another. The outputs were read and adapted into the repository.
Discarded: duplicate docs/web template apps, template UI components, ESLint and
Prettier packages, caret dependencies, broad TypeScript 5 defaults, generated
branding, and skipLibCheck. Retained: pnpm layout, Turbo dependency ordering,
App Router and Biome. shadcn/Tailwind onboarding and Base UI preset refinement
belong to issue #3; no visual preset was selected in this increment.

## Verification

Initial Windows verification ran from an isolated native worktree whose full
path contains spaces; the original checkout's in-progress documents were
preserved. The owner subsequently selected a single-checkout/branches-only
workflow. That worktree was archived after its commit was pushed; the existing
checkout now holds the issue branch. Frozen install and complete verification
were also run in the original native project path. Future implementations must
follow Development_Workflow.md and must not create or use worktrees.
Git lists only the original checkout. The archive retained files in its former
directory; automatic approval review blocked recursive deletion of that
unregistered directory. This leftover is not an active Git worktree.
Linux verification installs its own dependencies in Docker Desktop's Linux
engine and never mounts or copies Windows node_modules.

The integrated main documentation predates the owner's 13 October instructions
and still names TypeScript 6/planning approval. The explicit issue and supplied
AGENTS.md supersede that stale text for this implementation. Existing owner
documentation edits in the original checkout are not included in this PR.

| Issue acceptance criterion | Command or evidence |
| --- | --- |
| Exact supported pins, no RC or silent major change | Registry engines/peers checks; packageManager/engines and exact manifests/lockfile; compatibility decisions above |
| Clean frozen native Windows install, paths with spaces | pnpm verify:clean: fresh temporary directory, frozen install, complete verification, unchanged lockfile |
| Actual web and worker boot/shutdown; no premature endpoint | pnpm smoke: standalone server, HTML/client asset, typed /api/healthz, 404 /api/orders, compiled worker and graceful IPC stop |
| Lint, Knip, types and builds on both platforms | pnpm verify; Dockerfile.verify runs the same checks after a Linux frozen install |
| Browser/core/API boundaries and negative enforcement | pnpm boundaries plus five negative/positive AST graph tests for framework/vendor imports, aliases/re-exports, require, relative bypass, computed imports, server types and env access |
| Placeholders, secret/config isolation, safe build contexts | Environment validation tests; private synthetic canary build + check-artifacts; explicit Docker COPY paths and .dockerignore |
| Scoped LF and Linux executable handling | .gitattributes targets new code/config only; negative type runner is a Git executable with a Node shebang; Docker chmod and direct execution check |
| Commands and future safeguards documented | README lists actual package scripts and explicit outstanding safeguards |
| Official scaffold reproducibility/default review | Pinned commands/help/template review above; no generated ESLint, Prettier, Radix, vaul, duplicate apps or future template packages |
| Native TypeScript 7 strict/declarations/Next/worker/tool integrations | pnpm typecheck/build on Windows and Linux, skipLibCheck=false; local compiler reports Version 7.0.2 |
| Shared Zod-derived DTO/error shapes and Hono client declarations | Runtime contracts + OpenAPI tests; negative compiler rejects unsupported method, excess response field and invalid status/service values |

The applicable suite has ten passing tests; the negative compilation check
requires all four expected diagnostics. Tests are synthetic and operational.
Production smoke verifies no business endpoint was accidentally introduced.
Native pnpm dev also booted both processes, returned 200 for the page/health
route and 404 for POST health; Ctrl+C produced the worker's stopped message.
Production dependency audit reported no known vulnerabilities.

No PostgreSQL/Testcontainers, Playwright/axe, PDF/font/device, queue, restore or
pilot scenario is claimed: their features are absent and belong to later tickets.
No CI/settings are created in this issue; issue #6 owns the actual CI workflow.

## Integrity, isolation and recovery

No database, auth identities, tenant records, business mutation, money,
custody, history, jobs or external side effects exist here. Health is process
liveness only. No migration/rollback operation is necessary; revert the code
commit to recover the previous planning-only repository.
RLS, authorisation, transactions, idempotency, audit history, queue consumers,
privacy and restore gates remain later slices and block live-data use.
