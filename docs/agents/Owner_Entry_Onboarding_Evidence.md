# Owner entry revision evidence

Approved implementation and visual direction: 17 October 2026. The owner chose
“Keep this direction” for the clickable synthetic sign-in/onboarding/dashboard
prototype. Its toolbar and synthetic account are development-only and do not ship.

This record supersedes the earlier presentation evidence in
[Owner Access Onboarding](Owner_Access_Onboarding.md). That record retains the
migration/compatibility rationale and historical command results. Earlier passes
are not verification of this revision.

## Tested scope and state

Working branch: `codex/owner-access-onboarding`, base `7096a8c`; uncommitted working
tree. The pre-existing unrelated AGENTS.md edit is preserved. No issue, PR, push,
merge or deployment is part of this delivery. Phase 0.5/live activation remain held.

Implementation: focused auth screens; `/onboarding` with the verified owner's
read-only name/email and editable shop name; real-shop `/dashboard` welcome;
`/owner` compatibility resolver. One pure entry policy is used by the Node Proxy
and the mounted client. GET `/api/owner/entry` returns only the current owner's
summary and authorized shop state. Server membership checks precede a completed
shop response; denial/outage never grant setup permission. All decisions are
non-cacheable and preserve session-renewal headers.

Page failures use temporary redirects to `/entry-denied` or `/entry-unavailable`;
their public presentation pages return normal HTML. The authoritative entry API
retains distinct 401/403/503 envelopes. A Next.js rewrite was tested and discarded
because page rendering reset its status to 200. Retry goes through `/owner` and
rechecks server state; it does not retry creation or guess a signed-out state.

Migration 0016 remains additive. Existing named reservations and empty-body legacy
completion stay compatible; new nameless reservations require a name/key. Never
roll back to a build that strands nameless reservations. No existing shops are
renamed and historical creation audits are not fabricated.

## Verification

Before the final zoom correction, `pnpm verify`: exit 0, observed complete at
2026-10-17T08:21:22+05:30.
It passed lint/boundaries/tokens, Knip, strict types, 156 unit tests, negative-type
checks, OpenAPI, five Linux PDF page goldens, 99 real integration tests (21 files,
861.33 seconds), production build, readiness/outage/worker-shutdown smoke and
29 browser artifact scans. The first attempt stopped on an obsolete navigation
translation expectation; it was updated to Dashboard/முகப்பு before this full pass.

The first full `pnpm test:ui` finished with 99 passes and six failures in 21.6
minutes (08:21:22–08:43:17+05:30). All six were Tamil 200% text enlargement with
additional text spacing, in both themes across the three projects. The password
visibility control overflowed a 320px viewport. The final CSS allows the password
row to wrap and bounds nested narrow-screen gutters without shrinking text or
hiding overflow. Normal phone/desktop composition is preserved. All 15 focused
language/theme contrast, zoom/reflow and token-propagation checks then passed in
48.2 seconds; the independent reviewer approved the five correction captures.
The failed full log is retained as `ui-before-zoom-fix.log` locally.

Final `pnpm verify` against the correction passed (exit 0):
2026-10-17T08:45:48.1291301+05:30 → 08:59:11.5727551+05:30. It passed
156 unit tests, all 99 real PostgreSQL integration tests (21 files, 669.82 seconds),
negative types, OpenAPI, five Linux PDF page goldens, lint/boundary/token checks,
Knip, strict types, production build, smoke and 29 artifact scans. The complete
[PostgreSQL stage](owner-entry/PostgreSQL_Verification.txt) retains source/migration
digests and the integration file inventory. The production build reported 17.605
seconds.

Final `pnpm test:ui`: exit 0, **105 passed, zero failures** (35 per phone/tablet/desktop
project), reported duration 22.0 minutes. Command timing:
2026-10-17T08:59:11.6257288+05:30 → 09:21:30.2538896+05:30 (22 minutes
19 seconds including startup/build). The [browser result record](owner-entry/Browser_Verification.txt)
retains every reported case, command timing and source digest. No retries were
configured. Both final gates ran after the CSS correction; no source changes followed.

