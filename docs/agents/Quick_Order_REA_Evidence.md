# Quick Order: bounded REA evidence

19 October 2026. Roadmap **1.2.1**. Research status: **secondary inspection and authenticated Nool synthetic
save/reopen investigation completed within the limits recorded below**.
The initial blocked-connection section is historical; the resumed ledger supersedes it.
This is research evidence, not Aarili acceptance or competitor backend proof.
See the [independent design](Quick_Order_Design.md),
[ticket packet](Quick_Order_Ticket_Packet.md) and
[delivery status](Quick_Order_Implementation_Evidence.md).

## Initial targets, connection and privacy (historical preparation)

Requested primary: Nool live Orders → New tailoring order and our synthetic
saved order, starting at <https://app.nooltech.com/login>. Existing research
profile: `%LOCALAPPDATA%\Aarili-REA\nool-research`. The directory and installed
Chrome executable were present. Fresh REA `list_browser_targets` against the
previous `http://127.0.0.1:9226` returned `provider_unavailable`,
`endpoint_unreachable`; no current target was discovered. The historical target
ID was not reused. No Chrome process with the dedicated debugging arguments was
reported by the bounded process query.

Reopening that profile through `Start-Process`, with hidden window handling and
the prior CDP port, was rejected by automatic approval review: **“blocked by
policy”**. No more specific reason was supplied. The command did not execute;
the agent did not retry its effect through another transport or change browser
configuration. A private browser-reopening/sign-in request was presented to the
owner. No password, OTP, cookie, token or auth storage was requested in chat.

T3 `preview_status` initially reported unavailable; `preview_open` succeeded.
The T3 default profile reached Nool role selection, with an unauthorized session
refresh visible in request metadata. This is a different browser profile and
does **not** prove expiry of the closed dedicated research profile. A separate
REA temporary profile captured the ordinary Nool login form, solely to record
the accessible boundary; it does not inherit the research login.

Exact secondary targets: <https://tailorman.in/demo/new-bill.html> and
<https://tailorman.in/demo/bill.html>. T3 preview inspected New Bill; REA used
declared launch scenarios for reproducible evidence. Chrome reports
**155.0.8059.80**; scenario provider `rea-playwright-browser-scenario`, version
`1`. Vendor app build identity was not established. No APK or shipped client
code analysis was needed. The displayed demo tour initially selected Malayalam;
that incidental tour preference is not a Tamil or English accessibility result.

Scenario calls were sequential on each target. There was no overlapping passive
capture or user action. `service_workers: allow` reused the prior capture lesson.
DOM was requested only for initial New Bill structure; accessibility/URLs were
used for focused interactions. Network header values, request/response bodies,
storage and script sources stayed off. No Save Bill, payment, share, production,
photo upload or real-message action was executed. Temporary browser cleanup
reports `terminated-owned-process` for all five successful scenarios.

## Executed evidence ledger

IDs below are returned by REA, not analyst-generated labels. All five scenarios
report complete coverage of their declared artifacts; that does not imply full
application coverage. Invalid tool-schema attempts executed no scenario and
received no Evidence ID.

| Label | Actual REA Evidence ID | Observed scope |
| --- | --- | --- |
| TM-new-desktop | `ev_fa3bcdbe8b8945366d05ed6d2fd61602881e8c3ab472e1d2dfd2908918938c4c` | New Bill at 1280×800, settled initial DOM/accessibility/URL; sample customer, garment rows, dates, price, optional details and payment/bill controls. |
| TM-disclosure-phone | `ev_8d70e3736ba552a7643b2e49103338bda34caee584ec86ea00c5aa376959970d` | 360×800; pause tour, click collapsed item-details control, click Express, open discount/notes disclosure. |
| TM-detail-tablet | `ev_264d231d030b89d96383e606f7b0224e5263187985b6802f4590f580adfec33e` | Bill Detail at 820×1180; pause tour; readable sample identifier, date, item/stage and commercial summary. |
| Nool-login-boundary | `ev_5fae8ca6fbbf0cea1029d67f4a24c6406139eaeffc51ff2b5f2f014e35ef475e` | Temporary profile at exact `/login`; ordinary email/password sign-in and Google option. No research-account workflow observed. |
| TM-cancel-desktop | `ev_79f48296df2d74a524b03b3af1ac5bb37313bc37258ba38caf77bf18411812ad` | 1280×800; pause tour, Change customer and + Blouse clicks, then Cancel navigates to demo dashboard. No Save action. |

