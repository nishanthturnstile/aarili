# Issue 55 durable draft foundation evidence

Issue [#55](https://github.com/nishanthturnstile/aarili/issues/55), slice W0 0.4.2a.
Base: integrated main `27e3a4675cf89d2cc2ebed593bfa6becfbe9207b`.
Sources: product USE-03/04/08, ORD-08 foundation, AC-02/40/55; architecture
6.3-6.4, 7.3, 8.1-8.5 and 15; approved Phase 0.4 implementation plan.
Direct prerequisites #51 (PR #61) and #16 (PR #21) were merged before work.
The owner explicitly approved this issue's isolated managed worktree and branch.
No production deployment, merge, real data or external service is authorized.

## Delivered behavior and acceptance mapping

| Criterion | Implementation and evidence |
| --- | --- |
| E1 | Independent `contracts/request`, `core/request-binding`, `core/request-version`, `db/repositories/request` and `db/request-repository` remove exemplar types from production draft paths. Existing command imports re-export their established hash/version/header/actor APIs. Existing command unit and real-database suites exercise extraction regressions. |
| E2 | Typed PUT/GET/list/promote/abandon routes use `withOwnerDraft`, delegating to the verified owner/shop transaction. UUIDv7 identity, immutable workflow/schema/creator/creation time, lifecycle/version and trusted timestamps are persisted. The registry has separate incomplete and complete schemas. The test-only intake adapter preserves blank raw amounts/measurements and rejects promotion until complete, without coercion. |
| E3 | Shared `(shop,key)` advisory locking and actor/action/hash comparison precede current-row/version checks. A separate shop/draft lock also covers absent IDs, preventing blind initial replacement. Missing update precondition is 428, stale is 412 with authorized state/ETag, lifecycle conflict is 409, validation/changed binding is 422. Same-key replay recovers a committed result after a lost response. Real PostgreSQL covers identical-key saves, initial PUT races and competing edits. |
| E4 | Promotion locks the draft, runs registered current-state validation and promotion, verifies result origin, then persists lifecycle/audit/hook/key in one transaction. Required `verifyResult` checks current shop, result ID/type and originating draft. Real PostgreSQL verifies different-key promotion races, rollback after result/enlisted write/update/audit/key/private hook, retry, and a real pg-boss enqueue sharing the exact transaction ID. Failures after enqueue/audit/key roll the queued job back. No worker or external effect runs. |
| E5 | The disposable workflow reads locked current duplicate/authority rows. Duplicate candidates and missing current authority return 409; saved oldApproval=true does not grant authority, and the complete command drops it. No automatic merge exists. The production registry is empty; production rejects the fixture type and OpenAPI has no fixture workflow or dev route. |
| E6 | Resume lists return committed active drafts ordered by immutable creation timestamp/UUID, with a bounded keyset cursor. Editing an earlier row does not duplicate pagination entries. Promoted/abandoned drafts reject edits. SQL computes 30-day stale flags from trusted time; writes use trusted post-lock time and return persisted trigger timestamps. Explicit retention configuration defaults disabled with unapproved notice/deletion and no notice period. A privileged disposable synthetic notice/cleanup exercise demonstrates eligibility; runtime has no DELETE grant. |
| E7 | Reviewed migration 0011 has shop-led primary/index/unique keys, creator membership composite FK, enabled and forced RLS/read/write policies and a provenance/lifecycle trigger. The adapter's test-only result has a composite shop/draft FK; wrong-origin and foreign-shop result IDs reject and roll back their result/enlisted/queued writes. Catalog, cross-shop read/replay, missing context, direct terminal-row update and runtime deletion denials use actual app_user PostgreSQL. |
| E8 | Hono/OpenAPI and compiled typed clients expose the new generic boundary; five negative DTO/client uses and AST negative-import tests enforce it. Browser transport remains authenticated, memory-only and no-store, and rejects late old-identity responses. Specialized draft response parsing preserves HTTP status, current draft and validated version ETag in DraftRequestError for 428/412/409/422; identity generation is checked immediately after asynchronous body parsing, before exposing an error body. Current 401 and 403 SHOP_ACCESS_DENIED invalidate private state independently of ETag validity. Draft admission middleware skips unrelated shop-module routes so their rate limits remain independent. Unsafe draft requests enforce a technical 512 KiB transport-byte limit with Hono bodyLimit before JSON validation (413 INVALID_REQUEST), independently of the core 65,536-character canonical binding bound. Origin/rate checks run first. Streaming tests cover missing/chunked and understated lengths plus a valid Tamil roundtrip; this is not a business quota. `AuthConfiguration.draftInstrumentation` is a private transaction factory; `withOwnerDraft` invokes it on the verified transaction and hooks run after the durable audit ID exists. The factory's structural contract matches #54's SQL adapter, so integrating both attaches instrumentation without importing unmerged code. Production graph rejects the test-only draft queue fixture; browser artifact checks reject draft server symbols. |

## Commands and results

Focused development evidence:

- `pnpm build:packages`: nine package builds passed.
- `pnpm lint`: Biome, architecture boundaries and canonical token/assets checks passed.
- `pnpm knip`: passed.
- `pnpm exec tsc --noEmit -p tests/tsconfig.json`: passed.
- `pnpm exec vitest run tests/drafts.test.ts tests/drafts-boundary.test.mjs tests/command.test.ts`: 14 tests passed.
- `node scripts/check-negative-types.mjs`: existing checks and all five new negative draft uses passed.
- `node scripts/generate-openapi.mjs`: seven health/command/draft paths generated offline.
- `pnpm exec vitest run --config vitest.integration.config.ts tests/drafts.integration.test.mjs tests/command.integration.test.mjs tests/command-failure.integration.test.mjs tests/tenant-isolation.integration.test.mjs`: four files / 18 tests passed in 120.39 seconds, including all five latest draft integration tests and the existing command/failure/isolation regressions.

The coordinator subsequently ran `pnpm verify` on the frozen server/core/database
implementation: exit 0, 96 unit tests, 71 real PostgreSQL integration tests, lint,
Knip, strict types, negative checks, OpenAPI, production build, smoke and 29 browser
artifact scans. A later coordinator review found that the client must preserve
412/current-state envelopes rather than use the strict owner-only error parser.
The client-only correction changes no server/core/database code. After that fix,
`pnpm --filter @aarili/api build` and four focused unit files / 18 tests passed,
including status/current/ETag semantics, list responses without ETags, malformed
headers, auth invalidation and delayed old-identity error-body rejection.
A further client-only review preserved the server's legitimate initial conditional
PUT 412 response without current state or ETag; version/ETag matching remains
required when a 412 includes current state. The API package compiled and all five
focused draft-client tests passed after that final correction.

The coordinator reviewed the final client patch and completed the affected final
pipeline with exit 0 (`TEMP/aarili-issue55-client-final.log`): lint, Knip, strict
types, 101 unit tests across 25 files, negative contracts, production build
(11 tasks, 13.687 seconds), smoke, 29 browser artifact scans and dependency audit
(no known vulnerabilities). PostgreSQL was not repeated after this client-only
correction because all server/core/DB source remained identical to the successful
full verification above.

The actual cross-PR disposable composition check also completed with exit 0
(`TEMP/aarili-coordinator-composition.log`). It composed the real #54 private usage
writer/repository with #55 save/edit/promote using reviewed additive migrations,
and proved committed-action replay deduplication, shop isolation, atomic usage
rollback and recovery. The disposable PostgreSQL instance was cleaned. No
production workflow or external service was activated.

A later independent integration review found that owner middleware's broad shop
wildcard rejected the draft list's `limit`/`cursor` query before the draft handler
in the production `createApi(owner)` mount. The new exact-composition regression
first failed with 422 instead of 200. Owner admission now applies to owner/auth
routes and its single shop-read path; nested shop modules use their own rules.
The green regression preserves owner shop-read query rejection, unrelated-module
fallthrough and owner/draft origin protection. The real draft integration host
now uses the production owner-before-drafts mount. After this correction, the API
package compiled, five focused unit files / 20 tests passed, and all five actual
PostgreSQL draft tests passed in 25.79 seconds. The coordinator then completed
`TEMP/aarili-55-composition-fix-final.log` with exit 0: lint, Knip, strict types,
the composition regression plus owner contracts/query checks (eight tests across
three files), negative DTOs, OpenAPI, production build (11 tasks, 10.806 seconds),
smoke and 29 artifact scans. An independent agent re-review confirmed the finding
resolved and identified no additional actionable finding. Integration onto current
main and required CI remain separately controlled by the coordinator.

After #66 merged, the five-case real draft suite was strengthened to inject the
actual private usage writer through `AuthConfiguration.draftInstrumentation` and
delegate to the production `withOwnerDraft` context. A test-only WeakMap supplies
the same transaction solely for synthetic workflow registration; repository,
authorization and instrumentation composition stay real. The fifth case now
asserts real product-event save/promotion counts, replay deduplication, failure
after the usage INSERT rolling back business/audit/key/result changes, same-key
recovery, tenant B's zero count and exact audit-subject/time binding. On this
combined main/#55 tree, `pnpm install --frozen-lockfile` passed with no resolution
or lockfile changes (13 workspace projects, pnpm 12.11.2). `pnpm build:packages`
passed all nine package builds in 9.51 seconds; the focused real PostgreSQL draft
suite passed all five cases in 26.44 seconds. These checks preserve a durable CI
regression for actual auth/private-usage composition, rather than relying only
on the earlier external composition probe.

## Recovery, isolation and activation gates

Migration `0011_durable_drafts.sql` is additive and runs through the existing
migration advisory lock under app_owner. Back up before application. There is no
destructive down migration; compatible application rollback leaves draft history
and committed result links intact. app_user cannot delete drafts or modify
promoted/abandoned rows. Ordinary privacy-role access remains absent.

`result_type`/`result_id` are polymorphic linkage metadata. Every registered real
workflow must implement same-transaction current-state validation, `verifyResult`
shop/result/draft-origin verification, and its own composite tenant/draft FK on the
concrete domain result. It must enlist applicable business audit/jobs in this
transaction. The synthetic adapter tests this seam; it is never production-wired.
Wave 1 must repeat acceptance checks with actual customer/approval/order policies.

Production retention stays disabled until owner/privacy notice and deletion
policy approval and a reviewed privileged retention host exist. This slice does
not schedule deletion or invent a notice period. Synthetic cleanup uses only the
disposable administrator fixture, leaving audit/key provenance untouched.

Issue #56 owns draft UI, debounce/composition/uncertain-save presentation and
physical-device recovery UX. This backend slice stores no business data in
browser storage or URLs beyond opaque route identities; it adds no screen.
Physical Android/fluent Tamil/pilot/privacy/restore gates remain applicable before
live use. Owner review and CI are required before merge. No services are deployed.

## Documentation research

Current Context7 lookup resolved Zod to `/colinhacks/zod` and Hono middleware to
`/honojs/middleware`, then fetched strict-object/no-coercion schema and official
`@hono/zod-openapi` route/defaultHook/RPC documentation. A separate current Hono bodyLimit lookup verified maxSize/onError and streaming semantics before the transport guard was added. No package versions or
dependencies changed. The overlapping pure request hash helper and optional auth
instrumentation field are coordinated byte-identical additions across the three
independent PRs; subsequent merges must retain the union of additive exports,
OpenAPI, artifact and tenant-catalog expectations and rerun affected checks.

## Integrated-main review and merge authorization

The owner authorized sequential merges after re-review on 16 October 2026.
PR #64 merged as 6860c13 and PR #66 as a29c707. Their updated-main frozen installs,
production builds, smoke checks and 29-artifact scans passed before this branch
was reconciled. The resolution retains all additive exports and tenant/catalog
inventories, the identical request-binding helper once, the API final-response
observer together with draft routes, and the real auth usage factory together
with withOwnerDraft attachment. Migrations 0009, 0010 and 0011 remain distinct.
Independent review found no lost changes or additional actionable findings.

On the stable combined tree, the coordinator's aarili-65-integrated-final.log
exited 0: lint, Knip, strict types, 26 focused draft/client/owner/usage unit tests,
negative contracts, OpenAPI, four affected PostgreSQL session/catalog/bootstrap/
upgrade cases (10 unrelated cases skipped), production build (11 tasks, 12.644
seconds), smoke and the 29-artifact scan passed. The implementation agent's
captured tool output separately confirms the five strengthened real PostgreSQL
draft cases passed in 26.44 seconds after frozen installation and nine package
builds; these commands retained output in its tool transcript, not a local log.
No full local browser suite was rerun. Required CI must pass on the reconciled
head before the authorized squash merge; activation/privacy/pilot gates remain.
