# Measurement versions: research evidence and limits

22 October 2026. Roadmap **1.3.2**, MEA-01/02/03/04/05/06/07/11;
AC-06 (measurement versions), partial AC-07/08. Preparation only.
[Design](Measurement_Versions_Design.md), [tickets](Measurement_Versions_Ticket_Packet.md),
[validation/status](Measurement_Versions_Implementation_Evidence.md).

**Authenticated follow-up, 17:22–17:32 UTC:** the owner privately signed in to
the visible research browser. REA then observed entry/save/reopen, cancellation,
editing/comparison and explicit per-item version selection on a synthetic order.
The sign-in blocker below is historical. Key limits: editing changed a saved
value while its label stayed Version 2; the exposed earlier-order screens did
not disclose enough measurement content to prove preserved original values.
This remains UI evidence, not immutable-storage or historical-reference proof.

## Targets, access and provenance

Applied the installed reverse-engineer-anything skill and its runtime-observation
guide. Primary target: [Nool](https://app.nooltech.com/login), with
[public documentation](https://nooltech.com/docs/#measurements). Secondary:
[TailorMan tour](https://tailorman.in/product-tour/), the tailorman.in software,
not tailorman.com clothing. Vendor application build identities are unknown.
Initial research ran approximately **16:54–17:04 UTC**, followed by authenticated
research **17:22–17:32 UTC**; passive windows below have exact timestamps.
These captures establish UI observations, not backend
immutability, tenant isolation, consent correctness or historical-reference safety.

T3 preview status reported no attached tab. Opening Nool with the default profile
created `tab_1_ba4763f6-35d9-4e4a-ae35-3e4df9af6d70` at `/login`. Two snapshot
attempts failed with the identical raw error:
**“Preview automation snapshot timed out after 15000ms.”** No authenticated
T3 content was successfully inspected in this investigation. The installed
agent-browser workflow was read and used as the permitted fallback. A named
session attached to the dedicated REA browser and also observed sign-in.
T3 profile state was not exported or transferred to REA.

Fresh REA discovery at literal loopback `http://127.0.0.1:9226` found target
`24B7D98C87FC7D418A227E247106C790`, Nool `/login`. This ID was rediscovered,
not selected solely from a historical note. Chrome **155.0.8059.86**, CDP **1.3**.
Passive inspection succeeded using `rea-cdp-browser` v2. Private sign-in was
requested through a text choice; no credential/OTP/token was requested in chat,
read from storage or copied between profiles. At preparation handoff no successful
private sign-in or authenticated measurement action had been observed. That
initial limitation was resolved for the follow-up below, through a new explicitly
selected endpoint/profile; the old headless endpoint remains separate.

REA controlled launch scenarios used installed Chrome in temporary profiles,
`rea-playwright-browser-scenario` v1. REA itself navigated the three public
TailorMan pages, waited for rendering, and in a separate scenario selected cm
and Shirt. Those temporary browser processes were terminated by REA. No Save,
Delete, payment, delivery, approval, message or account-purchase action occurred.
No values were entered or persisted in the shared public demo. The separate
agent-browser public-demo session was closed after discovery. Its narrated tour
advanced once automatically; that navigation is not attributed to a Save action.

Raw network headers/bodies, storage values/keys/fingerprints, console text and
script-source acquisition were not requested. DOM captures incidentally contain
ordinary inline page markup; none is copied into Aarili. No illustrations,
graphics, measurement definitions, formulas or vendor validation thresholds were
adopted. Raw evidence remains outside Git at
`%TEMP%/aarili-measurement-rea-20261022/evidence-bundle.json`:
**4 records, 143,393 bytes**. Exporter reported zero ledger unknown records;
the substantive unanswered research questions below remain unknown.

## Authenticated Nool follow-up

The owner's “signed in” message authorised resuming the existing research.
Fresh discovery at **`http://127.0.0.1:9227`** found
`7AE48FFEA83EF91BB411AB670550AE3A`, at the authenticated Nool dashboard. The
owner opened installed Chrome with the dedicated `Aarili-REA/nool-measurements`
profile after automatic approval review rejected the agent's `Start-Process`
launch as “blocked by policy.” No bypass, profile credential extraction or
credential transfer was used. Chrome **155.0.8059.86**, CDP **1.3**. Passive
inspection **17:22:37.071–17:22:37.723 UTC** confirmed workspace navigation and
synthetic existing records; no login values were captured.

All follow-up actions were performed by **REA controlled connect scenarios**,
not T3 or agent-browser. Scenarios navigate on connection, so forms were explicitly
reconstructed in each declared sequence; successful writes were never replayed
as setup. Existing unsaved user work was absent at the dashboard. Every connect
scenario disconnected from the external browser and left it open. Captures used
accessibility/URL and necessary DOM for locators; network events/headers/bodies,
storage, console and script sources remained off. Some scenario envelopes report
`incomplete`, missing `events`; no network completeness is claimed. Individual
action outcomes and their captured UI text support the claims below.

The follow-up bundle is outside Git at
`%TEMP%/aarili-measurement-rea-20261022/authenticated-followup-evidence-bundle.json`:
**36 records, 5,029,868 bytes**, including the four earlier records and failed
locator attempts. Exporter's zero ledger unknowns is not complete research
coverage. Three initial selectors timed out (wrong element tag, whitespace in
combined text and a title-only icon button); corrected selectors were derived
from captured DOM. Failed/cancelled steps are not described as successful.

| Local ID / retained Evidence ID | Follow-up action and evidence |
| --- | --- |
| MV-R05 / `ev_20496854dbe430f204bbc1539654f601cee5f9e4e8f25d87511855e550262296` | Fresh endpoint/target discovery; only explicitly allowed Nool origin. |
| MV-R06 / `ev_dba255d5bc2f45eac667002a1f4e21dcd35cc0186bcea95207fd3711ae355500` | Passive authenticated dashboard inspection; no unsaved form, existing synthetic customer/orders. |
| MV-R07 / `ev_dc7dde3c26a79defe0e92d1802a7576d3ef7642ec54d31b4aa6b82b6503d26e7` | Customer → Add Measurement → Women → Blouse. Garment-specific numeric fields, member-label input, units and optional notes/custom fields. |
| MV-R08 / `ev_52adc0145ec75c4ac15ffcddd3010c8005b6e613969a2ce8329843938ba5e72d` | New adult A label, bust 36.25 in, other values blank; cm/in switching relabelled unchanged input; Save succeeded as Version 2. |
| MV-R09 / `ev_8eae1ace2a7470332dd132c94d219e13b0bfcd45623e0254805371ea3bfb29eb` | Fresh navigation/reselection reopened saved A Version 2, bust 36.25 in; original blouse V1 and salwar fixture retained. |
| MV-R10 / `ev_c81df229e3b32dc7785163159dfee7777eeb58e049fca233823aa764f24018ce` | Order measurement step offers latest per type; Items step additionally exposes explicit member-labelled V2/V1 buttons. |
| MV-R11 / `ev_9802cd08de0379bcb66acec7d7bf76e5521df48351453bbfca3e98d3017d5216` | Review explicitly says adult A v2 linked. Synthetic ₹100, default displayed 29 October date, no advance entered; conspicuous research-only instructions. |
| MV-R12 / `ev_64ada1b196996cdcb0ef2e16e799a8e01f4134bfd47dd34c6596933e0c8e38c1` | One Create Order action → “Order Created!” success. Subsequent detail inspection below establishes its order identity. |
| MV-R13 / `ev_c2dff933d43f6cbee4a6ee24c1bd2b7a6b983667228c4c912e6ac918293b49ee` | Saved `ORD-20261022-001`, ID `6ada477019aa23f5a4d9d52e`, Pending, one blouse, zero paid. Detail did not expose linked numeric values/version. |
| MV-R14 / `ev_ea7c3babbd9f6da5426fe145a9ab70190c99b6a84075dc175f338e39f51daaf2` | Edit A: type 38.25 → Cancel → reopen 36.25; then explicitly change to 36.75 and Save Changes. Saved row still says Version 2; no V3/pre-edit copy exposed. |
| MV-R15 / `ev_0032a553c7fd446b556e846f00dce7003c1c522f1de4f8a2f386cb429cbca144` | Compare shows A V2 36.75 with +0.8 against earlier differently labelled V1 36.00. It did not recover A's 36.25 pre-edit state. |
| MV-R16 / `ev_1062f4e26d7e67f3aab6945f156d3ab3be28265dbf707dac50b8d3a8e5e22363` | New adult B label under same customer saves bust 40.5 as blouse Version 3; A V2 and original V1 remain in the same garment history. |
| MV-R17 / `ev_9a4acb02bca04b183de9274327a830da7bfb68f2d11be5797e6c8bf8a03a4488` | A fresh, unsubmitted order candidate exposes B v3/A v2/original v1 and permits clicking A v2. No second order submitted. |
| MV-R18 / `ev_64e1f1c8e6c1387777dffd8fc687cc3255122d8ac89d35a0314bdc6ef21cbcf2` | Reopened earlier saved order after editing/adding versions; Pending/₹100/zero payments unchanged, Change History says no changes. No measurement value/reference detail exposed. Final browser state, no open form. |

Additional bounded source-order observations: Job Sheet visual and Technical
Details captures `ev_fc9de86e583969f0a45efbea787eb971bb8512c2a13d208941607c3076052ea6`
and `ev_b7fc1f43196b4cf378047d0f0c423a16ab3af524795036747cc6c52b12ff1d71`,
Edit Items `ev_14575b8ac38a954adb041729e2dd7c933134834ff8555c1dd740858ca2cd4f2f`,
Edit Order `ev_55fae4eb229cd4325ad9c0ecfa382e27c39d766d7045de1d8afb9805de15c02d`
and Repeat preview `ev_4c8d6d17c959253b3747c07dcb8260710fa39ace3c4f24e953e386f2aca5c900`
did not reveal the selected numeric snapshot or exact version identity needed
to verify old-order preservation. No Save, Repeat submit, Print or Invoice action
was performed on those inspection surfaces. Original manually entered order notes
mentioning 36.25 are not proof that structured measurement input stayed fixed.

### Observed behaviour and independent implications

- The new-profile field is free text, initially Self. Its explanation calls it
  a label for distinguishing people. Adult A/B share one customer/phone and appear
  as successive versions within the blouse group. This does **not** establish
  stable wearer identities, permissions or a safe per-person revision lineage.
- Add selects category and garment before rendering garment-specific fields.
  Decimal 36.25 saved and reopened, with the other eight exposed blouse fields
  blank. Numeric controls declare `step="0.1"`, but quarter-decimal save succeeded;
  the attribute is not a proven enforced precision policy. Raw fractional text,
  zero semantics, and server validation rules remain untested.
- Switching Inches→Centimeters→Inches retained the displayed number 36.25,
  changing labels/diagram units. No automatic physical conversion was observed.
  Aarili must distinguish display conversion from reinterpreting entry units.
- Adding a record incremented the visible garment version; **editing an existing
  record did not increment its displayed version** in this experiment. This is
  evidence against inferring immutable edits from a version badge, not a forensic
  claim about database rows. No attributable correction reason/history was exposed;
  the research explanation was voluntarily typed into Notes.
- Order step 2 offers latest-per-type shortcuts, while step 3 exposes explicit
  version/profile selection. Do not incorrectly report that only latest selection
  exists. Aarili still requires explicit suitability review with wearer/source/age
  context and an immutable version, rather than equating a vendor selection badge
  with those guarantees.
- Source method, stated measurement date and measurer were not exposed as
  dedicated fields in the inspected Add/Edit forms. Displayed save dates and
  free-text notes are not equivalent provenance. No guardian/rights workflow
  was simulated to unlock access.

### Synthetic account effects and final state

Saved two new synthetic adult-labelled blouse records (A v2, then B v3), edited
only A's value/notes, and created one Pending research order. Original blouse
V1 36 in and salwar V1 30 in remained visible unchanged. All test values/prices/
dates are labelled fixtures, not approved Aarili measurements or business rules.
No real body/minor data, photos, payment, approval, assignment, production,
delivery, message, public publication or purchase. No destructive fixture cleanup.
The final unsubmitted second-order candidate was left by explicit research
navigation to the saved order; no pending user work was present. The visible
browser remains signed in on that research order with Change History expanded.

## Initial-pass evidence ledger

| Local ID / retained Evidence ID | Target, action and observation |
| --- | --- |
| MV-R01 / `ev_73a79b9bc6908338a3f676c3f73718fabdc91e1ca0e703194af5230919b23885` | Fresh CDP discovery: one eligible Nool sign-in target. Attachment state unknown. |
| MV-R02 / `ev_7d641158ec7de9d97782bab8de12da695ead4be9c61b4568c400c0a12178d9a6` | Passive Nool inspection **16:56:53.970–16:56:55.027 UTC**: required email/password inputs, sign-in and Google controls. No login or measurement entry observed. Capture is attach-window/policy limited. |
| MV-R03 / `ev_2fcfdf89850c10b3d39c6b7fa2e581d67e737529ff44c670a43d639dcd518c88` | Controlled TailorMan launch: measurement form → customer profile → item-types configuration. Six step results including start; all completed; selected DOM/accessibility/URL sections complete. No event stream or storage requested. |
| MV-R04 / `ev_cd3931115108680b0bf932796f729191a8a24e9cdc5f96238f04ffc6982fad91` | Fresh temporary measurement page → settle → select cm → select Shirt. Four completed step results including start; selected accessibility/URL sections complete. No persistence tested. |

## Observed runtime behaviour

**Nool initial pass:** only sign-in was observed then. The authenticated follow-up
above supersedes that access gap. Earlier customer/design research remains dated
background, not proof for this measurement experiment.

**TailorMan Add Measurement:**
[sample form](https://tailorman.in/demo/measurement.html), MV-R03/R04:

- An optional free-text “For” field accompanies garment and unit selectors.
  The sample groups length inputs under Upper Body and Neck, also showing a
  Piping checkbox, optional custom-field disclosure, notes, Cancel and Save.
  This is presentation evidence, not a separate-wearer identity contract.
- cm became selected while all eight captured numeric values remained unchanged.
  The observation does not establish conversion intent or a live implementation
  defect. Do not copy this interaction into Aarili as automatic unit conversion.
- Shirt became selected but the captured blouse-like field labels/values remained.
  A dynamic garment-specific form change was not established in this sample.
- No source-method, measurer, revision-reason or saved-version selector was exposed
  in the inspected form. This bounded page observation is not proof of absence
  elsewhere. No fractional input, save validation or failed-save action was tested.

**TailorMan customer profile:**
[sample profile](https://tailorman.in/demo/customer.html), MV-R03:
measurement cards expose garment, family label, date, unit, values, notes and
Edit/Delete controls. No prior-version comparison or immutable revision identifier
was exposed in this capture. Neither control was invoked. Sample profile content
is vendor-supplied demo content, not an Aarili customer record.

**TailorMan item types:**
[sample configuration](https://tailorman.in/demo/item-types.html), MV-R03:
garment list beside a blouse field group, number and yes/no kinds and add/save
controls. Configuration persistence and historical field semantics are unknown.
Aarili already has independently approved form-definition infrastructure; no
second editor or competitor field catalogue follows from this comparison.

## Documented claims, inference and gaps

**Documented claims (now partly exercised above):** Nool's
[Measurements guide](https://nooltech.com/docs/#measurements) describes
garment-specific entry, family-member context, cm/inch switching, dated versions,
retained earlier versions and selecting saved measurements during ordering.
Its [order guide](https://nooltech.com/docs/#order-management) also describes
attachment during creation and reuse in repeat orders. These descriptions include
Android screenshots; equivalence with the accessible web application is unknown.
Even a visible version number would not prove immutable storage or stable old-order
references. TailorMan's [tour](https://tailorman.in/product-tour/) describes its
demo as matching live screens. That is a vendor claim; the inspected sample does
not prove its live storage behaviour.

**Independent design inference:** explicit person/form/source/date context,
grouped field entry and a readable saved summary are useful interaction patterns.
Aarili's exact values, separate wearer identity, consent, immutable versions and
explicit review/selection derive from its own product and architecture baselines.

| Requested experiment | Evidence / remaining gap |
| --- | --- |
| Adult wearer → form → values → save/reopen in Nool | Observed for explicitly synthetic adult labels, MV-R07–09/16. Labels do not prove wearer identity. |
| Correct value; compare previous/current; select version on new order; reopen older order | Observed UI sequence, MV-R10–18. Edit kept V2 label; earlier-order structured measurement content was not exposed, so immutable old references remain unknown. |
| Separate same-phone wearers and private access | Two adult labels under one customer observed; no distinct identity/access boundary proved. |
| Required/optional, blank/zero, source/date/measurer, decimal/fraction handling | Partial form save and decimal reopen observed; blank/zero, raw fractions, approved precision and dedicated provenance unproven. |
| Conversion precision, round trips and switching populated inputs | MV-R08 relabelled unchanged 36.25; no exact conversion or storage round-trip guarantee. |
| Cancel, save failure and retry preserving values | Cancellation/reopen preserved 36.25. Real failed-save/lost-response/retry not induced or proven. Shared-demo saves excluded. |
| Minor guardian consent, erasure, fitting-photo privacy | Not observed or fabricated; no minor/body photo used. |

Further evidence would be needed to establish exact saved measurement IDs,
pre-edit retention and old-order value stability; UI version labels cannot do so.
Network/storage/DB guarantees, forced failures, raw fractions and privacy remain
unproven. No deeper capture or paid/mobile acquisition is implicitly necessary
to proceed with Aarili's independent, stricter design.
