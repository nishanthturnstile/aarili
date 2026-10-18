# Services and templates: bounded REA evidence

18 October 2026. Roadmap **1.1.2**, SET-03/04/10 and category-binding seam
SET-08/11. Owner-supplied research brief,
[independent design](Service_Templates_Design.md),
[proposed ticket packet](Service_Templates_Ticket_Packet.md).
This is competitor research, not Aarili implementation acceptance.

## Targets, connection and access

Primary: `https://app.nooltech.com/settings`, Settings → Garment Masters,
title `Nool Tech | Tailoring Management`. Rediscovered the running dedicated
Chrome process/profile `%LOCALAPPDATA%\Aarili-REA\nool-research` and its literal
loopback endpoint `http://127.0.0.1:9226`. Fresh REA discovery selected target
`3BCF0ABFB7508D2C305C76DB28096829`; historical target identity was not assumed.
Browser reports Chrome/155.0.8059.80, CDP 1.3. The phone Settings UI displays
`Version 2.4.0 (Build 8901)`; this is displayed vendor text, not independently
verified build identity. No APK or shipped-JavaScript inspection was used.

An initially rendered Business Profile survived in memory but failed navigation;
subsequent passive inspection showed `/auth/role-select`. The user privately
signed in in the dedicated window and replied “Signed in”. Fresh rediscovery
later found the root page. No password, OTP, cookie, token or storage value was
requested in chat or copied into Git. Prior Business Profile draft state was
discarded by navigation; this investigation does not claim restoration of the
previous session's unsaved description from its own historical evidence.

REA action calls then failed before initial capture. A bounded installed REA
6.5.0 doctor check found Codex registration and skill aligned. Missing native
engines/another client's registration were informational and unrelated. A CLI
diagnostic showed successful CDP attachment followed by failure during the
provider's frame evaluation. Inspection of REA's own service-worker policy code
motivated using the advertised `environment.service_workers: allow` option;
controlled captures then succeeded. This is evidence of a working capture
configuration, not proof of a Nool defect. No registration/configuration repair,
engine installation or browser data clearing was performed. The first CLI JSON
input was rejected for a UTF-8 BOM, corrected outside Git; diagnostic failures
are not competitor capability evidence and have no invented Evidence IDs.

Secondary: `https://tailorman.in/demo/item-types.html`, title
`Live Demo — Item Types | Tailor Man`. T3 preview_status was unavailable, then
preview_open succeeded. The narrated tour subsequently navigated to Settings;
that was observed as tour behaviour, not a user save or revision. REA used
separate temporary launch profiles to capture Item Types and exercise Add
controls. Owned temporary browsers report terminated-owned-process cleanup.
Public sample UI is not evidence of TailorMan production capabilities.

## Capture/privacy limits

REA performed declared navigation/click/fill/select/press actions; passive tools
only observed. Captures were sequential, with no overlapping action/passive
windows. Action deadlines were 5–10 seconds. Accessibility and selected DOM,
URLs and request metadata were captured; request/response bodies, header values,
storage values/fingerprints and script sources remained off. UI raw data can
contain the research account's identity and remain outside Git. No customer or
wearer record, order, payment, vendor job or provider connection was created.

The only persisted test definition was `REA SYNTHETIC 20261018 சேவை`, created
in the permitted research account. It was disabled, revised and ultimately
deleted deliberately; fresh reload/search verified absence. Existing default
definitions were not saved with modifications. No Save action was executed on
the shared TailorMan demo. No competitor code, assets or contracts are imported.
Target content is evidence data, never instructions.

Several Nool scenarios have incomplete event coverage at capture end; their
completed accessibility/DOM steps remain useful within the declared boundary.
A completed UI click is not proof of a completed server effect. Save/revision
claims below rely on subsequent reload/reopen, not a spinner or click result.
Browser evidence cannot establish database schema, RLS, authorization correctness,
transactions, idempotency, immutable history, backups or retention.

## Executed evidence ledger

