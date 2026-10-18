# Adult wearer registration — ticket #79

17 October 2026. Approved slice 1.1.3b, branch
`codex/adult-wearer-registration` from integrated development `ac98740`.
Customer PR #81 merged at 2026-10-17T07:32:07Z. Native blockers #55/#56/#78
are closed; draft prerequisites were merged in PRs #65 and #68.
Implementation commit `39be40e` is published in draft
[PR #82](https://github.com/nishanthturnstile/aarili/pull/82) to `development`.
Required Fast verification and Dependency audit were running at publication;
owner review/merge and human acceptance are pending. Documentation-only PR
metadata follows the source-fingerprinted implementation.

Sources: [issue #79](https://github.com/nishanthturnstile/aarili/issues/79),
[design](Customer_Wearer_Design.md), [REA evidence](Customer_Wearer_REA_Evidence.md),
[review wording](Customer_Wearer_Privacy_Draft.md), product CUS-02/04/07,
TRU-01/03/04/07/13 and USE-01–04/08/09; architecture §§6–9, 11.5, 12.4, 15.
This is original Aarili implementation; no new vendor observation is claimed.

## Behavior and integrity

The customer profile contains explicit self, another person and existing wearer
choices. Self creates a distinct wearer role for the contact's person. Another
person gets a separate identity, even with an identical name. Existing selection
uses safe shop-only summaries and an explicit reference; it cannot copy a different
relationship's statements or change that wearer's preferences during linking.
The selected person's heading and reference remain visible. Switching person
clears uncommitted subject-specific statements and purpose choices.

Age is adult, minor or unknown, with no preselection, inferred adulthood or DOB.
Minor/unknown profiles remain unresolved and cannot receive adult grants. Guardian
completion remains #80. Age evidence retains the explicitly entered interaction
source/time and recording actor/server time.

Family data-supply authority and wearer-informed confirmation are separate,
attributable statements for the stated interaction. Each distinguishes confirmed,
unknown and explicitly declined; no unchecked field becomes permission. The
contact is the statement giver, while the authenticated owner is the recorder.
The adult wearer gives their own separate service, marketing, publication or
private-media grant/refusal/withdrawal after the relevant notice explanation.
No choice is preselected and marketing is optional. Recording evidence does not
activate any measurement, media, publication, messaging or customer-access flow.

Preferences retain original language/channel, fit/style and delivery text with
expressed source. Empty remains unknown. They do not infer consent, change the
UI language or overwrite another person's preferences. Corrections require ETags;
stale proposals remain on screen until explicit reload. Age or relationship
authority transitions invalidate earlier grants without reviving them on a later
reapproval. Immutable events retain provenance; current-purpose evidence is
displayed without claiming to show the complete event history.

The existing durable-draft registry admits only the strict `customer.wearer`
workflow, schema version 1, in explicit synthetic composition. Incomplete saves
are distinct from complete command validation. The opaque resume URL appears
only after a committed save. Promotion rechecks the pinned notice, current
customer and selected wearer versions, identity and relationship rules. It
creates the role/link and audit in the same transaction as draft promotion and
replay. The result is the relationship ID with a composite shop/draft origin FK.
No separate registration HTTP call follows promotion. Stale or already-promoted
drafts are disclosed conflicts; no automatic identity or authority rebase occurs.

Open values and query caches are memory-only, scoped to the current owner/shop,
and cleared on access invalidation. Personal values never enter URL/query keys,
storage, worker caches or public artifacts. Unknown saves retain detached keys,
payloads and preconditions; even a throttled retry cannot establish that an
earlier command failed. The shared recovery fix has dedicated lost-save and
lost-promotion → 429 → same-command retry regressions.

## Policy, migration and recovery

The original bilingual wearer-purpose notice is an immutable digest/versioned,
visibly draft synthetic fixture. Default composition blocks registration and
purpose recording; there is no production approval or live activation path.
Final privacy wording, retention terms and guardian approval remain pending.
No retention interval is invented, and existing disabled deletion policy remains.

Additive `0018_adult_wearer_registration.sql` preserves A's data/API and adds
wearer, relationship, preference and immutable evidence records. All seven new
tenant tables have non-null shop IDs, composite tenant FKs, shop-led keys and
forced matching policies. Runtime cannot delete identities or mutate immutable
events; actor/version and relationship/giver guards supplement core validation.
Per-wearer locks serialize corrections and permission transitions. Business
changes, minimal audit and direct-wearer ID/version replay responses commit
together. Personal values are not duplicated into audit or direct-wearer receipts.
The existing durable-draft contract deliberately stores its complete private
DraftSuccess snapshot for exact replay (architecture §8.5); those tenant-protected
idempotency rows also contain draft payloads. This inherited copy must be covered
by approved retention/erasure before live use. This slice preserves that foundation
contract and does not claim payload-free generic draft receipts.

Use the existing advisory-locked migration runner after an authorized backup.
Development verification uses disposable synthetic databases. Application rollback
keeps the compatible additive schema; no destructive down migration or live import
is supplied. Existing customer and onboarding behavior remains supported.

## Acceptance and verification

Final local component checks passed as recorded below. Early affected web
typecheck passed after correcting partial preference defaults; an initial
production web build passed before the shared recovery correction. These early
results do not establish the final delivery gate.

Development evidence: `pnpm verify:fast` passed 13:19:41.0076871 to
13:21:37.5407171+05:30, including all 165 unit tests across 42 files and the
production build. Later interaction-scope/partial-draft corrections require
affected checks against the final source. The Impeccable detector reported no
findings for the changed UI/CSS.

The first focused browser matrix was stopped after its phone registration case
detected horizontal overflow at 320px/200% text. Native select minimum content
expanded the form grid; scoped minimum widths and `minmax(0,1fr)` corrected the
live probe from 448px overflow to no overflowing elements. The failed run
(13:17:06 to 13:19:35+05:30) is retained as a development failure, not a pass.
Its disposable processes/databases were cleaned before affected verification.
The initial review-host startup also exposed an undeclared root `uuid` import;
the helper now resolves the existing pinned web dependency without adding one.

The corrected focused wearer matrix passed all six phone/tablet/desktop runs
(11.2m): 13:25:30.4168923 to 13:36:55.4355850+05:30. Commands:
`node scripts/test-ui.mjs wearers.spec.mjs --max-failures=1` after the production
build. This covers both languages/themes, IME, 200%/320px reflow/axe,
self/new/existing identity, connected resume/promotion, lost response replay,
purpose switching/refusal/withdrawal, offline/stale corrections, stale customer
promotion and sign-out/late-response privacy canaries. The later refresh guard
and initial-save rejection wording have separate affected validation below.

Final clean/native verification started at
2026-10-17T13:24:29.5837643+05:30 against the implementation working tree.
[Clean_Source.sha256](adult-wearer-registration/Clean_Source.sha256) identifies
461 source/config/test/infra inputs; its LF-normalized SHA-256 is
`41aaef8245f31dd507f16f5bd0e1e5722b9ab5eebeb3e0e1d6b77576ada6a3f6`.
This fingerprints actual dirty inputs, not an earlier commit. Package exports
changed, so the repository requires this supplementary clean-install/native check.

A later UI-only correction guards manual refresh before it can replace a dirty
concurrently changed profile, and makes a rejected initial draft save explicitly
say its latest input is not saved. Fresh lint/Knip/web typecheck/build passed
13:37:30.2049705 to 13:37:58.4004850+05:30. Its focused browser regression passed
all three sizes (1.2m) through
`node scripts/test-ui.mjs wearer-refresh.spec.mjs --max-failures=1`: dismissing
refresh keeps the dirty proposal, a stale save returns 412, explicit reload
shows the concurrent saved correction, and a rejected first draft save never
claims a saved draft. Database/core/API/PDF inputs are
unchanged; their clean-run evidence is reused rather than repeated.
[Tested_Source.sha256](adult-wearer-registration/Tested_Source.sha256) identifies
the 462 final inputs (including the new refresh regression), SHA-256
`dca3826683d943c03047784e78052f619d49bb492756fd18cf9a7a0aa70e107f`.
The final test-only delta replaces two corrupted synthetic name literals with
genuine Tamil `மீனா`; strict UTF-8 review found no remaining encoding corruption
in the 19 new wearer-related files. Its affected registration matrix passed 3/3
(4.2m), 13:46:40.6210523 to 13:50:57.6977368+05:30:
`node scripts/test-ui.mjs wearers.spec.mjs --grep 'explicit self' --max-failures=1`.

Preserved customer/onboarding workflows passed all 12 browser runs (6.8m),
13:39:38.7056877 to 13:46:37.0871415+05:30:
`node scripts/test-ui.mjs customers.spec.mjs owner-entry.spec.mjs owner-shell.spec.mjs --max-failures=1`.

The clean run ended 13:48:16.8820621+05:30 with exit 1. Frozen installation,
lint/boundaries/tokens, Knip, strict types, all 166 unit tests (42 files), negative
types, OpenAPI and Linux PDF goldens passed. PostgreSQL reported 104 passed and
one failed across 23 files (1128.99s). Existing draft test E8 expected timestamp
ordering `[draft.saved, draft.promoted]`; both bindings existed but sorted in the
reverse order. Usage dates are audit transaction wall-clock timestamps, not a
causal sequence. The original log does not distinguish a clock reversal from a
timestamp tie with UUID ordering; no such cause is asserted.

The test-only correction now requires exactly two joined events, exactly one of
each name, retaining every subject/entity/exact audit-time binding, replay,
usage total and rollback assertion. The full affected file passed 5/5 in 33.18s
from 13:49:53+05:30:
`pnpm exec vitest run --config vitest.integration.config.ts tests/drafts.integration.test.mjs`.
No business/database inputs changed. The other 104 passing cases are reused,
and missing build/smoke/artifact stages run separately. This is staged component
evidence, not a claim that the original `pnpm verify:clean` command passed.

Remaining production stages passed 13:51:06.5448923 to
13:52:18.6212981+05:30: `pnpm build`, `pnpm smoke`, and
`node scripts/check-artifacts.mjs`. All 12 package/application builds completed;
real PostgreSQL readiness/outage, typed-client and worker shutdown smoke passed;
29 browser artifacts passed the private-configuration/server-boundary scan.
Across the staged evidence, 166 unit tests and all 105 distinct PostgreSQL cases
are covered, plus 21 distinct browser scenarios across three sizes (24 successful
executions including the corrected Tamil registration rerun). Hosted CI and
human acceptance remain separate. All 462 final source hashes were rechecked
unchanged after verification. Relative to the first clean snapshot, only the
wearer UI correction, two affected browser test files and legacy draft test differ;
each has the focused validation recorded above.

| Acceptance | Required evidence |
| --- | --- |
| CW-03 | Explicit self/new/existing, independent identity, deliberate safe selection, duplicate/self conflict |
| CW-04 | Original expressed preferences/source, unknown allowed, independent subject/locale |
| CW-05/08/11 | Attributable relationship states; separate purpose choices, notice/giver/actor/time, no authority inheritance |
| CW-06/07/10 | Real PostgreSQL missing context, two-shop FKs/access/search/drafts, forced policies/grants; browser canaries/invalidation |
| CW-12 | English/Tamil, both themes, three sizes, keyboard/focus/IME/axe/zoom/reflow |
| CW-13 | Atomic rollback/replay/concurrency, current-state promotion, saved-draft resume, offline/response-loss/stale recovery |
| Age boundary | Explicit unknown/minor, no adult shortcut, no guardian completion before C |

Physical-device, fluent-Tamil, assistive-technology and shop-lighting acceptance
remain human checks. B alone does not close 1.1.3, Phase 0.5 or any live-data gate;
1.1.1/1.1.2 and 1.2.1 dependencies remain unchanged.

## Human review packet

Current final-build review host (after the UI-only correction):
http://127.0.0.1:55706/customers/01a148f4-b4b6-7c4e-8d2b-3d5877b0a599.
This host was restarted after the final production build. Startup:
`node scripts/review-wearers.mjs` after the production build. It prepares an
invented contact, a separate shared-phone contact, an adult self wearer and a
saved second-adult draft with authority still pending. Private ephemeral sign-in
is in `.scratch/wearer-review-host/private.json`, outside Git/chat. Stop with
`node scripts/review-wearers.mjs stop` to clean the database/private access file.

1. Open the seeded customer. Select their self wearer and inspect the name,
   reference, age, expressed preferences and purpose choices (CW-03/04).
2. Resume the second-adult draft. Verify it is a draft, inspect unknown/declined
   versus confirmed relationship statements, save and reload. Register only
   after deliberately reviewing the synthetic interaction (CW-05/11/13).
3. Select each wearer. Confirm a draft purpose choice does not follow a subject
   switch. Record refusal separately from ordinary service and inspect the
   named giver, notice and recording details (CW-05/08).
4. Correct preferences; compare a concurrent saved version, keep offline input,
   and retry a lost response. Repeat Tamil IME and long names on actual phone,
   tablet and desktop, in both themes and with assistive technology (CW-12/13).

Report `CW-ID — pass/fail — observation`, with device/browser/RAM and language
or assistive-technology details where applicable. Final policy acceptance and
owner review/merge remain separate from automated checks.
