# Selected service repeat — A2 / issue #135

21 October 2026. Owner selected #135 after merging A1 PR #139. Existing checkout
updated to `origin/development` `56b07f6b453cf560b73784c52fc60b4edbf3e34a`, then
branched `codex/repeat-service-intake`. No worktree, deployment or live data.
Direct blockers #134/#124/#125/#126/#118 are closed with merged PRs
#139/#127/#128/#129/#121. #139 Fast verification and Dependency audit passed in
[run 39578686370](https://github.com/nishanthturnstile/aarili/actions/runs/39578686370).
No product or architecture baseline correction was needed.

Sources: [approved design/matrix](Repeat_Order_History_Design.md),
[ticket packet](Repeat_Order_History_Ticket_Packet.md),
[competitor observations and limits](Repeat_Order_History_REA_Evidence.md),
[product plan](../Boutique_Business_Management_Final_Product_Plan.md) ORD-08/12/13/14,
CUS-02/07, SET-11, TRU-01/03/05/06/12/13; AC-50 intake, AC-60, AC-63 structure.
Architecture §§6–9, 11–12 and 15 govern modules, transactions, immutable history,
shop isolation, recovery and verification. This implements A2, not B/C1/C2 or
the whole 1.2.4 capability. No custody, payment, fulfilment or identity merge.

## Behaviour and implementation

Accepted custom and service details offer explicit work selection. Candidates
distinguish standalone lines, exact accepted supplemental lines/change digests,
and pinned original add-ons. Native piece labels accompany piece-scoped work.
No line is selected automatically. The owner chooses a current standalone
profile and maps each selected line. Stable catalogue entry identity, not labels,
proves comparable work. Task mappings and incompatible native pieces block review.
Missing profile/mapping can be saved as an actionable draft.

`order.repeat-service` v1 delegates ordinary service acceptance to existing core
policies/writers. The browser uses typed clients and existing recovery; Hono
handlers validate/authorise through the existing owner/shop transaction. There
are no new business Server Actions, runtime packages or browser persistence.
The source customer's wearer/guardian authority is rechecked on reads, draft
recovery, acceptance and replay. Dropping wearer identity cannot bypass access.

The draft records the exact immutable source and selected work. Fresh current
scope/line versions require explicit review; refresh clears commitment decisions.
New profile revisions require deliberate selection and current review. Booking,
source order and identity locks follow the established order, including ancestor
service references, before revalidation. Current capacity fingerprints serialize
competing acceptance. A draft/review adds no demand; acceptance adds demand once.
Accepted custom-order discovery acquires each page's customer/wearer locks in
sorted identity order before hydration. Display order and per-record access
checks remain unchanged. This prevents an opposite-order cycle with grouping.

### Serialized field reuse/reset matrix

This covers all `ServiceOrderDraft` fields and the A2 extension; the approved
general matrix still governs later domains.

| Fields | New draft policy |
| --- | --- |
| `customerId`, `wearerId` | Exact authorised source identity, fixed; nullable wearer remains nullable. No cross-wearer conversion. |
| `profile.entryId/revisionId` | Explicit current selection, initially nullable; current eligibility and comparable mapping checked again at acceptance. |
| `subjectId` | Fresh UUID; original subject retained only as provenance. |
| `subjectDescription` | Descriptive source candidate, editable and reconfirmed; no receipt or same-possession inference. |
| `propertyReference`, `intakeContext` | Empty; current intake must supply its own facts. |
| `sourceOrderId`, `sourcePieceId` | Exact immediate source order; native piece only when all selected work has that same piece. Fixed, with per-selection piece references retained. |
| `lines[].id` | Fresh, fixed target IDs; only explicitly selected work. |
| `lines[].key` | Explicit target profile mapping; editable until acceptance, validated by catalogue identity. |
| `lines[].requestedWork` | Selected descriptive requested work candidate, editable. Completed work requires explicit selection. |
| `lines[].priceState/priceText` | `to-be-quoted` / empty. Unknown remains distinct from an explicitly entered quoted zero. No package/included-price allocation. |
| `lines[].notRequired/notRequiredReason` | False / empty; fresh work pending, regardless of original progress. |
| `deliveryDate`, `deliveryTime`, `requestedDate`, `eventDate`, `occasion`, `orderDate`, `historicalReason` | Empty. Current valid promise, cut-off and capacity confirmation required. |
| `priority` | Normal; any new rush choice uses existing review. |
| `instructions` | Empty unless explicit reuse selected; editable candidate. |
| `presentation`, `presentationRevisionId` | Simple / null; current presentation selected independently. |
| `commitmentReview` | Null. New current fingerprint, acknowledgement and existing exception/waiver policy. |
| `repeat.sourceId/subjectId/snapshotDigest/reuseInstructions` | Fixed provenance of the selected source and instruction choice. |
| `repeat.sourceVersion/scopeDigest` | Pinned; only explicit review refresh may advance them. |
| `repeat.selections[].key/kind/sourceId/sourceDigest/lineId/addonKey/pieceId/catalogueEntryId/catalogueRevisionId/targetLineId` | Exact fixed typed source and fresh target identity; no polymorphic unchecked UUID. |
| `repeat.selections[].lineVersion` | Pinned current progress version; explicit refresh may advance it. |
| Approval, coverage, original price, progress, assignment, custody, stock, payment, bill/PDF/share | Not copied into intake. Original records remain immutable and independently readable. |

### Migration and recovery

0038 is additive. Three shop-led tables store origin, typed selected scope and
accepted target. Composite foreign keys distinguish standalone lines from
supplemental line/change references and validate native piece/order membership.
All three ENABLE/FORCE RLS, fail closed without context, and permit ordinary
runtime SELECT/INSERT only. Immutable triggers, deferred draft/lineage/audit
guards and existing acceptance constraints commit together. New order/subject/
line IDs, exact mapping and acceptance snapshot are checked at commit.

The migration makes narrow predecessor-checked extensions to existing service
acceptance guards; A1 `order.repeat` v1 and legacy strict service DTOs remain
unchanged. Populated 0037 upgrade checks include A1 drafts/origin, original
snapshots, accepted service lines/progress and audit rows. Existing A1 tests also
exercise populated 0036 upgrade through the latest schema.

Recovery is **write-disable, retain schema/data and compatible readers**. Disable
the new command/UI and revoke INSERT on the three repeat tables before a
compatible application rollback; keep SELECT and the v1 recovery reader. Do not
deploy the old application as a reader for new workflow drafts, drop history or
reverse the migration. The real PostgreSQL test revokes inserts, observes failed
creation with no partial draft, reads existing source/draft, restores grants and
retries the exact key successfully. No destructive down migration is supplied.

## Validation record

Native Windows, synthetic disposable PostgreSQL 18.6 through Testcontainers;
runtime `app_user`, existing pinned workspace tooling. `pnpm exec node` reports
24.21.0; the bare `node` used by the first browser regression run reports 24.20.0.
Final pinned-node browser coverage is recorded separately; hosted pinned Linux CI
is a separate check. No dependency/lockfile/build-tool/platform boundary change,
so no additional local Linux image was required by the workflow.

Evidence applies to this branch's dirty implementation before commit. Final
command results and tested capability commit are recorded below. Ignored raw logs
and screenshots are under `.scratch/repeat-services/`; no credentials or real
customer data enter Git. Context7 resolved `/colinhacks/zod` and fetched current
strict-object composition documentation before the adapter contracts changed.

Early failures retained: migration CASE-expression parenthesis syntax corrected;
an unmapped-draft test expected 409 instead of the existing incomplete-command
422, and a supplemental fixture needed explicit acceptance. Corrected expanded
SQL suite passed **9/9, 85.32s**. First browser attempt found missing explicit
accessible selection labels; corrected. Two subsequent test attempts used an
undefined save-label key; corrected to existing `orderMessages.en.save`.
Desktop corrected flow passed **1/1, 33.1s**, scenario **20.3s**. Expanded final
checks add required native-piece selection, populated A1 upgrade and write-disable
recovery; their results follow. No earlier failure is represented as passing.

Fresh frozen-software results:

| Command | Observed result |
| --- | --- |
| `pnpm verify:fast` | Exit 0, **132.880s**; lint/boundaries/tokens, Knip, types, **266 units / 60 files, 15.76s**, negative types, OpenAPI and production build (**20.521s** task graph). |
| `pnpm verify:fast` after final form-control styling | Exit 0, **109.670s**, **266 units / 60 files, 12.27s**, production graph **15.136s**; all other fast stages passed. |
| `pnpm verify:fast` after source-list lock correction | Exit 0, **113.895s**, **266 units / 60 files, 14.43s**, production graph **17.292s**; all fast stages passed. |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/repeat-services.integration.test.mjs tests/orders.integration.test.mjs` after lock correction | **17/17, 205.61s**: all 12 A2/race cases and five existing order tests. |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/repeat-services.integration.test.mjs tests/repeat-orders.integration.test.mjs tests/small-services.integration.test.mjs tests/tenant-isolation.integration.test.mjs tests/owner-bootstrap.integration.test.mjs` | **54/54, 612.24s**, before final canonical-ID change. |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/repeat-services.integration.test.mjs` | Final **11/11, 155.93s**, including native scope, uppercase identifiers, publisher/completion races, write-disable recovery, populated A1 upgrade and fault rollback. |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/order-acceptance.integration.test.mjs -t 'GB-C'` | **17/17 selected, 227.52s**; grouped atomic acceptance and current-source publisher regressions. |

Final browser regression and pinned-node results are recorded below.
Corrected phone regressions passed booking history (**1.5m**), A2 (**22.8s**),
accepted additions/conversion (**4.9m**), completion (**1.7m**) and standalone
intake (**2.6m**). That broad run was deliberately stopped after phone coverage;
its tablet/desktop repetitions are **not claimed passed**. Only its task-owned
processes and logged disposable containers were removed. Final A2 and grouped
intake checks run at all three sizes with `pnpm exec node`, without a concurrent
production rebuild. The earlier boot failure is retained and explicitly rerun.
The initial expanded browser run passed A1/A2 on all sizes but exposed the new
accepted-page heading skipping h2: **6 passed / 9 failed, 10.0m**. Changed the new
panel heading to h2, retaining all axe assertions. The corrected broad run had
one fixture fail to boot while the concurrent production build replaced its build
directory; rerun that case after the build has settled. Fast-check's command and
jobs properties hit their existing 5s timeouts under earlier parallel load;
frozen fast verification passed without changing those tests or timeouts.
An expanded uppercase-ID test exposed case-sensitive scope hashing: canonicalise
UUIDs before source hashing/command binding; corrected selected test passed
**1/1, 19.05s**, then the complete final 11-case suite above passed.

### Grouped discovery deadlock follow-up

The pinned-node six-case run passed A2 on all three viewports (**17.5s, 18.4s,
17.3s**) and grouped phone/tablet, but desktop grouping's background booking-list
read returned 503. An isolated run reproduced it; PostgreSQL reported `deadlock
detected`. A later instrumented pass did not establish a fix. Static tracing found
accepted-order lists acquiring wearer locks in descending display order while
booking queries acquire sorted wearer IDs.

A real PostgreSQL barrier test holds source discovery after its first wearer
lock, starts grouping discovery, observes the advisory wait, releases the source
list, and requires both return their two unchanged records. Old code returned
**503** (**10.70s** run); page-wide sorted authority locking passed **1/1, 11.14s**.
No timeout, retry, assertion or domain policy was weakened. Initial test-fixture
setup errors (reusing published settings/catalogue, then omitting a candidate POST
body) were corrected before the actual red/green proof. The final 17-case
PostgreSQL rerun above includes this regression.

### Final browser closeout

`pnpm exec node scripts/test-ui.mjs repeat-services.spec.mjs group-intake.spec.mjs`
after the lock fix passed A2 on **phone 24.9s, tablet 19.1s, desktop 16.5s**,
and grouped intake on phone (**1.5m**) and desktop (**1.4m**). The run reported
**5 passed / 1 failed, 6.9m**: tablet package promotion received a real 429. Trace
inspection showed a saved draft and the enabled explicit confirmation button;
the old test expected only completed or unknown-outcome retry UI.

Updated that test to distinguish known admission refusal from unknown outcome,
honor Retry-After, and explicitly confirm the retained reviewed draft again.
Injected a first package-promotion 429 to ensure this branch executes; acceptance,
package/history/privacy assertions and admission limits remain intact.
`pnpm exec node scripts/test-ui.mjs group-intake.spec.mjs --project=tablet`
then passed **1/1, 1.7m** (scenario **1.5m**). This completes all three A2 and
grouped viewport outcomes; no single six-case clean run is claimed. Full `pnpm
lint` and `pnpm knip` passed after the test-only admission correction. Runtime
types/unit/negative/OpenAPI/build inputs had not changed since the final fast run.
No PDF or runtime packaging change required additional PDF/Linux-image checks;
full promotion, physical Android, fluent Tamil and screen-reader gates remain.

### Revision and hosted checks

Capability `f4f1cf4c939558e6098b69787403898a025724f4` was published in draft
[PR #140](https://github.com/nishanthturnstile/aarili/pull/140), targeting
`development`, at **2026-10-21T11:51:45Z**, and immediately linked to T3.
Its Fast verification and Dependency audit passed in
[run 39595111999](https://github.com/nishanthturnstile/aarili/actions/runs/39595111999)
at **11:53:46Z** and **11:52:12Z** respectively. Full scaffold/browser jobs are
skipped for feature PRs by the existing workflow, not waived promotion checks.
The subsequent lock correction, regression and richer review fixtures were
tested against `f4f1cf4` plus dirty `packages/core/src/orders.ts`,
`tests/repeat-services.integration.test.mjs` and `scripts/review-repeat-services.mjs`.
The later test-only correction is `tests/ui/group-intake.spec.mjs`; evidence and
timings are committed with the closeout. The PR head is the immutable publication
locator. Latest-head CI must pass before owner merge; earlier-head green checks
are not represented as current-head proof.
Runtime correction and complete review fixtures are published as
`e3531f84e5530ed1f6dedf5094c2f29d62927ed3`. Review-ready closeout was prepared by
**2026-10-21T12:24:54Z**. Its
[CI run 39599419140](https://github.com/nishanthturnstile/aarili/actions/runs/39599419140)
had audit success at **12:25:28Z** and Fast in progress when observed. This final
documentation-only timing record supersedes that head; check the PR's latest
required CI before merge. No source/build input changed after the recorded checks.

### Requirement check

| Acceptance | Evidence and limits |
| --- | --- |
| RH-01/02/11 | Explicit partial standalone/original/supplemental selection; fresh identities; unknown/zero; current comparable mapping; native piece context; incompatible/task mapping blocked. Contract property test preserves metadata through form projection. |
| RH-03/09 | Existing commitment evaluator; zero draft demand; stale competing review conflicts; simultaneous exact replay creates once; two intentional repeats remain distinct. |
| RH-04/05 | Original order/snapshot/promise compared unchanged; source completion retained, target pending; no receipt, money or package facts copied. Existing grouped/service regressions retain their original semantics. |
| RH-06 | Missing/stale preconditions, changed request, exact retry, transactional fault rollback; browser lost-create response, same creation retry, dirty navigation, save/reload and acceptance. Existing durable recovery governs failed saves and acceptance. |
| RH-07/08 | Real RLS inventory/missing context; cross-shop/wrong source key/stripped wearer denied; guardian withdrawal denies replay/read; immutable lineage and atomic failure. Completion and acceptance barrier proves serialization. |
| RH-10 | English/light and Tamil/dark, keyboard, axe and 200% text reflow on three emulated sizes. Actual Android, fluent Tamil and assistive-technology findings pending. No AC-59 timing target claimed met. |
| RH-14 | Populated upgrade, strict legacy DTO rejection, old regression suites, write-disable/retry recovery and inventory updates. |
| RH-15 | Private no-store authenticated APIs, UUID-only record URLs, no browser business storage or new jobs. Immutable provenance contains personal candidate text under existing retention/redaction boundaries; no production privacy/retention activation or later-domain closure. |

## Human review packet

Start after the production build: `pnpm exec node scripts/review-repeat-services.mjs`.
The disposable loopback host prints the exact `/orders?services=1&serviceOrder=…`
URL. Sign-in details are available only in ignored
`.scratch/repeat-services-review-host/private.json`; do not paste them into chat
or Git. The synthetic source has two saree-finishing lines, distinct prices
(zero/unknown) and a descriptive garment reference. Running host URL and first
tryable time are recorded below after startup verification.

The final host also seeds a custom garment with original add-ons and an accepted
native-piece supplemental change, plus garment-price and package-proposal booking
members. Their URLs are in the same private access file. All fixture writes use
existing synthetic commands, without production configuration approvals.

At **2026-10-21T11:44:07Z**, ordinary sign-in and source review were verified at
`http://127.0.0.1:59586/orders?services=1&serviceOrder=01a15e42-5eee-74cf-a564-e38b04f4794c`.
The first diagnostic expected `/owner` rather than the final `/dashboard` after
successful sign-in; corrected check passed. T3 preview opened the host but twice
returned `Preview automation snapshot timed out after 15000ms.` Used the
repository's Playwright workflow with pinned Node for sign-in/source verification;
no auth traces, credential screenshots or business mutation. Screenshot inspection
then applied existing field/select/check styles and 44px label targets.

**Current final host**, verified by **2026-10-21T12:14:36Z**:

- Standalone: `http://127.0.0.1:59017/orders?services=1&serviceOrder=01a15e61-ff7d-7a17-ad57-a02abeb79068`.
- Original add-ons / accepted native-piece addition: `http://127.0.0.1:59017/orders?order=01a15e62-015f-746c-9e28-7180f229c643`.
- Pinned-Node ordinary sign-in, both source types, 44px targets, axe zero,
  Tamil/dark landscape and 200% text reflow verified without business mutation.
  The ignored diagnostic initially used `browser.newPage`; axe requires an
  explicit context. Context7 current Playwright docs confirmed
  `browser.newContext` / `context.newPage`; corrected diagnostic passed. Product
  code and the repository's browser test context setup were unaffected.

1. **RH-01/02/11:** Open the source, review previous service work, select one line
   and a current compatible profile/mapping. Create the draft. Only selected work
   appears; price is unknown, date blank, garment receipt unrecorded.
2. **RH-02/03/06:** Enter a fresh date and explicitly quoted zero or unknown; save,
   reload and resume. Review current commitment facts, acknowledge and confirm.
   A new order/code/subject and pending line appear; source detail is unchanged.
3. **RH-04/11:** Follow source/new lineage both ways. Separately mark a synthetic
   source line completed using existing explicit completion, then select it for
   a new repeat; it starts pending. Review fresh capacity again.
4. **RH-02/10/11:** Leave mapping unresolved and save; review must explain the gap
   and keep acceptance blocked. Check clarity in English/Tamil, light/dark,
   keyboard and phone landscape. Report actual Android/device/RAM/browser,
   fluent Tamil or screen-reader observations where applicable.

Report `RH-ID — pass/fail — observation`. These human findings and owner merge
review remain pending. Stop using `pnpm exec node scripts/review-repeat-services.mjs stop`;
the host removes private access files and its disposable database. No tunnel or
production demo is created. Production catalogue/rates/privacy/restore/pilot and
later-domain decisions retain their existing gates.
