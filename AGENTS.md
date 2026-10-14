# Aarili agent instructions

Wave 0 Phase 0.1 and 0.2 implementation tickets (#2–#6 and #12–#16) are approved
and merged. The [foundation closeout](docs/agents/Phase_0_Closeout_Acceptance.md)
records validation and remaining activation gates. Implement only a selected
approved issue when requested and after its direct blockers have merged.
Phase 0.3 and later retain concrete draft, review and publication approval.

## Sources and scope

- Read [Product Plan](docs/Boutique_Business_Management_Final_Product_Plan.md) and [Architecture Decisions](docs/Architecture_and_Technology_Decisions.md) before changing a capability. The product plan wins on behaviour and release scope; the architecture wins on technology and constraints. Report conflicts; do not silently revise either baseline.
- Product §§29.1 and 30.1 define committed Phase 1 Must/Should scope and scenario applicability. §§27, 32 and 33 define gates and readiness. The [roadmap](docs/Boutique_Business_Management_Implementation_Roadmap.md) derives from these sources and cannot override them. Later release allocation is provisional; optional extensions in §31 require a separate decision.
- Phase 1 is owner-only, online-only, non-tax billing, manual WhatsApp sharing and manual/external patterns. No retail, AI, customer access, automated messages or pattern engine. Business rates, tolerances and policies need the approvals in product §32; never invent them.

## Architecture and boundaries

- Follow architecture §§6.1–6.4: pnpm/Turborepo modular monolith, one PostgreSQL database, Next.js web and a worker from the same code. Create packages only for real build/runtime boundaries; module folders live within `core` and `db`.
- `core` contains framework-free business commands, queries and policies; it may use `contracts`, `money`, `i18n` and database repository interfaces, never Next.js, Hono, React or vendor SDKs. Database implementations stay behind those interfaces.
- `api` depends on `core`, `contracts`, `auth`, `platform`; never Next.js. Browser code imports only contracts, UI, i18n and typed module clients, never core, database, server auth or secrets. Worker handlers reuse core policies and tenant transactions. Enforce restricted imports in CI.
- All business mutations use Hono in a Node-runtime Next.js route. No business Server Actions. Handlers validate and authorise, call core, and map results; business rules do not live in route files or UI.

## Technology conventions

- Follow architecture §§4–5; pin Node 24 LTS, TypeScript 7.0.2 strict (the recorded owner-approved workspace correction), pnpm `packageManager` and exact dependencies in `pnpm-lock.yaml`. Preserve the documented declaration/typed-route compatibility corrections; propose any new baseline correction before adoption. Install P2/P3 packages only with their features.
- Use Hono + `@hono/zod-openapi`, Zod 4 (separate draft/command schemas), Drizzle SQL-style queries + `pg`, pg-boss 12, Better Auth, TanStack Query 5/Table 9, React Hook Form, nuqs and next-intl as specified. shadcn uses Base UI only, Tailwind v4 CSS-first; never mix Radix or add vaul.
- Use pinned Biome and committed `biome.json`, Knip and TypeScript checks. Respect this tooling; do not add overlapping formatters. No Redis, microservices, event sourcing, separate API service or Better Auth organization plugin.
- Logged-in UI is client-rendered through typed API clients. Test Tamil/English, phone/tablet/desktop, self-hosted Tamil fonts, accessibility and printer-free PDF sharing (architecture §§7, 9). No cached business data in service workers, browser storage or URLs. Query cache is memory-only and cleared on sign-out/shop switch.
- For library-specific syntax, setup or debugging, resolve and fetch current docs with `npx ctx7@latest library` then `docs`; at most three commands per question. Do not include secrets. Report quota/network failures; never substitute remembered API details. Refactoring, business-logic review and general concepts do not need documentation lookup.

## Shop isolation and access

- Architecture §§8.1–8.2, 11: every tenant table has non-null `shop_id`, composite tenant foreign keys and shop-led indexes/uniqueness. Enable and FORCE RLS with matching read/write policies. Missing context fails closed.
- Runtime is `app_user`, never table owner, superuser or BYPASSRLS. Check the user's own membership, then set user/shop/actor transaction-local context through `withShop()`. Every repository operation uses that transaction, including jobs, search, exports, PDFs and later AI. Never trust a supplied shop ID without membership checks.
- Auth identities/Better Auth and pg-boss are explicit exceptions accessed only through their packages. Migration, backup and privacy credentials never enter ordinary runtime paths. Roles supplement RLS; before shared access enforce product §4/TRU-02.
- Private media uses shop-prefixed immutable keys; authorise its row before issuing signed links. Payer, wearer and guardian are distinct. Guardian consent precedes minor measurements/photos; minor and private fitting images cannot be published.

## Integrity and history

- Architecture §§8.3–8.5: money uses integer paise, PostgreSQL bigint and safe exact arithmetic/serialization; fabric uses integer millimetres. Empty amounts/measurements stay unknown. Use the balanced posting journal; derive balances, never edit them.
- FIN-05 allocation floors proportional shares to whole rupees; all remaining rupees AND paise go to the largest-charge line, earliest if tied. Zero total charge leaves unallocated credit. Lock sources, forbid over-allocation, require reasons for reallocation, and use adjustments after issue. Enforce per-shop UTR uniqueness where supplied.
- Every business command has an idempotency key bound to actor/action/request hash. Same request replays its result; changed payload fails. Commit key, business change, audit and jobs together. Editable records require ETag/If-Match: 428 missing, 412 stale, 409 domain conflict, 422 validation. Never auto-merge measurements, money, stock, custody or approvals.
- Preserve immutable measurement/design/document versions, explicit order references, issued PDF hashes/fonts/templates, original promises and transition history. Money, stock and custody corrections append linked events; numbers are locked at issue and never reused. Keep progress, assignment, approval, money, custody and handover separate (product §27).
- Immutable history does not prevent legitimate erasure: only audited privacy functions may redact personal values, keeping required provenance and tombstones. Enforce retention across media, exports, backups and processors (architecture §§8.3, 11.5).
- Follow architecture §§10–13: idempotent jobs re-read current state; restore kill switch, restore epoch/job quarantine and money freeze prevent repeated effects. No live data before the restore drill, approved privacy/configuration and pilot gates. Dev is synthetic-only; no live restore into dev.

## Verification and traceability

- Each slice links product requirement IDs, acceptance scenarios, architecture sections, dependencies and activation decisions. Update roadmap traceability when scope changes; test names should expose the relevant IDs. Claims require fresh command output and a requirement-by-requirement check.
- Run relevant unit/property tests (Vitest/fast-check), real PostgreSQL integration tests (Testcontainers), and Playwright/axe workflows. Financial/isolation/history changes require negative, concurrency, retry and failure tests; mocks cannot prove RLS or transactional queueing. CI checks every tenant table for forced policies (architecture §15).
- Before completion run the repository's actual lint, Knip, typecheck, relevant tests and production build; report failures and checks not run. Do not claim commands exist before scaffolding. All pilot workflows need three screen sizes, Tamil PDF golden checks, search recall, real-device review and recovery evidence per architecture §15 and product §33.

## GitHub workflow

- Track work in `nishanthturnstile/aarili` GitHub Issues through the authenticated `gh` CLI; see [tracker configuration](docs/agents/issue-tracker.md), including label vocabulary and native blockers. After roadmap approval, use the installed `to-tickets` skill phase by phase; each issue carries stable slice ID, sources, scope, prerequisites, verification and acceptance. Present its ticket breakdown for approval before publication. Do not create issues during this planning review.
- Use one local checkout at the owner's existing Aarili workspace. Do not create, restore or use Git worktrees or additional feature checkouts. Work sequentially on focused `codex/<slice-or-topic>` branches in that checkout; push each implementation branch to GitHub and review through its PR. Preserve unrelated edits and existing branches. Disposable CLI-generator and verification directories are allowed only for their scoped checks and are not development workspaces.
- Follow [the development workflow](docs/agents/Development_Workflow.md). Verify direct blockers are merged before starting an issue; after an approved merge, update the same checkout's main branch and run the integrated checks before branching for the next issue. PRs link the issue/slice, explain behaviour and risks, list verification evidence, migrations/recovery and traceability changes. Review immutable-history and isolation consequences explicitly.
- Require CI and owner review before merge; no direct main pushes, automatic production promotion or destructive migrations. Use reviewed SQL migrations with advisory locking and expand/migrate/contract; never `drizzle-kit push` in prod. Back up before schema/money migrations; rollback only with compatible schema (architecture §12.4).
- Never commit secrets or real customer data. Do not publish, send messages, change GitHub settings or deploy without applicable user authorisation. Do not install skills/tools merely because available; project baselines take precedence over generic skill recipes.
