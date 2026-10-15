# Issue #48 — remove foundation runtime examples

Evidence date: 15 October 2026. Branch `codex/foundation-demo-cleanup`, from
integrated main `b13f176`. PR/owner review remains required before merge.

## Prerequisite and implementation plan

The audit found #47 implemented in draft PR #49 and #48 unimplemented. After
owner authorization, #49 was reviewed, verified and squash-merged. GitHub closed
#47. Fresh `pnpm verify` passed (76 unit/property and 65 PostgreSQL integration
tests); `pnpm test:ui` passed all 48 cases in 4.5 minutes. Main was updated and its
production build and smoke checks passed before this branch was created.

The approved sequence is unchanged: remove runtime API examples, separate their
browser clients, remove default worker registrations, preserve explicit test
composition, then run the complete verification and browser suites. No new
product behavior or business policy is introduced.

## Acceptance and traceability

| Issue requirement / source | Implementation and proof |
| --- | --- |
| Removed command/documentation routes, USE-08/09; architecture §§6, 15 | `createApi` no longer imports or mounts command routes, in any environment. Unit coverage checks collection/item routes, documentation and the recent-auth probe with configured auth, seven HTTP methods and query strings across development/test/production. The owner middleware applies only to its actual namespaces and lets retired examples reach 404 before origin/query/auth processing. Development browser requests and standalone production smoke check the removed endpoints. Production owner browser fixtures also require 404 with auth configured. |
| Browser entry separation, architecture §§6.2–6.4 | Synthetic command methods/errors moved to `@aarili/api/command-fixture-client`; command contracts remain on their separate existing subpath. Ordinary `@aarili/api/client` retains real owner methods, authenticated transport, generation fencing, request cancellation and invalidation. Exemplar clients share that transport rather than duplicating it. The unused recent-probe browser method is removed. Money fixture transport remains separate. |
| Normal worker composition, architecture §§10–13 | Normal worker and opted-in development web runners use an empty handler registry and no scheduler callback. They still check the application role, queue schema and restore control, and retain bounded drain/shutdown and environment fencing. Queue connection is shared without selecting foundation queues. `@aarili/jobs/foundation-runtime` explicitly supplies synthetic and scheduled handlers, enqueue logic and inspection for tests/operator exercises. No environment switch installs exemplars. |
| Preserve queue behavior and negative/failure proofs | A real PostgreSQL test places synthetic work and a due schedule, runs normal worker and opted-in web composition, verifies empty handler lists and unchanged queue/effect/audit/schedule state, then proves explicit fixture composition consumes the queued work. Existing crash/retry/concurrency/restore/epoch/authority/schedule/redrive tests import that explicit composition. |
| Recent-auth coverage | The synthetic HTTP probe is removed from real owner routes. Test-only `scripts/test-support/owner-api.mjs` composes it explicitly. Recovery browser tests use their actual browser cookie with an in-process verification adapter, retaining stale/recent/expired assertions while all real sign-in/reset/reauthentication operations continue through the production web server. Private artifact cleanup and redaction remain. |
| Import audit | Application imports, including indirect helpers, cannot reach the known exemplar modules. Browser imports cannot consume command/job exemplar contracts. Boundary regression cases cover worker, server, browser and contract paths; existing server isolation rules remain. |
| RLS/history/money/recovery, TRU-01/06/12, AC-38/55; architecture §§8, 10–13 | Applied migrations, tenant policies, schemas, core policies and historical evidence are retained. Tests explicitly mount command routes for RLS/concurrency/idempotency/ETag proofs. Exact-money, journal, allocation, jobs and restore fixtures and inspection commands remain. No schema migration, table/data deletion, business rule, auth policy, credential or provider activation change. |

## Validation

- Final `pnpm verify`: passed lint, boundary/token guards, Knip, strict types,
  **80 unit/property tests**, negative type fixtures, offline OpenAPI generation,
  **66 real PostgreSQL integration tests**, production build, standalone HTTP
  readiness/outage/removed-route checks, normal worker readiness/shutdown, and
  all **19 browser artifact scans**. Integration duration: 355.42 seconds.
