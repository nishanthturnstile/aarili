# Shop calendar implementation evidence

17 October 2026. Issue [#85](https://github.com/nishanthturnstile/aarili/issues/85),
roadmap 1.1.1b. SET-02, SET-08; SS-02, SS-07, SS-09–10; DAY-06 calendar seam.
Product sections 6, 20, 25 and 32; architecture sections 7–9 and 15.
Implementation is synthetic-only. Owner acceptance, publication, merge and
deployment are separate gates.

Publication update: the owner authorized commit, a PR to development and squash
merge after validation/required CI, followed by the next unblocked issue.
Fresh pre-publication `pnpm verify:fast` passed on 17 October 2026: 45 test
files/182 tests and all lint, Knip, type, declaration, OpenAPI and build stages.
No application source changed after the recorded PostgreSQL/browser evidence.
Physical-device/language acceptance and deployment remain separate gates.
The first pre-publication launcher reported successful stages but exited 1
without a diagnostic. Running the installed `pnpm.cmd` entry point confirmed
the complete fast gate with explicit process exit 0; no source change was made.

## Scope and integrated baseline

The owner requested implementation and confirmed same-date ranges with overnight
work split at midnight, and independent dated replacements per calendar.
`codex/shop-calendar` uses the existing checkout at integrated development
`549955b8faa079019d8a9ce68bd4b6dca843df66`. Direct prerequisites #55/#56/#84
merged through #65/#68/#89 and are ancestors of this base. Baseline #89 Fast
verification and Dependency audit succeeded in run 39029524002.
No worktree, dependency upgrade or baseline correction is introduced.

The [implementation plan](Shop_Calendar_Implementation_Plan.md),
[independent design](Shop_Settings_Design.md), and
[bounded research evidence](Shop_Settings_REA_Evidence.md) supply traceability.
No further competitor behaviour is claimed from this implementation. Aarili's
product and architecture remain authoritative.

## Behaviour and integrity

Customer hours and production availability have separate weekly rules and dated
replacements inside an immutable calendar snapshot. Unconfigured and closed
days differ; no standard hours, holidays or appointment durations are seeded.
Ranges use local 24-hour HH:MM values, support `24:00` only as an end boundary,
and reject overlap, duplication and overnight wrapping. Breaks fit within an
opening range; appointment slots fit inside net customer hours. Production
cannot contain appointment slots. Technical bounds are 32 ranges per collection,
366 exceptions per domain and the existing durable-draft canonical JSON limit.

Publication uses the existing draft transaction, with separate draft ETag and
calendar base revision checks. Stale calendar publication requires comparison
and an explicit new draft bound to the current calendar. It never merges
silently. Each domain publication preserves the other domain. Same-key retries
replay the original result. UTC server-assigned publication time is displayed
in Asia/Kolkata; there is no backdating or scheduled activation.

Migration 0021 adds calendar current/revision tables with composite tenant
references, shop-led keys, FORCE RLS, restricted runtime grants, immutable
history and pointer guards. A deferred origin guard checks that the same draft
was promoted to the revision before commit. Audit facts contain version/domain,
not calendar values. Calendar publication does not rename the shop, rewrite
customers or alter existing work. No queue job or external effect is added.

The pure resolver takes an explicit revision/domain/local date. Working-day
counting uses an explicit half-open date interval and returns unknown for missing
or invalid availability; configured closures count zero. The 3,660-date bound
prevents unbounded calculation. It supplies a seam for #88, not warning-window
semantics, category lead times, capacity, festival cut-offs or rush handling.
There is no service-catalogue import or prerequisite.

## Verification record

Native Windows, Node 24.21.0, pnpm 12.11.2, Docker Desktop disposable PostgreSQL.
Evidence applies to the local dirty implementation, not a published commit.

| Requirement | Evidence |
| --- | --- |
| SS-02 validation and DAY-06 arithmetic | `tests/shop-calendar.test.ts`: eight unit/property tests passed, including 200 generated interval cases, midnight split, breaks/slots, duplicate/invalid dates, leap/year boundaries, unknown/closed and pinned historical resolution. |
| SS-07/09 transactional integrity | Calendar and durable-draft focused PostgreSQL run: eight tests passed across two files in 53.95s. Calendar cases cover concurrent first publish, simultaneous retry, stale draft versus stale calendar, immutable history, tenant access and injected rollback after revision, pointer, draft, audit and replay writes. |
| Repository checks | `pnpm verify:fast` passed: lint/boundaries/tokens, Knip, strict types, 182 unit tests, negative declaration tests, OpenAPI and production build. After finish corrections, lint, Knip, strict compilation and the production web build passed again. |
| Browser and accessibility | Three bilingual calendar Playwright/axe cases passed across phone/tablet/desktop in 4.3 minutes, including recovery, independent publication, stale comparison, history, IME, validation, load retry and read-only closed drafts. Four existing desktop customer/adult-wearer/guardian/profile regression cases passed in 5.1 minutes. |
| Native clean install | The full clean command passed frozen install, compilation, 182 unit tests, declarations/OpenAPI and Linux PDF checks (50 strings/five goldens), then reported 111/116 PostgreSQL passes in 1174.45s. Its five failures and successful focused corrections are recorded below; the full command is not claimed green. Final scoped disposable frozen-install/package-build/web-type/declaration checks passed with exit 0 and unchanged lockfile. |
| Production readiness | Final production build, `pnpm smoke` and `node scripts/check-artifacts.mjs` passed, including PostgreSQL readiness/outage, typed client/worker shutdown and 29 browser artifacts. |
| Human acceptance | Physical Android, fluent Tamil, assistive technology and owner business review remain pending. Emulation does not establish these. |

Earlier failures are retained: the first calendar PostgreSQL run passed two
cases and failed one assertion because the driver wrapped its denied-write
cause; the corrected assertion checks that cause. Initial browser runs exposed
a missing submit type on preview and a redundant leave prompt during a
value-preserving rebase. Both were corrected and verified by the final browser
run. Rate-limit handling now gives explicit wait/retry guidance; tests honour
Retry-After without relaxing the foundation policy.
The Impeccable static detector returned no findings for
the changed calendar screen, workspace navigation and canonical stylesheet.

The full clean run found four stale tenant-table/repository registry inventories
and one auth provenance test assuming transaction-start timestamps totally order
events. Inventories now include both calendar tables and all new access paths.
The auth assertion checks the exact action multiset; preceding command assertions
retain link/disconnect ordering proof. No auth runtime changed. Corrected
bootstrap RLS passed (one test, 10.09s), full tenant-isolation and owner-Google
suites passed (12 tests, 138.92s), and the final adjusted Google case passed
(one test, 9.96s). Successful unchanged-input stages were reused under the staged
workflow; the approximately 26-minute full command was not repeated.

Final clean export confirmation reports cleanup complete and process exit 0 in
`.scratch/shop-calendar-clean-exports-confirmed.log`. An earlier diagnostic
printed successful checks but returned an incongruent wrapper status, prompting
the bounded explicit-exit rerun. No dependency changed. Final source was built
and all sixteen refreshed responsive/correction captures inspected.

Independent finish review: **ship**, scoped to its three prior findings. Initial
load recovery, non-active draft truth and associated validation recovery are all
resolved; no material fixes remain in that list. This is not human acceptance.
See the [incumbent design comparison](Shop_Calendar_Design_Review.md).

## Migration and recovery review

No production database is touched. Review SQL 0021 and back up before applying
outside disposable verification. Compatible application rollback retains the
additive tables and immutable history; do not drop them or use schema push.
Correct hours through a new reviewed revision. Existing customer/wearer,
guardian, media, restore controls and draft retention policy remain unchanged.
Unsupported draft versions remain retained with an explicit recovery error;
they are not silently coerced or deleted.

## Owner review packet

Start `node scripts/review-shop-calendar.mjs` after building the current source.
The loopback URL and private sign-in are written to the ignored
`.scratch/shop-calendar-review-host/private.json`; never paste credentials into
chat or Git. This host labels its shop/customer synthetic and sends no messages.
Open Settings, then Working calendar. Final synthetic review host:
http://127.0.0.1:59499/settings (observed available 17 October 2026, 19:48 IST).
The collaborative preview is privately authenticated. Calendar values are
synthetic; production availability remains unconfigured for independent review.

1. **SS-02:** Choose Customer hours. Set a synthetic Monday range, break and
   appointment slot. Add a closed dated replacement. Set different production
   hours, including a production-only date. Verify the other calendar survives.
2. **SS-02/10:** Try overlapping ranges, an appointment crossing a break, and an
   inverted/overnight range. Check the errors and split midnight work into two
   dates using `24:00` as the first end boundary.
3. **SS-07:** Wait for Draft saved, reload and resume. Open the saved draft in a
   second synthetic session; change and publish one calendar, then attempt the
   older publication. Compare, explicitly reapply, and review again.
4. **SS-02/07:** Preview seven dates containing the replacement. Review and
   publish. Open Calendar history and compare earlier versions and author/time.
5. **SS-10:** Repeat relevant controls in Tamil on an actual Android phone and
   with a screen reader. Report keyboard/date entry, text wrapping and wording.

Reply using `SS-02 / SS-07 / SS-10 — pass/fail — observation`, including actual
device/browser details where applicable. Owner acceptance does not approve real
business policy values, merge, production promotion or live-data activation.
Teardown: `node scripts/review-shop-calendar.mjs stop` removes disposable data
and private access. A stopped host must be restarted after rebuilding.
