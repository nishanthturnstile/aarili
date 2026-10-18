# Issue #99 — operating templates and exact service manifests

Roadmap **1.1.2c**, ST-03/04/07/10–12; SET-04/08, ORD-05/06,
DES-02, JOB-01/02/10 definition contributions; AC-11/12 partial.
Product §§3/6/9–15/24–25/27/29.1/30.1/32–33 and architecture
§§6–11/15 remain authoritative. This implements configuration and labelled
requirements preview, not order/task execution or production authority.

## Authorization and isolation

Owner selected #99 and authorized this specific parallel T3 worktree alongside
independent #101. Assigned worktree:
`C:/Users/Nishanth Murugan/.t3/worktrees/aarili/t3-53d0d7c3`.
Clean integrated base `f604acbba9144762b868cbf69c61aa8302b96ecb`;
branch renamed from the fresh T3 branch to `codex/operating-templates-99`.
Authenticated GitHub native blockers are #97/#98, closed through merged
#102/#104. #104 Fast verification and Dependency audit passed.
No additional worktree, publication, issue/PR mutation, merge, deployment or live
activation is authorized. Parent checkout and review host 59673 remain untouched.
Shared final verification uses the exclusively created parent
`.scratch/parallel-99-101/verification.lock`, removed only by its acquiring process
in `finally`. Each PostgreSQL/review scenario uses disposable data and random ports.

## Delivered behavior

One exact manifest revision owns a service's finite operating templates, pinned
catalogue service/piece/add-on definitions and exact measurement-form definitions.
Each section must be reviewed as applicable (with items) or not applicable (with
a scoped reason and no items). An incomplete section remains a recoverable draft.
Manifest publication and availability have separate immutable histories and CAS
pointers. Current eligibility rechecks every source; explicit historical reads
preserve old versions after source edits or disablement.

Materials capture finite kind/source choices; tasks capture stable keys,
predecessors, finite prerequisite decisions, illustrative milestones and owner
assignment; quality definitions link exact local task keys; instructions separate
internal/customer audiences. Construction and decoration are separate sections.
Manual/external method questions create no pattern engine. Confirmation topics
are finite and placeholders are restricted to `service`, `scope`, `price_basis`,
`ready_date`, `collection_date`, `supplied_materials`. Customer wording rejects
markup/scripts, unsupported tokens, private indicators and copied internal content.

