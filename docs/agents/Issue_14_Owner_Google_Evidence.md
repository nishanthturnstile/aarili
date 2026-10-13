# Issue #14 — owner Google linking evidence

Scope: W0 / 0.2.1c, roadmap 0.2.1; product §4, TRU-01, TRU-11 connection-control
foundation, USE-01/02/09, §§29.1/30.1/33; architecture §§4–5.1, 6.2, 11.1,
11.4, 12.3 and 15. No other provider, public account creation, invitations,
ownership transfer, live Google client, domain/DNS change, outbound email or
external activation is included.

## Starting state and research

Issue #14 was approved (`ready-for-agent`), open and had no comments. Its only
native direct blocker, #13, closed after [PR #18](https://github.com/nishanthturnstile/aarili/pull/18)
merged on 13 October 2026 at 14:21:23 UTC, commit
`1ecfdd62fa4d35514298e76bfe590219f89918ee`. Clean main matched origin/main at that
commit. [Integrated main CI](https://github.com/nishanthturnstile/aarili/actions/runs/38412637605)
passed; local main also passed `pnpm verify`, all 39 `pnpm test:ui` cases and
`pnpm audit --audit-level low`. Work uses only the existing Windows checkout,
on `codex/0.2.1c-google-owner-linking`; no worktree or additional feature checkout.

The approved TypeScript 7.0.2 baseline correction and exact Better Auth 1.7.7
pin remain. No dependency changed. Context7 CLI resolved Better Auth before
focused Google/linking and session-field documentation queries. There is no
indexed 1.7.7 entry; the installed pinned official Google provider, callback,
account-linking, state, validation, session and adapter source resolved exact
semantics. The docs site's llms index could not be fetched by the web reader
(unsupported Markdown content type); Context7 queries succeeded.

Confirmed native options: both provider signup switches, explicit linking with
`disableImplicitLinking`, verified local email, no different-email/unlink-all or
profile-update options, database state plus signed cookie checks, PKCE,
`encryptOAuthTokens`, and no account cookie or token refresh endpoints. Raw
provider claims are checked through native `validateUserInfo`, including on
returning linked sign-in. Google trust does not override `email_verified`.

The pinned native state parser uses both stored JSON and a signed cookie. Its
payload expiry does not substitute for checking the row expiry. Redirects can
skip after hooks, so rejected callbacks observe authenticated state deletion
inside the native transaction before rolling effects back and consuming state
under the same outer lock. Effect writes use a nested savepoint, so a queued
valid callback cannot enter between rollback and rejection-state consumption.
A tampered/missing cookie cannot consume somebody else's state. Drizzle's
savepoint API was also resolved/fetched with Context7 and checked against its
pinned node-postgres implementation.
Next.js host handling was resolved/fetched separately (nearest indexed 16.2.9)
and checked against the installed 16.4.0 server source and guide. No Next.js
dependency enters the auth/API packages.

## Acceptance-to-evidence map

| Criterion | Executable evidence |
| --- | --- |
| C1 explicit owner linking | `0.2.1c C1/C3/C5`: real Google authorization URL, native callback/Drizzle adapter and PostgreSQL attach one account to the existing verified owner; identity/membership counts and bootstrap/shop provenance stay unchanged. Password sign-in and recovery remain. Six bilingual/device browser scenarios perform the flow. |
| C2 closed signup | `0.2.1c C2/C3`: modified `requestSignUp: true` cannot admit new/unapproved identities. Native email/provider signup, alternative OAuth providers/entrypoints and token endpoints remain closed. Direct callbacks without state and direct service signup fail. Counts are checked after each rejection. Strict DTO tests exclude direct ID tokens, extra scopes and client-controlled state/context. |
| C3 no implicit linking | Returning same-email unlinked sign-in is denied before explicit linking. Both native link/sign-in callbacks reject different/alias, absent/empty and non-boolean/unverified email claims, including signup intent. Linked access rechecks the fresh provider email against the verified local owner and exact allow-list. |
| C4 callback/session security | `0.2.1c C4`: missing/tampered/expired state or cookie, invalid/missing/replayed code, failed-code state replay, unsafe Origin/Host, stale/revoked/rotated initiating session and an owner becoming unverified fail without account/history writes. Concurrent native callback replay has one success; another fixture user's existing binding is denied. Two concurrent PostgreSQL inserts for distinct users prove provider uniqueness independently. Real account-write trigger failure and post-account/history failure roll back effects; authenticated rejection state is consumed and a new flow succeeds. Existing expiry/revocation/session-renewal tests also run. |
| C5 sign-in/disconnect | Native Google sign-in reaches the original owner/shop. Allow-list removal denies callbacks and previously issued Google sessions. Disconnect checks freshness and a usable credential, appends attribution, revokes all sessions and clears the cookie. Future Google access fails; password sign-in/reset remain. Direct credential unlink is denied even with Google connected. A null password cannot masquerade as a remaining method. Injected disconnect failure preserves account/session/history; retry succeeds. |
| C6 configuration/secrets | `0.2.1c C6` DTO/env tests prove disabled/missing/invalid approval fails closed and selects separate development/production credentials with exact origin and HTTPS production requirements. The synthetic transport checks only `openid email profile`, exact client/callback and PKCE. Every retained Google token field is null; token APIs/direct-ID paths are closed. Browser flows inspect DOM/storage and private process logs against secret/token/code canaries, disable traces and automatic screenshots, and scrub failure artifacts. Browser artifact scans include Google secret canaries; CI retains the three existing checks. |
| C7 accessible flow/activation | `tests/ui/owner-google.spec.mjs`: Tamil/English at 360×800, 820×1180 and 1440×1000 exercise sign-in/link rejection, stale confirmation, successful linking/sign-in, cancel/review/disconnect and subsequent password entry; keyboard, focus, axe, overflow and no browser persistence checks. Cleared-state captures live in `auth-google/captures/`. [Separate activation checklist](Owner_Google_Activation_Runbook.md) records final domain, per-environment OAuth client/credentials, exact redirect and an authorised real-provider smoke. |

## Isolation, history, migration and recovery

Additive reviewed `0002_auth_connection_history.sql` adds the server-set session
method and immutable connection-event table. Identity/session/event records are
the architecture §8.2 auth exception, confined to auth; tenant tables and forced
policies are unchanged. Google operations check the reserved verified owner and
own membership using transaction-local user context. No shop, bootstrap,
membership, money, media, document or job history is rewritten. Connection events
carry owner/session/provider/action/time only; no provider email, subject or
tokens. Runtime cannot update/delete them, and session revocation cannot cascade
history deletion. Real PostgreSQL tests exercise grants and immutable triggers.

Count assertions use transaction-local owner context as `app_user` and require
one actual membership row; an empty FORCE-RLS view is not counted as proof.
The rejection-race test observes the second request waiting in PostgreSQL before
releasing the rejected native callback.

Native auth account/session/history writes share the credential transaction and
advisory lock with password reset/re-authentication/logout. Signed state is
bound to the original session ID, not a refreshed cookie or client-supplied ID.
Provider uniqueness is a database constraint. Disconnect preserves password
recovery. Retain the additive schema on application rollback; no destructive
down migration or setup reset. Before rollback to pre-Google code, revoke sessions
through fresh disconnect or authorised recovery because old code lacks Google
session-policy checks. Production schema migration requires its normal
backup/review gate; no live database was touched. Restore/approval reconciliation
and general command/idempotency/queue foundation remain their later slices.

## Verification record

Fresh native Windows results on 13 October 2026:

| Command | Result |
| --- | --- |
| `pnpm verify` | Passed sequentially: Biome, import/token boundaries, Knip, strict typechecks, 40 unit tests, both negative type suites, 23 real PostgreSQL integration tests, web/worker production builds, standalone readiness/outage/shutdown smoke and 26 browser artifact scans. |
| `pnpm test:ui` | Passed all 45 cases, including six full Tamil/English Google workflows with PostgreSQL-backed production web, keyboard/focus/axe checks and no persistence. |
| Focused Google browser repeat | Passed all six cases after adding a locale assertion to every capture and selecting English after the OAuth return resets the in-memory locale. |
| `pnpm audit --audit-level low` | Passed; no known vulnerabilities, including development dependencies. |
| Explicit Google/setup private-canary production build | Passed; 26 browser artifacts scanned with server-only secret canaries supplied. |
| Impeccable detector / visual review | Detector returned no findings. Phone, tablet and desktop cleared-state captures were inspected against the existing controls/tokens/fonts. |

No verification failure is treated as passing evidence. Final sequential checks
include the real RLS membership assertion and the queued rejection-state race.

Earlier development failures were repaired rather than suppressed: the native
validation hook requires endpoint context, so internal bootstrap uses its own
protected adapter while every exposed OAuth handler enables the gate; Drizzle
additional fields use the schema's property key; native special route abuse rules
needed explicit reuse of the approved sign-in policy; state expiry needs the DB
check; Next's hidden route announcer needs an explicit visible-status selector;
Next's internal URL requires validation of the actual approved Host. One verify
smoke failed because a browser build started before it finished and replaced the
shared `.next` output. Final builds/checks run sequentially.

No live-provider smoke, Google Cloud setup, final-domain/DNS work, production
mount/email activation, owner physical-device/Tamil screen-reader review or live
restore drill has run. Those remain explicit activation/readiness steps, not
claims from synthetic CI. No merge, deployment or next issue is authorised.
