# Issue #47 — selected themes and UI demo cleanup

Evidence date: 15 October 2026. Local verification completed; owner PR review and
CI remain the merge gates. Slice 0.1.1c follow-up, owner-approved
through the two-ticket cleanup plan. Implemented in the existing checkout on
`codex/design-system-cleanup` from integrated main `c45d26f`.

The owner chose **Current light and Current dark**, including Noto Sans and
Noto Sans Tamil, and declined Candidate light. Issue #45 and draft PR #46 were
closed as superseded without merging; the trial branch and its evidence remain
available. This branch does not introduce the candidate code or its three fonts.
Native dependency: #48 is blocked by #47. The UI foundation #3 and owner
foundations #12–14 are merged prerequisites.

## Scope and acceptance evidence

| Requirement | Implementation and evidence |
| --- | --- |
| USE-01/02/09, architecture §§5.2, 9.2 | One shared CSS authority retains the selected light/dark palette, Noto fonts, type scale, spacing and geometry. All six installed shared modules use its semantic roles. No additional component/theme library was required. |
| USE-01/09 | Owner-header light/dark control applies at the document root, including portals. Light is default. A fixed first-party head script reads only `aarili-appearance` before hydration. Storage failure leaves an in-page switch usable; no account/business state is stored. |
| USE-01/09 | Disabled controls use explicit semantic colours and opacity 1. Paired foreground/background colours swap together, avoiding low-contrast intermediate states. Read-only content stays readable; pressed/selected controls have a visible cue and keyboard focus is retained. |
| USE-01/02/09, architecture §7.1 | Actual sign-in checks cover both languages and themes at 320/360/390/768/1024/1280/1440px, 44px targets, focus/boundary/text contrast, text enlargement/spacing, wrapping, IME, missing fonts, reduced motion and hydration. |
| Existing owner flows | Setup, verification, sign-in, shop completion, reset, recent authentication, session expiry, Google callbacks/link/disconnect and failures retain their existing contracts. English/light and Tamil/dark owner workflows run at phone/tablet/desktop sizes. Sign-in separately covers all four language/theme combinations. |
| Shared components | Button/Input/Field retain their public variants and contracts. Card displays real shop setup information; Status renders existing notices/errors. Google disconnect uses the existing shared Dialog with locale, explicit initial/final focus, keyboard containment and busy dismissal protection. Its additive `closeDisabled` prop preserves other consumers. |
| Remove validation surfaces | The merged foundation gallery and health demo UI are deleted. Root redirects to sign-in; metadata and setup copy lose scaffold wording. Candidate Today/detail specimens were never merged and remain absent. There are no preview selectors or experiment flags in product source. |
| Preserve safeguards | `/api/healthz`, health wire/failure tests, real PostgreSQL outage smoke, boundary/type/token guards and historical evidence remain. The removed recent-access demo button's stale/recent/expired contract proofs remain in verification. Development callback/browser logging is disabled to keep private OAuth codes out of logs. |
| Dependencies | Exact existing versions are retained. TanStack Query was used only by the deleted health demonstration; its now-unused app dependency and lock entries are removed. The architecture's pinned Query choice remains the requirement when an approved workflow needs it. |
| Runtime cleanup | #48 will remove exemplar API/worker entry points after this prerequisite is merged and verified. Those runtime changes are not claimed by this UI PR. |

The six maintained modules are Button, Input, Field, Card, Status and Dialog.
Official shadcn monorepo/theming documentation was fetched with Context7 during
planning; no missing primitive was found for current screens. Existing
`base-nova`/Base UI configuration and exact CLI 4.21.4 remain the installation
path for later, approved features. Base UI 1.9.0 Dialog and installed Next 16.4.0
layout/redirect documentation were checked for this implementation.

## Command results

- `pnpm verify` for cleanup commit `53bca5d`: passed: lint, Knip, strict types,
  76 unit/property tests, compiled negative fixtures, OpenAPI, 65 real PostgreSQL
  integration tests, production build, standalone readiness/outage and worker
  shutdown smoke, and 19 browser artifacts scanned for private configuration.
