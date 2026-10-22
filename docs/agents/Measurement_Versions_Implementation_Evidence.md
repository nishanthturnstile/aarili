# Measurement versions: preparation, validation and implementation authority

22–23 October 2026. Roadmap **1.3.2**. **A / #153 implemented in [draft PR #156](https://github.com/nishanthturnstile/aarili/pull/156); audit/full-browser/human/merge gates remain open. No feature-complete claim.** [Design](Measurement_Versions_Design.md),
[ticket packet](Measurement_Versions_Ticket_Packet.md),
[REA evidence](Measurement_Versions_REA_Evidence.md),
[requested brief](Measurement_Versions_REA_Prompt.md).

## Preparation audit (before software approval)

The owner requested switching to development, pulling, research and a concrete
design/ticket packet, with implementation of a selected approved issue after its
blockers merge. The authenticated complete inventory returned **62 issues**, no
title for 1.3.2. Selected prerequisite issues have no comments. No approved or
selected measurement-session issue was found. Existing form-definition issue
#98 is not an approval to implement sessions. No new issue/PR was created,
no publication/push/merge/deployment occurred, and no application/migration code
was changed during preparation. The later approval/publication and selected A
implementation are recorded below; this paragraph preserves the initial audit.

Initial checkout: `codex/design-references-b`, remote branch gone; modified
roadmap and untracked measurement prompt. `git switch development` refused the
roadmap overwrite. The subsequent pull on the still-current feature branch
failed fast-forward; no merge occurred. `git switch --merge development`
preserved the edit (Git printed “Applied autostash”; no explicit stash command
was issued). A second pull correctly refused that overlapping edit. A byte copy
and binary patch were then deliberately saved under
`%TEMP%/aarili-measurement-version-start-20261022`; reversing only that patch,
fast-forwarding and reapplying it restored the exact original hunk. No reset,
unrelated commit, worktree, force operation or edit loss. The untracked prompt
was also backed up and remains unchanged.

Updated local development and origin/development both equal
**2aa1b1246213845f1dcaa55d7505051219aedecd**. Preparation branch:
`codex/1.3.2-measurement-versions-design`. Topic branch has no commits beyond
that base. Existing development work and historical branch remain preserved.

| Prerequisite | Fresh issue/merge evidence |
| --- | --- |
| 1.1.3 | #78/#79/#80 closed; PR #81 `ac98740698640d83fc0c1d14db806f4c5e57b379`, #82 `5d00a68a607fee7afb316cc5f62b7aa527c36d41`, #83 `1cf572416b1cfb0cb1a696448a9dc4b144d0d13f`; all verified ancestors. |
| Exact forms and manifest | #98/#99 closed; PR #104 `f604acbba9144762b868cbf69c61aa8302b96ecb`, #105 `7d8f819be03858afabaeba0493fe85752c617ba4`; both verified ancestors. Configuration authority only. |
| 1.3.1 | #146/#147/#148 closed, no comments; PR #149 `3459ec44e327b6a7fc8bd5821d0bcba4d7aab12e` merged 07:42:23Z, #150 `25f7f9fe67947b82a30b8b0b3526969cf6bb1463` 10:13:32Z, #151 `2aa1b1246213845f1dcaa55d7505051219aedecd` 16:42:48Z on 22 October. All verified ancestors. |
| 0.2.3 | #16 closed; PR #21 `abd67edd491be5a1dc46661750a3c138f57a1dce` verified ancestor. |
| 0.4.1 | #51–#54 closed. Shell #61 `0ba38284428d9b57c581636f1cf318525c83ca7d`, PWA #62 `403f24fb6ef0b1e6e8a2ef13f2ecf2f5603c92fa`, vocabulary #64 `6860c13802a8d1a7f1f29ff18aa94dc41a100077` verified ancestors; telemetry remains private operational context. |
| 0.4.3 | #57/#58 closed; PR #67 `9998f505fbe55e7564f333a9e99cdf266e04eae3`, #69 `c8f7a747bab703ba3ff6eea2fbcc5f949cc3158a`, both verified ancestors. |
| Durable draft/recovery | #55/#56 closed; GraphQL close events identify merged PR #65 `f053a441a15fd37ff8537fe618673129570d050f` and #68 `909b2798594054f9661afbbdd2bbdef4ac77f194`; both verified ancestors. |
| Repeat/history/identity | #134–#138 closed; PRs #139–#143 merged, each merge commit verified ancestor. Native dependency lists for #147/#148 were read; all returned blockers are closed. |

