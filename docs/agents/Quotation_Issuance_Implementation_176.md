# #176 / 1.4.1d — issued non-tax quotations

Owner selected #176 after PR #179 merged. Clean existing checkout pulled
`development` to `f062de2287d246d3b317afb9512e49d5668972c1`; branch
`codex/quotation-issuance-c`, no worktree. Admission observed 24 October 2026,
14:25:12 UTC. Native blockers #175/#59/#60/#169/#84/#34 are closed. PR #179
merged 14:22:51 UTC; required Fast verification and Dependency audit passed in
run 40099940214. Blocker merge ancestry and final verification follow below.

Authority: Product FIN-01–04/21 and §§29.1/30.1/32/33; architecture §§6–11/15;
approved Quotations_Design QD-06–11, Ticket_Packet C-01–10. Existing REA evidence
retains documented/observed distinctions; no new vendor runtime claim.

Lock protocol: canonical shop-wide document/privacy barrier (`job-slips`), then
existing proposal source aggregate/identity/catalogue/profile/policy locks,
serialized quotation sequence and canonical document locks. Same barrier wraps
worker authorization/storage acceptance and audited erasure. Issue freezes a
strict customer projection and separate A2 customer quantity/rate details;
private-cost models never enter document data. Existing document job/retry/
storage fence and manual sharing paths remain canonical.

## Implemented behaviour

One complete current B proposal issues once. Reviewed current profile/validity,
source authority, exact totals and selected scope are rechecked at commit. Shop-local
issue date is server-owned; expiry is explicit or derived from the reviewed
calendar-day policy, inclusive. No business policy values are installed as defaults.
The quotation-only `QT-000001` sequence is shop-scoped and monotonic. Language or
commercial changes require a new reasoned proposal/revision and number. Old content,
numbers, hashes, response history and accepted bytes remain immutable.

Migration 0056 adds five tenant relations with composite foreign keys, forced RLS,
append-only bindings/responses, sequence serialization and deferred document checks.
Issue, origin key, audit, frozen model and canonical locator-only render job commit
together. A failed render retains its issued number. Current rights and privacy/
restore fences apply before reads, replays, rendering and storage acceptance.
Audited quotation or source erasure revokes access, tombstones personal content and
queues exact-key purge with receipts; it retains required nonpersonal provenance.
This is an additive migration with no historical backfill or destructive down path.
Recovery uses compatible application code while retaining the expanded schema,
numbers and artifacts. No production migration or recovery drill was performed.

The strict customer projection carries B totals plus customer A2 quantity/rate
details. Included package references have no added charge; customer materials are
disclosed without a shop-stock charge. Private costs (including complimentary work),
issue reasons, measurements and production information never enter the PDF model.
The existing integer-paise calculations remain authoritative. PDFs use the existing
native sandbox, self-hosted fonts, immutable storage/hash and manual-sharing pipeline.

Responses are owner attestations bound to the exact issued revision/hash and an
authorized respondent, with reported time, channel, evidence and correction reason.
Corrections/withdrawals append history. Historical/expired/superseded warnings never
apply an agreement. No payment, receivable, revenue, agreement, stock, custody,
capacity or production effect is introduced. Original issue/response/sharing keys
survive uncertain in-page outcomes; navigation blocks unresolved operations and asks
before discarding dirty fields. Reload can reopen committed immutable issue history.

## Acceptance and fresh evidence

All commands below ran locally on 24 October 2026. Diagnostic logs are outside Git
at `%TEMP%/aarili-quotations-176-20261024`; fixtures use synthetic data only.

| Criteria | Evidence and practical limit |
| --- | --- |
| C-01 | Real profile/source review conflict and current wearer-rights negatives; browser stale-review 412 preserves input. Missing/unreviewed validity and incomplete proposals fail closed. |
| C-02 | Four final PG cases pass in 249.31s: same-key replay, different-key concurrent issuance, changed request, key retention expiry, numbered predecessor and enqueue rollback. |
| C-03 | Real queue/native renderer/private S3 tests cover render/storage/post-storage failure, concurrent retries, one accepted artifact, restore/outbound fences and revoked current rights. |
| C-04 | Populated 0055 upgrade preserves existing B snapshots, document bytes/hash/jobs; old issued model/bytes remain after profile edits and revised proposal. Audited erasure/purge retains number and denies replay. |
| C-05 | Exact response CAS/corrections and original response replay after key-cache expiry; browser lost-response retry produces one event, reload opens exact issue history. |
| C-06 | Strict-schema poison/hidden-text scans, actual private 25.01 cost excluded; package references/null nets and complimentary zero validated. 200 seeded exact-model graphs plus corrupt totals/unknown/private-field negatives. |
| C-07 | Six actual English/Tamil A4 variants, 38 new pages, all pages visually inspected; one template correction batch and all-page confirmation. `pnpm test:pdf` passes all 59 existing/new goldens, fonts and Linux sandbox checks. Fluent Tamil/owner typography acceptance remains pending. |
| C-08 | Three-size browser run previews stored private bytes, recovers prepared-history lost response with original key, cancels native share without marking sent, and exposes manual download/text fallbacks. No real messages sent. Physical Web Share remains pending. |
| C-09 | Four real app_user/PG cases include missing context, foreign shop/subject, immutable admin writes, source-rights revocation, race/rollback and unchanged money/stock/custody/capacity/production effects. Three incumbent job-slip regressions pass in 103.43s; A5 owner-bootstrap inventory passes. |
| C-10 | Final three Playwright/axe workflows pass in 4.2m: phone/tablet/desktop, English/Tamil, light/dark, 320px, IME, issue/response/sharing uncertainty, dirty/unresolved navigation and access clearing. Automated screenshots received one batched visual review; Impeccable detector returned `[]` once. Physical-device review remains pending. |

