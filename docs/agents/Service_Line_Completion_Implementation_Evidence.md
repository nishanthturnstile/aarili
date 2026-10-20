# Independent service-line completion — #126 / 1.2.3c

Selected by the owner on 20 October 2026 after #125 merged through
[PR #128](https://github.com/nishanthturnstile/aarili/pull/128), merge
`8e708e8f1c1842af9ac5b465fae9363e86216019`. Its required Fast verification
and Dependency audit passed in [run 39460891806](https://github.com/nishanthturnstile/aarili/actions/runs/39460891806).
The existing clean checkout fetched and fast-forward-pulled `development`, then
created `codex/service-line-completion`. No worktree, dependency, export or
toolchain changes. Merge, deployment, production policy and live-data gates remain.

## Authority, independent design and research limits

Implements the approved [C ticket and D3](Small_Service_Ticket_Packet.md),
[independent design](Small_Service_Design.md) and
[surface brief](Service_Line_Completion_Surface_Brief.md). Sources: ORD-14,
JOB-05 bounded/09 intake, ORD-06/12, TRU-01/03/05/06, USE-08/09;
AC-50 partial and AC-53/55; product §§9, 15, 24–25, 27, 32–33;
architecture §§6–11/15. No baseline behaviour or technology conflict was found.

The [existing REA ledger](Small_Service_REA_Evidence.md) is reused without
inventing new research IDs. TailorMan's dedicated public alteration list and
progress filters were observed in
`ev_0dbca9d42e7718d2f428fa9c8fd8b013a1bc61ae1a3e0be0cc8f91f21582125b`;
its tour/New attempt
`ev_86259f96a1090c445767d919db986a859b3685a0d9bde9ed2e8d17e8f47f5e4f`
did not establish intake or persistence. Nool's public delivered-order
alteration description is
`ev_9374c74dd4e5886054c3f932c354b067b07e6b56e85412c513aad118ab2dbea1`;
the signed-in research account's retained order stayed Pending, with no observed
Reopen execution. It remains unknown whether that workflow would persist or how
its backend enforces history. The inference that a distinct lightweight workflow
is useful does not supply Aarili's persistence, permission or completion rules.
No competitor code/assets, APK, private sign-in or production values were needed.

## Result and integrity boundaries

- Accepted A/B line snapshots keep their strict pending/not-required source
  shapes. A separate schema-v1 progress query overlays current state/history;
  untouched historical lines start at line version 1 without a backfill.
- Only a reviewed, known-mapping, taskless pending line accepts explicit owner
  attestation and a nonempty evidence note. A completed line returns to pending
  only through a reasoned correction referencing its latest completion. No
  required-to-not-required toggle or general task engine is introduced.
- Commands bind actor/action/shop/order/line, exact source ID/digest, parent
  version, booking/source scope digest, line ETag and body. Locks follow request
  key → sorted bookings → sorted orders → current identity authority. Missing
  If-Match is 428, stale state/scope 412, domain conflict 409, invalid command or
  changed bound payload 422. First-membership changes are rechecked after locks.
- Transition, current CAS pointer, evidence, audit and minimal replay result
  commit together. Server supplies actor/time. Durable command/key uniqueness
  outlives expiring response keys; exact replay authorizes the current customer,
  wearer and guardian before returning the original result.
- Notes live only in the evidence row, never copied into audit or replay JSON.
  Migration 0036 adds a narrow `redact_service_line_note` function to the existing
  privileged privacy boundary: fixed search path, owner-definer execution,
  FORCE RLS/context checks, immutable transition provenance and a new privacy
  audit tombstone. `app_privacy` receives EXECUTE only, no table privileges;
  ordinary `app_user` cannot invoke it. This is a new concrete note-redaction
  function, not a claim that a pre-existing general erasure service existed.
  No runtime erasure endpoint or live privacy activation is added.
  The trusted-schema search path places `pg_temp` last, following the
  [PostgreSQL security-definer guidance](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY);
  the test also supplies hostile temporary evidence/audit table names.
- Prices, original promises, accepted definitions, property identity, requirement
  rows, base/supplemental demand and package commercial scope stay unchanged.
  No garment/piece ready, trial, quality, payment, custody, booking fulfilment,
  actual handover, notification or production activation follows a line state.

## Acceptance matrix

| Acceptance | Evidence and practical limit |
| --- | --- |
| SS-04 | Real PostgreSQL: one of two taskless lines completes independently; correction preserves its first event; task-linked, not-required, missing evidence, false attestation and illegal correction fail. |
| SS-05 / AC-53 | Current guardian test covers standalone and attached service completion, then withdrawal denies history and exact replay. Existing relationship/guardian acceptance races remain. No body/photos are introduced. |
| SS-07 | Exact accepted source references and immutable snapshots remain; populated pre-0036 A/B upgrade starts progress at version 1 and compares original snapshots/change rows byte-for-byte. |
| SS-09 / AC-60 | Base demand, supplemental contributions and frozen package commercial rows compare identically before/after completion. Completion neither duplicates nor releases demand. |
| SS-10 | 428/412/409/422, changed key/body, expired replay-key durable origin, lost committed response and same-command browser retry; no note copy in replay storage. Form retry/conflict retains local text. Intake drafts retain existing A/B recovery; completion notes are not advertised as durable drafts. |
| SS-11 / AC-55 | Real app_user/FORCE RLS inventory, missing tenant context, wrong shop/order/line/source, current-pointer SQL attack, two-key completion/correction races, independent sibling commands and actual parent-write lock barrier. Faults after transition/current/evidence/key writes roll back audit, state, history and key. Privacy runtime denial, missing/wrong context and audited redaction are tested. |
| SS-12 | English/Tamil, both themes, 360×800, 820×1180, 1440×900 and 1180×820; 48 final captures, axe/reflow, IME, focus/status, unknown-response retry and conflict reload. T3 checked the open note form at 200% text in English/Tamil: 360px viewport/scroll width, 32px root text and 296px textarea. Human native AT, fluent Tamil and physical Android/tablet remain pending. |
| SS-13 | Existing Quick/custom, grouped intake/package/add-on and conflict workflows remain; empty completion views are omitted when no service lines exist. Separate regressions are recorded below. |
| SS-14 / AC-50 partial | Exact original order/demand/commercial comparisons and unchanged money/jobs/requirements/property counts bound the new effects. Full custody, execution, trials/quality and actual handover remain later slices. |

## Migration and recovery

`0036_service_line_completion.sql` is expand-only. New tenant tables have
shop-led keys/indexes, tenant-composite source/history foreign keys and ENABLE +
FORCE RLS. Guards require legal source/parent/booking provenance, same-transaction
transition/current/evidence/audit/key, immutable transitions and audited note
redaction. Unsupported progress/history schema versions fail visibly.

For non-disposable application, retain reviewed migration/advisory-lock and backup
gates. Recovery gates off new completion writes/readers while retaining the new
rows and source snapshots; do not delete history or roll an unaware writer over
recorded completions. No destructive down migration, production migration,
`drizzle-kit push`, merge or deployment was run.

## Verification ledger

- Final `pnpm verify:fast`: **exit 0, 158.968s**; actual lint/boundaries/tokens,
  Knip, typecheck, **260 unit tests**, negative DTO/client checks, OpenAPI and
  production build. Units **15.31s**; production build **23.004s**. An earlier
  overlapping run timed out the unchanged jobs seeded property at five seconds;
  the isolated run passed without changing its timeout or implementation.
- `pnpm audit --audit-level low`: **exit 0, 0.941s**.
- Service A/B/C real PostgreSQL: **18 passed, 268.79s**. Latest populated
  custom/package/standalone upgrade, sibling and parent-lock follow-up:
  **1 passed, 19.01s**. Latest privacy/temporary-shadow/rollback/race follow-up:
  **1 passed, 18.98s**.
- Current final C/guardian integrity follow-up: **5 passed, 54.47s**, including
  exact minimal replay-JSON enforcement, audit/transition/current/evidence/key
  rollback, concurrent guardian withdrawal/replay, populated package sibling
  independence and the parent-write lock race. The progress surface is keyed to
  shop/order/current accepted scope so a newly accepted add-on refreshes its state.
  Opening an action also reauthorizes and refreshes its exact line/parent scope;
  a changed line requires a new explicit choice rather than switching the action.
- Final binding follow-up: **4 passed, 45.45s**, including changed source payload
  rejection under a reused key after current authorization. Browser-artifact
  scan checked **29** outputs with no private-configuration canary leakage.
- Tenant isolation inventory/attack/upgrade suite: **6 passed, 62.44s**.
- Quick/custom/grouped PostgreSQL regressions: **47 passed / 2 setup failures,
  508.51s**, followed by both cases **passing in 19.29s**. Those two fixtures
  started during a corrected Windows BOM write to migration 0036; the migration
  is plain UTF-8. Their business expectations required no changes.
- Current C Playwright/axe workflow: **1 passed, 2.6m**, explicit runner **exit 0,
  168.249s**; 48 captures cover both
  languages/themes and all four viewport classes, plus lost committed response,
  exact retry, a committed mutation followed by failed refresh and preserved
  evidence/key through `Retry-After`, linked correction, stale conflict retaining notes, current-access
  denial clearing note/history, task reference/gate, focus/status/IME and static
  PWA-storage checks. Existing add-on workflow passed **5.0m**, including immediate
  progress refresh after acceptance; standalone intake passed **2.6m** and conflict
  workflow **22.8s**. Earlier strict-locator failures were corrected by scoping
  accepted history/source assertions separately from the new current-state view.
- Final normal-owner T3 review completed a Detailed-mode service line, appended
  its correction back to pending and opened a fresh Simple-mode action without
  a stale parent version. **32/32** custom/package reflow checks passed across
  English/Tamil, both themes and all four screen classes. The custom fixture
  retains that explicitly synthetic completion/correction history.
- Fresh Impeccable finish review: **fix**, then **ship** on the scored copy
  corrections. Fresh documenter: **No changes**, incumbent system preserved.
  Absent root PRODUCT.md/DESIGN.md is pre-existing drift, not repaired in this slice.

Private logs/captures live under ignored `.scratch/` and
`.impeccable/review/service-completion/`; no customer data or credentials belong
in this document or Git. No dependency/export/toolchain/packaging change warranted
another clean-install image. PDF/custody/quality/handover pilot acceptance is not
claimed by this intake/completion extension.

## Owner-review packet

Start after the production build with `node scripts/review-service-completion.mjs`.
The approved loopback-only synthetic fixture writes current origin, ordinary
sign-in and scenario URLs to `.scratch/service-completion-review-host/private.json`.
Keep that file private. The current final-build surface is **http://127.0.0.1:62316/orders**.
First running host observed **17:44:41 UTC**; ordinary owner sign-in and all five
scenario routes verified through T3 by **17:48:48 UTC**, with no observed console errors.
That first host used port 51241 and was replaced after the final production build.
Final ordinary sign-in, all five scenarios, presentation-mode actions and parent
reflow checks were verified by **18:35:36 UTC**. Human review remains pending.
Stop with `node scripts/review-service-completion.mjs stop`.

1. **SS-04/07/09:** Open **pending**. Fall and pico retain independent zero/unknown
   prices and two pending states; pre-pleating is explicitly not-required with
   its reason and no quote demand. Complete one line with evidence/attestation;
   the sibling stays pending and the summary changes only that line.
2. **SS-04/10:** Open its history, then correct completion with a reason. The
   original server actor/time/evidence remains and the correction links it.
   Browser failure/retry/conflict automation is evidenced; human review need not
   repeat terminal fault injection.
3. **SS-05/13:** Open **minorAuthority**, **custom** and **package**. The verified
   synthetic minor has explicit wearer/guardian authority. Attached lines retain
   original order/package scope; completion does not change either promise or
   charge. On custom/grouped orders try Simple/Detailed presentation.
4. **SS-04/14:** Open **taskLinked**. Its task reference stays blocked; no attested
   shortcut or garment-ready/handover control appears.
5. **SS-12:** Review English/Tamil, both themes, phone/tablet/desktop and tablet
   landscape. Check fluent wording, keyboard/native screen-reader announcements
   and physical-device usability. These judgments remain human acceptance.

Report `SS-ID — pass/fail — observation`, with device/browser/RAM and Tamil/AT
context where applicable. Business evidence sufficiency, production mapping,
human language/device/AT acceptance and owner merge review remain separate gates.
