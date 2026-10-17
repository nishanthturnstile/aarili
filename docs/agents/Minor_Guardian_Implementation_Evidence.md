# Minor registration and separate guardian evidence — #80

17 October 2026. Selected approved slice 1.1.3c, branch
`codex/minor-guardian-registration` from `development` at `5d00a68`.
Adult wearer PR #82 merged at 2026-10-17T08:45:15Z; native blocker #79 is closed.
The checkout was clean before switching. Existing onboarding, customer and adult
wearer implementation remains integrated; no worktree was created.
Implementation commit `9119554` is published in draft
[PR #83](https://github.com/nishanthturnstile/aarili/pull/83) to `development`.
Required Fast verification and Dependency audit were queued at publication;
owner review/merge and human acceptance remain pending. Documentation-only
publication metadata follows the source-fingerprinted implementation.

Sources: [issue #80](https://github.com/nishanthturnstile/aarili/issues/80),
[feature brief](Customer_Wearer_REA_Plan.md), [design](Customer_Wearer_Design.md),
[privacy review draft](Customer_Wearer_Privacy_Draft.md), product §§7/24/25/32/33
and architecture §§6–9, 10.1, 11.5, 12.4, 15. The owner authorizes nonblank,
visibly draft synthetic fixtures while final policy inputs are pending.
No new Nool observation, copied vendor notice or legal approval is claimed.

## Behavior and boundaries

Age remains explicitly adult, minor or unknown, with no default adulthood or
required date of birth, document or photograph. A minor can remain registered
with pending authority. Contact/payer, child wearer and guardian are separately
identified. A family or payer link supplies no guardian authority. A parent who
also pays can independently establish applicable authority; the aunt/child/parent
review scenario deliberately uses three different people. Self-guardianship is
rejected.

The owner deliberately creates a separate minimal guardian identity or selects
an existing shop person using safe name/reference summaries. A claim records
parent/legal-guardian status, scope, source and occurrence time. It starts pending.
Verification is a separate attributable event with pending, confirmed, rejected
or withdrawn outcome, method, minimal evidence reference, scope, source and both
statement and server-recording times. Confirmation is available only through the
explicit `synthetic-review-v1` fixture method and invented evidence reference.
A checkbox, claim or family label cannot verify real authority.

Measurement and optional private-photo decisions are separate. Each grant,
refusal or withdrawal binds the child, actual giver, authority/verification,
purpose, immutable bilingual notice/version, language, source, occurrence time,
recording owner/time and previous event. No optional choice is preselected.
Minor marketing and publication grants are rejected. No measurement, upload,
publication or messaging operation is exposed by registration.

Current evaluation requires the current minor age, applicable confirmed authority,
scope, authority epoch and notice. Age, guardian or material relationship changes
invalidate affected evidence for review. Re-confirmation does not revive an old
grant. Historical evidence remains visible and ineligible. Withdrawal can append
against the earlier grant, including its old notice or superseded authority,
without rewriting history or claiming erasure. Same-key replay returns its original
minimal result, while a new read evaluates current authority.

The supported `wearer.guardian` v1 durable draft pins customer/wearer versions and
notice. An incomplete draft is not authority. Promotion rechecks current identity,
age and pinned versions, then atomically creates a pending claim and the existing
draft transition/audit/replay. Verification and purpose decisions remain separate.
Only an opaque draft ID enters the resume URL; reload selects the correct wearer
from the authorized draft. Private values and query caches stay in memory and are
cleared on access loss. Unknown direct writes retain input/key/ETag; throttling
cannot discard an unresolved action. Stale proposals stay visible for explicit
comparison/reload and never rebase authority automatically.

## Integrity, policy and recovery

Additive migration `0019_minor_guardian_registration.sql` adds three tenant
evidence tables with non-null shop IDs, composite subject/guardian/previous-event
references, shop-led indexes, forced matching RLS policies and restricted runtime
grants. Wearer aggregate locking/versioning serializes age, guardian and purpose
changes. Immutable evidence and minimal audit/replay receipts commit together.
New guardian people use the existing person identity/search boundary without
becoming customers or exposing unrelated contact notes.

Default composition blocks guardian writes; the explicit existing loopback
synthetic composition admits the labelled draft fixture. Final authority method,
Tamil/English notice, retention, grievance, processors and live-data approvals
remain pending. No retention duration, production activation or legal-compliance
claim is supplied. Generic durable-draft replay still stores its tenant-private
snapshot under the inherited contract; approved retention/erasure must cover
that copy before live use.

Apply through the existing advisory-locked migration runner only after an
authorized backup. Verification uses disposable synthetic databases. Application
rollback keeps the additive compatible schema; no destructive down migration,
routine deletion, live import or deployment is included. Future narrowly audited
privacy functions must cover these personal values and evidence references.

## A–C registration acceptance mapping

| Label / obligation | Registration evidence and remaining boundary |
| --- | --- |
| CW-01 / CUS-01 | A: minimal optional-contact customer creation, search and reopen; no unique-phone assumption. |
| CW-02 / CUS-01/02 | A/B: shared-phone and matching-name people remain distinct; no automatic merge. |
| CW-03 / CUS-02 | B: explicit self/new/existing wearer. C: separate aunt, child and guardian. Garment/measurement links remain later integration. |
| CW-04 / CUS-04 | B: original expressed preferences/source; no locale, person or consent inheritance. |
| CW-05 / CUS-07 / TRU-03/04/13 | B/C: interaction statements and separate purpose decisions with named subject/giver; no blanket family access. |
| CW-06 / TRU-01 | Real PostgreSQL forced policies, runtime grants, missing-context and same-shop references across A–C. |
| CW-07 / TRU-03/07 | Shop-private summaries, memory-only values and access invalidation; no unrelated notes or customer access. |
| CW-08 / TRU-04/13 | B/C: independent grant/refusal/withdrawal, notice binding and no optional opt-in default. |
| CW-09 / TRU-05 / AC-53 registration | C: explicit age, separate guardian claim/verification, attributable minor decisions, pending/ineligible states, no minor marketing/publication grant. Actual measurement/photo write enforcement remains future 1.3.2/media tests. |
| CW-10 / TRU-05/07 | Registration exposes no measurement/photo/publication operation and claims no protection of absent endpoints. |
| CW-11 / TRU-04/13 | B/C: actual giver vs recorder, scope/source/times, immutable linked evidence; policy remains draft. |
| CW-12 / USE-01/02/09 | Automated bilingual three-size/focus/IME/axe/reflow checks; physical Android, fluent Tamil, screen reader and shop-lighting review remain human acceptance. |
| CW-13 / USE-03/04/08 | Server drafts/resume/promotion, retry/replay, offline retention in open forms, stale comparison and concurrency/rollback. |

AC-02 garment/measurement identity, AC-39 media and AC-52 rights/erasure remain
cross-slice obligations. A–C does not complete orders, measurements, media,
erasure, Phase 0.5, pilot readiness or any live-data gate. 1.1.1/1.1.2 and 1.2.1
dependencies are unchanged.

## Verification and review

Initial package builds passed after a typed repository mapping correction. The
first UI typecheck found an incorrect recovery method name and an unbuilt i18n
export; both were corrected. Biome identified a missing resume-effect dependency,
which was added. The first development PostgreSQL attempt had three fixture
mistakes (transaction-wrapper shape and draft PUT route); these were corrected,
not classified as product failures.

Independent review found historical-notice withdrawal binding and text-based
UUID lock normalization defects. The UI now pins the selected prior grant's
notice, displays its version and resets explanation on relevant changes. UUID
fields canonicalize before key/subject locking and request hashing. Fresh actual
two-connection tests prove concurrent mixed-case replay and age/grant races.
The review otherwise found no further substantive blocker in the reviewed scope.

| Command / scope | Observed result |
| --- | --- |
| Sequential contracts/db/core/auth/api builds | Passed. |
| `pnpm exec vitest run tests/guardians.test.ts` | 6/6, 503ms; final fast run includes the same unit inputs. |
| Guardian + D1/D3/D9/A5 PostgreSQL selection | 9/9 selected across 3 files, 85.37s from 14:30:15+05:30. |
| Actual parallel-pool retry / age-grant checks | Each 1/1, 9.22s from 14:32:15 and 12.58s from 14:32:50. These test-only refinements have independent results because the latter overlapped full-suite startup. |
| `pnpm verify:fast` | Passed 14:30:53.3527700–14:32:43.7170184+05:30; lint/boundaries/tokens, Knip, types, 172 unit tests/43 files, negative types, OpenAPI and production builds. |
| `node scripts/test-ui.mjs guardians.spec.mjs --max-failures=1` | 6/6, 10.5m, 14:32:48.2312869–14:43:28.1143880+05:30. |
| `pnpm smoke` and `node scripts/check-artifacts.mjs` | Passed 14:36:54.1804386–14:37:10.2011932+05:30; production readiness/outage, typed client, worker shutdown; 29 browser artifacts. |
| UI-only delta: `pnpm lint`, `pnpm knip`, i18n build, web typecheck/build | Passed 14:43:45.0235878–14:44:13.3604985+05:30. Final artifact scan passed again after rebuilding. |
| `pnpm test:integration` | Passed 110/110 across 24 files, 934.42s; 14:32:48.2038834–14:48:24.1778369+05:30. |
| `node scripts/test-ui.mjs guardian-resume.spec.mjs wearers.spec.mjs owner-entry.spec.mjs --max-failures=1` | Passed 12/12 (12.1m), 14:44:39.9768302–14:56:59.4226085+05:30. |

The first six-run matrix covers genuine Tamil names, both languages/themes,
focus, IME, axe, 320px/200% text reflow, draft save/reload/resume/promotion,
separate aunt/child/parent, pending/rejected/confirmed authority, wrong giver,
independent purposes, refusal/withdrawal, age invalidation, response loss/stable
retry, stale comparison and sign-out/late-response privacy canaries.

The prepared review session then exposed a saved-draft resume URL omission:
the form reopened but did not restore its opaque reload address. A one-line UI
correction restores/clears the appropriate address. A new focused three-size
regression checks bare-profile resume, reload into the correct child/form, close,
resume again and no authoritative claim. The bounded visual review also removed
inapplicable adult-purpose copy from new minor profiles; historical adult-purpose
records remain visible with explicit non-guardian wording. Fresh affected checks
are recorded separately rather than repeating unchanged backend/PDF stages.

[Initial_Source.sha256](minor-guardian-registration/Initial_Source.sha256)
identifies 473 inputs for the initial fast/browser/backend evidence; manifest
SHA-256 `1559084761e04b2b4f3dded6f4e3c37d05b8a990006364569edbf9287f4f8cd2`.
[Tested_Source.sha256](minor-guardian-registration/Tested_Source.sha256)
identifies 474 final inputs, SHA-256
`92d9c31a10ee2ba93ed595d55ffe890b4582faf62642cc2b950405759890dae2`.
Relative to the initial snapshot, only the guardian resume UI, existing wearer
UI/copy, review seed helper and new resume regression differ. Backend/database
inputs are unchanged. Both manifests use actual source bytes and LF separators.
All 474 final source hashes matched again at 14:57:42+05:30. Documentation-only
publication metadata follows. Local evidence covers 172 unit tests, 110 distinct
PostgreSQL cases and 18 three-size browser executions across the two snapshots;
the affected UI delta has its own fresh lint/Knip/types/build and browser checks.
No failing local check remains unresolved. Hosted CI and human acceptance remain
separate.

No dependencies, lockfile, package export maps, toolchain, install/build scripts
or runtime packaging changed; supplementary clean-install/native packaging and
an additional Linux image are not triggered by this slice. PDF production/test
inputs are unchanged and no PDF capability is added; earlier golden evidence is
retained as baseline, not described as a fresh PDF run. Promotion and actual
pilot/device/privacy gates remain required.

## Human review packet

Final-build running host:
http://127.0.0.1:54687/customers/01a14924-ae95-761c-bdfa-61ba5dd2abea.
The dedicated review tab is privately signed in. The synthetic aunt, child and
separate parent are prepared, with pending authority and a saved claim draft for
the existing parent's identity. No affirmative consent is seeded. Startup is
`node scripts/review-guardians.mjs` after building; ephemeral credentials stay in
`.scratch/guardian-review-host/private.json`, outside Git/chat. Stop with
`node scripts/review-guardians.mjs stop` to clean that access and database.

1. Select the named child. Compare the aunt/contact and parent names/references;
   inspect the pending authority and absence of any DOB/document/photo input
   (CW-09/11). A family relationship is not verified authority.
2. Resume the guardian draft, reload and close/reopen it. Confirm the correct child
   and parent remain named and the URL contains only an opaque draft ID. Recording
   a claim creates pending authority only; it does not grant permission (CW-13).
3. Review the separate authority observation. Use the explicitly labelled test
   method and invented evidence reference to exercise confirmation; inspect the
   original statement vs recording owner/source/times (CW-09/11).
4. For a purpose decision, try the aunt as giver (blocked), then deliberately
   choose the identified guardian. Refuse private photos separately from a
   measurement decision; withdraw a grant and revisit the record. Check linked
   evidence/current ineligibility and the absence of any measurement/photo action
   (CW-08/09/10/11).
5. Compare stale saved authority with an open proposal, retain offline input,
   resolve a lost response with the same action, and switch people. Repeat long
   Tamil text/IME, focus and announcements on physical Android, tablet and desktop
   with actual assistive technology (CW-12/13).

Respond `CW-09/CW-11/CW-12 — pass/fail — observation`, naming physical
device/browser and language or assistive technology where relevant. Fluent-Tamil,
screen-reader, shop-lighting and physical-device acceptance remain pending;
automation/emulation does not substitute for them. Owner merge authorization and
final privacy approval remain separate.