The fresh `gh pr view` checks for #149/#150/#151 show Fast verification and
Dependency audit **SUCCESS**. Full scaffold/browser checks were **SKIPPED** on
these feature PRs by policy, not described as passing. Supporting runs:
[39739495717](https://github.com/nishanthturnstile/aarili/actions/runs/39739495717),
[39760906265](https://github.com/nishanthturnstile/aarili/actions/runs/39760906265),
[39814350982](https://github.com/nishanthturnstile/aarili/actions/runs/39814350982).
The most recent development-branch run was
[39741739598](https://github.com/nishanthturnstile/aarili/actions/runs/39741739598)
at earlier `154a456`; it is not CI for `2aa1b12`. Feature regression-fix PR #145
merged 04:12:22Z into development; it is not the promotion. Previous promotion
is [PR #144](https://github.com/nishanthturnstile/aarili/pull/144), merged
04:34:41Z as `0f784206eca5b0d0bede91ab2be62de9b5afc77c`. Fresh checks in
[run 39721124709](https://github.com/nishanthturnstile/aarili/actions/runs/39721124709)
show Scaffold verification, Dependency audit, all nine browser shards and the
Browser smoke/accessibility aggregate **SUCCESS**; Fast verification is skipped
because the full scaffold check applies. This does not promote later feature
work to main or prove full new measurement behaviour.

Read product/architecture sources and named template, customer/wearer/privacy,
design and repeat/history designs/evidence. Inspected current form/order/draft/
guardian/media/merge/history contracts and relevant migrations. Codebase Memory
returned one unrelated project, no matching root; graphify-out is absent. Used
rooted local exploration, no new index/skill/tool installation. Impeccable context
was consulted for scoped planning; existing product plan/design-system authority
wins over its missing generic PRODUCT.md notice. No UI code was edited.

## Research validation and substantive limits

REA successfully discovered and passively inspected the dedicated Nool sign-in
target, then executed two temporary TailorMan scenarios (form/profile/templates
and unit/type selectors). Exact retained IDs and raw bundle location are in
[the research ledger](Measurement_Versions_REA_Evidence.md). Four exported records,
143,393 bytes; selected TailorMan capture sections complete. No saved mutations
in the shared demo, credentials, real values or body/minor photos.

Two T3 snapshot timeouts prevented authenticated observation there. The fallback
browser also found Nool sign-in. That was the initial handoff limitation.
The owner subsequently opened a visible research browser on 9227 and privately
signed in; no credentials were read/transferred. The authenticated follow-up
below resolves entry/order-selection access, not backend/history guarantees.
TailorMan's cm/Shirt selectors changed selection while captured numeric values/
fields remained unchanged; this is sample-page behaviour, not live conversion
or backend proof. No fabricated version-stability, guardian or erasure experiment.

**Authenticated follow-up, 17:22–17:32 UTC:** fresh REA endpoint discovery and
passive inspection verified the signed-in dashboard, then REA controlled connect
scenarios exercised the existing synthetic customer. Captured new profile A
36.25 in → save/reopen as V2 → explicit per-item link/review → one research
order; cancelled an unsaved 38.25 edit and reopened 36.25; saved A's correction
to 36.75 with the same displayed V2 badge; compared against original V1; saved
a second synthetic adult B label as V3; and re-inspected the earlier order.
Original older blouse/salwar fixture values stayed visible unchanged.

The order measurement shortcut showed latest per type, while the Items step
offered all member-labelled versions, including explicit A v2. It would be
incorrect to report latest-only selection. Edit did not expose a retained copy
of 36.25 or increment the V2 badge; this is UI evidence, not proof of backend
mutation/storage design. Earlier-order detail/job-sheet/edit/repeat screens did
not expose enough structured measurement content to prove original value/reference
stability. Its manually entered note mentioning 36.25 is not such proof.

The final order is synthetic `ORD-20261022-001`, Pending, one blouse, ₹100
fixture amount, zero paid and no assignments. No production, approval, payment,
delivery, message or public publication was performed. Two adult-labelled test
measurement records persist (A v2 edited, B v3); no real measurements or minor/
body photos. The unsubmitted later-order candidate was left for the final saved
order; no user work was discarded. Research browser stays open/signed in.

The new raw bundle has **36 records / 5,029,868 bytes**, including the initial
four records, outside Git at `authenticated-followup-evidence-bundle.json` in
the same private evidence directory. Exact IDs/scenarios/limitations are in the
research ledger. Three failed locators were corrected against captured DOM;
cancelled steps were not counted as success. Bodies/headers/storage/script sources
remained off. Some scenario envelopes report missing `events`; no network-
completeness claim is made. **12 retained-UI assertions passed**, covering save/
reopen, unit relabelling, explicit v2 review, order identity, cancel preservation,
same-label edit, compare, adult B/v3 and final unpaid/no-history state. These are
research-evidence checks, not tests of Aarili's proposed runtime.

Tooling attempts that failed are not validation passes: PowerShell refused the
agent-browser `.ps1` shim; using the installed `.cmd` shim worked. Initial shell
arguments for browser refs/evaluation were malformed; a zero-byte accidental
output file was inspected and removed. REA's schema-backed scenario then supplied
the actual selector evidence. No environment execution-policy change or REA
reinstallation. `pnpm.cmd` was absent; installed `pnpm.exe` is the actual runner.
Ambient Node is 24.20.0 but `pnpm exec node --version` is pinned **24.21.0** and
`pnpm --version` **12.11.2**. These commands verified the runtime used for checks.

## Requirement-by-requirement preparation review (before approval)

This table validates **coverage in the proposed design**, not implemented runtime.
Runtime evidence had not started at that preparation checkpoint. The selected
A implementation and current command results are recorded separately below.

| Requirement | Concrete design / acceptance ownership | Current evidence and limit |
| --- | --- | --- |
| MEA-01 | MV-D03/06; MV-A01/06 | Existing exact form source inspected; proposed approval/field snapshot design. No new session runtime. |
| MEA-02 | MV-D04/05; MV-A03/04 | Entered numeric/raw/unit + exact rational proposal, explicit display/entry switch distinction. Reference arithmetic check below; production precision/grammar/display still needs owner review. |
| MEA-03 | MV-D01/02/13; MV-A02/07 | Explicit wearer/date/measurer/source/mixed-source proposal. No inferred owner/today/body defaults. |
| MEA-04 / AC-06 | MV-D08/09; MV-A05, MV-B01/02 | Immutable versions and exact selection/history proposed; no claim V2/O1 test has run. |
| MEA-05 | MV-D07; MV-A04 and interface | Base lengths separated from design targets/ease/derived; no formula or pattern implementation. |
| MEA-06 | MV-D05/06; MV-A04/06 | Missing/unit/exact precision checks specified; plausibility/override inputs remain unapproved. |
| MEA-07 | MV-D09/10/12; MV-B03/04 | Context/age/suitability review, exact-only compatibility, no latest/expiry; repeat adapter pending. |
| MEA-11 | MV-D13–15; MV-A07/09/10, MV-C01–06 | Text/privacy in A, private assets C. Existing media is a foundation, not proof of measurement access/purge. |
| CUS-02/03/06/07, AC-02 | MV-D10/12/13; MV-A01/11, MV-B05 | Same-phone identities, current permission and merge/relink boundaries specified; integration tests pending. |
| TRU-01/05/06/08/13, AC-38/52/53/55/56 | MV-D13/14, DB/transaction/recovery design; MV-A07–11/B07/C02–05 | Negative/concurrency/retry/erasure cases allocated from first storage ticket. No real-PG or object-purge claim for this new domain. |
| USE-01/02/03/08/09, AC-40 | Interface/recovery section; MV-A10/B08/C06 | Three-size bilingual keyboard/axe/manual packet requirements specified; no measurement page exists yet. |
| DES-11 / partial AC-07/08 | MV-D11; MV-B06 | Unsupported consequential selection is blocked by design, no blanket approval reset. Later production/pattern/change agreement remains gated. |

## Preparation verification ledger (before implementation)

Tested revision: base **2aa1b12** plus this documentation-only dirty scope.
No dependency/lockfile/toolchain/config/runtime/test source changes. Existing
roadmap brief and prompt are included in status but retain their original content.
Raw logs/results stay outside Git under
`%TEMP%/aarili-measurement-rea-20261022`.

- `pnpm verify:fast`: **exit 0**, **195.351s**,
  **17:10:53.316–17:14:08.667 UTC**. Lint checked 682 files (five existing
  informational suggestions, no fixes), boundaries 402 source files, token/PWA
  checks, Knip, strict package/test types, **65/65 unit files, 288/288 tests**,
  negative DTO/client type checks, OpenAPI and production build passed. Package
  builds used valid Turbo cache hits; web production build ran (12 tasks,
  11 cached). No claims that this exercised a new measurement runtime.
- Scoped packet check via `pnpm exec node --input-type=module`: **exit 0**;
  **8 documents, 147 local links, 25 unique acceptance rows, 9 requirement
  mappings**, original prompt byte equality and original roadmap-brief preservation.
  Five exact BigInt rational assertions validate document examples only, not
  application arithmetic. Initial attempt failed because Windows stdin encoding
  replaced the heading's em dash; ASCII regex delimiter corrected the checker.
- `git diff --check`: **exit 0**. Scope inventory contains documentation only;
  current HEAD and development remain `2aa1b12`. Final docs-only evidence/timing
  edits after the broad check do not change executable inputs; packet links and
  scope are rechecked after those edits, without repeating unchanged code checks.
- Expanded final packet/status/delivery check: **9 documents, 177 local links,
  25 acceptance rows, preserved original prompt/brief, 10 docs-only dirty files**,
  exit 0. The tenth file is the owner's original untracked prompt. Exact source
  arithmetic assertions above are specification-example checks, not runtime tests.
- Authenticated-follow-up changes affect documentation only. The 17:10–17:14
  `verify:fast` executable inputs remain unchanged; do not rerun them solely for
  this research amendment. Fresh evidence-consistency, Markdown-link, acceptance-ID,
  original-brief and docs-only checks are recorded with this follow-up.
- Follow-up scoped checker (`pnpm exec node --input-type=module`): **exit 0**,
  **9 documents / 178 local links / 25 acceptance rows**, all **23 cited Evidence
  IDs** found in the retained 5,029,868-byte bundle, original prompt/brief
  preserved, **10 docs-only dirty files** and clean `git diff --check`.
  The separate 12 retained-UI assertions above also passed; neither check proves
  backend immutability or historical-order value preservation.
- New measurement PostgreSQL/concurrency/RLS, browser/axe/device/Tamil PDF,
  retained-media purge/restore and production activation tests: **not run**;
  implementation/review surface does not yet exist. No mocks or static packet
  checks substitute for them. No full `pnpm verify`/`pnpm test:ui` was run for
  this docs-only preparation; those remain explicit implementation-ticket checks.

## Review packet and remaining authority

Open the [design](Measurement_Versions_Design.md) and
[A/B/C packet](Measurement_Versions_Ticket_Packet.md). Review MV-P01–09 and the
MV-A/B/C acceptance tables against the requirement mapping above. No measurement
route/start command or synthetic review host is invented here. Each implemented
ticket must supply its own running host, exact URL/command/private access path,
synthetic records, try/observe sequence and manual-review limits before acceptance.

Preparation leaves all Aarili application records untouched; the permitted Nool
synthetic writes are enumerated above. Raw research can be retained
privately for follow-up; no destructive cleanup of the existing Nool profile or
synthetic account. The final selection decision needs a **specific approved issue**
after publication and merged blockers. A's existing prerequisites are merged;
B/C cannot start before their new predecessor merges. No ticket label or software
approval resolves production forms/precision/validation, privacy/guardian notice,
retention/purge/backups/processors, physical-device/fluent-Tamil/AT review, restore
drill or pilot gates. Full 1.3.2, AC-06 and later AC-07/08 remain open.

## Approved implementation start — 22 October 2026

The owner approved proceeding with the A/B/C software packet. Published
[#153](https://github.com/nishanthturnstile/aarili/issues/153),
[#154](https://github.com/nishanthturnstile/aarili/issues/154),
[#155](https://github.com/nishanthturnstile/aarili/issues/155) with native blockers
read back. #153 has no comments; all 12 blockers have merged PRs, freshly verified
as ancestors of HEAD. Updated development by fast-forward (already current at
`2aa1b1246213845f1dcaa55d7505051219aedecd`); branch
`codex/1.3.2a-measurement-sessions` in the existing checkout. No worktree.
First application file creation observed at **17:46:06.003 UTC**, from the
filesystem creation time of `contracts/src/measurement-values.ts`. The earlier
17:48:49 documentation timestamp was a later checkpoint, not the first edit.
Active coding time is unknown; elapsed verification is recorded separately.
Production form/privacy/precision and live activation gates remain separate.
Baseline evidence above describes preparation, not this implementation.

### A runtime and schema

`measurement.use` records immutable synthetic form-use approval/withdrawal
evidence. `measurement.session` uses the incumbent durable-draft protocol for
partial entry, immutable first save and a distinct reviewed first selection.
It checks current membership, wearer/service purpose or verified guardian
measurement purpose before storing even a partial private draft. Form snapshots
retain exact definitions, field identities, units and precision. Entry text and
numeric strings/rationals remain exact; display switching cannot change them.

Migration **0045** adds eight forced-RLS tables, tenant-led composite references,
typed order/piece draft links, immutable/provenance/deferred commit guards and
the audited `app_privacy` erasure boundary. Saved context, values, notes and exact
private draft-response copies redact together; minimal replay metadata retains
no private payload. First-use uniqueness and target CAS prevent replacement or
cross-garment reuse in A. B/C remain separate blocked issues.

The existing measurement form editor is reused. Review begins without zero
decisions or plausibility thresholds. Explicitly reviewed synthetic policy
evidence is distinct from an owner's configuration proposal and from production
authority. No production approval, live-data activation, customer access,
derived measurement, fit photograph, repeat adapter or correction is added.

### Development checks and original failures

- Exact arithmetic/core policy: **23 tests passed** across the two new unit files,
  including 500 exact conversion/round-trip properties, blank/zero, finite
  representation, mixed source and explicitly supplied synthetic validation.
- PostgreSQL development run: **6 passed, 62.31s** at the recorded source stage.
  Populated/reapplied migration, independent same-contact adults, exact snapshots,
  RLS, private erasure and blocked readers, malformed/partial drafts, first
  selection/concurrency and injected rollback were exercised. Later first-use,
  typed piece-reference and registry changes require the broad results below.
- Phone browser development run: **1 passed, 1.5m**. Real form-use approval,
  fraction entry, optional unknown, exact conversion, lost-response retry,
  reload, save-only, separately reviewed selection and four English/Tamil/theme
  axe/reflow captures passed. This precedes the final denial/first-use refinements
  and is not final three-size evidence.
- Original corrections retained: service manifest kind narrowing; a moved
  triple-slash Better Auth declaration reference; typed form inference and locale
  binding; generated test PATCH/SQL-dollar quoting; the new browser-client
  allowlist; complete tenant/piece consumer inventories; asynchronous scope
  refresh versus selection; test admission waits using real `Retry-After`;
  Windows stdin encoding of newly inserted Tamil copy. None relax runtime gates.
- The pinned **Next.js 16.4.0 CLI reports a security advisory** and has stopped
  build/dev invocations to show its upgrade reminder. Retried invocations have
  continued. No dependency upgrade, suppression setting, worktree or baseline
  change is made by A. Record the final command outcome and this warning; a
  security upgrade remains a separate baseline review.
- The first full `pnpm verify` attempt exited **1 in 3.080s** because the new
  typed client was missing from the browser allowlist; it was registered and
  lint/Knip passed. The next broad run started **18:49:29.764 UTC**, with **806
  source files**, fingerprint
  `18e9e51634399ed1fc5a4c9fa13267c9801db73159721c332a4c21f72cca516b`.
  Its observed final outcome is retained in the later ledger. Raw logs/results are retained
  in `%TEMP%/aarili-measurement-validation-20261023`; private fixture material
  and browser captures remain outside Git.

### A acceptance review map (full browser/audit and human gates remain open)

| Acceptance | Concrete implementation/check | Remaining qualification |
| --- | --- | --- |
| MV-A01 | Wearer-first API/draft and standalone wearer/order UI; exact manifest/native-piece form binding. PG same-contact adults, same-phone contact association guard, wrong wearer/piece and foreign shop. | Browser matrix and final regression result below; no relationship-as-permission shortcut. |
| MV-A02 | Explicit source/date/measurer/method and per-field mixed attribution; no source/actor/date inference. Unit source-kind/mixed tests, PG partial/raw preservation, sample-garment browser recovery. | Production source/applicability decisions remain MV-P06. |
| MV-A03 | Raw text + original unit + numeric string/reduced rational; exact `127/50` conversion, exact-only display. 500 round trips and specified fraction/conversion examples; real SQL numeric storage. | No approximation/rounding policy is invented. |
| MV-A04 | Unknown/zero distinction, required/optional fields, exact increment and finite approved validation; unsupported representation remains a draft. | Synthetic rules only; MV-P01–05 production approvals remain open. |
| MV-A05 | Immutable event/version/value guards, separate first selection, native-piece composite references, first-use uniqueness, transactional promotion. | Correction/replacement/contextual reuse stay B; failed selection retains saved version. |
| MV-A06 | Frozen exact form/field semantics and labels; current availability/approval/manifest compatibility before use; renamed form read remains byte-identical. | No automatic compatible-form mapping. |
| MV-A07 | Current wearer/service or verified guardian measurement purpose before any private draft and every read/save/select/replay. Real minor/photo-only/withdrawal tests and shared wearer barrier. | Production guardian/notice policy and human verification remain open. |
| MV-A08 | Incumbent actor/action/hash/key/If-Match protocol, immutable origin uniqueness and reviewed target base CAS. PG concurrent first selection and injected failures through all writes. | No measurement auto-merge; browser lost-response/admission checks use real protocol. |
| MV-A09 | Audited maintenance-only wearer-level erasure redacts values/context/notes and durable/exact response copies, keeps IDs/tombstones, advances draft ETags and holds further admission. | No re-collection/reinstatement flow is approved; backup/retention activation is still open. |
| MV-A10 | Typed private no-store/body-query clients, existing durable recovery and guard; owner invalidation plus domain-access denial clear private state. Bilingual responsive forms, visible source/unit/version and exact conversion. | Final phone/tablet/desktop axe/reflow/capture evidence and manual host below; physical device/fluent-Tamil/AT remain human checks. |
| MV-A11 | Additive/reapplied 0045 with unchanged prior snapshots; forced RLS/catalogue registration; tenant and legacy-piece FK inventories expanded, contact merge hard blocks before values can move. | No destructive downgrade or live migration. Minimum compatible reader is recorded in the design. |

### Prepared manual review entry point

The source script now exists: `pnpm exec node scripts/review-measurement-sessions.mjs`.
It requires the current production build and starts a disposable loopback owner
host with generated private credentials in
`.scratch/measurement-sessions-review-host/private.json`. Exact running URL and
availability will be recorded only after startup succeeds. Cleanup command:
`pnpm exec node scripts/review-measurement-sessions.mjs stop`.

The fixture is intended to include two independent adult wearers sharing a
synthetic contact phone, an unconsented synthetic minor, two native-piece forms
with an optional unknown field, an unselected saved fraction observation, a
second adult's independent order and a no-measurement small-service profile.
At that preparation checkpoint, setup/tryability was unclaimed. The later running
surface and private API check below supersede that checkpoint.

### Final-review refinements and retry ledger

The first broad run exposed stale exact registries in the incumbent draft and
tenant-isolation fixtures. Their expected lists now include both measurement
workflows and the registered repository path; no runtime checks were relaxed.
Approval heads follow explicit predecessor links, with a single root/successor
constraint and the shared form-configuration barrier. Added real concurrent
reapproval and guardian-withdrawal/private-draft checks. Mixed sources distinguish
compilation attribution from each field's actual observation attribution.

Private UI requests carry a generation guard through loading, exact selection,
resume and pagination. Domain access loss increments it before clearing state.
The browser check holds the last successful order-piece read, revokes wearer
authority, observes autosave denial, then releases the older response and checks
that private values remain absent. This is distinct from global sign-out cleanup.

The three-size focused browser invocation at 19:36:16 UTC stopped on the pinned
Next.js production-build security reminder (22.559s). Retry at 19:36:56 UTC built
successfully, then stopped on the independent dev-start reminder (28.299s).
The unchanged-source direct browser runner retry started at 19:37:58 UTC; its
outcome was **3/3 passed, 289.229s** (phone/tablet/desktop). It covers all four
language/theme combinations, axe/reflow, private-storage assertions and the held
response/access-loss case. An additional offline-invalid-input assertion was added
while it ran; this result does not prove that later assertion. Strict web type checking passed after correcting
the discriminated validation-policy presentation. No dependency change or security
warning suppression is included.

The broad `pnpm verify` finished at **19:41:05.538 UTC**, **3095.774s**, exit 1:
**311/311 unit tests**, negative types, OpenAPI and PDF goldens passed, followed by
**263 passed / 5 failed integration tests**, **48 passed / 2 failed files (50)**.
Four draft requests returned the generic 503 because their instrumentation asserted
the outdated workflow list; the isolation case asserted the outdated repository
registry. Those exact assertions were corrected and their fresh focused run is
recorded below. Source changed during the broad run, so it is development evidence,
not a frozen-source full-green claim. Build/smoke/artifact stages were not reached.

The review-host script successfully seeded and served its synthetic scenario.
The collaborative browser observed the protected route redirecting to Sign in at
**19:42:43 UTC**, with self-hosted font requests returning 200 and no console
errors in that snapshot. The host was deliberately stopped before final builds;
the final owner-review URL must come from the later fresh startup, not that port.
Phone Tamil/dark and desktop English/light and Tamil/dark captures were visually
inspected as one batch. Named native-piece labels, original/exact values and
unknown optional values are visible without horizontal overflow; long region
screenshots include the incumbent fixed navigation overlay. Emulation and these
captures do not establish physical-device or fluent-Tamil acceptance.

### Human review sequence (automated setup first)

Use the generated private access file on the running loopback host; the final
URL/availability is recorded below after startup. Test English and Tamil, with a
phone, tablet or desktop browser. Physical Android, fluent Tamil and assistive
technology observations remain human acceptance, separate from browser emulation.

1. **MV-A01/02:** Open the prepared adult's order, expand Measurements and select
   its named native piece. Confirm the wearer/form/source/date/measurer match;
   the second adult's independent order must not show the first adult's values.
2. **MV-A03/04/10:** Start an observation from the approved synthetic form. Missing
   source/unit/date/measurer stays incomplete. Try unsupported text, then the
   explicitly labelled synthetic fraction `12 1/4 in`; switching converted display
   to cm shows exactly `31.115` without changing the entry. Leave the optional field
   unknown. Briefly disconnect/reconnect before continuing; preserve entered text
   and use incumbent Retry when offered. Reload only after Saved is visible.
3. **MV-A05/08:** Review and save, then close the promoted editor. The garment stays
   unselected. Open the saved observation and separately review/reason its first
   selection; check the selected exact source/form/version after reload. There is
   no correction, replacement or cross-garment reuse in A.
4. **MV-A07/09:** The prepared minor without measurement consent cannot store values.
   Guardian withdrawal and audited privacy erasure are exercised automatically by
   real PostgreSQL tests; assess the visible denial/privacy wording without
   inventing consent. Erasure holds further collection; reinstatement is not added.
5. **MV-A01/10:** Inspect the no-measurement small-service profile and existing
   lightweight flow. Check labels, keyboard focus, error clarity and reading order.

Report: `MV-Axx — pass/fail — observation`; include language, device/browser and
assistive technology where used. No terminal-test replay is requested. Teardown:
`pnpm exec node scripts/review-measurement-sessions.mjs stop`.

### Frozen-source verification — 22 October UTC / 23 October IST

Base HEAD: `2aa1b1246213845f1dcaa55d7505051219aedecd`, implementation dirty in
the selected branch. **806 application/configuration/script/test files**,
SHA-256 `90e566bd9925c8bc4d3ebae35bfd21dde7391e2cc47b93736a614b660c75a7c7`.
The logger confirmed unchanged source inputs for each completed command below;
documentation is excluded from this application fingerprint.

| Command | Fresh result and UTC interval |
| --- | --- |
| `pnpm test:integration tests/measurement-sessions.integration.test.mjs tests/drafts.integration.test.mjs tests/tenant-isolation.integration.test.mjs` | **18/18 passed**, 3 files, exit 0; **19:41:17.182–19:46:01.154**, **283.972s**. All six expanded measurement cases and both corrected regression files pass. |
| `pnpm verify:fast` | **Exit 0**, **19:44:39.482–19:46:38.747**, **119.265s**: lint/boundaries/tokens, Knip, all strict types, **311/311 tests in 67 files**, negative declarations, OpenAPI and all production builds. Five existing informational Biome findings remain. |
| `pnpm smoke` | **Exit 0**, **19:46:31.943–19:46:45.866**, **13.923s**; production health/web/worker shutdown smoke. |
| `pnpm exec node scripts/check-artifacts.mjs` | **Exit 0**, **19:46:57.798–19:46:58.298**, **0.500s**. |
| `pnpm test:ui` | The **19:47:06.615** attempt stopped at the build reminder after **13.537s**. Retry **19:48:23.485** reached the test stage despite its dev-start warning. A mistaken duplicate direct runner was started at **19:49:12.986**; both were stopped at **19:50 UTC**, their results discarded. All owned process trees, temporary host and disposable containers were confirmed stopped and port 3103 free before the sole fresh run below. A further **19:50:57.942** root attempt stopped at its build reminder after **13.005s**. Full browser validation is **blocked/incomplete**, with the later interruption and baseline cause below. |

The original full `verify` result remains exit 1; the corrected, affected PG
files and final fast/build/smoke/artifact stages above are fresh follow-up evidence.
No second full-green `verify` claim is made. The unchanged existing PDF/remaining
PG evidence comes from the broad run; physical-device/fluent-Tamil/AT, production
policy/precision/privacy decisions, CI and owner merge review remain separate.

### PR and baseline gate

[Draft PR #156](https://github.com/nishanthturnstile/aarili/pull/156) opened on
commit `369419a46bfcd0240f57a74f0763042e133b6756`, targeting development, and was
immediately linked to the T3 thread. [Run 39844058655](https://github.com/nishanthturnstile/aarili/actions/runs/39844058655)
has **Fast verification passed** and **Dependency audit failed**. Audit reports
two critical and one high `next@16.4.0` advisory with 16.4.1 patched. Dependencies
and lockfile are unchanged by A. See the concrete, unadopted
[baseline correction proposal](Next_16_4_1_Baseline_Correction_Proposal.md).

The sole broad browser continuation at **19:51:44.113 UTC** was stopped at
**19:58 UTC** after discovering that the shared dev process exited after readiness.
It is **interrupted/invalid**, not full-suite evidence. Its first booking-recovery
case failed a missing resume locator; isolated booking groups/contact merge/history
and grouped recovery cases passed, while PDF component hosts exited. The original
artifacts are retained. No conclusion that these are all product or fixture defects
is asserted without a stable host and fresh affected run.

Current official Next documentation and the installed CLI show a single-use retry
receipt with a five-minute TTL. Fresh component-host directories cannot reuse it.
No config/environment suppression or installed-package patch was applied. The
unused shared dev host is omitted only for a fresh **measurement-only** production
fixture run, using ignored local config
`.scratch/measurement-validation/production-measurements.config.mjs`; all three
incumbent viewports, one worker/zero retries and the unchanged measurement test
body remain. Each case still starts its own production web process and real PG via
`withOwnerWeb`. This does not validate the full shared-dev/component browser suite.
Its exact result is pending below. The broad suite and audit remain activation/
merge qualifications until a separately approved baseline can be integrated.

### Final measurement-only browser refinements

The production-fixture attempt at **20:01:20.451–20:02:54.643 UTC** failed all
three cases (**94.192s**): reconnect was already retrying the frozen request,
while the added test tried to click its temporarily disabled Retry button. The
next attempt **20:03:02.974–20:04:39.523 UTC**, **96.549s**, also failed all three:
the promotion waiter preceded a rate-limited autosave in phone/desktop; tablet's
immediate bounded draft-list assertion returned no new measurement row. The
earlier full run's booking-list omission is retained separately, not declared fixed.

The test now waits for incumbent reconnect recovery, retains/compares invalid text,
honours real Retry-After for draft saves before waiting on promotion and synchronises
the disposable DB statement clock with the committed row before opening its
time-bounded list. No application, API limit, retry key, precision/validation rule,
  overall test timeout or business clock policy was changed. Phone verification then passed
**1/1**, **20:05:50.973–20:07:17.920 UTC**, **86.947s**, unchanged **806-file**
source fingerprint `f12b4bd0cf58d1f37482fb0db7f6fab3e455e6878ccdb05cac1967d96b413188`.
Only the measurement browser fixture changed from the prior frozen static/PG build.
Fresh root lint after those test changes passed (the same five existing infos).
The final three-size run passed **3/3**, **20:07:52.924–20:12:07.463 UTC**,
**254.539s**, with the same fingerprint and unchanged source. English/Tamil,
light/dark, axe/reflow, optional unknown values, exact conversion, offline invalid
entry retention/reconnect, lost-response retry/reload, independent save/first
selection and held-response access loss passed at phone/tablet/desktop. This is
production-fixture measurement evidence; the shared-dev/full component suite
remains unverified on a corrected baseline. No application source changed after
the frozen static/PG/build evidence; later source edits are only the explained
measurement browser fixture. No full-green root verify/browser claim is made.

### Running owner review surface

The final synthetic host is running from the unchanged production application:

- Open [prepared adult garment](http://127.0.0.1:51165/orders?order=01a16536-7f06-7619-9e4d-341645293833).
  The collaborative browser checked the protected route redirect to Sign in.
- Private email/password: `.scratch/measurement-sessions-review-host/private.json`;
  generated ready file **20:03:54.770 UTC**. Credentials are excluded from Git/chat.
- The second same-contact adult's independent order is
  `01a16536-7cc7-72a4-986b-e19e9635a055`; use the same origin and `/orders?order=`.
  The file also names both wearers, the unconsented minor, exact forms/version/
  piece and no-measurement service profile. The original observation is saved
  without target selection; start with the manual sequence above.
- At **20:11:16.243 UTC**, a private-file-driven loopback API check signed in
  successfully, read exactly one saved `12 1/4` observation and its unselected
  native-piece target, verified the second adult's empty measurement list and
  the unconsented minor's 404. Credentials/cookies and private response bodies
  were kept in process memory and not printed or added to Git.
- Startup: `pnpm exec node scripts/review-measurement-sessions.mjs` after the current
  build. Stop: `pnpm exec node scripts/review-measurement-sessions.mjs stop`.
  Stop removes the disposable database, process and private file. Restart creates
  a fresh scenario/port/credentials; record that new URL rather than reusing this one.

Human acceptance, baseline correction/audit, full browser and owner merge remain
pending. No merge, deploy or live-data activation; #154/#155 are unstarted.
