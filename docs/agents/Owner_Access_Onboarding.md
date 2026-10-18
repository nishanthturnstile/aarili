# Owner access and initial shop onboarding

Historical implementation record. The owner rejected this presentation and
approved the [17 October entry-flow revision](Owner_Entry_Onboarding_Revision_Plan.md).
Its progress-bar and `/owner` screen descriptions below document the earlier
build; current presentation and fresh evidence are in the revision record.

Owner-approved implementation plan, 16 October 2026, without GitHub issues.
Sources: product BIZ-01, SET-01, USE-01/02/08/09, TRU-01/06/12, §§29.1, 32.2,
33; architecture §§6.5, 7–9, 11, 15. This refines the foundation before Phase 1.1.

## Journey and scope

Protected registration → verification → explicit sign-in → name/create shop →
welcome. Keep Current light/dark, local Noto fonts and Base UI. Registration
collects owner name/email/password/setup token. Contextual actions support
verification/resend after reload. Password visibility permits paste/managers;
codes are pasted text, never numeric assumptions or URL tokens. Workspace
navigation appears only after authorized shop completion.

Access uses a 28rem measure, semantic spacing, noninteractive progress, associated
field errors, one request-feedback region and explicit success actions. English
starts each page; explicit Tamil switching preserves input. Only appearance persists.

Tamil progress uses two columns up to 479px, four otherwise. Password Show/Hide
has pressed/control association while setup tokens stay masked. Invalid fields
associate their hints/errors and receive first-error focus; the one request
region is focused with alert/status semantics. Only actual pending-shop → complete
transitions focus the shop heading and completion description, including lost
response recovery; completed-shop reloads do not steal focus.

Shop creation is not live readiness. Policies/services remain 1.1.1–1.1.2,
imports 1.10.1, sample/pilot readiness 1.10.4, external onboarding 2.1.4. Phase
0.5 remains held. No public signup, live provider activation or demo records ship.

## API, compatibility and recovery

- Registration permits omitted shopName, preserving legacy names/admission hashes.
  Pending-shop reads may return suggestedName, only after authentication.
- New completion submits shopName and Idempotency-Key. Empty legacy requests
  finish/replay named legacy reservations; new nameless reservations reject
  empty completion requests both before and after creation, including direct
  calls to the one-argument SQL function.
- Migration 0016 expands bootstrap constraints and adds narrow completion without
  changing applied migrations, reserved provenance or completed shops.
- Lock/recheck session; commit shop/membership/completion/replay/audit atomically.
  Same requests replay; changed names conflict and never rename. Historical
  completed shops receive no fabricated creation audit.
- Resolve uncertain outcomes with an authorized read before manual retry; never
  automatically resubmit. Keys/inputs are memory-only. No outgoing job is needed.
- Back up before schema changes outside disposable tests. Rollback requires code
  supporting nameless reservations. Retain expanded schema and deploy a compatible
  fix; never reset bootstrap or delete identities/shops to recover.

## Acceptance and verification

| ID | Required evidence | Status |
| --- | --- | --- |
| ACCESS-01 | owner-bootstrap integration ACCESS-01 plus browser owner-bootstrap journey | Automated passed |
| ACCESS-02 | Browser owner-bootstrap reload/direct-entry/resend; owner-recovery reset and owner reload | Automated passed |
| ACCESS-03 | owner-contracts limits/scripts; bootstrap strict/injected DTOs; browser presentation focus/axe | Automated passed |
| ACCESS-04 | Bootstrap A1/A3/A5/A6 and ACCESS-04; Google C2/C3 admission negatives | Passed in full integration suite |
| ACCESS-05 | Bootstrap ACCESS-05 locking/replay/rollback; browser double-submit and committed lost response | Automated passed |
| ACCESS-06 | Bootstrap ACCESS-06 fresh/legacy-pending/completed migration and old caller/provenance assertions | Passed in full integration suite |
| ACCESS-07 | owner-recovery B1–B7 and owner-google C1–C7 integration/browser regression | Automated passed |
| ACCESS-08 | owner-query and owner-recovery invalidation units; bootstrap A5 real RLS; browser failed logout | Automated passed |
| ACCESS-09 | Browser presentation/bootstrap/selected-themes: English/Tamil × light/dark × three sizes | Automated passed; fluent Tamil review pending |
| ACCESS-10 | Presentation reflow 320/390/768/1024/1280 plus 40 pending/completed shop width states and 8 axe scans; shell tablet landscape; keyboard/zoom/reduced motion | Automated/visual passed; physical Android/AT review pending |
| ACCESS-11 | Browser no-script POST/private-storage/capture canaries; artifact scanner and static PWA whitelist | Automated passed |
| ACCESS-12 | i18n welcome/configuration copy, design/roadmap traceability and sanitized captures | Implemented and inspected; owner wording review pending |

