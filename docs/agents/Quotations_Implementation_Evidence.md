# Quotations — preparation and A1 verification evidence

**B follow-up, 24 October 2026:** A2 PR #178 merged at 12:24:46 UTC as
`df5f3265c719afe38e1613a2c9144befd4ea7a33`; required checks passed in
[run 40092740832](https://github.com/nishanthturnstile/aarili/actions/runs/40092740832).
Owner-selected B #175 now has [implementation and fresh verification evidence](Booking_Quotations_Implementation_175.md).
The preparation/A1 observations below retain their historical timestamps.
Issued documents and whole-feature acceptance remain pending C #176.

24 October 2026. **Owner approved publication and selected A1 #173. A1 delivery
and fresh checks are recorded below; whole 1.4.1 is not implemented or accepted.** [Brief](Quotations_REA_Prompt.md),
[research/access limits](Quotations_REA_Evidence.md),
[independent design](Quotations_Design.md),
[complete four-ticket packet](Quotations_Ticket_Packet.md).

**Merged follow-up, 24 October 2026:** A1 PR #177 merged at **10:49:47 UTC**
as `286c80b523e70b2579d32a8a022bf6a9399b827f`. Required Fast verification and
Dependency audit succeeded in [run 40078759286](https://github.com/nishanthturnstile/aarili/actions/runs/40078759286).
The publication-time pending observations below remain historical. The owner
then selected [A2 #174](Garment_Estimates_Implementation_174.md) from updated
development; whole 1.4.1 and pilot/human gates are not inferred complete.

## A1 #173 — implementation scope and review contract

The owner's subsequent **“approved and proceed”** approved QD-01–12 and the
concrete packet, publication of issues [#173](https://github.com/nishanthturnstile/aarili/issues/173),
[#174](https://github.com/nishanthturnstile/aarili/issues/174),
[#175](https://github.com/nishanthturnstile/aarili/issues/175),
[#176](https://github.com/nishanthturnstile/aarili/issues/176), and selected A1.
Native blockers were installed and read back for every issue. A1's direct
blockers #97/#87/#84/#16/#55 were closed and their merge commits were ancestors
of development before code changes. A2 cannot start before #173 merges.

Implementation started approximately **07:42:35 UTC, 24 October 2026**, from
development **941806755e9de0cb6fd8a0f204a8f54420dadb66** in the existing checkout,
branch `codex/quotation-rates-a1`. No worktree. Pending preparation documents
and the owner's roadmap/prompt were preserved byte-for-byte across the branch
switch. An initial switch was blocked by pending documentation; the empty topic
created by that failed command sequence was left untouched, then the correct
development-based branch was created before runtime work. No resets or stashes.

### Delivered behavior and integrity

- Settings → Rates saves incomplete raw prices/dates/units through the existing
  durable draft controller, including IME, uncertain outcomes and opaque draft
  URLs. Strict publication requires explicit source, component, unit, basis,
  dates, price and review reason. Blank stays unknown; deliberate zero is exact.
- Publication appends a schedule revision, relational periods and SHA-256 of
  PostgreSQL's canonical JSONB content, then advances a CAS pointer. Periods
  use Asia/Kolkata calendar dates and inclusive start/exclusive end. Overlap,
  backdating new prices, changing/removing past prices and identity/unit/basis
  changes fail. Prospective closure and gaps are explicit. Current, future and
  ended periods, unavailable sources and exact revision history are visible.
- Exact service-catalogue availability/definition and persisted shop-profile
  revisions are pinned. The catalogue/profile/rate lock order serializes source
  and schedule review. Disabled or replaced sources stop new resolution while
  old revisions remain readable; retirement can retain its disabled exact source.
- A quotation-only policy binding pins the saved owner proposal's draft version,
  canonical content hash, values, actor, reason and time. Editing its source
  makes the binding stale without rewriting it. This does not change old policy
  DTOs, fixture-only publication or unrelated readiness/action gates. Synthetic
  content remains synthetic-only; production rejects fixture adoption.
- `0053_quotation_rates.sql` expands four shop-scoped tables with composite
  source/draft/actor FKs, FORCE RLS, explicit read/write policies, immutable
  history/provenance and same-transaction completion guards. Only current rate
  pointer/version can update through validated publication. Revision, periods,
  draft result, idempotency and audit commit together. No schema/rate/policy seed,
  dependency, lockfile, journal, order, stock or custody mutation was added.
- Hono handlers only authorize/validate/map core operations. New module exports
  retain server/browser boundaries; no business data enters persistent browser
  storage, URLs or PWA caches. Failure copy distinguishes admission limits from
  rejected review; explicit retry preserves the original request envelope/key.

This is A1 configuration only. Estimates/private costs/customer-material rules
are #174; booking consolidation/exact discounts #175; immutable issued non-tax
quotations/Tamil A4 PDFs/manual sharing #176. No quotation, payment, revenue,
receivable, governed agreement or bill is created by this slice. Historical
prices and documents are untouched. No live policy/rate/privacy/pilot activation.

### Verification process and retained failures

Environment: native Windows, pinned Node **24.22.1**, pnpm **12.15.0**, TypeScript
**7.0.2**, real disposable PostgreSQL/Testcontainers and production web fixtures.
Logs are in `%TEMP%/aarili-quotations-20261024/`; synthetic credentials are kept
out of Git and chat. No new platform/package baseline was adopted. Current
Context7 documentation was resolved/fetched for Zod/Hono and PostgreSQL hash
functions; core money/date behavior reused existing utilities and source tests.

Initial checks caught and corrected ES2022-incompatible `toSorted`, placement
of the existing Bun declaration reference, a too-narrow test UUID inference,
use of an unavailable extension digest function (replaced with built-in SHA-256),
and a strict draft parser accidentally receiving a separate repository hash.
The first PG runs were **2 passed / 1 failed**, then **3 passed** after those fixes.

First browser run: **3 failed** because recovered-draft promotion did not refresh
the visible rate list. The second reached policy publication on all three sizes
but failed there. The follow-up captures the exact response and honors a bounded
429 Retry-After, preserving the key, without weakening command admission limits.
It also improves saved-draft/rejected-review copy and heading hierarchy.

The first expanded PG regression run was **20 passed / 1 failed, 371.17s**.
The failure was the bootstrap's exact inventory omitting **two already-merged
material-label tables**, not tenant leakage. Its inventory now includes those
and the four new tables. Affected A1 + bootstrap A5 confirmation was **5 passed /
11 filtered, 67.80s**. Explicit SELECT/INSERT/UPDATE policies follow the existing
bootstrap contract. A final run below covers the subsequent content-hash change.

Clean frozen installation/package build/new-export import check passed with
unchanged lockfile. Impeccable's scoped detector exited 0 with no findings;
the existing Aarili design system governs this Settings extension. Automated
checks and screenshots do not establish fluent Tamil or physical-device acceptance.

The subsequent browser key assertion reproduced a UI wiring defect: re-clicking
publication after known 429 rejection called `promote()` and generated a fresh
key, despite the controller retaining admission retry intent. The new surface
now exposes Retry and uses the controller's original retry operation for that
same review. No shared controller or admission policy was changed. The original
unknown-save retry already preserved its exact key/body; this adds admission
retry coverage for promotion. Final confirmation is recorded below.

After that UI-only change, `verify:fast` reached **324 passed / 2 failed** in its
unit stage: the existing canonical-JSON property test and configured-development
retired-route test each hit their unchanged 5s timeout. Fresh isolated execution
of both files passed **12 tests, 6.32s**. No timeout, seed or implementation was
changed. This aggregate failure is retained, not called green; the earlier full
fast run and subsequent affected checks are reported separately.

### Acceptance-to-evidence map

| Criterion | Automated evidence and remaining review |
| --- | --- |
| A1-01 / Q-01 | Strict vs draft contracts, 200 exact-paise property runs, real publication/history and browser incomplete-save/IME/reload. No business rates seeded. |
| A1-02 / Q-01 | Leap/year/half-open date tests, future/gap/overlap/backdate tests, exact date resolver, zero distinct from missing, incompatible basis rejection. Database completion guards reject overlapping periods. |
| A1-03 / Q-01/10/11 | Concurrent first identity and same-base replacement, original-key replay, source disable/retirement, old-byte/hash comparison, immutable history/pointer/late-child denial. |
| A1-04 / Q-07 | Exact proposal/version/hash binding, stale source invalidation, synthetic-only preservation, production fixture denial and unchanged old publisher/readiness; no unrelated activation. |
| A1-05 / Q-13 | Shared recovery controller's unit coverage for conflict/retry/IME/access loss plus new three-size workflow for unknown/raw draft, response loss, reload, exact publish/history and retained-key admission retry. Source conflict comparison is explicit; human usability/Tamil/device review remains pending. |
| A1-06 / Q-10/11 | Four new tables in forced-policy inventory; owner/missing/foreign/pool context; 428/412/409/422; post-write rate and policy audit rollback; zero journal count; populated 0052 upgrade retains source/profile bytes and seeds no configuration. Existing catalogue/policy regressions and bootstrap A5 included. |

No fresh quotation PDF golden is claimed: no quotation renderer exists in A1.
Full repository PG/browser/promotion matrices, real-device/Tamil/assistive review,
pilot and restore/live gates remain required at their applicable later frontier.
The populated upgrade and new-table isolation tests are real PG, not mocks.

### Manual acceptance session

**Current review URL:** `http://127.0.0.1:60245/settings?section=rates`.
The final-build host became available **08:31:58 UTC**, with HTTP 200 verified.
Its named-session fallback sign-in snapshot was verified **08:34:05 UTC**;
the session was closed afterward and the review host remains running.
The intermediate host at port 56311 was checked by HTTP and isolated agent-browser
sign-in snapshot **08:25:43 UTC**, then stopped for the final empty-history fix.
The first host at port 59494 (available **08:19:57 UTC**) was also stopped and
disposed before rebuilding; earlier credentials are no longer valid. Two T3 snapshots failed
with `Preview automation snapshot timed out after 15000ms.` before the installed
named-session fallback. No sign-in secret was printed or sent to the browser.

Use the synthetic loopback host described in the final verification checkpoint
below. Sign-in values are only in `.scratch/quotation-rates-review-host/private.json`.
Start/restart with pinned Node: `node scripts/review-quotation-rates.mjs` after
the production build. Stop with `node scripts/review-quotation-rates.mjs stop`;
the host removes its private access file and disposes its database/web process.
No tunnel, live provider, customer record or outbound message is involved.

1. **A1-01/05:** In Settings → Rates, create a synthetic blouse labour/item
   schedule. Leave price blank, type Tamil with IME, save and reload. Expect the
   same incomplete draft and disabled strict review. Enter `100.01`, basis `1`,
   today's start and a synthetic reason; explicitly review and publish.
2. **A1-02/03:** Inspect exact history/hash. Revise with an end-exclusive date
   and a future replacement period; verify current/future labels. Try overlap
   and observe retained draft with rejected review. Reopen the earlier version;
   its price/source/actor/hash remain unchanged.
3. **A1-04/06:** Open the saved synthetic quote-validity proposal, inspect both
   languages, acknowledge and record its quotation-only binding. Verify the
   synthetic label. Changing its source draft requires a new review; no payment,
   agreement, stock movement or bill becomes available from this action.
4. **A1-05:** Repeat language switching, keyboard/focus and narrow reflow on an
   actual Android device and with assistive technology. Report Tamil wording,
   target/focus issues and actual device/RAM/browser. Automated emulation is
   separate evidence; these human observations and owner merge review are pending.

Copyable report: `A1-01/02/03/04/05/06 — pass/fail — observation; device/browser/RAM; language`.

### Final automated checkpoint

All results below concern the staged A1 source on development base `9418067`;
the final UI-only admission-retry correction is explicitly distinguished from
the earlier full fast run. No fixture, timeout or admission limit was loosened.

| Command / log under the temporary evidence directory | Result |
| --- | --- |
| `pnpm verify:fast` / `a1-fast4.log` | Exit 0; lint, Knip, strict types, **326 unit passes**, negative types, **127 OpenAPI paths**, production build. Before the last UI-only retry handler correction. |
| `pnpm verify:fast` / `a1-fast5.log` | Latest aggregate: **324 pass / 2 existing 5s timeouts**, exit 1. Lint/Knip/typecheck completed first. Retained failure; not reported as a complete green run. |
| `pnpm exec vitest run tests/command.test.ts tests/runtime-cleanup.test.mjs` / `a1-timeout-diagnostic.log` | **12 passed / 6.32s**, exit 0, unchanged cases/limits. |
| `pnpm lint` / `a1-lint-final.log` | Exit 0, no new errors; **787 files**, 5 existing warnings/6 infos; **463** boundary sources, **101** UI sources, **8** static assets. |
| `pnpm test:negative`; `pnpm openapi`; `pnpm build` / final logs | Each exit 0 after retry correction; **127 paths**, **12 build tasks / 18.362s**. |
| `node scripts/check-artifacts.mjs` | Exit 0; **29** browser artifacts checked, new server markers absent. |
| `pnpm exec node scripts/verify-quotation-rates-exports.mjs` / `a1-clean-final.log` | Exit 0; fresh frozen install, all ten package builds (**32.194s** build stage), new server/client exports imported, lockfile unchanged. Later script edit corrects its comment/failure label only; Biome rechecked it. |
| `pnpm exec vitest run --config vitest.integration.config.ts tests/quotation-rates.integration.test.mjs tests/owner-bootstrap.integration.test.mjs -t 'A1-\|0.2.1a A5'` / `a1-pg-hash-final.log` | Exit 0; **5 passed / 11 filtered / 61.49s**, including content hashes, populated upgrade, real race/replay/rollback/source-disable and forced policies. |
| Catalogue/policy/bootstrap expanded regression / `a1-pg-final.log` | **20 passed / 1 inventory failure / 371.17s**; all catalogue/policy and other bootstrap cases passed. The affected A5 and complete A1 file were corrected/rechecked above. |

After the full three-size workflow passed **3 tests / 4.2m**, a single batched
visual review inspected all six English/light and Tamil/dark captures. Text,
wrapping, source provenance, buttons and phone/tablet/desktop navigation were
legible without clipped values or missing Tamil glyphs. It found one empty-state
gap: a policy with no recorded binding gave no result after History. The final
small UI batch adds an explicitly named history region and localized unconfigured
message. Its test opens both empty advance history and recorded quote-validity
history before the bilingual axe/reflow captures. Backend/migration inputs did
not change in this visual batch.

Fresh affected checks after that batch: `pnpm lint`, `pnpm knip`,
`pnpm typecheck` (**23 tasks / 24.804s**) and `pnpm build` (**12 tasks / 17.679s**)
all exited 0 (`a1-*-ui-final.log`). Browser artifact scan again checked **29**
artifacts. Earlier PG and clean-export evidence retain their backend/export scope;
no dependency, export metadata or backend source changed in the final UI batch.

**Final browser confirmation:** `node scripts/test-ui.mjs quotation-rates.spec.mjs`
(`a1-ui-confirm.log`) exited **0**, **3 passed / 4.2m**, at phone **360×800**,
tablet **820×1180**, desktop **1440×1000**, plus 320px reflow. Every case checks
English/light and Tamil/dark axe, raw unknown/IME/save loss/reload, exact rate
publication/history, exact policy binding, retained promotion key after 429,
empty and recorded policy histories, and static-only PWA storage. All six fresh
captures in `.impeccable/review/quotation-rates-{size}-{locale}.png` were inspected
together for the single confirmation pass; no further UI change was needed.
This is browser automation and visual inspection, not fluent-language or physical
device acceptance. Review-ready checkpoint: **08:36:02 UTC, 24 October 2026**.

### Publication checkpoint

Runtime/preparation commit **58b10b7e6524078e7b41603006b3220a5fdca6bf** was pushed
to `codex/quotation-rates-a1`. [Draft PR #177](https://github.com/nishanthturnstile/aarili/pull/177)
was created **08:36:39 UTC**, targeting `development`, and registered with this
T3 thread. At **08:36:46 UTC**, [run 40078714336](https://github.com/nishanthturnstile/aarili/actions/runs/40078714336)
had Fast verification and Dependency audit **in progress**, both started
**08:36:44 UTC**. Scaffold/full browser jobs were skipped under the development
PR workflow. These are pending hosted gates, not successful results. A following
documentation-only commit records this checkpoint; runtime verification inputs
remain unchanged. No merge, promotion, deployment or later-slice implementation.

No supplementary local Linux image was run: export/package changes were covered
by the scoped native clean frozen installation/import test. Hosted Linux Fast
verification and dependency audit remain PR gates; full promotion/browser matrix
is separate. No shared infrastructure, dependency versions or runtime packaging
configuration changed. The earlier full fast success does not erase later
timing failures or pending hosted results.

## Admission, workspace and integrated prerequisites

The preparation record below describes the earlier 06:54 UTC checkpoint.
The later A1 record supersedes its unpublished/unselected status, preserving
the original research boundaries and verification failures.

Preparation began approximately **06:54 UTC**. Existing checkout branch:
`codex/170-material-labels`, HEAD
`84b727e08d32052f16fa5af82d4b9a0bda2049e8`.
Initial unrelated files: nine added roadmap lines for the quotation REA brief,
and untracked `Quotations_REA_Prompt.md`. Both are preserved. This work adds four
preparation documents and a scoped roadmap cross-link; no code, package, lockfile,
SQL, old evidence or accepted record is changed. No branch switch, stash/reset,
worktree, commit, push, issue/PR publication, merge or deployment was performed.

Fresh `git fetch origin` found development
`941806755e9de0cb6fd8a0f204a8f54420dadb66` and main
`0f784206eca5b0d0bede91ab2be62de9b5afc77c`.
`git diff --quiet origin/development -- packages apps scripts tests` returned 0.
The topic checkout matches current development runtime; its documentation history
does not make it the base for future feature work. After issue selection, update
development in this same checkout before creating the focused implementation
branch, preserving these pending files. No worktree permission is inferred.

Authenticated tracker inventory and exact `1.4.1 in:title` search found **no
quotation issue**. No selected approved implementation issue exists. The
[workflow](Development_Workflow.md), [tracker](issue-tracker.md) and user brief
require concrete packet approval before publication and merged direct blockers
before selected implementation. Earlier feature approvals do not approve this
new packet. Accordingly, no speculative quotation implementation was started.

Existing issue-to-PR and merged-PR inventory were checked. An ancestry check
confirmed **29** relevant prerequisite/foundation PR merge commits are ancestors
of fetched development: #21/#38/#39/#40, #61/#62/#64/#66/#67/#68/#70/#71,
#83/#89/#91/#102/#105/#106, #121/#122/#123/#127/#128/#129,
#149/#150/#151/#171/#172. The packet's real external edges refer to existing
issues; its A1/A2/B/C edges are proposed and have not been installed on GitHub.
Re-read full issue bodies/comments and exact native edges when a ticket starts.

Fresh PR-specific checks:

- [#171](https://github.com/nishanthturnstile/aarili/pull/171) merged
  **05:08:18 UTC**, `dacf56ea50ccf185bf34a3a61fc337538d2e399c`;
  [run 40064889238](https://github.com/nishanthturnstile/aarili/actions/runs/40064889238)
  Fast verification and Dependency audit succeeded.
- [#172](https://github.com/nishanthturnstile/aarili/pull/172) merged
  **06:46:23 UTC**, development SHA above;
  [run 40067938593](https://github.com/nishanthturnstile/aarili/actions/runs/40067938593)
  Fast verification and Dependency audit succeeded. Full/browser checks were
  skipped under the development-PR workflow, not reported as successful.
- Latest branch-listed development workflow at discovery:
  [39918656681](https://github.com/nishanthturnstile/aarili/actions/runs/39918656681),
  SHA `43fa1b3`, successful. This older branch-listed run is not claimed to verify
  today's development head; the two PR-specific results establish their gates.
  Main is not claimed to contain this development feature set or a new promotion.

Codebase Memory returned one unrelated project and no index for this exact root;
bounded rooted source inspection was used. No Graphify graph exists in this
checkout, and no graph/index or tool was installed. Runtime API syntax/config was
not changed: source review and design require no remembered library API recipe.
REA tools used live schemas and the cached CLI's own help. Installed Turborepo
README/running-task docs were read before verification; no Turbo config changed.

## Research results and design coverage

REA discovered and passively observed the saved synthetic Nool order, establishing
the garment/quantity/price/total display. Its connected action capture failed;
one corrected CLI transport attempt also failed. Later REA observation confirmed
sign-in controls after the browser fallback chose Tailor / Staff. There was no
authenticated editor/save/reopen/PDF success. T3 had two exact snapshot timeouts.
Zoho sources are public vendor documentation only; no authorized quote workspace
was established. Four REA evidence IDs, operation boundaries and failed attempts
are retained in the linked research ledger. No real messages or financial actions.

| Requested outcome | Concrete preparation | Implementation status |
| --- | --- | --- |
| Effective-dated owner-approved rates | QD-01/06, Q-01/07, A1; schedule/date/overlap/retirement and exact policy-binding design | Not implemented; rates and production policies unapproved |
| Recoverable garment estimates | QD-02/11, Q-02, A2; incomplete raw drafts, unknown totals and explicit refresh | Not implemented; no new UI/route/draft registry |
| Booking quotes without duplicate charges | QD-05, Q-05, B; one charge graph, package references and accepted outside services | Not implemented; existing source snapshots remain unchanged |
| Exact totals and discounts | QD-03, Q-04, A2/B; incumbent exact-only arithmetic/FIN-05, cap/zero-base restrictions | Existing utilities inspected/tested; quote calculator not implemented |
| Private cost vs selling price | QD-04, Q-03/06, A2/B/C; separate estimated/actual sources and customer allowlist | Proposed; no actual-cost events fabricated or new posting |
| Immutable revisions/non-tax Tamil A4 PDFs/manual sharing | QD-07–09, Q-08/09/12/14, C; exact issue/number/job transaction and response seam | Foundation regression only; no quotation template/PDF/response feature |
| Customer materials, complimentary work/history | QD-01–05/08, Q-03/08/10, all applicable tickets | Acceptance specified, not proved by future tests |
| No payment/revenue/receivable/agreement side effect | QD-07, Q-10, common ticket tests | No runtime change; future no-effect transaction assertions required |

The design contains QD-01–12 and Q-01–14 and the packet has complete vertical
outcomes A1/A2/B/C with explicit blockers, sources, decisions, migration/recovery,
tests and review demonstrations. FIN-01–04 whole-slice completion is not claimed.
FIN-05 payment acceptance, general approval/change control and billing remain
1.4.2/1.4.3/1.4.4–1.4.5; quote response records cannot activate those consumers.

## Fresh local verification

Native Windows, Node **24.22.1**, pnpm **12.15.0**. Default shell Node was 24.20.0;
verification prepended the already installed 24.22.1 directory to each process
PATH, without changing machine configuration. Runtime source equals fetched
development; dirty/new files are documentation only. Logs/raw scenario failures
are outside Git at `%TEMP%/aarili-quotations-20261024/`.

| Command/check | Fresh result and precise limit |
| --- | --- |
| `git fetch origin`; tracker/PR/ancestry check | Exit 0; no 1.4.1 issue, 29 merged foundation/prerequisite PRs integrated. This is software dependency evidence, not live-policy approval. |
| `pnpm verify:fast` | **Exit 1**. Lint/boundaries/tokens, Knip and strict types passed; unit run **320 passed / 1 failed**, 69 files, **17.67s**. Existing seeded jobs locator/hash property exceeded the unchanged **5,000ms** test timeout. Negative fixtures/OpenAPI/production build were not reached by this invocation. Log `verify-fast.log`. |
| `pnpm exec vitest run tests/jobs.test.ts` | **Exit 0, 2 passed, 441ms**. Isolated unchanged test, no seed/timeout/config relaxation. This supports load-sensitive timeout as an inference, not a proven root cause; it does not turn the failed full invocation green. Log `jobs-isolated.log`. |
| `pnpm test:integration tests/money.integration.test.mjs tests/documents.integration.test.mjs tests/document-sharing.integration.test.mjs` | **Exit 0, 3 files / 10 passed, 126.54s**. Real PostgreSQL money boundary and existing queue/private-storage/document/sharing foundation cases. Does not prove quotation RLS/numbering, new audience projection or business arithmetic. Log `foundation-integration.log`. |
| `pnpm test:negative` | **Exit 0**. Existing invalid boundary/DTO/client/component declarations rejected. Run separately because the full invocation stopped before this stage; log `negative.log`. |
| `pnpm openapi` | **Exit 0**, existing **122** paths generated. No quotation route/schema is claimed. Log `openapi.log`. |
| `pnpm build` | **Exit 0**, **12/12 tasks**, 11 cached, **16.338s**. Fresh enclosing build invocation; cached package task logs are not fresh package execution. Log `build.log`. |
| `pnpm test:pdf` | **Exit 0**, Linux namespace/seccomp sandbox, uid 1000, four local fonts, 50 synthetic strings, **21 unchanged A4/A3 page goldens**. Existing slip/label/foundation templates only, no new quotation PDF; fluent Tamil remains deferred. Log `pdf-foundation.log`. |
| Preparation consistency/arithmetic check | **Exit 0**: four documents, **34 local links**, 12 decisions, 14 acceptance mappings, 32 ticket criteria. Existing compiled money functions reproduce all design examples, including fractional-result rejection, blank vs zero, FIN-05 paise reconciliation and the over-cap tiny-line case. This is not a quote implementation test. Script retained outside Git as `check-preparation.mjs`. |
| `git diff --check`; runtime comparison | **Exit 0**; existing roadmap CRLF normalization notice retained. Runtime comparison against origin/development remains 0 after OpenAPI/build. No production source/generated API drift. |

The full `verify:fast` command remains a failed invocation; the successful
isolated rerun and separately completed stages are reported individually, not
renamed a passing full run. No test/configuration/runtime source was edited to
make it green. Existing unit coverage consists of 320 passes in that run and
two isolated jobs passes (one overlaps its initial pass). No new feature tests
exist yet; none are described as passing. Final lint/link validation is recorded
at the final checkpoint below. No additional full install or full UI matrix was
required for unchanged packages/configuration; focused foundations were run
because money/document reuse is material to this packet.

No quotation browser/axe, quote-specific PG concurrency/isolation, new template
goldens, actual quote PDF all-page visual inspection, physical Android, fluent
Tamil, screen-reader, live recovery drill or live activation has been performed.
The existing renderer golden check, if successful, proves its retained templates
only. No quotation screenshot or text extraction can substitute for actual C PDFs.

## Manual review packet for this preparation

Document review-ready checkpoint: **24 October 2026, 07:13:21 UTC**. This is
preparation availability, not a working quotation or implementation delivery.
Start/active implementation, first usable feature, CI and review waiting are
not measured for an unselected issue; the delivery log records that distinction.

**Open:** this evidence, the linked design and ticket packet in the existing
checkout. No server, sign-in, customer record or terminal replay is required for
document review. There is no running quotation feature to try yet.

**Try and observe:**

1. QD-01/06: review date boundaries/no retroactive rate publication and the
   quote-only policy-binding seam. Confirm fixtures cannot become production terms.
2. QD-02–05: trace unknown fabric rate versus explicit free work; review private
   known/unknown cost, customer material, package references and outside services.
   Confirm that a known subtotal is not a complete total.
3. QD-03: review exact-only fractional-paise blocking, percent basis points,
   FIN-05's paise remainder/cap edge and reasoned manual allocation. Approve
   semantics separately from real discount authority/values.
4. QD-07–09: review immutable issuance/numbering/validity/customer-safe output,
   exact-revision response, unchanged accepted prices and deliberate manual share.
5. Review A1 → A2 → B → C granularity and real blocker edges, approve/amend the
   concrete packet, authorize publication separately and select A1 if desired.

**Report:** `QD-xx — approve/change — observation; packet — approve/change;
publish — yes/no; selected issue/outcome — ...`. Approval is required by the
project workflow and brief, not by vendor research failure. No new credentials,
payments or messages are needed to review this packet.

**Cleanup:** no quotation host or infrastructure remains. Integration fixtures
are disposable; evidence stays outside Git and research browser remains at
sign-in with no unsaved draft. Future implementation must provide its actual
local URL/startup/private synthetic access, Q acceptance steps and teardown.
Owner/template, physical-device/language/AT, merge and live-data approvals remain
separate from packet review.

## Final preparation checkpoint

- Final `pnpm lint`: **exit 0**, 773 files, no fixes; existing **5 warnings /
  6 infos**, architecture boundaries across 455 sources, 100 UI token sources
  and eight static PWA assets checked. Log `lint-final.log`.
- Final preparation consistency/arithmetic script: **exit 0**, same 34 local
  links/12 decisions/14 mappings/32 criteria. `git diff --check`: **exit 0**,
  with existing CRLF normalization notices. The later edit is this evidence-only
  checkpoint; no verified runtime input changed.
- Only the four quotation preparation documents, scoped roadmap addition and
  preparation delivery entry were authored. The pre-existing nine-line roadmap
  brief and untracked REA prompt remain intact. No implementation, publication,
  commit, push, PR work or activation occurred. No PR needed thread registration.
- Self-review checked the six requested outcomes, effective-date ambiguity,
  exact arithmetic/cap restrictions, customer-stock exclusion, cost audience
  separation, immutable accepted-price/document history, FIN-03 response seam,
  atomic issuance/PDF and later-slice boundaries against Q-01–14. These are
  proposed acceptance obligations, not claims that documentation proves software.
