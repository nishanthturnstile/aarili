# Commercial policy implementation evidence

Issue [#87](https://github.com/nishanthturnstile/aarili/issues/87), slice **1.1.1d**.
SET-05/08/09; SS-04/07–10; AC-44 configuration/readiness portions only.
Product §§6/17/27/32 and architecture §§6.5/8–9/15 govern this delivery.
The approved [design](Shop_Settings_Design.md), [bounded REA evidence](Shop_Settings_REA_Evidence.md)
and [ticket packet](Shop_Settings_Ticket_Packet.md) remain the authorities.
No competitor code, contract or asset is imported.

## Baseline and boundaries

The explicitly approved isolated #87 worktree starts at
`2e3118f074b9810bfc85a7ebbc07f22bc284ff7c` (PR #90).
Branch: `codex/issue-87-commercial-policies`.
Native blockers #84/#55/#56 are closed by merged PRs #89/#65/#68; merge commits
`549955b8`, `f053a441`, `909b2798` precede the base. PR #90 Fast verification
and Dependency audit succeeded in [run 39042034538](https://github.com/nishanthturnstile/aarili/actions/runs/39042034538).
The full issue body and empty comment list were read; the downloaded snapshot
is retained only in ignored `.scratch/issue-87/issue.json`.

Migration **0023_shop_policies.sql**, namespace **shop-policies**, workflow
**shop.policies** are reserved for #87. #86's 0022/shop-directory is not imported.
Receiving-account readiness returns `receivingAccountsNotIntegrated` until the
parent integrates and reconciles #86. No circular prerequisite is added.

Production authority is deliberately unavailable in this delivery. The server
accepts incomplete `owner-proposal` drafts but never publishes them. Explicitly
labelled `synthetic-fixture` review revisions have `authorityScope: synthetic-only`;
neither a browser flag nor fixture publication can mark production terms reviewed.
The SQL origin/authority guard also binds the changed policy to its saved draft.
Owner-approved real terms, authority and customer presentation remain activation
gates. Fixture publication is review evidence, not legal advice or acceptance of
real business values. No production default, commercial calculation, enforcement,
money movement, retail activation or outgoing message is introduced.

## Requirement matrix

| Requirement | Implementation and evidence |
| --- | --- |
| SET-05, SS-04 | Eight policy kinds; separate nullable basis points, calendar days, integer paise strings, counts, approval and credit decisions. Bilingual terms, review decision, scoped N/A reason and authority label. Pure schema/property tests and direct API negatives distinguish missing/zero and reject malformed/unapproved publication. |
| SET-08, SS-07/08 | Per-shop aggregate lock, immutable complete snapshot revisions, predecessor/actor/audit/draft composite FKs, immediate server effective time and pointer CAS. Exact revision/history reads; only the selected policy changes. Existing consent/approvals/prices/documents are never updated. Later consumers must pin explicit revision IDs. |
| SET-09, AC-44 limited | Owner-only readiness distinguishes available registration/profile/calendar, preliminary versus binding quote, receiving-account integration, bill format, credit handover/refund prerequisites and release-ineligible retail. Every future commercial action remains `not-yet-implemented`; N/A and fixtures grant no readiness. Active durable drafts report `policyDraft`, not missing or reviewed authority. |
| SS-07/09 | Existing durable draft request hash/key, replay-before-CAS, separate draft ETag versus aggregate version, explicit compare/reapply, no auto-merge. One verified owner transaction contains key/result, draft, revision, pointer and audit. Five injected failure boundaries plus concurrent publications/retries run against real PostgreSQL. |
| SS-09 isolation/privacy | FORCE RLS, matching read/write policies and shop-led references; runtime `app_user` through membership-checked owner `withShop`. No free text/contact values in publication or draft audit diffs. Ordinary runtime and maintenance roles have no direct history mutation grant. |
| SS-10 recovery/UX | Existing Settings typography/tokens and controls; English/Tamil, IME-safe server drafts, explicit unsaved/pending states, original-key lost-response retry, second-session resume, dirty navigation/close, read-only closed drafts and initial-load retry. Memory invalidates with owner scope; only public section and opaque draft IDs enter URLs. |
| AC-44 exclusions | Actual quote/payment/bill/refund/handover enforcement and issuance, retail, real production terms, legal/tax approval, physical Android, fluent Tamil and assistive-technology acceptance remain outside automated acceptance. |

Technical input bounds are validation/storage limits, not policy defaults:
0–10,000 basis points, 0–36,500 calendar days (quote validity requires at least
one), 0–1,000 trial count and integer paise up to `Number.MAX_SAFE_INTEGER`.
Drafts retain incomplete and invalid typed proposals; publication applies the
stricter command schema. Fixed/percentage/case-by-case charge bases are explicit;
inapplicable numeric branches must be empty. No credit requires an empty limit.

## Verification ledger and timings

Native Windows, Node 24.21.0/pnpm 12.11.2, pinned existing dependencies.
Logs stay in ignored `.scratch/issue-87/`; disposable DB containers and web
processes use random ports. The parent's calendar review host is untouched.
No lockfile, toolchain or dependency pin changes.

- Initial focused pure suite: `pnpm exec vitest run tests/shop-policies.test.ts`,
  **4 tests passed**, 0.803s, observed 17 October 2026 20:50:26 IST.
- Initial real PostgreSQL: `pnpm exec vitest run --config vitest.integration.config.ts tests/shop-policies.integration.test.mjs`,
  **3 tests passed**, 32.98s. Later source changes require the affected rerun.
- First typecheck built all packages and app types, then exposed a test-only
  discriminated-union typing error. The `emptyPolicy` factory now preserves the
  requested kind in its return type; no unsafe cast was added to hide it.
- First fast-gate attempt stopped on the downloaded ticket JSON in the root;
  it was moved to ignored evidence storage. Next run passed lint, Knip and all
  types, then had **185 passing / 1 failing** unit tests. Existing `jobs.test.ts`
  asynchronous property test hit its 5-second timeout during concurrent work.
  This is retained in `fast-2.log`; no timeout/config change is made to conceal it.
- Biome's first Windows wildcard invocation failed because wildcard paths were
  literal. Explicit paths corrected the invocation. A build attempted before the
  new message file existed failed; the subsequent package build passed (10.23s).
- The diagnosed unchanged `jobs.test.ts` rerun passed **2 tests in 0.620s**;
  the prior timeout is retained. No production timeout or test configuration was
  relaxed. The coordinated fast gate later passed all **187 tests / 46 files**,
  lint/boundaries/tokens, Knip, strict types, negative types, OpenAPI and production
  build with explicit **exit 0** (`fast-final-2.log`). A preceding attempt stopped
  on CRLF formatting in the edited tenant helper; Biome corrected that file.
- Scoped clean gate: `pnpm exec node scripts/verify-shop-policies-exports.mjs`
  passed frozen install, every package build, all new subpath imports and unchanged
  lockfile with **exit 0** (`clean-exports-2.log`). Package build: 13.288s;
  overall elapsed was not instrumented. Its first attempt unnecessarily used a
  shell, splitting the Windows executable path at a space. Direct spawn corrected
  this portability defect; the original failure remains in `clean-exports.log`.
- The first phone browser scenario reached the fork-draft setup and received
  HTTP 429 from the existing five-command/minute admission policy. The scenario
  now batches IME edits and honours actual `Retry-After`, keeping request keys;
  limits are unchanged. Its original failure is retained in `browser-phone.log`.
- Browser preparation found several new script-inserted strings damaged by the
  Windows shell encoding. They were corrected to actual Tamil/typographic text;
  complete English/Tamil catalogue-key equality now has a focused test. The
  policy editor uses the existing profile form's spacing. The affected production
  rebuild passed (25.954s); the refreshed pure suite passed **6 tests in 0.582s**.
  These UI/message changes do not alter package exports, so clean export evidence
  is reused. Subsequent browser and focused regression results follow below.
- Production browser: `pnpm exec playwright test --config .scratch/issue-87/playwright.config.mjs tests/ui/shop-policies.spec.mjs --project phone`
  passed **1 scenario in 1.3m**; the tablet/desktop command with both project flags
  passed **2 scenarios in 2.5m**. Each runs English/light and Tamil/dark, axe,
  horizontal reflow, IME/save/reload, same-key lost-response retry, second-session
  recovery, aggregate conflict comparison/reapply, exact history, outage recovery,
  static-only PWA storage and sign-out/back clearing. All six full-page captures
  were opened and validated, not inferred from successful screenshot writes.
- Final real PostgreSQL regression: `pnpm exec vitest run --config vitest.integration.config.ts tests/shop-policies.integration.test.mjs tests/customers.integration.test.mjs tests/wearers.integration.test.mjs tests/guardians.integration.test.mjs tests/drafts.integration.test.mjs tests/owner-bootstrap.integration.test.mjs tests/tenant-isolation.integration.test.mjs tests/shop-profile.integration.test.mjs tests/shop-calendar.integration.test.mjs -t '<recorded focused pattern>'`
  passed **12 tests across 9 files in 93.76s**, with 31 unrelated tests deliberately
  excluded. Output is retained in `postgres-regression.log`; the exact name
  pattern is recorded below. Includes current policy tests, adult/guardian/customer privacy
  boundaries, owner isolation, catalog/upgrade checks, registry and profile/calendar.
- OpenAPI review found the offline generator did not automatically mount new
  settings routes. The API's named route export and offline registration now
  include all four policy read routes; a missing-readiness assertion protects
  generation. `pnpm openapi` passed with 40 paths. This export addition required
  a fresh scoped clean install/import check, which passed with **exit 0** and
  package builds in 11.871s (`clean-exports-final.log`), lockfile unchanged.
- Final `pnpm lint`, `pnpm knip`, `pnpm typecheck` passed with explicit aggregate
  exit 0; types took 11.961s. A last UI input-bound correction was then built and
  checked by lint/Knip and production strict types: **12.589s build**, exit 0.
  Focused `shop-policies-values.spec.mjs --project phone` passed **1 test in 16.4s**:
  overlong/malformed paise remains editable, empty and zero differ, draft reload
  succeeds and incomplete publication stays disabled. The limit attribute affects
  paise inputs only; the captured advance screen's output is unchanged.
- Impeccable detector ran once over the changed screen/composition/canonical CSS:
  **exit 0, `[]` findings**. No detector or screenshot-polishing loop was run.
- Fresh independent finish reviewer: **ship**, with no material fixes at the
  supplied six-capture/source/log scope. It independently opened all six captures,
  checked persistence/fidelity/ceiling/material fixes/retained decisions and kept
  human gates separate. [Retained finish report](Shop_Policies_Finish_Review.md).
  The independent documenter compares the extension with the incumbent authority
  in [design review](Shop_Policies_Design_Review.md); it changes no baseline design.
- Full `pnpm verify`, broad `pnpm test:ui`, Linux PDF goldens and physical-device/
  fluent-Tamil/AT review were not run for this scoped delivery. Promotion retains
  its full scaffold/browser gates; those are not reported as passed here.

Focused PostgreSQL name pattern (the command's explicit exclusions are intentional):

```text
SET-05|CW-01/02/06/08/11/13|CW-03/04/05/08/11/13|CW-09/11 separate|0.4.2a E1/E2/E3/E5/E8|0.2.1a A5|0.2.2 D3/D8|0.2.2 D9|SS-01/07/08/09|SET-02/08 SS-02/07/09|SS-09 tenant policies|SS-07/09 policies
```

| Capture | English/light | Tamil/dark |
| --- | --- | --- |
| Phone 360×800 | [English](../../.impeccable/review/policies-phone-en.png) | [Tamil](../../.impeccable/review/policies-phone-ta.png) |
| Tablet 820×1180 | [English](../../.impeccable/review/policies-tablet-en.png) | [Tamil](../../.impeccable/review/policies-tablet-ta.png) |
| Desktop 1440×1000 | [English](../../.impeccable/review/policies-desktop-en.png) | [Tamil](../../.impeccable/review/policies-desktop-ta.png) |

The orchestration accepted this task at 20:42:41 IST; active implementation time
was not instrumented and remains unknown. First observed test time above is not
substituted for active start time.
First usable own review host: **21:20:39 IST**, 17 October 2026; heavy-window
release was sent to the parent at **21:20:52 IST**. Read-only independent review
began at approximately 21:21 IST. Finish review and documenter handoff were read
back by **21:24:17 IST**, making the delivery locally review-ready. Hosted CI
queue/execution and merge times remain pending.
These issue-local timings are for parent consolidation; central
`Delivery_Measurements.md` is intentionally unchanged.

## Migration, recovery and privacy

0023 is additive and seeds no policy or revision. The existing migration runner
uses `app_owner`, an advisory lock and migration checksums. Back up before any
approved non-disposable application. Application rollback must retain compatible
tables/history; never drop history or use schema push. Correct a mistake with a
new reviewed revision, not by changing an earlier revision or existing consumer.
The SQL guards enforce actor/audit provenance, predecessor version, current
transaction pointer, exact active-draft origin/content and complete promotion at
commit. Revision mutation/deletion remains denied.

The foundation explicitly defers privacy execution; no approved executable
general-purpose erasure function exists in this base. This slice adds no bypass
or ad hoc history-edit endpoint. Real personal terms are prohibited in the
synthetic host. Future erasure must use the architecture's approved audited
`app_privacy` path and retain nonpersonal provenance/tombstones; this remains a
live-data activation gate, not a claim that immutable history forbids erasure.
Draft retention and backup/restore controls remain those of the foundation.

## Sequential integration overlaps

Minimal shared edits: auth/API composition, package subpath exports, owner
Settings navigation, owner-flow message composition, i18n index/settings copy,
boundary client allowlists, offline OpenAPI generator, tenant path/table inventories and the production
draft-registry assertion. New policy files are isolated. No edits to
`core/drafts.ts` or `draft-recovery.ts`; #86's publication-authorization and
stale-auth changes must be retained when integrating. The parent must combine
Settings sections and #86 receiving readiness, then rerun affected shared checks.
The canonical CSS has only two scoped policy text/textarea rules; retain sibling
additions when reconciling that shared file.

## Running synthetic manual-review packet

After building, start `node scripts/review-shop-policies.mjs` in this worktree.
The disposable loopback URL and sign-in method are written privately to
`.scratch/shop-policies-review-host/private.json`; never publish its credentials.
The host creates a clearly synthetic shop, a preserved customer and an incomplete
labelled synthetic advance draft. No outbound message or payment occurs.
Running review URL: **http://127.0.0.1:56975/settings?section=policies**, verified
ready 17 October 2026 21:20:39 IST. This is a separate host from the parent's
calendar review. Private access stays in the ignored file above. Independent
finish review returned **ship**; the documenter completed the retained-system
comparison without baseline repairs. Both reports are linked in the ledger.

1. **SS-04:** Open Settings → Commercial policies. Inspect readiness: customer,
   wearer/profile/calendar remain available; payment account integration, binding
   quote, bill, refund and handover retain named missing gates. Retail is outside
   Phase 1; preliminary quote has no mandatory policy questions.
2. **SS-04/07:** Resume the synthetic advance draft. Observe empty percentage
   versus explicit `0`, English/Tamil terms and fixture authority. Save, reload,
   then review and publish only the labelled fixture. Production proposal cannot
   be published. Record production policy decisions separately for later approval.
3. **SS-07/08:** Publish a changed fixture and inspect old/new history with author
   and Asia/Kolkata effective time. Earlier content and existing customer/consent
   evidence must stay unchanged. Try a second session and explicitly compare/reapply
   a stale draft; cancel navigation to retain edits.
4. **SS-10:** Review English and Tamil on phone/tablet/desktop, then on a physical
   Android phone and with a screen reader. Judge Tamil meaning, keyboard/IME,
   validation/retry announcements, focus and wrapping; automation is not fluent
   language or assistive-technology acceptance.

Report `SS-04 / SS-07 / SS-08 / SS-10 — pass/fail — observation`, with actual
device/browser details for human gates. Production authority, physical Android,
fluent Tamil, AT acceptance, owner review, merge and deployment remain separate.
Teardown: `node scripts/review-shop-policies.mjs stop` cleans this host's disposable
data and private access only. A stopped host needs restart after rebuilding.