Final commands: pnpm verify and pnpm test:ui. Record tested revision/dirty files,
results and failures below; passing results only apply while inputs are unchanged.

## Manual review packet

Prepare a local synthetic review host with private access instructions and record
its exact URL/start/stop below. Do not put credentials in chat, screenshots or this
file. Ordinary pnpm dev:web does not provision its database or credentials.
Review /setup, /sign-in, /recovery, /reset-password, /owner, /connections and
/reauthenticate using established synthetic mail capture.

1. ACCESS-01/02: register without naming a shop, verify, sign in, name/create it;
   reload and confirm the same shop.
2. ACCESS-03/07: try invalid fields/codes/passwords; inspect explanation, focus,
   recovery and retained retryable input.
3. ACCESS-09/10: switch language while typing and switch themes; inspect phone,
   tablet, desktop, keyboard order, enlargement and long mixed-script reflow.
4. ACCESS-12: confirm configuration/live readiness are separate and no future
   business action is offered.

Report `ACCESS-ID — pass/fail — observation`. Actual Android device/RAM/browser,
fluent Tamil and assistive-technology review remain separately pending. Emulation
cannot close those gates. No publication, merge or deployment is implied.

### Screen/state map and copy authority

English/Tamil copy lives together in `packages/i18n/src/owner-messages.ts`.
The shared stylesheet is `packages/ui/src/globals.css`; screens do not define a
second palette or persist language. The following headings identify the review
surfaces; request failures use the same translated alert region throughout.

| Route/state | English / Tamil heading | Primary action and continuation |
| --- | --- | --- |
| /setup, initial | Set up your owner account / உரிமையாளர் கணக்கை அமைக்கவும் | Register with protected token; reset fields and show verification |
| /setup, verify | Verify your email / மின்னஞ்சலை உறுதிசெய்யவும் | Verify pasted code; success offers explicit sign-in |
| /setup, resume | Resume pending verification / நிலுவை உறுதிப்படுத்தலைத் தொடர் | Protected resend with email/password/token; no persisted credentials |
| /sign-in | Sign in to Aarili / ஆரிலியில் உள்நுழையவும் | Credential sign-in; Google eligibility guidance and contextual recovery |
| /recovery | Recover your password / கடவுச்சொல்லை மீட்டெடுக்கவும் | Neutral request result removes form and offers reset |
| /reset-password | Set a new password / புதிய கடவுச்சொல்லை அமைக்கவும் | Reset code/password; success removes form and offers sign-in |
| /reauthenticate | Confirm your password / கடவுச்சொல்லை உறுதிசெய்யவும் | Password confirmation returns to /owner; no sensitive action executes |
| /owner, pending | Create your shop / உங்கள் கடையை உருவாக்கவும் | Explicit named creation; no workspace navigation |
| /owner, complete | Your shop / உங்கள் கடை | Server name/welcome; operating configuration is still pending |
| /connections | Sign-in connections / உள்நுழைவு இணைப்புகள் | Explicit linking; disconnect confirmation and recent-authentication gate |

Loading disables duplicate mutations. Validation retains inputs and focuses the
first invalid field. Request errors retain retryable inputs and explain recovery;
closed setup, delivery/rate limits, invalid codes, expired access and unavailable
providers each have contextual next steps. Failed sign-out clears authorized
state and leaves a sign-in action even when its network response is unavailable.

