# Issue #13 — owner recovery and session evidence

Scope: W0 / 0.2.1b; product §4, TRU-01, USE-01/02/09, TRU-09 foundation only,
§§29.1, 30.1, 33; architecture §§6.2, 6.4, 8.7, 11.1, 11.4, 12.4, 15;
roadmap 0.2.1 with outbound activation gated on 0.3.2. No AC-57/team lifecycle,
Google linking, sensitive business commands, settings shell, worker, live data
or outbound transport is claimed.

## Starting state and decisions

The full approved issue had no comments. Its sole native direct blocker was
#12, closed through [PR #17](https://github.com/nishanthturnstile/aarili/pull/17),
merged on 13 October 2026 at 13:07:16 UTC. Clean local main matched origin at
`cd24ce1d0f375d56fdfd194704bae9693db77415`. Its
[main CI run](https://github.com/nishanthturnstile/aarili/actions/runs/38402458559)
passed all three required checks. Protection read-back retained strict
up-to-date checks: Scaffold verification, Browser smoke and accessibility,
Dependency audit. Integrated local main passed `pnpm verify` before branching.

Work uses the existing Windows checkout on `codex/w0-0.2.1b-owner-recovery`.
No worktree, additional feature checkout, unrelated edit, environment-file
change or GitHub setting change was introduced. Ignored local development
state remains preserved. The owner explicitly approved the 30-minute reset,
5-minute freshness, retained password/session policy and concrete PostgreSQL
abuse limits in this chat; see [Owner_Recovery_Runbook.md](Owner_Recovery_Runbook.md).

Context7 CLI resolved Better Auth, Next.js and Drizzle ORM before focused docs
lookups. Indexed Better Auth docs have no 1.7.7 version entry; the exact installed
1.7.7 password/session/internal-adapter source was inspected to resolve token
consumption, transactions and creation-time freshness. Native reset's entire
operation needs an outer transaction in this version, despite newer indexed
docs describing automatic endpoint-wide transactions. No dependency upgrade or
compiler correction was needed; the approved TypeScript 7.0.2 and existing
Drizzle declaration/esbuild compatibility fixes remain unchanged.

## Acceptance-to-evidence map

| Criterion | Fresh executable evidence |
| --- | --- |
| B1 existing eligible owner | `0.2.1b B1/B7` PostgreSQL test: unknown/seeded-other/unverified addresses get generic responses without captures; failed capture retries; separate process requests and redeems a code; new-password sign-in succeeds, old password fails, setup stays closed and provenance/membership survive. Six browser flows perform the complete recovery/sign-in journey. |
| B2 reset token lifecycle | `0.2.1b B2`: two separate Node processes concurrently redeem one token against real PostgreSQL; one success, one denial, replay/invalid/expired denial. Post-password checkpoint failure and a real database trigger failing session deletion roll back token/password/session writes; the same code succeeds on retry. Only one credential remains. |
| B3 session termination | `0.2.1b B3`: logout deletes only the current session and expires its cookie; old cookie replay fails. Reset revokes all sessions, including concurrent old-password sign-ins; expired cookies fail the next request. Bootstrap completion remains. Controlled HTTPS test proves Secure/HttpOnly/Lax rotation, no bearer response, old-cookie denial. Browser tests exercise expiry and sign-out. |
| B4 fresh authentication | `0.2.1b B4`: shared service guard denies missing/stale sessions before its callback, checks actual tenant context, forces native automatic renewal and proves it does not refresh creation-time freshness. Injected clock checks the exact boundary. Re-auth rotates/revokes the old cookie, rollback preserves the old session, successful confirmation admits the probe; missing membership denies the callback. Submitted ID/time cannot establish authority. |
| B5 boundaries/abuse/secrets | `0.2.1b B5`: unsafe/missing origins, forwarded-header spoofing, malformed/URL codes, redirect fields and native reset bypass fail. Real concurrent application limits permit exactly 3 requests or 5 redemption/reauth attempts; new instances and separate restarted processes retain counters. Responses/logs redact canaries. Browser forms never send to third parties, remove transient fragments, and clear codes after success. Failure-artifact canary checks strip private matcher snapshots and redact the thrown error. |
| B6 bilingual accessible recovery | Tamil/English phone/tablet/desktop browser flows cover recovery, reset error/success, wrong password, stale confirmation, re-authentication, expiry and sign-out with keyboard/focus/axe and no overflow. Empty-form captures contain no secrets. Browser storage, Cache Storage and service-worker assertions stay empty. Unit regressions prove pending reads cannot repopulate an old identity even when abort is ignored, including reads started during sign-out and late 401s. |
| B7 outbound disabled | Environment tests reject accidental provider credentials as activation; real web fixtures include unusable Resend/SMTP canaries but only write private local captures and make no third-party browser requests. No transport SDK/worker added. Runbook explicitly retains 0.3.2 suppression and domain/DNS/provider approval plus restore/privacy/pilot gates. |

## Isolation, history, migration and recovery review

Schema/model files and reviewed SQL are unchanged: the existing auth/session/
verification tables already support this adapter. Existing app_owner/advisory
migration tests and app_user/RLS negative tests run in `pnpm verify`; no privileged
credential enters the auth/web process. Sensitive probes use own-membership
checks and transaction-local user/shop/actor context before their callback.

The reset wrapper uses a transaction-bound native adapter and database advisory
serialization shared with sign-in/re-authentication. Session revocation cannot
leave an old-password sign-in usable after reset. Sensitive work locks/rechecks
the database session inside its tenant transaction, so revocation is ordered
with the operation. Credential/session changes do not rewrite immutable
bootstrap/shop provenance or erase membership. No money/property/document
effects or general audit/idempotency foundation are added in this slice.

Retain the additive existing schema on application rollback; no down migration,
account deletion, setup reset or live restore is authorised. A lost successful
reset response is recoverable by trying the new password or requesting another
code. No email/human wait holds an admission/reset transaction open.

## Verification and limitations

Fresh native Windows checks on 13 October 2026:

| Command | Result |
| --- | --- |
| `pnpm verify` | Passed Biome, import/token boundaries, Knip, strict types, unit and negative-type suites, 17 real PostgreSQL integration tests, web/worker production builds, readiness/outage/shutdown smoke and 26 browser-artifact canary scans. |
| `pnpm test:ui` | Passed all 39 tests: existing design/health/bootstrap checks, six complete bilingual recovery/session workflows and three failure-artifact canary checks. |
| `pnpm audit --audit-level low` | Passed; no known vulnerabilities, including development dependencies. |
| Impeccable detector / visual review | No mechanical findings; manual cleared-state phone/tablet/desktop capture review uses the existing shared controls/tokens/fonts. |

Earlier failed checks were repaired, not suppressed: Knip needed the separately
spawned test process declared as an entry; raw SQL timestamps required runtime
Date conversion; fixtures needed own-member context and fresh abuse counters;
same-page fragment navigation needed event cleanup and language selection needed
to respect existing locale state. The first browser run was interrupted after
these failures to rebuild the corrected output. Later full browser evidence
supersedes that incomplete run. Failure artifacts are sanitized before reporting.

Hosted Linux checks on the draft PR supply Linux fixture evidence; their result
is reported with the PR. Physical Android/Tamil screen-reader review, live
restoration, Tamil PDF/search golden gates and production activation are not run
or claimed for this auth increment. The unchanged dependency graph uses the
existing frozen-install CI; a separate `verify:clean` clone/install run is not
repeated here. Integrated main after merge is deliberately not run because the
owner has not authorised merge. All three existing hosted checks and owner
review remain required before merge.
