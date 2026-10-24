# #170 / 1.3.4b — minimal material-label implementation evidence

24 October 2026. The owner selected #170 after confirming the prerequisite PRs were merged. All six native blockers (#169/#118/#120/#124/#125/#126) were closed before implementation. PR #171 merged as `dacf56ea50ccf185bf34a3a61fc337538d2e399c`; its Fast verification and Dependency audit succeeded. The existing checkout's `development`, `origin/development` and new `codex/170-material-labels` branch were aligned to that commit. No worktree, dependency upgrade or live activation.

## Behaviour and field boundary

The owner selects accepted garments and existing native pieces through a controlled picker, with ordered copies. Candidate lists expose only accepted codes, controlled garment/piece names and native IDs; they never reuse a full private order DTO. Multi-member selections are authorized together; one inaccessible member rejects the whole sheet. Service provenance is independently authorized. Booking IDs confer no authority. Copying a label repeats its native identity. An order-level selection shows unknown quantity; no quantity creates physical piece IDs.

The label source repository selects controlled name scalars, order/piece identifiers and internal authorization/provenance IDs. It never fetches the acceptance snapshot JSON, instructions, fitting data, measurements, design/pattern records, prices or margins to construct labels. Existing identity policies may read identity records internally; those values never enter the label projection. The strict `material-labels.v1` model is separate from `job-slip.v1`. No names/contact details, booking reference, free text, fitting images, measurement/design/pattern values or money enter its model, PDF metadata or filename. The current accepted sources have no reviewed structured material type/colour value; optional material fields are omitted. This does not introduce material receipt fields or infer values from notes.

The trusted revision-1 template uses A4, 15 mm margins, two columns/four rows of 87 × 63 mm cells, with 6 mm horizontal and 5 mm vertical gaps. It preserves selection/copy order, blank unused cells and at least 12 pt text. It wraps identifiers and fails with a bounded label index when content overflows; it never silently clips, truncates or shrinks. The attempt stores only a bounded `label-N` field/cell identifier for an overflow, clears it on retry/claim and exposes a specific bilingual correction message through private PDF status. Raw rendering errors and source values are never stored in the diagnostic. Revision, generation time and page counts occupy the page's bottom margin. Four self-hosted Noto font faces are pinned by the existing renderer. Labels embed no images or external resources.

The owner reviews selected identities before issuing. The actual stored PDF is separately prepared and previewed before deliberate sharing. External print shop selects minimal labels; switching document purpose unmounts the private sharing component, revokes object URLs and rejects late responses. Recipient changes reset the prepared File and acknowledgement. Native file sharing occurs only after a user gesture; download/manual attachment remains available without a printer. No automated message or delivery/read claim.

## History, isolation and recovery

Migration `0052_material_labels.sql` adds immutable sheet revisions and ordered source-member bindings, composite tenant FKs, shop-led indexes and forced RLS. Binding/model hash, source digest, actor/action/request idempotency, audit, document revision and queue write commit together. The existing private document attempt/lease/output/artifact/sharing machinery is reused. New revisions append; no source, custody, assignment, progress, approval, completion or money status changes.

Labels opt into the same shop-level rendering/storage barrier as private slips. The existing exact-key purge engine now accepts only revoked job-slip or label revisions via a document-wide FK and typed trigger check. Audited maintenance-only `redact_material_labels` replaces an erased model with `{}`, keeps nonpersonal provenance/tombstones and queues planned/accepted keys. Wearer measurement erasure also revokes entire sheets containing that wearer. Runtime cannot erase historical models or edit bindings. Restore epochs, current permissions and revocation are rechecked before accepting outputs. Rollback must retain migration 0052 and its privacy-aware reader; do not drop history or remove the shared purge guard after issuance.

## Requirement and audience evidence

