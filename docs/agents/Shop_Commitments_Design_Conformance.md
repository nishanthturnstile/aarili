# Shop commitments design conformance

18 October 2026. Issue [#88](https://github.com/nishanthturnstile/aarili/issues/88),
roadmap 1.1.1 E. This is an ordinary extension of the existing Settings surface;
it establishes no new visual world or system-wide rule.

## Authority and evidence

[Aarili design system](../aarili-design-system.md) and
`packages/ui/src/globals.css` retain visual authority. The
[Settings design](Shop_Settings_Design.md) supplies the surface direction;
product SET-06/08/11, DAY-06 and USE-01/02/08 govern behaviour, and architecture
§§6–9/15 govern boundaries and verification. This report does not revise those
sources, PRODUCT.md, DESIGN.md, tokens or a design sidecar.

Source inspection covered `shop-commitments-screen.tsx`, `owner-workspace.tsx`,
`owner-flow.tsx`, `shop-commitments-messages.ts`, shared `globals.css` and
`tests/ui/shop-commitments.spec.mjs`. Rendered findings below are attributed to
the supplied [finish review](Shop_Commitments_Finish_Review.md), not an independent
browser or screenshot inspection by this documenter. Verification results belong
to the [implementation evidence](Shop_Commitments_Implementation_Evidence.md).
The supplied single detector output, `.scratch/commitments-detector.json`, is `[]`;
it is supporting evidence rather than a conformance verdict.

## Conformance

| Area | Observed implementation and assessment |
| --- | --- |
| Palette and material | Shared semantic roles preserve incumbent cream/plum light and canonical dark. Commitment styles add sizing, spacing and wrapping; they introduce no new palette, imagery, material or elevation system. The finish reviewer reports matching opaque, restrained surfaces in both languages/themes. |
| Typography | Shared Noto Sans/Noto Sans Tamil stacks, 16px body, 400/600 weights and 1.6/1.85 language line heights remain authoritative. No new font or display treatment is introduced. |
| Controls | Existing Button and Input primitives are reused. Native selects use the existing input treatment and explicit labels; checkbox choices use the existing labelled pattern. Busy fieldsets/actions disable appropriately; failures use alerts, draft/stale feedback uses status, and preview results use a polite live region. This supports accessible operation without establishing manual assistive-technology acceptance. |
| Layout and navigation | The extension uses the incumbent Settings section buttons and owner workspace shell. Editing is a readable vertical task with wrapping field labels, bounded selects and stacked definition-list facts. The finish review reports phone/tablet/desktop reflow at 360/820/1440; the source test asserts no horizontal overflow. The independent Settings design's narrow section-list composition is not a new composition implemented by this ticket. |
| Language and fact meaning | Owner-flow registers both catalogues within the existing locale mechanism. Source now gives calculated available lead days and capacity-week local date their own EN/TA labels, distinct from configured standard lead days and weekday index. Typed units use translated messages; numbers/dates and entered text retain their values. |
| Scope and consequence | Introductory, review and result copy explicitly identify synthetic inputs, unbound-preview publication and absent order/reservation/charge effects. Known warnings, unresolved inputs, calculation facts and hypothetical decisions are separate. Reasons and waivers do not erase risk facts or grant production authority. |
| Draft and history | Source exposes save, review, retry, conflict comparison, immutable revision history and read-only published drafts. Changed preview inputs receive a stale-result notice. These visible contracts agree with the supplied Settings direction; database integrity is evaluated separately in the implementation evidence. |

## Review disposition and limits

The finish reviewer originally returned `fix` for misleading calculation labels
and untranslated fact units. After one correction batch, the same reviewer
reopened all 18 refreshed captures:
`commitments-{phone,tablet,desktop}-{en,ta}-{warnings,unknowns,history}.png`.
Its appended `ship` disposition resolves **those two scored fixes only**; it is
not a second whole-surface acceptance. Source and EN/TA assertions support both
corrections. The parent reports the refreshed Playwright/axe matrix passed 3/3;
this documenter ran no browser, build or database commands.

The incumbent palette, typography and primitives therefore remain sufficient
for this extension. No new token, comp, world definition or system-document
rewrite is warranted. No observed defect is promoted into reusable house style.
The planned narrow section-list composition versus incumbent section buttons is
recorded above without repairing or canonizing that existing difference.

Physical Android operation, fluent Tamil wording, screen-reader experience and
real shop lighting remain unestablished. Owner review, hosted CI, policy approval,
merge/deployment and privacy/restore/live-pilot gates remain separate. Catalogue
binding belongs to 1.1.2 and atomic booking acceptance to 1.2.1; this report grants
neither integrated AC-60 acceptance nor production activation. The implementation
evidence records the completed clean install/export gate (exit 0, 81.160s, fresh
ten-package build and unchanged lockfile) and the ready disposable review host
(HTTP 200, first observed at 12:16:29 IST). These checks do not close the human,
hosted CI, merge or deployment gates above.
