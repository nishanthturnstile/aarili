# Customer and wearer history — 1.2.4c / #136

21 October 2026. Owner selected #136 after merging A2 [PR #140](https://github.com/nishanthturnstile/aarili/pull/140).
Implemented on `codex/customer-history`; owner review, hosted CI and merge remain separate gates.
This is partial CUS-03 coverage; C1/C2 and future domain integrations remain gated.

## Authority and baseline

- Updated the existing clean checkout's `development` with a fast-forward to
  `9ee0e0cd3766645e3673add8d374f95e2a9dc3b6`, then created the focused branch.
  No worktree, live data, merge or deployment.
- Native blockers #135/#78/#79/#80 are closed. PRs #140/#81/#82/#83 are merged.
  #140 merged at 12:30:48Z; its Fast verification and Dependency audit passed
  in [run 39599571515](https://github.com/nishanthturnstile/aarili/actions/runs/39599571515).
- Product CUS-03, ORD-12, TRU-01/03/05/06/12 and USE-01/02/09;
  product §§5.2/7/9/13/24–25/27; architecture §§6/8/9/11/15.
  [Approved design and reuse/reset matrix](Repeat_Order_History_Design.md),
  [ticket B and RH inventory](Repeat_Order_History_Ticket_Packet.md), and
  [REA evidence](Repeat_Order_History_REA_Evidence.md) remain authoritative.
  No new competitor claims or copied implementation/assets are introduced.

## Implementation contract

- `customer-history` contracts/core/repository/API modules provide a read-only
  projection. The API is `POST /api/shops/{shopId}/customer-history`; identity,
  search and cursor are private request-body values. Query strings are rejected.
  Responses use private/no-store and no-referrer. Browser imports the typed
  module client; the API calls framework-free core through membership-checked
  `withOwnerHistory` / `withShop`. No new mutation, audit engine or history table.
- Core discovers relationship IDs without row locks, takes customer and sorted
  wearer authority locks, and re-reads current relationship/purpose/guardian
  eligibility before projection. Adult service grants must be currently eligible;
  minors require current verified guardian order authority. Measurement/photo
  purpose is separate and no body/media values are retrieved. A wearer-specific
  denial returns only an error. Customer scope filters inaccessible wearers
  before search, pagination or snippets. No total count is exposed.
- Canonical event identity is the existing audit ID. Accepted order, native piece
  set, booking/member/commercial revision, service addition and line transition
  rows enrich that event rather than generating duplicate rows. Draft creation
  is excluded; Resume drafts remains the draft discovery surface.
- Original customer/wearer identifiers, event/actor/time, source aggregate/version,
  applicable native piece/line IDs, reason/note and selected non-personal authority
  facts remain visible. Service completion is a line event, never delivered/paid/
  received inference. Repeat acceptance links to its authorised original source.
  Opening source detail uses existing A1/A2 review and fresh-draft workflows.
- Accepted snapshots deliberately did not store personal names. UI labels are
  explicitly current, with original IDs shown separately. Earlier authority events
  that did not record the originating contact have a null original contact,
  displayed as not recorded. Relationship events are attributed only through
  their exact relationship/version. There is no fabricated old name or actor name.
- Existing correction audit records describe submitted field groups, not before/
  after values or a field-by-field diff. UI says so and shows absent reasons as
  not recorded. C1 owns additional correction provenance. Authoritative purpose,
  decision, notice, age, guardian-verification and presentation metadata is read
  at the event's version, without copying personal audit payloads.
- Booking events are available only when every member is within the authorised
  selected scope. A single-wearer view does not expose a mixed-wearer booking's
  shared proposal. Source order history remains independently discoverable.
- Redacted service-line evidence is joined live and displayed as redacted, with
  no fallback to its old note. There is no new personal search/materialised store
  to erase or rebuild. General rights/retention activation remains its own gate.

## Pagination and search

Ordering is descending `(audit occurred_at, event kind, audit ID)`. Cursor position
retains PostgreSQL microseconds even though display dates use JavaScript instants.
The first query captures `pg_snapshot_xmin(pg_current_snapshot())` using
[PostgreSQL 18's documented transaction boundary](https://www.postgresql.org/docs/18/functions-info.html#FUNCTIONS-PG-SNAPSHOT): the oldest
active top-level transaction, or the next transaction boundary. Events must come
from transactions older than this watermark. This conservative committed prefix
also excludes subtransactions and late commits; recent committed events behind a
long-running transaction may wait until refresh. UI explains this tradeoff.
No exported snapshot, connection or transaction is retained between requests.

AES-256-GCM cursors use a purpose-derived server key, contain no personal values,
expire after one hour, and bind shop, actor, customer, selected wearer, query,
page size, current identity/authority versions and the shop privacy-audit generation.
A new audited redaction invalidates subsequent cursors so already displayed
personal evidence is cleared before another page is appended. Tampering is 422; changed
scope/filter/authority or expiry requires a fresh query (409), and revoked wearer
access is 404. The client clears prior results on failures, scope changes, owner
invalidation, focus re-entry and close, aborting and ignoring late responses.
No private cache, browser persistence, URL query or telemetry payload is added.

Search reuses `searchKeysV1` and stored Tamil/Latin/skeleton/alias/phone-ending keys,
plus literal inner-name matches, exact customer/order/event/subject IDs and catalogue labels. Same-phone
wearers remain separate IDs. Corrected names use current keys and explicitly
retained aliases; no automatic identity merge or new fuzzy threshold.
Enquiries, appointments, shared documents, money position, custody, actual designs,
measurements and fit are explicitly unavailable. Manual earlier-garment retrieval
contributes to MEA-10 only; no fit/body correction is inferred or applied.

## Migration and recovery

`0039_customer_history_indexes.sql` adds shop-led indexes on customer orders,
relationships, bookings, canonical audit ordering and revision/transition audit
joins. It rewrites no accepted snapshots, history, demand, identities or lineage.
All underlying tenant tables retain their existing composite references, forced
policies and restricted runtime grants. No new tenant inventory entry is needed;
the query path is added to the isolation-path inventory.

Only disposable synthetic databases are migrated here. Production schema
application remains reviewed, advisory-locked and backed up through the existing
deployment process. Compatible rollback disables the new reader/UI and retains
the indexes and all business records; no destructive down migration or event
reconstruction is required. Existing accepted-order/service readers remain usable.

## Validation ledger

Final local evidence on the pulled `9ee0e0c` base with the implementation dirty:

| Check | Result / boundary |
| --- | --- |
| `pnpm verify:fast` | Exit 0, **150.297s**; lint/boundaries/tokens, Knip, strict types, **266/266 units in 60 files (21.08s)**, negative declaration checks, OpenAPI and production build (**19.608s** task graph). |
| Final Tamil-copy correction | Affected `pnpm lint`, `pnpm typecheck` (**21.138s**) and `pnpm build` (**16.740s**) exited 0. Handoff lint/Knip also exited 0 after the review-host flag. |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/customer-history.integration.test.mjs` | **4/4 passed, 82.72s** on final query/policy inputs, including accepted A1/A2 lineage, version separation and redaction cursor invalidation. |
| Existing wearer/guardian PostgreSQL regressions | **10 passed** in the earlier combined **160.79s** packet. That packet had one feature recall failure; only changed history cases were rerun after its fix. This is not a single 14-case clean run. |
| `pnpm exec node scripts/test-ui.mjs customer-history.spec.mjs` | Exit 0, **3/3, 1.7m**: phone **29.0s**, tablet **29.8s**, desktop **27.1s**. Both languages/themes; customer/wearer scope, custom/service/booking source links, A1/A2 entry points, pagination, no-match, 409 clearing, axe, reflow and static-only PWA storage. |
| Screen sizes | **360×800, 820×1180, 1440×1000**; tablet **1180×820**, **200% text**, Tamil/dark. Ordinary review at **1440×900** and **360×800**. Emulation, not physical-device acceptance. |
| Design / source review | Impeccable detector **[]** across changed UI targets. Batched desktop/Tamil phone screenshots visually inspected; shared tokens, wrapping and progressive provenance disclosure retained. `git diff --check` clean. |
| Ordinary review host | UI sign-in, populated history, exact custom source/repeat navigation, 44px disclosure, English/Tamil dark, axe zero, reflow and private-storage absence passed through the repository Playwright path. No business mutation. |

New package exports triggered a focused clean-install/native-portability check:
`pnpm exec node .scratch/customer-history/verify-exports.mjs` exited 0 in a
disposable path containing spaces. Offline frozen install, all ten package builds
(**20.558s**) and all five new compiled public export imports passed. Root lockfile
bytes stayed identical; the ignored verification copy is retained. No dependencies,
toolchain or production packaging changed. Required hosted Linux Fast verification
and Dependency audit will run on the feature PR; no extra local Linux image was
required. The full `pnpm verify`, `pnpm verify:clean`, full browser/PDF/smoke suites
were not run for this read slice; promotion retains those complete gates.

Earlier development failures are retained in ignored local logs.

| Acceptance | Fresh proof / remaining boundary |
| --- | --- |
| RH-07 | Distinct same-phone wearers, wearer-only versus customer scope, current adult grant, pending/confirmed/withdrawn guardian authority, revoked access between pages and deterministic read/withdrawal locking. No consent transfer or private body/media read. |
| RH-08 | Real app_user queries, forced-policy inventory, missing context, wrong customer/shop/membership/origin, private POST-only filtering, authenticated scope/filter cursors, tampering and current authority races. No mocks used as RLS proof. |
| RH-12 | Cross-domain canonical audit deduplication, actor/time/reason and unknown reasons, original IDs/current labels, exact source/version/piece/line references, accepted A1/A2 lineage, search, insertion/late-commit pagination and refresh after correction. Both UI languages and three sizes. |
| RH-14 | Populated 0038→0039 upgrade preserves snapshot bytes; additive shop-led indexes only. Existing custom/service readers and source links work; disabling this reader retains business history. No destructive down migration. |
| RH-15 | Audited service-note redaction hides old content and invalidates old cursors; denial exposes only an error; no private URL/search/storage/cache payload. Privacy wording/retention/erasure and pilot activation remain their own gates. |

Synthetic recall fixtures expect Tamil `மீனா`, Tanglish `meenaa`, English `Meena`,
exact order code/ID to retrieve an accepted order; phone ending `0707` retrieves
both distinct wearer-bound orders, while inner-name `kavya` excludes the other
wearer's work. No-match yields no events. This is fixture recall, not the consented/
anonymised 200-name pilot corpus or architecture §9.1's top-five 95% gate.

Final bounded measurement: **243 audit rows, 8 accepted orders**, including **120
actual presentation commands**, Windows / Node **24.21.0**, disposable Docker
PostgreSQL **18.6**. Repository page plus EXPLAIN ANALYZE/BUFFERS and the subsequent
read took **129.412ms**; plan **28.415ms**, SQL execution **47.802ms**, 25 events.
These are single observed timings, not end-to-end latency, percentiles or a pass
threshold. Raw synthetic plan and logs stay under `.scratch/customer-history/`.
No production query-load claim or invented business performance threshold.

- First integration development run: three fixture failures (wrong DB adapter
  passed to the policy inventory, reused subject/line IDs, wrong withdrawal enum).
- Second run: wrong custom read route, bypassed presentation command omitted its
  required idempotency result, and wearer revocation was asserted against a
  wearer-optional service. Fixed fixtures use real commands and wearer-bound work.
- Intermediate PostgreSQL run: **3/3 passed, 108.53s** before final attribution/
  authority-fact/scope metadata additions. This is not final verification.
- Expanded identity/guardian packet: 13 passed / 1 failed, 190.88s. The new
  phone-ending check exposed a missing second argument to searchKeysV1; fixed
  numeric queries to use phone normalization. Next packet: 13 passed / 1 failed,
  160.79s, finding a longer display-name recall gap. Literal inner-name/key
  matching fixes this without a fuzzy threshold. Subsequent four history
  scenarios passed, 65.40s, before final privacy/source-version additions.
- Initial phone browser run failed on a Tamil assertion after full navigation:
  the established shell restarts in English. The test now explicitly selects
  Tamil on each destination, preserving that existing product behaviour.
  Then all three sizes passed (2.0m total), including both languages, axe, source
  links, scope clearing and tablet landscape/200% text. Final changed metadata
  inputs are rechecked separately.
- Final self-review separated service-line versions from parent-order versions,
  uses accepted repeat snapshots for reviewed source versions, and binds cursor
  validity to audited privacy changes. New assertions cover these obligations.
- First build caught a moved triple-slash declaration reference and a non-exported
  guardian import. Restored the declaration's position and used the existing
  wearer export. Boundary check caught a generic arrow parsed as JSX; changed to
  the established named auth-context function. No baseline/dependency changes.
- The global pnpm wrapper waited on an NVM trust prompt. Commands now use the
  already installed pinned Node 24.21.0/pnpm 12.11.2 path; no global settings or
  tools were installed. Context7 was invoked through `npx.cmd` after PowerShell
  rejected its `.ps1` shim. PostgreSQL 18 snapshot/transaction documentation was
  resolved and fetched with the required two-step Context7 workflow.

## Manual review packet

The established disposable review host is extended with customer history.
After the production build, start `pnpm exec node scripts/review-repeat-services.mjs --history`.
It prints the exact customer profile URL and writes private synthetic access to
`.scratch/customer-history-review-host/private.json` (`historyUrl`, owner sign-in).
Never publish that file or its credentials. Running URL:
`http://127.0.0.1:51490/customers/01a15ea7-d14e-7767-9b7a-89169fd654fd`.
Observed ready **2026-10-21T13:30:56Z**; ordinary sign-in/review checks passed.
The lock prevents duplicate hosts. An abandoned A2 lock blocked the initial
default-directory start; the history flag selects its own fixed synthetic
directory and preserves earlier files. No global cleanup.
T3 preview navigated to sign-in but snapshot failed twice with
`Preview automation snapshot timed out after 15000ms.` Used the documented
Playwright fallback; this does not claim T3 inspection succeeded.

1. **RH-07/RH-12:** Open the customer profile, Browse history, then select a wearer
   using the existing distinct wearer controls. Compare selected-wearer and all
   authorised customer scopes. Confirm current names and original IDs are clear.
2. **RH-12:** Search Tamil/Tanglish name, code or exact order ID. Load older events,
   open Identity and revision evidence, and inspect actor/time/version, submitted
   groups, booking proposal and service events. Missing reasons/old names stay
   explicitly unknown. Inspect the unavailable-domain explanation.
3. **RH-07/RH-12:** Open custom and service source links and inspect the existing
   repeat controls. Reusable details remain reviewable inputs; fresh pricing and
   delivery belong to the existing new-draft flow. Original records stay intact.
4. **RH-12/RH-15:** Change language/theme, use keyboard/disclosures and phone/tablet
   layouts. Leave/re-enter the window and refresh; stale history clears and current
   access is checked. Review Tamil wrapping and the redaction/permission language.

Report `RH-07 / RH-12 / RH-15 — pass/fail — observation` with actual device/browser
and fluent Tamil or assistive-technology observations where applicable.
Physical Android, fluent Tamil and screen-reader acceptance remain pending unless
separately reported. Automation/emulation does not replace these observations.
Stop with `pnpm exec node scripts/review-repeat-services.mjs stop --history`; the host removes
private access, its lock and disposable database. No tunnel/production activation.
