# Design specification delivery and verification status

22 October 2026. Roadmap **1.3.1**. **Software packet approved; selected A1
[#146](https://github.com/nishanthturnstile/aarili/issues/146) implemented for review.** [Design](Design_Specification_Design.md),
[ticket packet](Design_Specification_Ticket_Packet.md),
[research evidence](Design_Specification_REA_Evidence.md).

Draft [PR #149](https://github.com/nishanthturnstile/aarili/pull/149) contains A1;
A2/B remain blocked/unselected. The broad clean-copy run finished **248 passed /
4 failed**; its missing workflow-inventory entry was corrected and the affected
file passed **6/6**. The whole broad command was not rerun. Current focused gates,
native portability, known failures and the running review packet are detailed
below; no full-parent-feature, human acceptance or live activation claim.

## Authority and selected outcome

After the concrete packet was presented, the owner explicitly answered
**“approved”** to publication and A1 selection. Published #146/#147/#148, read back
their native blockers, and selected only A1. All #146 direct blockers (#97/#98/
#99/#53/#55/#16) are merged, with closing commits in both development and main.
Created `codex/design-choices-a1` from updated development in the same checkout.
A2 #147 and B #148 remain blocked and unselected. Owner merge, real-data policy,
physical-device/Tamil/assistive-technology acceptance and deployment stay pending.

The following baseline/preparation sections retain what was observed before
approval; they do not describe the current implementation scope. Current A1
acceptance and fresh results follow under **A1 implementation** below.

## Historical preparation baseline evidence

`git status --short --branch` initially: `development...origin/development`,
modified roadmap and untracked `Design_Specification_REA_Prompt.md`. Both predate
the task and are preserved. `git fetch origin` succeeded. HEAD and
origin/development: **154a456ca6d132857216371694e5de08a661155f**;
origin/main: **0f784206eca5b0d0bede91ab2be62de9b5afc77c**.
Created `codex/design-specification-packet` in the same checkout, no worktree.
No application source, dependency, lockfile, migration or protected branch changed.

Commands inspected current issue titles/states/labels/comments, merged PR closing
references, native blockers (`gh api .../issues/114/dependencies/blocked_by`),
current CI and actual source. All inspected prerequisite issue comments were empty.
`gh issue list --repo nishanthturnstile/aarili --state all --search '1.3.1'`
returned `[]`; all-state inventory had only #28 open. Proposed A1/A2/B have no
native issue edges until approved publication.

| Prerequisite | Merged closing PRs; merge commits checked as ancestors of development AND main |
| --- | --- |
| 0.2.3 #16 | #21 |
| 0.4.1 #51/#52/#53/#54 | #61/#62/#64/#66 |
| Durable drafts/recovery #55/#56 | #65/#68 |
| Private uploads/processing #57/#58 | #67/#69 |
| 1.1.2 #97–#101 | #102/#104/#105/#107/#106 |
| 1.2.1 #113/#114 | #115/#116 |
| Grouped #118–#120 | #121–#123 |
| Small services #124–#126 | #127–#129 (plus #131 follow-up) |
| Repeat/history/identity #134–#138 | #139–#143 |

All `git merge-base --is-ancestor` checks above returned 0 for both branches.
Do not infer readiness from older pending headings in those evidence files.
Feature fix [PR #145](https://github.com/nishanthturnstile/aarili/pull/145)
merged 04:12:22 UTC; current-development Fast verification and Dependency audit
passed in [run 39720707778](https://github.com/nishanthturnstile/aarili/actions/runs/39720707778).
Promotion [PR #144](https://github.com/nishanthturnstile/aarili/pull/144)
merged 04:34:41 UTC; Scaffold verification, all nine browser shards, aggregate
Browser smoke/accessibility and audit passed in
[run 39721124709](https://github.com/nishanthturnstile/aarili/actions/runs/39721124709).
These are inspected inherited-baseline results, not fresh acceptance of 1.3.1.
They are background PRs, not PR work created or modified by this thread.

## Historical preparation coverage (before approval)

| Requirement | Reviewable artifact; implementation status |
| --- | --- |
| DES-01 | Design D1, source-seam inventory, A1 profile/choice publication and B rights-controlled examples. Not implemented. |
| DES-02 | D2/D3, four separate stable fields and intended-dimension distinction; DS-A1-02 / DS-A2-01. Not implemented. |
| DES-03 / AC-07 | D4/D7, current availability plus exact historical labels, explicit inactive retention/replacement/reactivation, repeat/new-use rules and races. Not implemented. |
| DES-04 | D2–D6, garment/piece applicability, immutable saved values, separate draft/current selection/concurrency; A2. Not implemented. |
| DES-05 | D5/D6/D10/D11, inspiration/instruction/approval distinction, annotations and successor reference associations; A2+B. Not implemented. |
| ORD-07 | D8–D11, images/documents/sketches/voice notes, exact component/version/source/uploader/date and existing format profiles; B. Not implemented. |
| DES-10 / AC-53 | D9/D12, private/reusable rights, current guardian authority, cross-wearer/repeat/merge denial, privacy tombstones; B. Not implemented. |
| AC-08 | Manual/external route remains possible; automatic drafting never implied. Actual method records are 1.3.3; full scenario open. |
| AC-40/55, isolation/history | Proposed PG/worker/browser negative/concurrency/retry/rollback tests in every ticket. No new runtime claims. |
| DES-06–09/11, MEA, PAT, ORD-10 | Approval/change control 1.4.3, measurements 1.3.2, pattern references 1.3.3, slips/PDF 1.3.4 remain open. |

REA executed bounded login-boundary and TailorMan observations. Authenticated Nool
sheet/attachment actions used T3 after the owner chose that fallback. Full raw
captures remain outside Git; precise IDs, actions, failures and unestablished
history/privacy capabilities are in the research record. No real data used.

## Preparation verification ledger (before implementation)

Preparation documentation checks and actual repository command results are
recorded below after execution. No software ticket acceptance or completion is
claimed. Verification-before-completion governs final reporting.

- Applied the installed verification-before-completion skill. Preparation check
  `node %TEMP%/aarili-design-spec-rea-20261022/verify-packet.mjs`: **exit 0**;
  four documents, **28 local links**, **D1–D18**, nine primary requirement/
  scenario IDs, **23 ticket acceptance IDs**, four roadmap links. It checks
  structure/links only, not software behaviour. `git diff --check`: **exit 0**.
- Initial shell resolved Node 24.20.0. Checks used the already-installed pinned
  **Node 24.21.0 / pnpm 12.11.2** without changing global configuration.
  First attempt did not start pnpm because PowerShell blocked `pnpm.ps1`.
  A `.cmd` follow-up ran child checks, but PowerShell native-stderr handling
  threw before logging/reporting a native result; the empty log provides no
  usable pass/fail evidence. No success is inferred from that wrapper.
- Reran via a Node native-process runner with stdout/stderr written directly
  to a log and exit code captured. **`pnpm verify:fast`: exit 1**,
  **63.007s**, 05:23:53.542–05:24:56.551 UTC. Lint/boundaries/tokens, Knip and
  strict types completed; Biome checked 636 files with five existing informational
  findings and no fixes. Unit stage **270 passed / 2 failed**, 62 files,
  **19.13s**. Both failures hit the unchanged 5,000ms timeout:
  `tests/command.test.ts` canonical request-JSON property and
  `tests/runtime-cleanup.test.mjs` development removed-routes check. No application
  or timeout was edited. The fast chain stopped before negative types/OpenAPI/
  final production build. Log/result: private `verify-fast-native.log` and
  `verify-fast-result.json` in the research temp directory.
- Focused diagnosis used the same unedited files/timeouts:
  **`pnpm test tests/command.test.ts tests/runtime-cleanup.test.mjs`: exit 0,
  12/12 tests, 2/2 files**, Vitest 6.34s / command 8.155s,
  05:26:21.051–05:26:29.207 UTC. Both suite-timeout cases pass in isolation;
  concurrency/load is a possible cause, not proven. No repeated full-suite
  rerun or increased timeout was used to obtain a green claim.
- **`pnpm test:negative`: exit 0, 8.036s**. All existing negative DTO/client/
  component fixtures rejected their invalid uses.
- **`pnpm openapi`: exit 0, 3.241s**. Generated 97 existing paths without
  mounting production API documentation; no tracked artifact changed.
- **`pnpm build`: exit 0, 46.768s**, finished 05:27:27.284 UTC; 12 successful
  Turbo tasks (11 cached), web production build executed. The prior unobservable
  wrapper may have populated unchanged package caches; this result explicitly
  reports reuse rather than claiming every compiler task reran.
- Follow-up command results and complete logs are private
  `followup-results.json` and `followup-1.log` through `followup-4.log` in
  `%TEMP%/aarili-design-spec-rea-20261022`. Final documentation link/coverage
  and whitespace checks were rerun after the last design clarification.

**Full `verify:fast` remains failed (two timeouts); no all-green gate claim.**
Lint, Knip, strict types, focused unchanged tests, negative types, OpenAPI and
production build have fresh successful evidence. This is verification of the
existing repository during preparation, not of unimplemented 1.3.1 behaviour.

No new PostgreSQL/S3/worker integration, full `pnpm verify`, `pnpm test:ui`,
dependency audit, physical-device, screen-reader, fluent Tamil or PDF-golden
acceptance was run for this documentation-only preparation. No runtime/schema/
media/UI implementation changed to exercise new 1.3.1 behaviour. Those remain
explicit selected-ticket checks, not waived feature acceptance. The inherited
promotion evidence is separately identified above and is not a substitute.

The inline design-review aid was rendered and inspected at 1,000px and 390px;
both previews reported no console messages. It is a diagram of the proposed
packet, not an implemented product screen or accessibility acceptance.

## Historical preparation review and live gates

Preparation review: read D1–D18 and the complete A1/A2/B acceptance/migration/
verification bodies, approve or correct the software decisions and choose the
first outcome. The final response identifies the exact approval needed. No
running design-specification screen exists, so no synthetic route or completed
human walkthrough is fabricated. The packet defines the required implementation
review host/steps/report/teardown; the selected ticket must actually prepare it.

Physical Android, fluent Tamil, assistive technology, production catalogue and
compatibility, rights/notice/retention, restore drill and product §32.2/33 live
gates remain unresolved. The inspected source has technical media cleanup and
scoped text-redaction precedents but no general retained-media purge workflow;
the design names that gap and cannot claim backup/processor erasure coverage.
No customer approval, authoritative measurement, pattern engine or PDF workflow
is delivered by this preparation.

[Delivery_Measurements.md](Delivery_Measurements.md) records implementation
deliveries. This work has no implementation start, review-ready runtime, PR or
merge timestamps. Do not count research/planning as one of the five deliveries
or reconstruct active coding time. Record those values when a ticket is selected.
No commit, push, issue/PR publication, merge, deployment, spending or live
activation occurred.

## A1 implementation — selected issue #146

Authority: owner approved publication and A1 selection after reviewing the concrete
packet. #146/#147/#148 and their native dependency edges were created and read
back. A1 starts from development `154a456ca6d132857216371694e5de08a661155f`;
the related previously dirty roadmap/prompt are preserved in this delivery.
No worktree, new dependency, lockfile or toolchain correction is involved.

### Delivered boundary and history/isolation review

- Owner Settings → Design choices and questions creates, saves, reloads, reviews
  and publishes choices and exact garment/piece question profiles. Revisions and
  attributable availability events reuse the existing durable-draft command,
  audit, idempotency, ETag and recovery engine. Configuration remains an owner
  proposal or explicitly synthetic fixture; publication is not live-policy approval.
- Contracts/core/database/API/client/UI stay in the existing packages. The typed
  client is explicitly registered with the browser import gate. Offline OpenAPI
  generation now asserts all six private query/preview routes. Mutation remains
  the existing Hono draft route; no business Server Action or duplicate draft engine.
- Four separate neck/sleeve construction/decoration dimensions, reviewed intended
  lengths (including independent front/back neckline depth), finite conditions,
  required/optional/applicability decisions and supported exact choices. No
  entered wearer answer, body measurement or specification is stored in A1.
- Exact category, manifest, piece, form and relevant checklist/task/instruction
  links are validated. Current source availability is checked at publication and
  illustrative preview. A category-label revision can be explicitly reviewed into
  a successor choice definition in the same category identity; changing category
  identity or choice meaning needs a new identity. Historical links stay exact.
- Publication serialises locks in catalogue → forms → manifests → design order,
  then atomically appends definition/typed children/availability/audit, advances
  the expected pointer and commits the draft/request result. Missing/stale/conflict/
  validation semantics remain 428/412/409/422; repeated exact requests replay once.
- Migration `0042_design_choices.sql` adds nine tenant tables. All have non-null
  shop IDs, shop-led keys, composite tenant foreign keys and ENABLE/FORCE RLS.
  `app_user` has SELECT/INSERT plus guarded current-pointer column updates; it
  cannot update/delete sealed history or add children after the creating transaction.
  Typed children mirror the immutable JSON definition, with completeness/provenance
  and cycle guards. CI's explicit tenant inventories include all nine tables.
- Browser business state is memory-only and uses existing owner-generation/session
  cleanup. Pending source/preview reads discard late results after edit/unmount or
  loss of authority. No private source query or answer is put in browser storage.
  A draft ID/section in the URL follows the incumbent durable-draft addressing.
- Preview has no business effects, makes unavailable private examples explicit,
  distinguishes unknown/selected/explicit-none/not-applicable/dependency-unresolved,
  and flags retained incompatible illustrative selections. It neither grants media
  access nor confirms a customer instruction/approval or starts production work.

### Acceptance mapping

| Acceptance | Concrete implementation and evidence |
| --- | --- |
| DS-A1-01 / DES-01 | `design-choices.ts` contracts/core, database repository and Settings screen; real-PG exact category/manifest/piece/form binding, draft save/promotion/history; browser bilingual choice creation/reload/publication and exact profile review. Synthetic salwar, alteration and fall/pico sources reuse the incumbent catalogue/forms/templates. |
| DS-A1-02 / DES-02 | Four independent controlled groups; separate typed intended lengths with reviewed units/precision; schema/property cases and PG preview distinguish unknown, explicit none, dependent and not-applicable states. No inferred defaults or wearer values. |
| DS-A1-03 / DES-04 configuration | PG scenarios cover salwar top/bottom/dupatta, alteration whole scope and fall/pico's explicit no-body/no-design decision. Wrong piece/kind/foreign category/changed semantic identity fail. Property cases reject duplicate stable fields and cycles. Preview retains incompatible selections. |
| DS-A1-04 / DES-03 | PG disable/reactivate, current eligibility, renamed labels with exact old definitions, concurrent CAS/first publication; immutable audit-linked availability. Historical reads remain accessible within the authorised shop. |
| DS-A1-05 / TRU-01 / AC-55 | Real runtime-role PostgreSQL: forced-policy inventory, missing/foreign context, update/delete/late-child denial, tenant FKs, missing/stale ETags, concurrent exact replay/mismatch, rollback after append/pointer/draft/audit/result writes; populated upgrade preserves accepted orders and all sampled earlier definitions. |
| DS-A1-06 / USE | New browser workflow covers real committed response loss + exact-key retry, unsaved cancel/reopen, save/reload/publish, IME events, keyboard/focus, English/light and Tamil/dark, axe, three screen classes, 320px reflow and tablet landscape. Human language/physical-device/AT findings remain pending. Search uses existing Tamil/Latin/skeleton normalisation, including aliases. |

### Verification environment and failure ledger

Native Windows checkout, pinned Node **24.21.0**, pnpm **12.11.2**, TypeScript
**7.0.2**, Docker Desktop Linux PostgreSQL containers. Commands use the pinned
Node directory first in PATH; the ordinary global Node differs. Complete private
logs are under `%TEMP%/aarili-design-spec-rea-20261022`; no credentials or raw
competitor captures are committed. All tests use disposable synthetic databases.
Working source was dirty atop the base above; commit/PR metadata is appended when
observed. No result below implies real-data or full parent-feature acceptance.

Development checks (not substitutes for final verification):

- Focused unit/schema/property command: **5/5 passed**, Vitest **387ms**, whole
  command **14.926s**. Initial focused PostgreSQL: **3/3 passed**, **26.35s**,
  whole command **27.309s**.
- Catalogue/forms/manifests/repeat + design PG regression: **22/22 across five
  files**, **178.65s**, whole command **193.311s**. Strengthened upgrade seeded
  an actual accepted order before migration 0042 and compared prior JSON rows.
- Added scenario check initially failed (409): its synthetic dupatta fixture
  attempted a not-required body form on a stitching service, which the incumbent
  form policy forbids. Corrected the fixture to preserve that policy; fall/pico
  retains the supported not-required body form. Then **4/4 passed**, **32.47s**,
  whole command **33.422s**. No baseline behaviour or policy was weakened.
- First desktop browser pass reached all domain/axe checks but failed its final
  storage allowlist assertion: test expected `aarili-theme`, while the incumbent
  appearance key is `aarili-appearance`. Corrected the test; no storage change.
- Clean-install attempt 1: install succeeded; boundary gate rejected the unlisted
  new typed client (**58.700s** total). Added its specific browser entry, keeping
  transitive server-import checks. Attempt 2 passed boundaries but Knip found an
  unnecessary exported fixture helper (**61.303s**); made it module-private.
- Self-review added independent front/back depth keys, bounded memoised preview
  dependency evaluation, field-associated validation, and reasoned category-label
  source refresh without changing identity. Final affected checks follow below;
  earlier source snapshots are not represented as final acceptance.
- Three-device recovery browser run passed **3/3**, **1.3m** Playwright,
  **129.639s** whole command. An expanded browser command then caught my no-design
  status using an editor-local variable (**34.683s**) and its missing union guard
  (**10.127s**). Corrected the preview to narrow `content.kind` before accessing
  applicability. These failed builds are retained, not described as browser passes.
- Final focused `pnpm test:integration tests/design-choices.integration.test.mjs`
  passed **4/4**, **59.40s**, whole command **61.682s**, including wrong-kind/
  foreign source rejection and an explicit same-category label-version refresh.
- `verify-packet.mjs` after approval/status updates: **4 documents, 27 local
  links, D1–D18, nine primary requirement/scenario IDs, 23 acceptance IDs and four
  roadmap links passed**. `git diff --check` passed; lockfile remains unchanged.

The clean/native verification copy was taken before the final front/back-key,
category-label refresh and no-design copy/status refinements. Install/export/
toolchain inputs stayed unchanged. Its broad regression result is recorded for
that frozen snapshot; current-source focused PG, fast verification and rebuilt
browser checks independently cover the affected final inputs. This distinction
prevents claiming an earlier clean-copy result as acceptance of later edits.

Current rebuilt browser regression:
`pnpm test:ui tests/ui/design-choices.spec.mjs tests/ui/shop-presentation.spec.mjs tests/ui/service-templates-history.spec.mjs`
— **exit 0, 12/12 passed**, Playwright **7.6m**, whole command **481.127s**.
The existing presentation cases cover lossless previews, preference recovery,
keyboard focus/cancel and exact bilingual template history on all three devices.

The expanded four-combination language/theme matrix then ran against that same
production build with `pnpm exec node scripts/test-ui.mjs tests/ui/design-choices.spec.mjs`
— **exit 0, 3/3 passed**, Playwright **1.8m**, command **116.344s**. Each screen
class checked English/light, English/dark, Tamil/light and Tamil/dark with axe;
**zero violations** and **12 captures** in `.scratch/design-choices-captures`.
Tablet landscape and 320px reflow also passed. This repeat was required by newly
expanded theme coverage, not a repeat of an unchanged successful check.

The explicit availability/profile and availability/definition races were added
to the existing concurrency case and rerun with
`pnpm test:integration tests/design-choices.integration.test.mjs -t concurrent`
— **exit 0, 1 passed / 3 filtered**, Vitest **22.41s**, command **24.037s**.
Profile publication either commits before disable or rejects the inactive source;
the final profile is ineligible after disable. Competing availability and definition
changes yield exactly **200/412**, with no lost update. Other current A1 cases
retain their unchanged-input 4/4 result above.

Final current-source `pnpm verify:fast` — **exit 0, 118.160s**; **277 units / 63
files**, Vitest **14.83s**; strict type tasks **23 successful**; production build
**12 successful tasks / 16.623s**, including web and worker. Lint/boundaries/tokens,
Knip, negative types and **103 offline OpenAPI paths** passed. Five existing
informational Biome template-literal suggestions in `review-service-additions.mjs`
are unchanged; no formatting/lint errors. That result predates the final
presentation/validation refinements described below.

Supplementary `pnpm verify:clean` is still running at draft publication. Its
frozen install passed with the lockfile unchanged; lint, Knip, strict types,
277 units, negative types, OpenAPI and the Linux sandbox's **five A4/A3 page
goldens / 50 synthetic strings / four fonts** passed. Its full integration/build/
smoke/artifact/cleanup result is pending until recorded below; no full-pass claim.

The continuing broad run exposed **four failures** in `drafts.integration.test.mjs`:
its exact production-workflow list omitted the new `design.choices` entry. Added
that one expected entry; no draft/runtime assertion was relaxed. Current-source
`pnpm test:integration tests/drafts.integration.test.mjs` — **exit 0, 6/6 passed**,
Vitest **106.68s**, whole command **108.050s**. The original broad run retains its
failed frozen assertion and is not represented as green; final totals follow.

Because the broad check's failed test prevents its later build/artifact stages,
ran a fresh disposable native **install/export/build/canary** check separately.
`pnpm exec node %TEMP%/aarili-design-spec-rea-20261022/verify-clean-exports.mjs`
— **exit 0, 154.268s**. This temporary recipe copies `scripts/verify-clean.mjs`,
replacing only its broad `verify` stage with `build:packages`; it retains frozen
install, clean web build with the existing private canary, artifact scan,
unchanged-lock assertion and guarded deletion of its exact temporary directory.
All installed packages are the pinned workspace dependencies. This explicitly
checks native export/install portability; it does not claim a second full verify.

Current `pnpm smoke` — **exit 0, 31.874s**: production standalone Next/Hono,
real PostgreSQL readiness/outage, typed operational client and worker shutdown.
`pnpm exec node scripts/check-artifacts.mjs` — **exit 0, 0.533s**, **29 browser
artifacts** checked for synthetic private-configuration leakage.

### Publication and review state

Capability commit **53be125bbef5c1e9b54e6309739be18f39d11ac2** was committed and
pushed after current-source fast/PG/browser evidence. Draft
[PR #149](https://github.com/nishanthturnstile/aarili/pull/149) targets development,
created **06:36:00 UTC** and registered with T3 immediately. At **06:36:11 UTC**,
required Fast verification and Dependency audit were running in
[run 39734956167](https://github.com/nishanthturnstile/aarili/actions/runs/39734956167).
Full scaffold/browser jobs are deliberately skipped on feature PRs under the
approved workflow; this is not a passing promotion gate. A later test-inventory/
evidence-only follow-up preserves runtime capability inputs. Current-head CI,
owner acceptance/merge and deployment remain separately gated.

The inventory-correction revision **def9b5d90deb7cebcb51570d2fa7c1b5f8054e15**
passed both required hosted checks in
[run 39735741565](https://github.com/nishanthturnstile/aarili/actions/runs/39735741565):
Fast verification **06:43:32–06:45:26 UTC** (114s), Dependency audit
**06:43:31–06:44:56 UTC** (85s). These are that revision's results; later
presentation/validation changes require their own current-head CI.

### Broad-run closeout and final refinements

The original `pnpm verify:clean` completed **exit 1, 3491.033s**. Its integration
stage finished **248 passed / 4 failed across 44 files**, **3185.47s**. The only
failures were the four draft calls whose test wrapper asserted an outdated
workflow inventory, producing a masked 503 instead of 200. The corrected complete
file's **6/6** result is above. The original frozen command remains failed; it was
not rerun wholesale after a one-entry assertion correction. Successful unaffected
results are retained under the workflow's evidence-reuse rule. Its temporary
installation directory and disposable PostgreSQL resources were cleaned up.

Its later build/smoke/artifact stages did not execute because integration failed.
Those checks were completed independently: current-source fast production build,
fresh native frozen install/package exports/web build/private-canary scan,
production readiness/outage/worker shutdown and browser-artifact scan above.
This does not turn the original full-command failure into a pass.

Final presentation review replaced internal ticket wording with the plain
unavailable-reference state and marks an explicit-none option visibly in the
illustrative selector. The browser case now selects it and checks the none label
separately from unknown and the selected state. Final validation review memoises
completed schema graph visits as well as preview evaluation; a malformed 40-node
shared dependency graph is rejected without exponentially revisiting branches.
It adds one bounded negative unit case; no compatibility policy or source history
is changed. A final fast attempt caught formatting in that test (**1.333s**),
then Biome corrected it without changing its behaviour.

Frozen final `pnpm verify:fast` — **exit 0, 97.886s**, **278 units / 63 files**,
Vitest **11.45s**, all strict type tasks, negative-type checks, Knip/lint/boundaries/
tokens, **103 OpenAPI paths** and production web/worker build (**14.311s**) passed.
Final `pnpm test:integration tests/design-choices.integration.test.mjs` — **exit 0,
4/4 passed**, Vitest **45.61s**, command **46.852s**. This includes the expanded
availability/profile/definition race in the complete file, not only a filtered run.
Final `pnpm exec node scripts/test-ui.mjs tests/ui/design-choices.spec.mjs` against
the frozen fast build — **exit 0, 3/3 passed**, Playwright **1.5m**, command
**97.091s**. All four language/theme combinations on all three screen classes,
explicit-none selection, IME/recovery, keyboard/axe, landscape and 320px reflow
passed; all **12 captures** were refreshed with **zero axe violations**.

These final checks tested dirty refinements above `def9b5d`: the design contract's
graph traversal, the content editor's explicit-none label, the English unavailable
copy and their two focused test files. No runtime source changed after these
results. This closeout and delivery-timing edits are documentation-only. Final
review-ready and latest running-host checks were observed **07:15:45 UTC**.
The final rebuilt browser-artifact scan also passed: **29 artifacts, exit 0,
0.290s**. The full browser suite, physical Android, fluent Tamil and assistive
technology acceptance were not rerun or claimed; the scoped automated matrix and
the earlier 12-workflow regression are the current UI evidence.

### Migration and recovery

Migration 0042 is additive and uses the existing advisory-locked migration runner.
It seeds no approved design choice, does no order backfill and leaves existing
readers/tables intact. The populated-upgrade test applies it twice and compares
catalogue/form/manifest/order/acceptance/draft rows before and after. Private
asset/garment specification tables are deliberately absent.

Before non-disposable use: backup and review the SQL through the established
process. Compatible rollback disables the new writers/navigation and retains
schema and immutable records; no destructive down migration or historical rewrite.
Restore/kill-switch/live-data activation retain their existing gates.

### A1 manual review packet

Startup after `pnpm build`: `node scripts/review-design-choices.mjs` using pinned
Node/PATH. It creates a disposable loopback host/database and prints only its
route and private access-file location. Exact running URL is recorded below when
observed. Final host: **http://127.0.0.1:58892/settings?section=design-choices**,
review-ready and HTTP **200** observed **07:15:45 UTC** on 22 October. Earlier
51739/62781/53713 hosts were stopped cleanly for rebuilds. The final host remains
running for owner review. Private credentials: `.scratch/design-choices-review-host/private.json`
(ignored, never paste into Git/chat). Ordinary owner sign-in; no hosted tunnel.
Named shop: **SYNTHETIC Design choices**. It contains **SYNTHETIC blouse questions**,
four independent neck/sleeve choices, salwar top/bottom/dupatta profiles, alteration
and no-body fall/pico profiles. These are illustrative decisions, not approved
production content. No customer/order/approval/media is required by A1.

1. **DS-A1-01/02:** Add a choice, enter bilingual labels/meaning/category/dimension
   and review reason; save, reload, review and publish. Confirm four independent
   neck/sleeve dimensions and separate intended lengths. Cancel an unsaved edit
   and resume the saved draft; the discarded text must not appear as saved.
2. **DS-A1-01/03:** Open blouse → revise → inspect each question's expandable
   controls and exact source links → preview. Try illustrative construction and
   decoration independently. Compare salwar top/bottom/dupatta and fall/pico;
   explicit no-design is different from an unreviewed/unknown answer.
3. **DS-A1-04:** Disable a choice with a reason, publish, then reopen its old
   revision/history. Prior bilingual labels/links remain; new profile publication
   using the inactive choice is blocked. Reactivation requires a reasoned event.
4. **DS-A1-06:** Try Tamil/dark and English/light with keyboard navigation and
   tablet landscape. Report physical Android device/RAM/browser, fluent-Tamil
   readability and assistive-technology observations where available. Emulation
   and axe are automation evidence only.

Return `DS-A1-0x — pass/fail — observation`. Owner merge authorisation remains
separate. Teardown: `node scripts/review-design-choices.mjs stop`; this stops the
disposable host/database and removes the private credential/lock/stop files.

### Remaining scope and gates

A2 #147 will save/select immutable garment-linked specification versions,
control same-scope inactive retention and reset repeat intent/approval. B #148
will add private component references/captions/annotations/version-preserving
replacement for required image/PDF/sketch/voice classes. They need their direct
blockers merged and separate owner selection. Customer approval remains 1.4.3,
measurement sessions 1.3.2, manual/external method records 1.3.3 and slips/PDF 1.3.4.
ORD-07/DES-05/10, full AC-07/08 and full 1.3.1 remain open. The REA authenticated
Nool access gap remains recorded; T3 observations never became backend proof.
Physical-device/Tamil/AT review, production catalogue/compatibility/precision,
privacy/rights/retention, restore drill and pilot/live activation remain pending.