Private retained bundle, outside Git:
`%TEMP%\aarili-quick-order-rea-20261019-evidence.json`.
Export returned **5 records, 111,386 bytes**. Its zero registered unknown records
is tool metadata; the substantive unknowns below remain open. Do not commit the
raw DOM/capture bundle or copy its sample contact data into fixtures.

## Initial observations

**TailorMan New Bill:** customer search is labelled name/mobile, with a selected
customer chip and Change/New controls. Given and Delivery dates, an Auto bill
number placeholder and Express checkbox share the header. The initial sample
contains two blouse units and another garment row; we did not manufacture a
single-blouse save from this multi-row sample. Item type, quantity and rate sit
beside a calculated-looking total. The first item's details show an optional
measurement selector labelled for self, a measurement summary, new-measurement
link, optional item note and photo affordance. The other item's detail control
is collapsed. A quick-add row includes Blouse.

The phone scenario successfully dispatched the item-details click, but the
captured tree remained collapsed. Express became checked; the hidden surcharge
field did not appear in the captured tree. The native discount/GST/notes
disclosure opened and exposed its inputs. These are bounded UI observations:
no successful dynamic item addition or functional surcharge calculation is
established. In the separate desktop scenario, Change and + Blouse clicks left
the captured sample unchanged. Cancel then navigated to `dashboard.html`.

The summary combines subtotal/total, advance, balance and Save Bill. We did not
press Save Bill to establish validation or persistence in a shared demo. No
explicit “to be quoted” control or draft-resume list was exposed in these
captured trees; absence here does not prove absence in the production product.

**TailorMan Bill Detail:** a readable sample bill identifier heads the page.
Material Date and Delivery Date, total/paid/balance and item-level stage labels
are visible. PDF/Share and Record Payment/Assign to Tailor/Mark Delivered are
present but uninvoked. The static bill detail has different sample dates/items
from New Bill. Opening it is not evidence that the new form saved or reopened.
Original-versus-current promise history was not exposed by this bounded view.

**Nool:** only login/role-entry access was observed in this investigation.
The marketing page named in the brief remains public context from the prior
owner-provided local readiness review, not fresh live-order
evidence. Prior Settings/Garment Masters findings are not promoted to order
workflow observations.

## Inferences and independent decisions

- A compact identity/date header and progressively disclosed item details may
  reduce intake scanning. This is a design inference; no task-time benefit was
  measured. Aarili uses its own six-group flow and incumbent components.
- The sample's measurement-for-self label suggests a useful wearer cue. It does
  not establish a separate wearer model, permission or guardian enforcement.
- Combining bill/payment and production controls is visible in the demo.
  Aarili's order, agreement, money, property and production dimensions remain
  separate under the product plan. No vendor API contract or implementation is
  copied.
- No screen or selected request establishes schema, forced RLS, transactional
  locking, idempotency, immutability, retention or backup guarantees. Aarili's
  own real-PostgreSQL tests must prove those properties.

## Initial unknowns and primary follow-up (superseded where observed below)

| Question | Current evidence | Required permitted follow-up |
| --- | --- | --- |
| Nool existing customer and correct wearer selection | Unobserved | Rediscover reopened research endpoint/target; create no duplicate identity. Use one existing synthetic adult/self wearer and one blouse. |
| Garment/date/priority/price and optional details | Unobserved in Nool; sample layout only in TailorMan | Capture live minimal input, optional sections and selected measurement/wearer cue; do not enter measurements or upload photos. |
| Missing/invalid fields, unknown versus explicit-zero price | Unobserved | Test normal supported validation on the synthetic Nool form; no backend fault injection. Do not save public demo state. |
| Cancel, navigation/reload and incomplete drafts | TailorMan Cancel navigation only | Capture Nool dirty cancel/navigation and any offered draft save; deliberately finish or discard test drafts. Do not equate lost unsaved values with a server defect. |
| Save, identifier, reopen and edit | Static detail only; no linked save | Save one clearly labelled synthetic blouse order in our account, reopen by its actual identifier, verify values after reload. Record unavoidable effects and deliberate cleanup without erasing history. |
| Lost responses, retry and stale/conflict feedback | Unobserved | Report only naturally observable supported feedback. Do not disrupt vendor servers; prove Aarili failure paths locally. |
| Backend guarantees and policy correctness | Not established | Remain unknown for competitors; never fill this gap with demo or marketing claims. |

