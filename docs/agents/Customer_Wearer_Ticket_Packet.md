# Customer and wearer: proposed implementation tickets

17 October 2026. **Owner approved A/B/C publication and sequential implementation.**
Stable slice: 1.1.3. The owner also approved synthetic implementation with
nonblank, explicitly draft privacy text while final policies remain under review.
This is a narrow revision to the brief's implementation-input gate, not approval
of policy wording or real-data activation. Published IDs are recorded below once
created. Merged-prerequisite and integrated-development gates still apply.

Sources: [feature brief](Customer_Wearer_REA_Plan.md),
[research evidence](Customer_Wearer_REA_Evidence.md),
[independent design and acceptance matrix](Customer_Wearer_Design.md), product
§§4, 7, 24–25, 29.1, 30.1, 32–33, architecture §§6–9, 11–12, 15, roadmap
1.1.1–1.1.3/1.2.1, [development workflow](Development_Workflow.md) and
[tracker rules](issue-tracker.md). Competitor findings are advisory; unobserved
Nool behavior is not an acceptance criterion for Aarili.

## Reviewable breakdown

1. **[W1 1.1.3a] Register, find and reopen a minimal private customer.**
   Delivers the dashboard-to-directory-to-create-to-profile journey with optional
   contact details, bilingual search, notice evidence and honest retry/conflict
   behavior. Blocked by draft synthetic notice fixtures, integrated owner entry, merged
   0.2.3/0.4.1 and the existing search foundation.
2. **[W1 1.1.3b] Register adult wearers with explicit relationship permissions.**
   Delivers self/another adult/existing-wearer selection, preferences and scoped
   family authority with recoverable longer-form drafts. Blocked by A and the
   existing draft recovery foundation, plus labelled draft purpose fixtures.
3. **[W1 1.1.3c] Register a minor with a separate guardian and consent evidence.**
   Delivers the aunt-contact/child-wearer/parent-guardian registration journey,
   pending states, attributable grant/withdrawal and negative authority cases.
   Blocked by B and labelled draft guardian-flow fixtures.

Each is an independently demonstrable vertical outcome including persistence,
core, API, UI and tests. No schema-only or UI-only ticket. Approval review should
confirm granularity and direct edges, and identify any desired merge/split before
publication. There is no parent/map issue proposed. After approval, publish in
A/B/C order with native blocking edges and existing `enhancement` /
`ready-for-agent` labels as applicable; re-read each body and native relationship.

## Gate record and common delivery obligations

Fresh tracker inspection found no selected published 1.1.3 ticket and no open
PR. Existing roadmap technical prerequisites are #16 (0.2.3, merged PR #21) and
#51 (0.4.1a, merged PR #61). Additional reused foundations were checked through
their closing PRs: #53 search → merged #64, #55 drafts → merged #65, #56 draft
recovery → merged #68 (all merged 16 October). Recheck their integration into
current development before starting. Do not treat CLOSED alone as a merge check.

The local onboarding revision is uncommitted on `codex/owner-access-onboarding`.
Its deliberate review/integration is a real implementation-base gate, not an
instruction to commit it during this research. No branch switch, stash, reset
or worktree workaround. After integration, refresh `origin/development`, inspect
current CI, then start one requested approved unblocked issue on a focused branch
in this same checkout. Recheck actual native blockers then.

Owner decision during publication approval: final Tamil/English notice, retention
terms and guardian-consent policy are still pending. Proceed with clearly labelled
original draft text and synthetic fixtures for development/review; never mark them
approved or use them to collect real customer data. See
[the policy review draft](Customer_Wearer_Privacy_Draft.md). Each ticket carries
the relevant draft mechanics and review inputs; final approval remains required
before real-data activation or a claim of full policy/parent-slice readiness.
Production gate inputs also include
grievance contact, processing agreement, processor locations, breach procedure,
appropriate applicability advice and the product §32.2/TRU-10 pilot requirements.
No assumed wording, legal conclusion, period or authority-verification method.

For every ticket:

- Preserve framework-free core/repository boundaries, thin Node Hono handlers,
  validated contracts and compiled typed module clients. Follow existing pins
  and tooling; fetch current docs only for implementation-specific questions.
- Membership-checked `withShop` for every path; non-null shop IDs, composite
  tenant FKs, shop-led indexes and ENABLE/FORCE RLS with matching write policy.
  Runtime `app_user` must not own tables or bypass RLS.
