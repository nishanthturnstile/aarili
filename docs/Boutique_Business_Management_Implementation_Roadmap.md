# Boutique Business Management — High-Level Implementation Roadmap

**Target document:** `docs/Boutique_Business_Management_Implementation_Roadmap.md`  
**Planning baseline:** [Boutique Business Management Final Product Plan](Boutique_Business_Management_Final_Product_Plan.md), dated 12 October 2026  
**Status:** Complete implementation-planning baseline. Product implementation and software acceptance remain pending.

## 1. Roadmap purpose and planning basis

This roadmap translates the complete product plan into **3 waves, 24 phases and 85 vertical slices**. It covers all **241 numbered functional requirements** and all **66 product acceptance scenarios**.

The implementation should progressively establish the boutique’s authoritative business record: who ordered and wears each garment, what was agreed, where the materials are, what must happen next, when the garment was promised, and what money remains outstanding.

The first wave delivers a complete owner-operated custom-stitching and alteration workflow. The second expands that workflow to teams, independent boutiques, purchasing, retail, customer participation and reviewed assistance. The third adds validated pattern generation, contextual intelligence and conditional platform integrations.

The roadmap defines functional delivery and acceptance. It does not select architecture, technology, database structures, APIs, infrastructure, implementation effort or development dates.

### 1.1 Scope classifications

- **Essential:** Required to satisfy the committed founding-pilot scope or a mandatory prerequisite of that scope.
- **Enhancement:** Part of the complete product baseline, delivered after the MVP.
- **Conditional baseline capability:** Part of the product plan, but activated only when its business need, configuration, permissions or validation prerequisites are satisfied.
- **Optional extension:** Outside the committed baseline and excluded from these implementation waves.

Source-plan **Phase 1** corresponds to roadmap **Wave 1**. Roadmap phases are smaller business-capability groups; their numbering does not replace the source plan’s release commitments.

### 1.2 Assumptions and scope decisions

No critical ambiguity requires clarification before preparing this roadmap. Recorded owner decisions govern the following defaults:

| Topic | Roadmap decision |
|---|---|
| Founding boutique | Owner-only operation; free use; non-GST-registered; cash and manually confirmed UPI; no ready-made retail. |
| Initial services | Blouse, Chudidhar/Salwar, standalone alterations and approved small services. Exact catalogue and outfit-piece structures require owner approval before live use. |
| Bridal | An occasion/package booking containing independent garment orders, not a garment category. |
| Outfit orders | One order per outfit, with independently tracked pieces and order-level pricing unless a piece breakdown is agreed. |
| Mixed bookings | Wave 1 combines custom garments and alteration/service work. Retail lines extend the same capability in Wave 2. |
| Simple mode | Default for the founding owner. Progressive detail does not weaken consent, money, custody or irreversible-work checks. |
| Connectivity | Online-only responsive installable web app. Unsaved values remain visible in the currently open form; offline business-data capture is excluded. |
| Communications | Wave 1 prepares Tamil/English WhatsApp text and PDFs/images for owner-controlled sharing. Automated sending is later and conditional. |
| Drafting | Manual/external references in Wave 1; calculation sheets in Wave 2; validated automated patterns in Wave 3. |
| Gallery | Complete mannequin functionality is assigned to Wave 2. The source plan permits earlier inclusion, but it is not an MVP operating gate. |
| Purchase and stock prerequisites | Minimal purchase-cost evidence and opening-stock controls accompany mandatory MVP material costing. Full purchasing and stocktake remain in Wave 2. |
| Monthly advertising spend | Simple monthly channel entry is a Wave 1 **Should** enhancement. Attribution and campaign reporting remain in Wave 2; connected data remains in Wave 3. |
| Unquoted or entirely zero-priced lines | Confirmed money remains visible as unallocated customer credit until a supported, owner-reviewed allocation is possible. The product does not invent proportional shares. |
| Partial-piece billing | Before partial invoicing, the owner records an agreed piece value or reviewed division of the order price. Cumulative billing cannot duplicate the order’s charge. |
| Source-plan Should items | Unless explicitly included below, these are completed in Wave 2. Their deferral cannot remove a prerequisite of a Wave 1 Must requirement. |

Business values such as rates, tolerances, refund terms and retention periods remain configurable approval inputs. They are activation gates, not values for an implementer to invent.

### 1.3 Rules applying to every vertical slice

Every slice includes its complete user interaction, authoritative record changes, relevant history, permissions, business consequences and functional verification.

- Preserve separate enquiry, production, assignment, approval, billing, payment, custody and handover states.
- Treat unanswered requirements as unresolved; never interpret blank as received, approved or not required.
- Apply checks to the action being attempted. Missing fabric can block cutting without blocking an appropriate advance receipt.
- Preserve original agreements and promises alongside revisions and actual outcomes.
- Keep customer property separate from purchased stock and prevent duplicated money, stock, costs and actions.
- Record actor, time and reason for significant changes and authorised exceptions.
- Recheck current records before consequential actions; surface conflicting edits and prevent repeated actions.
- Keep private measurements, fitting media and internal financial information out of public or customer-facing outputs.
- Provide Tamil/English core workflows, accessible controls and usable mobile, tablet and desktop experiences.
- Provide readable PDFs for every printable output, with preview and A4 as the default.
- Show failed saves, uploads and external actions honestly; preserve recoverable work and the promised manual path.
- Test applicable exceptions as well as normal completion. A form alone does not complete a slice.

Earlier increments use practice or reviewed test records. **No live pilot starts until the complete Wave 1 readiness gate passes.**

---

## 2. Wave 1 — MVP: Reliable Owner-Operated Boutique Operations

**Objective:** Let the founding owner run custom stitching, alterations and small services from intake through production, handover and settlement without reconstructing critical records elsewhere.

**Business value:** A trustworthy daily record reduces missed requirements, lost property, unclear artisan obligations, forgotten charges and misleading delivery or payment status.

**Scope:** Owner setup, customers/wearers, bookings and outfit pieces, design and measurements, quotes and payments, material custody, owner/external production, trials, quality, partial handover, cancellation, daily actions, basic reports, migration, privacy, export and recovery.

**Dependencies:** Approved pilot policies and baseline evaluation. No dependency on AI, retail, customer accounts, automated messaging or an automated pattern engine.

**Completion criteria:**

- Every source §29.1 Phase 1 Must requirement is satisfied.
- All applicable source §30.1 Phase 1 scenarios pass, including measurement-only AC-06.
- All source §32.2 live-data decisions are resolved.
- Opening records, balances and customer property are reconciled.
- Recovery restoration and outage reconciliation are demonstrated.
- The owner completes the full service and custom-garment journeys at all three required screen sizes without daily developer assistance.
- Conditional cross-shop checks pass before any second boutique; gallery checks apply if a gallery is moved earlier.

### Phase 1.1 — Configure Safe Owner Operation

**Objective:** Establish the business rules and identities needed for trustworthy intake.  
**Functional scope:** Shop policies, supported services, Simple mode, customers, wearers and consent.  
**Dependencies:** None; owner approval of initial policies and forms.

#### Vertical Slice 1.1.1 — Configure the Shop and Commitment Policies

- **Purpose:** Make daily work reflect the boutique’s actual operating rules.
- **Functional requirements:** Configure profile, INR/local timezone, working calendar, payment accounts, vendors, commercial policies, warning windows, category lead times, weekly caps, festival cut-offs and rush charges. Version changes; activate only relevant modules.
- **Expected user workflow:** Owner completes setup, reviews missing policies and tests a delivery commitment.
- **Dependencies:** Owner-supplied business values.
- **Acceptance criteria:** Missing policy values remain unresolved. Over-capacity/cut-off acceptance requires a reason; rush charges can be waived explicitly. Changed policies do not silently alter existing work.
- **Deliverable:** Approved operating configuration and understandable commitment warnings.

#### Vertical Slice 1.1.2 — Configure Services, Templates and Simple Mode

- **Purpose:** Support fast intake without losing garment-specific requirements.
- **Functional requirements:** Configure approved categories, outfit pieces, add-ons, measurement forms, requirement/task/quality templates and confirmation wording. Default to Simple mode; support per-order and shop-wide detailed mode.
- **Expected user workflow:** Owner selects a service, previews its generated checklist and milestones, then switches a sample order to detailed mode.
- **Dependencies:** 1.1.1.
- **Acceptance criteria:** Templates distinguish required and optional work. Owner assignment is automatic in Simple mode. Switching modes preserves all information and history.
- **Deliverable:** Approved service templates and a usable solo-owner workflow.

#### Vertical Slice 1.1.3 — Register Customers and Authorised Wearers

- **Purpose:** Identify the correct person without confusing payer, wearer or guardian.
- **Functional requirements:** Create/search minimal customer records; add separate wearers, relationships, language/channel preferences and permissions. Capture Tamil/English notice and consent; protect private assets and shop records.
- **Expected user workflow:** Owner identifies a contact, selects the wearer and records the applicable authorisation.
- **Dependencies:** Approved privacy notice, retention terms and guardian-consent policy.
- **Acceptance criteria:** Shared phones do not merge identities or grant blanket access. A non-guardian payer cannot authorise a minor’s measurements/photos. Minor images cannot be published or used for marketing targeting.
- **Deliverable:** Permission-aware customer and wearer registration.

### Phase 1.2 — Create Recoverable Orders and Bookings

**Objective:** Capture independent, traceable work quickly.  
**Functional scope:** Quick intake, outfit pieces, packages, service orders, repeat intake and customer history.  
**Dependencies:** Phase 1.1.

#### Vertical Slice 1.2.1 — Create and Recover a Quick Order

- **Purpose:** Record a new commitment with minimal administrative effort.
- **Functional requirements:** Provide readable identifiers and the six Simple-mode input groups: customer name/phone, wearer defaulting to the customer, garment type, agreed delivery date, price or “to be quoted”, and optional advance. Generate unresolved checklists and owner assignment. Preserve original/current dates, event dates, priority, creation time and attributable history. Advance recording is added by 1.4.2 without delaying base intake.
- **Expected user workflow:** Owner selects the customer/wearer, garment, date and price; saves and later resumes. Optional advance entry uses the payment capability once available.
- **Dependencies:** 1.1.1–1.1.3.
- **Acceptance criteria:** Incomplete drafts are recoverable. Lost connectivity shows unsaved changes and preserves typed values on screen. Retry creates no duplicate; conflicting edits are disclosed.
- **Deliverable:** Reliable online quick-order intake.

#### Vertical Slice 1.2.2 — Group Garments and Track Outfit Pieces

- **Purpose:** Manage family visits and packages without hiding independent work.
- **Functional requirements:** Group separate orders under an optional booking; support multiple wearers, shared occasion/event dates and Bridal package pricing. Give every outfit piece its own requirements, measurements, tasks, custody and readiness.
- **Expected user workflow:** Owner adds blouse and salwar orders, defines salwar pieces and reviews independent commitments.
- **Dependencies:** 1.2.1.
- **Acceptance criteria:** A piece’s blocker does not falsely complete another piece. Booking totals do not duplicate garment revenue. Retail choices stay unavailable in Wave 1.
- **Deliverable:** Multi-garment bookings and piece-aware outfit orders.

#### Vertical Slice 1.2.3 — Create Alteration and Small-Service Orders

- **Purpose:** Handle lightweight jobs without forcing a full custom-stitching process.
- **Functional requirements:** Add priced fall/pico/pre-pleating and similar lines with completion state and optional tasks. Create standalone small-service or alteration orders without mandatory full measurements or patterns.
- **Expected user workflow:** Owner records a customer’s saree service or kurti alteration, requested work, price and delivery commitment.
- **Dependencies:** 1.2.1; later money, custody and fulfilment slices complete the journey.
- **Acceptance criteria:** Inapplicable forms/tasks are absent. Customer garments remain traceable property. Multiple add-ons retain separate completion and pricing.
- **Deliverable:** Lightweight service intake compatible with the main fulfilment workflow.

#### Vertical Slice 1.2.4 — Reuse Orders and Maintain Customer History

- **Purpose:** Accelerate repeat work while preserving historical truth.
- **Functional requirements:** Duplicate as new; retrieve customer/wearer history; review duplicates and merge only with authorisation. Preserve identifiers, financial links and wearer distinctions. Record corrective identity edits and reviewed relinking.
- **Expected user workflow:** Owner finds a previous garment, reviews its context, starts a new order and confirms reusable information.
- **Dependencies:** 1.2.1–1.2.3.
- **Acceptance criteria:** Old approvals, payment confirmations and promises are not copied as current facts. Historical versions survive edits/merges. Matching phones alone never trigger a merge.
- **Deliverable:** Safe repeat intake and consolidated customer history.

### Phase 1.3 — Define Garment Instructions and Measurements

**Objective:** Make the intended garment and its authoritative inputs explicit.  
**Functional scope:** Design libraries, references, measurements, manual patterns and production documents.  
**Dependencies:** Phases 1.1–1.2.

#### Vertical Slice 1.3.1 — Capture a Versioned Design Specification

