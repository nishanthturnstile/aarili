# Commitment preview implementation evidence

Issue [#88](https://github.com/nishanthturnstile/aarili/issues/88), slice **1.1.1e**.
SET-06/08/09/11; SS-05–10; AC-28 warning seam, AC-44 configuration portion and
AC-60 evaluator portion. Product §§6/20/27/32, architecture §§6–9/15 and the
[approved independent design](Shop_Settings_Design.md) govern this implementation.
The existing [REA evidence](Shop_Settings_REA_Evidence.md) is reused without
new competitor-runtime observations or sign-in. Observations, inferences and
unknowns retain their separate classifications there. No competitor code or
assets are imported.

## Baseline and scope

Root checkout branch `codex/commitment-preview`, based on development
`6f3918ead53fbeabe1388a4a915102e0d1e7648b`. Direct blockers #85 and #87 are
closed and merged (PR #90 `2e3118f`, PR #91 `6f3918e`); independent #86 is
also merged (PR #92 `fa744dd`). The integrated baseline's two required checks
passed in [run 39052315148](https://github.com/nishanthturnstile/aarili/actions/runs/39052315148).
No new worktree was created. The full issue body and empty comment list were read.

The implementation adds warning settings, a category-neutral evaluator,
unbound durable rule drafts, append-only preview configuration revisions,
and an owner-only transient preview. It creates no order, reservation, charge,
alert acknowledgement, job, message or real category. There is no activation
endpoint. Production policy approval remains outstanding.

## Noncircular catalogue and acceptance boundary

`ApprovedCategoryResolver` is a repository-side core interface. The current
authenticated composition resolves no production categories. The request cannot
provide an approved category object or authoritative load: strict DTOs reject
those properties. A synthetic mode selects a server-owned labelled fixture;
production mode reports missing category/load/authority.

Every published revision has `authorityScope: unbound-preview`. Its
`originDraftId` identifies the unbound rule draft; the revision has its own ID,
version, previous revision, actor, schema version and immediate database effective
time. Multiple unbound drafts may coexist. There is no category catalogue here.
1.1.2 implements the resolver and composite tenant binding references to these
immutable revisions; it does not become a prerequisite of this ticket.
1.2.1 must re-read live load and eligible category/rule versions, serialize the
capacity bucket and pin inputs/decisions at acceptance. A preview fingerprint
does not authorize booking. Full integrated SET-11/AC-60 remains in those slices.

## Explicit fixture conventions and unknowns

The product supplies the initial **three calendar-day** shop warning window,
Asia/Kolkata and normal/rush choices. A resolved longer category window uses
`max(shop, category)`; occasion never changes priority.

Only labelled synthetic fixtures choose the following assumptions: Monday-based
weeks (`0`); demand allocated to requested delivery date; lead-day counting over
`[booking date, delivery date)`; all matching inclusive delivery peak ranges;
booking strictly after each cutoff warns, equality is allowed; zero cap means
closed capacity. The fixture has five calendar lead days, cap ten garments,
existing demand ten garments, a seven-day category window and 50,000-paise rush
suggestion. Its peak is 20–31 October 2026, cutoff 18 October at 18:00. The
initial candidate is one garment booked 20 October for 22 October. These values
are synthetic review inputs, not business defaults or production approvals.

Missing lead/cap/unit/week convention/calendar/category/load/rush suggestion
remain unknown. Zero is preserved separately. Unit mismatch is an explicit
unresolved error with no conversion or reassuring clear result. Known warnings
remain visible alongside unknowns. Production configuration authority always
remains unresolved in this delivery, even if a browser selects fixture labels.
Warning acknowledgements and charge waivers never remove warning facts.
Hypothetical review requires nonblank exception/waiver reasons where applicable;
decisions exist only in the transient response.

Dates use local-date UTC arithmetic without machine-local DST. Passed explicit
delivery slots use strict time comparison; otherwise the production working-day
end is used, or remains unresolved. Capacity weeks are half-open; an unrepresentable
week at the supported four-digit date boundary is unknown. Technical bounds
(3,660 warning/lead days, 1,000,000 demand/cap, 32 peaks and safe integer paise)
are input/resource limits, not approved business policies.

## Persistence, privacy and recovery

Additive migration `0024_shop_commitments.sql` introduces the tenant current
pointer and immutable revision table. FORCE RLS, composite tenant foreign keys,
restricted grants, verified actor/audit/draft provenance, deferred promotion
link checking and same-transaction pointer publication follow the existing
calendar/policy pattern. An advisory publication lock and base revision/version
comparison prevent first-publication and stale-write races. The existing draft
command commits revision, pointer, draft lifecycle, audit and replay result
atomically. Retrying the same command replays; changed payload does not.

Audit metadata excludes configuration/free-text content. Business values remain
in server drafts/revisions or memory. API responses are private/no-store; URLs
contain only section and opaque draft identity. Sign-out invalidates owner scope.
No browser business storage, payment data, credentials, real identifiers or
outbound integration is introduced. Controlled privacy erasure and production
retention approval remain existing gates, not a general revision-delete API.

Before applying outside disposable development, back up and review the SQL.
Application rollback retains additive schema/history; no down migration, bulk
rebinding, production migration or deployment was performed. Migration advisory
locking remains in the shared runner.

## Acceptance matrix

| Issue acceptance | Implemented evidence | Remaining boundary |
| --- | --- | --- |
| E1 warning window/basis, longer category, occasion | Contract/pure evaluator tests; durable configuration; production calendar resolver | Real category eligibility/binding in 1.1.2 |
| E2 AC-60 fixture, reason and waiver | Pure tests and owner preview show cap 10, load 10+1, cutoff, two lead days, rush 50,000 paise; reasons separate | No real booking or financial effect |
| E3 missing/zero/boundaries | Unit/property tests for cap/cutoff/lead equality, year/week edges, all-closed/missing calendar, zero and unit mismatch | Owner production conventions unapproved |
| E4 no activation/foreign authority/history | Strict DTOs, resolver denial, RLS/foreign reads, immutable rule/calendar revision tests | Catalogue bindings remain 1.1.2 |
| E5 acknowledgement/staleness | Risk facts retained; configuration/source/candidate/load fingerprint; UI marks changed preview | Atomic acceptance/load reservation remains 1.2.1 |
| E6 common integrity and UI | Real PostgreSQL replay/CAS/concurrency/five rollback points; bilingual browser/recovery and repository gates below | Human and hosted checks recorded separately |

## Verification ledger

All new-source results refer to the dirty `codex/commitment-preview` tree above.
Logs are retained in ignored `.scratch/commitments-*`; they are not production data.

- Initial packages build passed 10 tasks, 10.88s. Initial 205 unit tests passed
  in 48 files, 36.28s; the attempted file argument to `pnpm test` ran the full
  unit suite. Later focused commands use `pnpm exec vitest`.
- First strict type check found a generic translation-key typing error in the
  editor. Corrected dynamic key conversion; subsequent strict check passed all
  23 tasks, 10.257s, plus the root test TypeScript check (exit 0).
- Initial real PostgreSQL: three new suites passed, 53.39s. Publication/replay,
  history, tenant/foreign reference denial and concurrent first publication
  were exercised with `app_user` runtime. The initial fault-injection assertion
  accepted any rejection and was insufficient; the corrected evidence below
  supersedes that part of this preliminary result.
- Initial production build passed 12 tasks, 43.96s.
- First phone browser reached warnings/reasons/recovery, then failed horizontal
  reflow (12.0s). A diagnostic run (10.9s) identified three native selects with
  long options. Scoped select sizing and existing input styling were corrected;
  no domain/rate policy changed. Both failures are retained.
- A subsequent browser matrix reached the corrected reflow states, then exposed
  a shared draft-recovery defect after undoing back to acknowledged values:
  dirty became false but status remained `notSaved`, blocking publication.
  Phone/tablet failed (26.1s/24.3s); the remaining run was stopped. A focused
  regression failed before correction and passed afterwards. The shared state
  transition now restores saved status only with no pending/in-flight command;
  retry, conflict and uncertain outcomes keep their protections. All 27 focused
  draft/evaluator cases passed in 0.447s.
- `pnpm verify:fast` then exited 0: 207 unit tests in 48 files, all lint,
  boundaries/tokens, Knip, 23-task strict types, negative declarations, offline
  OpenAPI (48 paths, all four commitment routes explicitly asserted) and
  production build (11.813s). A separate earlier attempt stopped on formatting
  after strengthening the integration assertion; formatting was corrected.
- Corrected production Playwright/axe matrix passed **3/3**, 1.2m, with English
  light/Tamil dark at 360/820/1440. It checks missing inputs, cap/cutoff/rush,
  exception/waiver reasons, unchanged risk, stale preview, IME validation,
  actual lost-response/exact-key retry, cross-context server-draft recovery,
  dirty navigation/undo, unbound publication/history, load outage/retry,
  exact-ID Tamil resume, static-only PWA storage and sign-out/back.
- Scoped real PostgreSQL regression selected 12 distinct cases across seven
  suites. First run: nine passed and three failed, 26 deliberately excluded,
  87.10s. Two existing-draft fixtures asserted Map insertion order rather than
  registry membership; comparison now sorts the keys. The stronger rollback
  assertion exposed swapped `mutateDraft(id, action)` test arguments and a 422
  before fault injection. Correcting those fixtures yielded all three affected
  cases passing in 23.16s. The five rollback points now require `/injected/`
  after each actual write, check unchanged totals and active draft lifecycle.
  No runtime policy, rate limit or timeout was weakened. The nine unchanged
  passes cover new publication/history/authority, forced-RLS catalogue/drift,
  registered tenant paths, retained bootstrap/schema upgrade, owner isolation,
  existing calendars/policies and populated customer/adult/minor upgrade.
- Final pure evaluator suite passed ten tests (0.512s), adding complete synthetic
  clear vs missing-load unknown and changed-load fingerprint regression.
- All 18 full-page captures were inspected. The single required detector returned
  `[]`. The fresh [finish reviewer](Shop_Commitments_Finish_Review.md) returned
  `fix`: two computed fact labels reused editor meanings, and typed unit values
  needed Tamil translation. One batch adds separate available-lead/date labels
  and translates unit enums. The apparent phone overlap was a display artefact;
  standalone review confirmed clean spacing and no layout fix was required.
  The same reviewer reopened all 18 refreshed captures and scored both fixes
  **resolved**, with a scoped `ship` verdict; this is not fresh whole-surface or
  human acceptance.
- Final `pnpm verify:fast` exited **0**, with **208 tests/48 files** (10.40s),
  all lint/boundaries/tokens/Knip/strict types/negative declarations/OpenAPI
  checks and production build (12.97s). Final Playwright command exited **0**:
  **3/3**, 1.2m; all 18 same-path captures refreshed, with extra bilingual
  assertions for available lead 2, capacity-week date and units. The reviewer
  separately confirmed the configured required lead remains 5.
- `pnpm exec node scripts/verify-shop-commitments-exports.mjs` exited **0**:
  frozen clean install, fresh package builds and every new public export imported;
  lockfile unchanged. 12:14:27.792–12:15:48.950 IST, **81.160s** wall time,
  inner fresh package build 14.429s. Required because package export maps changed.
  No dependencies, pins, toolchain or lockfile changes.
- The 34 changed implementation/test/script files retained their recorded hashes
  through final browser verification; aggregate SHA-256
  `b0ffe8d47c2b145a5b60da6e3ac75d03697e978c18d6ad06df3b8aef7147b7fe`.
  Subsequent changes are documentation only. Full promotion verification,
  dependency audit and physical-device/language/AT acceptance were not run
  locally; unchanged dependency audit remains a hosted feature gate, and full
  jobs/S3/PDF/smoke verification remains the promotion gate. No PDF capability,
  dependency or runtime packaging change is introduced here.
- Fresh [design conformance documentation](Shop_Commitments_Design_Conformance.md)
  confirms the ordinary extension retains incumbent visual authority and records
  the existing narrow-navigation design difference without changing it.
  The local review packet was complete by **12:17:20 IST**. Owner acceptance,
  hosted CI and publication/merge metadata remain separate from local results.

Publication: implementation commit `84f7cdb`; draft
[PR #93](https://github.com/nishanthturnstile/aarili/pull/93) created at
2026-10-18 12:18:19 IST against `development`, linked to this T3 thread and
confirmed to close #88 on merge. Initial required Fast verification and Dependency
audit were in progress in
[run 39105340366](https://github.com/nishanthturnstile/aarili/actions/runs/39105340366).
This metadata-only follow-up preserves the recorded implementation hashes.
No merge, promotion, deployment or production authority was performed.

## Owner review packet

Running synthetic review observed ready at **2026-10-18 12:16:29 IST**:
[delivery and commitments](http://127.0.0.1:54207/settings?section=commitments).
Own disposable PostgreSQL port 36087; other review hosts were not touched.

Run `node scripts/review-shop-commitments.mjs` after the production build.
It creates an isolated disposable database/loopback host and a synthetic server
draft. Read its exact URL and private sign-in from ignored
`.scratch/shop-commitments-review-host/private.json`; credentials stay out of Git
and chat. The route is `/settings?section=commitments`.

1. SS-05: open the saved synthetic draft, inspect warning window and unbound rule.
   Changing occasion must leave owner-selected priority unchanged.
2. SS-06: evaluate the synthetic candidate. Observe cap/current/candidate,
   cutoff and rush facts. Select missing-load then production readiness and
   inspect warnings alongside unknowns. Supply review/waiver reasons; risks stay.
3. SS-07: save/reopen, publish an unbound preview revision, then inspect its
   history/effective time. No category activation or order/charge is offered.
4. SS-10: review Tamil on an actual Android phone, keyboard/screen reader and
   real shop lighting. Report `SS-ID — pass/fail — observation` with device,
   browser and language where relevant.

Automated terminal checks do not require owner repetition. Physical Android,
fluent Tamil, assistive-technology, business-policy acceptance, hosted CI,
merge, promotion/deployment, restore/privacy and live-pilot gates remain pending.
Stop with `node scripts/review-shop-commitments.mjs stop`; private access and
disposable data are removed by the host. No tunnel or live data is used.
