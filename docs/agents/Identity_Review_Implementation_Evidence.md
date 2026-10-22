# Duplicate contact review and reasoned identity corrections

21 October 2026. Issue [#137](https://github.com/nishanthturnstile/aarili/issues/137),
slice **1.2.4d / C1**. Owner selected this ticket after #136 merged as
[PR #141](https://github.com/nishanthturnstile/aarili/pull/141) at
14:07:44 UTC. Its Fast verification and Dependency audit succeeded in
[run 39611266705](https://github.com/nishanthturnstile/aarili/actions/runs/39611266705).
Same checkout, latest `development` base `b3ac971`, branch
`codex/duplicate-contact-review`. No worktree or new activation decision.

Merged in PR #142 at 2026-10-21T15:41:47Z, commit `1dc7746`; required checks passed
in [run 39624106793](https://github.com/nishanthturnstile/aarili/actions/runs/39624106793).
The following C1 packet preserves its delivery evidence. C2 is now separately
selected as #138; see [its consumer inventory](Contact_Merge_Implementation_Evidence.md).

## Behaviour and traceability

Sources: CUS-01/02/05/06/07, TRU-03/05/06/12/13, USE-08/09;
AC-02/53/55; product §§7/24/27 and architecture §§8/9/11/15.
The approved [design](Repeat_Order_History_Design.md) and
[ticket packet](Repeat_Order_History_Ticket_Packet.md) remain authoritative.
There is no product/architecture conflict or new business threshold.

- From a contact profile, explicitly find possible matches. Existing version-1
  stored name/alias, skeleton and full normalised phone keys determine reasons.
  No score, similarity threshold, inferred same-person conclusion or automatic
  action. Empty keys cannot match. Up to 25 candidates per ID-paginated page.
  Previously reviewed candidates remain discoverable with their latest decision.
- Preview two distinct contact codes and versions, linked wearer identities,
  relationships and current service/guardian authority. A wearer without current
  authority has its name withheld. Shared phones do not share people or permission.
  Minor eligibility uses current verified guardian authority; it does not grant
  measurements, photos, marketing or publication permission.
- Explicitly record **Keep separate** or **Dismiss suggestion**, with a reason.
  Both contacts, wearers and all associations remain intact. The latest 25 pair
  decisions are shown in the preview; the paginated customer history retains the
  older authoritative audit events. One event appears in each involved contact's
  history, with actor/time/reason, pair and source-contact versions and both IDs.
- Existing contact correction and wearer update commands now require a reason.
  Contact name/phone/email/aliases/notes and wearer age/preferences/relationship
  retain their existing rules. A separate wearer's name can also be corrected.
  Contact-backed names use the contact command, preserving its phone/alias search
  keys and independent contact version. A name correction does not infer a new
  person, payer, guardian, purpose grant or accepted-order association.
- Material evidence records actual changed field groups, previous/current version
  and a separately redactable reason. It does not duplicate old personal values
  into immutable audit JSON or replay payloads. Older revisions keep their original
  limited evidence; missing reasons/old names are never reconstructed.

This is partial CUS-05/06 delivery. Actual merge, relink, survivor selection,
aliases/tombstones and sensitive-domain policies remain **#138 / C2**. Orders,
acceptance snapshots, issued documents, money, custody and domain consent are not
rewritten. Earlier acceptance snapshots contain original IDs, not historical
personal names; snapshot byte equality is the actual preservation evidence.

## Integrity, isolation and recovery

Private POST bodies carry candidate IDs and reviewed decisions, with no personal
query in URLs. Responses are private/no-store/no-referrer. The existing owner
membership transaction, Hono validation, command limiter, typed clients and
memory-only owner state are reused. Navigation/discard, frozen unknown-outcome
requests, retry, stale-review clearing and access invalidation are explicit.

Mutation lock order is request key → sorted pair → sorted contact person rows
→ sorted wearer advisory locks → authority reads. Pair contact rows take FOR
UPDATE because wearer/link registration takes FOR SHARE on the same parent;
this pins discovery as well as existing wearer versions. Ordinary history keeps
its existing shared contact protocol. No booking/order lock is discovered later.
Preview fingerprints bind actor/shop, both contact versions, wearer versions and
current names/eligibility/guardian state, plus the privacy generation. Only the
digest is returned. Names included in fingerprint input are not persisted in it.
They also invalidate history cursors when a contact-backed wearer is named through
another contact's relationship.

If-Match is required (428); stale preview/contact/wearer edits fail 412; changed
actor/action/request-bound keys fail 422; authority/privacy changes reject stale
review replay with 409. Pair version starts at 1 before a decision. A first
decision is version 2. The immutable shop/key binding survives key-row expiry:
same request returns IDs/version, changed payload fails, with current access
rechecked. SQL pair serialization and uniqueness prevent duplicate decisions.

Migration **0040_identity_review.sql** adds `customer_pair_review` and
`identity_revision_evidence`: non-null shop IDs, composite same-shop references,
shop-led keys/indexes, ENABLE/FORCE RLS, actor guards, immutable reviews and
deferred review/evidence/key commit validation. Audit, evidence, decision and key
commit together. No backfill, destructive migration or accepted-row mutation.
The isolation catalog and tenant-path inventory include both new paths.

Reasons live only in redaction-capable evidence. Ordinary runtime cannot edit or
delete it. `app_privacy` can invoke `redact_identity_reason` with verified tenant
context; a fixed-search-path definer writes the privacy audit and clears the
reason, retaining fields/versions/provenance. The live projection cannot fall
back to the old reason. Replay contains IDs/version only. Retention policy,
live wording and pilot/recovery gates remain pending under the existing plan.

Apply reviewed SQL through the existing advisory-locked migration runner. Back
up before non-disposable migration. For recovery, disable review writes (revoke
INSERT on `customer_pair_review` from `app_user`) and retain compatible readers,
evidence, keys and audit history. Restore grants only after validation. Do not
drop contact/history tables or roll back accepted identities. Correction writes
require the evidence table; deploy compatible command/readers together. Existing
strict durable drafts and accepted snapshots remain readable across upgrade.

## Validation record

Environment: native Windows, pinned Node 24.21.0/pnpm 12.11.2, Docker Desktop
PostgreSQL fixtures, synthetic records only. Commands run through `pnpm.cmd`.
Feature-specific tests are `tests/identity-review.integration.test.mjs` and
`tests/ui/identity-review.spec.mjs`. Final results are appended below after the
checks finish; earlier passes do not prove later edits.

Intermediate evidence:

- Typechecks found an unavailable direct `zod` import in DB and incorrect chaining
  from Hono middleware. DTO-derived types now export from contracts; middleware
  registration is separate from typed OpenAPI route chaining. Context7 resolved
  `/honojs/middleware` and its current zod-openapi README confirmed the return-type
  behaviour. No dependency/toolchain baseline changed.
- Initial legacy wearer regression failures identified fixtures missing the new
  reason. The relevant customer/wearer/guardian/order fixtures and UI correction
  workflows now supply explicit synthetic reasons.
- Customer/wearer/history/new-review PG packet: **12/12, 124.79s**. Expanded
  guardian/order/new-review packet: **13/13, 122.91s**. Expanded review/history
  packet: **8/8, 127.40s**, including parent-lock serialization and wrong-shop FK.
- Intermediate `pnpm verify:fast` passed: **266 unit tests / 60 files**, 13.11s
  unit stage, production build graph 22.214s. Later changes require the final
  affected checks below.
- First desktop browser test exposed missing heading focus. The first three-size
  rerun mistakenly reused that previous production bundle and failed the same
  check. The fixed component focuses after render; the production bundle was then
  rebuilt before the next repository-harness run. No failing run was retried
  without diagnosis.
- T3 preview navigation succeeded, but two snapshots returned exactly
  “Preview automation snapshot timed out after 15000ms.” The documented repository
  Playwright workflow supplies the browser evidence and ordinary-host fallback.
- The rebuilt broader browser packet had **9 passes / 6 failures, 13.1m**.
  Customer corrections, dirty draft refresh and wearer registration passed at all
  three sizes. The remaining failures exposed a missing shared `PAIR_CHANGED`
  wire code and missing reasons in two competing-write test fixtures. A client
  regression reproduced `REQUEST_FAILED` from the previous compiled contract
  (**1 failed / 1 passed**) before the fixed contract was built.
- The next affected packet had **6 passes / 3 failures, 9.5m**. History and wearer
  corrective workflows passed at all sizes; duplicate review reached the real
  sixth-request admission limit during Tamil stale-preview validation. The UI now
  announces a wait message, and its test observes Retry-After before an explicit
  retry with unchanged body, key and If-Match. No admission rate was changed.
- Review also covered an expired review key subsequently bound to another active
  command: that active actor/action/hash binding must reject review replay, rather
  than being hidden by the durable review row. The final PG packet includes it.

Final completed PostgreSQL verification (base `b3ac971` plus this PR's runtime/test
working changes; no unrelated edits):

`pnpm exec vitest run --config vitest.integration.config.ts tests/identity-review.integration.test.mjs tests/customer-history.integration.test.mjs`
passed **8/8 in 120.95s**. This includes the material source-contact versus pair
version distinction, observed registration lock waiting, foreign-shop pair FK,
missing context, expired and cross-action replay, populated upgrade, absent minor
guardian authority, withdrawal, privileged redaction/ordinary denial, and injected
rollback. Later edits affected client error codes/copy and browser validation only;
the tested core, repository and migration inputs remain unchanged.

The ordinary synthetic owner host passed sign-in, pair discovery, actual matching
reasons, distinct codes and wearer authority in English/light and Tamil/dark,
1440×900 and 360×800; axe reported zero violations, no horizontal overflow and
static-only PWA cache/storage. The batched desktop/phone captures were inspected.
The Impeccable detector returned `[]`. These are automation/emulation results;
human language, assistive technology and physical-device judgments remain pending.

Final `pnpm verify:fast` passed, **111.851s**: lint/boundaries/tokens, Knip,
strict types, **271 unit tests / 61 files** (14.97s), negative types, OpenAPI and
production build (17.575s graph). Biome retained five informational template-literal
suggestions in the unchanged `scripts/review-service-additions.mjs`; no lint
errors. The client code tests cover stale/policy/version/unavailable wire errors.

Final duplicate-review command:
`pnpm exec node scripts/test-ui.mjs tests/ui/identity-review.spec.mjs`
passed **3/3, 4.2m**, each device reported **1.3m**. Every case checks both
English/light and Tamil/dark, axe, heading focus, lost-response exact retry, stale
preview clearing, actual admission wait/retry, retained identities and static PWA
storage. Tablet additionally checks landscape and 200% text. Sizes are 360×800,
820×1180 and 1440×1000; the ordinary host also checks 1440×900.
The retained 9 customer/refresh/registration and 6 history/correction regression
passes above cover unchanged inputs. These are separate packets, **not one clean
18-test run**. The earlier rate-limit and fixture failures are resolved by the
specific affected reruns, not omitted or represented as passing attempts.

The tested implementation patch on base `b3ac971`, covering `apps`, `packages`,
`scripts` and `tests`, has SHA-256
`9df248efa9f8a22223b8541e615b8128933feae2698a689ecdb89c1d7d560329`.
It was staged unchanged through final verification; subsequent edits are evidence
and publication metadata only. The fresh ordinary-host check and final detector
also passed; its final desktop/phone captures were inspected without further
visual edits. Raw logs/screenshots and the patch remain ignored under
`.scratch/identity-review*`; they contain synthetic data only.

No full promotion/PDF/smoke suite or
full browser suite was run: these remain promotion gates. Dependencies, lockfile,
package export maps, install/build scripts, toolchain and runtime packaging did
not change, so an additional clean-install/Linux-image check was not triggered.
Hosted feature Fast verification remains the Linux portability check.

Published as draft [PR #142](https://github.com/nishanthturnstile/aarili/pull/142)
to `development` at **15:15:23 UTC** and registered with the T3 thread.
Implementation commit `d9844be64b96ec7ff048ce97ce82e6eec27eb08f` seals the tested
runtime/test patch. The following documentation-only publication update does
not change those inputs. Initial hosted Fast verification and Dependency audit
started **15:15:29 UTC** in
[run 39623983204](https://github.com/nishanthturnstile/aarili/actions/runs/39623983204);
they were still in progress when inspected. The documentation push may supersede
that run; current-head CI and owner review remain required before merge.

Final running review URL:
**http://127.0.0.1:55961/customers/01a15f01-3b49-77a5-9fb4-308f354e1cea**.
Observed ready at **15:08:12 UTC** after the final bundle refresh. Ordinary sign-in
and the private access method below apply. Local review-ready observed at
**15:13:41 UTC**; active implementation time remains unknown. Hosted checks,
owner merge review and physical/Tamil/screen-reader acceptance remain pending.

| Acceptance | Concrete proof / remaining human check |
| --- | --- |
| RH-07 | Distinct same-phone contacts/codes; eligible versus withheld wearer name after withdrawal; current guardian policy reused; stale authority preview denied; bilingual browser state clearing. |
| RH-08 | Real app_user/FORCE catalog, absent context and foreign-shop pair FK; competing decisions and corrections, key mismatch/expiry replay; injected correction rollback, deferred pair commit and parent registration lock. |
| RH-12 | Canonical pair audit visible to both contacts; exact material fields/reason/previous and current version; original snapshots unchanged; existing history regressions. |
| RH-13 | Manual reasons, keep/dismiss history, repeated candidate, ambiguous exact name/alias, no merge/relink; stale edits 412, changed key 422. Human clarity of the match wording remains pending. |
| RH-14 | Populated 0039→0040 preserves durable payloads and accepted snapshot bytes; correction/search remain compatible; disabled pair writes retain readers/history with no partial audit. |
| RH-15 | Audited privileged reason redaction, ordinary mutation denial, minimal replay, POST/no-store and static-only PWA storage checks; no future-domain or live-data closure. |

## Manual review packet

Start from this branch with package and production web builds complete:
`pnpm exec node scripts/review-repeat-services.mjs start --identity`.
The running synthetic URL is recorded in the final evidence below. Sign in through
the ordinary owner UI with the private access file
`.scratch/identity-review-host/private.json`; do not put credentials in Git/chat.
The fixture has two distinct contacts sharing a phone and a name/alias key,
accepted custom/service history, different wearer context and empty new review
history. Run this in one session on phone/tablet/desktop, English and Tamil:

1. Open the customer URL, find possible matches and read the reasons (RH-07/13).
   Confirm they describe shared data without claiming the people are identical.
2. Open the pair: compare both contact codes, wearer context, authority and
   versions. Enter a reason and record Keep separate. Search/reopen and verify
   the decision/actor/time/reason. Dismiss on a subsequent review; both original
   contacts and accepted work must still open (RH-12/13).
3. Correct one contact detail with a reason. Open Browse history and its identity
   evidence. Confirm material fields/version/reason; prior work retains original
   attribution. For a separate wearer, also try the reasoned name/preference form;
   self/contact names direct you to contact correction (RH-12/13).
4. Leave a reason unsaved and try navigating away/cancelling. Verify the prompt.
   Use the tested stale/unknown-outcome examples from the automated packet as
   evidence; no terminal replay is requested from the owner (RH-08/13/15).

Report `RH-13 — pass/fail — matching wording / codes / observation`, with device,
RAM/browser and fluent Tamil or screen-reader observations where applicable.
Physical Android, fluent Tamil and assistive-technology acceptance remain human
checks; desktop emulation is not their substitute. Owner merge review is separate.
Teardown: `pnpm exec node scripts/review-repeat-services.mjs stop --identity`.
The runner releases its own disposable server/database and private access file.
