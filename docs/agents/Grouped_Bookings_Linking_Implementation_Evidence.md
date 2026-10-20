# Accepted garment grouping: 1.2.2b / #119

20 October 2026. Owner selected approved #119 after #118 merged in PR #121
at 03:52:18 UTC, commit `80b339f`. Native blockers #118/#114 were rechecked as
closed through merged PRs. The clean existing checkout's development branch was
fast-forwarded to that base before creating `codex/accepted-booking-groups`.
No worktree, reset, discarded edit, merge or deployment was performed.

The server-restart notification referred to the preceding review host. Completed
A verification/publication was retained, rather than restarting completed work.
B gets its own disposable review host and current-source verification.

## Scope and source authority

[Approved design and GB matrix](Grouped_Bookings_Design.md),
[ticket packet](Grouped_Bookings_Ticket_Packet.md),
[REA evidence ledger](Grouped_Bookings_REA_Evidence.md),
[development workflow](Development_Workflow.md), product §§3, 5.3, 9, 17,
24–25, 27, 29.1/30.1 and 32, architecture §§6–9, 11 and 15.
Retained competitor evidence is reused; no new competitor claim or invented
Evidence ID is introduced. ORD-02/03/14 and AC-01's structural contribution apply.

This slice groups already accepted garments. Single-garment Quick Orders remain
independent. New multi-garment intake/atomic acceptance remains #120. Bridal is
occasion context. Actual payments stay in later 1.4.2 and initially mean manual
recording/owner confirmation. No gateway, automated UPI/bank integration,
allocation, posting, measurement capture, production, custody or handover command.

## Implementation and review boundaries

- `booking.group` uses the existing durable-draft registry, transaction, version
  checks, autosave/IME handling and exact uncertain-request recovery controller.
  Incomplete drafts can be saved and resumed in another session. Promotion
  creates a booking or appends a context/membership revision; it never accepts
  a garment again. Every revision has a unique durable origin draft.
- One contact, optional separate payer reference, occasion/date/notes and reason;
  independently authorised wearers retain their own instructions, dates, price,
  source snapshot, pieces and unresolved work. Payer/contact grouping grants no
  service, guardian, measurement or photo permission.
- Read/list/history/draft/replay authority checks all involved garments. A denied
  member fails the whole private group response. Candidate pages expose only
  authorised ungrouped accepted garments, with bounded keyset paging.
- Generic draft authority runs before revalidation, so it also takes booking →
  sorted orders → sorted customers → sorted wearers locks. This avoids acquiring
  order locks after identity locks when competing with presentation commands.
  Attach and context edits recheck their reviewed target/source preconditions.
- Immutable member source versions/digests and context revisions retain history.
  One active booking per garment is a durable tenant uniqueness constraint.
  No unlink, transfer, merge, correction or package repricing shortcut exists.
  `BK-000001` uses the owner-approved prefix; QO identifiers are unchanged.
- Known price subtotals use exact BigInt paise serialization, with a separate
  unquoted count and explicit zero preserved. Accepted garment prices remain
  quote information. Grouping writes no demand, financial event or job.
- The existing Orders surface, shell, bilingual fonts, tokens and controls are
  extended. Simple/Detailed is a local group projection; opening a member reuses
  its existing order detail. Changing booking context never propagates promises.

## Migration and recovery

Additive reviewed `0032_accepted_booking_groups.sql`: `booking`,
`booking_revision`, `booking_member`, `booking_membership_history`. Non-null tenant
IDs, shop-led keys/indexes, composite contact/payer/order/actor/draft/audit links,
ENABLE/FORCE matching policies and limited runtime grants. Immutable revisions,
members and history; the booking permits only guarded version/current-pointer
updates. Deferred guards require the matching promoted draft/result, complete
members/history, audit and idempotency result in the same transaction.

No automatic grouping/backfill, rewritten acceptance snapshot or destructive
down migration. Apply through the advisory-lock migration runner; back up before
non-disposable application. Compatible rollback retains additive records and
disables unsupported writes. Restore quarantine/epoch/freeze/live-data gates stay
unchanged. All fixtures are synthetic, disposable real PostgreSQL.

## Verification ledger

Pinned Node 24.21.0 / pnpm 12.11.2 on native Windows. Context7 resolved/fetched
Drizzle transaction/parameterized SQL documentation. Existing source contracts,
draft controller and prior baseline evidence were inspected and reused.

- Package build initially exposed TypeScript's declaration serialization limit;
  booking routes were split into their own internal module, retaining typed
  clients. Subsequent 10-package build and strict web types passed.
- First grouping test caught a shared trigger accessing a field absent on the
  history table. Separate trigger branches corrected it. A test-only reference
  to a nonexistent journal table was corrected to the actual `journal_batch`.
