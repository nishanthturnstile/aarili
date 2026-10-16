# Issue #58 — private media validation and processing

Slice 0.4.3b; predecessor #57 merged in PR #67. Implementation starts from
integrated main `909b2798594054f9661afbbdd2bbdef4ac77f194` in the existing checkout,
branch `codex/issue-58-media-processing`. No new worktrees, provider resources,
production activation, real personal data or document renderer were introduced.
The original local policy commit `f7c5e4e` remains on its separate unpublished branch.

Sources: product TRU-01/03/05/07, USE-01/02/04/05/07/09, AC-38/39/53 foundations;
architecture §§5.3, 6.2–6.4, 7.1, 8.1–8.5, 10.1–10.2, 11.4–11.5, 15;
[approved phase plan](Phase_0_4_Implementation_Plan.md). No scope allocation changed.

## Acceptance mapping

| Criterion | Implementation and executable evidence |
| --- | --- |
| H1 | `media-photo.ts` uses native `createImageBitmap` with orientation, checks 20 MiB/40 MP, re-encodes JPEG through canvas at a longest edge of at most 1,600 px and quality 0.8, releases native bitmap/canvas resources and reports conversion/preparation errors. PDF/audio retain the 25 MiB limit. Controller/browser tests prove selection is not upload or acceptance. |
| H2 | `private-attachments.ts` performs bounded structural parsing; `media-validation.test.mjs` covers positive formats, mismatched/truncated inputs, inconsistent PDF objects/streams/page trees/xrefs, invalid audio headers/tables/timing/sample ranges and unsupported profiles. Real S3/PG processing exercises each supported attachment and corresponding malformed input. See the explicit profile limits below. |
| H3 | Pinned sharp 0.35.5 decodes JPEG/PNG/WebP only, rejects animation and more than 40 MP, auto-orients and re-encodes the accepted primary in the declared format. Primary, display and thumbnail outputs all strip metadata; WebP derivatives use at most 1,600/320 px. Real storage downloads verify dimensions, metadata absence, hashes and separate immutable keys. |
| H4 | PDF/audio remain unchanged private untrusted attachments, served as downloads with safe filenames, attachment disposition and private/no-store headers. There is no HTML/PDF preview, autoplay, content execution, transcription or URL fetching. Uploaded instructions never become application authority. |
| H5 | Both shared runtime entry modes default to the same `productionJobComposition`, containing only `media.process`. Minimal locator validation precedes DB access; explicit trusted adapters are required. Current principal, subject policy, original initiator, durable attempt, restore epoch, fence and lease remain authoritative before and after storage I/O. Accepted/content-rejected redelivery is terminal without repeating effects. |
| H6 | Reusable page-memory upload/controller/form components expose preparation, uncertain upload, queued processing, acceptance, quarantine, exhausted retry and access-ended states. An uncertain completion replays its exact key/version; definitive rejections are not labelled unknown. Status reads authorize the asset before a jobs-package adapter returns an allowlisted phase. Real runner tests cover transient storage recovery, exhaustion, accepted redelivery, final-transaction veto and worker shutdown after usage writes. |
| H7 | Real PostgreSQL/Garage tests cover the new accepted set and usage once, forced RLS, foreign shops, late derivative insertion, partial storage writes, original/derivative immutability, retry rollback and explicit orphan reconciliation. Existing #57 real negative/concurrency/guardian/restore/fence tests continue to exercise the shared guards. Orphan cleanup is described below. |
| H8 | **Physical Android/HEIC/notebook legibility and fluent Tamil review are deferred at the owner's request.** Actual installed Chrome responsive rendering, native synthetic audio decoding, English/Tamil layout and axe are automated evidence only. A malformed synthetic HEIC proves the error/guidance path, not support for genuine HEIC or a phone camera. This PR does not mark physical phase acceptance complete. |

## Supported validation profiles and limits

- JPEG, PNG and single-frame WebP: 20 MiB source, 40,000,000 source pixels.
  Type signature and native decoded format must match. sharp warnings/truncation
  fail closed. Every accepted primary and derivative is re-encoded without
  EXIF/GPS/XMP/orientation metadata. Accepted staging snapshots are detached from
  mutable upload URLs. Staging objects themselves remain private and are not
  claimed to have been erased by this slice.
- PDF: a conventional cross-reference table, consistent subsection coverage,
  reserved free object zero, object offsets/identities, trailer size/root, catalog,
  parent-linked page tree/count/MediaBox and actual stream references for page
  contents. Streams require direct, bounded lengths and matching terminators.
  Encrypted, incremental, cross-reference-stream/object-stream, indirect page
  Contents arrays and indirect stream length profiles are explicitly unsupported.
  These can be valid PDF features outside this bounded profile. Re-export with a trusted app if
  necessary. The parser never decompresses streams or renders PDF content.