- **Purpose:** Replace scattered references with clear garment instructions.
- **Functional requirements:** Maintain category/type libraries with availability controls. Separate neck type/design and sleeve type/design. Capture garment-specific construction, fit, lining, decoration and restrictions; attach source-linked references, captions and annotations.
- **Expected user workflow:** Owner selects supported choices and distinguishes inspiration from confirmed instructions.
- **Dependencies:** 1.1.2, 1.2.1.
- **Acceptance criteria:** Inactive choices remain readable historically but require replacement/reactivation for new work. Reference replacement preserves the previous version. Private references never publish automatically.
- **Deliverable:** Versioned garment specifications and controlled design libraries.

#### Vertical Slice 1.3.2 — Record and Select Measurement Versions

- **Purpose:** Preserve accurate wearer-level measurement history.
- **Functional requirements:** Support approved per-category/piece forms, inches/centimetres, decimals/fractions, visible conversions and field precision. Record measurement source, method, date and measurer; validate missing or implausible values with approved rules.
- **Expected user workflow:** Owner records a session or reviews a previous version, then explicitly links it to the order/piece.
- **Dependencies:** 1.1.3, 1.3.1.
- **Acceptance criteria:** Revisions do not change historical orders. Reuse shows age/source/context and requires confirmation. Entered, garment-target and derived values are distinguishable; no unapproved formulas or guessed measurements are introduced.
- **Deliverable:** Authoritative, private measurement versioning.

#### Vertical Slice 1.3.3 — Record a Manual or External Pattern Path

- **Purpose:** Keep production usable without automated drafting.
- **Functional requirements:** Declare manual, external or validated automated availability for each supported type. Link physical-pattern references, sketches or uploaded outputs with source, version and review status.
- **Expected user workflow:** Owner selects the manual/external method and records the reference used for the garment.
- **Dependencies:** 1.3.1–1.3.2.
- **Acceptance criteria:** Orderable types are not presented as automatically draftable. Imported scale/formula assumptions remain visibly unverified. No unsupported generation is offered.
- **Deliverable:** Reviewed manual/external production references.

#### Vertical Slice 1.3.4 — Produce Job Slips and Material Labels

- **Purpose:** Connect physical bags and garments to their instructions.
- **Functional requirements:** Produce previewable job slips/bag labels with readable order/piece identifiers and permitted production details. Support PDF download and sharing; show upload failures and missing assets.
- **Expected user workflow:** Owner previews, prints or shares the document and labels the physical item.
- **Dependencies:** 1.2.2, 1.3.1–1.3.3.
- **Acceptance criteria:** A4 and printer-free use work. Public labels reveal no private fitting data or margins. Core work remains usable without loading every historical image.
- **Deliverable:** Usable physical identification and shareable production documents.

### Phase 1.4 — Agree Prices and Maintain Customer Money

**Objective:** Establish trustworthy agreements, documents and payment positions.  
**Functional scope:** Rates, quotes, deposits, approval/change control, non-tax billing and financial adjustments.  
**Dependencies:** Phases 1.1–1.3.

#### Vertical Slice 1.4.1 — Prepare Itemised Estimates and Quotations

- **Purpose:** Agree a transparent price without confusing revenue and cost.
- **Functional requirements:** Maintain effective-dated rates for garment labour, materials, add-ons, alterations, Aari and rush work. Produce garment/booking quotes with assumptions, quantities, inclusions, discounts, validity and revisions; distinguish selling price from internal cost.
- **Expected user workflow:** Owner prepares an estimate, resolves unanswered pricing and shares a quotation.
- **Dependencies:** 1.1.1, 1.2.2–1.2.3, 1.3.1.
- **Acceptance criteria:** Customer-supplied materials are not charged as shop stock. Bundled/complimentary lines retain real costs. Catalogue changes do not rewrite old quotes; booking and garment charges are counted once.
- **Deliverable:** Versioned, itemised non-tax quotations.

#### Vertical Slice 1.4.2 — Record, Verify and Allocate Payments

- **Purpose:** Show what money is genuinely received and which work it funds.
- **Functional requirements:** Record advances, instalments and split methods; distinguish pending, confirmed, failed and reversed evidence. Confirm cash on receipt and UPI through the owner’s receiving-account check. Detect duplicate UTRs and allocate confirmed money transparently. Apply proportional shares by agreed charge, round each down to whole rupees, and give remaining rupees to the largest-charge line, earliest if tied. Owner reallocation needs a reason before billing; after billing it requires an adjustment. Receipt document generation is layered on by 1.4.4.
- **Expected user workflow:** Owner records cash/UPI, confirms receipt and reviews allocations; the linked receipt is issued once document generation is available.
- **Dependencies:** 1.4.1.
- **Acceptance criteria:** Screenshots remain evidence. Pending money does not settle balances. Default allocation sums exactly; ₹1,000 across three equal ₹700 lines allocates ₹334/₹333/₹333. Allocations cannot exceed confirmed available funds. Excess money remains customer credit.
- **Deliverable:** Confirmed payments, reviewable allocations and accurate balances.

#### Vertical Slice 1.4.3 — Approve Agreements and Govern Changes

- **Purpose:** Ensure production uses an accepted, current scope.
- **Functional requirements:** Prepare customer summaries and Tamil/English WhatsApp content; record prepared/marked-sent status and communication history. Capture current design, price and date approval, including staff-attested verbal approval. Assess changes and issue revised agreements. Sharing opens WhatsApp click-to-chat with prefilled text; the owner attaches a PDF/image through the mobile share route or desktop download and marks it sent.
- **Expected user workflow:** Owner shares the summary, records approval, then reviews any requested change against affected work, costs and dates. Available payment information is included without making payment a prerequisite for agreement.
- **Dependencies:** 1.3.1–1.3.3, 1.4.1.
- **Acceptance criteria:** A share is not approval. Requests remain pending until accepted. Only affected approvals/work become stale; cut/dispatched work is flagged. Original promises and agreements remain readable. The product does not claim automatic sending or access to private WhatsApp history.
- **Deliverable:** Approved customer agreements and attributable change control.

#### Vertical Slice 1.4.4 — Issue Non-Tax Bills and Receipts

- **Purpose:** Create valid business documents and a clear commercial event sequence.
- **Functional requirements:** Distinguish quote, acknowledgement, payment receipt, bill and adjustment. Use approved identity/numbering/correction rules; preserve issued originals and cancelled numbers. Apply the founding shop’s unregistered regime without GSTIN or tax lines.
- **Expected user workflow:** Owner issues a receipt or bills the relevant garment/piece/service, normally at handover.
- **Dependencies:** 1.4.1–1.4.3; approved document configuration.
- **Acceptance criteria:** Quotes create no obligation; price approval sets expected order value, not revenue/receivable; advances create deposits, not revenue. Billing creates revenue/receivable and applies deposits once. Earlier billing requires a reason. Missing material does not block an otherwise valid document.
- **Deliverable:** Controlled non-tax documents and distinguishable expected versus collectible balances.

#### Vertical Slice 1.4.5 — Correct Money and Settle Refund Liabilities

- **Purpose:** Resolve financial exceptions without rewriting history.
- **Functional requirements:** Record credits, reversals, approved adjustments and refunds with source obligation, beneficiary, method, authority and settlement status. Separate sale credit, refund liability and actual refund.
- **Expected user workflow:** Owner reviews the original transaction, approves the correction and records settlement or failure.
- **Dependencies:** 1.4.2, 1.4.4.
- **Acceptance criteria:** Reversal restores the applicable balance once. Failed refunds remain payable. Retry does not refund twice. A fully credited/refunded sale leaves neither a false receivable nor an unresolved settled liability.
- **Deliverable:** Auditable correction and refund workflows.

### Phase 1.5 — Control Materials, Customer Property and Direct Costs

**Objective:** Know what is available, where it is and what it actually cost.  
**Functional scope:** Receipts, shared fabric, allocation/consumption, minimal cost evidence, returns and incidents.  
**Dependencies:** Phases 1.2–1.4.

#### Vertical Slice 1.5.1 — Receive Customer Property and Resolve Material Requirements

- **Purpose:** Distinguish a material promise from physical receipt.
- **Functional requirements:** Record fabric, samples and accessories with quantities, dimensions/units, condition, source, receiver and optional photos. Track required, promised, received, usable and shortfall quantities.
- **Expected user workflow:** Owner receives an item, links it to the relevant order/piece and updates its checklist.
- **Dependencies:** 1.2.2–1.2.3.
- **Acceptance criteria:** Unknown dimensions remain unknown. Customer property does not increase purchased-stock value. Partial/unusable receipt remains visible and blocks only the relevant production action.
- **Deliverable:** Customer-property receipts and accurate material readiness.

#### Vertical Slice 1.5.2 — Split Shared Fabric and Track Custody

- **Purpose:** Prevent fabric double-commitment and lost cut pieces.
- **Functional requirements:** Plan fabric splits across garments/pieces; track cut pieces and remnants separately. Record optional storage locations, current custodian and movement between shop, worker, trial and vendor.
- **Expected user workflow:** Owner allocates shared fabric, records its cut pieces and confirms each physical movement.
- **Dependencies:** 1.5.1, 1.2.2.
- **Acceptance criteria:** The same cloth cannot be committed twice. Assignment changes do not imply physical movement. Every dispatched piece and unresolved return remains traceable.
- **Deliverable:** Piece-level shared-fabric and custody records.

#### Vertical Slice 1.5.3 — Reserve and Consume Shop Materials

- **Purpose:** Make stock availability and garment material cost trustworthy.
- **Functional requirements:** Maintain minimal reconciled opening stock, explicit units and purchase unit cost; reserve without consuming. Record issue, actual use, wastage and reusable remnant returns.
- **Expected user workflow:** Owner reserves material, records cutting/issue and reconciles the remainder.
- **Dependencies:** 1.5.1; approved opening quantities/cost basis.
- **Acceptance criteria:** Insufficient stock is blocked by default. A ₹100/m issue of 2.2 m costs ₹220 if 0.2 m is unusable, or ₹200 if the remnant is returned as reusable stock. Purchase and consumption are not both charged to the order.
- **Deliverable:** Minimal accurate stock allocation and material costing.

#### Vertical Slice 1.5.4 — Record Direct Costs and Purchase Evidence

- **Purpose:** Preserve genuine fulfilment costs without requiring full purchasing.
- **Functional requirements:** Capture minimal purchase/service evidence, quantities, unit costs and order/stock purpose. Record estimated/actual material, vendor, labour, fulfilment and correction costs; flag missing evidence.
- **Expected user workflow:** Owner records a purchase or direct cost and links it to stock or the relevant work.
- **Dependencies:** 1.4.1, 1.5.3.
- **Acceptance criteria:** Stock purchases are recognised through consumption for order costing. Vendor charges are not duplicated as purchase and labour costs. Zero-priced work retains its cost.
- **Deliverable:** Evidence-linked direct costs and completeness indicators.

#### Vertical Slice 1.5.5 — Return Property and Resolve Incidents

- **Purpose:** Keep property obligations visible after garment completion.
- **Functional requirements:** Record returned/retained/pending remnants and samples, permission-based disposal, losses, damage, mix-ups and remedies. Link evidence, responsible owner, communication and financial settlement.
- **Expected user workflow:** Owner checks outstanding property, records a return or opens an incident and follows its agreed remedy.
- **Dependencies:** 1.5.1–1.5.2, 1.4.5.
- **Acceptance criteria:** Garment delivery does not close property automatically. Remedy payments do not erase custody events. Retention/disposal requires the applicable permission or published terms.
- **Deliverable:** Property reconciliation and incident resolution.

### Phase 1.6 — Capture Enquiries, Appointments and Acquisition Evidence

**Objective:** Connect prospective work and scheduled interactions to orders.  
**Functional scope:** Enquiry lifecycle/conversion, owner-recorded appointments and source evidence.  
**Dependencies:** Phases 1.1–1.4.

#### Vertical Slice 1.6.1 — Capture and Convert an Enquiry

- **Purpose:** Track prospective work without requiring full intake.
- **Functional requirements:** Capture minimal request/contact/source information; manage new, contacted, awaiting-information, quoted, follow-up-due, converted and lost/closed states with owner, reason and next action. Preserve unsuccessful quotes.
- **Expected user workflow:** Owner records an enquiry, follows up and converts it into existing customer/booking/order records.
- **Dependencies:** 1.2.1–1.2.2, 1.4.1.
- **Acceptance criteria:** No measurements or fabric are required for enquiry capture. Conversion preserves source history and avoids duplicate customers/orders. Enquiry state does not masquerade as production state.
- **Deliverable:** Lightweight enquiry-to-order conversion.

#### Vertical Slice 1.6.2 — Book Owner-Managed Appointments

- **Purpose:** Schedule measurements, consultations, trials and collection.
- **Functional requirements:** Record appointment type, duration, location, attendee and linked garment/booking using the shop calendar.
- **Expected user workflow:** Owner chooses an available time, links the visit and shares the applicable manual confirmation.
- **Dependencies:** 1.1.1, 1.2.1, 1.4.3.
- **Acceptance criteria:** Appointments appear against the correct wearer/work. Appointment time and garment delivery promise remain distinct. No customer self-booking is offered.
- **Deliverable:** Owner-managed appointment scheduling.

