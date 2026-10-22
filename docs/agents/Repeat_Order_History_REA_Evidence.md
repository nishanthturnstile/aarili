# Repeat orders and customer history: REA evidence

21 October 2026. Roadmap **1.2.4** preparation, not implementation acceptance.
[Independent design](Repeat_Order_History_Design.md),
[ticket packet](Repeat_Order_History_Ticket_Packet.md),
[delivery status](Repeat_Order_History_Implementation_Evidence.md).

## Authority, target and capture boundary

Applied `reverse-engineer-anything` and its browser runtime guide. Nool web:
<https://app.nooltech.com/login>; public guide:
<https://www.nooltech.com/docs/>. TailorMan public tour:
<https://tailorman.in/product-tour/>, linking to `/demo/customers.html`,
`/demo/customer.html` and `/demo/bill.html`. Vendor application versions unknown.
Chrome **155.0.8059.86**, CDP **1.3**; REA `rea-cdp-browser` v2 and
`rea-playwright-browser-scenario` v1. These are tool/browser identities, not app builds.
Captures ran approximately **06:39–06:45 UTC**; exact per-record windows/actions
are retained in the private bundle.

T3 preview opened the default profile and established signed-in synthetic Nool
access. Its tab remained on the saved source detail. T3 and REA sessions were
independent; no cookies or authentication material were transferred. No private
sign-in, account creation, upgrade, APK, emulator or package installation was needed.

The dedicated research Chrome process was absent. The existing
`%LOCALAPPDATA%/Aarili-REA/nool-research` profile and installed Chrome executable
were verified. A hidden headless launch exposed loopback CDP port 9226. Initial
REA discovery found no HTTP page because the only page was a new tab. A second
shell launch with a Nool URL was rejected by automatic approval review with
`blocked by policy`. It did not execute. REA's supported scenario connected to
the existing blank page (ID discovered from the endpoint page listing), navigated
to the declared login URL and reused that profile's existing sign-in. Subsequent
REA origin-filtered discovery selected the actual Nool HTTP target
`121C3855C0C2138B8FEFFBE7DA622550`. Do not reuse that ID/port without discovery.
No approval rejection was bypassed through another shell or configuration change.

Scenarios captured accessibility and URLs. One passive Repeat inspection captured
value-free DOM structure and accessibility; one creation scenario requested
network metadata to distinguish submission from a UI-only click. Raw header
values, cookies, request/response bodies, storage values/keys/fingerprints,
script sources and console text were not requested. No competitor implementation,
asset or private customer data is copied into Aarili. Public demo names/amounts
are vendor examples, not business rates or Aarili fixtures.

Complete raw REA records, including research-account UI identity, remain outside
Git at `%TEMP%/aarili-repeat-history-rea-20261021/evidence-bundle.json`:
**17 records, 693,073 bytes** at final export. The exporter reports zero ledger
unknown records; that does **not** mean the research questions are all answered.
Scenario captures report overall `incomplete`, `missing_sections: events`, even
where all declared actions and selected accessibility/URL captures completed.
The phone cancellation failure additionally lacks downstream action/capture
sections. No complete event stream, backend transaction or equality claim follows.

## Evidence ledger

Actual REA Evidence IDs follow. UI observations are bounded to the recorded
synthetic fixture and capture window; passive capture cannot recover prior events.

