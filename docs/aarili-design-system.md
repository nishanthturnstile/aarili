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

Owner clarification, 15 October 2026: every interactive owner screen starts in **English**,
including after reload/navigation and when the browser prefers Tamil. Tamil
interface copy and branding appear only after the user selects the `தமிழ்`
control. Entered names/notes keep their original scripts. Language is not saved
or inferred yet; a persisted preference belongs to future settings/profile work.
English/Tamil owner catalogues live in the framework-free `@aarili/i18n`
package. Explicit language switching preserves entered values.
The static offline fallback always shows English and Tamil together and follows
the device colour scheme without reading stored appearance preferences. Its
headings use the bundled 400-weight fonts to keep that isolated fallback small;
interactive owner screens retain the established 600-weight headings.

- Self-host Noto Sans Latin and Noto Sans Tamil, normal weights 400 and 600,
  using the existing exact Fontsource 5.3.0 pins. No runtime font-service calls.
- Body text is 16px, with 1.6 line height; Tamil uses 1.85, normal letter spacing
  and its own font priority. Headings use the selected sans family at weight 600.
  Preserve customer names and notes in their entered scripts.
- Keep the existing 12px base radius, semantic spacing scale, flexible text and
  minimum 44px controls. Let labels and actions wrap rather than clip Tamil.
  The owner-entry auth surface and shop preview use 16px corners; this does not
  replace the shared control radius.
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
the dashboard and Sign-in connections show fixed bottom navigation on phone, a
collapsible rail on tablet and a full sidebar on desktop. The sidebar displays
the current shop name with wrapping. Navigation remains absent from authentication
and incomplete setup screens. Business workflow destinations remain future work.

## Product surfaces and verification

The owner-approved [entry revision](agents/Owner_Entry_Onboarding_Revision_Plan.md)
preserves this identity and separates authentication, required shop setup and the
workspace. It supersedes the composition in the earlier
[access/onboarding refinement](agents/Owner_Access_Onboarding.md). All three
surfaces share the restrained Aarili brand, appearance and language header.

Authentication uses a 28rem single-column card with one heading, associated
field errors, contextual recovery and one primary form action. It has no shop
progress, shop preview or workspace navigation. Protected registration collects
the setup ID once; verification then offers explicit sign-in. Password Show/Hide
controls expose pressed state and control association; setup tokens remain
masked. Recovery, reset and reauthentication retain their own explicit purpose.
The password input/visibility-control row wraps when space is constrained, and
the visibility button is limited to the container width. This allows Tamil
Show/Hide controls to move below the input with enlarged text and added spacing.
At widths up to 479px, shell inline padding is capped at 32px and auth-card inline
padding at 24px; up to 359px, auth-card inline padding is capped at 16px. These
caps preserve text space when relative spacing enlarges, while retaining the
ordinary 360px and desktop composition.

`/onboarding` is a dedicated page with a maximum 66rem stage. At 768px and above,
a larger task column and a shop-identity preview share a 1.15:1 grid; their gap
reduces from 5rem to 36px below 1024px. Below 768px the complete task and creation
action precede the preview in one column. The verified owner's name and email
are read-only account details. Shop name is the editable task, followed by an
explicit Create shop and continue action. The preview uses the entered name,
owner name, solid primary background and paired primary foreground; its preview
label prevents it implying creation. It is the composition's single expressive
element. No raster asset, extra font, palette or component library is introduced.

`/dashboard` shows the authorized shop name as its main heading, a welcome,
pending business-configuration guidance, account connections, reauthentication
and sign-out. It uses the existing responsive workspace navigation. This is the
dashboard entry shell; the operational dashboard remains roadmap 1.9.2. Do not
add invented orders, metrics, alerts or unimplemented workflow links. Shop
creation, business configuration and pilot readiness remain distinct.
`/connections` retains Google confirmation and recent-authentication protections.

Fields associate hints/errors, mark invalid values and focus the first invalid
field after validation. The single request-feedback region receives focus and
announces failures as alerts and notices as status. Authentication step changes
focus their heading when no notice receives focus. On workspace mount, the main
heading receives focus only when focus is still on the document body; this also
applies on completed-shop reload and connections entry. Shop creation replaces
the route with `/dashboard`, where that same heading rule applies. Do not restore
the former in-place completion-heading/description focus pattern.

Root and `/owner` resolve authoritative entry state: signed-out owners enter
sign-in, admitted pending owners enter onboarding, and completed owners with
their own membership enter the dashboard. Server entry checks and client
navigation share this decision; UI visibility is not authorization. Direct
entry denial and outages temporarily redirect to dedicated error screens with
retry through `/owner`; the entry API retains distinct 401/403/503 responses.
Private memory is cleared on invalidation and remote session signals. Page exit
hides the owner surface and clears forms/memory; a back/forward-cache return
reloads and revalidates before showing private data.

The supported current UI is protected owner registration/verification, sign-in,
recovery, password reset, reauthentication, shop onboarding, dashboard entry and
Google connections.
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
The [owner-entry evidence](agents/Owner_Entry_Onboarding_Evidence.md) records the
revision's acceptance mapping and verification status. Both final automated gates
passed; prototype approval and automated checks do not establish finished-flow,
fluent-Tamil, physical-device or assistive-technology acceptance.
The [#52 PWA foundation](agents/Issue_52_PWA_Evidence.md) reuses Status and Button
for connectivity/installation notices. Its static offline page derives both
palettes and local Noto fonts from the same authority; it shows Tamil and English
together without persisting language or business values. The installed icon is
a deterministic A monogram in the canonical primary colours. Update notices
appear only when the shared in-memory work guard is safe; updates wait until
every controlled Aarili window closes.
Run the repository verification and browser suites in both themes and languages,
including failure paths. Record font payloads and unrun physical-device,
shop-lighting and Tamil screen-reader checks. Automated checks do not establish
usability or WCAG conformance by themselves.
