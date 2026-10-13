# Synthetic owner bootstrap — issue #12

Scope: Wave 0 / 0.2.1a; product §4, TRU-01, BIZ-01 foundation,
USE-01/02/09; architecture §§6.5, 8.1–8.2, 11.1–11.2, 11.4, 12.4.
This is the owner identity and first-shop foundation, not full onboarding or a
pilot/live activation decision. Google, reset/re-authentication, invitations,
workers and outbound email are excluded from this bootstrap slice. Issue #13's
separate [recovery/session runbook](Owner_Recovery_Runbook.md) adds synthetic
password recovery and recent authentication without enabling outbound email.

## Prepare a synthetic environment

Use the existing native checkout and dedicated local infrastructure from
issue #4. `infra/init-postgres.sh` only runs for empty volumes; **do not erase a
retained volume to obtain this schema**. The reviewed migration runner upgrades
both fresh and retained PostgreSQL 18 installations. It verifies `app_owner`,
takes a transaction-scoped advisory lock, checks previously applied SQL hashes,
and commits schema/grants/history together. Concurrent runners serialize.

Provide `MIGRATION_DATABASE_URL` to the migration process only and run
`pnpm db:migrate` from the repository root. Use the existing private
`infra/.local/owner_password` value; do not print the connection string or place
it in the web/worker environment. The runner deliberately does not load an env
file automatically. `packages/db/.env.example` describes its separate input.
No `drizzle-kit push`, destructive down migration or automatic live migration
is part of this slice. Migrations require PostgreSQL 18's verified `uuidv7()`.

Keep the web `DATABASE_URL` on `app_user`, using its separate local credential.
Auth checks the effective role, superuser/BYPASSRLS flags and owner membership
before using it. It fails closed for privileged credentials. Migration files
are deployment inputs, not browser files.

In the ignored `apps/web/.env.local`, preserve existing values and add the
server-only keys described in `apps/web/.env.example`:

- `AARILI_SYNTHETIC_AUTH=true` explicitly enables this local adapter.
- `AUTH_ORIGIN` is one exact loopback origin, e.g. `http://127.0.0.1:3000`.
  Scheme, host and port must match the browser. No paths, wildcards, inferred
  origins or forwarded-header trust are accepted. Remote HTTP is rejected;
  HTTPS enables Secure cookies, including on the controlled TLS test surface.
- `BETTER_AUTH_SECRET` and `SETUP_TOKEN` are independent cryptographically
  generated values with at least 32 bytes of randomness. Write them directly
  to private configuration, never source, chat, URLs, browser storage or logs.
- `AUTH_CAPTURE_DIRECTORY` is an absolute directory outside the checkout.
  On Linux, the adapter creates it with mode 0700 and each capture with 0600.
  On Windows, provision a directory with an ACL restricted to the developer
  account; POSIX mode bits do not substitute for Windows ACLs. Do not put it on
  a shared drive or serve it as web content.

`pnpm dev:web` builds the real packages and starts Next.js. Keep all data
synthetic; use names, shops and email addresses created for testing. The public
auth signup endpoint stays closed. Without the explicit synthetic adapter,
owner API endpoints are unavailable. Non-loopback synthetic origins are
rejected even when the opt-in variable is set. There is no mail viewer/debug
HTTP endpoint, outbound transport, OAuth or production activation here.

## Complete or resume setup

1. Open `/setup`, choose Tamil or English, and enter the synthetic owner name,
   email, long password, initial shop name and operator-provided setup token.
   Admission takes a database lock and reserves only one identity/credential
   pair. The identity, immutable request binding and reservation commit in one
   transaction. A lost response can replay the same key and input; changed
   input under the same key conflicts. The open form retains its entries on
   errors. A second identity is never created as a recovery action.
2. Read the verification message from the private capture directory using
   local filesystem access. Paste its code into the verification form; it is
   submitted as a POST body, never in a URL. No transaction waits for delivery
   or human verification. Only the code hash is in the database. Verification
   marks the user verified and consumes all pending codes in one transaction.
3. If capture failed, a code expired, the browser closed or the process
   restarted, use **Resume pending verification** with the same setup token,
   email and password. It verifies the reserved owner's password and captures
   another code. It does not delete or change the reservation, password or shop
   name. If already verified, sign in instead.
4. Open `/sign-in`. A verified server session is required. `/owner` resolves
   the session and membership on the server. Choose **Create my shop** to
   complete the previously named shop. A narrowly granted database function
   checks the reserved verified identity, creates the shop/membership and
   records permanent completion atomically. Retries return the same shop.
   A restart between verification, sign-in and completion resumes this step.
5. After authorized completion, remove `SETUP_TOKEN` from the private
   environment and restart the web process. Keep the auth secret and runtime
   credential. The database completion flag, actor, timestamps, original shop
   name and request binding remain; leaving/re-adding the variable cannot
   reopen setup. There is no reset endpoint or normal-restart reset.