- A nested static booking route initially collided with the incumbent dynamic
  order route. Booking routes now mount first; middleware is scoped to booking
  paths. One rerun used stale package outputs; rebuilt before fresh verification.
- Initial B PostgreSQL selection: **4/4**, **42.20s**. Covers exact creation/replay,
  competing attachment/context races, stale source, durable origin, every actual
  write rollback and guardian withdrawal serialization/private-response denial.
- Unit/property selection: **2/2**, **1.57s**, exact aggregation/unknown/zero/large
  paise and strict duplicate/date/package-field rejection.
- Browser setup/first resume succeeded. A PowerShell-to-Node pipe corrupted
  Unicode test literals; restored exact UTF-8 Tamil/rupee/middle-dot strings.
  Subsequent missing-confirm diagnostic was a real **429**; the test now honours
  returned Retry-After without changing admission policy or controller semantics.
- Broad four-file integration run: **45 passed / 4 failed**, **479.77s**. One
  catalogue publisher fixture failed during Docker startup with HTTP 409
  "container ... is not running"; three exact table-inventory assertions placed
  the added tables after consent rather than in alphabetical order. Corrected
  ordering, with no assertion weakening. Focused failed/new grouping/upgrade
  follow-up: **9/9**, **75.87s**. Unchanged broader cases reuse their passing results.
- After bounded version validation and tenant-path registration: **6/6**,
  **92.28s**. An initial Windows command quoting error ran no tests; the corrected
  command used a quoted multi-word test-name selection. After enforcing closed
  production/content policy even for empty drafts: **6/6**, **73.12s**.
- Final separate draft/command validation and all fast gates passed with
  **56 files / 240 unit/property tests**, **14.63s**, lint/boundaries/tokens,
  Knip, strict types, negative DTO/UI checks, **77-path OpenAPI**, and
  **12/12 production build**, **13.732s**. Log: b-fast-final.log.
- The first nine-case browser matrix passed all **six existing Quick Order/piece
  workflows** across three sizes, **3.7m** total, but failed the new three cases
  on a genuine hidden stale-version recovery control. That control is now shown
  for conflicts; comparison loads current versions and requires an explicit choice.
  Reused piece regions carry garment-specific landmark labels.
- A second overlapping browser runner failed before tests because port 3103 was
  owned by the first. The remaining stalled run was cancelled after its known
  failures; its process tree and disposable resources were cleaned. Subsequent
  browser runners are sequential. No verification claim comes from that run.
- New typing recovery reached its post-reload value assertions; later theme
  checks failed because tests passed theme strings to a boolean helper. Corrected
  only those calls. Grouping/recovery then passed **6/6**, **2.6m**,
  b-ui-verified.log, before the finish-review refinements below.
  Captures remain ignored under .scratch/grouped-bookings-b/captures.
- Impeccable's detector returned [] on the changed UI scope; the final finish
  review covers subsequent conflict/container-layout refinements too.
- Independent Impeccable finish review inspected all 24 captures and required
  four bounded fixes: first-viewport draft state/wearer orientation, authorised
  identity labels in saved/candidate summaries, per-garment confirmation detail,
  and 44px Detailed-view controls. The order repository deliberately stores no
  identity labels in snapshots; booking reads now hydrate through the existing
  authorised reader after globally sorted authority locks and piece permission
  checks. Labels remain absent from immutable booking records. Both languages
  have an honest missing-name fallback. The shared shell/tokens are preserved.
  Confirmation lists each garment's service, wearer, promises, quote,
  instructions and unresolved-work cue. Targeted assertions cover hydrated
  candidate/detail identities and actual first-viewport orientation.
- After those fixes, `VITEST_MAX_WORKERS=4 pnpm verify:fast` exited 0:
  **240 tests / 56 files, 19.19s**, lint/boundaries/tokens/PWA, Knip, strict
  types, negative checks, **77 OpenAPI paths**, **12/12 build, 19.233s**.
  Log: b-fast-review-fix.log. Affected PostgreSQL command:
  `pnpm exec vitest run --config vitest.integration.config.ts tests/order-acceptance.integration.test.mjs tests/orders.integration.test.mjs -t 'GB-B|empty grouping drafts'`
  exited 0, **6/6, 90.67s**, b-pg-review-fix.log. An earlier PowerShell
  `pnpm.ps1` policy rejection ran no formatter; `pnpm.cmd` succeeded unchanged.
  Historical template retirement and changed-key payload checks also passed
  separately **2/2, 24.76s**, b-pg-history-key.log, before identity hydration;
  their encompassing B cases passed again in the latest selection.
