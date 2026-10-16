# Issue 59: immutable versioned Tamil PDFs

Slice 0.4.4a implements the renderer foundation in #59. Sources are roadmap
0.4.4; product USE-07/08, COM-04/06, TRU-01/06/07 and the AC-64 foundation;
architecture §§5.3, 6.2–6.4, 8.3–8.5, 9.2–9.3, 10.2 and 15. The approved issue
scope is unchanged. #60 owns preview/manual-sharing integration; business
bills, receipts, numbering, job slips and pattern geometry remain later work.

## Starting point and boundaries

Implementation started from integrated main `c8f7a747bab703ba3ff6eea2fbcc5f949cc3158a`.
The direct native blockers #51, #54 and #58 were closed with their merge commits
on main. The frozen install, integrated production build, smoke and browser
artifact checks passed before branching. Main's hosted verification run
38890261217 succeeded. This issue uses the existing checkout and focused branch
`codex/issue-59-versioned-pdfs`; no new worktree or other issue was started.
The separate local policy commit `f7c5e4e` remains on
`codex/approved-parallel-worktree-policy` and is excluded from this PR.

The documents package is a real native runtime boundary. Core owns business
commands through repository/storage/renderer interfaces; DB implements tenant
transactions; API only authorizes, validates and maps results. Browser clients
import contracts and typed clients. The ordinary API and both job modes have
no business or synthetic template activation: absent policy/storage/template
composition fails closed. Synthetic templates and component hosts are test-only.

## Acceptance evidence

| Criterion | Implementation and verification |
| --- | --- |
| I1 | Immutable source JSON, language, default A4/A3, template code fingerprint, font manifest, creator and audit linkage. Revision, attempt, audit, replay result and locator-only job commit together. Real PostgreSQL tests cover rollback and unknown registry versions. |
| I2 | Queue singleton includes tenant/doc/revision with three retries. Durable revision and issue-key constraints outlive queue/replay expiry. Real concurrent render/delivery tests accept one artifact and two distinct deduplicated usage events. |
| I3 | Trusted registered static templates escape values. Four retained Noto Tamil/Latin regular/600 WOFF2 assets have SHA-256 validation and OFL notices. All fonts explicitly load before PDF generation. Changed template code under an old revision is rejected before launch; accepted historical bytes are served without rerendering. |
| I4 | Global concurrency one, fresh context, JavaScript/service workers/downloads disabled, CSP and request abortion, embedded assets only. Tests exercise escaped hostile content, denied remote/file content, serialization, idle release/relaunch and explicit close. Production idle is 60 seconds; the timer lifecycle test uses a shorter configurable interval. No arbitrary HTML/URL rendering endpoint exists. |
| I5 | Real Linux UID 1000 proof checks chrome://sandbox PID/network namespaces and seccomp, plus renderer /proc identity, zero effective capabilities, no-new-privileges and seccomp mode 2. The explicit restricted container profile is described in infra/pdf/README.md. Sandbox failures during initial probes were corrected with the upstream seccomp profile and bounded SYS_CHROOT capability, never a disabled sandbox. |
| I6 | Every transaction reauthorizes the initiating principal and current policy. Epoch, job, fence, active lease and control checks surround external I/O and acceptance. Five tenant tables have forced matching RLS, composite tenant FKs and immutable/provenance guards. Real tests cover policy/epoch changes, expired lease successors and final acceptance/shutdown veto after usage writes. |
| I7 | Hash-bound private keys are shops/{shop}/docs/{doc}/{revision}-{sha256}.pdf. Existing storage is hash-verified, never replaced with changed bytes. Acceptance records output/audit provenance. Explicit operator cleanup uses committed intentions, grace and fresh authority/epoch/lease checks, cursor pagination and exact deletion. Tests cover >20 outputs, partial deletion acknowledgement failure, late retries and accepted-key protection. |
| I8 | API, typed clients and reusable bilingual component expose pending/rendering/failed/ready, safe failure codes, ETags and explicit retry. Exhaustion, missing queue history, missing/stale If-Match and explicit replay are tested. Failed rendering leaves the original revision committed. An uncertain client outcome disables retry until status is checked. |
| I9 | Linux CI renders 50 synthetic difficult Tamil/mixed strings. Independent Poppler inspection checks embedded font programs, every row exactly once, repeated headers, multipage A4/A3 dimensions and escaped/denied content. Five reference page PNGs received technical visual review; regular checks compare pixels and page counts without regenerating references. Fluent Tamil review remains deferred and is required for phase acceptance. |
| I10 | Both supported modes share productionJobComposition and the documents runtime factory. Real queue/PostgreSQL/S3/native-render tests cover retry exhaustion, private failure reporting, worker shutdown veto, bounded resource-close failure and separate deduplicated pdf.rendered/media.stored events. No synthetic handler is enabled in ordinary composition. |

The status browser fixture tests component states/callbacks; it does not pretend
to be a connected business workflow. The API/queue/render/storage path is tested
separately with real PostgreSQL, private S3-compatible storage and Chromium.

## Verification record

