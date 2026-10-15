# aarili Design System
## Direction A: The Grounded Editorial Sanctuary

**Version:** 1.1 - experimental candidate; not the adopted application design system

**Repository trial:** issue #45, 15 October 2026; owner visual review pending

**Review date:** 14 October 2026

**Product:** aarili, boutique and tailoring business management

**Example workspace:** Navodhai Boutique

**Primary reference viewport:** approximately 390 CSS pixels; never a fixed application width

**Theme covered:** light theme
**Suggested repository location:** `docs/aarili-design-system.md`

> Preserve Direction A's warm, editorial identity. Make operational information unambiguous, controls readable, and implementation incremental. Do not turn this handoff into a product rebuild.

### How to interpret this document

The supplied Stitch specification is the visual and product baseline. Its seven main sections are retained and expanded here. This review preserves the direction, corrects measurable or internal inconsistencies, and adds explicitly identified implementation recommendations.

- **Retained:** a decision present in the supplied specification.
- **Correction:** a factual, accessibility, or consistency issue identified in this review.
- **Recommended extension:** a proposed detail needed for implementation, not evidence that Stitch or the owner already approved it.

The tokens and component rules below are the **recommended trial baseline for the coding agent**. The change register identifies departures from the source. Evaluate them in local development first; obtain owner review before default adoption. The product plan and architecture remain authoritative where this exploration differs.

**Original review boundary (14 October):** the written review covered the supplied specification, calculated color contrast, and official documentation. No rendered Direction A screens, repository, device tests, accessibility audit, or owner usability session were available then. The 15 October repository trial and browser evidence are recorded in section 7 and the linked trial evidence; physical-device/shop-lighting and owner acceptance remain unverified. Do not report this handoff as a certified design system.

**Scope boundary:** this document authorizes design-system work, not changes to database schemas, permissions, payment calculations, measurement formulas, business state machines, or new product modules. Where presentation requires unavailable data or capabilities, report the gap instead of inventing it.

---

## 1. Executive Summary & Review Audit

### 1.1 Review verdict

Direction A is a coherent candidate for aarili: forest-green actions, nearly white warm surfaces, editorial customer identity, and practical sans-serif operational content. Keep that combination. The source is not yet an implementation-complete system because several contrast claims are incorrect, some critical text is too faint, component states are underspecified, and responsive and measurement rules need clarification.

The most important improvement is **precision, not a new aesthetic**. Preserve the calm visual character while making deadlines, money, measurement provenance, and next actions unmistakable.

### 1.2 Change register

| ID | Source decision or claim | Reviewed baseline | Classification |
|---|---|---|---|
| R01 | Forest, primary-text, and secondary-text contrast ratios are inconsistent across sections. | Replace with computed pair-specific ratios in section 3.4. A color alone cannot be called AA or AAA compliant. | Correction |
| R02 | `#848C86` is used for metadata and units. | Use `#626B64` for muted readable text. The original is only 3.34:1 on the canvas, below the normal-text threshold. Critical units use secondary text, not the weakest text role. | Correction |
| R03 | `#D5D0C5` is called a strong border/focus boundary; the audit also mentions `#E5E3DC`. | Keep `#D5D0C5` as a grouping border. Add `#7A8179` for essential control boundaries and a separate forest focus indicator. Decorative card hairlines may remain light. | Correction |
| R04 | In-progress text `#8D6E00` on `#FFF8E1`. | The original passes normal-text contrast narrowly at 4.53:1. Darken it to `#735B00` for a 6.13:1 margin. Do not describe the original as a failure. | Recommended extension |
| R05 | Paid text `#15803D` and all outstanding balances in crimson. | Use `#166534` for paid text across the approved light surfaces. Use primary text for an ordinary balance; reserve red for a confirmed overdue/error condition. | Contrast correction + semantic recommendation |
| R06 | Primary body text is 15px; operational section labels are 11px uppercase. | Recommend 16px body/inputs, 14px operational labels and units, and 13px noncritical section labels. Keep 12px only for nonessential captions. | Recommended extension |
| R07 | Newsreader optical size described as 16-72; Tamil optical parity is guaranteed; Noto Serif Tamil is named but omitted from font imports. | Newsreader metadata lists an optical-size range of 6-72. Load the Tamil serif if used; verify scripts visually instead of promising identical metrics. | Correction |
| R08 | Three-column measurement grid at a 390px phone viewport. | Use two columns where they fit comfortably; one when needed. Allow three only when the actual container can accommodate readable labels and controls. | Recommended extension |
| R09 | Finished measurements display `+/-` indicators as a standard treatment. | Show tolerance only if explicitly recorded. Never infer ease, tolerance, units, or measurement type. Body and finished-garment records remain distinct. | Clarification + operational safeguard |
| R10 | `ND-BL-014` appears as an order reference. | The earlier exploration brief identifies it as a lookbook/design reference. Keep design reference, order number, garment item, and measurement record distinct. Use an explicitly fictional separate order number in previews. | Source-consistency correction |
| R11 | Source describes three tracks, but the header contains production, trial, and delivery. | The independent concepts are production, scheduling, and finance. Trial and delivery belong to scheduling; finance can remain in its own visible section. | Clarification |
| R12 | A 480px maximum width is suggested for tablet/desktop. | Retain a narrow form/detail mode when useful, but do not constrain the entire desktop application to a phone-sized column. | Recommended extension |
| R13 | Sticky bottom action plus persistent bottom navigation without collision rules. | Define one bottom-stack owner, safe-area handling, keyboard behavior, and content/focus clearance. | Recommended extension |
| R14 | Mostly happy-path components and two screens. | Add focus, loading, invalid, empty, read-only, error, and save-feedback contracts; preview unsupported capabilities only, never fake them. | Recommended extension |

### 1.3 Retained non-negotiables

Retain the forest/linen palette family, Newsreader plus Plus Jakarta Sans pairing, Tamil font support, clear tenant identity, mobile-first workflow, 44-48px touch targets, garment-oriented information, explicit measurement types, and independent production/schedule/payment presentation.

Do not reintroduce the rejected burgundy/gold luxury treatment, default terracotta craft theme, developer-console styling, large dark dashboard header, or decorative sewing motifs.

---

## 2. Brand Identity & Tenancy Model

### 2.1 Brand hierarchy - retained

**aarili** is the platform. **Navodhai** is the example active boutique. The workspace name is prominent; the platform signature is quiet. Do not hardcode Navodhai into shared components, database identifiers, or reusable copy.

A workspace switcher appears only when workspace switching exists and the user has more than one accessible workspace. Do not create a nonfunctional switcher or implement multi-tenancy as part of this visual migration.