- Atomic idempotency/audit/business write, stable retries, changed-payload 422,
  ETag/If-Match 428/412 and domain 409. No silent identity/permission merge.
- Client data only in memory; clear on sign-out/access change/shop switch and
  reject late responses. No private values in URLs, browser storage, service
  worker cache, telemetry, public output or vendor-derived artifacts.
- Run actual `pnpm lint`, `pnpm knip`, `pnpm typecheck`, relevant `pnpm test`,
  `pnpm test:negative`, `pnpm openapi`, real PostgreSQL
  `pnpm test:integration`, focused Playwright/axe through the supported UI runner,
  and `pnpm build`. Use the actual scripts listed in the root package manifest;
  honor explicit checks without repeating successful unchanged stages.
  The implementation's selected test filters must be recorded with results.
- Feature PR CI requires Fast verification and Dependency audit. Promotion retains
  full scaffold/browser/PDF/smoke gates. No automatic merge, promotion or deploy.
- Record requirement-by-requirement evidence, unknowns, tested revision/dirty
  inputs and real timings in Delivery_Measurements for implementation delivery.
  Update 1.1.3 traceability only for the approved breakdown; leave 1.1.1/1.1.2,
  1.2.1, Phase 0.5 and live gates unchanged.
- Additive reviewed migration through existing advisory lock, backup before
  authorized schema application, no destructive down migration, compatible-app
  rollback and disposable synthetic integration databases. Allocate filenames
  after onboarding 0016 merges. No real-data import.

## Proposed issue A — 1.1.3a

**Title:** [W1 1.1.3a] Register, find and reopen a minimal private customer

**What to build:** From the authorized dashboard, the owner opens Customers,
creates a person using a display name and applicable approved service notice,
finds the record and reopens its profile. Phone/email are optional; two people
can share a phone without merging. The profile offers simple audited contact
correction. It does not present wearer/measurement/order actions that have not
yet shipped.

**Direct blockers:** #16 (0.2.3), #51 (owner shell), #53 (versioned search
foundation), integrated owner-entry revision and labelled synthetic draft
notice fixtures. At publication replace integration/input references
with their actual reviewed evidence or genuine issue blockers; do not invent an
issue number. 1.1.1 and 1.1.2 are not blockers for A.

**Requirement/architecture links:** CUS-01; TRU-01/03/04/07/13;
USE-01/02/04/08/09. AC-02 shared-phone identity portion. Architecture §§6.2–6.4,
7, 8.1–8.3/8.5, 9.1–9.2, 11.2/11.4–11.5, 12.4, 15.

**Acceptance criteria:**

- [ ] CW-01: Name-only contact saves, shows a shop code and reopens after
  navigation; phone/email/notes optional; no DOB/ID/photo requirement. Invalid
  or whitespace-only name produces useful validation without losing input.
- [ ] CW-02: Two distinct people save with the same phone; each remains a
  separate result/profile. Exact/partial name, original Tamil, Tanglish aliases,
  normalized phone and supported suffixes use current versioned keys. Search
  body/cursor stays out of URLs; a synthetic recall fixture records top-five
  results, with no claim of meeting the later real-name pilot corpus gate.
- [ ] CW-06/07/10: Missing context and cross-shop reads/search/updates/links
  reveal no foreign data; runtime grants and forced policies verified. Existing
  public routes/artifacts contain none of the new synthetic private canaries.
- [ ] CW-08/11: Applicable bilingual notice version, purpose, person,
  giver, recording actor, source/channel and times persist correctly. Marketing
  is not required or presumed. Without final approved policy, production
  registration is blocked with an understandable reason; only explicit synthetic
  development/test review composition can use the visibly draft fixture notice.
- [ ] CW-12: English/Tamil phone/tablet/desktop directory, empty/no-match/error,
  create/profile/edit/cancel flows pass keyboard/focus/axe/zoom checks in both
  existing themes. Initial locale preserves the owner-entry decision.
- [ ] CW-13: Repeated/lost-response save replays exactly once; changed payload
  on same key fails; rollback leaves no person/customer/audit/key residue.
  Two competing updates have one success and one stale conflict; no silent
  overwrite. Offline values stay on screen with explicit not-saved/retry.

**Verification:** Unit/property schemas and key behavior; real PostgreSQL
two-shop/pooled-context/FK/catalog tests; concurrent creates/edits, replay after
version change, actor/action mismatch, audit failure and transaction rollback;
browser response-loss, sign-out/late-response, URL/storage/network-log canaries.
Use common commands above; no mocks as evidence of RLS/atomicity.

