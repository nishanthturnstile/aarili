# Aarili Phase 0.2 draft ticket review

Five proposed implementation issues cover Wave 0 → Phase 0.2 — Protect Identity, Tenancy and Business Commands. Phase 0.1 is merged and current integrated main has passing hosted verification and activated required checks. These are local drafts for owner review, not published or approved issues. No application implementation, repository setting change or external activation is included.

## Phase 0.1 readiness on 13 October 2026

Read through the authenticated `gh` CLI: full issues #2–#6, comments, linked closing PRs #7–#11, PR bodies/reviews/checks, current main, hosted logs and branch-protection configuration. All five issues are CLOSED/completed; all linked PRs are MERGED. Earlier PRs predate the CI ticket and appropriately carry local Windows/Linux evidence rather than fabricated historical CI checks. No issue comments add outstanding acceptance work. No submitted GitHub approving reviews are present; zero required reviews is the documented solo-owner configuration, with deliberate owner merge remaining the review checkpoint.

| Approved issue | Closing PR | Merged main commit | Evidence |
|---|---|---|---|
| [#2 Workspace](https://github.com/nishanthturnstile/aarili/issues/2) | [#7](https://github.com/nishanthturnstile/aarili/pull/7) | `ac2b456` | Workspace evidence, compatibility decisions, Windows/Linux frozen install/build and negative boundaries/types |
| [#3 Design system](https://github.com/nishanthturnstile/aarili/issues/3) | [#8](https://github.com/nishanthturnstile/aarili/pull/8) | `46a812d` | Base UI/preset provenance, shared CSS/fonts, three-size/language/theme accessibility checks |
| [#4 Local infrastructure](https://github.com/nishanthturnstile/aarili/issues/4) | [#9](https://github.com/nishanthturnstile/aarili/pull/9) | `cf1da74` | Dedicated PostgreSQL/Garage, extensions/runtime roles, persistence and resource isolation |
| [#5 Database health](https://github.com/nishanthturnstile/aarili/issues/5) | [#10](https://github.com/nishanthturnstile/aarili/pull/10) | `ce7ddb8` | Typed Next/Hono/pg path, real Testcontainers on Windows/Linux, 24 browser cases |
| [#6 CI and protection](https://github.com/nishanthturnstile/aarili/issues/6) | [#11](https://github.com/nishanthturnstile/aarili/pull/11) | `46872a0` | Real failed/passing hosted gate demonstrations, required-check read-back, dependency policy |

Local HEAD, origin/main and authenticated remote main all match `46872a0a2be46fe07bfa092a62f2130e15f18e86`. The [integrated-main run](https://github.com/nishanthturnstile/aarili/actions/runs/38365710101) completed successfully at that exact commit:

- [Scaffold verification](https://github.com/nishanthturnstile/aarili/actions/runs/38365710101/job/115190215625): actual lint/boundaries/tokens, Knip, strict typechecks, unit/negative/real PostgreSQL tests, production builds/smoke and private-canary artifact checks.
- [Browser smoke and accessibility](https://github.com/nishanthturnstile/aarili/actions/runs/38365710101/job/115190215889): 24 passing cases and disposable database cleanup.
- [Dependency audit](https://github.com/nishanthturnstile/aarili/actions/runs/38365710101/job/115190215956): no known vulnerabilities at the run.

Fresh protection read-back requires these exact three contexts from GitHub Actions App ID 15368, with `strict: true` for up-to-date branches. Administrator enforcement, PRs, resolved conversations and linear history remain enabled; force pushes and deletion remain disabled. PR #11's final push and PR checks are successful. Its recorded negative regression run failed the real scaffold/browser gates before restoration.

Fresh native Windows `pnpm verify` also exited 0: 29 unit/scaffold tests, three real PostgreSQL tests, negative compiler checks, lint/Knip/typechecks, production build, real readiness/outage/worker-shutdown smoke and browser artifact inspection. `pnpm test:ui` exited 1 before browser cases began because the owner's existing Next dev server (PID 2348, port 3000) holds the checkout's dev lock. The runner's separate disposable database was cleaned. The server was left intact; no fresh local browser pass is claimed. The successful hosted-main browser result remains independent evidence.

**Outstanding prerequisite:** confirm/install the hosted Renovate App for Aarili and verify onboarding/a real bot run. This is the explicit external activation gap permitted by issue #6, not an open direct Phase 0.2 implementation blocker. Daily audit and exact required checks are actual configured workflows; a green config is not proof of bot activation. Live data, physical devices, Tamil PDF, restore and pilot gates remain later requirements.

## Sources and existing implementation

Precedence remains product behavior/release scope → architecture technology/constraints → derived roadmap. Follow AGENTS.md, issue-tracker and Development_Workflow. The scoped source slices are 0.2.1–0.2.3 only; 0.3.2 is referenced solely as a later activation dependency.

The implemented base already contains the Node 24.21.0/pnpm 12.11.2/Turborepo workspace, TypeScript 7.0.2, exact Hono/Zod/Next/React dependencies, compiled contracts/client declarations, runtime health schemas, in-memory Query health UI, canonical Base UI/Tailwind tokens/fonts, AST import enforcement, negative types, database fixture and actual CI jobs. Local PostgreSQL already provisions distinct `app_owner`/`app_user` and required extensions. Auth, application tenant tables, Drizzle migrations, core business services, forced RLS, command idempotency and audit do not yet exist.

**Approved baseline discrepancy:** architecture/roadmap/AGENTS text still names TypeScript 6.x; issue #2's explicit owner update selected 7.0.2, and merged issues #3–#6 retain it with compatibility evidence. Preserve the approved implemented compiler and exact Next/React declaration fixes. Do not downgrade or edit the baselines during ticket drafting. Reconciliation of stale text can be proposed separately if desired. Registry metadata/pins that differ within the approved compatible major are recorded in merged evidence; no repeat scaffolding, new formatter or speculative dependency installation is proposed.

## Decision and research readiness

| Classification | Finding | Treatment |
|---|---|---|
| Already decided | Owner-only Phase 1; verified email/password plus explicitly linked, allow-listed Google; closed public/implicit signup/linking; database sessions and recent authentication | Follow architecture §§6.5/11.1–11.2. No research ticket to choose another auth method or organization plugin. |
| Already decided | Exact origins, Secure/HttpOnly/SameSite=Lax cookies, CSRF/origin checks, database rate limits, no Redis | Build and prove them in owner-auth tickets; no inferred production wildcard or general security exception. |
| Already decided | Forced RLS from the first tenant table; own-membership bootstrap; application authorization plus `withShop()`; separate runtime/migration/backup/privacy roles | Bootstrap needs minimum tenant protection immediately. 0.2.2 extends and proves it comprehensively; no temporary unprotected shop schema. |
| Already decided | Framework-free core, thin Hono handlers, one transaction; 428/412/409/422, actor/action/hash-bound keys, 30-day lifetime, append-only audit and finalized history | One bounded synthetic command proves the contract. Full business capabilities remain later. Changed idempotency binding is 422 under architecture §8.5. |
| Already decided | No real auth sends before 0.3.2 suppression guards; production domain/OAuth/email DNS are activation prerequisites | Local synthetic capture only. No durable worker, external-effect ledger or outbound activation is moved into 0.2. |
| Implementation detail | Bootstrap serialization and resumable pending verification; schema/grants; private provisioner; repository transaction types; safe callback checks | Keep complete admission/resume invariants, exact pinned APIs and failure tests in 0.2.1a. No owner choice is needed to select a lock primitive or transaction type. |
| Implementation detail | Request canonicalization, locking/replay ordering, ETag parser, catalog gate completeness, missing-key/common auth error codes | Decide during implementation with negative/concurrency tests. Preserve the decided HTTP mappings and avoid cross-shop disclosure. |
| Research required before decomposition, completed | Can the prescribed Better Auth release support closed ordinary signup, explicit-only Google linking and database transaction wiring? | Context7 resolve plus two focused docs requests; official tagged 1.7.7 source and exact registry metadata checked. Controls/transaction support exist; no library/architecture substitution is needed to define scope. Evidence and alternatives below. |
| Research required during implementation | Exact private provisioning and shared-transaction integration, callback-time eligibility/revocation, reset-token consumption and freshness semantics on pinned releases | Bounded work inside the owning issue. Integration behavior still needs an executable proof; docs/metadata are not runtime compatibility evidence. Escalate a reproduced incompatibility before changing architecture or enabling another plugin. |
| Owner decision required during implementation | Concrete strong-password policy; session renewal/lifetime, reset-token lifetime, recent-authentication window and rate-limit thresholds | The requirement for these controls is approved; numerical settings are not. Present concrete configuration for owner approval before finalizing those values. Scope/dependencies do not depend on which safe durations are selected. Synthetic fixture values do not become live policy. |
| Owner decision required before external activation | Production domain/origins, approved owner Google identity/allow-list, environment-specific OAuth client, email sender/DNS and sealed credentials | Later authorized activation, after its stated prerequisites. No domain purchase, provider setup or external service change in this request. |

No unresolved decision changes the proposed ticket scope or dependency graph. Numerical policy and real service activation remain explicit approval points within their owning work; ticket publication must not silently approve them.

## Official research evidence and trade-offs

Context7 returned `/better-auth/better-auth`; the indexed version list did not contain 1.7.7, so the exact official release source was also read. Registry metadata confirms Better Auth 1.7.7 accepts the existing Next 16/React 19/pg 8 line and the prescribed Drizzle ORM 0.45.4/Kit 0.31.11 line. This establishes availability/peer compatibility only; the first ticket must still pass strict TypeScript 7/runtime integration tests.

- [Pinned options](https://github.com/better-auth/better-auth/blob/v1.7.7/docs/content/docs/reference/options.mdx) distinguish closed signup from implicit linking; explicit linking remains possible with implicit linking disabled. Google verified-email and allow-list checks must be proved across real callback paths, not inferred from a trusted-provider flag.
- [Pinned Drizzle adapter source](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/drizzle-adapter/src/drizzle-adapter.ts) makes transaction support opt-in. Recommend explicitly bound database transactions and injected-failure verification; do not assume hooks are already enlisted in a surrounding application transaction.
- [Pinned signup source](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/better-auth/src/api/routes/sign-up.ts) rejects ordinary signup when disabled. Recommend a narrowly private auth-bound provisioner using library password handling, admission serialization and a resumable existing-identity completion flow. Temporarily enabling public signup or adding broad admin endpoints increases admission risk and conflicts with the chosen scope.
- [Pinned freshness type](https://github.com/better-auth/better-auth/blob/v1.7.7/packages/core/src/types/init-options.ts) has a default one-day freshness window and allows zero to consider sessions always fresh. Neither is silently treated as approved Aarili policy; the owner reviews the concrete recent-authentication configuration.

Sequencing alternatives: delaying shop creation until 0.2.2 leaves the first ticket's setup incomplete; introducing a shop now without RLS violates the source constraints. The recommended first ticket supplies minimum safe shop/membership protection, while 0.2.2 finishes the broad reusable isolation contract and catalog gate. This allocates an existing prerequisite to its earliest consumer and does not authorize a change to product behavior or the roadmap baseline.

## Proposed issues in execution order

1. **[W0 0.2.1a] Bootstrap one verified owner and the initial protected shop** — [exact draft](01-owner-bootstrap.md). Blocked by merged #6. Delivers protected admission, verification, sign-in, initial protected membership and restart-safe setup. Includes only the minimum tenancy work required by the first shop.
2. **[W0 0.2.1b] Recover owner access and enforce session re-authentication** — [exact draft](02-owner-recovery.md). Blocked by 0.2.1a. Delivers reset/logout/expiry/revocation and reusable sensitive-action freshness, with synthetic capture and accessible recovery flows.
3. **[W0 0.2.1c] Link allow-listed Google identity without opening signup** — [exact draft](03-explicit-google-linking.md). Blocked by 0.2.1b for verified identity and freshness. Delivers explicit linking and subsequent sign-in, proven callback denial, disconnect safety and deferred activation checklist.
4. **[W0 0.2.2] Enforce transaction-local shop context and prove forced RLS** — [exact draft](04-shop-context-rls.md). Blocked by 0.2.1c, preserving the roadmap prerequisite on completed 0.2.1. Delivers real two-shop/pool/failure isolation, tenant constraints/roles and a failing-on-drift CI catalog gate. Google is a roadmap sequencing prerequisite, not a technical requirement for SQL policies.
5. **[W0 0.2.3] Prove atomic idempotent commands, conflicts and protected history** — [exact draft](05-command-audit-conflicts.md). Blocked by 0.2.2. Delivers the bounded synthetic mutation with typed API/core/transaction path, replay/conflict semantics, attributable audit and database-enforced finalized history.

The first existing blocker #6 is merged. All later blockers are proposed unpublished issues and must merge before their dependants start. Only direct edges are needed; no redundant edge to every earlier issue and no phase/map issue is proposed. Publication order is the list above. 0.2.2/0.2.3 have executable operational outcomes rather than added product screens.

The suggested change to the original decomposition is splitting 0.2.1 into three focused sessions. Tenancy and the single synthetic command remain one bounded issue each. If the owner prefers smaller command work, split only around independently verifiable outcomes; avoid landing a live mutation before its retry/audit/history safeguards.

## Coverage of every Phase 0.2 outcome and verification criterion

Acceptance identifiers below refer to the exact draft checkboxes.

| Roadmap outcome or verification obligation | Owning ticket and criteria |
|---|---|
| Protected one-time owner setup, verified email/password, initial shop | 0.2.1a A1–A6 |
| Concurrent attempts admit one owner; setup flag closes permanently | 0.2.1a A2–A4 |
| Interrupted verification/setup is resumable without second account | 0.2.1a A3–A4 |
| Sign-in/session database authority, origins/cookies/CSRF/rate limits | 0.2.1a A6–A8; 0.2.1b B3–B5 |
| Logout, reset, expiry, recent authentication; negative/concurrent token handling | 0.2.1b B1–B6 |
| Closed public and implicit signup; explicit allow-listed verified Google linking | 0.2.1a A1; 0.2.1c C1–C5 |
| Environment-specific OAuth scopes/origins/redirects and secret protection | 0.2.1c C6–C7 |
| Synthetic local mail; no auth send before 0.3.2 guards | 0.2.1a A3; 0.2.1b B7; 0.2.1c C7 activation boundary |
| Membership first, authenticated user/shop/actor transaction-local context | 0.2.1a A5; 0.2.2 D1–D2 |
| Separate owner/user/backup/privacy roles and confined auth/job exceptions | 0.2.2 D3/D8 and migration/isolation notes |
| Non-null tenant keys, composite FKs, shop-led indexes/uniqueness, forced policies | 0.2.1a A5; 0.2.2 D4–D5; 0.2.3 E9 |
| Two shops, guessed IDs, cross-shop writes/links and missing/empty context | 0.2.2 D1/D4–D6; 0.2.3 E9 |
| Rollback, pool reuse, switching and concurrency | 0.2.2 D7; 0.2.3 E3/E5–E6/E9 |
| CI discovers all tenant tables and rejects missing FORCE/read/write policies | 0.2.2 D8; 0.2.3 E9 |
| Repeated isolation on future repositories/search/exports/media/jobs/AI | 0.2.2 D6 coverage registry; each later feature repeats its own real path |
| Thin routes, framework-free core, shared transaction and error shape | 0.2.3 E1–E2/E6 |
| ETag/version/If-Match and 428/412/409/422 with authorized stale state | 0.2.3 E2–E3 |
| Actor/action/request binding; replay, changed payload 422 and duplicate serialization | 0.2.3 E4–E5/E9 |
| Lost response/retry and atomic rollback with no partial audit/effect | 0.2.3 E5–E7 |
| Attributable minimal audit, no ordinary audit update/delete | 0.2.3 E7–E8 |
| Finalized history grants/triggers, linked corrections and privacy boundary | 0.2.3 E8–E9; full domain triggers/functions land with their business/privacy tables |
| OpenAPI generation and compiled per-module typed clients pass CI | 0.2.3 E2/E10 |
| 30-day key lifetime, transaction seam for later jobs | 0.2.3 E6/E10; real queue commit/rollback and scheduled purge execution later |
| Windows/Linux migration/checks, three-size Tamil/English auth accessibility | 0.2.1a A8, 0.2.1b B6, 0.2.1c C7; each issue's verification section |

This matrix does not claim completion of business AC-55 for real orders or AC-38 for features that do not exist. Their respective slices inherit and repeat the demonstrated foundation. The phase's generic command has no artificial UI. A test-only enlisted write proves transaction rollback, not a real durable queue; pg-boss proof remains 0.3.2.

## Deferred activation and later prerequisites

- **Real auth email:** owner authorization plus 0.3.2 shared kill switch, restore epoch/quarantine and practice suppression, approved production origin/domain, Resend setup and SPF/DKIM/DMARC. Prove a restored/disabled/practice state cannot send before activation. Phase 0.2 creates no send-capable shortcut or durable worker.
- **Real Google OAuth:** approved final production domain and allow-list, distinct environment clients, exact scopes/callbacks and sealed credentials; a separate authorized real-provider smoke. Synthetic callback tests do not activate the external service.
- **Scheduled idempotency cleanup and real transaction-enlisted jobs:** durable/retention implementation after 0.2.3. Protect durable domain uniqueness beyond the 30-day key lifetime. No real queue claim is made here.
- **Audited privacy redaction/tombstones/retention:** 0.5.2 and named privacy/domain slices. Current runtime is denied history editing; no blanket privacy role assumption or fictitious full erasure implementation.
- **Live customer data/pilot/second shop:** the product's policy, privacy, recovery drill and release gates; hosting/backup prerequisites; fixed role matrix before shared access. Two synthetic shops are tests, not approval for another boutique.
- **Renovate:** owner confirms App installation/repository access and verifies actual bot execution. This remains separate from issue publication.

## Publication after explicit approval

Publish only these approved bodies using authenticated `gh` with explicit repository, exact temporary UTF-8 body files and the existing `ready-for-agent` vocabulary. Publish in dependency order; retrieve numeric database IDs and establish supported native blocking edges, then re-read every issue/body/label/relationship. Native dependencies were read successfully for existing issues in this review. No parent/map issue or other-phase ticket is needed.

After verification, recommend 0.2.1a as the first executable frontier, because #6 and its prerequisites are merged. Publication approves the definitions only: wait for a request to implement that selected issue. No settings, deployment, services or implementation are authorized by ticket approval.

## Review requested

Is the five-ticket granularity appropriate, are these direct blocking relationships correct, and should any tickets be merged or split? In particular, confirm the minimum protected-shop prerequisite in 0.2.1a and the roadmap sequencing gate from completed 0.2.1 to 0.2.2. Explicit approval is required before publishing the proposed issues.
