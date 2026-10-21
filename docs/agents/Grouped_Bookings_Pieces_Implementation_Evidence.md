# Outfit pieces A: implementation and owner-review evidence

19 October 2026. **#118 / 1.2.2a implemented for owner review.** This is A's
piece-aware Quick Order outcome; it does not complete grouped intake, actual
payments, measurements, production, custody or AC-63 handover.
[REA ledger](Grouped_Bookings_REA_Evidence.md),
[approved design/GB matrix](Grouped_Bookings_Design.md),
[approved tickets](Grouped_Bookings_Ticket_Packet.md).

## Approval, payment boundary and baseline

After reviewing the concrete A–C packet, the owner approved publication/proceeding
with A and clarified initial payment handling as **manual recording and owner
confirmation only** in the later payment slice. No payment gateway, automated UPI
collection/verification, bank integration or payment provider SDK is introduced.
Quote/package semantics do not become payments, allocations or revenue postings.
Production prices, rates, privacy/retention and pilot/live activation remain gated.

Published with the installed `to-tickets` skill as #118/#119/#120. Native blockers
were read back: #118 → #114/#99, #119 → #118/#114, #120 → #119/#114/#101. #118's
direct closing PRs #116/#105 were rechecked as merged; the inherited identity,
catalogue/form/presentation prerequisites are integrated. B/C wait for their
direct predecessor merges; this is not authorisation to merge A implicitly.

Fetched base **68d07ed**, equal to origin/development. Existing checkout,
`codex/outfit-pieces`, created after updating development. The six local planning
documents from the preceding authorised research session were preserved and are
included with this delivery, with their approval/status updates. No worktree,
stash, reset, unrelated edit, dependency/toolchain migration or production change.

## Behaviour and integrity review

- Existing Quick Order acceptance now creates one immutable piece-set provenance
  record, stable identities for applicable/unresolved pieces, and relational
  requirement scopes in the **same** acceptance/draft/idempotency/audit transaction.
  One salwar still creates one capacity demand; three physical pieces create no
  additional garment, quote, payment or capacity reservation.
- Scope resolves by section/stable key through the exact accepted definition.
  Measurement requirements resolve the exact pinned form and field key. Missing,
  ambiguous, foreign or unsupported source mappings fail closed. Labels, forms,
  instructions, default owner and dependency references are retained; no current
  catalogue regeneration or extra template/evaluation engine.
- Accepted order detail shows each piece, its form definition and unresolved work,
  alongside shared order requirements. Simple and Detailed preserve the same
  identities/data; Detailed reveals original source/dependency/instruction detail.
  No toggle marks work, material, measurements or a physical piece complete.
- Historical v1 orders remain exact read-only previews until an explicit reviewed
  `Prepare piece records` command. It requires order If-Match, snapshot digest,
  reason and actor/action/request-bound key. It appends provenance without editing
  order version, acceptance snapshot, original/current promise, price or demand.
  A unique `(shop, order)` set survives key expiry; concurrent exact requests replay
  one result, while a different command on an already materialised set conflicts.
- Every read, stale response and replay rechecks membership and current wearer/
  guardian service authority through the existing owner transaction. Shared
  payer/contact is not permission. Same-shop wrong-order piece links are also
  blocked by composite FKs, independently of cross-shop RLS.
- Lost-response recovery freezes the key/body/precondition, guards navigation and
  retries the same action. Known validation/conflict failures differ from unknown
  outcome. A recovered uncertain result rechecks current structural state. Piece
  responses validate their ETag against orderVersion. Sign-out/access generation
  invalidation clears browser memory; no business storage/cache/URL payload.

Framework-free core and existing transaction-bound repositories remain behind
thin Node Hono routes and typed browser clients. New read/materialise DTOs are
additive; v1 accepted order and price semantics remain intact. No business Server
Action, new package, payment/production/custody job or vendor contract was added.

`summarizePieceProgress` is a **pure future-fact projection**, tested with top-ready/
bottom-trial-correction input. No persisted execution command can supply those
facts in A, and no test hands over a physical top. It does not close AC-63.

## Migration, compatibility and recovery

Reviewed additive **0031_outfit_pieces.sql** creates `order_piece_set`,
`order_piece` and `order_requirement_scope`. Every row has non-null shop_id,
shop-led keys/indexes, tenant-composite source/order/requirement/piece FKs,
ENABLE/FORCE matching policies and app_user SELECT/INSERT only. Immutable guards
protect all three tables; source/provenance and deferred commit guards reject
wrong or incomplete sets, missing child rows and missing command results.
The forced-policy inventory and exact tenant-table lists were extended.