Clean frozen install and export-import proof passed (1m2.275s), with no dependency
or lockfile change. Final `pnpm verify:fast` passed lint/Knip/types but stopped on
two unchanged five-second unit deadlines (337 passed, 2 timed out; 19.31s). With
worker concurrency bounded, `pnpm test --maxWorkers=4` passed all 339 in 26.92s,
without changing test timeouts or repository configuration. `pnpm test:negative`
and `pnpm openapi` then passed. Production build and artifact-scan results follow
in the publication checkpoint. Full promotion verification, live restore, physical devices
and human approvals are not claimed by these focused feature checks.

Focused commands: `pnpm exec vitest run --config vitest.integration.config.ts
tests/quotation-issues.integration.test.mjs`; `pnpm exec playwright test
tests/ui/quotation-issues.spec.mjs`; `node scripts/test-quotation-pdf.mjs`;
`pnpm test:pdf`; `pnpm exec node scripts/verify-quotation-issues-exports.mjs`.
The export gate requires the pnpm-managed environment (`npm_execpath`). The final
integration run includes the populated upgrade; regression/A5 evidence was obtained
with the corresponding incumbent integration files and focused test-name filters.

Development failures were investigated rather than hidden: new imports displaced
the existing leading Bun declaration reference; restoring first-line placement fixed
builds. PG exposed a missing narrow privacy audit policy, fixture pool/table-order
mistakes, and a reference-line null-versus-zero validation error; final four-case run
passes after correction. Initial fast checks found formatting/Knip entries; one busy
run hit unchanged five-second test deadlines, followed by a passing quiet run. Browser
attempts found incorrect test expectations for embedded preview and short receipt
waits; final tests retain exact-key/body/one-event assertions. Prepared-history loss
uses an aborted response after commit. A recovery review found in-page navigation
could discard unresolved work; guards and the reload/history flow now pass together.

## Manual review packet

The synthetic development host is running at **http://127.0.0.1:60453** (first ready
15:17:32 UTC). Sign in at `/sign-in`; private synthetic credentials are in ignored
`.scratch/quotation-issues-review-host/private.json`, never Git or chat. The host
uses the actual C component/Hono/PG/private-storage/worker path, not the full Orders
shell. Authenticated fallback inspection confirmed reviewed dates 24–31 October and
the non-tax/no-agreement wording; no quotation was manually issued. T3 preview twice
returned `Preview automation snapshot timed out after 15000ms.`; the named
agent-browser fallback inspected the authenticated surface instead.

1. On phone/tablet/desktop, select Tamil or English, enter a synthetic revision
   reason and Review issuance. Observe exact scope/terms/date review, then acknowledge
   and issue once. Observe one number, pending/ready status and immutable history.
2. Prepare and preview the private PDF. Check every Tamil page, package references,
   extras, paise discounts and total. Download/manual attach; cancel native sharing
   and confirm it is not marked sent. No real recipient/message is needed.
3. Record a rejection with respondent/time/channel/evidence. Reload, review and open
   issued history: the exact response and original PDF remain. Typed fields require
   explicit discard; unresolved command outcomes must be retried before leaving.
4. Automated failure/restore/revision evidence above supplements this host. The full
   Orders path exposes C beneath a saved B proposal; create/select a new B revision
   there to demonstrate a new number and unchanged old bytes. The standalone host
   intentionally has no B editor or owner fault-injection UI.

Restart if needed: `pnpm build:packages`, then
`node scripts/review-quotation-issues.mjs` with the pinned Node in PATH and Docker
running. Read the newly generated URL/private file; the port is ephemeral. Cleanup:
`node scripts/review-quotation-issues.mjs stop`; it removes its private credentials,
lock and owned disposable containers. Do not stop unrelated containers.

Owner template/numbering/content approval, fluent Tamil, physical Android/low-memory/
Web Share, approved production policies and pilot/privacy/restore gates remain
pending. No live data, deployment, production migration or automatic sharing.

## Review-ready checkpoint

Observed **24 October 2026, 15:40:31 UTC**. Final production build passed (12 tasks,
25.831s), then `node scripts/check-artifacts.mjs` passed all 29 browser artifacts.
`git diff --cached --check` passed. Checks cover the selected branch's uncommitted
runtime tree at this checkpoint, based on f062de2, with no dependency/lock changes.
Only documentation/publication metadata follows. The complete fast command's unit
timeout failure remains recorded above; its remaining stages and all unit tests
passed separately, with bounded unit worker concurrency. Required hosted fast/audit
checks and owner review must pass before merge. No full promotion suite is claimed.

Draft [PR #180](https://github.com/nishanthturnstile/aarili/pull/180) was created
**15:41:14 UTC**, targets development and is linked to this T3 thread. Verified
runtime commit: `31b8a955a7bfc8034257b824920d74d676d48890`. At **15:41:27 UTC**,
Fast verification and Dependency audit were in progress in
[run 40108112092](https://github.com/nishanthturnstile/aarili/actions/runs/40108112092).
Browser jobs were skipped under the feature-PR policy; local browser evidence is
above. This follow-up changes publication documentation only. Hosted results,
owner review, merge and activation remain pending; no watcher or deployment started.
