# New multi-garment intake: 1.2.2c / #120

20 October 2026. Owner selected #120 after B merged in
[PR #122](https://github.com/nishanthturnstile/aarili/pull/122) at 06:33:15 UTC
(12:03:15 IST), commit `7b1ca94`. Its Fast verification and Dependency audit
succeeded. Direct blockers #119/#114/#101 and native blocker edges were rechecked;
#114/#101 closed through merged #116/#106. The clean existing checkout was
fast-forwarded to development before creating `codex/multi-garment-acceptance`.
No worktree, implicit merge or deployment.

## Sources and approved boundaries

[Approved design/GB matrix](Grouped_Bookings_Design.md),
[ticket packet and five owner decisions](Grouped_Bookings_Ticket_Packet.md),
[REA evidence](Grouped_Bookings_REA_Evidence.md), product §§3–9, 13, 15, 17,
24–25, 27, 32–33; architecture §§6–11, 15;
[workflow](Development_Workflow.md). ORD-02/03/13/14, AC-01 and AC-63 structure;
AC-40/55/60 integration. Reuse retained actual competitor evidence and distinguish
its observations/inferences/unknowns; no new competitor claim, copied vendor
implementation, sign-in request, APK or invented REA ID.

All-or-nothing new acceptance, stable draft line UUIDs, explicit Quick Order
conversion and package proposal semantics are approved. Manual payments stay in
1.4.2; no payment, allocation, bill, gateway, automated UPI/bank integration,
measurement capture, production, custody or handover command. Bridal remains an
occasion. No invented rates, allocations or production-policy activation.

## Implementation under review

- `order.group` reuses the existing durable draft registry/controller, typed
  Hono clients and owner-verified transaction. B's already-accepted linking path
  remains distinct. The group neither promotes independent Quick Order drafts
  nor relies on compensation after a partial acceptance.
- The existing acceptance resolver/writer is the shared seam. All customer and
  wearer authorities lock in sorted class order; catalogue → forms → templates →
  commitments → bindings → calendar → policies → profile locks precede all
  distinct sorted canonical-category capacity locks and readable code allocation.
  One server clock and deterministic pending candidate demand cover the complete
  set, including week/category differences. Whole-set review binds exact line
  identity/order/input, authority, sources, load, warnings, context and basis.
- Additive per-line origin uniqueness outlives expiring request keys. One demand
  per garment; outfit pieces remain components. Shared context never propagates
  promises. Every accepted garment retains its own pinned requirements/pieces.
- Garment-price aggregate keeps zero/unknown separate. A package proposal freezes
  every listed garment as included; its amount is the headline and is never added
  to reference amounts. Commercial schema v2 references immutable proposal version
  1; included allocation is null, never an invented zero. Existing v1 Quick Order
  price meaning remains intact. Unsupported versions fail strict parsing.
- Conversion is an explicit `draft.convert` action with frozen key/body/If-Match.
  It creates one grouped draft/line and closes the original source atomically,
  retaining all fields while clearing stale commitment acknowledgement. It cannot
  independently accept the converted Quick Order. The original durable result
  points to the recoverable target, including reload after a lost response.
- Shared Quick Order fields edit one stable group line at a time. Add/copy/reorder
  actions are explicit; Simple/Detailed retain hidden fields. Bilingual review
  lists every wearer, service, independent date/instructions, price basis,
  unresolved requirements and capacity facts before all-or-nothing confirmation.
  Package context changes reuse B; attaching garments to frozen package scope is
  rejected rather than silently extending the quote.

## Migration/recovery

Reviewed additive `0033_grouped_order_acceptance.sql` adds the nullable line origin,
partial unique indexes preserving legacy single origins, immutable commercial
versions and draft conversion records. All new tenant tables have non-null shop
IDs, composite tenant links, shop-led keys, ENABLE/FORCE matching policies, narrow
grants and transactional provenance/completion guards. Existing acceptance and
booking guards retain their single-order/B checks and add explicit group intent.
No backfill or destructive down migration. Compatible rollback retains source,
commercial and conversion history and disables unsupported writes/readers.
Use the advisory-lock runner; back up non-disposable databases. Synthetic-only
fixtures do not open restore/privacy/content/rates/pilot gates.

## Verification ledger

Pinned Node 24.21.0/pnpm 12.11.2, native Windows with disposable PostgreSQL.
Context7 resolved `/drizzle-team/drizzle-orm-docs` and fetched partial unique-index
declarations; existing SQL/repository transaction patterns remain authoritative.

- Initial package compile caught explicit array/control-flow typing omissions;
  subsequent package build passed. No baseline/tooling correction was adopted.
- Initial test command's Windows unquoted pipe ran no tests; corrected selection
  used a single GB-C prefix. Initial SQL contained a PowerShell-added UTF-8 BOM;
  removed it without changing migration execution. The next group attempt exposed
  an ambiguous PL/pgSQL variable/table alias, corrected to an explicit alias.
- Initial C real-PostgreSQL acceptance/conversion selection **2/2, 22.15s**.
  Broader C selection **12 passed / 1 failed, 103.05s**: the failed fixture tried
  to recreate a blouse category rather than the intended two-category journey.
  Corrected to salwar plus blouse; category/week follow-up **1/1, 12.73s**.
- Unit/recovery selection **23/23, 1.08s** across three files. Strict typechecks
  passed after replacing a nonexistent display fact with the actual `existing`
  load field; most recent observed pass **23 tasks, 11.34s**. Changes afterward
  retain affected checks before publication.
- First browser attempt reached the source draft but served the prior B production
  build: the fixture runs production Next, not the separate Playwright dev host.
  No C behavior claim comes from that run. Rebuilding the current artifact is the
  prerequisite for the next browser attempt.
- Current-production browser conversion/retry and second-line editing succeeded,
  then a lookup assuming the converted draft appeared in a generic list failed.
  Added bounded Load more recovery; direct assertions use the actual durable
  conversion result rather than assuming its position in a paged/time-bound list.
- The next browser wait assumed Load more before async list results arrived;
  corrected it to wait for either the actual draft or its next-page control.
  Inspection also caught a real two-way form reset race that could replace a
  selected wearer with stale values. The line form now resets only on explicit
  copy/server-conflict recovery; ordinary typing/mode changes remain local and
  feed the complete parent draft. A stored wearer-ID assertion guards this
  correction, in addition to visible distinct-wearer checks.
- Full affected four-file PostgreSQL regression **63/63, 406.17s**:
  order-acceptance, orders, owner-bootstrap and tenant-isolation. Log:
  c-pg-full.log. This includes both Quick Order and group publisher races,
  every-write rollback, guardian withdrawal, populated upgrade and new inventory.
  Subsequent group validation/UI refinements retain focused verification; this
  passing broader evidence is reused for unchanged paths.
- Final affected C PostgreSQL selection **15/15, 126.78s**,
  c-pg-final-scope.log, adds invalid proposal/reference/unknown-effort checks and
  faults after each actual conversion write plus competing conversion keys.
- Browser confirmation caught two retry issues: its saved-state assertion matched
  “Not saved yet,” corrected to exact Saved; and the shared controller forgot a
  known rate-rejected business intent, making Retry save instead of continuing.
  The controller now retains that explicit intent without claiming an uncertain
  outcome or blocking edits; changing input clears it. Unknown outcomes still
  freeze the original key/body/precondition. Focused recovery **22/22, 421ms**.
  Initial final-gate attempt found missing test-constructor ETag arguments;
  corrected those fixture calls. Final `pnpm verify:fast` exited 0:
  **57 files / 243 tests, 15.83s**, lint/boundaries/tokens/PWA, Knip, strict
  types, negative checks, OpenAPI and **12/12 build, 13.03s**.
  Log: c-fast-corrected.log. A new browser-only recovery file was added afterward;
  its lint and direct workflow results are recorded separately below.
- First new phone recovery journey passed **17.4s**: IME defers save, a committed
  in-flight save retains newer garment typing with a new key/current ETag, reload
  retains it, and explicit discard-to-server conflict resolution refreshes the
  active line without silently merging.
- The first complete acceptance UI wait raced the retry/detail transition. Trace
  confirmed one committed group, exact replay and successful booking read. It
  also exposed a redundant request burst at that transition; the parent no longer
  refreshes invisible lists, and initial booking detail loads its own data before
  any explicit edit needs candidates. No pool/timeout limit was increased.
  The test now waits for either the recovered detail or its retry action.
- Added closed-policy empty `order.group` and adult service-withdrawal/replay
  negatives: **2/2, 16.31s**, c-pg-purpose-gates.log. Guardian withdrawal race
  remains in the passing full and C-focused selections.

- The pre-acceptance review now reuses A's exact piece projector. Its fingerprint
  binds piece names, pinned forms, scoped unresolved requirements and shared
  requirements before confirmation. C PostgreSQL selection after this change:
  **16/16, 140.12s**, c-pg-pieces-final.log.
- Tamil transport regression **1/1, 11.52s**, c-pg-tamil-bounds.log: twenty
  garment lines with multibyte Tamil instructions save and review under the
  durable-draft bounds; oversize canonical content is rejected without orders.
  Intake review uses the draft transport ceiling while retaining the canonical
  65,536-character bound. Existing B request limits remain intact.
- Impeccable detector ran once on the four changed UI surfaces: **zero findings**,
  c-detector.json. Incumbent Operate UI, typography, themes and density remain
  authoritative; no new visual world, raster assets or design-token change.
- First complete six-file browser matrix: **14 passed / 4 failed, 9.1m**,
  c-ui-delivery.log. All existing Quick Order draft/acceptance/piece and all new
  IME/in-flight/conflict recovery journeys passed at all three sizes. Phone and
  tablet C completed acceptance/exact retry/reload, then the in-process setup
  request for the second scenario returned 503. Desktop C reached both bookings,
  but a test wait tried saving again during its successful detail transition.
  The old B tablet test also proceeded through a substring Saved assertion.
  Package fixture setup now precedes interactive work, both confirmation waits
  await detail-or-retry, and B requires exact Saved with bounded real-admission
  retry. Captures explicitly return to the top for valid viewport context.
- A native-exit-captured fast rerun overlapping the browser matrix reached
  **242 passed / 1 timeout, 19.16s** in unchanged runtime-cleanup's five-second
  check, c-fast-overlap-failure.log. Final heavy gates run sequentially with four
  Vitest workers; no assertions or timeouts were weakened. Earlier full fast
  output reported every component passing, but its PowerShell stderr wrapper
  returned 1, so it is not represented as an observed native exit-0 result.
- Sequential pre-review `pnpm verify:fast`: **native exit 0**, c-fast-before-finish-fix.log.
  **57 files / 243 tests, 15.78s**, lint/Biome/boundaries/tokens/PWA, Knip, strict
  typechecks, negative types and **79 OpenAPI paths**; production build
  **12/12 successful, 13.07s**. SQL changes afterward remove only a trailing blank
  line; UI test changes require only their targeted browser confirmation.
  [Verified file manifest](Grouped_Bookings_Intake_Verified_Files.sha256) contains
  37 capability/fixture/test files, SHA-256 over the staged LF Git blobs, rather
  than undocumented CRLF worktree bytes. Documentation is outside that manifest.
- Affected B browser confirmation **3/3 at phone/tablet/desktop**, within the
  six-case **3 passed / 3 failed, 3.6m** run, c-ui-confirmation.log. Its C cases
  selected the wrong fixture by ordinal after both drafts were pre-seeded;
  selection now uses the intended visible notes rather than list position.
  Final C-only confirmation and fresh top-of-page captures follow below.
  Post-helper full lint **native exit 0**, c-final-lint-current.log;
  all 37 staged/worktree sources match the SHA-256 manifest.
- Final C-only browser confirmation **3/3, 3.3m, native exit 0**,
  c-ui-intake-final.log: both pricing bases, conversion and committed-response
  loss/exact retry, distinct wearers/dates, current piece requirements, server
  list/second-session/cold completed-source recovery and sign-out. Together with
  the passing original unchanged journeys and B confirmation, all **18 scoped
  workflows** have passing evidence across six files at three sizes; this is
  evidence reuse, not a claim that the failed first matrix passed unchanged.
  English/Tamil × light/dark axe and reflow passed. Tablet landscape and 200%
  text remain in the passing C journey. All **24 current PNG captures** in
  `.scratch/grouped-bookings-c/captures/` have their expected 360×800, 820×1180
  or 1440×900 dimensions, real loaded content and top-of-page context.
  Capture validity checked before the independent finish-review handoff.

## Independent finish review

The fresh Impeccable reviewer inspected every one of the 24 valid captures plus
below-fold source and returned **fix** for two approved-design deviations: C's
desktop garment list stacked above the active editor, and picker rows omitted
their own wearer/service/quote cues. Typography, themes, shell, atomic review,
commercial boundaries and piece disclosure matched the incumbent direction.
Report: ignored `.scratch/grouped-bookings/c-finish-review.md`.

Fix batch 1 reuses the existing `.booking-garments` container-query composition
inside `.booking-editor`; no new CSS or tokens. Rows use the authorised existing
preview API for wearer and exact bilingual service labels, repeat their own
promise and quote state, and explicitly label package references. Those memory
labels clear on identity/source or authority loss. The browser asserts row cues
and desktop list/editor geometry. Current fast gates and same-matrix recapture
follow before the reviewer's scoped verdict pass. No second detector runs.

Post-fix `pnpm verify:fast` **native exit 0, 13:52:40 IST**,
c-fast-delivery-final.log: **57 files / 243 tests, 20.12s**, full fast components
including **79 OpenAPI paths** and **12/12 production build, 21.975s**. No backend
or schema behavior changed in this visual batch; the current PostgreSQL evidence
above remains applicable. The 37-file source manifest was refreshed after the
UI/test edits.

Post-fix browser confirmation **6/6, 4.7m, native exit 0**,
c-ui-finish-fix.log, finished by **13:57:54 IST**. It reruns all three new intake
and all three IME/in-flight/conflict recovery journeys. Every row's wearer,
service and quote state plus desktop column geometry are asserted. All 24 same
PNG paths were refreshed and revalidated against this source manifest.

The reviewer reopened all 24 recaptures and scored **both fixes resolved**,
**disposition: ship**, with no second detector. This verdict is limited to those
two scored fixes, not a new whole-surface approval. Report:
`.scratch/grouped-bookings/c-finish-verdict.md`. Human language/device/AT and
owner merge acceptance remain pending.

The fresh Impeccable documenter completed the incumbent-system comparison:
canonical palette, local fonts, geometry, shared Base UI components and layout
contracts are preserved. It independently checked desktop English light and
phone Tamil dark; the finish reviewer supplies the other capture coverage.
Report: `.scratch/grouped-bookings/c-documentation-report.md`. Pre-existing
supported-surface inventory drift in the design-system document was reported
without changing the baseline or creating new design-system artifacts.

Software/packet review-ready observed **13:59:25 IST, 20 October**.
[Draft PR #123](https://github.com/nishanthturnstile/aarili/pull/123) opened at
**08:30:27 UTC / 14:00:27 IST** against `development`, implementation commit
`92d6a18`, and was immediately registered with this T3 thread. This publication
metadata follow-up changes documentation only; all 37 verified source blobs
remain identical. Initial feature run
[39393898720](https://github.com/nishanthturnstile/aarili/actions/runs/39393898720)
was observed at **14:00:39 IST** with Fast verification queued and Dependency
audit in progress; full scaffold/browser jobs skipped per feature workflow.
That is an initial-head observation, not a latest-head CI pass. Owner acceptance,
current-head CI, merge and live activation remain separate gates.

## Acceptance mapping

| Scenario | C evidence and boundary |
| --- | --- |
| GB-01 | Two independent garments, wearers, instructions and promises; atomic C intake plus existing B linking. |
| GB-02 | Existing A exact salwar top/bottom/dupatta and per-piece readiness are projected before and after acceptance; no extra garment demand. |
| GB-03 | Immutable v2 package proposal versus garment subtotal; known zero/unknown separated; included references never summed into headline, allocation remains unknown. Bridal remains an occasion/package. |
| GB-04 | Whole-set current authority/capacity review; sorted category/week locks, cumulative demand and actual last-slot/Quick-vs-group races. |
| GB-05 | Forced RLS inventory, cross-shop negatives, adult purpose and guardian-withdrawal races, private history/replay denial. |
| GB-06 | One transaction for every order, requirements, pieces, demand, booking, commercial history, audit and command; injected actual-write rollback and exact replay. |
| GB-07 | Recoverable grouped drafts, stable line IDs, explicit one-time conversion; changed-key races, expired-key durability and lost-response replay. |
| GB-08 | Populated A/B upgrade preserves immutable snapshots; current source publication races reject stale reviews. Exact pieces retain their pinned forms/requirements, conversion retains original fields, modes remain lossless. Existing A legacy materialisation regression is reused. |
| GB-09 | Lossless Simple/Detailed, bilingual accessible responsive workflow; IME/in-flight edits, explicit conflict recovery and cold result reload. Browser results below. |
| GB-10 | No payment posting/capture, measurements, production, custody or partial handover; later slices and human activation gates retained. |

Physical Android, fluent Tamil and assistive-technology reports remain pending.
No new issued PDF; customer summary/piece handover integrations stay in
1.4.3/1.8.3. Full `pnpm verify`, physical-device and new PDF-golden results are
not claimed by the scoped checks above.

## Owner-review packet

Current C review host: **http://127.0.0.1:64754/orders**. The original host at
62208 was first observed ready by **13:28:24 IST, 20 October**, then stopped for
the finish-review rebuild. The current host uses that rebuilt artifact and fresh
synthetic records. It is a disposable loopback host with no real
customer data. Restart using pinned Node and
`node scripts/review-multi-garment-intake.mjs`; a restart chooses a new port.
Private sign-in and the three draft IDs are in ignored
`.scratch/multi-garment-review-host/private.json`; do not publish those values.
The setup has two adult wearers under one contact, salwar and blouse, separate
dates/instructions, a ₹1,200 garment plus an unquoted garment, a separate ₹2,000
package-proposal draft, and an unverified minor Quick Order draft. There are no
accepted orders initially.

1. **GB-01/02/04/07/08/09:** open the primary grouped draft. Check both wearers,
   dates and instructions, switch Simple/Detailed and reload. Review exact
   salwar pieces and unresolved requirements, acknowledge the synthetic capacity
   exception when shown, then accept the whole set. Expect one BK with two QOs,
   ₹1,200 known subtotal plus one unquoted garment; no extra piece garment.
2. **GB-03:** open the separate package draft. Its ₹2,000 is the package headline;
   included garment amounts are references and allocation stays unresolved.
   Confirm/reload and inspect separate garments. No payment is recorded.
3. **GB-05/07:** open the minor draft by its private ID through
   `/orders?draft=<minorDraftId>`. Conversion with no verified guardian must fail
   closed and leave the original draft recoverable. Automated write-fault,
   concurrency and exact lost-response retry results are in the ledger; the
   owner need not replay terminal tests.
4. **GB-09:** inspect both themes and English/Tamil on phone, tablet and desktop.
   Human fluent-Tamil, actual Android/device/RAM/browser and assistive-technology
   observations remain pending. Report `GB-ID — pass/fail — observation`, keeping
   language/device findings separate from automated results.

Teardown: `node scripts/review-multi-garment-intake.mjs stop`. It removes its
private access file and disposable web/database resources; unrelated review
hosts remain untouched. Merge and deployment require separate owner action.