#### Vertical Slice 1.6.3 — Preserve Lead Sources and Optional Monthly Spend

- **Purpose:** Establish evidence before sophisticated attribution.
- **Functional requirements:** Record walk-in, referral, Google Business Profile/Maps, WhatsApp direct/Status/forwarded, organic Instagram, Click-to-WhatsApp/boosted-post ads, Google Ads, other Instagram/Meta Ads, local directories and other/unknown sources. Keep customer-stated, tracked and manually assigned evidence distinct. Provide optional monthly spend by channel.
- **Expected user workflow:** Owner records the source during enquiry/intake and, if useful, enters monthly channel spend.
- **Dependencies:** 1.6.1, 1.2.1.
- **Acceptance criteria:** Unknown is valid; no campaign match is fabricated. Monthly spend is labelled manual and does not imply campaign-level attribution or platform synchronisation.
- **Deliverable:** Source-linked acquisition records; monthly spend entry is a non-blocking Should enhancement.

### Phase 1.7 — Produce Garments and Reconcile Artisan Work

**Objective:** Move approved work forward with accountable next actions.  
**Functional scope:** Tasks, cutting, blockers, Aari work, external dispatch/return and minimal vendor dues.  
**Dependencies:** Phases 1.3–1.5.

#### Vertical Slice 1.7.1 — Start and Complete Applicable Production Tasks

- **Purpose:** Turn intake into an executable garment workflow.
- **Functional requirements:** Generate template-dependent tasks, optional/parallel work and Simple-mode milestones. Record assignment, start/completion, timestamps, evidence and approved manual/pattern method.
- **Expected user workflow:** Owner checks readiness, starts cutting or another applicable task and completes its recorded work.
- **Dependencies:** 1.1.2, 1.3.2–1.3.3, 1.4.3, 1.5.1–1.5.3.
- **Acceptance criteria:** Cutting is an explicit irreversible checkpoint. Missing applicable approvals/materials/assignment block the action. Owner assignment is valid; differing pre/post-cut embroidery sequences both work.
- **Deliverable:** Governed owner-operated production.

#### Vertical Slice 1.7.2 — Hold Work and Manage Blockers

- **Purpose:** Make stalled work actionable.
- **Functional requirements:** Record reason, accountable owner, next action, review date and schedule impact for holds/blockers. Preserve blocked duration and explicit reopening.
- **Expected user workflow:** Owner pauses a task, records the resolution action and resumes when the underlying condition changes.
- **Dependencies:** 1.7.1.
- **Acceptance criteria:** Acknowledgement is not resolution. Waiting time is not automatically worker effort. Changing dates preserves the original promise and requires the applicable agreement.
- **Deliverable:** Owned production exceptions and blocker history.

#### Vertical Slice 1.7.3 — Brief and Dispatch Aari/Embellishment Work

- **Purpose:** Manage specialist work and customer panels without a separate ledger.
- **Functional requirements:** Maintain motif references, placement/coverage, complexity, effort ranges and consumable templates. Price through approved rates; identify shop/customer/artisan supplies. Maintain minimal artisan profiles and shareable briefs. Apply the approved marking/tracing, framing, Aari, removal, quality and stitching sequence appropriate to the garment.
- **Expected user workflow:** Owner agrees the design/rate, selects the applicable sequence and dispatches exact panels/materials with an expected return.
- **Dependencies:** 1.3.1, 1.4.1–1.4.3, 1.5.2, 1.7.1.
- **Acceptance criteria:** Dispatch changes custody only for specified items. Supplies land in the correct cost category. A vendor login is unnecessary; photos remain subject to publication permission.
- **Deliverable:** Complete Aari/external-work briefs and dispatch records.

#### Vertical Slice 1.7.4 — Accept External Returns and Settle Vendor Dues

- **Purpose:** Reconcile returned property, accepted work and artisan money.
- **Functional requirements:** Record reported progress, partial returns, quantities, quality acceptance/rejection, rework/dispute, agreed charge, advances, later payments and outstanding due.
- **Expected user workflow:** Owner receives panels, checks them and reconciles custody and the payable position.
- **Dependencies:** 1.7.3, 1.5.4–1.5.5.
- **Acceptance criteria:** “Vendor done” does not mean returned or accepted. A ₹1,500 job with ₹200 advance shows ₹1,300 remaining, payable on acceptance; rejection/dispute remains visible. Repeated settlement does not double-pay or double-cost.
- **Deliverable:** Accepted external work and a reliable vendor-dues list.

### Phase 1.8 — Validate Fit, Hand Over and Settle Exceptions

**Objective:** Complete work without concealing quality, property or money obligations.  
**Functional scope:** Trials/corrections, quality/readiness, partial collection, cancellation/reopening and stored property.  
**Dependencies:** Phases 1.4–1.7.

#### Vertical Slice 1.8.1 — Record Trials, Corrections and Fit Outcomes

- **Purpose:** Resolve fitting work and preserve contextual learning.
- **Functional requirements:** Record trial attendance, versions used, feedback, changed measurements, correction cause/chargeability/cost, owner and next action. Save final garment fabric/construction/alterations and distinguish staff-assessed from customer-confirmed fit.
- **Expected user workflow:** Owner records a trial, creates corrective work if needed and captures the final accepted outcome.
- **Dependencies:** 1.3.2, 1.6.2, 1.7.1, 1.5.4.
- **Acceptance criteria:** Missed trials flag risk without silently changing dates. Planned fitting differs from avoidable rework. A garment correction never automatically rewrites general body measurements.
- **Deliverable:** Trial-to-correction workflow and verified fit history.

#### Vertical Slice 1.8.2 — Quality-Check and Mark Valid Readiness

- **Purpose:** Make “ready” a trustworthy event.
- **Functional requirements:** Run garment/piece-specific checks for construction, finish, defects, closures, accessories and relevant dimensions. Failed checks create corrective tasks; preserve first/current readiness and withdrawal reasons.
- **Expected user workflow:** Owner completes quality review and marks the relevant work ready, or sends it back for correction.
- **Dependencies:** 1.7.1–1.7.4; 1.8.1 where trial decisions apply.
- **Acceptance criteria:** Unresolved required trial/quality decisions prevent readiness. Withdrawing readiness preserves the earlier event and its invalidation. Payment or collection is not implied by readiness.
- **Deliverable:** Quality acceptance and auditable readiness.

#### Vertical Slice 1.8.3 — Hand Over Garments or Pieces and Record Collection

- **Purpose:** Fulfil individual items while preserving the remainder.
- **Functional requirements:** Record selected garment/piece, recipient, acknowledgement and actual collection time. Issue the applicable bill; apply payment or authorised credit policy. Review outstanding customer property and prepare ready/balance messages.
- **Expected user workflow:** Owner selects ready items, reviews settlement/property and records partial or full handover.
- **Dependencies:** 1.8.2, 1.4.2/1.4.4, 1.5.5.
- **Acceptance criteria:** A salwar top can be handed over while its bottom remains in correction. Unpaid credit remains collectible. Ready, dispatched and received/collected are distinct; optional delivery records do not falsely imply receipt.
- **Deliverable:** Piece-aware handover and accurate remaining obligations.

#### Vertical Slice 1.8.4 — Cancel, Reopen and Close Work Correctly

- **Purpose:** Resolve exceptions without deleting their consequences.
- **Functional requirements:** Review irreversible work, remaining commitments, charges, refund/credit, vendor dues and property. Reopen through new linked work with a reason. Aggregate booking fulfilment separately from closure.
- **Expected user workflow:** Owner assesses cancellation, records the approved settlement actions and closes only resolved obligations.
- **Dependencies:** 1.4.5, 1.5.5, 1.7.4, 1.8.3.
- **Acceptance criteria:** Cancellation after cutting preserves costs/history. Mixed handed-over/cancelled garments show “fulfilled with cancellations”. Closure requires no unresolved work, money, property, vendor due or issue; prior handover is never erased.
- **Deliverable:** Governed cancellation, reopening and obligation-based closure.

#### Vertical Slice 1.8.5 — Manage Uncollected Garments and Stored Property

- **Purpose:** Prevent forgotten garments or fabric from disappearing operationally.
- **Functional requirements:** Apply approved holding periods, reminder schedules, final notices and permitted outcomes. Preserve continued storage, charges, authorised disposal/donation and pending obligations.
- **Expected user workflow:** Owner reviews aged items, shares the permitted notice and records the agreed outcome.
- **Dependencies:** 1.1.1, 1.5.5, 1.8.3.
- **Acceptance criteria:** No silent disposal occurs. Storage charges follow recorded published terms. Collection stops the relevant pickup follow-up without hiding another property obligation.
- **Deliverable:** Governed uncollected-item management.

### Phase 1.9 — Run the Day and Review Reliable Results

**Objective:** Make records useful for immediate action and business review.  
**Functional scope:** Search/lists, action home, alerts, daily close and essential reports.  
**Dependencies:** Phases 1.2–1.8.

#### Vertical Slice 1.9.1 — Search and Filter Linked Work

- **Purpose:** Locate the right record without reconstructing it.
- **Functional requirements:** Search customer/wearer, phone fragments, booking/order IDs, garment and material labels. Combine relevant filters; provide reset/saved views and clear empty results. Legacy-reference search is extended when 1.10.1 supplies migrated records.
- **Expected user workflow:** Owner finds a record and opens its customer, work, custody or money history.
- **Dependencies:** Existing record slices in Phases 1.2–1.8; no dependency on the later migration extension for base search.
- **Acceptance criteria:** Tamil script, Latin-typed Tamil and English variations find supported names/terms without merging identities. Search exposes only authorised records.
- **Deliverable:** Practical cross-workflow search and order lists.

#### Vertical Slice 1.9.2 — Act on Alerts and Complete Daily Close

- **Purpose:** Give the owner a clear next action.
- **Functional requirements:** Show due/at-risk work, trials, pending decisions, shortages, vendor returns, quality failures, uncollected items and balances. Support acknowledge, assign, snooze, resolve/reopen and quick actions. Reconcile cash/UPI/bank records against supplied counts/evidence.
- **Expected user workflow:** Owner works through action cards, then reviews tomorrow’s work and payment mismatches.
- **Dependencies:** Phases 1.4–1.8, 1.9.1.
- **Acceptance criteria:** Three-day, two-day, tomorrow, today and overdue warnings use shop-local dates; default calendar days can switch to working days with category-specific windows. Slots become overdue when passed, otherwise at working-day end. Snoozed work remains listed. A ₹200 cash shortage uses an adjustment, not rewritten bills. Priority has a visible reason.
- **Deliverable:** Daily operating workspace and reconciled close.

#### Vertical Slice 1.9.3 — Review Operational and Customer Outcomes

- **Purpose:** Evaluate real performance without flattering statistics.
- **Functional requirements:** Report intake/completion, WIP, blocked duration, original/current-promise readiness, trials, rework, pickup age, repeat demand and basic conversion/service demand.
- **Expected user workflow:** Owner selects a period/category and inspects the contributing garments.
- **Dependencies:** 1.6.1, 1.8.1–1.8.4.
- **Acceptance criteria:** Revised promises do not improve original-promise results. Unfinished overdue work remains in the denominator. Cancelled-after-due and invalidated readiness remain visible; planned fitting is separate from avoidable rework.
- **Deliverable:** Essential operational/customer scorecards.

#### Vertical Slice 1.9.4 — Review Sales, Collections and Outstanding Obligations

- **Purpose:** Understand what was agreed, billed, collected and remains due.
- **Functional requirements:** Separate quoted/approved value, invoices, credits, deposits, confirmed collections, expected balance, collectible receivables, customer credit and vendor dues. Show dates, ageing and available direct-cost completeness.
- **Expected user workflow:** Owner reviews totals and opens their source transactions.
- **Dependencies:** 1.4.1–1.4.5, 1.5.4, 1.7.4.
- **Acceptance criteria:** Deposits are not sales; booking/garment totals are not duplicated. Unknown due dates are not automatically overdue. Incomplete costs are visible and contribution is never labelled net profit.
- **Deliverable:** Trustworthy basic financial and obligation reporting.

### Phase 1.10 — Migrate, Protect, Recover and Launch

**Objective:** Make the completed workflow safe for real daily use.  
**Functional scope:** Reviewed migration, data rights, understandable exports, support, recovery, onboarding and pilot validation.  
**Dependencies:** All Wave 1 capabilities; safeguards are applied throughout development, not postponed to this phase.

#### Vertical Slice 1.10.1 — Import and Reconcile Starting Records

- **Purpose:** Begin live use without duplicating old business activity.
- **Functional requirements:** Preview/import customers, measurements, active orders, opening stock and receivables/payables. Preserve source, cut-off, legacy dates and identifiers. Attach notebook photos as unconfirmed records indexed by book/page.
- **Expected user workflow:** Owner reviews errors/duplicates, approves opening records and confirms handwritten values when the wearer next orders.
- **Dependencies:** Receiving business capabilities in Phases 1.2–1.9.
- **Acceptance criteria:** Re-import cannot duplicate opening balances. Historical creation/order dates are distinct. Opening money/stock is not counted again as new-period sales/purchases; notebook photos are not authoritative measurements.
- **Deliverable:** Reconciled opening records and searchable legacy evidence.