No automatic backfill or migration of accepted content. The populated upgrade
test retains valid v1 acceptance rows/snapshots/demand/drafts/audit, reconstructs
the old 0030 structural-schema boundary **inside a disposable test database**,
then applies the real migration runner and checks zero backfill/history changes.
The UI fixture separately removes only new acceptance-created synthetic structural
rows to represent a historical order; it refuses non-synthetic or independently
materialised records. These are test-support operations, not runtime endpoints,
live downgrade instructions or user-data deletion tools.

Use the existing advisory-lock migration runner; back up before non-disposable
schema application. Compatible application rollback retains additive tables and
history; disable unsupported acceptance/materialisation writes rather than
creating incomplete records. Old readers can still read v1 accepted snapshots.
Restore epoch/quarantine, money freeze, kill switch, audited privacy erasure and
live-data gates remain unchanged. No live restore or live customer data was used.

## Verification ledger

Native Windows, explicitly selected existing Node **24.21.0**, pnpm **12.11.2**,
disposable real PostgreSQL **18.6** through Testcontainers/Docker Desktop. Runtime
queries use app_user; admin credentials are limited to synthetic fixture setup,
fault injection and catalog verification. Context7 resolved/fetched Drizzle RLS/
composite FK and React async-effect cleanup documentation; read installed Next
client-boundary and Turbo task documentation. No library upgrade was adopted.

- Initial package build passed 10/10; the first real accepted-order regression
  passed 1/1. Strict types passed 23/23 tasks. Initial formatting exposed a misplaced
  local state declaration and an unused effect dependency; both were corrected.
  No assertion or policy was weakened. Later test-only non-null warnings were
  replaced with explicit fixture assertions.
- Initial GB PostgreSQL cases: **3/3**, 30.13s. Full affected integration command
  `pnpm exec vitest run --config vitest.integration.config.ts
  tests/order-acceptance.integration.test.mjs tests/tenant-isolation.integration.test.mjs
  tests/owner-bootstrap.integration.test.mjs tests/orders.integration.test.mjs`
  passed **44/44 across four files**, **381.28s**. Covers exact scopes, source history,
  populated upgrade, actual-write rollback, duplicate/key-expiry protection,
  wrong-order piece FK, guardian withdrawal race, forced RLS/pooling/grants and
  existing acceptance/draft/bootstrap regressions. Log `pg-complete.log`.
- Final lookup tightening verifies a measurement field exists in its exact form,
  and the typed client verifies piece-response ETags. Affected PostgreSQL follow-up
  `... tests/order-acceptance.integration.test.mjs -t 'GB-|accepted order exact snapshots'`
  passed **5/5**, 17 unselected cases skipped, **61.02s**. Log `pg-final.log`.
  Unchanged broader integration inputs reuse the 44-case result; it is not a
  second full run after the refinement.
- Final `VITEST_MAX_WORKERS=4 pnpm verify:fast` passed lint/boundaries/tokens,
  Knip, strict types, **55 files / 238 unit/property tests** (**18.75s**), negative
  DTO/UI checks, **72-path OpenAPI** and **12/12 production build** (**15.769s**).
  Four workers reuse the recorded resource-concurrency convention without changing
  test timeouts. Log `.scratch/grouped-bookings/fast-final.log`.
- Initial new phone browser flow passed **1/1**, **48.8s**, including a successful
  response deliberately dropped after commit, exact-envelope retry, stale review,
  reload, Tamil/English × light/dark axe/reflow and cross-tab sign-out. Final
  new/existing Quick Order suite passed **6/6**, **2.6m** across phone, tablet
  and desktop. Log `ui-final.log`. A final desktop-only follow-up uses the exact
  requested **1440 ? 900** viewport and passed **1/1**, **28.5s**
  (`ui-desktop-final.log`). Affected test formatting/lint also passed.
- Impeccable detector on the two changed UI modules returned **[]**, exit 0.
  Representative automated Tamil phone capture and live desktop 1440 ? 900
  viewport were inspected; full-element captures
  include the incumbent fixed navigation at the browser's scroll position. Live
  viewport review supplies layout evidence; screenshots are not physical-device
  or fluent-Tamil acceptance.

Logs/captures remain ignored under `.scratch/grouped-bookings/`. Tested source is
base 68d07ed plus this delivery's capability/test files; the final source manifest
is recorded in the [verified source manifest](Grouped_Bookings_Pieces_Verified_Files.sha256). Documentation edits alone do not invalidate
unchanged application tests.

Not claimed: complete 1.2.2/AC-01, actual AC-63 handover, payment recording or
gateway/UPI integration, measurement entry, production/custody execution, new PDF
templates, full promotion `pnpm verify`/entire browser suite, physical Android,
fluent Tamil/AT, search-recall/pilot privacy/restore or live readiness. Feature PR
needs Fast verification and Dependency audit; full scaffold/browser gates remain
on promotion. No package export/dependency/runtime graph changed, so no extra
clean-install/platform migration check was introduced solely for this slice.