Tenant logos and names may vary. Do not automatically recolor operational statuses, accessibility-critical controls, or payment states using an uploaded logo's palette.

### 2.2 Working personas - retained context, not validated research

| Persona | Interface priority | Design implication |
|---|---|---|
| Owner-maker | Resume interrupted work; identify today's commitments; find customer requirements and balances. | Stable page position, legible summaries, one dominant next action, restrained notifications. |
| Assistant or tailoring collaborator | Identify assigned garments and instructions; report supported progress changes. | Clear garment identity and measurement context. Preserve existing access restrictions; do not reveal finance by default. |
| Customer viewing shared content | Recognize a garment or design and understand the next step. | Useful imagery, design reference, clear enquiry action. No internal notes, private measurements, or workshop controls. |

These are design assumptions from the project brief. Validate them with the owner; do not invent interview findings or productivity statistics.

### 2.3 Visual signature - recommended articulation

Use an **editorial identity header over a structured workshop record**:

- Customer or garment identity receives a restrained serif heading.
- Dates, amounts, units, field labels, and actions use the sans-serif.
- One quiet forest accent identifies the active action or selected item.
- A labeled specification panel groups the garment's measurements and provenance.

This is the recurring pattern, not an additional decorative component. Even without the logo, the identity-to-specification relationship should feel consistent across pages.

Keep the canvas mostly neutral. Use white cards where grouping is meaningful; do not place every line of information inside its own card. Reserve tinted surfaces for selected contexts, reference sections, and semantic feedback. Avoid shadows on every object.

### 2.4 Voice and terminology

Use direct, warm language: `New order`, `Record trial feedback`, `Ready for handover`, `Measurements not recorded`, `Balance remaining`, `Try again`.

Retain domain vocabulary where it is useful, but use one term consistently. For this baseline, prefer **Trial** rather than alternating between Trial and Fitting, and **Customer** in operational copy. Keep the source navigation label **Clients** until the owner decides whether to rename it; do not silently rename routes during styling work.

Avoid uppercase state-machine names, unexplained abbreviations, blame, and promotional language inside working screens. `Today` does not automatically mean `Urgent`. `Awaiting measurements` is a neutral workflow state unless a real deadline or operation is blocked.

---

## 3. Design Tokens & Color Palette

### 3.1 Token contract

Use semantic roles, not literal color utilities in feature components. Preserve a single canonical token source and adapt it to the existing component library. The names below are a reference contract, not permission to replace the repository's architecture.

Keep these roles separate:

- **Canvas:** overall application background.
- **Card / overlay:** white content surfaces; elevation is conveyed through placement and restrained shadow, not a darker fill.
- **Subtle / inset:** warm secondary and read-only sections.
- **Action:** forest interactive emphasis, unrelated to urgency.
- **Feedback:** ready, progress, attention, error.
- **Text:** primary, secondary, muted, and inverse.
- **Boundary:** decorative divider, group border, essential control border, focus indicator.

### 3.2 Reference CSS tokens

**Recommended extension:** the source's `surface-elevated` color is renamed `surface-inset`; real floating overlays use white. Transitional aliases preserve the old names while components migrate.

The selector deliberately supports an isolated preview. After review, apply the same contract at the appropriate application-theme scope. Check for conflicts with existing token names before merging. Font family strings must be connected to the project's actual font loader where it generates hashed family names.

```css
[data-aarili-theme="grounded-editorial"] {
  /* Retained surfaces */
  --color-canvas-bg: #FBFBFA;
  --color-surface-card: #FFFFFF;
  --color-surface-subtle: #F3F1EC;
  --color-surface-inset: #EDEAE2;
  --color-surface-overlay: #FFFFFF;

  /* Retained brand; pressed state is a reviewed addition */
  --color-primary-base: #142920;
  --color-primary-hover: #0E1D16;
  --color-primary-pressed: #0A1711;
  --color-primary-subtle: #E8EFEA;
  --color-primary-border: #C8D8CE;
  --color-text-on-primary: #FFFFFF;

  /* Text */
  --color-text-primary: #191B1A;
  --color-text-secondary: #575E59;
  --color-text-muted: #626B64;
  --color-link: var(--color-primary-base);

  /* Operational feedback: use paired backgrounds and foregrounds */
  --color-stage-ready-bg: #E8F5E9;
  --color-stage-ready-text: #1B5E20;
  --color-stage-progress-bg: #FFF8E1;
  --color-stage-progress-text: #735B00;
  --color-status-neutral-bg: #F3F1EC;
  --color-status-neutral-text: #575E59;
  --color-urgency-amber-bg: #FEF3C7;
  --color-urgency-amber-text: #92400E;
  --color-alert-rose-bg: #FEE2E2;
  --color-alert-rose-text: #991B1B;

  /* Financial semantics */
  --color-financial-balance: var(--color-text-primary);
  --color-financial-paid: #166534;
  --color-financial-overdue: var(--color-alert-rose-text);

  /* Boundaries: do not use decorative borders for essential cues */
  --color-border-subtle: #EAE7E0;
  --color-border-group: #D5D0C5;
  --color-border-control: #7A8179;
  --color-border-control-hover: #575E59;
  --color-focus-ring: #142920;
  --color-focus-gap: #FFFFFF;
  --color-invalid-border: #991B1B;

  /* Disabled remains distinguishable from read-only */
  --color-disabled-bg: #EDEAE2;
  --color-disabled-text: #626B64;
  --color-disabled-border: #D5D0C5;

  /* Fonts: connect these names to loaded font assets */
  --font-editorial: "Newsreader", "Noto Serif Tamil", Georgia, serif;
  --font-ui: "Plus Jakarta Sans", "Noto Sans Tamil", system-ui, sans-serif;
  --font-editorial-tamil: "Noto Serif Tamil", "Newsreader", serif;
  --font-ui-tamil: "Noto Sans Tamil", "Plus Jakarta Sans", system-ui, sans-serif;

  /* Nominal values use a 16px root; respect user font preferences */
  --text-display: 1.75rem;
  --text-title: 1.375rem;
  --text-card-title: 1.125rem;
  --text-body: 1rem;
  --text-label: 0.875rem;
  --text-section-label: 0.8125rem;
  --text-caption: 0.75rem;
  --text-amount: 1.125rem;
  --text-measurement: 1rem;

  /* 4px rhythm; 2px is an intentional micro-spacing exception */
  --space-2: 0.125rem;
  --space-4: 0.25rem;
  --space-8: 0.5rem;
  --space-12: 0.75rem;
  --space-16: 1rem;
  --space-20: 1.25rem;
  --space-24: 1.5rem;
  --space-32: 2rem;
  --space-40: 2.5rem;
  --space-48: 3rem;
  --space-64: 4rem;

  --touch-target-min: 2.75rem;
  --touch-target-generous: 3rem;
  --radius-sm: 0.375rem;
  --radius-md: 0.625rem;
  --radius-lg: 1rem;
  --radius-full: 9999px;
  --border-width: 1px;
  --focus-width: 3px;
  --focus-offset: 3px;

  /* Restrained elevation; structural role, not a default card decoration */
  --shadow-card: 0 1px 2px rgb(20 41 32 / 0.04);
  --shadow-overlay: 0 12px 32px rgb(20 41 32 / 0.14);
  --color-scrim: rgb(25 27 26 / 0.38);

  --motion-fast: 120ms;
  --motion-standard: 180ms;
  --motion-ease: cubic-bezier(0.2, 0, 0, 1);
  --z-sticky: 20;
  --z-popover: 30;
  --z-modal: 50;
  --z-toast: 60;

  --layout-reading-max: 40rem;
  --layout-workspace-max: 80rem;

  /* Temporary compatibility aliases; remove after usage is migrated */
  --color-surface-elevated: var(--color-surface-inset);
  --color-text-tertiary: var(--color-text-muted);
  --color-border-strong: var(--color-border-group);
}
```

