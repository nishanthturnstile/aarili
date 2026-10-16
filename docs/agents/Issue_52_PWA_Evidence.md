# Issue #52 — Online-only PWA evidence

Slice 0.4.1b, product USE-01/03/04/09 and AC-40 foundation; architecture
§§7.2–7.3, 11.4 and 15. Prerequisite #51 was closed by merged PR #61.
Implementation started from clean integrated main `0ba3828` in the existing
Windows checkout. No migrations, new dependencies or hosted resources.

## Behaviour and acceptance

| Criterion | Implementation and evidence |
| --- | --- |
| B1 | Next manifest starts at `/owner`, standalone display, stable app identity, 192/512 PNG and separate maskable declaration. Theme metadata and icons derive from the canonical CSS. Browser checks load all icons and verify a signed-out start exposes no workspace navigation and offers normal sign-in. Standalone smoke checks copied public assets and manifest. |
| B2 | Hand-written worker writes exactly `/offline.html`, `/pwa/offline.css`, `/pwa/latin.woff2`, `/pwa/tamil.woff2`. Actual secure-loopback Chromium Cache Storage is inspected; API/auth, private file and signed requests fail offline rather than receiving cached content or HTML. Owner recovery, Google and access-loss suites assert the same exact allowlist after private flows. |
| B3 | Live bilingual notices preserve the open form and explain uncertain outcomes without claiming a save or automatically sending work. Static fallback shows both languages and explains that committed server work is safe but a previous page's unsaved values are unavailable. Reconnect links perform ordinary online navigation. Both themes and all three viewport classes have axe/reflow coverage. |
| B4 | Shared memory-only multi-workflow guard tracks dirty/in-flight/outcome-unknown flags. Update notice is hidden while any flag is set. There is no activation/reload button, `skipWaiting`, `clients.claim`, controller-change reload, or mutation queue. The update waits for **all** controlled tabs to close, becomes eligible to activate after the last controlled tab closes; reopening uses the updated worker. Browser tests change actual worker bytes, preserve Tamil input, hold a second tab open, and verify activation/cache cleanup only after the last tab closes. A test-only proxy exercises the production React notice, registration retry and dirty-form suppression. |
| B5 | Registration rejection and incomplete asset installation become visible unavailable states with explicit retry. A failed initial install deletes its partial Aarili cache. Activation removes only old `aarili-offline-` caches and unexpected entries in its own cache; an unrelated cache survives. No worker or unrelated data is deleted during normal startup. |
| B6 | `tests/ui/pwa.spec.mjs` uses a separate test-only host for uncertainty and worker revisions; it never enters normal startup. English/Tamil and light/dark run at phone 360×800, tablet 820×1180 and desktop 1440×1000. Existing owner suites retain their privacy checks with a stricter exact static cache/worker allowlist in place of the pre-PWA empty-cache expectation. |

The fallback is a generated static document, with self-hosted Noto Sans and
Noto Sans Tamil 400 from the existing Fontsource pins. It has no JavaScript,
identifier, cookie-dependent rendering or third-party fetches. Its dark variant
uses the device colour-scheme because it deliberately does not read browser
preferences. The live page keeps the owner's existing explicit appearance
preference. PNGs are deterministic A monograms drawn by
`scripts/generate-pwa-assets.mjs`, using canonical light-theme primary/primary-foreground colours;
no sourced or generated photographic artwork is included. Font licensing remains
under the existing Fontsource/OFL dependencies; both original copyright/license
notices accompany the public copies as `pwa/OFL-noto-sans*.txt`. They are not
added to Cache Storage. A final artifact-only scan including these license
notices passed across **29 artifacts**; application code and rendered assets
were unchanged from the full verification/browser runs.

## Validation record

Final stable-code checks on 15 October 2026:

- `pnpm verify` — exit 0; lint/boundaries/tokens, Knip, strict types, **89 unit
  tests**, negative checks/OpenAPI, **66 real PostgreSQL tests**, production
  build, standalone Next/Hono/PostgreSQL/worker smoke and **27 artifact scans**.
  The log spans approximately **13 minutes 50 seconds**; the PostgreSQL suite
  reports **664.12 seconds**. No browser suite overlapped it.
- `pnpm test:ui` — exit 0, **63 passed**, reporting **11.9 minutes**. Includes
  existing owner flows and all nine new PWA scenarios across three screen classes.
- `pnpm audit --audit-level low` — no known vulnerabilities.
- `git diff --check` — clean. PNG/WOFF2 files have explicit binary Git attributes
  so Windows/Linux checkout preserves their bytes.
- Existing CI runs the frozen clean Linux install, full verification, browser
  suite and audit. A separate duplicate local clean-install suite was not run;
  there are no dependency or lockfile changes. Remote results remain PR checks.

Development checks included baseline lint/type checks and 87 passing unit tests, targeted
guard/boundary tests, actual worker lifecycle tests and production owner notice
checks. The first production-notice attempt used the wrong existing sign-in link
label; the locator was corrected without changing application copy or assertions
about authorisation. No timeouts or security assertions were relaxed.
The first fallback captures applied dark emulation to the wrong tab; this
test-only setup was corrected before the final full browser run. Final captures
show distinct light/dark fallback renders. The bounded mechanical design scan
returned no findings; all twelve final captures were opened and checked.
The independent finish review returned **ship**, with no material fixes, for
these twelve captures and the scoped PWA extension. It does not certify the
outstanding physical-device or fluent Tamil checks.

Representative captures are retained in [pwa/captures](pwa/captures/phone-fallback-light.png):
static bilingual fallback and live Tamil notice in both themes at all three sizes.

## Install, update and recovery

Use HTTPS in hosted environments. Loopback is a browser-trusted secure context
for automated verification (`isSecureContext` is asserted). On supported Chrome,
use the browser's **Install app / Add to Home screen** menu after opening the
online app. Installation UI availability and names vary by browser. No custom
install prompt or notification permission is required. Launching while signed
out still requires normal authentication. Installation is optional for online
browser use.

For an update, finish/check outstanding work, close every Aarili browser or
installed-app window, and reopen online. Reloading a tab alone is not promised
to activate a waiting worker. Updates never reload a page automatically. Manually
closing or navigating away can lose unsaved values: these are held only by the
open page, not durable device storage. Server draft recovery arrives in #55–#56.

When changing any fallback content, fonts or styling, regenerate with
`node scripts/generate-pwa-assets.mjs` and increment the cache version in
`apps/web/public/sw.js`. `pnpm tokens` checks all eight generated artifacts for
drift. Versioning retains old assets in their old cache until the new worker can
activate safely. If installation fails, online use remains available and the
notice offers retry. A connection-restored hint is not proof that a request
committed; check its result before retrying.

Recovery is a compatible application revert, followed by the same safe worker
update lifecycle. If manual recovery is necessary, first resolve/preserve open
work, then use browser Application tools to unregister only the root worker
whose script is this origin's `/sw.js`, and remove only caches prefixed
`aarili-offline-`. Reopen online. Never clear all site/browser storage or
unregister unrelated scoped workers. No business records or immutable history
are changed by this slice; authorisation and tenant transactions remain server
enforced.

## Remaining phase review

Physical Android installation/reopen/airplane-mode review over temporary local
HTTPS and fluent Tamil review of the **new** notices remain explicit phase
closeout checks. Prior Pixel 8 shell readability feedback does not establish
these PWA checks, native Tamil composition, TalkBack or the agreed 3–4 GB profile.
No live records, hosted activation or deployment is authorised by this evidence.

Implementation references: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
for manifest/manual worker headers, and [MDN worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
for waiting/activation. The implementation deliberately omits the force-activation
behaviour described by [skipWaiting](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting).