- MP3: MPEG Layer III framed data with valid bitrate/sample-rate/version fields,
  complete frame boundaries, bounded side-information fields, legal Huffman
  table indices, bit-reservoir bounds and frame/side-information payload lengths.
  Free-format encoding and other MPEG layers are outside this profile.
- M4A: one nonfragmented AAC-LC audio track with required movie/track/media
  headers, audio handler, self-contained data reference, AAC decoder configuration,
  matching channel/rate fields, sample sizes, sample-to-chunk mapping, chunk
  offsets, timing counts/duration and nonoverlapping in-range media-data spans.
  Video, encrypted/fragmented/multiple-track and other codec profiles are unsupported.
- WAV: RIFF/WAVE PCM or 32-bit float, valid channels/rate/bit depth/block alignment,
  byte rate, complete chunk boundaries and nonempty frame-aligned data.
- PDF/audio: 25 MiB. Compressed audio payloads are **not semantically decoded on
  the server**; there is no antivirus scan or claim that every corrupt compressed
  bitstream can be detected by structural validation. Attachments remain untrusted.
  The actual installed Chrome successfully decoded both synthetic compressed
  positive fixtures without playback. Bundled Chromium codec availability may
  differ; server structure/negative tests always run.

Parsing caps: PDF tokens/names at 4,096 bytes, nested values/page trees at 32,
100,000 cross-reference entries and 200,000 parsed/reference visits; MP4 at 50,000
boxes, 100 descriptors and 1,000,000 samples. Unsupported resource profiles fail
closed. The numeric grammar uses disjoint alternatives and bounded token scanning;
xref-valid long-invalid-number tests cover the previous ambiguous regex risk.

## Transactions, recovery and activation