#### Vertical Slice 1.10.2 — Handle Correction, Consent Withdrawal and Data Rights

- **Purpose:** Resolve privacy requests with honest retention outcomes.
- **Functional requirements:** Track correction, access/export, erasure, consent withdrawal and archive requests. Apply approved retention to records, media, exports, backups and processors; show grievance routes.
- **Expected user workflow:** Owner reviews authority, processes the request and communicates what changed or must be retained.
- **Dependencies:** 1.1.3 and relevant record histories; approved privacy procedures.
- **Acceptance criteria:** Marketing withdrawal stops marketing use. Permitted measurement/photo deletion or anonymisation is completed; retained financial records are explained. No false claim of total erasure is made.
- **Deliverable:** Reviewed customer-data lifecycle workflows.

#### Vertical Slice 1.10.3 — Export Linked Records and Request Contextual Support

- **Purpose:** Preserve portability and resolve problems without unnecessary exposure.
- **Functional requirements:** Export understandable customers/wearers, orders, measurements/history, patterns where present, bills/payments, stock, costs and permitted media. Provide accountant-linked financial exports and contextual support/feedback status.
- **Expected user workflow:** Owner selects export scope or submits a problem with authorised record context.
- **Dependencies:** Phases 1.2–1.9.
- **Acceptance criteria:** Exports declare inclusions/exclusions, date bases and retention limits and retain meaningful links. Routine support does not require an entire private customer dataset.
- **Deliverable:** Useful data/accountant exports and tracked support requests.

#### Vertical Slice 1.10.4 — Demonstrate Recovery and Pass the Founding-Pilot Gate

- **Purpose:** Establish recoverability and operational readiness before live records.
- **Functional requirements:** Complete guided setup and a sample journey; approve loss/restoration limits and demonstrate restoration. Provide printable outage intake/payment slips and later reconciliation. Capture baseline and agreed pilot measures.
- **Expected user workflow:** Owner rehearses custom/service journeys, an outage and recovery, reviews the evidence and activates live use.
- **Dependencies:** All Wave 1 Must capabilities and all §32.2 decisions.
- **Acceptance criteria:** Restoration meets approved limits and does not repeat refunds/messages. Mobile/tablet/desktop workflows pass. Repeated outage entry does not duplicate records. Baseline and go/no-go thresholds exist before pilot use.
- **Deliverable:** Reviewed pilot-readiness evidence and a recoverable operating product.

---

## 3. Wave 2 — Business Expansion: Teams, Commerce and Reviewed Assistance

**Objective:** Support richer operations and repeatable adoption by independent boutiques while preserving the MVP’s integrity.

**Business value:** Reduce coordination and reconciliation work, support purchasing/retail, involve customers safely and test assistance against actual business outcomes.

**Scope:** Roles and memberships, stock/purchases, scheduling and payables, supported GST regimes, finance enhancements, retail, customer access, controlled communications, mannequin showcase, drafting sheets, initial AI, manual attribution and conditional subscription administration.

**Dependencies:** Successful founding-pilot checkpoint; discovery interviews; module-specific business decisions. Shared or second-shop use requires §33.3 readiness.

**Completion criteria:**

- The complete expansion journeys work under the intended role boundaries.
- Independent shops remain isolated across records, assets, search, exports and assistance.
- Registered shops activate only after their billing regime is supported.
- Retail, customer access, messaging, AI and charging each pass their own activation gate.
- Source Phase 2 scenarios pass for enabled modules.
- Advanced modules do not become compulsory for a simple owner-operated shop.

### Phase 2.1 — Enable Teams and Independent Boutique Onboarding

**Objective:** Expand participation without expanding unintended access.  
**Functional scope:** Staff/external access, shop membership, scoped support and reusable onboarding.  
**Dependencies:** Wave 1; pilot go/no-go and discovery interviews before external onboarding.

#### Vertical Slice 2.1.1 — Invite Staff and Apply Role Boundaries

- **Purpose:** Let staff perform their jobs with appropriate authority.
- **Functional requirements:** Provide the fixed owner/manager/tailor/bookkeeper matrix and owner toggles. Configure worker skills, relationships, availability and active state; support invitations and immediate revocation.
- **Expected user workflow:** Owner selects a role, reviews permitted actions and assigns work.
- **Dependencies:** 1.7.1, 1.10.4; approved staff-access decisions.
- **Acceptance criteria:** Tailors see assigned work; bookkeepers do not see fitting assets. Discount/refund limits are enforced. Departure stops access while preserving assignments and payables.
- **Deliverable:** Governed shared-team operation.

#### Vertical Slice 2.1.2 — Share Scoped Work with External Workers

- **Purpose:** Allow artisan participation without general shop access.
- **Functional requirements:** Expose only shared briefs/pieces, minimum contact information and the worker’s own rates; allow permitted acknowledgement/progress/return reporting.
- **Expected user workflow:** Owner shares a job; artisan acknowledges or updates it; owner independently accepts returned work.
- **Dependencies:** 2.1.1, 1.7.3–1.7.4.
- **Acceptance criteria:** External reports cannot confirm shop receipt, quality or payment. Other customers, jobs and margins remain inaccessible.
- **Deliverable:** Optional external-worker participation.

#### Vertical Slice 2.1.3 — Switch Shops and Govern Support Access

- **Purpose:** Support independent boutiques and accountable support.
- **Functional requirements:** Provide explicit shop membership/current-shop indication; verify ownership transfer. Offer owner-authorised, time/scenario-limited support access and revocation.
- **Expected user workflow:** User switches between authorised shops; owner grants and ends a specific support session.
- **Dependencies:** 2.1.1, 1.10.3–1.10.4; multi-shop continuity approval.
- **Acceptance criteria:** Search, media, exports and notifications remain isolated; AI inherits this boundary when introduced. Ownership verification cannot erase history. Membership does not create multi-branch stock/accounting.
- **Deliverable:** Isolated shop membership and recorded support access.

#### Vertical Slice 2.1.4 — Onboard a Boutique through Reusable Configuration

- **Purpose:** Adopt the product without a shop-specific product fork.
- **Functional requirements:** Guide module selection, supported catalogues/prices/templates/calendars/messages, migration and a first sample order. Provide resettable practice mode. Registered-shop activation additionally waits for 2.4.1; unregistered-shop onboarding can be verified independently.
- **Expected user workflow:** New owner configures and rehearses the shop, then completes its applicable readiness checks.
- **Dependencies:** 2.1.3, 1.10.1/1.10.4; approved onboarding policies.
- **Acceptance criteria:** Practice cannot affect live money or send real messages. Unsupported configuration needs are explained. All live modules, including the selected billing regime, have completed activation requirements.
- **Deliverable:** Repeatable external-shop onboarding.

### Phase 2.2 — Manage Inventory, Purchasing and Supplier Obligations

**Objective:** Connect replenishment, receipt, stock and supplier money.  
**Functional scope:** Units/variants, corrections, purchase requests/commitments, partial receipts, bills and returns.  
**Dependencies:** Phase 1.5 and role controls for delegated actions.

#### Vertical Slice 2.2.1 — Maintain Detailed Stock and Perform Stocktake

- **Purpose:** Distinguish usable material variants and reconcile actual quantities.
- **Functional requirements:** Support explicit metre/centimetre/piece/roll/pack conversions, colour/batch/width/condition, damaged/quarantined stock, counted adjustments and write-offs.
- **Expected user workflow:** Owner defines a material, counts it and reviews a reasoned adjustment.
- **Dependencies:** 1.5.3, 2.1.1.
- **Acceptance criteria:** Incompatible units cannot convert silently. Roll and length quantities are not double-counted. Negative-stock exceptions require explicit authority and reconciliation.
- **Deliverable:** Detailed material inventory and stocktake.

#### Vertical Slice 2.2.2 — Raise and Approve a Purchase

- **Purpose:** Turn shortages into reviewed replenishment.
- **Functional requirements:** Maintain suppliers, terms/lead times and shared supplier/vendor identity. Create requests from low stock, shortages or manual needs; record approved purchases, quantities, cost, treatment and expected receipt.
- **Expected user workflow:** Owner reviews a request, considers substitution impacts and approves a purchase commitment.
- **Dependencies:** 2.2.1, 1.5.4, 1.4.3.
- **Acceptance criteria:** A request is not a purchase. No automatic ordering occurs. Substitution affecting design/price needs approval; unreceived material is not made available.
- **Deliverable:** Approved purchase commitments and supplier records.

#### Vertical Slice 2.2.3 — Receive Purchases and Record Supplier Bills

- **Purpose:** Reconcile physical supply independently from supplier money.
- **Functional requirements:** Record accepted partial receipts and discrepancies; retain outstanding quantities. Record bills, due dates, credits, payments and disputes with duplicate detection.
- **Expected user workflow:** Owner accepts a delivery, separately records the bill/payment and reviews remaining supply and balance.
- **Dependencies:** 2.2.2, 1.4.2/1.4.5.
- **Acceptance criteria:** Only accepted stock becomes available. Unpaid bills remain payable. Manual/photo/import entries cannot double-count a bill/payment or duplicate a craft obligation.
- **Deliverable:** Partial purchasing receipts and supplier payable accounting.

#### Vertical Slice 2.2.4 — Return Supplies and Review Replenishment

- **Purpose:** Resolve defective supply and anticipate shortages.
- **Functional requirements:** Link supplier returns, replacements, credits/refunds and stock effects. Show low stock, upcoming/overdue receipts, consumption, adjustments and open custody.
- **Expected user workflow:** Owner records returned goods and follows the replacement/credit through completion.
- **Dependencies:** 2.2.3, 1.5.5.
- **Acceptance criteria:** Stock, cash and supplier balance remain consistent. Reorder suggestions require approval. Customer fabric is excluded from inventory value.
- **Deliverable:** Reconciled purchase returns and replenishment visibility.

### Phase 2.3 — Coordinate Workforce, Capacity and Dues

**Objective:** Plan team work with realistic commitments and reliable labour obligations.  
**Functional scope:** Assignment, workload, calendars, capacity, rates, settlement and contextual performance.  
**Dependencies:** Phases 2.1 and 1.7–1.8.

#### Vertical Slice 2.3.1 — Assign, Transfer and Find Team Work

- **Purpose:** Make task responsibility visible.
- **Functional requirements:** Provide queued/in-progress/blocked/review/completed workload stacks, task assignment/reassignment reasons and acknowledgement where used. Add access-controlled QR/barcode lookup as an enhancement.
- **Expected user workflow:** Coordinator assigns/transfers a task; worker opens the permitted brief and updates work.
- **Dependencies:** 2.1.1–2.1.2, 1.3.4, 1.7.1.
- **Acceptance criteria:** Assignment and custody remain separate. Staff landing shows assigned work. Public scans reveal no private data; inactive workers remain historical.
- **Deliverable:** Accountable team workload and optional physical lookup.

#### Vertical Slice 2.3.2 — Plan Capacity and Review Commitment Risk

- **Purpose:** Improve scheduling beyond weekly category caps.
- **Functional requirements:** Use approved task effort/duration, skills, availability, holidays, dependencies, trial buffers and vendor lead times. Provide list, progress board, day/week scheduling and bottleneck views.
- **Expected user workflow:** Owner reviews a proposed date or queue change and its affected commitments.
- **Dependencies:** 2.3.1, 1.1.1, 1.6.2.
- **Acceptance criteria:** Missing estimates are disclosed. Active and waiting time differ. Queue movement never silently changes customer promises; authorised risky commitments retain reasons.
- **Deliverable:** Explainable team scheduling and capacity review.

#### Vertical Slice 2.3.3 — Calculate Labour Dues and Review Accepted Work

- **Purpose:** Pay for approved work without duplicated costs.
- **Functional requirements:** Version piece/time rates; record payable hours, acceptance basis, advances, partial settlement and disputes. Extend the MVP vendor-dues record; report accepted timeliness, rework and utilisation with cause context.
- **Expected user workflow:** Owner reviews accepted work, approves dues and records payment.
- **Dependencies:** 2.3.1, 1.7.4, 1.5.4.
- **Acceptance criteria:** Supplier bills, labour costs and advances are not double-counted. Owner labour estimates create no payable by default. Customer/supplier causes are distinguished; no opaque worker ranking or statutory payroll is added.
- **Deliverable:** Detailed worker/vendor settlement and contextual performance.

### Phase 2.4 — Expand Billing, Reconciliation and Business-Cost Visibility

**Objective:** Support more boutique billing regimes and clearer business finances.  
**Functional scope:** Conditional GST support, payment aids/imports, overheads and contribution reporting.  
**Dependencies:** Phase 1.4 and the relevant purchasing/workforce cost records.

#### Vertical Slice 2.4.1 — Activate Reviewed Registered-Shop Billing

