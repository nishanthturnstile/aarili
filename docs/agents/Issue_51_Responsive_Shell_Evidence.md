# Issue 51 responsive bilingual owner shell evidence

Slice 0.4.1a, [issue #51](https://github.com/nishanthturnstile/aarili/issues/51).
The owner approved the ten-slice Phase 0.4 plan and requested implementation on
15 October 2026. Issues #51–#60 were published with verified bodies, labels and
native blockers. Work proceeds sequentially; this change implements #51 only.

## Prerequisites and scope

Main started at `e848210`. Direct prerequisites #3, #12–#15, #47 and #48 are
closed with merged PRs #8, #17–#20, #49 and #50. The checkout remains the owner's
single existing workspace, on `codex/responsive-owner-shell`. No additional
checkout/worktree or deployment is used.

Sources: product USE-01/02/09, TRU-01, §§32.1/33.1; architecture §§5.2,
6.2–6.4, 7.1, 8.2, 9.2 and 15; roadmap 0.4.1; selected design system.
The [phase implementation plan](Phase_0_4_Implementation_Plan.md) and individual
ticket bodies retain later boundaries. PWA, search/vocabulary, observability,
drafts, media and PDFs remain #52–#60. This is not phase closeout.

## Acceptance mapping

| Criterion | Implementation and evidence |
| --- | --- |
| A1: preserve owner behavior | Existing setup, sign-in, recovery, reset, reauthentication and Google flows reuse the same typed clients/server operations. The complete owner browser suite and removed-route checks cover them. Synthetic records/routes/consumers remain disconnected. |
| A2: shared language | New framework-free i18n package owns the existing English/Tamil catalogues with a typed Tamil key mapping and parity test. Both self-hosted Noto families/pins and selected themes remain. Fresh loads/navigation still start English; explicit Tamil switching preserves typed values. Existing startup/font/IME tests remain. |
| A3: responsive navigation | Verified complete owner/shop state exposes only Your shop and Sign-in connections. Phone uses fixed bottom navigation; tablet a collapsible rail; desktop a full sidebar with the current shop's untruncated name. No invented business destinations or shop-switch UI. The new owner-shell browser scenarios exercise both tablet orientations and all three screen classes. |
| A4: memory and access isolation | Each mounted surface owns its QueryClient. Keys contain the server-authorised shop and access epoch. Bootstrap is uncached until authority resolves. Sign-out, membership denial, auth invalidation, detected shop change and unmount abort reads and clear Query data. Components clear private values and ignore invalidated completions. Unit tests cover transport ignoring cancellation, second synthetic shop, same-shop new epoch and unmount; browser tests cover failed sign-out removing name/navigation. |
| A5: typed transport/boundaries | Owner-shop/Google reads accept optional AbortSignal combined with the transport's signal. Existing generation checks remain. SHOP_ACCESS_DENIED 403 now invalidates memory; unrelated permission denial does not. Current/synthetic transport boundaries and browser artifact scans remain; an added regression rejects an i18n export that reaches db. Build scripts, frozen lockfile and verification Docker manifest include i18n. |
| A6: accessible presentation | Shared Base UI Button and existing tokens/fonts provide both themes. Navigation has explicit labels, current-page text/underline, keyboard skip link and tablet expand/collapse semantics. Tests cover 44px controls, axe, focus, 200% text, reflow, phone/tablet/desktop and portrait/landscape. Existing dialog animation/keyboard/font/IME coverage stays. Physical screen-reader/Android review is still required during this phase. |
| A7: privacy and measurements | No persister, IndexedDB, service worker, behavioral tracker or URL filter is added. Theme remains the only persisted preference. New browser cases inspect local/session/IndexedDB/Cache Storage and produce synthetic first-usable/warm-navigation timings; these are desktop Chromium emulation, not physical-device performance claims. |

## Dependency and documentation checks

TanStack Query is pinned to the architecture's 5.104.2, with query-core at the
same version. No baseline upgrade or package build-script activation was made.
The only new workspace is the planned i18n boundary. Existing Next 16.4.0,
next-intl 4.14.9, TypeScript 7.0.2 and declaration/route compatibility corrections
remain. Current Next bundled client-component/Query documentation and Context7
TanStack Query/next-intl guidance were read before their APIs were used.

All ten issue bodies and native blocker relationships were read back after
publication. The initial planning link/section check found ten tickets, 77
acceptance criteria and 40 resolving local links. Publication status is recorded
in each local ticket copy. The final check covers 14 documents and 70 local links,
including capture/measurement files; all targets resolve.

## Verification record

Verification ran on native Windows with Node 24.21.0/pnpm 12.11.2 and disposable
Linux PostgreSQL containers. No completion claim relies on the intermediate
runs below. The final aggregate command exited 0 on 15 October 2026.

| Command | Result |
| --- | --- |
| `pnpm verify` | Exit 0 on settled source: lint/boundaries/tokens, Knip, strict types, 87 unit/property tests, negative type checks/OpenAPI, 66 real PostgreSQL tests (418.68 seconds), production build, real PostgreSQL/Next/Hono/worker smoke and 19 browser artifact scans. The run was sequential, without an overlapping UI build. |
| `pnpm test:ui` | Exit 0, 54 passed in 12.5 minutes; current runtime source, all three screen classes, both languages/themes, real disposable PostgreSQL and production owner processes. |
| `node scripts/test-ui.mjs tests/ui/owner-shell.spec.mjs --project phone` | Exit 0, 2 passed in 22.6 seconds after adding the explicit bottom-scroll/footer bounds check; both languages/themes. The added assertion changes no runtime source. |
| `pnpm verify:clean` | Exit 0; fresh frozen native install, 87 unit/property and 66 PostgreSQL tests, negative checks, strict types, production/canary builds, smoke and artifact scans. Snapshot limitation below. |
| `pnpm audit --audit-level low` | Exit 0, no known vulnerabilities. |
| Hosted Linux CI | Required on the PR; local Windows evidence does not assert hosted success. |

- Focused catalogue/query/transport/boundary run: 22 tests passed before the
  additional i18n boundary case. Lint, Knip, strict types and production build
  passed on that iteration.
- Membership-denial red/green proof: prior-main client produced zero access
  invalidations for SHOP_ACCESS_DENIED 403 (required assertion failed); updated
  client produced one (passed). The prior client was loaded from an ignored
  verification copy; no checkout/source reset was performed.
- The first aggregate invocation overlapped the intermediate catalogue move and
  failed at build on its removed relative import after 66 PostgreSQL tests
  passed. It is not clean baseline or settled-source passing evidence.
- The first new browser run exposed a test alert locator matching Next's route
  announcer, an incorrect Tamil theme label in the test, and an actual toggle
  visibility defect: Tailwind's button display utility overrode component-layer
  hiding. The tests were narrowed to the form alert and correct catalogue label;
  responsive display utilities now restrict the toggle to tablet. Assertions
  explicitly require it hidden on both phone and desktop.
- The next complete browser run passed 48 of 54 cases and exposed a real public
  authentication regression in all six recovery cases: remounting a public
  sign-in form on invalidation discarded the email needed for password retry.
  The handler now clears only authorised owner/connection component data and
  public forms retain their original stable key. The existing recovery workflow
  adds an explicit retained-email assertion. No security assertion was weakened.
- After that UI correction, lint, Knip, strict types and all 87 unit/property
  tests passed again. A later overlapping aggregate/browser invocation hit the
  existing jobs binding property's 5-second deadline (86/87 passed); its unchanged
  two-test file passed immediately in isolation. No job source, seed, assertion
  or timeout was changed. Final aggregate verification is run separately from
  browser builds rather than treating the timeout run as a pass.
- The frozen clean-install command passed its 87 unit/property tests, 66 real
  PostgreSQL tests, negative checks, production builds, smoke and artifact scans
  in a disposable Windows path containing spaces. That snapshot predates the
  final public-form-only correction; final frontend checks cover that correction.
- Visual inspection of the initial Tamil/dark phone and English/light tablet
  landscape captures found readable untruncated text; the phone toggle defect
  above was included in the correction. The final independent visual review
  covered all 16 main and four bottom-scroll captures and returned `ship` with
  no material fixes. Parent confirmation covered Tamil phone/desktop and English
  tablet landscape. Current themes, Noto and the approved layout are preserved.
- The added footer check initially used `scrollIntoViewIfNeeded`, which treats
  content under a fixed overlay as within the viewport. That six-case run had
  five passes and one Tamil phone failure. Explicitly scrolling to the document
  bottom tests reachability correctly; the final two phone cases pass and show
  the complete footer above the navigation. No layout change was required.
- Impeccable's mechanical check returned no findings for the changed UI targets.

## Synthetic visual and timing evidence

These captures contain only the synthetic long Tamil shop name. Full-page phone
captures stitch the fixed navigation at the original viewport boundary; the
separate bottom-scroll viewport images prove the final footer is reachable.

| Layout | English light / dark | Tamil light / dark |
| --- | --- | --- |
| Phone 360×800 | [Light](responsive-shell/captures/phone-en-light.png) / [Dark](responsive-shell/captures/phone-en-dark.png) | [Light](responsive-shell/captures/phone-ta-light.png) / [Dark](responsive-shell/captures/phone-ta-dark.png) |
| Phone bottom scroll | [Light](responsive-shell/captures/phone-en-light-bottom.png) / [Dark](responsive-shell/captures/phone-en-dark-bottom.png) | [Light](responsive-shell/captures/phone-ta-light-bottom.png) / [Dark](responsive-shell/captures/phone-ta-dark-bottom.png) |
| Tablet portrait 820×1180 | [Light](responsive-shell/captures/tablet-en-light.png) / [Dark](responsive-shell/captures/tablet-en-dark.png) | [Light](responsive-shell/captures/tablet-ta-light.png) / [Dark](responsive-shell/captures/tablet-ta-dark.png) |
| Tablet landscape 1180×820 | [Light](responsive-shell/captures/tablet-landscape-en-light.png) / [Dark](responsive-shell/captures/tablet-landscape-en-dark.png) | [Light](responsive-shell/captures/tablet-landscape-ta-light.png) / [Dark](responsive-shell/captures/tablet-landscape-ta-dark.png) |
| Desktop 1440×1000 | [Light](responsive-shell/captures/desktop-en-light.png) / [Dark](responsive-shell/captures/desktop-en-dark.png) | [Light](responsive-shell/captures/desktop-ta-light.png) / [Dark](responsive-shell/captures/desktop-ta-dark.png) |

Last focused-run measurements use desktop Chromium with emulated viewports and
local production processes. First usable means navigation to the visible
authorised shell; warm navigation means clicking the connection destination until
its current-page navigation is visible. They are single observations, without
mobile network/CPU throttling, and do not prove the physical-device targets.

| Profile / raw record | First usable | Warm navigation |
| --- | --- | --- |
| [Phone English](responsive-shell/phone-en-timings.json) | 240 ms | 134 ms |
| [Phone Tamil](responsive-shell/phone-ta-timings.json) | 261 ms | 217 ms |
| [Tablet English](responsive-shell/tablet-en-timings.json) | 242 ms | 203 ms |
| [Tablet Tamil](responsive-shell/tablet-ta-timings.json) | 285 ms | 209 ms |
| [Desktop English](responsive-shell/desktop-en-timings.json) | 270 ms | 152 ms |
| [Desktop Tamil](responsive-shell/desktop-ta-timings.json) | 254 ms | 140 ms |

## Recovery and limits

No migration, money policy, immutable business history, tenant policy, provider
activation or deployment changes. Recovery is a compatible application source
revert. Query data is memory-only and discarded on unmount/access invalidation;
it cannot be recovered as an offline draft.
Invalidation covers known local authentication transitions and access changes
detected by authorised responses. It does not add cross-tab broadcasts or
proactive polling for an external session revocation; each subsequent API
operation continues to enforce server authority.

Physical Android/low-memory/lighting, real TalkBack/fluent Tamil owner usability
and device performance checks have not been performed for this slice. These
remain explicit Phase 0.4 acceptance work, using synthetic data and the approved
temporary local HTTPS preview. This PR does not approve live data or the later
privacy, restore and pilot gates. Require CI and owner review before merge;
verify integrated main before starting dependent #52–#55/#59 work.
