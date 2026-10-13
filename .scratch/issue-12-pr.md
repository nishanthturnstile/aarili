Closes #12

The scaffold had no owner admission or tenant records. This adds protected synthetic setup that reserves exactly one email/password owner, verifies a single-use code, signs in through database sessions and atomically creates the initial shop/membership. Pending setup survives failed capture and process restarts; completed setup cannot reopen.

Scope: W0 0.2.1a; product §4, TRU-01/BIZ-01 foundation and USE-01/02/09; architecture §§6.5, 8.1–8.2, 11.1–11.2, 11.4, 12.4 and 15. Direct blocker #6 is merged through #11; integrated main passed before branching. Only the existing checkout is used. The initial untracked `.scratch/` is preserved; no other local main edits/commits existed to include.

### Behavior and boundaries

- Closed public signup; private Better Auth provisioner bound to the actual Drizzle transaction, using library password handling and UUIDv7 identities. PostgreSQL admission serialization plus immutable request binding; injected failures prove complete rollback.
- Private synthetic file capture, opaque POST-body codes with hashes/expiry/one-time consumption, pending resend and restart recovery. No outbound transport or public mail-debug endpoint. Explicit loopback-only synthetic activation.
- Exact origins and explicit library CSRF/origin checks even in test mode. PostgreSQL application limits and Better Auth database limits persist across processes; forwarded headers cannot select a new bucket. Approved password/session/rate policy is recorded in the runbook.
- Database sessions, no cookie caching or bearer JSON, HttpOnly/Lax cookies with Secure on HTTPS and explicit no-store auth responses. Sign-out revokes the session and clears the owner page's memory through navigation.
- First shop/membership migration enables and forces RLS, with non-null shop keys, shop-led constraints and own-membership reads before shop context. Runtime is verified as app_user with no elevated privileges. The only tenant-write exception is a narrowly granted, reserved-owner-only completion function. No ordinary membership grant is exposed.
- Tamil/English client-rendered setup, verification, sign-in and pending-shop/error states reuse canonical controls/tokens/fonts. A separate verification dev output preserves the owner's existing dev server.

### Acceptance evidence

| Criterion | Evidence |
| --- | --- |
| A1 protected admission | Missing/wrong token, unsafe/missing origin, existing identity, invalid input and URL token denied; ordinary/direct library signup closed; secret canary, no-browser-storage and disabled-JavaScript POST-fallback checks |
| A2 one owner | Eight concurrent admissions yield one identity/credential, keyed replay/conflict checks, six concurrent completions yield one membership/shop, fault injection after each admission write |
| A3 recovery | Failed capture retains reservation; a new Node process resumes it; invalid/expired/replayed codes denied; unverified access denied; verification rollback and pending-shop resume |
| A4 permanence | Atomic shop/membership/completion, completion rollback, restart/retry returns original shop, runtime reset denied, setup-variable removal documented |
| A5 first tenant records | Real app_user, forced-policy catalog checks, second synthetic user/shop, own membership, denied cross-shop reads/grants and cleared pooled/rollback context |
| A6 sign-in | Verified sessions, matching wrong/unknown credential failures, expiry/revocation, real certificate-validated HTTPS Secure/HttpOnly/Lax/no-store/no-cache/no-bearer evidence |
| A7 origins and abuse | Exact origin + library CSRF checks, concurrent limits retained in a fresh Node process, spoofed forwarded headers denied fresh buckets, no Redis/organization plugin |
| A8 operational/UI | Reviewed advisory-locked migration runner with separate owner credentials, privileged runtime denial, clean native install, all language/device flows plus existing checks; hosted Linux gates below |

Local verification passed:

- `pnpm verify`: Biome, boundaries/tokens, Knip, strict typechecks, 31 unit tests, eight DTO/client negatives and Base UI negatives, 10 PostgreSQL tests, production build, smoke and 26 artifact scans.
- `pnpm test:ui`: all 30 tests passed, including six actual owner workflows with independent PostgreSQL/production web processes, keyboard/focus/axe and no persistent browser storage.
- `pnpm audit --audit-level low`: no known vulnerabilities.
- `pnpm verify:clean`: frozen native install and complete verification in a temporary path with spaces, without host node_modules/private env; lockfile unchanged.
- Pinned `drizzle-kit generate` after the audit fix: no schema changes. Mechanical UI detector: no findings. Four flow states captured and reviewed using the existing visual system.

### Compatibility, migrations and recovery

The owner approved a declaration-only pnpm patch for Drizzle 0.45.4 plus pinned dev-only optional type dependencies (gel 2.2.1, isolated bun-types 1.4.3). The patch restores types present in runtime and removes private keys from public exclusions; it changes no runtime JavaScript. TypeScript 7.0.2, strict declarations, exact optional properties and skipLibCheck=false remain. The exact nested esbuild 0.25.12 override fixes GHSA-67mh-4wv8-2f99 in drizzle-kit's legacy loader; the generator was retested. No driver/service other than PostgreSQL is used.

Migrations are additive, reviewed, hash-tracked, advisory-locked and run as app_owner on the verified PostgreSQL 18 baseline. Retained synthetic volumes upgrade without replaying container initialization. The disposable fixture uses independent admin/migration/runtime passwords. app_user has no direct tenant writes; global auth/bootstrap/limiter exceptions are explicit. Bootstrap reservation/completion provenance is immutable. No money, stock, custody, document or worker effects are introduced. Roll back only to compatible application code, keeping schema/data; no account deletion, setup reset, destructive down migration or live restore is authorized.

Runbook and full evidence: `docs/agents/Owner_Bootstrap_Runbook.md`, `docs/agents/Issue_12_Owner_Bootstrap_Evidence.md`. Roadmap traceability is updated for this bootstrap portion only.

Remaining limits: synthetic-only; Windows private capture ACLs require operator provisioning. Physical-device/screen-reader review, live domain/credentials, outbound email, Google, broader account recovery/re-authentication, comprehensive tenancy/general command contracts and live restore/pilot gates remain separate. No deployment, external activation, merge or next issue is authorized.

### Hosted Linux verification

All three required checks passed for commit `d802a26d85e0c0e1091b719bac6c7552c380f54d`, on both the [push run](https://github.com/nishanthturnstile/aarili/actions/runs/38392319691) and [PR run](https://github.com/nishanthturnstile/aarili/actions/runs/38392335807):

| Required check | PR evidence |
| --- | --- |
| Scaffold verification | [Passed](https://github.com/nishanthturnstile/aarili/actions/runs/38392335807/job/115278929259): complete verification plus private-configuration canary build |
| Browser smoke and accessibility | [Passed](https://github.com/nishanthturnstile/aarili/actions/runs/38392335807/job/115278928739): 30 Chromium/axe tests with disposable PostgreSQL |
| Dependency audit | [Passed](https://github.com/nishanthturnstile/aarili/actions/runs/38392335807/job/115278929031): no known vulnerabilities at low threshold |

No failed or skipped required checks remain. The three required check names and protection are unchanged; owner review is required before merge. This PR remains draft; no merge, deployment or external activation occurred.
