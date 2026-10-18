# Receiving accounts and external vendors — issue #86 evidence

17 October 2026. Roadmap **1.1.1c**. [Issue #86](https://github.com/nishanthturnstile/aarili/issues/86).
Sources: product §§4/6/16–17/32 (SET-07/08/09), architecture §§6–11/15,
[approved design](Shop_Settings_Design.md), [research limits](Shop_Settings_REA_Evidence.md),
[ticket packet C/common obligations](Shop_Settings_Ticket_Packet.md), and
[development workflow](Development_Workflow.md). SS-03 and SS-07–11 apply;
AC-61/62 remain later payment/reconciliation integration references.

Final local verification is complete. The corrected three-size bilingual browser
matrix passed; the required finish verdict is **ship**, with both listed fixes
resolved (its scope is those fixes). Automated evidence is synthetic, not live
receiving authority. Running owner review:
[Settings directory](http://127.0.0.1:58118/settings?section=directory).
Required [documenter conformance](Shop_Directory_Design_Conformance.md) is complete;
human and hosted gates remain pending. The delivery report links the separate
draft PR and its immutable head.

## Baseline, approval and boundaries

The owner explicitly approved isolated parallel worktrees for #86/#87 and a
separate draft PR per issue. This worktree is
`C:\Users\Nishanth Murugan\.t3\worktrees\aarili\t3-5ae9d2a6`, renamed from the generated
branch to `codex/issue-86-receiving-vendors`. Inherited `32158a8` contracts/tests and
delivery record are preserved and extended. Integrated development `2e3118f`
contains #85/PR90. Native direct blockers #84/#13 were closed; #84 PR89 reports
MERGED at 2026-10-17T13:12:55Z. No parent checkout/branch or running calendar host
is changed. Migration **0022_shop_directory.sql** belongs to this issue;
#87 reserves 0023 and `shop-policies`. No dependency/toolchain change.

The owner approved minimal identifiers and labelled SYNTHETIC fixtures: UPI ID;
bank name/holder/number/IFSC; owner/family recipient label; vendor name/phone/
capability and artisan/supplier roles (both may apply). No real account or policy
is seeded. Cash needs an enabled method; electronic methods require an active
receiving destination. This is a receiving-configuration seam, not proof that
payment recording is implemented or ready for release. Missing configuration
has no blanket customer/calendar gate.

## Implementation and integrity

`shop-directory` is an in-package module, `shop.directory` its durable-draft
workflow. Stable account/vendor identities point to append-only revisions.
Edits, deactivate and reactivate publish new revisions with actor and trusted
immediate effective time; references to old revisions remain readable. Kind
cannot change. One methods aggregate per shop is enforced in core and SQL.
The active-selection seam checks current active state and enabled receiving
method under the same tenant transaction, and returns an explicit revision.

Lists omit vendor contact/full account identifiers. Authorised detail/history
may show them. Queries use POST bodies for private filters; URLs contain only
opaque draft/identity locators and the static Settings section. Audit metadata
contains version/kind, never account identifiers, labels, phone or capability.
No provider, financial event, balance, UTR, reconciliation, payroll, staff login,
invitation, WhatsApp message/send or other external effect is introduced.
Manual communication remains descriptive only.

Every operation enters the existing verified owner `withShop` transaction.
Receiving account and method publication calls `recentIdentity` against the live
session row **inside that transaction**, including a matching original-key replay.
The shared draft workflow has an optional `authorizePublication` hook; workflows
without it retain their earlier behavior. Binding mismatch is checked before
replay authorization; authorization precedes current-version validation/writes.
Draft saves themselves do not claim receiving authority.

Stale authentication pauses the existing detached pending command, preserving
its key and If-Match in memory, including an already-committed lost response.
The inline password form calls the existing reauthentication endpoint; it clears
its password field before awaiting and never includes credentials in draft
payloads. Same-owner session rotation may resume that command; other tabs receive
the existing identity-free invalidation notification. Actual owner invalidation,
sign-out/shop change clears controller/cache state and rejects late results.
No private browser persistence is added. The server checks freshness again on retry.

Draft and directory concurrency versions are distinct. A stale directory or draft
shows current published/server-draft/local values and requires an explicit choice
or a new draft with the current base. No automatic merge. Existing draft scope
supplies IME-safe autosave, dirty guards and response-loss retry.

## Migration and recovery review

0022 is additive: `shop_directory` current pointers and `shop_directory_revision`
with shop-led keys/uniqueness, composite tenant predecessor/pointer/audit/actor/
draft references, ENABLE/FORCE RLS, restricted grants and protected history.
Pointer advancement checks same-transaction revision provenance; deferred origin
checks require completed promotion. No default accounts/methods/vendors are
backfilled. Existing populated shops retain their customers/calendars.

Use the existing migration runner/advisory lock as app_owner; never production
schema push. Back up before an approved non-disposable application. Application
rollback must retain the additive schema and compatible draft reader. Correct
mistakes with another revision. Ordinary runtime has no history deletion/redaction
or privacy credential. Production personal-data retention/redaction approval and
its audited maintenance path remain activation gates; this delivery is synthetic-only.

## Direction contract and bounded finish

THESIS: Extend the existing owner Settings task flow for receiving/vendor work.
OWN-WORLD: Preserve the shared semantic CSS authority, Base UI controls,
Noto Sans/Noto Sans Tamil and light/dark tokens from profile/calendar.
STORY: Owner scans masked destinations, opens authorised details, edits a server
recoverable draft, compares, publishes and reads history.
FIRST VIEWPORT: Settings navigation, task title, specific setup reason, creation
controls, then a readable list; phone rows stack rather than becoming a wide table.
FORM: Existing Operate extension; no new visual world, comp, PRODUCT.md or DESIGN.md.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, existing design-authority comparison, and every shipping
raster carrying its provenance. No raster asset is added.

## Verification ledger

All logs/captures/private access remain ignored under `.scratch` or test-results.
Commands run in this worktree with Node 24.21.0 / pnpm 12.11.2; Testcontainers
uses disposable PostgreSQL 18 on random mapped ports. Browser tests use separate
production web processes and random ports, never the parent's calendar port.

- Initial strict `pnpm typecheck`: 23 tasks passed, 35.293s after correcting a
  TypeScript control-flow narrowing declaration; first failed output retained.
- Initial `pnpm knip`: exit 0.
- Focused `vitest run --config vitest.integration.config.ts tests/shop-directory.integration.test.mjs`:
  initial 2 tests passed, 43.78s (before adding additional auth/pagination cases).
- Focused draft recovery/directory contracts: 21 tests passed, 477ms after adding
  the stale-auth/original-key recovery regression.
- Initial `pnpm build`: 12 tasks passed, 48.127s.
- First browser matrix: 3 failures, all at the missing explicit reauth submit type.
  Fixed `type=submit`. Phone retest then progressed through original-key lost-response
  reauthentication but found a later publication rejection; diagnosis is retained.
- Lint initially found formatting and typed-client allowlist/CSS-authority omissions.
  Corrected using Biome, the existing client allowlist and shared CSS authority.
  Latest focused lint exits 0. No parallel formatter or dependency change.

This initial evidence preceded the coordinated final window. Observed final
checks, requirement matrix, finish verdict and running review packet follow below;
pending human/hosted gates are never inferred from local automation.

## Delivery measurements

Inherited implementation start/active duration is unknown. This child thread
started at 2026-10-17T15:12:09.037Z (app metadata); it is an elapsed thread timestamp,
not reconstructed active coding time. First explicitly sampled clock:
2026-10-17T15:20:37Z. First coordination update followed passing focused DB/types/
unit/Knip/build; parent acknowledged and reserved heavyweight final coordination.
Review-ready, first usable review-host time, publication, CI queue/execution and
review waiting remain pending. Component command timings above are not summed as
active implementation time. Central Delivery_Measurements.md has no additional
child edits; its inherited 32158a8 entry is preserved. Parent will reconcile this
issue-specific record.

## Shared overlaps for parent reconciliation

Auth/index and API/index; API/client same-owner reauth command resume; core/drafts
optional publication auth on new/replayed promotions; browser draft-recovery stale
auth handling; owner-workspace and owner-flow Settings navigation/messages; i18n
index; core/db/api export maps; shared UI stylesheet; boundary client allowlist;
tenant inventories/isolation catalog; owner-web test fixture synthetic expiry.
Keep #87 policy/readiness work independent and preserve both additive migrations.

## Remaining human gates

Owner software acceptance, physical Android/actual shop lighting, screen-reader
and fluent Tamil findings are pending. Emulation/axe cannot satisfy those.
Production receiving identifiers, privacy/retention, restore/pilot activation,
CI, owner merge, promotion and deployment remain separate gates. No merge/deploy
is authorised or performed.


### Coordinated pause and diagnosed retries

At 2026-10-17T15:31Z the parent gave #87 the next heavy window. The current
build had passed (12 tasks, 27.161s); the queued phone launcher was stopped before
a browser worker started. No new build/browser/fast/clean check runs until the
parent's explicit #86 grant. Source/document preparation continues.

The later browser failure was HTTP **429 RATE_LIMITED**, from the unchanged
approved five-command/minute admission bucket. The original-key response-loss/
stale-auth/reauthentication replay had progressed successfully before that later
methods publication. UI now explains the wait; browser helpers honor Retry-After
and retry without altering production rate policy. Browser proof remains pending
until the corrected scenario completes.

Static review also avoided a generic replay regression: optional authorization
looks up an adapter without requiring a now-disabled workflow to be registered.
Existing successful workflow results remain replayable; directory's installed
adapter still checks live recent authentication on its replay. Added a real-DB
regression for the disabled earlier-workflow case and updated exact inventory/
registry assertions. These final source corrections await affected verification.


Static schema review added explicit revision `schemaVersion: 1` plus its checked
SQL column and matching Drizzle declaration, as required by the approved version
model. This extends the inherited contracts rather than changing receiving scope.
Final source verification must include these additions. Base PR90's Fast
verification and Dependency audit are confirmed successful in
[run 39042034538](https://github.com/nishanthturnstile/aarili/actions/runs/39042034538);
this is baseline evidence only, not evidence for the new source.


Source preparation also registers the four directory read/query routes in the
existing offline OpenAPI generator and adds a route-presence assertion; no public
runtime documentation endpoint is introduced. The server-route export joins the
scoped clean-install import check. Add `scripts/generate-openapi.mjs` to the parent
reconciliation overlap list. A populated upgrade regression is prepared from
0021 with existing synthetic customer, adult/minor wearers and calendar, followed
by two migration-runner invocations and exact existing-row/read comparisons.


Parent read-only inspection of shared publication authorization, stale-auth key
retention, same-owner reauth resume and auth composition found no concrete blocker;
this was explicitly scoped inspection, not final acceptance. Prepared focused tests
also assert that a wrong password clears the password field while the original
paused command remains locked for retry, vendor create/deactivate succeeds with a
stale session, and owner invalidation clears memory. Their latest-source runs are
pending the parent grant. Synthetic test authorities never become live approvals.


One subsequent source correction binds command-resuming reauthentication to the
existing authenticated-request generation/abort guard. A sign-out/shop/owner
invalidation while the password request is pending must reject its late result,
not resume a command from an old scope. Prepared owner-recovery unit regressions
cover that race and successful/wrong-password same-owner resume. The parent review
preceded this correction; affected checks remain pending the coordinated window.

## Acceptance map and concrete owner review packet

This table maps acceptance to the automated coverage. Actual outcomes and retries
are recorded in the ledger below; human observations remain separate.

| Acceptance | Prepared automated evidence | Human observation |
| --- | --- | --- |
| #86.1 / SS-03/07/09 | Directory API publication/history/active-selection and pagination; browser list/detail/edit/availability/stale comparison | Owner label/identifier and vendor role clarity |
| #86.2 / SS-03/11 | Live stale receiving create/edit/deactivate/reactivate; stale original-key replay after reauth; fresh foreign-shop denial; vendor stale-auth boundary; wrong-password and late-invalidation unit/browser cases | Reauthentication explanation and password entry usability |
| #86.3 / SS-03/09 | Missing methods/account reason and non-authoritative paymentRecording seam; populated upgrade/exact preserved customer/adult/minor/calendar reads | Missing setup reason is actionable without blocking preliminary work |
| #86.4 / SS-09 | Strict allowlisted content; audit excludes identifiers; no provider/job/money/message path | No payment/message/invitation was sent |
| #86.5 / SS-07–11 | Real PostgreSQL RLS/provenance/history/rollback/concurrency/replay; generic draft replay compatibility; three-size bilingual Playwright/axe/IME/dirty-guard/sign-out | Physical Android, screen reader, fluent Tamil and actual shop-lighting review |

Running host: **http://127.0.0.1:58118/settings?section=directory**, first observed
usable at 2026-10-17T16:38:54Z (22:08:54 IST), with HTTP 200 confirmed immediately
afterward. Startup: `node scripts/review-shop-directory.mjs`. It uses its
own disposable PostgreSQL/port/captures and leaves the calendar review host alone.
The host seeds only SYNTHETIC owner/family UPI and bank destinations, one combined
artisan/supplier and a preserved synthetic customer, through authorised commands.
Unknown contact fields remain empty. Runtime data and generated access credentials
stay outside Git; use `.scratch/shop-directory-review-host/private.json` locally
for the private sign-in method, never paste it into chat or a report.

Use one session at the URL above:

1. **SS-03/11:** Open Settings → Payment methods and vendors. Verify masked list
   identifiers. Open SYNTHETIC family UPI and owner bank details to see only the
   selected record's full identifiers; inspect recipient/active state.
2. **SS-07/10:** Edit a synthetic label, try closing and decline the dirty prompt.
   Let the draft save; reload and resume. Switch Tamil/English and check labels,
   keyboard focus and wrapping on phone/tablet/desktop. Review and publish.
3. **SS-03/07:** Run `node scripts/review-shop-directory.mjs expire` against this
   disposable host. Change a receiving label or availability and publish. Expect
   recent-auth prompt with the draft intact. An incorrect password must leave the
   request paused; correct private reauthentication retries the original request.
   The password field clears. No account/payment duplication should appear.
4. **SS-03/08:** Disable a receiving account, publish, inspect the retained history
   with author/time, then reactivate by another revision. Earlier content stays
   readable. Open the combined artisan/supplier; change capability/availability
   without creating another identity. Empty phone stays unknown.
5. **SS-09/10:** Inspect the specific setup reason after disabling electronic
   destinations or methods. Customer and calendar navigation remains usable.
   Confirm no outgoing message, money event, staff invitation or payroll action.

Report `SS-ID — pass/fail — observation`. For physical Android, include device,
RAM/browser if known; record fluent Tamil and screen-reader observations separately.
These are human gates, not repeated terminal-test requests.

Final automated ledger and running URL are recorded in this packet before publication.
Cleanup is `node scripts/review-shop-directory.mjs stop`; it removes only this
host's disposable data/private access. Keep the host running for owner review
until that cleanup is requested. Merge, promotion and live activation remain pending.

### Settings integration conventions

This branch does not import unmerged #87/PR91. Its receiving readiness is local to
`shop-directory`; #87 may honestly report `receivingAccountsNotIntegrated` until the
parent integrates the two modules. No policy value/readiness implementation is
duplicated here.

Navigation entry is the existing `/settings` owner workspace. The directory owns
`?section=directory`; durable recovery uses
`/settings?section=directory&draft=<opaque UUIDv7>`. No account/vendor identifier or
business value is put in the URL. Calendar retains its existing plain
`/settings?draft=<UUIDv7>` recovery convention; profile is `/settings`. Existing
profile/calendar navigation clears its prior task locator deliberately after the
dirty guard. The parent must reconcile these Settings state/navigation branches
with #87 so both destinations and their draft locators survive. Messages are
`directory` under the existing owner `NextIntlClientProvider`. Public API routes
are namespaced `/api/shops/{shopId}/settings/directory`; promotion remains the shared
`/drafts/{id}/promote` path, workflow `shop.directory`. Named server export is
`@aarili/api/shop-directory`; typed browser export is
`@aarili/api/shop-directory-client`.

## Coordinated final window: observed results and corrections

Parent granted #86 the heavy window at 21:20:39 IST after #87 released. #87
subsequently published independent draft PR91 (`ba4de47`); this branch does not
import it. The following results supersede the earlier pending statements, which
are retained as the chronological failure/retry record. Exact command start/end
and wall times are in ignored `.scratch/final86-ledger.jsonl`; command logs share
the ledger name under `.scratch`.

| Check | Observed result | Wall time |
| --- | --- | --- |
| `pnpm build:packages` (`packages86-final`) | passed | 12.348s |
| Directory/draft/owner focused units, 4 files (`auth-unit86-final`) | 37 passed | 4.138s |
| `pnpm typecheck` | 23 tasks passed | 16.500s |
| Expanded directory/drafts/calendar/tenant real DB run | 17 passed, 2 failed initially | 132.274s |
| Targeted corrected DB cases plus owner tenant inventory | 4 passed, 19 deliberately filtered | 37.644s |
| Production build before browser | 12 tasks passed | 51.068s |
| First wrong-password browser check | failed, exposed real 401 handling | 26.060s |
| Affected package build after 401 correction | passed | 10.421s |
| Owner recovery/draft recovery/query units after correction | 32 passed | 2.747s |
| Affected production build | 12 tasks passed | 38.694s |
| Corrected phone Playwright/axe | 1 passed | 143.854s |
| Tablet + desktop Playwright/axe | 2 passed | 282.971s |
| `pnpm verify:fast` | exit 0; lint/Knip/types, 190 units, negative types, OpenAPI, build | 86.988s |
| Scoped clean frozen install + fresh package build/export imports | exit 0; lockfile hashes unchanged, isolated directory with spaces removed | 72.313s runner / 56.506s inner |

The first new DB replay test used Vitest's default five-second timeout and omitted
the fixture's draft-state setup; corrected setup and explicit bounded timeout
passed. The initial combined paging case exceeded the synthetic 100-command
fixture admission budget; independent list/history fixtures passed. The resulting
evidence covers **21 distinct DB cases**: directory 5, shared drafts 6, calendar 3,
tenant isolation 6, and owner tenant inventory 1. The 17 unchanged successful
cases are reused; affected cases alone were rerun. No production rate, freshness,
authorisation or isolation policy was weakened.

The actual API returned **401 INVALID_CREDENTIALS**, whereas the initial unit mock
used 403. Generic owner response handling invalidated the paused command on this
recoverable password error. Only `reauthenticateOwner` now opts into that narrow
recoverable code. The final unit fixture uses 401, asserts no invalidation on the
failed password or successful same-owner reauth, and asserts actual **401
UNAUTHENTICATED** still invalidates. Separate generation/abort assertions reject
late invalidated reauth results, with no state application or session-change
publication. Draft recovery asserts the exact pending key/payload survives failure
and is retried unchanged. The corrected phone browser proves a committed response
loss, live stale rejection, wrong password with cleared field and retained locked
command, then correct reauth: all three promotion attempts use the same key and
only the original account revision exists. Parent's subsequent scoped read-only
inspection found no concrete blocker; it is not final approval.

The earlier PowerShell timing-wrapper launch was refused by local script execution
policy before any test started. A Node timing runner replaced the wrapper; no
machine policy changed. Context7 resolved/fetched current Vitest test-name regexp
and Playwright locator alternative documentation (closest returned versions
5.0.3 and 1.63.0 respectively); installed pins remain 5.0.4 and 1.64.0.

### Required finish handoffs

The one-time detector returned `[]` for the changed directory screen/shared CSS.
Fresh Impeccable reviewer inspected all 15 valid initial captures and returned
**fix**, recorded in [finish review](Shop_Directory_Finish_Review.md). Two material
findings: requested tasks were appended without focus/viewport arrival, and
expanded revision records lacked the incumbent disclosure/section separation.
The correction batch adds meaningful programmatic heading/password focus only
on requested task/state transitions, clears prior detail/history when opening a
new/edit/rebased/resumed draft, and reuses `shop-profile-history` disclosures and
semantic section boundaries. No new visual system or policy change. New browser
assertions cover task focus and clearance above the fixed phone navigation,
new/edit/rebase/resume, review/conflict/reauth, collapsed separate revisions and
English/Tamil editor arrivals. Old captures are preserved under ignored
`.scratch/shop-directory-before-finish`; they do not verify the corrected UI.
Affected lint/types/build/browser recapture and reviewer verdict are pending here.
DB/auth/unit/negative/OpenAPI/Knip and scoped export install evidence are reused
because those inputs are unchanged; no broad repeat solely for waiting.

`.gitignore` now excludes only `/.impeccable/review/` captures in addition to the
existing `.scratch` exclusion. Include this minimal shared file in reconciliation.

Affected correction lint passed (1.835s), types passed 23 tasks (15.275s) and build
passed 12 tasks (47.492s). The first corrected browser batch stopped on phone after
208.180s: all earlier task-arrival assertions passed, but the test expected the
Tamil editor heading to remain focused after its own manual rate-limit Save click.
That expectation contradicted the no-autosave-focus-stealing requirement. Arrival
is now asserted/captured immediately after opening the task, before admission
retry; no application or rate policy changed for this test-only correction.
Test lint passed again (1.786s). Revised three-size run is pending below.

The next phone retry (208.259s) exposed a second test-only expectation: native
disabled Save loses focus during its request, so the test cannot require it to
retain focus afterward. That assertion was removed. Tamil coverage now resumes
the existing saved draft after reload, asserts its exact opaque draft ID and
captures restored values and immediate heading arrival, rather than creating an
unnecessary additional draft just for the language capture. Application source
has not changed since the affected lint/types/build above. Latest test lint
passed (1.879s); full matrix retry follows. Both failed logs remain retained.

That next phone run reached exact-ID Tamil recovery, but an immediate URL assertion
ran before the asynchronous server draft read completed and observed `draft=null`.
The test now waits for the requested editor's focus/viewport arrival, then asserts
the exact saved draft ID and restored label/UPI values. This is another test-only
ordering correction; application source remains invariant. Latest lint passed
(1.859s). The corresponding run's actual timing remains in the command ledger.

**Final corrected browser matrix passed: 3/3, 423.231s**
(`finish86-ui-final2`, 2026-10-17T16:30:08.960Z–16:37:12.191Z). Phone/tablet/desktop
each passed English/Tamil axe, overflow/keyboard, IME/dirty guards, live wrong-
password/original-key replay, explicit stale comparison, three distinct history
disclosures and immediate task-focus/viewport assertions. Exact-ID Tamil recovery
asserts both restored label and UPI value after the asynchronous server read.
The 21 current full-page/arrival captures are ignored under `.impeccable/review/`;
each was opened and checked once in the second bounded inspection. The six arrival
captures intentionally show the task viewport, not document top. They replace the
older UI evidence for the revised focus/history behavior. No detector rerun or
discretionary polish pass occurred. Reviewer verdict is recorded separately.

Frozen changed-source inventory: 36 files, SHA-256 aggregate
`ab0a397d66e8980e88cef60ac6f5e61a5cae22048cf70435d7b67e776369fe38`
at 2026-10-17T16:32:27.873Z, excluding Markdown/capture ignore entry. The inherited
HEAD in command logs is 32158a8 plus these working-tree changes, not a claim that
32158a8 alone contains or verifies the implementation. Final delivery commit binds
the verified source and issue evidence. Unavailable pre-inheritance coding time
remains unknown. Source remains frozen during the read-only finish handoffs.

Final reviewer verdict: **ship**, both listed fixes **resolved**, after independently
reopening all 21 captures and inspecting the changed source. This is a verdict on
the two scored fixes, not whole-product or runtime-integrity acceptance. See the
[full original findings and verdict](Shop_Directory_Finish_Review.md). The first
review identified material issues; no whole-surface approval is substituted for
the narrower verdict pass.

Heavy window released to parent at 2026-10-17T16:38:54Z after the final browser
batch, reviewer verdict and review-host setup. Only the idle own review host remains;
no new build/browser/verify/clean/DB tests run during documentation/publication.
Review host has its own disposable PostgreSQL (mapped port 36026) and web port
58118; the parent's calendar host is untouched. Review credentials stay private
under the ignored host directory. Full promotion/S3/PDF/job/browser suites were not
repeated: this slice adds no such runtime path and the selected issue requires the
focused DB/browser plus actual fast gate; promotion retains its complete gates.

Fresh documenter handoff completed after the final source and reviewer verdict:
[design conformance](Shop_Directory_Design_Conformance.md). It directly checked the
incumbent/changed source and approved authorities, attributed rendered evidence to
the reviewer, preserved existing design files, and reported pre-existing spacing
variation without repairing or canonising it. No PRODUCT.md, DESIGN.md, sidecar,
raster asset or new palette was created.

Final self-review checked selected issue scope, live authorization/replay,
generation invalidation, immutable history, tenant/provenance guards, additive
rollback, private drafts/audit/URLs and export boundaries. Development still
reports `2e3118f074b9810bfc85a7ebbc07f22bc284ff7c` at the final remote check;
PR91 remains unmerged and independent. The verified 36 source hashes remain
unchanged; only issue documentation followed the final run. No dependency,
lockfile, toolchain, live data, parent checkout or parent host change.

Review-ready publication preparation is 2026-10-17T16:40:32Z after the final host,
ship verdict and documenter handoff. Exact commit/head and PR creation time are
reported from Git/GitHub publication metadata in the delivery report/PR body;
they cannot predate this evidence freeze. CI queue/execution and owner review wait
are pending at publication, not fabricated active coding time. Parent reconciles
this issue-specific record with Delivery_Measurements after integration.
