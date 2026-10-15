# [W0 0.4.3b] Validate and process private media safely

Published and approved as [issue #58](https://github.com/nishanthturnstile/aarili/issues/58) on 15 October 2026.
Implementation starts only after its direct blockers merge.

## What to build

Prepare photos for mobile data and process supported private images, documents
and voice notes into validated ready assets or understandable failure/quarantine
states. Repeated jobs and crashes cannot replace accepted bytes or cross tenants.

## Sources and scope

Roadmap 0.4.3; product TRU-03/05/07, USE-05/07, AC-39/53 foundations;
architecture §§5.3, 7.1, 10.1–10.2, 11.4–11.5, 15. JPEG/PNG/WebP images, PDF
documents/manual patterns and MP3/M4A/WAV audio only. No SVG/DXF/Office,
transcription, AI, pattern engine or execution of uploaded content.

## Blocked by

- 0.4.3a: private staging/sealing, policy, processing requests and storage adapter.

## Acceptance criteria

- [ ] H1: Client photo selection/preparation uses supported native decoding and
  canvas re-encoding around 1,600px/quality 0.8; reports errors without claiming
  an upload succeeded. Source limits are 20 MiB/40 MP; PDF/audio limits 25 MiB.
- [ ] H2: Server validates content signature/structure against the declared
  supported type and limit before acceptance. An audio/video container must be
  validated as the supported audio type. Mismatched/truncated/malformed inputs
  cannot become ready merely because the filename/MIME is plausible.
- [ ] H3: Sharp processing rotates images, removes EXIF/GPS and creates display
  and approximately 320px thumbnail derivatives with hashes under immutable
  keys. Bound decoding/pixel/resource use and safely reject decompression abuse.
- [ ] H4: Documents/audio stay private untrusted attachments. No browser HTML,
  uploaded PDF script, external reference or file-supplied instruction executes
  in application or rendering contexts. Public/gallery behavior remains absent.
- [ ] H5: media.process uses the production shared runtime, minimal locator
  payloads, current authority/epoch/attempt checks and durable uniqueness. The
  in-process and standalone registries agree and never register foundation demos.
- [ ] H6: Ready/failure/quarantine and safe retry are visible through reusable
  components in the test-only host. Duplicate jobs, shutdown, timeout and crashes
  between object writing/finalization leave one accepted asset set and reclaimable
  unreferenced objects. State changes during I/O prevent stale acceptance.
- [ ] H7: Actual local S3/PostgreSQL tests cover malformed supported formats,
  oversized/pixel-bomb images, EXIF/GPS, forged consent, cross-shop access,
  retry/concurrency/restore races and orphan cleanup. Media usage/event hooks
  report accepted bytes once when the private adapter is composed.
- [ ] H8: Measure HEIC and notebook-page legibility on the phase reference
  Android. If native decode is unsupported, show explicit JPEG/PNG conversion
  guidance. Record real findings and fluent Tamil review, not assumed support.

## Verification and delivery

Fetch current sharp/native browser documentation. Verify pinned sharp operation
on Windows and Linux with the existing dependency-build policy; do not silently
enable package scripts or add an unapproved processor. Run lint, Knip, types,
unit/integration/browser tests and build. Include the format/limit test matrix.

## Recovery and activation

Keep accepted originals/derivatives immutable; recovery changes processing code
or retries unaccepted attempts, never rewrites history. Real privacy purge and
consent integration remain gated. No new external storage resource is provisioned.