Source snapshot: base `7096a8c8752d3a7e7b3f7cc3e426a9d3aa12e1ba`, working-tree
SHA-256 `002ae42e60e7a6dc42ef03305b4d494e6c5acb2b270c81e2a108f98c855e13b1`
over 476 version-controlled/non-ignored source/tooling/test files. Documentation
and the unrelated AGENTS.md edit are excluded. The manifest is retained locally
in [Tested Source](owner-entry/Tested_Source.sha256). It was recomputed after both
final gates and matched exactly at 2026-10-17T09:21:59.948323+05:30.
Focused development checks: 20 entry-policy, boundary and query tests passed.
Real PostgreSQL entry-state and nameless-reservation checks passed (2 selected).
Production compilation includes the Node Proxy and all revised routes.
Focused phone/desktop entry scenarios passed (2 tests, 39.1 seconds; recapture
confirmation 2 tests, 37.3 seconds). They exercise 80 onboarding/dashboard reflow
states, eight axe states per scenario, close/reopen, direct-request redirects,
cross-tab sign-out, browser back, revoked membership and a real stopped database.
The initial focused mix also passed both Google and recovery languages, the
private-artifact canary, and both failed-sign-out shell checks (7 passes); its
entry-page status assertion exposed the rewrite behavior above. The earlier
relative-URL and post-navigation language selector assumptions were corrected.
Public-surface focused presentation passed 8 phone/desktop language/theme tests
(42.6 seconds). These development results supplement, not replace, final gates.

| Acceptance | Evidence / remaining observation |
| --- | --- |
| ENTRY-01 | Auth presentation matrix; no shop progress or workspace nav |
| ENTRY-02 | Bootstrap/security integration and Google negatives; one protected admission |
| ENTRY-03 | Browser HTTP 307 direct requests before rendering protected routes |
| ENTRY-04 | Strict entry contract, own-profile PG/API test and pending route matrix |
| ENTRY-05 | Close/reopen browser path without stored credentials or local setup flags |
| ENTRY-06 | PG lock/retry/rollback/audit tests; browser double-submit/lost-response path |
| ENTRY-07 | New/legacy completion and ready route matrix; page lifecycle hides/restores via revalidation |
| ENTRY-08 | PG/API and browser 401/403/503 distinction; no inferred creation permission |
| ENTRY-09 | Query epoch/abort checks, failed sign-out clearing and cross-tab browser path |
| ENTRY-10 | Bilingual/theme viewport, reflow, axe, keyboard, focus, IME and reduced-motion tests; physical/AT observations below |
| ENTRY-11 | No-script POST, private-capture audit, storage/PWA and artifact checks |
| ENTRY-12 | Real shop name, pending business setup, no fake metrics or future workflow links |

All automated coverage in this table passed in the final gates above. Human
observations below remain pending; automated results do not substitute for them.

## Retained ACCESS acceptance coverage

These original acceptance IDs remain in force alongside ENTRY-01–12. Both final
gates passed on the recorded source. Historical passes are not substituted for
the current working tree. Each row below is an automated pass; human observations
for ACCESS-09/10 remain separately pending.

| ID | Current evidence source |
| --- | --- |
| ACCESS-01 | `owner-bootstrap` PG and browser tests: nameless registration, verification, sign-in, explicit name/create, one shop/membership |
| ACCESS-02 | Bootstrap/recovery browser journeys and entry interruption; no stored continuation secrets |
| ACCESS-03 | Owner contracts, bootstrap/recovery negatives and associated-error/focus browser checks |
| ACCESS-04 | Real-PG unverified/anonymous/wrong-token/public/provider denial and Google browser negatives |
| ACCESS-05 | Bootstrap PG serialization/replay/conflict/rollback and browser duplicate/lost-response recovery |
| ACCESS-06 | Migration/legacy pending/completed bootstrap PG fixtures; preserved reservation/hash/history assertions |
| ACCESS-07 | Recovery/Google/session/origin/rate-limit integration and callback/dialog browser checks |
| ACCESS-08 | Query epoch/abort tests, membership/RLS integration, failed-sign-out clearing and cross-tab browser checks |
| ACCESS-09 | Public/access, entry, bootstrap and shell language/theme matrix; input preservation and English navigation defaults |
| ACCESS-10 | Axe, keyboard, focus, targets, zoom/reflow, mixed-script names, reduced motion; human observations remain pending below |
| ACCESS-11 | No-script POST, exact PWA/storage allowlist, auth failure-artifact canary, log/privacy and production artifact scans |
| ACCESS-12 | Visual/source review and current route/copy checks; no operational dashboard, business setup actions, demo records or readiness claim |

## Local review instructions

Current isolated production review instance, started 17 October 2026:
`http://127.0.0.1:49774/sign-in` (sign-up at `/setup`). This is temporary and uses
only a disposable synthetic database. Google is disabled here; callback/linking
coverage uses the automated synthetic provider. The local review host remains
running for owner inspection, independently of the browser test fixtures.

After a successful build, start `node scripts/review-owner-access.mjs` from the
repository root. Use the printed `/setup` URL. The local ignored
`.scratch/access-review/private.json` supplies the setup credential and latest
synthetic email codes; never paste it into chat, screenshots or Git. Stop with
`node scripts/review-owner-access.mjs stop`; its disposable database and private
access file are removed.

