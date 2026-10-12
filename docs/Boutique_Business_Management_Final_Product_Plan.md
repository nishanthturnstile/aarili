# Boutique Business Management Portal
## Final Product Plan

**Date:** 12 October 2026
**Document status:** Complete product-scope baseline, revised after multi-model review (Claude Opus 5.5 and GPT-6.1 Sol) and owner decisions recorded in Section 32.1. Phase 1 scope is committed in Section 29.1; later-phase allocation remains provisional. Revised after the architecture review: Phase 1 is online-only (USE-03, USE-04, AC-40).  
**Initial market:** Owner-operated tailoring businesses and small boutiques in India.  
**Initial validation setting:** The founding boutique, followed by a small group of independent boutiques.  
**Document boundary:** Product purpose, user experience, features, business rules, outcomes, acceptance criteria and indicative release sequence. Application architecture, database design, technology stack, infrastructure and implementation estimates are intentionally excluded; they are recorded in the companion document [Architecture and Technology Decisions](Architecture_and_Technology_Decisions.md).

**Planning basis:** This document is the planning baseline for the product. Section 2 summarises the key product decisions. It is not a claim that every shop policy or tailoring formula has already been approved. Unresolved business-specific values are listed in Section 32 and must be configured or validated before their associated capability is activated. This is a product specification, not a competitor report, tax opinion or claim of validated product-market fit.

---

## Contents