**Migration/recovery:** Add person/customer and applicable notice/consent records,
search keys/indexes and grants. Minimal ID/version replay result; avoid duplicate
personal data in audit/idempotency. Additive rollback compatibility verified.

**Human review:** After implementation supply exact running local URL and startup
command, synthetic records and private owner access method. Open Customers,
save name-only, find Tamil/Latin variants, create shared-phone second person,
reopen and edit; inspect conflict and failed-save recovery. Record
`CW-ID — pass/fail — observation`, plus device/browser/RAM and fluent Tamil
observations. Device and policy approval remain separate from automation.

**Exclusions:** No wearer/guardian flow yet, customer portal, full merge/relink,
order/measurement/media capture, messages, rights execution or live activation.
A alone does not complete 1.1.3.

## Proposed issue B — 1.1.3b

**Title:** [W1 1.1.3b] Register adult wearers with explicit relationship permissions

**What to build:** The owner opens a customer, explicitly adds self or another
adult wearer (or selects an existing shop wearer), records the relevant
relationship/authorisation and expressed preferences, and returns to a profile
whose selected wearer is unmistakable. A connected server draft can be resumed
without creating an authoritative wearer until validated promotion.

**Direct blockers:** A merged; #55/#56 draft save/promotion/recovery integrated;
labelled synthetic family-authorisation and relevant purpose fixtures. A inherits command,
shell/search and owner-entry prerequisites. No dependency on future measurements.

**Requirement/architecture links:** CUS-02/04/07; TRU-01/03/04/07/13;
USE-01/02/03/04/08/09; AC-02 identity/permission portion. Architecture §§6–9,
11.5, 12.4, 15, including draft/current-state promotion.

**Acceptance criteria:**

- [ ] CW-03: Explicit self mapping and a second adult have separate wearer
  records. Another person's matching name/phone never selects self or silently
  reuses an identity. Existing wearer choice is deliberate and same-shop only.
- [ ] CW-04: Language/channel, fit/style and delivery preferences preserve
  expressed original text and source; unknown is valid. Preferences neither
  grant permission nor change interface locale or another wearer automatically.
- [ ] CW-05/08/11: Family data-supply authority and wearer-informed confirmation
  identify who stated them and their applicable interaction. Separate purpose
  grant/refusal/withdrawal records bind subject, notice, giver, recording actor,
  time and source. No optional opt-in default or marketing requirement.
- [ ] CW-03/05: Switching active wearer clears uncommitted subject-specific
  permissions, names the new subject and never transfers another person's grant.
- [ ] CW-06/07/10: Cross-shop person/wearer/notice/draft/relationship links fail;
  the client never receives unrelated notes or implied future customer access.
- [ ] CW-12/13: Bilingual three-size, focus/IME, online unsaved/retry/conflict,
  connected autosave, reload/reopen/resume and cancel behavior verified. Draft
  promotion rechecks current identity, authority and notice policy and never
  auto-merges similar records. Stale/superseded drafts remain visible conflicts.
- [ ] Unknown/minor age may be retained as unresolved, with no adult permission
  shortcut. Full minor/guardian authority flow remains unavailable until C.

**Verification:** Common commands; unit policies for independent preferences and
permission state, property tests for subject switching; real PostgreSQL forced
policies, composite FKs, missing context, replay/binding mismatch, concurrent
relationship/consent updates, audit rollback and draft promotion retries.
Browser tests distinguish saved draft from registered wearer and clear all
memory on sign-out; no personal data in URLs/storage/public artifacts.

**Migration/recovery:** Add wearer, relationship and preference records and
purpose evidence as needed, preserving A data and API compatibility. Extend
existing draft workflow allowlist rather than accept arbitrary payloads. No new
outbound effects. Retention uses approved policy, never an invented period.

**Human review:** Exact running URL and synthetic self/second-adult draft are
prepared by the implementer. Select each person, inspect identity heading and
permission state, resume a draft, switch person and verify no carried grant.
Review long Tamil names/IME on physical phone and separate optional purposes.
Collect `CW-ID — pass/fail — observation`; do not request repeat terminal tests.

**Exclusions:** No minor consent completion, garment/measurement links, full
merge/relink/history, staff/customer access, automation or rights case handling.

## Proposed issue C — 1.1.3c

**Title:** [W1 1.1.3c] Register a minor with a separate guardian and consent evidence

