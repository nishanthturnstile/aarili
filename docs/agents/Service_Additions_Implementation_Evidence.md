# Service additions — 1.2.3b / issue #125

Status: implemented and locally verified; prepared for owner review. Merge/deployment not authorised.
Selected by the owner on 20 October 2026. Branch `codex/service-order-addons`
starts at development `21a5e79` after #124/#120 merged. #127 merged at
2026-10-20 14:15:17 UTC; prerequisite Fast verification and Dependency audit
were successful. No worktree, dependency, package-export or toolchain change.

## Approved design and evidence

This implements the approved [B ticket and D2/D4/D6 decisions](Small_Service_Ticket_Packet.md)
and [independent design](Small_Service_Design.md), using product ORD-14/02/03/12/13,
SET-08/11, TRU-01/03/05/06/12/13, FIN-03/04 intake and USE-03/08/09.
Applicable scenarios: AC-01/07/40/50 intake/53/55/60/63; architecture §§6–11/15.
The [REA ledger](Small_Service_REA_Evidence.md) retains actual Evidence IDs and
separates observations, inferences and unknowns. This ticket reuses that evidence;
it makes no new competitor-persistence or Nool alteration-execution claim. No
competitor code, APK or unapproved production values were introduced.

- `order.service-change` is a durable, exact-target workflow. It pins original
  digest, current aggregate version and supplemental-scope digest, exact profile
  and catalogue sources, native garment/piece identity, original promise,
  booking membership/revision and immutable commercial proposal. A new reason,
  agreement and exact review acknowledgement are required. Target identity cannot
  be moved by editing an existing draft. Missing draft precondition is 428;
  stale aggregate or draft is 412; changed review/domain conflict is 409.
- Append-only supplemental revisions retain separately priced stable lines,
  selected requirements, scope links, reviewed capacity basis and audit provenance.
  Original snapshots, prices, requirements, promises, group commercial versions,
  native pieces and membership source history are unchanged. Lines remain
  independently `pending` or explicitly `not-required`; completion is #126.
- Canonical catalogue identity plus native piece scope prevents adding the same
  source through another profile, key or expired request record. Unknown prices
  remain unknown. Current garment totals add supplemental charges once. Package
  proposals keep their frozen base and show explicit outside-package extras;
  included/reference amounts are never allocated or treated as extra charges.
  The supplemental and booking current-scope queries serialize cumulative paise
  as exact decimal strings, including sums beyond Number.MAX_SAFE_INTEGER.
  Booking reads expose known subtotal and unknown-price count independently;
  they do not reinterpret the original strict booking DTO.
- Positive capacity contributions use the existing canonical category/unit and
  unchanged promise. Shared accepted-demand reads union each contribution once.
  An explicitly reviewed already-covered basis links the base garment demand,
  retains its reason and records zero additional demand without a positive row.
  Unknown/incompatible mapping, category changes, ambiguous commercial basis,
  repricing/removal, date changes and package-included additions remain blocked.
- `order.services-intake` is a separate v1 workflow. Explicit conversion from old
  Quick Order or grouped intake closes the source atomically, retains its exact
  raw payload as immutable provenance, preserves stable garment IDs and clears
  reviews. Old DTOs/readers and the existing Quick → grouped conversion remain
  supported. Whole-set review includes all base demand and selected additions;
  base acceptance, booking, commercial scope and supplemental records commit
  together or all roll back.
- Order, booking, identity, publication and capacity lock classes are reused.
  Recovery-list preparation takes all relevant aggregate locks before identity
  locks, preventing a mixed page from inverting the scope-read lock order.
  Accepted changes share the order version with presentation and membership
  checks; a newly observed membership or changed booking revision invalidates
  the old agreement. Save conflicts still require explicit draft comparison.
  A target-stale promotion retains the current saved draft for explicit refresh
  and a fresh review; no business values are automatically merged.
  A competing saved draft shows readable fields and explicit whole-input choices;
  it does not show the accepted-target refresh action. Review/accept remain
  disabled until that saved-draft conflict is resolved.

## Acceptance matrix