| Requirement | Implemented outcome | Evidence |
| --- | --- | --- |
| JS-B01 / ORD-10 | Minimal allowlist; poison fields rejected; no fitting images | Real source projection inspection; strict model/PDF proof; integration model assertions |
| JS-B02 | One/eight/nine labels, stable selection/copy order, native and unknown identity | PDF proof and PostgreSQL mixed service/piece/order selection tests |
| JS-B03 / USE-07 | A4 geometry, Tamil/English wrapping, partial pages, explicit overflow | Eight retained new PNG goldens; Poppler geometry/text/font/image assertions; all-page visual inspection |
| JS-B04 | Stored PDF preview/download/manual sharing, recipient/purpose clearing | Three viewport browser/axe workflows, English/Tamil; shared manual-sharing regression |
| JS-B05 | Tenant isolation, atomicity, history/replay, concurrency/retry, erasure/restore | Real PostgreSQL/private storage/native worker integration tests; A regressions |
| JS-B06 / AC-64 contribution | A supplies exact private production references; B supplies minimal labels | #169 evidence plus this record; overall human/pilot acceptance remains open |

The approved field/audience matrix in [the design](Job_Slips_Labels_Design.md) still applies: owner and explicitly reviewed production recipients may receive private slips; an external print shop receives minimal labels. B has no fitting/photo/money fields even for the owner. QR lookup, automated messaging and true-scale patterns remain excluded.

## Verification and review

Final results below refer to the working tree based on `dacf56e`, including the final picker, overflow diagnostic and migration. No runtime edits followed these checks. Logs remain outside Git under `%TEMP%/aarili-labels-170/`. Initial compilation errors (a renderer variable name and TypeScript narrowing helper) were corrected. Adding imports above the existing Bun SQLite reference initially disabled that declaration directive; restoring the directive to the first line fixed compilation without changing dependencies or compiler settings. The boundary check initially rejected the new typed browser client until it was registered in the existing narrow client allowlist.

Candidate Linux PDF proof passed: 21 total page goldens, including eight new label pages and 13 unchanged foundation/job-slip pages. All eight new label pages were visually inspected. This is technical shaping/layout evidence; fluent Tamil review remains a human acceptance gate.

Human gates remain: owner field/template/privacy acceptance, fluent Tamil shaping and line-break review, physical Android file sharing, low-cost phone usability and pilot/recovery activation. No physical print, live customer data, production provider configuration, deployment or real WhatsApp send occurred.


### Integration configuration and restore boundary

