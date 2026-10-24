# Payments 1.4.2: REA evidence and limits

24 October 2026, approximately 16:34–16:50 UTC. [Brief](Payments_REA_Prompt.md),
[independent design](Payments_Design.md), [ticket packet](Payments_Ticket_Packet.md).
Observed UI is not proof of receipt verification, SQL locks, RLS or atomicity.

## Targets, method and safe boundary

Primary: existing owner-authorized synthetic Nool account at
<https://app.nooltech.com/login>, public <https://nooltech.com/docs/>.
Secondary: <https://www.zoho.com/in/invoice/help/invoice/payments-received.html>.
No account/organization/trial/gateway or API credential was created. No competitor
source/assets, payment submission, edit save, message, PDF, transfer, statement
import or bank application action was performed. Only existing synthetic orders
were opened. The account's existing research notes explicitly identify synthetic
data. Notification suppression was not established, so no financial save was safe
to exercise. This limits save/reopen/retry conclusions below.

T3 preview opened the login page but snapshot repeatedly returned the raw error
`Preview automation snapshot timed out after 15000ms.` Status later showed sign-in
at `/`; preview still could not inspect it. Local process discovery first found
the older dedicated Chrome loopback 9226 profile `Aarili-REA/nool-research`, signed
out. After the owner's private sign-in, fresh discovery found the dedicated
headed `Aarili-REA/nool-measurements` Chrome on loopback **9227** and REA enumerated
its authenticated target **BC7DCC9EE6DCF899E0A4916752551B3D**. No session/cookies
were copied between profiles or logged.

REA passive inspection works. The scenario tool's abbreviated exposed action
schema omitted nested details; two rejected argument shapes performed no action.
Installed schema inspection supplied `action`, `step_id` and role locator. A valid
Finances-click scenario returned **execution_failure**, non-retryable, with no
Evidence ID; post-failure passive inspection still showed dashboard. Do not claim
that scenario succeeded. Read-only `npx.cmd -y rea-agents@6.5.0 doctor --client
codex --json` passed selected Node/registration checks, without resolving the
scenario error; unrelated native engines are absent. Initial `npx` was blocked
by PowerShell script policy, corrected by using its `.cmd` launcher. No setup,
installation/configuration repair or engine addition was performed.

Following the documented browser fallback, installed agent-browser used named
session `aarili-payments-rea`, CDP 9227, snapshot refs, click/open/close only. REA
then passively captured the resulting states. **agent-browser performed actions;
REA observed them.** No claim that passive REA clicked or captured prior requests.
Request/response bodies, headers, script sources, console text and storage captures
were not enabled. Tool responses are local-session evidence; this sanitized ledger
retains IDs/observations, not raw page captures or personal account details in Git.

## Observed Nool evidence