| Issue outcome / requirement | Implementation and evidence |
| --- | --- |
| Selected custom/group services and explicit conversion — SS-03/13, D6, AC-07/50 intake | Contracts and core adapters, immutable raw conversion; real-PG custom/group/package atomic acceptance test; old conversion recovery unit regression |
| Exact accepted target and new agreement — SS-08/10, D4, ORD-14, AC-55/60 | Version/digests/native scope, reason/agreement, membership and commercial review binding; missing/stale/conflict and actor/key request binding |
| Append-only changes and independent lines — SS-02/03/07/08, ORD-02/03/12/13, TRU-12 | New revision/line/requirement snapshots, canonical source uniqueness and same-order/tenant FKs; original/current history and independent pending states |
| Exact price and package semantics — SS-03/08/13, FIN-03/04 intake | Unknown/zero independent prices, exact bigint sum checks, garment total once, frozen package plus outside extras; no allocation/payment |
| Reviewed mapping without duplicate demand — SS-09, D2, SET-08/11 | Shared evaluator and union demand reader, grouped coverage once, explicit covered evidence and zero contribution; source/mapping stale checks |
| Tenant/guardian authority — SS-05/11, TRU-01/03/05/06/13, AC-40/53 | Owner transaction, FORCE RLS, composite source links, current permission rechecks on history/save/promotion/replay; real-PG withdrawal and foreign-scope negatives |
| Concurrency, rollback, retry — SS-10/11, AC-55/60 | Actual line-write failure rollback, independent-addition and presentation races, first-membership race, expired-key protection, conversion request binding and lost-result recovery |
| Upgrade and rollback — SS-07/13, architecture §§8/12/15 | Populated pre-0035 A/custom/group/package fixture remains byte-exact after migration; no backfill or destructive rollback |
| Language/responsive/recovery — SS-12, USE-03/08/09 | Shared controls/draft engine and bilingual catalogues; three-size Playwright/axe/theme/IME/reload/conflict/capture evidence recorded below |
| Later lifecycle boundaries — SS-06/14, AC-50 partial | No money, receipt/custody movement, production execution, trials/quality, ready/handed-over/closed or automatic task completion |

## Migration and recovery

`0035_service_order_addons.sql` is expand-only. Four tenant tables are FORCE RLS,
shop-led and append-only, with composite tenant/same-order source references and
durable origin/canonical source uniqueness. Deferred guards require promoted
origin, exact line provenance, requirements, audit, idempotency and matching
positive demand; covered work cannot acquire a positive demand row. The existing
aggregate guard gets a narrowly checked supplemental-version branch. Pure
workflow adapters extend acceptance/booking guards without rewriting old DTOs or
historical migration files; migration fails if a predecessor function shape differs.

Back up before any non-disposable schema change. Compatible application rollback
must retain the schema, immutable histories and contribution-aware demand reader,
and gate unsupported new writes/readers. Never subtract demand by deleting history,
replay a conversion under a new identity, run destructive down SQL, or use
`drizzle-kit push`. Production/live-data/pilot/restore/privacy gates stay closed.
The historical reader adapter exists only in disposable populated-upgrade tests;
it is restored before migration and every post-upgrade assertion. Runtime has no
missing-table fallback.

## Verification ledger

Native Windows; Node 24.21.0, pnpm 12.11.2; real disposable PostgreSQL 18 fixtures.
Logs are private under `.scratch/service-addons-*`; screenshots/manifests under
`.impeccable/review/service-additions-*`. Fresh final source hashes and results
are added after checks finish. Historical results are not represented as fresh.

- Initial accepted vertical passed; custom/group conversion/package vertical
  passed. Broad small-services + draft integration: 17 passed / 1 failed,
  306.33s. The failure expected 409 while sending an obsolete draft ETag and
  correctly received 412; the corrected check uses the current closed draft
  version to prove the expired-key lifecycle conflict. Focused fault/race and
  mixed read follow-up: 1 passed, 37.88s.
- Final B/guardian/upgrade PostgreSQL: 6 passed, 200.24s
  (`pnpm exec vitest run --config vitest.integration.config.ts
  tests/small-services.integration.test.mjs -t 'SS-B|guardian'`). This
  includes exact large sums, booking totals, unknown counts, capacity/membership
  races and mixed-list lock preparation. Source inputs predate this run.
  A later focused independent-state assertion passed (1 test, 13.53s): one line
  remains pending while another is explicitly not-required; the latter cannot
  retain a quoted charge or affect the exact total. Its initial fixture retained
  a price and correctly received `notRequiredPrice`; that rejection is now an
  explicit negative assertion before clearing the declined line's quote.