## Acceptance mapping

| GB check | A disposition and evidence |
| --- | --- |
| GB-01 | B/C pending. A preserves one independently identified Quick Order and does not create a booking. |
| GB-02 | Three pinned pieces, each exact form/scope and visible unresolved work: PostgreSQL, pure projection and new browser journey. Real readiness/correction/handover execution remains later. |
| GB-03 | B/C package basis pending. A leaves v1 quote amount/unknown/zero and snapshots unchanged; zero journal/payment effects. |
| GB-04 | New single-outfit acceptance retains one demand; historical materialisation retains demand unchanged. Grouping accepted orders remains B. |
| GB-05 | Real app_user/missing context/two-shop/pooling/FK checks and minor guardian withdrawal race; reads and exact replay denied after withdrawal. No measurement/photo consent grant is fabricated. |
| GB-06 | Concurrent exact materialisation, durable uniqueness after key expiry, changed request 422, missing 428, stale 412, domain 409, and actual-write rollback for every new table/audit/key. Existing acceptance rollback also includes new piece stages. |
| GB-07 | A adds no new intake/draft workflow. Existing Quick Order regression remains; historical preparation has exact lost-response recovery and protected dirty navigation. Group drafts remain B/C. |
| GB-08 | Snapshot/digest/promise preservation after source rename and presentation switches; explicit historical materialisation/provenance; unit/property canonical scope equality. |
| GB-09 | Automated English/Tamil, themes, keyboard/axe/reflow, screen sizes and cross-tab clearing; human language/device/AT review remains pending. |
| GB-10 | No runtime measurement/payment/production/custody/handover command or job. Pure future status input is explicitly labelled and cannot satisfy full AC-63. |

Documentation QA validates UTF-8, relative links, GB-01?10, three vertical tickets
and actual retained REA IDs; final command output is retained in the transcript.
Source manifest contains 26 capability/test files. No credential or capture is committed.

## Running owner-review packet

First review host observed ready **22:28:05 IST**,
**http://127.0.0.1:52793/orders**. It is loopback-only, synthetic and disposable;
T3 preview was privately signed in via ordinary owner authentication and opened
the retained order. It is not a deployment or a public demo.

Startup, if the host has been stopped: select the pinned Node/pnpm runtime, run
`pnpm build:packages`, `pnpm --filter @aarili/web build`, then
`node scripts/review-quick-orders.mjs pieces`. Read its actual ready URL because
the port changes. Private generated access is in
`.scratch/outfit-pieces-review-host/private.json`; do not paste it into Git/chat.

1. Open **QO-000001**, synthetic historical salwar. Expect top, bottom and dupatta,
   exact form labels, unresolved bottom material/stitch requirements, shared
   prerequisites, original promise **2026-11-18**, quoted zero and the historical
   preview notice. Nothing is ready or handed over. (GB-02/04/08/10)
2. Choose Prepare piece records; enter a synthetic review reason. Cancel once:
   expect no change. Prepare again and confirm: expect history and the same
   pieces, promise and price. Reload: the historical-preview action stays gone
   and no duplicate garment appears. Automated tests cover lost-response and
   concurrency; the owner need not replay terminal fault injection. (GB-06/08)
3. Switch Simple/Detailed and English/Tamil, including phone/tablet/desktop and
   enlarged text. Bottom unresolved work remains visible; source/form and
   dependency detail survives. Check wording, keyboard/focus and the owner's
   actual Android/AT where available. (GB-02/08/09)
4. Back to orders; resume the synthetic incomplete intake or make a new Quick
   Order. New acceptance creates its piece identities atomically and retains one
   garment's demand. Actual payment, production and handover actions remain later.
   (GB-04/07/10)

Report `GB ID — pass/fail — observation`, with device/browser and fluent-Tamil/AT
notes where actually reviewed. Human findings and owner merge authorisation remain
pending, separate from automated verification. Stop with
`node scripts/review-quick-orders.mjs pieces stop`; this removes private access and
the fixture's own temporary web/database resources. No other checkout or service
is cleaned up implicitly.

## Publication and review state

Draft [PR #121](https://github.com/nishanthturnstile/aarili/pull/121) targets
`development`, created **19 October 2026, 22:35:04 IST**. Capability commit
`cd15d4d` matches the committed source manifest. At **22:35:12 IST**, hosted
Fast verification and Dependency audit were queued; promotion-only scaffold/
browser jobs were correctly skipped. [Hosted run](https://github.com/nishanthturnstile/aarili/actions/runs/39291091095).
No hosted success, owner acceptance, merge or deployment is claimed. The PR was
immediately registered with this thread; B/C remain blocked on direct merges.