Primary research is an explicit outstanding task, not a reason to invent product
behaviour or block independent design. Resume it when the dedicated connection
is restored. No synthetic Nool order was created, no test draft remains open,
and there is no vendor persisted fixture to delete from this session.


## Resumed authenticated Nool investigation ? 19 October 2026

The owner reopened the dedicated research Chrome profile and opened Custom
Tailor Order after automatic approval review rejected the agent-driven opening
capture with ?blocked by policy?; no more specific reason was supplied. That
rejected action was not retried through another transport. Subsequent declared
customer/items/measurement/order scenarios used the owner-opened target.
Fresh discovery returned target `93D2CB8BE7B7DCA1B74C012717E614FE`, CDP 9226,
Chrome 155.0.8059.80, signed in. No private sign-in or credentials were needed.
REA MCP was absent from the active catalog; the aligned 6.5.0 CLI was used.
No installation, configuration repair or native engine was required.

Raw Evidence JSON remains outside Git in `%TEMP%/aarili-quick-order-live/`.
Header/body/auth storage capture stayed off; sources were not collected or copied.
Discovery and passive inspection may include script identity metadata, not code.
Each scenario navigates to its start URL; only the declared save scenario created
an order. It was never replayed after success. Initial locator/schema failures
are preserved as incomplete evidence, never described as completed actions.

| Scope | Actual REA Evidence ID | Result |
| --- | --- | --- |
| Closing rediscovery | `ev_937e6993253f14ec7634f25d67db814268ac3b6618897dfb3ba726b3b32a2fc4` | Existing research target rediscovered; retained CLI record. The initial discovery ID was observed but its raw record was not in this retained bundle, so this row uses the fresh retained observation. |
| Orders | `ev_878330477370a3dae633885e02824ca20685aa50912fe18a08a428dd92c77b54` | Live Orders/Create Order. |
| Chooser | `ev_f5b91b6b8a14382c0f8417b469a282988470ada08a84677a6ce3fb23983a6dc2` | Custom Tailor Order choice. |
| Owner-opened form | `ev_aeffb69e05e8b68540a0586c414e68bcab75dd53a6e1e4bd40154168ec90f594` | Actual `/orders/new/tailor`; customer creation dismissed, no duplicate customer created. |
| Existing customer | `ev_174d6db3d214efaa0a6f76d068b98bf1de4d9e8cea4a476c41f82cc6b076c050` | Existing synthetic customer, no measurements initially. |
| Items/DOM | `ev_38a41a8ecc6b9cb19a7120b041695c722b5e2af994257c21dacbd2f367230bdf`, `ev_effa8f5142e0806a7c59300f75237477bb93b606cf33f4f16ea4ab6e5d521a80` | Date, quantity, price, instructions and garment control. |
| Garments | `ev_5c4ccea8278dc2cb99f66b66441fb4efaf59d93b3051551ebb1af21aefe772cd` | Garment options including Blouse. |
| Missing measurement | `ev_1705527d4f76b5c5c22a11f2986e791e488c9ccefc98469563f4026148523103` | Review click failed/disabled; link measurement required. |
| Measurement editor | `ev_59a90bc97df70bdf7ed6e77271f93e079fb860eddb5c44e53b3631429ce07bdb` | Profile label, units, nine value controls, notes. |
| Incomplete attempts | `ev_1f0ddae71b5e071f6b24021f87478cce9206f3af8a392e18dd64ae076628a537`, `ev_afde2ad5e08eeecb06d66f5f9efbee0ddb2eddeba906f3734c47480e3482dc5e`, `ev_37b6a91403a65e6b82706668a99803eac744bf6e7882524f5f8e14e17ef6f787` | Continue/Cancel timeouts; subsequent steps unexecuted. Slower customer selection exposed automatically opened measurement editor. No save in these attempts. |
| Fresh form | `ev_509b9c9f1aeac2d1836a2729d8c9481c01a2eb92690512d6275d8f92517956d6` | Navigation starts a fresh unselected intake. |
| Minimal synthetic editor | `ev_84207e6be75c41b8225cf563d3efc9fa1a06b52ba39b5608560a1d243d6f447c` | One invented bust value and explicit research-only profile/notes enabled Save Measurement. |
| One synthetic measurement saved | `ev_09b0b2b2f15e8d953529d0659b7fc71bb9181cc9e98090c5468d47f41fdb6c04` | Customer now shows one measurement on file. No real measurement/person/photo used. |
| Reuse saved profile | `ev_979ba4ce683aa222e2515357f7bbd08d848a00bacfc2dbb6274448ab988a7324` | Saved Blouse v1 and reuse action. |
| Blouse link required | `ev_3863a6f6d11516ae2e39dc25a2670880f4b04a120372858fd6cd4e84beea9e4d` | Must select the synthetic profile for the item. |
| Blank/zero price | `ev_96692f093685f29951f7e5b684462031b84807b7e87d9a9ecf485fef97319f53`, `ev_ae36c8152cf1f6d634c3d93681dba9fe1f7fcc7c7b12131a20aa3e85d4f67c76` | Blank Review timed out; explicit 0 rendered blank and Continue remained disabled after linking profile. No ?to be quoted? observed. |
| Review positive price | `ev_a748d08bd9146326714b5dd67bd5f44ad32c26806885b4c6c0925d8fb90b4335` | One blouse, ?100, 20 November 2026, Normal/Urgent, linked profile, notes, discount/advance controls. No payment entered. |
| Save exactly once | `ev_d6b4de9817d88b9f07003882f8ad9b44884f0c3c700941a98ee2d013cf4d1a6f` | ?Order Created!? observed. |
| Saved list | `ev_1b4e0d06d8c4dff5272bbdca54f5bc2af881a29f5934033803b9dad4bc1db739` | Exactly one synthetic order: **ORD-20261019-001**, blouse, Pending, ?100. |
| Reopen details | `ev_aa86a732806d99446a57e3e552a1b4836483fa79eea0462b54d139f454de4eea` | Same ID, customer, quantity/price, research notes; no workers/payments/attachments, zero changes. |
| Reload and edit | `ev_6117acf74406e6faa33aa8ced2939fdf02fa7096c6651cf6a04c1dafac5fbf65` | Direct saved URL reload then Edit Order shows delivery 20 November, original notes and advance zero. |
| Discard edit | `ev_62b177f1ff1d01a7c6d27b0b1ebb36d15ec05aa892b8ab466853d1539ec952c2` | Typed a distinct unsaved note, Cancel returned to original detail/notes and zero recorded changes. |