Reviewed integrations register both `jobSlipTemplates()` and `materialLabelTemplates()` through the existing registry resolver, supply the same private document/queue adapters to owner auth, and pass `owner.jobSlipDocuments` to the existing `productionJobComposition`. The synthetic fixture demonstrates that composition. Default adapter denial remains intact. The bottom-margin footer uses the pinned renderer's CSS page-margin support; [Chromium's primary documentation](https://developer.chrome.com/blog/print-margins) describes that mechanism, and the actual retained PDFs verify it here.

Pre-erasure backups may retain earlier model/PDF bytes. Apply the existing audited erasure/restore reconciliation to restored rows and storage before enabling reads or job effects, and reconcile purge intents under the reviewed restored epoch. Old-epoch jobs cannot publish. No production retention duration is introduced.


### Final software results

- `pnpm verify:fast`: **exit 0**, log interval **05:40:01?05:43:12 UTC**. Biome/import boundaries/design tokens, Knip, strict types, **69 unit files / 321 tests**, negative declaration/client fixtures, **122 OpenAPI paths** and production web/worker builds passed.
- `pnpm test:integration tests/material-labels.integration.test.mjs`: **5 passed / 130.78s / exit 0**, started **05:46:21 UTC**. Real PostgreSQL and private storage/native worker cover strict projection/candidates, one/nine and mixed service/native/order selections, unknown quantity, stored bytes, append-only revisions, same-key concurrency, enqueue rollback, ETag/payload mismatch, other-shop access, render/storage retry, bounded overflow status, erasure during rendering, exact-key purge replay, restore epoch and permission withdrawal.
- The preceding combined A+B run retained **9 passing A regressions and 4 passing B cases**, with one B candidate request returning 404 because the test file changed after that run's package build. The rebuilt targeted candidate case passed (**40.20s**), then all five B cases passed together as above. The earlier complete A+B run also passed **14 tests / 311.54s**. The stale-artifact failure is retained, not called a passing combined run.
- `node scripts/test-ui.mjs tests/ui/material-labels.spec.mjs tests/ui/job-slips.spec.mjs`: **6 passed / 6.6m / exit 0**. Final expanded `node scripts/test-ui.mjs tests/ui/material-labels.spec.mjs`: **3 passed / 3.6m / exit 0**, log interval **05:43:06?05:46:48 UTC**. Phone/tablet/desktop, English/light and Tamil/dark, axe, controlled multi-selection, stored preview/download, activated cancelled share, incapable share, DataError/manual attachment, prepared-state revocation and delayed file response after purpose switch, plus access loss. Native sharing was stubbed; no real send.
- `pnpm test:pdf`: **21 page goldens passed / exit 0**, log interval **05:42:28?05:43:20 UTC**. Linux uid 1000 namespace/seccomp sandbox; four embedded Noto faces, no blocked-network requests; actual A4 dimensions, 93 mm column pitch and 68 mm row pitch, 1/8/9 counts in both languages, footer on every page, strict poison-field rejection, no image objects, links/attachments/active content, and explicit overflow rejection. All eight new label pages were visually inspected; the 13 prior goldens are unchanged. Latest PDFs/text/PNGs and SHA-256 evidence are located by `.scratch/pdf59-latest-proof.json`; retained images are `tests/goldens/documents/LBL-*.png`.
- `pnpm smoke` and `node scripts/check-artifacts.mjs`: **exit 0**. Production Next/Hono/real PostgreSQL readiness/outage, typed client and worker shutdown passed; **29 browser artifacts** checked for private runtime/configuration leakage.
- Final scoped Impeccable detector: **[]**, no findings. Phone English/Tamil screenshots were visually reviewed; all three sizes were checked by browser assertions/axe. Captures: `.scratch/material-label-captures/`.

The full `pnpm verify`, full repository PostgreSQL set and full UI suite were not rerun; feature-specific real-PG/PDF/browser and production-smoke checks supplement fast verification. Hosted Linux Fast verification/Dependency audit remain the feature PR gates. Owner approval and promotion remain separate.

### Running manual review

Ready URL: **http://127.0.0.1:51976/sign-in**. Started from this checkout using `node scripts/review-job-slips.mjs`; the actual new label component, membership-bound Hono API, disposable PostgreSQL/private storage and real queued renderer are running. Synthetic credentials and exact scope are in `.scratch/job-slip-review-host/private.json`; do not commit or paste that file. HTTP 200 and the sign-in heading/fields were confirmed in an isolated agent-browser session, which was then closed. Embedded T3 navigation succeeded, but snapshot returned `Preview automation snapshot timed out after 15000ms.` twice; this is a tool limitation, not a passing embedded snapshot claim.

1. Sign in and open job slips. Change **Document purpose ? Bag / material labels**, select the native piece, and choose another accepted garment/order-level label through **Choose accepted garments**. Review each order code, piece identity and copy count (JS-B01/02).
2. Choose English or Tamil PDF independently of interface language, acknowledge the selection and create the immutable A4 sheet. Prepare the real stored PDF, inspect every page and download it. An order-level label must say quantity unknown; copies retain the same native identity (JS-B02/03).
3. External print shop is the default label recipient. Review/acknowledge the exact minimal file, then deliberately open/cancel sharing or download for manual attachment. Switch purpose and confirm the previous preview/acknowledgement disappears. Do not send a real message (JS-B04).
4. Review automated overflow, retry, permission/restore and erasure evidence above. Report human findings as `JS-Bxx ? pass/fail ? observation`. Fluent Tamil, physical Android file sharing and low-memory phone judgments remain pending (JS-B05/06, JS-D09).

Teardown in another terminal: `node scripts/review-job-slips.mjs stop`. The launcher removes its private access/lock files and stops its disposable services. The review host is synthetic-only and loopback-only; no tunnel or deployment was created.