| Evidence ID | Declared actions and observation |
| --- | --- |
| `ev_8079bd4b3cec6fadb71f80136a82c21b43c574ed6e4db42463137a6015c59f51` | Fresh endpoint discovery: Chrome version established; no eligible HTTP page yet. |
| `ev_3b11de4fc23424e5e86fb0ad0664c8d391e8c7c2dabeae8f0d8ac162da0a83db` | Connect blank page → login → 2s settle. Signed-in dashboard with two retained synthetic orders. External browser disconnected, retained. |
| `ev_51d929ef9ef02f2fa2bce8b86a787bad2214c68c83335efe5c12fedc72510fac` | Fresh Nool-origin target discovery. Attachment state unknown. |
| `ev_b9e99cf18d0b4916ece1519ee63bdf35fb49d4190b6d720dfdd4e5261bc0bd5d` | 1440×900: source detail → Repeat → settle. Pending source offers Repeat. Sheet shows both garment rows, quantity controls, carried amounts, empty date/advance/notes and Create Repeat Order. |
| `ev_d3b272d2689ed947940d09a5ca818f6c060b4addc3473e6595d804cf88155893` | Passive Repeat inspection confirms inputs and UI structure without scripts, bodies or storage. No additional interaction. |
| `ev_ff3849fb6a13e6b850f23efd42c48fe00f6cd0db13332f0a597201d2bd91eed2` | 360×800: Repeat → date 20 Nov → synthetic note. Cancel locator incorrectly assumed a second phone Cancel; 5s timeout. Later reopen/Clone actions cancelled, not executed. No submission. |
| `ev_feb9420da213075554b98b9e6059cdca0809b34fd5c7962550158dd3e3ca54fd` | Corrected desktop scenario recreates Repeat → enters date → cancels sheet → reopens with empty date → cancels → Clone. Clone confirmation lists both rows and ₹300; no editable date/price/customer in that confirmation. Clone submission not performed. |
| `ev_c4605befb77106e4b7f3b269782735e5466caf74c2d603bc9c4262a69dc2b9ac` | Repeat → new date 20 Nov → conspicuous synthetic note → Create Repeat Order → settle. UI success names ORD-20261021-001. Metadata records POST to source `/repeat`, response 201; bodies/headers values off. Source detail remains displayed. |
| `ev_f8b4846c19003916d66d7fbf85946d7c37a2a4d65024bb3e4722c18140b72915` | Navigate Orders → new order → View Full Profile. Three orders now listed; new detail reloads two rows ₹100/₹200, new creation date/note, Pending, no workers/payments/attachments. Profile initially Loading Dossier. |
| `ev_c60859ac88faeb4ed3635cf32092903a99e3161ad72bc8b2a78d2004ab35f9a0` | Passive settled profile follow-up: Customer Not Found / Return to Registry. A successful profile-history route from the repeated order is not established. |
| `ev_333082498cd89b45d2530b25290f2690b6cc963fafc68ac038429230a4db0d11` | New-order detail → Edit Order click. Immediate capture still detail; it alone does not establish the editor. |
| `ev_8563b5388d6e97dc66a2ed13e98785994b00d0b4c5e031ceaf5ab5be2ca7e901` | Passive settled editor: new order, delivery 20-11-2026, advance 0, both original prices and new note. No fields edited or Save Changes used. |
| `ev_00a3f9ae4fbb4e97d3a8429421b30940f3b0e67914a67c817c30553493beaaee` | First source-return capture still Loading Workspace. Not source-immutability proof. |
| `ev_76f8806fe686c9f048708552899879a131b65f4ff0632105400ad122f0248ced` | Corrected source-return waits for source heading then settles. Original -002 still Pending, ₹300, original two rows/note, no payments/workers/attachments and zero recorded changes. No editor left open. |
| `ev_9e61e5af823fd4296ff26114a4ea1b880ab51372e249a97f307fd5cb2697806d` | TailorMan 1440×900 customer list: name/mobile search control, four public sample rows with Open labels and saved-measurement context. Temporary browser terminated. |
| `ev_e514def93f6dd079143a16af337356eda4e6c8530c24c23d188dadcf05be55b5` | TailorMan 360×800: pause narration → first Open click → unchanged settled tree/URL → declared direct profile navigation. Profile has order/spend/due/measurement summaries, Bills/Measurements/Payments/Deliveries buttons, dated self/daughter measurement examples. Direct navigation is not proof Open worked. |
| `ev_c72fc8f4f8da7ee359162e2caf09858f40a84c8693675228a2a4f71b831c1eab` | TailorMan 820×1180: pause profile narration → Bills click → unchanged main content → direct bill URL. Bill shows item/measurement context, material/delivery dates, total/paid/balance and separate payment/assignment/delivery controls. No business action used. Temporary browser terminated. |

Schema-rejected calls (empty actions, guessed action discriminator/locator kind,
unsupported heading role) produced no Evidence ID and executed no scenario. The
installed tool schemas and local schema definition resolved them. The failed phone
Cancel was diagnosed once and replaced with the visible final sheet Cancel;
the next scenario deliberately discarded only our own unsubmitted test inputs
and recreated the relevant state. No pre-existing unfinished owner draft was touched.

