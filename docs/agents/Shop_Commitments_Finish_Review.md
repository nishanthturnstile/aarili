disposition: fix

No literal PRODUCT.md/DESIGN.md, five-block concept contract, or separate quality card was supplied; this incumbent extension is reviewed against the supplied product/design baselines and direction brief, with no new world, comp, or seed obligation inferred.

## persistence

Pass for the existing Settings extension: Shop_Settings_Design.md,
Shop_Commitments_Implementation_Evidence.md and aarili-design-system.md persist
scope, visual authority and remaining activation gates. All 18 required captures
were opened: commitments-{phone,tablet,desktop}-{en,ta}-{warnings,unknowns,history}.png.
Their widths are 360/820/1440 respectively; each shows the document top and
the named warning, unresolved-input or history state without blank regions.
Readable in-memory crops supplement the tall full-page views. The supplied
detector result is []; no second detector or browser/build/database run was made.
The implementation evidence's pending verification ledger needs the parent's
final results before delivery; automated, physical-device and human acceptance
remain distinct.

## fidelity

| Element | Assessment | Evidence |
| --- | --- | --- |
| TYPE | match | Existing Noto Sans/Tamil character, readable body copy and 600-weight headings; no new display face. |
| MATERIAL | match | Restrained opaque controls and flat product surfaces follow the incumbent world; no imitation physical material or raster promise. |
| GROUND | match | Cream/plum light and plum-black dark match the supplied semantic-token authority. |
| Settings navigation and form hierarchy | match | Existing narrow desktop navigation, tablet rail and phone bottom navigation; one editing column with labelled controls. |
| Responsive bilingual controls | adaptation | Labels/actions wrap on phone as expressly required by Shop_Settings_Design.md and aarili-design-system.md; the supplied capture matrix shows both scripts. |
| Draft, review and history boundary | match | Save/review/publish remain unbound-preview operations; read-only published draft, new-draft action and history entry are visible. |
| Known warning versus unresolved input | match | Unknown load remains unresolved alongside known cutoff/lead warnings; reasons do not erase risks or imply booking/payment authority. |
| Calculation fact labels | contradicted | All viewport sets label computed available lead days (2) as standard lead time although the configured standard is 5; the dated capacity-week start is labelled with the editor's weekday-index instruction. |
| Calculation unit localisation | contradicted | Tamil fact rows show raw `garments`, despite an existing Tamil translation used by the controls. |
| Synthetic and transient truth | match | Fixture assumptions, unresolved production authority, stale-preview guidance and absence of order/reservation/money effects are explicit. |

Source supports labelled inputs, composition handling, stale-result notices,
busy disabling, retry/recovery and owner invalidation. Actual screen-reader
experience, physical Android operation and fluent Tamil acceptance remain
unknown; screenshots and supplied automated results do not establish them.

## ceiling

Reached for the incumbent Operate surface apart from the two material copy
defects below. Additional illustration, ornament, dimensional effects or authored
entrance motion would not serve this ordinary Settings extension. The first
viewport establishes the selected task and its unbound scope; later calculations
retain a readable label/value rhythm. No new redesign is indicated.

## material_fixes

1. Truth / readable owner operation: in apps/web/src/app/shop-commitments-screen.tsx:761, give preview `leadDays` and `weekStart` fact-specific bilingual labels (available lead days; capacity week starts on). Do not reuse the editor labels in packages/i18n/src/shop-commitments-messages.ts:45/49 and :208/212. The evaluator assigns actual lead to `leadDays` and configured requirement to `requiredLead`; the contract's preview `weekStart` is a date, whereas configuration `weekStart` is a weekday index. Preserve those meanings and recapture the same 18 files.
2. Bilingual coverage: in apps/web/src/app/shop-commitments-screen.tsx:771, render typed fact units through the existing `garments` / `effort-points` translations instead of raw `String(v)`; keep numbers, dates and entered fixture labels unchanged. Confirm the Tamil result says the same unit as its selected control and recapture the same 18 files.

## keep

Preserve the existing cream/plum and dark identity, single-column reflow, explicit synthetic/unbound scope, independent warning/unknown/decision facts, immutable history and owner review/CI/merge/deployment gates.

## verdict

Scoped post-fix pass, 18 October 2026, using the same 18 capture paths refreshed
at 12:13–12:14 IST and the changed result-rendering/message source. All captures
were reopened and valid; readable in-memory crops checked the changed facts.
The original review above is retained as the pre-fix record.

1. Resolved — fact labels now distinguish calculated available lead days (2) from required lead days (5), and identify 2026-10-19 as the capacity-week start local date. EN/TA wording appears in the recaptures; the editor's standard-duration and weekday-index labels retain their original meanings.
2. Resolved — unit facts now use translated messages: English shows “Garment count” and Tamil shows “ஆடை எண்ணிக்கை”, matching the selected control. Source applies the same translation path to the typed unit enum, including effort points; dates and numeric facts remain unchanged.

## remaining

Clear for the two scored fixes; no regression introduced by this batch was
observed. This ship disposition covers the scored fixes only, not a new review
of the whole surface. Physical Android, fluent Tamil and assistive-technology
acceptance remain unestablished; owner review, CI, merge and deployment gates
remain in place. No browser/build/database commands or application edits were
performed in this verdict pass.

disposition: ship
