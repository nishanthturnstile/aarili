# Manual/external pattern research: observations and gaps

23 October 2026, approximately **10:32–10:50 UTC**. Roadmap **1.3.3**,
PAT-01/03, AC-07/08. Research follows the [brief](Manual_Pattern_REA_Prompt.md)
and the installed reverse-engineer-anything skill v42/runtime-observation guide.
This is bounded UI evidence, not a competitor schema/security audit or authority
for Aarili's business policy. [Independent design](Manual_Pattern_Design.md) and
[tickets](Manual_Pattern_Ticket_Packet.md) make our own requirements explicit.

## Targets, tools and scope

Primary: [Nool login](https://app.nooltech.com/login), the existing dedicated
synthetic account, its known synthetic order **ORD-20261022-001**, item-level
job sheet and order attachments. Supporting documentation:
[Nool product guide](https://nooltech.com/docs/), Attachments and Job Sheets.
Secondary: [TailorMan product tour](https://tailorman.in/product-tour/),
[item types](https://tailorman.in/demo/item-types.html) and
[bill detail](https://tailorman.in/demo/bill.html). This is tailorman.in software,
not the tailorman.com clothing brand. No demo record was saved or changed.

T3 preview status/open used the existing default profile and restored signed-in
synthetic Nool access. Its tab was
`tab_2_5474c3fd-e392-4f80-8dea-f288ec8980be`. Ordinary browsing/upload used T3;
REA scenarios independently used the existing research browser/profile. No
cookies, tokens, passwords or storage were read/transferred between profiles.

REA MCP tools were absent from this tool catalog. Read-only CLI doctor reported
missing Codex registration; no setup, registration or engine installation was
performed. The already-cached **rea-agents 6.5.0** CLI supplied actual REA
Evidence. Missing native engines are irrelevant to this browser investigation.
Initial PowerShell `npx` hit its script-execution restriction; `npx.cmd` used the
existing launcher without changing execution policy. The first JSON scenario
had a UTF-8 BOM; it was corrected to BOM-free UTF-8 after the precise parser
error. Neither rejected command established an observed app behaviour.

The historical port 9227 was unreachable. Fresh discovery at literal loopback
**http://127.0.0.1:9226** found the single eligible Nool `/login` target
**24B7D98C87FC7D418A227E247106C790**; attached state was unknown. An initial
allowed-origins CLI argument was rejected after shell argument conversion;
corrected unfiltered discovery returned only this eligible Nool page. Connect
mode first navigated that research page to the declared start URL; its pre-state
was the sign-in page, not an unfinished owner draft. Existing authentication
then restored the dashboard. No new browser profile/login/account was needed.

Chrome **155.0.8059.86**, CDP **1.3**; REA discovery provider `rea-cdp-browser`
v2 and scenario provider `rea-playwright-browser-scenario` v1. These are browser/
tool identities, not vendor app build numbers. Nool scenarios used 1280×720;
ordinary T3 inspection used 1280×800. No real-device or full responsive vendor
comparison is claimed. TailorMan launched an owned temporary headless Chrome
and reported `terminated-owned-process`; Nool connect reported
`disconnected-external` and left the existing research browser available.

## Synthetic fixtures and permitted actions

Used our known synthetic adult/order. Added no measurements, monetary events,
customer approvals, assignments, production/delivery transitions or messages.
The only saved changes were item construction notes and our own attachments:

- Initial note: conspicuously synthetic manual-pattern research, **Cabinet B /
  folder 12**, unknown source/exact inputs, unverified scale/formula assumptions,
  no cutting approval. Saved and reopened through REA.
- Revised note: **REVISION B, Cabinet B / folder 13 replaces folder 12**, with
  the same limitations. Saved/reopened through REA. Existing order-level
  Production Notes were preserved; item Construction Notes are a separate field.
- Our own earlier shop-created `synthetic-blouse-sketch.png` (8,511 bytes), from
  the prior permitted design research fixture. T3 uploaded it; Nool displayed
  `synthetic-blouse-sketch.jpg`, **18 KB**. This establishes displayed conversion/
  metadata, not byte/geometry/scale equivalence.
- A locally constructed one-page **SAMPLE-SCALE-UNVERIFIED.pdf**, with visible
  “SAMPLE / SCALE UNVERIFIED” and “Not a cutting pattern” text. No proprietary
  pattern, customer/minor/fitting photo or third-party design was uploaded.
  T3 uploaded it, then deleted only this new synthetic attachment through the
  observed **“Delete this attachment?”** confirmation and uploaded it again.
  This exercised remove/add replacement, not an established versioned-replace
  operation. REA independently reopened the resulting two-attachment list.

The sketch and PDF remain on that synthetic order; revision B remains the
item's current note. Both browser surfaces were left without unsaved input or
an open file picker/confirmation. No account purchase, external message, APK,
CAD executable, emulator or additional SaaS account was used.

Scenario inputs, complete individual scenario Evidence JSON and fixture generator remain
outside Git under **`%TEMP%/aarili-manual-pattern-rea-20261023/`**. The reused
sketch is under `%TEMP%/aarili-design-spec-rea-20261022/`. No vendor scripts,
assets, formulas or raw DOM/network captures are committed. Raw captures may
include synthetic account UI; they are not a portable public evidence archive.

## Evidence ledger

All scenario captures requested only DOM/accessibility/URL sections as needed;
no request/response bodies, header values, storage, script-source collection or network events
were requested. Whole scenario completeness therefore reports **incomplete:
events**, even where requested step artifacts and actions completed. This is
not a complete network/event trace or equality proof. One failed step has
additional missing sections, recorded below rather than discarded.

| Local ID / REA Evidence ID | Operation and observed boundary |
| --- | --- |
| MP-R01 / `ev_73a79b9bc6908338a3f676c3f73718fabdc91e1ca0e703194af5230919b23885` | Fresh 9226 discovery: one eligible Nool target; Chrome/CDP identity and unknown attachment state. Evidence is deterministic; the same target list can have the same ID as an earlier investigation. |
| MP-R02 / `ev_33d7786ce3daf11ea642fe956fb5c61eab9a2520716c3584a47edb2540378996` | REA connect `/login` → settle; existing account resolves to dashboard. No private login input supplied. |
| MP-R03 / `ev_277579150f208570a114a582b468c94456471c5013cb8528ab47e9fce9866b51` | Declared known-order navigation → View Job Sheet → Technical Details. Item Construction Notes textbox exposed. |
| MP-R04 / `ev_af277588fc73cf65938ff44beb98330b6ad938773b704b7bd6a9f2bfe5ec995d` | REA fills initial physical-locator note → Save Changes → settles → navigates back/reopens job sheet/Technical Details. All 12 results including start completed; saved note visible. |
| MP-R05 / `ev_5c5b5ac6ea9fddec0b2fc6f1aca690f9da7a487c738f9221c508fee1700d26bf` | Same declared route with revision B note → save/reopen. All 12 results completed; current textbox contains folder 13. Earlier-note version selector not exposed in the captured sheet. |
| MP-R06 / `ev_19c87bf9dd44d566e6b0082bca4d71475dcae7a57c7ad317ef1fb22289bc35ab` | REA reopens after T3 uploads. Order shows Attachments 2/5, PDF, JPG-named sketch, Download and unnamed controls. Change History expanded to “No changes recorded.” All four results completed. |
| MP-R07 / `ev_783e3abbd525250173c511f8ed5880eda64cdf2980724540e1a9a38e14929b7e` | Temporary TailorMan item-types → settle → bill detail → settle. All four results completed; exposed garment fields/items/context below. No configuration, payment, share or delivery control invoked. Owned process terminated. |
| MP-R08 / `ev_9785993a0a5195c071346e4e95cf70617608931df85a73f2f637bae180efbf77` | After T3 synthetic PDF remove/add, fresh REA navigation retained both attachments. Exact-name history click timed out after 5,000 ms; following wait cancelled. Those actions/end artifacts are not successful evidence. |
| MP-R09 / `ev_f2bd636d47c970ffd8b419af35e4f6cf8dc225f5c55104b0d61658cf45683b5f` | Corrected history CSS locator with 10,000 ms deadline, fresh navigation and settle. All four results completed; re-added PDF and sketch visible; expanded history again says no changes recorded. No repeated unchanged failing request. |

T3 observations are supplementary browser evidence, **not REA Evidence IDs**:
MP-T01 is the order/job-sheet/Technical Details inspection; MP-T02 is the
image/PDF upload and 1/5→2/5 attachment UI; MP-T03 is filename-click inspection
(no inline dialog, image/PDF viewer, iframe/embed/object exposed); MP-T04 is
the exact synthetic-PDF delete confirmation and re-add. Input accepts
`image/*,application/pdf`, one file at a time. Download and trash-icon controls
were exposed; file-name clicking left the attachment list unchanged. Download
bytes, external PDF viewer behaviour and image fidelity were not tested.
T3's initial two clicks using incorrect/stale ref targeting timed out with
**“Preview automation click timed out after 15000ms.”** A focused DOM read and
the unique first-row View Details button corrected the target; no fallback
browser was needed. Bounded snapshot text was supplemented with focused DOM
text/control reads, without reading credentials or storage.

## Findings by evidence type

**Observed, Nool (MP-R03–06/09):** a garment row opens its own job sheet. Visual
Config, Technical Details and Component List are separate tabs. Technical Details
has Construction Notes and a Save Changes action. A physical locator can be
stored there as free text without uploading. It is not a structured physical
pattern identity or an exact input-version binding. Order attachments are
separate from those item notes, persisted across reload and displayed as a list.
Remove/add is exposed; immutable replacement lineage was not exposed. The
visible Change History remained at zero after these actions. This does not
prove the backend has no audit or retained deleted object.

**Documented, Nool:** the [guide](https://nooltech.com/docs/) describes order-level
image/PDF reference uploads (a stated 3 MB limit) and item-level job sheets with
construction notes/components and saving. The limit is vendor documentation,
not an Aarili rule or a tested boundary. The guide's cut-ticket terminology
does not establish qualified pattern validation or cutting permission.

**Observed, TailorMan (MP-R07):** Item Types & Measurements lists garment types;
the selected Blouse has number fields and a yes/no field with Add/Save controls.
Bill Detail groups distinct garment rows with measurement summaries and stage
text, alongside separate payment/assignment/delivery actions. No shared demo
mutation was used. These screens help locate garment context; their static
summaries do not establish saved version identities or a manual-pattern workflow.

**Inferred design value:** keep reference entry close to the relevant garment
and separate concise notes from attachment readiness. Aarili needs structured
physical locators, immutable versions, explicit exact-input provenance and
separate review/selection because PAT-01/03 and our history/privacy rules require
them, not because either competitor demonstrated those guarantees.

| Research question | Coverage / remaining unknown |
| --- | --- |
| Discover notes and attachment entry? | Answered on known synthetic Nool order/item; sample garment context observed in TailorMan. |
| Save/reopen a fileless locator and revise it? | Answered as Nool free-text notes, not a dedicated pattern record. Earlier-note retrieval/immutability unestablished. |
| Attach sketch/PDF and reopen? | Answered across T3 upload and independent REA reopen. File content, fidelity and calibrated scale unestablished. |
| Preview/download? | Controls/list and unchanged filename-click observed. No inline viewer exposed in that inspection; actual downloaded bytes/viewer not tested. |
| Replace and retain history? | Synthetic remove/add and current list observed. No predecessor/reference selector exposed; backend retention/audit unknown. |
| Dedicated manual/external capability, physical-pattern ID, exact input bindings or pattern review? | Not exposed in sampled item notes/order attachments or TailorMan type/bill screens. Not proven absent from either entire product. |
| Scale/formula verification, immutable versions, RLS, transactions, privacy/rights/erasure? | Unknown. No backend/security probe performed; browser appearance cannot establish these properties. |

No full competitor coverage, successful calibrated output, true-scale export,
automated drafting, verified fit or cutting-readiness claim follows from this work.