- **Purpose:** Onboard composition/regular-GST shops only with supported documents.
- **Functional requirements:** Add accountant-approved effective classifications, value-dependent rate rules, declarations, tax splits, place of supply, invoice/advance requirements and correction controls. Provide appropriate accountant/Tally-import and GSTR-1 preparation exports.
- **Expected user workflow:** Owner/accountant verifies the regime and sample documents before activation.
- **Dependencies:** 1.4.4, 1.10.3; approved accountant configuration.
- **Acceptance criteria:** Composition bills collect no customer tax; regular-GST documents use reviewed rules. No universal rate/threshold is assumed. E-invoice/e-way-bill restrictions are recorded; those outputs remain external.
- **Deliverable:** Approved registered-shop billing and financial export support.

#### Vertical Slice 2.4.2 — Assist UPI Collection and Statement Reconciliation

- **Purpose:** Reduce manual matching while retaining human verification.
- **Functional requirements:** Offer amount/order-reference UPI QR and reviewed bank/UPI statement import. Match references/accounts, fees, pending/reversed events and settlement evidence.
- **Expected user workflow:** Owner requests payment, imports a statement and reviews proposed matches.
- **Dependencies:** 1.4.2, 1.9.2.
- **Acceptance criteria:** A QR does not prove payment. Repeated imports do not settle balances twice. Unmatched or ambiguous transactions require review; discrepancies preserve original documents.
- **Deliverable:** Optional payment aids and reviewed statement reconciliation.

#### Vertical Slice 2.4.3 — Record Overheads and Review Contribution

- **Purpose:** Separate fulfilment economics from cash flow and overall profit.
- **Functional requirements:** Record rent/utilities/other expenses, owner contributions/withdrawals and account transfers. Show estimated/actual direct contribution, missing costs and optional owner-labour/overhead allocations.
- **Expected user workflow:** Owner records expense type and reviews an order/shop cost report.
- **Dependencies:** 1.5.4, 1.9.4; supplier/labour extensions where enabled.
- **Acceptance criteria:** Transfers and deposits are not revenue. Owner withdrawals are not automatically operating expenses. Contribution is not labelled net profit; allocation assumptions and missing costs are visible.
- **Deliverable:** Business-cost records and honest contribution reporting.

### Phase 2.5 — Enable Ready-Made Retail and Linked Alterations

**Objective:** Add retail as a complete business workflow when required.  
**Functional scope:** Variants/stock, reservations, mixed checkout, linked alterations, returns/exchanges and reporting.  
**Dependencies:** Phases 1.4–1.8 and 2.2; applicable billing regime.

#### Vertical Slice 2.5.1 — Catalogue, Stock and Reserve Retail Variants

- **Purpose:** Sell or hold the exact available item.
- **Functional requirements:** Maintain style/size/colour/SKU/barcode, price/cost/supplier and active status. Track opening/received/reserved/saleable/damaged quantities and reservation expiry/deposit policy.
- **Expected user workflow:** Owner selects a variant, checks availability and reserves or releases it.
- **Dependencies:** 2.2.1–2.2.3, 1.4.2.
- **Acceptance criteria:** Overselling is prevented. Reservation is not sale or handover; cancellation settles deposits. Retail catalogue remains distinct from pattern libraries and mannequin history.
- **Deliverable:** Exact-variant retail inventory and reservation.

#### Vertical Slice 2.5.2 — Complete Mixed Checkout with Linked Alterations

- **Purpose:** Combine retail and services without conflating their fulfilment.
- **Functional requirements:** Add retail/custom/service lines to a booking with line-level discounts, treatment, costs and status. Link an alteration to its exact retail item, wearer, instructions, date, charge and worker.
- **Expected user workflow:** Owner sells the item, records payment and creates any alteration for the normal production/quality journey.
- **Dependencies:** 2.5.1, 1.2.2–1.2.3, 1.8.1–1.8.3.
- **Acceptance criteria:** Retail need not undergo custom production. Complimentary alteration preserves real cost. Stock, sale and alteration remain linked without duplicated revenue.
- **Deliverable:** Complete retail checkout and alteration fulfilment.

#### Vertical Slice 2.5.3 — Return, Exchange and Review Retail Outcomes

- **Purpose:** Resolve retail exceptions consistently.
- **Functional requirements:** Review altered/damaged eligibility and condition; link inbound/outbound exchange, credits/refunds, price differences and appropriate restocking. Review linked alteration/custody/irreversible work; report sales, returns, ageing and contribution.
- **Expected user workflow:** Owner inspects the original item and resolves the return/exchange and linked work.
- **Dependencies:** 2.5.2, 1.4.5, 1.8.4.
- **Acceptance criteria:** Exchanges do not overwrite the original sale. Altered items are not blindly restocked. Cancellation prompts alteration review; unresolved refund/property obligations remain visible.
- **Deliverable:** Governed retail returns and distinct retail reporting.

### Phase 2.6 — Enable Customer Participation and Controlled Communication

**Objective:** Let customers participate safely and reduce routine follow-up.  
**Functional scope:** Scoped access, customer requests, issues, reminder policies and official messaging.  
**Dependencies:** Role/privacy controls and the relevant MVP workflows.

#### Vertical Slice 2.6.1 — Open and Revoke a Private Booking View

- **Purpose:** Provide useful customer visibility without exposing wider history.
- **Functional requirements:** Offer branded booking-scoped access with expiry/revocation, approved scope, dates, appointments, selected progress and bills/receipts. Apply wearer/guardian restrictions and owner-assisted contact re-verification.
- **Expected user workflow:** Contact opens the shared booking view; owner can revoke it.
- **Dependencies:** 1.4.3–1.4.4, 2.1.1; approved access/confirmation channel.
- **Acceptance criteria:** Expired/revoked links show no order data and offer shop contact. Ordinary links do not expose measurements/fitting photos, margins or unrelated bookings. Phone changes revoke old links.
- **Deliverable:** Secure customer booking visibility.

#### Vertical Slice 2.6.2 — Review Customer Decisions, Appointments and Issues

- **Purpose:** Turn customer responses into governed business actions.
- **Functional requirements:** Accept/reject specific revisions, acknowledge dates, request appointments/alterations and report issues with evidence. Add granular approvals, appointment conflict/reschedule/cancel/no-show handling, quote-expiry follow-up and owned complaint resolution.
- **Expected user workflow:** Customer submits a response/request; owner reviews and accepts the resulting action.
- **Dependencies:** 2.6.1, 1.4.3, 1.6.1–1.6.2, 1.8.1.
- **Acceptance criteria:** Requests cannot directly change authoritative work. Approvals refer to the exact revision. Closed/converted/opted-out enquiries stop irrelevant follow-up; appointment changes do not silently revise delivery. Internal issue notes are not shared externally or used to label customers unfairly.
- **Deliverable:** Customer decisions and resolved service issues.

#### Vertical Slice 2.6.3 — Configure Reminder Policies

- **Purpose:** Define permitted follow-up before automating it.
- **Functional requirements:** Configure timing, frequency, quiet hours, escalation, snooze, consent and stop conditions for trials, collections, balances and stored property.
- **Expected user workflow:** Owner previews reminder eligibility and approves the policy.
- **Dependencies:** 1.4.3, 1.8.3–1.8.5, 2.6.1.
- **Acceptance criteria:** Service and marketing permissions remain separate. Settlement/handover stops the relevant reminder while preserving other obligations. Disputed/uncertain cases return for review.
- **Deliverable:** Reviewed reminder policies.

#### Vertical Slice 2.6.4 — Send Official Messages with Safe Failure Handling

- **Purpose:** Automate only authorised, current transactional messages.
- **Functional requirements:** Activate supported official messaging after number/template/budget approval. Recheck status, consent, timing, duplication and costs; record delivery/failure and preserve manual fallback.
- **Expected user workflow:** Owner enables a permitted reminder; product sends only while its conditions remain true.
- **Dependencies:** 2.6.3; approved WhatsApp Business Platform decision and access.
- **Acceptance criteria:** Newly confirmed payment suppresses a stale balance reminder. Retries do not duplicate sends. Opt-out/failure/limit is visible; shop work continues and prepared content remains available.
- **Deliverable:** Controlled transactional messaging and cost/failure visibility.

### Phase 2.7 — Complete the Physical-Mannequin Showcase

**Objective:** Turn actual shop displays into permission-controlled customer discovery.  
**Functional scope:** Mannequin history, publishing, public browsing and linked enquiries.  
**Dependencies:** Privacy/media controls and enquiry capture; independent of Instagram integration.

#### Vertical Slice 2.7.1 — Maintain Mannequins and Publish Costume History

- **Purpose:** Preserve the shop’s changing physical displays.
- **Functional requirements:** Create any number of identified mannequins; record dated costume photos, fabric/description/notes and cover choice. Support draft/published/archived states, date corrections and withdrawal.
- **Expected user workflow:** Owner records a costume change, reviews rights and publishes selected assets.
- **Dependencies:** 1.1.3, 1.3.1; approved publication policy.
- **Acceptance criteria:** A fourth mannequin is supported. Changes retain chronology. Private fitting/reference media and minor images cannot appear through incidental upload or publication.
- **Deliverable:** Controlled physical-mannequin costume history.

#### Vertical Slice 2.7.2 — Browse the Public Showcase and Enquire

- **Purpose:** Convert approved display interest into traceable enquiries.
- **Functional requirements:** Provide a sign-in-free gallery landing, recent uploads, individual mannequin history and image-specific enquiry route. Keep private order services deliberate and separate.
- **Expected user workflow:** Visitor opens a published costume and asks about it.
- **Dependencies:** 2.7.1, 1.6.1.
- **Acceptance criteria:** Only published assets appear. The reference carries into the enquiry without becoming a retail SKU, fixed price or guaranteed pattern. Staff/owner landing remains role-appropriate.
- **Deliverable:** Public mannequin discovery and enquiry conversion.

### Phase 2.8 — Introduce Reviewed Drafting Calculation Sheets

**Objective:** Assist traditional drafting before automated pattern geometry.  
**Functional scope:** Formula governance, provenance and shareable calculation sheets.  
**Dependencies:** Authoritative measurements/design; independent second reviewer for approved derived outputs.

#### Vertical Slice 2.8.1 — Review Formula Versions and Supported Ranges

- **Purpose:** Establish expert authority for derived drafting values.
- **Functional requirements:** Record owner/independent reviewer, approved measurement forms, formula versions, allowable variation, fabric assumptions and validation evidence. Separate draft and approved status.
- **Expected user workflow:** Experts review a rule version and its explicitly supported inputs.
- **Dependencies:** 1.3.1–1.3.3; named second reviewer and validation decisions.
- **Acceptance criteria:** Author cannot be sole approver. Unreviewed rules cannot become approved production outputs; unsupported inputs are explicit.
- **Deliverable:** Expert-reviewed drafting-rule catalogue.

#### Vertical Slice 2.8.2 — Generate and Share a Drafting Calculation Sheet

- **Purpose:** Give the owner traceable dimensions for manual drafting.
- **Functional requirements:** Compute supported dimensions from exact measurement/design/formula versions; record provenance, assumptions and review status. Produce previewable PDF, A4 default and sharing instructions; flag changed-input sheets stale.
- **Expected user workflow:** Owner selects current inputs, reviews calculations and drafts traditionally.
- **Dependencies:** 2.8.1, 1.3.2–1.3.3.
- **Acceptance criteria:** A rule lacking both approvals carries “unvalidated — check before cutting” and cannot be recorded as approved cutting output. No pattern shapes or guaranteed fit are implied.
- **Deliverable:** Versioned drafting calculation sheets.

### Phase 2.9 — Add Measurable, Reviewed AI Assistance

**Objective:** Test whether assistance reduces real work after review and correction.  
**Functional scope:** Enablement/evaluation, intake/follow-up, quote checks, reference tagging and document extraction.  
**Dependencies:** Stable manual workflows; approved processing policy and feature-specific evaluation.

#### Vertical Slice 2.9.1 — Enable, Evaluate and Disable Assistance

- **Purpose:** Introduce AI under explicit product and data-use controls.
- **Functional requirements:** Explain externally processed content/terms; restrict to authorised minimal records; control capabilities/usage. Record proposals separately from confirmed facts, feedback, reversible undo and manual fallback. Customer content is not used for external-provider training by default; no cross-boutique learning is introduced.
- **Expected user workflow:** Owner reviews policy, trials a capability and accepts, rejects or disables it.
- **Dependencies:** 1.10.2, 2.1.3; approved error limits/evaluation sample.
- **Acceptance criteria:** Non-compliant processing remains disabled. Outage/limit preserves permitted manual work. Evaluation includes review time, critical errors, cost and eventual outcomes; uploaded instructions cannot authorise actions. No AI approval substitutes for validated arithmetic, payment verification or expert drafting approval.
- **Deliverable:** Governed AI enablement and outcome evaluation.

#### Vertical Slice 2.9.2 — Draft Intake and Ask Relevant Follow-Up Questions

- **Purpose:** Reduce entry effort without guessing important facts.
- **Functional requirements:** Interpret supplied Tamil/English/mixed-language speech, text or notes into draft enquiries/orders. Link values to sources; highlight uncertainty and ask only unresolved checklist questions.
- **Expected user workflow:** Owner supplies content, reviews proposals and confirms the resulting draft.
- **Dependencies:** 2.9.1, 1.2.1, 1.6.1.
- **Acceptance criteria:** Uncertain names, numbers, units and dates remain unconfirmed. No measurements or rules are invented. Answered/not-required questions are skipped; repeated attempts create no duplicates.
- **Deliverable:** Reviewed assisted intake with complete manual alternatives.

