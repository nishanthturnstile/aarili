# [W0 0.4.4a] Render immutable versioned Tamil PDFs

Published and approved as [issue #59](https://github.com/nishanthturnstile/aarili/issues/59) on 15 October 2026.
Implementation starts only after its direct blockers merge.

## What to build

A committed immutable document revision renders asynchronously into a private
Tamil/English PDF. Failure is visible and retryable without undoing its originating
command; successful historical output is downloaded unchanged after later edits.

## Sources and scope

Roadmap 0.4.4; product USE-07/08, COM-04/06, TRU-01/06/07, AC-64 job-slip
foundation; architecture §§5.3, 6.2–6.4, 8.3–8.5, 9.2–9.3, 10.2, 15.
Add the documents runtime boundary and a synthetic template in test-only
composition. Business bill/receipt/job-slip templates, numbering and pattern
geometry remain later work. Do not expose an arbitrary HTML-to-PDF service.

## Blocked by

- 0.4.1a: catalogues, fonts and real UI/client conventions.
- 0.4.1d: private observability and usage/event interfaces.
- 0.4.3b: validated immutable storage and production guarded job composition.

## Acceptance criteria

- [ ] I1: Issuance fixes immutable source model, language, A4-default/A3 paper,
  template/font revisions and actor/history, then queues pdf.render atomically
  through a registered template. Unknown template/revision denies safely.
- [ ] I2: Minimal jobs use docId:revision singleton identity and three retries.
  Durable tenant/document/revision uniqueness outlives queue/idempotency expiry;
  duplicate delivery or concurrent consumers accept one revision artifact.
- [ ] I3: Trusted templates produce escaped static HTML with exact embedded
  Noto Tamil/Latin assets and print CSS. Fonts finish loading before render;
  template/font versions remain available for pending historical revisions.
- [ ] I4: Chromium launches on demand at concurrency one, uses fresh isolated
  contexts and shuts down around 60 seconds idle. User URLs, scripts and remote
  resources cannot trigger network access. Local trusted assets are embedded or
  explicitly supplied; no arbitrary file URL or filesystem read is exposed.
- [ ] I5: A Linux non-root runtime test proves Chromium sandboxing enabled;
  merely avoiding root or omitting a no-sandbox flag is insufficient. If the
  target sandbox cannot run, report the concrete blocker rather than disabling it.
- [ ] I6: Tenant/authority/restore epoch and attempt are checked before work and
  before accepting results after I/O. Forced RLS/composite references protect
  document/artifact rows. Crash/retry/finalization races cannot attach stale output.
- [ ] I7: Accepted storage follows the immutable shop/doc/revision/hash layout
  and records SHA-256 plus provenance. Later source/config/template/font changes
  never replace accepted PDF bytes. Orphans from failed attempts are reconcilable.
- [ ] I8: Pending/rendering/failed/ready and retry are explicit. Renderer/storage
  failure leaves the issuing command committed and does not create a second
  document. Dead letters and private operational status expose safe codes only.
- [ ] I9: CI renders about 50 difficult Tamil strings into reviewed goldens,
  covering conjuncts, Sri/ksha, reordered vowels, long names, mixed English and
  rupee amounts. Check font embedding, A4/A3 dimensions, page breaks and remote
  request denial. Fluent Tamil review is required for phase acceptance.
- [ ] I10: Both supported job modes use the same production renderer registry;
  shutdown/resource cleanup, retry exhaustion, failure reporting and deduplicated
  PDF/media usage instrumentation have real integration evidence.

## Verification and delivery

Resolve/fetch current Playwright Chromium documentation and use the approved
exact pin. Run lint, Knip, types, unit/PostgreSQL/S3/render tests, Linux sandbox
verification, golden/browser checks and production build. Add reviewed queue/SQL
migrations and an explicit image/runtime resource manifest; do not deploy it.

## Recovery and activation

Back up before retained schema changes. Compatible code rollback preserves
accepted artifacts and immutable models. Do not rerender issued PDFs to recover
missing historical bytes without an explicit correction process. Hosting/privacy
and business-template approval remain later activation gates.
