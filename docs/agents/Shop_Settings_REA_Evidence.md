# Shop settings: bounded REA evidence

17 October 2026. Roadmap **1.1.1**. Research is **partial**, with explicit
unresolved coverage after scenario calls stalled. This is competitor evidence,
not implementation acceptance. [Brief](Shop_Settings_REA_Prompt.md),
[independent design](Shop_Settings_Design.md),
[ticket packet](Shop_Settings_Ticket_Packet.md).

## Targets, access and capture limits

Primary: `https://app.nooltech.com/`, Settings at `/settings`, title
`Nool Tech | Tailoring Management`. App build/version was not exposed; observed
entry asset filename `index-lmQPaCGJ.js` is not a version guarantee. Browser
Chrome/155.0.8059.80, CDP 1.3; passive REA provider version 2. Reused
`%LOCALAPPDATA%\Aarili-REA\nool-research`, loopback endpoint
`http://127.0.0.1:9226`. Fresh discovery selected target
`3BCF0ABFB7508D2C305C76DB28096829`; matching an old ID was a discovery result,
not an assumption of continuity.

The existing process/profile was inspected before asking for access. Its old
Customers page was still rendered, but the first scenario reload returned 401
from the session check and stopped before its initial capture. Only then did
the user privately sign in again and report “Signed in”. Subsequent Settings
and Business Profile captures succeeded. No password/OTP/token/cookie was
requested or copied; no new account, paid terms or provider connection.

