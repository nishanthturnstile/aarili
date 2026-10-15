# Phase 0.4 implementation plan

Owner-approved phase direction, 15 October 2026. The owner requested implementation
of the conversational plan. This document preserves that direction and provides
the concrete tickets required by the repository workflow. The approved ten-slice
breakdown was published as issues #51–#60; bodies, labels and native blocker
relationships were read back. Implementation begins with unblocked #51 only.

## Purpose and authority

Establish responsive bilingual owner navigation, recoverable online drafts,
private media processing and immutable Tamil PDFs with manual sharing. Preserve
the existing owner flows, selected Current light/dark themes and self-hosted Noto
fonts. Synthetic exercises run only in test/harness compositions.

Sources: [Product Plan](../Boutique_Business_Management_Final_Product_Plan.md)
§§1.6, 24–25, 27–30, 32–33; [Architecture Decisions](../Architecture_and_Technology_Decisions.md)
§§5–11, 12.5 and 15; [roadmap](../Boutique_Business_Management_Implementation_Roadmap.md)
0.4.1–0.4.4; [selected design system](../aarili-design-system.md);
[development workflow](Development_Workflow.md) and [tracker rules](issue-tracker.md).
The product governs behavior and release scope; architecture governs technology.

Read-only prerequisite inspection found a clean existing checkout on main
`e8482103522957efe2b462045d107f93dcf006e7`. Phase 0.3 closeout PR #44 and cleanup
PRs #49–#50 are merged; #50's scaffold, browser and audit checks succeeded.
These hosted results establish prerequisite evidence, not fresh verification of
Phase 0.4. Implementation uses `codex/responsive-owner-shell` in the same checkout.

## Confirmed decisions

- Fresh page loads/navigation start in English; Tamil is explicitly selected.
  Do not infer or persist language yet. Documents select language independently.
- Keep synthetic draft/consent/media/PDF examples out of normal application
  routes and worker composition. Real production modules are exercised by
  isolated test hosts; business screen integration follows in Wave 1.
- Support JPEG/PNG/WebP, PDF documents/manual patterns and MP3/M4A/WAV audio.
  Measure HEIC decoding on the actual phone; provide conversion guidance when
  unsupported rather than promising universal support.
- Technical admission limits are 20 MiB and 40 megapixels for source images,
  25 MiB for PDFs/audio. Prepare display photos around 1,600 px at quality 0.8
  and thumbnails around 320 px. These are implementation limits, not commercial
  quotas or approved retention periods.
- Flag drafts after 30 days. Implement configurable cleanup with synthetic
  policy tests; real draft deletion stays disabled until notice/retention approval.
- Physical 3–4 GB Android capture/IME/PWA/share testing and fluent Tamil review
  happen during this phase. Use a temporary local HTTPS preview with synthetic
  data; do not bring hosted Phase 0.5 services forward.
- No customer access, gallery, automated messaging, financial templates, pattern
  geometry, offline capture or third-party behavioral tracking is activated.

## Ticket breakdown and order

Each linked file preserves a complete published issue body. Issues #51–#60 carry
`enhancement` and `ready-for-agent`; the label approves definition, not bypassing
blockers. No parent/map issue was created.

