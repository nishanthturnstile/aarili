# Private pattern outputs and deliberate reuse — #165 / 1.3.3b

23 October 2026. **Implementation prepared for owner review; activation remains gated.**
The owner selected B after all PRs merged. The existing checkout's development
branch was updated to `96b3e54ee1bececd3411048caef2aae65563a2e4`, then branched as
`codex/manual-pattern-outputs`. No worktree, reset or stash. Existing measurement
closeout edits remain outside this work. An instrumented task checkpoint was
**15:01:25 UTC**; active coding time is not reconstructed from elapsed time.

## Authority and prerequisites

Sources: [approved design MP-D01–12](Manual_Pattern_Design.md),
[A → B ticket packet](Manual_Pattern_Ticket_Packet.md),
[REA observations and limitations](Manual_Pattern_REA_Evidence.md),
[A implementation](Manual_Pattern_Implementation_Evidence.md),
[workflow](Development_Workflow.md), product PAT-01/03 and applicable
ORD/DES/MEA/CUS/TRU/USE requirements in #165; architecture §§6–11/15.
No additional vendor research or dedicated-pattern claim is inferred.

All eight direct blockers are closed and their closing PRs are merged; every
merge commit was checked with `git merge-base --is-ancestor <commit> HEAD`:

| Blocker | PR | Merge commit |
| --- | --- | --- |
| #164 | #166 | `96b3e54` |
| #57 | #67 | `9998f50` |
| #58 | #69 | `c8f7a74` |
| #148 | #151 | `2aa1b12` |
| #155 | #163 | `c04020a` |
| #134 | #139 | `56b07f6` |
| #135 | #140 | `9ee0e0c` |
| #136 | #141 | `b3ac971` |

Merged #166's Fast verification and Dependency audit succeeded on its final
head (`670c31b`); full/promotion checks were skipped as the workflow requires.
That establishes the base, not evidence for B.

## Implementation boundary

B extends the existing private media pipeline for JPEG/PNG/WebP sketches and
bounded PDF attachments. A's strict `pattern.reference@1` remains fileless;
schema 2 adds accepted output identity or deliberate exact-source reuse.
Upload, save, review and selection remain distinct. A replacement appends a new
version and preserves the selected predecessor until explicit selection.
Source lineage pins original input IDs; target inputs are recorded separately.
No review, fit/scale validity, custody or cutting approval is inherited.

Migration 0050 is additive. Pattern media subjects/assets, immutable accepted
hash evidence and reuse joins use tenant composite foreign keys and forced RLS.
The API and worker compose the same current identity/private-media authority.
Exact-reference reads check ownership, source lineage, current authority and
ready bytes/hashes. Generic signing and other-domain ownership substitutions
are denied. Source erasure extends private values/drafts/replay and creates
retained/staging purge intents with receipts, restore epoch and expiry fencing.

Custom orders and existing single-form garment/native-piece input adapters
remain the approved A+B boundary. Pattern-bearing service/multi-form adapters,
drafting, formulas, seam presets, generation, true-scale export and production
activation remain outside this issue. No rates, tolerances or policies are seeded.

## Verification during development

Raw logs remain outside Git in `%TEMP%/aarili-manual-pattern-b-20261023/`.
Pinned existing Node 24.22.1/pnpm 12.15.0 and repository dependencies are retained.

| Check | Actual result |
| --- | --- |
| Initial full workspace typecheck | Passed before UI integration. |
| Existing A pattern/input PostgreSQL regressions | **2 files / 6 passed / 87.28s**, expanded schema installed. |
| First UI typecheck/lint | One nonexistent upload-status message key and a broad effect capture were found; corrected to existing translated state and exact scope fields. Not a passing aggregate. |
| First B PostgreSQL/S3 file | **4 failed / 57.21s**: output guard used SQL alias `old`, conflicting with the trigger's OLD row; the populated migration test also used an invalid UNION ORDER BY expression. Both corrected and covered by the later aggregate/focused passes below. |

Further verification is still running. Failed attempts remain evidence of
development, not successful aggregate verification. Initial B fixtures exposed
the trigger alias conflict above, an invalid purpose MIME, a PDF reader asking
for an image derivative and an incorrect test-helper signing argument. These
were corrected. A cross-wearer replay negative exposed a missing target
private-media check; both core and the SQL publish guard now require it. The
three authority/race/repeat cases subsequently passed in **54.10s**.

The first aggregate stopped at Knip's unused fixture export (**19.94s**); the
export was removed. The next aggregate passed static checks, **320 unit cases**,
negative types/OpenAPI and PDF before a staging-expiry fixture failed; that
owned run was stopped (**728.90s**, not a passing aggregate). Investigation
showed that the test must observe PostgreSQL's actual not-before boundary,
rather than infer it from the Windows clock. A diagnostic **335.81s** run proved
actual expiry/purge but exposed an incorrect HTTP-status assumption: Garage
returned 400 rather than 403 for an expired signature. No expiry policy, grant,
clock, assertion about absent bytes or production timeout was shortened.

