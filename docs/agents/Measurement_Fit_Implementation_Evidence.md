# Exact-version private fitting references — #155 / 1.3.2c

Implementation started **23 October 2026, 08:40:40 UTC** after the owner selected
[#155](https://github.com/nishanthturnstile/aarili/issues/155). The existing checkout
was clean, `development` was pulled with `--ff-only` to `5cfd399`, and work uses
`codex/measurement-fit-references`. Direct blockers were closed with merged PRs:
#154 → #161, #57 → #67, #58 → #69, #148 → #151. PR #162's documentation closeout
was also merged. No worktree, dependency correction, merge or deployment is included.

Product §§3/7/9–10/13/24–25/27/29.1/30.1/32–33, architecture §§6–11/15,
[design MV-D13–15](Measurement_Versions_Design.md) and
[packet C](Measurement_Versions_Ticket_Packet.md) govern this change.
Traceability: MEA-11 and continued MEA-03/04/07; TRU-01/03/05/06/07/08/10/13;
USE-01/03/07/08/09; AC-06/38/40/52/53/55/56.

## Implemented boundaries

- A typed fitting subject belongs to one wearer and measurement session. Its ID
  is the initial version ID. Accepted images may be explicitly selected for
  versions of that same session; another wearer or session cannot borrow them.
- Each reference freezes the exact measurement version, accepted asset and
  original/display/thumbnail hashes. Replacement appends a predecessor, actor,
  timestamp and private reason under expected-head concurrency checks. Independent
  image references have independent roots. Neither attaching nor replacing an
  image modifies numeric values or changes an order's selected version.
- Saved-version history offers optional private upload and exact-reference reads.
  Existing form definitions, conversion, precision, validation and explicit garment
  selection remain authoritative. No photo is required to save/select measurements;
  no image is inherited by a correction or repeat order automatically.
- Existing private image upload/processing limits apply. The API and worker both
  compose measurement authority around the existing media policy. Every stage
  requires current measurement and separate photo authority. A minor measurement
  grant alone is insufficient; unknown age or unavailable guardian authority denies.
  Generic media signing and design/public ownership cannot retrieve these assets.
- Captions, correction reasons and draft/replay values use private stores. Owner
  access loss clears them from memory; a photo-only withdrawal leaves authorised
  text usable. Ordinary service failure preserves draft input and exact retry state.

## Migration, erasure and recovery

Additive `0048_measurement_fit.sql` adds seven tenant relations with composite
ownership constraints, shop-led indexes, forced RLS and immutable/audited writes.
It extends the existing measurement privacy function, retaining the original
function behind a non-public wrapper. No historical image/value/form/order snapshot
is fabricated or rewritten. The populated 0047→0048 fixture checks those snapshots
and inert migration reapplication.

Erasure redacts captions and private draft/replay copies and commits immutable
per-asset purge intents with the existing `media.process` queue in the same
transaction. Retained originals, accepted variants and every processing claim
prefix are enumerated. Staging deletion waits until the existing signed PUT expiry;
this introduces no retention duration. Each deletion rechecks current job principal,
erasure provenance, restore epoch, outbound controls and scope, then records an
audited receipt. A crash after deleting bytes but before committing its receipt is
safe to retry. Protected fitting output writes hold the same authority/session/media
barriers through object I/O so an older processor cannot recreate bytes after purge.

The erasure adapter is an explicit worker capability. Ordinary upload/signing has
no retained-object deletion authority. The production default does not enable this
adapter or a retention schedule. Media metadata and immutable reference IDs remain
as provenance while current erasure blocks signing. Previously issued signed URLs
remain bearer capabilities until expiry or actual object removal; erasure cannot
recall copies already downloaded.

Primary synthetic S3 deletion is testable here. Approved production retention,
backup expiry/tombstone reapplication, processor deletion, exports/downloaded copies,
restore drill, final forms/privacy configuration and physical-device/Tamil/assistive
technology acceptance remain activation gates. Orphan cleanup is not retention.
Back up before applying outside disposable fixtures. Deploy compatible web/worker
readers together; rollback keeps additive tables/history and denies unsupported
reads. Never down-migrate immutable history or restore live data into development.

## Development validation (not final frozen evidence)

- Package build passed after correcting an internal auth repository accessor
  (**14.061s**); later package build passed **14.42s**. Strict typecheck passed
  **23 tasks, 14.32s**. Knip passed after adding the review script.
- Initial PG/S3 reference workflow passed **17.84s**. Expanded run exposed a
  missing required `If-Match` in the new completion test (428); the fixture was
  corrected without weakening the API. Expanded five-case run passed **67.35s**.
- C/B/design-consent integration run: **13 passed, 194.52s**. Subsequent test
  strengthening adds real queued purge, exact replay/pagination and simultaneous
  replacement evidence; final source verification remains pending.
- First phone run exposed unsaved subject preparation: its form has no editable
  fields to trigger debounce. Opening it now explicitly saves the initial draft.
  The next run exposed premature removal of an in-flight lost-response interceptor;
  the test now waits for promotion before removing it. A later Tamil failure is
  under diagnosis. These attempts are retained as failures, not passes.

## Current acceptance evidence

The strengthened C file passed **6 tests / 81.97s** at base `5cfd399` plus this
working patch: command **10:03:16.412–10:04:40.209 UTC**, **exit 0 / 83.797s**
including package preparation. Its normalized **826-file** source fingerprint
was unchanged: `de37455875c20276ad00220573b60a595ce0fed5a5ace9fd2de6b53093999218`.
Raw logs/metadata are local under `.scratch/measurement-fit-validation/`.

| Acceptance | Current concrete evidence | Remaining qualification |
| --- | --- | --- |
| MV-C01 | PG exact asset/version hashes, append-only correction/history, unchanged measurement response; populated upgrade preserves selected order/form/design snapshots. | Existing A/B save/select scenarios remain in the full regression run. |
| MV-C02 | PG minor measurement-only denial, separate photo grant/withdrawal, same-payer foreign wearer denial, unknown-age denial, completion/processing races; UI photo-only loss preserves text and erasure clears both. | Production guardian/privacy configuration and human policy review stay gated. |
| MV-C03 | Actual generic original/variant access denied; design specification draft rejects the fit asset; wrong upload purposes and direct unrelated `media_reference` insert rejected. Shop isolation catalog checked. No gallery/public fitting path exists. | No public/repeat photo publication or ownership transfer is introduced; existing design/merge/repeat regressions remain in full verification. |
| MV-C04 | PG exact-once replay, two simultaneous replacements yield one success/one stale response, old caption/hash preserved, 25+1 history pagination; UI real failed processing, read outage/retry and lost association response preserve text. | None for the focused automated scenarios; full regressions pending. |
| MV-C05 | Real PG/S3 erasure rollback, private-copy scrubbing, signing denial, actual queued retained purge, delayed staging eligibility, stale restore epoch, receipt rollback/retry and output-write/erasure barrier. | Production backup/processor/export retention and explicit erasure adapter activation remain open. |
| MV-C06 | Phone **48.0s**, tablet **48.4s**, desktop **48.5s**; each runs English/light + Tamil/dark, keyboard, zero axe violations and 320px reflow. Independent bounded UI review: ship. | Full browser regression and human physical-device/fluent-Tamil/AT acceptance pending. |

`pnpm verify:clean` began **10:05:23.802 UTC**: native frozen install passed
**52.8s** in a disposable path containing spaces. Lint/boundaries/tokens, Knip,
strict typecheck (**23 tasks**), **311 unit tests**, negative types and OpenAPI
passed. PDF/full PG/build/smoke/private-canary results are still pending.
Only the manual review launcher changed after that copy: seeding moved before the
live queue and generated bytes were corrected from PNG to their declared JPEG.
Comparison of all **826 copied inputs** found exactly that launcher difference;
all feature/config/test inputs match (`42a7eb8a53f573915a62fa008509e040f44796eee55f986a718d73acf0dffb2a`,
excluding review launchers). The current launcher passed scoped Biome and Knip and
was exercised below. This is not an unchanged-whole-tree verification claim.

## Running synthetic manual packet

Access file ready **10:08:39 UTC**; normal owner sign-in checked **10:09:38 UTC**.
Open **http://127.0.0.1:53582/sign-in**. Credentials stay only in
`.scratch/measurement-fit-review-host/private.json`; never copy them to Git/chat.
Startup after teardown: `pnpm build:packages`, then
`pnpm exec node scripts/review-measurement-fit.mjs`; read its fresh dynamic URL.
The earlier cancelled B/history host is obsolete. This host contains only labelled
non-body private research imagery, synthetic measurements and synthetic authority.

1. **C01/C06:** Sign in, open Measurements, then its saved observation and Private
   fitting images. Text remains `12 1/4 in`. Open reference 1 and 2: the original
   caption remains attributable after replacement. View either private image; only
   the labelled research fixture appears. T3 normal sign-in and original-image
   load (320px natural width) were checked; text remained unchanged.
2. **C01/C04:** Attach an image to this version, inspect the ready-image selection,
   caption/reason and saved/not-saved feedback. Cancel or save only synthetic input.
   The garment selection remains independent. For a read failure, hide an image,
   use the browser's offline setting, try viewing, then restore online and retry.
   The measurement text stays readable; processing/read failure is already automated.
3. **C06:** Switch English/Tamil and theme; try keyboard-only operation and narrow
   phone/tablet widths. Report language/usability/device findings; automation does
   not replace a fluent Tamil, screen-reader or physical Android observation.
4. **C02/C03/C05:** Permission, foreign/public access denial and erasure races are
   established by the named real PG/S3/browser tests above. No privacy-admin or
   production activation shortcut is added to this review page.

Report `MV-Cxx — pass/fail — observation`; include browser/device/RAM only for
actual-device reports. Human findings and owner merge approval remain pending.
Teardown: `pnpm exec node scripts/review-measurement-fit.mjs stop`; the host cleans
its loopback web process, disposable PG/S3 and private access file. It does not
delete the owner's ordinary development database or use external/live data.

Final full command/browser evidence and PR remain pending. No completion, human
acceptance or live-readiness claim is made yet.

**UI review.** Reviewed `measurement-fit.tsx`, `media-upload-form.tsx`, incumbent
`measurement-sessions.tsx` and `packages/ui/src/globals.css` against all six
phone/tablet/desktop English/light and Tamil/dark captures in
`.scratch/measurement-fit-captures/`. The extension preserves incumbent typography,
surfaces, controls and spacing; optional disclosure, separate photo permission,
exact-version provenance and Tamil wrapping remain clear. Supplied workflow evidence
reports passing axe, keyboard and reflow checks at all three sizes; the detector
returned `[]` and the independent finish review returned **ship**, with no fixes.
That verdict covers this ordinary Operate UI extension only; it does not establish
feature completion, physical-device acceptance or activation readiness. Pre-existing
absence of `PRODUCT.md` and `DESIGN.md` remains unchanged; no new visual world,
shared tokens or drift repairs are introduced.