| ID | Action/state | Observation and boundary |
| --- | --- | --- |
| `ev_73a79b9bc6908338a3f676c3f73718fabdc91e1ca0e703194af5230919b23885` | Enumerate 9226 | Older page was at login; this did not prove the account unavailable elsewhere. |
| `ev_019d79476adeac0faac7638873a1db92b56fc5c9f3ca128b6f98bd357f802488` | Passive login inspection | Sign-in fields, no authenticated payment workflow. |
| `ev_1516735c674b85c23a4b3f836559b07ea006f26d436e60b7a08051914468be6a` | Fresh 9227 discovery | Authenticated page at `/`, correct dedicated browser target. |
| `ev_9087206000f35bdf97f48ad7b6a28107f6c2b5f103d24bd97e03f59b92f9ace1` | Passive dashboard | Finances link and Payments quick action; existing synthetic order activity. |
| `ev_8f035f56423ef2de93ce7bdb0392280fa2f80dbe83d06295be0896a0d0fdf231` | After failed REA scenario | Still dashboard, not evidence of a successful action run. |
| `ev_7451737c369dc6707f275ca07a3468633329c6b1e99321b91c5e4b13b632939c` | agent-browser Finances link, passive `/finances` | Payments tab, order/customer/date/status/total/paid/balance table. Four synthetic orders; total 800, collected 0, pending/balance due 800. This pending label described unpaid balance here, not proof of a reported-payment verification queue. |
| `ev_acf0d2921577cc136f841613bbc3a24b2d0fdac9085bc6a3bca0dafc3c9c7f50` | First synthetic row More Actions → Record Payment | Opened `/orders/…/edit`, headed Edit Order. Editable Advance Amount, discount, order status, delivery and Save Changes; total 100/advance 0/balance 100. This entry point differs from a dedicated receipt form. No edit/save performed; Cancel returned to Finances. |
| `ev_c716e6ec63f594f20a9d1cbf7de4f1641d9b128095de321c2b555fa135696cfd` | Open same order → detail Record Payment | Payment history empty; summary total 100/paid 0/balance 100. Modal has required amount, 50%/Full Balance, Cash/Card/UPI/Bank Transfer/Other, optional reference and notes, Confirm Payment. No payment-date or receiving-account selector was exposed in this modal. |
| `ev_121ab1f080002a1412fd9231e6db32ab175727873265b6b4318ad3346627c958` | Click 50%, then UPI; no submit | Amount became 50; UPI control focused; same optional reference and Confirm Payment, no additional bank-seen attestation/account chooser exposed. Amount control reported min 1/max 100. Cannot infer global range policy or server validation from control attributes. |
| `ev_fde2b309c935ed46e67f3b9340d10f88567bb9facf2acc5d50c8194d74ae486a` | Close modal and reopen in same page | Amount 50 remained in the reopened unsaved form. This is observed in-page retention, not durable save/reload/retry evidence. Closed again without confirming; no payment or order change saved. |

The synthetic detail still had no payment history and zero paid before opening
the unsaved modal. No submit means no observed settlement transition. The final
research state is the existing synthetic order detail with modal closed; the
owner's authenticated browser is preserved, not logged out or terminated.

## Documented claims, not observed application behaviour

**N-D1:** [Nool public product guide, Finances](https://nooltech.com/docs/)
describes order selection, amount/method entry and automatic partial/paid status;
it also describes advance/final transaction rows and order total/paid/balance.
It does not establish independent owner receipt verification or immutable journal
semantics. The observed Finances row action above opened an editor instead; do
not silently reconcile that difference as identical behaviour.

**Z-D1:** [Zoho Invoice receiving payments](https://www.zoho.com/in/invoice/help/invoice/payments-received.html)
documents offline and partial invoice payments, date/mode/reference/notes and
optional attachments. Its optional thank-you email can send on recording.
It describes full versus partial paid status and converting a draft invoice to
Open/sent before payment entry. Those are documented flows, not an observed
authorized Zoho session or Aarili agreement authority.

**Z-D2:** The same [Zoho help page](https://www.zoho.com/in/invoice/help/invoice/payments-received.html)
describes customer credit from excess receipts/credit notes, unused customer
credit and application to invoices. It also describes editing/deleting recorded
payments and removing applied credit. Aarili may adopt transparent credit
presentation, but its immutable history and governed corrections prohibit those
shortcuts. No existing authorized Zoho synthetic session was established in the
discovered research target inventory; no organization/login was created to fill
this gap. Zoho remains documented-only, including offline/partial/credit UI claims.

## Inferences and unresolved questions

- **Inference:** separating reported evidence from explicit receipt confirmation
  is necessary for Aarili, because the observed generic Nool Confirm Payment form
  does not demonstrate its account-bound verification requirement. Absence from
  this modal is not proof no other vendor verification flow exists.
- **Unknown:** Nool confirmed/failed/reversed states after save; split batch
  persistence; excess credit; UTR duplicate handling; same-key/different-key retry;
  source allocation/rounding and immutable journal. These were not exercised.
- **Unknown:** vendor locking/RLS/atomicity, server validations and bank receipt
  verification. Browser controls and synthetic data cannot prove them.
- **Independent Aarili choices:** exact FIN-05, deposits as liabilities, agreed
  source versions, retained excess credit, immutable corrections, unique UTR and
  transactional restore/idempotency safeguards derive from Aarili's product and
  architecture, not competitor claims or copied implementation.
