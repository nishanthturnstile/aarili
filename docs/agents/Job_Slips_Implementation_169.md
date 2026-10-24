# #169 / 1.3.4a — private job-slip implementation evidence

24 October 2026. Selected owner-approved issue [#169](https://github.com/nishanthturnstile/aarili/issues/169); [#170](https://github.com/nishanthturnstile/aarili/issues/170) remains blocked by A and separately selectable after its merge. Overall 1.3.4 is not closed by A.

Preparation PR [#168](https://github.com/nishanthturnstile/aarili/pull/168) squash-merged as `aea6e312112ced3cca67e0cb4855b895efb2bab3` after both required checks passed on `d2addde`. The existing checkout's development branch was updated and `codex/169-private-job-slips` created at that merge. Implementation checkpoint: **03:19:49 UTC**. All nine direct blockers (#16/#51/#59/#60/#120/#126/#148/#155/#165) were closed with merged prerequisites before starting. No worktree or dependency change.

## Behaviour and integrity

The owner reviews one accepted garment/native piece or applicable standalone service, explicitly chooses PDF language and acknowledges exact sources/omissions. Core builds the allowlisted model; the browser cannot submit HTML or arbitrary PDF models. Design, measurement session/form/source/units and manual/external pattern IDs and versions are frozen with image purpose, subject, original/display digests, dimensions, captions and annotations. Lightweight services retain requested work and recorded line state without creating body-measurement or pattern obligations. No quantity creates piece identities.

Source review is labelled as a review, not the issued PDF. Source changes return 412 and show previously reviewed versus current version IDs. Uncertain issuance retains the same idempotency key and payload. The real stored PDF is separately prepared, previewed and downloaded. Owner/download and deliberate production-sharing purposes are separate; a print-shop choice cannot mount the private slip. File preparation precedes the later native-share gesture and explicit private-recipient acknowledgement. No conversation or message is automatically opened or sent.

The existing document revision/attempt/lease/output-intention/artifact/share-history paths remain authoritative. The new trusted `job-slip` revision-1 template uses self-hosted fonts and bounded hash-checked image bytes. Network, scripts, arbitrary paths and uploaded pattern PDFs remain denied. Missing critical assets block; optional inspiration omissions are visible. Fitting photographs, fit notes, financial amounts and margins never enter this projection. Image derivatives are read only through the bounded private-key adapter after source/media authority checks.

Migration `0051_job_slips.sql` adds source bindings, purge intents and receipts with composite tenant FKs and forced RLS. Issuance, source binding, idempotency, audit and queue write commit in one membership-bound transaction. Ordinary history stays immutable. A shop barrier orders issuance/render acceptance against audited measurement/design/source erasure. The separate maintenance-only `redact_job_slip` function also covers document-specific requests and wearerless service instructions. Erasure revokes access, replaces personal frozen models with `{}`, and queues exact planned/accepted object keys; purge retries cannot recreate a document. The storage-write barrier is opt-in for job slips; generic document storage behaviour is preserved.

## Verification record

Final commands and outcomes are recorded below after they finish. Intermediate failures are retained in the local logs under `%TEMP%/aarili-job-slips-20261024/` and are not completion evidence.

- Initial PostgreSQL tests found strict-scope projection and trigger record-field errors; corrected before the first three-path pass (55.92s).
- Expanded five-case PG run passed (119.09s): exact bytes, source correction, concurrent same-key issue, transactional enqueue rollback, renderer/storage failure recovery, erasure during render.
- Asset test exposed use of the staging-only snapshot adapter for accepted private derivatives; corrected with an explicit bounded private read. A later real image/annotation/optional omission/design-source erasure case passed. Service setup initially attempted to reseed an already-versioned calendar; corrected to reuse the existing reviewed configuration, then the standalone service case passed (25.09s).
- Three-size browser run passed (3 tests / 2.8m) in English/Tamil, including lost-reply reconciliation, real prepared PDF, activated cancelled share, download, print-shop clearing, access clearing and axe. A subsequent source-comparison and guard update requires the final rerun below.
- Native Linux sandbox proof uses uid 1000, namespace/seccomp, four self-hosted fonts and no network requests. Candidate job-slip PDFs cover two English and six Tamil A4 pages, images/anchors, fractions/units and long mixed text. All pages are rendered to PNG; baseline five foundation goldens remain unchanged. Final retained golden comparison is recorded below.

### Final software checks

- `pnpm verify:fast` - **exit 0**, log interval **04:42:16-04:44:34 UTC**: Biome/boundaries/tokens, Knip, 23 type/build tasks, **69 unit files / 321 tests**, negative declarations, generated OpenAPI and 12 production build tasks. Five pre-existing lint warnings remain; no errors. Earlier concurrent runs caused three existing five-second timeouts; the unchanged tests pass in this final run.
- `pnpm test:integration tests/job-slips.integration.test.mjs tests/documents.integration.test.mjs tests/document-sharing.integration.test.mjs tests/owner-bootstrap.integration.test.mjs` - **4 files / 29 passed, 559.06s, exit 0**. This includes nine new slip cases, worker mode and the forced-RLS inventory. The earlier combined 26-pass/two-failure run used an obsolete test history route and incorrectly ordered expected table names; corrected rather than weakening assertions.
- `node scripts/test-ui.mjs job-slips.spec.mjs document-sharing.spec.mjs` - **6 passed / 6.2m / exit 0**, phone 360x800, tablet 820x1180, desktop 1440x1000. Both languages, real source-change comparison and all relevant controlled share/access cases; axe reported no violations.
- `pnpm test:pdf` - **exit 0**, 13 retained page goldens pass. New A4 job-slip proof is 2 English + 6 Tamil pages; four embedded local fonts and zero blocked/remote requests. All eight new PNG pages inspected individually and as a contact sheet. Model hashes and exact source IDs, fraction markers, first/last annotations and repeated page scope are checked. The new template uses bounded grapheme-safe presentation rows without altering the stored source model. No existing golden image changed.
- Source-privacy regression command selected `DS-B-01`, `MV-C05 audited` and `MP-B06/09 audited` plus the new standalone service case. The three existing source cases passed; the service case caught a missing, narrowly scoped audit-insert policy (383.26s aggregate, 3 pass/1 fail). The policy now permits only the document-erasure action for app_owner under shop context; runtime and app_privacy table grants are unchanged.
- Fresh final edge command: `pnpm test:integration tests/job-slips.integration.test.mjs tests/owner-bootstrap.integration.test.mjs -t 'standalone service|exact image|0.2.1a A5'` - **3 passed / 18 filtered, 52.97s, exit 0**. It proves maintenance-only erasure of wearerless service snapshots, runtime erasure denial, required image/annotation retention, missing/digest-changed asset rejection, explicit optional unsupported-audio omission, design/source erasure and forced-RLS inventory after the final migration change.
- Final frozen-code `pnpm verify:fast` - **exit 0**, log interval **04:54:48-04:57:43 UTC**: all required fast checks, **321 unit passes**, production build. It includes the final omission branch and maintenance audit policy. Source-privacy three-case passes above remain valid because the later policy is limited to the new document-erasure action; the affected service/asset/RLS cases were freshly rerun.
- `pnpm smoke` - **exit 0**: production Next/Hono with real PostgreSQL readiness/outage, typed client and worker shutdown. `node scripts/check-artifacts.mjs` - **exit 0**, **29 browser artifacts** checked including new private job-slip symbols and fitting-data sentinel. Documentation local targets: **160 checked**. `git diff --check` reports no whitespace errors.

### Review-ready checkpoint

**24 October 2026, 05:00 UTC.** Running synthetic review: **http://127.0.0.1:63989/sign-in**. Launcher PID 34164, private access file `.scratch/job-slip-review-host/private.json`. The host is running in the owner's existing checkout and uses disposable infrastructure; it is not a production deployment. All checks refer to the implementation working tree on `codex/169-private-job-slips` from `aea6e31`, with the committed PR head providing its immutable identifier. Owner/template review, fluent Tamil and physical Android/low-memory acceptance remain pending. The draft PR and hosted CI are separate from local verification.

`pnpm verify`, the full repository integration set and the full UI suite were not rerun for this selected feature; focused real-PG, source-privacy, PDF, browser and production-smoke checks supplement fast verification. No live data, production migration, external provider, hardware print or real message was used.

## Requirement map

| Acceptance | Implementation and proof |
| --- | --- |
| JS-A01 | Real order/native-piece readers, explicit unsupported contexts, standalone service fixture; guessed piece rejected. Group membership grants no additional wearer access. |
| JS-A02 | Exact frozen model/digests and immutable source IDs; later pattern selection changes cannot change old bytes; stale request rejected and visible source comparison. |
| JS-A03 | Required image/annotation manifest, bounded private read and renderer hashes; critical omission rejected, optional omission recorded, changed digest rejected, missing private object blocked, design/source erasure revokes output. Existing media suites own admission/processing/quarantine states. |
| JS-A04 | Real app_user/RLS, concurrent same-key requests, payload mismatch, deferred document binding, enqueue rollback and audit/job atomicity. |
| JS-A05 | Real queue/storage/renderer, failed writes and explicit retry, duplicate delivery, erasure while rendering; existing document suites cover lease succession, orphan cleanup and acceptance rollback. Same production composition is exercised in in-process and worker modes. |
| JS-A06 | Stored SHA-256/byte equality after source correction, separate revision and retained history; no rerender on download. Existing font/template mismatch checks retained. |
| JS-A07 | Two-shop denial, forced-RLS inventory, audited measurement/design erasure and exact purge receipts; stale restore epoch and session-loss paths. |
| JS-A08 | Actual A4/embedded-font/text/asset checks, eight new page goldens and all-page inspection; independent fluent Tamil acceptance still pending. |
| JS-A09 | Three viewport classes, English/Tamil, keyboard/native activation, cancelled share, exact-file download and axe; existing sharing suite covers incapable/failed/manual attach paths. Physical Android acceptance pending. |
| JS-A10 | Source blockers/stale comparison, uncertain-key reconciliation, queued/failed/retry status, history and access clearing. No eager browser image/PDF fetch before explicit preparation. |

## Recovery and activation

This is synthetic-only software delivery, not live activation. Keep a reader that understands revoked bindings and redacted models: minimum compatible schema/reader is migration 0051 plus this feature's document authorization and purge handlers. Roll forward once snapshots exist; do not deploy an older generic-document reader that could expose them. Old template/font fingerprints remain part of issued provenance; changes need another template revision. Original PDF bytes survive ordinary corrections and deployment changes; audited erasure is the deliberate exception.

Restore with side effects disabled and the new restore epoch/quarantine. Replay the existing privacy/tombstone ledger against restored models and storage before enabling reads or job effects; reconcile pending purge intentions under the reviewed restored epoch. Do not replay old-epoch outbound jobs or assume a pre-erasure backup is safe merely because access is currently denied. No live backup/restore, retention duration or production activation was executed or invented here.

Production integrations must explicitly supply `jobSlipTemplates()`, private document/media storage and queue adapters to owner auth, then supply `owner.jobSlipDocuments` with the same policies to `productionJobComposition` in either runtime mode. Supply exact-key erasure storage for purge jobs. Default adapter denial remains intact; environment factories do not silently activate external providers.

## Manual review

Start from the existing checkout with pinned Node 24.22.1 and Docker:

```powershell
pnpm build:packages
node scripts/review-job-slips.mjs
```

The running loopback URL is printed by the launcher and recorded in the final review checkpoint. Credentials and exact synthetic scope are only in `.scratch/job-slip-review-host/private.json`; do not commit or paste that file. This host uses the actual component/API, disposable PostgreSQL/private storage and real queued PDF renderer.

1. Sign in, open **Review job slip sources**, choose the native piece in the private access file, then review exact source IDs and raw values/units. Select English or Tamil PDF independently from UI language (JS-A01/02).
2. Record a reason, acknowledge scope, create the PDF. Prepare and inspect every page; confirm continuation identity, unknown values and unverified pattern warning. Download it without any printer (JS-A08/09). Image/annotation multipage proof PDFs and PNGs are in the output named by `.scratch/pdf59-latest-proof.json`.
3. Choose a production recipient purpose, prepare the exact file again, acknowledge the PDF and deliberately open/cancel the native sharing sheet. Confirm nothing is marked sent. Choose print shop and confirm the private preview disappears. Do not send a real message (JS-A09/10).
4. Review failure/retry and source-race automation evidence; report any human readability, focus or low-memory observation separately. Fluent Tamil review and physical Android/3–4 GB device sharing remain pending (JS-D09).

Report `JS-Axx — pass/fail — observation`, with device/browser/RAM only for real-device observations. Teardown in another terminal: `node scripts/review-job-slips.mjs stop`; the launcher removes its private access and lock files and stops its disposable services. No QR lookup, automated messaging, true-scale pattern printing or material-label implementation is part of #169.
