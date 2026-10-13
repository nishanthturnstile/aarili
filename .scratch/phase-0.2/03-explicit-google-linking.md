# [W0 0.2.1c] Link allow-listed Google identity without opening signup

**Status:** Draft awaiting owner approval. Proposed publication label: `ready-for-agent`.

**Wave / phase / source slice:** Wave 0 → Phase 0.2 — Protect Identity, Tenancy and Business Commands → 0.2.1 — Bootstrap and Recover the Owner Account, Google-linking portion.

## What to build

A recently authenticated verified owner explicitly links the approved Google identity and can subsequently use it to sign in to the same account. An unapproved, unverified or merely same-email Google identity cannot create an account or link itself during sign-in. CI proves callback behavior without live Google credentials.

## Blocked by

- Proposed **0.2.1b — Recover owner access and enforce session re-authentication**. It provides the verified identity, local auth, sessions and recent-authentication guard; merge it before implementation. Use the assigned issue number/native blocker after publication.

## Sources and expected outcome

- [Roadmap](https://github.com/nishanthturnstile/aarili/blob/main/docs/Boutique_Business_Management_Implementation_Roadmap.md): 0.2.1 Google linking, environment separation and activation gates.
- [Product plan](https://github.com/nishanthturnstile/aarili/blob/main/docs/Boutique_Business_Management_Final_Product_Plan.md): §4 owner-only access; TRU-01; TRU-11 connection-control foundation; USE-01/02/09; §§29.1, 30.1 and 33. This does not complete Phase 2 invitations/ownership transfer or other integrations.
- [Architecture](https://github.com/nishanthturnstile/aarili/blob/main/docs/Architecture_and_Technology_Decisions.md): §§4–5.1, 6.2, 11.1, 11.4, 12.3 production-domain constraint and 15.

## Scope

Configure the Google provider on the pinned Better Auth version, with public email/password signup still closed, Google signup and implicit signup disabled, and implicit account linking disabled. Keep explicit linking enabled only for the authenticated verified owner, with matching verified provider email and an exact allow-list. Add only the focused connection control and Google sign-in affordance needed for this flow.

Exercise the real Better Auth routes/callback processing with a controlled synthetic provider transport. It may substitute provider responses at the network boundary, but must not replace application authorization/session/linking logic with mocks. Production provider configuration is disabled when its separately supplied credentials and approved exact origin are absent.

Out of scope: creating accounts via Google, extra scopes/providers, arbitrary allow-list administration UI, organization/admin/SSO plugins, One Tap convenience flows, passkeys, Google production-client creation, DNS changes, purchases, live provider calls and outbound email.

## Acceptance criteria

- [ ] **C1 — Explicit owner linking:** A verified owner with fresh authentication can initiate linking and complete a controlled callback for the matching, verified, exactly allow-listed provider email. It attaches to the existing user without creating another user or changing shop membership. Email/password sign-in remains available.
- [ ] **C2 — Closed signup:** Unapproved/new users cannot register through Google sign-in, signup-intent flags, direct callbacks or alternate exposed provider entry points. The provider's signup and implicit-signup controls are both active, and ordinary email/password signup remains closed. Assert unchanged identity/membership counts after each rejection.
- [ ] **C3 — No implicit linking:** Same-email sign-in for an unlinked identity is rejected until explicit linking succeeds. Different-email, absent/unverified-email and not-allow-listed cases fail on both link and sign-in routes. A provider's trusted status is not a substitute for checking its actual verified-email claim and the allow-list.
- [ ] **C4 — Callback/session security:** Missing, expired, tampered or replayed state/code, malicious callback/redirect origin, stale or revoked initiating authentication and an account already linked to another fixture user are rejected without partial account writes. Controlled concurrency cannot link one provider account to two users. Prove rollback on a failed account write.
- [ ] **C5 — Subsequent sign-in and disconnect:** Explicitly linked Google sign-in resolves the original authorized owner session. Removing Google with fresh authentication stops Google access while retaining the credential sign-in/recovery route. A direct request cannot unlink the remaining usable sign-in method. Allow-list removal is enforced on subsequent Google access.
- [ ] **C6 — Provider configuration and secrets:** Required scopes are only `openid email profile`, with separate per-environment clients and exact redirect URIs/origins. No wildcard production origins, implicit/insecure linking options, disabled state/CSRF checks or exposed client secrets. Provider tokens are excluded from browser artifacts, logs, error bodies and captures; any retained tokens use the pinned library's supported protection. Tests need no production secrets.
- [ ] **C7 — Accessible flow and activation record:** Connection/sign-in success and rejection flows pass Tamil/English, phone/tablet/desktop and keyboard/focus/axe checks. Record a separate owner-run activation checklist for the final domain, environment-specific OAuth client, credentials, exact callback and an authorized real-provider smoke test; controlled synthetic coverage does not claim production Google activation.

## Research and decisions during implementation

Confirm exact option names and callback hooks against Better Auth 1.7.7. Official pinned options confirm `account.accountLinking.disableImplicitLinking` permits explicit `linkSocial()` while denying automatic linking; OAuth signup closure needs separate controls. Verify all exposed provider paths and callback-time eligibility, rather than assuming configuration alone covers a modified account or revoked session. These are bounded implementation investigations, not a new choice of authentication architecture.

The owner supplies the approved identity/allow-list and exact production domain before real-provider activation. CI uses fictional identities. Do not create a Google Cloud client or change DNS as part of this issue without separate applicable authorization.

## Migration, isolation, history and recovery

Reuse auth account/session records and existing forced tenant policies. Provider unlink/relink changes must not alter the owner identity, initial-shop access or bootstrap completion. Preserve connection-change attribution without logging OAuth tokens. Any schema additions need reviewed migration SQL and compatible rollback. Missing provider configuration fails closed with email/password recovery retained. Auth sends remain blocked pending 0.3.2 suppression guards; Google integration does not authorize email activation.

## Verification and completion evidence

Run actual `pnpm verify`, `pnpm test:ui` and `pnpm audit --audit-level low`, including the real callback/session path, PostgreSQL link uniqueness/concurrency/failure tests, browser flows and private-configuration artifact checks. Map C1–C7 to fresh evidence and identify the unrun live-provider smoke as an activation step. Require the existing three hosted checks; use one focused `codex/` branch in the existing checkout. No merge, deployment or external service activation is authorised by green checks.
