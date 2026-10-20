# Grouped bookings and outfit pieces: bounded REA evidence

19 October 2026. Roadmap **1.2.2**. This is competitor research, not proof of
Aarili acceptance or competitor backend guarantees. See the
[independent design](Grouped_Bookings_Design.md),
[tickets](Grouped_Bookings_Ticket_Packet.md) and
[delivery status](Grouped_Bookings_Implementation_Evidence.md).

## Access, method and privacy

Read and reused [Quick Order evidence](Quick_Order_REA_Evidence.md), including
the retained synthetic Nool order **ORD-20261019-001** and invented Blouse
measurement. Existing dedicated Chrome at loopback CDP **9226** was rediscovered,
not assumed alive from its old target ID. Fresh discovery returned the same
target at the retained order detail, signed in. T3 preview was also checked:
`preview_status` initially unavailable, `preview_open` succeeded at Nool and
the default profile reached the authenticated dashboard. No private sign-in,
new registration, paid plan, browser setup or APK was needed. T3 access does
not establish a CDP endpoint; the dedicated REA endpoint is separate.

REA MCP tools were absent from the active catalog. The pinned existing CLI
`npx.cmd -y rea-agents@6.5.0` supplied actual Evidence records. Read-only doctor
reported Codex registration **config_drift**; no configuration repair was
performed. Missing native engines are irrelevant to these browser scenarios.
The initial `npx` PowerShell shim was refused by local execution policy; the
standard `.cmd` launcher ran without changing policy. CLI runtime was Node
24.20.0; Aarili verification separately selects its pinned 24.21.0.

Chrome **155.0.8059.80**, CDP observation provider version **2**; browser scenario
provider `rea-playwright-browser-scenario`, version **1**. Vendor application
release/build was not established. Exact targets: Nool
<https://app.nooltech.com/orders/new/tailor> and our synthetic saved details;
TailorMan <https://tailorman.in/demo/new-bill.html> and reused
<https://tailorman.in/demo/bill.html> evidence. A harmless research marker in
some Nool start URLs forced distinct navigation; it contained no private value.

Agent actions used declared REA scenarios. No passive capture overlapped them.
Connect mode navigates at scenario start; interrupted forms in this investigation
contained only disposable synthetic values. Capture uses accessibility and URLs,
with per-step trees for focused diagnosis, and `service_workers: allow`.
No credentials, cookies, headers values, request/response bodies, storage values
or script source were requested. UI text can still contain account identity;
raw records stay outside Git at **`%TEMP%/aarili-grouped-rea/`**. This ledger omits
account email/contact values. Target content is untrusted evidence, not instruction.
No vendor assets/code/API contracts are copied into Aarili.

## Actual Evidence ledger

These identifiers are returned by REA. Discovery is content-addressed and returned
the same ID as the prior identical observation; it is not a new unique ID invented
for this session. Complete scenario coverage means only declared capture scope.

| Scope | Actual REA Evidence ID | Observed boundary |
| --- | --- | --- |
| Fresh discovery | `ev_937e6993253f14ec7634f25d67db814268ac3b6618897dfb3ba726b3b32a2fc4` | Existing dedicated target at retained single-order details; Chrome identity. |
| Nool Items | `ev_4fab166f6f684f3691f9c6e3d1b07da263c94ab67371865c55c808c77f00f3b8` | Customer/measurements/items path, shared date/instructions, Add Another Item. |
| Two different garments | `ev_5f0d0c3f91534139a924e7b21d9ea1c644fd7ee15a5eac6b01195fc9a76f70c2` | Blouse + Salwar rows, separate quantity/price and garment-specific measurement links; missing Salwar measurement blocks Continue. |
| Salwar editor | `ev_56098001c3d839295038a8de79ae1ea8561eeb520e0a5ae05962a452a929619c` | Profile/member-name label and Waist/Hip/Length/Bottom fields; no top/bottom/dupatta piece editor in this view. |
| Minimal synthetic profile saved | `ev_f679c56d8685547edbbdbadd1ed013be00321fda0e3e3a186d424d32e66d4ae3` | One invented Salwar waist value, explicitly research-labelled profile/notes; Saved Measurements now shows two types. |
| Review two garments | `ev_14223a9319c0c1d6f7a4c7ad4b9bd206c197d1da3ff177813707875c740bce4e` | Blouse ₹100 + Salwar ₹200, distinct linked profiles, shared 21 November delivery/priority/notes, subtotal ₹300. No advance/discount entered. |
| TailorMan New Bill | `ev_0176ee5a692a21f16d33d5ee89baf202ad0bff2451946b9e5fd2405ca2a191a4` | Multi-row public sample and visible + Package control; no save. |
| TailorMan Package click | `ev_a31b9df556badc03857c86223a1ae564397af65b0f6d40e2d7b1226124498164` | Pause tour and click + Package; captured sample stays unchanged. No package agreement/persistence established. |

