# #174 / 1.4.1b — recoverable garment estimates and private costs

24 October 2026. Selected A2 implementation. Whole feature 1.4.1, issued
quotations and live/pilot acceptance remain later gates. [Approved design](Quotations_Design.md),
[packet](Quotations_Ticket_Packet.md), [REA evidence](Quotations_REA_Evidence.md).
No new competitor claim or vendor implementation is used in this slice.

## Admission and base

The owner explicitly requested latest development and issue #174 after merges.
The existing checkout was clean on `codex/quotation-rates-a1`; fetched origin,
switched to development, fast-forwarded and created `codex/garment-estimates-a2`
from **286c80b523e70b2579d32a8a022bf6a9399b827f**. No worktree, reset, stash,
dependency/version change or unrelated edits. Admission/implementation checkpoint
observed **10:54:26 UTC**; active coding time is not separately instrumented.

All eight native blockers were closed and their implementation merge commits
were verified ancestors of development: #173 → PR #177, #118 → #121,
#124 → #127, #125 → #128, #147 → #149, #32 → #38, #51 → #61, #56 → #67.
PR #177 merged **10:49:47 UTC** at the base above; its required Fast verification
and Dependency audit succeeded in [run 40078759286](https://github.com/nishanthturnstile/aarili/actions/runs/40078759286).
Skipped full/promotion browser jobs were not claimed as passes. #175 waits for
#174 to merge; no booking proposal/issue/payment/agreement/billing work starts here.

Codebase Memory listed one unrelated indexed root and none for this checkout;
there is no Graphify graph here. Bounded rooted source discovery was used without
installing or reindexing tools. Product FIN-01–04, ORD/CUS/TRU/USE references in
the approved packet and architecture §§6–9/11/15 govern the implementation.
Current Context7 Zod strict-projection and React lifecycle documentation was read;
installed Turbo and Next.js guidance was used. Existing tools and pins remain.

## Implemented boundaries

- The existing Orders workspace opens an unattached estimate or a real garment,
  native piece context or wearerless service. Existing authorized readers supply
  customer/wearer, acceptance digest, aggregate/supplemental scope, selected
  specification, booking/package and native service-subject/line identities.
  Attachment uses a new reviewed draft/version; it never creates fake pieces,
  accepts an order or rewrites its commercial/promise/approval snapshots.
- Raw incomplete or invalid text is recoverable through `pricing.estimate` and
  the established durable controller. Stable line/subject IDs, raw prices,
  quantity/unit/basis, assumptions and source selections survive acknowledged
  reload. Published internal versions may retain explicit unknown prices; they
  are **estimate-not-issued**, with unknown count and no confirmed selling total.
- Known/fixed/rate prices, included named charges, complimentary zero and
  reasoned exclusion are distinct. Customer fabric/lining/trims can be unknown
  or explicitly excluded; they cannot be sold as shop stock. Any handling service
  is its own disclosed component. Included work does not add a second charge.
- Existing `parseRupees`, `checkedMultiplyDivide`, checked sums/subtraction and
  safe integer serialization calculate all paise. Counts/mm are integers;
  unsupported fractional paise, overflow, basis/unit mismatch and invalid text
  remain visible blockers. No rounding or invented rate/policy is introduced.
- Owner-entered estimated costs live in separate private rows with independent
  unknown/known values and reasons. Complimentary/zero/included selling states
  retain these costs. Estimated margin is explicitly a private proposal and is
  unknown when either side is unknown. Negative sub-rupee margins format exactly.
  Actual costs remain **unavailable**; there is no fabricated actual/expense entry.
- Strict customer DTOs are built explicitly and reject private cost, margin,
  actual and production fields at both root and line level. The customer-query
  route returns only this projection under current owner/subject authorization.
- Current rates never refresh on read. Explicit comparison presents entered
  versus proposed rates, then Apply replaces selections only after owner action.
  A review fingerprint binds raw input and current source/cost calculations.
  Source, rate or specification changes invalidate review. Old versions return
  frozen prices/costs plus source-changed metadata; no history is recalculated.
- Immutable revision/line/private-cost rows, CAS pointers, actor-bound draft
  origin/idempotency/audit and exact tenant/source FKs commit together in
  expand-only `0054_garment_estimates.sql`. Four tables have non-null shop IDs,
  FORCE RLS and explicit policies; runtime is app_user. History, replay and
  recovery reauthorize current customer/wearer/guardian rights. Scope lock
  preparation precedes identity/configuration locks; conflicts never auto-merge.

No journal, payment, revenue, receivable, stock, custody, production, capacity,
PDF or accepted-order mutation is part of the estimator. Read source state is
not an instruction to manufacture a financial or physical event. #175 supplies
booking consolidation/discounts; #176 supplies non-tax issuance and Tamil/A4 PDFs.

## Verification record

Native Windows, Node **24.22.1**, pnpm **12.15.0**, TypeScript **7.0.2**;
real disposable PostgreSQL and production web fixtures. Logs are outside Git in
`%TEMP%/aarili-estimates-20261024/`. Test subjects, values and identities are
synthetic only. Runtime checks below concern the working A2 source on base 286c80b.

- Baseline money/rates/draft controller: **36 passed / 1.05s**.
- New arithmetic/projection suite: **6 passed / 1.08s**, including **200** seeded
  exact selling/cost pairs (`174001`), private-field poisoning, unknown totals,
  customer materials, included identities, fractional paise and overflow.
- First new PG run: **2 passed / 1 failed / 38.58s**. The failure was a fixture
  attempting `authorisation_declined=true` while leaving `authorised=true`,
  violating the pre-existing relationship invariant. The fixture now clears
  authorization as well; no domain permission constraint was weakened.
- Next PG run: **4 passed / 42.73s**, including explicit rate replacement and
  unchanged old estimate prices/costs. Expanded native service and RLS inventory:
  **6 passed / 11 filtered / 75.08s** (`pg-expanded.log`), including populated
  0053 upgrade, exact source attachment, current permission denial, first/same-base
  races, original-key replay, 428/412/409, post-child rollback and immutable history.
- First full `pnpm verify:fast`: **exit 0**, **332 units / 71 files**, unit stage
  **19.93s**, production build **29.812s**; lint, Knip, strict types, negative
  DTO/client fixtures and OpenAPI included. Subsequent affected checks are below.
- Clean frozen installation/build/new module import verification: **exit 0**,
  all ten package builds **34.218s**, lockfile unchanged (`clean.log`). No new
  dependency, package boundary, toolchain correction or local Linux image.
- Impeccable scoped detector: **exit 0, empty findings** (`detector.json`).
- Initial browser workflow failed at draft editing: `guard.safe` means safe to
  leave, not authenticated. Reading it as access hid a dirty editor. The new
  surface now separates access invalidation from unsaved-work state; the shared
  guard/controller was not changed. Its failure is retained in `ui-first.log`.

No quotation PDF check is represented as implemented: PDFs belong to C. Full
promotion matrices, physical Android/low-memory behavior, fluent Tamil,
assistive technology, owner review, restore/live/privacy/pilot gates remain
distinct from automation. A feature PR is not an issued quotation or live approval.

## Requirement-to-evidence map

| Criterion | Evidence |
| --- | --- |
| A2-01 | Unattached acknowledged raw drafts, native order/piece/service readers, new immutable attachment provenance; populated accepted snapshot remains unchanged. |
| A2-02 | Unknown versus zero, included/complimentary/excluded unit properties; known subtotal, unknown count and null total; interrupted/reloaded browser drafts. |
| A2-03 | Core and SQL customer-property guards, separate handling component, no stock/custody command; before/after source and financial assertions. |
| A2-04 | Private rows/projection allowlist, runtime poison rejection, positive cost with zero selling amount, unknown margin and typed unavailable actuals. |
| A2-05 | Existing paise utilities, integer mm/count/basis, precision/fraction/overflow tests and seeded price/cost properties. |
| A2-06 | Exact rate/source/version fingerprints, explicit proposed refresh, stale-review rejection and unchanged frozen old versions/accepted snapshots. |
| A2-07 | Real PostgreSQL concurrency, original-key replay, post-write rollback, preconditions, no-context/cross-shop and current subject permission checks; shared controller conflict/access-loss tests. |
| A2-08 | Three-size bilingual workflow/axe/IME/reload/unknown/private review; manual language/device/AT session remains pending. |

## Owner review session

The running URL and latest automated result are recorded in the final checkpoint
below. Sign-in is only in `.scratch/garment-estimates-review-host/private.json`,
outside Git/chat. Start after building with pinned Node:
`node scripts/review-garment-estimates.mjs`. Stop:
`node scripts/review-garment-estimates.mjs stop`. The disposable host deletes its
private access file and disposes its database and web process. No public tunnel.

1. **A2-01/02/08:** Resume the seeded estimate: unknown blouse labour, excluded
   customer fabric, complimentary hooks with a private ₹25.01 estimated cost.
   Type Tamil with IME, save, reload and inspect the same acknowledged values.
2. **A2-02/03/04:** Review prices. Expect known selling subtotal and explicit
   incomplete status while blouse price remains unknown. Customer fabric has
   no stock charge. Complimentary hooks keep their private cost. Customer review
   includes no cost/margin/private reason; actual cost remains unavailable.
3. **A2-05/06:** Compare current sources and explicitly Apply; enter a reasoned
   exact price or select a reviewed rate. Review and save an estimate version.
   Change a rate separately, then compare a revised estimate. Inspect the old
   version and accepted source price: neither changes. No quotation is issued.
4. **A2-01/06/07:** Attach a current accepted garment, optional native piece or
   wearerless service through Scope; review mapping as a new version. In a second
   session edit the same draft/version and exercise explicit conflict comparison;
   keep typed data or start against the current estimate deliberately.
5. **A2-08:** Review focus, 44px targets, enlarged text, wrapping and language on
   an actual Android/low-memory device and with assistive technology. Report
   device/RAM/browser and fluent Tamil findings separately from emulation.

Copyable report: `A2-01…08 — pass/fail — observation — device/browser/RAM/language`.

## Final local verification checkpoint

All commands used pinned Windows Node 24.22.1/pnpm 12.15.0 on this branch's
implementation working tree, based on 286c80b; logs remain outside Git in
`%TEMP%/aarili-estimates-20261024/`. These are synthetic disposable databases.

- Final `pnpm verify:fast` completed all stages: lint/boundaries/tokens, Knip,
  strict types, **332 tests / 71 files / 15.13s**, negative contract/client
  fixtures, OpenAPI and production build (**12 successful tasks / 17.665s**).
  `fast-final.log` supersedes earlier runtime checks.
- Final A2 plus forced-RLS inventory PostgreSQL run: **6 passed / 11 filtered /
  71.31s**, `pg-final.log`. This includes native-piece eligibility and populated
  upgrade, both grouped commercial bases and a wearerless native service,
  unchanged accepted commercial snapshots, current permission revocation,
  concurrency, retry, rollback and strict customer projection.
- `node scripts/test-ui.mjs garment-estimates.spec.mjs`: **exit 0, 3 passed /
  1.3m**, phone 360×800, tablet 820×1180, desktop 1440×1000. Each runs lost
  committed response/original-key retry, IME deferral, raw Tamil reload,
  unknown selling subtotal, explicit source application, complimentary selling
  price with private ₹25.01 cost, version/history and cost-free customer review.
  English light/Tamil dark axe have no violations; narrow 320px reflow and static
  PWA-only storage checks pass. `ui-final.log`; six captures under ignored
  `.impeccable/review/garment-estimates-{phone,tablet,desktop}-{en,ta}.png`.
- One batched inspection of those six captures found readable layouts and
  wrapping. Final self-review identified a missing comparison detail: non-rate
  source changes had only a stale warning. The single final UI fix batch adds
  old/current order, design, booking and package revision comparisons, accepted
  prices and rate bases, using the frozen predecessor source. A first estimate
  explicitly shows unknown previous values. This is visual automation review,
  not fluent Tamil, physical-device or screen-reader acceptance.
- The second earlier browser run exposed incorrect uncertain-response copy
  (`ui-second.log`): the UI falsely combined outcome checking with review failure.
  It now reports outcome checking until recovery resolves it. The phone
  confirmation passed before the complete final three-size run.
- `node scripts/check-artifacts.mjs`: **exit 0**, including the new server-only
  estimator repository markers. Clean export/import verification above remains
  applicable: dependency/export/build configuration did not change afterward.
- Manual-host inspection exposed three garbled synthetic Tamil item labels.
  Corrected only that fixture, checked it with Biome, and restarted the host.
  This fixture-only correction preceded the final source-comparison fix above.

The T3 preview opened sign-in, but two snapshot attempts each returned
`Preview automation snapshot timed out after 15000ms.` The installed
agent-browser fallback used its own named session and private-file credentials;
the authenticated seeded editor opened successfully. No secret was printed or
committed. The final host checkpoint and supplementary regression results follow.

Intermediate synthetic host ready **11:57:00 UTC, 24 October 2026**:
**http://127.0.0.1:56227/orders?section=estimates&estimateDraft=14b0f682-5f4d-70a0-976d-a7e13e052da6**.
HTTP sign-in **200** and authenticated draft snapshot checked by **11:58:12 UTC**;
the corrected Tamil description and all three seeded item identities were visible.
Sign-in: `.scratch/garment-estimates-review-host/private.json` (local private file;
never commit/paste it). The separate inspection browser was closed; the review
web/database host was stopped for the final comparison build. Ports 58394, 64350
and 56227 are historical links. The current host is recorded below after the
final confirmation; use the stop command above when finished.

Supplementary regression checkpoint:

- `pnpm exec vitest run --config vitest.integration.config.ts
  tests/orders.integration.test.mjs tests/small-services.integration.test.mjs`:
  **exit 0, 23 passed / 332.31s** (`pg-regression.log`). These exercise the
  established source/acceptance/draft paths used by A2.
- After the comparison UI fix, `pnpm verify:fast` again passed lint, Knip and
  types, but stopped at **330 passed / 2 failed / 18.70s**: existing command
  canonicalization property and retired-route unit tests each hit their **5s**
  limit (`fast-source-compare.log`) while PostgreSQL regression work was active.
  No estimator assertion failed. Do not represent this aggregate as a pass.
- Diagnosed by running the full unchanged unit matrix with
  `pnpm exec vitest run --no-file-parallelism`: **332 passed / 71 files / 73.77s**
  (`unit-serial-final.log`). No timeout or repository worker configuration was
  changed. Negative fixtures, OpenAPI and production build were then run
  explicitly because the aggregate had stopped before those stages.

- Negative contract/client fixtures and OpenAPI: **exit 0**;
  production build: **exit 0, 12 successful tasks / 24.19s**
  (`negative-source-final.log`, `openapi-source-final.log`, `build-source-final.log`).
  Final artifact scan also **exit 0** (`artifacts-source-final.log`).
- Single final browser confirmation: **exit 0, 3 passed / 1.6m**
  (`ui-source-confirm.log`), now asserting the explicit source-comparison labels
  before Apply. Six refreshed English/Tamil captures inspected once; no further
  application changes. Earlier 1.3m run remains historical evidence.
- Money and accepted/grouped-order regression run: **44 passed / 2 fixture
  failures / 624.73s** (`pg-acceptance-money.log`). Both failures were in the
  pre-0031 reconstruction fixture: its fixed foreign-key inventory omitted the
  new estimate relation and the incumbent job-slip/material-label relations.
  Adding only the estimate relation still failed (**32.18s**, preserved in
  `pg-legacy-confirm.log`); inspecting the migration references identified the
  other two. The fixture now preserves and restores all **13** exact FK
  definitions, retaining its constraint-definition and function-body checks.
  No runtime migration, production integrity guard or domain check was weakened.
- Final affected legacy cases: **exit 0, 2 passed / 42 filtered / 31.36s**
  (`pg-legacy-final.log`). Together with the 44 unchanged passing cases above,
  all 46 money/custom/grouped-order cases have passing evidence. The original
  full-run failure remains recorded; it was not rerun wholesale.

Current final-build review host ready **12:04:47 UTC**, 24 October 2026:
**http://127.0.0.1:61960/orders?section=estimates&estimateDraft=9c8737fa-a6e4-72f5-9f94-54ec2986a226**.
HTTP **200** and the authenticated seeded editor were checked before
**12:06:58 UTC**. All three line identities and the Tamil label were visible.
Access is in the same ignored private file above; the inspection browser was
closed and the disposable web/database host remains running. Physical-device,
fluent Tamil, assistive-technology and owner acceptance remain pending.

Review-ready checkpoint: **12:07:50 UTC**. Runtime commit and draft PR/hosted CI
checkpoint are recorded after publication. No owner acceptance, merge or live
activation is inferred from the automated evidence.

Publication: runtime commit **b20b52f27065307cdfdb3476816ef7e1dbdfe740**,
[draft PR #178](https://github.com/nishanthturnstile/aarili/pull/178) to
`development`, created **12:08:21 UTC**. At **12:08:33 UTC**, Fast verification
and Dependency audit were **in progress**, started **12:08:26 UTC**, in
[run 40092699288](https://github.com/nishanthturnstile/aarili/actions/runs/40092699288).
Browser jobs were skipped under the development-PR workflow. This is a timed
publication observation, not a CI pass. This documentation-only follow-up leaves
the verified runtime unchanged; its subsequent CI, owner review and merge remain
pending. The PR is registered with the T3 thread.