Captures contain synthetic email and verification codes. Restrict access and
remove captures after the synthetic exercise. Do not commit or attach them.
Application responses redact bearer session tokens; cookies are HttpOnly,
SameSite=Lax, Secure on HTTPS, and database-backed with cookie caching disabled.
Loopback HTTP alone omits Secure so native local development works. Sign-out
revokes the database session and leaves the shop UI via full navigation, clearing
its in-memory state; nothing is stored in localStorage or sessionStorage.

## Owner-approved initial policy

Approved in this implementation chat on 13 October 2026:

| Setting | Value |
| --- | --- |
| Password | 15–128 characters; no mandatory composition rules |
| Database session | 12 hours, refresh after 1 hour; no remember-me control |
| Verification code | 256-bit random opaque value, expires after 30 minutes |
| Sign-in | 5 attempts/minute |
| Setup and resend | Each limited to 3 attempts/5 minutes |
| Code verification | 5 attempts/minute |
| IP/proxy trust | None; shared installation/per-path buckets |

Sign-in accepts only email and password. Unsupported fields, including
`rememberMe` and `callbackURL`, return 422 before a session is created. Session
renewal forwards the refreshed cookie through `/owner/shop`, `/owner/complete`
and `/auth/get-session`, including the pending-shop state, so browser and
database expiry follow the same approved policy.

The Better Auth database limiter and PostgreSQL-backed rate-limiter-flexible
store are explicitly active in tests and runtime. Spoofed forwarded headers
cannot select a fresh bucket. A database outage fails closed; there is no memory
or Redis fallback. Shared buckets can temporarily block the legitimate owner
under attack; a trusted-proxy policy needs a separate reviewed configuration
before publicly accessible use. Better Auth's origin and CSRF checks are both
explicitly enabled, including in its test mode, alongside the Hono origin check.

## Isolation, immutable history and recovery review

`shop.shop_id` is the root tenant key; memberships have a non-null shop key,
shop-led composite primary key and root foreign key. Auth's global identity
foreign key is the documented identity exception. Both tenant tables enable
and force RLS from the first migration. Own-membership reads deliberately work
with user context before shop context; `withShop` then checks membership and
sets user/shop/actor transaction-local context. The callback uses that
transaction exclusively. Missing/cross-shop context fails closed and connection
reuse/rollback clears it.

`app_user` cannot directly insert/update/delete shops or memberships. The only
initial write path is `complete_owner_bootstrap`: fixed search path, explicit
schemas, no dynamic SQL, PUBLIC execution revoked, and only the reserved
verified actor accepted. It has a tightly scoped owner-role INSERT policy under
FORCE RLS. This is a bootstrap exception inside auth, not a reusable arbitrary
membership grant or owner-runtime connection. Ordinary identity/credential/
session operations stay behind auth. Global bootstrap, verification and limiter
metadata are explicitly classified and granted; they are not tenant data.

Reservation and completion provenance cannot be reset or deleted through the
runtime surface. Completion is idempotent by its immutable reserved actor and
shop request. This does not substitute for the general audit/idempotency/ETag
foundation in 0.2.3. No money, stock, custody, issued document or worker effects
are introduced. Full tenancy/access-matrix coverage continues in 0.2.2.

Rollback means reverting the application to a schema-compatible version and
retaining these additive tables/migrations. Do not delete accounts, clear
bootstrap metadata, change applied SQL, remove the shop or run a down migration
to recover setup. Restores must retain the bootstrap completion and auth state;
normal restart is not restore or reset. Live backup/restore, privacy approvals,
production domain/credentials, transport suppression and pilot gates remain
later prerequisites. Nothing here authorizes real data or real email.

## Verification entry points

`pnpm verify` runs Biome, canonical-token/import boundaries, Knip, strict
TypeScript/declaration and negative-client checks, unit tests, real PostgreSQL
tests, production builds, smoke and browser-secret scans. `pnpm test:ui` builds
production web, runs the existing design/health workflows and six owner flows
on independent disposable databases and web processes. Its separate `.next-ui`
output avoids the owner's existing dev-server lock. Migration credentials are
never passed to those web processes. `pnpm audit --audit-level low` includes
development dependencies. The original three required CI check names remain.

Auth browser tests disable traces/screenshots of request fields and clear the
page before Playwright's automatic failure snapshot. Reviewed UI captures show
only cleared, synthetic flow states. Test TLS keys/captures are temporary and
removed. Physical-device/screen-reader and live recovery evidence are not
claimed; those remain product §33 / architecture §15 pilot gates.

Forms have a POST-only native fallback, so delayed/disabled JavaScript cannot
put entered credentials or setup codes in a query string. A browser test with
JavaScript disabled verifies the fallback transport. The disposable database
fixture uses independent admin, migration and runtime passwords; web processes
receive only the runtime connection string.
