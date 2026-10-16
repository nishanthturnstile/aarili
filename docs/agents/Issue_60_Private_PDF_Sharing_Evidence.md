# Issue 60: private PDF preview and manual sharing

Slice 0.4.4b, product USE-01/02/07/09, COM-04/06, TRU-03/07 and AC-64
job-slip foundation; architecture §§7.1–7.3, 9.2–9.3, 11.4 and 15.
The published ticket/roadmap scope is unchanged. Business-specific documents,
numbering, customer links, automated messages and external services remain absent.

## Prerequisites and implementation boundary

Direct native blocker #59 closed through merged PR #70. Clean main at `c84a812`
was current with origin/main; integrated production build (12 tasks), real
PostgreSQL readiness/outage/typed-client/worker-shutdown smoke and private browser
artifact check passed before creating `codex/issue-60-private-pdf-sharing`.
The existing checkout is used sequentially. No worktree or implementation agent
was created. Local policy commit `f7c5e4e` remains on its separate unpublished ref.

Ordinary application composition stays default-deny with no synthetic document
template enabled. The reusable browser surface is connected to typed authorised
clients; only the isolated test host selects a synthetic document. Future feature
hosts supply an authorised selection and intended phone. WhatsApp text is a fixed
reviewed bilingual literal, never arbitrary model/customer content or internal
costs. The displayed intended phone can be checked before opening the separate
text action. No test opens a real share target or sends a message.

## Acceptance mapping

| ID | Implementation and evidence |
| --- | --- |
| J1 | Selected-document component lazily checks status then loads `/file` through the typed client only after an explicit preparation tap. The server authorises the immutable row under `withOwnerDocument`, reads bounded private storage bytes and verifies SHA-256; browser verifies the same expected hash before constructing a File/object URL. The preview is that exact accepted PDF, retaining its issued model/template/font/language/paper rather than rerendering current data. Unselected documents fetch nothing. |
| J2 | Preparation finishes before the enabled native-share tap. `canShare({files})` detects actual capability; `share({files})` runs synchronously in the tap handler before any awaited work. No URL/text is passed with the file. Unsupported capability exposes download/manual attachment instructions. Browser tests assert live user activation, file size/type, cancellation, failure, success and fallback; these are controlled native-API stubs, not physical Android proof. |
| J3 | A separate explicit action opens the literal bilingual text at the displayed E.164 phone through wa.me, with noopener/noreferrer. Downloads use the same prepared File and neutral opaque filename. Neither signed URLs, private content, costs, phone nor text enters sharing-history/audit/product-event payloads. Test intercepts `window.open`; no external message is sent. |
| J4 | Migration `0015_document_sharing.sql` adds append-only attributable prepared/marked-sent events, linked to accepted artifact hash, actor and deferred audit FK. Forced RLS, composite tenant/document/actor/preparation FKs, actor/hash guard and no runtime UPDATE/DELETE protect history. Per-shop durable key/hash binding replays after generic key expiry. Core locks and commits event/audit/replay together. Marking is a separate owner action; share resolution/cancellation/failure never marks sent. PG and browser tests prove duplicates, changed payloads, loss of acknowledgement, concurrency and rollback. |
| J5 | Explicit bounded request timeout, safe storage/access errors, same-key history reconciliation and existing status/retry controls. Memory File/object URL expires after two minutes; selection unmount, sign-out/shop switch and denied access release it and clear displayed history. Generation/abort checks reject late bytes. No storage persistence or service-worker cache path is added. Already downloaded/shared copies are outside app control. Tests cover storage outage/recovery, expiry and access loss during a held download. |
| J6 | Connected browser/API/real-PG/S3/render fixture covers both languages/themes at three viewport classes, 320px reflow and tablet landscape, keyboard download, focus, axe, 44px actions, capability/cancel/fallback, repeated same-key history and revoked URLs. Server integration proves cross-shop/missing-context denial, immutable bytes/history and durable replay. |
| J7 | `scripts/review-document-sharing.mjs` creates a temporary synthetic HTTPS fixture with one-day certificate and bounded local interface binding. Loopback `--smoke` validates TLS readiness and automatic teardown. [Local HTTPS instructions](Local_HTTPS_Review.md) cover single-phone/private-network firewall scope, certificate trust verification and removal, downloaded-file cleanup and forced-exit recovery. No trust or firewall setting is changed automatically. |
| J8 | **Deferred by explicit owner instruction.** No actual Android model/RAM/browser, genuine HEIC/notebook capture, Tamil IME/reconnect/PWA install/reopen, native file/text target or fluent Tamil review is claimed. Chrome viewport checks and technical Tamil PDF goldens remain automated evidence only. Outstanding human/device review blocks phase acceptance. |
| J9 | [Phase closeout evidence](Phase_0_4_Closeout_Evidence.md) maps every A–J criterion group to retained evidence plus fresh integrated-candidate checks, distinguishing reviewable implementation from phase/live activation acceptance. |

## Verification record

Environment: native Windows, pinned Node 24.21.0/pnpm 12.11.2, Docker Desktop,
bundled Chromium 156.0.8078.4 and installed Chrome 155.0.8059.80. Local checks tested
`c84a812` plus the #60 working diff. Separate uncommitted workflow/architecture
documentation and CI-trigger edits appeared during verification; they are preserved
and excluded from this issue's commit. They do not change the tested runtime.

