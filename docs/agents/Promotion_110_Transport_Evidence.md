# PR #110 — owner-entry redirect transport correction

19 October 2026. Part of the owner's existing authorization to resolve release
checks and merge the Services configuration promotion to main. No deployment,
production migration, live data or protection change is involved.

## Original result and diagnosis

Run [39221346149](https://github.com/nishanthturnstile/aarili/actions/runs/39221346149)
on `9cbdcd4` passed Scaffold verification, including real PostgreSQL, PDF,
production smoke and private-configuration canary, and Dependency audit. The
complete phone and desktop browser jobs also passed. Tablet completed **57
passing / 1 failing**; the required aggregate correctly failed.

The failing case is `ENTRY-01–12` in `tests/ui/owner-entry.spec.mjs`. An
authenticated read-only GET `/` redirect probe raised `ECONNRESET` before a
response could be asserted. It did not report an incorrect redirect, access
decision, application exception or assertion failure. Raw original job output
is retained only in ignored `.scratch/promotion-110-tablet-failure.log`; do not
publish its synthetic request headers.

## Bounded correction

`scripts/test-support/entry-redirect.mjs` supplies only the existing owner-entry
redirect probes with `{ maxRedirects: 0, maxRetries: 1 }`. Installed Playwright
1.64.0's documented request option retries only `ECONNRESET`, never HTTP response
codes, and throws when its bound is exhausted. No mutation request receives this
policy. Existing 307, destination, no-store, no private-shell, owner denial and
database-outage assertions remain unchanged. Playwright suite retries stay zero;
no timeout, status assertion, device gate or CI workflow is relaxed.

Current official documentation was resolved/fetched through Context7:
[request retry semantics](https://github.com/microsoft/playwright/blob/main/docs/src/api/params.md),
[request context lifecycle](https://github.com/microsoft/playwright/blob/main/docs/src/api/class-apirequestcontext.md).

## Verification and retained failures

Three tests exercise the actual shared helper against disposable loopback HTTP
servers and real destroyed sockets, without a browser, Docker or application
mock. The red run used the previous zero-retry behaviour: one reset failed to
recover, and a persistent reset stopped after one attempt; **2 failed / 1
passed**, exit 1. The unchanged HTTP-503 test already passed.

Adding only `maxRetries: 1` makes all **3/3 pass**, exit 0, **1.15s**. They prove
one-reset recovery still exposes the 307/destination, HTTP 503 is returned after
exactly one request, and repeated resets still throw after exactly two attempts.
Commands: `pnpm exec vitest run tests/entry-redirect.test.mjs`; logs
`.scratch/promotion-110-transport-red.log` and
`.scratch/promotion-110-transport-green.log`.

`pnpm lint` and `pnpm knip` exit 0, with 514 files plus boundaries, tokens and
static-PWA checks. Log `.scratch/promotion-110-transport-checks.log`.
`pnpm exec node scripts/test-ui.mjs tests/ui/owner-entry.spec.mjs` exits 0:
**3/3** complete owner-entry flows, **1.1m**, phone/tablet/desktop at 18.0s,
16.7s and 16.5s respectively. This includes both languages/themes, interrupted
onboarding, real redirects, cross-tab logout, membership denial and database
outage. Log `.scratch/promotion-110-entry-browser.log`. Disposable processes,
databases and private captures were cleaned by the established fixture.

Runtime/package/schema/dependency/build inputs remain unchanged. Earlier
passing promotion scaffold, phone and desktop evidence is retained as historical
evidence; the updated promotion still requires fresh complete release gates on
its exact new revision. Clean-install/portability extensions are not triggered.
Unrelated roadmap, order-intake research and quick-order prompt edits remain
outside this correction's commit.
