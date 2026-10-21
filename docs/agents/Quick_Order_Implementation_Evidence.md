# Quick Order A: implementation and owner-review evidence

19 October 2026. **#113 / 1.2.1a selected and implemented for review**.
At the A delivery, the owner had approved A-B, authorised publication and
selected A; B awaited A's merge. This A-only record does not itself complete
accepted orders, AC-60 or all of 1.2.1. See the subsequent B selection below.
[REA evidence](Quick_Order_REA_Evidence.md), [design/QO matrix](Quick_Order_Design.md),
[approved tickets](Quick_Order_Ticket_Packet.md).

## Subsequent B selection

A merged in #115 at `c6ab32d` (19 October 13:36:15Z), with feature fast/audit CI
successful. The owner then selected #114 and approved the count/week/retained-
demand/QO-code conventions. B implementation and verification are tracked in
[Quick Order acceptance evidence](Quick_Order_Acceptance_Implementation_Evidence.md).
The A-only scope and preparation records below are historical; production,
merge/promotion and human acceptance remain separate gates.

## Current approval and baseline

Published #113/#114 with the installed `to-tickets` workflow; issue bodies and
native blocker edges were read back. A → #56/#78/#79/#80/#99/#100, whose closing
PRs #68/#81/#82/#83/#105/#107 are merged. B → #113/#84/#85/#87/#101; its foundation
closing PRs #89/#90/#91/#106 are merged. Transitive prerequisites remain integrated.