- Removed-route red/green check: a request against the pre-cleanup API composition
  at `b13f176` returned 403 instead of the required 404; the identical request
  against the cleanup composition returned 404. The baseline was loaded from a
  disposable verification file, without changing the checkout.
- Final `pnpm test:ui`: **48 passed (4.6 minutes)** across phone, tablet and
  desktop. Both languages/themes, all seven sign-in widths, font loading/fallback,
  keyboard/focus, axe, reflow, IME, storage failure, owner setup/recovery/Google
  flows, busy/failure states and private artifact redaction remain covered.
  Added HTTP assertions cover removed routes in the development server and in
  production-mode owner fixtures with auth configured.
- Fresh phone English/light, phone Tamil/dark and desktop English/dark captures
  were inspected; no clipping was observed. Existing curated #47 captures are
  retained. Settled appearance is preserved; the transient dialog correction
  below was discovered during subsequent CI validation.
- Normal worker smoke required `no job consumers registered; real providers
  disabled` and graceful shutdown, and rejected foundation handler names.
- `git diff --check`: passed. Final documentation-only lint is recorded in the PR.

The initial integration run passed 64 of 66 cases, including the new normal
worker/web non-consumption proof. Two recovery cases detected a double `/api`
prefix in the new test-only adapter. Correcting its relative route made all six
recovery integration cases pass in a focused rerun. A regression for adapter
composition also passed. Hono's current routing documentation was resolved and
fetched through Context7; `basePath` already prefixes later route registrations.
The final full suite passed after this correction; it changes no application route.

### Linux CI fixture follow-up

On `83f8263`, both Linux scaffold verification runs and audits passed, and one
Linux browser run passed all 48 cases. A second run timed out in English phone
recovery; its rerun timed out in Tamil phone setup while recovery passed. Both
runs passed their other 47 cases. The focused English phone case also passed
locally. No action stack or failure artifact was available from those timeouts.

Review found unread bodies in the fixture's added HTTP checks. Current Undici
documentation ([fetch resource guidance](https://github.com/nodejs/undici#garbage-collection)),
resolved/fetched through Context7, requires consuming or canceling
fetch bodies to avoid connection stalls. The fixture now consumes readiness and
removed-route responses and bounds those requests. Disposable web cleanup has
a bounded graceful wait, then force-stops only its own child; production graceful
shutdown remains independently asserted by smoke. Fixed phase-only diagnostics
preserve redaction and make later hangs localizable. This addresses concrete
fixture resource/cleanup defects; the original timeout location is not established.
No application code, test timeout, assertion or retry policy changed in this follow-up.
Lint, Knip, strict types and 80 unit/property tests passed again; final browser/CI
results for the correction are recorded in the PR.

### Selected-theme dialog correction (#47 acceptance follow-up)

After the fixture correction, one Linux run exposed an actual axe contrast
failure during the disconnect dialog's opacity transition: 3.76:1 instead of
4.5:1. The other complete Linux browser run and local suite passed, making the
timing-dependent defect easy to miss. A new browser regression holds the actual
dialog at an intermediate opening frame: it failed before the correction with
opacity `0.061332` instead of `1`. The popup now retains full opacity while its
existing translate animation runs; palette, fonts, geometry and focus/busy
behavior are unchanged. The regression checks both full opacity and axe at that
paused intermediate frame in both languages and all three device classes.
The Impeccable mechanical check found no issues in the changed stylesheet.
Final results are recorded in the PR before merge.

## Recovery and limits

Recovery is a source revert, with no schema or data rollback. Historical queues,
requests, audit records and restore epochs remain intact; normal startup leaves
them unconsumed. Explicit operator inspection/recovery commands retain their
existing authority checks. No deployment, live-data use or outbound provider is
enabled. All existing pilot/provider/privacy/recovery gates still apply.

Physical-phone software keyboard/zoom, shop lighting, Tamil screen-reader and
owner usability review were not run. Automated browser checks do not establish
physical-device acceptance. No new PDF, business workflow or recovery drill is
claimed by this cleanup.
