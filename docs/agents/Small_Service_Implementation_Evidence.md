# Standalone small-service intake: implementation and owner review

20 October 2026. **#124 / 1.2.3a implemented and prepared for owner review.
Automated A evidence is below; human/CI/merge gates remain. No full AC-50 claim.
B/C (#125/#126) retain merged-prerequisite and selection gates.**
[REA evidence and gaps](Small_Service_REA_Evidence.md),
[independent design/SS-01–SS-14](Small_Service_Design.md),
[concrete tickets A–C and D1–D6](Small_Service_Ticket_Packet.md).

## Current implementation authority and baseline

The owner approved A–C and D1–D6 implementation conventions, authorised ticket
publication and selected A by replying “approved and proceed” to that exact
concrete review request. The to-tickets workflow published #124–#126 with native
blockers and labels, then read their full bodies/comments/edges back. No second
approval was requested. Business rates/mappings and production/live-data values,
B/C selection, merge and deployment remain separate.

A's direct #114/#99/#101/#118/#80/#56 outcomes are merged through
#116/#105/#106/#121/#83/#68 and are ancestors of integrated development `63d5123`.
The existing checkout switched to development, pulled `origin/development`
with `--ff-only` (already current), then created `codex/standalone-service-intake`.
Research documents, original prompt/roadmap changes and prior branches are retained.
No worktree or production mutation. Implementation observed underway by
20 October **16:09:30 IST**; first-edit/active durations were not instrumented.

Backend, frontend and real-PostgreSQL test work use distinct file ownership in
this one checkout. Shared contracts and migration allocation are coordinated;
heavy verification is sequential. The ledger below distinguishes automated A
proof from remaining B/C and human acceptance. Historical preparation checks
cover unchanged pre-implementation code only and are never substituted for new
verification.

## Current A implementation and verification ledger

The vertical path now includes strict service/profile contracts; framework-free
core; tenant repositories and expand migration `0034`; membership-bound auth;
thin Hono reads/review plus existing draft commands; typed clients; English/Tamil
Orders intake/details and Settings profile authoring. Existing catalogue, forms,
templates, presentation, commitment evaluator, code allocator and durable drafts
are reused. No new dependency, rate, production mapping or competing order engine.

The new `intake_kind` discriminator preserves strict custom readers. Nullable
wearer is restricted to the service branch and exact reviewed non-fit applicability;
custom orders still require a wearer. Alteration may explicitly publish a
no-measurement form, but still requires wearer/service and relevant guardian
authority. Source references retain the authorised exact customer/wearer/order/piece
and source version/digest. A new order is contextual follow-up intake, not an
accepted-order amendment or trial/correction event.

Each physical intake subject and selected line keeps a stable ID through draft and
retry. Lines freeze their exact profile/manifest/catalogue source, requested work,
price or unknown, and initial pending/not-required state. Selected optional work is
separate from omitted work; requirement projection cannot mark active execution
complete. Coverage groups count once, comparable effort is explicit, and unknown
mapping is blocked. Accepted demand and source/history are immutable. No receipt,
custodian, stock, return, money, completion, quality, ready or handover is fabricated.

### Fresh development checks

Native Windows and Docker Desktop real PostgreSQL. Root checks explicitly select
pinned Node **24.21.0** / pnpm **12.11.2**. Delegated UI development runs initially
used the machine default **24.20.0**; they are development evidence, not pinned
runtime sign-off. Final browser/build/clean checks explicitly print/select the
pinned runtime. Commands use `pnpm.cmd` because PowerShell blocks the `.ps1` launcher.
Output on stderr may be labelled `NativeCommandError` by PowerShell; the actual
native exit code and complete test summary determine the result. Logs are private
under `.scratch/small-service/`. These checks cover the dirty implementation from
base `63d5123`; final clean verification and source hashes are recorded separately.

| Command / checkpoint | Actual result |
| --- | --- |
| `pnpm.cmd build:packages` | Exit 0; 10/10 fresh tasks, 12.058s. Subsequent narrow db/core builds cover the conflict preflight. |
| `pnpm.cmd lint` | Initial boundary check rejected the unregistered client. Added only the explicit typed-client root/export; final development pass exit 0, 577 files, 339 source boundaries, 81 UI sources and 8 static PWA assets. |
| `pnpm.cmd exec knip` | Exit 0. |
| `pnpm.cmd exec vitest run tests/boundaries.test.mjs` | 13/13, 272ms; erased route types allowed, transitive server runtime still denied. |
| `node scripts/check-negative-types.mjs` | Exit 0; includes five invalid compiled service unit/state/priority/command/money uses. |
| `node scripts/generate-openapi.mjs` | Exit 0; 85 paths, including six new service read/review paths; production docs remain unmounted. |
| Focused core/property/regression selection | 23/23 across four files, including optional task applicability, custom/group intake and measurement-form regressions. |
| `pnpm.cmd exec vitest run --config vitest.integration.config.ts tests/small-services.integration.test.mjs` | 9/9, 74.84s, observed by 16:28:53 IST. |
| Same suite, first/concurrent cases after identity conflict fix | 2/2, seven deliberately skipped, 26.93s. Copied subject/line IDs return 409, retain the draft and add no demand; capacity race uses distinct real customers. |
| Pinned web production build / focused frontend types | Exit 0, including the final reviewer-fix build. Final clean gate is recorded separately below. |
| Pinned new service browser workflow | Final **1/1, 3.5m**, native exit 0; 40 refreshed captures, multiline Tamil IME/save/reload, exact bilingual profile labels, two independent prices, optional not-required line, lost-response exact retry, profile history and session recovery. |
| Pinned existing Quick Order/grouped browser workflows | **2/2, 2.8m**, native exit 0. The final reviewer fixes touch only the new service editors/spec, so these unchanged regression results are retained. |
| Final historical-upgrade follow-up | **4/4, 39.67s**; 40 unchanged order cases deliberately skipped. Exact current FK/guard are restored/read back; actual migrations and immutable-history assertions remain. |
| Final canonical service + durable-draft follow-up | **15/15, 85.94s**, two files, native exit 0; all nine service cases use canonical LF SQL and all six legacy draft cases retain real auth/usage/rollback assertions. |
| Final `pnpm.cmd verify:fast` | Exit 0, **135.391s** command elapsed; Biome 578 files, 339 source boundaries, 81 UI sources/eight PWA assets, Knip/types, **58 files / 257 tests, 21.31s**, negative checks, 85-path OpenAPI and **12/12 production build, 23.699s**. |
| `pnpm.cmd smoke` | Exit 0, **13.079s** command elapsed; production Next/Hono/real PostgreSQL readiness/outage, typed client and worker shutdown. Disposable fixture cleaned. |
| Repeat `pnpm.cmd --filter @aarili/web build` | Exit 0, **12.839s** command elapsed; second build closes the clean workflow's repeated-build compatibility stage. |
| `node scripts/check-artifacts.mjs` | Exit 0; 29 browser artifacts checked with the synthetic private canary present during both builds. No private configuration leakage. |

Failure history is retained. Initial database run **9 failed**: `0034` PL/pgSQL
CASE syntax plus a current-reader/pre-0034 fixture mismatch. The test-only historical
adapter removes only the new custom discriminator from known pre-upgrade app-user
SELECTs, restores it before migration and changes no writes/guards. The next run
**8 failed / 1 passed**, exposing the genuine alteration no-body-form policy seam;
the populated custom/group upgrade passed. Narrow acceptance then exposed SQL
`42702`, a local quantity/column ambiguity, fixed by renaming the local variable.
The following genuine kurti+saree case passed **1/1, 10.54s**, before the full
nine-case pass. No failing assertion was relaxed or competitor service reclassified.

The first browser attempt stopped on a test fixture using an incorrect GET for the
incumbent custom reader; the fixture now uses its actual POST `orders/:id/read`.
The second tried to materialise already-created pieces and received the correct
409; it now reads them. A later second-candidate fixture correctly encountered a
capacity warning and needed an explicit exception reason. These setup corrections
changed no application rules. A subsequent run found a real recovered-profile
review bug: raw JSON property order differed from schema-parsed order. Review and
publication comparisons now parse both sides canonically. Back destinations and
readable exact-source labels were corrected together. Session recovery tests use
actual sign-out/401 rather than inventing a recent-auth publication requirement.

The functional browser passed **1/1, 2.8m**, followed by a capture/copy correction
pass **1/1, 2.7m**, on Node 24.20.0. Each is one Playwright workflow, not 32 tests;
it exercises 16 intake and 16 profile language/theme/size combinations. Earlier
profile captures with autofocus scroll were not accepted as final evidence. The
final pinned-runtime run adds accepted-detail accessibility/captures. No screenshot
or interface claim is drawn from a setup-failure run.

Pinned browser development also caught overflow in expanded accepted-source details,
an absent action for adding an omitted optional profile line and misleading pricing
on not-required details. Scoped wrapping, append-with-new-ID and state-only display
fixes retain existing line IDs, instructions and prices. A lost-response test
correctly hit the incumbent 429 limiter on exact retry; it now honours Retry-After
and proves the original key is reused. The limiter was not disabled.

The finish reviewer inspected all 40 valid original captures and returned **fix**:
single-line work controls clipped long instructions and profile mapping groups led
with UUIDs/raw keys. One batch uses native wrapping textareas and exact-source
bilingual service/add-on labels; stable keys remain secondary. The new assertions,
pinned build and final **1/1, 3.5m** workflow passed. The same reviewer returned
**ship**, scoring both fixes **resolved** against the refreshed originals/source
hashes; this is a verdict on those two fixes, not whole-surface human acceptance.
The detector ran once, returned `[]`, and was not repeated. There are no new
shipping raster assets or visual-system changes. Private reports are
`.scratch/small-service/finish-review-round1.md` and `finish-review-verdict.md`.

A fresh documenter checked the final components/integration, bilingual catalogue,
shared controls/tokens, brief/mirror and sample originals against the incumbent
system. It preserved the design authority, created no competing DESIGN.md/sidecar
and reported no system change. Its private report is
`.scratch/small-service/documenter-report.md`. The incumbent design document's
earlier entry-focused surface inventory remains historical drift, not authority
to redesign or rewrite the system during this extension.

Required screenshots comprise 16 intake and 16 profile-editor captures across
English/Tamil, light/dark and 360×800 / 820×1180 / 1440×900 / 1180×820, plus eight
accepted-detail captures at 360/1440. The workflow checks keyboard/focus, axe,
200% text/reflow, IME and recovery; it is one workflow, not 40 separate tests.
Private manifest `.impeccable/review/capture-manifest.json`, generated
`2026-10-20T11:43:53.824Z`, records each image and eight source hashes; manifest
SHA-256 `9bf4f52781d2b3d0822e7d3322d510a1a193ca1d093a1f2f04926105ec3f15c1`.

### Final clean verification

Package exports changed, so `pnpm.cmd verify:clean` is required for a frozen native
install in a disposable path containing spaces, full `pnpm verify`, a repeat web
build and private-canary/artifact scan. It is running sequentially after browser
fixtures were cleaned, on Node 24.21.0 / pnpm 12.11.2 with four Vitest workers.
No dependencies, lockfile, toolchain pins or historical migration files changed.

First clean attempt ran `17:14:12.7750336–17:19:32.6182486 IST`, **exit 1,
319.828s**. Frozen install, lint, Knip and strict types passed. Units reached
**254 passed / 1 failed**: the existing retired-route test's combined three-
environment matrix exceeded its unchanged 5s timeout (6.663s). Refactored only
that test into one case per environment, preserving the full method/path/query/
auth/OpenAPI matrix and original timeout; no assertion or scope was removed.
Affected `tests/runtime-cleanup.test.mjs` then passed **5/5, 14.24s**, and Biome
passed. The new frozen clean attempt covers this test-only correction. Earlier
browser/SQL source is unchanged; no duplicate browser run is warranted.
The second immutable clean copy ran **17:20:35.6141805–17:49:03.8157583 IST,
1708.192s, exit 1**. Frozen install, lint/Knip/types, **257 units (35.52s)**,
negative types, 85-path OpenAPI and Linux namespace/seccomp sandbox checks passed
(50 synthetic strings, four fonts, five A4/A3 PDF page goldens). Full integration
reported **199 passed / 8 failed, 38 files, 1233.47s**. This includes the nine new
service cases and the repository-wide isolation inventories; no full-pass claim.

Four failures were in the legacy draft fixture:
its exact registry inventory omitted the new `order.service` and
`service.intake-profile` workflows. Added precisely those two registrations to
the expected sorted list; its authority/usage/rollback assertions remain intact.
The first follow-up still failed those four draft cases (**11 passed / 4 failed,
102.80s**) because that same older inventory also omitted the already-merged
`booking.group` and `order.group` registrations. The expected list now names all
four additions explicitly; no runtime registry or authorisation was changed.
Four more were historical upgrade fixture setup. Two genuine pre-0034 schemas
used the current custom reader before its discriminator column existed; the
existing narrow historical SELECT adapter is now shared and asserts column
absence, then restores the real reader before migration/post-upgrade checks.
Two synthetic structural downgrades tried to drop `order_piece` while the new
source FK referenced it. They now assert the service-subject table is empty,
capture/drop only that FK, run the original real structural migration, and
restore/read back the exact FK and current piece-commit guard. No cascade,
accepted commercial/history rewrite or runtime fallback is introduced.

Final affected checks run the four upgrade cases and all six draft/nine service
cases, with unchanged successful broad cases retained. A failed top-level
command remains recorded as failed rather than relabelled by a focused pass.
The remaining full-command production-build/smoke/artifact/canary stages are
run explicitly after the current final fast gate, including a second web build.
The four upgrade cases then passed **4/4, 39.67s** (40 unchanged cases skipped);
after completing the registry list, the canonical service/draft selection passed
**15/15, 85.94s**. These include the eight formerly failing cases and eleven
overlapping successful cases; they are not 19 additional unique cases on top of
the original 207. Unchanged broad successes are retained under the workflow's
evidence-reuse rule. No failed aggregate command is described as passing.

Final `verify:fast`, smoke, repeated web build and artifact scan all returned 0
on the final canonical source. The sequence finished **18:00:24.260 IST**.
Private command/timing/source records are `final-verification-results.json`,
`affected-upgrades.log`, `affected-postgres.log`, `final-fast.log`,
`final-smoke.log`, `repeat-web.log` and `final-artifacts.log`, all under
`.scratch/small-service/`. Frozen installation/packaging inputs and all application
TypeScript are unchanged from the broad clean copy. Only the documented fixture
corrections and new migration line endings changed, with affected proof above.
The aggregate `verify:clean` remains exit 1; its successful unchanged components
and the current affected/tail checks provide the required coverage without
repeating 38 integration files. This is not a single green full-run claim.

Not run: the entire local `pnpm test:ui` promotion suite, physical Android,
fluent-Tamil/assistive-technology acceptance, an operational restore drill or
production/live-data activation. The focused new and incumbent browser journeys
are the feature-stage proof; promotion retains the full hosted browser gate.
Hosted feature Linux fast/audit results are recorded after PR publication.

Staging also identified CRLF in the **new** `0034` file. The migration runner
hashes source bytes, so the working file now matches `.gitattributes`' LF rule
and the already-staged Git blob exactly. No SQL token or historical migration
changed. Canonical SHA-256:
`7bb07c113e5f4a0d9664941884323782cf8fc7056ddc2cbf9861bb0cf53c9b84`.
The frozen broad run retains its original raw-byte manifest; the final affected
PostgreSQL suite must also run against the canonical file before publication.
Final results and timings follow actual output, not this running checkpoint.

The final 44 implementation/test inputs have combined SHA-256
`13c39529a9386d673b70c0f6583460038d1d6697721790521740b8d530cd608b`
from base `63d5123863e5324a35c635fa25592310593a828b`. Private per-file hashes are
`.scratch/small-service/implementation-source-hashes.json`; verify them again
after final checks and before publication. The broad immutable clean-copy inputs
are retained as `implementation-source-hashes-clean-input.json` (41 files,
`b1659121c855c19da82ce08cc6e9f0e508d3874cdb77ca2a2e05659cb0fef721`).
Only the fixture inventory/historical adapters and new SQL line endings differ.
Application TypeScript/UI is unchanged. Documentation hashes are recorded
separately so evidence-only updates do not pretend code changed.

### A acceptance mapping and remaining boundaries

| SS row | A evidence / remaining acceptance |
| --- | --- |
| SS-01 / SS-02 | Real PostgreSQL accepts genuine standalone kurti and multi-line saree services with no body facts/full form/delivered prerequisite. Final bilingual browser workflow covers both intake shapes and accepted reopen. |
| SS-03 | Independent unknown and explicit-zero line prices and incomplete total; optional not-required has no invented charge. Package supplements remain B. |
| SS-04 | Completion commands and attributable corrections remain C; A permits only pending/not-required intake states. |
| SS-05 | Real guardian/aunt/withdrawal/read/draft/replay tests and a lock-barrier race; alteration exemption forgery denied in SQL. Human privacy/notice/live gates remain. |
| SS-06 | Immutable property subject/source provenance and no-effect assertions; physical receipt/movement/return proof remains 1.5.1. |
| SS-07 | Exact accepted sources/labels/prices/hash survive profile revision/disable; source/profile conflict and populated upgrade assertions. Supplemental history remains B/C. |
| SS-08 | Governed accepted-order attachment is B, blocked on A merge and selection. |
| SS-09 | Coverage/property tests; genuine count/effort demand, unknown/mixed-unit blocking and shared-capacity concurrency in PostgreSQL. Production quantities remain unapproved. |
| SS-10 | Request actor/action/hash/ETag, durable expiry/replay, copied identity conflict and atomic origin tests; final browser reload, multiline Tamil IME, unknown-outcome exact-key retry, stale conflict and fresh-session recovery. |
| SS-11 | FORCE RLS/current membership, foreign customer/profile/order/piece, missing/pooled context, SQL provenance/immutability, source/guardian races and six real AFTER-write rollback faults. Broad repository-wide isolation inventories passed; canonical nine-case service follow-up passed within 15/15. |
| SS-12 | Final English/Tamil/light/dark matrix, phone/tablet/desktop/landscape, keyboard/axe/200% reflow/IME/recovery and 40 validated captures. Physical Android, fluent Tamil and assistive-technology review remain human acceptance. |
| SS-13 | Populated 0033 custom/grouped snapshots and commercial facts unchanged. Pinned Quick Order/grouped browser workflows pass 2/2. Broad unchanged custom/group cases passed; all four corrected historical upgrade fixtures pass 4/4 with exact current constraints restored. |
| SS-14 | No money/job/custody/execution/trial/quality/handover/message effects. AC-50 remains partial; later 1.4–1.8 integrations retained. |

### Migration and recovery review

Only new `0034_standalone_service_intake.sql` is added; historical SQL is unchanged.
Four tenant tables have non-null shop IDs, composite references, shop-led keys,
matching ENABLE/FORCE RLS and restricted grants. Revision/subject/line history is
immutable. Exact draft/audit/key/snapshot/line/requirement/demand provenance is checked
within the accepting transaction and at deferred commit. Original custom/group
branches remain in the three narrowly extended order guard functions.

The expand migration ran only on disposable synthetic PostgreSQL. Back up before
any non-disposable schema use. Compatible rollback must gate new service writes
and unsupported readers while retaining schema/history and the explicit custom
reader discriminator; an old binary cannot safely parse nullable-wearer service
records. No destructive down migration, production SQL, deployment or live activation.

### Synthetic owner-review packet

Running synthetic review: **http://127.0.0.1:49812/orders**, first observed ready
by **18:01:17 IST**. Health and sign-in returned 200; the collaborative browser
opened Orders and reached the ordinary sign-in page (307 → 200) with its fonts
and assets loaded. This is host readiness, not human acceptance or a claim that
the browser was already signed in. Startup, if it has been stopped:

```powershell
$env:PATH = "$env:LOCALAPPDATA/Author Software/nvm/installs/v24.21.0;$env:PATH"
node scripts/review-small-services.mjs start
```

Use the established private local access file
`.scratch/small-service-review-host/private.json`; it contains transient synthetic
sign-in and named direct `scenarios.kurti`, `scenarios.saree` and
`scenarios.unknownCapacity` links. No password, token or cookie belongs in Git or
chat. The host binds loopback and uses a disposable database/production web process.
It pre-saves three drafts and an unverified aunt/minor case, with no accepted
service, payment or custody event during setup. Second-tenant, exact linked-source
and existing custom/grouped regression fixtures are covered by the automated
evidence above; this host focuses the six human journeys below.

1. **SS-01/02/06/12:** Open the saree scenario after sign-in. Recognise the
   customer-owned garment and receipt-not-recorded wording. Switch English/Tamil
   and theme; edit a recognisable description, save and reload. This reviewed
   non-fit fixture omits irrelevant wearer/body forms; linked-source authority
   is tested above.
2. **SS-02/03/10:** Keep fall at quoted zero and pico to be quoted. Add pre-pleating
   from the pinned profile; check the first two instructions/prices stay unchanged.
   Mark only pre-pleating not-required with a reason. Save/reopen the draft.
3. **SS-03/07/09/14:** Review the real current commitment and synthetic shared
   demand once, acknowledge it and accept. Reopen: fall/pico are pending with
   separate price facts; pre-pleating is not-required with its reason, not an
   unknown charge. Receipt, payment, ready/completion and handover are absent.
   Expanded exact-source details remain readable on a phone-width screen.
4. **SS-01/05:** Open the kurti scenario. It retains an authorised wearer while
   avoiding full measurements/patterns. The synthetic minor/aunt has no verified
   guardian authority; selecting it must not permit acceptance. Restore the
   authorised adult for the ordinary alteration journey.
5. **SS-09/10:** Open unknown-capacity intake. Save/reload remains available;
   commitment acceptance stays blocked. No numerical production mapping is inferred.
6. **SS-07/12:** In Settings → Service intake profiles, inspect exact source
   labels, applicability and mapping, revise with a reason and read history. Old
   accepted details keep their original sources/prices. Normal sign-out and fresh
   sign-in resume only server-saved content; unacknowledged typing is not recovery.

Report `SS-ID — pass/fail — observation`. Physical Android/device/RAM/browser,
fluent Tamil and assistive-technology observations remain separate human acceptance;
emulation and axe cannot sign them off. Review the business meaning and usability,
not already-evidenced terminal tests. Production policy/privacy/restore/live-data,
B/C selection and merge authorization remain separate.

Teardown: `node scripts/review-small-services.mjs stop`; the running helper removes
its transient credential file, production web process and disposable PostgreSQL.
It does not delete repository work or run a down migration.

Final component checks, browser/finish review and running host readiness are
recorded above. Final source-hash/document QA passed by **18:03:45 IST**:
44 unchanged code/test inputs; eight documents/130 relative links, 14 SS rows,
three tickets/six decisions and 14 real Evidence IDs matched the retained bundles
(10 current records). The original prompt hash remains
`e047b034f2a03537c20b87c4f50be3a38688ebe3`; `git diff --check` passed.
The owner-review packet is ready. Draft PR/hosted CI are recorded after creation;
owner acceptance, merge and deployment remain separate.

## Historical preparation record

The following preparation/approval-gap observations predate the owner's approval
and #124 implementation. They remain dated evidence, not current selection gates.

### Historical checkout, merges, approvals and CI

Started on `codex/multi-garment-acceptance` at local planning commit `a52222a`.
Existing changes were the eight-line 1.2.3 roadmap prompt note and untracked
`Small_Service_REA_Prompt.md`. Initial `git switch development` refused to overwrite
the roadmap because local development was older. The following pull command also
could not fast-forward the feature branch; it changed no files/commits. No stash,
reset, discard, unrelated commit or worktree was used.

Read-only comparison established the roadmap was identical between feature HEAD
and fetched origin/development before its working edit. `git fetch origin
development:development` safely fast-forwarded the inactive local development ref
from `7b1ca94` to `63d5123`. Then `git switch development` and `git pull --ff-only
origin development` succeeded, preserving both existing edits. Research documents
use focused `codex/small-service-design`, based on integrated **63d5123863e5324a35c635fa25592310593a828b**.
The prior local branch/planning commit remains available. No push/PR/merge/deploy.

Live `gh` checks used `--repo nishanthturnstile/aarili`:

- Issues #113/#114/#118/#119/#120 are CLOSED, merged via #115/#116/#121/#122/#123.
  #123 merged at **09:47:12 UTC / 15:17:12 IST** on 20 October. Open issue list
  contains only Dependency Dashboard #28; no approved 1.2.3 issue exists.
- #120 native direct blockers #119/#114/#101 are closed/merged. #114 native
  blockers #113/#84/#85/#87/#101 are closed. Proposed ticket prerequisites also
  reuse integrated catalogue/templates, guardian, draft and exact-piece outcomes.
  Merge ancestry is checked in preparation QA; this is no future-ticket approval.
- [#123 run 39394216921](https://github.com/nishanthturnstile/aarili/actions/runs/39394216921):
  Fast verification and Dependency audit SUCCESS; Scaffold verification and
  Browser smoke/accessibility SKIPPED as expected on feature PRs. Not full-suite
  verification of the new merge commit.
- [Promotion #110 run 39231567178](https://github.com/nishanthturnstile/aarili/actions/runs/39231567178):
  Scaffold, phone/tablet/desktop browser projects, aggregate browser and audit
  SUCCESS. Local origin/main remains promotion merge `29c4975`. This historical
  result does not cover newer development or new service functionality.
- Daily [run 39387659326](https://github.com/nishanthturnstile/aarili/actions/runs/39387659326)
  passed Dependency audit with other jobs skipped; do not mistake its overall
  success for full verification.

No PR is being created or changed, so these baseline-only PR references are not
registered as active thread work. Ticket/PR publication remains unapproved.

### Historical source inspection and independent design review

Inspected actual catalogue/service kinds, reviewed not-required measurement
definitions, exact template add-on keys, current quick/group accepted contracts,
draft registry/recovery, order/piece projection, acceptance evaluator and SQL
guards in migrations 0030–0033. Findings incorporated in the design:

- A hidden wearer field cannot bypass mandatory command and SQL constraints.
- Accepted readers embed strict Quick Order DTOs; service payloads need explicit
  compatible discrimination and distinct draft workflows. The registry supports
  one schema version per workflow name; silently changing v1 strands drafts.
- Original requirements/demand/snapshots and piece sets are immutable and closed
  after acceptance. Additional work requires supplemental records/current projection.
- One positive original demand row cannot represent zero or repeated add-on
  increments. Shared load reads must include new contributions exactly once.
- Existing order version updates require presentation-event provenance; service
  change CAS requires a narrow guard extension/shared concurrency protocol.
- Package included reference amounts cannot become additive charges implicitly.

The invoked REA skill's independent-question instruction was used for one read-only
source-seam reviewer. It made no edits or browser/Git mutations. Its findings
confirmed the hazards above and the standalone → accepted additions → bounded
completion split. This is source/design review, not implementation acceptance.
Its bounded review of the finished four-document packet returned no material
findings; final verification/QA claims were still pending at that review and are
updated only from actual command output below.
Frontend-design/impeccable guidance was applied to the scoped incumbent Orders
extension; no UI redesign or competing product/design baseline was introduced.

### Research outcome and limitations

Actual current REA IDs, capture methods, incomplete attempts, reused historical
evidence and private raw-bundle location are in the ledger. TailorMan's alteration
list is accessible; New Alteration click leaves the public sample unchanged.
Nool's public guide describes delivered-order reopening, but both permitted
synthetic orders are Pending. The reopen workflow remains unexecuted; no order
was marked delivered to unlock it. Nool phone English/Tamil content was observed;
the phone capture reports missing events and the tablet restore-toggle attempt
timed out, followed by a passive English-detail inspection. None is a complete
vendor accessibility/backend guarantee.

No new competitor business record, money, invoice, message, upload, production,
custody or handover event was created. Dedicated research access is retained;
no password/OTP/cookie was requested or committed. No APK or new account.

### Preparation-only local verification

Application source, dependencies, schema, tooling and runtime configuration are
unchanged. The documentation-only delivery runs `verify:fast` and dedicated
document/traceability QA; new real-PostgreSQL/browser acceptance remains assigned
to the future tickets rather than claimed from an unchanged baseline.

Environment: native Windows, existing pinned **Node 24.21.0**, **pnpm 12.11.2**.
Default shell Node was 24.20.0; explicitly prepended the already-installed pinned
runtime, without changing project pins or installing software. Read installed
Turbo 2.11.7 README/running-tasks/run docs before repository checks.

First attempted `pnpm` hit PowerShell's disabled `.ps1` execution policy; no suite
ran, despite the wrapper reporting exit 0. Used the existing `pnpm.cmd` launcher
for actual verification; no policy change. Command:
`VITEST_MAX_WORKERS=4 pnpm.cmd verify:fast` (PowerShell environment assignment,
pinned runtime first on PATH). Log `.scratch/small-service/verify-fast.log`.
**Exit 0**, completion observed by **15:49:38 IST**. This is an observation
checkpoint, not a reconstructed finish timestamp or active duration:

- Biome checked **561 files**, no fixes; architecture boundaries checked **328
  source files**, UI token/Base UI and eight canonical PWA assets passed.
- Knip and strict TypeScript checks passed; **23/23 typecheck/build prerequisite
  tasks**, typechecks freshly executed rather than cached assertions.
- Vitest **57 files / 243 tests passed**, **46.08s**. Negative DTO/client/UI
  checks and offline OpenAPI generation passed.
- Production build **12/12 tasks**, **28.482s**; 11 package/worker builds reused
  cache and the web build freshly compiled. No uncached-build claim for those 11.
- PowerShell labels native progress on stderr `NativeCommandError` in the log;
  the actual suite process returned 0 with passing component results. No
  assertion, timeout, dependency or execution policy was relaxed.

Dedicated document QA checks strict UTF-8, all new relative links, SS/D/ticket
coverage, actual current/reused REA IDs against retained private records, merge
ancestry, preserved prompt/roadmap edits and absence of runtime-file changes.
`git diff --check` also runs on the final document tree. Initial QA caught
abbreviated scenario references rather than explicit AC-55/AC-60 in the ticket
packet; the cross-cutting list now names each ID explicitly. A second QA failure
was a historical raw-file decoding mismatch: older PowerShell result files are
UTF-16, so the private checker now decodes their BOM rather than treating them
as UTF-8. No Evidence ID or acceptance assertion was changed to bypass the check.

Final QA **exit 0** on pinned Node 24.21.0: **7 documents, 127 relative links,
14 SS acceptance rows, 3 vertical tickets, 6 decision rows, 14 cited Evidence IDs
matched retained current/historical raw records, 10 current retained REA records,
11 merged-ancestor checks, zero runtime changes**. `git diff --check` passed.
The private checker is `.scratch/small-service/check-docs.mjs`; current document
Git blob hashes are `.scratch/small-service/document-hashes.json`. Original prompt
was not edited; its current hash is `e047b034f2a03537c20b87c4f50be3a38688ebe3`.

Not run for new service behaviour: real PostgreSQL isolation/history/guard/atomicity/
concurrency tests, Playwright/axe bilingual three-size service workflows, full
`pnpm verify`, `pnpm test:ui`, Linux PDF goldens, physical Android, fluent Tamil,
IME/AT human review, recovery drill or hosted checks on this unpublished branch.
There is no implemented service UI to validate yet. Unchanged-source baseline
checks do not establish any SS acceptance row. No tooling/portability migration
or new PDF template warrants duplicate install/Linux/PDF work in this preparation.

### Historical packet review request (superseded by approval above)

Review these concrete documents, without replaying terminal tests:

1. [Evidence](Small_Service_REA_Evidence.md): confirm observations are separated
   from inferences/unknowns, particularly the unexecuted Nool reopen flow.
2. [Design](Small_Service_Design.md): walk through kurti, standalone saree and
   accepted custom add-on journeys; review SS-01–SS-14 and future AC-50 integration.
3. [Ticket packet](Small_Service_Ticket_Packet.md): review A/B/C scope and named
   D1–D6 proposals, approve/amend publication, then select a ticket. A's direct
   technical blockers are merged; B and C must wait for their new predecessors.

Copyable decision: `A–C breakdown/publication — approve/amend; D1–D6 —
approve/amend (implementation conventions only); selected ticket — A/none;
production values — pending or separately supplied for review.`

No new software review URL, service route, synthetic service host or accepted
scenario is claimed. Once a ticket is selected and implemented, prepare the
workflow's running synthetic packet with exact URL/startup/private access,
SS-linked steps, expected observations, results and teardown before requesting
human acceptance. Existing Quick Order/grouped review hosts are not substitutes.

### Preparation-time integration and activation gates

Await concrete packet approval/publication/selection. Production service list,
wearer applicability, capacity combinations/units/quantities, rates/terms and
completion evidence need named owner review. Existing count/numbering/grouping
approvals are reused and not reopened.

All SS rows are planned/unimplemented. AC-50 still needs custody receipt/movement/
return (1.5.1 and continuation), agreements/quotes/money, production 1.7.1,
trials/correction/fit 1.8.1, quality/readiness 1.8.2 and actual handover 1.8.3.
Intake is not full JOB-08/09 or garment closure. Restore/privacy/configuration,
physical-device/language/AT, production-policy and live-data/pilot gates remain.
No merge, deployment or external publication is implicit in this review.
