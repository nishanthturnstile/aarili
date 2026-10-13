# Issue #12 — owner bootstrap evidence

Wave 0, 0.2.1a. Product §4 and TRU-01, BIZ-01 foundation, USE-01/02/09;
architecture §§5.1, 6.2, 6.4–6.5, 8.1–8.2, 11.1–11.2, 11.4, 12.4, 15;
roadmap 0.2.1 and the first-tenant-table prerequisite in 0.2.2. AC-38 receives
initial two-shop isolation evidence, not completion of the later access matrix.

## Starting state and approvals

Issue #12 was open, ready-for-agent, with no comments and one native blocker,
#6. PR #11 merged that blocker on 13 October 2026 as
`46872a0a2be46fe07bfa092a62f2130e15f18e86`. Its main workflow
[38365710101](https://github.com/nishanthturnstile/aarili/actions/runs/38365710101)
passed. Protection read-back required the three existing names with strict
up-to-date branches: Scaffold verification, Browser smoke and accessibility,
Dependency audit. Local main matched origin and passed `pnpm verify` before
branching. The existing `.scratch/` was preserved; no other local main edits
or commits were present to include. Work uses the sole existing checkout on
`codex/w0-0.2.1a-owner-bootstrap`, with no worktrees or additional checkouts.

The owner approved the concrete password/session/rate policy and declaration
compatibility correction in this chat. See the
[runbook](Owner_Bootstrap_Runbook.md) for configuration, recovery, isolation,
history and activation details. The earlier approved TypeScript 7.0.2 decision
is retained; no architecture or product baseline was silently rewritten.

## Exact compatibility and current-source research

Context7 CLI resolved each library before fetching focused docs for Better
Auth's private credential provisioning/transactions and verification/limiting,
Drizzle node-postgres transactions/migrations, rate-limiter-flexible's
PostgreSQL store, Next route/client boundaries, next-intl client catalogues,
pnpm overrides, Playwright tests, Zod validation and Hono response headers. Registry metadata confirmed Better Auth
1.7.7, Drizzle 0.45.4/kit 0.31.11, pg 8.23.1 and limiter 11.2.1 compatibility.
Next 16.4's local route documentation was read. Better Auth 1.7.7's installed
internal-adapter, signup/sign-in, limiter and origin-check source were reviewed.

The private provisioner explicitly binds a fresh Drizzle adapter to the outer
transaction and uses the library password handler/internal identity and account
operations. Public disableSignUp remains true. No plugin, public-signup bypass
or transactional after-hook assumption is used. Fault injection proves identity,
credential and reservation rollback. Opaque code verification is confined to
auth, with atomic hash consumption and identity verification; raw codes are
never URL tokens or database values. Database sessions remain Better Auth's.

Unpatched Drizzle 0.45.4 fails strict declaration checking: stripped internal
members are still required by interfaces, optional policy values mismatch
exactOptionalPropertyTypes, and broad type barrels require unused drivers.
The owner-approved `patches/drizzle-orm@0.45.4.patch` changes declarations only:
direct imports of the same types, runtime-present getSQL/role/generated-column
members, accurate undefined policy values, enum generated type, and removal of
a private config key from public query exclusions. ESM/CJS declarations match;
no runtime JavaScript, compiler flags, any-shaped stubs or ignored diagnostics
are changed. Pinned dev-only gel 2.2.1 and bun-types 1.4.3 resolve optional
upstream types; only Bun's isolated sqlite declarations are referenced, not its
global overrides. PostgreSQL is the only runtime database. Strict negative
client fixtures continue rejecting invalid calls and fields.

An audit exposed GHSA-67mh-4wv8-2f99 in drizzle-kit's legacy loader. The exact
parent-scoped esbuild 0.25.12 override removes that vulnerable nested version.
`drizzle-kit generate` ran again and reported no schema changes. New optional
next-intl watcher/SWC installation scripts remain explicitly disabled, using
the shipped prebuilt paths. No external tool/service is activated.

## Acceptance-to-evidence map

| Criterion | Fresh executable evidence |
| --- | --- |
| A1 protected admission | PostgreSQL/API test rejects missing/wrong token, unsafe/missing origin, URL token and invalid input; both ordinary HTTP signup and direct library signup fail; frontend artifact canary, no-storage assertions and disabled-JavaScript POST-fallback browser evidence |
| A2 exactly one owner | Eight concurrent PostgreSQL admissions yield one identity/credential; same key/input replays, changed request conflicts; concurrent completions return one shop/membership; injected identity/credential/reservation failures leave no partial records |
| A3 verification/restart recovery | Failed capture preserves reservation; a separate Node process resends for the same owner; invalid/expired/replayed codes fail; unverified sign-in/shop access denied; injected verification failure rolls back consumption and verification; verified owner resumes pending shop creation |
| A4 permanent completion | Shop/membership/flag commit together; injected post-function failure rolls back completion; retried/restarted completion returns the original shop; completed setup and attempted runtime reset denied; removal of setup variable documented |
| A5 first-tenant protections | Real app_user, forced-policy catalog introspection for every tenant-key table, own-membership pre-shop read, seeded second user/shop, cross-shop reads, wrong membership/grant, missing context, transaction rollback and pooled-context denial |
| A6 secure sign-in | Real database sessions, matching unknown/wrong-credential errors, revocation and expiry; controlled certificate-validated HTTPS proves Secure/HttpOnly/Lax cookie and no bearer JSON/cookie-cache; untrusted library/browser origins denied |
| A7 origin/abuse protection | Exact application-origin checks plus explicit library CSRF/origin checks in test/runtime; real atomic auth/application database limiters allow only approved boundaries across concurrent instances and a fresh Node process; forwarded-header spoofing does not create a new bucket |
| A8 reproducibility/UI | Concurrent/idempotent reviewed migrations as app_owner, runtime role guard, fresh Windows checks; six actual Next/production-API/PostgreSQL Tamil/English phone/tablet/desktop flows with error focus, keyboard, axe, reload, sign-out, no storage; existing health/design/artifact workflows and hosted Linux checks |

## Final verification

Fresh native Windows results on 13 October 2026:

| Command | Result |
| --- | --- |
| `pnpm verify` | Passed: Biome/boundaries/tokens, Knip, all strict typechecks, 31 unit tests, eight negative health/owner DTO/client diagnostics plus Base UI negative fixtures, 10 real PostgreSQL integration tests, production web/worker build, readiness/outage/shutdown smoke and 26 browser-artifact scans |
| `pnpm test:ui` | Passed: 30 tests, including both languages across phone/tablet/desktop, independent synthetic owner web/database fixtures, resume/errors/verification/sign-in/shop/reload/sign-out, keyboard/focus/axe and existing design/health flows |
| `pnpm audit --audit-level low` | Passed: no known vulnerabilities |
| `pnpm verify:clean` | Frozen native install and complete verification passed from an OS temporary path containing spaces, without copied node_modules/private env files; lockfile unchanged |
| `drizzle-kit generate` after nested override | Passed: five auth tables; no schema changes |
| Mechanical UI detector | No findings; manual review of the four flow states across device sizes confirms the incumbent shared system and readable Tamil text |

Hosted Linux required-check URLs are recorded in the draft PR after it is
pushed. Earlier failures were actionable: strict Drizzle declarations, the
nested advisory, the occupied dev output, an ambiguous alert selector, a
negative-fixture assertion that looked for a field name the compiler did not
print, and a strengthened TLS assertion exposing a missing no-store header on
the raw auth response. Each was corrected; no failed gate is suppressed. The
complete suites and all three hosted checks must pass before an owner can
approve a merge. These results do not claim a merge or live activation.

Remaining limits: no real-device/screen-reader session, live transport, live
domain/credentials, production data, deployed migration or live restore drill.
Synthetic Windows capture directories require private ACL provisioning.
No money/history-domain migration or outbound side effects are introduced.
General command/audit/ETag and comprehensive tenancy foundations remain their
separate issues. A draft PR is reviewable work, not merged issue completion.