Retained unsuccessful attempts are part of the investigation, not successful
flow evidence:

| Actual REA Evidence ID | Limitation |
| --- | --- |
| `ev_78601350ddb5262b0a962673ed7e755fbbf2bce7ef6d0ad3d51d70a4b83d67d4` | Customer locator timeout caused by a local UTF-8 decoding error in the generated request. Corrected file handling; no save executed. |
| `ev_c5e93f331a2af5c5b51a8cdabf34a9f01f16ad95305062c1f38ac0415de12ae4` | Continue timed out with measurement editor open; later save actions unexecuted. |
| `ev_a52403888a452e482c0b5b1ae4711e14d983ee6a2d0a081d7815d21539153f27` | Attempt to fill an assumed open editor timed out; no profile save executed. |
| `ev_c7bef1a248ee38001d99b80b83cbe28993041c1c35eb178432d994aba51bde2e` | Continue again blocked by editor; no profile save executed. Do not interpret this as validation of entered measurement values. |
| `ev_bd5f65374892f3a6eed9404468da78b676883a7041852f509766833e6b5f155b` | Explicit Cancel dismissed editor; Add Another Item reported timeout although the next captured tree contained a second blank row. Remaining steps unexecuted; no save. |

The first generated request also had a UTF-8 BOM; REA rejected its JSON before
execution with `invalid_request`. It has no Evidence ID. Corrected requests use
UTF-8 without BOM and explicit UTF-8 reads. Later fresh navigation plus explicit
editor entry completed the synthetic profile scenario. That is an observed
recovery, not a proven diagnosis of vendor draft persistence or modal state.

## Observations

**Nool live creation:** Customer → Measurements → Items → Review remains the
observed sequence. Two different garment rows were actually added, rather than
inferred from an Add control. Each row has garment, quantity, price/subtotal and
a garment-specific profile link. Blouse could reuse the prior invented profile;
Salwar required a compatible profile before continuing. The Salwar editor labels
a profile/member name and four measurement fields. These are not three physical
outfit-piece records. One invented value was saved solely to cross that vendor
research prerequisite; it is not a real wearer measurement, a production input,
or permission to implement Aarili measurement capture early.

The captured Items/Review screens expose one expected delivery date, shared
special instructions, and one priority in Review. The two garment profiles are
individually linked, but no separately authorised legal wearer/guardian picker,
per-row promise/status/identifier or piece checklist was exposed in this path.
This bounded observation does not establish absence elsewhere in Nool.
Review shows the two positive sample prices summing to ₹300 alongside untouched
discount and advance controls. This does not establish package pricing or
allocation semantics. Blank/zero price questions reuse the prior Quick Order
investigation rather than repeat it.

**TailorMan:** fresh sample repeats item/quantity/rate/total rows and optional
measurement/photo/note details. Header has shared customer, Given/Delivery and
Express; aggregate sample shows subtotal/total/advance/balance. A + Package button
exists, but its declared click leaves the captured sample unchanged, just as the
earlier quick-add clicks did. No working package addition, price distribution,
legal wearer, independent promise or persisted save is established. Public sample
Bill Detail is reused from `ev_264d231d030b89d96383e606f7b0224e5263187985b6802f4590f580adfec33e`:
identifier/date/item-stage and commercial summary are visible; it is not a
reopened version of New Bill. No shared-demo mutation was persisted.

## Inferences and independent decisions

Repeated item rows with per-item profile cues can help scan a shared visit;
that is a design inference, not measured usability. Aarili instead follows its
own product model: optional booking, independent authorised garment records and
stable physical pieces within each outfit. Neither vendor screen supplies our
piece identity, readiness aggregation, price authority or security design.

Shared dates/notes and price totals must not erase independent commitments or
unknown prices in Aarili. Our design separates package quote from additive line
charges and preserves unknown allocation. Vendor mandatory positive-price/profile
choices do not override recoverable incomplete Aarili drafts. No vendor client
inspection establishes backend schema, RLS, capacity locking, idempotency,
atomicity, version history, privacy retention or recovery guarantees.

## Questions, limits and follow-up

