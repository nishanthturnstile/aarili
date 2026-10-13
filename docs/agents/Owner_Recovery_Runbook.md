# Synthetic owner recovery and recent authentication — issue #13

Wave 0 / 0.2.1b extends the [bootstrap foundation](Owner_Bootstrap_Runbook.md).
Product §4, TRU-01, USE-01/02/09 and the account-lifecycle foundation of TRU-09;
architecture §§6.2, 6.4, 8.7, 11.1, 11.4, 12.4 and 15 apply. This does not
complete staff revocation, ownership transfer, AC-57 or production activation.

## Recover access locally

Use the existing synthetic configuration, private capture directory and
`app_user` runtime credential. No new environment variables, dependencies,
workers or migrations are required. `AARILI_SYNTHETIC_AUTH=true` still requires
an exact loopback origin. Ordinary signup and native reset/callback endpoints
remain closed; only the validated owner API exposes recovery.

1. Choose **Forgot your password?** on `/sign-in`. Enter the verified owner's
   email. `/owner/recovery/request` always returns `recovery-requested` for
   eligible and unknown addresses. Unverified or other seeded identities cannot
   receive a reset. A local capture failure has the same public response; retry
   the request after the abuse window rather than changing/deleting the account.
2. Read the private local capture with `purpose: "reset"`. Captures contain an
   opaque `code`, never a recovery URL. Choose **I have a reset code**, paste
   the code at `/reset-password`, and enter a new 15–128-character password.
   Tokens/passwords are sent only in POST bodies. Redirect fields, URL tokens
   and malformed inputs are rejected by the API. The browser does not consume
   URL tokens and strips accidental query/fragment parameters, including later
   fragment/history changes. Never put a real code in an address bar.
3. On success, sign in with the new password. The previous password, every
   pre-reset session and all outstanding reset codes are invalid. Invalid,
   expired or replayed codes require another request. If a response was lost,
   try the new password or request another code; do not reopen bootstrap.
4. **Sign out** deletes the current database session and expires its cookie.
   A failed/offline sign-out clears local authenticated state, but cannot promise
   server revocation until its request succeeds. Retry when connected. Password
   reset can end other sessions when access has been lost.

Private captures are synthetic, not an HTTP debug mailbox. Retain the existing
0700-directory/0600-file handling on Linux and owner-only directory ACL on
Windows. Delete captures after verification; never commit or attach them.

## Confirm recent access

The owner surface includes a **synthetic access check**, without business
effects. After five minutes it asks for recent authentication. Choose **Confirm
recent access** and enter the current password. Re-authentication resolves the
verified owner from the database session, uses the library password handler,
creates a new session and revokes the previous session in one transaction.
Neither a submitted user ID nor client time is accepted.

Later service/API handlers can use `OwnerAuth.withRecentOwner(headers, run)`.
It resolves the session on the server, checks membership through `withShop`,
and rechecks/locks the authoritative session in that same tenant transaction.
The callback receives only the transaction and server-resolved actor/shop.
Missing/expired/revoked sessions fail with `UNAUTHENTICATED`; stale or future
creation timestamps fail with `AUTHENTICATION_STALE`. The callback is never
called on denial. Future business commands still need their own permission,
idempotency, audit and conflict policies from the corresponding slice.

Freshness uses `created_at`, never `updated_at`. Automatic renewal can extend
expiry but cannot establish recent authentication. Cookies remain HttpOnly,
SameSite=Lax and Secure on HTTPS; cookie caching is disabled. Only loopback HTTP
omits Secure. Controlled certificate-validated HTTPS tests exercise rotation
and old-cookie rejection.

Current authenticated UI state is React memory; no persistent query cache or
future-only Query dependency is added. Typed clients abort pending reads and
use a generation check even if cancellation is ignored. Sign-in/sign-out/reset
clear state before and after the transition; re-authentication and 401 responses
invalidate it. Late responses from a previous identity cannot restore its state
or invalidate a newer generation. Screens subscribe to invalidation and clear
the shop immediately. Future memory-only module caches must use this lifecycle.

## Approved numeric policy

Owner approval in the issue #13 implementation chat, 13 October 2026:

| Setting | Explicit value |
| --- | --- |
| Reset code | Native Better Auth opaque 24-character code; 30-minute expiry |
| Recent authentication | 5 minutes from successful sign-in/re-authentication |
| Session / renewal | Retain 12 hours / refresh after 1 hour |
| Password | Retain 15–128 characters without mandatory composition rules |
| Reset request | 3 attempts per 5 minutes |
| Reset redemption | 5 attempts per minute |
| Re-authentication | 5 attempts per minute |

Each new limiter has its own installation-wide PostgreSQL bucket. Exact
origin/CSRF protections and the existing 5-attempt/minute native sign-in limit
remain. Limits run in synthetic tests and runtime, with no memory/Redis fallback
or forwarded-header trust. Shared buckets can temporarily block the owner under
attack; public hosting needs a separately reviewed trust/abuse configuration.
Clock and policy injection are server-side test seams, never request fields or
environment policy overrides.

## Native reset semantics, failure and recovery

Installed Better Auth **1.7.7** `dist/api/routes/password.mjs` spends the token
before updating the password and deleting user sessions. Its internal adapter
atomically consumes the verification record; the complete endpoint does not
wrap all these writes together. Current indexed documentation describes newer
behavior, so the pinned source and real PostgreSQL evidence govern here.

The private auth wrapper binds a fresh Drizzle adapter to one outer transaction
and invokes the throwing native reset API inside it. Token consumption,
password update, all-session revocation and removal of outstanding codes commit
or roll back together. An injected PostgreSQL DELETE failure after the password
write proves retry with the same token remains possible and the old password/
sessions remain valid. A second Node process cannot redeem a consumed token.
Credential transactions share a database advisory lock, so an old-password
sign-in cannot race reset and create a usable session after revocation. No
transaction waits for local mail capture or human verification.

Auth identity/session/verification tables remain the documented global auth
exception, reachable only through auth. The shop/membership forced policies and
bootstrap provenance remain unchanged. Reset/logout never delete membership,
modify shop history, clear completion or grant access. No money, stock, custody
or issued-document changes occur. No destructive down migration or account
deletion workaround exists; rollback retains the compatible schema and the
changed password/revoked sessions. Live restore remains a later approved gate.

## Outbound activation remains closed

Only the local file capture adapter exists. Missing or accidentally present
Resend/SMTP credentials cannot select an outbound transport. No durable worker
or provider SDK is installed for recovery. Before any real auth email can be
activated, complete 0.3.2's kill switch, restore epoch/job quarantine and practice
suppression, and obtain explicit production domain/DNS/provider/credentials
approval. Restore rehearsal, privacy/configuration and product §33 pilot gates
still precede live data. There is no deployment or external activation here.