The final `pnpm verify` attempt passed lint, Knip, full workspace types,
**151 unit tests**, all negative declaration fixtures (including six new document
uses), OpenAPI generation and ordinary Linux PDF golden comparison. Its full
integration run passed 73/94 cases and failed 21 cases at a shared old assertion
that only three production queues existed. The fourth queue is now `pdf.render`.
The three affected files were rerun after correcting both queue inventories:
21/22 cases passed. The remaining recovery case expected immediately due queue
retries; a bounded poll now waits for the real retry schedule while preserving
all six required quarantine results. Only that case and the seven PDF integration
cases affected by the Windows browser correction were then rerun: **8/8 passed**
(six unrelated recovery cases not selected). Together these runs provide passing
evidence for **all 94 distinct integration cases**. The unsuccessful full command
is not represented as a successful `pnpm verify` exit.

Final fresh lint/boundaries/tokens, Knip, native package types and the three PDF
unit cases passed after the renderer/composition refinements. Frozen installation
passed without lock changes. The dependency audit reported no known
vulnerabilities. The final Linux image rerendered the 50-string set and passed
all **five unchanged A4/A3 reference pages**, four embedded font programs,
namespace/seccomp proof, context isolation, serialization and idle cleanup.
Production build passed **12/12 tasks**; real PostgreSQL readiness/outage,
typed-client and worker-shutdown smoke passed; **29 browser artifacts** passed the
private configuration/import scan. A separate standalone inspection validated
all four retained font files against their manifest.
Scoped Git binary attributes protect the new WOFF2 assets and PNG references
from checkout newline conversion; all nine staged binaries were compared
byte-for-byte with the verified working files.

The focused component matrix passed **3/3 viewport projects in pinned Chromium**
(47.3 seconds) and **3/3 in installed Chrome** (38.7 seconds), including English
and Tamil, light/dark, all four states, explicit callbacks, axe, minimum target
height, 320-pixel reflow, tablet landscape and empty local/session storage.
The coordinator visually reviewed phone Tamil/dark, tablet Tamil/light and
desktop English/light captures: text wraps, controls remain usable and no
clipping was found. The one scoped mechanical design check returned no findings;
no visual-system or styling change was needed. Logs are
`aarili59-ui-chromium-final.log` and `aarili59-ui-chrome-final.log`.

Local evidence logs are retained under the operating-system temporary directory:
`aarili59-verify-final.log`, `aarili59-affected-jobs-final.log`,
`aarili59-affected-final.log`, `aarili59-final-static-unit.log`,
`aarili59-packaging-final.log`, `aarili59-packaging-final-3.log`,
`aarili59-standalone-final.log` and `aarili59-audit-final.log`.
These use synthetic data only. Hosted CI remains a separate PR gate.

## Runtime, packaging and recovery

Playwright Core is pinned to the approved existing 1.64.0 release; vendored
Noto assets use the existing 5.3.0 font baseline. No application dependency
version was upgraded. The generated lock additionally normalizes existing
optional debug/supports-color peer links without changing those versions.
The runtime image manifest pins Node/pnpm and browser distribution, limits CPU,
memory, processes and temporary storage, runs non-root/read-only without
network access, and retains the upstream seccomp license. Its small explicit
build context excludes local dependencies, environment files and unrelated
application data. Poppler exists only in the verification stage. This is a
resource/build manifest, not a host deployment or external service activation.

The production build caught Turbopack attempting to bundle the native font
directory through inactive job registration. Native construction now has the
explicit `@aarili/jobs/document-runtime` server entry; ordinary registration
imports only locator/transaction code. Both supported modes accept the same
composition value. The restricted Linux image independently verifies the actual
compiled renderer, browser dependency and assets. The ordinary web application
does not activate or embed that native renderer. Future authorized server
composition must preserve the documented native runtime/asset boundary.

Native Windows integration uses Playwright's pinned Chromium headless shell with
sandboxing enabled. A bounded launch probe confirmed this works after the bundled
full Chromium executable failed to spawn in this environment; no global cache was
modified. Linux production engine/sandbox/golden proof uses the pinned full
Chromium distribution. Installed Chrome provides an additional viewport matrix.
Viewport checks are technical layout checks, not physical-device tests.

Migration 0014 is additive and runs through the existing advisory-locked
migration runner. Back up before applying it. Compatible rollback retains all
document tables, accepted objects, models, font/template versions and audit
history; never drop retained data or regenerate a missing issued PDF as a
silent recovery. Stop processing/control outbound effects before an operational
rollback. A crash can leave a private unaccepted output; operator-only cleanup
can reconcile known identities after the minimum five-minute grace period and
fresh policy/control checks. Restart cursor scans to catch late object writes.
This is not a general retention/privacy erasure or bucket deletion facility.

No financial command, balance, stock, custody or issued-number behavior changes.
No browser storage, offline business caching, automated messaging, customer
access or live data is enabled. No deployment or production provider is created.

## Review and remaining gates

Self-review covers the actual source/SQL/lock/asset diff, cross-tenant access,
durable identity, stale output, immutable accepted bytes, cleanup, browser
imports and private error reporting. Owner review and CI remain PR merge gates.
No blocking code finding remains after the corrected queue inventory, bounded
recovery retry test, pinned Windows launch and explicit native composition entry.
Physical Android testing, fluent Tamil wording/shaping review and other
phase-wide device/pilot gates are deferred by the owner's instruction; technical
layout/golden evidence does not satisfy those human gates. Future business
template/hosting/privacy activation requires its own approved composition.