### Observations, inferences and remaining unknowns

**Observed:** Nool separates Customer ? Measurements ? Items ? Review. Existing
customer selection may open the measurement editor automatically when none exists.
The profile/member-name label distinguishes measurements under the customer;
no independent authorised-wearer/guardian selection was exposed. Blouse required
linking a profile and positive price for this path. Date and notes survived save,
direct reload and reopen. Review has Normal/Urgent and payment-like controls;
none of the latter were invoked. Saved details expose Edit Items, Edit Order,
Clone, Repeat, Cancel, Invoice and Update; only Edit Order/its discard were used.
No explicit draft save/resume affordance appeared in the captured flow. Repeated
start navigation discarded unsaved form state and did not add orders. This is
not proof that Nool has no other draft capability.

**Independent inference/decision:** compact intake and progressive optional detail
remain useful cues. Aarili keeps identity authority separate from measurement
labels, supports incomplete server drafts, quoted zero and unknown price, and
separates draft save from atomic booking. A does not add measurement capture;
the single invented Nool measurement was an unavoidable research fixture, not
permission to advance Aarili?s later measurement slice.

**Unknown:** vendor server idempotency, RLS, capacity locking, immutable snapshots,
backup/retention guarantees, retry/conflict semantics, original/current promise
history and other draft routes. No vendor fault injection was attempted. Backend
properties must be proved by Aarili?s own tests. We did not send messages, record
payments, issue an invoice, assign workers, upload files or advance production.
The one clearly labelled research order and its one fake measurement remain in
the research account for traceable review; no history was erased. The form is
closed at saved details with no unsaved edit. Cleanup of that retained fixture is
a deliberate later account action, not an implicit destructive step.
