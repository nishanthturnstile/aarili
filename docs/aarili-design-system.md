# Aarili design system

Owner selection, 15 October 2026: **Current light and Current dark**, including
Noto Sans and Noto Sans Tamil. Grounded Editorial / Candidate light was reviewed
and declined. Its unmerged [PR #46](https://github.com/nishanthturnstile/aarili/pull/46)
and branch retain the experimental evidence; it is not the product baseline.

## Authority and implementation

`packages/ui/src/globals.css` is the sole token authority. The web stylesheet
imports it. Tailwind v4 semantic aliases use `@theme inline`; components consume
roles rather than literal colours. Both themes use the same component contracts.

| Role | Current light | Current dark |
| --- | --- | --- |
| Page | `#faf6ed` | `#211c1e` |
| Text | `#282323` | `#f8f0e5` |
| Card | `#fffdf8` | `#2d2629` |
| Primary | `#751f3d` | `#efb4c8` |
| Primary text | `#fff9f1` | `#3a1422` |
| Control boundary | `#89796b` | `#a39399` |
| Focus | `#751f3d` | `#efb4c8` |

These values describe the selected identity; edit the canonical stylesheet to
change it. Light is the default. A labelled owner-header control switches to dark
and remembers only the visual preference. Storage failure must not stop either
theme from working in the current page. No business data belongs in browser storage.

## Typography, geometry and states

Owner clarification, 15 October 2026: every current screen starts in **English**,
including after reload/navigation and when the browser prefers Tamil. Tamil
interface copy and branding appear only after the user selects the `தமிழ்`
control. Entered names/notes keep their original scripts. Language is not saved
or inferred yet; a persisted preference belongs to future settings/profile work.
English/Tamil owner catalogues live in the framework-free `@aarili/i18n`
package. Explicit language switching preserves entered values.

- Self-host Noto Sans Latin and Noto Sans Tamil, normal weights 400 and 600,
  using the existing exact Fontsource 5.3.0 pins. No runtime font-service calls.
- Body text is 16px, with 1.6 line height; Tamil uses 1.85, normal letter spacing
  and its own font priority. Headings use the selected sans family at weight 600.
  Preserve customer names and notes in their entered scripts.
- Keep the existing 12px base radius, semantic spacing scale, flexible text and
  minimum 44px controls. Let labels and actions wrap rather than clip Tamil.
- Use semantic success/warning/info/error roles with text and icons. Money,
  production progress and scheduling remain independent business concepts;
  styling must not infer overdue state or treat a missing amount as zero.
- Inputs distinguish editable boundaries, invalid boundaries and focus. Read-only
  content remains readable. Disabled and busy controls remain identifiable.
- Preserve keyboard navigation, visible focus, dialog containment/restoration,
  reduced motion, text enlargement, reflow and usable font fallbacks.
- Dialog surfaces stay fully opaque during opening/closing movement so text
  contrast remains readable at intermediate animation frames.

## Components and layout

Maintain the installed Button, Input, Field, Card, Status and Dialog modules in
the shared UI package, plus the owner shell's WorkspaceNavigation. These are
owned source based on shadcn `base-nova` and
Base UI; preserve their local semantic tokens and accessibility contracts.
Install additional components only for a concrete approved workflow, reviewing
official generator output with pinned CLI 4.21.4. No Radix, vaul, extra component
library or theme manager. Table recipes must respect the architecture's Table v9.

Phone is below 768px, tablet 768–1279px, desktop 1280px and above. Adapt component
content to container width. Once server-verified owner/shop setup is complete,
Your shop and Sign-in connections show fixed bottom navigation on phone, a
collapsible rail on tablet and a full sidebar on desktop. The sidebar displays
the current shop name with wrapping. Navigation remains absent from authentication
and incomplete setup screens. Business workflow destinations remain future work.

## Product surfaces and verification

The supported current UI is owner setup, sign-in, recovery, password reset,
reauthentication, owner/shop setup and Google connections. Root enters sign-in.
Design galleries, synthetic Today/detail screens and sample bookings are not
product capabilities and have no product routes. Readiness APIs, synthetic test
fixtures, recovery tools and historical evidence remain verification safeguards.

Track delivery through [#47](https://github.com/nishanthturnstile/aarili/issues/47)
and [#48](https://github.com/nishanthturnstile/aarili/issues/48) for the selected
design foundation, with scope in the [approved cleanup plan](agents/Design_System_Adoption_Plan.md).
The responsive owner-shell extension is [#51](https://github.com/nishanthturnstile/aarili/issues/51);
its [acceptance evidence](agents/Issue_51_Responsive_Shell_Evidence.md) retains the
later physical-device and phase activation gates.
Sources: product USE-01/02/08/09; architecture §§5.2, 7.1, 9.2 and 15.
Run the repository verification and browser suites in both themes and languages,
including failure paths. Record font payloads and unrun physical-device,
shop-lighting and Tamil screen-reader checks. Automated checks do not establish
usability or WCAG conformance by themselves.
