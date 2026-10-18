# Service catalogue implementation evidence

Issue [#97](https://github.com/nishanthturnstile/aarili/issues/97), slice **1.1.2a**.
SET-03/08/09; ST-01/07/10–12; AC-07 configuration contribution. Product
§§3/6/9/10/24–25/27/29.1/30.1/32–33 and architecture §§6–11/15 govern the work.
The [approved packet](Service_Templates_Ticket_Packet.md),
[independent design](Service_Templates_Design.md) and
[REA ledger](Service_Templates_REA_Evidence.md) retain their different authority.
No new competitor observations were needed after approval.

## Authorization and baseline

Owner: “approved and proceed” after the concrete A–E packet and A selection.
Published #97–#101 through authenticated gh, with existing labels and native
blocking edges; bodies/labels/blockers were read back. #97 is selected; B–E
remain behind merged-prerequisite gates. No implicit merge/deploy authorization.

Existing checkout, `codex/service-catalogue` from current `origin/development`
`964b863336a5f666df6b8a0f282cff71846ee57f`. All ten direct blockers have merged
closing PRs: #84→#89, #85→#90, #86→#92, #87→#91, #88→#93, and the existing
foundation #16/#51/#53/#55/#56 closing PRs were freshly verified through gh.
Readback retained in ignored `.scratch/service-templates-tickets/A-blocker-merges.json`.
PR #93 required Fast verification and Dependency audit passed in
[run 39105373390](https://github.com/nishanthturnstile/aarili/actions/runs/39105373390).
The immediately preceding documentation checkpoint also passed fresh fast checks.
No worktree/reset/stash or unrelated branch/edit cleanup was used.

## Implemented boundary

One canonical tenant catalogue holds category, subcategory, service, physical
outfit-piece and add-on definitions. Stable lowercase codes are unique per
shop/kind and cannot be reassigned or renamed; bilingual names/description/aliases,
category warning override and exact parent/composition references are revisioned.
Subcategories require categories; services require category/subcategory parents.
Only services can compose pieces/add-ons, with explicit optional flags and order.
Wrong-kind, duplicate, self, missing, foreign, disabled and stale pinned references
are denied. Fixed kind topology prevents recursive category/workflow cycles.

Search uses existing Tamil/Latin/skeleton search keys, separately from preserved
labels and aliases. Queries are POST bodies, never business text in URLs. It is
bounded/keyset-paged and tenant-scoped. It is not the pilot's full recall benchmark.
Nullable category warningDays means no extension. Integers 0–3,660 are a technical
bound; no value/lead time/cap/rush policy is invented. E (#101) must consume the
reviewed exact category/window through the existing resolver and rule-binding seam.

Definitions and availability have independent immutable records. Every reviewed
definition has a server-derived content hash/provenance and an append-only
availability decision. Availability-only commands pin the same definition and
cannot smuggle content changes. Disable/re-enable has explicit review/reason
and history. Current configuration eligibility also checks referenced current
availability and exact definition IDs; source changes need explicit new review.
Historical revision reads remain readable. There is no published-definition delete.

The server classifies synthetic verification records through the existing trusted
synthetic composition; ordinary records remain owner-proposals. No client approval
or load flag grants production authority. The interface states production approval
and templates/intake are pending. Definition publication is configuration review,
not business-policy activation. No official initial catalogue is silently seeded.
The review host supplies only clearly labelled synthetic fixtures.

The existing durable draft workflow performs online save/recovery, exact-key
retry, ETag 428/412, validation 422 and domain 409, publication/audit/result atomicity
and explicit conflict comparison. Core is framework-free; membership-checked
auth composition supplies transaction-bound DB repositories. Thin Node Hono
routes and typed clients cover list/current/revision/definition/history.
Pinned references render names from their exact historical definitions, never
from a mutable current-name lookup. Strict DTOs reject
extra client authority; request bodies and responses are private/no-store.
No business Server Actions, browser business persistence or new dependency.

Measurement forms (#98), operating templates (#99), Simple/Detailed preview
(#100), ApprovedCategoryResolver implementation/real commitment binding (#101),
orders, live-load acceptance, production, money, custody and customer confirmation
remain outside #97. The existing null resolver and evaluator were preserved.
No new order/measurement/charge/message/production job is emitted by this screen.

## Migration and recovery

`0025_service_catalogue.sql` is additive: stable entry/current pointer,
immutable definition revisions, availability/history events and relational
reference rows. All four tenant tables have non-null shop_id, composite tenant
keys/FKs, shop-led uniqueness/indexes and ENABLE/FORCE RLS with matching policies.
Definitions/references/events deny ordinary UPDATE/DELETE; pointer writes require
same-transaction provenance and sequential CAS. Deferred constraints check the
promoted draft result, complete references and complete definition publication.
Runtime remains app_user, with no table ownership or BYPASSRLS. The dynamic
isolation catalogue and explicit path/table regression inventories include them.

Migration uses the existing advisory-lock runner. No approved data backfill,
old-rule relabelling, destructive down migration or live migration is performed.
Back up/review SQL before non-disposable application. Compatible app rollback
retains additive history; privacy/retention and restore/pilot gates remain intact.
Existing populated owner/customer/wearer/settings state is preserved by expansion.

## Ticket acceptance mapping

| #97 acceptance | Concrete implementation and automated proof | Remaining gate |
| --- | --- | --- |
| 1: canonical kinds, composition, save/reopen/review/publication | Core/SQL kind topology; PostgreSQL creates blouse, salwar composition, alteration and small-service; browser creates/reloads/publishes category and composed service | Owner content review |
| 2: invalid parents/cycles, tenant links, keys, Bridal/retail | Strict command/property cases; real PostgreSQL wrong-kind/foreign/missing/duplicate negatives, tenant RLS and protected writes | Production catalogue remains empty |
| 3: exact revisions and availability | Separate immutable definitions and availability events; PostgreSQL rename/window/history, disable/re-enable identical definition, stale source rejection; browser read-only history/disable | Historical order/PDF consumers remain later slices |
| 4: vocabulary, Tamil and durable recovery | Exact pinned definition read endpoint with foreign-shop 404; browser Tamil IME/language/history, committed lost-response retry, reload/resume and stale-draft comparison | Fluent Tamil/physical Android/assistive technology |
| 5: search and category warning | Existing Tamil/Latin/skeleton index keys; three-script search and foreign absence; nullable/explicit window history; bounded integer property/command cases | Full pilot recall corpus and approved production window |
| Shared ST-10/12 | Actor/hash/key replay and race, 428/412/409/422, five post-write rollback points, forced policies, populated upgrade/path regression; no later-slice command introduced | CI/owner review; restore/privacy/live-data gates |

## Verification ledger: attempts and final evidence

All commands refer to the dirty #97 branch above; private logs/captures remain in
ignored `.scratch/catalogue-*` or `.scratch/service-catalogue-captures`.

- Initial package build passed 10 tasks (10.516s). Initial and subsequent strict
  typechecks passed all 23 tasks plus the root test check.
- Three focused unit/property cases passed (0.384s) after correcting a test
  callback that returned Vitest's matcher result rather than void; no runtime
  rule was changed for that fixture correction.
- Initial real PostgreSQL suite passed 2 cases (15.45s): catalogue/reference
  integrity, search/isolation/history, CAS/replay/concurrency and five fault
  points after actual domain/pointer/draft/audit/result writes.
- Scoped PostgreSQL regression passed **8 selected cases in 4 files** (67.43s;
  18 deliberately excluded), including tenant path inventory, FORCE-policy drift,
  retained bootstrap/schema upgrade and draft journeys. A pg overlapping-query
  deprecation warning motivated sequential catalogue queries on the one transaction
  client; follow-up focused evidence is recorded after execution.
- First fast gate stopped on formatting; corrected only the named files. The
  next gate passed lint/boundaries/tokens, Knip, strict types, **211 unit tests
  in 49 files**, and negative-type checks, then caught offline OpenAPI mounting
  a second app as a third route argument. Corrected into separate mounts and
  added four explicit catalogue-route assertions. `pnpm openapi` then passed
  **52 paths**; production build passed 12 tasks (20.693s).
- Following the sequential-query change, production build passed **12 tasks**,
  22.873s, without cache reuse. Final fast evidence follows below.
- Frozen clean install/export check passed: fresh package builds (19.728s), all
  seven new public module exports and existing critical exports imported, lockfile
  unchanged. Required because package exports changed; no dependency migration.
- Initial phone/tablet/desktop browser attempts reached first catalogue publication
  then failed on **429** during rapid API fixture setup. The test now honors
  Retry-After and existing safe UI retries; runtime admission limits are unchanged.
  The exploratory phone rerun then exposed a retry-state fixture assertion. Initial plain-node browser harness was
  24.20.0; final verification uses pinned `pnpm exec node` 24.21.0.

- Follow-up real PostgreSQL command `pnpm exec vitest run --config
  vitest.integration.config.ts tests/service-catalogue.integration.test.mjs`
  passed **2/2**, 20.88s, after the deferred definition publication guard,
  sequential query change and exact-definition endpoint. Cross-shop definition
  reads return 404; no-context and immutable-history negatives remain covered.
- A native-exit confirmation run hit the unchanged jobs property test's 5,000ms
  deadline (5,073ms) while fixtures were starting. Isolated `tests/jobs.test.ts`
  passed **2/2** in 0.441s without a timeout change. The next complete
  `pnpm verify:fast` exited **0**, including lint/boundaries/tokens, Knip,
  23 type tasks plus root, **211 units in 49 files**, negative types,
  **53 OpenAPI paths**, and production build **12 tasks**, 14.09s.
  Host/script stderr initially made PowerShell's wrapper status ambiguous;
  the final invocation explicitly recorded and returned `$LASTEXITCODE`.
- The added browser conflict assertion initially read GET's bare DraftRecord as
  save's `{draft}` response. Corrected the test only. All three already-loaded
  workers retained that earlier assertion; their failure is preserved. Captures
  also needed resetting detail/history between languages and scrolling to document
  top; these fixture corrections precede the fresh complete browser run.
- Corrected browser command `pnpm exec node scripts/test-ui.mjs
  service-catalogue.spec.mjs --max-failures=1` exited **0**, **3/3** (7.2m),
  Node 24.21.0. English/light and Tamil/dark: 360x800 phone, 820x1180 tablet,
  1440x1000 desktop; axe returned no violations for list, editor and composition.
  Includes valid publication, incomplete draft, pinned composition labels,
  availability/read-only history, committed lost-response exact-key retry,
  reload/resume, IME/language, stale comparison/keep-local, dirty cancel and
  sign-out/private storage. Twenty-four fresh complete captures were validated.
  The parent design's 1440x900 height has not been claimed by this run.
- Impeccable detector ran once against the new screen: exit 0, empty findings.

- Independent finish review inspected all 24 originals and requested three material
  fixes: max-window/null wording, complete server availability/reason comparison,
  and labelled expandable exact definition IDs. Applied one correction batch in
  the screen/messages plus the shared existing summary-control selector (44px
  target); no core/API/SQL change. No second detector was run, per the skill.
- Affected `pnpm verify:fast` exited **0** after that batch: **211/211** unit tests,
  strict types/negative checks/lint/Knip, 53 OpenAPI paths, production build 12
  tasks in **12.88s**. Updated browser assertions cover disclosures, null meaning,
  helper wording and reason/availability-only conflict visibility. Final desktop
  viewport is set explicitly to **1440x900** to match ST-11.

- First post-review browser recapture stopped on the obsolete pre-review
  assertion that selected references must contain no ID. The requested disclosure
  intentionally includes it. Replaced that assertion with the exact primary-label
  check plus expanded-full-ID visibility; no runtime change. Original failure
  retained in `.scratch/catalogue-browser-reviewed.log`.
- Independent documenter completed source-level ordinary-extension conformance:
  canonical light/dark palette, Noto English/Tamil 400/600, shared geometry and
  controls, existing shell and semantic states. No source blocker or new visual
  world. Missing conventional PRODUCT/DESIGN artifacts are pre-existing and were
  not repaired. Report `.scratch/catalogue-design-conformance.md`.

- Post-correction phone and tablet passed the full updated workflow (2.3m/2.4m)
  in the all-project attempt. Desktop's first attempt then found a fixture race:
  language/capture work allowed existing autosave to finish, so manual Save sent
  no request for the loss injector. The fixture now waits for a saved state,
  makes a new dirty description edit, asserts the intercepted server response is
  **200**, then drops it and retries the identical key. No runtime change.
- Scoped final desktop rerun `pnpm exec node scripts/test-ui.mjs
  service-catalogue.spec.mjs --project=desktop --max-failures=1` exited **0**,
  **1/1** (2.9m total; scenario2.5m), with **1440x900** viewport. Together with
  the corrected phone/tablet passes, all three target workflows passed after
  source corrections. This is composite evidence, not a claim that the failed
  all-project invocation exited0. Final33 captures (11perviewport) were opened
  and validated; final fix-list verdict follows below.

Final independent verdict: **ship at the three-fix-list scope**. All three
requested corrections were scored resolved after inspecting all33 originals;
no batch regression was observed. This does not re-certify the whole surface or
establish human/whole-parent acceptance. The independent documenter completed
ordinary-extension source conformance (canonical palette, local Noto400/600,
shared geometry/controls, incumbent shell, preserved semantic states).

Local implementation and owner-review packet ready at **2026-10-18T17:41:13+05:30**.
Human acceptance, feature CI, merge and deployment are pending. Full jobs/media/PDF/smoke and
browser promotion suites remain the development→main gate; focused #97 checks
and remaining human observations are recorded separately when complete.

## Owner review packet

Start `pnpm exec node scripts/review-service-catalogue.mjs` after the production
build. It prepares an isolated disposable database and loopback production host.
Private synthetic sign-in is written to ignored
`.scratch/service-catalogue-review-host/private.json`; credentials stay out of
chat/Git. Route: `/settings?section=catalogue`. First ready observation **17:09:57 IST**, 18 October 2026:
http://127.0.0.1:59715/settings?section=catalogue (first usable host).
An intermediate refresh was observed at 17:16:47 IST on port 52060.
After the reviewer correction build, the final host was observed ready at
**17:31:39 IST**: http://127.0.0.1:57597/settings?section=catalogue.
HTTP 200 was checked
after startup; the host runs pinned Node 24.21.0 against the production build. No tunnel or production shop is created.

1. ST-01: find blouse using English/Tamil/Tanglish. Inspect the synthetic salwar
   service's optional bottom and pico reference. Create a draft for a new piece;
   save/reload/resume and review both names, stable code and reason.
2. ST-07: revise a definition and inspect actor/effective history. Use availability
   only to disable it; linked new configuration becomes unavailable while old
   definitions remain readable. Re-enable explicitly and compare exact versions.
3. ST-10/11: test dirty cancellation, failed-save retry and conflict comparison;
   change language while editing. Review Tamil and focus/targets on an actual
   Android and assistive technology. Terminal checks need no owner replay.
4. ST-12: verify the pending templates/production-authority explanation. No order,
   measurement, payment or production action is offered here.

Report `ST-ID — pass/fail — observation`, with device/browser/language for the
human checks. Production catalogue/forms/policies, fluent Tamil, physical Android,
screen reader, full parent-slice acceptance, restore/privacy and live-pilot gates
remain pending. Stop with `pnpm exec node scripts/review-service-catalogue.mjs stop`;
the host removes its disposable data/private access file. Merge stays separate.