- Final `pnpm exec node scripts/test-ui.mjs booking-groups.spec.mjs booking-draft-recovery.spec.mjs --workers=3`
  exited 0, **6/6, 2.7m**, b-ui-review-fix.log. All 24 current captures refreshed:
  editor/booked × three sizes × English/Tamil × light/dark. Assertions now prove
  the complete orientation region fits the viewport and Detailed controls have
  at least 44px height; actual candidate and saved garment labels show both
  authorised wearers. Existing six Quick Order/piece checks retain their earlier
  passing evidence: later changes affect only new booking code and an optional
  piece landmark prop whose default remains unchanged.
- Impeccable documenter confirmed the incumbent system is preserved; no design
  system rewrite. It noted pre-existing capability-inventory drift and local
  focus-outline thickness without canonizing or repairing unrelated work.
- Finish reviewer re-inspected all 24 refreshed captures and the confirmation
  source: **ship**, four scored fixes clear, no material visual regression.
  Confirmation is source-reviewed below the supplied viewport captures. This
  verdict does not replace human Tamil/device/AT acceptance or owner merge review.
  Review packet ready **10:24 IST, 20 October 2026**.

[Verified source SHA-256 manifest](Grouped_Bookings_Linking_Verified_Files.sha256)
records the exact capability/test inputs. Logs and screenshots stay in ignored
`.scratch/grouped-bookings` and `.scratch/grouped-bookings-b/captures`.

## Acceptance mapping

| Approved scenario | B evidence and limit |
| --- | --- |
| GB-01 | Two accepted QO identities grouped under one BK; own wearer/instructions/promises preserved; PostgreSQL and browser checks. New simultaneous intake remains C. |
| GB-02 | Existing A piece projections reused read-only; no new garment/demand or execution. |
| GB-03 | Exact known/unknown/zero price aggregation, explicit garment-price basis; no package price command, journal or payment mutation. |
| GB-04 | Real database demand/journal counts unchanged by grouping and rollback/retry. |
| GB-05 | Forced RLS, composite links, missing context/two shops, whole-group permission denial, guardian withdrawal race and revoked membership. |
| GB-06 | Competing creation/attachment/edit, missing/stale preconditions, immutable request-key binding, expiry/origin and each actual-write rollback. New cumulative capacity admission belongs to C. |
| GB-07 | Server reload/second session, exact lost-success retry, IME and newer in-flight typing, dirty navigation, explicit conflict comparison/review. |
| GB-08 | Immutable source versions/digests/context/history; retired template preserves saved details; Simple/Detailed projections preserve member state. |
| GB-09 | English/Tamil, light/dark, three sizes, axe/reflow/IME, target sizing and sign-out/storage checks. Physical Android/fluent Tamil/AT pending. |
| GB-10 | No measurement, payment, production, custody or handover command; later execution acceptance remains open. |

No full promotion suite, changed PDF golden, physical Android, fluent Tamil,
assistive-technology, live configuration/privacy/restore/pilot acceptance is
claimed. Customer summary and piece handover documents remain 1.4.3/1.8.3.

## Owner-review packet

First review host observed ready by 09:59:01 IST at port 56099, then stopped
cleanly for the conflict/layout refinement. Final host observed ready by
**10:22:06 IST** at **http://127.0.0.1:49680/orders**. Ordinary synthetic sign-in
and grouping-draft resume were checked through the T3 collaborative browser.
Start again with `node scripts/review-booking-groups.mjs` if needed; the new
process reports its actual loopback URL. Private generated credentials remain
in ignored `.scratch/booking-groups-review-host/private.json`, never Git/chat.
The fixture contains a blouse quoted ₹1,200 and an unquoted salwar for two
authorised adults sharing one contact, with different promises and an incomplete
grouping draft. These are synthetic demonstration amounts, not approved rates.

1. Open Orders → Bookings; resume the grouping draft. Inspect both wearers,
   promises, instructions and piece blockers. (GB-01/02/07/08)
2. Review and confirm the group. Expect one BK identifier, known subtotal ₹1,200
   and one unquoted garment. Reload; no duplicate garment is created. (GB-03/04/06)
3. Change the booking event date with a reason. Expect independent promises to
   remain unchanged and the prior context in Booking history. (GB-01/06/08)
4. Switch Simple/Detailed, Tamil/English, themes and three sizes. Check actual
   device, wording, keyboard/focus and assistive technology where available.
   Report `GB ID — pass/fail — observation`, with actual device/language/AT notes.
   (GB-09)

Automated terminal fault injection is the agent's work. Human usability findings
and owner merge authorisation remain separate. Stop the fixture with
`node scripts/review-booking-groups.mjs stop`; cleanup is confined to its own
temporary web/database/access resources.