Migration `0013_media_derivatives.sql` is additive. Back up first and apply using
the existing advisory-locked migration runner. It adds tenant-keyed forced-RLS
derivatives and technical cleanup intents, composite foreign keys, immutable
history guards and narrow runtime grants. A derivative insert must belong to the
exact transaction that made its asset ready (`xmin` compared with the current
transaction ID's low 32 bits), preventing later additions to an accepted set.
Legacy synthetic byte-only validators may still accept zero derivatives; normal
production validation returns the complete image set atomically.

Each storage seal uses a fresh opaque suffix under the claim fence. Hashes, all
variant rows, ready state, audit and one `media.stored` event commit together.
The event counts the sum of accepted primary and derivative bytes once. A caught
I/O/final-transaction failure releases only its still-owned processing lease so
automatic queue retries can recover. A process crash retains the durable lease;
queue expiry must outlast it. Both pre-write and final post-audit/usage shutdown
vetoes run inside the accepting/quarantining transaction. A database COMMIT already
in flight at shutdown can have an unknown acknowledgement; accepted redelivery
re-reads durable state and completes without another accepted set/event.

The shared runner is serial: one active cycle/job per process. Each image metadata,
primary, display and thumbnail operation has a 15-second native timeout, for up to
four sequential native operations (not a promised 15-second whole job). The durable
claim lease is 300 seconds. Real persisted job metadata confirmed a 900-second
queue expiry, three retries and a one-second retry delay. Caught-failure lease
release makes those retries usable; process crashes retain the durable lease.
40 MP is a pixel bound, not a 20 MiB working-memory bound. Synthetic resource
observations are recorded by the focused test and are not mobile performance claims.
In the stable full unit run, an 8,000×5,000 compressible synthetic JPEG was
processed in 921 ms; process RSS was 87→90 MiB and the process-wide peak was
383 MiB. Source bytes were 235,016; accepted primary plus derivatives were
238,124. These are one synthetic host observation, not a working-memory cap,
compression guarantee or representative notebook/phone performance result.

Normal owner adapters still deny unknown subject/consent authority. Production
storage and the subject/guardian binding require explicit reviewed composition;
no ambient credentials or environment consent flags activate processing. No
foundation demo consumer, public gallery, maintenance schedule or PDF job is
registered. Rollback must retain additive schema/catalog awareness and accepted
objects, and disable/revert compatible media composition; never rewrite accepted
bytes or deploy an incompatible arbitrary old catalog.

`reconcileMediaOutputs` requires an explicitly supplied server/operator-only
`createMediaOrphanStorage` capability. There is no cleanup endpoint or automatic
sweep. Under current tenant authority, restore control and an asset advisory lock,
it considers committed claim prefixes older than the caller's explicit grace
(minimum 300 seconds), up to ten claim prefixes and twenty candidate objects per
call. Storage returns a bounded first page of twenty keys per prefix; repeated
calls progress as removed keys leave the listing. Any referenced asset, active
claim lease, accepted primary or accepted derivative is protected. Every key must
be the exact known claim prefix plus one UUID suffix.

Deletion intent and audit commit **before** external deletion. A fresh transaction
then rechecks current authority, epoch, reference/accepted/lease state and caller
grace, deletes the exact unaccepted key and records completion. A partial crash
retries the pending intent and exact idempotent delete. After restore, a new audited
intent for the same object/current epoch preserves old epoch history. This is
technical unaccepted-output cleanup, not consent withdrawal or retained-file
erasure. Real privacy/retention/backup obligations remain later gates.

Real tests explicitly advance technical timestamps for simulated elapsed grace,
crashed job expiry and old claim age. A disposable synthetic fixture temporarily
disables the audit timestamp guard only to establish old claim age and restores it
in `finally`; application credentials have no such operation. This is fault/time
simulation, not evidence of waiting the full production lease/grace duration.

## Browser evidence and deferred review

Final installed Chrome **155.0.8059.80** and standard Playwright Chromium
**156.0.8078.4** matrices each passed all three grouped projects: phone 360×800,
tablet 820×1180 and desktop 1440×1000. Each matrix covers 12 viewport/language/theme
combinations, lost completion/replay, ready and quarantine states, no persistence,
320 px reflow, axe and 44 px buttons. The grouped tablet workflow also checks
1180×820 landscape. Native AudioContext decoding without playback confirmed the
synthetic MP3 and AAC-LC M4A fixtures in these Windows browsers; server validation
remains structural and does not decode compressed audio. The disposable Garage bucket
accepted narrowly configured CORS for the exact temporary loopback origin and
the browser used direct signed PUTs. This does not verify Railway provider behavior.
The helper has an explicit fixed-fixture proxy fallback if local CORS is unavailable;
it is never mounted in normal application routing and logs no capabilities.

Coordinator visual review accepted phone English/light, phone Tamil/dark,
desktop English/light and final tablet Tamil/dark captures without layout changes. No real-device,
camera/HEIC, notebook legibility, local HTTPS, screen reader or fluent Tamil review
was performed; these remain owner-deferred phase gates. Only Chrome viewport
emulation is claimed.

## Verification record

Focused package builds, strict types, Knip, unit/negative contracts and real PG/S3
tests were used during implementation. An initial 5-second default test budget was
corrected to the existing 120-second integration-fixture budget; a synthetic
`SELECT ... FOR SHARE` fixture was corrected to include the required UPDATE grant.
A browser assertion was narrowed to its owned section to exclude Next's route
announcer. These were fixture corrections, without production timeout relaxation.

Stable-code lint/boundaries/tokens, Knip, 21 build/typecheck tasks, all **148 unit
tests in 38 files**, negative contracts including six media misuse cases, and
OpenAPI generation (**13 paths**) passed in `aarili58-final-verify.log`.

The full integration stage recorded **81 passing / 6 failing cases out of 87**
in 19 files (579.42 s), so the original `pnpm verify` command exited 1. The six
failures were old expectations: three table inventories needed sorted new table
names, one registered-path inventory needed the new paths, normal runner
registration now includes `media.process`, and caught infrastructure failures
now release their lease. Four test files were corrected without changing runtime
code. The exact six cases then passed (18 unrelated cases skipped, 41.37 s) in
`aarili58-final-six-integration-recheck.log`; the other 81 cases were not rerun.
The lease test retains a separate explicit active-lease exclusion check and
proves immediate retry after usage rollback.

An initial production smoke found a real Windows standalone tracing defect:
Next copied sharp's native addon but omitted its dependent libvips DLLs. A narrow
portable `outputFileTracingIncludes` glob now includes installed sharp/libvips
runtime `lib/` files from pnpm's platform packages. No version, build-script
permission or processor changed. Fresh lint/Knip/types passed, then **11 production
build tasks**, real PostgreSQL readiness/outage/typed-client/worker-shutdown smoke
and **29 browser artifacts scanned** passed in `aarili58-packaging-build-smoke.log`.
Dependency audit found no known vulnerabilities (`aarili58-final-audit.log`).
The standalone output contains both DLLs and the native addon. Linux sharp/native
packaging validation remains the hosted Linux CI gate; no local Linux run is claimed.

Final affected standard-engine browser matrix passed **3/3 projects** (1.3 min,
`aarili58-final-ui-chromium.log`, exit 0); installed Chrome passed **3/3 projects**
(1.4 min, `aarili58-final-ui-chrome.log`, exit 0). Both used actual direct signed
Garage PUTs with scoped fixture CORS. These logs, like the preceding verification
logs, are retained in the local temporary directory. The initial full `pnpm verify`
is not claimed to have exited successfully; the passing retained and targeted
evidence above is reported explicitly.
The coordinator reviewed the actual final diff, corrected test expectations,
standalone tracing configuration, browser captures and final output logs. No
blocking code finding remains. Hosted CI and owner review remain PR gates;
physical-device and fluent Tamil acceptance remain deferred as recorded above.