1. [Product definition and intended outcomes](#1-product-definition-and-intended-outcomes)
2. [Scope and key product decisions](#2-scope-and-key-product-decisions)
3. [Product terminology](#3-product-terminology)
4. [Users, access and landing experiences](#4-users-access-and-landing-experiences)
5. [End-to-end journeys](#5-end-to-end-journeys)
6. [Business setup and operating policies](#6-business-setup-and-operating-policies)
7. [Customer and wearer management](#7-customer-and-wearer-management)
8. [Enquiries, appointments and conversion](#8-enquiries-appointments-and-conversion)
9. [Bookings, garment orders and intake](#9-bookings-garment-orders-and-intake)
10. [Design libraries, approvals and changes](#10-design-libraries-approvals-and-changes)
11. [Materials, customer-property custody and stock](#11-materials-customer-property-custody-and-stock)
12. [Suppliers, purchases and replenishment](#12-suppliers-purchases-and-replenishment)
13. [Measurements and verified fit memory](#13-measurements-and-verified-fit-memory)
14. [Pattern preparation, seam allowances and printing](#14-pattern-preparation-seam-allowances-and-printing)
15. [Production, trials, alterations and handover](#15-production-trials-alterations-and-handover)
16. [People, external work and capacity](#16-people-external-work-and-capacity)
17. [Quotations, billing, payments and costs](#17-quotations-billing-payments-and-costs)
18. [Ready-made retail and linked alterations](#18-ready-made-retail-and-linked-alterations)
19. [Customer experience and communications](#19-customer-experience-and-communications)
20. [Daily workspace, search and alerts](#20-daily-workspace-search-and-alerts)
21. [Mannequin gallery and Instagram viewer](#21-mannequin-gallery-and-instagram-viewer)
22. [Business reporting and marketing attribution](#22-business-reporting-and-marketing-attribution)
23. [Outcome-led AI assistance](#23-outcome-led-ai-assistance)
24. [Privacy, permissions and trustworthy records](#24-privacy-permissions-and-trustworthy-records)
25. [Usability, continuity and data portability](#25-usability-continuity-and-data-portability)
26. [Small-business product administration](#26-small-business-product-administration)
27. [Lifecycle rules and workflow gates](#27-lifecycle-rules-and-workflow-gates)
28. [Success measures and evaluation](#28-success-measures-and-evaluation)
29. [Indicative release allocation](#29-indicative-release-allocation)
30. [Product acceptance scenarios](#30-product-acceptance-scenarios)
31. [Scope boundaries and optional extensions](#31-scope-boundaries-and-optional-extensions)
32. [Business configuration and validation decisions](#32-business-configuration-and-validation-decisions)
33. [Release readiness and completion criteria](#33-release-readiness-and-completion-criteria)

---

## 1. Product definition and intended outcomes

### 1.1 What the product is

A daily business-management and production-assistance product for small Indian tailoring businesses and boutiques. It connects customer enquiries, garment requirements, measurements, design approvals, fabric custody, quotations, payments, production, external craft work, fittings, delivery and business performance in one coherent workflow.

It supports custom stitching, alteration-only services and ready-made clothing sales with optional alterations. Its specialist scope includes configurable pattern libraries, expert-validated pattern generation, seam allowances, true-scale printing, a physical-mannequin costume gallery, an Instagram feed viewer, and Google Ads/Instagram Ads performance review.

The owner should not need to maintain the same order independently in a notebook, chat history, measurement register and payment sheet. Physical notes and manual methods may still be used, but the product should provide a reliable consolidated record.

### 1.2 Core product promise

> Every garment has clear instructions, traceable materials, an accountable next step, a trustworthy delivery commitment and an accurate payment position, with less administrative effort for the boutique owner.

### 1.3 Intended users and business shape

The initial user is an owner who handles several roles herself: customer conversations, measurements, design decisions, production coordination, collections and showcase management. The product must also serve a small team with in-house tailors and external specialists without requiring enterprise-style administration.

Initial custom-work categories are **Blouse and Chudidhar/Salwar**, plus small add-on services such as saree fall, pico and pre-pleating. **Bridal is an occasion/package**, not a garment category: a bridal booking groups several garment orders (for example blouse, lehenga or salwar) and may carry a package price, while each garment keeps its own measurement form, production and costing. Additional categories are owner-approved configuration, not an assumption that every garment has a supported automated pattern.

In Phase 1 the founding owner is the only user of the product. She is not GST-registered, does not yet sell ready-made garments, collects mostly cash with some UPI, and communicates with customers through the WhatsApp Business App on her own number.

### 1.4 Outcomes the product must improve

- Reduce intake effort, repeated entry and time spent locating customer or garment information.
- Prevent incomplete or unapproved work from progressing into the wrong production activity.
- Improve readiness by the original promised delivery date and expose capacity or supplier risks early.
- Reduce avoidable fit corrections, design misunderstandings, material losses and missed charges.
- Preserve successful fit and production knowledge for repeat customers without corrupting history.
- Improve payment collection, reconciliation and visibility of genuine order contribution.
- Connect showcase and marketing activity to enquiries and actual orders rather than vanity metrics alone.

These are evaluation goals, not guaranteed improvements or already-observed results.

### 1.5 Product principles

The product is action-oriented, mobile-friendly, bilingual for the initial pilot, usable without AI, and configurable within clear boundaries. It must distinguish facts from estimates, preserve historical versions, reveal blockers, minimise duplicate work and give people control over consequential decisions. A small shop must be able to use a simple workflow; advanced modules must not clutter every order. The simple workflow is a defined, testable mode (SET-10), not just an aspiration.

### 1.6 Business model and validation hypotheses

- **Commercial position:** The founding boutique uses the product free of charge during and after the pilot. Other boutiques will be offered a subscription later; the price, included allowances and support model are not yet set (Section 32.3).
- **Alternatives the product must beat:** Paper notebooks and measurement books, WhatsApp chats, generic billing/accounting apps (for example Vyapar and myBillBook) and existing tailoring/measurement-book apps.
- **Differentiation hypothesis:** Tailoring-specific workflow that generic billing tools lack — wearer-level measurement history, customer-fabric custody, outfit pieces, Aari/embellishment work, trials and corrections, drafting support and honest delivery commitments — in Tamil and English.
- **Hypotheses to validate before commercial expansion:** (1) Owners will maintain records daily instead of reconstructing them in a notebook. (2) The product measurably reduces late deliveries, missed charges or time spent searching. (3) Owners outside the founding boutique will pay a subscription. Before Phase 2 external onboarding, run 5–10 discovery interviews with Tamil-speaking boutique owners covering current tools, top recurring pain and willingness to pay.
- **Cost to serve:** Track per-shop media storage, messaging, AI usage and support effort from the pilot onward so that any subscription price covers them.

## 2. Scope and key product decisions

| Area | Product decision |
|---|---|
| Independent garment orders | Each outfit/garment/service is a separate order. An outfit order (for example a salwar set) tracks its pieces — top, bottom, dupatta — inside it. An optional booking group covers a shared customer visit, occasion (including a Bridal package), quotation, advance or collection. |
| Add-on services | Saree fall, pico, pre-pleating and similar small services are add-on lines on an order. When an add-on is the only service requested, it is a lightweight service order with no measurement or pattern requirement. |
| Customer identity | The contact/payer is separate from the person wearing the garment. Shared phone numbers do not merge measurement histories. |
| Mixed boutique business | Ready-made sales and alteration-only work are supported. A retail item does not require a custom-stitching workflow unless an alteration job is linked. |
| Financial and production gates | Checks are action-specific. Quotes, advances and appropriate receipts are not blocked merely because material is pending. Production release requires the prerequisites for that task. |
| Pattern preparation | Exploratory preview is distinct from an approved cutting output. Both need their relevant validated inputs; physical fabric receipt is required only where the applicable production rule needs it. |
| Workflow | Cutting, trials, corrections, quality acceptance, partial handover and cancellation settlement are explicit activities. Optional tasks are used instead of forcing every garment through every stage. |
| Landing pages | Owner: daily actions. Staff: assigned work. Customer/gallery visitor: mannequin showcase, with a deliberate route to private order services. |
| Permissions | Basic role boundaries and isolation between boutiques are required before shared use. A complex permission-design interface is not a prerequisite. |
| Communications | Owner-triggered sharing and a communication history are in scope. In Phase 1 sharing is manual through the owner's WhatsApp Business App (click-to-chat link with prefilled text plus a PDF/image). Automated outbound messaging is a later capability, subject to permission, cost controls and supported provider access. |
| Fit knowledge | Measurement history includes source-linked, customer-confirmed fit outcomes. One alteration is never treated as a universal change to body measurements. |
| Pattern library | Neck type and neck design, and sleeve type and sleeve design, are separate attributes. Library entries have availability toggles and keep all historical versions. |
| Mannequin gallery | Photos and costume history of the physical shop mannequins; not a generic apparel catalogue. |
| AI | Assists with capture, completeness and actionable follow-through. Never replaces validated arithmetic, drafting formulas, payment verification or human approval with an unsupported model answer. |
| External integrations | Instagram viewer and Google/Meta advertising reporting, with manual fallback and visible data freshness. Access-dependent functionality is not guaranteed until verified. The live Instagram viewer and advertising data sync through platform connections are excluded from the pilot; the pilot uses manual lead-source capture and manual monthly ad-spend entry. |
| Product form | A desktop web application that is also a mobile-responsive installable web app (PWA). It must work at desktop/large-screen, tablet and mobile sizes. No native mobile app is planned. Phase 1 is online-only: the PWA is installable but does not capture data offline (USE-04). |
| Printing and sharing | Printing is optional. Every printable output — bills, receipts, job slips, labels, confirmations and pattern/drafting outputs — must also be available as a PDF that can be shared through WhatsApp. A4 is the default paper size; A3 is supported where the shop has it. |
| Billing regime | Founding boutique: not GST-registered, so it issues non-tax bills and receipts. Support for composition and regular GST shops is added before onboarding any registered shop (FIN-07). |

**Scope convention:** Requirements in Sections 6-26 describe the complete intended product, not a single MVP. Conditional capabilities are explicitly labelled. Section 29.1 commits the Phase 1 requirement set and Section 30.1 the Phase 1 acceptance scenarios; the later-phase sequencing in Section 29 does not remove functionality from the complete scope. Section 31 identifies optional extensions that are not committed requirements.

## 3. Product terminology

| Term | Business meaning |
|---|---|
| Boutique/shop | One business operating its own private customer, financial and production records. |
| Customer/contact | The person interacting with or purchasing from the boutique; may also be the payer. |
| Wearer | The person whose garment and measurements are involved. A customer can manage more than one wearer where authorised. |
| Booking | An optional commercial grouping of garment orders and retail items associated with one visit or occasion. A Bridal package is a booking with the Bridal occasion type and, optionally, a package price. |
| Garment order | One independently traceable custom outfit/garment or alteration service, with its own requirements, dates, costs, fit history and progress. |
| Piece | A physical component of an outfit order, such as a salwar top, bottom or dupatta. Each piece has its own measurement form, tasks, custody and readiness, and can be handed over or cancelled separately. Price is held at order level, with an optional per-piece breakdown. |
| Add-on service | A small priced service such as saree fall, pico, pre-pleating, tassels or hooks, recorded as a line on an order. |
| Task | A production activity such as cutting, Aari work, stitching, finishing or a correction. |
| Design specification | The agreed construction and decorative choices, instructions and reference assets. |
| Measurement version | A dated set of recorded values, method, units and sources that an order explicitly uses. |
| Fit outcome | The recorded trial/acceptance result and corrections for a specific garment, fabric and construction context. |
| Pattern version | A particular reviewed drafting result, linked to its exact inputs and allowance rules. |
| Quotation | A proposed price and scope; not proof of payment or automatically a final invoice. |
| Invoice/bill | A business document issued under the shop's applicable billing rules. Its status is separate from production progress. |
| Payment/receipt | Money recorded and the corresponding acknowledgement. Reported or pending payment evidence is not the same as confirmed money. |
| Customer property | Fabric, accessories, sample garments or other items entrusted to the shop; distinct from shop-owned inventory. |
| Ready date | When the garment passes the relevant checks and is available for handover. |
| Collection/delivery date | When it actually reaches the customer or authorised collector. |
| Order contribution | Net order revenue, excluding tax, less attributable direct fulfilment costs; not automatically overall business profit. |

## 4. Users, access and landing experiences

| User | Intended actions | Default boundaries |
|---|---|---|
| Owner/admin | Configure the shop, oversee all operations, approve pricing and exceptions, manage people, view reports and control access. | Access only to businesses where explicitly authorised. |
| Manager/front desk | Handle customers, intake, appointments, quotes, collections and coordination within delegated limits. | Discounts, refunds, configuration and sensitive exports require explicit permission. |
| Cutter/tailor/finisher | View assigned jobs, relevant measurements and instructions; update permitted tasks, blockers and completion. | No general customer directory, advertising accounts or unrestricted financial records. |
| External craft worker/vendor | Receive the necessary work brief and, where enabled, acknowledge progress/return. | Only shared jobs and the minimum customer information needed; no general shop access. |
| Bookkeeper/accountant | View permitted billing, payments, purchases, expense reports and exports. | Measurements and private fitting images are not necessary by default. |
| Customer/authorised contact | View approved showcase, own shared order information, confirmations, appointment requests and payment documents. | No access to another customer or wearer merely through a shared or guessed phone number. |
| Product support administrator | Help with onboarding and product problems when authorised. | No routine unrestricted access to customer data; sensitive support access is scoped and recorded. |

In a solo-owner shop, the owner can be the assigned worker and perform all tasks. Worker records need not require a login. Staff management must not become a compulsory daily burden for the owner. In Phase 1 the owner is the only user; staff, external-worker, bookkeeper and customer access arrive in Phase 2. External workers such as home-based Aari artisans can still be recorded (without a login) in Phase 1.

Customer-facing order actions may be provided through a private access flow without mandatory full-account registration. Sensitive details require suitable identity/access confirmation. Customers cannot directly edit authoritative measurements, confirmed prices or production states.

## 5. End-to-end journeys

### 5.1 Custom garment

Enquiry or walk-in -> identify customer and wearer -> create booking/garment order -> capture design and materials -> select or record measurements -> quote and record any advance -> obtain the relevant approvals -> prepare pattern manually or through a validated engine -> complete production tasks and external work -> trial/correction where required -> quality check -> notify readiness -> settle or approve remaining credit -> hand over garment and property -> record fit outcome and contribution.

### 5.2 Repeat customer

Find the correct wearer -> retrieve a relevant previous garment -> compare its design, measurement date, fabric and confirmed fit result -> confirm what can be reused -> record changed requirements -> create a new independent order. Copying must not alter or reuse the previous order's approvals or dates as though they were new.

### 5.3 Multi-garment or family booking

Create one booking -> add separate wearers and garment orders -> record common occasion/contact and agreed dates -> allocate shared discounts and advances transparently -> progress each garment independently -> allow trials and partial collection -> retain visibility of unfinished work, allocated costs and remaining amounts.

### 5.4 Ready-made sale with alteration

Select the exact stock variant -> reserve/sell the item -> record payment -> link an alteration job if needed -> preserve the retail transaction and alteration instructions separately -> complete fitting/quality checks -> hand over according to policy. A returned or cancelled sale must trigger review of its linked alteration rather than silently leaving inconsistent work.

### 5.5 Exception handling

A shortage, late vendor, rejected trial, scope change, cancellation or loss creates a visible exception with an owner, reason, next action and date. Price/date changes require the relevant approval. Customer property and money are settled explicitly; closing an order never hides outstanding obligations.

## 6. Business setup and operating policies

- **SET-01 - Business profile:** Configure display/legal business details, address/contact, branding, local date/time presentation, currency, relevant tax registration status and document identity fields. Default pilot currency is INR and shop timezone is Asia/Kolkata.
- **SET-02 - Working calendar:** Configure opening days, holidays, breaks, appointment slots and production availability. Distinguish customer-facing hours from internal production capacity.
- **SET-03 - Service catalogue:** Maintain garment categories, approved subcategories, stitching/alteration services, retail availability and optional work such as Aari, embroidery, stone work and patchwork.
- **SET-04 - Operating templates:** Configure measurement forms, material checklists, task templates, quality checklists, standard instructions and customer confirmation templates within supported product fields. No general-purpose workflow programming is required.
- **SET-05 - Commercial policies:** Configure advance expectations, quote validity, discount authority, cancellation treatment, change charges, trial/rework policy, credit handover, returns/exchanges and refund approval. Where a policy is not configured, ask the owner rather than invent a value.
- **SET-06 - Alerts and priority:** Provide a normal/rush priority starting point, an initial three-day delivery warning window and configurable escalation. Occasion alone must not silently override queue priority.
- **SET-07 - People and services:** Set up staff, workers, vendors, suppliers, supported payment methods and communication channels. Allow inactive records to remain available in history.
- **SET-08 - Versioned configuration:** Changes to rates, forms, policies or library entries apply to new activity by default. Show their effective date and author; applying a change to existing work is explicit and auditable.
- **SET-09 - Optional module activation:** Let the shop enable retail, pattern generation, customer self-service, automated messaging and advertising reporting only when relevant. Disabled modules do not corrupt existing records or hide outstanding obligations.
- **SET-10 - Simple mode (solo owner):** This is the default for a single-user shop.
  - **Quick order:** A new order needs at most six inputs: customer name and phone; wearer (defaults to the customer); garment type; agreed delivery date; price or "to be quoted"; and an optional advance. Everything else is optional and disclosed progressively. The requirement checklist is generated from the approved template, and unanswered items stay visibly unresolved.
  - **Tasks:** The owner is automatically assigned to every task. Tasks are shown as milestones — Booked, Cutting, Work/Stitching, Trial, Ready, Handed over — while the product keeps the underlying task history.
  - **Approval:** One tap records a staff-attested verbal approval covering the current design, price and date together.
  - **Payments:** Payments are recorded at booking level and allocated automatically using the default method (FIN-05).
  - **What is not relaxed:** Money integrity, customer-property custody, history, privacy and irreversible-work checks keep their full rules.
  - **Switching:** The owner can switch a single order, or the whole shop, to detailed mode at any time without losing data.
  - **Target:** The initial design target is that a repeat-customer blouse order can be created on a phone in about two minutes. The pilot target is confirmed after the baseline (Section 28.3).
- **SET-11 - Capacity guard and rush rule:** Configure a weekly capacity per garment category, as a garment count or simple effort points. Configure a peak calendar (for example Deepavali, Pongal and wedding months) with last-booking dates. When a commitment would exceed capacity or a cut-off date, warn the owner; she can still accept it, with a recorded reason. An order whose requested delivery is sooner than the category's configured standard lead time is flagged as rush, and the configured rush charge is suggested; the owner can waive it.
- **SET-12 - Uncollected garments and stored property:** Configure the holding period for ready-but-uncollected garments and stored customer fabric, the reminder schedule, a final notice and the permitted outcome (continued storage, storage charge, or disposal/donation only under published terms recorded on the order). Never dispose of property silently.

## 7. Customer and wearer management

- **CUS-01 - Customer records:** Create/search customers using a shop-specific identifier and minimal necessary contact details. Support spelling variations and optional notes without requiring an email address or a unique phone number.
- **CUS-02 - Wearer identity:** Support self, family members and other authorised wearers as separate profiles. Link each garment and measurement session to the correct wearer; changing the payer must not change the wearer.
- **CUS-03 - Unified history:** Show enquiries, appointments, bookings, garments, shared documents, material custody, approved design references, payment position and permitted fit history in one customer view.
- **CUS-04 - Preferences:** Record preferred language/channel, communication permissions, fit/style preferences and practical delivery instructions. Clearly distinguish an expressed preference from an AI inference.
- **CUS-05 - Search and duplicate review:** Suggest possible duplicate customers for manual review. A merge preserves identifiers, financial links, wearer distinctions and history; never merge solely because phone numbers match.
- **CUS-06 - Corrective edits:** Record material changes to contact or wearer identity. Relinking a garment with measurements or private assets requires explicit authorised review.
- **CUS-07 - Relationship permissions:** A family/payer link does not automatically authorise access to every wearer's measurements or photos. Respect the permission recorded for the interaction.
- **CUS-08 - Service issues:** Record complaints, promised remedies, owner, follow-up date and resolution. Link issues to the relevant garment and cost without labelling a customer unfairly or sharing internal notes externally.
- **CUS-09 - Data lifecycle:** Support archiving, correction requests and appropriately reviewed deletion/export requests. Preserve required financial and operational history according to the approved retention policy.

## 8. Enquiries, appointments and conversion

- **ENQ-01 - Enquiry capture:** Record walk-in, call, message, referral, showcase and advertising enquiries with source, request, preferred dates, interested services and responsible person.
- **ENQ-02 - Minimal entry:** An enquiry may exist before measurements, material receipt or a confirmed customer profile. Avoid demanding a full order form for someone seeking a price.
- **ENQ-03 - Follow-up lifecycle:** Track new, contacted, awaiting information, quoted, follow-up due, converted and closed/lost, with reason and next action. These states are separate from garment production.
- **ENQ-04 - Conversion:** Convert an enquiry into a booking and one or more orders while preserving source history and avoiding duplicate customer creation. Preserve unsuccessful quotes for reporting.
- **ENQ-05 - Appointments:** Book measurement, consultation, trial and collection appointments with duration, location, attendee/worker and linked booking or garment.
- **ENQ-06 - Changes and conflicts:** Show overlapping appointments, support rescheduling/cancellation/no-show records and notify relevant people through enabled channels. An appointment change does not automatically change a delivery promise.
- **ENQ-07 - Quote follow-up:** Show unapproved quotations and expiry/review dates. Stop irrelevant follow-up when the enquiry is closed, converted or the customer opts out.
- **ENQ-08 - Attribution evidence:** Retain customer-stated source, referral, tracked campaign or manual assignment separately. Unknown is a valid state; do not fabricate a campaign match.

## 9. Bookings, garment orders and intake

- **ORD-01 - Booking and order identifiers:** Provide readable identifiers for the booking and each garment/service. A single-item order can be created without forcing the user to manage a complicated booking screen.
- **ORD-02 - Independent garment records:** Each garment has its own wearer, category/type, references, materials, measurements, pattern path, tasks, assignment, dates, cost, payment allocation and progress. Booking totals must not conceal incomplete garments.
- **ORD-03 - Mixed bookings:** Support custom orders, ready-made items and alteration services in the same customer visit while preserving their different processing rules.
- **ORD-04 - Intake fields:** Capture order date, garment/category/subcategory, occasion, event date, requested delivery, agreed original delivery date/slot, priority, customer instructions, design choices and intake owner. Preserve record-creation time separately from a legacy order date. Validate date consistency and label intentional historical imports. Draft orders may be incomplete; confirmed commitments must be explicit.
- **ORD-05 - Requirement checklist:** Generate the applicable checklist from selected garment and work. Include main fabric, lining, extra/net/contrast fabric, trims, craft work, construction decisions, measurements and confirmations.
- **ORD-06 - Explicit requirement states:** Record pending, confirmed/received, not required, completed or another appropriate supported state. Blank must not be interpreted as either received or not required.
- **ORD-07 - Reference assets:** Attach images, documents, sketches and voice notes to the particular neckline, sleeve, embellishment or instruction they support. Preserve source/uploader, date and approved version.
- **ORD-08 - Fast and repeat intake:** Support saved templates, duplicate-as-new, repeat-customer retrieval, auto-saved drafts and quick addition of another garment. Reuse never silently carries old approvals, payment confirmations or delivery commitments into a new order.
- **ORD-09 - Customer-facing summary:** Produce a readable specification/booking summary including materials supplied, approved scope, price basis, dates and advance/balance position. Internal margin and private production notes are excluded.
- **ORD-10 - Physical identification:** Provide printable job slips/bag labels with garment identifier and essential production information. Optional QR/barcode lookup must respect access boundaries and reveal no private data in a public label by default.
- **ORD-11 - Ownership and exceptions:** Show the accountable coordinator, present blocker and next useful action. Support urgency explanations, holds, cancellation, reopening and partial fulfilment through the governed lifecycle.
- **ORD-12 - History:** Preserve who created/changed the order, meaningful field revisions, approvals and linked business events. Changing an order description must not retroactively rewrite a previously approved customer summary.
- **ORD-13 - Outfit pieces:** An outfit order (for example a salwar set) contains pieces. Each piece has its own measurement form, requirement checklist, tasks, custody and readiness. A piece can be handed over or cancelled on its own, with settlement under the order's terms. The order shows partially ready or partially handed over until every piece is resolved.
- **ORD-14 - Add-on services and packages:** Add fall, pico, pre-pleating and similar add-ons as priced lines on an order, each with an optional task and its own completion state. A standalone add-on, such as a saree brought in only for fall and pico, is a lightweight service order without measurement or pattern requirements. A Bridal package is a booking with the Bridal occasion, optional package pricing and a shared event date; each garment keeps independent production.

## 10. Design libraries, approvals and changes

- **DES-01 - Category and type library:** Maintain approved categories and subcategories such as front-dart/princess-cut blouse and approved Salwar/Chudidhar variants. Each entry has a name, description, relevant form/checklist/task template and reference examples.
- **DES-02 - Type versus decoration:** Store neck type, neck design, sleeve type and sleeve design separately. For example, a neckline shape is not the same as its piping or embroidery treatment. Selected combinations determine relevant questions, cost components and supported pattern choices.
- **DES-03 - Availability control:** Each library entry has an Available for New Orders toggle. Inactive entries disappear from new selections but remain readable in historical orders. Duplicating an old order with an inactive type requires an explicit supported replacement or authorised reactivation.
- **DES-04 - Design specification:** Record fit preference, neckline/depth where relevant, sleeve construction/length, opening/fastening, lining, decorative treatment, placement, finishing and special restrictions. The exact fields are garment-specific, not universal.
- **DES-05 - Versioned references:** Support multiple reference assets, captions and annotations tied to a specification version. Distinguish inspiration from a confirmed instruction. Replacing a reference creates history rather than erasing the one used for approval.
- **DES-06 - Customer approval:** Share the relevant specification, inclusions/exclusions, supplied materials, quoted price basis and promised dates for approval. Record approved version, approver, time, channel and evidence. Verbal approval can be recorded as staff-attested verbal approval, not misrepresented as a customer digital signature.
- **DES-07 - Partial approvals:** Track design, price, date and other required approvals individually where useful. Only the approvals relevant to a task gate that task; an unresolved decorative choice must not automatically invalidate unrelated completed preparation.
- **DES-08 - Change requests:** After approval, capture the requested change, reason, feasibility, affected tasks/materials, price/date impact and approving person. Flag already-cut or externally dispatched work before acceptance.
- **DES-09 - Revised agreements:** Issue a new confirmation/quote where required. Retain original agreements and identify which changes were accepted, rejected or withdrawn. A requested change is not an approved change.
- **DES-10 - Reuse and rights:** Allow shop-owned reusable design references and private customer references, with separate visibility. Do not publish a customer's reference photo, fitting image or completed garment without the appropriate recorded permission.
- **DES-11 - Change-impact rules:** When an approved order changes, apply the following baseline. Approvals and completed work not listed for a change stay valid.

| Change | Approvals superseded | Work/outputs affected | Required action |
|---|---|---|---|
| Measurement revision | None automatically; price approval only if the agreed size band/price basis changes | Unused pattern/drafting outputs become stale; not-yet-started cutting for affected pieces is held | Review and regenerate; if cutting already happened, record it and agree a correction route |
| Neckline/sleeve or construction change | Design approval for the affected piece | Pattern output, cutting, and embellishment placement for that piece | Re-check price and date; flag irreversible work; obtain new approval |
| Embellishment/Aari change | Design approval for that element only | Aari task, consumables, artisan brief, cost | Re-quote where needed; notify the artisan; re-approve |
| Fabric change or substitution | Design approval if the agreed appearance changes | Material requirement, fabric estimate, pattern if width/direction differs | Customer approval before cutting; record the custody change |
| Price change | Price approval | None | New quotation revision and approval |
| Date change | Date agreement | Capacity check and alerts | Record the reason and customer agreement; keep the original date |

## 11. Materials, customer-property custody and stock

- **MAT-01 - Three-way distinction:** Keep customer-owned property, shop-owned inventory and stock allocated to a particular order conceptually separate. Receiving customer fabric must not increase purchased stock value.
- **MAT-02 - Customer property receipt:** Record fabric/sample/accessory description, pieces, relevant length/width and units, source, date, receiver, condition, visible defects and optional receipt photos. Record unknown dimensions explicitly instead of assuming them.
- **MAT-03 - Storage and movement:** Assign an optional bag/rack/location identifier. Track movement to a worker, external craft vendor, trial, return or customer handover. Show current custodian and unresolved movements.
- **MAT-04 - Requirement versus receipt:** A selected or priced material is not automatically received. Track required amount, promised amount, received amount, usable amount and shortfall where applicable.
- **MAT-05 - Order allocation:** Reserve shop material against a garment without counting it as consumed. On issue/cutting, record actual usage, wastage/remnant and remaining quantity according to the material's units. Baseline costing rule: material issued to an order and left as unusable off-cut is charged to that order; a reusable remnant returned to stock is not charged and goes back at its unit cost.
- **MAT-06 - Inventory units:** Support metres/centimetres and pieces, rolls or packs where applicable, with explicit conversion rules. Do not allow silent conversion between incompatible measures or double-count roll and length quantities.
- **MAT-07 - Variants and quality:** Where relevant, identify material colour, lot/batch, width and usable condition so visually similar or mismatched supplies are not treated as interchangeable. Track damaged/quarantined stock separately from saleable/usable stock.
- **MAT-08 - Shortage and substitution:** Raise shortage, defect or alternative-material decisions with cost/date impact. Obtain approval when a substitute changes the agreed garment or price. A shortage can trigger purchasing or a customer request, not an invented receipt.
- **MAT-09 - External dispatch:** Record exactly which pieces/materials are sent for external work and reconcile returned items, consumed items and unexplained differences before closing custody.
- **MAT-10 - Returns and remnants:** Track sample garments, unused fabric and accessories owed back to the customer. Record returned, retained with permission, disposed under approved policy, lost/damaged or still pending. Garment delivery alone does not automatically settle property custody.
- **MAT-11 - Stock corrections:** Support opening balances, counted adjustments, damage/write-off, purchase returns and stocktake with reason and authorised user. Block insufficient stock by default; any permitted negative-stock exception is explicit and flagged for reconciliation.
- **MAT-12 - Incident handling:** Record loss, damage, mix-up or unexplained shortage with evidence, owner, customer communication and agreed remedy. Link financial remedies without deleting the original custody event.
- **MAT-13 - Shared customer fabric:** When one customer fabric serves several garments or pieces, or is split between the shop and an artisan, record the planned split per garment/piece. Record the cut pieces and remnants as separately traceable custody items. The same length of cloth cannot be committed twice. Each dispatched piece and each outstanding return stays visible until reconciled.

## 12. Suppliers, purchases and replenishment

- **PUR-01 - Supplier records:** Maintain supplier identity/contact, items supplied, lead-time notes, payment terms and active state. A business may be both a material supplier and a craft vendor without duplicating financial obligations.
- **PUR-02 - Purchase requests:** Create replenishment requests from shortages, low-stock rules or manual needs. Distinguish an internal request from an approved purchase commitment.
- **PUR-03 - Purchase records:** Capture supplier, order/reference, items, quantities/units, expected date, agreed cost, applicable tax treatment and whether the purchase is for stock or a particular garment.
- **PUR-04 - Partial receipts:** Receive part of a purchase, record quality/quantity discrepancies and leave the rest open. Receiving stock and recording the supplier bill/payment are separate actions.
- **PUR-05 - Bills and payables:** Record supplier bills, due dates, credits, payments and outstanding balances. Prevent the same supplier bill or payment from being counted twice when entered from a photo/import and manually.
- **PUR-06 - Returns and credits:** Record goods returned to the supplier, replacement items and supplier credit/refund status. Keep inventory, payable balance and cash movement consistent.
- **PUR-07 - Replenishment visibility:** Show upcoming receipts, overdue supply and low-stock needs. Reorder suggestions require approval; the product does not place a purchase merely because a threshold was crossed.

## 13. Measurements and verified fit memory

- **MEA-01 - Garment-specific forms:** Provide approved base measurement fields per category/type, required/optional status, explanatory labels and optional measurement-method illustrations supplied or approved by the business.
- **MEA-02 - Units and entry:** Support explicit inches/centimetres, decimal and familiar fractional entry, suitable precision and visible conversions. The pilot default is inches with quarter-inch fractions; the precision for each field is confirmed with the owner. Ambiguous spoken numbers or units remain unconfirmed.
- **MEA-03 - Source and method:** Record wearer, session date, person measuring and whether values came from body measurement, a sample garment, customer-provided information or another documented method. These sources are not interchangeable.
- **MEA-04 - Version history:** A new measurement session creates a new version. Each order preserves the exact version it uses. Correcting an error creates an attributable revision rather than silently changing every historical garment.
- **MEA-05 - Base versus derived values:** Clearly label entered measurements, intended garment dimensions, ease choices, derived values and pattern parameters. Show the approved formula/reference and version for derived outputs where relevant.
- **MEA-06 - Validation:** Detect missing values, incompatible units and implausible combinations using approved rules. Warnings must be explainable and must not shame customers or replace unusual but valid measurements with guessed values.
- **MEA-07 - Reuse confirmation:** Display source garment, measurement age and context when reusing a profile. Ask whether it remains appropriate; do not automatically apply a universal expiry period or claim old values are still accurate.
- **MEA-08 - Trial record:** Capture trial date, relevant design/measurement/pattern versions, fit observations, requested changes, measurements actually changed, assigned correction and customer response. Distinguish planned fitting adjustments from avoidable production rework.
- **MEA-09 - Verified fit outcome:** Save the final accepted garment's fabric characteristics, construction, final alterations and acceptance source/date. Mark staff-assessed fit and customer-confirmed fit distinctly.
- **MEA-10 - Contextual fit reuse:** Retrieve suitable earlier garments and show their specific corrections. Applying a correction to a new order requires review and never automatically edits the wearer's underlying body measurements.
- **MEA-11 - Private fit assets:** Limit access to fitting photos and measurements to authorised roles. Customer-facing design/gallery media are separate. Permit useful textual fit notes without requiring body photos.

## 14. Pattern preparation, seam allowances and printing

This is a specialist product workstream. The operational portal must remain fully useful when drafting, cutting or pattern storage is manual.

- **PAT-01 - Supported-pattern catalogue:** For each garment/type, show whether the path is manual, externally supplied, or supported by a validated automated rule set. An orderable garment type is not automatically an automated-pattern capability.
- **PAT-02 - Expert-approved rules:** Maintain reviewed measurement schemas, derivation rules, pattern pieces, allowed variation ranges and fabric assumptions. Draft rules cannot be used as an approved production output. Approval is by a qualified tailoring/pattern-making reviewer, not by an AI self-check. The founding owner is the primary pattern expert. Because she cannot be the sole approver of her own rules, every rule version also needs approval from an independent second reviewer — an experienced tailor or pattern maker who is named in Section 32.
- **PAT-03 - Manual/external patterns:** Link a physical pattern reference, sketch, uploaded pattern or externally generated output to the garment, with source, version and review status. Label unverified imported print scale or formula assumptions visibly.
- **PAT-04 - Seam allowances:** Provide a dedicated category/subcategory-specific list of relevant seam/edge positions with units and owner-approved values. Do not apply every seam edge to every garment or silently insert unapproved defaults.
- **PAT-05 - Allowance presets:** Support create-new and use-existing paths. Preview mapped values; allow an order-specific override without altering the reusable preset. Changing a preset creates a version and never silently changes existing outputs.
- **PAT-06 - Complete provenance:** Every generated result records garment/order, exact measurements, design choices, ease/other relevant inputs, rule version, seam-allowance version, author/reviewer and generation date. Explicit regeneration produces a new result.
- **PAT-07 - Input and release checks:** Show missing/unsupported inputs before generating. Exploratory previews are visibly not approved for cutting. A cutting release requires the approved design and measurement/pattern checks plus task-relevant fabric readiness. Unsupported combinations are blocked, not approximated silently.
- **PAT-08 - 2D visual preview:** Show front, back, sleeve and other applicable pieces, piece names, dimensions, cutting versus stitching lines, allowances and relevant grain/fold/cut-count/orientation markings. These markings must come from the approved pattern specification.
- **PAT-09 - Calculation summary:** Show derived values, applied allowances, source versions, warnings and fabric-length estimate with its assumptions. Allow comparison of regenerated versions and clearly identify the one approved for use.
- **PAT-10 - Fabric estimate:** Account for the validated scope of fabric width, directional print/nap, repeats, shrinkage allowance and placement where supported. Clearly label unsupported considerations and estimates requiring physical confirmation. An estimate does not authorise cutting insufficient customer fabric.
- **PAT-11 - True-scale export:** Provide downloadable print-ready PDF at 1:1 scale for supported A4 and A3 tiling. Include page/tile labels, alignment marks, overlap/trim guidance, assembly order, calibration ruler/square, version and page count.
- **PAT-12 - Print preview and instructions:** Show paper selection, tiling and approximate page count before export. Instruct Actual Size/100%, not Fit to Page. Preserve calibration features on every relevant output and clearly warn that the user's printer settings can alter scale.
- **PAT-13 - Physical verification:** Record a supported-pattern validation result, relevant test conditions and print-calibration result before claiming production readiness. Do not describe a pattern as guaranteed fit; acceptance requires physical garment/fit validation appropriate to the supported range. The validation matrix lists every supported garment type, body-measurement range, fabric class and design combination, and the number of physical garments tested for each. Proposed starting tolerances, to be confirmed by both reviewers:
  - calibration square accurate to ±1 mm per 10 cm;
  - tiled pages aligned to within ±2 mm across the assembled pattern;
  - key piece dimensions within ±3 mm of the computed value.

  A print that fails calibration is blocked for cutting use.
- **PAT-14 - Production handoff:** Provide the approved piece checklist, validated cutting/marking notes and relevant assembly/stitching instructions where supplied by the expert. Updated outputs notify affected workers and must not silently replace a pattern already used to cut fabric.
- **PAT-15 - Invalidated output:** A changed measurement, design or rule can make a not-yet-used output stale. Flag it and require explicit review/regeneration. Record whether earlier physical cutting has already occurred before accepting a replacement.
- **PAT-16 - Drafting calculation sheet:** Before full pattern generation, provide a printable/shareable sheet with the computed cutting and drafting dimensions for the owner's traditional drafting method. It is computed from the order's measurement version, the design choices and versioned formulas, and the owner drafts directly onto paper or fabric from it. Until both reviewers approve the formula version, the sheet is labelled "unvalidated — check before cutting". It records the same provenance as PAT-06. It does not draw pattern pieces.
- **PAT-17 - Output delivery without a printer:** Every pattern and drafting output is available as a downloadable PDF that can be shared through WhatsApp (for example to a print shop). A4 tiling is the default; A3 tiling is offered as an option. When the output is sent to a third-party printer, show the calibration and Actual-Size instructions prominently.

Optional 3D visualisation and plotter formats are addressed in Section 31; neither is a dependency for the core pattern capability.

## 15. Production, trials, alterations and handover

- **JOB-01 - Simple milestones, detailed tasks:** Present understandable garment milestones while retaining task-level progress for material preparation, pattern, marking, cutting, craft work, stitching, trial, correction, finishing and quality check.
- **JOB-02 - Garment-specific sequence:** Use approved task templates with required/optional tasks, dependencies and permitted parallel work. Some embroidery happens before cutting and some after; do not impose one universal order.
- **JOB-03 - Explicit cutting activity:** Record cutting readiness, assigned worker, start/completion and approved pattern/manual method. This is an irreversible-work checkpoint with relevant design, material and measurement checks.
- **JOB-04 - Task assignment:** Assign work to owner, employee or external vendor as appropriate. A task that requires an assignee cannot start unassigned; in solo mode the owner is a valid assignee.
- **JOB-05 - Progress and history:** Record task status, key timestamps, optional actual effort, completion evidence and notes. Keep assignment state separate from production state.
- **JOB-06 - Holds and blockers:** Require a reason for on-hold/blocked states, accountable owner, next action and review date where relevant. Record the impact on schedule and retain elapsed blocked time without automatically treating it as worker time.
- **JOB-07 - External-work reconciliation:** Dispatch, expected return, progress, received pieces, quality check, rejection and vendor rework remain visible. Vendor completion is not equivalent to accepted return into the shop.
- **JOB-08 - Trials:** Schedule and record one or more trials. Record attendance, result, customer feedback and next action. A missed trial should flag delivery risk but should not silently revise the agreed date.
- **JOB-09 - Alteration and correction jobs:** Support planned fitting adjustments, customer-requested scope changes, avoidable rework and standalone alteration services. Link the original garment where applicable and record cause, chargeability, direct cost and agreement.
- **JOB-10 - Quality acceptance:** Use garment-specific checks for agreed construction, finishing, visible defects, closures, supplied accessories and relevant dimensions. A failed check creates a corrective task; quality acceptance is distinct from customer fit acceptance.
- **JOB-11 - Ready for handover:** Record first-ready and current-ready times when the appropriate checks pass. If a garment is withdrawn from readiness, record why and preserve the earlier event; do not use a false ready event to improve delivery metrics.
- **JOB-12 - Partial handover:** Deliver some garments/items from a booking while retaining outstanding garments, amounts and property. Record what was handed over, recipient, date/time and acknowledgement method.
- **JOB-13 - Collection versus fulfilment:** Track ready-but-uncollected, customer collection and optional delivery dispatch/receipt separately. A courier dispatch is not customer delivery unless the chosen fulfilment method explicitly defines and records that handoff.
- **JOB-14 - Cancellation and reopening:** Permit governed cancellation before or after work starts, with feasibility, completed/irreversible work, outstanding tasks, property return, charges and refund/credit settlement. Reopen with a reason and new linked work; never erase the original completion or payment history.
- **JOB-15 - Closure:** Treat production, property, customer acceptance and financial closure as separate conditions. A cancelled/delivered garment can still have an open receivable, payable, return or complaint; show those obligations until resolved.
- **JOB-16 - Aari and embellishment work:**
  - **Design library:** Each Aari/embellishment design has a motif name, reference image, placement and coverage, a complexity grade, an estimated effort range and a consumables template (beads, zari, stones, sequins, threads).
  - **Pricing:** Prices are calculated from the complexity grade and coverage using the owner-approved rate catalogue (FIN-01).
  - **Consumables:** Each consumable is recorded as shop stock, customer-supplied or artisan-supplied, so its cost lands in the right place.
  - **Workflow:** Marking or tracing on the cut panel, framing, Aari work, removal, quality check, then stitching. The template states when embellishment happens before or after cutting or stitching (JOB-02).
  - **Home-based artisans:** Dispatch to an artisan is external work (JOB-07, MAT-09) with an agreed piece rate, an expected return date and a returned-panel check, and the vendor due is recorded (OPS-11).
  - **Photos:** Completed-work photos may be used in the gallery only with recorded permission (DES-10).

## 16. People, external work and capacity

- **OPS-01 - Worker profiles:** Record name, contact where needed, approved skills, employment/vendor relationship, availability and active status. Inactive workers remain visible on historical work.
- **OPS-02 - Workload stacks:** Show in-progress, queued, blocked, awaiting quality review and completed work by person, with garment, fabric, due date, priority, next action and assignment history.
- **OPS-03 - Assignment and reassignment:** Support task-level assignment, transfer, acknowledgement where used and reason for reassignment. Record physical item custody separately so changing an assignee does not pretend a fabric handover occurred.
- **OPS-04 - External vendors:** Maintain craft capabilities, quoted costs, lead times, sent/return history, accepted/rejected work and outstanding payables. Provide printable/shareable job briefs without requiring a vendor login.
- **OPS-05 - Production estimates:** Record shop-approved expected effort or duration by task/garment complexity and dependencies. Distinguish active work time from waiting time and disclose where estimates are missing.
- **OPS-06 - Capacity and commitments:** Compare queued work against relevant worker skills, availability, holidays, trial buffers and vendor lead time. Warn before accepting an implausible date; an authorised owner may still accept with a reason.
- **OPS-07 - Planning view:** Provide day/week scheduling, due-date calendar, unassigned work and bottleneck views. A proposed queue change shows affected commitments and does not automatically promise new dates to customers.
- **OPS-08 - Piece-rate and time-based work:** Where used, record agreed task rates or payable hours, effective versions, completion/acceptance basis and worker advances. Owner labour may be estimated for contribution analysis without creating a payable to the owner by default.
- **OPS-09 - Payable settlement:** Calculate worker/vendor dues from approved work without double-counting supplier bills or advances. Track partial payments, disputed work and adjustments. Full statutory payroll is outside scope.
- **OPS-10 - Performance context:** Report on-time accepted work, rework categories and capacity utilisation with enough context to distinguish customer changes, supplier delays and production faults. Avoid opaque AI worker rankings.
- **OPS-11 - Minimal vendor obligation record (Phase 1):** For each external job (for example Aari dispatched to a home-based artisan), record the agreed charge, any advance paid, later payments, the acceptance or dispute, and the remaining amount due. Show a simple list of outstanding vendor dues. This record is the basis that OPS-08 and OPS-09 extend later; it must not require a parallel paper ledger.

## 17. Quotations, billing, payments and costs

### 17.1 Pricing and agreements

- **FIN-01 - Rate catalogue:** Maintain garment labour, lining, additional fabric, trims, craft work, alteration and approved rush charges with units, effective dates and owner permissions. Customer-supplied material is not charged as shop-supplied stock; an agreed handling/service charge, if any, is a separately disclosed line.
- **FIN-02 - Itemised quote:** Show quantity, rate, price inclusions, discounts, relevant tax treatment, total, validity and terms. Support garment-level quotes and a consolidated booking quote without duplicating the same revenue.
- **FIN-03 - Drafts and revisions:** Save an incomplete estimate with visible assumptions. Record approval/rejection and issue a new revision when scope or price changes. Prices used on old approved documents remain unchanged when the catalogue changes.
- **FIN-04 - Price versus cost:** Store customer selling price separately from internal estimated and actual fulfilment cost. Zero-priced, bundled and deliberately complimentary work must be possible without deleting its real internal cost.
- **FIN-05 - Shared amounts:** Allocate booking discounts, deposits and shared direct costs to garments/items using an explicit, reviewable method. Allocations must sum to the source amount, including rounding; do not make partial delivery balances depend on hidden assumptions. The default method is proportional to each line's agreed charge. Each share is rounded down to the whole rupee, and any remaining rupees go to the line with the largest charge (the earliest line if tied). The owner may reallocate manually with a reason before the bill for the affected line is issued; after that, only by an adjustment.

### 17.2 Documents and tax configuration

- **FIN-06 - Distinct documents:** Support quotes, booking acknowledgements, appropriate advance/payment receipts, invoices/bills, and applicable credit/debit adjustments. Identify each document clearly; issuing a quote does not create a confirmed payment.
- **FIN-07 - Billing configuration:** Configure the shop's actual tax status, approved item/service classifications, applicable treatment, effective dates, document fields and number sequences with accountant review. Do not embed an assumed universal tailoring tax rate or enable tax collection just because a template contains a tax column. The supported billing regimes are:
  - **Unregistered — required in Phase 1 (the founding boutique):** The shop issues a bill/cash memo and payment receipts with no GSTIN and no tax lines. The product must not display or collect tax. An optional turnover alert value, set by the accountant, warns the owner as her turnover approaches the registration threshold.
  - **Composition scheme — before onboarding any composition shop:** The shop issues a bill of supply carrying the required composition declaration and no tax collected from the customer.
  - **Regular GST — before onboarding any regular-GST shop:** The shop issues tax invoices with GSTIN, item classification codes, place of supply and the applicable tax split, plus advance receipt vouchers where an advance creates a tax liability. Tax-rate rules must be able to depend on the item's value where the law requires it.
  - **Out of scope:** E-invoicing and e-way bills. A shop subject to them must use an external compliant system for those documents, and the product records that restriction during onboarding.

  Thresholds and rules are confirmed with an accountant and are not hard-coded as legal facts.
- **FIN-08 - Issue and correction controls:** Draft documents can be edited; issued documents preserve their original content and are corrected using approved revision/void/credit processes. Preserve cancelled numbers and reasons rather than silently recycling them.
- **FIN-09 - Action-specific gating:** Validate the requirements of the financial document itself. A missing lining receipt must not independently block a legitimate advance receipt or required billing action. Never describe a financially complete document as proof that production is ready.
- **FIN-21 - Commercial event sequence:** The baseline sequence below fixes when money becomes due and when revenue is counted. Reports show the expected order balance and the collectible receivable separately.
  1. **Quotation:** creates no obligation.
  2. **Order confirmation with price approval:** sets the agreed order value. This is the expected order balance; it is not revenue or a receivable.
  3. **Advance:** recorded as a customer deposit and allocated to lines (FIN-05). It is not revenue.
  4. **Approved change or cancellation charge:** adjusts the agreed order value.
  5. **Bill issued (default: at handover of each garment, piece or service; a booking can be billed together when everything is handed over at once):** the amount becomes a collectible receivable and is counted as revenue. Deposits allocated to the billed lines are applied.
  6. **Later payments:** reduce the receivable. **Credits and refunds:** follow FIN-14.

  The owner may bill earlier (for example a full prepayment) with a reason. The default cannot be changed silently for past documents.

### 17.3 Payments, balances and refunds

- **FIN-10 - Payment recording:** Record cash, UPI, bank transfer and other enabled methods, payment date, reference, recipient business, amount, recorder and confirmation status. Support advances, instalments, split methods, a shared booking payment and unallocated customer credit.
- **FIN-11 - Verification states:** Distinguish reported/pending, confirmed, failed, reversed and refunded as appropriate. A QR code, screenshot or customer statement alone does not produce an automatically verified payment. Manual owner confirmation remains available with an audit trail. Pilot workflow:
  - **Cash** (the main method) is confirmed when received and reconciled at the daily till count (FIN-16).
  - **UPI** is confirmed by the owner with a one-tap "seen in my UPI/bank app" action, which identifies the receiving account from the configured list (owner's or a family member's UPI ID or bank account). Entering the UPI transaction reference (UTR) is optional but recommended; when entered, it is the duplicate-detection key.
  - A customer screenshot is attached as evidence, never as confirmation.
  - A dynamic UPI QR carrying the amount and order reference, and bank/UPI statement import, are Phase 2 options.
- **FIN-12 - Allocation and prevention of duplication:** One payment may fund multiple items, but allocated value cannot exceed confirmed available value. Detect duplicate references and repeated imported/provider events; recording the same payment twice must not reduce the balance twice.
- **FIN-13 - Transparent balance:** Show charges, discounts, tax, issued credits, confirmed allocations, unallocated credit, refunds, pending evidence and net amount still due separately. A pending payment is visible but does not settle the confirmed balance. An excess payment is a customer liability/credit, not extra sales.
- **FIN-14 - Refunds and reversals:** Record the reason, related cancellation/return/adjustment, approved amount, original source, beneficiary confirmation, method and settlement status. Distinguish a payment reversal that reopens a receivable from a refund associated with a reduced sale or customer credit. Failed refunds remain payable to the customer; retry must not refund twice.
- **FIN-15 - Credit handover:** Warn about unpaid balances at collection. Follow the owner's configured credit policy and approval limits instead of hard-coding that every garment must be fully paid before handover. Preserve the receivable after an authorised credit delivery.
- **FIN-16 - Daily reconciliation:** Compare recorded cash/UPI/bank collections, refunds and relevant fees against till counts or supplied settlement records. Show unmatched, duplicate, pending and reversed entries and record reconciliation adjustments without silently rewriting invoices.

### 17.4 Costs and management accounts

- **FIN-17 - Direct costs:** Record estimated and actual shop-material consumption, externally purchased services, accepted labour, direct fulfilment fees and rework. Link cost evidence and avoid counting both the purchase of stock and its consumption as the same order cost twice.
- **FIN-18 - Overheads and owner withdrawals:** Record rent, utilities and other business expenses separately from direct order contribution. Separate business expense, owner contribution/withdrawal and transfer between business payment accounts. Full financial accounting remains outside the core product.
- **FIN-19 - Profitability presentation:** Show missing cost data, estimated versus actual values, optional owner-labour allocation and selected overhead allocation. Do not label contribution or cash collected as net profit.
- **FIN-20 - Financial controls and export:** Restrict discounts, write-offs, refunds, manual adjustments and period changes according to authority. Export linked quotes, invoices, credit adjustments, payments, expenses, supplier balances and worker dues for accountant review, with clear reporting dates and definitions. For registered shops, also provide exports that a Tally-using accountant can import and that support GSTR-1 preparation.

## 18. Ready-made retail and linked alterations

- **RTL-01 - Product and variant catalogue:** Record product/style, size, colour, SKU/barcode where used, price, cost, supplier and active availability. Keep this separate from custom pattern/type libraries and the physical-mannequin history.
- **RTL-02 - Variant stock:** Track opening stock, receipts, saleable/reserved/damaged stock, sales and adjustments for the exact variant. Show available quantity before sale/reservation and prevent accidental overselling.
- **RTL-03 - Sale and mixed checkout:** Add retail items and custom services to a shared booking/checkout where appropriate. Preserve line-level taxes, discounts, costs and fulfilment status.
- **RTL-04 - Reservation and deposit:** Record a hold/reservation, expiry/review date, deposit policy and release. A reservation is not a completed sale or physical handover; cancellation must settle the deposit under the approved policy.
- **RTL-05 - Linked alteration:** Create an alteration garment order with wearer, exact retail item, requested changes, trial/date, charge and worker. Preserve the retail stock/transaction link even when alteration is complimentary.
- **RTL-06 - Return and exchange:** Apply the shop's configured eligibility rules, including altered or damaged items. Link the original sale, inspect condition, record credit/refund or price difference and restock only when appropriate. An exchange is linked outbound and inbound activity, not an overwrite of the first sale.
- **RTL-07 - Cancellation coordination:** Cancelling/returning a retail item prompts review of reserved stock, linked alteration progress, irreversible work, customer property and refund obligations.
- **RTL-08 - Retail reporting:** Show sales, net returns, variant availability, stock ageing and contribution separately from custom stitching while supporting a combined shop view.

## 19. Customer experience and communications

- **COM-01 - Customer overview:** Provide a shop-branded view of the customer's authorised bookings, garment summaries, agreed dates, approved scope, appointment details and shareable payment documents. Show only selected customer-friendly progress, not every internal task or margin.
- **COM-02 - Secure access:** Provide customer/account access or a scoped private-link flow with expiry/revocation and suitable confirmation for sensitive actions. Forwarding an unprotected link must not expose an entire customer history or another wearer's private data. Baseline access model (customer access starts in Phase 2):

| Customer action | Who may do it | Access method |
|---|---|---|
| View order status, ready notice, appointment, bill/receipt | The contact/payer for that booking | Private link scoped to that booking, with expiry and revocation |
| Approve a design/quote revision or acknowledge a date change | The contact/payer for the wearers they manage; a guardian for a minor wearer | Link scoped to that revision plus a confirmation step |
| View measurements or fitting photos | The wearer, or the guardian of a minor wearer | Never through an ordinary shared link; in-shop or after explicit wearer authorisation |
| Change contact phone number | — | Owner-assisted re-verification; old links are revoked |

  A shared family phone gives access only to bookings that phone's contact pays for or manages. Any one-time-password channel (SMS needs DLT registration; WhatsApp needs an authentication template) is decided in Section 32 before Phase 2.
- **COM-03 - Customer decisions:** Let customers approve/reject the specific design/quote revision, acknowledge a date change, request an appointment or ask for an alteration. Requests remain pending until accepted; they cannot directly rewrite committed production records.
- **COM-04 - Owner-triggered sharing:** Produce shareable booking confirmations, material requests, trial reminders, ready notices, balance statements and receipts through the owner's selected channel. Record whether the product only prepared content, the owner marked it sent, or delivery was confirmed by a supported service. Phase 1 mechanism: a WhatsApp click-to-chat link opens the owner's WhatsApp Business App with prefilled Tamil or English text addressed to the customer's number. The related PDF/image is attached through the device share sheet on mobile, or downloaded and attached on desktop. The owner then marks the message sent. No WhatsApp API or automated sending is used in Phase 1.
- **COM-05 - Automated messages:** When enabled and permitted, send selected transactional reminders through supported official services, using required permissions/templates and shop limits. Each event must check current order/payment status before sending and avoid duplicate reminders. Before enabling this, decide whether to move the owner's existing WhatsApp Business App number to the WhatsApp Business Platform or use a separate number, and set the monthly message budget (Section 32.3).
- **COM-06 - Language and tone:** Support Tamil and English customer templates, editable shop identity, respectful phrasing and concise garment/date information. Provide preview before consequential or uncertain messages.
- **COM-07 - Preferences and consent:** Record channel preference, consent source/time and opt-out. Separate service communication from marketing permission. Lack of marketing consent must not prevent normal fulfilment through another available channel.
- **COM-08 - Communication timeline:** Show linked messages, owner notes, confirmed delivery failures, customer replies available through supported access and action status. Do not imply the product can read a private messaging account or all past conversations without an authorised capability.
- **COM-09 - Reminder controls:** Configure timing, frequency, quiet hours, escalation, snooze and stop conditions. Stop balance reminders when the relevant amount is settled and pickup reminders once handover is recorded; preserve other unresolved obligations.
- **COM-10 - Provider failure and cost visibility:** Show unavailable connections, failed sends and usage/cost limits. Preserve the prepared message and offer a manual route. Communication failure must not prevent work progressing inside the shop.
- **COM-11 - Customer issues:** Allow a customer to report a problem against the relevant garment, with optional evidence and acknowledgement. Route it to an owner and provide an explicit resolution rather than burying it in a chat transcript.

## 20. Daily workspace, search and alerts

- **DAY-01 - Action-first home:** Show due/at-risk work, today's trials, pending customer decisions, missing materials, vendor returns, unassigned work, quality failures, ready-but-uncollected garments and balances needing attention.
- **DAY-02 - Action cards:** Each card identifies the customer/wearer as permitted, garment, fabric type, order date, original/current promised date, present task, owner, blocker, reason for alert and next action. Provide a direct route to complete that action.
- **DAY-03 - Order lists:** Support garment/category, customer, date range, production status, worker/vendor, priority, overdue, unassigned and booking filters. Combine filters, show clear empty states and allow reset/saved views.
- **DAY-04 - Search:** Find records by customer/wearer, phone fragment, order/booking identifier, garment, material label or documented reference. Respect access boundaries and handle common spelling variations without merging identities.
- **DAY-05 - Views:** Provide a readable list, garment progress board and day/week calendar. An owner can use the simple list without being forced into drag-and-drop planning.
- **DAY-06 - Delivery warnings:** On owner/admin entry, show a prominent due-work panel covering due in three days, two days, tomorrow, today and overdue. Keep acknowledged/snoozed items in the relevant list without repeated intrusive popups. Distinguish readiness lateness from a customer's delayed pickup. The warning window counts calendar days in the shop's local date by default; the shop can switch to working days using the SET-02 calendar. Each category can have a longer window (for example Bridal or heavy Aari work). An order with a delivery time slot becomes overdue when the slot passes; otherwise at the end of the shop's working day.
- **DAY-07 - Exception ownership:** Allow acknowledge, assign, snooze with reason, resolve and reopen. Acknowledgement is not resolution. Mark the action complete only when the underlying business condition changes or an authorised exception is recorded.
- **DAY-08 - Clear prioritisation:** Explain whether priority comes from promised date, missing prerequisite, customer event, owner-selected rush or another configured rule. Do not silently reorder work using an opaque AI score.
- **DAY-09 - Quick actions:** Offer new enquiry, new booking/garment, record material receipt, record payment, update task, book trial and handover from a small set of accessible actions.
- **DAY-10 - Daily close:** Present unfinished commitments, tomorrow's critical work, cash/payment mismatches and items awaiting owner decisions. Optional narrative assistance must link to underlying records and actions, not replace them.

## 21. Mannequin gallery and Instagram viewer

### 21.1 Physical-mannequin costume gallery

- **SHO-01 - Mannequin master:** Create any number of actual shop mannequins, each with a unique ID and optional name/location. Do not hard-code the founding shop's count of three.
- **SHO-02 - Costume changes:** Add dated costume photos with fabric type, description and relevant notes whenever the mannequin changes costume. Preserve chronological history rather than overwriting the previous display.
- **SHO-03 - Customer showcase:** Show recent uploads and let visitors open an individual mannequin's history. Customer/gallery users enter here by default; staff enter their work view instead. When enabled, the showcase is a public page that needs no sign-in (suitable for an Instagram bio or Google Business Profile link). It contains only published images and an enquiry action. In Phase 1, customers have no other product surface; they receive shared PDFs and messages through WhatsApp.
- **SHO-04 - Publishing control:** Support draft/published/archived visibility, cover selection, correction of costume dates and owner-controlled photo withdrawal. Historical internal records may remain according to retention policy even after public unpublishing.
- **SHO-05 - Enquiry from showcase:** Allow a customer to enquire about a specific approved costume image. Carry its reference into an enquiry without treating it as an available retail SKU, fixed price or guaranteed reproducible pattern.
- **SHO-06 - Privacy and asset rights:** Separate published mannequin images from private customer fitting/reference images. Apply permission, download/share and removal policies; never publish automatically because an image was uploaded to an order.

### 21.2 Instagram feed viewer

*Excluded from the pilot by owner decision. Customers can be pointed to the shop's Instagram profile through a link. The requirements below are post-pilot scope and are reconsidered only when there is evidence that owners value the viewer.*

- **SHO-07 - Read-only feed:** Display supported posts already published on the shop's connected Instagram account, including available media/thumbnail, caption, publication date and open-post action. This is not a posting or scheduling tool.
- **SHO-08 - Refresh controls:** Provide manual refresh, last successful refresh, loading/error/retry feedback and optional periodic refresh where supported. Failed refresh preserves the previous successful content and visibly labels its age.
- **SHO-09 - Connection lifecycle:** Show supported account/access prerequisites, granted connection status, expired/revoked access and a reconnect/disconnect flow. Do not ask the shop to hand over its social-account password or promise access beyond the approved connection.
- **SHO-10 - Content separation:** Keep Instagram posts, physical-mannequin costume history, private design references and ready-made catalogue items distinct. Explicit linking is allowed; importing one must not create the others automatically.

## 22. Business reporting and marketing attribution

- **REP-01 - Operational scorecard:** Show incoming/completed orders, work in progress, original-promise readiness, current delays, blocked duration, trial outcomes, avoidable rework and ready-but-uncollected age.
- **REP-02 - Sales and collections:** Report quoted, approved, invoiced, credited, confirmed collected and outstanding amounts distinctly. Support garment, booking, service/category and period views without counting a booking and its garments twice.
- **REP-03 - Contribution:** Show estimated/actual direct cost and order contribution, with cost-completeness flags. Separate shop-level overheads and any optional allocations; surface loss-making or cost-incomplete work without false precision.
- **REP-04 - Receivables and payables:** Provide ageing by agreed due date, customer/booking and worker/vendor/supplier, including disputed, pending and approved-credit cases. A date not yet agreed remains unknown rather than automatically overdue.
- **REP-05 - Materials and retail:** Report stock availability/ageing, consumption, adjustments, shortages and open customer-property custody. Customer fabric is not treated as business inventory value.
- **REP-06 - Customers and services:** Report repeat orders, enquiry conversion, garment/service demand, complaint resolution and relevant fit outcomes. Do not equate storing more personal data with better customer insight.
- **REP-07 - Acquisition sources:** Capture walk-in, referral, Google Business Profile/Maps, WhatsApp (direct, Status or forwarded), organic Instagram, Click-to-WhatsApp or boosted-post ads, Google Ads, other Instagram/Meta Ads, local directories and other/unknown sources. Keep source, campaign, evidence and confidence/assignment method visible.
- **REP-08 - Advertising inputs:** The baseline paid-ad scope is Google Ads and Instagram advertising obtained through supported Meta access, with manual entry/import fallback. In the pilot, ad spend is entered manually as a monthly figure per channel; platform data sync is post-pilot. Record campaign dates, spend and available metrics. Identify Instagram-placement spend separately where the source supports that split; label mixed-placement campaigns rather than presenting all Meta spend as Instagram-only. Reach, impressions, clicks and leads retain their respective source definitions.
- **REP-09 - Attribution policy:** Configure the attribution model/window and treatment of repeat enquiries and multi-touch exposure before reporting. Allow an unknown/unattributed share. Do not count the full value of the same order against multiple campaigns in a combined total.
- **REP-10 - Campaign outcomes:** Link enquiries to converted bookings/orders and report cost per qualified enquiry, cost per confirmed order and attributed net revenue under a clearly named policy. Separate platform-reported conversions from verified boutique orders.
- **REP-11 - ROAS and contribution after advertising:** Show the chosen attributed revenue basis, ad spend and formula. Label contribution after advertising separately from ROAS and from full business profit. Returns/credits must affect the selected reporting basis consistently.
- **REP-12 - Comparison and freshness:** Compare like periods and definitions, show last successful sync/import, preserve previous data on failure and identify provisional/late-arriving values. Provide a manual correction history.
- **REP-13 - Filters and drill-down:** Filter by relevant date basis, service, worker, source/campaign and business unit supported by the product. Every important total should open its contributing records; document zero-denominator and missing-data behaviour.
- **REP-14 - Business review actions:** Turn an observed issue into an owned action, such as review pricing, follow up a balance, address repeated rework or stop accepting an overloaded slot. Advertising budget changes remain human decisions; this module does not autonomously run campaigns.

## 23. Outcome-led AI assistance

### 23.1 Product role

AI is an optional assistance layer over visible business records and approved rules. It must save effort or improve an observable business outcome. A fluent answer, generated summary or number of AI interactions is not sufficient evidence of value.

Every action-oriented AI flow follows:

**Input -> source-linked interpretation -> missing-information check -> reviewable proposal -> required approval -> recorded action -> measurable result.**

The owner must always be able to complete the underlying workflow without AI. Voice is optional, not compulsory; forms, quick actions and text remain fully usable.

### 23.2 Required capabilities

- **AI-01 - Tamil/English assisted intake:** Turn explicitly supplied speech, text, notes or reference documents into a draft enquiry/garment order. Recognise shop terminology and mixed-language phrasing where validated. Link proposed values to the input, highlight uncertain names/numbers/units/dates and require confirmation before consequential values are committed. Do not assume access to private chat history.
- **AI-02 - Relevant follow-up questions:** Use the garment, selected work and approved checklist to ask only unresolved relevant questions. Skip answered questions, distinguish not required from unknown, and keep mandatory checks even when the AI considers an answer likely. Never generate a new measurement or tailoring rule merely to finish the form.
- **AI-03 - Scope and quote completeness:** Compare approved requested work, material source and quoted inclusions. Suggest omitted/duplicated charges or unanswered price questions. Recognise bundled, complimentary and customer-supplied items; adding a charge or changing the total requires authorised approval.
- **AI-04 - Delivery-risk assistance:** Explain risk using missing materials, blocked tasks, vendor return dates, trials and available capacity. Propose a specific action and show affected garments. Start from transparent business rules; predictive estimates can be enabled only after relevant data and evaluation exist. No silent date changes, worker reassignment or customer commitment.
- **AI-05 - Source-linked fit recall:** Retrieve relevant prior accepted garments for the same authorised wearer and show the actual recorded correction, fabric and construction context. Propose questions or reuse for review; do not autonomously change measurements or guarantee a fit.
- **AI-06 - Collection/payment assistance:** Draft the right next reminder using the latest confirmed payment, handover and consent state. A proposed message becomes an outcome only when the intended action occurs. Routine sending can follow a separately approved automation policy; unusual, disputed or uncertain cases return to the owner.
- **AI-07 - Design-reference structuring:** Suggest neckline/sleeve/embellishment tags and clarification questions from supplied reference images. Treat interpretation as uncertain where necessary. Do not derive exact body dimensions, hidden construction or guaranteed fabric quantities from an ordinary photo.
- **AI-08 - Assisted document entry:** Extract proposed supplier-bill, expense or legacy-order fields from owner-supplied documents/images. Show the source beside the draft, flag unreadable values and detect possible duplicates. Financial confirmation and opening balances require human review.
- **AI-09 - Action-linked operational questions:** Support questions such as "What prevents Friday's blouses from being ready?" with authorised source records, known/unknown distinctions and actions. Do not invent profit, causation or a missing deadline. This interface is supplementary, not a replacement for the daily workspace.
- **AI-10 - Feedback and enablement:** Allow per-shop capability controls, correction/rejection, undo where the underlying action is reversible, usage limits and escalation to manual work. Record model-assisted proposals separately from human-confirmed business facts.

### 23.3 Outcome and safety scorecard

| Capability | Primary business measure | Countermeasure/quality check |
|---|---|---|
| Assisted intake and follow-up | Median confirmed intake time; requirements discovered late | Critical-field error rate; review/correction time; abandoned intakes |
| Quote completeness | Genuine omitted charges resolved before agreement; reduced billing disputes | False suggestions, unwanted charges, customer complaints |
| Delivery assistance | Original-promise ready rate; reduction in preventable late work | False alarms, ignored alerts, unnecessary queue disruption |
| Fit recall | Repeat-order preparation time; avoidable alteration effort/cost | Incorrect context matches; inappropriate copied corrections |
| Collection assistance | Ready-to-collection time; overdue balance value | Duplicate/wrong reminders, opt-outs, complaints |
| Reference structuring | Time to reach an approved design specification | Misinterpreted design choices; downstream rework |
| Assisted document entry | Entry and reconciliation time | Amount/date/tax/reference errors; duplicate records |
| Operational question answering | Time to locate and complete the right action | Unsupported claims, stale answers, unauthorised data exposure |

### 23.4 Non-negotiable AI controls

**No guessing critical facts.** Missing measurements, unclear units, payment confirmation, price approvals and pattern rules stay unresolved until properly confirmed. AI cannot overwrite a source fact to make a workflow appear complete.

**No independent control of money or irreversible work.** Refunds, extra charges, purchases, credit write-offs, cutting release, material substitution, measurement revisions and customer commitments require the configured authority. Pre-approved routine reminders are not permission for broader action.

**No unsupported learning across boutiques.** Another shop's customers, measurements, garments or private media must not become searchable examples or suggestions. Any separate cross-shop learning programme would require its own approved policy and permission; it is not part of this plan.

**Safe failure and stale-state checks.** An unavailable or uncertain AI service leaves a usable draft/manual path. Repeated attempts must not duplicate orders, messages or payments. Before executing a previously suggested action, recheck whether the underlying order, approval or balance has changed.

**Source content is not authority.** Instructions embedded in an uploaded bill, image, reference document or external message are content to interpret, not permission to change prices, reveal records or perform actions. Only the authorised user interaction and approved shop rules can authorise a business action.

**Visible data use.** Before enabling an AI feature, explain which customer content is processed externally and under what retention/use terms. Use only the minimum relevant information. Customer content must not be reused for external-provider training by default; enable the feature only when the chosen service terms/settings meet the approved policy. Do not claim that a privacy preference is enforced unless it actually is. Keep a manual path for excluded records or unavailable compliant processing.

**Measurable evaluation.** Compare similar real workflows with and without assistance, including human review time, costs and errors. Record accepted/rejected suggestions and eventual outcomes. Disable or redesign a feature that produces no net benefit or introduces unacceptable errors; feature usage is not proof of improvement.

## 24. Privacy, permissions and trustworthy records

- **TRU-01 - Shop isolation:** A user, worker, customer or support interaction may access only explicitly authorised boutiques and records. Search, exports, images, notifications and AI retrieval must honour the same boundaries.
- **TRU-02 - Basic role controls:** Enforce the role boundaries in Section 4 before shared use. Separate permission to view costs, edit measurements, issue documents, approve discounts/refunds, export data, publish media and administer connections. This is a fixed role matrix with a few owner toggles, not a permission-design interface (Phase 1 has only the Owner role):

| Permission | Owner | Manager/front desk | Tailor/finisher | External worker | Bookkeeper |
|---|---|---|---|---|---|
| Customer directory and contact details | Yes | Yes | Assigned jobs only | Minimum for the shared job | No |
| Measurements and fitting photos | Yes | Toggle | Assigned jobs only | Shared piece only | No |
| Prices, costs and margins | Yes | Prices yes; costs by toggle | No | Own rates only | Yes |
| Issue bills/receipts, record payments | Yes | Yes | No | No | View only |
| Discounts, refunds, write-offs | Yes | Within toggle limit | No | No | No |
| Configuration, roles, connections, exports | Yes | No | No | No | Financial export only |
| Publish media | Yes | Toggle | No | No | No |
- **TRU-03 - Customer/wearer privacy:** Protect measurements, fitting photos, contact details and private notes. Sharing a family contact or booking does not grant blanket access to every individual record.
- **TRU-04 - Consent and notice:** Provide understandable notice of collected data and intended use. Record permissions for marketing, promotional imagery and optional sensitive media separately from ordinary fulfilment. Configure and review the applicable privacy obligations before launch rather than embedding unverified legal claims.
- **TRU-05 - Data minimisation:** Do not require date of birth, identity documents, body photographs or unrelated personal details for a normal tailoring order. Minors (under 18) are accepted. For a minor wearer:
  - record an "under 18" flag (not a date of birth) and the parent or legal guardian who authorises the order;
  - capture the guardian's consent before storing the minor's measurements or photos;
  - a payer who is not the parent or guardian cannot give this consent;
  - images of minors are never published, and minors' data is never used for marketing targeting.
- **TRU-06 - Business audit history:** Preserve significant changes to orders, measurements, pattern rules, prices, assignments, approvals, payment confirmations, refunds, stock, custody, dates and permissions with actor/time/reason.
- **TRU-07 - Document and media visibility:** Private assets stay private unless deliberately published. Customer exports, gallery pages and shared job slips omit internal cost/margin and unrelated records. Revoking a share prevents future access through that share, subject to copies already legitimately downloaded.
- **TRU-08 - Correction, archive and deletion:** Provide reviewed correction/deletion/export requests and clear status. Balance applicable retention needs with deletion; where details must be retained, explain that instead of falsely confirming complete erasure.
- **TRU-09 - Account and access lifecycle:** Support invitations, departure/revocation, shop ownership transfer under verification and customer-share revocation. A worker leaving does not remove their historical assignments or payable records.
- **TRU-10 - Recovery:** Provide recoverable business records and media under the approved backup policy, a tested restoration process and visible handling of detected data loss or corruption. Restoring records must not blindly repeat past external messages/refunds. Before the founding pilot holds live money, custody or measurement records:
  - agree the maximum acceptable data loss and restoration time (proposed starting point: no more than 24 hours of confirmed records lost; restoration within one business day);
  - complete one successful test restoration;
  - provide a printable paper fallback slip for intake and payments during an outage, with a later reconciliation step.

  This is the single recovery gate. Sections 29, 32 and 33 refer to it.
- **TRU-11 - Integrations and support:** Let the owner view, revoke and reauthorise connected services. Support access is time/scenario limited, owner-authorised where appropriate and recorded; never require routine sharing of account passwords.
- **TRU-12 - Financial integrity:** Preserve source documents and adjustments, block unauthorised retrospective edits, and expose reconciliation differences. Audit history is not an excuse to keep unnecessary sensitive content forever; retention applies deliberately to both records and associated evidence.
- **TRU-13 - Digital personal data protection:** Put the obligations of India's Digital Personal Data Protection Act 2023 and its Rules into operation, with applicability and commencement dates confirmed by advice before real-data use:
  - **Roles:** The boutique is the data fiduciary for its customers. The product provider acts as its processor under a written data-processing agreement.
  - **Notice and consent:** Provide a short notice in Tamil and English, and record consent at intake. When a payer enters a family member's data, the payer confirms they are authorised to share it and that the wearer has been informed. Minors follow TRU-05.
  - **Rights and grievances:** Show the boutique's grievance contact. Handle access, correction, erasure and consent-withdrawal requests with tracked status (CUS-09, TRU-08).
  - **Breaches:** Maintain a breach-response procedure, including notification of the regulator and affected people as the law requires.
  - **Retention:** Retention and deletion also cover exports, backups and external processors.
  - **Children:** No behavioural tracking or targeted advertising directed at children.

## 25. Usability, continuity and data portability

- **USE-01 - Mobile and desktop use:** The product is a desktop web application that is also a mobile-responsive installable web app (PWA); there is no native app. Every Phase 1 workflow must be fully usable at three sizes: mobile phone, tablet, and desktop/large screen. The reference devices are a low- to mid-range Android phone on intermittent mobile data and a standard laptop or desktop browser. Support one-handed quick actions, readable labels, clear required/optional fields and a practical desktop view for planning, costing and pattern printing. Do not rely on hover-only or colour-only meaning.
- **USE-02 - Language:** Provide Tamil/English core labels, garment terminology, message templates and input, with Tamil-first available as a shop default. Search must match across Tamil script, Tamil typed in Latin letters, and English spellings of names and garment terms. Preserve customer names and original notes rather than silently replacing them with an AI translation. Additional languages are configuration/product expansion, not assumed launch support.
- **USE-03 - Reliable drafts:** Save intake drafts to the shop's records (auto-saved while connected) and show saving, saved and not-saved/failed states. Phase 1 forms are online-only: if the connection drops, the open form keeps what has been typed on screen, clearly shows that the latest changes are not saved, and saves them when the connection returns or the user retries. Retries must not create duplicate records or actions. An interrupted connection must never silently lose saved work or falsely display unsaved work or an uncommitted payment as saved or complete.
- **USE-04 - Connectivity boundaries:** Phase 1 requires a connection for all work. The installable app (PWA) provides home-screen installation and a clear "you are offline" notice; it does not capture or store business data on the device beyond the page that is open. Confirmation-dependent actions such as final stock allocation, authoritative payment confirmation or irreversible release always use current shop records. Offline capture of intake drafts and measurement sessions with later synchronisation is deferred by owner decision (Section 32.1) and listed as an optional extension (Section 31.2); it is reconsidered only if the pilot shows that connectivity is a real obstacle. A fully offline multi-user POS is not promised by this plan.
- **USE-05 - Import and migration:** Import customers, legacy measurements, opening stock, active orders and opening receivables/payables through supported templates and review. Preview errors/duplicates, preserve source and cut-off date, and require approval before opening balances go live. Do not count migrated balances again as new sales or purchases. For handwritten measurement books, allow photos of notebook pages to be attached to a customer/wearer as an unconfirmed legacy record, searchable by the old book/page number. The values are typed in and confirmed when that wearer next orders.
- **USE-06 - Export:** Export customer/wearer records, orders, measurements and their relevant history, approved patterns, bills/payments, stock, costs and permitted media through understandable formats. Clearly identify what is included and any exclusions or retention limits.
- **USE-07 - Printing and media:** Provide readable receipts/job cards, material labels and pattern outputs with preview. Printing must never be required: every printable output is also a PDF that can be shared through WhatsApp, and A4 is the default paper size. Show upload failures, supported file limits and missing assets; core order work must not require loading every historical image. Compress photos for mobile data.
- **USE-08 - Concurrent updates:** When another person changes a record during editing, disclose the conflict and prevent silent overwriting of measurements, stock, approvals or money. Repeated clicks/retries must not create duplicate business actions.
- **USE-09 - Recovery and accessibility:** Support clear errors, non-destructive cancellation, review before consequential changes, keyboard/screen-reader-friendly workflows where applicable and accessible contrast/targets. Define and test practical performance and recovery targets before each release rather than claiming unmeasured guarantees.

## 26. Small-business product administration

- **BIZ-01 - Guided onboarding:** Create a shop, select operating modules, import or enter starting records, review policies and complete a first sample order without developer assistance. Provide a resettable practice experience that cannot send real messages or affect live finances.
- **BIZ-02 - Reusable configuration:** Allow supported differences in garment catalogues, prices, checklists, working calendars and messages without making a separate custom product for each boutique. Explain what is configurable and what needs a product change.
- **BIZ-03 - Shop membership:** Let one authorised person belong to multiple shops with an explicit current-shop indicator and switch. Sharing membership does not merge business data or introduce multi-branch stock/accounting features.
- **BIZ-04 - Plans and limits:** If sold as a subscription, show the chosen plan, included users/features, AI/message/media allowances, usage and any paid overage approval. Final prices and quotas are not fixed in this document; never promise unlimited costly services by default.
- **BIZ-05 - Expiry and exit:** Explain renewal, cancellation, grace/read-only access where offered, export period, data retention and deletion. Product-plan expiry must not make the owner's financial records misleading or silently erase outstanding obligations.
- **BIZ-06 - Support and feedback:** Provide a way to report a problem with relevant record context and permission, track status and collect feedback tied to an actual workflow. Avoid demanding full private customer exports for routine troubleshooting.

## 27. Lifecycle rules and workflow gates

### 27.1 Separate lifecycle dimensions

Do not represent the whole business with one overloaded status field. The following are the product's baseline state families; shops can simplify labels but cannot erase their meaning.

| Dimension | Baseline states/meaning |
|---|---|
| Enquiry | New, contacted, awaiting information, quoted, follow-up due, converted, closed/lost. |
| Booking | Draft, confirmed, active, partially fulfilled, fulfilled, fulfilled with cancellations, cancelled, closed. Financial/property closure remains separate; "closed" requires production, property and financial closure (JOB-15). |
| Garment progress | Draft, booked, preparation, production, trial/correction where used, quality review, ready, cancelled. A visible hold/blocker can apply to active work. Handover is tracked only in the Handover dimension. Outfit pieces (ORD-13) carry their own progress, and the order shows the least-advanced unresolved piece. |
| Individual task | Not required, pending, ready, in progress, blocked/on hold, completed, accepted or rejected where review is required. |
| Assignment | Unassigned, assigned, reassigned; the responsible person and history remain visible. |
| Requirement | Required but unresolved, promised, partially received/shortfall, confirmed/received, received but unusable, not required, completed; use the state appropriate to the requirement type. |
| Customer approval | Not requested, awaiting approval, approved, rejected, superseded or withdrawn. Approval always refers to a particular scope/version. |
| Quotation | Draft, shared, approved, rejected, expired, withdrawn, superseded. |
| Billing document | Draft, issued, voided/corrected under the approved document process; retain the original. |
| Payment evidence | Reported/pending, confirmed, failed, reversed. A refund or credit settlement is its own related record with states: approved, paid, failed. |
| Financial position | Unpaid, partially paid, settled, customer credit/refund due, disputed or written off under authority. Derive amounts from recorded financial events. |
| Customer property | Expected, received, with shop/worker/vendor, consumed as agreed, returned, retained with permission, disposed under published policy, lost/damaged or unresolved. |
| Handover | Not ready, ready awaiting collection, partly handed over, dispatched where used, received/collected. This dimension is authoritative for handover. |
| Complaint/change | Open, assessing, awaiting approval, in progress, resolved, closed or reopened. |

A garment can be delivered while payment remains outstanding under approved credit, or cancelled while a refund/property return remains open. Show those facts rather than forcing a misleading single "complete" flag.

### 27.2 Action-specific gates

| Action | Required check | Explicitly not assumed |
|---|---|---|
| Save enquiry/draft order | Enough information to identify and recover the draft | All measurements/materials/payment are already available |
| Share preliminary quote | Identified scope, price assumptions, draft/estimate label | Production is ready or a deposit has been paid |
| Record advance/appropriate receipt | Correct customer/booking, amount, method, confirmation/document requirements | Fabric/lining has arrived |
| Confirm design or date | Exact revision, authorised approver and evidence | A message draft or unanswered share equals approval |
| Generate exploratory pattern | Supported rules and all inputs needed for that preview, explicit assumptions and non-release label | Physical fabric is already received or output is safe to cut |
| Release pattern/cutting work | Validated/reviewed output or approved manual method, current inputs, approved design, task-relevant materials and assignee | A nice-looking preview or AI confidence establishes fit/accuracy |
| Start stitching | Its required predecessor tasks/materials are accepted/ready and a valid worker is assigned | Every possible task in the product is mandatory |
| Mark external work accepted | Returned quantities/property and relevant quality check | Vendor saying "done" means the shop received/accepted the items |
| Mark garment ready | Required production/quality checks passed; required trial decisions resolved | Payment has necessarily been collected or customer has collected |
| Hand over garment | Correct item and recipient, handover/property checklist and settlement/credit decision | All items in the booking are simultaneously complete |
| Cancel work | Approved cancellation, irreversible-work review, commitments and money/property settlement actions | Cancel means delete history, refund everything automatically, or ignore vendor dues |
| Issue refund/write-off | Appropriate authority, source obligation, beneficiary/amount and duplicate prevention | AI suggestion or pending payment evidence authorises money movement |
| Publish an image | Approved visibility and relevant rights/permission | Uploading privately gives promotional permission |
| Send automated reminder | Current business state, permission, timing, duplication/cost checks | A previously queued message remains correct forever |

### 27.3 Exceptions and history

Owner override is allowed only for a defined business exception, such as accepting a risky date or approving credit handover, and requires the configured authority and reason. It is not a universal bypass for missing identity, unvalidated pattern inputs, unauthorised access or unconfirmed payment.

A required prerequisite can be declared not applicable only under the relevant approved rule or an explicitly reviewed template change. It cannot be bypassed merely by leaving a field empty or marking a mandatory task complete without its evidence.

Changing a promised date requires a reason and records customer agreement where applicable. Preserve original, revised and actual dates; a late order cannot become historically on-time just by editing its promise.

### 27.4 Key transitions and aggregation

| Transition | Trigger and prerequisite | Permitted reversal |
|---|---|---|
| Draft -> booked (garment) | Customer, wearer, garment type and agreed delivery date confirmed | Cancel the draft (no settlement needed if no money or property is held) |
| Ready -> back to production/quality review | A defect or required change is found after the garment was marked ready (JOB-11) | Ready again after checks pass; the first-ready event is preserved and flagged for metrics |
| Handed over -> reopened for alteration | Customer returns the garment for a correction | A new linked correction job is created; the original handover is never erased (JOB-14) |
| Any active -> cancelled | Approved cancellation with irreversible-work review and settlement actions (§27.2) | Reopen with a reason as new linked work; the cancellation event is preserved |
| Quotation approved -> superseded | A new revision is approved | None; old revisions remain readable |
| Payment confirmed -> reversed | Bank or UPI reversal, or a confirmation recorded in error | Allocations are reversed once and the receivable reopens (AC-19) |

**Booking aggregation:**
- A booking is **active** while any garment is in progress.
- It is **partially fulfilled** when at least one garment/piece is handed over and another is still unresolved.
- It is **fulfilled** when every garment is handed over.
- It is **fulfilled with cancellations** when every garment is either handed over or cancelled and at least one was handed over.
- It is **cancelled** when every garment is cancelled.
- It is **closed** only when the conditions above are met and no money, property, vendor due or complaint is outstanding.

## 28. Success measures and evaluation

### 28.1 Business definitions

| Measure | Required definition |
|---|---|
| Confirmed intake time | Time actively spent capturing and reviewing a valid order, including correction of assisted entry; report sample and garment mix. |
| Administration time per order | Intake, search, updates, follow-up and reconciliation effort per completed comparable garment; do not count only typing saved. |
| Original-promise ready rate | Eligible garment orders due in the period that reached valid readiness by their original accepted promise divided by eligible orders due. Keep unfinished overdue work in the denominator; show exclusions/cancellations separately. |
| Current-promise ready rate | The same measure against the latest agreed promise, clearly labelled and never substituted for original-promise performance. |
| Valid readiness | Required checks passed and readiness was not subsequently invalidated by a known unresolved defect. Preserve any withdrawn readiness event in history and flag its effect on the metric. |
| Ready-to-collection time | Elapsed time from valid readiness to actual handover, with customer delays separated from production lateness. |
| First-trial acceptance | Garments accepted without an avoidable corrective cycle at their first attended trial divided by comparable garments with an attended trial; planned fitting work is reported separately. |
| Avoidable rework | Recorded effort/direct cost and count of corrections classified under the approved cause policy. Customer scope changes are not automatically worker error. |
| Net order revenue | Issued/recognised customer charges under the selected reporting basis, less relevant discounts and sales credits/returns, excluding tax. Deposits and payment-account transfers are not new revenue. |
| Order contribution | Net order revenue minus attributable direct fulfilment costs. Show missing/estimated costs and do not subtract the same cost twice. |
| Cash collected | Confirmed incoming customer payments, with refunds/reversals and reporting basis shown; not equivalent to revenue or profit. |
| Outstanding balance | Remaining collectible obligation after the appropriate charges, credits, confirmed allocations and reversals. Show customer credit/refund liability and pending evidence separately. |
| Enquiry conversion | Qualifying enquiries converted under a defined period/cohort policy divided by qualifying enquiries. Show the definition and conversion lag. |
| Cost per enquiry/order | Attributable ad spend divided by qualifying attributed enquiries/confirmed orders for the specified policy. A zero denominator produces N/A, not zero or infinity. |
| ROAS | Attributed net revenue under the stated basis divided by ad spend. A zero ad-spend denominator produces N/A. |
| Contribution after advertising | Attributed contribution before advertising minus allocated ad spend, with attribution and cost assumptions visible; not full net profit. |
| Product adoption | Share of active orders accurately maintained without reconstructing the same information elsewhere; include abandoned/incomplete records in evaluation. Measured weekly through the leading indicators in Section 28.3 plus a short owner check of the paper/notebook use. |
| Qualifying enquiry | An enquiry with an identified contact and a specific service request; price-only calls with no contact detail are counted separately. |
| Eligible garment order | A confirmed (not draft) garment/service order with an agreed delivery date that falls within the reporting period. |
| Comparable garment | Same category and complexity grade (for example plain blouse vs. Aari blouse), in the same season band (peak vs. normal). |

The same underlying sale, payment, material use or vendor charge must never be counted twice because it appears at garment, booking and shop levels. Date basis, exclusions, estimates and missing-data treatment must be visible on reports.

For original-promise readiness, the baseline excludes cancellations agreed and recorded before the original due time and reports them separately. A cancellation recorded after that deadline remains visible in the original due cohort as cancelled-after-due and must not retrospectively raise the on-time rate. An authorised backdated correction is labelled as a correction; it does not silently rewrite a previously reviewed report.

### 28.2 Validation approach

Establish a baseline using the owner's current work, then compare similar garment/service types, complexity and seasonal load during the pilot. Capture both owner effort and customer/production outcomes. A small initial sample can diagnose usability problems; it does not establish statistically reliable improvement or general market demand.

For AI, compare the complete assisted workflow against the ordinary workflow, including review time, error correction, usage cost and false alerts. Separate the effects of introducing a structured order process from the additional effect of AI.

Numerical improvement targets, acceptable error limits and pilot sample sizes are set after baseline measurement. Critical failures such as another customer's data exposure, an unauthorised charge or a guessed measurement entering production are release-blocking issues rather than acceptable average-error trade-offs.

### 28.3 Pilot protocol

- **Baseline (2–4 weeks, before go-live):** With the founding owner's current methods, record:
  - intake time for a sample of orders;
  - orders ready by the original promise;
  - charges discovered as missed;
  - time spent finding customer or measurement information;
  - payment follow-ups;
  - the number of orders and their category/complexity mix.

  The baseline must be captured before the product is used, otherwise it is lost.
- **Pilot (3 months, founding boutique only):** The owner uses Phase 1 as the primary record for new orders, plus migrated active orders. Collect usability notes and support requests weekly.
- **Leading adoption indicators (reviewed weekly):** share of new orders entered on the same day; number of days per week the product is used; share of handed-over orders with a complete payment record; share of active orders also kept in the notebook.
- **Go/no-go checkpoint (end of pilot):** Numerical thresholds for the measures above and in Section 28.1 are agreed at the end of the baseline period, before the pilot starts. Proceeding to Phase 2 or a second boutique requires: those thresholds met; no unresolved critical failure; Section 33.3 readiness; and completed discovery interviews (Section 1.6).
- **Stop or redesign triggers:** Any critical failure (Section 28.2); the owner going back to the notebook as her primary record for more than two consecutive weeks; or support effort that would not be sustainable for paying shops.

## 29. Indicative release allocation

This allocation is advisory for Phases 2 and 3. Phase 1 is committed through the requirement list in Section 29.1 and the acceptance-scenario phases in Section 30.1. The complete functionality above remains the product baseline. Reprioritisation is allowed when the boutique's real work demands it, but privacy, financial correctness and historical integrity cannot be deferred behind the features that depend on them.

### Phase 1 - Reliable daily operations / MVP

**Objective:** The founding owner, working alone, can run real custom-stitching and alteration work from intake through handover and payment without parallel reconstruction of critical records.

Include:
- **Setup and simple workflow:** shop setup, Simple mode (SET-10), the capacity guard and rush rule (SET-11).
- **Customers and orders:** customer/wearer identity including guardian consent for minors; bookings (including Bridal packages); independent outfit/garment orders with pieces and add-on lines; dynamic checklists; references and approvals with change-impact rules.
- **Measurements:** measurement versions, trial records and fit outcomes.
- **Money:** quotes, advances with proportional allocation, non-tax bills and receipts, balances, cash/UPI confirmation, daily cash reconciliation, refunds/corrections, and basic direct costs including minimal purchase cost capture.
- **Materials and production:** customer-property custody including shared fabric; simple task-based production; Aari/embellishment work and manual external-work records with vendor dues; trials/alterations; quality checks; original/revised dates.
- **Daily work and output:** daily actions; delivery alerts; job slips; WhatsApp click-to-chat and PDF sharing; basic reporting with manual lead sources; imports/exports, including legacy notebook photos.

Provide manual or uploaded pattern references so operations do not depend on developing a pattern engine. Establish shop isolation, protected media, audit history, financial corrections, DPDP notice/consent capture (TRU-13) and the recovery gate (TRU-10) before the pilot holds live data. Role boundaries for additional users must be in place before anyone other than the owner gets access.

The retail module stays disabled in Phase 1 because the founding boutique does not yet sell ready-made garments; no partial sale workflow is built. A simple physical-mannequin gallery may be included when it provides immediate value; it is not a gate for operating a custom order. No AI features are in Phase 1.

### Phase 2 - Team operations and measurable assistance

**Objective:** Several boutiques can operate independently with repeatable onboarding and demonstrably useful assistance.

Add staff and external-worker roles. Deepen worker/vendor workload, approved payables, capacity views, stock allocation and purchasing, and supplier balances. Add the retail module when the shop starts selling ready-made garments. Add customer self-service under the COM-02 access model, customer appointment requests, complaint resolution, controlled automated communication (after the WhatsApp Business Platform decision), UPI QR and statement import, and business-cost visibility. Complete the mannequin showcase where not delivered earlier. Add composition and regular GST billing (FIN-07) before onboarding any registered shop.

Introduce the drafting calculation sheet (PAT-16), reviewed by the owner and the independent second reviewer, as the first step toward pattern capability.

Introduce assisted intake, relevant follow-up questions and quote-completeness checks behind explicit confirmation. Add document-entry assistance only when its errors and duplicate handling are acceptable. Use actual pilot outcomes to decide which AI features remain enabled.

Offer subscription administration only when external shops are paying; no plan/usage feature may weaken data access boundaries or accurate recordkeeping. External onboarding requires the pilot go/no-go checkpoint (Section 28.3) and the discovery interviews (Section 1.6).

### Phase 3 - Validated production intelligence and growth modules

**Objective:** Deliver specialist capabilities on top of trustworthy operating data.

Add expert-validated automated patterns for explicitly supported garment types, seam-allowance presets, 2D previews, validated fabric estimates, A4/A3 true-scale output (always also shareable as a PDF) and contextual fit reuse. Expand pattern coverage only after physical verification for each supported scope.

Enable more advanced delivery-risk estimates only when estimates are grounded and evaluated. Consider the official Instagram viewer and advertising imports/sync — both excluded from the pilot — only when owner value, account access and tracking discipline are evident. Defined attribution and contribution-based marketing review can use manual spend data before then.

This phase is not permission to add guaranteed-fit AI, 3D simulation, social auto-posting, a marketplace or enterprise ERP. Conditional extensions remain outside the committed baseline until separately approved.

### Module depth by phase

| Module group | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Setup, roles, privacy, history and portability | Required foundations | Improved onboarding/controls | Continued validation |
| Customer, wearer, enquiry and appointments | Owner-recorded enquiries and appointments (no customer self-booking) | Customer self-service, appointment requests and richer follow-up | Outcome-led refinements |
| Booking, intake, approval and change control | Core, in Simple mode by default | Faster assisted flows | Broader approved templates |
| Materials and customer-property custody | Receipt, checklist, issue/return, shared fabric and incidents | Deeper stock, purchase and vendor reconciliation | Validated estimation improvements |
| Measurements and fit | Versioning, reuse review, trial records and fit outcomes | Verified fit history collection | Evaluated contextual recommendations |
| Pattern and allowances | Manual/external references | Drafting calculation sheet; expert rule preparation and validation | Validated generation and print release |
| Production and people | Owner-assigned tasks, Aari/external-work record with vendor dues, holds, trials, handover, capacity guard | Staff roles, skills/capacity, detailed dues and scheduling | Evaluated risk assistance |
| Money and contribution | Non-tax bills/receipts, allocations, balances, cash/UPI confirmation, refunds and direct-cost basics | GST regimes for registered shops, richer cost/reconciliation reporting | Advanced comparisons with reliable data |
| Retail | Disabled (founding shop does not sell ready-made) | Minimal-to-full path when the shop starts selling | Demand/ageing review |
| Communications | WhatsApp click-to-chat + PDF sharing and records | Approved automation/customer actions | Evaluated next-action assistance |
| Gallery | Optional simple public showcase | Complete mannequin history/enquiries | Maintain independently of social sync |
| Instagram and advertising | Manual source capture (incl. Google Business Profile, WhatsApp) and optional manual spend | Defined attribution/report preparation on manual data | Integrations only if justified post-pilot |
| AI | None | Intake, follow-up, completeness and reviewed extraction | Fit recall and risk features when validated |
| Commercial product administration | Private-pilot setup (free for founding boutique) | External-shop onboarding, support and subscription controls | Sustainable expansion |

**Dependency rule:** Whenever a feature is moved earlier, move its required correctness, permissions, financial settlement, audit and recovery behaviour with it. A feature is not complete merely because its happy-path screen is available.

### 29.1 Phase 1 committed requirements

**Must** = required for the founding pilot to go live. **Should** = in Phase 1 if it does not delay go-live. Anything not listed belongs to a later phase or stays disabled.

| Area | Must | Should |
|---|---|---|
| Setup | SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07 (payment methods, vendors), SET-08, SET-09, SET-10, SET-11, SET-12 | — |
| Customers | CUS-01, CUS-02, CUS-03, CUS-04, CUS-05, CUS-06, CUS-07, CUS-09 | CUS-08 |
| Enquiries | ENQ-01, ENQ-02, ENQ-03, ENQ-04, ENQ-05, ENQ-08 | ENQ-06, ENQ-07 |
| Orders | ORD-01 to ORD-14 (ORD-10 without QR) | ORD-10 QR lookup |
| Design | DES-01 to DES-06, DES-08 to DES-11 | DES-07 (Simple mode uses a combined approval) |
| Materials | MAT-01 to MAT-05, MAT-09, MAT-10, MAT-12, MAT-13 | MAT-06, MAT-07, MAT-08, MAT-11 |
| Purchases | — | PUR-03 (minimal purchase cost capture) |
| Measurements | MEA-01 to MEA-09, MEA-11 | MEA-10 (manual retrieval only) |
| Pattern | PAT-01, PAT-03 | — |
| Production | JOB-01 to JOB-16 (JOB-13 courier dispatch optional) | — |
| People | OPS-01 (minimal), OPS-04, OPS-11 | OPS-02 |
| Money | FIN-01 to FIN-06, FIN-07 (unregistered regime), FIN-08 to FIN-17, FIN-20, FIN-21 | FIN-18, FIN-19 |
| Communications | COM-04, COM-06, COM-07, COM-08 | COM-10 (manual route only) |
| Daily workspace | DAY-01, DAY-02, DAY-03, DAY-04, DAY-06, DAY-07, DAY-08, DAY-09, DAY-10 | DAY-05 (board/calendar views) |
| Gallery | — | SHO-01 to SHO-06 |
| Reporting | REP-01, REP-02, REP-04, REP-06 (basic), REP-07 | REP-03, REP-05, REP-08 (manual spend) |
| Privacy and records | TRU-01, TRU-03 to TRU-08, TRU-10, TRU-12, TRU-13 | TRU-09, TRU-11 |
| Usability | USE-01 to USE-09 | — |
| Administration | BIZ-01 (practice mode Should), BIZ-06 | — |

Not in Phase 1: retail (RTL-*), AI (AI-*), customer access (COM-01, COM-02, COM-03, COM-05, COM-09, COM-11), purchasing beyond PUR-03, OPS-03 and OPS-05 to OPS-10, PAT-02 and PAT-04 to PAT-17, SHO-07 to SHO-10, REP-09 to REP-14, TRU-02 (only one user), and BIZ-02 to BIZ-05.

## 30. Product acceptance scenarios

These are product-level checks to use for final scope review and later acceptance. They are not a claim that software has already been built or tested.

| ID | Scenario | Required result |
|---|---|---|
| AC-01 | One customer books a blouse and salwar together. | Shared booking; independent requirements, measurements, tasks, prices, dates and status; no duplicated booking revenue. |
| AC-02 | A family shares a phone number but has different wearers. | Correct garment/measurement links and access boundaries; no automatic wearer merge. |
| AC-03 | A required lining item is pending while a customer pays an advance. | Appropriate payment/receipt can be recorded; relevant production task remains blocked with a specific reason. |
| AC-04 | An optional trim is not required. | Checklist accepts that explicit state without fabricating receipt, cost or a task. |
| AC-05 | An approved neckline reference is changed after cutting. | Change request shows irreversible-work and cost/date impact; original approval and cutting output are preserved. |
| AC-06 | A saved measurement version or seam preset is updated. | Historical garments/patterns retain their original versions; new work explicitly selects the revision. |
| AC-07 | A library type becomes unavailable. | It is hidden for new orders but remains readable historically; duplicate-as-new requires a supported decision. |
| AC-08 | A garment type is orderable but has no validated automated pattern. | Manual/external path remains available; generation is not silently approximated. |
| AC-09 | A supported pattern is previewed and printed on A4/A3. | Correct pieces, versions, allowances, tiling and assembly/calibration marks; physical scale is checked before production readiness is claimed. |
| AC-10 | Relevant design/measurement inputs change before cutting. | Prior output is flagged stale; release needs review. A pattern already used for cutting is not silently replaced. |
| AC-11 | A worker tries to start stitching without an assignment or prerequisite. | Start is blocked; assigning the owner is valid in solo mode; only genuinely applicable prerequisites are enforced. |
| AC-12 | Embroidery is required before cutting for one garment and after for another. | Correct template dependencies operate independently; no universal sequence corrupts either job. |
| AC-13 | A vendor reports work done but has not returned the fabric. | External completion does not mark property returned or quality accepted. |
| AC-14 | A customer sample and unused fabric remain after garment collection. | Customer-property obligations remain open until explicitly returned/settled. |
| AC-15 | A trial causes a corrective cycle. | Correction reason, chargeability, cost, owner and fit outcome are linked; planned fitting is distinguished from avoidable rework. |
| AC-16 | A garment fails quality after having been marked ready. | Readiness withdrawal/correction is recorded; historical metrics expose the invalid ready event rather than rewarding it. |
| AC-17 | Two garments total INR 2,500; a confirmed INR 1,000 advance is allocated by the default proportional method (FIN-05) as INR 400 and INR 600. | Allocations sum to INR 1,000. For garment charges of INR 1,000 and INR 1,500, remaining amounts are INR 600 and INR 900; partial collection does not erase the remainder. |
| AC-18 | An INR 2,000 invoice has INR 700 confirmed and INR 500 pending payment. | Confirmed balance remains INR 1,300. On confirmation of the INR 500, balance becomes INR 800; repeating the same confirmation does not reduce it again. |
| AC-19 | A confirmed payment is later reversed. | Relevant allocations are reversed once, the receivable reopens as appropriate, and the original event remains visible. |
| AC-20 | A fully paid INR 1,000 sale is fully credited and refunded. | Sale credit, customer refund liability and actual refund are distinct linked events; after successful settlement there is neither a false receivable nor an outstanding refund. |
| AC-21 | An owner authorises delivery on credit. | Handover succeeds under permission and reason; the unpaid balance remains collectible and visible. |
| AC-22 | A cancellation occurs after cutting and vendor work. | Preserve work/costs, settle approved charges/refund, cancel remaining commitments and return property; no automatic full refund or history deletion. |
| AC-23 | Five metres of shop fabric cost INR 500 and two metres are consumed by an order. | Under that stated unit-cost basis, direct order material cost is INR 200 and three metres remain; the INR 500 purchase is not also charged in full to that order. |
| AC-24 | A purchase is partially received and the supplier bill is unpaid. | Only accepted received stock becomes available, remaining receipt stays open and supplier payable is tracked separately. |
| AC-25 | A ready-made variant is sold with a complimentary alteration. | Stock, sale and alteration are linked; zero selling price for alteration does not erase its cost. |
| AC-26 | That retail item is returned after alteration. | Return policy and work condition are reviewed; credit/refund, stock condition and linked job are reconciled, not blindly reversed. |
| AC-27 | A delivery promise is revised after delay and a customer collects later still. | Original/current promise, valid-ready and actual collection remain separate; revised dates cannot improve historical original-promise performance. |
| AC-28 | A garment enters the three-day warning window or becomes overdue. | Correct local-date warning and next action appear; acknowledging the alert does not remove the underlying due/overdue work. |
| AC-29 | A fourth mannequin is created and its costume changes twice. | No fixed-count limit; both costume records remain; customer gallery and staff landing experiences remain distinct. |
| AC-30 | Instagram or advertising refresh fails. | Previous successful content remains, freshness/error is visible and retry/manual reporting is available. |
| AC-31 | An order's marketing source is unknown or has several possible touches. | Unknown/evidence is retained; policy governs any attribution; combined totals do not count full revenue repeatedly. |
| AC-32 | Attributed net revenue is INR 2,000, direct costs INR 900 and ads INR 200. | Contribution is INR 1,100, ROAS is 10x and contribution after ads is INR 900. No figure is mislabelled full business net profit; zero denominators show N/A. |
| AC-33 | AI hears an uncertain measurement, amount or delivery date. | Uncertainty is shown and confirmation required; guessed values do not enter authoritative production or financial records. |
| AC-34 | AI suggests charging for an item included in a package. | Owner can reject it; no automatic charge; false suggestion is captured in evaluation. |
| AC-35 | A prior successful blouse has a fabric-specific correction. | Fit assistance shows the original context and requires review; it does not modify all body measurements or unrelated garments. |
| AC-36 | A queued balance reminder becomes stale because payment is confirmed. | Current-state check suppresses the unnecessary message; repeated sending attempts do not duplicate it. |
| AC-37 | A customer opts out or a message connection fails. | Applicable outbound messages stop/fail visibly; manual permitted fulfilment work remains possible. |
| AC-38 | A worker/customer from one boutique tries to search, export or use AI against another shop. | Access is denied consistently, including media and indirect search/AI results. |
| AC-39 | A private fitting image is uploaded and the mannequin gallery is opened. | The private asset never appears without deliberate permitted publication. |
| AC-40 | A draft intake is interrupted by lost connectivity. | The form clearly shows that the latest changes are not saved and keeps the typed values on screen until the connection returns or the user retries. The last saved draft is recoverable, retrying does not create duplicates, and nothing is shown as saved or confirmed that was not committed. |
| AC-41 | Opening receivables or stock are imported twice. | Duplicate/cut-off review prevents repeated opening values and false new-period sales/purchases. |
| AC-42 | A shop exports its records. | The export is understandable, states inclusions/exclusions and contains linked history. |
| AC-43 | AI becomes unavailable or a subscription usage limit is reached. | Core permitted operations and accurate records continue through the specified manual/read-only paths; no false completion claim or silent loss. |
| AC-44 | Tax/rate/policy configuration is incomplete. | Relevant actions require proper configuration or explicitly permitted draft treatment; the product never inserts an assumed legal/tax rule to finalise the transaction. |
| AC-45 | An uploaded document instructs AI to change charges or expose other customers. | Treat those instructions as untrusted source content, not authority; no unauthorised action or disclosure occurs. |
| AC-46 | A campaign contains Instagram and other placements. | Advertising labels do not misrepresent mixed spend as Instagram-only; unsupported placement splits remain explicitly unavailable. |
| AC-47 | A late order is cancelled after its original deadline. | The original due cohort retains the cancelled-after-due outcome; cancellation does not retrospectively improve the on-time rate. |
| AC-48 | An AI feature cannot meet the approved external-processing/data-use policy. | Do not enable it for the affected content or falsely claim compliance; explain the limitation and preserve the manual workflow. |
| AC-49 | A confirmed INR 1,000 advance is shared by three garments each charged INR 700. | The proportional shares (INR 333.33 each) are rounded down to INR 333, and the remaining INR 1 goes to the first line (tie rule). Allocations are INR 334, 333 and 333, summing exactly to INR 1,000. Remaining amounts are INR 366, 367 and 367. |
| AC-50 | A customer brings her own kurti for a standalone alteration. | A lightweight service order is created without requiring a full measurement form or pattern. It is quoted, assigned, completed, quality-checked, billed and handed over with custody of the customer's garment recorded. |
| AC-51 | In a two-garment booking, one garment is handed over and the other is cancelled with a partial refund. | The booking shows "fulfilled with cancellations". The refund and any cancellation charge are linked. The booking is "closed" only when no money or property remains outstanding. |
| AC-52 | A customer withdraws marketing consent and requests deletion of her measurements. | Marketing use stops. Measurements and photos are deleted or anonymised under the retention policy. Financial records that must be kept remain, and the customer is told what was kept and why. |
| AC-53 | A 15-year-old wearer is booked by her aunt, who pays. | Measurements and photos cannot be stored until her parent or guardian's consent is recorded. The aunt can pay but cannot give that consent. No image of the wearer can be published. |
| AC-54 | A customer opens an expired or revoked order link. | No order data is shown. The page offers the shop's contact route instead. |
| AC-55 | Two people edit the same order at the same time. | The conflict is surfaced. Measurements, stock, approvals or money are not silently overwritten, and repeated clicks do not duplicate actions. |
| AC-56 | Records are restored from backup. | The restoration is verified against the stated data-loss limit (TRU-10). Restored records do not resend messages or repeat refunds. |
| AC-57 | A departing worker's access is revoked. | Access stops immediately. Historical assignments, payables and documents remain intact. |
| AC-58 | 2.2 m of shop fabric (INR 100/m) is issued to an order, the garment uses 2.0 m, and 0.2 m is an unusable off-cut. | Under MAT-05, the order's material cost is INR 220 and stock falls by 2.2 m. Had the 0.2 m been a reusable remnant, the cost would be INR 200 and 0.2 m would return to stock. |
| AC-59 | In Simple mode, the owner creates a repeat-customer blouse order on a phone. | Only the SET-10 quick-order inputs are required. The order, checklist and owner assignment are created and can be shared through WhatsApp within the design target (about two minutes; the pilot target is set after the baseline). |
| AC-60 | During a configured festival peak, a new blouse booking exceeds the weekly capacity cap and arrives after the cut-off. | A warning shows the cap and the cut-off date. The owner can accept only with a recorded reason. A delivery date sooner than the standard lead time is flagged as rush and the rush charge is suggested. |
| AC-61 | The same UPI payment (same UTR) is entered twice. | The second entry is flagged as a duplicate and does not reduce the balance again. |
| AC-62 | At day close, the counted cash is INR 200 less than the recorded cash receipts. | The mismatch is shown. The owner records a reconciliation adjustment with a reason; no bill or receipt is rewritten. |
| AC-63 | In a salwar outfit order, the top is ready but the bottom needs a correction. | The top can be handed over on its own. The order shows "partly handed over", and the bottom keeps its correction task and remaining balance. |
| AC-64 | A shop with no printer needs a job slip, and a shop with only an A4 printer needs a pattern. | The job slip is available as a PDF and shareable through WhatsApp. The pattern is offered as A4 tiles with calibration marks; A3 is not required. |
| AC-65 | The owner generates a drafting calculation sheet for a formula version not yet approved by the second reviewer. | The sheet shows its formula version and inputs and carries the label "unvalidated — check before cutting". It cannot be recorded as an approved cutting output. |
| AC-66 | An Aari blouse panel is sent to a home-based artisan with an INR 200 advance against an INR 1,500 agreed charge. | The dispatch, expected return and outstanding due of INR 1,300 are visible. When the panel returns and is accepted, the due becomes payable, and custody is reconciled. |

### 30.1 Phase applicability

| Phase | Acceptance scenarios |
|---|---|
| Phase 1 (founding pilot) | AC-01 to AC-08, AC-11 to AC-23, AC-27, AC-28, AC-38 (before a second boutique), AC-40 to AC-42, AC-44, AC-47, AC-49 to AC-53, AC-55, AC-56, AC-58 to AC-63, AC-66; plus AC-29 and AC-39 if the gallery is enabled. AC-06 applies to measurement versions only. |
| Phase 2 | AC-24, AC-31, AC-32 (manual spend), AC-33, AC-34, AC-36, AC-37, AC-43, AC-45, AC-48, AC-54, AC-57 (staff roles), AC-64 (job-slip part already Phase 1), AC-65; AC-25 and AC-26 when retail is enabled |
| Phase 3 / post-pilot | AC-06 (seam presets), AC-09, AC-10, AC-30, AC-35, AC-46, AC-64 (pattern part) |

## 31. Scope boundaries and optional extensions

### 31.1 Not part of this product baseline

The product is not a full ERP, statutory payroll system, general accounting replacement, lending service, open marketplace, social-media scheduling platform or enterprise multi-branch suite. It does not promise automatic access to private WhatsApp histories, all Instagram data or every advertising metric. It does not autonomously move money, operate advertisements or contact customers outside approved policies. It does not generate e-invoices or e-way bills, and there is no native mobile app; the product is a web application with a responsive installable web app (PWA).

It is not a guaranteed-fit service or an unrestricted AI pattern designer. Body measurements are not inferred from ordinary photographs. Unsupported garment rules, seam allowances and fabrication assumptions must not be invented.

Architecture, database structures, API designs, technology selection, infrastructure, implementation effort and delivery dates are intentionally outside this document; see [Architecture and Technology Decisions](Architecture_and_Technology_Decisions.md).

### 31.2 Optional extensions requiring a separate decision

- **3D garment preview:** A possible design communication aid, with accurate labelling of what is and is not simulated. It is not fit validation and must not block the 2D/printing product.
- **Plotter/large-format pattern export:** Can extend the validated print capability after target format, output scale and printer assumptions are agreed. A4/A3 remain the committed full-plan formats.
- **Wider garment/language coverage:** Add only with appropriate forms, workflow terminology and, where relevant, expert-validated pattern rules.
- **Advanced fabric placement/optimisation:** Requires its own fabric, direction, repeat, nesting and wastage validation; the existing estimate does not imply this capability.
- **Multi-branch operations, full e-commerce and social publishing:** Separate product expansions, not hidden dependencies for a small boutique.
- **Offline capture and synchronisation:** Capturing intake drafts and measurement sessions without a connection, storing them on the device and synchronising later (the original USE-04 intent). Deferred from Phase 1 by owner decision; reconsidered only if the pilot shows connectivity is a real obstacle. It needs its own design for device storage, synchronisation, conflicts, duplicate prevention and lost-device privacy.

The full-plan modules in Sections 6-26, including the mannequin gallery and read-only Instagram/ad review, must not be confused with these optional extensions. The Instagram viewer and advertising data sync are excluded from the pilot (Section 29) but remain part of the full product scope.

## 32. Business configuration and validation decisions

The product behaviour is defined above. The business values and external approvals below must not be invented. Section 32.1 records the decisions already made. Section 32.2 lists the decisions that must be resolved before the founding pilot holds live data. Section 32.3 lists decisions needed only before the dependent later capability is activated.

### 32.1 Decisions recorded (12 October 2026, founding owner)

| Topic | Decision | Affected requirements |
|---|---|---|
| GST status | Founding boutique is not GST-registered; it issues non-tax bills and receipts | FIN-07, AC-44 |
| Retail | Not selling ready-made garments; retail module disabled in Phase 1 | Section 18, Section 29 |
| Order granularity | One order per outfit, with pieces (top/bottom/dupatta) tracked inside it | ORD-13, AC-63 |
| Bridal | Occasion/package grouping garments, not a garment category | §1.3, ORD-14 |
| Small services | Fall, pico, pre-pleating are add-on lines; standalone add-on = lightweight service order | ORD-14, AC-50 |
| Phase 1 users | Owner only | Section 4, Section 29.1 |
| Payments | Mostly cash, some UPI | FIN-11, FIN-16, AC-61, AC-62 |
| WhatsApp | WhatsApp Business App on owner's number; manual sharing only for now | COM-04, COM-05 |
| Minors | Accepted; parent or guardian authorises | TRU-05, TRU-13, AC-53 |
| Product form | Desktop web app plus mobile-responsive installable web app (PWA) for desktop, tablet and mobile; no native app | USE-01 |
| Connectivity | Phase 1 is online-only: the PWA is installable but does not capture data offline; drafts are saved to the shop's records; offline capture is an optional later extension | USE-03, USE-04, AC-40, Section 31.2 |
| Printing | Mixed: some shops have A4, few have A4+A3, many have none; every output also shareable as a PDF through WhatsApp | USE-07, PAT-17, AC-64 |
| Pattern reviewer | Owner is the primary expert; an independent second reviewer is required | PAT-02 |
| Pattern timing | Drafting calculation sheet in Phase 2; pattern engine stays in Phase 3 | PAT-16, Section 29 |
| Marketing | Instagram viewer and ads API sync excluded from the pilot; manual source capture and manual monthly spend | SHO-07 to SHO-10, REP-07, REP-08 |
| Capacity | Phase 1 per-category weekly cap, festival cut-off dates, override with reason | SET-11, AC-60 |
| Advance allocation | Proportional to each line's charge (rounding rule in FIN-05) | FIN-05, AC-17, AC-49 |
| Pilot | Founding boutique for 3 months, preceded by a 2–4 week manual baseline | Section 28.3 |
| Pricing | Free for the founding boutique; subscription for other boutiques later | Section 1.6, BIZ-04 |

### 32.2 Blocks the Phase 1 pilot

| Decision | Required owner/reviewer | Activation condition |
|---|---|---|
| Initial garment/service catalogue, piece structure per outfit and add-on list | Boutique owner | Confirm before the first live order. |
| Measurement forms per category/piece, field precision (default inches with quarter fractions) and validation tolerances | Owner (plus second reviewer before any derived output) | Approve before authoritative measurement use. |
| Price list, add-on prices, Aari complexity grades, rush charge, discounts and quote validity | Boutique owner | Configure before issuing binding quotes. |
| Advance expectation, cancellation/alteration charges, credit-handover and refund policy | Boutique owner | Record authority and customer terms before enforcement. |
| Bill and receipt format, number sequence, correction rules and optional registration turnover alert | Owner and accountant | Verify before issuing live bills. |
| Receiving accounts list (cash, owner/family UPI IDs, bank accounts) | Boutique owner | Configure before recording payments. |
| Stock costing basis for shop materials (unit cost per purchase) and opening balances | Owner | Reconcile before direct-cost reporting. |
| Standard lead time per category, alert windows, weekly capacity caps and festival cut-off dates | Boutique owner | Configure before commitment warnings. |
| Task/milestone templates, Aari workflow sequence and quality checks | Owner | Approve before governing real work. |
| Artisan/vendor piece rates and acceptance basis | Boutique owner | Configure before recording vendor dues. |
| Uncollected garment and stored-fabric holding period and outcome | Boutique owner | Publish to customers before enforcing. |
| DPDP notice text (Tamil/English), consent wording, guardian-consent flow, grievance contact, breach procedure, data-processing agreement, retention periods | Owner with appropriate privacy advice | Complete before storing real customer data. |
| Photo publication policy (gallery) | Boutique owner | Before any public image if the gallery is enabled. |
| Maximum acceptable data loss, restoration time, outage paper fallback; test restoration | Product owner and founding owner | Complete before the pilot holds live data (TRU-10). |
| Legacy notebook migration scope (customers, active orders, book numbers) | Boutique owner | Agree before go-live. |
| Baseline measurement plan and pilot go/no-go thresholds | Product owner and founding owner | Baseline before go-live; thresholds before pilot start (Section 28.3). |

### 32.3 Later decisions

| Decision | Required owner/reviewer | Activation condition |
|---|---|---|
| Independent second pattern reviewer (name, qualification) and validation matrix | Owner and product owner | Before the drafting calculation sheet loses its "unvalidated" label. |
| Pattern formulas, allowed garment/fabric ranges, piece markings and tolerance confirmation | Owner and second reviewer | Physically validate before automated cutting release. |
| Seam names, values, ease choices and preset governance | Owner and second reviewer | Approve relevant versions; no universal defaults. |
| Pattern paper/printer assumptions and calibration process | Owner and second reviewer | Confirm before true-scale production printing. |
| Composition/regular GST support details, classification codes and tax-rate rules | Product owner and accountant | Before onboarding any registered shop. |
| Retail catalogue, returns/exchanges and altered-item eligibility | Boutique owner | Before enabling retail. |
| Staff roles, toggles and support access | Boutique owner | Before anyone other than the owner gets access. |
| Customer access model details and OTP channel (SMS with DLT registration vs WhatsApp authentication template) | Product owner | Before customer self-service. |
| WhatsApp Business Platform: migrate the existing number or use a separate one; templates; monthly message budget | Owner and service administrator | Before automated outbound messages. |
| Instagram/advertising access and refresh expectations | Account owner | Only if the post-pilot integration is approved. |
| Attribution model/window and revenue/cost report basis | Owner and accountant/marketing reviewer | Before campaign profitability claims. |
| Subscription price, allowances, support model, exit/export period | Product owner | Before charging external shops. |
| AI quality/error limits and review sample | Product owner and boutique users | Before enabling any AI feature. |
| Recovery and continuity policy for multiple shops | Product owner | Before the second boutique (Section 33.3). |

## 33. Release readiness and completion criteria

### 33.1 For each feature

A feature is complete only when its normal flow, relevant exceptions, permissions, history, financial/property consequences, failure handling and user-visible acceptance checks are covered. A happy-path form alone is not sufficient.

The feature must have clear labels, usable manual operation where promised, correct handling of missing information and no hidden dependency on an unapproved formula, third-party permission or business policy. Supported and unsupported cases must be visible.

### 33.2 For the owner-first pilot

The owner can create a real garment order, understand what is missing, approve the work, locate the material, move tasks forward, record trial/correction, identify the correct balance, hand over the right item and recover its history without daily developer assistance. Opening balances, current orders and essential customer property are reconciled.

Before the pilot holds live data:
- every Section 32.2 decision is resolved;
- every Phase 1 Must requirement (Section 29.1) and every Phase 1 acceptance scenario (Section 30.1) passes;
- the TRU-10 recovery gate and the TRU-13 notice/consent capture are complete;
- the baseline in Section 28.3 has been captured.

Every Phase 1 workflow must also be verified at mobile, tablet and desktop sizes (USE-01).

### 33.3 Before a second boutique or shared team

Verify independent-shop isolation, role boundaries, sensitive asset handling, recovery under the multi-shop continuity policy (building on TRU-10), understandable exports, onboarding, support access and all critical financial paths. The billing regime of each new shop must be supported (FIN-07). The pilot go/no-go checkpoint (Section 28.3) must be passed. Reuse configuration rather than a shop-specific product fork.

### 33.4 Before specialist pattern or AI release

Validate the supported pattern's formulas, output dimensions, printing and physical garments with the designated expert. For AI, demonstrate acceptable critical-field accuracy, review effort, false-action rate and real workflow benefit on the intended cases. Neither a model-generated assurance nor a polished visual preview is evidence of correctness.

### 33.5 Product completion standard

> The product earns daily use when the owner can trust that the recorded garment, materials, agreements, next action, dates and money position reflect reality, and can act on them without reconstructing the business from scattered notes.

This standard governs prioritisation across every phase. Additional modules are valuable only when they preserve that trust and improve a concrete boutique outcome.