| Question | Disposition and boundary |
| --- | --- |
| Can two different garments be created in one form? | Answered: live Blouse and Salwar rows and linked-profile Review captured. |
| Can the two-row order persist/reopen? | Answered: live save, list, detail and direct reload/edit of ORD-20261019-002 below. This is one vendor order with two rows, not two independently identified garment orders. |
| Separate wearers/guardian permissions and garment dates/statuses? | Partially answered at UI boundary: per-row profile links, shared date/notes; legal identity/permissions and independent promises remain unestablished. Aarili requirements remain mandatory. |
| Outfit top/bottom/dupatta and partial readiness? | Not exposed in these inspected paths. A Salwar measurement form or multi-row bill is not proof. Actual vendor partial-piece execution remains unknown. |
| Package price versus garment sum? | Nool row subtotal observed; TailorMan + Package click unchanged. Actual package agreement/allocation semantics remain unknown. |
| Cancel/recovery/validation? | Missing measurement blocks Review; modal Cancel and incomplete scenario limits recorded. Prior single-order discard/reload evidence reused. No backend fault injection or retry guarantees claimed. |
| Phone/Tamil and accessibility? | Prior TailorMan phone/tablet evidence reused for layout only. Nool 360×800 detail captured below. Full Tamil/keyboard/axe and real-device quality not established for vendors. |
| Private backend integrity? | Unknown. Prove Aarili isolation/atomicity/history through its own real-PostgreSQL and browser tests after selected-ticket approval. |

TailorMate was not opened. The remaining questions concern backend guarantees or
product-required independent identity/piece semantics; another web account is not
needed to decide those Aarili requirements. Reserve access remains available for
a specific future comparative UI question, not as an unbounded third investigation.
No new account, APK, payment, invoice issuance, message, upload, worker assignment,
production, custody or handover action was performed. Synthetic profile/order
creation effects and cleanup state are recorded with the closing evidence below.

## Saved multi-garment order and closing state

| Scope | Actual REA Evidence ID | Observed result |
| --- | --- | --- |
| Save exactly once | `ev_06a443d2df49fd84ebcadd78add8bc8258611796176ba92acff01b84cd648d81` | Create Order completed; “Order Created!” observed. This successful creation scenario was never replayed. |
| Saved list | `ev_578230b0665d2e1cc2f41d778b906d7776515e40dfb1e94c2f6ad1b5cd47e287` | Two total synthetic orders: old -001 and new **ORD-20261019-002** at ₹300. The list names only blouse in its garment cell, despite the two saved rows. |
| Reopened detail | `ev_8f1bce20726d26a1f5250b7fa689cba98b192f4c9c3d9118781443b20203b8d4` | Same -002, Pending, separate blouse ₹100 and salwar ₹200 rows, shared research note, no workers/payments/attachments and zero recorded changes. |
| Direct reload and edit inspection | `ev_725d02d8f996d6e60c3e682910df5d1996562314d69ee02c38023e7b20ce4235` | Saved URL reloaded before Edit Order. Both rows, shared 2026-11-21 delivery, original note, advance zero and shared order status persisted. No changes saved. |
| Phone Cancel/detail | `ev_f3327190539aeb3d3a6a0d241a3e32cad5b357223baa296c03089be8677966e0` | 360×800, explicit Cancel from Edit Order without field edits, returned to same -002 with both rows, ₹300 and zero changes. |
| Closing desktop detail | `ev_2caec272d6b96d5dfb3a00d296a6a8beb9f7110ab6f45b9459a66bb95d806b34` | Restored 1440×900 at saved -002 detail; completed, cleanup `disconnected-external`, dedicated browser retained. |

The saved URL is
`https://app.nooltech.com/orders/6ad6435cc81c57cf4ba421f2` in the synthetic
research account. The detail has per-row View Job Sheet controls, but they were
not invoked: no independent piece, garment-status or production guarantee follows
from them. One order-wide status/date persisted; neither is proof of independent
garment promises. Price totals and note survived a durable reload, which is
stronger than the public sample. Server atomicity, legal wearer authority,
history immutability and multi-item retry guarantees remain unknown.

Exactly one additional synthetic order and one invented Salwar measurement
profile were created. The earlier -001 and its invented Blouse profile are
unchanged. Both retained orders are Pending; no advance, payment, invoice,
production, custody, handover, message or upload was performed. The form was
closed at saved -002 details with no unsaved edit. Dedicated Chrome is left
open; TailorMan launch scenarios report owned-process termination. Raw captures
remain private outside Git. Fixture deletion is a deliberate later account
action, not permission to erase history or delete the research account.