Promotion #110 was rechecked: merged `29c497563bfa1424304be4099a4b36b97346f30e`,
19 October 10:10:15Z. [Run 39231567178](https://github.com/nishanthturnstile/aarili/actions/runs/39231567178)
passed scaffold, all three browser projects, audit and aggregate checks; fast was
skipped as expected. Both local long-lived branches were fast-forwarded. A uses
the existing checkout, **codex/quick-order-drafts**, based on fetched development
`ca6aad06331acf4699a552d3c2d8d537a62788e6` (includes #111/#112). No worktree.

Initial owner edits remain preserved: the 14-line roadmap readiness/prompt note
and untracked `Order_Intake_Readiness_REA_Review.md` / `Quick_Order_REA_Prompt.md`.
They are local input provenance, not automatically committed with A. Only this
task's separate roadmap hunk, packet and implementation enter its PR.

## Implemented outcome and integrity review

- `/orders`, dashboard/navigation entry and real Resume drafts reuse the existing
  customer search, authorised wearer/self selection and registration routes.
  Switching customers clears the previous wearer; shared phone is not authority.
- `contracts/orders` retains bounded incomplete values, quoted zero versus unknown
  and a stricter future command shape. Framework-free core composes the existing
  customer/wearer/guardian/template repositories in one membership transaction.
  Hono preview and typed browser client remain thin.
- `order.quick` uses existing durable drafts, ETags, actor/action/hash-bound keys,
  audit and usage instrumentation. No migration/table/package/dependency was added.
  All draft reads/list/replay/commands reauthorise references before exposing
  content, including stale comparison and abandonment responses. Revoked private
  relationship/service permission returns 404. Minor guardian work remains
  unresolved; A cannot capture measurements or accept any order.
- Exact immutable manifest content pins catalogue/forms/template references.
  Canonical publisher lock order and existing projection produce unresolved
  requirements/default task owner without creating instances or reservations.
  Disabled/drifted sources retain their saved projection and need explicit review.
- One canonical record preserves hidden fields through Simple/Detailed. Existing
  IME-aware recovery freezes uncertain envelopes, retains newer typing, offers
  explicit full-field conflict choices and clears on access loss. DraftForm gains
  a no-promotion option; the same controller supports exact-key abandonment.
- A has no booking/confirmation action. Promotion fails closed. Price is not a
  payment/invoice; advances remain 1.4.2. Measurement/material/approval/production
  effects remain later slices. Synthetic customer/configuration gates stay intact.

Existing app_user, FORCE RLS, composite references, immutable definitions and
same-transaction audit/key authority remain unchanged. Optional `authorizeDraft`
protects consumer-specific private references; existing workflows have no new
publication rule. Compatible code rollback retains draft rows/history; older
code must treat the workflow as unsupported, not approve or erase it. No SQL
rollback, retention deletion, policy activation, outbound action or live seed.

## Fresh A verification

Native Windows; pinned Node **24.21.0**, pnpm **12.11.2** and disposable PostgreSQL
18.6 through Docker Desktop, runtime app_user. PATH selected the already installed
runtime; no toolchain or execution-policy change. Source is `ca6aad0` plus A's
dirty files before commit. Ignored `.scratch/quick-order-*` logs stay local.

- Initial compile/export/useRef errors were corrected at existing package seams.
  The first revoked-reference abandonment failure prompted a privacy review:
  bypassing authorisation was rejected because responses carry private payloads.
  Every command now checks authority before replay/stale/error content.
- Generic JS composition/read fixtures omitted their required workflow registry;
  they now supply explicit empty maps. Runtime guards/assertions were preserved.
  Quick Order plus existing drafts passed **9/9**, **79.28s** (`postgres-4.log`).
- Expanded Quick Order/isolation passed nine cases; its new incomplete-promotion
  assertion expected 409 incorrectly. Incomplete shape correctly returns **422**
  before command unavailability. Corrected withdrawal case passed **1/1**, three
  unselected cases skipped, **23.76s** (`postgres-6.log`). Together these runs cover
  four Quick Order, six existing draft and six isolation cases, with failures
  retained in `postgres-1/3/5.log` rather than relabelled successful.
- `verify:fast` found formatting/boundary registration and fixture omissions;
  corrected. Its next run passed lint/Knip/types and **233/234** units, failing the
  unchanged jobs property's **5,000ms** deadline under 54 workers, as seen on the
  promoted baseline. No deadline/assertion was weakened. Diagnostic four-worker
  full suite passed **234/234**, then negative types, **65-path** OpenAPI and
  **12/12** production build passed. The original fast invocation remains failed.
- Final separate lint, Knip, strict types, **234/234** units with four workers
  (**28.15s**), negative types, **65-path** OpenAPI and **12/12** production build
  (**27.582s**) passed. Logs `quick-order-final-*.log`. A final UI batch made
  Retry reload authorised wearer choices and distinguished result pagination from
  draft pagination. Affected lint/Knip/types, **22/22** focused units (**636ms**)
  and **12/12** build (**20.782s**) passed (`quick-order-finish-*.log`).
- Clean native frozen install/build/public imports passed from a disposable path
  containing spaces, unchanged lockfile, **10/10** fresh package builds in 25.146s.
  The initial wrapper incorrectly passed pnpm-native.exe to Node; it now invokes
  an executable directly. Command: `pnpm exec node scripts/verify-quick-order-exports.mjs`.
  This checks exports without copied dist/cache, not another full promotion run.
  The final fresh repeat passed **10/10**, **28.571s**, after the schema guard;
  log `quick-order-clean-exports-final.log`. Later copy/retry changes do not alter
  these package export paths or graph.
- Initial phone search timed out because “Meena” was not a prefix of the fixture
  “SYNTHETIC Meena”. Added explicit synthetic aliases and empty-result guidance;
  incumbent search semantics remain unchanged. Corrected phone **1/1 passed**
  (**1.6m**): save/close/list/resume, reload/second authenticated context, dropped
  committed response with exact replay, offline retention and abandonment.
  Automated initial intake **1,059ms** excludes setup/recovery and does not prove
  the physical-owner two-minute target.
- Expanded conflict/IME/422 runs reached real conflict state but a text locator
  matched both status and alert. Narrowed it to the status region; no conflict
  assertion or runtime rule was removed. `quick-order-ui-final.log` retains the
  three failed cases; a fresh corrected run supplies final evidence below.
- After adding Retry-After handling for the existing admission rejection on
  abandonment, **6/6** browser cases passed in **3.5m**: recovery and active-draft
  two-tab sign-out on each size. Command: `pnpm exec node scripts/test-ui.mjs
  orders.spec.mjs orders-access.spec.mjs --workers=3`; log
  `quick-order-ui-complete.log`. Fixtures have separate databases, ports and
  browser contexts; no runtime limit changed. Earlier admission failures remain
  in `quick-order-ui-verified.log`.
- Visual review caught a shared-layout defect invisible to axe/overflow alone:
  reconnect notice occupied the navigation grid cell. At 1280px, the old host
  had nav x368/width824 and content x88/width256; the new geometry assertion was
  false. Spanning the notice across the grid fixes it: nav x88/width256, content
  x368/width824, assertion true. No PWA cache/update/auth behaviour changed.
- Affected lint passed (**528 files**, boundaries/tokens/static assets), build
  passed **12/12**, **18.087s**. After the CSS fix, complete recovery journeys
  recaptured **3/3**, **2.8m**, with desktop/tablet column-width assertions, all
  English/Tamil × light/dark axe checks, landscape and CSS zoom2 reflow. Command
  `pnpm exec node scripts/test-ui.mjs orders.spec.mjs --workers=3`; logs
  `quick-order-layout-lint/build/ui.log`. Active-draft sign-out is reused from
  the preceding run; its auth/clearing inputs did not change.
- Final automated intake segments: **1,888ms phone / 2,147ms tablet / 1,750ms
  desktop** (parallel emulation; excludes setup, recovery and manual reading).
  Physical task time and native browser zoom/AT remain manual observations.
  Twelve final theme/language captures are in `.scratch/quick-order-captures/`;
  representative phone/tablet/desktop captures were inspected after correction.
  Full-page images retain browser sticky/fixed positioning; live geometry and
  normal viewport review establish actual column placement.
- Documentation QA passed UTF-8/relative links, all 12 QO rows and primary IDs.
  **31** cited REA IDs matched retained raw records outside Git. Initial discovery
  raw data was absent from the retained bundle; its row now cites fresh retained
  closing discovery, without inventing an ID. `git diff --check` passed.
  Tested source manifest: `.scratch/quick-order-source-manifest.json`, **38 files**,
  raw source-set SHA-256
  `cb1870b529b2ea5fd019177b9f67320ef9b42bbe0d6a6b9fcf93a6e494025391`.

Not claimed: full new-flow `pnpm verify`/all browser suite, new PDF goldens,
physical Android/fluent Tamil/AT, accepted snapshots/capacity concurrency,
key-expiry origin uniqueness or pilot/live readiness. Full scaffold/browser CI
remains the promotion gate. A changes no PDF pipeline; promoted PDF evidence
applies only unchanged. Local gates follow the approved A packet/workflow.

## A acceptance mapping

| QO ID | Evidence and disposition |
| --- | --- |
| 01 | Existing customer/self, exact eligible service, date/priority/zero/unknown and honest advance deferral: contracts, PostgreSQL and browser. Accepted order ID remains B. |
| 02 | Foreign/missing context, relationship/service withdrawal and guardian current-state preview in real PostgreSQL. Full guarded acceptance remains B. |
| 03 | Exact source pins, canonical locks, unresolved task owner and disable-history projection. Accepted immutable/policy snapshots remain B. |
| 04 | Server save/list/resume/reload/second session, IME, offline and current-memory recovery. Shared controller tests cover newer typing during an older response. |
| 05 | Same-key race/one version/audit, mismatch and 428/412/422/409; actual dropped commit/replay and explicit conflict choices. Acceptance duplicates remain B. |
| 06 | Seeded lossless-mode properties and canonical browser comparisons. Accepted-order presentation history remains B. |
| 07–08 | **B only; not implemented/executed.** A creates no capacity commitment. |
| 09 | app_user missing/cross-shop context, pooled clearing, forced-policy catalogue and actual draft/audit/key rollback. Order/demand/job rollback remains B. |
| 10 | Raw draft dates/priorities retained; accepted timelines/historical commitment rules remain B. |
| 11 | Automated responsive bilingual evidence below; physical/fluent-Tamil/AT acceptance pending. |
| 12 | No money/stock/custody/measurement/outbound/production effect; draft/isolation regressions run. Entire prior capability suite was not rerun. |

## Owner review packet

Local review-ready observed **19 October 2026, 17:55:47 IST**, after final
verification, visual correction, source-manifest and focused-staging checks.
Human acceptance, hosted feature CI and owner merge review remain separate.

Published draft [PR #115](https://github.com/nishanthturnstile/aarili/pull/115)
at **17:56:44 IST**, targeting development, implementation commit
`f2eebbccf146354f8434109d7af35b86522eb263`. Registered with T3 immediately.
Initial [CI run 39252113026](https://github.com/nishanthturnstile/aarili/actions/runs/39252113026)
started fast verification/audit at **17:56:50 IST** (6s after PR creation); both
were in progress at inspection. Scaffold/browser were skipped as expected for
a feature PR. The publication-record follow-up changes documentation only;
final-head CI, human review and merge remain pending, with no automatic promotion.

Running synthetic surface: **http://127.0.0.1:52751/orders**, observed ready
**17:50:48 IST** after the final build. Private local access:
`.scratch/quick-order-review-host/private.json`; never paste it into chat, Git or
the PR. The existing local T3/Chrome review surface may sign in with that file.
Fixtures: synthetic Meena/மீனா aliases, adult authorised self wearer and service
templates before/after cutting with exact forms and unresolved owner tasks.
They are verification examples, not production catalogue/policy approval.
One actual partial intake was saved through the UI and closed into Resume drafts:
authorised self, before-craft service, missing delivery date, To be quoted.
Its acknowledged link is `/orders?draft=01a1541c-ab65-77a2-8708-b84a1392bbb9`;
it creates no commitment.

If stopped, use pinned Node 24.21.0/pnpm 12.11.2, `pnpm.cmd build`, then
`node scripts/review-quick-orders.mjs`. The script prints its new loopback URL and
refreshes the private access file. No tunnel, production host or live data.

1. **QO-01/02/03:** New order draft → Find customer “Meena” → verify Self →
   Find service → choose the synthetic before-cutting service. Enter delivery,
   Normal/Rush and To be quoted, then quoted zero. Requirements must stay
   unresolved with owner assignment; no payment or booking success is offered.
2. **QO-04/06:** Detailed → optional Tamil instructions/date → Simple → Save.
   Close editor → Resume drafts → reload. Check all hidden values return. Repeat
   in English/Tamil, light/dark, phone/tablet/desktop and tablet landscape.
3. **QO-04/05:** With a saved draft open, briefly go offline and type. It must
   retain current text and show an honest unsaved/checking state; reconnect and
   Retry. Unsaved text is not promised to survive reload. In two tabs save a
   different edit, then edit the older tab: compare both versions and explicitly
   choose, without automatic merge. Automation supplies dropped-response proof.
4. **QO-09/11:** Keyboard focus, Tamil composition/readability, 200% browser zoom
   and screen-reader labels/status announcements. Sign out while a private draft
   is open in another tab; both must clear. Abandon a separate saved draft and
   check it leaves Resume drafts. Human review need not repeat terminal tests.

Copyable report: `QO-<ID> — pass/fail — observation`. For real-device/AT findings,
include device/RAM/browser and assistive technology; fluent Tamil review should
identify exact copy. Physical Android/fluent Tamil/AT remain **pending**, separate
from emulation/axe. Use the approved local-device review path for an actual phone;
the loopback URL does not itself provide network/device access. Owner acceptance,
merge, production policy, restore/privacy and promotion/live gates remain separate.

Cleanup: `node scripts/review-quick-orders.mjs stop` removes only this host’s
synthetic database/container and private access files after shutdown. The
clearly labelled Nool research fixture is separately retained as documented in
the REA ledger; it is not part of Aarili’s database. No vendor history was erased.

## Historical preparation snapshot

Everything below records the state before owner approval and earlier-head checks.
It remains for provenance and does not override the current status above.

## Fresh baseline and prerequisite review

`git fetch origin` completed. Local development and origin/development initially
resolve to `9759cbe8e6b3ba0c5f0d69bb87af7ee5befa8886`; origin/main was
`13ae3733e2fcde01a62845610ed1ad6a985ad689`. No branch, worktree, reset, stash,
commit, issue, PR, merge or deployment was created by this task.

Authenticated `gh pr list --state open` found only
[promotion #110](https://github.com/nishanthturnstile/aarili/pull/110), targeting
main. No open PR targets development. Feature prerequisites are already merged:

| Foundation | Integrated evidence |
| --- | --- |
| Owner/customer/adult/minor/guardian and Shop Settings | Prior promotion #96 and merged feature PRs #81–#83/#89–#93; retained issue-local evidence. |
| Catalogue #97 | PR #102 merged; catalogue/form/template dependencies are retained. |
| Forms #98 | PR #104 merged. |
| Operating manifests #99 | PR #105 merged. |
| Category binding #101 | PR #106 merged. |
| Shop presentation #100 | PR #107 merged. |
| Integration inventories | PR #109 merged 19 October at 08:13:20Z, development `9759cbe`. |

No Quick Order issue was found in all-state `1.2.1` search; matches were its
closed prerequisites. The open-issue inventory contained only #28 Dependency
Dashboard. Thus there is no selected approved Quick Order issue or native blocker
graph yet. Existing prerequisite approvals are reused; the new proposed packet
still requires concrete review/publication/selection.

The earlier #108 promotion is closed without merge. #110's inspected head was
`9cbdcd47edb96867c26ecfc941f61112baeb1bb5`; its
[run 39221346149](https://github.com/nishanthturnstile/aarili/actions/runs/39221346149)
completed scaffold, phone, desktop and dependency audit successfully; tablet
failed, so Browser smoke and accessibility failed. Fast verification was skipped
as expected for promotion. The failed tablet case was owner-entry, reporting
`apiRequestContext.get: read ECONNRESET`; this read-only inspection does not
diagnose or fix its cause. Promotion is not green, merged or an additional
synthetic-development dependency. Independent #110 repairs were observed in
the checkout and left untouched. Later CI must be evaluated at its actual head.

The initial unrelated work was the 14-line roadmap planning addition plus
untracked readiness review and reusable Quick Order prompt. They remain
preserved. This task adds the four Quick Order packet documents and a distinct
roadmap traceability note/delivery planning note only. No application input is
intentionally changed by this task.

## Inspected reuse seams and missing boundary

- Core drafts: `DraftWorkflow` provides separate schemas, same-transaction
  revalidation/promotion/result verification; `mutateDraft` locks key and draft,
  replays before checking current state and supports promoted-origin recovery.
- Existing `draft-form`, `draft-recovery`, draft scope/work guard and typed client
  supply honest online saves and request recovery. No second draft module needed.
- Customer/wearer/guardian repositories have explicit person/link/purpose and
  lock boundaries. Customer/payer/phone must not become wearer authority.
- `serviceTemplatesReferencesEligible` validates current exact service/piece/
  add-on/form references. `previewServiceRequirements` produces canonical
  unresolved items, dependencies, owner assignment and source references, but
  explicitly creates no business instance.
- Presentation uses a versioned shop preference, implicit Simple and a lossless
  sample projection. Real per-order persistence/audit is missing.
- `ApprovedCategoryResolver`, bindings and `evaluateCommitment` already exist.
  Bound preview deliberately forces null quantity/unit/load and effects none.
  Accepted-order authority, actual demand, serialization, snapshot/demand writes
  and durable order detail are new consumer work, not another evaluator.

This is local source inspection, not fresh implementation acceptance. Current
library API syntax has not been added; ctx7 lookup is required when implementing
library-specific integrations. Tool schemas were discovered from installed REA
metadata; raw captures stay outside Git.

## Research and acceptance disposition

Five actual REA records cover secondary layout/interactions and the Nool login
boundary. The dedicated research CDP endpoint was unreachable; automatic approval
review rejected reopening it, and private owner reopening/sign-in is pending.
No synthetic blouse order was saved in Nool. All primary questions and permitted
follow-up steps remain explicit in the evidence ledger. No invented observation,
competitor persistence or backend guarantee is claimed.

QO-01–12 in the design are **specified / not implemented / not executed**.
The proposed A–B tickets define their precise scope and required evidence.
Real PostgreSQL isolation, snapshots, concurrency, rollback, accepted-order
idempotency and browser draft recovery remain to be proved for this new flow.
Prior foundation results are historical evidence for their unchanged scope only.

No runnable Quick Order software-review host or new seed exists. Providing a fake
working form would bypass the selected-approved-issue gate. The ticket packet
contains the exact required later running-host/manual-review structure; actual
URLs/credentials/test outputs must be filled from implemented software, never
invented. Fluent Tamil, physical Android, assistive technology, live policy,
privacy/restore, promotion and pilot gates remain pending.

## Verification and measurements

Fresh preparation checks and timing are recorded at closeout below. Application
lint/Knip/typecheck/unit/integration/browser/production-build success is not
claimed for unimplemented Quick Order behaviour. Full gates run for selected
approved implementations as specified in the packet, without overwriting the
independent promotion repair's builds or repeating unchanged heavy checks.

The preparation does not consume one of the five implementation-delivery timing
entries. Implementation start, review-ready/first-usable-host, hosted CI, review,
merge and rework times remain pending; active research time was not continuously
measured and will not be reconstructed from file/commit timestamps.

## Closeout refresh

Independent PR #111 merged into development as
`c985ce6c3d7d1ab0fa871730ef94d5dad5f153d2` while preparation ran. #110 was
updated to `f03780a6f70b75b0087e1bb56ffaff64b97d64da`; fresh
[run 39226379586](https://github.com/nishanthturnstile/aarili/actions/runs/39226379586)
has scaffold and all three browser jobs in progress, audit successful and fast
verification skipped. This supersedes the earlier failed-head status as the
current pending run; no promotion success is claimed. Open-PR inventory still
contains only #110, with no open feature PR into development.

The shared checkout was switched by the independent task to
`codex/promote-services-main-20261019`, HEAD `f03780a`. This task preserves that
branch and makes no checkout mutation. All Quick Order documents stay uncommitted
for review; they are not implicitly included in another task's commit.

REA bundle SHA-256:
`00f948923b2a3ea1f3a3355103218890c9c170f34389689502790b5756f0884f`.
A second bounded discovery still returned endpoint unreachable. No user-confirmed
research connection was available at this inspection.

### Fresh preparation verification

Tested source: promotion HEAD `f03780a`, with only the Quick Order/readiness
planning documents and roadmap/delivery notes dirty. This is the independent
promotion's source plus this documentation, not implemented Quick Order code.
Native Windows, pinned Node **24.21.0**, pnpm **12.11.2**. The shell's default
Node was 24.20.0, so verification explicitly prepended the existing approved
24.21.0 installation to this process's PATH. No runtime was installed/changed.

- Initial `pnpm` resolution found a PowerShell shim blocked by execution policy;
  no fast gate ran in that attempt. Used the normal Windows `pnpm.cmd` launcher
  without changing execution policy. Do not interpret the shell wrapper's initial
  zero exit as a successful gate.
- `pnpm.cmd verify:fast` ran **14:30:39.548–14:31:22.151 IST**, exit **1**.
  Lint passed (514 Biome files, 303 boundary sources, 72 token/UI sources and
  eight static PWA assets), Knip passed and strict typechecking passed (23 tasks).
  Unit run passed **229/230**; `tests/jobs.test.ts` deterministic-binding seeded
  property test hit its unchanged **5,000ms** timeout. The command stopped before
  negative types/OpenAPI/final build. Log `.scratch/quick-order-planning-fast.log`.
- Inspected that test: 50 seeded async hash properties, no Quick Order code.
  `pnpm.cmd exec vitest run tests/jobs.test.ts --maxWorkers=1` exited **0**,
  **2/2**, **438ms**, at **14:31:50 IST**. Log
  `.scratch/quick-order-planning-jobs-isolated.log`. No timeout/assertion weakened.
- Diagnostic full suite with reduced concurrency,
  `pnpm.cmd exec vitest run --maxWorkers=4`, exited **0**, **230/230 in 53 files**,
  **19.89s**, starting **14:32:11 IST**. Log
  `.scratch/quick-order-planning-units-bounded.log`. This is consistent with
  contention in the original run; its precise timeout cause is not proved and
  the original full fast invocation remains failed.
- The unreached components were run separately: `pnpm.cmd test:negative`
  **exit 0**, compiled negative/UI type contracts; `pnpm.cmd openapi` **exit 0**,
  **64 paths**; `pnpm.cmd build` **exit 0**, **12/12 tasks**, **15.922s**.
  Logs `.scratch/quick-order-planning-negative.log`,
  `.scratch/quick-order-planning-openapi.log` and
  `.scratch/quick-order-planning-build.log`. These outcomes do not relabel the
  earlier fast run as successful.
- The first document traceability check detected abbreviated grouped requirement
  references rather than individually searchable IDs. Added the explicit primary
  traceability register. The corrected check **passed** four UTF-8 documents,
  all relative links, bounded privacy-pattern checks, all **12 QO rows** and every
  primary requirement/scenario ID. `git diff --check` passed. This is documentation
  QA, not proof that acceptance scenarios execute.
- T3 HTML handoff preview passed at **728px and 360px**, no horizontal overflow,
  both proposed tickets present. This is a read-only planning visualization, not
  a running app mock or Quick Order accessibility acceptance.

Not run for this documentation-only delivery: new-flow PostgreSQL integration,
Playwright/axe, actual intake timing, full `pnpm verify`, new PDF goldens,
physical-device/fluent-Tamil/AT or a Quick Order review host. There is no approved
new flow to exercise. The running promotion owns its complete current-head CI;
no duplicate full local promotion run was started. A–B must supply their own
fresh implementation evidence before any software completion claim.