Do not treat `primary-border`, `border-group`, or `border-subtle` as sufficient focus indicators. Do not apply opacity to a whole enabled component to achieve a muted look; that changes the computed text/background pair.

### 3.3 Color usage rules

| Role | Use | Do not use for |
|---|---|---|
| Forest action | Primary button, selected navigation accent, underlined text links. | Every heading, urgent trial labels, payment status inference. |
| White card | Grouped records, dialogs, sheets. | Arbitrary boxes around every field. |
| Subtle / inset | Reference blocks, secondary actions, read-only regions. | A disabled appearance for editable information. |
| Ready green | A supported ready/completed production state with its label. | Automatically claiming an order is paid or delivered. |
| Progress amber | A supported in-progress production stage. | Automatically marking work overdue. |
| Attention amber | A time-sensitive item requiring attention according to existing rules. | All appointments happening today. |
| Rose error | Invalid input, confirmed overdue condition, failed operation. | Every unpaid balance or missing optional field. |
| Muted text | Noncritical supporting metadata on approved light surfaces. | Important units, input values, deadlines, essential instructions. |

Payment state and production state can share a color family but always have different labels and contexts. A dot alone is not meaningful secondary encoding; readable status text is mandatory. An accompanying icon is optional and should add meaning rather than duplicate decoration.

### 3.4 Contrast audit - calculated, not screen-tested

The values below were calculated from the supplied or revised opaque sRGB hex pairs using the WCAG relative-luminance method. Ratios are rounded for display only; pass/fail comparisons use unrounded values. Normal text is checked against 4.5:1; essential non-text boundaries against 3:1. These are pair checks, not a claim of full WCAG conformance. [R1], [R2], [R3]

| Foreground / background | Ratio | Result / decision |
|---|---:|---|
| `#FFFFFF` / `#142920` | 15.35:1 | Retained primary button pair. Replaces the source's 9.8:1 claim. |
| `#142920` / `#FBFBFA` | 14.83:1 | Retained forest on canvas. Replaces the source's 7.8:1 claim. |
| `#191B1A` / `#FBFBFA` | 16.72:1 | Retained primary text. Replaces the source's 13.4:1 claim. |
| `#575E59` / `#FBFBFA` | 6.44:1 | Retained secondary text. Replaces the source's 5.2:1 claim. |
| Original `#848C86` / `#FBFBFA` | 3.34:1 | Fails normal-text minimum; replace for readable metadata and units. |
| Revised `#626B64` / `#FBFBFA` | 5.33:1 | Muted text on canvas. |
| Revised `#626B64` / `#EDEAE2` | 4.59:1 | Muted text on the darkest approved neutral inset. Do not lower opacity. |
| Original `#D5D0C5` / `#FFFFFF` | 1.54:1 | Not sufficient when this border is needed to identify a control. Retain for grouping only. |
| Revised `#7A8179` / `#EDEAE2` | 3.33:1 | Essential control boundary on inset; 4.00:1 on white. |
| Original `#8D6E00` / `#FFF8E1` | 4.53:1 | Passes narrowly; darker recommendation is not a mandatory contrast repair. |
| Revised `#735B00` / `#FFF8E1` | 6.13:1 | Recommended progress badge. |
| `#1B5E20` / `#E8F5E9` | 6.996:1 | Retained ready badge; passes normal-text AA. Do not round this up to claim a 7:1 result. |
| `#92400E` / `#FEF3C7` | 6.37:1 | Retained attention badge. |
| `#991B1B` / `#FEE2E2` | 6.80:1 | Retained error badge. |
| Original `#15803D` / `#F3F1EC` | 4.44:1 | Fails normal-text minimum here, although it passes on white. |
| Revised `#166534` / `#EDEAE2` | 5.93:1 | Paid text works on the approved inset; 7.13:1 on white. |

For reproduction: normalize each RGB channel to 0-1; linearize with `c/12.92` when `c <= 0.04045`, otherwise `((c + 0.055)/1.055)^2.4`; compute `L = 0.2126R + 0.7152G + 0.0722B`; then `(Llighter + 0.05)/(Ldarker + 0.05)`. Recheck actual computed styles after implementation, including alpha compositing and tenant/theme overrides. [R1]

### 3.5 Spacing, shape, and elevation

Use 16px nominal phone page gutters, 16px card padding, 12px between related items, and 24-32px between sections. Increase page gutters to 24-32px as space allows. Controls grow to accommodate text; these values are defaults, not rigid height constraints.

Retain 6px small radii, 10px control radii, and 16px card/sheet radii. Reserve full pills for compact statuses and selected filters, not every input or primary action. Icons normally use a 20px visual box inside a 44-48px target. Reuse one existing icon family and stroke style.

Cards generally use a fine border without shadow. Use overlay shadow for a dialog/popover, not as a way to make essential boundaries visible. The z-index tokens describe intended layering; adapt them to existing portal/top-layer behavior rather than forcing every library component to those exact values.

---

## 4. Typography System

### 4.1 Families and loading

Retain **Newsreader** for selected editorial headings and customer identity, **Plus Jakarta Sans** for the operating interface, **Noto Serif Tamil** for Tamil editorial text, and **Noto Sans Tamil** for Tamil UI text.

