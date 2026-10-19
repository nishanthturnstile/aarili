# PR #110 — logout navigation synchronization

19 October 2026. Release-check repair under the owner's existing merge
authorization; no production, schema, dependency or application change.

## Retained failure and correction

[Run 39226379586](https://github.com/nishanthturnstile/aarili/actions/runs/39226379586)
on `f03780a` passed Dependency audit and the full phone and desktop browser
jobs. Tablet passed 57 tests and failed the commitments access scenario with
`page.goBack: net::ERR_ABORTED`. The required browser aggregate correctly failed.
The earlier owner-entry redirect-reset case passed.

The commitments test clicked Sign out, waited only for a private field to
disappear, then immediately navigated Back. The application clears private
state while its asynchronous sign-out still resolves and assigns `/sign-in`.
Field absence therefore does not establish navigation completion. The test now
asserts the exact sign-in URL before Back and again afterwards, retaining both
private-field absence checks. This follows the already-established owner-entry
logout sequence. No exception is swallowed, timeout increased or retry added.
Suite retries remain zero and all three device gates remain required.

Current Playwright documentation resolved and fetched through Context7:
[URL assertions](https://github.com/microsoft/playwright/blob/main/docs/src/api/class-pageassertions.md)
and [history navigation](https://github.com/microsoft/playwright/blob/main/docs/src/api/class-page.md).

## Separate scaffold diagnostic

The same run passed 230 unit tests and 148 integration tests; the remaining
integration failure was the disposable PostgreSQL port-closed assertion during
media-maintenance fixture teardown. No domain assertion failed in that case.
The cleanup assertion remains unchanged. A targeted diagnostic,
`pnpm exec vitest run --config vitest.integration.config.ts tests/media-maintenance.integration.test.mjs tests/database-health.integration.test.mjs`,
passed **5/5**, two files, **38.83s**, exit 0. Log:
`.scratch/promotion-110-cleanup-diagnostic.log`.

An attempted single-job rerun was rejected by GitHub because the workflow was
still running; no retry was accepted. The new promotion revision will instead
receive all fresh release checks. A repeated cleanup failure requires further
lifecycle diagnosis, not repeated retries until green.

## Verification

`node scripts/test-ui.mjs tests/ui/shop-commitments.spec.mjs` passed **3/3**,
phone/tablet/desktop, **1.4m**. The first PowerShell wrapper reported an error
for a harmless stderr color warning despite all tests passing. A confirmation
invocation explicitly captured `$LASTEXITCODE`: **0**, **3/3**, **1.4m**
(21.4s / 21.4s / 22.5s). Log:
`.scratch/promotion-110-logout-navigation-confirmed.log`. This complete scenario
retains preview, unknown-value, reason, IME, recovery, replay, immutable-history,
access and logout checks. All disposable fixtures cleaned up.

`pnpm lint` and `pnpm knip` passed, exit 0, including 514 files,
boundaries, tokens and static PWA validation. Runtime, package and build inputs
remain unchanged; hosted Fast verification and audit still gate this repair's feature
PR, and all full release checks must pass on the updated promotion revision.
Unrelated roadmap, delivery measurements and order-intake/quick-order research
edits are excluded.