### Sanitized visual evidence

These inspected Chromium captures contain empty credential/code fields or
synthetic shop text. They demonstrate presentation, not physical-device or
screen-reader acceptance. Local `.scratch` captures retain the broader matrix.

- [Phone: English light registration](owner-access/captures/phone-en-light-setup.png)
- [Tablet: English light verification](owner-access/captures/tablet-en-light-verification.png)
- [Desktop: Tamil dark sign-in](owner-access/captures/desktop-ta-dark-sign-in.png)
- [Phone: Tamil dark recovery confirmation](owner-access/captures/phone-ta-recovery-requested.png)
- [Phone: Tamil dark pending shop](owner-access/captures/phone-ta-dark-pending-shop.png)
- [Tablet: Tamil dark created shop](owner-access/captures/tablet-ta-dark-complete.png)
- [Phone: English light disconnect confirmation](owner-access/captures/phone-en-disconnect-review.png)

Recreate the disposable review host with Docker Desktop running:

```powershell
pnpm build:packages
pnpm --filter @aarili/web build
node scripts/review-owner-access.mjs
```

The launcher prints its local URL. Open `.scratch/access-review/private.json`
locally for the setup token and latest verification/reset codes; use synthetic
account/shop details. Google is intentionally unavailable on this review host;
provider callback/link/disconnect behavior is covered by the synthetic browser
suite. Stop with `node scripts/review-owner-access.mjs stop`. Stopping removes
private access/mail files and the disposable database; restarting begins fresh.

## Verification record

Tested working tree: `codex/owner-access-onboarding`, base `7096a8c`.
[The manifest](owner-access/tested-files.sha256) identifies all 33 changed runtime,
migration, script and test files. Manifest SHA-256:
`87a601d3f37e5302c2174c65ff216c27a5dc91848cfcb72ab0f8de4df9ba338a`.
The unrelated pre-existing AGENTS.md edit is excluded. No commit, GitHub issue,
PR, publication, merge or deployment was performed.

| Command / evidence | Result |
| --- | --- |
| `pnpm verify`, VITEST_MAX_WORKERS=4 | Exit 0; observed complete 2026-10-17T00:37:07+05:30 |
| Full `pnpm test:ui` sweep | 96 passed / 6 failed in 32.2 minutes; failure causes and scoped reruns below |
| `pnpm test:ui tests/ui/owner-bootstrap.spec.mjs tests/ui/owner-shell.spec.mjs tests/ui/pwa.spec.mjs` | Exit 0; 27 passed in 7.1 minutes; observed complete 2026-10-17T00:44:58+05:30 |
| `node scripts/test-ui.mjs tests/ui/draft-recovery.spec.mjs --project=desktop --grep en/light` | 1 passed unchanged in 1.4 minutes after diagnosed clock failure |
| One-off `node .scratch/access-review/check-shop-reflow.mjs` using existing withOwnerWeb/Playwright/axe fixture | 40 pending/completed shop width states and 8 axe scans passed: English/Tamil × light/dark × 320/390/768/1024/1280px |
| `node scripts/check-artifacts.mjs` after final browser build; manifest check; git diff --check | 29 artifacts passed again; all 33 hashes matched; no whitespace errors |
| Impeccable detector / bounded finish review | Detector []; completion-focus finding scored resolved; seven sanitized captures inspected |

The final repository command passed Biome, boundaries/tokens, Knip, strict types,
152 unit/property tests in 39 files, negative declarations, 19-path OpenAPI,
Linux namespace/seccomp PDF isolation with 50 synthetic Tamil strings and five
A4/A3 golden pages, 98 real integration tests in 21 files, production build,
readiness/outage/worker-shutdown smoke and 29 browser-artifact leakage scans.
The final integration run took 404.19 seconds. Capacity was bounded to four
Vitest workers; assertions were not weakened. New container-based ACCESS tests
have explicit 120-second limits for their full setup/transaction checks.