Official metadata confirms Newsreader's optical-size range is 6-72 and weight range is 200-800; Plus Jakarta Sans is also variable from 200-800. Both specified Noto Tamil families include the Tamil subset. This confirms family metadata, not matched optical weight, baseline, or actual browser rendering. [R8], [R9], [R10], [R11]

Use Newsreader mainly at weight 600 and UI weights 400, 500, 600, and 700. Load only styles/weights needed by actual screens. Do not load italic fonts unless the interface uses them. Enable `font-optical-sizing: auto` for Newsreader; do not force a large display optical size onto small headings.

The source's Google Fonts snippet omitted Noto Serif Tamil. Include that family through the project's existing font mechanism when Tamil editorial headings are supported. Do not copy a CSS family name without ensuring the font is loaded.

### 4.2 Reviewed type scale

Nominal pixel equivalents below assume a 16px root. Keep the root responsive to user preferences.

| Role | Family | Size / line height | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| Display / workspace title | Newsreader | 28 / 36 | 600 | -0.01em | Short workspace identity; not repeated on every card. |
| Screen title / customer identity | Newsreader | 22 / 30 | 600 | 0 | Primary identity and page heading. |
| Card title | Newsreader | 18 / 26 | 600 | 0 | Garment or customer record title. |
| Dense row title | Plus Jakarta Sans | 16 / 24 | 600 | 0 | Optional compact list variant; same design family. |
| Body / input value | Plus Jakarta Sans | 16 / 24 | 400 | 0 | Notes, instructions, form input. |
| Prominent body / action label | Plus Jakarta Sans | 16 / 24 | 600 | 0 | Trial time, important action, key value. |
| Operational label / badge / unit | Plus Jakarta Sans | 14 / 20 | 500-600 | 0 | Measurement labels, statuses, navigation. |
| Section label | Plus Jakarta Sans | 13 / 20 | 600 | 0.02em maximum in Latin | Prefer sentence case; not an 11px all-caps strip. |
| Large amount | Plus Jakarta Sans | 18 / 26 | 700 | 0 | Order total and balance. |
| Measurement value | Plus Jakarta Sans | 16 / 24 | 600 | 0 | Clearly labeled numeric value. |
| Noncritical caption | Plus Jakarta Sans | 12 / 18 | 500 | 0 | Optional supporting caption, never essential units or actions. |

Visual styles are not HTML heading levels. Use a logical `h1`/`h2`/`h3` document structure independently of the font token.

For amounts and measurement values, request `font-variant-numeric: tabular-nums lining-nums`. Confirm the loaded font supplies the desired behavior; align values consistently even if a fallback font lacks a feature. Do not replace the selected font with a monospace font merely to display numbers.

### 4.3 Tamil and mixed-script behavior

Set the correct page language and mark mixed-language segments where appropriate. Use the Tamil-first family for Tamil text, normal tracking, and adequate line height. Start operational Tamil text at 14px or greater, and body/input text at 16px, then validate real content. Do not impose Latin uppercase styling or a fixed one-line height.

Required script specimens include `இன்றைய பணிகள்`, `அளவுகள்`, a long Tamil customer name, a mixed English/Tamil garment note, and amounts such as `₹1,400.50`. These are rendering checks, not certified product translations. In particular, resolve money-versus-inventory wording with a Tamil-speaking owner rather than reusing an ambiguous word everywhere.

Do not guarantee zero font swapping or optical parity. Test loading, fallback rendering, line breaks, clipping, and layout movement on actual browsers before accepting the typography.

---

## 5. Component Patterns & UX Blueprints

All additions in this section beyond the two supplied screens are **recommended extensions**. They specify how existing functionality should look and behave. They do not authorize new backend features.

### 5.1 Responsive shell and content layout

| Available width | Recommended presentation |
|---|---|
| Below 768px | Single-column working view. Approximately 16px gutters where feasible. Bottom navigation on top-level compositions. Full-page detail or an existing accessible sheet pattern. |
| 768-1279px | Architecture §7.1 tablet mode: side rail and comfortable content. Do not force a split when the available width does not support it. |
| 1280px and above | Architecture §7.1 desktop mode: full navigation labels and useful wider content. Keep long-form reading nearer 640px. Preserve logical reading order. |

The architecture's 768/1280px navigation boundaries supersede the earlier exploratory 640/1024px suggestion. These are layout modes, not a requirement to build the Phase 0.4 application shell during the design trial. Use available container width to choose measurement columns.

390px is a review reference, not a `width: 390px` rule. A 480px single-column view remains an option for a focused flow, not the application-wide desktop maximum. Verify meaningful content reflows at 320 CSS pixels. [R6]

Do not create sideways page scrolling. A genuinely two-dimensional table may have a labeled, contained scroll region, but customer names, forms, schedules, and measurement cards should reflow. Desktop convenience must not change information hierarchy or remove mobile capabilities.

### 5.2 Interaction-state contract

| State | Required treatment |
|---|---|
| Default | Clear text, correct semantic pair, identifiable interactive boundary where needed. |
| Hover | A modest background/border change on devices with hover; never the only way to reveal a required action. |
| Pressed | Stable layout and a distinct action surface; no spring or scale animation on operational controls. |
| Focus-visible | A visible focus indicator independent of hover/selection. Default: 3px forest outline with 3px separation on light surfaces; provide an inverse/two-tone alternative on dark surfaces. |
| Selected | Persistent text/shape/indicator plus suitable programmatic state; not color alone. |
| Loading / submitting | Preserve the button label's meaning and width, show progress text, prevent duplicate activation through existing form logic, announce status appropriately. |
| Disabled | Actual disabled semantics when applicable, distinct from read-only, with an adjacent explanation when the reason is not obvious. |
| Read-only | Readable, selectable/copyable information; do not fade it like unavailable functionality. |
| Invalid | Textual error associated with the field plus an error boundary; retain entered values. |
| Empty | Explain the state and present one appropriate existing next action. Distinguish no records from filtered-out records. |
| Failure | Explain what failed, retain context, provide a supported retry. A toast alone is insufficient for a persistent failure. |
| Saved | Confirm only after the application actually acknowledges the save. Never imply persistence from an optimistic visual change alone. |

Focus outlines must not be clipped by overflow containers. On dialogs/sheets, use the existing accessible primitive: name the dialog, place focus appropriately, contain modal focus, support dismissal, and restore focus sensibly. [R7]

Use the motion tokens only for modest color/opacity/position feedback. Respect reduced-motion preferences; do not add celebratory animation, autoplay, or shimmer as the only loading signal. Do not globally remove existing motion necessary to understand another feature without review.

### 5.3 Buttons, inputs, and navigation

