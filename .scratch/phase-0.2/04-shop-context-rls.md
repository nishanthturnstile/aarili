# [W0 0.2.2] Enforce transaction-local shop context and prove forced RLS

**Status:** Draft awaiting owner approval. Proposed publication label: `ready-for-agent`.

**Wave / phase / source slice:** Wave 0 → Phase 0.2 — Protect Identity, Tenancy and Business Commands → 0.2.2 — Enforce Shop Context and Forced RLS.

## What to build

An authenticated owner request resolves its own membership and performs every tenant repository operation in one shop transaction. A real two-shop PostgreSQL suite proves that missing context, guessed IDs, foreign-shop links, connection reuse and failed transactions cannot expose or modify another shop. CI prevents new tenant tables from landing without forced policies.

## Blocked by

- Proposed **0.2.1c — Link allow-listed Google identity without opening signup**, completing the roadmap's mandatory 0.2.1 prerequisite. Its earlier bootstrap supplies the protected initial shop/membership; extend those records rather than rebuilding them. Replace with the published issue/native blocker.

## Sources and expected outcome

- [Roadmap](https://github.com/nishanthturnstile/aarili/blob/main/docs/Boutique_Business_Management_Implementation_Roadmap.md): 0.2.2 and architecture traceability §9.
- [Product plan](https://github.com/nishanthturnstile/aarili/blob/main/docs/Boutique_Business_Management_Final_Product_Plan.md): §4; TRU-01; AC-38; §§29.1, 30.1 and 33. AC-38 is proved with synthetic shops now and repeated on all later indirect paths before second-boutique use. BIZ-03 switching UI and TRU-02 shared-role behavior remain Phase 2.
- [Architecture](https://github.com/nishanthturnstile/aarili/blob/main/docs/Architecture_and_Technology_Decisions.md): §§6.1–6.4, 8.1–8.2, 11.2, 11.4, 12.4 and 15.1–15.2.

## Scope

Harden and finish the shared `withShop()` boundary, own-membership bootstrap policies, runtime role/grant validation, tenant schema conventions, CI catalog inspection and reusable synthetic fixtures. An authenticated operational read path and fixture parent/child writes verify the whole auth → API → core → repository → PostgreSQL path; no product shop-switcher or business UI is needed.

Reuse existing `app_owner`/`app_user`, PostgreSQL image/extensions, health path, Testcontainers lifecycle, boundary checker and CI jobs. Add backup/privacy role definitions and privilege checks in disposable/local provisioning as needed; backup/erasure execution and external credentials remain later phases. Role creation that exceeds `app_owner` privileges stays in explicitly privileged provisioning, never an ordinary request or hidden migration credential.

Out of scope: second live boutique onboarding, invitations, staff/customer access, a flexible permission system, organization plugin, production backups/erasure functions, exports/search/media/AI features, queue setup, deployment and live data.

## Acceptance criteria

- [ ] **D1 — Authenticated membership bootstrap:** The server resolves the session, sets transaction-local user context and reads only that user's membership before setting shop/actor context. Supplied shop/actor/user headers cannot establish authority. No membership, revoked membership, malformed identifier or a foreign-shop request fails closed without revealing its records.
- [ ] **D2 — One transaction throughout:** `withShop()` sets user/shop/actor using transaction-local settings. All repositories and core operations receive that transaction, with no global/session-level context or independent nested connection. Core remains framework-free; API remains thin and Next-independent; server composition does not create a browser import leak or allow API/core to import database implementations contrary to the existing matrix.
- [ ] **D3 — Runtime privilege:** Ordinary auth/web/database operations use `app_user`, not owner/superuser/BYPASSRLS. Catalog/grant checks prove it neither owns tenant tables nor can assume migration, backup or privacy roles. `app_owner` owns/migrates; `app_backup` has only reviewed read/backup privileges with BYPASSRLS and no runtime credentials; `app_privacy` is unavailable to ordinary runtime pending narrowly audited functions. Local/disposable privileged role provisioning is explicit and separate.
- [ ] **D4 — Tenant constraints from the schema:** Every implemented tenant table, including child/fixture tables and the shop root as applicable, uses non-null tenant identifiers, composite tenant foreign keys and shop-led uniqueness/indexes. Own-membership policies retain their documented user-context exception. Direct cross-shop foreign-key inserts/updates fail at the database, even when a fixture exercises elevated setup privileges.
- [ ] **D5 — Forced read and write policies:** Every tenant table has ENABLE and FORCE RLS, matching `USING` and `WITH CHECK`, and narrow grants. Missing/empty user or shop context produces no tenant visibility; direct INSERT/UPDATE/DELETE cannot create, move or affect foreign-shop rows. An omitted shop filter in a controlled repository query is still isolated by RLS.
- [ ] **D6 — Two real shops:** Two independently authorized synthetic owners/shops prove permitted reads/writes in their own shop and denied list/by-ID/parent-child/update/delete access to the other. Check both directions, guessed IDs, arbitrary membership grants and forged actor context. Add a registry/checklist for all implemented repositories and repeatable coverage when later search/export/media/job/AI paths arrive; absent features receive no pretend passing test.
- [ ] **D7 — Pool reuse, switching and failure:** A pool constrained to reuse the same physical connection proves shop A → no context → shop B isolation after commit and after rollback. Missing/empty context, callback failure, timeout and concurrent transactions leave no leaked settings or partial changes. Server-side authorized switching in fixtures works; no production multi-shop UI is added.
- [ ] **D8 — CI rejects policy drift:** Real PostgreSQL catalog inspection discovers tenant tables and verifies forced policies plus effective read/write coverage; unexpected non-RLS tables fail except the documented, explicitly enumerated auth/identity and future pg-boss exceptions. Removing FORCE or a write check in an isolated migrated fixture makes the gate fail; restore the valid fixture. Do not replace this with a source-text search.
- [ ] **D9 — Migration and local reuse:** Reviewed SQL, grants and policies apply under migration/advisory locking to a clean fixture and to retained synthetic schema from 0.2.1. Existing development volumes require explicit upgrades rather than destructive reset. Health readiness, cleanup, Windows path-with-spaces behavior and Linux CI remain valid.

## Research and decisions during implementation

The role/policy model and UUIDv7/tenant conventions are already decided. Exact grant SQL, the non-recursive own-membership policy, Drizzle transaction/repository types, bootstrap write confinement and catalog-query completeness are implementation details verified against current prescribed docs. No choice of tenancy model is reopened. If an existing auth/bootstrap table contradicts these rules, fix its narrow interface/migration here; seek approval for a material privilege or architecture change.

## Migration, isolation, history and recovery

Add constraints/policies without weakening bootstrap protections. Preserve owner identity, membership and completion provenance; runtime cannot remove attribution by altering another shop's records. Privileged fixtures are setup-only and never count as runtime RLS evidence. Auth identities remain the documented exception behind auth; the pg-boss exception is documented but no queue schema is created here. Backups, privacy functions and production recovery activate in their later slices. Rollback requires a compatible schema, never removing RLS to make an older app work.

## Verification and completion evidence

Run actual `pnpm verify`, `pnpm test:ui` and `pnpm audit --audit-level low`. Real Testcontainers PostgreSQL on native Windows and Linux must prove D1–D9, including negative, concurrency, rollback and connection-reuse cases as `app_user`; mocks cannot establish isolation. Keep browser smoke/axe for existing auth screens; no invented infrastructure screen is required. Extend the existing required CI jobs, record acceptance coverage and checks not run, and verify integrated main after owner-authorised merge. Work in the existing checkout on a focused `codex/` branch. No second live shop or pilot release is authorized.
