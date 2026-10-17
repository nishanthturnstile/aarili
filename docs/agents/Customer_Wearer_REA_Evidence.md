# Customer and wearer research evidence

Research date: 17 October 2026. Status: bounded authenticated workflow research
completed with the explicit limits below. This is a competitor evidence record,
not an Aarili implementation acceptance report.

## Target and provenance

- Primary runtime: https://app.nooltech.com/ (sign-in at `/login`), title
  `Nool Tech | Tailoring Management`. App build/version not exposed in the
  inspected dashboard. Observed delivered entry asset: `index-lmQPaCGJ.js`
  (filename only, not a source digest/version guarantee). Browser:
  Chrome/155.0.8059.80, CDP 1.3; REA observation provider version 2.
  Do not substitute the browser or REA version for the app version.
- Public vendor descriptions: [customer management](https://www.nooltech.com/tailor-customer-management-software/)
  and [measurements](https://www.nooltech.com/tailor-measurement-app/), fetched
  17 October 2026. These establish vendor claims, not executed workflows.
- Repository state: `codex/owner-access-onboarding`, HEAD `7096a8c`;
  `git ls-remote origin refs/heads/development` returned
  `7096a8c8752d3a7e7b3f7cc3e426a9d3aa12e1ba`. Numerous existing tracked and
  untracked onboarding edits were present before this work.

## Capture boundaries and access handoff

The user supplied an already signed-in T3 tab. `preview_status` identified its
owner as unclaimed. A read-only `preview_snapshot` inspected the dashboard;
no preview click or form entry was performed. The preview snapshot includes UI,
accessibility and request metadata, with no requested headers or bodies.
Account identity is omitted from this sanitized note.

The installed REA tool schemas were discovered for `list_browser_targets`,
`inspect_web_page`, `observe_web_session` and `capture_browser_scenario`.
`get_evidence_bundle(detail=summary, operation=capture_browser_scenario)` returned
zero retained records before this investigation. Subsequent captures are listed
below with their actual REA Evidence IDs.
The T3 tab has not been claimed to expose a CDP endpoint. An unrelated local
headless browser discovered during preparation was not used or attached.

Preparing a dedicated Chrome profile with loopback port 9226 was rejected by
automatic execution policy (`blocked by policy`); the launch did not succeed.
The user was given a private manual sign-in handoff. A subsequent loopback
version check initially found no reachable endpoint. The user then launched the
browser and completed private Google verification/sign-in. Authentication was not copied from
T3, cookies are not exported, and passwords/OTP must never enter chat or Git.

Research profile: `%LOCALAPPDATA%\Aarili-REA\nool-research`.
Endpoint: `http://127.0.0.1:9226`. REA discovery selected Nool target
`3BCF0ABFB7508D2C305C76DB28096829` before inspection. The profile and raw captures
remain outside Git. The local existing-work hash manifest is outside Git under
`%TEMP%\aarili-nool-rea-20261017`.

Private sign-in was followed by passive page inspection. Agent actions used
declared REA scenarios, without overlapping passive windows. Empty forms or
completed invalid test drafts were deliberately discarded between scenarios;
the member-label experiment ended with Cancel. Network request/response bodies,
header values, storage values and script sources stayed disabled. Selected
accessibility/DOM, request metadata and one viewport screenshot were captured.
No credentials were collected and no real customer record was inspected.

The exported raw bundle is outside Git at
`%TEMP%\aarili-nool-rea-20261017\nool-evidence.json` (20 records, 1,174,199 bytes).
It contains account UI identity and remains private; only this sanitized note
is intended for repository review. Header *names* are metadata, not header values.
No payload capture was necessary. No account signup, upgrade, import,
messaging/payment integration or message sending occurred.

## Evidence ledger

Local IDs below identify this note's sources; `PREVIEW` and `PUBLIC` IDs are
explicitly **not REA Evidence IDs**.

| Local source ID | Observation or claim | Authority and limitation |
| --- | --- | --- |
| PREVIEW-01 | Signed-in dashboard offers Customers in navigation and a Customers quick action. It displays zero registered customers and no recent activity. | Read-only T3 accessibility/text snapshot, 17 October. Does not prove all data in the account are synthetic or empty. Inspect only the dedicated synthetic shop and our own fixtures. |
| PREVIEW-02 | Dashboard displays Free Trial, 90 days left, all features unlocked, and an Upgrade action. | Runtime UI claim only. No upgrade selected; no billing terms or renewal conditions accepted/verified. |
| PUBLIC-01 | Vendor describes name/phone creation, optional email/tags/notes, search and customer profiles. | Public customer page. Required fields, persistence, shared phones and permission behavior still need runtime checks. |
| PUBLIC-02 | Vendor describes choosing a customer and a family member before measurements. | Public measurement page. Does not establish separate legal identity, guardianship or consent controls. |
| PUBLIC-03 | Both public pages advertise a 90-day trial without a credit card. | Current marketing description; not proof of this account's contractual trial/renewal terms. |
| REPO-01 | Issue inventory has no published Wave 1 customer/wearer ticket; open inventory contains the Dependency Dashboard. No open PRs returned. | Fresh authenticated `gh issue list --state all --limit 150` and `gh pr list --state open`. Recheck before implementation/publication. |
| REPO-02 | #16 closed through merged PR #21 (14 October); #51 through merged PR #61 (15 October). | Fresh `gh issue view` closing references plus `gh pr view` state/merge time. These are the roadmap's 0.2.3/0.4.1 technical prerequisites. |

No raw captures are committed. No vendor code, assets or API contracts are
imported. Client observations cannot establish Nool's database model, RLS,
server permissions, atomicity, idempotency, backups or retention implementation.

## Executed REA evidence

All IDs below are retained in the private bundle. Long captures were inspected
through selected structured fields rather than treating a truncated text preview
as the canonical result.

| Short label | Exact REA Evidence ID | Sanitized observation |
| --- | --- | --- |
| Discovery | `ev_73267f20456576d4ac03fae2e00a0b2e0040049f92af655adf47fb2bee1860c1` | Dedicated endpoint selected the Nool root page after private sign-in. |
| Dashboard | `ev_8dc3c85cd6e6dc747ec1bf0c222c02bdddeb937062bbb0f263f62486882fcee0` | Authenticated dashboard and trial banner. |
| Empty directory | `ev_e3c8c9c021616ee7ba0f7f8c2cd398f9969bbabccc9ef29531c32df4702acc61` | Zero customers, Add Customer, search, type filters and No customers found table state. |
| Create form | `ev_12d1fbefec0b4f9e30bc4ad39e088afd0c995a40c2120b807192984464b892ff` | First Name and Phone marked required; last name/email/address optional. Type, fit, design tags and fabric notes present. No notice/consent/guardian/channel control exposed on this form. |
| Minimal/Cancel | `ev_142de00ad53f07cc8c029e78403e9af5dc27d7e90531a3991464faf8baaa6f0c` | Name-only save issued POST, got 400, showed phone-required/format error and retained name. Save briefly disabled. Cancel returned to zero customers. |
| Save | `ev_d7894046210f724b4b86f76a22adba2d5b71641f87fa663e970bc7f901ff7d9e` | Name + fictitious international phone, other contact fields empty, saved with 201; directory showed one row and C0001. |
| Shared phone | `ev_79dd3fb30c11798cb34b77953fd04da6d989a7a6f5efb261a7a8b6e6002022b2` | A different synthetic name with the same phone got 409 and a visible already-exists message. Invalid draft was deliberately discarded; no second customer created. |
| Reopen profile | `ev_a81754da98d813ae9ff12fb62d276fee257ca6cc3e3dc9f9d0944129e0d9c947` | After navigation/reload, saved customer reopened through View Profile. Original Tamil/Latin name retained; email Not provided; default preferred fit Regular; Overview/Measurements Registry/Order History/Private Notes visible. |
| Settled search | `ev_77a7072edf010a687354482a167eec63a7a9192395c4fa35870f4655421146a3` | Exact mixed-script name, Meena and மீனா returned our row; meenaa, national phone digits, spaced international phone and suffix 0101 returned No customers found. |
| Registry | `ev_d7323373bf41f66b0ea8fd467e9f51b0cf844f334ada02e59f762782984bc4d5` | Customer profile registry was empty. No member creation control exposed there. |
| Select contact | `ev_1853dbe916fba1b41962642168e44a266ed5876334cd97726c6bc96bd56f10cc` | Global Measurements page selects our synthetic customer and names them above Add Measurement. |
| Person entry | `ev_530730cfb45a40a54c8e448465cca6e5354c30e0e33a2287af5123161ca4da2f` | Add New Measurement exposes a free-text Measurement Profile (Member Name), initially Self, explaining that labels distinguish people under a customer. No separate person record selector/age/guardian/consent control exposed here. |
| Adult/minor labels | `ev_7a340b11056a9d8f9840b15453d7ba010caccfcc40f742d5a95eb487eff19e83` | Entered an adult member label, then a clearly synthetic under-18 label; no guardian control appeared. No measurements entered or saved. Cancel returned to No measurements recorded yet. This does not establish persisted wearer identity. |
| Phone/UI language | `ev_135e6fdf6bfd04b844f41fbc0d3046ed50434987feb29ca032b43adb1198320d` | Exact stored international phone also returned no matches in this test. Global Tamil switch translated directory/navigation labels and kept original name; English restored. Some action/trial labels remained English. This is UI locale, not customer preference evidence. |
| Directory viewport | `ev_ed2098b4f47982ddc3413083456e0c825269c7d0e5e294cdd20c2639c71e9bdd` | 907×964 screenshot: our row, country-prefixed phone and directory layout; table scrolls horizontally at this width. Not a three-size accessibility audit. |

Capture timing: initial passive authenticated inspection began at
2026-10-17T05:42:04.516Z. Later records retain their own observation windows.
Early search captures used 450ms waits and still showed loading skeletons;
they were not used as proof of settled search results. The follow-up used 1400ms
per query and captured either our row or No customers found. This is a single
fixture observation, not comprehensive search quality or a vendor bug diagnosis.
Some network-enabled scenarios ended with unrelated requests unfinished and
declare events incomplete; the observed customer POST status/UI result is
retained, while later activity remains unknown. No server guarantees are inferred.
Two malformed fill-value calls were rejected by schema validation before
runtime; the corrected live schema uses `{source: literal, value: ...}`.

## Bounded checklist outcome

Every untested item remains a gap, not a negative finding about Nool.
Saved fixture: `REA Test Meena மீனா`, C0001, phone `+1 202 555 0101` from the
[NANPA reserved fictitious non-working range](https://nanpa.com/numbering/555-line-numbers).
The United States country selector was used. No number was called or messaged.
No other customer was saved; adult/minor member labels were canceled. This one
clearly labelled synthetic customer is retained for reproducibility. The browser
remains open in English on Customers, with search cleared and no unfinished form.
Any later cleanup must target this fixture alone through supported UI; no bulk
deletion, real contact import or measurement/photo save is authorized here.

| Question | Result | Boundary |
| --- | --- | --- |
| Directory empty state | Observed | Empty directory uses the same No customers found wording as a zero-match result. |
| Minimal/optional entry | Name-only rejected; name+phone saved without email/last name/address | Phone requirement differs from Aarili. |
| Save/reopen | Observed persisted row/profile after navigation | No inference about transaction internals. |
| Name/Tamil/phone search | Mixed-script and partial exact text matched; tested spelling/phone variants did not | One fixture; transliteration/general phone coverage unknown. |
| Shared phone | Rejected with 409 and explicit message | No bypass or phone alteration to defeat the duplicate rule. |
| Self/adult wearer | Self default and editable member label observed | Separate persisted wearer identity unavailable in inspected path without saving measurements; not attempted. |
| Minor/aunt/guardian | Dedicated controls not exposed in create/profile/person-entry screens | No claim of product-wide absence; adult/child labels are not authority evidence. |
| Notice/preferences/marketing | Fit/tags/fabric notes and global locale exposed; no per-person notice/channel/marketing controls seen here | No privacy-settings expansion or legal conclusions. |
| Validation/cancel/retry | Required-phone and duplicate errors, disabled save, retained values and Cancel observed | Naturally occurring outage/retry not encountered; no fault injection/concurrency test of vendor. |

Inspect the directory before opening any record. If unexpected real data appear,
avoid those records and use only the explicitly selected synthetic workspace.
All checklist questions are now observed, unavailable on the inspected path or
bounded unknown. Stop this investigation here. No APK, delivered script analysis,
secondary TailorMan research or vendor security probing was needed.

## Independent interpretation and Aarili comparison

The explicit Customers destination, save-to-list and profile reopening support a
clear registration journey. Phone-required/duplicate rejection and a free-text
measurement member label are observed differences from Aarili's requirements.
The latter is a useful visible context cue, but cannot replace wearer identity.
No runtime evidence establishes the privacy guarantees Aarili needs.

| Aarili requirement | Research limit | Independent design response |
| --- | --- | --- |
| CUS-01 minimal contact; shared phone valid | Nool required phone and rejected duplicate phone | Display name required; phone/email optional and non-unique. |
| CUS-02/07 separate wearer and permission | Nool exposed a member label; persisted identity/authority unknown | Explicit self/adult wearer records and interaction-scoped permission evidence. |
| TRU-04/13 notice and purpose | Controls not exposed on inspected registration path | Approved bilingual notice versions and independently recorded purposes; no assumed opt-in. |
| TRU-05 aunt is not guardian | No dedicated controls in inspected path | Nullable under-18 flag, separate guardian identity and authority evidence; unknown stays unresolved. |
| TRU-01/03/07 private tenant records | Vendor server guarantees unknown | Aarili membership checks, FORCE RLS and private-only output tested in our own environment. |

See [design](Customer_Wearer_Design.md) and [proposed tickets](Customer_Wearer_Ticket_Packet.md).
Research gaps do not change product requirements. No implementation, feature
completion, legal compliance or live-readiness claim follows from this record.

## Packet verification and manual handoff

- `git diff --check`: exit 0. Existing-work SHA-256 manifest comparison found
  only the intentional appended research-result section in the existing feature
  plan changed. All pre-existing onboarding/application/AGENTS/prompt files
  retained their baseline hashes. Three new documents were added: this evidence
  note, the design and the ticket packet. No existing edits were committed.
- A local Python document check initially flagged the abbreviated `AC-39/52`
  label; it was expanded to explicit IDs. The corrected check exited 0: four
  documents' relative links, 15 cited REA IDs present in the retained raw bundle,
  14 requirement/scenario references and 13 ticket-local CW labels checked.
- Private bundle SHA-256:
  `A09ABC473F484A57F35AC9887D6D742682B377F96874F8B5926A840220BEF705`.
  This identifies the exported evidence; it does not prove vendor guarantees.
- The explanatory in-thread identity/ticket diagram was previewed at 728px and
  360px with no console messages. It is a design proposal, not a running Aarili
  feature or completed usability/accessibility test.
- No application lint/Knip/typecheck/unit/integration/browser test/production
  build was run for this documentation-only research change. Existing onboarding
  command results were read for context, not rerun or claimed as this feature's
  verification. Actual implementation requires the commands and evidence in
  the selected approved ticket and Development_Workflow.

For owner review, read the evidence differences, then the design acceptance
matrix and the full A/B/C issue bodies. Confirm granularity, direct edges and any
merge/split changes before authorizing publication. That review is distinct from
approving policy wording, accepting implemented software or authorizing merge.
Implementation can begin only after the selected-approved-ticket, relevant
policy and integrated-onboarding/merged-prerequisite gates are satisfied.