**Buttons.** Primary: forest fill, white text, 10px corners, 48px minimum target height. Secondary: white/subtle surface, readable text, suitable control outline. Tertiary: labeled text action with a full target area. Destructive: explicit wording and an error treatment only for genuine destructive behavior. Prefer one dominant action per task region.

Use minimum height rather than fixed height, so long labels and translated text can wrap. Icons supplement labels on primary actions. Icon-only secondary controls need an accessible name and a 44px minimum target.

**Forms.** Keep a visible label above each field. Inputs start at 16px; helper/error text is readable and associated with the control. Use placeholder text only as an example, not as the label. Use the control-border token for boundaries needed to recognize editable regions. Keep `required`, optional, read-only, and invalid states distinct.

Use existing native or accessible library selects, date pickers, switches, checkboxes, radios, and comboboxes. Do not replace them with styled clickable `div` elements. Enlarge the interactive label area around small checkbox/radio visuals. Preserve keyboard and screen-reader behavior when restyling.

**Navigation.** Retain the source's top-level `Today`, `Garments`, `Clients`, `Lookbook` presentation as a design reference. Preserve currently implemented destinations and permissions; do not delete other product navigation to match this list. If these four destinations do not represent the actual product structure, report the mismatch.

Each navigation item has an icon plus label, a comfortably sized target, and a non-color active indicator. Use route semantics for page navigation; use a tab pattern only for real tab panels. Do not make noninteractive status pills look tappable.

### 5.4 Order cards and garment identity

A working record presents customer/garment identity first, a concise requirement second, the next relevant commitment next, and finance only in an authorized context. Keep secondary metadata visually subordinate, not illegible.

Provide a clear opening link or button. Avoid nesting buttons inside a link that wraps the entire card. Long names wrap naturally, with the full identity available; do not enforce a two-line clamp if it hides important information.

Use an actual garment image or a clearly labeled reference image where available. Distinguish **reference design**, **work-in-progress photo**, and **finished garment**. A generic blouse silhouette is a fallback, not proof of the requested neckline or cut. Do not make a silhouette interactive unless a supported view or action exists.

Recommended image treatment: approximately square thumbnails in work lists and consistent portrait tiles in the lookbook. Preserve garment proportions; provide a full-image view when available. An internal specification image must not be cropped in a way that hides important tailoring details.

### 5.5 Measurement system - critical guardrails

Retain two explicitly named contexts: **Client Body Profile** and **Finished Garment Measurements**. Their different surfaces support recognition; the label and data provenance do the real work. A neutral body-profile presentation does not imply lower accuracy.

Show, where supported by real data:

| Information | Required display rule |
|---|---|
| Measurement type | Body or finished garment; never infer the type from a garment name. |
| Owner/context | Customer plus relevant garment item or saved profile. |
| Unit | Explicit `in` or `cm`; unit must remain evident while reading and editing. |
| Record provenance | Recorded/updated date and profile/version where the product actually stores them. |
| Value | Readable decimal precision, not coerced into an integer. |
| Ease | Separate, explicitly recorded design allowance; no automatic rule introduced here. |
| Tolerance | Separate permitted deviation only when recorded; no invented `+/-` default. |

A missing value displays `Not recorded`, not `0`. Unknown measurement type or unit displays `Not specified` with a visible clarification note; do not label legacy records as finished measurements by assumption. Report any missing schema support separately.

Use `14.5 in` for a standalone readout, or a visible unit suffix beside an input. A bare double quote is not the only unit explanation. Preserve existing unit-conversion and precision rules; do not introduce conversion or rounding as a styling change. Repeated units in visual cells may be concise, but accessible names must identify the measurement and unit.

Start with two columns at a typical 390px view when labels fit. Fall back to one for narrow containers, zoom, or long translations. Three columns are allowed only when each cell remains readable. Prefer CSS grid/container behavior to device-specific assumptions; do not squeeze three long labels into a phone screenshot.

Prefer the existing numeric input and validation implementation. If a decimal input is needed, use a suitable decimal keyboard hint, but treat keyboard choice and actual validation as separate concerns. Preserve partial input while typing and show specific supported errors.

The supplied sample values are **display fixtures, not verified tailoring instructions**. `Bust point`, neck depth, circumference, and any width-versus-round measurement need the existing product's precise definition. Do not encode their values, ease, tolerances, or relationships as tailoring formulas.

### 5.6 Independent status tracks and finance

| Concept | Examples | Independence rule |
|---|---|---|
| Production | Cutting, Basting, Trial ready, Finished. | Map existing states; never advance production because a trial time passed. |
| Schedule | Trial today 4:30 pm; delivery 16 October. | Trial and delivery are distinct events within scheduling. |
| Finance | Total, received payments, remaining balance, paid, overdue. | Never infer payment from a green production badge or handover status. |

The source's production/trial/delivery header remains valid as a visual summary, provided the payment summary is separately visible. Do not rename it a three-state business model or couple its fields in code.

Ordinary `Balance remaining: ₹1,400` uses primary text with clear weight. Red requires a real overdue/error condition from supported business rules. A paid amount may use the revised paid-green token plus a `Paid` label.

Use the existing locale-aware currency formatter. Keep the currency symbol and amount together, preserve Indian grouping where appropriate, and allow the surrounding row to wrap. Do not rebuild ledger arithmetic in presentation components. Format the authoritative balance; distinguish unknown values from zero.

A payment receipt of ₹1,000 is a received amount, not an unexplained negative transaction. A subtraction-style summary is acceptable only when its arithmetic context is clear. Keep refunds, adjustments, and pending payments truthful to existing data.

Do not expose balances or payment controls in assistant/customer views unless existing permissions allow them. Hiding a button is not an authorization mechanism.

### 5.7 Screen 1 - Today / Working Day

**Retained intent:** know what needs attention and act without navigating a large dashboard.

1. Show the active boutique and the current date. Use `New order` as the primary quick action and a secondary `Find customer` action.
2. Show the most relevant upcoming commitment with its actual time, customer/garment identity, and next supported action. An amber accent indicates attention when warranted; an appointment is not automatically urgent merely because it is today.
3. Group remaining work by useful concepts such as `Due tomorrow`, `Ready for handover`, and `Awaiting measurements`. Keep the source's calm hierarchy; do not add decorative KPI panels.
4. Render the supported top-level navigation with active state and proper touch targets.

**Fictional preview fixture:** Meera Krishnan has a booking containing two independently tracked blouse orders, a trial on 14 October 2026 at 4:30 pm, delivery on 16 October, booking-wide total ₹2,400, received ₹1,000, and balance ₹1,400. Per-order allocation is not supplied. Deepika has a churidar alteration due 15 October; Kavitha has a garment ready for pickup and is paid; Anitha is awaiting measurements. These are not production records. [S1], [S2]