Preview shows required/optional configuration separately from applicability and
unresolved/not-required state. Applicable work and optional undecided work stay
unresolved; explicit exclusions show their reason. Price/date placeholders remain
unresolved. Exact form fields appear without wearer values. No preview item is
received, completed, passed, ready or approved. Editing content invalidates its
preview; generation fingerprints content, exact sources and authenticated owner.
Simple/Detailed preference (#100) and commitment binding/evaluator (#101) are
outside this implementation.

## Requirement evidence

| Requirement | Evidence |
| --- | --- |
| ST-03 / acceptance 1–2 | Bounded strict draft/command schemas, all section editors, durable save/reopen/revision; missing sections cannot publish; scoped not-applicable reasons; honest optional/unresolved preview. Unit and real PostgreSQL tests. |
| ST-04 / acceptance 3 | Independently published before/after craft sequences with parallel trim; stable task keys; self/missing/cyclic/duplicate/foreign and optional bypass negatives. 60 generated graph cases. Local edge/quality FKs and trigger guards. |
| ST-03 / acceptance 4 | Separate construction/decoration, finite confirmation topics/tokens, script/private-content negatives; missing illustrative values remain unresolved. |
| ST-07 / acceptance 5 | Exact catalogue/piece/add-on/form/template revisions, attributable history, disable/current eligibility, old reads unchanged; real publication and first-publication races. |
| ST-10 | All eight tenant tables FORCE RLS, composite tenant FKs, missing-context reads denied, foreign API denial; 428/412/409/422; replay/changed-request/action/actor negatives; rollback after actual append/advance/draft update/audit/result persistence. |
| ST-11 | Bilingual 360×800, 820×1180, 1440×900 browser matrix, light/dark, keyboard, IME, axe/reflow, exact-key lost save/publication responses, reload, conflict/cancel, unavailable/history and sign-out. Final results below. |
| ST-12 | Existing owner-only transaction and typed Hono/client boundaries; zero order/stock/custody/approval/message/task-execution APIs or jobs introduced. Populated customer/adult/minor/settings/catalogue/form history survives additive upgrade. |

## Migration and recovery

Only **0027_service_templates.sql** is allocated. It adds definition/availability/
entry/reference/form/item/edge/quality-task tables, tenant-composite keys,
shop-leading indexes, forced matching policies and least runtime grants.
Append-only provenance and deferred commit guards tie exact draft content,
actor, audit, pointer and promoted result to one transaction. Child rows mirror
reviewed content; task edges and quality links reference local immutable item keys.
Database guard rejects task cycles and optional predecessor bypass.

No approved content is seeded. Apply using the existing advisory-locked migration
runner only after applicable review/backup approval for non-disposable data.
Compatible application rollback retains all additive tables and immutable history;
there is no destructive down migration or reinterpretation as approved defaults.
Restore, privacy/retention, policy, pilot and live-data gates remain unchanged.

## Verification ledger

Environment: Windows PowerShell, pinned Node 24.21.0 and pnpm 12.11.2;
strict TypeScript 7.0.2; frozen lockfile. Installed Turbo running-tasks docs and
Next `use client` docs were read. Context7 library→docs fetched Zod 4 strict
objects/refinement, React controlled inputs/labels and Playwright locator/assertion
documentation. No dependency or toolchain baseline changed.

- Frozen install: exit 0, 437 packages, unchanged lockfile.
- Focused unit/property: exit 0, 6 tests, including 60 generated graphs.
- PostgreSQL `pnpm exec vitest run --config vitest.integration.config.ts tests/service-templates.integration.test.mjs`:
  2026-10-18 21:51:25–21:52:37 IST, exit 0, 4 tests, 72.74 seconds.
- Impeccable mechanical detector on both new UI files: exit 0, `[]`.
- Final fast/browser/clean-install verification, tested source fingerprint and
  review-ready timing are recorded after completion below.

Corrected runtime `pnpm verify:fast` acquired the lease at **22:04:15.697 IST**
after waiting from 21:58:15.445, and completed **22:05:47.933**, exit **0**:
501 files checked, 302 boundary sources, 71 UI/token sources, 223 tests in 51
files, strict and negative types, offline OpenAPI and production build (12 tasks,
14.406s). A prior complete fast pass at 21:55:14–21:57:45 had 222 tests, before
the documented self-review corrections. Source snapshot at the corrected runtime
gate was `860162016a4dfd0d6f4d5cf5e367cb418603599a972b2bc9d951679641901fa1`
(580 source/configuration files; raw dirty-scope hashes retained in `.scratch`).

The subsequent generator change adds all six template routes
to the offline OpenAPI generator and asserts their presence: focused Biome and
`pnpm exec node scripts/generate-openapi.mjs` both exit **0**, **59 paths**.
The new SQL file's line endings were normalized to LF before corrected PostgreSQL
verification, which passed **4/4**, exit **0**, **30.52s**, 22:07:21–22:07:52 IST.
This includes same-shop actor and changed-payload denial and historical-preview
content mismatch. Database/core inputs have not changed since that pass.

The first browser matrix passed **3/3** in **4.0 minutes**, exit **0**, ending
22:12:43.958 IST. It covered full English flows and English/light–Tamil/dark
axe/reflow. A direct Tamil-flow extension exposed review completeness issues:
read-only review/history now show both manifest names, component applicability
and reasons, form-to-piece scope, and aliases. Cancel restores focus to the new
manifest action. These UI-only changes require a fresh production web build,
strict web check and the final six English/Tamil × viewport cases. They do not
invalidate the unchanged core/property/PostgreSQL evidence. The intermediate
names-only build passed at 22:15:35; subsequent scope/focus changes are included
in the final pending build/matrix, not claimed under that earlier build.

The reviewed production rebuild passed at the start of the 22:21:07–22:28:55
lease; all **6/6 English/Tamil × phone/tablet/desktop** workflows passed in
**7.5 minutes**, exit **0**. The explicit web typecheck, root lint and Knip also
passed. Clean frozen install/package builds and all **46 export imports** passed,
exit **0**, 22:28:55–22:29:57 IST, with unchanged lockfile.

A supplementary exact-history axe check then exposed two moderate semantics
defects: `heading-order` on read-only section headings and `landmark-unique` on
repeated read-only preview regions. Original failure: **1 failed, 2 not run**,
exit **1**, ending 22:30:27.930 IST. `.scratch/browser-history-1.log` retains the
raw violations; `.scratch/history-a11y-original-failure/` retains screenshot,
context and trace. Read-only section headings now progress from h3 to h4 and
read-only previews rely on their labelled detail/history parent instead of adding
duplicate landmarks. The editor retains its one named preview region. No business
data, state or command changed. A fresh affected web build and three bilingual
history/axe/reflow scenarios are pending; the passed business workflows, core,
database and export checks are retained for unchanged inputs. Fresh closeout
root lint (**502 files**) and Knip both exit **0**.

Final affected web production build passed (compile **2.3s**, strict build types
**3.5s**), then the corrected history suite passed **3/3**, **58.6s**, exit **0**,
ending **22:35:38.961 IST**. Every project exercised English/light and Tamil/dark,
exact template/form sources, axe and 200% reflow. The explicit strict web
typecheck passed again after these semantic changes. Editor/business-flow inputs
were unaffected by the two read-only semantic corrections; the earlier 6/6 flow
results remain valid. There is no repeated backend, database or export run.

Final source/configuration fingerprint: **`b3214fb98e83472feb4054999d57fcc0a46194d2b7f556fe6f010c66e5133e3f`**,
**581 files**, based on `f604acb` plus this issue's dirty implementation scope.
Per-file hashes are retained in `.scratch/source-final.json`; the full fast gate's
earlier exact snapshot is `.scratch/source-at-fast-final.json`. The intervening
changes are the documented UI/test refinements, offline generator and SQL LF
normalization. Documentation is outside this code fingerprint. No dependency,
toolchain, root script or lockfile baseline changed. `git diff --check` exits 0.

| Actual command | Exit | Relevant result |
| --- | --- | --- |
| `pnpm verify:fast` | 0 | 223 tests / 51 files, lint, boundaries/tokens, Knip, strict/negative types, OpenAPI, production build; later affected UI inputs checked below |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/service-templates.integration.test.mjs` | 0 | 4 real PostgreSQL tests; final 30.52s |
| `pnpm lint` / `pnpm knip` | 0 / 0 | Final 502 files, 302 boundary and 71 UI/token sources; no findings |
| `pnpm --filter @aarili/web typecheck` | 0 | Generated routes and strict `tsconfig.build.json` |
| `pnpm --filter @aarili/web build` | 0 | Final production output and strict Next build types |
| `pnpm exec node scripts/generate-openapi.mjs` | 0 | 59 paths; all six template routes asserted; artifact regenerated after Playwright output cleanup |
| `pnpm exec node scripts/test-ui.mjs service-templates.spec.mjs --max-failures=1` | 0 | 6 full language/viewport cases, 7.5m |
| `pnpm exec node scripts/test-ui.mjs service-templates-history.spec.mjs --max-failures=1` | 0 | 3 history cases, both languages, 58.6s; original axe failures corrected |
| `pnpm exec node scripts/verify-service-templates-exports.mjs` | 0 | Frozen install, 10 package builds, 46 imports; unchanged lockfile |

All heavy commands used the shared exclusive lease. Full `pnpm verify`, unrelated
full browser, PDF golden/smoke, hosted CI and dependency audit were not rerun:
they remain promotion/publication gates under the workflow; this issue uses its
required fast, focused database/browser and clean-install gates. Human fluent
Tamil, physical Android, AT and production business-content acceptance remain
pending. No publication, merge, deploy or live-data activation occurred.

Original local failures are retained in `.scratch` logs and tool output:
the initial auth build displaced the existing leading Bun declaration directive
(TS2307); restoring the directive resolved it. The first projection build inferred
a section union too narrowly for measurement rows (TS2322); the explicit preview
contract now types those rows. Direct web `tsc` before route generation reported
missing `LayoutProps`; actual `next typegen` in repository typecheck passed.
PowerShell execution policy rejected a scratch script file; the same local script
was invoked as a script block. The first lock wrapper treated ordinary native
stderr as a terminating error; native output capture was corrected and the lease
released in `finally`. Fast gate attempt 2 stopped on two formatting differences;
Biome corrected them. Logs are not rewritten by retries.

## Owner review packet

Production-built synthetic review host, exact URL, private access path, startup,
teardown, review sequence and final source fingerprint follow after verification.
Credentials remain in the worktree-local private access file only, outside Git,
chat and logs. Human fluent Tamil, physical Android, assistive technology and
owner business-content review remain pending; emulation does not close them.

Start/stop from this assigned worktree with pinned Node on `PATH`:

```powershell
$env:PATH = 'C:/Users/Nishanth Murugan/AppData/Local/Author Software/nvm/installs/v24.21.0;' + $env:PATH
pnpm.cmd exec node scripts/review-service-templates.mjs
# After review, in another terminal in this same worktree:
pnpm.cmd exec node scripts/review-service-templates.mjs stop
```

The host uses production `.next` output and disposable synthetic PostgreSQL,
binds loopback on a random port and writes private sign-in only to
`C:/Users/Nishanth Murugan/.t3/worktrees/aarili/t3-53d0d7c3/.scratch/service-templates-review-host/private.json`.
If restarting after source changes, run the affected approved build checks first.
Stop requests normal cleanup. Wait for `host.lock` and `private.json` in that
review directory to disappear; the running host removes its web process, private
access and disposable database. The worktree and committed source remain intact. The parent's
existing review host on 59673 is unrelated and must remain running.

Try and observe in one session:

1. **ST-03/07:** Open Operating templates, inspect `SYNTHETIC blouse-before-craft`
   and `SYNTHETIC revised salwar after cutting`. Check both names, actor/effective
   history, exact component/form revisions, scope/applicability and reason. Generate
   requirements: required work and optional undecided decoration stay unresolved;
   price/date placeholders stay unresolved. No item is completed or approved.
2. **ST-03/11:** Revise a synthetic manifest. Edit bilingual material, quality,
   instruction and confirmation fields and keep construction/decoration distinct.
   Review not-applicable sections with reasons. Save, reload and resume; check
   that editing invalidates the old preview. Cancel dirty work once with “stay”
   and once with “leave”; focus returns to the new-manifest action.
3. **ST-04:** Compare craft → cutting on the blouse with cutting → craft on salwar;
   parallel trim remains independent. In a draft try a self/cyclic/missing
   predecessor, an optional predecessor of required work, or an unsupported
   confirmation token. Publication review stays unavailable until corrected;
   saved draft content remains recoverable. No task is actually started.
4. **ST-07/11:** Review the published/yours comparison in Tamil and English.
   Both names and all scope decisions remain visible. Publish a synthetic
   revision and reopen the older exact history. Disabling a linked catalogue
   component blocks new selection without erasing the manifest's old content.
5. **ST-11/12:** Try Tamil keyboard composition, long labels, keyboard focus and
   text enlargement on the actual Android/AT setup; sign out and confirm private
   editor/preview content disappears. Report language, physical device/browser/RAM
   and assistive technology separately from the automated emulation.

Copyable response: `ST-03 / ST-04 / ST-07 / ST-11 — pass/fail — observation`.
No human review response, business policy approval or merge authorization is
implied by this packet.

Running review: **http://127.0.0.1:56860/settings?section=serviceTemplates**.
Hidden review process **48928** started **22:35:55.427 IST**; private access file
and HTTP 200 readiness were observed **22:36:21.588 IST**. Exact earlier ready
time was not instrumented. The running host uses the final production build and
real core/draft/publication commands to seed two independent craft sequences and
salwar revision history. First usable owner review is therefore observed at that
time; actual human acceptance remains pending. Review packet/source closeout
observed **22:37:54.992 IST**; local commit preparation follows.

Expected integration overlap with independent #101: small additive changes to
auth/API composition, package exports, owner navigation/message registration,
boundary/isolation inventories, offline OpenAPI composition, roadmap and delivery
records. Reconcile both additions without dropping either. Domain contracts and
migrations are independent: #99 owns 0027 only, and does not alter the evaluator,
commitment rule schemas, #101's module or its 0028 migration. No contract conflict
or unpublished prerequisite was encountered. Preserve this worktree and running
review host for owner review; cleanup needs its own applicable authorization.