- Custom/group acceptance and tenant isolation regression: 48 passed / 2 failed,
  782.57s. The two genuine historical upgrade fixtures needed their empty new
  composite FKs captured, detached and restored alongside the existing A FK.
  No runtime fallback or CASCADE was introduced. Corrected historical tests:
  2 passed, 37.94s; unchanged other 48 results are retained. Owner-bootstrap
  isolation inventory: 1 passed, 17.53s.
- First phone run exposed overflow from missing shared editor styling. The next
  run exposed a mixed recovery/scope lock inversion (scope request 503). Shared
  aggregate preparation and explicit field/button sizing corrected these causes.
  Phone EN/TA and both themes then passed, including lost-result retry and draft
  conversion: 1 workflow, 5.5m. The final workflow additionally covers target
  conflict recovery and uses one language flow with both theme captures rather
  than duplicating business mutations for a theme change.
  Extended workflow attempts exposed an async target-refresh/save timing race,
  corrected by disabling review while refresh saves; admission retries now
  respect actual `Retry-After` without disabling the limiter. A conversion test
  checked visibility before the saved grouped draft had loaded; it now waits
  for the conversion control before its bounded action/retry sequence.
- First fast verification stopped at unit tests: the old conversion mock received
  an extra undefined argument, and a pre-existing request-JSON property test
  exceeded 5s during overlapping heavy suites. Original three-argument transport
  shape restored; focused command/group/recovery units: 31 passed, 4.91s.
  `pnpm verify:fast` before the last UI refinement: exit 0, 83.11s; all lint/boundary/token, Knip, strict
  type, negative DTO/UI and OpenAPI checks passed; 260 unit tests in 58 files
  passed (9.07s), production build 12/12 successful (16.542s). No timing budget
  or test timeout changed. `pnpm audit --audit-level low`: exit 0, 1.32s,
  no known vulnerabilities.
- Final `pnpm verify:fast` after the last copy/conflict refinement: exit 0,
  **123.338s**; 260 unit tests / 58 files passed (11.92s), production build
  12/12 successful (17.634s), lint/boundaries/tokens, Knip, strict types,
  negative DTO/UI and OpenAPI passed. No dependencies or runtime inputs changed.
- After the finish-review textarea correction, final `pnpm verify:fast` again
  exited 0 in **89.971s**: 260 units / 58 files (11.81s), all static/negative/API
  checks, and production build 12/12 (15.916s). This is the final capability source.
- Main browser command `node scripts/test-ui.mjs service-additions.spec.mjs
  --max-failures=1`: **3 passed, 14.5m**. EN/TA, both themes, 360×800,
  820×1180, 1440×900 and tablet landscape, IME, keyboard conversion, recovery,
  explicit target/draft conflicts, lost-result replay, unchanged originals,
  separate pending lines, reload and axe/storage checks passed.
- Final focused competing-draft checks after the control refinement:
  `node scripts/test-ui.mjs service-conflicts.spec.mjs --project=desktop`:
  1 passed / 42.3s; `--project=phone --project=tablet`: 2 passed / 1.1m.
  They prove readable comparison, no accepted-target refresh prompt during a
  saved-draft conflict, disabled review until explicit whole-input choice,
  exact saved local choice, unchanged accepted scope and axe in EN/TA/themes.
  An earlier desktop attempt timed out because its initial HTTP recovery snapshot
  omitted the newly seeded target; trace contained only the predecessor template,
  and PostgreSQL showed no blocked client sessions. The cause of that first
  snapshot omission was not established. The fixture now explicitly asserts
  authenticated HTTP visibility after setup and bounds each action at 15s;
  no runtime correction or timeout increase is attributed to that retry.
- The fresh finish reviewer returned **fix** for borderless new textareas. The
  existing booking textarea declarations now also select `.service-additions`
  textareas, including group notes and review exceptions; no new style values.
  The private repository-Playwright recapture script performed normal synthetic
  scoped review and explicit Quick/group conversion, without accepting another
  order or altering an original. **36 full-page captures with axe/overflow checks**
  cover review/conversion/group context across three sizes, EN/TA and both themes.
  Computed border/background/padding/minimum height/resize facts are retained in
  `.impeccable/review/service-additions-style-manifest.json`. Six additional native
  booking-summary viewport captures verify exact package/extra labels and reflow.