To demonstrate `In 2 hours`, fix preview time at `2026-10-14T14:30:00+05:30`. Production displays must use actual time and the supported workspace timezone. Do not hardcode `Today`, Wednesday, or a countdown. Prefer an absolute time alongside relative wording; avoid a timer that creates noise.

Avoid repeating the same urgent order in multiple sections without a clear reason. Do not reorder an active list while the owner is interacting with it merely because a clock tick occurred.

### 5.8 Screen 2 - Meera's order / garment detail

**Header.** Back navigation, customer identity, supported contact action, and a real order number. In fixtures, use `ORD-2026-0142` as an explicitly fictional order number and keep `ND-BL-014` labeled **Design reference**. Neither pattern dictates production numbering.

**Status summary.** Present `Production: Trial ready`, `Trial: 14 Oct, 4:30 pm`, and `Delivery: 16 Oct`. Use separate labels and wrapping, not a row of tiny compressed chips. Confirm actual state from data.

**Garment order.** Show `Garment order 1 of 2 in this booking`, its independent order number, name, meaningful image/fallback, and complete instructions. Independently tracked blouses are separate orders, not pieces of a single order (product §3). Notes and previous completed steps should not become a second competing status system.

**Measurement panel.** Label `Finished Garment Measurements` and the unit, then render a responsive field grid. Keep access to the body profile distinct. Example values from the source, such as 14.5 in length and 31.0 in waistband, are nonvalidated visual fixtures; do not present an unverified 6.5 in neck specification as an approved cutting instruction.

**Payment summary.** Show booking-wide total ₹2,400, advance received ₹1,000, and balance remaining ₹1,400. Explicitly identify the aggregate context and unavailable per-order allocations. Payment method and receipt date appear only when stored. Use neutral emphasis for the ordinary balance.

**Next action.** Retain `Record trial feedback` when supported and appropriate for the record's state. Put trial time in adjacent context rather than making the button unnecessarily long. Do not always render this CTA for every production stage. Do not invent a feedback workflow when the project does not implement one.

### 5.9 Bottom action, safe area, and keyboard behavior

On top-level screens, navigation may remain persistent. On a focused detail flow, prefer the task action plus clear back navigation without a second competing bottom bar. If the existing shell retains both, one shared layout component must own their stacking and spacing.

Allow the bar height to grow with text and localization. Reserve scroll space equal to the **actual rendered** bottom stack plus safe-area inset, using the existing layout mechanism; a hardcoded 64px offset is not sufficient for every language and viewport.

Account for `env(safe-area-inset-bottom)` once, not twice. Keep the focused control and its error text visible above navigation, the action bar, and the software keyboard. A sticky footer must not entirely obscure a focused control; this design aims to keep it fully visible. [R5]

Do not dismiss typed input on scroll or orientation changes. Use existing form recovery behavior. If persistence does not exist, do not show `Draft saved` or invent a sync queue; report the capability gap.

### 5.10 Supporting patterns and limits

**Lookbook.** Preserve useful garment imagery, category, design reference, and the existing enquiry action. Keep platform navigation separate from public customer content. Do not add stock photographs that imply work the boutique has completed. This is a minimum styling contract, not a full new lookbook specification.

**Tables and lists.** Reuse existing tables for genuinely tabular desktop work; preserve headings and row actions. Use a card/list adaptation where appropriate on small screens. Do not replace every table with cards or delete columns without an information-priority review.

**Empty/error/loading.** Distinguish first use, no search results, permission limits, load failure, and unavailable connectivity. Do not present network failure as an empty customer list. Keep last-known data only when the product truly retains it, with a truthful stale indicator.

**Notifications.** Use local field messages for field errors, banners for persistent page-level problems, and nonintrusive announcements for completed actions. Do not make every successful save modal.

**Print.** Where a cutting/job slip already exists, keep black-on-white readability, order/garment identity, measurement type, units, and provenance. Hide navigation and controls. Do not treat an operational printout as a decorative brand poster or add a new printing feature.

**Scope limits.** The source supplies two operational screens, not complete checkout, ready-made inventory, reporting, catalog administration, staff management, or customer-portal designs. Apply shared tokens to those existing modules only after checking their requirements. Do not claim they are fully specified by this document.

---

## 6. Accessibility & Operational Guardrails

### 6.1 Accessibility target and evidence

Target **WCAG 2.2 AA** for implemented screens, with more generous product-specific touch sizing. A contrast table does not establish full conformance; keyboard, semantics, reflow, focus, errors, and real screen-reader use remain to be tested. [R1]

Use 4.5:1 for ordinary text and 3:1 for qualifying large text. In this system, keep all operational labels at the ordinary-text target regardless of their visual prominence. Meaningful non-text cues that identify controls or states need appropriate 3:1 contrast against adjacent colors; decorative dividers do not all need to be darkened. [R2], [R3]

The product's 44px minimum / 48px preferred touch size is a deliberate choice. WCAG 2.2 AA's Target Size Minimum criterion is 24 by 24 CSS pixels with exceptions; the enhanced criterion uses 44 by 44 with exceptions. Do not mislabel the product's 48px policy as the universal AA threshold. [R4a], [R4b]

### 6.2 Required operational behavior

Preserve logical keyboard order, visible focus, accessible names, associated labels/errors, and the current semantic component behavior. Use text as the primary status explanation. Instructive icons and images need meaningful alternatives; decorative icons should not repeat an already announced label.

Support 200% text enlargement, reflow at 320 CSS pixels, and user text-spacing overrides without clipped controls or hidden instructions. Test applicable spacing overrides rather than forcing every script to use Latin tracking. [R6], [R12]

Do not make drag-and-drop, swipe, hover, or color perception the only way to perform an essential action. Preserve existing accessible alternatives. Respect reduced motion and test forced-color/high-contrast rendering where available.

Never auto-advance a production stage from time, auto-fill missing measurements, invent measurement provenance, assume a balance is overdue, or label an unsaved local edit as saved. These are data integrity requirements, not stylistic preferences.

### 6.3 Unverified assumptions to validate with the owner

Validate readability in the actual shop lighting, comfort of the serif titles, real Tamil text, one-handed target placement, the owner's preferred Trial/Fitting and Client/Customer terminology, and whether a two-column measurement view is practical during work.

The source's workshop-light narrative is a plausible design context, not proof of a completed test. Collect actual observations and amend this document only when a decision changes.

---

## 7. Migration & Engineering Implementation Guide

### Repository trial, 15 October 2026