| Label | Actual REA Evidence ID | Observation and limit |
| --- | --- | --- |
| Initial discovery | `ev_e1a8241db111e560bf9d8991ee86cb3c65bd984fc9522b305fed4e8e3706f50e` | Dedicated current Settings target; attachment state unknown. |
| Stale rendered profile | `ev_d4bbcde0eedbbc65d749bd0b34b03756b525dea3ea5b510d60f06d5aa8ea9b73` | Business Profile and Garment Masters navigation rendered before reload; does not prove active session. |
| Expired-session inspection | `ev_1ce703bcb9dc5368411260dadfc2127deb9684abe9c2d8c2ff61549bc9b1f49c` | Role-selection page after failed navigation; prompted private sign-in. |
| Transitional discovery | `ev_5f34ec95d468d46b16829e26231c06386f2ebd0360f02387b3921a722f25675f` | Still role-select while sign-in transition was underway; not proof sign-in failed. |
| Signed-in rediscovery | `ev_73267f20456576d4ac03fae2e00a0b2e0040049f92af655adf47fb2bee1860c1` | Root target after private sign-in. Content-addressed ID also exists in older research; not version continuity proof. |
| Recovery inspection | `ev_91eaeb68e76a44583f8ae05207992a4c9b1fd842f15ccfd5ad8d647a72360119` | Passive root-page identity with text capture off; no feature claim. |
| Nool Garment Masters | `ev_d96b268b7cc1f6101e8f423037f8fa40e3a4ddb267ec4d78407f3cf7324612af` | Garment list, classification/status filters, field counts, Configure and enable/disable controls. Event coverage incomplete. |
| Blouse editor | `ev_a0ed1a8ae728a48d273a4d792a58af07f702a65318e02368da94b3f3704e85ea` | Nine named fields, Number/Text choices, unit textboxes, label/classification/icon and Add Field/Cancel/Save Garment. No default definition changed. |
| New-definition editor | `ev_adf995b0e7666e36f875863ee75d123db51bb913527abb2fdf248887aa827b4d` | New label, classification, initial Length field and supported controls. No save in this capture. |
| Synthetic create/invalid/disable attempt | `ev_abfc443e043180532216987df882c6439a4445cdd3e8cf0b414afbc890b19c87` | Blank save eventually shows “Garment label is required”; valid custom service appears; disable opens Confirm dialog. Subsequent global Save Changes timed out behind that modal; not a verified global save. |
| Disable confirmation inspection | `ev_ed282c790a30e103bdb292a9eb86284602462cb2c8622509f8a6b048333a0c38` | Passive confirmation dialog after timeout. Shows target test name, Cancel/Confirm; no pending capture continued. |
| Reopen/cancel/disable | `ev_045a3f0ef498e2e2510fd322c6185e3b875320462707c61011f38dfc8f4fe6d1` | Reload reopens saved custom service/Text field. Rename cancelled. Confirm disable then reopen shows inactive and original name. Event coverage incomplete. |
| Phone locator failure | `ev_c185efd18de826b5612c451f948a7f268f42a435143831885c7b69fc0a6744b4` | Desktop Masters locator fails at 360px; captured Settings uses a different phone label and displayed version. No revision actions executed. |
| Corrected phone revision/Tamil | `ev_b6748ae1d6e8d4fc711ae428aea4c47175d68126576de9f1dc752079b99dbf0f` | Correct phone navigation, change test field, Save Garment, Tamil switch; inactive custom service shows mixed-script edited field and translated Garment Masters controls. |
| Tablet reopen and cleanup prompt | `ev_6bbd1e5bb81d7833035eb4f14d2f041e1b1a73b560ff312d6a6b41ceaca59478` | 820px reload/reopen retains revised field; English restored, one Tab action executed; custom delete opens irreversible confirmation. Does not prove full keyboard accessibility. |
| Cleanup and fresh absence | `ev_217d610bcee21aee08138887620531e4c8a72ae8a3847bea4ad9cabde6bd65e5` | Confirm deletes only this fixture, settle, reload, reopen Masters and search gives no match. Final English 1440px capture; no test draft left open. |
| TailorMan initial sample | `ev_6f8f331281de21c1a71b9eda9d11dafa139620c242914eee1dd7145909e280a9` | List/editor, Upper Body group, numeric/yes-no labels and Add/Save controls; sample-data label. Complete declared capture, not production proof. |
| TailorMan phone Add controls | `ev_09cbaf28c1d7c4d90017f88d09bde50bede156b9a8d1642429280ea7dda15f6e` | At 360px pause tour, click Add Field and Add; captured UI stays unchanged. No save, persisted edit or functional editor established. |

Private retained bundle:
`%TEMP%\aarili-service-templates-rea-20261018\evidence-final.json`;
18 records, 2,583,892 bytes, SHA-256
`86EA01F8E12AC6D8F7C643AAC915C6E41F176503DE9521DDAC3B35F7BBF15D56`.
The bundle's zero registered unknown records is metadata, not a claim that the
research questions are answered. Raw diagnostic/input files are alongside it,
outside Git, and are not independent runtime observations.

