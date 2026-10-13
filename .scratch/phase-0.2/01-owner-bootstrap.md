# [W0 0.2.1a] Bootstrap one verified owner and the initial protected shop

**Status:** Draft awaiting owner approval. Proposed publication label: `ready-for-agent`.

**Wave / phase / source slice:** Wave 0 → Phase 0.2 — Protect Identity, Tenancy and Business Commands → 0.2.1 — Bootstrap and Recover the Owner Account, bootstrap portion.

## What to build

The owner can use protected setup to create one email/password identity, verify it through local synthetic email capture, create the initial shop and sign in. Concurrent requests, interrupted verification and process restarts cannot admit a second owner or leave setup irrecoverable. Completed setup remains closed.

## Blocked by

- [Issue #6 — scaffold CI and required main checks](https://github.com/nishanthturnstile/aarili/issues/6), merged through PR #11. Its prerequisite issues #2–#5 are also merged. Reconfirm integrated main and required CI before implementation.

## Sources and expected outcome

- [Roadmap](https://github.com/nishanthturnstile/aarili/blob/main/docs/Boutique_Business_Management_Implementation_Roadmap.md): 0.2.1; first-tenant-table prerequisite in 0.2.2.
- [Product plan](https://github.com/nishanthturnstile/aarili/blob/main/docs/Boutique_Business_Management_Final_Product_Plan.md): §4 owner-only access; BIZ-01 shop-creation foundation; TRU-01 isolation; USE-01/02/09; §§29.1, 30.1 and 33. AC-38 receives initial isolation evidence here and comprehensive foundation coverage in 0.2.2; full BIZ-01 onboarding is later.
- [Architecture](https://github.com/nishanthturnstile/aarili/blob/main/docs/Architecture_and_Technology_Decisions.md): §§5.1, 6.2, 6.4–6.5, 8.1–8.2, 11.1–11.2, 11.4, 12.4 and 15.
- Approved compiler correction: issue #2 explicitly targets TypeScript 7.0.2; its merged evidence and #3–#6 preserve that decision despite the older 6.x source snapshot. Retain the implemented compiler and compatibility fixes.

## Scope

Introduce the real auth and database boundaries, reviewed migrations and narrowly scoped bootstrap state. Use the prescribed Better Auth, Drizzle SQL-style queries and pg versions after exact compatibility verification. Use Better Auth's database limiter for auth and the prescribed PostgreSQL-backed application limiter for the protected setup/API path when it is needed here; neither may fall back to process memory or Redis. Add only the owner setup, verification and sign-in surfaces using existing shared controls, tokens and fonts.

Shop creation needs the minimum 0.2.2 protections now: non-null tenant identifiers, tenant constraints, forced read/write RLS, own-membership checks and transaction-local context. The later tenancy issue extends these foundations and their coverage; it does not replace an interim unprotected schema. Keep the bootstrap admission/provisioning exception confined to auth, with a reviewed initial-membership write path that ordinary callers cannot use to grant membership.

Public signup stays closed on the ordinary auth surface. Bootstrap admission requires both no existing identity and the one-time setup token; completion resumes for the same reserved identity through verification/sign-in, without reopening user creation. Local mail capture is private, synthetic and unavailable as a production debug endpoint. Real outbound transport remains disabled.

Out of scope: Google linking, password recovery beyond the pending-verification resend needed here, sensitive-action re-authentication, team invitations, role matrices, shop switching UI, full onboarding/practice UX, billing, workers, cloud provisioning, Resend sends and production activation.

## Acceptance criteria

- [ ] **A1 — Protected admission:** Missing/wrong setup token, unsafe origin, existing identity or completed setup prevents new user creation. The token is absent from browser bundles, persistent browser storage, URLs, logs and error bodies. The ordinary email/password signup endpoint stays disabled, including direct HTTP calls.
- [ ] **A2 — One owner under concurrency:** Real PostgreSQL concurrent setup attempts create exactly one identity/credential pair and one initial owner membership. Invalid input or a failed write leaves no partial admitted account or membership. Database serialization/constraints enforce admission; an in-memory flag is insufficient.
- [ ] **A3 — Verification and restart recovery:** Unverified identity cannot access the shop. Expired/invalid/replayed verification tokens fail appropriately. A failed local mail capture or a restart between identity reservation, verification and shop creation allows the same owner to resume, without deleting accounts, relaxing signup or creating a second owner. Do not hold a transaction open while waiting for email or human verification.
- [ ] **A4 — Permanent completion:** Shop creation and owner membership complete consistently; the database completion flag persists across restarts and prevents setup reopening even if the setup variable remains present. Document removal of the setup variable after authorised completion. Preserve completion provenance and do not turn normal restart into setup reset.
- [ ] **A5 — Protected first tenant records:** The shop root and membership schema have the relevant non-null tenant keys, shop-led constraints/indexes and enabled/forced policies from their first migration. Own-membership reads work with user context before shop context; another user cannot read the membership or create/grant their own membership through normal runtime operations. Seeded unauthorized-user/shop tests prove denial.
- [ ] **A6 — Secure sign-in:** Database sessions resolve on the server; cookie caching is disabled. Verified owner sign-in works, incorrect credentials fail without account enumeration, and protected API access cannot rely on client state or proxy routing. Cookies are HttpOnly, SameSite=Lax and Secure on HTTPS; test Secure behavior on a controlled HTTPS surface and document any loopback-only development handling without weakening production.
- [ ] **A7 — Origin and abuse protection:** Exact configured origins, library CSRF protections and application origin checks cover unsafe setup/auth requests. Database-backed rate limiting is explicitly enabled in synthetic verification as well as production configuration; concurrent/restarted processes cannot bypass it. Spoofed forwarded headers do not establish trust. No wildcard production origins, public setup escape hatch, Redis or auth organization plugin.
- [ ] **A8 — Reproducible operational and UI evidence:** Reviewed migrations run under migration credentials with advisory locking, while ordinary web/auth access uses non-owner `app_user`. Native Windows and Linux tests use the existing disposable PostgreSQL fixture. Setup, verification, sign-in and recoverable errors pass Tamil/English, phone/tablet/desktop, keyboard/focus and axe checks. Existing health, design-system and artifact checks remain green.

## Research and decisions during implementation

Before auth code is written, inspect the exact pinned Better Auth provisioning APIs, ID generation and transaction binding. Official 1.7.7 source exposes opt-in Drizzle adapter transactions; public `disableSignUp` also blocks ordinary server signup calls. Do not assume calling the public signup API bypasses closure, or that an after-hook shares the application transaction. Use a private auth-bound provisioner with library password handling and prove its database boundary through injected failures. If no safe implementation fits the approved boundaries, report the concrete blocker before adding a plugin or changing architecture.

The database admission/resume mechanism is an implementation detail. The owner must approve the concrete strong-password and initial session/rate policy configuration before those consequential values are finalised; ticket publication does not approve unspecified numbers. Synthetic tests may parameterise boundaries without establishing live policy. Exact production domain/origins and sealed credentials remain activation decisions.

## Migration, isolation, history and recovery

Reuse existing `app_owner`/`app_user` local provisioning; provide upgrades for retained synthetic volumes rather than assuming container init scripts rerun. Auth identity/session tables are the documented isolation exception and remain accessible only through auth. Bootstrap control metadata is global installation state; explicitly document and narrowly grant it rather than exempting business tables from RLS. Never place migration, backup or privacy credentials in web/worker runtime. Application rollback must remain schema-compatible; no destructive down migration, account deletion workaround or live restore is authorised.

## Verification and completion evidence

Run the actual `pnpm verify`, `pnpm test:ui` and `pnpm audit --audit-level low`; extend their real suites rather than creating dummy passing gates. Include real PostgreSQL duplicate-admission, rollback, membership-grant and process-restart tests; API origin/rate/cookie tests; browser accessibility and secret-canary evidence. Report each A1–A8 criterion separately, failures and checks not run. Require the three existing hosted checks on the PR and verify integrated main after an owner-authorised merge. Work in the existing checkout on one focused `codex/` branch. This issue authorises no deployment, outbound email, OAuth activation, production data or automatic merge.