The owner approved a local-development experiment, tracked in [issue #45](https://github.com/nishanthturnstile/aarili/issues/45), following foundation #3. The existing Next.js 16.4 / React 19.3 / Tailwind 4.3 / Base UI 1.9 stack is retained. `packages/ui/src/globals.css` remains the sole executable token authority; the reference CSS above is a role specification, not a second stylesheet to install.

In PowerShell, set `$env:AARILI_DESIGN_TRIAL = 'grounded-editorial'`, then run `pnpm dev:web`. Open `/dev/design-system` for sequential current-light / candidate-light / current-dark comparisons and synthetic Today/detail compositions. Existing setup, sign-in, recovery, owner, and connection routes inherit the candidate. Remove the environment variable and restart to restore the current default. Production ignores the flag and returns 404 for the Design Lab.

The three new font packages are pinned at 5.3.0: `@fontsource-variable/newsreader`, `@fontsource-variable/plus-jakarta-sans`, and `@fontsource/noto-serif-tamil`. Actual CSS family names are `Newsreader Variable`, `Plus Jakarta Sans Variable`, and `Noto Serif Tamil`; Noto Sans Tamil is retained. Only normal faces are imported; unicode-range declarations restrict the variable families' downloads to used characters. Static Tamil faces are explicitly subsetted. No external font service is used.

The preview uses `ORD-SAMPLE-0142` and `ORD-SAMPLE-0143` within `BK-SAMPLE-014`. Operational labels follow product terminology (`Customer`, `Garment order`); they do not establish production numbering or navigation routes. Existing production copy is preserved. Missing measurements use wrapping text instead of a clipped single-line control. Preview navigation and task controls remain in document flow, so no unvalidated fixed footer can obscure a field. Software-keyboard/sticky positioning remains a physical-device and future-shell review item.

Validation and remaining review gates are recorded in [the trial evidence](agents/Issue_45_Design_Trial_Evidence.md). This experiment does not approve default typography adoption, a candidate dark theme, or completion of Phase 0.4's shell/PWA/i18n work.

### 7.1 Repository-first implementation

Before editing, inspect the existing project instructions, package versions, theme files, UI primitives, font loading, routing, forms, responsive shell, test setup, and implemented modules. The original written review did not inspect the repository; the 15 October trial confirms the existing Next.js, Tailwind, and shadcn/Base UI foundation described above. Recheck installed versions before extending the trial.

Reuse the actual stack. Do not reinstall a UI starter, run a theme reset, replace a component primitive library, or upgrade dependencies just to follow this document. Avoid generated full-screen code from Stitch as a replacement for existing business screens.

### 7.2 Mapping to an existing component library

When an existing library uses CSS semantic variables, map these reviewed roles onto it. For shadcn/ui specifically, the official theming contract separates surface/foreground pairs, input borders, and focus rings. The table below is a conditional mapping, not an instruction to install it. [R13]

| Existing role | aarili role |
|---|---|
| `background` / `foreground` | Canvas / primary text. |
| `card` / `card-foreground` | White card / primary text. |
| `popover` / `popover-foreground` | White overlay / primary text. |
| `primary` / `primary-foreground` | Forest / white. |
| `secondary` / `secondary-foreground` | Subtle surface / primary text. |
| `muted` / `muted-foreground` | Subtle surface / reviewed muted text. |
| `accent` / `accent-foreground` | Botanical selection surface / forest. |
| `destructive` / its text role | Rose/error action / a separately checked foreground. |
| `border` | Decorative divider/group border as appropriate. |
| `input` | Essential control border, not decorative hairline. |
| `ring` | Dedicated focus indicator. |
| Sidebar roles | Same neutral/forest roles, without inventing a dark application shell. |

Check how existing radius utilities are derived; do not assume one global radius value creates exact 6/10/16px corners. Do not put raw hex values inside a consumer that expects HSL channel triples. Adapt the format without changing the reviewed appearance.

For Tailwind v4, expose existing CSS-variable aliases through the appropriate `@theme` mechanism; the official documentation recommends `@theme inline` when referencing other variables. Do not overwrite the project's configuration or create a second token system. For another Tailwind version or no Tailwind, use that installed stack's supported mechanism. [R14]

Check library opacity modifiers such as semi-transparent focus rings and low-opacity invalid borders: they can invalidate the solid-color pair checks. Preserve the final contrast, not merely the nominal token value.

### 7.3 Font integration

Use the existing font-loading mechanism. If this is a Next.js application, its documented `next/font` mechanism supports self-hosting fonts and serving them from the application's domain. Confirm availability and options in the installed version; connect its generated family variables to the theme. Do not add duplicate runtime Google Fonts links alongside an existing font loader. [R15]

Use the relevant Tamil assets when Tamil content can render, including mixed-script customer names in an otherwise English interface. Avoid preloading every font weight and script unnecessarily. Test slow/loading-failure fallback and actual glyph rendering. Font files are not included in this handoff.

### 7.4 Incremental rollout

**Phase 1 - inspect and map.** Produce a short implementation plan in the task response, identifying current files, reusable primitives, missing capabilities, and possible regressions. Do not create a new collection of planning documents.

**Phase 2 - isolate foundations.** Add/reconcile tokens and typography in a development-only preview scope. Adapt existing primitives; keep the rest of the application visually unchanged where possible during review.

**Phase 3 - Design Lab.** Reuse existing Storybook if present, otherwise add the smallest appropriate development-only component gallery. Show real components, not disconnected mock HTML. Include foundation swatches, type specimens, states, measurement panels, and the two source screen compositions using synthetic data. Ensure the preview is excluded from production or protected through the existing access mechanism; a hidden route name is not protection.

**Phase 4 - representative flow.** Apply the system to one implemented Today-to-order-detail flow when available. If it is not implemented, keep it a Design Lab composition and do not build missing business functionality. Record screenshots and test results.

**Phase 5 - owner review and broader adoption.** Pause for visual review before migrating the remaining feature screens. After approval, update existing screens in small, reversible changes. Preserve behavior, permissions, routes, and data models.

**Phase 6 - cleanup.** Remove obsolete duplicate tokens only when references are migrated. Keep a short change record and documented remaining gaps. Do not delete other design documents without checking whether they contain still-valid requirements.

### 7.5 Scope and safety rules for the agent

The agent must not change API contracts, database schemas, payment logic, measurement calculations, authentication, authorization, or tenant isolation for this styling task. It must not add unimplemented buttons, fabricated live data, fake autosave, automatic WhatsApp sending, or a simulated payment success state to production.

Preserve an existing dark theme if the project has one; this handoff does not specify or validate its replacement. Isolate the new light theme and report dark-theme compatibility work separately. Do not silently force all users into light mode or delete a theme toggle.

Use synthetic data only in previews. Keep sample contact details nonfunctional/masked. Do not send customer data or garment photos to an external design service as a side effect of implementation.

### 7.6 Agent handoff prompt

```text
Read docs/aarili-design-system.md and the repository's existing agent instructions.

Implement the reviewed Direction A design system incrementally in this existing
project. Start by inspecting the actual stack, theme tokens, font loading,
component primitives, navigation, forms, and test setup. Treat the document's
change register as intentional reviewed changes, not permission for a redesign.

Preserve the forest/linen palette family, editorial/sans typography pairing,
Tamil support, garment-oriented information, and independent production,
scheduling, and payment presentation.

First report a concise change plan and the affected existing files. Then apply
the foundations and build or update a development-only Design Lab using real
shared components and synthetic fixtures. Include all relevant component states
and the Today and order-detail compositions. If those flows already exist,
apply the system to one representative flow without changing its behavior.

Use the installed component library and framework. Do not introduce another UI
library, upgrade the stack, regenerate the app, or copy a complete Stitch export
over working screens. Do not alter schemas, APIs, authorization, payment math,
measurement formulas, state machines, or other business logic.

Do not invent missing data, units, tolerance, autosave, backend capabilities,
status transitions, or translations. Report gaps explicitly. Keep actual order,
garment, design-reference, and measurement-record identities distinct.

Validate contrast using actual rendered styles, English/Tamil layout, keyboard
focus, component states, 320/390/768/1024/1440px layouts, text zoom, and sticky
bar/keyboard behavior where the environment supports it. Run existing relevant
checks and distinguish executed tests from untested items.

Stop for visual review after the Design Lab and representative flow. Do not
migrate the whole application before that checkpoint. Return changed files,
preview instructions, test results, and remaining risks or questions.
```

---

## 8. Validation & Acceptance Checklist

These items are **acceptance criteria, not already completed tests**. An implementation report must mark each relevant item `Pass`, `Fail`, `Not run`, or `Blocked`, with evidence. Automated checks do not replace manual review.

| Area | Required evidence |
|---|---|
| Visual identity | Neutral canvas, restrained forest actions, editorial identity, clear operational text; no unapproved new theme. |
| Real components | Design Lab imports the same primitives used in production. |
| Color contrast | Actual text pairs meet targets; essential control boundaries and focus cues remain visible; no failing opacity overrides. |
| States | Default, hover where applicable, pressed, focus, selected, loading, disabled, read-only, invalid, empty, error, and saved represented truthfully. |
| Responsiveness | Screens checked at 320, 390, 768, 1024, and 1440 CSS pixels; no unintended page overflow. |
| Typography | All selected fonts actually load; long Latin names, Tamil specimens, mixed script, and currency render without clipping. |
| Zoom and spacing | 200% text enlargement, 320px reflow, and applicable text-spacing overrides preserve information and actions. |
| Keyboard | Every implemented action works without a pointer; focus order is logical; dialogs restore focus; no hidden focused control. |
| Mobile ergonomics | Primary controls target 48px; other controls at least 44px by product policy; keyboard/safe-area interaction reviewed on a device or reported untested. |
| Measurements | Type, unit, garment/profile context, and missing values are clear; no fabricated ease/tolerance/provenance or altered precision rules. |
| Finance | Sample balance is correct; ordinary balance is not styled overdue; authoritative totals and permissions are unchanged. |
| Identity | Order number, garment item, lookbook reference, and measurement record are not conflated. |
| Long/edge content | Long names, multiline requirements, large currency values, missing images, empty data, and error states remain usable. |
| Integrity | No changes to routes, schema, business state machines, payment math, or permissions unless separately authorized. |
| Production safety | Synthetic fixtures cannot be mistaken for real records; preview access/production exclusion is verified. |
| Regression | Existing type checks, lint, build, and relevant tests run where available; unsupported tests reported honestly. |
| Owner approval | Owner reviews the representative flow before broad adoption. Record actual feedback, not inferred satisfaction. |

### Remaining decisions that must not be guessed

The actual repository stack and installed versions; existing navigation and route structure; persisted measurement type/unit/version support; approved tailoring field definitions and tolerances; payment/overdue business rules; translation wording; dark-theme obligations; and availability of trial feedback, save recovery, enquiry, or printing capabilities must be determined from the project and owner.

Use available source evidence and existing behavior. Do not block token/component preview work on unrelated future product decisions, but do not ship a misleading production interaction to work around an unresolved dependency.

---

## 9. Sources & Review Provenance

### Supplied project sources

**[S1]** User-supplied `aarili Design System Specification - Direction A: The Grounded Editorial Sanctuary`, provided in this conversation. Primary basis for direction, palette, fonts, roles, sample screen composition, and migration intent. Its claims of completed tests are treated as unverified narrative unless supported separately.

**[S2]** Earlier user-provided exploration brief, `Pasted text(3).txt`, especially product context, persona hypotheses, and fictional screen data. It identifies `ND-BL-014` as a reference design, not an order number. No superseded visual direction is treated as approved.

### Official references checked on 14 October 2026

[R1]: https://www.w3.org/TR/WCAG22/ "WCAG 2.2; contrast ratio and relative luminance definitions"
[R2]: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html "Understanding Contrast (Minimum)"
[R3]: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html "Understanding Non-text Contrast"
[R4a]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html "Understanding Target Size (Minimum)"
[R4b]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html "Understanding Target Size (Enhanced)"
[R5]: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html "Understanding Focus Not Obscured (Minimum)"
[R6]: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html "Understanding Reflow"
[R7]: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ "ARIA Authoring Practices: Modal Dialog"
[R8]: https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/METADATA.pb "Google Fonts: Newsreader metadata"
[R9]: https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/METADATA.pb "Google Fonts: Plus Jakarta Sans metadata"
[R10]: https://raw.githubusercontent.com/google/fonts/main/ofl/notoseriftamil/METADATA.pb "Google Fonts: Noto Serif Tamil metadata"
[R11]: https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstamil/METADATA.pb "Google Fonts: Noto Sans Tamil metadata"
[R12]: https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html "Understanding Text Spacing"
[R13]: https://ui.shadcn.com/docs/theming "shadcn/ui: Theming"
[R14]: https://tailwindcss.com/docs/theme "Tailwind CSS: Theme variables"
[R15]: https://nextjs.org/docs/app/getting-started/fonts "Next.js: Font optimization"

External references support standards and implementation facts, not the proposed aesthetic or persona assumptions. Color ratios are this review's calculations. Responsive breakpoints, typography refinements, state contracts, and rollout sequencing are reviewer recommendations. Recheck framework documentation against installed versions when implementing.
