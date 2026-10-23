# Manual pattern preparation: baseline, verification and approval status

23 October 2026. **A #164 implemented; local verification passed. Owner review and CI remain required.**
The owner approved the independent design MP-D01–12 and concrete A → B packet,
then requested implementation. [A #164](https://github.com/nishanthturnstile/aarili/issues/164)
and [B #165](https://github.com/nishanthturnstile/aarili/issues/165) are published
with native blockers read back. A's ten direct prerequisites are merged; its
branch `codex/manual-pattern-fileless` starts at latest development `c04020a`.
B remains blocked by A and is not implemented. No worktree or dependency change.

## A implementation and review boundary

- Contracts/core/repository/API and typed private-query client implement exact
  existing manifest/native-piece capability decisions, pending preparation,
  fileless locator versions, review events and explicit reference selection.
  The existing durable-draft path provides atomic audit, idempotency and ETags.
- Migration `0049_manual_patterns.sql` adds six tenant relations with forced RLS,
  scoped foreign keys, immutable history guards, transactional publication and
  private replay snapshots. No approval is seeded. Current design/measurement
  inputs are compared without rebinding older records. Digest and input-selection
  counters reject stale review/selection; reference-only cannot authorize cutting.
- Pattern values and private drafts extend audited measurement erasure and
  contact merge/relink exclusions. All private reads and replay recheck current
  wearer/guardian authority. User text is absent from audit/idempotency results.
- The actual order-detail component provides English/Tamil manual/external
  configuration, physical reference editing, separate review/selection, exact
  history pagination and visible scale/formula/cutting limitations. Cache and
  recovery controllers clear on access invalidation; no browser persistence.
- A has no media ownership or upload control. Sketch/PDF linking, uploaded
  replacement and deliberate repeat reuse belong to B. Custom-order/single-form
  integration limits below remain explicit; no full 1.3.3/PAT-03 closure claim.

Completed checks, the review URL/steps, acceptance map and timings follow.
Earlier preparation evidence is retained as dated history.

## A acceptance map

This checklist maps the implementation and fresh automated evidence. Human
acceptance remains separate from the passing command results.
`tests/manual-patterns.integration.test.mjs` covers the fileless lifecycle,
privacy/history, commands and populated migration; `manual-pattern-inputs` adds
exact inputs and a real withdrawal/draft race. `tests/manual-patterns.test.ts`
covers strict draft/command boundaries and arbitrary locator preservation.

| Acceptance | Concrete evidence / review target |
| --- | --- |
| MP-A01 | Unconfigured promotion 409; explicit exact-manifest path configuration; manual and external saves; strict rejection of automated/file/cutting flags. Browser configuration and disabled entry paths. |
| MP-A02 | Pending method has no saved reference; folder 12 persists with zero media rows. Browser records a locator without file input. |
| MP-A03 | Unknown source stays unknown; external supplier and R2 label remain independent from immutable version identity. Date/rights/unit/scale fields are displayed with their stated uncertainty. |
| MP-A04 | Exact design and measurement save/review/selection; invalid/wrong-shop/wrong-piece/wrong-wearer sources denied. Strict known-without-ID and unknown-without-reason validation. Not-applicable requires existing exact policy decisions in core; unsupported service/multi-form remains outside A. |
| MP-A05 | Folder 13 is an immutable successor; folder 12 remains selected until explicit replacement. Both selection events and original locator remain. Browser checks the same visible distinction. |
| MP-A06 | Review evidence/acknowledgement required; changes-required/withdrawn block selection and remain visible after comparison-context changes. New version is unreviewed; review and selection have separate events. No cutting status exists in this contract. |
| MP-A07 | Detail/editor/selection/history notes keep scale/formula limitations visible. Physical-only has no print output. No formula evaluator, tolerance or calibration state. |
| MP-A08 | Changed design selection produces mismatch/unreviewed and stale digest 412; old design/measurement IDs persist. Browser changes a selected measurement while a decision is open, retaining the conflicted draft. |
| MP-A09 | Unavailable path preserves historical reads and blocks promotion/new selection. Type/manifest identity is exact and current; no name mapping. |
| MP-A10 | Current-authority reads/draft/replay; real withdrawal fences a racing private draft. Audited erasure clears every new private value and replay snapshot while retaining version provenance. Existing guardian/measurement/merge regressions supply shared-policy coverage; no new minor permission model. |
| MP-A11 | Real app_user missing/wrong-context reads, forced policy catalog audit, immutable update denial, concurrent writers 200/412, 428/412/409/422, exact retry and injected private-write rollback. Private queries reject URL fields, foreign origin and oversized body. |
| MP-A12 | English/light and Tamil/dark phone/tablet/desktop keyboard, axe and overflow checks; recoverable 503, stale comparison and access clearing. Actual production component and API run in disposable hosts; no storage persistence. Fluent Tamil, screen-reader and physical device acceptance remain human gates. |

## Local manual review

Startup from the pinned workspace toolchain: `pnpm build:packages`, then
`pnpm exec node scripts/review-manual-patterns.mjs`. Docker must be running.
The launcher uses disposable PostgreSQL/S3 fixtures and the actual client/API.
It prints a loopback sign-in URL and writes synthetic access/record IDs to
`.scratch/manual-pattern-review-host/private.json` outside Git. The verified
23 October host is **http://127.0.0.1:52701/sign-in**; its port/data are temporary.
It was refreshed on the current compiled core at **13:53:04.757 UTC**.
Stop with `pnpm exec node scripts/review-manual-patterns.mjs stop`.

1. Sign in using that local access file; open Pattern preparation. Whole garment
   starts unconfigured. Choose the first native piece (`SYNTHETIC design-bottom`).
2. MP-A01/02/03: inspect explicit manual/external availability. The selected
   synthetic reference is folder 12; source/input uncertainty is visible. No
   upload or generation action is present. Review the other piece's empty state.
3. MP-A05/06/07: expand Recorded versions and Review and selection history.
   Folder 13 is a reasoned successor, unreviewed, while folder 12 stays selected.
   Inspect actor/time/reason, exact IDs and visible scale/formula/cutting notes.
4. MP-A04/08/09: exact authorized IDs can be entered, or the currently selected
   input deliberately pinned. Keep unknown inputs reference-only. Change path
   availability in this synthetic fixture; old references stay readable.
5. MP-A10/12: switch English/Tamil and theme, use the keyboard and a narrow
   viewport, resume a saved draft, and use End access. No private references may
   refill. The automated fixture separately exercises stale input changes,
   concurrency, consent and audited erasure; do not run privacy SQL on live data.

Human review remains required for workflow fit, source/rights wording, fluent
Tamil, screen-reader announcements and physical phone/tablet use. There is no
printer/scale, fit, customer approval, cutting release or production activation
claim. Restore drill, approved retention/privacy/configuration and pilot gates
remain inherited requirements. Do not merge until required CI and owner review.
Report human findings as `MP-Axx — pass/fail — observation`, with device/browser
and language where relevant. Pending human acceptance is separate from automation.

## A verification record

Pinned Node **24.22.1**, pnpm **12.15.0**, existing dependencies/lockfile.
Raw logs/results are outside Git at
`%TEMP%/aarili-manual-pattern-a-20261023/`.

| Check | Result / retained failure |
| --- | --- |
| Initial `pnpm test:integration tests/manual-patterns.integration.test.mjs tests/manual-pattern-inputs.integration.test.mjs` | 2 files / **5 passes, 71.16s**, after fixing migration syntax, strict response projection, pure redaction-helper privilege and privacy alias defects. Subsequent stronger cases require their own results. |
| `pnpm verify` | Lint/Knip/types, **317 unit passes**, negative types/OpenAPI and Linux PDF passed. Legacy order-piece upgrade fixture omitted the new empty pattern FK when rebuilding synthetic historical tables; 2 failures. Stopped the failed run at **12:03 UTC** before repeating via clean-install verification. Not a passing aggregate. |
| Focused pattern/input plus two failing order migration cases | **7 passed / 1 failed / 42 skipped, 170.36s**. Both order cases passed after adding pattern_scope to the fixture's explicit empty-relation inventory. The new real withdrawal race reached both transaction barriers, then incorrectly parsed an already parsed fixture response; the test helper usage is corrected. |
| First `pnpm verify:clean` | Frozen native install, lint/Knip/types passed. Unit **316 passed / 1 timed out** at the unchanged 5s jobs property timeout, during 68-worker startup alongside browser compilation. **Exit 1, 212.19s**; no full-suite pass claimed. |
| `pnpm exec vitest run tests/jobs.test.ts` | Unchanged property file **2 passed / 669ms**. |
| Four-worker clean runs | 317 units and Linux PDF passed. Explicit tenant-table inventories in the isolation and bootstrap tests omitted the six new tables. Their RLS checks returned the new tables correctly; the expected inventories were extended without removing policy/privilege assertions. Stopped these failed runs after diagnosis. |
| Serial clean run | Frozen install, lint/Knip/types, 317 units, negative types/OpenAPI and Linux PDF passed. Four draft cases failed because their production-registry assertion omitted the two new workflows. Stopped the failed snapshot after diagnosis. The corrected full draft file passed **6 tests / 107.35s**. Portability/install results remain valid; the only subsequent production change was the framework-free comparison-state correction below. |
| `pnpm test:ui` with nine relevant files, all three projects | **29 passed / 7 failed**, command **11:50:52.418–12:22:43.797 UTC / 1911.38s**. The six shared measurement failures matched nested fitting summaries; the draft failure disposed an active route handler. Corrected direct-child selectors and awaited route teardown; no assertions removed. |
| `pnpm test:ui` with pattern, measurement sessions/history and draft recovery | **18 passed / 3 failed**, **12:24:03.072–12:49:08.245 UTC / 1505.18s**. All corrected shared workflows passed. The expanded pattern fixture attempted measurement replacement without its existing mandatory reviewed-reuse digest (409). Fixed the fixture to use the actual measurement review API. |
| Final `pnpm test:ui tests/ui/manual-patterns.spec.mjs --output=.scratch/manual-pattern-ui-release` | **Exit 0; 3 passed**, **12:50:46.634–12:56:07.381 UTC / 320.75s**. Phone/tablet/desktop each exercise English/light and Tamil/dark, exact measurement binding, folder revision, stale comparison/mismatch, retained input after 503/412, keyboard/axe/reflow and access clearing. |
| Current-source `pnpm test:ui tests/ui/manual-patterns.spec.mjs --output=.scratch/manual-pattern-ui-reviewed` | After the comparison correction, **exit 0; 3 passed**, **13:52:19.606–13:58:56.519 UTC / 396.92s**. The shared UI and the 18 corrected regression cases were unchanged; no assertion or timeout was weakened. |
| Final `VITEST_MAX_WORKERS=4 pnpm verify`, followed by direct `pnpm --filter @aarili/web build` and `node scripts/check-artifacts.mjs` with the private canary | **Both command exits 0**, **13:47:58.077–14:19:53.021 UTC / 1914.95s**. Lint/boundaries/tokens, Knip, strict types, **68 unit files / 317 tests**, negative/UI types, OpenAPI, **55 real PG files / 288 tests (1706.16s)**, Linux sandbox/50 strings/**5 A4/A3 PDF goldens**, production build (**15.772s**), real Next/Hono/PG readiness/outage/typed-client/worker-shutdown smoke and **29-artifact** scan passed. The direct web build additionally propagated the private canary outside Turbo's environment filtering and its fresh artifact scan passed. |

Current browser coverage is **36 distinct cases** across the nine files and
three projects: 15 unchanged cases from the broad run, 18 corrected shared cases
from the second run and 3 expanded pattern cases from the final run. This is an
evidence union, not a claim that either earlier failed aggregate passed. The
production implementation was unchanged between these browser runs; only the
affected test selectors, teardown and measurement-review fixture changed.
Final phone Tamil/dark and desktop English/light captures were visually reviewed;
the final Impeccable detector returned exit 0. Screenshots are outside Git at
`.scratch/manual-pattern-captures/`. Human/device/Tamil gates remain open.

Package export additions trigger the clean-install/native portability check under
the development workflow. The full Linux PDF sandbox/goldens run within verify;
hosted feature CI must additionally confirm the fast Linux build and audit.
The final source fingerprint covers **843 files**:
`4b717b5f52e571a512b06da6369c3fc36ea3e44d60e2f99f9c80d529d920833e`.
Cold-copy equality was recorded before its fixture corrections; frozen native
installs and package-export/type checks passed in paths containing spaces.
The final complete aggregate above ran on the corrected checkout. Earlier failed
or stopped aggregates are retained as failures, not represented as clean passes.

The final audit corrected one display edge: context changes no longer hide
changes-required/withdrawn as unreviewed. Selection was already blocked by the
stored review. Both blocking states are now tested across capability-context
changes; a prior reviewed decision still needs fresh review after input changes.
Normal sign-in and the selected folder-12/unselected folder-13 review fixture
were checked at **14:01:14.312 UTC**. Native T3 snapshots twice timed out at 15s;
the documented repository Playwright path confirmed the refreshed host instead.
Final documentation validation at **14:25:57.081 UTC** checked all **24 local
links** across the four new preparation/evidence documents and UTF-8 integrity.
The review packet was ready at **14:28:42 UTC**; PR creation, hosted CI and owner
acceptance remain separate delivery milestones.

## Preparation baseline (before owner approval)

The following inventory described preparation before implementation and does not
override the approved status above.
Sources: [brief](Manual_Pattern_REA_Prompt.md),
[REA findings](Manual_Pattern_REA_Evidence.md),
[design MP-D01–12](Manual_Pattern_Design.md),
[concrete A → B packet](Manual_Pattern_Ticket_Packet.md).
Product PAT-01/03 and applicable AC-07/08; architecture §§6–11/15.

## Historical preparation: checkout and preservation

Fetched origin and based **`codex/manual-pattern-preparation`** on
**`c04020a01c909915cd43751e68ec48e0e2215ba8`**, the latest origin/development.
Local development was subsequently fast-forwarded to that same commit with
`git fetch origin development:development` while the topic branch was checked
out. No worktree, reset, stash, unrelated commit, push, PR, merge or deployment.

Initial branch was `codex/measurement-fit-references` at `62affe3`. Pending
roadmap, Delivery_Measurements and Measurement_Fit_Implementation_Evidence edits
and the untracked supplied Manual_Pattern_REA_Prompt predated this task. Ordinary
`git switch development` correctly refused to overwrite them. The attempted
fast-forward also refused the squash-diverged topic; no integration occurred.
After examining the three small documentation diffs, deliberate
`git switch --merge -c codex/manual-pattern-preparation origin/development`
preserved them without conflicts. The original topic branch remains intact.

This work adds the four manual-pattern evidence/design/packet documents and a
scoped roadmap paragraph. The supplied prompt is preserved. The two unrelated
closeout files are deliberately untouched, including their pending status text:

| File | Preserved SHA-256 |
| --- | --- |
| `docs/agents/Delivery_Measurements.md` | `045bfb4f3f9ae33495727b07b06df9d042b54d4fdf8bd8386471ffe0d8b21706` |
| `docs/agents/Measurement_Fit_Implementation_Evidence.md` | `b3d0790e9507789e807449a3d930835e7f71ef65b1e160bb44b7b1d21ebef065` |

No implementation delivery timing entry was fabricated. This is research/design,
not an implementation PR. The selected implementation must record actual start,
verification, first-usable/review-ready/merge timings under the existing workflow.

## Historical preparation: prerequisites and approval inventory

Authenticated `gh` queried nishanthturnstile/aarili issues, comments, closing PRs,
native dependencies and checks. All listed merge commits were verified ancestors
of HEAD with `git merge-base --is-ancestor`; closed issue state alone was not used
as proof of integration. The six feature PRs below target development and each
reported successful **Fast verification** and **Dependency audit** on its head.

| Capability | Issue → merged PR | Merge commit |
| --- | --- | --- |
| Controlled design choices | #146 → [#149](https://github.com/nishanthturnstile/aarili/pull/149) | `3459ec4` |
| Exact garment specification | #147 → [#150](https://github.com/nishanthturnstile/aarili/pull/150) | `25f7f9f` |
| Private component references | #148 → [#151](https://github.com/nishanthturnstile/aarili/pull/151) | `2aa1b12` |
| Measurement sessions/selection | #153 → [#156](https://github.com/nishanthturnstile/aarili/pull/156) | `824304b` |
| Correction/history/reviewed reuse | #154 → [#161](https://github.com/nishanthturnstile/aarili/pull/161) | `d2cd8c9` |
| Exact-version private fitting references | #155 → [#163](https://github.com/nishanthturnstile/aarili/pull/163) | `c04020a` |

PR #163 merged **23 October 2026, 10:20:54 UTC**. Its required check run is
[39937564037](https://github.com/nishanthturnstile/aarili/actions/runs/39937564037),
head `62affe3`; Fast and audit succeeded. The merge commit is the preparation
base. Earlier design/measurement documents retain dated in-progress narrative;
this current status does not fabricate human acceptance or full pilot closure.

Source review also found a concrete coverage boundary: current design/measurement
target readers accept custom orders only and measurement selection requires one
form per scope. The draft explicitly blocks unsupported service/multi-form
bindings. If pattern-bearing alterations need these adapters, they require a
reviewed additional ticket before full-slice acceptance; A+B cannot silently
claim to have supplied them. No-pattern small services retain their existing path.

Technical prerequisites are also closed/merged and in ancestry: #16 → #21
(`abd67ed`), #51 → #61 (`0ba3828`), #52 → #62 (`403f24f`), #53 → #64
(`6860c13`), #54 → #66 (`a29c707`), #57 → #67 (`9998f50`), #58 → #69
(`c8f7a74`). The additional directly consumed foundations are closed/merged and
in ancestry: #55 → #65, #56 → #68, #97 → #102, #99 → #105,
#134 → #139, #135 → #140, #136 → #141, #138 → #143.

Native blocker lists were re-read for #153/#154/#155; all returned dependencies
were closed. Their closing PRs and the current integration ancestry corroborate
the design/measurement prerequisites. Proposed A/B direct edges are listed in
the packet; B's A edge cannot be satisfied until A is approved, published and
merged. Raw GitHub query/check snapshots are outside Git in the research folder.

`gh issue list --state open` returned only the unrelated Dependency Dashboard
#28. An all-state 1.3.3 search returned old design issues mentioning it, not a
manual-pattern implementation issue. No selected approved 1.3.3 issue exists.
Research/design is authorized; application writes must wait for concrete packet
approval, publication and issue selection. The source brief's instruction is:
**“Implement a selected approved issue once direct blockers merge.”** Its
publication instruction is **“Present the complete packet before publishing
unapproved issues.”** This is the remaining gate, not a missing prerequisite PR.

## Historical preparation: requirement coverage

| Requirement / requested outcome | Concrete preparation | Implementation evidence |
| --- | --- | --- |
| PAT-01 / select manual or externally supplied preparation | MP-D01/02, MP-A01/09: explicit type/path availability; automation unavailable. | Pending selected A. |
| PAT-03 / physical-only reference without upload | MP-D03/04, MP-A02/03; REA MP-R04 observes vendor free-text locator only. | Pending A; vendor evidence is not Aarili behaviour. |
| PAT-03 / sketch or uploaded output | MP-D10, MP-B01–05; REA MP-R06/09 establishes vendor persistence, not our integration. | Pending B. |
| Source, version, review, known exact inputs | MP-D04–07, MP-A03/04/06; unknown and not-applicable semantics are explicit. | Pending A. |
| Preserve replacement/revision and historical selections | MP-D06/09/12, MP-A05/08, MP-B03/07/08. | Pending A+B. |
| Visible unverified scale/formula assumptions | MP-D08, MP-A07, MP-B04; no evaluation/validation operation. | Pending A+B. |
| Reference review does not imply cutting approval | MP-D02/07/08; MP-A06/07 and every selection/reuse warning. | Pending A+B; no cutting-release implementation. |
| AC-07 / inactive historical types | MP-D01/12, MP-A09, MP-B08. | Pending A+B, with existing catalogue regressions. |
| AC-08 / no automated pattern approximation | MP-D01/02; MP-A01; excluded PAT-02/04–17. | Pending A; no generator added. |
| Isolation, privacy, consent, immutable history, retries | MP-D11 and transaction contract; MP-A10–12, MP-B05/06/09/10. | Existing foundations verified below; new paths pending real PG/browser tests. |
| Library-independent design and observed competitor gaps | REA ledger distinguishes observations/docs/inferences/unknowns; design reuses actual repository seams. | Preparation artifact; no competitor backend guarantee claimed. |

## Historical preparation: baseline verification

Application, dependency, migration, test and configuration files are unchanged.
Fresh repository verification supplies baseline regression evidence, not proof
that this unimplemented feature passes acceptance.

Native Windows PowerShell initially resolved Node 24.20.0, and pnpm was absent
from the ordinary PATH. The existing Codex runtime contains Node 24.19.0 and
pnpm 12.15.0. Located the already-installed **Node 24.22.1** in
`%LOCALAPPDATA%/Author Software/nvm/installs/v24.22.1/` and used it with that
existing pnpm 12.15.0 through a temporary verification-only `pnpm.cmd` wrapper.
PATH was changed only for that command process. No toolchain install, baseline
correction, repository script/config change or global shell-policy change.

| Command | Fresh result and boundary |
| --- | --- |
| `node --version`; `pnpm --version` in verification environment | `v24.22.1`; `12.15.0`. |
| `pnpm verify:fast` | **Exit 0**, **10:49:44.914–10:52:06.928 UTC**, **142.014 s**. Actual lint/boundary/token checks, Knip, strict types, unit/property tests, negative/UI type checks, OpenAPI and production build. **67 test files, 311 tests passed.** Final build: 12 successful tasks, 10 cached; no source edits since that run. |
| `git diff --check` | Exit 0 on the current tracked changes; CRLF normalization advisories do not indicate discarded content. Final document/link/ownership checks are recorded below. |

Raw fresh log/result: `%TEMP%/aarili-manual-pattern-rea-20261023/verify-fast.log`
and `verify-fast-result.json`. PowerShell wraps command stderr as a
NativeCommandError record at the start of the log; the actual process exit is
zero and all chained checks completed. No failed test or ignored failing exit
is being represented as a pass. Turborepo build cache use is reported, not hidden.

Final packet check at **10:56:36 UTC** returned exit 0: all **24 local links**
across the four new documents resolve, no replacement-character encoding damage,
all **eight scenario Evidence records** retain identities (including the failed
history-step record), both unrelated closeout hashes match, and tracked changes
are confined to documentation. `evidence-manifest.json` records raw-file SHA-256,
Evidence IDs, step outcomes and completeness outside Git. The check script/result
are `check-packet.mjs` and `packet-check-result.json` in that same temporary folder.
The subsequent edit only records this result; the final rerun confirms it below
in the command transcript. The scoped roadmap paragraph preserves its prior
brief and unrelated edits. Biome excludes Markdown, so no overlapping formatter
or configuration migration was added.

**Not run for this documentation-only preparation:** new pattern unit/PG/S3 or
browser/axe workflows (none exist), full `pnpm verify`, `pnpm test:ui`, PDF
goldens, dependency audit, restore drill, physical Android/Tamil/screen-reader
acceptance. There are no runtime/schema/dependency changes requiring those
additional runs here. They remain explicit selected-ticket requirements; do
not reuse baseline results to claim new pattern isolation/history/UX is proven.

## Historical preparation: approval handoff

Review the independent design and complete A/B acceptance tables. Confirm
reference-only handling of unknown inputs, the conservative review model,
unverified scale/formula display and A's physical-first boundary. The packet
is concrete enough to approve publication and select A; no running 1.3.3 review
route is claimed before implementation. Each selected issue must provide its
own real synthetic review URL/startup/records and acceptance-ID instructions.
Do not fabricate a route, credentials, production approval or completed delivery.

No issue, PR, push, merge, deployment or live activation occurred. A/B software
approval, publication, issue selection, owner merge and production policy/pilot
activation remain distinct. The supplied user instruction allows research/design
now and implementation only once its selected approved issue is eligible.