All 102 broad-suite cases have passing evidence through the original unaffected
passes and scoped reruns. The initial 102-case command exited 1; it was not
presented as green or repeated wholesale. The final 27-case command includes
the five corrected failures and all changed owner-continuation cases; the sixth
failure passed unchanged on its diagnosed rerun. No functional, migration,
security or automated accessibility blocker remains in this scoped delivery.

Local detailed logs remain under ignored `.scratch/access-review/`:
`verify-final.log`, `ui-complete.log`, `ui-final.log`, `ui-clock-rerun.log`,
`shop-reflow.log`. The supplementary reflow script stays local under `.scratch`;
it creates and removes its own synthetic database and captures no secret fields.
Native Windows checks used disposable Linux PostgreSQL/storage/PDF containers.
No extra clean-install image was needed: dependencies, lockfile, exports and
runtime packaging were unchanged. Hosted CI is not run without publication.

### Failures, fixes and evidence limits

- The first unrestricted unit run timed out in the unchanged jobs test while 39
  workers/browser work competed for capacity. Its isolated check passed; capped
  full suites passed with unchanged assertions and the original jobs timeout.
- The new bootstrap audit/replay records exposed fixture assumptions that those
  tables started empty. Command/jobs/vocabulary/usage tests now count their own
  action namespace; ACCESS-05 separately asserts exactly one creation audit and
  bound replay records. Historical pre-command-schema fixtures explicitly use
  their historical SQL. Ordinary runtime never skips audit based on schema age.
- Media maintenance now identifies preserved immutable cleanup intents by ID,
  rather than assuming creation-time ordering across transactions/restore epochs.
  No media production behavior was changed.
- The broad browser sweep's five shell/PWA failures targeted removed auth footer
  links and the registration-time shop field. Their replacements retain private
  state, 44px/navigation, offline/reconnect/update and accessibility assertions.
- The remaining broad failure was desktop English/light draft pagination. SQL
  diagnostics showed max(created_at) 18:49:40.444 UTC while the following snapshot
  was 18:49:38.695 and database clock 18:49:38.701: the database clock had moved
  backward. Snapshot exclusion was correct. The unchanged case passed on its
  diagnosed rerun; no production draft code or assertion was weakened.
- Final contract review restricted empty completion to named legacy reservations
  both before and after completion. HTTP/SQL negatives now reject a completed
  new nameless reservation. The complete final PostgreSQL suite passed afterward.
- One final attempt stopped on Biome indentation in a Tamil test selector; it was
  formatted. Another in-flight attempt was deliberately stopped for the above
  compatibility correction. Neither attempt is reported as a successful gate.
- Bounded visual review fixed cramped Tamil phone progress and completion-focus
  loss. Heading focus now covers manual verification/resume transitions, actual
  shop creation and lost-response recovery; completed reload does not steal focus.
  Failed sign-out clears private data and preserves an actionable sign-in link.
- Physical Android, fluent Tamil, assistive-technology and owner visual/flow
  observations remain pending. Automated emulation and independent finish scoring
  do not close those human observations or authorize live activation.

### Review surface and recovery

The first synthetic preview was offered at 2026-10-16T23:57:16+05:30 on
http://127.0.0.1:58941/setup. That disposable host was stopped before the final
build; its private access/mail files, process and database were cleaned up.
A fresh final-build host was offered at 2026-10-17T00:38:41+05:30:
http://127.0.0.1:50615/setup. Its local private setup token and latest captured
verification/reset codes are in `.scratch/access-review/private.json`. Follow
the synthetic sequence above; stop with `node scripts/review-owner-access.mjs stop`.
The app browser-panel opening was requested; the URL is usable directly.
Review packet ready: 2026-10-17T00:45:37+05:30; setup URL returned HTTP 200.

The ordinary retained local database has not been migrated. Apply 0016 with the
reviewed migration/backup procedure when integrating this change into a retained
environment. Recovery/rollback must keep support for nameless reservations and
retain the expanded schema; never revert to a build that strands those accounts.
