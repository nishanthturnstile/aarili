# Customer registration — ticket #78

17 October 2026. Branch `codex/customer-registration`, based on onboarding
squash merge `2ea55ac` in development. Sources: [issue #78](https://github.com/nishanthturnstile/aarili/issues/78),
[design](Customer_Wearer_Design.md), [reference evidence](Customer_Wearer_REA_Evidence.md)
and [privacy draft](Customer_Wearer_Privacy_Draft.md). This delivery covers 1.1.3a.

## Behavior and boundaries

Customers joins the protected workspace. The owner can register a display name
with explicit ordinary-service permission, optionally add contact details,
aliases and private notes, search, reopen a profile and correct contact details.
Shop codes start at C0001. Shared phones never merge people.

Search uses the existing version-1 Tamil/Latin/skeleton keys. Phone search
normalizes Unicode digits/punctuation and supports exact numbers and four/six
digit suffixes; it does not infer country codes. Mixed name/code queries cannot
fall back to unrelated phone suffixes. Search and cursors travel in POST bodies.
Synthetic top-five recall is not the later real-name pilot corpus gate.

The original bilingual notice is stored immutably with its digest/version.
Permission binds subject/self-giver IDs, purpose, notice, language, source,
occurrence time, recording owner and server recording time. Marketing remains
unrecorded. Default composition blocks registration with CUSTOMER_POLICY_PENDING.
Only explicit loopback synthetic composition enables the labelled draft fixture;
client flags cannot approve policy. No approved/live activation path is added.

Corrections require an ETag. Conflict preserves the proposed form alongside the
saved version and requires explicit reload. Uncertain saves lock their fields
and retry the same key/payload; offline input remains on screen. Values stay in
memory, clear on access invalidation and never enter URLs or browser storage.
React Hook Form owns uncontrolled contact inputs; shared contracts validate the
command. Longer-form durable drafts belong to B.

## Integrity, migration and recovery

Additive 0017_customer_registration.sql adds person/customer, notice, consent
and search-key tables. Each has non-null shop context, shop-led keys/indexes,
composite tenant references and forced matching RLS. Runtime cannot delete
identities or update notice/consent history. Per-shop code allocation serializes;
committed codes are not reused. Every repository uses the membership-checked
transaction. Business write, minimal audit and ID/version-only replay response
commit together; audit/replay never duplicate personal values.

Apply through the advisory-locked runner after an authorized backup. Verification
uses disposable synthetic PostgreSQL only. Compatible application rollback leaves
the additive schema; no destructive down migration or live import is supplied.
Wearers, guardians, measurements, media, orders, messaging, rights execution and
live activation remain outside this PR.

## Acceptance and verification

`pnpm verify:clean` passed with exit 0, from
2026-10-17T12:28:42.1570394+05:30 to 12:49:36.3681302+05:30 (20m 54.21s).
It verified a frozen clean native install in a path containing spaces, lint and
boundaries, Knip, strict types, 159 unit tests across 41 files, negative types,
OpenAPI, all 100 real-PostgreSQL integration tests across 22 files (997.04s),
the Linux sandbox PDF checks (50 strings/five golden A4/A3 pages), production
builds, PostgreSQL readiness/outage smoke checks, worker shutdown and browser
artifact leakage scans. Lockfile equality and cleanup completed successfully.

Tests ran against the implementation working tree, not an earlier commit.
[Tested_Source.sha256](customer-registration/Tested_Source.sha256) identifies
446 source/config/test/infra inputs; its LF-normalized SHA-256 is
`7b3dbd7d0b660638acd4d043a49e6cef0f7fb8aa02b7a15d43afcdb108a961f2`.
All listed inputs were independently rechecked unchanged at 12:48:50+05:30.
Only delivery documentation changed afterward.

Development failures retained: the first browser attempt could not launch the
pinned Chromium runtime; `pnpm exec playwright install chromium` restored it.
Three subsequent focused attempts reached the stale-edit assertion but received
429, diagnosed with status/code-only logging. POST search had incorrectly shared
the five-per-minute mutation bucket. Search now retains origin/auth/body bounds
without consuming write admission; write limits remain unchanged. UI distinguishes
a known rate rejection from an uncertain earlier save and honors retry safety.
Review also corrected mixed name/phone matching, conflict cancel/reset and the
contradictory “not saved” status after a potentially committed request. One matrix
was interrupted to apply that last review correction before final verification.

The first clean-native run installed the frozen workspace and passed lint,
Knip, strict types, unit and negative-type/OpenAPI checks, then failed before PDF
verification because its copy set omitted infra/pdf. The helper now copies that
existing runtime/fixture directory; no PDF behavior or security settings changed.
The corrected complete clean-native command passed as recorded above. The
original failed run remains recorded rather than described as a pass.

The next complete attempt caught the older owner-bootstrap table inventory;
related current/legacy catalog inventories also needed the five new tables.
They now enumerate those tables and still enforce the same policies/grants.
Four focused owner/catalog/legacy checks passed (46.15s); the full clean gate
restarted at 12:28:42.1570394+05:30. No isolation exception was introduced.

Fresh `pnpm verify:fast` passed 12:24:24.8789367 → 12:26:26.2988836+05:30 after
the final UI target-size and validation-feedback corrections. The final
customer matrix passed all three phone/tablet/desktop projects (5.3m), ending
12:31:51.238606+05:30; the earlier three-size matrix passed (6.1m).
Nine preserved owner-entry/shell journeys passed (3.8m,
12:19:01.5970139 → 12:22:59.5863645+05:30), including interrupted onboarding,
direct links, cross-tab/failed sign-out, keyboard/zoom and navigation.

The draft body digest was independently recomputed successfully as SHA-256 of
UTF-8 `textEn + "\n" + textTa`; the Tamil body contains 1,716 Tamil code points.
On the final seeded host, a failed search retained its input, exposed Retry and
recovered to the correct single result. IndexedDB was empty; cache paths were
exactly offline.html plus the three approved PWA assets. No customer fixture
values appeared in local/session storage or cached bodies.

Recorded top-five synthetic recall probe, 12:30:45+05:30 (two shared-phone people;
this is not the pilot corpus):

| Query | Returned shop codes in order |
| --- | --- |
| மீனா | C0001 |
| meena | C0001 |
| Meenaa | C0001 |
| +1 (202) 555-0101 | C0001, C0002 |
| 0101 | C0001, C0002 |
| 550101 | C0001, C0002 |

| Acceptance | Automated evidence |
| --- | --- |
| CW-01 | Contract/property cases, actual name-only save/reopen, validation |
| CW-02 | Shared-phone identities, Tamil/aliases, exact/four/six-digit phone recall, bounded pagination, mixed-query negatives |
| CW-06/07/10 | Two-shop API, composite FK 23503, catalog/grants, missing/cleared pooled context; URL/storage/public-output/late-response browser canaries |
| CW-08/11 | Default blocked policy, strict client-authority rejection, immutable bilingual synthetic metadata |
| CW-12 | Both languages/themes, three sizes, axe, keyboard/focus and enlarged-text reflow |
| CW-13 | Concurrency/replay, payload/actor/action mismatch, audit rollback, browser lost-response retry, offline and conflict flows |

Implementation tests: tests/customers.test.ts, customers.integration.test.mjs,
owner-entry.test.ts and ui/customers.spec.mjs. Browser commands were
`node scripts/test-ui.mjs customers.spec.mjs` and
`node scripts/test-ui.mjs owner-shell.spec.mjs owner-entry.spec.mjs`.
Physical-device, fluent-Tamil, assistive-technology, lighting and
policy review remain human acceptance. A alone does not complete 1.1.3;
1.1.1/1.1.2, 1.2.1, Phase 0.5 and real-data gates remain unchanged.

## Human review packet

Automated local gates passed; owner acceptance and hosted CI remain separate.
Run `node scripts/review-customers.mjs` after the production build. It creates a
disposable synthetic shop and two distinct people sharing the reserved fictitious
phone +1 202 555 0101. Final review host:
http://127.0.0.1:55074/customers (observed ready 12:28:59+05:30). Sign in with the
ephemeral details in `.scratch/customer-review-host/private.json`; credentials
stay outside Git/chat. Stop with `node scripts/review-customers.mjs stop`, which
cleans its database and private access file. Earlier diagnostic/rebuild hosts stopped.

1. Open Customers. Register an invented name-only person after explaining the
   labelled draft notice and explicitly recording self-given service permission.
   Reopen and inspect code/provenance (CW-01/08/11).
2. Add another person with the same reserved fictitious phone. Search exact
   phone, last four/six digits, Tamil name and Tanglish alias; confirm distinct
   profiles (CW-02).
3. Correct optional details. Compare concurrent edits and explicitly reload the
   saved version after a conflict. Disconnect/reconnect before saving; check
   retained values and unsaved/retry feedback. Cancel a changed form (CW-13).
4. Repeat in both languages/themes on actual phone/tablet/desktop; check keyboard,
   screen reader, enlarged text and shop lighting. Review wording and outstanding
   privacy decisions separately (CW-12/08).

Report `CW-ID — pass/fail — observation`, with device/browser/RAM and language or
assistive-technology observations where applicable. Owner review and merge
authorization for this PR remain separate from #77's authorization.