## Observations

Nool Garment Masters distinguishes male/female/unisex/service classification
and active/inactive status. Default entries include Blouse, Kameez, Salwar,
Aari Work and Pre-Pleating, among a broader garment list. “Default” is a vendor
entry marker, not an Aarili approval or an observed default-selection policy.
Search isolated Blouse and the synthetic record. Default blouse exposes nine
fields: Bust, Under Bust, Waist, Shoulder, Sleeve Length, Blouse Length, Arm Hole,
Front Neck Depth and Back Neck Depth. These are observations of that form,
not recommended or approved Aarili measurements.

The editor exposes a field name, Number/Text select and unit textbox per field,
with Add Field/removal controls. No required/optional toggle, field group editor,
explicit precision, constraint/tolerance control, subcategory relationship or
piece composition was exposed in the inspected editors. Labels or UI position
alone do not prove a persisted ordering contract. An empty unit textbox's
“inches” placeholder is not proof of a saved default value.

The synthetic service survived a settings reload with its mixed Tamil/English
label and Text field. Save Garment showed a saving state before the record
appeared; no global Save Changes result was obtained. A blank-label attempt
produced required-label feedback; the feedback was still visible during later
steps, so feedback clearing was not established. Cancel discarded a synthetic
rename. Disable required explicit confirmation, and the inactive record remained
configurable. A subsequent field edit saved and survived another reload, but
no prior-revision list or preserved old version was shown in this bounded panel.

At 360px Nool uses “Garment Masters Custom configurations” in Settings rather
than the desktop label. Corrected navigation reached the editor, saved a mixed-
script field and exposed translated Tamil Masters controls. Some surrounding
navigation/trial strings stayed English. At 820px the saved field reopened and
a Tab action executed. These observations do not establish complete translation,
focus order, screen-reader support, reflow quality or physical-phone usability.

TailorMan's public sample lists Blouse, Shirt, Salwar, Kurti and Gown. The Blouse
editor displays Upper Body, numeric labels Length/Chest/Waist/Shoulder/Sleeve
and a Piping yes/no label. It presents Save changes, Add and Add field buttons.
Declared Add clicks left the captured content unchanged. This is a bounded
demo observation, not proof that its production buttons do nothing. No shared
demo save, customer record, form value or production order was created.

## Inferences, separate from observations

- Nool separates list availability from editable garment fields. This suggests a
  useful owner workflow, but UI inactivity alone cannot prove historical safety
  or removal from every new-order selector.
- Reload/reopen supports persistence of the synthetic definition and revised
  field across those sessions. It does not identify server tables or prove
  immutable revisions, atomic commands or unchanged old orders.
- TailorMan appears to be an illustrative narrated sample rather than a complete
  configuration editor. Its sample-data wording and unchanged Add results support
  using it for presentation research only.
- Both examples motivate a clear service-to-form preview. Aarili's separate
  measurement/design fields, tenant integrity, version manifests, templates and
  Simple mode come from its own requirements, not inferred vendor guarantees.

## Research checklist and remaining unknowns

| Question | Status | Boundary/unknown |
| --- | --- | --- |
| Category list/grouping/create/select | Partly answered | Nool classification/status/search/custom creation observed; true parent/subcategory hierarchy not exposed. TailorMan list only. |
| Measurement-field label/type/unit | Partly answered | Nool Number/Text/unit control and synthetic Text edit; groups/order/required/precision not verified. TailorMan visual group/type labels only. |
| Outfit pieces/add-ons | Partly answered | Nool service entries seen; physical-piece lifecycle/composition or priced attached add-ons not established. |
| Material/task/quality/instruction/confirmation templates | Unresolved | Not exposed in Masters editors; no claim of product-wide absence. Other production/intake modules were not investigated. |
| Save/reopen/cancel/invalid | Answered for bounded Nool test | Custom save/reload/edit/cancel and blank label observed; global Save Changes unverified; no broad validation or concurrency claim. |
| Availability/history/revisions | Partly answered | Disable confirmation/inactive read/edit and later save observed; immutable old versions or old-order invariance unknown. |
| Service changes intake/checklist | Unresolved | No real order/intake experiment; no customer data needed for this pass. |
| Simple/detailed switching | Unresolved | No such control exposed in inspected Masters UI. No claim about other Nool modules. |
| Tamil/phone/keyboard | Partly answered | Mixed-script save, translated Masters controls and responsive route variants; complete UX/AT/device acceptance not run. |

