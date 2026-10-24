# #175 / 1.4.1c — reviewed unissued booking proposals

24 October 2026. Owner selected #175 after merges. Existing checkout was clean;
pulled development to **df5f3265c719afe38e1613a2c9144befd4ea7a33** and created
`codex/booking-quotations-b`. No worktree or live activation. Admission checkpoint
**12:25:50 UTC**. Blockers: #174→PR178, #119→122, #120→123, #33→39; closed,
merged and in development ancestry. PR178 merged **12:24:46 UTC**; required Fast
verification/Dependency audit passed in run 40092740832. No comments on #175.

Sources: approved [quotation design](Quotations_Design.md),
[ticket packet](Quotations_Ticket_Packet.md), product FIN-02/03/04/05 and
architecture §§6–11/15. No new vendor observation or business-policy default.

Discount decisions reuse the exact current A1 discount binding, its numerical
maximum, owner authority and unchanged bilingual policy terms. The owner must
explicitly review eligible charge identities, stacking and manual attribution
against those terms for each proposal. This finite, versioned proposal decision
is not a new shop policy or a prose-parsing engine; omitted decisions block a
positive discount. No unreviewed synthetic policy becomes production authority.

## Delivered boundary

Orders now supports recoverable `pricing.quotation` drafts, explicit source
comparison, exact discounts and immutable **unissued** proposal versions.
Package-covered garments remain priced references; accepted outside additions
and standalone services are charged once. Optional frozen A2 estimates replace
their corresponding sources. Unknown selling amounts remain unknown and block
reviewed versions. Unfinished numeric text remains saveable in raw drafts.

Integer-paise utilities calculate line then booking discounts. FIN-05 allocates
whole-rupee floors and sends all remaining rupees/paise to the largest charge,
earliest on ties. Over-cap proposals fail; explicit manual shares require exact
reconciliation and authority. Package amounts without a reviewed net split are
visibly unattributed to individual garments. Optional native-piece splits are
references and never independent charges.

Private estimated costs have a separate table and strict owner projection.
Complimentary work retains its cost, customer materials do not acquire stock
charges, and actual cost remains unavailable. Customer responses use strict
allowlists. No quotation number, PDF job, agreement application, payment,
revenue, receivable, journal, stock, custody, production or capacity mutation is
created. #176 retains issuance and Tamil/A4 PDF checks.

Families use CAS and immutable origin links. Current selections serialize
overlapping order scopes, require exact predecessors and their full coverage;
alternatives preserve their own versions. Expired request-cache entries cannot
duplicate an origin. Reads authorize current access while preserving frozen
commercial history; changed sources are reported rather than rewritten.

## Migration and recovery

`0055_booking_quotations.sql` expands with six shop-scoped FORCE-RLS tables,
composite source foreign keys, immutable-history and deferred promotion guards.
Only family/current pointers are mutable. No backfill selects a proposal or
rewrites existing estimates/orders. Runtime remains `app_user` via membership
and transaction-local context. Draft result, audit, revision, private data and
selection commit together; injected late failure proves rollback and retry.
Deployment remains subject to reviewed migration/backup gates. Application
rollback may leave the additive schema in place; do not delete history or use a
destructive down migration.

## Fresh verification, 24 October 2026

Logs are local, outside Git: `%TEMP%/aarili-quotations-175-20261024/`.
Commands use the pinned Node 24.22.1 and existing pnpm toolchain.