#### Vertical Slice 2.9.3 — Review Quote Completeness Suggestions

- **Purpose:** Find genuine omissions before agreement.
- **Functional requirements:** Compare requested work/material source with quote inclusions and suggest missing/duplicate charges or unanswered pricing.
- **Expected user workflow:** Owner reviews source-linked suggestions and accepts/rejects each before a quote revision.
- **Dependencies:** 2.9.1, 1.4.1–1.4.3.
- **Acceptance criteria:** Bundled, complimentary and customer-supplied lines are respected. No charge changes automatically. False suggestions are recorded in evaluation.
- **Deliverable:** Human-reviewed scope/quote completeness assistance.

#### Vertical Slice 2.9.4 — Structure Supplied Design References

- **Purpose:** Speed up clarification of garment choices.
- **Functional requirements:** Suggest neckline/sleeve/embellishment tags and clarification questions from supplied images; retain source and uncertainty.
- **Expected user workflow:** Owner reviews proposed tags before updating the specification.
- **Dependencies:** 2.9.1, 1.3.1.
- **Acceptance criteria:** Images do not produce authoritative body dimensions, hidden construction or guaranteed fabric quantities. Accepted interpretation still follows normal approval.
- **Deliverable:** Reviewed design-reference structuring.

#### Vertical Slice 2.9.5 — Extract Reviewed Document Entries

- **Purpose:** Reduce entry effort for bills, expenses and legacy work.
- **Functional requirements:** Present source beside proposed supplier-bill, expense and legacy-order fields; flag unreadable amounts/dates/references and potential duplicates.
- **Expected user workflow:** Owner corrects the draft and separately approves the business record.
- **Dependencies:** 2.9.1, 2.2.3, 2.4.3, 1.10.1.
- **Acceptance criteria:** Financial/opening confirmation requires human review. Repeated extraction does not duplicate records. Instructions embedded in documents cannot change charges or reveal unrelated data.
- **Deliverable:** Source-linked reviewed document entry.

### Phase 2.10 — Review Acquisition and Marketing Using Manual Data

**Objective:** Connect marketing activity to verified boutique outcomes before integrations.  
**Functional scope:** Attribution policy, campaign inputs, outcomes, contribution and business actions.  
**Dependencies:** Source-linked enquiries, authoritative finance and cost records.

#### Vertical Slice 2.10.1 — Define Attribution and Enter Campaign Evidence

- **Purpose:** Make marketing assignment explicit rather than guessed.
- **Functional requirements:** Configure model/window, repeat enquiries and multi-touch treatment. Enter/import campaign dates, channel, spend and supported metrics with evidence, source definitions and unknown share.
- **Expected user workflow:** Owner approves the policy and reviews campaign/enquiry assignments.
- **Dependencies:** 1.6.3, 1.6.1; approved attribution/reporting basis.
- **Acceptance criteria:** Multiple touches do not duplicate full order revenue. Platform-reported conversions remain separate from verified orders. Manual data is labelled; unsupported placement splits remain unavailable.
- **Deliverable:** Reviewable attribution and manual advertising inputs.

#### Vertical Slice 2.10.2 — Review Campaign Outcomes and Create Business Actions

- **Purpose:** Support human decisions using honest commercial measures.
- **Functional requirements:** Report qualified enquiries, confirmed orders, attributed net revenue, cost per enquiry/order, ROAS and contribution after advertising. Provide comparisons, freshness/correction history, filters, drill-down and owned review actions.
- **Expected user workflow:** Owner inspects a result, opens contributing records and assigns a pricing, collection, rework or marketing review.
- **Dependencies:** 2.10.1, 1.9.3–1.9.4, 2.4.3.
- **Acceptance criteria:** ₹2,000 revenue/₹900 direct costs/₹200 ads yields ₹1,100 contribution, 10× ROAS and ₹900 contribution after ads. Zero denominators show N/A; credits/returns apply consistently. No autonomous budget changes occur.
- **Deliverable:** Defined marketing outcomes and actionable business review.

### Phase 2.11 — Support Conditional Commercial Subscription Operation

**Objective:** Make paid external use understandable and sustainable.  
**Functional scope:** Plans/allowances, usage, renewal, exit and record access.  
**Dependencies:** Validated external onboarding; approved commercial terms. Founding boutique remains free.

#### Vertical Slice 2.11.1 — Explain Plans, Usage and Paid Allowances

- **Purpose:** Prevent hidden limits and uncontrolled service costs.
- **Functional requirements:** Show selected plan, included users/features, AI/message/media allowances, usage and approved overage. Support internal cost-to-serve review; collect per-shop media, messaging, AI usage and support effort from the pilot onward, even before subscriptions are activated.
- **Expected user workflow:** External owner reviews the offer and approves the permitted paid usage.
- **Dependencies:** 2.1.4; approved prices, allowances and support model.
- **Acceptance criteria:** No unlimited-cost promise is assumed. Limits cannot weaken isolation, financial accuracy or historical records. Founding-shop free use is preserved.
- **Deliverable:** Clear conditional subscription administration.

#### Vertical Slice 2.11.2 — Renew, Cancel and Export on Exit

- **Purpose:** Preserve trustworthy records during subscription changes.
- **Functional requirements:** Explain renewal/cancellation, approved grace/read-only states, export period, retention and deletion; expose outstanding business obligations.
- **Expected user workflow:** Owner changes/cancels the plan and retrieves records within published terms.
- **Dependencies:** 2.11.1, 1.10.2–1.10.3.
- **Acceptance criteria:** Expiry does not fabricate settlement or silently erase obligations. Allowed manual/read-only access and exports behave as stated; retention outcomes are explicit.
- **Deliverable:** Governed commercial lifecycle and exit.

---

## 4. Wave 3 — Advanced Capabilities: Validated Production and Contextual Intelligence

**Objective:** Add specialist and differentiating capabilities grounded in trustworthy data and expert validation.

**Business value:** Improve drafting support, fit recall, explainable follow-through and marketing visibility without turning estimates or model proposals into unsupported facts.

**Scope:** Seam presets, supported 2D pattern generation, fabric estimates, true-scale PDFs, physical validation/release, conditional Instagram/advertising connections and contextual AI assistance.

**Dependencies:** Stable earlier workflows; expert-reviewed rules; physical validation; usable historical outcomes; approved third-party access and feature-specific evaluation.

**Completion criteria:**

- Every enabled pattern combination has the required rule, print and physical-validation evidence.
- Unsupported inputs and stale outputs cannot be released for cutting.
- Integrated content preserves separation, freshness and manual fallbacks.
- Advanced assistance passes agreed benefit/error criteria and preserves human authority.
- All applicable post-pilot scenarios pass.
- Remaining unactivated conditional capabilities are explicitly listed with their unmet gate.

### Phase 3.1 — Generate, Print and Release Validated Patterns

**Objective:** Deliver supported automated cutting outputs with explicit provenance and physical evidence.  
**Functional scope:** Allowances, geometry, calculation summaries, fabric estimates, printing and production release.  
**Dependencies:** Phase 2.8, authoritative measurements/design and reviewer-approved specialist scope.

#### Vertical Slice 3.1.1 — Create and Apply Seam-Allowance Presets

- **Purpose:** Apply approved allowances appropriate to the garment.
- **Functional requirements:** Configure category/subcategory-specific seam positions, units and values. Create/use presets, preview mapping and permit order-only overrides without changing reusable versions.
- **Expected user workflow:** Owner selects the applicable preset or creates a reviewed version.
- **Dependencies:** 2.8.1, 1.3.1–1.3.2.
- **Acceptance criteria:** No universal or unapproved seam values are inserted. Preset changes preserve historical outputs; overrides remain order-specific.
- **Deliverable:** Versioned approved allowance selection.

#### Vertical Slice 3.1.2 — Generate and Compare Supported 2D Previews

- **Purpose:** Make the computed pattern understandable before release.
- **Functional requirements:** Generate approved-scope pieces with names, dimensions, cutting/stitching lines, allowances and expert-defined grain/fold/count/orientation markings. Show inputs, formulas, derived values, warnings and regenerated versions.
- **Expected user workflow:** Owner selects supported current inputs, reviews the preview and compares versions.
- **Dependencies:** 3.1.1, 2.8.1–2.8.2.
- **Acceptance criteria:** Unsupported combinations are blocked. Exploratory output is not cutting approval. Input changes flag unused outputs stale; previously cut output remains recorded. Provenance identifies exact source versions.
- **Deliverable:** Versioned supported pattern previews and calculation summaries.

#### Vertical Slice 3.1.3 — Produce a Validated-Scope Fabric Estimate

- **Purpose:** Help review material sufficiency without inventing placement accuracy.
- **Functional requirements:** Estimate using approved width, direction/nap, repeat, shrinkage and placement considerations only where supported. Expose assumptions and physical-confirmation needs.
- **Expected user workflow:** Owner reviews the estimate against actual available fabric and conditions.
- **Dependencies:** 3.1.2, 1.5.1–1.5.2; validated estimation rules.
- **Acceptance criteria:** Unsupported considerations remain labelled. Unknown width cannot silently become a standard width. An estimate does not authorise insufficient fabric or imply advanced nesting.
- **Deliverable:** Traceable fabric estimates with explicit limits.

#### Vertical Slice 3.1.4 — Export and Check True-Scale Pattern PDFs

- **Purpose:** Make supported patterns usable on ordinary printers.
- **Functional requirements:** Preview paper/tiles/page count; export 1:1 A4-default/A3 PDFs with tile labels, alignment/overlap/trim instructions, assembly order, calibration ruler/square and version. Include prominent Actual Size/100% instructions.
- **Expected user workflow:** Owner exports/shares, prints and measures calibration before use.
- **Dependencies:** 3.1.2; approved paper/printer assumptions.
- **Acceptance criteria:** A4 use needs no A3 printer. Third-party printing retains calibration instructions. Failed calibration blocks cutting use; PDF availability supports shops with no printer.
- **Deliverable:** Calibratable true-scale pattern printing and sharing.

#### Vertical Slice 3.1.5 — Validate Supported Scope and Release Cutting Work

- **Purpose:** Require evidence before production claims.
- **Functional requirements:** Maintain a matrix of garment type, measurement range, fabric class, design combination, physical garments tested and review results. Record print checks and approved release; share piece checklists and expert cutting/assembly notes.
- **Expected user workflow:** Reviewers validate the supported combination; owner releases a current output only after task readiness.
- **Dependencies:** 3.1.2–3.1.4, 1.7.1; both reviewers’ approval.
- **Acceptance criteria:** Reviewer-confirmed tolerances govern calibration/alignment/dimensions. Proposed starting tolerances are ±1 mm/10 cm, ±2 mm tile alignment and ±3 mm key dimensions until confirmed. Release also requires current approvals/materials/assignee. Updates never silently replace already-used cutting output.
- **Deliverable:** Physically validated pattern scope and governed production handoff.

### Phase 3.2 — Connect Read-Only Social and Advertising Data

**Objective:** Add supported external visibility without compromising manual operation.  
**Functional scope:** Conditional Instagram viewer and Google/Meta advertising inputs.  
**Dependencies:** Demonstrated owner value, approved account access and connection policies. Neither integration blocks operations or the mannequin gallery.

#### Vertical Slice 3.2.1 — Connect and Refresh the Instagram Viewer

- **Purpose:** Show supported existing posts with honest freshness.
- **Functional requirements:** Provide authorised connect/reconnect/revoke/disconnect, supported-account prerequisites, available media/captions/dates/open-post actions and refresh/retry status. Keep social posts distinct from mannequins, private references and retail.
- **Expected user workflow:** Owner connects the account and refreshes the read-only feed.
- **Dependencies:** 2.1.3; owner-value/access approval.
- **Acceptance criteria:** Failed refresh retains last successful content and its age. No password sharing, publishing/scheduling or guaranteed unsupported access is introduced. Linking does not automatically create another content type.
- **Deliverable:** Conditional read-only Instagram viewer.

#### Vertical Slice 3.2.2 — Synchronise Supported Advertising Inputs

- **Purpose:** Replace eligible manual entry with source-labelled platform evidence.
- **Functional requirements:** Connect supported Google Ads/Meta inputs; preserve campaign definitions, available metrics, import/correction history and freshness. Identify Instagram-placement spend only where supported; retain manual fallback.
- **Expected user workflow:** Owner authorises sync, reviews changed campaign data and existing attribution reports.
- **Dependencies:** 2.10.1–2.10.2, 2.1.3; approved account access/refresh expectations.
- **Acceptance criteria:** Mixed Meta spend is not labelled Instagram-only. Late/provisional values are visible. Refresh failures preserve prior data; retry cannot double-count spend or conversions.
- **Deliverable:** Conditional connected advertising review.

### Phase 3.3 — Add Contextual Fit, Risk and Action Assistance

