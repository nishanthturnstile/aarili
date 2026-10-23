---

version: 1
slug: "apps-web-src-app-small-services-tsx"
primary_target: "apps/web/src/app/small-services.tsx"
related_targets: ["apps/web/src/app/small-service-intake.tsx","apps/web/src/app/small-service-profiles.tsx"]
---

# Small-service intake surface brief

Scope: approved ticket A / #124 only, inside the existing Orders and Settings
workspace. Mode: Operate. The owner records a customer's existing garment and
requested work, saves a recoverable draft, reviews an exact service profile and
commitment, and reopens the accepted result. Profile authors review applicability
and capacity mapping. The approved design and ticket packet govern behaviour.

This brief records the implemented extension for independent finish review. It
was not persisted before implementation; the approved Small_Service_Design.md
and existing Orders/Settings components supplied the implementation direction.

## Direction contract

**THESIS:** Keep counter intake shorter than custom tailoring: customer, relevant
wearer permission, one recognisable garment and independent work lines. Preserve
Quick Order and grouped intake; do not introduce a dashboard or decorative cards.

**OWN-WORLD:** Inherit the existing Aarili light/dark semantic palette,
self-hosted English/Tamil typography, owner-form spacing, labelled native fields,
Button/Field/Input components and responsive owner workspace. No new tokens,
branding, images or motion system.

**STORY:** Select exact reviewed service, describe the garment and each requested
job, preserve unknown prices, then review current commitment before acceptance.
Known linked wearers retain permission gates. Receipt remains explicitly absent.

**FIRST VIEWPORT:** Existing workspace navigation above task actions. The intake
heading, selected customer and service profile lead a single readable form.
Garment description precedes independent service fieldsets; save/review follows
the working details. Profile authoring uses the same form grammar and explicit
review/publication controls.

**FORM:** Local extension of established order/draft and settings editors; no
concept tournament or comp. Seed: not applicable to this precisely specified
extension. The signature interaction is recoverable draft → exact commitment
review → independent accepted lines, retaining zero versus unknown pricing.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance

For this ordinary extension the documenter checks incumbent visual consistency
without creating or rewriting DESIGN.md; there are no shipping raster assets.

## Review evidence and limits

Required captures: intake and profile editor; English/Tamil; light/dark;
360×800, 820×1180, 1440×900 and 1180×820. Browser checks also exercise 200% text
reflow, keyboard focus, axe, IME, reload and exact retry. Screenshots live under
`.impeccable/review/small-service-*.png` once validated. No approved comp exists.

Quality bar: readable work instructions and distinct line states/prices; visible
permission and unknown-mapping feedback; no horizontal scrolling; no fabricated
receipt, completion, payment or handover. Physical-device, fluent-Tamil and
assistive-technology acceptance remain human gates.