Secondary: [TailorMan Settings demo](https://tailorman.in/demo/settings.html),
documented entry [product tour](https://tailorman.in/product-tour/). Title
`Live Demo — Settings | Tailor Man`, no app version exposed. The current public
demo was executed in a temporary REA launch profile; this establishes demo UI,
not TailorMan production behaviour. No public demo save was completed.

T3 `preview_status` first returned unavailable; `preview_open` successfully
opened the public Settings demo. It automatically progressed to Audit Log
while its narrated tour ran. That unsolicited navigation/sample audit text is
not evidence of persisted configuration history. The REA launch capture below
remained on Settings. No T3 tab was assumed to expose REA CDP.

Existing [customer/wearer evidence](Customer_Wearer_REA_Evidence.md) supplies the
private access handoff and prior language context only. Its customer search,
member-label and save observations do not establish Settings behaviour. Reused
discovery can have the same content-addressed Evidence ID as historical work;
it is not proof that a vendor version remained identical.

Completed captures requested accessibility/selected DOM and request metadata,
with network bodies, header values, storage values and script sources disabled.
Raw UI can contain account identity, so raw data remain outside Git. No customer
record was opened in this Settings investigation. No competitor code/assets/API
contract is imported into Aarili. Browser evidence proves neither database schema
nor RLS, server permissions, transactionality, idempotency, backups or retention.

## Executed evidence ledger

| Label | Exact REA Evidence ID | Sanitized observation / limit |
| --- | --- | --- |
| Discovery before refresh | `ev_4e64421afb1fb53123d49495681fa94d7b0824085eba0a0b7eea411aaa6d8242` | Current loopback endpoint lists the dedicated Nool Customers target. Attachment state unknown. |
| Stale rendered page | `ev_f75342005df199460ba28e39f2444171eaed2c6032ac17632fd766dbf0b8046c` | Passive Customers UI still rendered with Settings and Vendors navigation; does not prove the session will survive reload. Observation window 09:59:17.953–09:59:18.865Z. |
| Rediscovery after private sign-in | `ev_73267f20456576d4ac03fae2e00a0b2e0040049f92af655adf47fb2bee1860c1` | Fresh endpoint discovery selected the root page after user sign-in. Same ID exists in prior research; current discovery was executed again. |
| Settings inventory | `ev_f8cbc6677e8ad818dc4bdeb636a92a274c4c89f75a7c4b273d5a87b12322b239` | Declared navigation through Settings succeeded. Groups Account/Application/Workspace expose profile, security, business, notifications, language, display, team, subscription, privacy, garment masters, locations, audit logs and help. Initial panel My Profile. Network events incomplete at capture end; UI snapshot is retained. |
| Business Profile | `ev_2a41d1487a412cae6fe36323abf8ae1e7572e8e7a96dbe840a772bbcf0d8167f` | Declared Business Profile click exposes shop basics, legal/address, free-text hours, GST, social presence and branding, plus Save Changes. No structured calendar/capacity/policy-history control exposed in this panel. Network event coverage incomplete; no save executed here. |
| Draft visible during recovery inspection | `ev_1fd5541ce0b597f184bff23d0f3488087644ba4b8c70f180ca7cc484c74b542b` | Passive 10:08:02.356–10:08:02.790Z inspection finds synthetic mixed-script description text in Business Profile after the stalled draft test. Establishes visible input only; persistence/cancel/reopen unknown. |
| TailorMan public Settings | `ev_14ca721c49a14c056ae0851e115ee888d40c79a6cfffeb9d64976036b59cef5e` | Temporary launch + settle captured Shop Details, Bill Numbering and Wage Rates; ordinary editable inputs but no Save/form action in captured page. Complete declared capture, not persistence or production proof. Owned temporary browser cleanup terminated-owned-process. |

Private retained bundle:
`%TEMP%\aarili-shop-settings-rea-20261017\shop-settings-evidence-final.json`:
8 records, 613,018 bytes, SHA-256
`1928C35AF693931B6F3C5831908D962B1C10C60D27D9757F6D94330E5A4EF260`.
The extra discovery record is another bounded current-target check. Bundle
`unknowns: 0` is the export's record metadata, **not** an assertion that the
research questions below are answered. Earlier snapshot bundle is retained
separately. Do not commit either bundle.

## Observations

Nool Business Profile exposes three business-type choices, specialization and
business category selectors; its helper text says these affect enabled features
or garment types. Only Shop Name is visibly marked required in that panel.
Street/city/state/zip, optional GST number and an invoice GST toggle are present.
Business Hours is one free-text textbox, not separately structured opening,
break, holiday and production controls in the inspected panel.

Branding exposes tagline, external logo URL, invoice footer and colour inputs.
Social inputs and customer portal/copy/WhatsApp links are also visible. None of
these toggles/links was activated. Their presence does not establish integration,
media security, customer access semantics or correct generated documents.

The Settings inventory contains notification and audit destinations, but their
panels were not successfully captured. Vendors is separate main navigation;
its create/edit/active/history workflow was not reached. Payment methods were
not exposed in the captured Settings overview/Business Profile, which is a
bounded observation, not a product-wide absence claim.

TailorMan's captured Settings page has shop name/phone/address/GSTIN inputs,
automatic/manual bill-number choices and prefix/next-number inputs, plus two
piece-wage inputs. No save, cancel, required-field validation or effective-date
control was exposed in that captured page. No primary business profile values
were changed or copied from it. Narration offers multiple languages; its label
selector alone does not prove that Settings fields translate into Tamil.

## Inferences (not vendor guarantees)

- Nool's grouping suggests business identity is separated from personal account
  settings. This is a useful navigation idea, not a reason to copy its groups.
- A single hours text field likely provides less machine-checkable scheduling
  information than Aarili needs. It does not prove Nool lacks another calendar.
- TailorMan's page appears to be an illustrative public demo. Missing Save and
  tour progression support treating it as layout evidence; persistence is still
  unknown rather than disproven.
- Nool's visible business-type/GST/portal controls combine release capabilities
  Aarili must govern independently. They do not authorise enabling Aarili retail,
  tax invoicing, customer access or automated WhatsApp.

## Unknowns and bounded checklist result

| Research question | Status | What remains unknown |
| --- | --- | --- |
| Grouping, profile fields and defaults | Partly observed | Nool overview/profile and TailorMan fields only; defaults are displayed values, not approved or server-enforced business defaults. |
| Required/invalid/missing configuration | Partly observed | Shop Name marker seen; no executed invalid save, field validation or missing-policy gate. |
| Save, cancel, reload and recovery | Unresolved | Draft text visible; no verified save, restoration, cancellation or server persistence result. |
| Opening hours, breaks, holidays, appointment/production calendar | Partly observed | Nool free-text hours only; structured controls elsewhere not established. |
| Payment methods versus processing/integration | Unresolved | No relevant panel captured; no transaction/provider was connected. |
| External artisans versus staff; inactive historical vendors | Unresolved | Separate Vendors/Workers navigation only; vendor records not opened. |
| Advance/quote/cancellation/change/rework/credit/refund terms | Unresolved | Not exposed in inspected profile; other panels/search paths unavailable within this pass. |
| Delivery windows/escalation, lead time/capacity/peaks/cut-off/rush | Unresolved | No relevant settings panel captured; no order or queue experiment. |
| Overrides, exception reasons and rush waiver | Unresolved | No attributable override or charge experiment. |
| Effective dates, configuration history and old-work invariance | Unresolved | Audit destination/sample tour text cannot prove version history or unchanged old orders/PDFs. No historical record experiment. |
| Phone/Tamil usability | Unresolved for this settings flow | Synthetic Tamil description rendered in input. No successful phone-settings/locale scenario or accessibility audit. Prior customer-language evidence is not Settings acceptance. |

### Failed scenarios and stopping boundary

Two early calls were rejected at schema validation before runtime while
discovering action/locator fields. The corrected schema uses action/step_id,
CSS or role locator objects and fill values `{source: literal, value: ...}`.
The first corrected navigation failed before initial state; selected metadata
showed session check 401 and an unfinished refresh. It has partial diagnostic
output, not a completed Evidence ID or Settings result.

After private sign-in, completed Settings and Business Profile captures above
succeeded. A draft scenario attempted filling the initially empty description
with `REA synthetic settings draft — தமிழ்`, leaving the panel through
Notifications and reopening it. That call stalled and was terminated at the
orchestration-cell level. Passive recovery inspection confirmed only the draft
text visible. Subsequent bounded notification scenarios, including explicit
action deadlines, and a disposable TailorMan edit/reopen attempt also stalled;
their waiting cells were terminated. No results or Evidence IDs returned for
those attempts. Do not infer that their declared steps completed or that cell
termination proves provider/browser cancellation. No Save action was declared
in any stalled scenario. Persistent effects from possible autosave remain
unverified; no profile restoration success is claimed.

Read-only diagnostics used the already cached REA 6.5.0 CLI `doctor --client
codex --json`: exit 0, Node 24.21.0 and Codex registration healthy/aligned.
The general environment report lists missing unrelated native engines and
another client's registration; neither explains the browser scenario stall.
No registration/skill/engine repair or install was performed. Actual cause is
unknown. Stop further action captures until the REA scenario connection is
cancelled/reconnected and current target/draft state rechecked; do not overlap
potentially pending target actions. Raw diagnostics are not application findings.

Cleanup handoff: the dedicated profile remains available. Last verified Nool
state was Business Profile with the labelled unsaved description. Once pending
scenario work is confirmed stopped, reload/discard that test draft without
clicking Save, then re-open Business Profile to verify the original empty
description; restoration has not been verified here. No other value was targeted
for change. A temporary secondary local-demo edit was attempted but has no
returned result; no shared-demo save was declared. Do not clean up unrelated
customers or the prior retained customer fixture. Sign-in remains private.

## Independent design decisions

Adopt clear business-profile navigation and explicit document identity fields.
Use a structured, separately versioned customer/production calendar rather than
free text. Keep required configuration visible, with action-specific blockers
and draft treatment. Implement our own labels, flows, schema and evaluation.

Reject arbitrary external logo URLs, vendor-specific GST/business-type toggles,
customer-portal links and payroll/numbering fields as a template for this slice.
Aarili keeps private authorised media, non-tax pilot constraints, release gates
and immutable history. Competitor gaps are research unknowns; Aarili still must
deliver all SET-01/02/05/06/07/08/09/11 requirements in the approved boundary.

The design resolves the category seam with a neutral evaluator plus unbound
rule drafts in 1.1.1, actual category identity/binding in 1.1.2 and transactional
acceptance/load in 1.2.1. Synthetic preview is not full AC-60, and payment setup
does not prove AC-61 or AC-62. See the design's complete acceptance matrix.

## Packet verification and handoff

Fresh documentation verification: a local Python check passed with three
documents, 15 relative links, seven cited REA IDs present in the private bundle,
12 requirement/scenario references and 11 SS acceptance rows. The private bundle
SHA-256 matched this ledger. Removing only this session's roadmap paragraph
reproduced the pre-existing roadmap hash; the prompt hash was unchanged.
`git diff --check` exited 0. An independent read-only review found a possible
process cycle in the category completion wording; the design/packet now state
that merged approved A–E tickets unblock 1.1.2 while integrated category
acceptance follows there. Its alert integration mapping was corrected to 1.9.2.
This pass changes only this evidence, the independent design, ticket packet and
an appended roadmap research-status note. Pre-existing roadmap/prompt work is
preserved; no branch switch/reset/stash/commit/worktree was used. No issues, PR,
push, merge, deployment or live-data activation was authorised or performed.

No application lint/Knip/typecheck/unit/integration/browser suite/production
build is claimed for this documentation-only packet. They remain explicit
implementation-ticket obligations. No implementation delivery timing entry is
created because implementation has not begun. No running Settings review route
or implementation acceptance is claimed. Owner review should assess the ticket
breakdown and named open policy inputs before publication/selection.

## Subsequent approved delivery

The preceding handoff describes the initial documentation-only checkpoint.
The owner subsequently said “pls proceed”, authorising the concrete packet's
publication and selected first implementation. Issues #84–#88 were published
with native blockers; #84 is being delivered on `codex/shop-profile-history`
after its direct blockers merged. See the separate
[implementation evidence](Shop_Profile_Implementation_Evidence.md) for fresh
application checks, the running synthetic review host and outstanding gates.
This later work adds no competitor observations and does not turn the bounded
unknowns or unverified Nool draft cleanup into observed behaviour.
