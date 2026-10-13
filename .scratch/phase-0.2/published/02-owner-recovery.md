**Status:** Approved implementation ticket (`ready-for-agent`). Implementation requires a separate user request and merged direct blockers.

**Wave / phase / source slice:** Wave 0 → Phase 0.2 — Protect Identity, Tenancy and Business Commands → 0.2.1 — Bootstrap and Recover the Owner Account, recovery/session portion.

## What to build

The verified owner can recover a forgotten password through local synthetic mail, sign out and sign in again. Expired or revoked sessions cannot authorize requests, and a reusable server guard requires recent authentication for sensitive actions without treating session refresh as a new sign-in.

## Blocked by

- [Issue #12 - [W0 0.2.1a] Bootstrap one verified owner and the initial protected shop](https://github.com/nishanthturnstile/aarili/issues/12). Must merge before implementation; approval of this ticket does not override its open dependency.

## Sources and expected outcome

- [Roadmap](https://github.com/nishanthturnstile/aarili/blob/main/docs/Boutique_Business_Management_Implementation_Roadmap.md): 0.2.1 recovery/session outcome and 0.3.2 outbound-email activation dependency.
- [Product plan](https://github.com/nishanthturnstile/aarili/blob/main/docs/Boutique_Business_Management_Final_Product_Plan.md): §4 owner-only access; TRU-01; USE-01/02/09; TRU-09 account-lifecycle foundation only; §§29.1, 30.1 and 33. No claim to complete staff revocation, ownership transfer or AC-57.
- [Architecture](https://github.com/nishanthturnstile/aarili/blob/main/docs/Architecture_and_Technology_Decisions.md): §§6.2, 6.4, 11.1, 11.4, 12.4 and 15. Recent authentication is also required for exports by §8.7.

## Scope

Extend the existing auth boundary with password-reset request/redemption, logout, database session expiration/revocation and a shared recent-authentication guard. Add the minimal owner recovery and re-authentication UI. Demonstrate the guard through an authenticated synthetic probe; do not implement refunds, exports, receiving accounts or a product settings shell to make it demoable.

Maintain exact origins, CSRF protection, secure cookies, local-only mail capture and database-backed abuse controls from 0.2.1a. Clear in-memory authenticated query state on sign-out, invalidation and identity changes. Never persist business/session data in browser storage or a service worker.

Out of scope: public registration, email-address changes, account deletion, team lifecycle, passkeys/MFA/magic links, real business sensitive commands, Google linking, durable jobs, live Resend credentials and outbound sends.

## Acceptance criteria

- [ ] **B1 — Recovery for the existing owner:** A generic reset-request response does not reveal whether an address exists. Only the existing eligible identity receives a locally captured reset. The complete reset and new-password sign-in flow works; the previous password fails. Reset requests never create a user or reopen bootstrap.
- [ ] **B2 — Reset-token lifecycle:** Invalid/expired tokens fail; two concurrent redemptions of the same valid token produce at most one password change. Successful redemption prevents replay. Injected database failure does not consume recovery irreversibly while leaving an unchanged password or partial state. Document library-specific token semantics with real PostgreSQL evidence.
- [ ] **B3 — Session termination:** Logout revokes the current database session and clears its cookie. Password-reset completion revokes pre-reset sessions. Expired/revoked sessions are rejected on the next protected request, including replay of an old cookie; database state is authoritative and cookie caching stays disabled. Historical bootstrap/shop records remain intact.
- [ ] **B4 — Fresh authentication:** The shared API/service guard rejects missing, expired or stale authentication and accepts a successful recent re-authentication. Automatic session renewal, client time, a submitted user ID or a stale cached session cannot establish freshness. Synthetic sensitive requests are denied without effects until the guard passes. The guard is reusable by later refunds, exports, receiving-account changes and Phase 2 role changes.
- [ ] **B5 — Abuse and request boundaries:** Unsafe-origin, missing required origin, malformed token, malicious redirect and repeated recovery/re-auth requests are rejected appropriately. Database-backed limits survive process restart and concurrent requests. Credentials and reset tokens are redacted from logs/errors, third-party requests and test artifacts; strip transient recovery tokens from the address bar after consumption, with no browser storage persistence.
- [ ] **B6 — Bilingual accessible recovery:** Tamil/English password recovery, reset failure, session expiry, sign-out and re-authentication work at phone/tablet/desktop sizes with labels, keyboard/focus, accessible errors and axe checks. In-memory query state clears on logout/session invalidation; pending authenticated requests cannot repopulate the previous identity's cache.
- [ ] **B7 — Outbound remains disabled:** Verification/reset delivery uses the synthetic local adapter. Missing or accidentally present production email credentials cannot enable an external send in this increment. Document the later 0.3.2 kill-switch, restore-epoch/quarantine and practice-suppression prerequisites, plus domain/DNS/provider approval, before real auth email can be activated. Do not install or run a durable worker to bypass that gate.

## Research and decisions during implementation

Verify the pinned library's reset-token consumption, session revocation and `freshAge` semantics. Present concrete reset expiry, session lifetime/renewal, re-authentication window and abuse-limit values for owner approval before finalising security policy. The architecture decides that fresh authentication is required; it does not approve a numeric duration. Do not inherit a library default silently as a reviewed product policy. Boundary tests use an injected clock/configuration.

## Migration, isolation, history and recovery

Reuse the auth/session schema and tenant context, adding only migration changes required by the actual adapter. Auth operations remain confined to auth; protected probes must still verify membership through the current shop transaction. Session/password changes must not delete membership or provenance. Reset/logout cannot reactivate setup. Failures use disposable synthetic databases and locally captured mail; no production outage or live restore. Maintain compatible schema rollback and narrowly scoped migration credentials.

## Verification and completion evidence

Run actual `pnpm verify`, `pnpm test:ui` and `pnpm audit --audit-level low`, with real PostgreSQL token concurrency, retry, injected-failure and revoked-cookie tests plus the browser flows above. Report B1–B7 evidence, failure cases and checks not run. Keep existing health/design-system checks and the three required hosted CI checks. Work sequentially in the existing checkout on a focused `codex/` branch; only an owner-authorised merge permits integrated-main verification. No deployment or external activation is included.
