# Repeat orders and history: preparation and implementation status

21 October 2026. **A1 / #134 merged in [PR #139](https://github.com/nishanthturnstile/aarili/pull/139); A2 / #135 merged in [PR #140](https://github.com/nishanthturnstile/aarili/pull/140). B / #136 merged in [PR #141](https://github.com/nishanthturnstile/aarili/pull/141). Owner selected C1 / #137 after that merge; see [identity-review implementation evidence](Identity_Review_Implementation_Evidence.md). C1 merged in [PR #142](https://github.com/nishanthturnstile/aarili/pull/142); owner selected C2 / #138. See [contact merge evidence](Contact_Merge_Implementation_Evidence.md) for its consumer inventory, bounded current attribution and remaining domain gates. The A1 evidence below records its historical handoff state.**
[A2 evidence](Repeat_Service_Implementation_Evidence.md).

The preparation record below is historical; the current implementation audit follows it.
[Design/matrix](Repeat_Order_History_Design.md),
[approved ticket packet](Repeat_Order_History_Ticket_Packet.md),
[REA evidence](Repeat_Order_History_REA_Evidence.md).

## Preparation baseline and approval audit (before owner approval)

- Existing checkout on `development`, HEAD
  `bc23c0e770e6e5e4e0ebb13218312dc30b08f08d`; `git fetch origin` succeeded;
  `origin/development` equals HEAD. Main/origin main is
  `63646fec497d2b11db2396df0d982afd8ad9e8c9` (promotion #130).
- Initial dirty files: modified roadmap and untracked
  `Repeat_Order_History_REA_Prompt.md`. The pre-existing eight-line roadmap
  REA-brief hunk is preserved. Preparation adds a separate status/traceability
  hunk and four documents; no source/toolchain/dependency changes.
- `gh issue list --repo nishanthturnstile/aarili --state open --limit 100
  --json number,title,labels` returned only unrelated #28 Dependency Dashboard.
  There is no published approved 1.2.4 issue and no selection to implement.
- Fresh PR inventory: #127 merged 20 October 14:15:17Z, #128 17:03:54Z,
  #129 21 October 02:33:03Z; #130 merged 04:34:59Z. Closed #124–#126 implement
  1.2.3. Native blockers re-read via `gh api .../issues/{124,125,126}/dependencies/blocked_by`:
  #124 → #114/#99/#101/#118/#80/#56; #125 → #124/#120; #126 → #125;
  all returned closed. Existing closing PRs are merged. No native blocker
  graph can exist yet for an unpublished 1.2.4 ticket.
- `gh pr view 130 ... --json state,mergedAt,mergeCommit,statusCheckRollup,url`
  confirms full Scaffold verification, Dependency audit, all nine browser shards
  and Browser smoke/accessibility aggregate **SUCCESS** in
  [run 39542996621](https://github.com/nishanthturnstile/aarili/actions/runs/39542996621).
  Fast verification is expected SKIPPED on promotion.
- `gh pr checks 133 --repo nishanthturnstile/aarili`: Fast verification **pass**
  (2m17s), Dependency audit **pass** (20s), expected full/browser skips in
  [run 39553660557](https://github.com/nishanthturnstile/aarili/actions/runs/39553660557).
  #133 merged 06:13:30Z, supplies current development baseline. These checks
  are inherited baseline evidence, not fresh acceptance for proposed repeat code.

The requested REA prompt explicitly states: **“do not begin application changes
without a selected approved issue.”** The tracker also requires concrete ticket
breakdown approval before publication. Preparation therefore proceeds to a
reviewable packet, with A1 recommended for selection; no application changes
are authorised by merely verifying that the old prerequisites merged.

## Research and design validation

The linked REA ledger retains **17 actual Evidence records** outside Git, including
one newly persisted synthetic Nool repeat, cancel/reopen, Clone confirmation,
new-date reload, original-source follow-up and TailorMan list/profile/bill inspection.
All limitations, rejected calls, one failed phone locator, incomplete event coverage
and the Nool profile Not Found result are preserved. One second browser launch
was automatically rejected (`blocked by policy`); no configuration changes or
repeat shell launch were used. Existing-browser REA scenarios supplied the
supported investigation route.

Design choices are Aarili-specific, mapped to requirements and actual contracts.
No competitor code/assets/contracts, new rate, financial policy, merge threshold,
production configuration or live customer data entered the repository.
The field matrix explicitly separates reuse/reconfirm/reset/unavailable and
covers every current Quick Order/service draft field plus downstream facts.
The packet defines five vertical tickets, dependencies, acceptance IDs,
rollout/recovery and separate publication/selection gates.

Impeccable planning context was read against the existing Orders surface. Its
launcher reported missing PRODUCT.md/DESIGN.md and an orphaned surface brief;
the named `apps/web/src/app/small-services.tsx` actually exists in this checkout.
No context repair or competing product/design authority was created: this task's
explicit project baselines and design system govern preparation. No UI source
was edited, so implementation detector/pixel checks are not represented as run.
Verification-before-completion guidance is applied to documentation checks below.

## Preparation checks

Fresh `pnpm verify:fast` completed **exit 0, 87.795 seconds** on the unchanged
application revision `bc23c0e` plus the preparation documents/roadmap and owner's
existing prompt. It ran actual lint/boundaries/tokens, Knip, strict types,
**58 unit test files / 262 tests passed**, negative DTO/UI type checks, OpenAPI
and production build. Unit duration **10.73s**. The final build had **12/12
successful tasks**, **11 cached**, with a fresh web production build **13.919s**
for the build task graph. Cache reuse is explicit; this is no repeat-feature test.
Raw command output is outside Git at
`%TEMP%/aarili-repeat-history-verify-fast-20261021.log`. PowerShell's redirection
renders normal native stderr progress as `RemoteException` text at the log start;
the actual command exit is zero and the full chain completed.

A temporary `node --input-type=module` stdin check resolves local Markdown links,
checks RH-01–15 rows and literal contract field anchors. Its first run found two
missing literal anchors (`priority`, `notRequired`); the matrix was corrected
with explicit reset rows/names. Final rerun passed: **4 documents, 20 local links,
15 acceptance rows, 27 field anchors, zero failures**. `git diff --check` passed.
Final `git status --short` contains only the roadmap, owner's prompt and four new
preparation documents. No application input changed after fast verification.
The review diagram was previewed at 1000px and 390px with no console messages;
the phone rendering was visually inspected and published through T3 HTML render.
It is a preparation diagram, not a tested implementation surface.

Real PostgreSQL integration, full browser/axe workflows, PDF goldens and full
`pnpm verify` are **not run for this documentation-only preparation**. No runtime
inputs changed. The selected implementation must run its required checks and
supply all RH evidence; this note does not waive them. No fresh real-PG isolation/
atomicity claim, Tamil/AT/physical-device pass, search-recall measurement or
AC-59 time claim is made here.

## Preparation disposition (superseded by approval below)

| Requested outcome | Disposition |
| --- | --- |
| Read prompt/baselines, current source and merged prerequisites | Done for preparation; baseline and actual source anchors in design. |
| Nool repeat/clone research | Repeat creation/reload observed; Clone confirmation only; item subset/retry/durable draft and private backend unknown. |
| TailorMan customer history research | Public list/profile/bill content observed; Open/Bills navigation unchanged; no authenticated persistence/merge claim. |
| Independent repeat design and field matrix | Proposed in linked design; source immutable, new price/date/current capacity required. |
| Concrete history/identity ticket packet | Five proposed vertical tickets with RH-01–15 evidence and exclusions. Publication approval pending. |
| Implement selected approved ticket | Not started: no selected approved 1.2.4 issue. A1 is the proposed first outcome. |
| Roadmap/evidence update | Preparation traceability only; no full 1.2.4/scenario closure. |
| Delivery measurements | No implementation delivery started; no new implementation timing entry or fabricated active duration. Record start when an approved ticket is selected. |

## Original preparation handoff (subsequently approved)

Review D1–D6 and A1→A2→B→C1→C2 in the concrete packet. Publication and A1
selection require the owner's decision under the prompt/tracker gates, not REA
or Impeccable permission. After approval, use to-tickets, publish/read back issues
and native blockers, select the authorised issue, recheck merged prerequisites,
preserve unrelated edits and branch from freshly updated development in this
checkout. Provide a running synthetic review surface and record fresh RH checks
before asking implementation acceptance. Merge, deployment and live data remain
separate. No scheduled work or PR monitoring was created.

## Approved A1 implementation audit — issue #134

The owner replied **“approved and proceed”** to packet publication and recommended
A1 selection. Used the installed [to-tickets skill](../../.agents/skills/to-tickets/SKILL.md).
Published #134–#138 and read back every native blocking edge. #134 has no comments;
its #114/#120/#125/#126 direct blockers and PRs #116/#123/#128/#129 are merged.
Fetched/pulled the existing checkout at `bc23c0e`; created `codex/repeat-custom-intake`.
No worktree, merge, deployment, production data or new business policy.

A1 provides source review from an accepted custom garment (including one booking
member), explicit instruction selection, deterministic reset into a durable
`order.repeat` draft, fresh price/unknown/date/commitment review, ordinary acceptance
and paginated authorised links in both directions. Identity stays fixed to the source
customer/wearer. A selected package member never copies its package price/siblings.
Current additions are provenance/context only; A2 implements their selection.
Repeat conversion into grouped/services intake is blocked rather than losing lineage.

The core adapter reuses `mutateDraft`, `resolveOrderAcceptance` and
`acceptResolvedOrder`; strict historic Quick Order DTOs remain unchanged. Request-bound
keys replay exactly; source version/scope refresh is explicit and clears prior review.
Source locks, booking membership rechecks and current service/identity locks retain
existing publisher ordering. Authority is checked on draft reads, saves, replay,
review, acceptance and source/target links, including guardian withdrawal.

Migration `0037_repeat_custom_orders.sql` adds composite same-shop immutable origin
and target records, shop-led indexes, FORCE RLS, runtime append-only grants and deferred
provenance/acceptance guards. The existing SQL custom acceptance guards receive a
narrow repeat-to-quick projection; no old payload/snapshot is rewritten. Catalog,
bootstrap and tenant-path inventories include both tables. All writes run through
membership-bound owner `withShop()` transactions, with audit/idempotency/acceptance/
demand/lineage committed together. No new queue effect is required.

Recovery: disable repeat writes before any compatible rollback; keep migration and
lineage/history. Never run a destructive down migration or revert to a binary unable
to read the new workflow. Non-disposable schema work needs the normal backup/review
gate. New order demand is additional; original demand remains unchanged.

React Hook Form documentation was resolved with Context7 `/react-hook-form/documentation`
and fetched for full-value `reset`/`getValues` semantics. The repeat form retains the
provenance object in defaults/resets; the browser test verifies persistence/reload.
No dependency, export map, runtime package, rate or platform baseline changed.

### Fresh validation and diagnosed failures

- Initial package compilation found an overly narrow inferred snapshot object and
  TypeScript's route declaration serialization limit. Returning an extended snapshot
  and splitting the typed repeat route builder corrected those issues without changing
  architecture. UI `useRef` initialization was corrected to its installed type contract.
- First fast attempt stopped at two touched-file formatting differences. Second reached
  tests' typecheck and rejected the new test's invented `urgent` enum; corrected to
  existing `rush`. These are failures, not passes.
- `pnpm verify:fast` (third attempt): **exit 0**, **59 files / 264 tests**, unit duration
  **15.78s**, production task graph **20.784s**. Lint, boundaries/tokens, Knip, complete
  types, negative fixtures and OpenAPI generation completed in the same chain.
- Initial repeat PostgreSQL suite: **3/3, 36.57s**. Expanded suite initially **3 failed /
  3 passed, 57.25s**: tests used a booking ID as a revision ID, queried the wrong lock
  text and expected conflict rather than validation for an incomplete retired-source
  candidate. Corrected assertions, then **6/6 passed, 70.13s**.
- Added populated-0036 upgrade and concurrent current-manifest publication cases:
  **2/2 passed, 6 intentionally filtered, 24.54s**. Existing source rows/snapshots/
  requirements/demand/drafts/audit stay JSON-equal through upgrade.
- First browser attempt's unscoped Retry locator raced the in-flight request, then
  fixture teardown caused `route.fetch ECONNRESET`. The next diagnostic run surfaced
  the premature `dropped=false` assertion. Await committed-response observation before
  choosing Retry. A further run reached fresh review but checked for the warning reason
  before its response arrived; wait for the known capacity warning before filling it.
  These are test synchronization corrections, not UI passes.

Raw native logs/captures live outside Git under `.scratch/repeat-orders/`; REA raw
records remain at the separate temporary location recorded above. The source build
was dirty against `bc23c0e`; commit/PR/check links follow when actually observed.
Full PDF goldens, full repository integration/browser suite, physical Android,
fluent Tamil and assistive-technology acceptance are not claimed. No PDF renderer,
issued-document or search-index behavior changed in A1. AC-59 is not closed.

### Final software evidence

- `pnpm verify:fast`: **native exit 0, 115.676 seconds**, **264 tests / 59 files**
  (**16.04s** units), production task graph **20.262s** (11 cached tasks). This
  final chain includes lint/boundaries/tokens, Knip, types, negative fixtures,
  OpenAPI and production build. PowerShell redirects native progress stderr as
  `RemoteException`; an explicit `$LASTEXITCODE` capture confirms native zero.
  A separate final Knip command and final browser-file Biome check also returned zero.
- Broad legacy regression: **58 passed / 4 failed of 62, 651.00s**. All **44**
  existing quick/grouped acceptance cases passed. Four failures were exact bootstrap/
  tenant catalog/path expectations: new table names needed alphabetical placement
  and the newly registered repeat tenant path needed its matching assertion.
- During a stronger SQL shape check, **8/8 repeat cases failed, 111.41s**. JSON
  subtraction bound before `->` in one guard expression. Parenthesizing the JSON
  extraction fixed it. This was a real migration regression, not a flaky test.
- Final corrected PostgreSQL command:
  `pnpm exec vitest run --config vitest.integration.config.ts tests/repeat-orders.integration.test.mjs tests/owner-bootstrap.integration.test.mjs tests/tenant-isolation.integration.test.mjs -t 'RH-|A5|D1/D2/D6|D3/D8|D9'`:
  **exit 0, 12 passed / 14 intentionally filtered, 148.26s**. Includes all eight
  repeat cases and all four failed inventory cases, against final SQL/current core.
- Existing supplemental scope regression:
  `pnpm exec vitest run --config vitest.integration.config.ts tests/small-services.integration.test.mjs -t 'SS-B ORD-14'`:
  **exit 0, 1 passed / 17 intentionally filtered, 18.22s**. The full small-service
  suite was not rerun; unchanged scope behavior is checked through its main workflow.
- Three-size initial repeat browser suite: **3 passed, 1.5m**. Self-review then
  corrected the leftover strict Quick Order parser in the wearer callback, cleared
  repeat context/labels after observed access denial, and clarified the separate-order
  copy. Added page-error, keyboard/IME, dirty-navigation, 200% text, phone landscape
  and purpose-withdrawal checks. Its first run tried an obsolete Open booked order
  button after the screen had already opened the order; three cases failed at that
  test-only locator. Removing it matches the actual navigation behavior.
- Final expanded browser workflow: phone **1 passed, 32.4s** (scenario **19.4s**);
  tablet/desktop **2 passed, 1.3m** (scenarios **24.5s / 20.0s**). English/light and
  Tamil/dark, axe zero violations, fresh quoted zero/date, exact lost-create retry,
  persisted provenance/reload, keyboard checkbox, IME, dirty-navigation cancellation,
  enlarged text/reflow, static-only PWA storage, no uncaught page errors and observed
  withdrawal clearing private labels all passed. Phone lost-acceptance extension is
  recorded below when it finishes. These are emulation checks, not physical-device,
  fluent-language or assistive-technology acceptance.

### Requirement-by-requirement A1 disposition

| Acceptance | Evidence / remaining boundary |
| --- | --- |
| RH-01 | Custom and package-member SQL; one garment, new identity/code, no siblings/package allocation copied. Owner chooses the source in existing search/order context. |
| RH-02 | Property reset/strict DTO tests, retirement/current selection SQL, source review and new blank price/date browser assertions. |
| RH-03 | Existing current commitment resolver/writer; warning reason and fresh acknowledgement in UI; publisher barrier and concurrent replay SQL. No approved rate changed. |
| RH-04 | Original row and grouped proposal comparisons; populated snapshot/requirements/demand/draft/audit upgrade equality; linked target without source update. |
| RH-05 | Strict initial projection, fresh unresolved requirements, empty price/promise/review. Unimplemented financial/custody/design facts stay unavailable. |
| RH-06 | 428/412/409/422 SQL, changed-payload rejection, exact create/promotion replay, abandon, reload, IME and dirty-navigation browser checks; lost-create transport tested. |
| RH-07 | Fixed customer/wearer identity; different-wearer rejection, guardian withdrawal concurrent with acceptance, denied read/links/replay SQL; purpose withdrawal removes UI labels. No phone-based merge/match added. |
| RH-08 | Final real-PG FORCE-RLS/catalog/missing-context/cross-shop tests, composite keys, direct-SQL origin denial, injected post-target rollback and publisher/guardian races. |
| RH-09 | Draft contributes no demand; ordinary acceptance exactly once; original demand retained; separate intentional repeats allowed; capacity warning reviewed. |
| RH-10 | Three screen sizes, English/Tamil, both themes, keyboard/IME/axe/reflow/enlargement and phone landscape. Physical Android, fluent Tamil and screen-reader judgment pending; no AC-59 time target claim. |
| RH-14 | Populated 0036 upgrade passes; compatible-reader/write-disable recovery documented. No destructive rollback tested or authorised. |
| RH-15 | Source references contain opaque IDs/digests, not private copies; memory-only recovery/cache, static-only worker and no live activation. Privacy retention/redaction remains under existing activation gates. |
| RH-11/12/13 | A2/B/C1/C2 are published, blocked and unimplemented. Full service repeat/history/identity work is not claimed. |

### Running manual review packet

By **2026-10-21T09:28:12Z**, final synthetic owner sign-in and source review passed
on the disposable host. Open
`http://127.0.0.1:64776/orders?order=01a15dc9-0f0b-7264-8575-81ae5d8f0df5`.
Use the private local `.scratch/repeat-orders-review-host/private.json` access method;
credentials never enter Git/chat. If stopped, start after the normal package/web
build with `node scripts/review-repeat-orders.mjs`; read its new loopback URL.
Stop and remove disposable access with `node scripts/review-repeat-orders.mjs stop`.

1. **RH-01/02/04:** Open Review reusable details. Confirm the source code/wearer,
   prior price/promise and requested instructions. Instruction reuse starts unchecked.
   Choose it deliberately, then create the new draft. Expect the new price/date empty,
   identity fixed, ordinary Simple mode and original record still unchanged.
2. **RH-02/03/06:** Enter a new delivery date and price (including zero or explicit
   To be quoted). Save, reload, then review the current commitment, explain any
   capacity warning and acknowledge it. Confirm booking. Check new code and both
   source/new-order links; original promise and requirements remain historical.
3. **RH-10:** On an actual Android phone and a tablet/desktop, try English/light and
   Tamil/dark, keyboard/screen reader and enlargement. Judge source/new distinction,
   Tamil wording, disabled identity controls, recovery explanations and focus order.
   Automation already covers retry/rollback; do not replay terminal checks.

Copyable report: `RH-xx — pass/fail — observation`; include device/RAM/browser for
physical review and whether Tamil/assistive-technology review was performed.
All human findings remain pending. Owner merge review is separate.

T3 preview was attempted first, but snapshot returned
`Preview automation snapshot timed out after 15000ms.` twice. The repository
Playwright workflow was used; `.scratch/repeat-orders/live-review.mjs` confirmed
ordinary sign-in/source review and saved `review-source.png`. Six viewport/locale
captures remain under `.scratch/repeat-orders/ui/`. No hidden browser acceptance
or screenshot is represented as a human report.

### Final recovery extension and canonical IDs

Phone lost-acceptance extension: first **1 failed, 48.0s**. The trace showed the
acceptance committed, its response was dropped, and the immediate exact retry
received **429**; there was no duplicate acceptance. The test now honors the
actual `Retry-After` and retries the retained command. Follow-up **exit 0, 1 passed,
1.4m** (scenario **1.3m**) includes lost creation AND lost acceptance, then checks
one target, unchanged source, correct lineage and authority-denial cleanup.
Tablet/desktop share the same workflow; fault injection for acceptance is phone-only.

A final API edge correction uses the fetched canonical order ID in provenance,
so a valid uppercase UUID path cannot create a database-only conflict. SQL reset
comparison preserves the source intake's stored identity spelling while composite
UUID checks enforce the same people. Added uppercase-path coverage to the existing
custom reset/replay test; affected upgrade/reset SQL and final fast evidence follow.

Canonical-ID follow-up: **exit 0, 2 passed / 6 intentionally filtered, 31.22s**
(populated upgrade plus custom reset/replay/cross-shop/abandon using uppercase source
path). Final frozen `pnpm verify:fast`: **native exit 0, 99.608 seconds**, **264 units /
59 files, 13.46s**, production task graph **15.490s** (10 cached tasks). The complete
chain passed against final application/SQL inputs. Documentation-only closeout
followed; final local link check passed **4 documents / 21 links / RH-01–15** and
`git diff --check` passed. No dependency/package/runtime export change warrants an
extra clean portability build. Hosted Linux feedback follows the authorised draft PR.

The owner-authored source prompt and its initial roadmap link are preserved and
included unchanged as the task brief, alongside the approved preparation packet.
All other changes belong to A1; no unrelated branch/worktree changes were made.

### Publication and review state

Capability commit `96c10d2bc1c7d9b13094c87a1fd0e17fc8a66c22` was pushed on
`codex/repeat-custom-intake`; draft [PR #139](https://github.com/nishanthturnstile/aarili/pull/139)
opened **2026-10-21T09:38:58Z**, targeting `development`, closes #134 and was
immediately registered with T3. Working tree was clean at publication. The later
closeout commit changes documentation only; application inputs match the tested
capability commit. No merge, deployment or live-data action.

At **09:39:05Z**, Fast verification and Dependency audit were **QUEUED** in
[run 39578594864](https://github.com/nishanthturnstile/aarili/actions/runs/39578594864).
Full scaffold/browser jobs are expected skipped on a feature PR. These are pending
hosted results, not a CI pass. A documentation push may supersede this run.
No monitoring/scheduled task was created. Owner/physical-device/Tamil/AT reports
remain pending, and #135–#138 retain their direct blockers.
