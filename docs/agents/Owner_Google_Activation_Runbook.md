# Owner Google connection — issue #14

Wave 0 / 0.2.1c implements product §4, TRU-01, the Google connection-control
foundation of TRU-11, and USE-01/02/09. Architecture §§4–5.1, 6.2, 11.1, 11.4,
12.3 and 15 govern this increment. No invitations, other integrations or live
activation are included.

## Owner flow

The completed verified owner signs in using email/password, opens **Sign-in
connections**, confirms recent access when requested and chooses **Link Google
account**. The provider email must match the local verified email and an exact
approved entry. Matching is case-insensitive only; aliases, dots, plus suffixes
and domains are never expanded. A provider's raw `email_verified` must be the
boolean `true`. Same-email Google sign-in cannot link an account implicitly.

The callback rechecks the original database session, freshness, current owner,
membership and allow-list. A password reset, sign-out, expiry or re-authentication
while away invalidates that pending link. Return to password sign-in, confirm
access and start a new flow. Native state/cookie checks and PKCE remain enabled.
The 1.7.7 native state payload lasts ten minutes; its database expiry is also
checked. The already-approved five-minute authentication window controls linking
authority independently. Automatic session renewal does not refresh it.

Subsequent Google sign-in opens the same identity and shop. Allow-list removal
denies new callbacks and existing sessions identified as Google authentication.
Password access is unaffected. **Disconnect Google** offers review and cancel;
confirmation requires recent authentication, preserves a usable password account,
revokes every active session and clears the cookie. Sign in with the password
afterwards. If the response was lost, check the connection after password sign-in;
never reopen setup or remove a credential record to recover.

No access, refresh or ID tokens are retained. Account write hooks discard them;
native token encryption is enabled as defence in depth. No account/token export
endpoints, direct ID-token/One Tap paths, extra scopes or arbitrary provider paths
are exposed. Connection events contain only owner/session attribution, provider,
action and time, and remain after session revocation.

## Synthetic verification

`pnpm verify` runs real PostgreSQL and Better Auth callback processing. The test
transport replaces only the Google token exchange at the network boundary and
checks the exact callback, client and PKCE verifier. Browser tests preload that
transport in a disposable production web process and intercept Google's
authorization navigation. Fictional `example.test` identities are used throughout.
No Google credentials, client creation, live provider requests or outbound mail
are required. These tests prove application admission/state/session behaviour;
they do not certify a deployed Google OAuth client or Google's token service.

The existing `AARILI_SYNTHETIC_AUTH=true` mounting gate remains loopback-only.
Production auth/email transport is still unmounted. Missing/invalid Google
approval configuration disables Google without removing password recovery.

## Separate owner-run activation checklist

Every item below is pending and requires separately authorised implementation
or owner action. Passing CI does not approve it.

- [ ] Fix and approve the final HTTPS `app.<domain>` before OAuth production
  activation (architecture §12.3); authorise any domain/DNS changes separately.
- [ ] Approve the existing verified owner identity and exact lower-case
  `AUTH_GOOGLE_ALLOWED_EMAILS` list through private environment configuration.
- [ ] Authorise Google Cloud client creation/configuration separately. Use distinct
  development and production clients, secrets and consent-screen configurations.
- [ ] For each client, register exactly `AUTH_ORIGIN` as its JavaScript origin and
  exactly `AUTH_ORIGIN/api/auth/callback/google` as its redirect URI. No wildcard,
  preview-host or cross-environment entry. Request only `openid email profile`.
- [ ] Supply server-only `GOOGLE_DEV_CLIENT_ID/SECRET` or
  `GOOGLE_PROD_CLIENT_ID/SECRET`, `AUTH_GOOGLE_ENVIRONMENT`,
  `AUTH_GOOGLE_APPROVED_ORIGIN` equal to `AUTH_ORIGIN`, and explicit
  `AUTH_GOOGLE_ENABLED=true` in that environment. The example stays disabled.
  Never use `NEXT_PUBLIC_*`, commit a secret or put one in screenshots/logs.
- [ ] Complete the separately scoped production auth mount and auth-email
  activation prerequisites: 0.3.2 kill switch, restore epoch/quarantine and
  practice suppression, plus domain/DNS/email-provider approval. No worker or
  provider credential may bypass those gates.
- [ ] Apply reviewed additive migration `0002_auth_connection_history.sql` using
  `app_owner` and the existing advisory-locked runner. Ordinary web/auth remains
  `app_user`. Before live schema migration, take and verify the required backup.
- [ ] Authorise and run a real-provider smoke: password sign-in/confirmation,
  explicit link, logout, Google sign-in to the same shop, unapproved/unverified
  rejection, disconnect and password recovery. Confirm exact HTTPS cookies,
  redirects and safe proxy/access logs with OAuth query strings redacted.
- [ ] Perform owner-device and Tamil screen-reader checks. Record the actual
  environment/client/domain, reviewer, date and smoke outcome without secrets.
- [ ] Satisfy product §§32.2/33, privacy and recovery gates before any live data.

## Migration, isolation, immutable history and rollback

`auth_session.auth_method` is a server-only additive field defaulting to
`credential` for existing sessions. New Google sessions are labelled by native
callback context, never request input. `auth_connection_event` is an auth-identity
exception to tenant RLS, confined to the auth package; no business personal data
or tokens are stored. Runtime has insert/select only; a trigger prevents update
or delete, including accidental owner edits. Session attribution has no session
foreign key so revocation cannot erase history. User attribution is retained.

The credential transaction serialises link/sign-in/disconnect callbacks with
password reset, re-authentication and logout. Account/history/session effects
rollback together through a savepoint while the outer advisory/state locks stay
held through rejection-state consumption. Database uniqueness independently
prevents two users sharing one provider account. Failed callbacks consume only
state authenticated by native processing; a guessed state cannot cancel another
browser's flow. A new flow is
the retry after callback failure. The callback holds a transaction through token
exchange; no transaction spans the user's consent/interaction wait.

Own membership is checked with transaction-local user context. No tenant grants,
shop membership, bootstrap completion, money, media, document or job history are
changed. Existing forced tenant policies continue to apply.

Retain the additive schema on application rollback; older code ignores the new
column/table and credential access remains available. Before rolling back to
code that predates Google session-policy checks, disconnect with fresh access
(which revokes all sessions), or use an authorised recovery procedure to revoke
them. Disabling provider configuration alone cannot add the new session guard
to old code. Do not run a destructive
down migration, delete history or reset setup. After restore, independently
reconcile current provider approvals/revocations before enabling Google. The
broader restore/suppression drills remain later gates; this synthetic test suite
does not certify production recovery.