- Detector ran once on the changed UI/CSS and returned `[]`. Fresh finish review
  returned **ship** on its scored textarea correction, with no remaining finding;
  its original review had no other material fixes. Fresh documenter made no
  changes: the incumbent system remains authoritative. Pre-existing missing
  PRODUCT.md/DESIGN.md sidecars and old surface inventory were not repaired.
- [Source hashes](Service_Additions_Source_Hashes.json) bind 45 changed capability,
  migration, helper and verification source files to base `21a5e79`; canonical LF
  hashes permit checkout line-ending differences. Documentation/private captures
  are excluded. Main browser results are reused for unchanged behavior; the later
  conflict/control changes have the explicit focused and recapture evidence above.
- Dependencies/lockfile/exports/install/runtime packaging unchanged: no extra
  clean-install/Linux image gate was introduced. Required feature CI remains
  Fast verification and Dependency audit; promotion retains full scaffold/browser
  gates. No PDF template/model changed; existing PDF golden evidence is reused.

## Owner-review packet

Start after the production build: `node scripts/review-service-additions.mjs start`.
It uses disposable synthetic data, normal owner sign-in and real registered
commands. Private sign-in stays in ignored
`.scratch/service-additions-review-host/private.json`; never publish it.
Stop: `node scripts/review-service-additions.mjs stop`.

Final synthetic host: [Orders](http://127.0.0.1:63238/orders). Normal sign-in,
accepted scope and explicit group conversion were checked in the collaborative
browser initially at **2026-10-20 16:12:34–16:13:47 UTC**. The final rebuilt host
and normal sign-in were checked at **16:31:34 UTC**, then the clean final owner
scenario host at **16:48:14 UTC** after visual-only drafts were discarded with
their disposable host. This is temporary loopback access;
restart generates new scenario IDs and private access. Credentials remain in the
ignored private file above.

1. **SS-07/08/14:** Open [custom garment](http://127.0.0.1:63238/orders?order=01a15a36-2974-7932-8ae9-8a8621f77ec9) and expand Service change
   history. Original ₹1,000 and the original promise remain intact. Two separate
   ₹100/₹50 lines and a later unquoted covered line remain pending; the overall
   current total stays unknown. No receipt, payment or completion is recorded.
2. **SS-08/09/13:** In Bookings, open BK-000001 and BK-000002. The garment-price
   booking shows ₹2,000 original plus ₹150 extras. The package shows ₹1,800
   frozen base plus ₹150 outside it, current known amount ₹1,950; garment reference
   amounts are not added to that package. Open each garment to compare history.
3. **SS-09/10:** Open [unmapped draft](http://127.0.0.1:63238/orders?order=01a15a36-2bb7-7514-9521-6c2f89b1937f) or
   [unresolved package inclusion](http://127.0.0.1:63238/orders?order=01a15a36-2e4a-787a-afa5-c2b79e70c7b3), resume the saved
   service draft and review it. Confirmation stays blocked, with input retained.
4. **SS-10/13:** Open [Quick conversion](http://127.0.0.1:63238/orders?draft=05978b8c-e14b-7b56-9ec2-7efa2cb78ab8); explicitly continue
   with service add-ons, select a profile, edit requested work and reload. Resume
   exact saved input. The source is closed with immutable conversion provenance.
   A fresh grouped package conversion source is also seeded; its normal-command
   conversion was verified on the preceding host and in all three browser sizes.
5. **SS-12:** Repeat the meaningful review steps in Tamil and both themes on
   actual phone/tablet hardware. Check text enlargement, focus and a physical
   screen reader. Report `SS-ID — pass/fail — observation`, with device/browser
   and Tamil/AT details where relevant.

Review original/current scope on one custom garment, a two-garment contact booking
and a frozen package; two separately priced pending lines; an already-covered
zero increment; an unmapped blocked draft; explicit Quick/group conversion;
recovery after refresh/conflict and unchanged promise. Confirm no receipt,
custody, payment, completion or handover event was implied. Bilingual automated
accessibility is not a substitute for owner Tamil terminology, real phone/tablet,
physical assistive-technology or business-policy acceptance. Those owner
checks remain open. #126 is not selected or started; it still requires #125 merge.
