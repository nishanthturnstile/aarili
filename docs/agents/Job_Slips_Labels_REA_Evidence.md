# Job slips and labels: REA observations and gaps

24 October 2026, approximately **02:52–03:03 UTC**. Roadmap **1.3.4**,
ORD-10/USE-07 and AC-64's job-slip contribution. Bounded observation under the
[brief](Job_Slips_Labels_REA_Prompt.md), reverse-engineer-anything skill v42 and
its runtime-observation guide. This is independent product research, not a copy
of vendor templates or evidence of vendor database/security guarantees.

## Sources, targets and method

- Primary: [Nool](https://app.nooltech.com/login), existing dedicated synthetic
  research account, order **ORD-20261022-001** and multi-garment
  **ORD-20261019-002**. Supporting public [Job Sheets guide](https://nooltech.com/docs/).
- Secondary: [TailorMan product tour](https://tailorman.in/product-tour/),
  [bill detail demo](https://tailorman.in/demo/bill.html) and
  [item types demo](https://tailorman.in/demo/item-types.html). This is
  tailorman.in software, not the tailorman.com clothing brand. No demo save,
  payment, delivery, assignment or share action was performed.

T3 preview status/open created a Nool login tab successfully, but two snapshot
attempts failed with **“Preview automation snapshot timed out after 15000ms.”**
No login expiry or successful inspection is inferred from those failures.
Per the browser fallback rule, the installed agent-browser CLI used its own
named session `aarili-jobslips-20261024`, attached to the existing research CDP
browser. No new account/profile, storage extraction or credential transfer.

Fresh local process inspection found Chrome with the existing dedicated
`Aarili-REA/nool-research` profile and literal loopback endpoint
**http://127.0.0.1:9226**. REA independently rediscovered Nool target
**24B7D98C87FC7D418A227E247106C790**, Chrome **155.0.8059.86**, CDP **1.3**;
attachment state was unknown. The initial passive observation confirmed the
known saved order page before any navigation. No owner draft was present.

REA MCP passive inspection worked. Its first connected action scenario failed
with `execution_failure` from `rea-playwright-browser-scenario`; it supplies no
successful scenario evidence. Read-only **rea-agents 6.5.0 doctor** reported the
Codex registration/skill aligned. Missing native engines and another client's
registration do not diagnose this browser failure; no setup/install was run.
The already-cached 6.5.0 CLI then ran explicit connect scenarios successfully.
This changed transport, rather than repeating the unchanged failing MCP call.
REA provider identities are `rea-cdp-browser` v2 and
`rea-playwright-browser-scenario` v1, not vendor app build identifiers.

REA scenarios captured accessibility/URL only with no event, body, header,
storage or source capture. Whole-scenario completeness is **incomplete: events**
by that selection; requested action/capture steps completed where specified.
Passive observations are attach-limited/policy-filtered, not complete traces.
No private schema, RLS, transaction, issuance or immutability claims follow.
CLI connect cleanup is `disconnected-external`; TailorMan's owned temporary
launch is `terminated-owned-process`. Raw JSON/scenario inputs are outside Git
under **`%TEMP%/aarili-job-slips-20261024/`**. No competitor code, graphics,
templates, raw account DOM, cookies or tokens are committed.

## Evidence ledger

| ID / REA evidence | Operation and supported result |
| --- | --- |
| JS-R01 / `ev_b6562fbf7db84a70393b41a35feff9d2526252722da44789c389f9ed563e5d04` | Fresh exact-origin discovery found the existing saved Nool order and browser/CDP identity; attachment unknown |
| JS-R02 / `ev_31fad6bc30d3194335f4ed76d7eca77d8857cdf11e029ee7e2002d77a96f2b26` | Passive order: one blouse row/quantity one, View Job Sheet, separate order notes and two existing synthetic attachments |
| JS-R03 / `ev_8e96a4a059ae61d2946a4b7a17387651e6b04dbb408593a0472ea54dc98f4ba8` | REA passive observation after agent-browser opened Technical Details: item reference, Print, Save Changes, three sections and saved revision-B construction note |
| JS-R04 / `ev_b6a8c4c0e9582ed3017920f71056d44671646ecf9fcb798e18f2e5ebd3553986` | Passive text-field inspection during a supplementary unsaved bilingual note exercise; no persistence inferred |
| JS-R05 / `ev_1dbd9eba918f08734a479443a8f575b2d307f7b8f4a3c1509944f4d1d99e0b74` | Passive two-garment order/salwar sheet: separate rows and item reference; no native top/bottom/dupatta identities observed |
| JS-R06 / `ev_76c45bb5ee7f1a4af6205e08561d1f9b098d0a783d964751552f2fe534e94b21` | REA CLI navigated known order, settled, opened sheet, settled and opened Technical Details. All **5** steps including start completed; original saved revision-B note visible |
| JS-R07 / `ev_36b3a06a757462f6766a12242834e0c53086564945dc2bed1dcb839962bfbbe5` | REA CLI: sheet/technical → fill long synthetic Tamil/English note **without saving** → Print → wait → reload/discard → reopen/technical → component list. All **12** steps completed. Reopened technical field contains original revision-B note, not the temporary text |
| JS-R08 / `ev_336e8f92f8c27a5807e30eedd45a560eae855b89ff930dbab2e20843a1facc63` | REA CLI known two-row order → salwar row's sheet → Technical Details. All **4** steps completed. Construction field is empty; no missing-instruction warning exposed in that captured view |
| JS-R09 / `ev_c371567ce17e60f42015d97e3a10de2155761d7b71b156659cf8cab4d2b69034` | REA MCP owned headless launch: bill detail/settle → item types/settle, all **4** steps completed. Read-only public demo; no PDF/share/save invoked |

JS-R03–05 actions were performed by agent-browser, with REA passive observation;
JS-R06–08 actions were performed by REA itself. These are distinct claims.
The failed initial scenario and supplementary tool failures remain in the raw
records and do not count as successful actions. One unquoted PowerShell `@e51`
argument was rejected before click; quoting the current ref corrected it.

## Observed, documented, inferred and unknown

| Topic | Classification | Evidence and boundary |
| --- | --- | --- |
| Nool garment-level job sheet | **Observed** JS-R03/06/08 | An order row opens a sheet with item reference and garment visual type, visual/technical/component sections, Print and Save Changes. One shared heading derives from order context; the separate item reference distinguishes the row |
| Notes | **Observed** JS-R06/07 | Order production note is separate from item construction note. Long bilingual temporary text can be entered; reload/reopen restores the original saved note. This is unsaved-discard behaviour, not historical versioning or PDF layout proof |
| Print action | **Observed control/action; output unknown** JS-R07 | Print was exposed and tapped. The next accessibility capture remained on the sheet. No inspectable native print preview, PDF download or cancellation UI was established in headless mode. No hardware printing occurred; no inference of nonfunctionality or lack of export |
| PDF/export/share of this exact Nool sheet | **Unknown** | No downloaded job-sheet artifact or explicit share action verified. Order attachment Download and Invoice are different controls, not proof of sheet export |
| Nool inline measurements/design preview | **Documented**, partially observed UI context | Guide describes garment options, silhouette, inline measurements and save. The inspected technical views did not establish an exact immutable measurement-version binding or included PDF fields |
| Missing references | **Observed empty input; policy unknown** JS-R08 | Salwar construction field was blank. No critical/optional asset readiness policy, render retry or missing-reference PDF outcome was exercised. Existing attachments are order-level, not proof of exact sheet associations |
| Multi-piece order | **Observed multi-garment**, native pieces **unknown** JS-R05/08 | Existing fixture contains blouse and salwar rows; each row has a sheet. This does not prove native top/bottom/dupatta piece IDs, independent progress or quantity expansion |
| Nool published Job Sheets guide | **Documented claim** | Item-level production specification, design/fabric choices, notes/components and inline measurement context. General invoice PDF/print/share documentation is not sheet-specific proof |
| TailorMan bill | **Observed** JS-R09 | Public sample bill contains blouse quantity two and salwar quantity one, measurement summaries, stage labels, money/contact context and PDF/Share controls. We did not invoke sending or download |
| TailorMan item setup | **Observed** JS-R09 | Garment types and typed measurement fields appear; configuration Save was not invoked |
| TailorMan production slip/material labels | **Unknown** | No separate production-card/label artifact established by these bill/item views. A bill containing measurements is not automatically a safe production slip |
| Independent Aarili design | **Analyst proposal**, not vendor fact | Exact version freezing, field allowlists, stored-byte identity, required-asset policy and audited erasure derive from Aarili's product/architecture, not competitor UI |

## Fixture discipline and closing state

Only the two previously identified synthetic Nool orders were opened. The
temporary bilingual construction note was deliberately **not saved**; REA
reopened the original saved revision-B note. No customer/measurement/pattern
version, order, upload, payment, progress, assignment, custody or handover was
created or changed. No real WhatsApp conversation, account purchase, APK,
emulator, subscription or hardware printing. TailorMan shared demo was read-only.

Closing cleanup returns the dedicated research page to the known saved order
without an unsaved form. Browser remains available; authentication was not
copied elsewhere. T3's failed preview tab remains a separate surface. The
implementation evidence records final cleanup and verification.

## Consequences for Aarili

Use a garment/native-piece entry and concise sections; make source identities
and document audience explicit. Keep a production slip separate from billing
and minimal labels. Preserve pattern-source limitations. Existing vendor sheet
controls do not remove the need for Aarili's immutable artifacts, scoped media,
failure/retry handling and privacy proof. Native print-dialog output, true
vendor PDF fields/bytes, mobile sharing, native piece semantics and vendor
history/security remain gaps. No further account/tool installation is required
to prepare the independent design and ticket packet.