**Objective:** Help the owner act on known records without handing consequential decisions to AI.  
**Functional scope:** Fit reuse, delivery-risk explanation, operational questions and reminder proposals.  
**Dependencies:** Phase 2.9 controls and sufficiently useful underlying histories.

#### Vertical Slice 3.3.1 — Recall Contextual Fit for Repeat Work

- **Purpose:** Reuse successful fit knowledge selectively.
- **Functional requirements:** Retrieve suitable prior accepted garments for the authorised wearer; show corrections, source, fabric and construction. Provide manual contextual retrieval plus reviewed AI questions/reuse proposals.
- **Expected user workflow:** Owner compares previous garments and explicitly applies relevant choices to a new order.
- **Dependencies:** 1.8.1, 1.2.4, 2.9.1.
- **Acceptance criteria:** Fabric-specific corrections do not alter every body measurement or unrelated garment. Wrong-context suggestions can be rejected and evaluated; no guaranteed fit is claimed.
- **Deliverable:** Reviewed contextual fit reuse and source-linked assistance.

#### Vertical Slice 3.3.2 — Explain Delivery Risk and Propose Actions

- **Purpose:** Turn known blockers into useful intervention.
- **Functional requirements:** Explain risk from missing materials, blocked tasks, vendor dates, trials and capacity; identify affected work and propose actions. Begin with transparent rules; activate predictive estimates only after data/evaluation gates.
- **Expected user workflow:** Owner reviews evidence and accepts a follow-up or coordination action.
- **Dependencies:** 2.3.2, 1.9.2–1.9.3, 2.9.1.
- **Acceptance criteria:** Missing data and uncertainty are explicit. Dates, assignment and promises never change silently. False alarms and actual original-promise outcomes are evaluated.
- **Deliverable:** Explainable, evaluated delivery-risk assistance.

#### Vertical Slice 3.3.3 — Answer Operational Questions and Draft Next Reminders

- **Purpose:** Reduce time between finding a problem and taking the right action.
- **Functional requirements:** Answer permitted operational questions from source records with known/unknown distinctions. Draft collection/payment messages using current balance, handover and consent; link proposals to actual actions and outcomes.
- **Expected user workflow:** Owner asks a question, opens evidence and reviews a suggested action/message.
- **Dependencies:** 1.9.1–1.9.4, 2.9.1; 2.6.3–2.6.4 only for automated sending.
- **Acceptance criteria:** No invented profit, cause or deadline. Current state is rechecked before action. Disputed/unusual reminders require owner review; manual sending remains available and the ordinary workspace remains usable.
- **Deliverable:** Source-linked operational answers and reviewed follow-through.

---

## 5. Consolidated Implementation Order and Dependencies

Phase order is the recommended implementation sequence. Slice dependency lists identify direct prerequisites; they do not make every earlier capability an unnecessary dependency. Later enhancements referenced inside a slice’s functional scope are integration points, not prerequisites for its base delivery. Registered billing and automatic sending are conditional activation gates for their particular variants.

| Order | Phase | Incremental functional outcome |
|---:|---|---|
| 1 | 1.1 | Configure the shop and register authorised customers/wearers. |
| 2 | 1.2 | Capture recoverable garment, outfit and service orders. |
| 3 | 1.3 | Establish design, measurement and manual production instructions. |
| 4 | 1.4 | Agree prices and maintain trustworthy customer money/documents. |
| 5 | 1.5 | Receive, locate, allocate and cost materials/property. |
| 6 | 1.6 | Convert enquiries and schedule necessary interactions. |
| 7 | 1.7 | Execute owner/artisan work and reconcile vendor obligations. |
| 8 | 1.8 | Complete fitting, quality, partial handover and exceptions. |
| 9 | 1.9 | Run daily actions and review dependable results. |
| 10 | 1.10 | Reconcile migration and pass live-pilot readiness. |
| Gate | Founding pilot | Evaluate adoption, business outcomes and sustainable support. |
| 11 | 2.1 | Enable governed teams and independent shops. |
| 12 | 2.2 | Complete material purchasing and supplier reconciliation. |
| 13 | 2.3 | Coordinate team capacity, workload and labour settlement. |
| 14 | 2.4 | Support reviewed billing regimes and richer finance. |
| 15 | 2.5 | Enable complete retail workflows when needed. |
| 16 | 2.6 | Add secure customer participation and conditional messaging. |
| 17 | 2.7 | Complete independent mannequin discovery/enquiry. |
| 18 | 2.8 | Introduce traceable drafting calculation sheets. |
| 19 | 2.9 | Evaluate initial reviewed AI assistance. |
| 20 | 2.10 | Review manual campaign attribution and commercial outcomes. |
| 21 | 2.11 | Activate commercial plans only when external shops are charged. |
| 22 | 3.1 | Release physically validated generated patterns and true-scale output. |
| 23 | 3.2 | Connect supported social/advertising data where justified. |
| 24 | 3.3 | Add evaluated contextual fit, risk and action assistance. |

### 5.1 Delivery checkpoints

- **Recoverable intake:** Phases 1.1–1.3 demonstrate a customer/wearer-to-garment record with clear missing inputs.
- **Commercial/material readiness:** Phases 1.4–1.5 demonstrate approval, advance receipt, custody and explainable production blockers.
- **First complete business journeys:** Phases 1.6–1.8 demonstrate custom stitching, lightweight alteration and outsourced Aari through handover/settlement.
- **Live MVP:** Phases 1.9–1.10 add daily control and complete the mandatory pilot gates.
- **Expansion-ready operation:** Phase 2.1 provides shared-access readiness; every shop also passes its applicable billing and module gates.
- **Specialist readiness:** Drafting sheets precede geometry; calibrated printing and physical evidence precede cutting release.

### 5.2 Independent workstreams

Once their direct prerequisites are complete, purchasing, gallery, customer participation, drafting and manual marketing review can progress independently.

Retail does not depend on AI, drafting or social integrations. Mannequin discovery does not depend on Instagram. Initial AI does not depend on generated patterns. Advanced reminder assistance does not require automatic sending.

If a capability moves earlier, its relevant permissions, settlement, history, recovery and validation move with it.

---

## 6. Requirements-to-Roadmap Traceability

All 241 numbered requirements have delivery responsibility below. Numeric shorthand uses the family prefix in the first column: for example, **MEA 01–07** means **MEA-01 through MEA-07**. Inclusive ranges account for every identifier in that range.

Multiple slices indicate a deliberate minimum-to-full expansion, not duplicated ownership of the same business event.

| Requirement family | Requirement identifiers → responsible slices |
|---|---|
| **SET — 12** | 01, 02, 05, 06, 08, 09, 11 → **1.1.1**; 03, 04, 10 → **1.1.2**; 07 → **1.1.1** payment/vendor setup, **2.1.1** staff extension; 12 → **1.8.5**. |
| **CUS — 9** | 01, 02, 04, 07 → **1.1.3**; 03, 05, 06 → **1.2.4**; 08 → **2.6.2**; 09 → **1.10.2**. |
| **ENQ — 8** | 01–04 → **1.6.1**; 05 → **1.6.2**; 06–07 → **2.6.2**; 08 → **1.6.3**. |
| **ORD — 14** | 01, 04–06, 11 → **1.2.1**, with governed exceptions completed by **1.7.2/1.8.4**; 02, 13 → **1.2.2**, fulfilment by **1.8.3**; 03 → **1.2.2** custom/service mixture, **2.5.2** retail extension; 07 → **1.3.1**; 08, 12 → **1.2.4**; 09 → **1.4.3**; 10 → **1.3.4**, optional scanning **2.3.1**; 14 → **1.2.3** services and **1.2.2** packages. |
| **DES — 11** | 01–05, 10 → **1.3.1**; 06, 08–09, 11 → **1.4.3**; 07 → **2.6.2**. |
| **MAT — 13** | 01, 02, 04 → **1.5.1**; 03, 13 → **1.5.2**; 05 → **1.5.3**; 06, 07, 11 → **2.2.1**, minimum explicit-unit/opening controls **1.5.3/1.10.1**; 08 → **2.2.2**; 09 → **1.7.3–1.7.4**; 10, 12 → **1.5.5**. |
| **PUR — 7** | 01–02 → **2.2.2**; 03 → minimum cost evidence **1.5.4**, full purchase record **2.2.2**; 04–05 → **2.2.3**; 06–07 → **2.2.4**. |
| **MEA — 11** | 01–07, 11 → **1.3.2**; 08–09 → **1.8.1**; 10 → **3.3.1**, with manual previous-record access already available through **1.2.4**. |
| **PAT — 17** | 01, 03 → **1.3.3**; 02 → **2.8.1**; 04–05 → **3.1.1**; 06 → **2.8.2/3.1.2**; 07 → **2.8.2/3.1.2/3.1.5**; 08–09, 15 → **3.1.2**; 10 → **3.1.3**; 11–12 → **3.1.4**; 13–14 → **3.1.5**; 16 → **2.8.2**; 17 → **2.8.2/3.1.4**. |
| **JOB — 16** | 01–05 → **1.7.1**; 06 → **1.7.2**; 07 → **1.7.4**; 08–09 → **1.8.1**, standalone intake **1.2.3**; 10–11 → **1.8.2**; 12–13 → **1.8.3**; 14–15 → **1.8.4**; 16 → **1.7.3**. |
| **OPS — 11** | 01, 04 → minimal artisan profiles **1.7.3**, team extension **2.1.1**; 02–03 → **2.3.1**; 05–07 → **2.3.2**; 08–10 → **2.3.3**; 11 → **1.7.4**. |
| **FIN — 21** | 01–04 → **1.4.1**; 05, 10–13 → **1.4.2**; 06–09, 21 → **1.4.4**, registered regimes **2.4.1**; 14 → **1.4.5**; 15 → **1.8.3**; 16 → **1.9.2/2.4.2**; 17 → **1.5.4**; 18–19 → **2.4.3**; 20 → **1.10.3/2.4.1**, authority controls in each financial slice. |
| **RTL — 8** | 01–02, 04 → **2.5.1**; 03, 05 → **2.5.2**; 06–08 → **2.5.3**. |
| **COM — 11** | 01–02 → **2.6.1**; 03, 11 → **2.6.2**; 04, 06–08 → **1.4.3**, other manual notices **1.6.2/1.8.3/1.8.5**; 05, 10 → **2.6.4**; 09 → **2.6.3**. |
| **DAY — 10** | 01–02, 06–10 → **1.9.2**; 03–04 → **1.9.1**; 05 → **2.3.2**. |
| **SHO — 10** | 01–02, 04, 06 → **2.7.1**; 03, 05 → **2.7.2**; 07–10 → **3.2.1**. |
| **REP — 14** | 01, 06 → **1.9.3**, complaint extension **2.6.2**; 02, 04 → **1.9.4**, supplier/worker extension **2.2.3/2.3.3**; 03 → **2.4.3**, minimum cost visibility **1.9.4**; 05 → **2.2.4/2.5.3**, custody lookup **1.9.1**; 07 → **1.6.3**; 08 → optional pilot monthly entry **1.6.3**, manual campaign data **2.10.1**, connected data **3.2.2**; 09 → **2.10.1**; 10–14 → **2.10.2**, connected freshness **3.2.2**. |
| **AI — 10** | 01–02 → **2.9.2**; 03 → **2.9.3**; 04 → **3.3.2**; 05 → **3.3.1**; 06, 09 → **3.3.3**; 07 → **2.9.4**; 08 → **2.9.5**; 10 → **2.9.1**. |
| **TRU — 13** | 01, 03–05, 07, 13 → **1.1.3** and every applicable slice; 02 → **2.1.1–2.1.2**; 06, 12 → attributable records in **1.2.4** and every consequential slice; 08 → **1.10.2**; 09 → **2.1.1/2.1.3/2.6.1**; 10 → **1.10.4**; 11 → **2.1.3**, connection controls **2.6.4/3.2.1/3.2.2**. |
| **USE — 9** | 01–02, 09 → every slice, release verification **1.10.4** and subsequent wave gates; 03–04, 08 → **1.2.1** and every editing/consequential workflow; 05 → **1.10.1**; 06 → **1.10.3**; 07 → **1.3.4** and every document/media-producing slice. |
| **BIZ — 6** | 01 → **1.10.4**, practice/reusable onboarding **2.1.4**; 02 → **2.1.4**; 03 → **2.1.3**; 04 → **2.11.1**; 05 → **2.11.2**; 06 → **1.10.3**. |

### 6.1 Coverage of non-numbered product requirements

