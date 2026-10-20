# Boutique Business Management — High-Level Implementation Roadmap

**Target document:** `docs/Boutique_Business_Management_Implementation_Roadmap.md`  
**Planning baseline:** [Boutique Business Management Final Product Plan](Boutique_Business_Management_Final_Product_Plan.md), dated 12 October 2026  
**Technical baseline:** [Architecture and Technology Decisions](Architecture_and_Technology_Decisions.md), dated 12 October 2026
**Status:** Phase 0.1 and 0.2 implementation tickets are approved and merged;
[foundation closeout](agents/Phase_0_Closeout_Acceptance.md) records their actual
acceptance evidence and activation limits. Phase 0.3's six implementation tickets
are also merged; its [closeout review](agents/Phase_0_3_Closeout_Acceptance.md)
records fresh validation and the separate verification-repair review gate.
Before Phase 0.4, the owner selected the existing Current light/Current dark
foundation and approved cleanup [#47](https://github.com/nishanthturnstile/aarili/issues/47)
and [#48](https://github.com/nishanthturnstile/aarili/issues/48). The candidate trial
in #45/PR #46 is superseded without merging. The [cleanup plan](agents/Design_System_Adoption_Plan.md)
preserves verification safeguards and sequences UI cleanup before runtime exemplar cleanup.
UI cleanup #47 merged through PR #49 at `b13f176`; fresh full verification and
48 browser cases passed before merge, followed by integrated build/smoke checks.
Runtime cleanup #48 separates normal API/browser/worker composition from explicit
verification exemplars; its [acceptance evidence](agents/Issue_48_Runtime_Cleanup_Evidence.md)
records review status and validation. No business slice or activation gate changes.
Phase 0.4's ten slices (#51–#60) merged through PRs #61–#71; the
[Phase 0.4 closeout acceptance](agents/Phase_0_4_Closeout_Acceptance.md) records
integrated verification, the deferred physical Android/fluent-Tamil gates and the
remaining activation limits. Owner direction of 16 October 2026 holds Phase 0.5
until immediately before deployment; local development continues on synthetic data.
Phase 0.4 and later retain concrete draft, review and publication approval.
This roadmap alone authorises no new
implementation or GitHub Issue generation; later release allocation remains provisional.

## 1. Roadmap purpose and planning basis

This roadmap translates both source documents into **4 waves (0–3), 29 phases and 98 vertical slices**: 13 prerequisite foundation slices and the existing 85 business slices. It assigns delivery responsibility for all **241 numbered functional requirements** and all **66 product acceptance scenarios**, together with the architecture obligations. These are planning coverage claims, not software test results.

The implementation should progressively establish the boutique’s authoritative business record: who ordered and wears each garment, what was agreed, where the materials are, what must happen next, when the garment was promised, and what money remains outstanding.

The first wave delivers a complete owner-operated custom-stitching and alteration workflow. The second expands that workflow to teams, independent boutiques, purchasing, retail, customer participation and reviewed assistance. The third adds validated pattern generation, contextual intelligence and conditional platform integrations.

The hierarchy is **Wave → Phase → Functionality → Vertical Slice**. Functionality headings group related outcomes; stable slice IDs identify implementable/verifiable increments. Foundation slices have executable operational outcomes rather than user screens. Product behaviour/release scope takes precedence from the product plan; technical constraints come from the architecture. This document neither changes either baseline nor estimates effort or development dates.

### 1.1 Scope classifications

- **Essential:** Required to satisfy the committed founding-pilot scope or a mandatory prerequisite of that scope.
- **Phase 1 Should:** Non-blocking pilot enhancement; may move to Wave 2. Minimum correctness needed by a Must still ships with that Must.
- **Later baseline:** Part of the complete product, with provisional Phase 2/3 allocation; not an optional extension.
- **Conditional baseline capability:** Part of the product plan, but activated only when its business need, configuration, permissions or validation prerequisites are satisfied.
- **Optional extension:** Outside the committed baseline and excluded from these implementation waves.

Source-plan **Phase 1** corresponds to roadmap **Wave 1**. Roadmap phases are smaller business-capability groups; their numbering does not replace the source plan’s release commitments.

Wave 0 is mandatory prerequisite work within the Phase 1 effort, not a new product release. It may progress incrementally along its dependency graph; do not wait for every infrastructure slice before starting an unrelated safe synthetic business slice. Use only synthetic records until the Wave 1 live gate. The original 85 IDs are preserved for future tickets.

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

Earlier increments use isolated synthetic or practice records. **No live pilot starts until the complete Wave 1 readiness gate passes.**

Each slice delivers schema/migrations where needed, core policies, validated API/typed client, UI or operational interface, audit/jobs/documents and tests for its own outcome. A later integration is not required to verify the base slice; disabled future entry points must be explicit. Source/scenario ownership is recorded in §6 and the explicit requirement register. All business slices inherit the 0.2.2 tenant and 0.2.3 command safeguards. Upload, draft, money and document slices additionally depend on their specific foundation below.

## Wave 0 — Mandatory Foundations for Synthetic Development

**Objective:** Establish the smallest runnable, testable modular monolith and protect data before business features accumulate. Architecture §§4–15 govern these slices. No future-only packages, production customer records or speculative services are introduced.

### Phase 0.1 — Establish the Workspace and Verification Path

Implementation issues #2–#6 and maintenance closeouts #22/#29 are merged.
See the [current acceptance record](agents/Phase_0_Closeout_Acceptance.md) for
integrated verification, repository activation and owner manual results.

#### Functionality — Reproducible builds and reviewable delivery

##### Vertical Slice 0.1.1 — Resolve Compatibility and Bootstrap the Workspace

- **Scope:** Mandatory prerequisite; architecture §§4–6, 11.4, 12.4.
- **Outcome:** Pin Node 24, owner-approved TypeScript 7.0.2 strict (architecture §5.1 correction), pnpm and compatible exact P1 versions; create pnpm/Turborepo web/worker and the minimal real package boundaries. Commit lockfile, Biome/Knip/config, safe environment examples, local PostgreSQL/S3-emulator Compose and README commands. Enforce the §6.2 import matrix. Verify Base UI/Table 9 recipes; no RC adoption or Radix mixing. Create module folders/packages when first needed.
- **Dependencies:** Roadmap approval. No dependency on cloud provisioning.
- **Verification:** Clean frozen-lockfile install, workspace typecheck/lint and web/worker production build; negative import-boundary example is rejected. Confirm required engines/peers and PostgreSQL extensions; record any baseline conflict before changing versions.

##### Vertical Slice 0.1.2 — Run a Health Path through CI

Implementation split: approved issue #5 (**0.1.2a**) covers runnable database
readiness, typed health UI and local Windows/Linux PostgreSQL/browser evidence;
issue #5 merged in PR #10. Merged issue #6 (**0.1.2b**) implements the real CI checks,
negative/positive gate proof, required main protection and dependency policy.
See [issue #5 evidence](agents/Issue_5_Database_Health_Evidence.md) and
[issue #6 evidence](agents/Issue_6_CI_Gates_Evidence.md). Its historical Renovate
activation gap is closed by observed bot activity; an actual scheduled audit
also passed. Integrated results and dates are in the current acceptance record.
The implemented AC-38/AC-55 foundation proofs are recorded under Phase 0.2;
later business paths still require their own integrity tests.

Portable verification closeout [issue #29](https://github.com/nishanthturnstile/aarili/issues/29)
merged in PR #30. It packages the canonical role SQL and Linux OpenSSL test
prerequisite; [its evidence](agents/Issue_29_Portable_Verification_Evidence.md)
records the reproduced failures and native/Linux verification results.

- **Scope:** Mandatory prerequisite; architecture §§12.2, 12.4, 15.
- **Outcome:** An actual web/Hono health path reaches PostgreSQL. GitHub Actions runs Biome, Knip, typecheck, Vitest/property tests, Testcontainers, production build and initial phone/tablet/desktop Playwright/axe smoke tests. Add checks as real behaviours land; no dummy passing checks. Pin Actions to SHAs, audit dependencies and configure Renovate/security handling.
- **Dependencies:** 0.1.1; authenticated GitHub configuration when enabling required checks.
- **Verification:** Run locally and in CI on a review branch; database outage makes health fail; no server secrets in browser output. Require the actual check names on main once the workflow exists, then confirm protection. No remote change occurs in this planning task.

### Phase 0.2 — Protect Identity, Tenancy and Business Commands

Implementation issues #12–#16 are merged. This completes their synthetic
foundation scope, with owner manual results in the acceptance record; real
provider activation and the full product/pilot gates remain separate.

#### Functionality — Controlled owner access and tenant transactions

##### Vertical Slice 0.2.1 — Bootstrap and Recover the Owner Account

- **Scope:** Mandatory prerequisite; architecture §§6.5, 11.1, 11.4; TRU-01, BIZ-01.
- **Outcome:** Protected one-time setup, verified email/password and explicitly linked allow-listed Google sign-in. Resend serves auth email only. Database sessions, exact trusted origins, secure cookies, CSRF/origin checks, database-backed rate limits and recent re-authentication for sensitive actions. Environment-specific OAuth clients; public/implicit signup/linking closed.
- **Dependencies:** 0.1.2. Synthetic/local email adapter first; production domain/OAuth/email DNS before live activation.
- **Verification:** Concurrent bootstrap attempts produce one owner; setup flag permanently closes bootstrap; unapproved Google accounts cannot sign up/link. Test logout/reset/session expiry, unsafe-origin rejection and re-authentication against synthetic/local mail capture. Actual outbound auth email is enabled only after the shared suppression guards in 0.3.2; replayed restore jobs cannot bypass them. Do not base authority on proxy.ts.

**0.2.1 bootstrap traceability:** [Issue #12](https://github.com/nishanthturnstile/aarili/issues/12)
implements only protected synthetic owner admission, verification/sign-in and
initial shop/membership. Its first-table RLS prerequisite, recovery runbook and
acceptance evidence are recorded in
[Issue_12_Owner_Bootstrap_Evidence.md](agents/Issue_12_Owner_Bootstrap_Evidence.md).
Recovery, Google linking, command contracts and comprehensive current-path
tenancy are separately implemented and recorded below. This does not satisfy
full BIZ-01 onboarding or authorize outbound email/live use.

**0.2.1 recovery/session traceability:** [Issue #13](https://github.com/nishanthturnstile/aarili/issues/13)
adds synthetic owner password recovery, database session termination and a
shared recent-authentication guard demonstrated by an effect-free probe.
[Issue_13_Owner_Recovery_Evidence.md](agents/Issue_13_Owner_Recovery_Evidence.md)
maps B1–B7 and records the approved numeric policy, atomic reset/retry evidence,
bilingual accessible UI and compatible recovery. Real auth email still requires
0.3.2 suppression guards and domain/DNS/provider approval; TRU-09's broader
account/team lifecycle and AC-57 remain later scope.

**0.2.1 Google traceability:** [Issue #14](https://github.com/nishanthturnstile/aarili/issues/14)
adds explicit allow-listed owner Google linking, closed provider signup/implicit
linking, callback/session guards and focused bilingual connection controls.
[Issue_14_Owner_Google_Evidence.md](agents/Issue_14_Owner_Google_Evidence.md)
maps C1–C7; the separate
[activation checklist](agents/Owner_Google_Activation_Runbook.md) retains final
domain, per-environment client/credential and authorised real-provider smoke
gates. Synthetic coverage does not activate Google or outbound auth email.
TRU-11's other integrations and support access remain later scope.

##### Vertical Slice 0.2.2 — Enforce Shop Context and Forced RLS

- **Scope:** Mandatory prerequisite from the first tenant table; architecture §§8.1–8.2, 11.2; TRU-01, AC-38.
- **Outcome:** Separate app_owner/app_user/backup/privacy roles; shop and own-membership policy bootstrap; `withShop()` transaction-local user/shop/actor settings. Non-null shop_id, composite tenant foreign keys, shop-led uniqueness/indexes, FORCE RLS read/write policies. Auth identities and pg-boss remain confined exceptions.
- **Dependencies:** 0.2.1.
- **Verification:** Two synthetic shops; guessed IDs, missing/empty context, cross-shop writes/links, rollback, pooled-connection reuse and switching all fail closed. CI introspects all tenant tables for FORCE plus read/write policies. Repeat leak tests whenever a repository/search/export/media/job/AI path is added.
- **Implementation trace:** Merged [issue #15](https://github.com/nishanthturnstile/aarili/issues/15), with [acceptance evidence and retained-volume procedure](agents/Issue_15_Shop_Isolation_Evidence.md). Repeat the matrix as new tenant tables/paths arrive; shared-team and external activation gates remain separate.

#### Functionality — Atomic, attributable and retry-safe mutations

##### Vertical Slice 0.2.3 — Establish the Command, Audit and Conflict Contract

- **Scope:** Mandatory prerequisite; architecture §§6.4, 8.3, 8.5; TRU-06/TRU-12, USE-08, AC-55.
- **Outcome:** Thin zod-openapi routes and framework-free core services share one transaction and error shape. Version/ETag/If-Match and actor/action/request-bound idempotency commit with business changes, audit and job records. Runtime grants/triggers protect finalised history as each table arrives; explicit privacy functions are the only erasure exception.
- **Dependencies:** 0.2.2.
- **Verification:** A synthetic protected-record command proves 428/412/409/422, same-key replay, changed-payload rejection, concurrent duplicate serialization and rollback with no partial audit/effect. Contract/OpenAPI generation and per-module compiled clients pass CI. Finalised history refuses ordinary mutation.
- **Implementation trace:** Merged [issue #16](https://github.com/nishanthturnstile/aarili/issues/16), with [E1–E10 acceptance evidence and migration/recovery limits](agents/Issue_16_Command_Contract_Evidence.md). The exemplar schema/routes remain dev/test-only. Queue enlistment, restore/outbound suppression and scheduled purging are not established here; 0.3.2 owns actual durable jobs, with retention/privacy execution in its named later slices. New business capabilities and external activation retain their separate gates.

### Phase 0.3 — Establish Exact Money and Durable Work

#### Functionality — Financial arithmetic and journal invariants

##### Vertical Slice 0.3.1 — Verify Money, Quantities and Posting Primitives

- **Scope:** Mandatory prerequisite; architecture §8.4; FIN-05/12/21, AC-17/49/58/61.
- **Outcome:** Integer paise arithmetic and exact wire representation, checked safe-integer conversions from bigint, integer-mm material quantities, deterministic FIN-05 allocation including paise remainders and zero-charge unallocated credit. Small balanced posting journal and derived deposits/receivables/refund liabilities; source locks, durable UTR uniqueness, document-number locking and correction links added with the relevant business tables.
- **Dependencies:** 0.2.3.
- **Verification:** Property tests prove conservation/balancing, deterministic tie order, arbitrary retries/reversals, paise/zero/single-line inputs and quantity costs. Concurrent allocations/issue numbers cannot overdraw/reuse. Accountant reviews posting mappings before live use; fixtures never establish tax law.
- **Implementation trace:** Merged subdivision 0.3.1a [issue #32](https://github.com/nishanthturnstile/aarili/issues/32) implements exact paise/mm arithmetic, validated wire/storage boundaries and a disposable operational demonstration; see [A1–A6 evidence and owner validation steps](agents/Issue_32_Exact_Value_Evidence.md). Merged subdivision 0.3.1b [issue #33](https://github.com/nishanthturnstile/aarili/issues/33) adds pure FIN-05 whole-rupee allocation, largest-charge/earliest remainder including paise, zero-charge unallocated credit and operational inspection; see [B1–B6 evidence and owner steps](agents/Issue_33_FIN05_Allocation_Evidence.md). Merged subdivision 0.3.1c [issue #34](https://github.com/nishanthturnstile/aarili/issues/34) adds an insert-only persistent balanced journal, commit-time completeness/range/provenance guards, derived positions and linked synthetic reversals/refund liabilities/settlements; see [C1–C7 evidence and exact owner steps](agents/Issue_34_Balanced_Journal_Evidence.md). It merged in PR #40. Real payment source/UTR locks (1.4.2), document numbering (1.4.4), financial corrections/refund authority (1.4.5) and accountant mappings retain their later gates. Restore guards are implemented in 0.3.2b; these proofs do not complete full financial or material workflows.

#### Functionality — Transactional jobs and suppression of external effects

##### Vertical Slice 0.3.2 — Execute Durable Jobs and Establish Restore Guards

- **Scope:** Mandatory prerequisite; architecture §§10.2, 13.2.
- **Outcome:** pg-boss 12 setup under migration role, Drizzle transaction enqueue, ID/version-only payloads, singleton keys, retries/dead letters, per-shop jobs and Asia/Kolkata schedules. Prod worker/dev in-process mode share handlers. Kill switch, restore epoch/quarantine, practice suppression and money freeze exist before any external-effect path; provider effect ledger is extended only with P2 messaging.
- **Dependencies:** 0.2.3.
- **Verification:** Commit makes one job runnable; rollback makes none. Duplicate delivery, revoked authority and changed state do not repeat business effects. Old restore-epoch jobs and disabled outbound state cannot send email/messages; money commands honour freeze. Graceful shutdown and oldest-job/dead-letter checks work.
- **Implementation trace:** Merged subdivision 0.3.2a [issue #35](https://github.com/nishanthturnstile/aarili/issues/35) adds the synthetic same-transaction pg-boss command/handler proof, authoritative ID/version requests, durable effect deduplication and a disposable operational harness; see [D1–D8 evidence, approved compatibility correction and exact owner steps](agents/Issue_35_Transactional_Jobs_Evidence.md). It merged in PR #41. Merged subdivision 0.3.2b [issue #36](https://github.com/nishanthturnstile/aarili/issues/36) adds closed-by-default scoped operator controls, epoch quarantine, practice/outbound suppression, reusable money freeze and a disposable recovery/race exercise; see [E1–E8 evidence and exact owner steps](agents/Issue_36_Restore_Guards_Evidence.md). It merged in PR #42. Merged subdivision 0.3.2c [issue #37](https://github.com/nishanthturnstile/aarili/issues/37) adds the shared in-process/worker registry, narrowly granted scheduled authority, trusted per-shop/date occurrences, bounded retries/dead letters/redrive, scrubbed operations and disposable crash/shutdown proofs; see [F1–F9 evidence and exact owner steps](agents/Issue_37_Shared_Job_Runtime_Evidence.md). It merged in PR #43. Full restore/privacy recovery remain 0.5.1/0.5.2; no external effect or later business workflow is activated.

The [Phase 0.3 closeout](agents/Phase_0_3_Closeout_Acceptance.md) reconciles the
six merged implementations, delegated operational exercises, retained local
database preparation and the scheduler-fixture repair. Historical draft wording
in the individual evidence records is superseded by that review; the repair
still requires its own hosted checks and owner merge authorization.

### Phase 0.4 — Establish Responsive Capture and Private Outputs

The owner approved the phase direction and requested implementation on 15 October
2026. The [implementation plan and ten published ticket bodies](agents/Phase_0_4_Implementation_Plan.md)
preserve the parent slices below, synthetic-only verification boundary, physical
Android/Tamil review and pending retention approval. The approved breakdown was
published as #51–#60 with verified native blockers and all ten slices are merged
through PRs #61–#71 on integrated main `4eab791`, with the promotion PR #74
passing all three required checks. The
[Phase 0.4 closeout acceptance](agents/Phase_0_4_Closeout_Acceptance.md) records the
reconciled A–J coverage, hosted verification and remaining gates. Phase closeout
still leaves the physical Android/fluent-Tamil acceptance and the later privacy
and activation gates open.

#### Functionality — Bilingual navigation, server drafts and observable use

##### Vertical Slice 0.4.1 — Build the Responsive Bilingual Shell

- **Scope:** Mandatory prerequisite; architecture §§7, 9.1–9.2, 12.5; USE-01/02/09, product §28 and §1.6 cost-to-serve.
- **Outcome:** Tamil/English catalogues and versioned bilingual business vocabulary; self-hosted Noto Tamil; deliberate phone/tablet/desktop navigation and accessible Base UI controls. In-memory shop-keyed Query cache; nuqs safe filters only. Minimal manifest/service worker caches only static offline fallback. Establish search-key/glossary functions, private product_event instrumentation, per-shop media/usage/support effort and scrubbed pino/Sentry without replay.
- **Dependencies:** 0.2.2. Telemetry/Sentry adapters configured without live PII.
- **Verification:** 360px Tamil, keyboard/focus/44px targets, locale change, shop/logout cache reset, IME input and offline notice. Assert no API/authenticated-page caching, browser-persisted business data, PII in URLs/logs or third-party behavioural tracking. Unit-test Tamil/Tanglish/phone key folding; recall tuning happens before pilot.

##### Vertical Slice 0.4.2 — Save, Resume and Promote a Server Draft

- **Scope:** Mandatory prerequisite; architecture §7.3; USE-03/04/08, AC-40.
- **Outcome:** Recoverable synthetic draft using separate incomplete/complete Zod schemas, stable UUID and idempotent/versioned writes. Debounced IME-safe saves, resume list, Saving/Saved/Not saved/Checking outcome states, explicit current-state validation at promotion, retention flags and in-memory failed-save values.
- **Dependencies:** 0.2.3, 0.4.1.
- **Verification:** Lost save response and repeated promotion create one record; reconnect retries the same command. Reload, reopening and second-device resume recover committed values; unsaved on-screen values are honestly labelled. No offline persistence or copying of approvals. Order-specific fields land in 1.2.1.

#### Functionality — Private files and immutable bilingual documents

##### Vertical Slice 0.4.3 — Process and Authorise Private Media

- **Scope:** Mandatory prerequisite; architecture §§10.1, 11.5; TRU-03/05/07, USE-07, AC-39/53.
- **Outcome:** Consent-aware upload purpose/subject lifecycle for reference photos, sketches/documents, manual pattern files and supplied voice notes; private immutable shop keys, short signed PUT/GET links, content/type/size validation, checksums, quarantine/failure states and orphan cleanup. Images additionally use client re-encoding, pixel limits and sharp thumbnails; document/audio paths have explicit supported formats and do not execute uploaded content. Publication is a separate permission command developed with gallery, not an upload side effect.
- **Dependencies:** 0.2.2–0.2.3, 0.3.2; approved synthetic consent fixtures.
- **Verification:** Cross-shop signed-link/upload access denied; invalid/mismatched files quarantined, EXIF/GPS stripped, notebook legibility and HEIC support measured. Minor uploads require guardian authority. Private fitting/minor publication prohibited at the data/policy seam before gallery activation. Integration with live intake consent is verified again when 1.1.3 adds that workflow; it is not a prerequisite of the synthetic media harness.

##### Vertical Slice 0.4.4 — Render and Share a Versioned Tamil PDF

- **Scope:** Mandatory prerequisite; architecture §9.3; USE-07, COM-04/06, AC-64 job-slip portion.
- **Outcome:** Worker Chromium rendering of immutable document models with embedded fonts, hash/template/font revisions, A4 default/A3 option and no network access to user URLs. Concurrency one/on-demand lifecycle, non-root sandbox validation, preview and explicit pending/failed/retry status. Owner-triggered Android file share and desktop download plus wa.me text; prepared/marked-sent only.
- **Dependencies:** 0.3.2, 0.4.3, 0.4.1.
- **Verification:** Reviewed Tamil golden set, page sizes/font loading and blocked remote fetch. Renderer failure does not roll back the originating command; duplicate job yields one revision artifact. Test mobile share compatibility/fallback and desktop flow. Business-specific bill/job-slip templates follow in Wave 1; no pattern geometry yet.

### Phase 0.5 — Establish Operational and Privacy Recovery

#### Functionality — Reproducible infrastructure and recovery rehearsal

##### Vertical Slice 0.5.1 — Deploy Synthetic Environments and Restore Them

- **Scope:** Mandatory prerequisite; architecture §§12–14, 18; TRU-10, AC-56.
- **Outcome:** Singapore dev/prod config-as-code, standalone web, prod worker/dev in-process jobs, separate DB/buckets/credentials, locked reviewed migrations and expand/migrate/contract. PITR availability confirmed; app_backup off-site encrypted dumps every 12h, scratch restore verification then upload/hash/heartbeat, nightly immutable media/document copy and B2 lifecycle/no-delete keys. Private age key stays off-platform. Establish outage slips/runbook, alerts, spend limits and compatible rollback.
- **Dependencies:** 0.1.2, 0.2.2, 0.3.2, 0.4.4. External resource setup occurs only during its authorised implementation slice.
- **Verification:** Synthetic restore measures RPO/RTO, counts/ledger/document numbers/media hashes, enforces freeze/epoch/kill switch and proves paper reconciliation. Alert before backup age 18h and monitor WAL lag/jobs/cost. Dev never holds live data. Final live-ready drill and seven-day cost review occur in 1.10.4; Pro upgrade precedes all real records.

#### Functionality — Audited erasure, retention and restoration of revocations

##### Vertical Slice 0.5.2 — Enforce Privacy Maintenance without Rewriting Provenance

- **Scope:** Mandatory prerequisite before live use; architecture §§8.3, 11.5, 13; TRU-04/08/12/13, AC-52/53/56.
- **Outcome:** Versioned notice/consent schema, rights requests and restricted audited app_privacy functions; separate personal values from provenance, erase/redact with tombstones. Retention jobs cover media, audit personal fields, expired exports/drafts; processor register, breach/grievance procedure and approved periods. Backup manifests carry tombstones and later link revocations; off-platform monthly purge handles erased B2 media.
- **Dependencies:** 0.3.2, 0.4.3, 0.5.1. Synthetic policy first; counsel/owner approval before real data.
- **Verification:** Runtime cannot invoke unrestricted erasure; authorised rights request removes personal values while required financial provenance remains explained. Withdrawal takes effect; restoring an older dump re-applies newer tombstones. P2 adds a test proving newer share revocations survive restore. Rights-request UI and all module coverage complete in 1.10.2.

**Foundation gate:** A clean checkout runs the actual commands and all implemented safeguard tests. Foundation tests are repeated and expanded as every business table/path lands; they do not certify the later product by themselves.

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

**Approved prerequisite refinement (16 October 2026):**
[Owner access and initial shop onboarding](agents/Owner_Access_Onboarding.md),
tracked by ACCESS-01–12 without GitHub issues, refines the existing foundation UI
and defers naming until authenticated creation. Protected admission and the
selected light/dark design remain. This does not complete or move 1.1.1–1.1.2,
1.10.1/1.10.4 or 2.1.4, and cannot activate live use.

The [17 October entry-flow revision](agents/Owner_Entry_Onboarding_Revision_Plan.md)
supersedes its presentation: authentication only, then dedicated shop onboarding,
then a server-authorized `/dashboard` entry. ENTRY-01–12 cover this revision;
ACCESS-01–12 retain the compatible registration, creation and security guarantees.
Dashboard entry here does not implement the operational dashboard in 1.9.2.

**Objective:** Establish the business rules and identities needed for trustworthy intake.  
**Functional scope:** Shop policies, supported services, Simple mode, customers, wearers and consent.  
**Dependencies:** None; owner approval of initial policies and forms.

#### Functionality — Business configuration and supported services

##### Vertical Slice 1.1.1 — Configure the Shop and Commitment Policies

**REA delivery brief (17 October 2026):** the
[Shop Settings research and implementation prompt](agents/Shop_Settings_REA_Prompt.md)
uses the existing Nool research access where available and TailorMan's public
Settings demo as a bounded secondary reference. It retains the complete 1.1.1
scope, owner-supplied policy inputs, concrete ticket review/publication gates and
the service-catalogue boundary with 1.1.2. No implementation, dependency change or
live activation is recorded by this brief.

**Research/planning packet (17 October 2026):**
[evidence and bounded unknowns](agents/Shop_Settings_REA_Evidence.md),
[independent design/acceptance matrix](agents/Shop_Settings_Design.md) and
[five proposed vertical tickets](agents/Shop_Settings_Ticket_Packet.md) are
prepared for owner review. Nool Settings/profile and TailorMan demo were captured;
follow-up scenario stalls leave persistence, policy and commitment behaviour
unverified. The proposal keeps category ownership/binding in 1.1.2 and defines
the evaluator contract/unbound drafts in 1.1.1, preserving the dependency order.
No ticket publication, implementation acceptance or production policy approval
is recorded. AC-44/AC-60 configuration checks are partial scenario contributions;
AC-61 payment duplication and AC-62 reconciliation retain later workflow gates.

**Approved ticket delivery (17 October 2026):** the owner approved publication
and proceeding with the packet. Issues #84–#88 carry native blocker links.
Selected 1.1.1a/#84 adds existing-shop profile editing and immutable revision
history after its merged direct prerequisites; its
[implementation evidence and owner review](agents/Shop_Profile_Implementation_Evidence.md)
track executable acceptance and remaining human/merge gates. Selected 1.1.1b/#85
adds independent customer/production calendars, durable drafts and immutable
history after #55/#56/#84 merged; its
[implementation evidence and owner review](agents/Shop_Calendar_Implementation_Evidence.md)
track verification and outstanding gates. Selected 1.1.1c/#86 adds receiving
accounts/vendors ([evidence](agents/Shop_Directory_Implementation_Evidence.md));
1.1.1d/#87 adds policy review and action-specific readiness
([evidence](agents/Shop_Policies_Implementation_Evidence.md)). Their parallel
integration is recorded in [integration evidence](agents/Shop_Settings_Integration_Evidence.md).
#88 follows merged #85/#87 and adds unbound rule revisions and a category-neutral
delivery/capacity/cutoff/rush preview
([implementation and acceptance evidence](agents/Shop_Commitments_Implementation_Evidence.md)).
Production category binding stays in 1.1.2; atomic order acceptance stays in 1.2.1.
Complete 1.1.1, real category/order integration
and live readiness are not declared by ticket A.

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** SET-01, SET-02, SET-05, SET-06, SET-07, SET-08, SET-09, SET-11. Scenarios: AC-44, AC-60, AC-61, AC-62.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Make daily work reflect the boutique’s actual operating rules.
- **Functional requirements:** Configure profile, INR/local timezone, working calendar, payment accounts, vendors, commercial policies, warning windows, category lead times, weekly caps, festival cut-offs and rush charges. Version changes; activate only relevant modules.
- **Expected user workflow:** Owner completes setup, reviews missing policies and tests a delivery commitment.
- **Dependencies:** Owner-supplied business values.
- **Acceptance criteria:** Missing policy values remain unresolved. Over-capacity/cut-off acceptance requires a reason; rush charges can be waived explicitly. Changed policies do not silently alter existing work.
- **Deliverable:** Approved operating configuration and understandable commitment warnings.

##### Vertical Slice 1.1.2 — Configure Services, Templates and Simple Mode

**REA delivery brief (18 October 2026):** the
[Services, Templates and Simple Mode prompt](agents/Service_Templates_REA_Prompt.md)
uses Nool Garment Masters and TailorMan's public Item Types demo as research
candidates. It preserves owner-approved forms/templates, versioned catalogue
identities and the existing 1.1.1 category-binding seam. It does not approve
ticket publication, record runtime findings or move actual order acceptance
from 1.2.1 into configuration previews. Scope and dependencies remain unchanged.

**REA research/design and approved delivery (18 October 2026):** the
[sanitized evidence ledger](agents/Service_Templates_REA_Evidence.md) records
18 actual REA evidence IDs from bounded Nool/TailorMan investigation. The
[independent design](agents/Service_Templates_Design.md) and
[approved five-ticket packet](agents/Service_Templates_Ticket_Packet.md) cover
SET-03/04/10 and the existing SET-08/11 category-binding seam. #97-#101 are
published with native blockers. Selected A (#97), with all direct blockers
merged, implements catalogue definitions, pieces/add-ons, availability/history
and category warning authoring; see [implementation evidence](agents/Service_Catalogue_Implementation_Evidence.md).
B (#98) is selected after #97/#57/#58 merged; its local implementation defines
versioned garment/piece measurement forms, explicit precision/applicability and
private method references. See [form evidence](agents/Measurement_Forms_Implementation_Evidence.md).
C (#99 / 1.1.2c) is selected after #97/#98 merged. Its implementation adds bounded
bilingual operating-template editors, exact service manifests and honest generated
requirements; see [template evidence](agents/Service_Templates_Implementation_Evidence.md).
D (#100 / 1.1.2d) is selected after #99 merged. Its local implementation adds
an attributable versioned shop presentation preference and transient Simple/Detailed
views of one canonical requirements preview. See [presentation evidence](agents/Workflow_Presentation_Implementation_Evidence.md).
Per-order overrides, real intake and its two-minute target remain later work.
E (#101) is selected after #97/#88 merged, in the specifically owner-approved
parallel #99/#101 worktrees. Its additive bindings pin canonical category,
availability and unchanged unbound rule revisions; the shared evaluator's v2
configuration preview keeps demand/load unknown and activation unavailable.
See [binding implementation evidence](agents/Commitment_Bindings_Implementation_Evidence.md)
for issue-local verification and remaining acceptance gates. No #99/#100 domain
implementation or real booking acceptance is included in E.
Full 1.1.2 acceptance, production content/policy approval and live-data activation
remain pending. Orders, measurements, production and atomic live capacity
acceptance remain in their existing later slices.

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** SET-03, SET-04, SET-10. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Support fast intake without losing garment-specific requirements.
- **Functional requirements:** Configure approved categories, outfit pieces, add-ons, measurement forms, requirement/task/quality templates and confirmation wording. Default to Simple mode; support per-order and shop-wide detailed mode.
- **Expected user workflow:** Owner selects a service, previews its generated checklist and milestones, then switches a sample order to detailed mode.
- **Dependencies:** 1.1.1.
- **Acceptance criteria:** Templates distinguish required and optional work. Owner assignment is automatic in Simple mode. Switching modes preserves all information and history.
- **Deliverable:** Approved service templates and a usable solo-owner workflow.

#### Functionality — Customer, wearer and guardian registration

##### Vertical Slice 1.1.3 — Register Customers and Authorised Wearers

**Next-feature research selection (17 October 2026):**
[Customer and wearer REA plan](agents/Customer_Wearer_REA_Plan.md) selects this
existing slice for the next concrete research and implementation-planning packet,
using Nool Tech's web workflow as its primary reference. The
[reusable prompt](agents/Customer_Wearer_REA_Prompt.md) preserves evidence limits,
the selected-approved-ticket gate and synthetic-only operation. This does not
complete 1.1.1/1.1.2, change 1.2.1's dependencies, approve ticket publication or
activate live data. Existing privacy notice, retention and guardian-policy inputs
remain prerequisites; competitor behaviour cannot supply their approval.

**Approved delivery packet (17 October 2026):**
[Customer/wearer tickets](agents/Customer_Wearer_Ticket_Packet.md) are published
as **#78 (1.1.3a customers) → #79 (1.1.3b adult wearers/preferences) →
#80 (1.1.3c minor/guardian)**. This splits the existing slice into complete
vertical outcomes without adding release scope. #78 starts only after the
owner-entry prerequisite [PR #77](https://github.com/nishanthturnstile/aarili/pull/77)
merges to development; later tickets retain their merged direct blockers.
The owner permits clearly labelled, nonblank
[draft privacy fixtures](agents/Customer_Wearer_Privacy_Draft.md) for synthetic
implementation while final notice, retention and guardian inputs remain under
review. This revises the research brief's implementation-input gate only;
approved production policies and all Phase 0.5/live gates remain required.
1.1.1/1.1.2 and 1.2.1 dependencies remain unchanged.

**1.1.3a implementation (17 October 2026):** onboarding PR #77 merged into
development as `2ea55ac`. Approved #78 merged through PR #81 as `ac98740`;
local clean verification, 12 browser journeys and both required feature CI
checks passed. The
[implementation evidence](agents/Customer_Registration_Implementation_Evidence.md)
tracks CW-01/02/06/07/08/10/11/12/13. B/C retain separate tickets and merged
prerequisite gates; this does not close 1.1.3 or any live-data gate.

**1.1.3b implementation (17 October 2026):** selected approved #79 starts from
integrated `ac98740` after #55/#56/#78 merged. Adult wearer roles, interaction
authority, independent preferences and current-state draft promotion are scoped
in the [implementation evidence](agents/Adult_Wearer_Implementation_Evidence.md).
Local component verification is recorded. The owner merged PR #82 as `5d00a68`
on 17 October 2026; human/policy acceptance remains separate.

**1.1.3c implementation (17 October 2026):** selected approved #80 starts from
integrated `5d00a68` after #79 merged. Separate minor/guardian identity, pending
claim versus authority review, scoped purpose evidence and recoverable drafts are
recorded in the [implementation evidence and A–C mapping](agents/Minor_Guardian_Implementation_Evidence.md).
Local verification passed; required hosted CI and owner review/merge remain pending.
Actual order/measurement/media
write integration, AC-39/52, final policy, Phase 0.5 and pilot/live-data gates remain
unchanged; registration evidence alone does not close those gates.

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** CUS-01, CUS-02, CUS-04, CUS-07, TRU-01, TRU-03, TRU-04, TRU-05, TRU-07, TRU-13. Scenarios: AC-02, AC-39, AC-52, AC-53.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Recoverable intake

##### Vertical Slice 1.2.1 — Create and Recover a Quick Order

**Next-slice review (19 October 2026):**
[Order intake readiness and REA sources](agents/Order_Intake_Readiness_REA_Review.md)
records merged setup/configuration prerequisites, scoped verification evidence
and the then-pending #108 promotion. It selects Nool live order intake and
TailorMan's public New Bill demo for bounded research, with explicit later-slice
sources for grouping, alterations and repeat work. This is a research/validation
snapshot, not implementation/ticket approval or a change to the dependencies.

The [Quick Order REA prompt](agents/Quick_Order_REA_Prompt.md) turns this selected
research target into a reusable evidence, design and approved-ticket delivery
brief. It retains exact configuration pinning, server drafts and atomic capacity
acceptance, with payments and later booking/service lifecycles kept in their
existing slices.

**Approved delivery packet (19 October 2026):**
[REA evidence](agents/Quick_Order_REA_Evidence.md),
[independent design and QO acceptance matrix](agents/Quick_Order_Design.md),
[approved A–B breakdown](agents/Quick_Order_Ticket_Packet.md) and
[delivery/verification status](agents/Quick_Order_Implementation_Evidence.md)
track **#113 (1.2.1a)** recoverable intake drafts and **#114 (1.2.1b)** atomic
accepted orders/snapshots/capacity/detail. The owner selected A; B waits for A’s
merge. A reuses existing drafts/identity/templates and cannot book a commitment.
AC-40/55 cover draft portions; AC-59 stays partial, SET-11/AC-60 need B’s atomic
acceptance, and AC-58 costing/AC-61 payments are not closed here. #110 was
rechecked and merged with successful full CI. Human/policy/promotion/live gates
remain separate; no merge or deployment is implicit.

**B implementation selection (19 October 2026):** A merged through #115 at
`c6ab32d`; every #114 direct blocker is merged. The owner selected B and approved
one accepted garment in its promised-delivery week, retained booked demand,
shop-scoped QO numbering and blocked effort acceptance until reviewed mapping.
[Acceptance implementation and QO evidence](agents/Quick_Order_Acceptance_Implementation_Evidence.md)
records current-rule locking, atomic order/demand/snapshots, durable reopen and
attributable presentation changes. This contributes SET-11/AC-60; physical-device,
fluent-Tamil, policy, owner acceptance and promotion gates remain separate.

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** ORD-01, ORD-04, ORD-05, ORD-06, ORD-11, USE-03, USE-04, USE-08. Scenarios: AC-40, AC-55, AC-58, AC-59.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.2. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Record a new commitment with minimal administrative effort.
- **Functional requirements:** Provide readable identifiers and the six Simple-mode input groups: customer name/phone, wearer defaulting to the customer, garment type, agreed delivery date, price or “to be quoted”, and optional advance. Generate unresolved checklists and owner assignment. Preserve original/current dates, event dates, priority, creation time and attributable history. Advance recording is added by 1.4.2 without delaying base intake.
- **Expected user workflow:** Owner selects the customer/wearer, garment, date and price; saves and later resumes. Optional advance entry uses the payment capability once available.
- **Dependencies:** 1.1.1–1.1.3.
- **Acceptance criteria:** Incomplete drafts are recoverable. Lost connectivity shows unsaved changes and preserves typed values on screen. Retry creates no duplicate; conflicting edits are disclosed.
- **Deliverable:** Reliable online quick-order intake.

#### Functionality — Independent outfits, packages and services

##### Vertical Slice 1.2.2 — Group Garments and Track Outfit Pieces

**REA delivery brief (19 October 2026):** the
[Grouped Bookings and Outfit Pieces prompt](agents/Grouped_Bookings_REA_Prompt.md)
uses Nool's multi-garment order workflow, TailorMan's public multi-row/package
layout and TailorMate only as a reserve. It preserves independent garment orders,
piece-scoped identity, existing capacity accounting and later payment/fulfilment
boundaries. This brief does not publish tickets or change scope/dependencies.

**Research/design packet (19 October 2026):**
[bounded REA evidence](agents/Grouped_Bookings_REA_Evidence.md) records a live
Nool two-garment save/reopen and TailorMan's unchanged Package-click result.
[Independent design](agents/Grouped_Bookings_Design.md) maps GB-01–GB-10 to
ORD-02/03/13/14, AC-01 and AC-63's structural contribution.
[Proposed vertical tickets](agents/Grouped_Bookings_Ticket_Packet.md) sequence
piece-aware Quick Orders → grouping accepted orders → atomic grouped intake.
The owner approved the concrete breakdown and publication as #118–#120, selecting
A (#118), now merged in #121. B (#119) merged in #122;
[linking implementation/review evidence](agents/Grouped_Bookings_Linking_Implementation_Evidence.md)
tracks its bounded verification. The owner selected C (#120) on 20 October;
[atomic intake implementation/review evidence](agents/Grouped_Bookings_Intake_Implementation_Evidence.md)
tracks its scoped validation and separate activation gates; its implementation
is in draft [PR #123](https://github.com/nishanthturnstile/aarili/pull/123) for owner review.
[Delivery evidence](agents/Grouped_Bookings_Implementation_Evidence.md)
records verification limits. Initial payments are manual in their later slice;
payment gateways/automated UPI/bank integrations are deferred. Actual payments,
measurements, production, custody
and partial handover remain their later slices; this does not close AC-63.

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** ORD-02, ORD-03, ORD-13, ORD-14. Scenarios: AC-01, AC-63.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.2. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Manage family visits and packages without hiding independent work.
- **Functional requirements:** Group separate orders under an optional booking; support multiple wearers, shared occasion/event dates and Bridal package pricing. Give every outfit piece its own requirements, measurements, tasks, custody and readiness.
- **Expected user workflow:** Owner adds blouse and salwar orders, defines salwar pieces and reviews independent commitments.
- **Dependencies:** 1.2.1.
- **Acceptance criteria:** A piece’s blocker does not falsely complete another piece. Booking totals do not duplicate garment revenue. Retail choices stay unavailable in Wave 1.
- **Deliverable:** Multi-garment bookings and piece-aware outfit orders.

##### Vertical Slice 1.2.3 — Create Alteration and Small-Service Orders

**REA delivery brief (20 October 2026):** the
[Alteration and Small-Service prompt](agents/Small_Service_REA_Prompt.md) scopes
standalone lightweight intake and independent add-on lines, using TailorMan's
alteration surface and Nool's linked-alteration flow as research candidates.
It preserves customer-property identity, reviewed service-capacity mapping and
later custody/payment/production/fulfilment integration. It changes no scope or
dependencies and does not approve issue publication or claim full AC-50 closure.

**Research/design packet (20 October 2026):**
[actual REA evidence](agents/Small_Service_REA_Evidence.md) records the accessible
TailorMan alteration sample and unchanged New click; Nool's delivered-order
reopening remains a documented, unexecuted flow because our synthetic orders are
Pending. [Independent design](agents/Small_Service_Design.md) maps SS-01–SS-14
to lightweight intake, exact priced lines, customer-property identity, guardian
applicability, supplemental history and reviewed capacity coverage.
[Approved vertical tickets](agents/Small_Service_Ticket_Packet.md) sequence
standalone acceptance → governed custom/grouped add-ons → independent bounded
completion. The owner approved A–C and D1–D6 implementation conventions and
publication as [#124](https://github.com/nishanthturnstile/aarili/issues/124),
[#125](https://github.com/nishanthturnstile/aarili/issues/125) and
[#126](https://github.com/nishanthturnstile/aarili/issues/126), selecting A (#124).
B/C retain their direct merge and selection gates; production values remain pending.
[Implementation/check status](agents/Small_Service_Implementation_Evidence.md)
records integrated development `63d5123`, merged prerequisites and remaining
decisions. This adds traceability without changing scope/dependencies, approving
production values or closing AC-50. Full money, custody, execution, trials/quality
and actual handover remain their named later slices.

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** ORD-14, JOB-08, JOB-09. Scenarios: AC-50.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.2. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Handle lightweight jobs without forcing a full custom-stitching process.
- **Functional requirements:** Add priced fall/pico/pre-pleating and similar lines with completion state and optional tasks. Create standalone small-service or alteration orders without mandatory full measurements or patterns.
- **Expected user workflow:** Owner records a customer’s saree service or kurti alteration, requested work, price and delivery commitment.
- **Dependencies:** 1.2.1; later money, custody and fulfilment slices complete the journey.
- **Acceptance criteria:** Inapplicable forms/tasks are absent. Customer garments remain traceable property. Multiple add-ons retain separate completion and pricing.
- **Deliverable:** Lightweight service intake compatible with the main fulfilment workflow.

#### Functionality — Repeat intake and identity history

##### Vertical Slice 1.2.4 — Reuse Orders and Maintain Customer History

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** CUS-03, CUS-05, CUS-06, ORD-08, ORD-12, MEA-10, TRU-06, TRU-12. Scenarios: AC-02, AC-58, AC-59.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.2. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Versioned garment inputs

##### Vertical Slice 1.3.1 — Capture a Versioned Design Specification

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** ORD-07, DES-01, DES-02, DES-03, DES-04, DES-05, DES-10. Scenarios: AC-07, AC-08.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.3. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Replace scattered references with clear garment instructions.
- **Functional requirements:** Maintain category/type libraries with availability controls. Separate neck type/design and sleeve type/design. Capture garment-specific construction, fit, lining, decoration and restrictions; attach source-linked references, captions and annotations.
- **Expected user workflow:** Owner selects supported choices and distinguishes inspiration from confirmed instructions.
- **Dependencies:** 1.1.2, 1.2.1.
- **Acceptance criteria:** Inactive choices remain readable historically but require replacement/reactivation for new work. Reference replacement preserves the previous version. Private references never publish automatically.
- **Deliverable:** Versioned garment specifications and controlled design libraries.

##### Vertical Slice 1.3.2 — Record and Select Measurement Versions

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** MEA-01, MEA-02, MEA-03, MEA-04, MEA-05, MEA-06, MEA-07, MEA-11. Scenarios: AC-06, AC-07, AC-08.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.3. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Preserve accurate wearer-level measurement history.
- **Functional requirements:** Support approved per-category/piece forms, inches/centimetres, decimals/fractions, visible conversions and field precision. Record measurement source, method, date and measurer; validate missing or implausible values with approved rules.
- **Expected user workflow:** Owner records a session or reviews a previous version, then explicitly links it to the order/piece.
- **Dependencies:** 1.1.3, 1.3.1.
- **Acceptance criteria:** Revisions do not change historical orders. Reuse shows age/source/context and requires confirmation. Entered, garment-target and derived values are distinguishable; no unapproved formulas or guessed measurements are introduced.
- **Deliverable:** Authoritative, private measurement versioning.

#### Functionality — Manual production references and identification

##### Vertical Slice 1.3.3 — Record a Manual or External Pattern Path

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** PAT-01, PAT-03. Scenarios: AC-07, AC-08.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.3. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Keep production usable without automated drafting.
- **Functional requirements:** Declare manual, external or validated automated availability for each supported type. Link physical-pattern references, sketches or uploaded outputs with source, version and review status.
- **Expected user workflow:** Owner selects the manual/external method and records the reference used for the garment.
- **Dependencies:** 1.3.1–1.3.2.
- **Acceptance criteria:** Orderable types are not presented as automatically draftable. Imported scale/formula assumptions remain visibly unverified. No unsupported generation is offered.
- **Deliverable:** Reviewed manual/external production references.

##### Vertical Slice 1.3.4 — Produce Job Slips and Material Labels

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** ORD-10, USE-07. Scenarios: AC-64.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.4. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Quotations and customer deposits

##### Vertical Slice 1.4.1 — Prepare Itemised Estimates and Quotations

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** FIN-01, FIN-02, FIN-03, FIN-04. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1, 0.4.4. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Agree a transparent price without confusing revenue and cost.
- **Functional requirements:** Maintain effective-dated rates for garment labour, materials, add-ons, alterations, Aari and rush work. Produce garment/booking quotes with assumptions, quantities, inclusions, discounts, validity and revisions; distinguish selling price from internal cost.
- **Expected user workflow:** Owner prepares an estimate, resolves unanswered pricing and shares a quotation.
- **Dependencies:** 1.1.1, 1.2.2–1.2.3, 1.3.1.
- **Acceptance criteria:** Customer-supplied materials are not charged as shop stock. Bundled/complimentary lines retain real costs. Catalogue changes do not rewrite old quotes; booking and garment charges are counted once.
- **Deliverable:** Versioned, itemised non-tax quotations.

##### Vertical Slice 1.4.2 — Record, Verify and Allocate Payments

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** FIN-05, FIN-10, FIN-11, FIN-12, FIN-13. Scenarios: AC-03, AC-04, AC-17, AC-18, AC-49, AC-60, AC-61, AC-62.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Show what money is genuinely received and which work it funds.
- **Functional requirements:** Record advances, instalments and split methods; distinguish pending, confirmed, failed and reversed evidence. Confirm cash on receipt and UPI through the owner’s receiving-account check. Detect duplicate UTRs and allocate confirmed money transparently. Apply proportional shares by agreed charge, round each down to whole rupees, and give all remaining rupees and paise to the largest-charge line, earliest if tied. Zero total charge leaves unallocated customer credit. Owner reallocation needs a reason before billing; after billing it requires an adjustment. Source locking, balanced postings and durable references accompany this slice. Receipt document generation is layered on by 1.4.4.
- **Expected user workflow:** Owner records cash/UPI, confirms receipt and reviews allocations; the linked receipt is issued once document generation is available.
- **Dependencies:** 1.4.1.
- **Acceptance criteria:** Screenshots remain evidence. Pending money does not settle balances. Default allocation sums exactly, including paise sources; ₹1,000 across three equal ₹700 lines allocates ₹334/₹333/₹333. Allocations cannot exceed confirmed available funds under concurrency. Excess money remains customer credit. Test same-key retry after a lost response, stale versions, actor/action/hash mismatch, duplicate UTR and adjustment after billing; no second posting or confirmation is produced.
- **Deliverable:** Confirmed payments, reviewable allocations and accurate balances.

#### Functionality — Agreements, issue and financial corrections

##### Vertical Slice 1.4.3 — Approve Agreements and Govern Changes

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** ORD-09, DES-06, DES-08, DES-09, DES-11, COM-04, COM-06, COM-07, COM-08. Scenarios: AC-05.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1, 0.4.4. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Ensure production uses an accepted, current scope.
- **Functional requirements:** Prepare customer summaries and Tamil/English WhatsApp content; record prepared/marked-sent status and communication history. Capture current design, price and date approval, including staff-attested verbal approval. Assess changes and issue revised agreements. Sharing opens WhatsApp click-to-chat with prefilled text; the owner attaches a PDF/image through the mobile share route or desktop download and marks it sent.
- **Expected user workflow:** Owner shares the summary, records approval, then reviews any requested change against affected work, costs and dates. Available payment information is included without making payment a prerequisite for agreement.
- **Dependencies:** 1.3.1–1.3.3, 1.4.1.
- **Acceptance criteria:** A share is not approval. Requests remain pending until accepted. Only affected approvals/work become stale; cut/dispatched work is flagged. Original promises and agreements remain readable. The product does not claim automatic sending or access to private WhatsApp history.
- **Deliverable:** Approved customer agreements and attributable change control.

##### Vertical Slice 1.4.4 — Issue Non-Tax Bills and Receipts

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** FIN-06, FIN-07, FIN-08, FIN-09, FIN-21. Scenarios: AC-03, AC-04, AC-44.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1, 0.4.4. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Create valid business documents and a clear commercial event sequence.
- **Functional requirements:** Distinguish quote, acknowledgement, payment receipt, bill and adjustment. Use approved identity/numbering/correction rules; preserve issued originals and cancelled numbers. Apply the founding shop’s unregistered regime without GSTIN or tax lines.
- **Expected user workflow:** Owner issues a receipt or bills the relevant garment/piece/service, normally at handover.
- **Dependencies:** 1.4.1–1.4.3; approved document configuration.
- **Acceptance criteria:** Quotes create no obligation; price approval sets expected order value, not revenue/receivable; advances create deposits, not revenue. Billing creates revenue/receivable and applies deposits once. Earlier billing requires a reason. Missing material does not block an otherwise valid document. Concurrent issuance cannot reuse numbers; voids preserve numbers. Stored revision/hash/template/fonts remain unchanged after configuration edits. A failed PDF shows retry status without reversing the issued bill/payment.
- **Deliverable:** Controlled non-tax documents and distinguishable expected versus collectible balances.

##### Vertical Slice 1.4.5 — Correct Money and Settle Refund Liabilities

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** FIN-14. Scenarios: AC-19, AC-20, AC-51.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Customer fabric receipt and custody

##### Vertical Slice 1.5.1 — Receive Customer Property and Resolve Material Requirements

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** MAT-01, MAT-02, MAT-04. Scenarios: AC-03, AC-04, AC-50.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.3, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Distinguish a material promise from physical receipt.
- **Functional requirements:** Record fabric, samples and accessories with quantities, dimensions/units, condition, source, receiver and optional photos. Track required, promised, received, usable and shortfall quantities.
- **Expected user workflow:** Owner receives an item, links it to the relevant order/piece and updates its checklist.
- **Dependencies:** 1.2.2–1.2.3.
- **Acceptance criteria:** Unknown dimensions remain unknown. Customer property does not increase purchased-stock value. Partial/unusable receipt remains visible and blocks only the relevant production action.
- **Deliverable:** Customer-property receipts and accurate material readiness.

##### Vertical Slice 1.5.2 — Split Shared Fabric and Track Custody

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** MAT-03, MAT-13. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Prevent fabric double-commitment and lost cut pieces.
- **Functional requirements:** Plan fabric splits across garments/pieces; track cut pieces and remnants separately. Record optional storage locations, current custodian and movement between shop, worker, trial and vendor.
- **Expected user workflow:** Owner allocates shared fabric, records its cut pieces and confirms each physical movement.
- **Dependencies:** 1.5.1, 1.2.2.
- **Acceptance criteria:** The same cloth cannot be committed twice. Assignment changes do not imply physical movement. Every dispatched piece and unresolved return remains traceable.
- **Deliverable:** Piece-level shared-fabric and custody records.

#### Functionality — Shop material consumption and direct costs

##### Vertical Slice 1.5.3 — Reserve and Consume Shop Materials

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** MAT-05, MAT-06, MAT-07, MAT-11. Scenarios: AC-23, AC-58, AC-59.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Make stock availability and garment material cost trustworthy.
- **Functional requirements:** Maintain minimal reconciled opening stock, explicit units and purchase unit cost; reserve without consuming. Record issue, actual use, wastage and reusable remnant returns.
- **Expected user workflow:** Owner reserves material, records cutting/issue and reconciles the remainder.
- **Dependencies:** 1.5.1; approved opening quantities/cost basis.
- **Acceptance criteria:** Insufficient stock is blocked by default. A ₹100/m issue of 2.2 m costs ₹220 if 0.2 m is unusable, or ₹200 if the remnant is returned as reusable stock. Purchase and consumption are not both charged to the order.
- **Deliverable:** Minimal accurate stock allocation and material costing.

##### Vertical Slice 1.5.4 — Record Direct Costs and Purchase Evidence

- **Scope:** P1 Must direct-cost evidence (FIN-17); PUR-03 minimal purchase capture is Should, full purchasing P2.
- **Traceability:** PUR-03, FIN-17. Scenarios: AC-23.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Preserve genuine fulfilment costs without requiring full purchasing.
- **Functional requirements:** Capture minimal purchase/service evidence, quantities, unit costs and order/stock purpose. Record estimated/actual material, vendor, labour, fulfilment and correction costs; flag missing evidence.
- **Expected user workflow:** Owner records a purchase or direct cost and links it to stock or the relevant work.
- **Dependencies:** 1.4.1, 1.5.3.
- **Acceptance criteria:** Stock purchases are recognised through consumption for order costing. Vendor charges are not duplicated as purchase and labour costs. Zero-priced work retains its cost.
- **Deliverable:** Evidence-linked direct costs and completeness indicators.

#### Functionality — Property returns and remedies

##### Vertical Slice 1.5.5 — Return Property and Resolve Incidents

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** MAT-10, MAT-12. Scenarios: AC-13, AC-14.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Enquiry conversion and owner appointments

##### Vertical Slice 1.6.1 — Capture and Convert an Enquiry

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** ENQ-01, ENQ-02, ENQ-03, ENQ-04. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Track prospective work without requiring full intake.
- **Functional requirements:** Capture minimal request/contact/source information; manage new, contacted, awaiting-information, quoted, follow-up-due, converted and lost/closed states with owner, reason and next action. Preserve unsuccessful quotes.
- **Expected user workflow:** Owner records an enquiry, follows up and converts it into existing customer/booking/order records.
- **Dependencies:** 1.2.1–1.2.2, 1.4.1.
- **Acceptance criteria:** No measurements or fabric are required for enquiry capture. Conversion preserves source history and avoids duplicate customers/orders. Enquiry state does not masquerade as production state.
- **Deliverable:** Lightweight enquiry-to-order conversion.

##### Vertical Slice 1.6.2 — Book Owner-Managed Appointments

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** ENQ-05, COM-04, COM-06, COM-07, COM-08. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Schedule measurements, consultations, trials and collection.
- **Functional requirements:** Record appointment type, duration, location, attendee and linked garment/booking using the shop calendar.
- **Expected user workflow:** Owner chooses an available time, links the visit and shares the applicable manual confirmation.
- **Dependencies:** 1.1.1, 1.2.1, 1.4.3.
- **Acceptance criteria:** Appointments appear against the correct wearer/work. Appointment time and garment delivery promise remain distinct. No customer self-booking is offered.
- **Deliverable:** Owner-managed appointment scheduling.

#### Functionality — Acquisition evidence

##### Vertical Slice 1.6.3 — Preserve Lead Sources and Optional Monthly Spend

- **Scope:** P1 Must source evidence; monthly channel spend P1 Should.
- **Traceability:** ENQ-08, REP-07, REP-08. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Owner production and blockers

##### Vertical Slice 1.7.1 — Start and Complete Applicable Production Tasks

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** JOB-01, JOB-02, JOB-03, JOB-04, JOB-05. Scenarios: AC-03, AC-04, AC-11, AC-12, AC-50.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Turn intake into an executable garment workflow.
- **Functional requirements:** Generate template-dependent tasks, optional/parallel work and Simple-mode milestones. Record assignment, start/completion, timestamps, evidence and approved manual/pattern method.
- **Expected user workflow:** Owner checks readiness, starts cutting or another applicable task and completes its recorded work.
- **Dependencies:** 1.1.2, 1.3.2–1.3.3, 1.4.3, 1.5.1–1.5.3.
- **Acceptance criteria:** Cutting is an explicit irreversible checkpoint. Missing applicable approvals/materials/assignment block the action. Owner assignment is valid; differing pre/post-cut embroidery sequences both work.
- **Deliverable:** Governed owner-operated production.

##### Vertical Slice 1.7.2 — Hold Work and Manage Blockers

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** ORD-01, ORD-04, ORD-05, ORD-06, ORD-11, JOB-06. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Make stalled work actionable.
- **Functional requirements:** Record reason, accountable owner, next action, review date and schedule impact for holds/blockers. Preserve blocked duration and explicit reopening.
- **Expected user workflow:** Owner pauses a task, records the resolution action and resumes when the underlying condition changes.
- **Dependencies:** 1.7.1.
- **Acceptance criteria:** Acknowledgement is not resolution. Waiting time is not automatically worker effort. Changing dates preserves the original promise and requires the applicable agreement.
- **Deliverable:** Owned production exceptions and blocker history.

#### Functionality — Outsourced Aari work and obligations

##### Vertical Slice 1.7.3 — Brief and Dispatch Aari/Embellishment Work

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** MAT-09, JOB-16, OPS-01, OPS-04, OPS-11. Scenarios: AC-66.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.3, 0.4.4. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Manage specialist work and customer panels without a separate ledger.
- **Functional requirements:** Maintain motif references, placement/coverage, complexity, effort ranges and consumable templates. Price through approved rates; identify shop/customer/artisan supplies. Maintain minimal artisan profiles and shareable briefs. Apply the approved marking/tracing, framing, Aari, removal, quality and stitching sequence appropriate to the garment.
- **Expected user workflow:** Owner agrees the design/rate, selects the applicable sequence and dispatches exact panels/materials with an expected return.
- **Dependencies:** 1.3.1, 1.4.1–1.4.3, 1.5.2, 1.7.1.
- **Acceptance criteria:** Dispatch changes custody only for specified items. The agreed charge and any advance/outstanding due are visible immediately at dispatch; 1.7.4 adds acceptance/payability and final settlement. Supplies land in the correct cost category. A vendor login is unnecessary; photos remain subject to publication permission.
- **Deliverable:** Complete Aari/external-work briefs and dispatch records.

##### Vertical Slice 1.7.4 — Accept External Returns and Settle Vendor Dues

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** MAT-09, JOB-07, OPS-11. Scenarios: AC-13, AC-14, AC-65, AC-66.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Fit and quality acceptance

##### Vertical Slice 1.8.1 — Record Trials, Corrections and Fit Outcomes

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** MEA-08, MEA-09, JOB-08, JOB-09. Scenarios: AC-15, AC-16, AC-50.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.3. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Resolve fitting work and preserve contextual learning.
- **Functional requirements:** Record trial attendance, versions used, feedback, changed measurements, correction cause/chargeability/cost, owner and next action. Save final garment fabric/construction/alterations and distinguish staff-assessed from customer-confirmed fit.
- **Expected user workflow:** Owner records a trial, creates corrective work if needed and captures the final accepted outcome.
- **Dependencies:** 1.3.2, 1.6.2, 1.7.1, 1.5.4.
- **Acceptance criteria:** Missed trials flag risk without silently changing dates. Planned fitting differs from avoidable rework. A garment correction never automatically rewrites general body measurements.
- **Deliverable:** Trial-to-correction workflow and verified fit history.

##### Vertical Slice 1.8.2 — Quality-Check and Mark Valid Readiness

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** JOB-10, JOB-11. Scenarios: AC-15, AC-16, AC-50.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Make “ready” a trustworthy event.
- **Functional requirements:** Run garment/piece-specific checks for construction, finish, defects, closures, accessories and relevant dimensions. Failed checks create corrective tasks; preserve first/current readiness and withdrawal reasons.
- **Expected user workflow:** Owner completes quality review and marks the relevant work ready, or sends it back for correction.
- **Dependencies:** 1.7.1–1.7.4; 1.8.1 where trial decisions apply.
- **Acceptance criteria:** Unresolved required trial/quality decisions prevent readiness. Withdrawing readiness preserves the earlier event and its invalidation. Payment or collection is not implied by readiness.
- **Deliverable:** Quality acceptance and auditable readiness.

#### Functionality — Handover, cancellation and residual obligations

##### Vertical Slice 1.8.3 — Hand Over Garments or Pieces and Record Collection

- **Scope:** P1 Must piece/garment collection and credit handover; courier dispatch optional.
- **Traceability:** ORD-02, ORD-13, JOB-12, JOB-13, FIN-15, COM-04, COM-06, COM-07, COM-08. Scenarios: AC-13, AC-14, AC-21, AC-22, AC-50, AC-63.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Fulfil individual items while preserving the remainder.
- **Functional requirements:** Record selected garment/piece, recipient, acknowledgement and actual collection time. Issue the applicable bill; apply payment or authorised credit policy. Review outstanding customer property and prepare ready/balance messages.
- **Expected user workflow:** Owner selects ready items, reviews settlement/property and records partial or full handover.
- **Dependencies:** 1.8.2, 1.4.2/1.4.4, 1.5.5.
- **Acceptance criteria:** A salwar top can be handed over while its bottom remains in correction. Unpaid credit remains collectible. Ready, dispatched and received/collected are distinct; optional delivery records do not falsely imply receipt.
- **Deliverable:** Piece-aware handover and accurate remaining obligations.

##### Vertical Slice 1.8.4 — Cancel, Reopen and Close Work Correctly

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** ORD-01, ORD-04, ORD-05, ORD-06, ORD-11, JOB-14, JOB-15. Scenarios: AC-21, AC-22, AC-51.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Resolve exceptions without deleting their consequences.
- **Functional requirements:** Review irreversible work, remaining commitments, charges, refund/credit, vendor dues and property. Reopen through new linked work with a reason. Aggregate booking fulfilment separately from closure.
- **Expected user workflow:** Owner assesses cancellation, records the approved settlement actions and closes only resolved obligations.
- **Dependencies:** 1.4.5, 1.5.5, 1.7.4, 1.8.3.
- **Acceptance criteria:** Cancellation after cutting preserves costs/history. Mixed handed-over/cancelled garments show “fulfilled with cancellations”. Closure requires no unresolved work, money, property, vendor due or issue; prior handover is never erased.
- **Deliverable:** Governed cancellation, reopening and obligation-based closure.

##### Vertical Slice 1.8.5 — Manage Uncollected Garments and Stored Property

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** SET-12, COM-04, COM-06, COM-07, COM-08. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Find and act on daily work

##### Vertical Slice 1.9.1 — Search and Filter Linked Work

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** DAY-03, DAY-04, REP-05. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Locate the right record without reconstructing it.
- **Functional requirements:** Search customer/wearer, phone fragments, booking/order IDs, garment and material labels. Combine relevant filters; provide reset/saved views and clear empty results. Legacy-reference search is extended when 1.10.1 supplies migrated records.
- **Expected user workflow:** Owner finds a record and opens its customer, work, custody or money history.
- **Dependencies:** Existing record slices in Phases 1.2–1.8; no dependency on the later migration extension for base search.
- **Acceptance criteria:** Tamil script, Latin-typed Tamil and English variations find supported names/terms without merging identities. Search exposes only authorised records.
- **Deliverable:** Practical cross-workflow search and order lists.

##### Vertical Slice 1.9.2 — Act on Alerts and Complete Daily Close

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** FIN-16, DAY-01, DAY-02, DAY-06, DAY-07, DAY-08, DAY-09, DAY-10. Scenarios: AC-27, AC-28, AC-60, AC-61, AC-62.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Give the owner a clear next action.
- **Functional requirements:** Show due/at-risk work, trials, pending decisions, shortages, vendor returns, quality failures, uncollected items and balances. Support acknowledge, assign, snooze, resolve/reopen and quick actions. Reconcile cash/UPI/bank records against supplied counts/evidence.
- **Expected user workflow:** Owner works through action cards, then reviews tomorrow’s work and payment mismatches.
- **Dependencies:** Phases 1.4–1.8, 1.9.1.
- **Acceptance criteria:** Three-day, two-day, tomorrow, today and overdue warnings use shop-local dates; default calendar days can switch to working days with category-specific windows. Slots become overdue when passed, otherwise at working-day end. Snoozed work remains listed. A ₹200 cash shortage uses an adjustment, not rewritten bills. Priority has a visible reason.
- **Deliverable:** Daily operating workspace and reconciled close.

#### Functionality — Trustworthy operational and financial review

##### Vertical Slice 1.9.3 — Review Operational and Customer Outcomes

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** REP-01, REP-06. Scenarios: AC-15, AC-16, AC-27, AC-28, AC-47.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Evaluate real performance without flattering statistics.
- **Functional requirements:** Report intake/completion, WIP, blocked duration, original/current-promise readiness, trials, rework, pickup age, repeat demand and basic conversion/service demand.
- **Expected user workflow:** Owner selects a period/category and inspects the contributing garments.
- **Dependencies:** 1.6.1, 1.8.1–1.8.4.
- **Acceptance criteria:** Revised promises do not improve original-promise results. Unfinished overdue work remains in the denominator. Cancelled-after-due and invalidated readiness remain visible; planned fitting is separate from avoidable rework.
- **Deliverable:** Essential operational/customer scorecards.

##### Vertical Slice 1.9.4 — Review Sales, Collections and Outstanding Obligations

- **Scope:** P1 Must financial positions/dues and cost-completeness; full contribution/overhead analysis later.
- **Traceability:** REP-02, REP-03, REP-04. Scenarios: AC-01.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Reviewed opening records and privacy rights

##### Vertical Slice 1.10.1 — Import and Reconcile Starting Records

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** MAT-06, MAT-07, MAT-11, USE-05. Scenarios: AC-41, AC-42.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.3, 0.3.2, 0.5.2. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Begin live use without duplicating old business activity.
- **Functional requirements:** Preview/import customers, measurements, active orders, opening stock and receivables/payables. Preserve source, cut-off, legacy dates and identifiers. Attach notebook photos as unconfirmed records indexed by book/page.
- **Expected user workflow:** Owner reviews errors/duplicates, approves opening records and confirms handwritten values when the wearer next orders.
- **Dependencies:** Receiving business capabilities in Phases 1.2–1.9.
- **Acceptance criteria:** Re-import cannot duplicate opening balances. Historical creation/order dates are distinct. Opening money/stock is not counted again as new-period sales/purchases; notebook photos are not authoritative measurements.
- **Deliverable:** Reconciled opening records and searchable legacy evidence.

##### Vertical Slice 1.10.2 — Handle Correction, Consent Withdrawal and Data Rights

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** CUS-09, TRU-08. Scenarios: AC-52, AC-53.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.2, 0.5.2. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Resolve privacy requests with honest retention outcomes.
- **Functional requirements:** Track correction, access/export, erasure, consent withdrawal and archive requests. Apply approved retention to records, media, exports, backups and processors; show grievance routes.
- **Expected user workflow:** Owner reviews authority, processes the request and communicates what changed or must be retained.
- **Dependencies:** 1.1.3 and relevant record histories; approved privacy procedures.
- **Acceptance criteria:** Marketing withdrawal stops marketing use. Permitted measurement/photo deletion or anonymisation is completed; retained financial records are explained. No false claim of total erasure is made.
- **Deliverable:** Reviewed customer-data lifecycle workflows.

#### Functionality — Portability, support and pilot readiness

##### Vertical Slice 1.10.3 — Export Linked Records and Request Contextual Support

- **Scope:** P1 Must base; scoped Should expansions follow the requirement register.
- **Traceability:** FIN-20, USE-06, BIZ-06. Scenarios: AC-41, AC-42.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.2, 0.5.2. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Preserve portability and resolve problems without unnecessary exposure.
- **Functional requirements:** Export understandable customers/wearers, orders, measurements/history, patterns where present, bills/payments, stock, costs and permitted media. Provide accountant-linked financial exports and contextual support/feedback status.
- **Expected user workflow:** Owner selects export scope or submits a problem with authorised record context.
- **Dependencies:** Phases 1.2–1.9.
- **Acceptance criteria:** Exports declare inclusions/exclusions, date bases and retention limits and retain meaningful links. Routine support does not require an entire private customer dataset.
- **Deliverable:** Useful data/accountant exports and tracked support requests.

##### Vertical Slice 1.10.4 — Demonstrate Recovery and Pass the Founding-Pilot Gate

- **Scope:** P1 Must live gate; full self-service resettable practice UX P1 Should.
- **Traceability:** TRU-10, USE-01, USE-02, USE-09, BIZ-01. Scenarios: AC-56, AC-57.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.2, 0.5.2, 0.5.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Delegated access and work

##### Vertical Slice 2.1.1 — Invite Staff and Apply Role Boundaries

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** SET-07, OPS-01, OPS-04, TRU-02, TRU-09. Scenarios: AC-56, AC-57.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Let staff perform their jobs with appropriate authority.
- **Functional requirements:** Provide the fixed owner/manager/tailor/bookkeeper matrix and owner toggles. Configure worker skills, relationships, availability and active state; support invitations and immediate revocation.
- **Expected user workflow:** Owner selects a role, reviews permitted actions and assigns work.
- **Dependencies:** 1.7.1, 1.10.4; approved staff-access decisions.
- **Acceptance criteria:** Tailors see assigned work; bookkeepers do not see fitting assets. Discount/refund limits are enforced. Departure stops access while preserving assignments and payables.
- **Deliverable:** Governed shared-team operation.

##### Vertical Slice 2.1.2 — Share Scoped Work with External Workers

- **Scope:** P2 baseline with external login conditional; P1 vendor records need no login.
- **Traceability:** TRU-02. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Allow artisan participation without general shop access.
- **Functional requirements:** Expose only shared briefs/pieces, minimum contact information and the worker’s own rates; allow permitted acknowledgement/progress/return reporting.
- **Expected user workflow:** Owner shares a job; artisan acknowledges or updates it; owner independently accepts returned work.
- **Dependencies:** 2.1.1, 1.7.3–1.7.4.
- **Acceptance criteria:** External reports cannot confirm shop receipt, quality or payment. Other customers, jobs and margins remain inaccessible.
- **Deliverable:** Optional external-worker participation.

#### Functionality — Independent shop onboarding and support

##### Vertical Slice 2.1.3 — Switch Shops and Govern Support Access

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** TRU-09, TRU-11, BIZ-03. Scenarios: AC-38.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Support independent boutiques and accountable support.
- **Functional requirements:** Provide explicit shop membership/current-shop indication; verify ownership transfer. Offer owner-authorised, time/scenario-limited support access and revocation.
- **Expected user workflow:** User switches between authorised shops; owner grants and ends a specific support session.
- **Dependencies:** 2.1.1, 1.10.3–1.10.4; multi-shop continuity approval.
- **Acceptance criteria:** Search, media, exports and notifications remain isolated; AI inherits this boundary when introduced. Ownership verification cannot erase history. Membership does not create multi-branch stock/accounting.
- **Deliverable:** Isolated shop membership and recorded support access.

##### Vertical Slice 2.1.4 — Onboard a Boutique through Reusable Configuration

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** BIZ-01, BIZ-02. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Detailed stock and purchase commitments

##### Vertical Slice 2.2.1 — Maintain Detailed Stock and Perform Stocktake

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** MAT-06, MAT-07, MAT-11. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Distinguish usable material variants and reconcile actual quantities.
- **Functional requirements:** Support explicit metre/centimetre/piece/roll/pack conversions, colour/batch/width/condition, damaged/quarantined stock, counted adjustments and write-offs.
- **Expected user workflow:** Owner defines a material, counts it and reviews a reasoned adjustment.
- **Dependencies:** 1.5.3, 2.1.1.
- **Acceptance criteria:** Incompatible units cannot convert silently. Roll and length quantities are not double-counted. Negative-stock exceptions require explicit authority and reconciliation.
- **Deliverable:** Detailed material inventory and stocktake.

##### Vertical Slice 2.2.2 — Raise and Approve a Purchase

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** MAT-08, PUR-01, PUR-02, PUR-03. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Turn shortages into reviewed replenishment.
- **Functional requirements:** Maintain suppliers, terms/lead times and shared supplier/vendor identity. Create requests from low stock, shortages or manual needs; record approved purchases, quantities, cost, treatment and expected receipt.
- **Expected user workflow:** Owner reviews a request, considers substitution impacts and approves a purchase commitment.
- **Dependencies:** 2.2.1, 1.5.4, 1.4.3.
- **Acceptance criteria:** A request is not a purchase. No automatic ordering occurs. Substitution affecting design/price needs approval; unreceived material is not made available.
- **Deliverable:** Approved purchase commitments and supplier records.

#### Functionality — Supply receipt, payables and returns

##### Vertical Slice 2.2.3 — Receive Purchases and Record Supplier Bills

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** PUR-04, PUR-05, REP-02, REP-04. Scenarios: AC-24.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Reconcile physical supply independently from supplier money.
- **Functional requirements:** Record accepted partial receipts and discrepancies; retain outstanding quantities. Record bills, due dates, credits, payments and disputes with duplicate detection.
- **Expected user workflow:** Owner accepts a delivery, separately records the bill/payment and reviews remaining supply and balance.
- **Dependencies:** 2.2.2, 1.4.2/1.4.5.
- **Acceptance criteria:** Only accepted stock becomes available. Unpaid bills remain payable. Manual/photo/import entries cannot double-count a bill/payment or duplicate a craft obligation.
- **Deliverable:** Partial purchasing receipts and supplier payable accounting.

##### Vertical Slice 2.2.4 — Return Supplies and Review Replenishment

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** PUR-06, PUR-07, REP-05. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Team assignment and scheduling

##### Vertical Slice 2.3.1 — Assign, Transfer and Find Team Work

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** ORD-10, OPS-02, OPS-03. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Make task responsibility visible.
- **Functional requirements:** Provide queued/in-progress/blocked/review/completed workload stacks, task assignment/reassignment reasons and acknowledgement where used. Add access-controlled QR/barcode lookup as an enhancement.
- **Expected user workflow:** Coordinator assigns/transfers a task; worker opens the permitted brief and updates work.
- **Dependencies:** 2.1.1, 1.3.4, 1.7.1. 2.1.2 is required only for external-worker login/acknowledgement, not internal staff assignment.
- **Acceptance criteria:** Assignment and custody remain separate. Staff landing shows assigned work. Public scans reveal no private data; inactive workers remain historical.
- **Deliverable:** Accountable team workload and optional physical lookup.

##### Vertical Slice 2.3.2 — Plan Capacity and Review Commitment Risk

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** OPS-05, OPS-06, OPS-07, DAY-05. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Improve scheduling beyond weekly category caps.
- **Functional requirements:** Use approved task effort/duration, skills, availability, holidays, dependencies, trial buffers and vendor lead times. Provide list, progress board, day/week scheduling and bottleneck views.
- **Expected user workflow:** Owner reviews a proposed date or queue change and its affected commitments.
- **Dependencies:** 2.3.1, 1.1.1, 1.6.2.
- **Acceptance criteria:** Missing estimates are disclosed. Active and waiting time differ. Queue movement never silently changes customer promises; authorised risky commitments retain reasons.
- **Deliverable:** Explainable team scheduling and capacity review.

#### Functionality — Approved labour obligations

##### Vertical Slice 2.3.3 — Calculate Labour Dues and Review Accepted Work

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** OPS-08, OPS-09, OPS-10, REP-02, REP-04. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Billing regimes and payment reconciliation

##### Vertical Slice 2.4.1 — Activate Reviewed Registered-Shop Billing

- **Scope:** P2 baseline; mandatory activation gate before any composition/regular-GST shop.
- **Traceability:** FIN-06, FIN-07, FIN-08, FIN-09, FIN-21, FIN-20. Scenarios: AC-44.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Onboard composition/regular-GST shops only with supported documents.
- **Functional requirements:** Add accountant-approved effective classifications, value-dependent rate rules, declarations, tax splits, place of supply, invoice/advance requirements and correction controls. Provide appropriate accountant/Tally-import and GSTR-1 preparation exports.
- **Expected user workflow:** Owner/accountant verifies the regime and sample documents before activation.
- **Dependencies:** 1.4.4, 1.10.3; approved accountant configuration.
- **Acceptance criteria:** Composition bills collect no customer tax; regular-GST documents use reviewed rules. No universal rate/threshold is assumed. E-invoice/e-way-bill restrictions are recorded; those outputs remain external.
- **Deliverable:** Approved registered-shop billing and financial export support.

##### Vertical Slice 2.4.2 — Assist UPI Collection and Statement Reconciliation

- **Scope:** P2 optional payment-aid variant of baseline reconciliation.
- **Traceability:** FIN-16. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Reduce manual matching while retaining human verification.
- **Functional requirements:** Offer amount/order-reference UPI QR and reviewed bank/UPI statement import. Match references/accounts, fees, pending/reversed events and settlement evidence.
- **Expected user workflow:** Owner requests payment, imports a statement and reviews proposed matches.
- **Dependencies:** 1.4.2, 1.9.2.
- **Acceptance criteria:** A QR does not prove payment. Repeated imports do not settle balances twice. Unmatched or ambiguous transactions require review; discrepancies preserve original documents.
- **Deliverable:** Optional payment aids and reviewed statement reconciliation.

#### Functionality — Business costs and contribution

##### Vertical Slice 2.4.3 — Record Overheads and Review Contribution

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** FIN-18, FIN-19, REP-03. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Exact-variant reservations and checkout

##### Vertical Slice 2.5.1 — Catalogue, Stock and Reserve Retail Variants

- **Scope:** P2 conditional baseline: enable only when retail is required.
- **Traceability:** RTL-01, RTL-02, RTL-04. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Sell or hold the exact available item.
- **Functional requirements:** Maintain style/size/colour/SKU/barcode, price/cost/supplier and active status. Track opening/received/reserved/saleable/damaged quantities and reservation expiry/deposit policy.
- **Expected user workflow:** Owner selects a variant, checks availability and reserves or releases it.
- **Dependencies:** 2.2.1–2.2.3, 1.4.2.
- **Acceptance criteria:** Overselling is prevented. Reservation is not sale or handover; cancellation settles deposits. Retail catalogue remains distinct from pattern libraries and mannequin history.
- **Deliverable:** Exact-variant retail inventory and reservation.

##### Vertical Slice 2.5.2 — Complete Mixed Checkout with Linked Alterations

- **Scope:** P2 conditional baseline: retail.
- **Traceability:** ORD-03, RTL-03, RTL-05. Scenarios: AC-25, AC-26.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Combine retail and services without conflating their fulfilment.
- **Functional requirements:** Add retail/custom/service lines to a booking with line-level discounts, treatment, costs and status. Link an alteration to its exact retail item, wearer, instructions, date, charge and worker.
- **Expected user workflow:** Owner sells the item, records payment and creates any alteration for the normal production/quality journey.
- **Dependencies:** 2.5.1, 1.2.2–1.2.3, 1.8.1–1.8.3.
- **Acceptance criteria:** Retail need not undergo custom production. Complimentary alteration preserves real cost. Stock, sale and alteration remain linked without duplicated revenue.
- **Deliverable:** Complete retail checkout and alteration fulfilment.

#### Functionality — Retail exceptions and outcomes

##### Vertical Slice 2.5.3 — Return, Exchange and Review Retail Outcomes

- **Scope:** P2 conditional baseline: retail.
- **Traceability:** RTL-06, RTL-07, RTL-08, REP-05. Scenarios: AC-25, AC-26.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.3.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Private customer views and decisions

##### Vertical Slice 2.6.1 — Open and Revoke a Private Booking View

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** COM-01, COM-02, TRU-09. Scenarios: AC-02, AC-54.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Provide useful customer visibility without exposing wider history.
- **Functional requirements:** Offer branded booking-scoped access with expiry/revocation, approved scope, dates, appointments, selected progress and bills/receipts. Apply wearer/guardian restrictions and owner-assisted contact re-verification.
- **Expected user workflow:** Contact opens the shared booking view; owner can revoke it.
- **Dependencies:** 1.4.3–1.4.4, 2.1.1; approved access/confirmation channel.
- **Acceptance criteria:** Expired/revoked links show no order data and offer shop contact. Ordinary links do not expose measurements/fitting photos, margins or unrelated bookings. Phone changes revoke old links.
- **Deliverable:** Secure customer booking visibility.

##### Vertical Slice 2.6.2 — Review Customer Decisions, Appointments and Issues

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** CUS-08, ENQ-06, ENQ-07, DES-07, COM-03, COM-11, REP-01, REP-06. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Turn customer responses into governed business actions.
- **Functional requirements:** Accept/reject specific revisions, acknowledge dates, request appointments/alterations and report issues with evidence. Add granular approvals, appointment conflict/reschedule/cancel/no-show handling, quote-expiry follow-up and owned complaint resolution.
- **Expected user workflow:** Customer submits a response/request; owner reviews and accepts the resulting action.
- **Dependencies:** 2.6.1, 1.4.3, 1.6.1–1.6.2, 1.8.1.
- **Acceptance criteria:** Requests cannot directly change authoritative work. Approvals refer to the exact revision and require step-up confirmation via the approved OTP channel, not just possession of an ordinary booking link. Closed/converted/opted-out enquiries stop irrelevant follow-up; appointment changes do not silently revise delivery. Internal issue notes are not shared externally or used to label customers unfairly.
- **Deliverable:** Customer decisions and resolved service issues.

#### Functionality — Controlled transactional reminders

##### Vertical Slice 2.6.3 — Configure Reminder Policies

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** COM-09. Scenarios: AC-36, AC-37.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Define permitted follow-up before automating it.
- **Functional requirements:** Configure timing, frequency, quiet hours, escalation, snooze, consent and stop conditions for trials, collections, balances and stored property.
- **Expected user workflow:** Owner previews reminder eligibility and approves the policy.
- **Dependencies:** 1.4.3, 1.8.3–1.8.5, 2.6.1.
- **Acceptance criteria:** Service and marketing permissions remain separate. Settlement/handover stops the relevant reminder while preserving other obligations. Disputed/uncertain cases return for review.
- **Deliverable:** Reviewed reminder policies.

##### Vertical Slice 2.6.4 — Send Official Messages with Safe Failure Handling

- **Scope:** P2 conditional baseline: approved provider/number/templates/budget.
- **Traceability:** COM-05, COM-10, TRU-11. Scenarios: AC-36, AC-37.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Automate only authorised, current transactional messages.
- **Functional requirements:** Activate supported official messaging after number/template/budget approval. Recheck status, consent, timing, duplication and costs; record delivery/failure and preserve manual fallback.
- **Expected user workflow:** Owner enables a permitted reminder; product sends only while its conditions remain true.
- **Dependencies:** 2.6.3; approved WhatsApp Business Platform decision and access.
- **Acceptance criteria:** Newly confirmed payment suppresses a stale balance reminder. Retries use a provider-effect ledger and provider IDs; ambiguous outcomes are reconciled, not blindly resent (a queue cannot guarantee exactly-once external delivery). Kill switch/restore epoch/practice suppression override queued work. Opt-out/failure/limit is visible; shop work continues and prepared content remains available.
- **Deliverable:** Controlled transactional messaging and cost/failure visibility.

### Phase 2.7 — Complete the Physical-Mannequin Showcase

**Objective:** Turn actual shop displays into permission-controlled customer discovery.  
**Functional scope:** Mannequin history, publishing, public browsing and linked enquiries.  
**Dependencies:** Privacy/media controls and enquiry capture; independent of Instagram integration.

#### Functionality — Physical mannequin history and public discovery

##### Vertical Slice 2.7.1 — Maintain Mannequins and Publish Costume History

- **Scope:** P2 baseline; may move to P1 as non-blocking Should with all privacy/publish safeguards.
- **Traceability:** SHO-01, SHO-02, SHO-04, SHO-06. Scenarios: AC-29, AC-39.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Preserve the shop’s changing physical displays.
- **Functional requirements:** Create any number of identified mannequins; record dated costume photos, fabric/description/notes and cover choice. Support draft/published/archived states, date corrections and withdrawal.
- **Expected user workflow:** Owner records a costume change, reviews rights and publishes selected assets.
- **Dependencies:** 1.1.3, 1.3.1; approved publication policy.
- **Acceptance criteria:** A fourth mannequin is supported. Changes retain chronology. Private fitting/reference media and minor images cannot appear through incidental upload or publication.
- **Deliverable:** Controlled physical-mannequin costume history.

##### Vertical Slice 2.7.2 — Browse the Public Showcase and Enquire

- **Scope:** P2 baseline; may move to P1 Should with 2.7.1 and enquiry prerequisites.
- **Traceability:** SHO-03, SHO-05. Scenarios: AC-29.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Expert formula governance and calculation output

##### Vertical Slice 2.8.1 — Review Formula Versions and Supported Ranges

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** PAT-02. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Establish expert authority for derived drafting values.
- **Functional requirements:** Record owner/independent reviewer, approved measurement forms, formula versions, allowable variation, fabric assumptions and validation evidence. Separate draft and approved status.
- **Expected user workflow:** Experts review a rule version and its explicitly supported inputs.
- **Dependencies:** 1.3.1–1.3.3; named second reviewer and validation decisions.
- **Acceptance criteria:** Author cannot be sole approver. Unreviewed rules cannot become approved production outputs; unsupported inputs are explicit.
- **Deliverable:** Expert-reviewed drafting-rule catalogue.

##### Vertical Slice 2.8.2 — Generate and Share a Drafting Calculation Sheet

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** PAT-06, PAT-07, PAT-16, PAT-17. Scenarios: AC-65, AC-66.
- **Technical prerequisites:** 0.2.3, 0.4.1, 0.4.4. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Assistance policy and measurable reviewed intake

##### Vertical Slice 2.9.1 — Enable, Evaluate and Disable Assistance

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** AI-10. Scenarios: AC-43, AC-45, AC-48.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Introduce AI under explicit product and data-use controls.
- **Functional requirements:** Explain externally processed content/terms; restrict to authorised minimal records; control capabilities/usage. Record proposals separately from confirmed facts, feedback, reversible undo and manual fallback. Customer content is not used for external-provider training by default; no cross-boutique learning is introduced.
- **Expected user workflow:** Owner reviews policy, trials a capability and accepts, rejects or disables it.
- **Dependencies:** 1.10.2, 2.1.3; approved error limits/evaluation sample.
- **Acceptance criteria:** Non-compliant processing remains disabled. Outage/limit preserves permitted manual work. Evaluation includes review time, critical errors, cost and eventual outcomes; uploaded instructions cannot authorise actions. No AI approval substitutes for validated arithmetic, payment verification or expert drafting approval.
- **Deliverable:** Governed AI enablement and outcome evaluation.

##### Vertical Slice 2.9.2 — Draft Intake and Ask Relevant Follow-Up Questions

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** AI-01, AI-02. Scenarios: AC-33, AC-34.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Reduce entry effort without guessing important facts.
- **Functional requirements:** Interpret supplied Tamil/English/mixed-language speech, text or notes into draft enquiries/orders. Link values to sources; highlight uncertainty and ask only unresolved checklist questions.
- **Expected user workflow:** Owner supplies content, reviews proposals and confirms the resulting draft.
- **Dependencies:** 2.9.1, 1.2.1, 1.6.1.
- **Acceptance criteria:** Uncertain names, numbers, units and dates remain unconfirmed. No measurements or rules are invented. Answered/not-required questions are skipped; repeated attempts create no duplicates.
- **Deliverable:** Reviewed assisted intake with complete manual alternatives.

#### Functionality — Quote, image and document proposals

##### Vertical Slice 2.9.3 — Review Quote Completeness Suggestions

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** AI-03. Scenarios: AC-33, AC-34.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Find genuine omissions before agreement.
- **Functional requirements:** Compare requested work/material source with quote inclusions and suggest missing/duplicate charges or unanswered pricing.
- **Expected user workflow:** Owner reviews source-linked suggestions and accepts/rejects each before a quote revision.
- **Dependencies:** 2.9.1, 1.4.1–1.4.3.
- **Acceptance criteria:** Bundled, complimentary and customer-supplied lines are respected. No charge changes automatically. False suggestions are recorded in evaluation.
- **Deliverable:** Human-reviewed scope/quote completeness assistance.

##### Vertical Slice 2.9.4 — Structure Supplied Design References

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** AI-07. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Speed up clarification of garment choices.
- **Functional requirements:** Suggest neckline/sleeve/embellishment tags and clarification questions from supplied images; retain source and uncertainty.
- **Expected user workflow:** Owner reviews proposed tags before updating the specification.
- **Dependencies:** 2.9.1, 1.3.1.
- **Acceptance criteria:** Images do not produce authoritative body dimensions, hidden construction or guaranteed fabric quantities. Accepted interpretation still follows normal approval.
- **Deliverable:** Reviewed design-reference structuring.

##### Vertical Slice 2.9.5 — Extract Reviewed Document Entries

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** AI-08. Scenarios: AC-45.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Reduce entry effort for bills, expenses and legacy work.
- **Functional requirements:** Present source beside proposed supplier-bill, expense and legacy-order fields; flag unreadable amounts/dates/references and potential duplicates.
- **Expected user workflow:** Owner corrects the draft and separately approves the business record.
- **Dependencies:** 2.9.1, 1.10.1. Supplier-bill extraction additionally needs 2.2.3; expense extraction additionally needs 2.4.3. Each variant may be enabled and verified independently against its manual workflow.
- **Acceptance criteria:** Financial/opening confirmation requires human review. Repeated extraction does not duplicate records. Instructions embedded in documents cannot change charges or reveal unrelated data.
- **Deliverable:** Source-linked reviewed document entry.

### Phase 2.10 — Review Acquisition and Marketing Using Manual Data

**Objective:** Connect marketing activity to verified boutique outcomes before integrations.  
**Functional scope:** Attribution policy, campaign inputs, outcomes, contribution and business actions.  
**Dependencies:** Source-linked enquiries, authoritative finance and cost records.

#### Functionality — Manual attribution and marketing review

##### Vertical Slice 2.10.1 — Define Attribution and Enter Campaign Evidence

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** REP-08, REP-09. Scenarios: AC-31, AC-32.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Make marketing assignment explicit rather than guessed.
- **Functional requirements:** Configure model/window, repeat enquiries and multi-touch treatment. Enter/import campaign dates, channel, spend and supported metrics with evidence, source definitions and unknown share.
- **Expected user workflow:** Owner approves the policy and reviews campaign/enquiry assignments.
- **Dependencies:** 1.6.3, 1.6.1; approved attribution/reporting basis.
- **Acceptance criteria:** Multiple touches do not duplicate full order revenue. Platform-reported conversions remain separate from verified orders. Manual data is labelled; unsupported placement splits remain unavailable.
- **Deliverable:** Reviewable attribution and manual advertising inputs.

##### Vertical Slice 2.10.2 — Review Campaign Outcomes and Create Business Actions

- **Scope:** P2 later baseline; activate only with its named business/release gates.
- **Traceability:** REP-10, REP-11, REP-12, REP-13, REP-14. Scenarios: AC-31, AC-32.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Paid-shop terms and exit

##### Vertical Slice 2.11.1 — Explain Plans, Usage and Paid Allowances

- **Scope:** P2 conditional baseline: only before paid external shops; founding boutique remains free.
- **Traceability:** BIZ-04. Scenarios: AC-43.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Prevent hidden limits and uncontrolled service costs.
- **Functional requirements:** Show selected plan, included users/features, AI/message/media allowances, usage and approved overage. Support internal cost-to-serve review; collect per-shop media, messaging, AI usage and support effort from the pilot onward, even before subscriptions are activated.
- **Expected user workflow:** External owner reviews the offer and approves the permitted paid usage.
- **Dependencies:** 2.1.4; approved prices, allowances and support model.
- **Acceptance criteria:** No unlimited-cost promise is assumed. Limits cannot weaken isolation, financial accuracy or historical records. Founding-shop free use is preserved.
- **Deliverable:** Clear conditional subscription administration.

##### Vertical Slice 2.11.2 — Renew, Cancel and Export on Exit

- **Scope:** P2 conditional baseline: paid-shop expiry/exit.
- **Traceability:** BIZ-05. Scenarios: AC-43.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Approved allowances and computed geometry

##### Vertical Slice 3.1.1 — Create and Apply Seam-Allowance Presets

- **Scope:** P3 later baseline; expert/data/evaluation gates apply.
- **Traceability:** PAT-04, PAT-05. Scenarios: AC-06.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Apply approved allowances appropriate to the garment.
- **Functional requirements:** Configure category/subcategory-specific seam positions, units and values. Create/use presets, preview mapping and permit order-only overrides without changing reusable versions.
- **Expected user workflow:** Owner selects the applicable preset or creates a reviewed version.
- **Dependencies:** 2.8.1, 1.3.1–1.3.2.
- **Acceptance criteria:** No universal or unapproved seam values are inserted. Preset changes preserve historical outputs; overrides remain order-specific.
- **Deliverable:** Versioned approved allowance selection.

##### Vertical Slice 3.1.2 — Generate and Compare Supported 2D Previews

- **Scope:** P3 later baseline; expert/data/evaluation gates apply.
- **Traceability:** PAT-06, PAT-07, PAT-08, PAT-09, PAT-15. Scenarios: AC-06, AC-09, AC-10.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Make the computed pattern understandable before release.
- **Functional requirements:** Generate approved-scope pieces with names, dimensions, cutting/stitching lines, allowances and expert-defined grain/fold/count/orientation markings. Show inputs, formulas, derived values, warnings and regenerated versions.
- **Expected user workflow:** Owner selects supported current inputs, reviews the preview and compares versions.
- **Dependencies:** 3.1.1, 2.8.1–2.8.2.
- **Acceptance criteria:** Unsupported combinations are blocked. Exploratory output is not cutting approval. Input changes flag unused outputs stale; previously cut output remains recorded. Provenance identifies exact source versions.
- **Deliverable:** Versioned supported pattern previews and calculation summaries.

#### Functionality — Fabric estimation and validated print release

##### Vertical Slice 3.1.3 — Produce a Validated-Scope Fabric Estimate

- **Scope:** P3 later baseline; expert/data/evaluation gates apply.
- **Traceability:** PAT-10. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Help review material sufficiency without inventing placement accuracy.
- **Functional requirements:** Estimate using approved width, direction/nap, repeat, shrinkage and placement considerations only where supported. Expose assumptions and physical-confirmation needs.
- **Expected user workflow:** Owner reviews the estimate against actual available fabric and conditions.
- **Dependencies:** 3.1.2, 1.5.1–1.5.2; validated estimation rules.
- **Acceptance criteria:** Unsupported considerations remain labelled. Unknown width cannot silently become a standard width. An estimate does not authorise insufficient fabric or imply advanced nesting.
- **Deliverable:** Traceable fabric estimates with explicit limits.

##### Vertical Slice 3.1.4 — Export and Check True-Scale Pattern PDFs

- **Scope:** P3 later baseline; expert/data/evaluation gates apply.
- **Traceability:** PAT-11, PAT-12, PAT-17. Scenarios: AC-09, AC-10, AC-64.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Make supported patterns usable on ordinary printers.
- **Functional requirements:** Preview paper/tiles/page count; export 1:1 A4-default/A3 PDFs with tile labels, alignment/overlap/trim instructions, assembly order, calibration ruler/square and version. Include prominent Actual Size/100% instructions.
- **Expected user workflow:** Owner exports/shares, prints and measures calibration before use.
- **Dependencies:** 3.1.2; approved paper/printer assumptions.
- **Acceptance criteria:** A4 use needs no A3 printer. Third-party printing retains calibration instructions. Failed calibration blocks cutting use; PDF availability supports shops with no printer.
- **Deliverable:** Calibratable true-scale pattern printing and sharing.

##### Vertical Slice 3.1.5 — Validate Supported Scope and Release Cutting Work

- **Scope:** P3 later baseline; expert/data/evaluation gates apply.
- **Traceability:** PAT-07, PAT-13, PAT-14. Scenarios: AC-09, AC-10, AC-64.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Require evidence before production claims.
- **Functional requirements:** Maintain a matrix of garment type, measurement range, fabric class, design combination, physical garments tested and review results. Record print checks and approved release; share piece checklists and expert cutting/assembly notes.
- **Expected user workflow:** Reviewers validate the supported combination; owner releases a current output only after task readiness.
- **Dependencies:** 3.1.2–3.1.4, 1.7.1; both reviewers’ approval.
- **Acceptance criteria:** Reviewer-confirmed tolerances govern calibration/alignment/dimensions. Proposed starting tolerances are ±1 mm/10 cm, ±2 mm tile alignment and ±3 mm key dimensions until confirmed. Architecture §9.4 also requires programmatic PDF boxes/geometry and Actual-Size physical prints on at least three printers. Release also requires current approvals/materials/assignee. Updates never silently replace already-used cutting output.
- **Deliverable:** Physically validated pattern scope and governed production handoff.

### Phase 3.2 — Connect Read-Only Social and Advertising Data

**Objective:** Add supported external visibility without compromising manual operation.  
**Functional scope:** Conditional Instagram viewer and Google/Meta advertising inputs.  
**Dependencies:** Demonstrated owner value, approved account access and connection policies. Neither integration blocks operations or the mannequin gallery.

#### Functionality — Read-only platform connections

##### Vertical Slice 3.2.1 — Connect and Refresh the Instagram Viewer

- **Scope:** P3/post-pilot conditional baseline: owner value and approved account access.
- **Traceability:** SHO-07, SHO-08, SHO-09, SHO-10, TRU-11. Scenarios: AC-30.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Show supported existing posts with honest freshness.
- **Functional requirements:** Provide authorised connect/reconnect/revoke/disconnect, supported-account prerequisites, available media/captions/dates/open-post actions and refresh/retry status. Keep social posts distinct from mannequins, private references and retail.
- **Expected user workflow:** Owner connects the account and refreshes the read-only feed.
- **Dependencies:** 2.1.3; owner-value/access approval.
- **Acceptance criteria:** Failed refresh retains last successful content and its age. No password sharing, publishing/scheduling or guaranteed unsupported access is introduced. Linking does not automatically create another content type.
- **Deliverable:** Conditional read-only Instagram viewer.

##### Vertical Slice 3.2.2 — Synchronise Supported Advertising Inputs

- **Scope:** P3/post-pilot conditional baseline: owner value and approved account access.
- **Traceability:** REP-08, REP-10, REP-11, REP-12, REP-13, REP-14, TRU-11. Scenarios: AC-30, AC-46.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

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

#### Functionality — Contextual fit, delivery risk and operational assistance

##### Vertical Slice 3.3.1 — Recall Contextual Fit for Repeat Work

- **Scope:** P3 later baseline; expert/data/evaluation gates apply.
- **Traceability:** MEA-10, AI-05. Scenarios: AC-35.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Reuse successful fit knowledge selectively.
- **Functional requirements:** Retrieve suitable prior accepted garments for the authorised wearer; show corrections, source, fabric and construction. Provide manual contextual retrieval plus reviewed AI questions/reuse proposals.
- **Expected user workflow:** Owner compares previous garments and explicitly applies relevant choices to a new order.
- **Dependencies:** 1.8.1, 1.2.4, 2.9.1.
- **Acceptance criteria:** Fabric-specific corrections do not alter every body measurement or unrelated garment. Wrong-context suggestions can be rejected and evaluated; no guaranteed fit is claimed.
- **Deliverable:** Reviewed contextual fit reuse and source-linked assistance.

##### Vertical Slice 3.3.2 — Explain Delivery Risk and Propose Actions

- **Scope:** P3 later baseline; expert/data/evaluation gates apply.
- **Traceability:** AI-04. Scenarios: Requirement-derived checks; apply §33.1.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Turn known blockers into useful intervention.
- **Functional requirements:** Explain risk from missing materials, blocked tasks, vendor dates, trials and capacity; identify affected work and propose actions. Begin with transparent rules; activate predictive estimates only after data/evaluation gates.
- **Expected user workflow:** Owner reviews evidence and accepts a follow-up or coordination action.
- **Dependencies:** 2.3.2, 1.9.2–1.9.3, 2.9.1.
- **Acceptance criteria:** Missing data and uncertainty are explicit. Dates, assignment and promises never change silently. False alarms and actual original-promise outcomes are evaluated.
- **Deliverable:** Explainable, evaluated delivery-risk assistance.

##### Vertical Slice 3.3.3 — Answer Operational Questions and Draft Next Reminders

- **Scope:** P3 later baseline; expert/data/evaluation gates apply.
- **Traceability:** AI-06, AI-09. Scenarios: AC-36, AC-37.
- **Technical prerequisites:** 0.2.3, 0.4.1. Architecture constraints in §9 apply in addition to business dependencies.

- **Purpose:** Reduce time between finding a problem and taking the right action.
- **Functional requirements:** Answer permitted operational questions from source records with known/unknown distinctions. Draft collection/payment messages using current balance, handover and consent; link proposals to actual actions and outcomes.
- **Expected user workflow:** Owner asks a question, opens evidence and reviews a suggested action/message.
- **Dependencies:** 1.9.1–1.9.4, 2.9.1; 2.6.3–2.6.4 only for automated sending.
- **Acceptance criteria:** No invented profit, cause or deadline. Current state is rechecked before action. Disputed/unusual reminders require owner review; manual sending remains available and the ordinary workspace remains usable.
- **Deliverable:** Source-linked operational answers and reviewed follow-through.

---

## 5. Consolidated Implementation Order and Dependencies

Phase order is the default review sequence, not a requirement to finish unrelated functionality first. Slice dependencies and the technical prerequisite fields define implementation order. Later enhancements referenced inside a slice are integration points, not prerequisites for base delivery. Registered billing, external login, extraction variants and automatic sending have conditional activation gates. Base workflows must be demonstrable against synthetic records without pretending a future integration is already available.

Foundation order: 0.1.1 → 0.1.2 → 0.2.1 → 0.2.2 → 0.2.3. From there money (0.3.1), jobs (0.3.2) and shell (0.4.1) are separate paths. Drafts need shell/commands; media needs jobs/tenancy; PDFs need jobs/media/fonts. Operations restore follows those paths, then privacy recovery. Business configuration/identity can start after their named foundations; references wait for media, payments for money, documents for PDFs. Baseline measurement starts alongside development, not after the product has been used.

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
| Gate | Founding pilot | Complete the 2–4 week pre-use baseline, then 3-month pilot; validate thresholds, discovery interviews and sustainable support before expansion. |
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
| **OPS — 11** | 01, 04 → minimal artisan profiles **1.7.3**, team extension **2.1.1**; 02–03 → **2.3.1**; 05–07 → **2.3.2**; 08–10 → **2.3.3**; 11 → **1.7.3–1.7.4**. |
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
| AC-38 | **0.2.2** and every added repository/path prove two-synthetic-shop isolation before pilot; **2.1.3** repeats the complete access matrix before second-shop use; repeat against **2.6** and **2.9/3.3**. |
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
| AC-65 | **2.8.2** — unvalidated drafting label. |
| AC-66 | **1.7.3–1.7.4** — agreed charge/advance and outstanding due visible at dispatch; accepted returns activate payable settlement. |

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
| Implementation | The 85 business slices and 13 verified foundation increments deliver bounded outcomes. Dependencies progress from identity/agreement/materials to work, acceptance and settlement. |
| Quality | Slice acceptance covers normal operation and material exceptions. All 66 source scenarios have delivery ownership and release applicability. |
| Completeness | All 241 numbered requirements are accounted for. Non-numbered lifecycle, pilot, safety and readiness obligations are also mapped. |
| Scope discipline | Prescribed architecture is assigned to prerequisite and feature slices; no new technology decisions or estimates are invented. Optional extensions remain explicit. |

### 8.4 Completion standard for subsequent specifications

Each future phase specification should retain these slice identifiers and provide the finer interaction detail needed for implementation. Each slice is accepted only when:

1. Its normal workflow and relevant exceptions are functionally demonstrated.
2. Its permissions, history and money/property consequences are correct.
3. Its applicable source acceptance scenarios pass.
4. Missing information and failed operations remain visible and recoverable.
5. Its required business configuration and activation evidence are approved.
6. Its output integrates with the existing operating journey without duplicate entry or misleading status.

Complete-scope coverage does not imply every conditional module is enabled in every boutique. A capability remains explicitly gated until its prerequisites are satisfied; the manual core remains useful throughout.


## 9. Architecture Ownership, Technical Gates and Final Review

The architecture remains the technical source; this table assigns implementation and verification responsibility without reproducing its specifications. All referenced requirements/scenarios retain the product plan's release qualifications.

| Architecture source | Mandatory delivery and verification owner |
|---|---|
| §§1–3: monolith, budget, recorded decisions/drivers | 0.1.1 establishes the two entry points/one database; 0.5.1 and 1.10.4 measure cost/latency/recovery. Core operations need no optional modules. |
| §§4–5.1: exact stack, Node/TS/pnpm, PostgreSQL, Drizzle, API, auth/storage | 0.1.1 compatibility/pinning; 0.2.1–0.2.3 implement the prescribed request/auth/data paths; 0.3.2 and 0.4.3 implement queue/storage. Verify migrations and runtime role on the chosen PostgreSQL 18/17 image. |
| §§5.2, 7.1: Base UI/Tailwind/Query/Table/forms/nuqs/next-intl | 0.4.1–0.4.2 and each UI slice. Base UI only, no vaul/Radix; CSS source discovery includes workspace packages; accessible card/table/dialog adaptations and IME-safe forms. Virtual only after measurement. |
| §5.3: quantities/IDs/time/import/PDF/env/logging/tests/update policy | 0.1.1 establishes tools; 0.3.1 exact arithmetic; 0.3.2 local-date jobs; 0.4.1 IDs/time/search/logging; 0.4.3–0.4.4 sharp/fonts/Chromium/PDF merge; 1.10.1/1.10.3 Papa Parse. Env validation forbids server secrets in NEXT_PUBLIC variables. Vitest/fast-check, Testcontainers, Playwright/axe and MSW support real tests rather than unused installations. |
| §§6.1–6.3: package boundaries/modules | 0.1.1 restricted imports; every slice adds its own module folder. Cross-module orchestration calls core interfaces, not another module's private tables. No empty forest of packages or alternate generic framework. |
| §6.4: typed Hono/OpenAPI/current-transaction path | 0.2.3 plus every business command; generate OpenAPI in dev/CI only, per-module clients with compiled declarations. No business Server Actions, nested independent repository transactions or Next imports inside api/core. |
| §6.5: setup/guided onboarding/practice/support | 0.2.1 owner bootstrap; 1.1.1–1.1.2 record configuration gates; 1.10.3 contextual support; 1.10.4 guided sample journey. Practice uses isolated is_practice shop, watermark and permanently disabled effects. Full resettable practice UX remains product BIZ-01 P1 Should and completes in 2.1.4 if deferred. |
| §§7.2–7.3: PWA/drafts/retries/conflicts | 0.4.1/0.4.2, 1.2.1 and every editable screen. Offline fallback only; no business persistence/cache. Stable draft ID/resume list, 30-day stale flags/notice-period retention and current-state promotion; superseded draft conflicts are visible. |
| §8.1: types/FKs/migrations | 0.2.2/0.3.1 plus each table. Raw measurement text/entered units and value kept distinct; business date vs UTC timestamp. SQL review, extensions/grants/triggers and advisory lock; expand/migrate/contract. No production drizzle-kit push or automatic destructive rollback. |
| §8.2: FORCE RLS/membership/role exceptions | 0.2.2, repeated for all repositories and every indirect path. app_backup read-only BYPASSRLS credentials are limited to backup; app_privacy only audited functions; runtime app_user has neither privilege. Two synthetic shops before pilot, complete role matrix before shared access. |
| §8.3: immutable history/privacy exception/separate lifecycles | 0.2.3/0.5.2 and all consequential slices; 1.3.2 versions, 1.4 issued artifacts/events, 1.5 stock/custody, 1.8 lifecycle. Tests reject ordinary history mutation while permitting scoped privacy redaction/tombstones. |
| §8.4: posting journal/FIN-05/money references/document issue | 0.3.1; 1.4.2/1.4.4/1.4.5, 1.5.3–1.5.4, 1.7.4 and 1.9.2/1.9.4. Accountant approval before go-live; sums/postings/reversals/source locks/numbers/paise/safe wire bounds proven. Source payment reference constraints outlive the 30-day request-key retention. |
| §8.5: If-Match/idempotency/external effect ledger | 0.2.3, 0.4.2 and every mutation; actor/action/request-hash binding, 30-day keys and durable business uniqueness. 2.6.4 adds provider IDs/effect ledger and ambiguous-send reconciliation. |
| §8.6: SQL reports/product_event/named metrics | 0.4.1 initial pilot/cost/support instrumentation; 1.9.3–1.9.4/2.10 report definitions/date basis/denominator/N/A/drill-down. Materialised views only after a slow-query measurement; no warehouse. |
| §8.7: imports/exports/notebook photos | 1.10.1 versioned templates, file/row hashes, cut-off preview and opening approval; 1.10.3 ZIP entity CSV + JSON history + PDFs/permitted media + Tamil/English README. Escape formula cells, recent re-authentication, private job results, audited links expiring after seven days; notebook values stay unconfirmed. |
| §§9.1–9.2: Tamil/Tanglish search/vocabulary | 0.4.1 key functions/glossary; 1.9.1 shop-led trigram/phone_last4/last6 queries and ranking; 1.10.4 verifies approximately 200 consented/anonymised cases with at least 95% top-five recall. Names/notes are never auto-translated or merged. Document language follows customer preference. |
| §9.3: issued PDFs/Tamil/WhatsApp | 0.4.4, 1.3.4 and each document-producing slice; approximately 50-string reviewed golden set, fonts loaded before render, Chromium non-root/network restrictions/concurrency one/idle shutdown. Android file share then text second tap, desktop manual attach, prepared/marked-sent history. Printable blank outage slips prepared before pilot. |
| §9.4: pattern geometry/vector PDF/physical print gates | 3.1.2–3.1.5; pure millimetre geometry drives SVG/PDF, A4/A3 tile planning and 100mm square, page boxes and 1mm=72/25.4pt scale checked; at least three Actual-Size printers and reviewer tolerances. Library choice is deferred until P3. |
| §10.1: uploads/publication/immutable storage | 0.4.3, 1.1.3 and 2.7; pending upload/complete/process/quarantine, 5-minute signed links, checksum derivatives and deletion lifecycle. Explicit published copy and /g/img authorisation serve only published images from private buckets; unpublish removes it. Public R2 only on traffic trigger. |
| §10.2: jobs/schedules/worker topology | 0.3.2; per-shop daily alerts at 06:00 Asia/Kolkata, live local-date due panel, nightly retention, singleton PDFs (three retries), per-shop serial chunked imports/exports, dead-letter digest/queue-age monitoring. Scratch backup verification is part of backup cron, not pg-boss. |
| §10.3: integrations/restricted phases | 0.2.1 auth-only Resend with SPF/DKIM/DMARC; 1.4.3 manual sharing; 2.6.4 WhatsApp/selected OTP; 2.9 AI; 3.2 post-pilot social/ads. No WhatsApp API or AI SDK in P1. |
| §§11.1–11.2: auth/session/access | 0.2.1–0.2.2; verified allow-list and explicit Google linking, no implicit signup, exact origins, secure sessions and re-authentication. 2.1 adds fixed role/toggles/invites/revocation/ownership verification, never an organization plugin. Critical auth/framework advisories patched within 48h. |
| §11.3: customer private tokens/step-up | 2.6.1–2.6.2: 256-bit opaque tokens stored hashed, scope/revision/action/expiry/revocation/max-use checks every request, exchange URL token for narrow cookie, no-store/no-referrer/no third-party scripts. Ordinary links exclude fit assets; approval uses approved OTP; phone change revokes links. |
| §11.4: security baseline | 0.1.1/0.2.1/0.4.3/0.5.1: CSP/HSTS/frame/referrer/camera policy, origin defence, upload validation, onlyBuiltDependencies/audit/Action SHA pins, separate sealed environment secrets and scrubbed logs/Sentry. Production diagnostics are read-only, exceptional access time-limited/approved/audited. |
| §11.5: privacy/children/processors | 0.5.2 and 1.1.3/1.10.2; guardian/payer distinction, under-18 flag only, no minor publication/tracking/marketing, notices and consent purposes/withdrawal, rights/grievances/breach procedure. Approved processor locations and retention include backups/exports and monthly off-platform B2 erased-media purge. |
| §§12.1–12.3: infrastructure/environments/domain | 0.5.1; config-as-code, standalone web, production worker, dev in-process jobs, small pools/memory caps, Singapore separate synthetic dev/prod, same tested build/commit promoted manually with Wait for CI. No permanent staging. Fix domain before live OAuth; measure Tamil Nadu mobile latency in week one and record p95 trigger around 300ms. |
| §§12.4–12.5: delivery/monitoring | 0.1.2/0.5.1 and each PR; backup before schema/money migration, compatible rollback, scrubbed source maps/errors, uptime/backup heartbeat/WAL lag/disk/sign-in/PDF/oldest-job/spend monitoring and failed-job email digest. Weekly dependency batches and deliberate major-upgrade tasks. |
| §13: recovery layers/drill/continuity | 0.5.1–0.5.2 and 1.10.4; PITR/volume schedule plus 12h verified encrypted dumps and nightly media/manifest copy, B2 daily/monthly lifecycle, off-platform key custody and break-glass runbook. Target restore four hours within product one business day/RPO at most 24h; quarterly and major-change drills. Live drills only temporary locked-down prod service, removed afterwards; never dev. Money/window reconciliation and tombstone/revocation reapplication precede unfreezing; operator kill switch removed last. |
| §14: budget/cost controls | 0.5.1/1.10.4; whole workspace Hobby for synthetic development/Pro before real data, seven-day measured cost within under-$20 development/about-$50 pilot ceilings. Alerts/review/owner-approved hard limit, stop dev/optional work first; warn that hard limit stops all services. Backups cannot fail silently; paid Railway agent usage off unless approved. |
| §15: evidence-based testing/go-live | Every slice plus 1.10.4; property tests for money/state/search, real PostgreSQL RLS/queue/rollback/conflicts, E2E every P1 workflow phone 360x800/tablet orientations/desktop, Tamil golden PDFs/search recall/axe/manual screen reader. Real 3–4GB Android, camera/IME/share/PWA and measured first-use <3s/warm <1s/PDF <10s targets. Targets are measured, not assumed guarantees. |
| §§16–18: phased additions/triggers/open items | 2.1/2.4/2.5/2.6/2.8/2.9 and 3.1/3.2 retain source boundaries. Production domain, operator, accountant numbering/retention, devices, PITR availability and privacy advice are activation inputs in 0.5.1/1.10.4. Optional API extraction/PDF service/offline/HA depend on evidence and a revised decision. |

### 9.1 Mandatory scope versus optional enhancements

- **Pilot blockers:** Wave 0 safeguards needed by P1, all 148 P1 Must requirement IDs (including their scoped minimums), the product §30.1 scenario applicability, approved §32.2 decisions and architecture §15.2. All future feature additions carry their correctness and security prerequisites.
- **P1 Should:** CUS-08; ENQ-06/07; QR part of ORD-10; DES-07; MAT-06/07/08/11; PUR-03 minimal purchase capture; MEA-10 manual retrieval; OPS-02; FIN-18/19; COM-10 manual fallback; DAY-05; SHO-01–06; REP-03/05/08 manual spend; TRU-09/11; practice UX part of BIZ-01. Minimum stock/unit/cost/identity/recovery protections required by Must are already included; optional deepening does not delay pilot. Product §§29.1 and 30.1 remain authoritative if counting mixed qualifiers.
- **Conditional full-product baseline:** Registered tax regimes, retail, shared/customer access, messaging, drafting/patterns, AI, social/ads and paid-shop administration. They are neither pilot dependencies nor discarded optional extensions. Their activation decisions and later acceptance scenarios remain assigned.
- **Separate optional changes:** Product §31.2 and architecture triggers only. No offline capture, 3D, plotting, broader unsupported formulas/languages, nesting, e-commerce/multi-branch/social posting, Redis or extra permanent services in this proposal.

### 9.2 Final review findings and corrections

| Check | Result / residual dependency |
|---|---|
| Committed functional coverage | Explicit register assigns all 241 requirements. P1 Must IDs resolve to Wave 1 minimum owners; partial regimes, worker scope, QR/practice and reporting depth are qualified. No Must relies on retail, AI, customer login or patterns. |
| Scenarios | All AC-01–66 have owners in §6.2 and slice traceability. Multi-part AC-06/64 retain phase-specific checks. AC-38 is tested early with synthetic shops and again before external use. Gallery AC-29/39 applies if moved into P1. |
| Sequencing | Auth/tenancy/command safeguards precede records; money/jobs/media/PDFs precede dependent actions. Production follows accepted current inputs/custody; readiness follows trials/quality, handover follows readiness and reviewed settlement. Restore preparation is early, completed-workflow rehearsal precedes live use. |
| Integrity/security | Source locks, exact paise remainder, journal conservation, no double purchase/consumption cost, immutable issued versions, concurrency/retry tests, guardian rights, privacy erasure exception, restoration tombstones/revocations and money freeze have explicit owners. No database queue claim of exactly-once provider delivery. |
| Early observability | Cost-to-serve, support effort and pilot product events begin in 0.4.1; first real use waits for baseline. Dashboards/subscriptions do not delay capture. |
| Avoidable complexity | Preserve 85 domain IDs, add only 13 operational prerequisites. Minimal packages/managed topology, no warehouse/Redis/event sourcing/native app. Extract APIs, virtualise or add public R2 only on measured triggers. |
| Unnecessary dependencies | Internal staff assignment does not require external-worker login. Each document-extraction variant depends only on its manual workflow. Drafting/gallery/manual marketing do not wait for AI, retail or social connection. Staff and second-shop activation still wait for the product pilot checkpoint. |
| Open activation values | No invented tax rules, rates, tolerances, privacy commencement or subscription quotas. Owner/accountant/privacy/second-reviewer decisions in §§32 and architecture §18 block only the relevant actions and all required live-readiness gates. |

**Review evidence:** This is a static source/coverage/dependency review. Application tests, cloud security configuration, live restore and device performance have not been executed because implementation has not begun. Future ticket creation must preserve these IDs, narrow each phase into implementation detail and carry the stated checks; this document does not create issues.

## 10. Explicit Requirement and Phase 1 Scope Register

This register is derived from all numbered source requirements and §29.1. **Later baseline** is committed full-product scope with provisional timing, not permission to delete it. P1 Must with a qualifier requires its specified minimum; extensions wait for the stated gate. P1 Should never blocks go-live unless its minimum is necessary for a Must. Multiple owners represent minimum-to-full delivery and integration, not repeated transactions. See §6.2 for all 66 scenario owners and §9 for technology ownership.

| Requirement | Source functionality | Release commitment | Responsible business slices |
|---|---|---|---|
| SET-01 | Business profile | P1 Must | 1.1.1 |
| SET-02 | Working calendar | P1 Must | 1.1.1 |
| SET-03 | Service catalogue | P1 Must | 1.1.2 |
| SET-04 | Operating templates | P1 Must | 1.1.2 |
| SET-05 | Commercial policies | P1 Must | 1.1.1 |
| SET-06 | Alerts and priority | P1 Must | 1.1.1 |
| SET-07 | People and services | P1 Must: payment methods/vendors; staff P2 | 1.1.1, 2.1.1 |
| SET-08 | Versioned configuration | P1 Must | 1.1.1 |
| SET-09 | Optional module activation | P1 Must | 1.1.1 |
| SET-10 | Simple mode (solo owner) | P1 Must | 1.1.2 |
| SET-11 | Capacity guard and rush rule | P1 Must | 1.1.1 |
| SET-12 | Uncollected garments and stored property | P1 Must | 1.8.5 |
| CUS-01 | Customer records | P1 Must | 1.1.3 |
| CUS-02 | Wearer identity | P1 Must | 1.1.3 |
| CUS-03 | Unified history | P1 Must | 1.2.4 |
| CUS-04 | Preferences | P1 Must | 1.1.3 |
| CUS-05 | Search and duplicate review | P1 Must | 1.2.4 |
| CUS-06 | Corrective edits | P1 Must | 1.2.4 |
| CUS-07 | Relationship permissions | P1 Must | 1.1.3 |
| CUS-08 | Service issues | P1 Should | 2.6.2 |
| CUS-09 | Data lifecycle | P1 Must | 1.10.2 |
| ENQ-01 | Enquiry capture | P1 Must | 1.6.1 |
| ENQ-02 | Minimal entry | P1 Must | 1.6.1 |
| ENQ-03 | Follow-up lifecycle | P1 Must | 1.6.1 |
| ENQ-04 | Conversion | P1 Must | 1.6.1 |
| ENQ-05 | Appointments | P1 Must | 1.6.2 |
| ENQ-06 | Changes and conflicts | P1 Should | 2.6.2 |
| ENQ-07 | Quote follow-up | P1 Should | 2.6.2 |
| ENQ-08 | Attribution evidence | P1 Must | 1.6.3 |
| ORD-01 | Booking and order identifiers | P1 Must | 1.2.1, 1.7.2, 1.8.4 |
| ORD-02 | Independent garment records | P1 Must | 1.2.2, 1.8.3 |
| ORD-03 | Mixed bookings | P1 Must | 1.2.2, 2.5.2 |
| ORD-04 | Intake fields | P1 Must | 1.2.1, 1.7.2, 1.8.4 |
| ORD-05 | Requirement checklist | P1 Must | 1.2.1, 1.7.2, 1.8.4 |
| ORD-06 | Explicit requirement states | P1 Must | 1.2.1, 1.7.2, 1.8.4 |
| ORD-07 | Reference assets | P1 Must | 1.3.1 |
| ORD-08 | Fast and repeat intake | P1 Must | 1.2.4 |
| ORD-09 | Customer-facing summary | P1 Must | 1.4.3 |
| ORD-10 | Physical identification | P1 Must: PDF slips/labels; QR Should | 1.3.4, 2.3.1 |
| ORD-11 | Ownership and exceptions | P1 Must | 1.2.1, 1.7.2, 1.8.4 |
| ORD-12 | History | P1 Must | 1.2.4 |
| ORD-13 | Outfit pieces | P1 Must | 1.2.2, 1.8.3 |
| ORD-14 | Add-on services and packages | P1 Must | 1.2.3, 1.2.2 |
| DES-01 | Category and type library | P1 Must | 1.3.1 |
| DES-02 | Type versus decoration | P1 Must | 1.3.1 |
| DES-03 | Availability control | P1 Must | 1.3.1 |
| DES-04 | Design specification | P1 Must | 1.3.1 |
| DES-05 | Versioned references | P1 Must | 1.3.1 |
| DES-06 | Customer approval | P1 Must | 1.4.3 |
| DES-07 | Partial approvals | P1 Should | 2.6.2 |
| DES-08 | Change requests | P1 Must | 1.4.3 |
| DES-09 | Revised agreements | P1 Must | 1.4.3 |
| DES-10 | Reuse and rights | P1 Must | 1.3.1 |
| DES-11 | Change-impact rules | P1 Must | 1.4.3 |
| MAT-01 | Three-way distinction | P1 Must | 1.5.1 |
| MAT-02 | Customer property receipt | P1 Must | 1.5.1 |
| MAT-03 | Storage and movement | P1 Must | 1.5.2 |
| MAT-04 | Requirement versus receipt | P1 Must | 1.5.1 |
| MAT-05 | Order allocation | P1 Must | 1.5.3 |
| MAT-06 | Inventory units | P1 Should | 2.2.1, 1.5.3, 1.10.1 |
| MAT-07 | Variants and quality | P1 Should | 2.2.1, 1.5.3, 1.10.1 |
| MAT-08 | Shortage and substitution | P1 Should | 2.2.2 |
| MAT-09 | External dispatch | P1 Must | 1.7.3, 1.7.4 |
| MAT-10 | Returns and remnants | P1 Must | 1.5.5 |
| MAT-11 | Stock corrections | P1 Should | 2.2.1, 1.5.3, 1.10.1 |
| MAT-12 | Incident handling | P1 Must | 1.5.5 |
| MAT-13 | Shared customer fabric | P1 Must | 1.5.2 |
| PUR-01 | Supplier records | Later baseline / gated | 2.2.2 |
| PUR-02 | Purchase requests | Later baseline / gated | 2.2.2 |
| PUR-03 | Purchase records | P1 Should | 1.5.4, 2.2.2 |
| PUR-04 | Partial receipts | Later baseline / gated | 2.2.3 |
| PUR-05 | Bills and payables | Later baseline / gated | 2.2.3 |
| PUR-06 | Returns and credits | Later baseline / gated | 2.2.4 |
| PUR-07 | Replenishment visibility | Later baseline / gated | 2.2.4 |
| MEA-01 | Garment-specific forms | P1 Must | 1.3.2 |
| MEA-02 | Units and entry | P1 Must | 1.3.2 |
| MEA-03 | Source and method | P1 Must | 1.3.2 |
| MEA-04 | Version history | P1 Must | 1.3.2 |
| MEA-05 | Base versus derived values | P1 Must | 1.3.2 |
| MEA-06 | Validation | P1 Must | 1.3.2 |
| MEA-07 | Reuse confirmation | P1 Must | 1.3.2 |
| MEA-08 | Trial record | P1 Must | 1.8.1 |
| MEA-09 | Verified fit outcome | P1 Must | 1.8.1 |
| MEA-10 | Contextual fit reuse | P1 Should | 3.3.1, 1.2.4 |
| MEA-11 | Private fit assets | P1 Must | 1.3.2 |
| PAT-01 | Supported-pattern catalogue | P1 Must | 1.3.3 |
| PAT-02 | Expert-approved rules | Later baseline / gated | 2.8.1 |
| PAT-03 | Manual/external patterns | P1 Must | 1.3.3 |
| PAT-04 | Seam allowances | Later baseline / gated | 3.1.1 |
| PAT-05 | Allowance presets | Later baseline / gated | 3.1.1 |
| PAT-06 | Complete provenance | Later baseline / gated | 2.8.2, 3.1.2 |
| PAT-07 | Input and release checks | Later baseline / gated | 2.8.2, 3.1.2, 3.1.5 |
| PAT-08 | 2D visual preview | Later baseline / gated | 3.1.2 |
| PAT-09 | Calculation summary | Later baseline / gated | 3.1.2 |
| PAT-10 | Fabric estimate | Later baseline / gated | 3.1.3 |
| PAT-11 | True-scale export | Later baseline / gated | 3.1.4 |
| PAT-12 | Print preview and instructions | Later baseline / gated | 3.1.4 |
| PAT-13 | Physical verification | Later baseline / gated | 3.1.5 |
| PAT-14 | Production handoff | Later baseline / gated | 3.1.5 |
| PAT-15 | Invalidated output | Later baseline / gated | 3.1.2 |
| PAT-16 | Drafting calculation sheet | Later baseline / gated | 2.8.2 |
| PAT-17 | Output delivery without a printer | Later baseline / gated | 2.8.2, 3.1.4 |
| JOB-01 | Simple milestones, detailed tasks | P1 Must | 1.7.1 |
| JOB-02 | Garment-specific sequence | P1 Must | 1.7.1 |
| JOB-03 | Explicit cutting activity | P1 Must | 1.7.1 |
| JOB-04 | Task assignment | P1 Must | 1.7.1 |
| JOB-05 | Progress and history | P1 Must | 1.7.1 |
| JOB-06 | Holds and blockers | P1 Must | 1.7.2 |
| JOB-07 | External-work reconciliation | P1 Must | 1.7.4 |
| JOB-08 | Trials | P1 Must | 1.8.1, 1.2.3 |
| JOB-09 | Alteration and correction jobs | P1 Must | 1.8.1, 1.2.3 |
| JOB-10 | Quality acceptance | P1 Must | 1.8.2 |
| JOB-11 | Ready for handover | P1 Must | 1.8.2 |
| JOB-12 | Partial handover | P1 Must | 1.8.3 |
| JOB-13 | Collection versus fulfilment | P1 Must: collection; courier dispatch optional | 1.8.3 |
| JOB-14 | Cancellation and reopening | P1 Must | 1.8.4 |
| JOB-15 | Closure | P1 Must | 1.8.4 |
| JOB-16 | Aari and embellishment work | P1 Must | 1.7.3 |
| OPS-01 | Worker profiles | P1 Must: minimal worker profiles; full profiles P2 | 1.7.3, 2.1.1 |
| OPS-02 | Workload stacks | P1 Should | 2.3.1 |
| OPS-03 | Assignment and reassignment | Later baseline / gated | 2.3.1 |
| OPS-04 | External vendors | P1 Must | 1.7.3, 2.1.1 |
| OPS-05 | Production estimates | Later baseline / gated | 2.3.2 |
| OPS-06 | Capacity and commitments | Later baseline / gated | 2.3.2 |
| OPS-07 | Planning view | Later baseline / gated | 2.3.2 |
| OPS-08 | Piece-rate and time-based work | Later baseline / gated | 2.3.3 |
| OPS-09 | Payable settlement | Later baseline / gated | 2.3.3 |
| OPS-10 | Performance context | Later baseline / gated | 2.3.3 |
| OPS-11 | Minimal vendor obligation record (Phase 1) | P1 Must | 1.7.3, 1.7.4 |
| FIN-01 | Rate catalogue | P1 Must | 1.4.1 |
| FIN-02 | Itemised quote | P1 Must | 1.4.1 |
| FIN-03 | Drafts and revisions | P1 Must | 1.4.1 |
| FIN-04 | Price versus cost | P1 Must | 1.4.1 |
| FIN-05 | Shared amounts | P1 Must | 1.4.2 |
| FIN-06 | Distinct documents | P1 Must | 1.4.4, 2.4.1 |
| FIN-07 | Billing configuration | P1 Must: unregistered; composition/regular before registered-shop onboarding | 1.4.4, 2.4.1 |
| FIN-08 | Issue and correction controls | P1 Must | 1.4.4, 2.4.1 |
| FIN-09 | Action-specific gating | P1 Must | 1.4.4, 2.4.1 |
| FIN-21 | Commercial event sequence | P1 Must | 1.4.4, 2.4.1 |
| FIN-10 | Payment recording | P1 Must | 1.4.2 |
| FIN-11 | Verification states | P1 Must | 1.4.2 |
| FIN-12 | Allocation and prevention of duplication | P1 Must | 1.4.2 |
| FIN-13 | Transparent balance | P1 Must | 1.4.2 |
| FIN-14 | Refunds and reversals | P1 Must | 1.4.5 |
| FIN-15 | Credit handover | P1 Must | 1.8.3 |
| FIN-16 | Daily reconciliation | P1 Must | 1.9.2, 2.4.2 |
| FIN-17 | Direct costs | P1 Must | 1.5.4 |
| FIN-18 | Overheads and owner withdrawals | P1 Should | 2.4.3 |
| FIN-19 | Profitability presentation | P1 Should | 2.4.3 |
| FIN-20 | Financial controls and export | P1 Must: controls/linked exports; registered exports P2 | 1.10.3, 2.4.1 |
| RTL-01 | Product and variant catalogue | Later baseline / gated | 2.5.1 |
| RTL-02 | Variant stock | Later baseline / gated | 2.5.1 |
| RTL-03 | Sale and mixed checkout | Later baseline / gated | 2.5.2 |
| RTL-04 | Reservation and deposit | Later baseline / gated | 2.5.1 |
| RTL-05 | Linked alteration | Later baseline / gated | 2.5.2 |
| RTL-06 | Return and exchange | Later baseline / gated | 2.5.3 |
| RTL-07 | Cancellation coordination | Later baseline / gated | 2.5.3 |
| RTL-08 | Retail reporting | Later baseline / gated | 2.5.3 |
| COM-01 | Customer overview | Later baseline / gated | 2.6.1 |
| COM-02 | Secure access | Later baseline / gated | 2.6.1 |
| COM-03 | Customer decisions | Later baseline / gated | 2.6.2 |
| COM-04 | Owner-triggered sharing | P1 Must | 1.4.3, 1.6.2, 1.8.3, 1.8.5 |
| COM-05 | Automated messages | Later baseline / gated | 2.6.4 |
| COM-06 | Language and tone | P1 Must | 1.4.3, 1.6.2, 1.8.3, 1.8.5 |
| COM-07 | Preferences and consent | P1 Must | 1.4.3, 1.6.2, 1.8.3, 1.8.5 |
| COM-08 | Communication timeline | P1 Must | 1.4.3, 1.6.2, 1.8.3, 1.8.5 |
| COM-09 | Reminder controls | Later baseline / gated | 2.6.3 |
| COM-10 | Provider failure and cost visibility | P1 Should | 2.6.4 |
| COM-11 | Customer issues | Later baseline / gated | 2.6.2 |
| DAY-01 | Action-first home | P1 Must | 1.9.2 |
| DAY-02 | Action cards | P1 Must | 1.9.2 |
| DAY-03 | Order lists | P1 Must | 1.9.1 |
| DAY-04 | Search | P1 Must | 1.9.1 |
| DAY-05 | Views | P1 Should | 2.3.2 |
| DAY-06 | Delivery warnings | P1 Must | 1.9.2 |
| DAY-07 | Exception ownership | P1 Must | 1.9.2 |
| DAY-08 | Clear prioritisation | P1 Must | 1.9.2 |
| DAY-09 | Quick actions | P1 Must | 1.9.2 |
| DAY-10 | Daily close | P1 Must | 1.9.2 |
| SHO-01 | Mannequin master | P1 Should | 2.7.1 |
| SHO-02 | Costume changes | P1 Should | 2.7.1 |
| SHO-03 | Customer showcase | P1 Should | 2.7.2 |
| SHO-04 | Publishing control | P1 Should | 2.7.1 |
| SHO-05 | Enquiry from showcase | P1 Should | 2.7.2 |
| SHO-06 | Privacy and asset rights | P1 Should | 2.7.1 |
| SHO-07 | Read-only feed | Later baseline / gated | 3.2.1 |
| SHO-08 | Refresh controls | Later baseline / gated | 3.2.1 |
| SHO-09 | Connection lifecycle | Later baseline / gated | 3.2.1 |
| SHO-10 | Content separation | Later baseline / gated | 3.2.1 |
| REP-01 | Operational scorecard | P1 Must | 1.9.3, 2.6.2 |
| REP-02 | Sales and collections | P1 Must | 1.9.4, 2.2.3, 2.3.3 |
| REP-03 | Contribution | P1 Should | 2.4.3, 1.9.4 |
| REP-04 | Receivables and payables | P1 Must | 1.9.4, 2.2.3, 2.3.3 |
| REP-05 | Materials and retail | P1 Should | 2.2.4, 2.5.3, 1.9.1 |
| REP-06 | Customers and services | P1 Must: basic; complaint reporting P2 | 1.9.3, 2.6.2 |
| REP-07 | Acquisition sources | P1 Must | 1.6.3 |
| REP-08 | Advertising inputs | P1 Should | 1.6.3, 2.10.1, 3.2.2 |
| REP-09 | Attribution policy | Later baseline / gated | 2.10.1 |
| REP-10 | Campaign outcomes | Later baseline / gated | 2.10.2, 3.2.2 |
| REP-11 | ROAS and contribution after advertising | Later baseline / gated | 2.10.2, 3.2.2 |
| REP-12 | Comparison and freshness | Later baseline / gated | 2.10.2, 3.2.2 |
| REP-13 | Filters and drill-down | Later baseline / gated | 2.10.2, 3.2.2 |
| REP-14 | Business review actions | Later baseline / gated | 2.10.2, 3.2.2 |
| AI-01 | Tamil/English assisted intake | Later baseline / gated | 2.9.2 |
| AI-02 | Relevant follow-up questions | Later baseline / gated | 2.9.2 |
| AI-03 | Scope and quote completeness | Later baseline / gated | 2.9.3 |
| AI-04 | Delivery-risk assistance | Later baseline / gated | 3.3.2 |
| AI-05 | Source-linked fit recall | Later baseline / gated | 3.3.1 |
| AI-06 | Collection/payment assistance | Later baseline / gated | 3.3.3 |
| AI-07 | Design-reference structuring | Later baseline / gated | 2.9.4 |
| AI-08 | Assisted document entry | Later baseline / gated | 2.9.5 |
| AI-09 | Action-linked operational questions | Later baseline / gated | 3.3.3 |
| AI-10 | Feedback and enablement | Later baseline / gated | 2.9.1 |
| TRU-01 | Shop isolation | P1 Must | 1.1.3 |
| TRU-02 | Basic role controls | Later baseline / gated | 2.1.1, 2.1.2 |
| TRU-03 | Customer/wearer privacy | P1 Must | 1.1.3 |
| TRU-04 | Consent and notice | P1 Must | 1.1.3 |
| TRU-05 | Data minimisation | P1 Must | 1.1.3 |
| TRU-06 | Business audit history | P1 Must | 1.2.4 |
| TRU-07 | Document and media visibility | P1 Must | 1.1.3 |
| TRU-08 | Correction, archive and deletion | P1 Must | 1.10.2 |
| TRU-09 | Account and access lifecycle | P1 Should | 2.1.1, 2.1.3, 2.6.1 |
| TRU-10 | Recovery | P1 Must | 1.10.4 |
| TRU-11 | Integrations and support | P1 Should | 2.1.3, 2.6.4, 3.2.1, 3.2.2 |
| TRU-12 | Financial integrity | P1 Must | 1.2.4 |
| TRU-13 | Digital personal data protection | P1 Must | 1.1.3 |
| USE-01 | Mobile and desktop use | P1 Must | 1.10.4 |
| USE-02 | Language | P1 Must | 1.10.4 |
| USE-03 | Reliable drafts | P1 Must | 1.2.1 |
| USE-04 | Connectivity boundaries | P1 Must | 1.2.1 |
| USE-05 | Import and migration | P1 Must | 1.10.1 |
| USE-06 | Export | P1 Must | 1.10.3 |
| USE-07 | Printing and media | P1 Must | 1.3.4 |
| USE-08 | Concurrent updates | P1 Must | 1.2.1 |
| USE-09 | Recovery and accessibility | P1 Must | 1.10.4 |
| BIZ-01 | Guided onboarding | P1 Must: guided onboarding; resettable practice UX Should | 1.10.4, 2.1.4 |
| BIZ-02 | Reusable configuration | Later baseline / gated | 2.1.4 |
| BIZ-03 | Shop membership | Later baseline / gated | 2.1.3 |
| BIZ-04 | Plans and limits | Later baseline / gated | 2.11.1 |
| BIZ-05 | Expiry and exit | Later baseline / gated | 2.11.2 |
| BIZ-06 | Support and feedback | P1 Must | 1.10.3 |