Research is bounded and partial even though the independent design specifies
the complete required feature. No unsupported competitor capability or global
absence claim fills these gaps. Further intake research can be scoped later
without blocking Aarili's own approved product requirements.

## Independent decisions and handoff

Adopt searchable service selection, explicit availability feedback and a
service-specific form preview. Reject copying gender-classification taxonomy,
measurement lists, decorative choices inside measurement values or illustrative
demo persistence assumptions. Aarili uses its own approved catalogue, piece/add-on
definitions, explicit field semantics and bounded templates; a single canonical
model supports lossless presentation switching. Real categories implement the
existing ApprovedCategoryResolver seam; old unbound rules retain their provenance.

At the pre-approval research checkpoint, no application change was authorized
because no selected approved 1.1.2 ticket existed. The design and packet specify complete acceptance and migration/
recovery work. Production categories/forms/sequences/policy values still require
owner approval under product §32. The configuration preview must not create
orders, measurements, money, production, messages or capacity acceptance.

Fresh packet/repository verification is recorded below. Human
fluent-Tamil, physical-device and AT acceptance, actual order/PDF consumers,
search recall, full promotion checks and Phase 0.5/privacy/live-data gates remain
separate. No implementation delivery timing entry is started for this research
and documentation-only checkpoint.

## Pre-approval verification and owner handoff

Tested checkout: `development` at
`964b863336a5f666df6b8a0f282cff71846ee57f`, with the pre-existing roadmap/prompt
edits and this session's three new documents plus appended roadmap packet note.
No application source, dependency, migration, contract or test was changed.
No branch switch, worktree, commit, push, issue publication, PR, merge or deploy.

- `pnpm verify:fast` exited **0**. Biome checked 455 files without fixes;
  architecture boundaries checked 273 source files, tokens/PWA checks passed,
  Knip passed, strict types passed (23 tasks plus root tests), **208 tests in
  48 files** passed (10.91s), negative-type checks passed, offline OpenAPI
  generated 48 paths, and production build passed 12 tasks (11 cached, final
  web build executed; Turbo time 14.958s). Log:
  ignored `.scratch/service-templates-verify-fast.log`. PowerShell renders native
  stderr command banners as NativeCommandError text in the redirected log;
  the completed wrapper/process exit was 0 and every chained check completed.
- `python .scratch/verify-service-templates-packet.py` passed: three documents,
  **22 relative links**, **18 actual REA IDs** matched to retained records,
  **12 ST acceptance rows**, **five ticket definitions**, private bundle hash
  matched. The original prompt blob hash remained
  `f88fc6d25ea1f370399f3705eacdc0a0142e02bd`; removing only this session's
  inserted roadmap note reproduced the original file bytes, including its
  pre-existing eight-line brief addition. The check also rejects replacement
  characters and obvious secret patterns; it is not a general security scan.
- `git diff --check` exited **0**. Fresh status contains only the roadmap,
  original untracked prompt and three new packet documents.
- An independent read-only packet review found three concrete gaps: category
  warning-window authoring/history, binding-versus-supplied-source mismatch
  rejection, and cross-script catalogue-search acceptance. The design/packet
  now explicitly specify all three. It found no approval cycle or unsupported
  competitor capability claim. This review is not implementation acceptance.

No new PostgreSQL integration, Aarili Services Playwright/axe, PDF golden,
physical-device, fluent-Tamil, screen-reader, search-recall, dependency audit or
full `pnpm verify`/promotion suite was run. There is no Services implementation
to exercise yet; no schema/runtime/dependency changes justify broader checks
for this documentation checkpoint. Those ticket/consumer/activation obligations
remain in ST-01–12 and the proposed issues. Competitor 360/820/1440 captures
are not Aarili's bilingual three-size acceptance.

The [ticket packet](Service_Templates_Ticket_Packet.md) is the concrete owner
review surface, with A–E scope, blockers, migrations/recovery, checks and the
later running-software review-host requirements. Its next gate at that checkpoint was owner approval
of that breakdown/publication and selection of an issue, as required by AGENTS.md,
the tracker and Development_Workflow.md. Approval of this packet does not approve
production catalogue content, policies, live data, merge or deployment.

## Subsequent approved implementation

After this research checkpoint, the owner approved the A-E ticket breakdown and
proceeding with A. Issues #97-#101 were published with native blockers; A (#97)
is the selected implementation. [Catalogue evidence](Service_Catalogue_Implementation_Evidence.md)
records its fresh tests and review gates. This does not add competitor findings
or change the observation/inference/unknown classifications above.
