# Receiving accounts and external vendors — design conformance

17 October 2026. Issue #86, slice 1.1.1c. Bounded documentation pass on the
finished ordinary Operate extension; no new visual system is established.

Authority remains the [approved Settings design](Shop_Settings_Design.md),
[research boundaries](Shop_Settings_REA_Evidence.md),
[ticket C and common obligations](Shop_Settings_Ticket_Packet.md), and
[architecture](../Architecture_and_Technology_Decisions.md). The owner's explicit
instruction preserves these authorities: no PRODUCT.md, DESIGN.md or generated
design sidecar is required or created. No design-authority file was changed.

## Evidence checked

Direct source inspection covered `apps/web/src/app/shop-directory-screen.tsx`,
`packages/i18n/src/shop-directory-messages.ts`, the shared
`packages/ui/src/globals.css`, Button/Input primitives, and sampled profile and
calendar history markup. The direction contract and final verification ledger in
[implementation evidence](Shop_Directory_Implementation_Evidence.md) and the
[finish review's final verdict](Shop_Directory_Finish_Review.md#verdict) were read.
This pass did not independently open captures or run browser, detector, test or
build commands. Rendered observations below are attributed to that finish review.

## Comparison with the incumbent system

| Area | Final implementation and conformance |
| --- | --- |
| Palette and material | Shared semantic light/dark roles remain authoritative. The light cream ground, warm text, pale card and wine primary retain their existing token values; dark overrides are shared. Directory CSS introduces no palette or shadow. Flat borders separate operational tasks. |
| Typography | Self-hosted Noto Sans/Noto Sans Tamil, 16px body, 14px small text, 32px top-level title and 400/600 weights remain inherited. Tamil retains its established family order, normal tracking and 1.85 line height. No display face or raster asset is added. |
| Geometry and controls | Existing Base UI Button, Field and Input components, 44px minimum control height, shared radius and focus ring remain in use. Native labelled checkbox rows have a 44px minimum height and semantic focus/accent tokens. |
| Layout | Directory uses the existing Settings main column and wrapping action layout. Rows stack below 600px; details wrap instead of becoming a wide table. Directory task spacing, borders and scroll margins refer to shared tokens. The finish reviewer reports English/Tamil wrapping across phone, tablet and desktop. |
| Task arrival | Requested detail/history headings and editor/review/comparison/conflict/password destinations receive focus and viewport arrival. Opening an editor clears prior detail/history. Focus effects follow task/state transitions rather than autosave values. The finish reviewer scored the original arrival finding resolved, including six immediate arrival captures. |
| History hierarchy | Shared `shop-profile-values` and `shop-profile-history` patterns are reused. Version/time summaries disclose each revision independently with actor information inside; detail, history, drafts and editor have section boundaries. The finish reviewer scored the original history/task-separation finding resolved. |
| Meaning and scope | Masked overviews lead to authorised detail, recoverable server draft, explicit comparison and publication/history. Both language dictionaries distinguish unsaved/saved/published, missing setup, stale comparison and authentication. Inactive history remains available; manual contact and payment setup do not imply payment processing or message sending. |

## Drift and limits

The sampled incumbent profile/calendar CSS already mixes semantic spacing tokens
with literal rem spacing and 44px dimensions. This is existing implementation
variation, preserved here rather than promoted into a new token rule or repaired
outside scope. No additional material design drift was identified in this bounded
source comparison. No defect is canonized as future house style.

The finish review's final **ship** disposition covers its two scored corrections,
not whole-product acceptance. Its 21 inspected captures and the supplied final
3/3 bilingual browser/axe matrix (423.231s) support the recorded synthetic
conditions; the documenter did not rerun them. Shared dark token conformance is
source evidence, not a claim of new physical lighting acceptance.

Physical Android/shop-lighting, fluent Tamil, screen-reader and owner software
acceptance remain pending. Runtime integrity, production identifiers, privacy,
restore/pilot activation, hosted CI, merge and deployment retain their separate
gates. This record does not extend competitor evidence or authorize publication.