| Source content | Roadmap responsibility |
|---|---|
| §§1–2: vision, business outcomes, differentiation and recorded scope | Wave objectives, assumptions, Simple mode, specialist paths and business-outcome evaluation. |
| §§3–4: terminology, actors, landing experiences | Order/piece/booking distinctions; **1.1.3**, **2.1**, **2.6**, **2.7** and global role rules. |
| §5: custom, repeat, family, retail and exception journeys | **1.2–1.8**, **2.5**, with complete-journey release checks. |
| §23.3–23.4: AI scorecard and non-negotiable controls | **2.9.1** plus every AI slice and specialist human-approval boundary. |
| §27: lifecycle dimensions, transitions, gates and booking aggregation | Global slice rules; **1.4.3–1.4.5**, **1.7**, **1.8**, **2.5–2.6**, **3.1.5**. |
| §28: metrics, baseline, adoption and go/no-go | **1.9**, **1.10.4**, **2.9.1**, **2.10.2** and expansion gates. |
| §29: committed versus provisional allocation | Wave 1 Must preservation and explicitly identified Should/conditional extensions. |
| §30: acceptance scenarios | Full scenario mapping below. |
| §31: exclusions and optional extensions | Scope boundary register below; no hidden dependencies. |
| §32: business configuration and validation decisions | Assumptions and activation-gate register below. |
| §33: feature, pilot, shared-use and specialist readiness | Global slice completion rules and wave completion criteria. |

### 6.2 Acceptance-scenario traceability

These are planned functional checks, not claims that software has already been implemented or tested.

| Scenarios | Responsible slices / release check |
|---|---|
| AC-01 | **1.2.2**, **1.9.4** — independent garments and no duplicated revenue. |
| AC-02 | **1.1.3**, **1.2.4**, **2.6.1** — shared phone, distinct wearers/access. |
| AC-03–AC-04 | **1.4.2/1.4.4**, **1.5.1**, **1.7.1** — action-specific checks and explicit not-required state. |
| AC-05 | **1.4.3** — changed reference after irreversible work. |
| AC-06 | **1.3.2** measurement versions; **3.1.1–3.1.2** seam/pattern versions. |
| AC-07–AC-08 | **1.3.1–1.3.3** — inactive types and manual unsupported-pattern path. |
| AC-09–AC-10 | **3.1.2**, **3.1.4–3.1.5** — printing, validation and stale-output release. |
| AC-11–AC-12 | **1.7.1** — assignment and differing task dependencies. |
| AC-13–AC-14 | **1.7.4**, **1.5.5/1.8.3** — vendor return and residual property. |
| AC-15–AC-16 | **1.8.1–1.8.2**, **1.9.3** — correction and invalidated readiness. |
| AC-17–AC-18 | **1.4.2** — allocations, pending evidence and repeated confirmation. |
| AC-19–AC-20 | **1.4.5** — reversal, credit and refund distinctions. |
| AC-21–AC-22 | **1.8.3–1.8.4** — credit handover and post-cut cancellation. |
| AC-23 | **1.5.3–1.5.4** — stock consumption cost without purchase duplication. |
| AC-24 | **2.2.3** — partial receipt versus supplier payable. |
| AC-25–AC-26 | **2.5.2–2.5.3** — complimentary alteration and altered-item return. |
| AC-27–AC-28 | **1.9.3**, **1.9.2** — original promise and local-date warnings. |
| AC-29 | **2.7.1–2.7.2** — unlimited configured mannequin count and history. |
| AC-30 | **3.2.1–3.2.2** — failed refresh and retained successful data. |
| AC-31–AC-32 | **2.10.1–2.10.2** — attribution, commercial measures and N/A denominators. |
| AC-33–AC-34 | **2.9.2–2.9.3** — uncertain intake and bundled-price false suggestions. |
| AC-35 | **3.3.1** — context-specific fit reuse. |
| AC-36–AC-37 | **2.6.3–2.6.4**, **3.3.3** — stale reminder, opt-out and failure. |
| AC-38 | **2.1.3** before second-shop use; repeat against **2.6** and **2.9/3.3**. Owner access boundaries already apply in Wave 1. |
| AC-39 | **1.1.3**, **2.7.1** — private media excluded from gallery. |
| AC-40 | **1.2.1** and editing workflows — honest online save/retry behaviour. |
| AC-41–AC-42 | **1.10.1**, **1.10.3** — opening duplication and understandable export. |
| AC-43 | **2.9.1**, **2.11.1–2.11.2** — AI/plan limits and permitted fallback. |
| AC-44 | **1.1.1**, **1.4.4**, **2.4.1** — incomplete commercial/tax configuration. |
| AC-45 | **2.9.1/2.9.5** — uploaded instructions lack authority. |
| AC-46 | **3.2.2** — mixed-placement advertising labels. |
| AC-47 | **1.9.3** — cancellation after due remains in original cohort. |
| AC-48 | **2.9.1** — unavailable compliant external processing. |
| AC-49 | **1.4.2** — exact ₹334/₹333/₹333 allocation. |
| AC-50 | **1.2.3**, **1.5.1**, **1.7.1**, **1.8.1–1.8.3** — full standalone alteration journey. |
| AC-51 | **1.8.4**, **1.4.5** — fulfilled-with-cancellations and residual obligations. |
| AC-52–AC-53 | **1.10.2**, **1.1.3** — consent/deletion and guardian authority. |
| AC-54 | **2.6.1** — expired/revoked private access. |
| AC-55 | **1.2.1** and all protected editing workflows; shared-user verification in **2.1**. |
| AC-56–AC-57 | **1.10.4**, **2.1.1** — recovery without repeated actions and immediate departure revocation. |
| AC-58–AC-59 | **1.5.3**, **1.2.1/1.2.4** — remnant cost and fast repeat intake. |
| AC-60–AC-62 | **1.1.1**, **1.4.2**, **1.9.2** — capacity/rush, duplicate UTR and till discrepancy. |
| AC-63 | **1.2.2**, **1.8.3** — partial outfit-piece handover. |
| AC-64 | **1.3.4** — printer-free job slip; **3.1.4–3.1.5** — A4 calibrated pattern. |
| AC-65–AC-66 | **2.8.2**, **1.7.4** — unvalidated drafting label and accepted artisan dues. |

---

## 7. Business Decisions and Activation Gates

### 7.1 Before founding-pilot live use

All source §32.2 decisions remain mandatory. The roadmap groups them for review without removing any decision.

| Gate | Required approval / evidence | Dependent delivery |
|---|---|---|
| Supported service content | Owner approves categories, outfit pieces, add-ons and initial catalogue. | **1.1.2–1.2.3** |
| Authoritative measurement use | Owner approves per-piece forms, precision, default quarter-inch entry and validation tolerances. Second reviewer is required before derived output approval. | **1.3.2**, later **2.8** |
| Commercial agreement | Owner approves rates, Aari grades, rush/discount rules, quote validity, advances, changes, alteration/cancellation/refund and credit policies. | **1.4**, **1.8** |
| Live documents and accounts | Owner/accountant approves non-tax formats, numbering/corrections and any optional turnover alert; owner confirms receiving accounts. | **1.4.2/1.4.4** |
| Materials and costs | Owner reconciles opening balances and purchase-unit costing. | **1.5.3–1.5.4**, **1.10.1** |
| Commitments and production | Owner approves lead times, warning windows, weekly caps, festival cut-offs, tasks, Aari sequence and quality checks. | **1.1.1–1.1.2**, **1.7–1.8** |
| Artisan obligations | Owner approves vendor rates and acceptance basis. | **1.7.3–1.7.4** |
| Stored property | Owner publishes holding/reminder/outcome terms before enforcement. | **1.8.5** |
| Privacy and minors | Approved Tamil/English notice, consent/guardian flow, grievance contact, breach procedure, processing agreement and retention terms; applicability confirmed through appropriate advice. | **1.1.3**, **1.10.2** |
| Public photos | Owner approves publication policy before any gallery image is published. | **2.7**, or earlier gallery activation |
| Continuity | Product/founding owner approves maximum loss, restoration time, outage paper procedure and successful restoration evidence. | **1.10.4** |
| Migration and evaluation | Owner agrees notebook migration; baseline is captured and pilot thresholds approved before pilot starts. | **1.10.1/1.10.4** |

### 7.2 Before later capability activation

| Capability | Required decision / evidence |
|---|---|
| Shared or second-shop operation | Role/toggle/support decisions, multi-shop continuity review, §33.3 checks, pilot go/no-go and 5–10 discovery interviews with Tamil-speaking boutique owners. |
| Registered-shop billing | Accountant-approved composition/regular-GST requirements, classification/rate rules and supported export basis. |
| Retail | Catalogue, variant opening stock, returns/exchanges and altered-item eligibility. |
| Customer access | Confirmation/access model and chosen OTP channel where required; scoped revision authority and phone-change verification. |
| Automated messaging | Existing-number migration versus separate number, supported templates/permissions, budgets and reminder policy. |
| Drafting/pattern approval | Named independent reviewer, formulas, supported ranges, seam/ease governance, physical-validation matrix and confirmed tolerances. |
| True-scale printing | Paper/printer assumptions, calibration process and production-release evidence. |
| Social/advertising connections | Demonstrated owner value, approved account access and freshness expectations. |
| Campaign outcomes | Attribution/window, enquiry qualification, revenue/cost basis and treatment of returns/multiple touches. |
| AI | Approved external processing/data-use terms, evaluation cases, critical-field error limits and net-benefit criteria. |
| Charging external shops | Prices, allowances, support model, overage approval, exit/export period and retention terms. |

The source plan’s **2–4 week baseline and 3-month founding pilot** are existing validation commitments, not development estimates. Thresholds are set after the baseline. Critical failures, the owner returning to notebook-primary operation for more than two consecutive weeks, or unsustainable support trigger stop/redesign review.

---

## 8. Boundaries, Overlaps and Final Validation

### 8.1 Scope boundaries

The following are excluded from the committed roadmap unless separately approved:

| Optional extension / excluded capability | Boundary |
|---|---|
| Offline capture and synchronisation | Reconsider only if pilot connectivity is a demonstrated obstacle. Online save recovery does not imply offline persistence. |
| 3D preview | Separate design-communication proposal; never fit validation or a prerequisite of patterns. |
| Plotter/large-format export | Separate format/scale validation after committed A4/A3 support. |
| Wider garment/language coverage | Add only through approved forms, terminology and any required expert rules. |
| Advanced fabric nesting/optimisation | Separate validation; basic fabric estimates do not imply it. |
| Multi-branch, e-commerce and social publishing | Separate product expansions. Membership in several isolated shops does not implement them. |
| ERP, statutory payroll, full accounting, lending or marketplace | Outside the intended small-boutique product. |
| E-invoices/e-way bills and native mobile apps | Excluded by the product baseline. |
| Guaranteed fit, photo-derived body measurements and autonomous financial/advertising control | Not authorised product behaviours. |

Instagram/ad connections, retail, patterns and AI are baseline conditional capabilities, not optional extensions to be silently discarded.

### 8.2 Overlaps resolved

- **Customer versus wearer:** Shared contact, payment and family relationships never replace wearer identity or authorisation.
- **Order versus outfit piece:** Order-level commercials coexist with piece-level work/custody; partial billing uses reviewed amounts and cannot duplicate charges.
- **Booking versus garment finance:** Allocation changes attribution of a single source amount, not the amount itself.
- **Vendor versus supplier:** Shared party identity is permitted; the same obligation cannot appear twice.
- **Purchasing versus order cost:** Stock purchase and later consumption are distinct; only attributable consumption belongs to the garment.
- **Assignment versus custody:** Reassignment never pretends a physical item moved.
- **Ready versus delivered versus closed:** Quality readiness, customer receipt and settlement of obligations remain separate.
- **Design versus fit media versus showcase:** Private uploads do not acquire publication rights.
- **Drafting sheet versus pattern:** A calculation sheet provides dimensions, not generated geometry or physical fit evidence.
- **Reminder suggestion versus sending:** Prepared/owner-marked-sent/provider-confirmed statuses remain distinct.
- **Source versus attribution:** Evidence does not automatically establish campaign credit.
- **AI proposal versus fact:** Only reviewed authorised actions change authoritative records.

### 8.3 Final review outcome

| Perspective | Validation conclusion |
|---|---|
| Product value | Wave 1 delivers a usable operating loop; later modules build on genuine daily records. |
| Business workflow | Custom, repeat, family/package, small-service, outsourced Aari, partial fulfilment and cancellation journeys are covered. Retail receives a complete later workflow. |
| Implementation | The 85 slices deliver bounded functional outcomes rather than technical layers. Dependencies progress from identity/agreement/materials to work, acceptance and settlement. |
| Quality | Slice acceptance covers normal operation and material exceptions. All 66 source scenarios have delivery ownership and release applicability. |
| Completeness | All 241 numbered requirements are accounted for. Non-numbered lifecycle, pilot, safety and readiness obligations are also mapped. |
| Scope discipline | No architecture, stack, schema, API, infrastructure or development estimates are introduced. Optional extensions remain explicit. |

### 8.4 Completion standard for subsequent specifications

Each future phase specification should retain these slice identifiers and provide the finer interaction detail needed for implementation. Each slice is accepted only when:

1. Its normal workflow and relevant exceptions are functionally demonstrated.
2. Its permissions, history and money/property consequences are correct.
3. Its applicable source acceptance scenarios pass.
4. Missing information and failed operations remain visible and recoverable.
5. Its required business configuration and activation evidence are approved.
6. Its output integrates with the existing operating journey without duplicate entry or misleading status.

Complete-scope coverage does not imply every conditional module is enabled in every boutique. A capability remains explicitly gated until its prerequisites are satisfied; the manual core remains useful throughout.
