# Issue #45 — Grounded Editorial design trial

Evidence date: 15 October 2026. Approved follow-up to [#3](https://github.com/nishanthturnstile/aarili/issues/3),
whose prerequisite implementation merged through PR #8. Work stays in the owner's
existing Windows checkout on `codex/design-system-trial`; no additional checkout.

Sources: product USE-01/02/09 and §§3, 27, 29.1; architecture §§5.2, 7.1, 9.2,
15; [experimental design handoff](../aarili-design-system.md). This is a
foundation trial, not a completed operational shell, live-data gate, or final
design-system adoption.

## Review and activation

In PowerShell:

```powershell
$env:AARILI_DESIGN_TRIAL = 'grounded-editorial'
pnpm dev:web
```

Open `http://localhost:3000/dev/design-system`. The gallery compares current
light, candidate light, and current dark using the maintained shared components.
Today/detail navigation uses only synthetic in-memory fixtures. The sign-in link
opens the real existing screen; real owner flows require the already-documented
synthetic local auth configuration. There is no new auth configuration in this
slice. Leaving the gallery restores the prior root theme/language.

To disable, remove `Env:AARILI_DESIGN_TRIAL` and restart development. Production
ignores the flag and returns 404 for the gallery. No migration or recovery of
business records is required; reverting the focused patch removes the trial.

Candidate verification is split deliberately so two Next development servers
never share generated project files:

```powershell
$env:AARILI_DESIGN_TRIAL = 'grounded-editorial'
pnpm test:ui tests/ui/design-trial.spec.ts
node scripts/test-ui.mjs --config=playwright.owner-trial.config.ts
```

The second configuration enables the test-only `AARILI_OWNER_UI_TRIAL` marker
and starts only the per-scenario owner fixture, with persisted Turbopack dev
cache disabled for those changing database/origin fixtures. Normal development
and production retain their existing compiler/cache settings. The normal `pnpm test:ui` retains
production owner verification even when the design flag is set. Owner tests
wait for a nonvisual `data-owner-ready` hydration attribute before interacting;
it does not alter form, auth, validation or routing behavior.

## Acceptance mapping

| Requirement | Implementation/evidence |
| --- | --- |
| One visual authority; reversible candidate | Shared UI globals owns candidate palette/type/radii/states. Server root gates the flag on development; Turbo passes it to `dev`. Existing light/dark declarations remain. |
| Approved libraries only | Three Fontsource 5.3.0 additions, exact manifest/lockfile; Base UI, Tailwind and all other pinned dependencies retained. Fonts are served by the app. |
| USE-01/09 component states | Primary hover/pressed remain forest; explicit disabled colors; readable read-only controls; separate input/group/focus boundaries; additive neutral/progress Status tones. Candidate controls have 48px minimum targets. |
| USE-02 typography | Newsreader/Plus Jakarta Sans with Noto Serif Tamil/Noto Sans Tamil; separate editorial roles and Tamil line height. Existing owner messages preserved. New specimen wording is marked for owner review. |
| USE-01 responsive composition | Seven viewport widths; architecture's 768/1280px navigation transitions; container-based measurement columns; no fixed footer or competing bottom bars. |
| Product §3 identity and §27 independence | Two independent garment orders in one booking; distinct design reference; booking-wide payment totals with no inferred allocation. Progress, schedule and finance shown independently. |
| Honest incomplete capabilities | Disabled unsupported creation/search/navigation/feedback with explanation; fixed preview clock/date; no live contact details, fabricated saves, zero-filled measurements or simulated payments. Missing measurements wrap as text. |
| Existing working screens | Candidate is applied through shared styles to setup, sign-in, owner, recovery/reset, reauthentication and Google connections. The browser fixture can run the same real workflows in development and production. |
| Production isolation | Production smoke forces the flag and checks no theme activation plus gallery 404. Owner fixture also checks server-rendered activation matches its actual runtime mode. |

## Verification

The aggregate verification, final browser regression, and candidate owner-flow
verification passed as recorded below.
Historical foundation captures remain
unchanged; new trial captures live under `design-trial/`, and maintained-gallery
comparison captures are disposable `.scratch/design-system-baseline/` output.

| Check | Result |
| --- | --- |
| Baseline `pnpm lint` | Pass before implementation; Biome, architecture boundaries and token ownership. |
| `pnpm verify` | Pass: lint/boundaries/tokens, Knip, strict types, 76 unit/property tests, negative type checks, OpenAPI, 65 real PostgreSQL integration tests, production build, production smoke including forced trial flag/gallery denial, and 36 browser artifact checks. |
| Focused candidate gallery | Pass: 9 browser cases across phone/tablet/desktop, both languages, seven widths per language, 200% text enlargement/text spacing, real font faces and computed contrast/boundaries, dialog focus, fallback fonts, forced colors, reduced motion, and root restoration on exit. |
| Final visual refinements | Fresh `pnpm lint` passed after selected-state underlining and readable English navigation wrapping. The full browser command rebuilds production and rechecks these refinements. |
| Final `pnpm test:ui --reporter=list,json` | Pass: all 57 cases in 5.5 minutes, including maintained light/dark gallery, candidate gallery/token propagation, health, setup, Google, recovery, and privacy-artifact checks across all three device projects. |
| Final static/unit checks | Pass: lint/boundaries/tokens, Knip, strict typecheck, all 76 unit/property tests and all negative type checks after the verification-support corrections. The final browser command rebuilt production from the settled source. |
| Candidate owner workflows | Pass: all 21 owner cases on phone/tablet/desktop in actual development mode with the server-applied trial. Includes setup, Google denial/link/sign-in/disconnect, recovery/reset/session expiry/reauthentication, axe/keyboard and unchanged secret-log/artifact checks. |
| Final production smoke/artifacts | Pass: actual Next/Hono/PostgreSQL readiness/outage and worker shutdown; trial flag ignored; gallery 404; 36 browser artifacts checked for private configuration/server-code leakage. |

The aggregate `pnpm verify` preceded the final UI readiness and test-fixture
corrections. The settled patch repeated all affected static/unit/type/build/UI
checks and production smoke/artifact checks. The 65 PostgreSQL integration
cases were not repeated for those UI-only corrections; database/core/worker
runtime source stayed unchanged.

The focused gallery's network report with the trial flag unset is identical across the three viewport
projects and both interface languages: 56,760 WOFF2 response-body bytes after
loading current light; 253,652 bytes after sequential candidate comparison,
an additional 196,892 bytes across eight total font resources. This deliberately
includes both systems in one browser context; it is not a candidate-only core
screen budget, compressed wire-byte measurement, or a low-end-phone timing claim.
All requests stayed on the local app origin. Variable fonts use normal faces and
unicode ranges; the full gallery exercises Tamil, Latin and the rupee sign.

The final candidate-only follow-up also checks explicit language tags and serif
roles within mixed-script identity samples, responsive gutters declared at the
same cascade layer as the tokens, and browser injection of edited canonical
candidate declarations (color/radii/font/spacing) without touching repository
source. The historical default-token propagation assertions remain intact.

The initial focused test exposed Tamil overflow at 200% text enlargement and
320px. Candidate text wrapping corrected it, and the focused Tamil rerun passed.
The first aggregate attempt stopped on strict TypeScript errors in the new
contrast-test helper; its tuple/narrowing fix retains strict compiler settings.
Neither failed run is passing evidence for the final patch.

Development-only owner verification found two additional fixture problems. A
stale Turbopack development cache produced repeated `HMR hash mismatch` reloads;
the inactive generated `.next/dev` directory was preserved as
`.next/dev-before-design-trial` and regenerated. The old test could also click
before client hydration; the nonvisual readiness attribute now provides an
explicit wait without changing form handlers. Owner trial tests run in their
own configuration, sequentially, without the gallery development server.

The development Google test then correctly rejected raw Next request logs
containing synthetic callback codes. Documented Next `logging.incomingRequests`
and `logging.browserToTerminal` are disabled, retaining the negative log checks.
Both focused Google language cases passed after the correction. This adjusts
development diagnostics only; provider/authentication rules remain unchanged.

Impeccable's mechanical detector ran once over changed markup/components and
returned `[]` (exit 0). It is a limited static check, not usability certification.

Visual inspection confirmed the retained phone Tamil sign-in, tablet English
Today and desktop Tamil detail captures after the final UI run. Twenty curated
captures are retained under `design-trial/`; the other 100 generated trial
captures are preserved locally in ignored `.scratch/design-trial-extra-captures/`.
Regenerated historical baseline captures were preserved under `.scratch/` and
the tracked originals restored, rather than rewriting earlier issue evidence.

- [Phone Tamil sign-in](design-trial/auth/captures/phone-ta-sign-in.png)
- [Tablet English Today](design-trial/captures/tablet-en-today.png)
- [Desktop Tamil detail](design-trial/captures/desktop-ta-detail.png)

## Integrity and remaining gates

No API/schema/authentication policy, tenant transaction/RLS, journal, measurement
formula, immutable history or background-effect code changes. No live data,
provider requests or messages are introduced. The test-helper extension retains
disposable PostgreSQL, secret redaction and synthetic transports.

Pending: owner visual/terminology review, Tamil-speaking review of new preview
wording, actual shop lighting, screen-reader/device interaction, physical Android
keyboard and safe-area behaviour, and agreed low-end-phone performance profile.
Automated font fallback, forced-colors and reflow checks cannot establish these.
No PDF templates exist in this trial; Tamil PDF golden validation remains with
the approved future PDF slice. Broader adoption and a matching candidate dark
theme need a later explicit decision. No merge or deployment is approved here.

| Manual acceptance item | Status |
| --- | --- |
| Physical Android keyboard/safe areas, actual shop lighting | Not run — requires the owner's device/shop. |
| Real screen-reader review, agreed low-end-device timings | Not run — automation and emulator checks do not substitute. |
| Final Tamil wording and visual/default-adoption approval | Not run — owner review checkpoint. |
| Tamil PDF golden set | Not run — PDF capability is outside this trial and is not implemented. |