**What to build:** The owner records a child wearer linked to an aunt contact,
identifies a separate parent/legal guardian, and records actual applicable
authority/consent evidence. Pending evidence is visible and never interpreted as
consent. The owner can record a refusal/withdrawal without rewriting history.
Complete 1.1.3 registration evidence across A–C, retaining later integration gates.

**Direct blockers:** B merged; labelled draft synthetic guardian flow and
Tamil/English purpose fixtures. Final approved authority/consent flow, wording
and retention remain activation gates. Pending business inputs are not replaced
with a checkbox or synthetic policy in production.

**Requirement/architecture links:** CUS-02/07, TRU-01/03/04/05/07/13;
USE-01/02/03/04/08/09. AC-53 registration portion, AC-02 permission portion;
AC-39/52 remain incomplete cross-slice scenarios. Architecture §§6–9,
11.5, 12.4, 15, and later media constraints in §10.1.

**Acceptance criteria:**

- [ ] CW-09: Nullable under-18 status preserves unknown, supports explicit
  minor/adult entry, requires no DOB/document/photo and never defaults adulthood.
- [ ] CW-09/11: Aunt contact/payer and parent/guardian are different identified
  people. Payer/family relationship alone is rejected as guardian authority.
  Parent/legal guardian claims follow approved evidence flow; no self-guardianship,
  wrong-wearer authority or cross-shop guardian reference.
- [ ] CW-08/09/11: Guardian evidence names the minor, giver/authority,
  purpose/notice version/language, recording actor, source/channel and timestamps.
  Refusal/withdrawal append linked events. Unknown or withdrawn evidence never
  yields an eligible state; new notice/purpose cannot silently reuse an old grant.
- [ ] CW-09/10: Minor marketing/publication grants are rejected; no photo,
  measurement, publication or messaging operation is exposed by registration.
  The profile describes registration evidence without claiming future endpoints
  are protected. Age/guardian changes force affected permission eligibility review.
- [ ] CW-06/13: Concurrent guardian/age/grant/withdrawal changes serialize against
  current state; stale writes fail visibly. Same-key replay stays stable while a
  new downstream evaluation reads current authority. Rollback/retry is atomic.
- [ ] CW-12: Bilingual three-size aunt/child/parent journey and pending/refused
  states pass automation; physical Android, Tamil and screen-reader business
  review remain explicitly evidenced or pending.
- [ ] Final A–C evidence maps all CUS-01/02/04/07 and TRU-01/03/04/05/07/13
  obligations and each CW label. No claim of order/measurement integration,
  completed erasure, approved legal compliance or pilot readiness.

**Verification:** Common commands; real PostgreSQL negative guardian-role,
wrong-subject/notice/tenant, missing context, FORCE policy, rollback and concurrent
age/permission tests. Browser fixture uses explicitly synthetic child records,
separate aunt and parent; asserts no DOB/media input, private storage/URL absence,
clear refusal/withdrawal, focus and recoverable server draft state.
Future 1.3.2/media tests must exercise the actual minor measurement/photo writes;
those cannot be simulated away by registration unit tests.

**Migration/recovery:** Add guardian relationship and evidence constraints,
consistent subject locks and aggregate versioning. Preserve grants/refusals/
withdrawals as attributable events, avoid sensitive audit copies and retain the
later narrowly audited privacy redaction seam. Additive schema and rollback
notes; no routine deletion or grandfathered synthetic consent.

**Human review:** Implementer prepares exact running review URL with synthetic
aunt/child/parent, missing-authority draft and fixture notice clearly labelled.
Try the aunt as giver (blocked), identify parent, review separate authority and
purpose, record evidence, withdraw it and revisit the wearer. Inspect long Tamil
labels and screen-reader announcement of subject/pending state. Respond with
`CW-09/CW-11/CW-12 — pass/fail — observation`. Owner/privacy wording review and
physical-device acceptance remain mandatory where applicable.

## Remaining decisions and readiness

The owner approved this A/B/C breakdown, publication and synthetic implementation
on 17 October. Runtime Nool observations inform navigation principles but do not
approve Aarili policy. No parallel worktree approval was given; the ticket chain
is sequential. Read-only reviews and independent documentation can run alongside
verification in the same checkout without concurrent source mutations.

No application work has started. No delivery implementation timer is fabricated;
Delivery_Measurements remains unchanged during research. For implementation,
prepare the actual running manual-review surface rather than treating these
future review steps or an illustrative design as delivered software.
