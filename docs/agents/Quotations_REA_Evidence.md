# Quotations: REA observations, documented claims and gaps

24 October 2026, approximately **06:55–07:02 UTC**. Roadmap **1.4.1**,
FIN-01–04. Bounded research under the [brief](Quotations_REA_Prompt.md),
reverse-engineer-anything skill v42 and its browser/runtime-observation guide.
This research informs [Aarili's independent design](Quotations_Design.md);
it does not establish competitor internals or approve shop policies.

## Targets, access and methods

**Zoho Invoice:** public India [Quotes help](https://www.zoho.com/in/invoice/help/estimate/)
was fetched on 24 October 2026. T3 preview opened `https://invoice.zoho.in`,
which redirected to the public India Invoice landing page, not an authenticated
quote workspace. The rediscovered dedicated CDP browser exposed no Zoho page
among the selected exact Zoho/Nool origins. This is bounded access discovery,
not proof that the owner has no Zoho account or authorized profile elsewhere.
No account/organization/trial, credentials, integration or email setting was created.
Authenticated quote creation/reopen/revision/PDF behaviour remains **unobserved**.

**Nool:** the existing dedicated synthetic research browser was found by fresh
local process inspection: loopback **http://127.0.0.1:9226**, profile
`Aarili-REA/nool-research`. REA discovered target
`24B7D98C87FC7D418A227E247106C790`, Chrome **155.0.8059.86**, CDP **1.3**,
initially on saved synthetic **ORD-20261022-001**. Attachment state was unknown.
REA's passive observation succeeded before any navigation and exposed that
saved page. The test customer and prices are synthetic, not approved rates.

T3 preview initially opened Nool and read the authorized dashboard with the
synthetic order activity. Its separate profile/session is not proof of a REA
connection. After navigation to the saved order, two snapshot attempts returned
**`Preview automation snapshot timed out after 15000ms.`** Earlier public-Zoho
snapshot returned only bounded text; it supplies no account-access evidence.

An explicit REA connected scenario attempted known-order navigation, settle,
Edit Items and settle, with accessibility/URL only. MCP failed with
**`execution_failure`**, reporting **“Scenario navigation failed before the
initial state was captured.”** It completed no action steps. Do not claim it
clicked Edit Items. Cached **rea-agents 6.5.0** CLI doctor found Codex registration
and skill aligned; audit-wide unhealthy results concerned unrelated missing
native engines/another client's configuration and did not diagnose this browser.
No setup, reinstall, native engine or registration repair was performed.

One CLI transport fallback was attempted. PowerShell's `npx.ps1` execution-policy
error was corrected by using the existing `npx.cmd`, without changing policy.
The first JSON input had a PowerShell-generated UTF-8 BOM; the CLI explicitly
rejected it. Saving the same input without BOM corrected that input error. The
connected scenario then returned the same `execution_failure`; further unchanged
attempts were stopped. Failure captures are not successful observations.

Fresh REA rediscovery then showed Nool's role-selection page. After the two T3
snapshot failures, the installed **agent-browser** fallback (own named session
`aarili-quotes-20261024`, attached to the existing CDP browser) read that page and
clicked **Tailor / Staff** only. The resulting page required email/password sign-in.
REA independently observed those sign-in controls. No credential was entered,
storage/cookie/token extracted, sign-in workaround attempted or financial action
performed. This proves that editor access was unavailable at that later check;
it does not prove the exact cause of navigation failure or token expiry.

No competitor data was saved/edited, no payment/acceptance/invoice conversion,
message or print action was performed. Initial saved order had no unsaved draft;
the research browser was left at sign-in without a draft. No competitor code,
price list, template, graphics or raw DOM was copied into the implementation.
Scenario inputs/error captures are outside Git at
`%TEMP%/aarili-quotations-20261024/`. Passive records remain in the REA evidence
ledger under the IDs below. Browser action fallback is not described as REA action.

## Runtime evidence ledger

| Local ID / REA evidence ID | Operation, observation and limit |
| --- | --- |
| Q-R01 / `ev_457ff297ed64b9f3c7cd976bc2f558d9e56e1aca65e737312fa877cd5cf693c9` | Exact-origin target discovery: existing Nool saved order, Chrome/CDP identity, unknown attachment state; no Zoho target among selected origins. Not an exhaustive account inventory. |
| Q-R02 / `ev_3aec5d6b9dca03958658b0b1deb158246d74d1a00b445fdd1457ef3378efab4c` | Passive inspection **06:56:10.767–06:56:11.180 UTC**, 300ms requested window. Saved blouse row, quantity 1, price ₹100.00, line total ₹100.00; column labels GARMENT/QUANTITY/PRICE/TOTAL. Edit Items, Edit Order, Clone, Repeat and Invoice controls present; none invoked successfully by REA. |
| Q-R03 / `ev_dbcf63580959d815ade85d3b9314d5690bccddea5048907984a3408aa011407c` | Rediscovery after failed scenarios: same Nool target now at `/auth/role-select`. Navigation side effect observed; its cause/authentication internals unknown. |
| Q-R04 / `ev_458acf113b9bd688274fc137720c4cc57f15ccd78b283e2e784dcd584e34f5f6` | Passive inspection after agent-browser's role click: `/login`, Welcome back, Email/Password, Sign In, Continue with Google. No private sign-in performed. |

Q-R02 also showed order/payment summary and Record Payment controls. Their
presence is not a quotation workflow or evidence of verified funds/revenue.
Raw headers/bodies/storage values, console text, script sources and WebSocket
shapes were not requested. Passive records are policy-filtered and attach-limited;
they cannot recover prior network activity or establish calculations/transactions.
Failed scenarios selected no event families or request/response/header capture.
No successful editor action, changed-value persistence or downloaded vendor PDF
is asserted. Q-R04 observes controls after an agent-browser action, not a REA click.

## Public documentation ledger

The following are vendor claims retrieved today, **not runtime verification**.
Paraphrases are bounded; no vendor wording, template or pricing defaults adopted.

| ID / primary source | Documented claim and research boundary |
| --- | --- |
| Q-D01 / [Zoho new quote](https://www.zoho.com/in/invoice/help/estimate/new-estimate.html) | Customer and quote/date/expiry fields; selectable item with quantity and stored rate, editable rate, amount/percentage discount, notes/terms/template choice and save-as-draft. Documentation also permits editing a sent quote and resending. This does not demonstrate immutable stored revisions or fractional-money behaviour. |
| Q-D02 / [Zoho managing quotes](https://www.zoho.com/in/invoice/help/estimate/managing-estimates.html) | Lists quote states/filters and PDF download/print actions. No downloaded artifact, old-byte comparison, Tamil rendering or account permissions were tested. |
| Q-D03 / [Zoho acceptance](https://www.zoho.com/in/invoice/help/estimate/estimate-accept.html) | Describes customer-portal acceptance and manual recording of verbal/email acceptance after sent/marked-sent. No acceptance was recorded. Aarili Phase 1 adopts no portal or automatic conversion, and its exact-revision response seam is its own design. |
| Q-D04 / [Zoho other actions](https://www.zoho.com/in/invoice/help/quote/other-actions.html) | Documents editing, marking sent, PDF, print and cloning controls. Presence of those help instructions is not a successful lifecycle/immutability observation. |
| Q-D05 / [Nool guide](https://nooltech.com/docs/) — Order Management | Describes garment rows with quantity/price, order editing including discounts/pricing, and separate design instructions on job sheets. The observed saved row corroborates garment-level context only; no quote-specific workflow, effective rate book or immutable quotation revision was established. |

Initial guessed Zoho detail URLs were inaccessible; discovery followed the
overview's actual links to the sources above. No conclusion is based on the
failed URLs. Tax/email/portal/payment/conversion features mentioned in public
help remain outside Aarili Phase 1 and were not exercised.

## Observed versus inferred versus unknown

| Question | Classification and result |
| --- | --- |
| Saved garment quantity/rate/total context | **Observed**, Q-R02; one synthetic blouse row. Not calculation validation. |
| Nool order editor quantity/discount/missing-price behaviour | **Documented in part**, Q-D05; editor runtime **unknown** after access failure. An exposed Edit Items control does not prove its form behaviour. |
| Zoho draft/review/copy/terms/PDF/manual acceptance | **Documented only**, Q-D01–04. No authenticated scenario/artifact available. |
| Missing price vs zero, incomplete-save/reopen semantics | **Unknown vendor runtime**. Aarili must implement/test its own explicit states and recovery. |
| Package inclusions and duplicate charging | **Unknown vendor runtime** in this bounded pass. Aarili's own immutable package/service identities are authoritative for implementation. |
| Effective-dated owner-approved rates and historical price preservation | **Unknown vendor implementation**; no claim from a saved row/help screenshot. Aarili proposal QD-01/07 is independent. |
| Cost/margin separation, exact rounding/allocation | **Unknown vendor internals**. No database, RLS, arithmetic, audit or transaction inference from UI. |
| Tamil A4 artifacts and byte immutability | **Unknown vendor runtime**. Aarili's existing renderer foundation is not evidence that the future quote template passes. |
| Aarili decisions | **Analyst proposal** in QD-01–12; require owner review and independent implementation tests. |

Runtime investigation is **partial**. Further vendor editor observation needs an
already authorized synthetic sign-in/session; no new subscription or account is
required for this packet. The remaining gaps do not justify inventing success
or blocking the independently specified estimate/quotation design.