Final browser results appear below; PR/hosted check details follow publication.
Human fluent Tamil, screen-reader/physical devices and inherited
privacy/recovery/configuration/pilot gates stay separate.

**Final-UI fast verification:** `VITEST_MAX_WORKERS=4 pnpm verify:fast`
passed, **16:42:51.428–16:47:06.440 UTC / 255.01s / exit 0**. This covers
Biome/boundaries/tokens, Knip, strict workspace/test types, **69 files / 320
unit cases**, negative compiled types, OpenAPI (**117 paths**) and production
build (**12 tasks / 36.048s**). It was required because review/select context
and narrow-layout CSS changed after the aggregate's initial static stage.
Five existing lint warnings/information findings remain; no new lint error.
The fitting-media queued erasure case also passed unchanged in isolation
(**1 passed, 5 deliberately unselected / 71.38s**).

The source fingerprint (LF-normalized, **851 source/config/test files**, excludes
documentation, private scratch/env files, dependencies and build output) is
`27687154aa4d10f10b1221dac36d8f25cf34caace8c2cbfa76acbc7537351266`.
It was reproduced at **16:47:37 UTC**. The aggregate began with
`5800dafeddbe83e06583f9c45bd90e0b6df10e57d6b629904f4a88ba40f79251`;
only `manual-patterns.tsx`, `globals.css` and the pattern-output browser test
changed afterward. Core, SQL, contracts, API and worker inputs are unchanged;
the final fast run and affected browser cases verify those UI edits afresh.
No dependency, lockfile, package-export, install/build-script, toolchain or
runtime-packaging change triggers an additional clean-install gate. This is
native Windows evidence with real Linux containers; it is not a new full clean
Linux installation claim. Hosted feature checks remain required.

**Aggregate, focused repairs and remaining components:**

| Actual invocation | Result and interpretation |
| --- | --- |
| `VITEST_MAX_WORKERS=4 AARILI_PRIVATE_PROBE=aarili-private-probe-issue-2 pnpm verify` | **16:18:55.499–16:58:39.505 UTC / 2384.01s / exit 1**. Static/unit/negative/OpenAPI stages passed; Linux namespace+seccomp PDF sandbox, four fonts, 50 strings and five A4/A3 page goldens passed. PG/S3: **55 files passed, 2 failed; 293 passed, 2 failed / 2238.26s**. This aggregate did not pass, and its post-integration build/smoke stages were not reached. |
| Fitting erasure isolation described above | The aggregate's retained purge had already committed all three receipts; a later replay returned `Fitting purge is not yet eligible`. Because the intent is immutable and receipt insertion checks the same boundary, this indicates a backward PostgreSQL clock step (amount not instrumented). The guard correctly failed closed; ordinary queued retry remains safe. The exact case passed unchanged in isolation. No clock, grant, timeout or existing fitting assertion was altered. |
| `VITEST_MAX_WORKERS=1 pnpm exec vitest run --config vitest.integration.config.ts tests/pattern-outputs.integration.test.mjs -t 'MP-B06/09 audited erasure'` | A diagnostic failed **374.85s** because Garage's actual expired-signature response is `Date is too old`, rather than a word containing `expir`. The regex now recognizes that specific observed expiry response. Fresh Biome plus the corrected case passed **16:52:22.623–16:58:49.595 UTC / 386.97s / exit 0** (Vitest **375.19s**, **1 passed / 3 deliberately unselected**). Actual unexpired PUT succeeds only into staging; after the real boundary, purge removes it, expired PUT is denied and bytes remain absent. Epoch/wrong-shop/receipt checks also pass. |
| `AARILI_PRIVATE_PROBE=aarili-private-probe-issue-2 pnpm --filter @aarili/web build`, then `pnpm smoke`, then `node scripts/check-artifacts.mjs` | **16:58:04.093–16:59:16.553 UTC / 72.46s / exit 0**. Fresh production build, standalone Next/Hono/real-PG readiness/outage, typed client, worker shutdown and **29 browser artifacts** scanned for private configuration leakage. These explicitly complete the aggregate stages skipped after its PG failure. |

Together the aggregate's 293 passes and the two exact focused passes cover all
**295 distinct database cases** on unchanged business/SQL inputs. This is
combined case evidence, **not a green `pnpm verify` aggregate**. Promotion retains
its full hosted gate; owner review must see the recorded native clock anomaly.
After the final expiry-message-only test correction the **851-file** fingerprint
is `e9917f98d1e3ecf1903d7f1971993dbcb486278bd4693cd6ed2f40bc92d39a70`
(**17:00:04 UTC**). The sole delta from the final-UI fast run is that integration
test regex, verified by fresh Biome and the actual PG/S3 case; no application or
runtime input changed afterward.

