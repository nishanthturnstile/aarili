# Existing shop profile and revision history

17 October 2026. Selected approved issue [#84](https://github.com/nishanthturnstile/aarili/issues/84),
roadmap **1.1.1a**, from the owner-approved [A–E packet](Shop_Settings_Ticket_Packet.md).
This implements ticket A only. Calendar, receiving/vendor configuration,
commercial policy and commitment preview remain #85–#88, blocked by the required
merged prerequisites. Owner review, merge, promotion and live activation remain
separate gates.

Delivered through [draft PR #89](https://github.com/nishanthturnstile/aarili/pull/89)
to `development`, registered with T3. Final local gates below passed. Hosted
Fast verification and Dependency audit were running at publication; required
owner review/merge, promotion, physical-device and live activation gates remain.

## Sources and integration baseline

Product SET-01/08/09, USE-01–04/09 and tenant/privacy requirements govern behaviour;
architecture §§6–11/15 govern implementation. See the independent
[design/acceptance matrix](Shop_Settings_Design.md), bounded competitor
[observations, inferences and unknowns](Shop_Settings_REA_Evidence.md), and
[workflow](Development_Workflow.md). No competitor code, assets or API contracts
were imported. Research gaps remain gaps; they do not weaken Aarili acceptance.

Branch `codex/shop-profile-history` starts at integrated development `1cf5724`
(minor registration PR #83). Direct blockers #16/#51/#53/#57/#58 were verified
merged through PRs #21/#61/#64/#67/#69. Onboarding PR #77 and minor registration
PR #83 were also verified merged. Existing customer, adult wearer and guardian
flows are retained. The carried roadmap/prompt/planning changes were preserved;
no reset, stash, unrelated commit or additional worktree was used.

## Delivered behaviour and boundaries

The existing owner workspace links to `/settings`. Edit the current shop's
display/legal name, contact/address, tagline/footer and date/time presentation,
review the proposed values, then apply. INR, Asia/Kolkata and unregistered
non-tax billing are fixed. Missing legal name, address or contact remain explicit
unknowns; they do not prevent existing customer registration or fabricate rates.
Later configuration is described as unavailable, without owner activation toggles.

An unedited existing shop reads its canonical onboarding name as virtual version
1. Its first correction captures that identity as an attributed baseline and
publishes version 2 in the same transaction. The baseline timestamp records its
capture, not the unobserved original onboarding publication time. Every later
correction appends a revision, previous reference, actor, server effective time
and audit reference. Publication time becomes visible on commit; it is not a
claimed exact PostgreSQL commit timestamp. History shows “You (owner)” only when
the revision actor matches the verified current actor; another actor is labelled
accurately with the stable identity reference, without inventing historical names.
Existing explicit revision values remain unchanged after later edits.

Profile state, forms, file bytes and retry payloads stay in memory. Invalid input
focuses the field; cancellation retains the saved profile. A stale version shows
saved/proposed comparison and requires reload. A lost response freezes the
attempt and retries the same key/payload/version. Sign-out/shop invalidation
clears private values. Review receives keyboard focus. English/Tamil, the
existing light/dark themes and concise phone navigation reuse the incumbent
design system; no new visual world or font is introduced.

Private logos use existing media admission, preparation, quarantine, processing
and private immutable storage. Only a ready image with this shop as subject and
the new `shop-branding` purpose can attach. Each revision retains its media
reference even after a newer profile removes the logo. The default environment
honestly reports unavailable storage; this change does not configure a provider.
Effect-owned upload/guard resources survive development StrictMode setup replay
by creating a fresh scope, and dispose on leaving the screen.

Framework-free core commands sit behind transaction-bound repositories. Thin
Hono routes and typed module clients expose current profile, revise, history and
explicit revision reads; pagination uses a POST body rather than business URL
values. Verified owner membership and `withShop()` supply the actor/shop context.
Responses are no-store. Request binding, ETag/If-Match and existing error
conventions enforce 428 missing, 422 invalid, 412 stale and 409 domain conflicts.
Same-key replay precedes the stale-version check; a changed payload is rejected.
Revision, pointer, canonical name, audit, media reference and replay result commit
atomically. No new external effect, order, price, charge or issued document exists.

## Migration and recovery

Reviewed additive SQL `0020_shop_profile.sql` creates shop-led composite keys and
references, FORCE RLS and matching policies on both tenant tables. Revision
mutation is denied. Provenance/predecessor and ready-logo guards protect inserts;
pointer guards require the current transaction's attributed successor. The only
new canonical shop grant is `UPDATE(name)`, guarded by that published revision.
A deferred constraint rejects a current-pointer/canonical-name disagreement at
commit. Isolation-catalog verification explicitly checks this narrow exception,
without granting general shop or membership mutation.

Back up before applying the reviewed migration outside disposable verification.
Use the existing advisory-locked migration runner. Compatible application rollback
retains additive tables/guards; do not drop historical rows. Correct a profile by
publishing a new revision. Approved privacy functions remain the only route for
legitimate personal-data redaction; no generic settings erasure route is added.
Restore epoch/quarantine, privacy and pilot gates remain in force. No live data,
deployment or production policy value is activated by this delivery.

Compatibility limit: the prior runtime's isolation catalog does not recognise
the new guarded `shop.name` column grant. Do not assume an unadapted old binary
is a compatible rollback. Review a compatibility patch/privilege plan or use a
forward fix, keeping all revisions and references. No rollback or production
privilege adjustment was executed here.
Deployment review must also select and verify a compatibility-first rollout
before enabling the grant, or a controlled maintenance plan; do not apply this
migration first while unadapted old processes serve traffic. Mixed-version
deployment has not been accepted by these disposable tests and remains a
deployment gate, not an asserted zero-downtime property.

## Acceptance and fresh verification

| Acceptance | Executable evidence | Limit |
| --- | --- | --- |
| SS-01 / SET-01 | `shop-profile.integration.test.mjs`: initial baseline, canonical rename, reopening, fixed pilot values, unsupported fields, ready/private/same-shop branding; `shop-profile.spec.mjs`: review/save/reload | Supported logo provider tested in disposable media host; production provider remains an activation decision |
| SS-07 / SET-08 | Explicit old revision hash unchanged, predecessor/baseline/provenance guards, atomic history, real private media reference retention | Actual future order/issued PDF consumers remain later integrations |
| SS-08 / SET-09 | Strict server schemas reject later-release fields; fixed pilot constraints; UI shows unavailable configuration | Does not implement #85–#88 or grant later feature eligibility |
| SS-09 / TRU | Real PostgreSQL catalog/RLS, missing context/cross-shop isolation, concurrent stale writes and replay, changed-payload key rejection, rollback after result/audit persistence | Mocks are not used to claim isolation/atomicity |
| SS-10 / USE | Phone/tablet/desktop, English/Tamil themes and axe, keyboard focus, invalid field, lost-response replay, stale comparison, dirty cancel, private-memory/storage assertions | Physical Android, fluent Tamil/IME and assistive-technology observations remain human acceptance |
| Existing registration | Customer, adult wearer, guardian PostgreSQL and browser regressions | No replacement onboarding or registration implementation |

Final production profile browser run: **3/3 passed**, phone/tablet/desktop,
2026-10-17T16:47:14.3405255+05:30 → 16:48:40.4920139+05:30, exit 0.
The configured private-logo browser flow separately passed **3/3** (2.1 minutes).
Existing customer/adult-wearer/guardian browser regressions passed **15/15**
across all three sizes. Their combined earlier command also contained three
profile navigation-name failures, subsequently corrected and superseded by the
fresh 3/3 profile run; it is not reported as a wholly passing command.

Finish reviewer disposition: **ship the reviewed corrections**. All three
original findings—phone labels, availability jargon and UUID-only attribution—
were scored resolved against six fresh production screenshots and source. This
is a fix-list verdict, not whole-surface or configured-logo certification.
Ordinary-extension documentation comparison preserved the incumbent visual
system. Its minor CSS convention observations (an undefined spacing variable
with a working fallback and repeated equivalent token values) remain recorded;
no new visual world or token primitive was introduced. Existing supported-surface
documentation drift was reported separately rather than repaired as a side effect.
The detector ran once and returned an empty findings array; no second scan ran.
Private capture copies: `.scratch/shop-profile-review/captures/`; raw captures,
test logs, source fingerprints and private access remain outside Git.

Final native gate: **`pnpm verify:clean` exit 0**,
2026-10-17T16:45:05.4417245+05:30 → 17:07:09.3069322+05:30 (22 minutes 4 seconds).
Frozen install in a temporary Windows path containing spaces left the lockfile
unchanged. This ran the complete repository `verify`: Biome/boundaries/tokens,
Knip, strict types, **174 unit tests / 44 files**, negative DTO/client checks,
36-path OpenAPI generation, Linux sandbox/PDF checks (50 synthetic strings and
five A4/A3 goldens), **113 real PostgreSQL integration tests / 25 files**,
production build/smoke and 29 browser-artifact privacy scans. Integration duration
was 1124.61 seconds. The clean script additionally rebuilt the web app and
rechecked artifacts. All 470 final source/config inputs matched that clean copy;
subsequent edits were documentation only.

Earlier failures are retained in [delivery measurements](Delivery_Measurements.md):
formatting, outdated static table/registry inventories, a disposed StrictMode
upload scope, exact navigation-name assertions and an existing property-test
timeout under overlapping verification. Corrected final gates passed; no test
timeout or business rule was relaxed.

Final owner-entry plus English/Tamil phone-shell regression command: **3/3
passed**, exit 0, Playwright 1.0 minute. The owner-entry case also checks its
responsive previews at 320/390/768/1024/1280px; the profile journey covers the
three shipped viewport classes. The entire promotion browser suite was not
repeated: unaffected cases retain the promotion gate, while this delivery ran
the selected profile/media and existing registration/entry/navigation workflows.

## Owner review packet

Open **http://127.0.0.1:63238/settings** on this Windows machine. Synthetic access
is in ignored `.scratch/shop-profile-review-host/private.json`; keep it private.
This is the implemented production build, separate from competitor research.
If stopped, run `pnpm build:packages`, `pnpm --filter @aarili/web build`, then
`node scripts/review-shop-profile.mjs`; use the fresh URL printed by that host.
It creates disposable synthetic data and no outbound provider effects.
Docker Desktop must be running for its disposable PostgreSQL fixture. Use this
Windows browser for the initial review; actual Android review remains pending
because this host is loopback-local.

1. **SS-01/10:** In English and Tamil, inspect the profile and missing-details
   list. Enter a synthetic shop name/tagline, review, then apply. Check readable
   labels, useful focus and a clear saved result; reload and check the header name.
2. **SS-07:** Open Profile history and expand the initial identity and correction.
   Check the different saved values, effective/capture explanation and meaningful
   owner attribution. Save a later correction; the old revision must stay intact.
3. **SS-10:** Type another change, cancel and confirm discard. The last saved
   details should remain. Try enlarged Tamil on the actual Android device and
   report keyboard/IME, screen-reader and shop-lighting observations.
4. **SS-01 regression:** Open Customers and inspect “Synthetic preserved customer”.
   Existing registration remains available. Review the honest unavailable-media
   explanation; this host deliberately has no configured production storage.

Reply using `acceptance ID — pass/fail — observation`; include actual device/RAM/
browser and fluent-Tamil observations where available. Automated checks below
need not be repeated manually. Business/visual acceptance is separate from merge
approval. Teardown: `node scripts/review-shop-profile.mjs stop` removes the
disposable database, private sign-in file and host lock after graceful shutdown.
