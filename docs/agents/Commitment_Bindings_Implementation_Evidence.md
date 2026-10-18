# Category commitment binding implementation evidence

Issue #101, roadmap **1.1.2e**, ST-07–12, SET-08/11 (SET-03 integration),
AC-60 configuration contribution. Product §§6/27/29.1/30.1/32–33 and architecture
§§6–11/15 govern this delivery. The approved
[design](Service_Templates_Design.md), [ticket packet](Service_Templates_Ticket_Packet.md),
[unbound implementation](Shop_Commitments_Implementation_Evidence.md) and
[workflow](Development_Workflow.md) remain the source baselines.

## Approved checkout and independent scope

Owner explicitly approved parallel #99/#101 worktrees after their suitability
check. This child uses only `C:/Users/Nishanth Murugan/.t3/worktrees/aarili/t3-c63ef8f9`,
branch `codex/commitment-bindings-101`, clean base
`f604acbba9144762b868cbf69c61aa8302b96ecb`. The newly allocated T3 branch was renamed;
no additional worktree was created. Native blockers #97/#88 are closed; PRs
#102/#93 are merged (`797c3d0`/`964b863`). Baseline #104 required checks passed in
[run 39142093644](https://github.com/nishanthturnstile/aarili/actions/runs/39142093644).
Full issue body, comments and native blockers were read through authenticated gh.

#99 owns migration 0027 and templates/manifests. This issue exclusively adds
`0028_service_commitment_bindings.sql`, which applies directly after this base's
0026 without 0027. No #99/#100 domain implementation is imported or assumed.
Auth composition, public functions within existing export paths, commitment API,
owner commitment screen/locales, isolation inventories and traceability are
additive integration points for the parent's sequential reconciliation.

## Authority, sources and history

`approvedCategoryResolver` structurally implements the existing neutral resolver
inside the same owner-authorized transaction. It returns only current published,
available root category definitions, with exact definition/availability/version,
nullable warning extension and server-derived synthetic provenance. Foreign,
missing, unpublished and disabled sources do not resolve. Authorized immutable
history reads are separate and cannot select a current source.

The new durable workflow `service.commitment-bindings` reviews exact category
definition, availability decision and existing immutable rule IDs. Binding
revision/current-pointer tables use shop-composite source/predecessor/actor/audit/
draft references, forced read/write RLS, restricted grants and immutable guards.
Immediate server time, reason, review classification and source digest are retained.
Source publishers and binding publication share canonical advisory locks; DB
guards additionally lock/recheck exact current source pointers. A changed source
requires a new binding review. No historical row is rebound or relabelled.

An ordinary owner proposal can acquire reviewed authority only in a new explicitly
reviewed binding. Pending review and synthetic categories/rules remain pending or
synthetic. A reviewed binding does not fill missing conventions or rates. The
original 0024 migration, unbound v1 schemas and immutable rule content are retained.

The additive v2 bound-preview request names a binding. The server derives exact
sources and rejects mismatching category identity/definition/rule compatibility
assertions with 409, including when current pointers have advanced. Historical
binding reads remain read-only; they cannot invoke current preview after retirement
or source replacement. Client approval, eligibility and authoritative load fields
are rejected by strict contracts.

The four additive routes remain under the existing typed commitment module:
`GET /settings/commitments/bindings/{categoryId}` (ETag/current source status),
`GET /settings/commitments/binding-revisions/{id}` (explicit history),
`POST /settings/commitments/binding-history` (category/version keyset), and
`POST /settings/commitments/bound-preview` (contractVersion 2/bindingId).
Optional `categoryRevisionId`, `ruleRevisionId` and `scenario.categoryId` are
compatibility assertions, never selection authority. Existing durable draft
PUT/promote performs publication; there is no new mutation protocol. Existing
public export paths are extended without changing package manifests/maps.

Both paths call the **same evaluator**. Its trusted optional binding input changes
only the authority gate and fingerprint sources for v2. v1 keeps its unbound
literal contract and pending production authority. Bound sources include binding,
category definition, availability, rule, digest and calendar. Candidate demand and
live load are always unknown in bound preview. The effective warning window is
`max(shop, category)`, category null adds nothing, and a missing shop window stays
unknown. Historical source views use original revisions/windows.

Every response retains `activation: unavailable` and `effects: none`. No orders,
reservations, live capacity reads, money, jobs, messages, automatic effects or
production activation are introduced. Real acceptance/load locking remains 1.2.1.

## Owner flow and recovery

The existing Delivery and commitments screen includes category search/current
source status, exact source review, server drafts, explicit review/publication,
history and bound preview. It reuses current tokens, fonts, Base UI controls,
typed API clients and the existing draft controller/owner scope. Rule editing
remains the incumbent unbound editor. There is no second evaluator or rule editor.

Both languages retain known warnings alongside unknown load/demand/authority.
IME pauses autosave, lost responses retain the exact key, server reload resumes
the exact draft, conflicts require explicit review and cancellation protects dirty
memory. Owner invalidation clears private forms/results and disposes controllers.
No business values enter browser persistence or URLs; only opaque draft IDs do.

## Requirement mapping

| Requirement | Implementation and verification |
| --- | --- |
| ST-07 / acceptance 2/4 | Immutable binding revisions/current pointer, exact source/history reads, actor/time/digest, retirement preserves source windows; PostgreSQL history and byte-preservation tests; browser read-only history/unavailable states. |
| ST-08 / acceptance 1/2/3/6 | Transaction resolver, composite source bindings, canonical locks and stale-source rejection, separate synthetic/review authority; single evaluator; exact rule/category compatibility assertions; unit/property and real DB cases. |
| ST-09 / acceptance 4/5/6 | Server-derived v2 inputs, unknown demand/load, preserved missing conventions, source fingerprint, longer/null/shorter/missing-shop window properties; browser warnings plus unknowns. |
| ST-10 / acceptance 5 | Forced RLS/missing context, foreign refs, owner checks, 428/412/409/422, exact replay and changed actor/action/hash, concurrent source changes/CAS, five actual-write rollback points, populated baseline upgrade. |
| ST-11 | English/light and Tamil/dark phone/tablet/desktop Playwright/axe, invalid/normal/reload/loss/retry/IME/conflict/cancel/reflow/signout, immutable/unavailable history. Human Tamil/physical Android/AT remain separate. |
| ST-12 | No order/capacity/money/job/message effects; preview does not write business state; incumbent settings/customer/adult/minor paths remain regression checks. No live data. |

## Verification ledger

Native Windows; pinned Node 24.21.0/pnpm 12.11.2, unchanged dependencies/lockfile.
Heavy gates acquire the parent's absolute `.scratch/parallel-99-101/verification.lock`
exclusively, include issue/path/time, and release only their own lease in `finally`.
Disposable PostgreSQL containers/random review ports and worktree-local builds
are isolated. Fixed browser port 3103 is serialized. Parent's 59673 host is untouched.

- Initial frozen install passed, 437 packages, 28.9s. Turbo resolution before
  install correctly reported missing package; installed Turbo README/run docs
  and Next client-boundary docs were then read. An initial Next docs `.mdx` path
  did not exist; corrected to installed `.md` without changing framework settings.
- Current Context7 library→docs fetched Zod strict/extension schemas, React
  async-effect cleanup/subscriptions, Hono OpenAPI typed-client routing and
  Playwright response interception/project selection/auth-state reuse. No
  quota/network fallback or package/toolchain migration was used.
- Initial packages build passed 10 tasks, 10.372s; focused evaluator/contracts
  passed 13/13 (836ms), including incumbent v1 and 60 warning-window property runs.
- Initial strict check found a missing `readCatalogueRevision` browser adapter.
  Added the typed function over the existing route. Corrected strict check passed
  23/23 tasks (11.982s) plus root TypeScript tests.
- Windows PowerShell's Python stdin encoding replaced new Tamil labels with `?`;
  restored those labels with UTF-8 patches. Existing Tamil strings were preserved.
- First DB attempt parsed zero tests because a new helper lacked `async`.
  Corrected the helper. Second DB run: 4/5 passed, 43.55s. The failure expected
  a stale-source 409 while also sending base version 0 against binding version 1,
  correctly obtaining 412 first. Corrected the fixture's base to isolate 409.
- Initial lint/boundaries/tokens passed. A later fast attempt stopped on the
  deliberate source-refetch retry dependency annotation; added its scoped lint
  explanation. A PowerShell Biome glob was not expanded; explicit file paths
  corrected that invocation. No validation/policy/timeout was weakened.
- Fast verification reached 219/219 tests in 51 files, 57 OpenAPI paths and
  successful 12-task production build (19.247s). Final source/command-exit evidence
  and supplementary checks are recorded below when completed; PowerShell stderr
  redirection generated NativeCommandError records despite successful component
  output, so process exit reporting is being made explicit.

Completed results and retained corrections follow. All logs/private artifacts
below are ignored local evidence, never production data or credentials in Git.

- Corrected final fast command `pnpm verify:fast` exited **0**, recorded explicitly
  in `.scratch/bindings-fast-3.log.exit.json`. Lease held
  2026-10-18T16:35:50.415Z–16:37:18.924Z (88.509s): lint/boundaries/tokens,
  Knip, 23 strict tasks/root test types, **219 tests/51 files** (10.28s), all
  negative declarations, **57 OpenAPI paths** including four explicit new route
  assertions, and **12-task production build** (13.078s) passed. Source aggregate
  before/after: `e9f6d96f422564661908aa8e2c1ca95cea5c2ade0b7380bf7d8b099a38e63623`
  across 25 implementation/test/script files; manifest is ignored
  `.scratch/bindings-source.json`.
- First three-size browser run failed 3/3 at its intended conflict expectation:
  the owner admission limit produced an unsaved failure first. Earlier exact-key
  committed-response loss/retry, IME pause, reload, second-session resume and
  dirty-cancel assertions succeeded. The corrected test observes the actual PUT
  response and honors the existing Retry-After before asserting 412. Admission
  policy remains unchanged. Original failure output is retained in
  `.scratch/bindings-browser-1.log` and Playwright error contexts.
- Mechanical UI detector ran once against the changed screen, exit **0**, `[]`.
  Self-review corrected bound versus unbound boundary wording, UTF-8 separator
  text, resumed-draft category status, dirty-cancel double prompting and failed
  bound-preview result clearing before the final fast command above.
- Isolation/draft regression inventories had omitted already-merged #98 form
  paths/workflow/tables. Their expected inventories are corrected additively;
  the old test assumptions are retained in Git, rather than weakening catalog
  coverage or removing the new paths.
- Strengthened issue PostgreSQL suite exited **0**, **5/5**, 38.68s, under its
  own exclusive lease (16:37:55.523Z–16:38:34.617Z). Log/status:
  `.scratch/bindings-integration-3.log` and `.exit.json`. It proves current resolver
  denial, exact source mismatches, unchanged old unbound row bytes, max/history
  windows, synthetic/pending/incomplete authority, 428/412/409/422, concurrent
  identical-key replay, changed key payload/action/actor denial, both canonical
  source-change races, concurrent binding CAS, five actual-write rollback points,
  source-composite FKs/FORCE RLS/missing context, and upgrade from 0026 with an
  actual synthetic customer and profile/settings revision preserved.
- Corrected production-built phone browser exited **0**, **1/1**, 2.5m overall
  (2.3m scenario), `.scratch/bindings-browser-2-phone.log` plus `.exit.json`.
  It observed **429 RATE_LIMITED**, honored Retry-After, then observed **412
  VERSION_STALE**, resolved the server conflict explicitly and continued through
  publication/history/retirement/signout. Both English/light and Tamil/dark
  warnings+unknowns, history and unavailable captures passed axe and reflow.
  The six phone captures are `.impeccable/review/bindings-phone-*.png`.
  Tablet/desktop run only the remaining two projects; the successful phone case
  is not repeated without a changed input.
- Tablet and the incumbent 1440×1000 desktop both passed, **2/2**, 4.8m,
  `.scratch/bindings-browser-3-tablet-desktop.log`, exit **0**. ST-11 explicitly
  requests 1440×900, so the issue test now overrides only that project height;
  shared Playwright configuration is unchanged. The first pending 900px queue was
  stopped before acquiring any lease to rebuild the corrected unbound wording.
- Supplemental exact-source resolver regression and incumbent PostgreSQL selected
  run exited **0**: **14 passed / 20 deliberately excluded**, nine suites,
  **111.28s**, `.scratch/bindings-regressions-final.log` and `.exit.json`.
  It includes actual foreign/unpublished/disabled/non-category identities and
  missing-context denial; incumbent unbound publication/history/rollback;
  catalogue search/composition/replay; registered tenant paths, drift detection
  and bootstrap upgrade; production draft composition; customer/adult/minor
  journeys; and populated measurement/settings/catalogue upgrade. No policy,
  limiter or timeout was weakened.
- UI self-review added a source-loading guard: draft saving stays available,
  but review/publication waits for both exact immutable source payloads. Source
  load failure keeps the draft and offers retry. The final fast run after this
  application change exited **0**, **219/51** (13.20s), all required component
  gates and production build **12.428s**,
  `.scratch/bindings-fast-5-final.log(.exit.json)`.
- The new 900px outage test initially put navigation after its first assertion,
  producing a missing-field failure. Corrected test ordering without changing
  application behavior or assertions; original output is retained in
  `.scratch/bindings-browser-5-desktop900.log`. Its follow-up is recorded below.
- Incumbent unbound phone browser exited **0**, **1/1**, **33.8s** (23.6s scenario),
  `.scratch/bindings-unbound-phone-regression.log(.exit.json)`: synthetic risk,
  unknowns, reasons, durable drafts, IME, exact-key response loss/retry, history,
  language/theme, access and sign-out remain valid with the new panel present.
- Corrected **1440×900** desktop exited **0**, **1/1**, **2.5m** overall (2.3m
  scenario), `.scratch/bindings-browser-6-desktop900.log(.exit.json)`. The log
  explicitly records its viewport. It covers the source-outage disabled-review
  state and successful retry, then the complete bilingual loss/reload/conflict/
  publication/history/retirement/signout matrix. All six desktop captures were
  refreshed after the wording/source-loading correction. Earlier phone/tablet
  recovery results retain their unchanged normal-state inputs; the final review
  host check additionally exercises the new source-outage guard and wording in
  both languages at all three reviewed sizes.
- After the browser-only test ordering correction, fresh `pnpm lint` and
  `pnpm knip` exited **0**. Application types/unit/negative/OpenAPI/build inputs
  remain those of final fast run #5; only the focused browser fixture required
  rerunning. The subsequent saved-draft-list correction is covered by final fast
  run #6 and its focused acceptance check below.
- Frozen clean install/export gate exited **0**, lease
  **17:13:13.481Z–17:14:14.573Z** (61.092s),
  `.scratch/bindings-clean-exports-final.log(.exit.json)`: 437 frozen packages,
  fresh ten-package build **15.049s**, all new named contract/core/repository/
  resolver/client exports imported, and lockfile byte equality asserted. This
  native portability check is required by the new public functions; no package
  manifest/export-map/dependency/toolchain change was introduced. Additional local
  Linux/PDF/full promotion runs are not applicable to unchanged packaging/PDFs;
  hosted Linux feature and full promotion gates remain pending authorization.
- Final running-host check exited **0**, **six bilingual size/theme states** plus
  **three source-outage/retry cases**, 12.705s lease,
  `.scratch/bindings-review-copy-final.log(.exit.json)`. It uses the actual
  production-built review host at 360×800, 820×1180 and 1440×900. Each state
  checks current unbound wording, bound v2 rush plus unknown demand/load,
  unavailable activation/no effects, axe and reflow. It writes no business
  command. The six additional `bindings-review-copy-*.png` captures and the
  refreshed desktop captures were inspected alongside the original matrix;
  fluent Tamil/device/AT acceptance is not inferred from these captures.
- An optional Python contact-sheet attempt found Pillow unavailable. No tool
  was installed; original PNGs were inspected directly. Windows blocked direct
  invocation of the ignored review launcher under its script policy; the
  process-scoped `powershell.exe -NoProfile -ExecutionPolicy Bypass -File
  .scratch/start-bindings-review.ps1` invocation succeeded without changing
  machine policy. A queue-adjustment safety guard also stopped before mutation
  when the pending fast job had just acquired its lease; active work and the
  other child's lease were preserved.
- Final `pnpm lint` and `pnpm knip` exited **0** at observed
  **22:47:54 IST**, including 491 Biome files, 292 source boundary checks,
  canonical token/Base UI and eight static PWA asset checks. Final source SHA-256
  across **26 implementation/test/script files** is
  `456c36302bbb23eb04f097589cbde7ecbe309d2b7b6b787e199450720006f083` at that stage;
  the final post-list-correction fingerprint is recorded below.
- Final owner-flow review found that same-session saved-draft lists only reflected
  their initial read. The panel now merges **acknowledged server records** by ID
  and version, removes promoted/abandoned drafts, includes the explicitly resumed
  record and deduplicates pagination. Unsaved/uncertain local values never enter
  the saved list. No backend, migration, contract, public export or shared draft
  controller changed. The earlier child review host was cleanly stopped and
  rebuilt; the parent's review host was untouched.
- Final application `pnpm verify:fast` **#6 exited 0**, lease
  **17:23:37.824Z–17:25:07.199Z** (89.375s), **219 tests/51 files** (11.35s),
  all lint/Knip/strict/negative/OpenAPI checks and production build **12.503s**.
  `.scratch/bindings-fast-6-final.log(.exit.json)` is the final whole-repository
  gate. The package builds were unchanged cache hits; existing PostgreSQL and
  clean export evidence is reused only for those unchanged inputs.
- Updated full **1440×900** browser acceptance exited **0**, **1/1**, **2.5m**,
  `.scratch/bindings-browser-7-final-resume.log(.exit.json)`: source outage/retry,
  bilingual warnings/unknowns, lost response/exact-key retry, reload/second
  session, conflict, publication, **new save → close → list → resume without
  reload**, promoted-draft removal, immutable history, retirement and sign-out.
  The final source fingerprint across **26 implementation/test/script files** is
  **`5dc8f4d28d0b1fbd2e4c39efce668e05fc2aad8bde61bc6eb63893f73feaa16c`**;
  manifest `.scratch/bindings-final-source.json`. Documentation-only closeout
  follows; no application source changed after the final fast gate.
- The final rebuilt host's own confirmation also exited **0**,
  `.scratch/bindings-review-final-verified.log(.exit.json)`,
  **17:30:30.314Z–17:30:42.297Z** (11.983s): all six current English/light and
  Tamil/dark size states passed exact-source outage/retry, current copy, bound
  preview, axe and reflow. It preserves the seeded active draft for owner review.

## Migration, recovery and remaining gates

0028 is additive and does not update 0024 or any old content. Back up and review
before applying outside disposable development. Application rollback retains the
binding schema/history; old clients continue unbound v1. Corrections append new
bindings, never delete or overwrite history. No production migration was run.

Owner software/business-policy review, fluent Tamil, physical Android and AT
observations, hosted feature checks, publication/merge, full promotion verification,
deployment, restore/privacy and live-pilot activation remain pending. This local
implementation authorizes none of those gates. No PR/issue write or push is made.

## Running review packet

First usable host was observed at **22:45:26 IST**. After the saved-list fix,
the final rebuilt host was observed ready **2026-10-18T22:59:38.1223328+05:30**,
HTTP 200:
[open the seeded binding draft](http://127.0.0.1:63057/settings?section=commitments&draft=5f771469-e822-7d0f-a809-2a0357f5c70b).
The host remains running for owner review, launcher PID **22320**, own disposable
PostgreSQL port **36251**; the parent's 59673 host was not touched. The first
child host/database was cleanly removed; its stdout/stderr were preserved locally.

From this assigned worktree, exact foreground startup after its production build:

```powershell
Set-Location 'C:/Users/Nishanth Murugan/.t3/worktrees/aarili/t3-c63ef8f9'
& 'C:/Users/Nishanth Murugan/AppData/Local/Author Software/nvm/installs/v24.21.0/node.exe' scripts/review-commitment-bindings.mjs
```

Private sign-in and the exact current URL are in
`C:/Users/Nishanth Murugan/.t3/worktrees/aarili/t3-c63ef8f9/.scratch/commitment-bindings-review-host/private.json`.
Credentials stay outside Git/chat. The launcher is hidden and has isolated
`stdout.log`, `stderr.log` and `launcher.pid` in that same ignored directory.
No tunnel, public service, real customer or production activation is involved.

1. ST-08: open the saved labelled synthetic binding draft. Inspect exact category,
   availability, rule, conventions and effective warning window. Edit review reason,
   save and explicitly publish a new configuration binding. Synthetic authority
   must remain pending even when the review checkbox is selected.
2. ST-09: run bound preview; observe rush/cutoff facts plus unknown demand/load.
   No order, charge, capacity reservation or activation action is available.
3. ST-07: inspect both binding versions, actor/time/reason and exact original
   source window. A category change or retirement requires a new review for
   current selection and leaves earlier history unchanged.
4. ST-11: review phone Tamil wrapping/IME, keyboard/focus and assistive technology
   in the incumbent themes. Report `ST-ID — pass/fail — observation` with actual
   device/browser/language; terminal tests do not need manual repetition.

Stop only this host, from the assigned worktree, with
`& 'C:/Users/Nishanth Murugan/AppData/Local/Author Software/nvm/installs/v24.21.0/node.exe' scripts/review-commitment-bindings.mjs stop`.
Its disposable database/private file are removed by its own teardown. Preserve
the assigned worktree and all other running review hosts.

## Parent integration notes

No #99/#100 domain dependency or unpublished change is required. Expected shared
reconciliation points are additive auth imports/workflow/context composition,
the new historical catalogue client helper (deduplicate if #99 adds the same
function), OpenAPI route assertions, tenant path/table inventories, draft registry
expectations, roadmap and delivery records. Preserve both issues' additions and
the already-merged measurement-form inventory correction. There is no lockfile,
package manifest/export-map or owner navigation change to reconcile. Migration
0028 and all commitment-specific implementation/evidence/review scripts belong
to this issue. Local commit only; no PR, push, issue update or merge was made.