- `pnpm test:ui`: **45 passed (4.7 minutes)** across phone, tablet and desktop,
  including all four sign-in language/theme combinations, owner workflow failures,
  long mixed-script shop names, dialog busy/focus containment/restoration and
  private-artifact redaction checks.
- `pnpm knip`: passed after removing the unused demonstration dependency.
- Focused Google phone run before the final busy-close assertion: 2 passed.
  The final full browser run also covers the settled busy-close behaviour.
- `git diff --check`: passed after final source and evidence updates.

### English-default clarification

The owner subsequently requested English on every initial page load, with Tamil
only after explicit selection. Current branding follows the chosen language; the
language button identifies its own script for assistive technology. Locale is not
inferred from the browser or stored, and reload/navigation starts in English.
Saved profile/settings preferences remain future work.

Fresh follow-up checks passed: lint, Knip, strict types, 76 unit/property tests,
compiled negative checks, production build and **48 browser tests (4.7 minutes)**,
plus standalone production smoke and the 19-artifact scan. The added regression
visits all seven current owner routes with a Tamil-preferring browser, checks
server-rendered English and hydrated English, then tests explicit Tamil selection,
reload and navigation. Both language/theme matrices and real owner flows remain
covered. The 65 database integration cases above were not rerun for this locale-only
follow-up; no API/database/auth/business logic changed. CI runs the full suite.

The curated captures and font measurements below are refreshed for this follow-up.

Initial checks exposed an intermediate disabled-colour contrast failure, old
zero-storage assertions, duplicate language switching in test setup and a
server-boundary fixture still tied to the removed gallery. These were corrected
without removing the underlying security/accessibility assertions. Exploratory
browser runs were stopped once those failures were diagnosed; final command
results above supersede them.

## Font/network measurement

Fresh Chromium contexts at 360px on the actual development sign-in screen loaded
three same-origin WOFF2 resources, totalling **42,208 encoded body bytes** in
English/light and English/dark. Selecting Tamil loads the Tamil body face:
four resources, **56,760 bytes**, in Tamil/light and Tamil/dark. External
requests: zero. No candidate family was loaded. These refreshed measurements
reflect the owner's English-default clarification; they are not total wire
traffic, a cold production performance budget or a physical-phone measurement.
Browser resource details are captured alongside the curated evidence.

[Font resource details](design-cleanup/font-payloads.json) record all four
combinations. Curated captures cover [English/light phone](design-cleanup/captures/phone-en-light.png),
[Tamil/dark phone](design-cleanup/captures/phone-ta-dark.png),
[Tamil/light tablet](design-cleanup/captures/tablet-ta-light.png),
[English/dark desktop](design-cleanup/captures/desktop-en-dark.png),
[actual setup](design-cleanup/captures/tablet-en-setup.png),
[long mixed-script shop information](design-cleanup/captures/desktop-ta-complete.png),
and [English](design-cleanup/captures/phone-en-disconnect-review.png) /
[Tamil](design-cleanup/captures/desktop-ta-disconnect-review.png) disconnect dialogs.
Final visual inspection covered the phone Tamil/dark header, tablet English setup,
desktop Tamil dialog and long shop name; no clipping was observed in those captures.

## Review limits, integrity and recovery

No API handlers, database schemas/migrations, auth policies, tenant boundaries,
money rules, immutable history or worker composition changed. The disconnect
confirmation is a presentation/focus change around the existing command; failure
returns focus to the existing alert, and a pending command cannot be dismissed.
Rollback is a source revert with no migration or data operation.

No Today/detail/order, navigation shell, PWA, autosave, document/PDF or other
future business capability is represented as complete. Synthetic test fixtures
and all existing pilot/provider/restore activation gates remain applicable.
Physical-phone software keyboard/zoom, shop lighting, Tamil screen-reader checks
and final owner usability review have not been run. Automated axe and focus
checks do not certify usability or WCAG conformance.