1. Register using a synthetic owner name/email/password and the local setup ID.
2. Verify using the locally captured code, then explicitly sign in.
3. Confirm `/onboarding` displays the owner and a live shop-name preview. Close
   the tab before creation, reopen `/dashboard`, and confirm setup is required.
4. Create the shop explicitly. Expect `/dashboard`, its authoritative name and
   business-configuration guidance. Reload and revisit `/onboarding`; setup must
   not repeat. Sign out and directly visit `/dashboard`; expect sign-in.
5. Review English/Tamil and both themes on phone, tablet and desktop. Language
   changes preserve current input; navigation defaults to English.

Copyable observation: `ENTRY-xx — pass/fail — observation` or
`ACCESS-xx — pass/fail — observation`.

Sanitized visual samples are retained with this packet:
[desktop sign-in](owner-entry/captures/desktop-en-light-sign-in.png),
[desktop onboarding](owner-entry/captures/desktop-en-light-onboarding.png),
[desktop dashboard](owner-entry/captures/desktop-en-light-dashboard.png),
[Tamil tablet onboarding](owner-entry/captures/tablet-ta-dark-onboarding.png),
[Tamil phone onboarding](owner-entry/captures/phone-ta-dark-onboarding.png) and
[Tamil phone dashboard](owner-entry/captures/phone-ta-dark-dashboard.png).
The [enlarged Tamil form](owner-entry/captures/phone-ta-dark-enlarged.png) and
[its 320px viewport](owner-entry/captures/phone-ta-dark-enlarged-viewport.png)
record the final CSS correction on a development host; normal journey samples
come from synthetic review/test hosts. Screenshots establish the captured state,
not transactional guarantees or physical-device acceptance.

Pending human observations: finished-product owner flow/visual review (prototype
direction is approved), fluent Tamil, actual Android, assistive technology and
shop lighting. Browser emulation/axe do not establish physical-device acceptance
or screen-reader usability. No operational configuration or live readiness is
claimed by creating a shop.

## Delivery state

Implementation and automated gates are ready for owner review. No known functional,
security, migration or accessibility blocker remains from these checks and scoped
visual reviews. Human observations listed above are still pending. Creating a shop
does not establish business configuration, Phase 0.5 activation or pilot/live readiness.
Only schema-compatible code can be used for rollback; no deployment or rollback
was performed. The synthetic review host remains running independently of the
completed test fixtures.

## Check-in validation — 17 October 2026

The owner authorized committing the existing work on its feature branch and
subsequently authorized push/PR publication to `development`. The checkout was
already on `codex/owner-access-onboarding`; no development-branch switch, reset,
stash or worktree was needed. Customer/wearer research and its approved ticket
packet accompany the preserved onboarding delivery; customer application code
has not started.

Fresh `pnpm verify:fast` exited 0: Biome/boundaries/tokens, Knip, strict types,
156 tests across 40 unit files, negative DTO/UI type checks, OpenAPI generation
and the production build passed. Fresh source-manifest verification matched
all 476 recorded source files, with no uncovered source files. Manifest SHA-256
is still `002ae42e60e7a6dc42ef03305b4d494e6c5acb2b270c81e2a108f98c855e13b1`.
The earlier 99 real PostgreSQL and 105 browser results above are reused against
these identical inputs; they were not rerun or described as fresh results.

A parallel read-only review found no actionable commit-blocking regression in
entry/proxy/API, admission, migration compatibility or invalidation. This does
not replace owner review or the pending physical-device/Tamil/accessibility
observations. Only synthetic fixtures/captures are included; private credentials
and raw Nool captures remain outside Git. Hosted PR results remain separate.

Check-in published as commit `78127b6` on `codex/owner-access-onboarding`, with
[draft PR #77 to development](https://github.com/nishanthturnstile/aarili/pull/77).
The owner's publication authorization did not authorize an automatic merge.
The synthetic review host was rechecked at `http://127.0.0.1:49774/sign-in`
and returned HTTP 200. Customer issues #78–#80 are published separately and
cannot start app implementation until their merged prerequisites are satisfied.

Initial source-commit CI succeeded: [run 39008824442](https://github.com/nishanthturnstile/aarili/actions/runs/39008824442)
reported Fast verification and Dependency audit successful on `78127b6`.
Full scaffold/browser jobs were skipped as designed for a development feature PR;
promotion retains those gates. Later publication/traceability documentation
updates require their own current PR check status; this run does not certify a
different PR revision.