**Broad browser run:** **16:03:19.022–17:03:29.692 UTC / 3610.67s / exit 1**,
**43 passed / 2 failed**, one worker and zero retries, using:

```text
pnpm test:ui tests/ui/pattern-outputs.spec.mjs tests/ui/manual-patterns.spec.mjs tests/ui/design-specifications.spec.mjs tests/ui/design-references.spec.mjs tests/ui/measurement-sessions.spec.mjs tests/ui/measurement-history.spec.mjs tests/ui/measurement-fit.spec.mjs tests/ui/repeat-orders.spec.mjs tests/ui/customer-history.spec.mjs tests/ui/contact-merge.spec.mjs tests/ui/draft-recovery.spec.mjs tests/ui/media.spec.mjs --output=.scratch/pattern-output-ui-reviewed
```

The last media filter matched no file; actual `media-processing.spec.mjs` and
`repeat-services.spec.mjs` are included in the supplemental run, not claimed by
this command. All three pattern-output scenarios passed (English/light and
Tamil/dark in each); A's fileless scenarios also passed at all sizes. Tablet
and desktop include the final review/select-context assertion; phone preceded
that UI-only change and is explicitly refreshed next.

Two desktop regressions failed: customer-history's synthetic host did not boot
within the fixture's bound; measurement-fit's initial saved-observation assertion
reached five seconds while the page still displayed loading. Phone/tablet
versions passed. Both exact desktop tests are rerun after the heavy aggregate
has finished, with unchanged assertions/timeouts. Their failures and the
remaining actual media/service/phone checks stay open until fresh results below.

The exact unchanged desktop cases subsequently passed:
`pnpm test:ui tests/ui/customer-history.spec.mjs tests/ui/measurement-fit.spec.mjs --project=desktop --output=.scratch/pattern-output-ui-desktop-repair`,
**17:03:50.688–17:06:02.008 UTC / 131.32s / exit 0 / 2 passed**. The synthetic
customer-history host booted and completed in 34.2s; fitting completed in 52.4s.
No application change, retry setting or timeout increase was used. The broad
command's two failures remain recorded above; its 43 passes plus these two cover
its **45 distinct cases**. Actual media/service and final-phone results follow.

**Final phone refresh:**
`pnpm test:ui tests/ui/manual-patterns.spec.mjs tests/ui/pattern-outputs.spec.mjs --project=phone --output=.scratch/pattern-output-ui-phone-final`
passed **17:06:27.482–17:09:45.205 UTC / 197.72s / exit 0 / 2 passed**.
This specifically verifies the final review/select source-context assertion
and narrow-layout CSS. Together with the broad tablet/desktop passes, current
B workflows cover English/Tamil, light/dark, keyboard/axe, recovery, private
clearing and overflow at all three sizes. These two are repeated cases, not
additional distinct coverage. Supplemental media/service results follow.

**Supplemental actual media/service run:**
`pnpm test:ui tests/ui/media-processing.spec.mjs tests/ui/repeat-services.spec.mjs --output=.scratch/pattern-output-ui-media-repeat`
passed **17:09:45.276–17:13:14.268 UTC / 208.99s / exit 0 / 6 passed**.
Phone/tablet/desktop verify existing private preparation/processing/retry and
native audio decode, bilingual accessibility and service-repeat recovery/fresh
commitment/source preservation. No test, timeout, rate limit or retry setting
was weakened to make the broad failures pass.

The broad 43 passes, two unchanged desktop passes and six supplemental passes
cover **51 distinct selected browser cases**. The two final-phone passes refresh
existing cases and are not counted again. This is the relevant targeted suite,
not the entire repository browser suite. Broad failures remain reported; the
two follow-up commands and supplemental command passed. Business/SQL inputs
remain unchanged from the aggregate, and final application inputs remain
unchanged from the passing fast/build/smoke checks. Local evidence is complete
for this implementation packet; a single green full aggregate is not claimed.

Local review packet ready at **17:14:33 UTC**; its source fingerprint was
reproduced unchanged at that checkpoint. PR publication and hosted checks are
pending. Owner review/merge, fluent Tamil, assistive technology and physical
devices remain separate from this automated evidence. No activation is claimed.

## Acceptance traceability