| Check | Observed evidence |
| --- | --- |
| `pnpm verify:fast` | Final `fast-delivery.log`: exit 0; lint, Knip, typecheck, 337 tests / 72 files (17.79s), negative tests, OpenAPI and production build (18.091s). Includes the final raw-piece-text guard/assertion. |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/booking-quotations.integration.test.mjs tests/owner-bootstrap.integration.test.mjs` | `pg-final.log`: five passed, one failed, eleven filtered (185.86s). Failure was the newly added standalone fixture expecting a known price while seeding unknown prices. Corrected explicit synthetic prices; `pg-source-final.log` confirms the affected case passes (38.08s), including unchanged raw order/capacity rows. The five other passing cases were unchanged. |
| Focused concurrency/retention | `pg-concurrency-final.log`: two passed (89.03s), overlapping selection, family CAS, immutable-origin replay after request-cache expiry. |
| Incumbent order/service regressions | `pg-regressions.log`: eight passed (137.38s), including populated upgrade and reconstruction/failure guards. Existing FK inventory updated for the new exact source edge. |
| `pnpm exec playwright test tests/ui/booking-quotations.spec.mjs` | `ui-settled.log`: three passed, phone/tablet/desktop (5.2m), English/Tamil, axe, 320px reflow, IME, unknown selected estimate, fixed/booking discounts, private-cost exclusion, reload and original-key response-loss retries including real 429 Retry-After. |
| Clean exports | `pnpm exec node scripts/verify-booking-quotations-exports.mjs`: exit 0 (`clean-pnpm.log`), frozen install, ten package builds (49.066s), imports and unchanged lockfile. Later changes were module-local; final local build covers them. |
| Artifacts and presentation | `node scripts/check-artifacts.mjs`: exit 0 (`artifacts-delivery.log`). One scoped detector returned `[]`. One batch of six captures reviewed for wrapping, hierarchy and amount/reference visibility; no additional visual fix required. |

The browser run precedes only the final server-side raw-piece guard: it changes
validation for unfinished piece split text; the tested browser inputs contain
no piece splits, and the UI and dependencies are unchanged. Final fast checks
cover the resulting source. Whole promotion CI, physical Android, fluent Tamil,
assistive technology and owner acceptance are pending, not inferred passes.

Earlier failed attempts are retained: strict fixture shape/table assumptions;
Drizzle array interpolation corrected to a scalar JSON parameter after current
official Context7 docs; PL/pgSQL alias ambiguity and UPSERT predecessor guard;
standalone unknown-price fixture and capacity table ordering assumptions.
Browser failures exposed unknown-price save readiness, rate-limit feedback and
test synchronization races; corrected without relaxing quotas or integrity
guards. One earlier browser run was cancelled and its owned container cleaned;
the final three-project run completed. A wrong clean-check invocation failed
before install; the pnpm invocation passed. Optional empty-temp cleanup was
automatically rejected as “blocked by policy”; the directory was left alone.

## Acceptance map

| Ticket criterion | Evidence |
| --- | --- |
| B-01 | Pure canonical graph plus real PG package/garment-only/standalone cases; browser shows package 1800, two 1000 references and 100/50 outside extras. Gross 1950, discounts 150.01, net 1799.99. |
| B-02 | Duplicate/cycle/scope/unknown unit negatives; composite piece/source FKs; partial-package raw draft recoverable but review blocked. |
| B-03 | Exact fixed/bps unit properties, current policy source checks, explicit scoped decisions and stale-policy PG negative; bilingual browser calculation. |
| B-04 | 250 generated graphs (seed 175001), FIN-05 remainder, tie, cap/manual/zero-base assertions; booking and garment views use the same result. |
| B-05 | Separate frozen private lineage and shared-cost allocation; zero/unknown bases unattributed; strict customer poison-field tests and browser projection scan. |
| B-06 | PG overlapping-family and same-family races, exact predecessor coverage, replay after retention expiry; UI explicit rebase uses actual family current. |
| B-07 | Accepted versus proposed references and amounts visible; PG raw commercial/order/capacity snapshots unchanged, no posting; alternatives and frozen reads retained. |
| B-08 | Real PG forced RLS/missing context/foreign shop/current wearer denial, immutable admin update rejection, populated 0054→0055 upgrade, late rollback/retry; three-size bilingual recovery/axe. Human gates remain pending. |

## Owner review packet

Final synthetic host ready **13:48:15 UTC**, using the final production build:
[Open quotation review](http://127.0.0.1:60383/orders?section=quotations&quotationDraft=37294e9a-812e-7da0-84f4-877c94ed575c).
Sign-in is held privately in `.scratch/booking-quotations-review-host/private.json`;
never commit or paste that password. The host is loopback-only and temporary.
Earlier hosts at ports 55476 and the A2 session were stopped; their links are
historical. Stop this session with `node scripts/review-booking-quotations.mjs stop`.

Review the prefilled proposal: package references do not add to gross, total is
1799.99 after line 100 and booking 50.01 discounts. Open private costs (25.01),
then customer proposal review: no private cost appears. Switch booking/garment
views and inspect the explicitly unattributed package remainder. Try incomplete
text, save/reload, unknown estimate selection and source comparison. Save an
alternative version, reopen history, and inspect explicit current-selection and
conflict/rebase behavior. No issue/share/payment action exists here.

T3 preview snapshots twice failed with
`Preview automation snapshot timed out after 15000ms.` The documented browser
fallback is used for the final local session; this is separate from the passing
production browser suite. Human review should assess Tamil terminology,
keyboard/screen-reader flow and an actual Android device. This packet does not
assert those reviews have happened.

Authenticated fallback inspection of the final host confirmed both 1000.00
included references, accepted package 1800.00, proposed total 1799.99 and the
enabled “Save reviewed proposal” control. Snapshot retained outside Git as
`manual-final-snapshot.txt`; the inspection browser was closed, host retained.
Review-ready checkpoint: **13:50:12 UTC**. Active coding time is unknown.
