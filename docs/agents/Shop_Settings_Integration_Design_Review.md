# Settings integration: independent design handoff

17 October 2026. Bounded existing-world Operate review of the combined Settings
navigation for directory issue #86 / PR #92 and policies issue #87 / PR #91.
The fresh independent finish reviewer returned **ship at combined-navigation
integration scope only**, with no material fixes. This does not establish
whole-feature, owner, production-policy or pilot acceptance.

## Authority and evidence

The [design system](../aarili-design-system.md),
[Settings design](Shop_Settings_Design.md), and canonical
`packages/ui/src/globals.css` retain authority. This documenter read Impeccable's
`reference/document.md` within the explicitly limited ordinary-extension brief.
Only this report is written; no PRODUCT.md, DESIGN.md, sidecar, tokens or baseline
changes are introduced.

Direct source comparison covered the final four-section `owner-workspace.tsx`,
`owner-flow.tsx` message composition, shared CSS, Settings/directory/policy
message catalogues and draft-route helpers. The existing
[directory conformance](Shop_Directory_Design_Conformance.md),
[policy design handoff](Shop_Policies_Design_Review.md), and
[integration evidence](Shop_Settings_Integration_Evidence.md) were read.

Rendered observations are attributed to the fresh independent finish reviewer,
who opened all six valid document-top viewport captures. The documenter did not
independently open these images or run browser, build, test or detector commands.

| Viewport | English / Current light | Tamil / Current dark |
| --- | --- | --- |
| Phone, 360 × 800 | [Capture](../../.scratch/integration-captures/phone-en.png) | [Capture](../../.scratch/integration-captures/phone-ta.png) |
| Tablet, 820 × 1180 | [Capture](../../.scratch/integration-captures/tablet-en.png) | [Capture](../../.scratch/integration-captures/tablet-ta.png) |
| Desktop, 1440 × 1000 | [Capture](../../.scratch/integration-captures/desktop-en.png) | [Capture](../../.scratch/integration-captures/desktop-ta.png) |

These are final navigation views at the document top, not full-page evidence or
coverage of every editor, history, recovery state or theme/language pairing.

## Comparison with the incumbent system

| Area | Integration finding |
| --- | --- |
| TYPE | Self-hosted Noto Sans and Noto Sans Tamil, established body/heading hierarchy, 400/600 weights and Tamil leading remain shared. No new type authority is introduced. The reviewer found type consistent across the supplied captures. |
| MATERIAL and GROUND | Current light cream/plum and Current dark warm plum/pink inherit the canonical semantic roles. Existing plain surfaces, borders and spacing carry hierarchy; the selector adds no palette, imagery or decorative depth. The reviewer found material and ground consistent. |
| Workspace shell | Existing phone bottom navigation, tablet rail and desktop sidebar surround the same Settings task column. The reviewer found shell continuity in all six captures. |
| Selector and adaptation | One labelled navigation region presents Shop profile, Working calendar, Payment methods and vendors, and Commercial policies, each connected to its real screen. Shared outline Buttons and wrapping `calendar-actions` preserve the incumbent grammar. Tamil labels wrap and increase height without changing reading order. |
| Selected state | The active button exposes `aria-pressed`; the shared pressed-button underline makes selection visible without depending on colour alone. Existing control geometry and focus styles remain shared. |
| Messages and language | Owner composition supplies Settings, calendar, directory and policies catalogues under their separate namespaces for the selected locale. English startup and explicit Tamil selection remain the incumbent decision; this merge does not establish a persisted language preference. |
| Reload and draft routing | Source initialisation recognises all four public section values. A draft-only URL retains the calendar fallback; directory and policy draft helpers set their explicit section. Section changes retain the dirty-state guard, remove the previous draft reference and replace the section URL. Opaque draft identifiers remain routing references; account values and policy terms are not navigation content. |

## Existing drift

The central design-system supported-surface inventory predates current customer
and Settings delivery. The Settings design describes five eventual groups and a
narrow desktop section list; incumbent composition uses wrapping top section
controls, now with four delivered groups. Delivery and commitments remains a
separate planned outcome. This integration preserves the incumbent composition;
it does not claim the fifth group or silently revise the approved design.

Shared Settings CSS also retains the existing mix of semantic spacing variables
and literal rem/44px values. These observations are recorded as incumbent
variation, not repaired or canonized as new design rules. No material new design
drift was identified within this bounded comparison.

## Verification attribution and remaining gates

The supplied fresh combined-navigation production Playwright result passed 3/3
in approximately 1.4 minutes, including axe, reflow and reload coverage. The
corrected fast gate passed 197 tests; the selected real PostgreSQL gate passed
14 tests across seven files in 105.31 seconds. These are supplied integration
results, not commands rerun by this documenter. Their detailed ledger and any
subsequent outcomes belong to [integration evidence](Shop_Settings_Integration_Evidence.md).

Two full desktop directory/policy regression runs were still running at this
handoff. No outcome is inferred here; consult that separate integration ledger.
No new integration detector ran. Historical feature-local `[]` detector output
does not prove this combined navigation passed a detector.

The finish review supplied its full five-section assessment and found no
material correction necessary within the navigation integration scope. Its
disposition does not replace feature-local evidence, establish WCAG conformance,
or close physical Android/shop-lighting, fluent Tamil, assistive-technology and
owner software review. Real receiving identifiers, approved production policy
authority, privacy/restore readiness and pilot activation retain their separate
gates. This handoff authorizes no deployment or activation.
