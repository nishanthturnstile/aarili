# Design specification research: evidence and limits

22 October 2026; roadmap **1.3.1**, ORD-07, DES-01/02/03/04/05/10, partial
AC-07/08. [Independent design](Design_Specification_Design.md),
[packet](Design_Specification_Ticket_Packet.md),
[delivery status](Design_Specification_Implementation_Evidence.md).
Research is not Aarili implementation acceptance or competitor backend proof.

## Targets, access and tool boundary

Applied installed `reverse-engineer-anything` and its runtime-observation guide.
Primary: [Nool login](https://app.nooltech.com/login),
[public guide](https://nooltech.com/docs/), existing synthetic research account.
Secondary: [TailorMan tour](https://tailorman.in/product-tour/),
[item-type sample](https://tailorman.in/demo/item-types.html).
This is tailorman.in software, not tailorman.com clothing. Vendor app build
identities are unknown. Research ran approximately **05:03–05:12 UTC**; source
and approval checks continued afterwards. Tool capture windows are in raw records.

T3 `preview_status` initially reported no active tab. `preview_open` at the Nool
login URL using default profile reached its authenticated synthetic dashboard.
The selected tab is `tab_4_6d0d1b46-1d0d-4fa5-a70f-08c8d198d4b3`.
No credentials, cookies or tokens were read/transferred. T3 preview authentication
is independent of REA and does not establish a connectable CDP endpoint.

REA discovery at the historical literal loopback endpoint `http://127.0.0.1:9226`
initially failed `provider_unavailable`, reason `endpoint_unreachable`. Read-only
process/profile checks found the dedicated browser absent and existing
`%LOCALAPPDATA%/Aarili-REA/nool-research` profile present. A hidden headless launch
of installed Chrome restored that profile/port on a new blank page. REA listed
no eligible HTTP page; read-only `/json/list` identified the blank target
`24B7D98C87FC7D418A227E247106C790`. No unfinished page/draft was navigated away.

The installed scenario schema was consulted after two invalid action-shape calls
(wrong discriminator, then missing step/duration). The corrected connect scenario
attempted the declared Nool login navigation but returned `execution_failure`:
**“Analysis could not complete. Run `rea doctor` and review the reported details;
repeating the unchanged request is not expected to succeed.”** Its partial result
says navigation failed before initial capture and external browser disconnected.
Fresh discovery and passive inspection subsequently succeeded at that target,
showing the ordinary sign-in form. This is not an authenticated REA workflow.

The requested diagnostic was run from already-installed rea-agents **6.5.0**;
Codex registration and skill aligned. Audit-wide health was false for unrelated
native engines and Copilot registration, not evidence that browser observation
was unavailable. No REA reinstall/repair or native engine acquisition followed.
A bounded connect follow-up after the successful passive attach still returned
execution_failure. No further identical retries. A private sign-in option was
offered; the owner selected **continue with T3 observations and record the REA
gap**. Authenticated Nool actions below were therefore performed by T3, not REA.

Chrome **155.0.8059.86**, CDP **1.3**; REA observation provider
`rea-cdp-browser` v2 and scenario provider `rea-playwright-browser-scenario` v1.
Raw request/response bodies, header values, storage values/keys/fingerprints,
script sources and console text were not requested through REA. T3 snapshots
include their standard UI/metadata output; focused DOM reads inspected only
rendered text, form values, attributes/styles and control positions. No script
bundle/code acquisition, arbitrary API calls or backend probing.

## Retained REA ledger

| Evidence ID | Action and observed boundary |
| --- | --- |
| `ev_c044e5193c242514a820d96683e68da023c72a626f8d460966cd90c6017dc7ff` | Restored endpoint discovery: Chrome identity; blank page excluded, no eligible HTTP page. |
| `ev_54bf2de9414d0883fb564ae9520ccb562b9f1d2cd62fa0a645f922404ea72d19` | Fresh discovery selects current Nool `/login` HTTP target; attachment state unknown. |
| `ev_6679011ab56940f7891ab64e3d0354d6f5b06a8ef2df55250ca528b98ab26ec5` | Passive 1s observation, 05:05:27–28 UTC: email/password/Google sign-in boundary. Policy-filtered, attach-limited; no prior activity or successful login observed. |
| `ev_db34d3418f950e1d1c3d1eae6b8286efc8d20e372e4e9a53d800510aec957343` | Temporary TailorMan launch → item-types sample → 2s settle; garment list, current blouse field list and add/save controls captured. Temporary process terminated. Selected captures complete; no network event stream requested. |
| `ev_34aabdf54be0a6397141b321fceaff414764eb36eed1ebc12068f45bf805e8da` | New temporary sample → pause narration → click Shirt text. Click completed but captured content remained blouse. No type-switch success or persistence claim. Process terminated. |

Raw REA bundle: `%TEMP%/aarili-design-spec-rea-20261022/evidence-bundle.json`,
**5 records / 72,956 bytes**, exporter reported zero ledger unknown records.
Zero ledger unknowns does not mean every research question was answered. Failed
scenario/schema calls are tool-call evidence, not successful ledger records.
Raw T3 records are in the same private directory as `t3-observations.json` and
`t3-final-observations.json`. They contain research-account UI identifiers and
are intentionally outside Git. Neither screenshots nor competitor assets are
copied into product source.

## Authenticated Nool observations (T3, not REA)

Used existing synthetic **ORD-20261019-002**, with separate blouse/salwar rows.
Orders → second row View Details opened `/orders/6ad6435cc81c57cf4ba421f2`;
blouse View Job Sheet referenced item `6ad6435cc81c57cf4ba421f3`.
The local record keys below are identifiers in the private T3 observation files.

| Local observation | Action/result |
| --- | --- |
| `previewDetail`, `previewSheetDOM` | Per-item sheet; garment visual selector, Visual Config, Technical Details, Component List, Save Changes. |
| `neckOptionsActual`, `sleeveOptions` | Neck exposed shape options; sleeve exposed length choices. Selected Sweetheart and Elbow for the fixture. Decoration/construction were separately research-labelled in text, not established as separate structured controls. |
| `technical`, `component` | Construction-note editor and component checklist input observed. No checklist completion action taken. |
| `savedSheet`, `reopenedNote` | Saved explicit synthetic lining/fastening/inspiration notes; reload/reopen retained them. Save feedback observed. |
| `cancelReopen` | Changed note to unsaved cancellation marker, closed without saving, reopened; original saved note retained. |
| `savedRevision2`, `finalReopen`, `persistedNeck` | Saved second synthetic note, reloaded/reopened; second note persisted. Sweetheart had the selected visual style; this is UI evidence, not schema proof. |
| `attachmentAfter`, `attachmentDOM`, `finalReopen` | Uploaded our 8,511-byte PNG sketch; order displayed a JPG-named attachment and a count of one. Attachment survived reload. No content/encoding equivalence claim. |
| `historyAfterRevision` | Inspected Change History after sheet changes: zero changes and empty history. No exposed prior-sheet-version retrieval established. |

One valid locator correction and one role-locator timeout occurred in the sheet.
Snapshot text was bounded, so read-only DOM text/control inspection supplemented
it. A coordinate click based on observed bounds opened Neck; later focused CSS
locators operated the sheet. No separate browser fallback or hidden business API.

The synthetic shop-owned sketch was generated locally, labelled inspiration,
and uploaded only to our research account. No real customer/minor/fitting image,
payments, messages, invoice, production progress, approval or handover action.
The shared TailorMan sample was not saved/edited, and no spending occurred.
No attachment deletion was used to simulate replacement. Final Nool state:
saved second research note and one sketch; sheet closed, no unsaved edit left.
The dedicated REA browser remains on the sign-in page. Synthetic test records
remain for future authorised research; no destructive cleanup was attempted.

## Documented, inferred and unknown

**Documented:** Nool's [Job Sheets](https://nooltech.com/docs/#job-sheets)
guide describes item-specific choices, notes, components and save; its
[order attachment section](https://nooltech.com/docs/#order-management)
describes images/PDFs and a file-size cap. These are vendor documentation claims;
the applicable exposed web controls were only partly exercised. TailorMan's
[tour](https://tailorman.in/product-tour/) links the sample item configuration.
Its observed sample groups garments and shows numeric and yes/no field kinds.
No edit persistence was tested. These findings do not set Aarili limits or fields.

**Inference for Aarili:** component context, a compact controlled-choice summary,
and explicit save/reopen are useful patterns. Aarili's separate construction/
decoration, exact history, rights and approvals follow its own product plan;
neither vendor is authority for those policies. No competitor implementation
code or visual assets are used.

| Research question | Result/gap |
| --- | --- |
| Item-specific entry, choices, notes, save/reopen and cancel? | Observed for the synthetic blouse through T3. Authenticated REA execution remains unobserved by owner-approved fallback. |
| Distinct neck/sleeve construction versus decoration? | Not established as four structured fields; note text can express the distinction. Do not claim the product lacks other controls. |
| Component versus order attachment? | Separate component checklist and order attachment section observed. An attachment-to-specific-component association was not established. |
| Reference replacement, old image/caption/annotation retrieval? | No exposed version-preserving replacement/caption/annotation workflow established in inspected screens. Old-version access remains unknown; no delete/replace experiment. |
| Immutable versions, backend constraints, RLS, transactions? | Unknown. Browser observations cannot prove these properties. Empty inspected history is not proof that no backend history exists. |
| Customer approval evidence versus inspiration? | No governed approval provenance established. Research note wording is our fixture, not a native approval model. |
| Private/reusable rights, guardian checks, erase/retention? | Unestablished; no security/permission probe or real personal data used. |
| TailorMan item switch/save persistence? | Shirt click left captured blouse content unchanged; no persistence claim or shared-demo mutation. |

Research stops at these bounded gaps. Nool's Android-only or other controls were
not acquired; no APK/emulator is necessary to prepare the independent packet.
