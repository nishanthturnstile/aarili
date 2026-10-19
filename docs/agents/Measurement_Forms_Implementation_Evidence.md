# Measurement form implementation evidence

Issue [#98](https://github.com/nishanthturnstile/aarili/issues/98), slice **1.1.2b**.
Sources: SET-04/08, MEA-01/02 definition contribution, DES-01; product §§6/13/32;
architecture §§6–9/11/15; [approved design](Service_Templates_Design.md) and
[ticket packet B](Service_Templates_Ticket_Packet.md). ST-02/07/10–12 apply.

## Scope and baseline

The owner requested implementation of #98. All direct blockers were verified
closed with merged PRs: #97→#102, #57→#67, #58→#69. The existing clean checkout
matched `origin/development` at `29423f60c9577e92d9c4a12d10eaa13316c60d84`.
[PR #103 CI](https://github.com/nishanthturnstile/aarili/actions/runs/39133485727)
passed Fast verification and Dependency audit. Work uses the same checkout on
`codex/1.1.2b-measurement-forms`; no worktree, reset, stash or dependency upgrade.
This implementation request does not authorize merge, deployment or live data.

The Settings measurement-form editor attaches to exact existing service and
optional composed-piece definitions. Blouse, top and bottom forms have independent
identities, drafts and publication histories. A standalone small service can
explicitly declare measurements not required, with a reason and no fields.
Unresolved applicability cannot publish. Construction/decorative questions are
rejected by the base-length-only DTO; no measurement values, conversions,
formulas, guessed ranges, thresholds or measurement-session approvals exist here.
Actual entry remains 1.3.2; operating manifests and Simple/Detailed preview remain
#99/#100, category binding remains #101. No order, money, custody, message or
production job is created. No production definition is seeded.

Each ordered group/field snapshot retains bilingual labels/hints, UUID identity,
stable lowercase field key and explicitly reviewed meaning. Renaming/reordering
preserves identity. A changed meaning or key requires a new field identity and key;
validation checks all historic revisions, including fields removed in intervening
revisions. Entry units are limited to inches/centimetres; default unit,
required/optional and positive decimal precision are explicit decisions. Missing
precision unit remains unknown even when an increment is entered. Precision is
entry granularity, not an invented tolerance or conversion calculation.

Publication retains the catalogue's proven definition/availability separation,
durable draft controller, actor/action/hash-bound keys, CAS preconditions,
explicit review/diff, exact-key retry, draft reload/recovery, conflict comparison,
read-only history and memory clearing on access loss/sign-out. Ordinary definitions
remain owner proposals; trusted synthetic fixtures remain synthetic. Configuration
eligibility does not grant production measurement authority.

Optional method illustrations reuse private media status/read authorization.
Only an already-ready manual-method image may be pinned by asset ID/version;
foreign, missing, stale, denied, fitting/wearer and minor rows fail. Current
subject-policy minor status also fails. No new purpose, upload pipeline or public
image route is introduced. Signed capabilities stay in component memory and are
issued by the incumbent row-authorized media route. Immutable references retain
media from ordinary unreferenced cleanup; approved privacy/retention remains gated.
The initial review fixtures intentionally use text method hints without images.

## Storage and rollback

`0026_measurement_forms.sql` adds form identities/current pointers, immutable
content and availability revisions, exact catalogue links and optional illustration
links. Group/field revisions are ordered immutable child snapshots inside the
versioned form JSON, rather than independently publishable records. All five
new tables have shop-led keys/composite tenant references, ENABLE/FORCE RLS and
restricted grants. Database guards enforce same-transaction draft/audit/pointer
provenance, protected history, stable historical field semantics and complete
relational references at commit. Core takes the catalogue transaction lock before
form publication; source edits/availability changes cannot race a reviewed pin.

Apply through the existing advisory-lock migration runner. Back up before any
non-disposable application. Roll back compatible application code while retaining
the additive schema/history; no destructive down migration. A populated upgrade
test preserves customer, adult/minor wearer, consent, calendar and catalogue rows
byte-for-byte through migration/reapplication and subsequent form publication.
Only disposable synthetic databases were migrated during this delivery.

## Requirement evidence

| Acceptance | Evidence |
| --- | --- |
| ST-02 independent blouse/top/bottom and explicit not-required small service | PostgreSQL create/reopen/revise/history tests; four seeded review forms |
| ST-02/07 stable identity and exact bilingual historical order | 100-case label/order property test; PostgreSQL rename/reorder and removed-field semantic-reuse rejection; explicit revision reads |
| ST-02 invalid/unresolved choices and references | Strict draft/command unit tests; real missing/foreign/wrong-kind/disabled/stale catalogue and media negatives; no inferred precision/unit/required value |
| ST-07/10 history, isolation and authority | Forced-RLS catalog assertion, missing-context zero rows, cross-shop current/history/list denials, immutable SQL provenance and synthetic versus owner-proposal scope |
| ST-10/12 retry, CAS and atomicity | Real concurrent same-key replay, changed-request/actor denial, first-publication and later-revision races, 428/412/409/422; injected failures after actual append/pointer/draft/audit/result writes with unchanged counts |
| ST-11 bilingual owner workflow | Focused Playwright/axe phone/tablet/desktop results below; Tamil composition, keyboard group moves, exact-key response-loss retry, reload/resume, read-only history, conflict/cancel/sign-out |
| Migration/recovery and incumbent preservation | Populated upgrade snapshot test; existing catalogue integration regression; final broad unit/type/build gates |

## Verification ledger

Tested base: `29423f6` plus the issue-local dirty scope. Logs are ignored local
`.scratch-98-*.log`; tracked code, migration, package-export, browser-boundary,
locale, tests, review scripts and evidence are the selected change. No dependency
or lockfile changes. Exact final source fingerprint and final results follow.

- Initial focused PostgreSQL: 3/3, 24.03s. Expanded optional-media attempt failed
  on an incorrectly constructed **test staging key**, then was corrected to the
  existing `shops/<shop>/staging/<asset>` convention. No runtime media constraint
  was weakened. Existing catalogue regression passed 2/2 in the combined run.
- Corrected form PostgreSQL: 4/4, 30.88s; the additive-upgrade test separately
  passed 1/1, 9.31s. These were followed by a final affected-policy rerun below.
- Fast verification passed lint/boundaries/tokens, Knip, strict types, **216/216**
  unit/property tests, negative type fixtures, OpenAPI and production build.
  A final minor-policy review change requires the affected fresh gate below.
- Clean frozen install/package build/new form and private-media exports: passed;
  lockfile unchanged. No new package/runtime dependency. This also exercises a
  temporary Windows path with spaces. Hosted Linux checks await publication.
- Initial browser matrix stopped at the existing admission limit after a real
  committed response-loss/retry. The test now waits and retries the pending key.
  The next matrix reached bilingual/axe captures and exposed a test locator that
  ambiguously matched form, group and field labels. It was scoped to the form
  name. GET draft's bare-record response was corrected in the new conflict test.
  Original failure logs remain retained; failed commands are not described as
  passes. No runtime rate limit or recovery behavior was weakened.
- Intermediate build failure caused by imports placed before the incumbent Bun
  triple-slash declaration reference was corrected by restoring that reference
  to the first line. No baseline correction or dependency change was adopted.
- Impeccable mechanical detector: exit 0, empty findings. Visual inspection of
  the actual bilingual device captures is recorded with final browser results.

## Owner review packet

Startup (pinned Node 24.21.0 and pnpm 12.11.2):
`pnpm exec node scripts/review-measurement-forms.mjs`. This starts a loopback
production-built synthetic host with a disposable database. Exact ready URL is
recorded below. Private sign-in is in
`.scratch/measurement-forms-review-host/private.json`; never copy it into Git/chat.
Choose Settings → Measurement forms. Use English/Tamil and phone/tablet/desktop.

1. Open each synthetic blouse/top/bottom form and the small-service no-measurements
   decision. Check independent labels, applicability and exact service/piece names
   (ST-02). All examples and precision values are synthetic review data.
2. Revise one form, rename a label, move a group/field with the keyboard, save,
   reload and reopen. Review/publish; inspect old history for unchanged labels,
   order, method hints and units (ST-02/07). Try changing meaning on the old key:
   publication must fail; remove it and add a new identity/key for new meaning.
3. Leave precision/unit/required unresolved; draft saving remains possible but
   review/publication stays blocked. Select not-required on the small service and
   supply a reason with no measurement fields (ST-02/12).
4. Type Tamil using the actual IME, check wrapped labels, focus, keyboard moves
   and the explicit definition-only text. Review screens must not request wearer
   values or claim measurement approval (ST-11). Cancel dirty edits and confirm
   the selected leave/keep choice is respected.
5. Human reports: `ST-ID — pass/fail — observation`. Fluent Tamil, physical Android
   (device/RAM/browser), assistive technology and business wording/content review
   remain pending, separate from automation. Owner merge approval stays separate.

Stop: `pnpm exec node scripts/review-measurement-forms.mjs stop`. The host removes
its disposable database/container and private access file. No tunnel, production
demo, live shop or provider activation is created.
## Final local results and handoff

- `pnpm verify:fast`: **exit 0**, observed complete at
  **2026-10-18T20:01:39+05:30** (`.scratch-98-gate.log`,
  `.scratch/issue98/.scratch-98-gate.exit`). All **216 tests / 50 files** passed,
  strict declarations/negative checks/OpenAPI passed, and the 12-task production
  build completed in **14.086s**. This includes the final current-subject-minor
  rejection; no source baseline/version change was needed.
- Final PostgreSQL command: `pnpm exec vitest run --config
  vitest.integration.config.ts tests/measurement-forms.integration.test.mjs`:
  **exit 0, 5/5**, **40.82s**; `.scratch-98-integration-final.log`.
  Existing catalogue regression: **2/2**, from the earlier combined run on the
  unchanged catalogue implementation.
- Final browser command: `node scripts/test-ui.mjs
  tests/ui/measurement-forms.spec.mjs --max-failures=1`: **exit 0, 3/3**, **4.0m**;
  `.scratch-98-ui3.log`. Phone 360×800, tablet 820×1180, desktop explicitly
  1440×900; English/light and Tamil/dark. All bilingual axe scans returned zero
  violations; reflow, IME, keyboard moves, response-loss/exact-key retry,
  reload/resume, invalid precision, publish/history, stale draft comparison,
  dirty-cancel choice, sign-out and static-only browser storage passed.
- All six actual editor captures under `.scratch/measurement-forms-captures/`
  were visually inspected. They preserve the existing palette, fonts, controls,
  reading measure and focus/disabled states; long Tamil labels wrap. Full-page
  captures include the existing fixed navigation at its capture scroll position.
  No visual identity change or claim of physical-device review is made.
- The clean frozen install/export check passed with unchanged lockfile;
  `.scratch-98-clean-install.log`. Its new-export/package-build result is reused
  after the small policy/test/review-helper changes because export/dependency
  surfaces did not change. The final helper itself was executed successfully.
- Review-helper setup attempts exposed two test-harness assumptions (sanitized
  session response has no user ID; callback `runtime` is a pg Pool, not a Drizzle
  database). Corrected the helper to read the existing synthetic bootstrap identity
  through its runtime credential and use a scoped app_user database adapter. Fixture
  seeding now calls the real membership-checked core draft/publication workflows;
  interactive HTTP admission limits remain unchanged. No privileged credential
  enters the web runtime. Original setup-failure logs remain retained.
- After that helper-only correction, fresh `pnpm lint` and `pnpm knip` both
  returned **exit 0**, `.scratch-98-lint-ready.log` and `.scratch-98-knip-ready.log`.
  No unaffected build/unit suite was repeated solely for this fixture correction.
- Source manifest: **531 files**, SHA-256
  `5c258689de8187d038343a83a27179a762fecad6f8c2d80e3c54235c31f272ca`,
  `.scratch/issue98/source-manifest.json`. Recomputed after verification with
  exactly the same hash. Documentation-only closeout follows this fingerprint.

The current review host was observed ready at **2026-10-18T20:05:04+05:30**:
**http://127.0.0.1:59673/settings?section=measurementForms**. HTTP **200** was
checked at **20:05:39 IST**. It remains running with four independent synthetic
form examples. Use the established private access file above. The source used
for the production build is unchanged; review-helper setup has its own fresh
lint, Knip and successful execution evidence.

Full `pnpm verify`, PDF/smoke/full-browser promotion suites and a separate Linux
verification image were not run for this feature delivery: this changes no PDF,
worker/runtime packaging, dependency or toolchain. Real PostgreSQL, the focused
browser matrix and a clean Windows install/export check were run locally.
Hosted Linux Fast verification/Dependency audit require a published PR. Publication,
owner acceptance/merge, fluent Tamil, physical Android/AT, production content and
pilot activation remain pending. No commit, push, PR, deployment or live data was
created by this implementation request.

Supplementary running-host Playwright/axe check:
`node .scratch/issue98/unavailable.mjs` exited 0, **6/6** (three sizes ×
English/Tamil). A real catalogue availability revision made the form unavailable
for new selection; exact historical content remained readable without an editor,
with zero axe/reflow failures. The original substring-locator assertion failure
is retained in `.scratch-98-unavailable.log`; corrected result is
`.scratch-98-unavailable2.log` and `.scratch/issue98/unavailable-results.json`.
The source was restored through a reviewed availability revision. No runtime
change followed.

Local implementation and review packet ready: **2026-10-18T20:10:24.6268398+05:30**. Human acceptance/publication/merge remain pending.

## Publication and merge authorization, 18 October 2026

The owner explicitly requested check-in, a PR to `development`, correction of
check failures and merge. That authorizes publication and squash merge after
required checks pass. It does not approve production content, human Tamil/device/
AT findings, deployment or live data. At the publication preflight, development
still pointed to `29423f6` and the 531-file runtime/test/tooling source manifest
remained exactly `5c258689de8187d038343a83a27179a762fecad6f8c2d80e3c54235c31f272ca`.
The unchanged PostgreSQL/browser/clean-install evidence above is reused; a fresh
`pnpm verify:fast` is recorded in `.scratch/issue98/publication-fast.log` with its
exit code in `.scratch/issue98/publication-fast.exit`. Hosted results and the PR
URL are recorded in the PR and the final handoff.
Fresh publication gate completed **21:17:28 IST**, **exit 0**: 216/216 tests,
50 files, lint/boundaries/tokens, Knip, strict/negative types, OpenAPI and the
production build. Production build: 12 successful tasks, 27.174s. Runtime/test
source inputs match the earlier PostgreSQL/browser source manifest; only this
publication record and delivery timing were added before commit.
