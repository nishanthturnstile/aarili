# Shop calendar: incumbent design comparison

17 October 2026. Issue [#85](https://github.com/nishanthturnstile/aarili/issues/85),
slice **1.1.1b**, extends the existing Settings Operate surface. This is a
comparison record, not a new visual specification, whole-product acceptance or
permission to activate business configuration.

## Authority and scope

The [design system](../aarili-design-system.md),
[Settings design](Shop_Settings_Design.md) and
[calendar implementation plan](Shop_Calendar_Implementation_Plan.md) remain the
authorities. No replacement visual world or system change was approved.
`PRODUCT.md`, `DESIGN.md` and `.impeccable/design.json` were not created.

Compared `apps/web/src/app/shop-calendar-screen.tsx` and
`apps/web/src/app/owner-workspace.tsx` with the incumbent
`apps/web/src/app/shop-profile-screen.tsx`; checked
`packages/ui/src/globals.css` and
`packages/i18n/src/shop-calendar-messages.ts` against those authorities.

## Extension consistency

| Concern | Observed implementation |
| --- | --- |
| Palette | Calendar consumes the existing semantic control, text, boundary, error and focus roles. Current light/dark remain defined solely in the shared stylesheet; no calendar palette or asset was introduced. |
| Typography | Existing self-hosted Noto Sans/Noto Sans Tamil, 16px body, 400/600 weights and Tamil line-height remain in force. Labels and actions wrap in the supplied Tamil captures. |
| Geometry | Shared Button, Input and Field primitives retain the 12px control radius, 44px minimum control height, visible boundaries and focus. Day fieldsets and dividers extend the existing flat form treatment. |
| Responsive shell | Existing phone bottom navigation, tablet rail and desktop sidebar remain. Calendar is a readable single task column, bounded by the existing 70ch Settings main width. Start/end pairs use two flexible columns; actions wrap rather than require a schedule table. |
| Settings continuity | Profile/calendar selection uses existing outline buttons with a pressed state. Customer and production editing remain separate; revision summaries, retained history and proposed/published comparisons reuse the incumbent definition-list and disclosure vocabulary. |
| State truth | Unconfigured, explicitly closed, open, saved, publishing and published remain explicit text. Draft saving and publication are separate actions. Review copy states applicability to new activity, preservation of the other calendar and unknown availability. No opening hours or policy values are implied as defaults. |
| Recovery and validation | Corrected source provides an initial-load retry, read-only closed/published drafts with an explicit new-draft action, associated invalid date/range messages and a first-error focus action. These use existing controls and feedback styling. |

## Evidence and limits

Visually inspected the supplied full-page and viewport PNGs in
`.scratch/calendar-captures/`: `phone`, `tablet` and `desktop`, each in English
light and Tamil dark (`{size}-{en,ta}.png` and
`{size}-{en,ta}-viewport.png`). They show the existing identity, shell changes,
wrapping labels, long editor, history and read-only published state. Full-page
and viewport captures show different workflow moments; they are not identical
state snapshots or a complete language/theme cross-product.

Also inspected `fix-abandoned.png`, `fix-load-failure.png`,
`fix-date-error.png` and `fix-range-error.png`. The first three show the explicit
read-only/new-draft path, load retry, and focused invalid duplicate date.
All sixteen captures were refreshed from the final production build and
inspected in the implementation session. This documenter reopened the final
`fix-range-error.png`: the range error appears directly below the range legend,
before the invalid start/end fields, with visible invalid boundaries and focus
on the first field. This agrees with the source associations.

The supplied static detector output
`.scratch/shop-calendar-design-detect.json` was checked and contains `[]`.
The implementation session reports the final three-size bilingual
Playwright/axe calendar cases passed (4.3 minutes), including retry,
abandoned-draft read-only behaviour, duplicate date association and focus.
Four existing desktop customer/wearer/guardian/profile cases also passed
(5.1 minutes). Final lint, Knip, typecheck and web production build passed
after the inline error-placement change. This documenter did not rerun those
checks.

The independent finish review returned all five review sections with
**disposition: ship**, scoped to its three earlier findings: initial-load
recovery resolved, non-active draft truth resolved, and validation recovery
resolved. No material fixes remain within that review scope. This verdict is
not inferred from the empty detector result and does not establish
whole-product or human acceptance.

## Drift retained and acceptance still pending

Incumbent Settings CSS already contains literal spacing/600-weight values and
`--space-8` with a fallback rather than exclusively using the named semantic
spacing/weight tokens. The broader Settings design describes a five-group
overview and narrow desktop section list; the approved slices currently expose
the delivered profile/calendar choices above the task, while the incumbent
profile uses a separate summary/form layout. This comparison does not promote
those differences into new global design rules, add later settings groups or
repair existing CSS. Calendar-specific spacing remains local composition, not
a replacement token scale.

Fluent-Tamil wording and task acceptance, actual Android device/keyboard and
shop-lighting review, and screen-reader/assistive-technology acceptance remain
pending. Captures and automated accessibility checks do not establish those
acceptances or full WCAG conformance. Owner review, repository verification,
merge and activation gates remain as recorded in the delivery evidence.