| Command / evidence | Actual result |
| --- | --- |
| `pnpm verify` | Lint, Knip, strict/negative types, OpenAPI and **151 unit tests** passed. It initially stopped in the existing Linux PDF idle-close test's fixed 180ms sleep. The test now observes actual browser disconnection within a bounded five-second budget, retaining the close/relaunch assertions. Passing stages were retained. |
| `pnpm test:pdf` after that correction | Passed actual non-root namespace/seccomp sandbox proof, four embedded fonts, 50 synthetic Tamil/mixed strings and all five A4/A3 golden pages. No reference binaries changed. |
| Remaining verify stages: `pnpm test:integration`, `pnpm build`, `pnpm smoke`, `node scripts/check-artifacts.mjs` | **95 integration tests / 21 files**, 12-task production build, real-PG readiness/outage/typed-client/worker-shutdown smoke and 29 private browser-artifact checks passed. The sharing race was subsequently strengthened to use both real PostgreSQL connections and its focused test passed again (9.26s). |
| Final `pnpm typecheck`, lint, Knip | Passed 23 workspace type tasks, canonical tokens/PWA assets, restricted imports and unused-code checks. The final preview change also receives the affected production web type/build check. |
| `pnpm test:ui` | **82 passed, 2 failed** initially. Existing tablet Tamil/light draft pagination observed the Docker database clock moving backwards during fixture setup; one existing desktop English owner fixture failed to boot. All new sharing cases passed. |
| `node scripts/test-ui.mjs --last-failed` | Only those two failures ran once: **2 passed** (54.8s). Passing browser cases were not repeated. The original failures remain documented as environment/fixture flakiness; no draft/owner business logic was changed. |
| Installed Chrome sharing suite | All **3 viewport cases** passed, including English/Tamil, both themes, keyboard download, focus/axe, active-gesture sharing stubs, fallback/cancel, two-minute expiry and late-response clearing. After adding fitted preview parameters, only the affected sharing cases ran again: **3 passed** (1.8m). |
| Visible-frame Chrome captures | Phone 360×800, tablet 820×1180 and desktop 1440×1000 render the complete accepted Tamil PDF page without clipping after fit-to-width. Native PDF compositing paints only visible frames, so the capture scrolls the preview into view. Actual reading comfort, fluent Tamil and physical-device acceptance remain deferred. |
| `node scripts/review-document-sharing.mjs --address 127.0.0.1 --smoke` | Passed certificate-validated HTTPS readiness and teardown; temporary certificate directory removed, no listener left on 3443 and disposable data stopped. No trust/firewall changes were made. |
| `pnpm audit --audit-level=low` | No known vulnerabilities found. |

Local evidence logs/captures use `.scratch/issue60-*` and
`.scratch/pdf-preview-visible-{phone,tablet,desktop}.png`; they are synthetic-only
verification output, not shipped assets. Hosted clean-install/Linux PR checks
remain a separate current-revision gate and are reported in the PR. Extra full
local clean-install verification was not repeated: dependencies, lockfile and
package exports are unchanged; the explicit PDF/Linux runtime proof ran locally,
and hosted CI performs the full frozen install and Linux suites.

Development failures corrected: Playwright's module rewriting intercepted the
retained native template loader, so the browser fixture now runs in a separate
native Node process with finite synthetic IPC controls. A clock installed after
the expiry timer did not control it; the test installs its clock before navigation.
The temporary host's unsafe-origin check now uses its explicit origin, independent
of Next's internal Request URL normalisation. These are fixture corrections;
ordinary API origin defence and native template identity remain enforced.
The preview uses `#view=FitH&navpanes=0`, supported by
[Chromium's PDF parameter parser](https://github.com/chromium/chromium/blob/main/chrome/browser/resources/pdf/open_pdf_params_parser.ts),
to fit the page without spending the narrow panel on thumbnails. Browsers without
inline PDF support receive explicit download/PDF-reader instructions.

## Manual review packet (when requested)

Physical/Tamil review is deferred; no owner terminal-test replay is requested.
For a later supervised review, use [the prepared local HTTPS host](Local_HTTPS_Review.md):
`node scripts/review-document-sharing.mjs --address 127.0.0.1` opens the isolated
synthetic surface at `https://127.0.0.1:3443` after temporary certificate trust is
prepared. A nearby phone uses its explicit private LAN address and narrowly scoped
firewall rule as documented. Never bypass certificate verification or send the
placeholder recipient a real message.

1. J1/J5: Prepare PDF; check the immutable Tamil text and page size, close/reopen
   the preview, and confirm sign-out/switch clears it. Unsupported viewers should
   provide download instructions.
2. J2/J3/J4: With the intended test recipient deliberately configured for that
   future session, cancel native file sharing and confirm no marked-sent entry;
   try download/manual attachment and the separate text action. Mark sent only
   after actually sending a supervised synthetic message; never infer delivery.
3. J6/J8: Switch language/theme, inspect wrapping and focus, then record any actual
   device/Tamil observations in the deferred review packet rather than treating
   browser automation as human acceptance.

Response format: `acceptance ID — pass/fail — observation`.
Ctrl+C tears down processes/data; remove temporary trust/access/downloads using
the linked cleanup instructions. Code/CI review and merge authorisation remain
separate from this later human session.

## Review, recovery and activation

The SQL change is additive and retained: run only with the reviewed advisory-locked
migration runner, with a backup before retained environments. Roll back compatible
UI/API source while retaining the table, accepted artifacts and all history; do
not drop the history or rerender PDFs. This PR does not apply a production migration.
No money, stock, custody or approval state is changed. Sharing events are owner
statements, never provider delivery/read receipts or approval/payment evidence.

Current adapters deny unconfigured business templates; no live data, hosted tunnel,
provider delivery, deployment, privacy activation or automatic promotion occurs.
Owner/CI review and explicit merge remain required. Physical/Tamil review and the
later privacy/retention/consent/business-template/restore/pilot gates remain open.