## Observed, documented, inferred and unknown

**Documented:** Nool's [Repeat orders & cloning guide](https://www.nooltech.com/docs/)
describes repeating completed work with customer/items/measurements prepared and
cloning an order for modification. Its customer section describes profile history.
Those are vendor claims; the current web fixture contradicts a universal completed
prerequisite because our Pending source opened and submitted Repeat successfully.
The guide also includes Android screenshots, so platform differences remain possible.

**Observed:** Repeat's visible sheet starts with both old prices and empty date,
advance and note fields. A new date and note were entered, one repeat submitted,
and a distinct order persisted after navigation/reload. It has the same two prices,
new creation date and new delivery date in its editor. Cancelling and reopening
the sheet cleared the entered date. This does not establish durable draft support.
The inspected Repeat sheet had quantity controls but no exposed unit-price editor.
No selection/subset change was executed; both rows were intentionally retained.
Clone reached a whole-order confirmation only; its actual resulting fields remain
unknown. No source/new-order relationship was visible in the inspected new detail;
that bounded absence is not proof no relationship exists elsewhere.

Original source UI remained unchanged, including its zero change count. We did
not read its private database or hash its stored record; byte-level immutability,
tenant isolation, exact replay and transactionality are **unknown**.

**TailorMan documented:** the [public tour](https://tailorman.in/product-tour/)
advertises customer repeat history and a profile grouping measurements, orders
and dues. **Observed:** public sample surfaces provide identity, dated context
and separate domain navigation labels. First Open and Bills clicks did not change
the captured main content. [Customer list](https://tailorman.in/demo/customers.html),
[profile](https://tailorman.in/demo/customer.html) and
[bill detail](https://tailorman.in/demo/bill.html) were accessible directly.
Sample amounts/statuses do not establish saved records, linked navigation,
financial correctness, consent or wearer permissions in the actual product.

**Inference:** showing the source beside editable new inputs should help an owner
review reuse without confusing old agreements with new work. No time saving or
real-device usability benefit was measured. Aarili's defaults and policies follow
its own plan; Nool's copied price is deliberately not our new-price default.
Neither investigation establishes identity merges, aliases, sensitive relinking,
guardian controls, or private schema/tenancy guarantees.

| Research question | Coverage and residual gap |
| --- | --- |
| Find earlier work / repeat entry? | Answered for known Nool source and order list; TailorMan list/profile content observed, Open traversal unestablished. |
| Item selection and copied/reset fields? | Partial: two carried rows/prices, fresh date/notes, quantity controls; subset selection, measurements and Clone result unknown. |
| New price/date review? | Date persisted; prices carried, no Repeat price edit observed. No separate review step before submit observed. |
| Cancel/draft/retry? | Cancel/reopen date reset observed. Durable draft, reload recovery, lost-response retry and duplicate prevention unknown. |
| Acceptance/new identity/source preservation? | New repeat order reload and visible source preservation observed; backend invariants unknown. No Clone submission. |
| Source link/history? | No relationship visible in new detail; profile route ended Not Found. TailorMan Bills/Open unchanged. No complete unified-history traversal claim. |
| Same phone, minors, privacy, merge? | Unresolved in these bounded paths; no automatic-merge claim. |
| Three sizes/language/accessibility? | Accessibility trees at stated sizes only; no pixel/reflow, axe, AT, Tamil or physical-device certification. |

## Retained fixtures and handoff

Retained source: **ORD-20261019-002**, internal suffix `6ad6435cc81c57cf4ba421f2`.
One new synthetic order: **ORD-20261021-001**, suffix `6ad85e8979a72ff3c6f1774f`,
delivery **20 November 2026**, note beginning `REA REPEAT SYNTHETIC 20261021`.
Both belong to the pre-existing REA Test Meena fixture. No payments, delivery,
production, invoice, messages, media, assignments or cleanup deletion performed.
The dedicated research browser is retained on the original saved detail with no
unfinished editor. Launch-mode TailorMan browsers were terminated by REA.
Future runs must inspect current fixture/session state before navigation.