| Order / slice | Ticket | Direct blockers |
| --- | --- | --- |
| 1 / 0.4.1a ([#51](https://github.com/nishanthturnstile/aarili/issues/51)) | [Build the responsive bilingual owner shell](phase-0.4-tickets/01-responsive-bilingual-owner-shell.md) | Merged #3, #12–#15, #47–#48 |
| 2 / 0.4.1b ([#52](https://github.com/nishanthturnstile/aarili/issues/52)) | [Install the online-only PWA with safe updates](phase-0.4-tickets/02-online-only-pwa.md) | 0.4.1a |
| 3 / 0.4.1c ([#53](https://github.com/nishanthturnstile/aarili/issues/53)) | [Version bilingual vocabulary and search keys](phase-0.4-tickets/03-vocabulary-and-search-keys.md) | 0.4.1a; merged #15–#16 |
| 4 / 0.4.1d ([#54](https://github.com/nishanthturnstile/aarili/issues/54)) | [Record private usage and operational evidence](phase-0.4-tickets/04-private-observability.md) | 0.4.1a; merged #16 |
| 5 / 0.4.2a ([#55](https://github.com/nishanthturnstile/aarili/issues/55)) | [Save and promote durable tenant drafts](phase-0.4-tickets/05-durable-draft-lifecycle.md) | 0.4.1a; merged #16 |
| 6 / 0.4.2b ([#56](https://github.com/nishanthturnstile/aarili/issues/56)) | [Recover online drafts without false save states](phase-0.4-tickets/06-honest-draft-recovery.md) | 0.4.2a |
| 7 / 0.4.3a ([#57](https://github.com/nishanthturnstile/aarili/issues/57)) | [Authorise private uploads and immutable file reads](phase-0.4-tickets/07-private-upload-lifecycle.md) | 0.4.2a; merged #15, #35–#37 |
| 8 / 0.4.3b ([#58](https://github.com/nishanthturnstile/aarili/issues/58)) | [Validate and process private media safely](phase-0.4-tickets/08-media-validation-and-processing.md) | 0.4.3a |
| 9 / 0.4.4a ([#59](https://github.com/nishanthturnstile/aarili/issues/59)) | [Render immutable versioned Tamil PDFs](phase-0.4-tickets/09-versioned-tamil-pdf-rendering.md) | 0.4.1a, 0.4.1d, 0.4.3b |
| 10 / 0.4.4b ([#60](https://github.com/nishanthturnstile/aarili/issues/60)) | [Preview and manually share private PDF outputs](phase-0.4-tickets/10-private-pdf-sharing.md) | 0.4.4a |

The table gives working order, not artificial dependency edges. For example,
drafts do not depend on search, and uploads do not depend on the draft editor.
0.4.3a's added dependency on 0.4.2a is intentional: it reuses the extracted
non-synthetic command infrastructure. Preserve parent roadmap IDs on publication.

## Implementation contracts

### Boundaries and reusable infrastructure

Add `i18n` for catalogues/formatting/search keys and `documents` for template/font
assets and rendering. Keep policies in core, SQL implementations in db, storage
and logging adapters in platform and queue orchestration in jobs. Extend build,
Knip, artifact and boundary checks for the real package boundaries. Browser
imports remain limited to contracts, UI, i18n and typed module clients.

Use the existing verified owner/shop transaction seam. API factories accept
composed services, not database implementations. Extract reusable request
binding, replay/version handling and job guards without importing synthetic
types into new production modules. Keep old fixture proofs green and old demo
routes absent. Install exact approved dependencies only when their slice uses
them; resolve current Context7 documentation and verify compatibility first.

All new tenant tables use shop-led keys/indexes, composite tenant foreign keys,
ENABLE/FORCE RLS and fail-closed read/write policies. Runtime remains app_user.
Reviewed additive migrations provision queues with migration authority. Audit,
idempotency, business changes and enqueue commit together. No runtime DDL.

### Drafts and online behavior

Provide typed PUT/read/list draft operations and registered promotion commands.
The client creates a UUIDv7 when a form opens; only after a committed save does
the opaque draft ID enter the URL. Drafts record creator/workflow/status/version
and timestamps, and are not authoritative business records. Separate incomplete
draft and complete command schemas. The production workflow registry initially
contains no synthetic workflow; unsupported workflow types fail closed.

Existing-record writes require If-Match and every mutation requires a bound
idempotency key. Replay the identical committed request before rejecting its
now-stale version. Preserve 428 missing precondition, 412 stale, 409 domain
conflict and 422 validation/changed binding. Promotion validates current state,
does not copy approvals and atomically marks the draft promoted with its result.

Serialize approximately one-second debounced saves; pause during composition.
Retain the exact uncertain key/payload until its outcome is resolved before
sending later edits. Show Saving/Saved/Not saved/Checking outcome/Conflict.
Committed values survive reload/reopen/second device; failed current edits
exist only in the open page's memory. Do not automatically merge conflicts.

### Media and storage

Provide typed POST upload admission, POST completion and authorised GET file
operations. Purpose/subject policy comes from trusted current repositories,
never a browser consent boolean. Unknown subject authority denies. Synthetic
consent adapters are test-only; real customer/guardian/notice workflows remain
in 1.1.3/0.5.2, with integration revalidation before activation.

Signed PUT/GET links last about five minutes. Upload into staging, then seal
validated bytes under private shop-prefixed immutable keys. A reusable upload
URL cannot overwrite accepted bytes. Record object identity/hash and processing
attempt state; expose only ready accepted assets. Do not claim immediate
revocation of a previously granted URL beyond its bounded expiry.

Content/structure/type/size/pixel validation controls acceptance. Re-encode
images, rotate and strip EXIF/GPS, then generate display/thumbnail derivatives.
Serve non-image user files as attachments, without executing uploaded content.
Quarantine/failure status has safe retry guidance. Publication remains absent,
with explicit minor/private-fitting prohibition at the data/policy boundary.
Cleanup excludes referenced keys, active attempts and accepted history; real
retained-file erasure requires the later approved privacy machinery.

### Documents and jobs

Document language, A4-default/A3 size, immutable source model and template/font
revisions are fixed at issue. Retain versioned assets and record the final PDF
hash. Queue pdf.render in the issuing transaction with docId:revision singleton
identity and three retries; durable per-revision uniqueness outlives queue/key
retention. Never replace an accepted PDF by rerendering current data.

Render with headless Chromium on demand, concurrency one and approximately
60-second idle shutdown. Use embedded trusted assets, fresh contexts, no user
URL fetches and verified non-root sandbox operation. Record failures separately
from the committed issuing command. Recheck authority, epoch and attempt before
accepting results after external I/O. Reconcile unreferenced output after crashes.

Register only media.process/pdf.render and necessary maintenance in supported
production runner compositions; never restore foundation demo handlers. Preserve
shutdown, retry, dead-letter, current-authority and restore quarantine behavior.

Fetch an authorised PDF before the Android share tap, then use file sharing
where supported and a separate WhatsApp text tap. Desktop downloads before
manual attachment. Cancellation is not sent. Record prepared/marked sent only.
Bill/receipt/job-slip content and numbering remain later business capabilities.

### Observability and privacy

Use tenant-isolated allowlisted events with named metric definitions, date
basis and N/A treatment. Deduplicate committed action events on retries. Attach
draft/media/PDF instrumentation when those slices land; do not fabricate pilot
outcomes or add future messaging/AI SDKs. Support effort is explicit recorded
duration/category, not free-text customer content.

Scrub pino/Sentry with an allowlist that excludes names, phones, measurements,
form bodies, file content, signed URLs and credentials. Disable replay/default
PII and leave external delivery unconfigured pending approved activation.
Query cache is memory-only, shop/identity-scoped and cleared with in-flight
cancellation and stale-response rejection on access changes. Safe URL filters
never include personal search text. The service worker caches fallback assets
only and never activates an update mid-form.

## Verification and completion

Every slice maps its acceptance IDs to fresh evidence, runs the existing lint,
Knip, strict types, relevant unit/property/real PostgreSQL/S3/browser checks and
production build, and records skipped checks. At integration/closeout run fresh
pnpm verify, pnpm test:ui, audit and applicable clean-install/Linux checks.
Tests expose requirement/scenario IDs; mocks do not establish RLS or queue
atomicity. Review history/isolation consequences explicitly in each PR.

Required screen evidence: 360x800, tablet portrait and landscape, 1440x1000;
English/Tamil, both themes, keyboard/focus, axe, 44px controls, zoom/reflow and
manual screen-reader review. PWA checks inspect actual caches/storage/network,
auth invalidation races and updating with unsaved values. Draft tests include
lost responses, concurrency, promotion replay/rollback and cross-device resume.
Media tests include forged authority, malformed content, metadata stripping,
PUT reuse, duplicate completion, processing crashes and safe cleanup. PDF tests
cover about 50 reviewed difficult Tamil strings, font embedding, page dimensions,
blocked remote requests, sandbox evidence, crashes and unchanged accepted bytes.

A test-only local HTTPS preview must support a nearby physical Android phone
without publishing a hosted service or exposing retained data. Document local
certificate trust, narrowly scoped access, startup and teardown. Record actual
device/RAM/browser, Tamil reviewer, camera/HEIC/notebook legibility, IME,
PWA install/reopen and WhatsApp sharing observations. Do not mark the phase
accepted while physical or fluent Tamil review is outstanding.

The ten approved issues were published through gh with native blockers and
verified bodies/edges. Start only 0.4.1a (#51).
Use one topic branch at a time, owner/CI review before each merge, and verify
integrated main before dependent work. No automatic merge, deployment or
production activation is implied. Full privacy, recovery and pilot gates remain.