| Acceptance | Concrete implementation and evidence |
| --- | --- |
| MP-B01 | Pattern-owned subject/upload; ready JPEG/PNG/WebP and bounded private PDF; immutable accepted original/derivative hashes; exact-reference preview/download. Output PG case 1 and bilingual browser scenario. |
| MP-B02 | V1 remains strict/fileless; V2 requires locator, ready output or explicit reuse. Upload preparation is optional. Pending/processing/rejected/wrong-purpose assets cannot publish. Contracts/property and output PG case 1; A and B browser regressions. |
| MP-B03 | Successor joins never rewrite accepted bytes or earlier versions. Selected predecessor survives failed/retried successor save; selection has its own expected head. Output PG cases 1–2 and browser sketch → PDF → explicit reuse. |
| MP-B04 | Source scale/formula text, check observations, original/target input IDs and unverified warnings appear in detail, review/select forms and reuse context. No scale approval, formula evaluator or cutting state. Contract negative flags and browser review-form assertions. |
| MP-B05 | Current wearer/guardian media authority, source-chain scope/rights and ready evidence guard API and worker. Generic signing, foreign purpose/subject/shop and private cross-wearer reuse fail closed. Output PG case 1 and authority case 1. |
| MP-B06 | Audited redaction covers private values and all draft/replay copies, including cross-wearer dependants; retained/staging intents and claim-prefix enumeration use epoch/eligibility/receipt fences. Output erasure case and authority race/purge cases; verification remains open until their fresh pass. |
| MP-B07 | Actual repeat acceptance carries metadata-only context; no new reference, selection or review. Deliberate fresh reuse pins exact source and target inputs and starts unreviewed. Authority case 3, output case 2 and repeat browser regressions. |
| MP-B08 | Input changes create visible mismatch; inactive paths/erased inputs/source withdrawal block new selection/reuse. Existing irreversible-work correction guard remains. A input regressions, output withdrawal and authority history/inactive tests. |
| MP-B09 | Six forced-RLS tables, composite ownership, immutable joins/hash evidence, atomic durable publish/audit and current-authority replay. Real concurrent promotions yield 200/412; changed-key payload rejects. Rollback, erasure race, restore and actual signed-PUT expiry have explicit PG/S3 tests. |
| MP-B10 | English/Tamil, keyboard/axe/overflow, memory-only access and late-response clearing in three viewport projects. Existing design, fitting, measurements, repeat, history, merge and recovery regressions are included. Automated viewport proof does not replace actual-device acceptance. |

## Running synthetic review

Normal owner sign-in and the seeded records were checked at
**16:40:07 UTC**, using the repository Playwright workflow after two T3 preview
snapshot timeouts (`Preview automation snapshot timed out after 15000ms.`).
The T3 tab had opened successfully; it could not provide inspection evidence.
No competitor profile or human-owned tab was changed.

- Open **http://127.0.0.1:62885/sign-in**. Synthetic credentials and exact record
  IDs are only in ignored `.scratch/pattern-output-review-host/private.json`;
  use that established private local access file. Never copy it into Git/chat.
- If stopped: with the existing pinned Node/pnpm environment run
  `pnpm exec node scripts/review-pattern-outputs.mjs`. The loopback URL may
  change; read the launcher's non-secret ready line and private access file.
- Sign in, open pattern preparation, choose the seeded top piece. The sketch
  is selected; the external SAMPLE / SCALE UNVERIFIED PDF is an unselected
  successor with a measurement mismatch. Both physical folder 12 and folder
  13 remain in recorded versions. A rejected upload remains unavailable.

1. **MP-B01/02/03:** inspect selected sketch and recorded PDF/physical versions;
   view the sketch and download the PDF. Expect a private attachment download,
   readable history and no selection change from opening/downloading a file.
2. **MP-B04/08:** open review/select on the PDF. Inspect source label R2, exact
   input provenance, mismatch, unverified scale/formula observations and the
   separate cutting disclaimer. Cancel without changing the selected sketch.
3. **MP-B02/03/10:** prepare a new reference with a physical locator and no
   upload, or upload a permitted synthetic sketch/PDF. A rejected candidate
   cannot be chosen. Save appends history; selection requires a separate action.
4. **MP-B05/07:** review the private file's rights and the separate source
   reference ID in the private access file. Explicit source review retains
   target inputs, requires acknowledgement/evidence and creates an unreviewed,
   unselected successor. Reference review grants no cutting approval.
5. **MP-B10:** repeat meaningful reading/editing in Tamil at phone/tablet/desktop
   and with keyboard/assistive technology; report fluent Tamil and actual
   device/browser observations separately from emulation.

Report `MP-Bxx — pass/fail — observation` with device/browser where applicable.
The owner need not repeat terminal verification. Stop with
`pnpm exec node scripts/review-pattern-outputs.mjs stop`; the launcher removes
its own private access file/lock and cleans its disposable services. No public
tunnel, production demo, live customer data or deployment was created.

Rollback must retain B-aware private readers, erasure consumers and worker
support once B records exist. Preserve schema/history/tombstones; repair forward
or follow the existing quarantined restore procedure. No destructive downgrade,
production migration, merge or deployment is authorized by this implementation.
