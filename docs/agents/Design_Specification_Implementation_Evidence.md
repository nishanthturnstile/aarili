# Design specification delivery and verification status

**Fresh dependency check, 22 October 2026 during 1.3.2 preparation:**
[PR #151](https://github.com/nishanthturnstile/aarili/pull/151) merged at
**16:42:48 UTC**, commit `2aa1b1246213845f1dcaa55d7505051219aedecd`.
Its Fast verification and Dependency audit passed in
[run 39814350982](https://github.com/nishanthturnstile/aarili/actions/runs/39814350982).
Issues #146–#148 are closed and all three merge commits are ancestors of updated
development. Prior selected/draft/pending-merge text below is historical evidence;
original failed test totals are deliberately retained. No new human acceptance,
production privacy/retention or live-activation result is asserted by this update.

22 October 2026. Roadmap **1.3.1**. **A1 #146 / PR #149 and A2 #147 / PR #150 merged;
owner selected [B #148](https://github.com/nishanthturnstile/aarili/issues/148).** [Design](Design_Specification_Design.md),
[ticket packet](Design_Specification_Ticket_Packet.md),
[research evidence](Design_Specification_REA_Evidence.md).

[PR #149](https://github.com/nishanthturnstile/aarili/pull/149) contains A1 and merged
at **07:42:23 UTC**. PR #150 merged **10:13:32 UTC**. The B selection record is
immediately below; A1/A2 records retain their dated delivery evidence. A1's broad clean-copy run finished **248 passed /
4 failed**; its missing workflow-inventory entry was corrected and the affected
file passed **6/6**. The whole broad command was not rerun. Current focused gates,
native portability, known failures and the running review packet are detailed
below; no full-parent-feature, human acceptance or live activation claim.

## B / #148 — selected implementation, 22 October 2026

Owner instruction: update development and implement #148 after the A2 merge.
The existing checkout was clean; fetched origin, fast-forwarded `development` to
**25f7f9fe67947b82a30b8b0b3526969cf6bb1463**, and created
`codex/design-references-b`. No worktree. Stopped the old disposable A2 review
host before rebuilding. Implementation clock **10:18:22 UTC** before the first
schema edit; active coding/rework stopwatch time is unknown.

All six direct blockers are closed with merged closing PRs; each merge commit
passed `git merge-base --is-ancestor <commit> HEAD`, exit 0:

| Issue / PR | Merged commit |
| --- | --- |
| #147 / #150 | `25f7f9fe67947b82a30b8b0b3526969cf6bb1463` |
| #57 / #67 | `9998f505fbe55e7564f333a9e99cdf266e04eae3` |
| #58 / #69 | `c8f7a747bab703ba3ff6eea2fbcc5f949cc3158a` |
| #79 / #82 | `5d00a68a607fee7afb316cc5f62b7aa527c36d41` |
| #80 / #83 | `1cf572416b1cfb0cb1a696448a9dc4b144d0d13f` |
| #138 / #143 | `77766454ae9a0adede7224557b7962c22fbe3c3f` |

The merged A2 revision's Fast verification and Dependency audit passed. #148 has
`ready-for-agent`; comments were empty. The approved D8–D18 / DS-B-01–09 packet
is the implementation contract. Nool's T3 observations and dedicated REA access
gap remain exactly as recorded; no new competitor/backend claim is inferred.

### B implementation

Additive migration **0044_design_references.sql** introduces typed private-order
and reusable-library subjects, source/rights values, immutable asset ownership,
exact specification reference/annotation children and redactable private draft
responses. Existing A2 draft schema v1 stays strict; schema v2 carries the complete
reference set through the same workflow/engine. Version-aware dispatch selects
the adapter; v1 cannot silently discard saved references. Every replacement is a
successor specification; geometry refers to the accepted display digest and
requires review when bytes change. PDF/audio annotations remain plain notes
because the existing validators expose no trusted page/duration metadata.

Web and worker use the same core design-media policy and current recorded wearer
and guardian evidence. The worker receives the reviewed wearer-policy object,
not an environment consent flag. Existing media admission/processing/fencing,
immutable variants, usage accounting and restore-aware runner remain the pipeline.
Generic byte signing denies design assets; exact saved-version/reference and
active durable-draft/reference reads authorize their concrete association before
issuing an existing five-minute capability. Draft review locks and re-reads the
current draft under the same privacy barrier; it does not publish a specification.
Status reads
remain usable for pending candidates. No storage keys appear in the product DTOs.

Lock classes: request/draft, shop design-media barrier, all sorted booking/order
aggregates and identity authority, design scope/configuration, sorted media.
Multi-source reads discover the whole order class under the barrier. The short
shop barrier serializes subject/privacy/reference decisions for this owner-only
slice; storage processing I/O remains outside claim/final transactions. Existing
configuration publishers never acquire business aggregates after their locks.

The approved software bounds are 20 references per version, 20 annotations each,
caption/reason 1,000 and source/note 2,000 characters, with no truncation. The
existing **512 KiB aggregate draft JSON request limit** still applies; valid
individual fields can collectively exceed it (especially Tamil text), returning
413 and retaining unsaved page input. These are ceilings, not a guarantee that
all fields can simultaneously reach their individual maximum. Existing
#58 formats/limits/exclusions apply. No new dependency, recording/transcription,
public gallery, arbitrary URL ingestion, PDF renderer, approval writer or legal
policy is introduced. Retained-media purge, processor/backup erasure and approved
production privacy/configuration remain explicit live-activation gates.

### B development verification

Package builds pass after narrowing the denial helper and using the existing
wearer-repository export. The real PG migration applies. Initial workflow test
failed at a fixture consent using the customer notice rather than the distinct
wearer notice; corrected that fixture and made the worker policy input explicit.
Development failures were diagnosed and retained: the old A2 event guard only
admitted schema v1 (extended explicitly for v2); a trigger's `old` SQL alias
collided with PL/pgSQL OLD (renamed); privacy joins needed an app_owner SELECT
policy under FORCE RLS; draft GET returns a record directly; stale CAS is 412;
media admission/completion permission denial is 403 and completion requires ETag.
The real guardian race exposed a worker notice mismatch: guardian policy is now
supplied separately from wearer policy, matching the web composition. The race
passed **11:34:18.526–11:34:36.062 UTC**, exit 0, **17.536s**: withdrawal after
snapshot blocks final acceptance, leaves no media.stored usage, and cross-wearer
draft association is refused. Accepted-byte cleanup remains separate.
The browser's initial readiness poll repeatedly clicked Reload and observed its
own busy state; queue evidence showed accepted completion. The test now waits
for worker state, reloads once, then observes the enabled candidate control.
Fresh focused evidence: the original bilingual/theme browser workflow passed
all three sizes **11:39:39.424–11:43:32.251 UTC**, exit 0, **232.827s** before
the finish review. That review returned four material fixes: per-draft attachment
identification/authorised inspection, exact saved component labels, compact
provenance disclosure, and bilingual rights labels. All four are implemented;
updated captures were submitted for review. The new active-draft preview
route passes real PG/S3 tests for every supported format, wrong shop and promoted
draft denial, plus concurrent erasure. Targeted PG command **11:53:35.699–
11:54:31.655 UTC**, exit 0, **55.956s**, **3/3** across two files. The current
320px Tamil source/IME/keyboard/unavailable-media scenario passed **11:59:08.913–
11:59:48.690 UTC**, exit 0, **39.777s**, including real source publication and
core revision with failed historical media access.

The expanded focused browser command passed **6/6**, **270.970s**,
**12:00:36.605–12:05:07.575 UTC**. Round two returned **recapture** because
the tablet/desktop outage files were actually 320px captures; it did not score
the fixes. Corrected only capture timing/viewport setup: open the revision,
capture document top plus failed historical reads at each configured viewport,
then restore 320px for source-entry testing. Rerun **3/3**, **102.728s**,
**12:13:12.631–12:14:55.359 UTC**. Primary capture widths are 360/820/1440;
the separately named source-workbench crops use a 320px page viewport (272px
element crops, not full-page images).
The actual guardian/age worker race also
passed **1/1**, **16.610s**, **12:07:52.717–12:08:09.327 UTC**: consent withdrawal
and then unknown age while processing is outside the transaction each prevent
final acceptance and usage recording. These are synthetic policy fixtures.
Round three also returned **recapture**: viewport widths were valid, but only
the image-read action had been exercised. PDF and voice showed unclicked download
controls. The scenario now clicks each historical download action and requires
three failure messages before capture. No product code changed for either
recapture. The full browser invocation then passed all **six new reference
cases** at 360/820/1440, including the stricter three-failure outage assertion.
All **30** required PNGs were refreshed after the run start, checked for valid
headers/dimensions and opened for inspection. Full-page outage dimensions are
360×14705, 820×11403 and 1440×10959. The 12 draft-fieldset crops are 312/772/1104px
wide within their respective page viewports; the three source-workbench crops
are 272×2560 within 320px pages. They are explicitly element crops, not claimed
full-page viewport images. Fresh full finish review round four accepted all
30 captures and all four original fixes, with matching type/material/ground,
exact component labels, translated rights and outage presentation. Its disposition
was **fix** for one additional D16 requirement: a compact current-versus-proposed
reference comparison alongside the desktop successor editor.

The second material fix batch adds that comparison, using exact current-version
and live draft values without new media reads. It exposes component, immutable
asset identity, caption, intent and every annotation/anchor, with explicit
successor removals and preserved-history wording. Desktop uses an adjacent
comparison; narrower layouts stack it. English/Tamil copy separates save-only,
current selection and customer approval. New browser assertions edit caption,
intent and notes, remove a reference, verify unchanged history and check the
desktop/stacked geometry before save. Current rebuild and fresh captures pass;
the verdict pass scored this D16 fix **resolved**, disposition **ship**. All four
prior fixes remain retained; no material batch regressions observed. This verdict
covers the scored fix only, not whole-surface/backend/human/live acceptance.
No second detector or redesign.

The separate Impeccable documentation handoff checked both specification/reference
components, canonical CSS, bilingual reference messages, D8–D18 and sampled shared
Button/Input components. It recommends preserving the incumbent system: Current
palette, local Noto families/weights, shared fields/actions, 44px controls, wrapping
and bounded private previews remain in use. No new visual-world files or system
rules are warranted. Its source inspection is not rendered/device acceptance.
The fresh post-comparison documenter rechecked both components, CSS, bilingual
messages, shared Button/DraftForm and D8–D18. It again returned **No changes**:
the desktop adjacent/stacked-before-submit comparison preserves incumbent tokens,
typography, spacing and controls, without a reused-system rule change. This is
source evidence, not rendered or human acceptance.
The system document's older supported-workflow inventory is pre-existing drift;
it was reported, not repaired or adopted as a new baseline.

### B acceptance traceability

The following maps implementation and focused development evidence; final broad
command results and human findings are recorded separately, not inferred here.

| Acceptance | Implementation and observed focused evidence |
| --- | --- |
| DS-B-01 | `design-references.integration.test.mjs` admits/processes/reopens JPEG, PNG, WebP, PDF, MP3, M4A and WAV through real PG/S3/worker. Pending promotion fails. Existing media validators retain their format exclusions; browser upload uses the existing private upload form. |
| DS-B-02 | Frozen version/reference/question IDs, explicit whole scope, independent caption/intent and source/rights/date; trusted accepted/display hashes and dimensions. PG exact snapshot assertions; draft/saved bilingual browser review and lazy authorised attachment actions. No PDF-page or audio-time geometry is invented. |
| DS-B-03 | Successor saves retain exact old snapshots, save-only/current distinction, changed-byte geometry review, removal and concurrent CAS 200/412. Same-key promotion replays exactly. DB append/creating-transaction guards seal children. |
| DS-B-04 | Reusable library requires shop-owned/licensed evidence and exact category. Private origin cannot change through an opaque `media_reference` insertion; explicit same-wearer new-order association succeeds without changing origin, cross-wearer fails. A2 governed-change and no-approval boundaries remain in force. |
| DS-B-05 | Actual wearer/guardian policy in both web and worker; minor payer-only admission refusal, completion refusal after withdrawal, withdrawal and age-change races during worker processing. No accepted usage on denied finalisation. |
| DS-B-06 | Generic design byte access denied; exact saved and active-draft association reads succeed only under current authority. Wrong shop/promoted draft/erased source deny fresh links; safe attachment download through existing short-lived capability. Previously issued capability remains usable until its existing expiry. |
| DS-B-07 | Real app_privacy audited subject erasure races history/draft/replay/saved and active-draft reads; tombstones, advanced ETags, erased private values, runtime/wrong-shop denial and no late annotation insertion. Retained derivatives remain: this proves access/redaction, not object/backup purge. |
| DS-B-08 | Real source-write and reference-annotation-write injected failures leave all business/reference/value/media-reference/audit/key counts unchanged; same-key retry succeeds. Existing media processing/fencing/cleanup/restore tests remain applicable because the pipeline is reused; the broad run passes those existing files, with its one unrelated scope-error regression and correction recorded separately. |
| DS-B-09 | Six Chromium reference cases pass within the full run; 12 full-page history captures, 12 draft-review element crops, three corrected full-page outage captures and three source crops within 320px pages. English/Tamil, both themes, three viewport classes, axe, keyboard, IME deferral and core editing despite denied historical image/PDF/voice access. Physical device, screen reader and fluent Tamil acceptance remain pending. |

### B migration and recovery review

Migration 0044 SHA-256:
`411667e979eaf2ec5e7547d3697bd43926d348a0439e1fb6987c53c68dc24a0a`.
Nine new tenant tables have composite shop keys and forced policies. This is
additive, but replaces guards/privacy functions to understand v2; a rollback
must retain this schema and a compatible reader while disabling new writes.
Do not run destructive down migrations or overwrite accepted objects. Production
application still requires the existing backup/migration-lock and activation
gates. Existing technical staging/orphan cleanup does not erase retained media.
Privacy handoff must enumerate originals, accepted variants, derivatives,
redactable draft/replay values, exports/downloaded copies, backups and processors;
retention/purge and processor/backup handling remain unimplemented live gates.

### B manual review procedure

Use the existing synthetic loopback path:
`pnpm exec node scripts/review-design-references.mjs`. It creates disposable
PostgreSQL/S3 fixtures and serves the shipping specification component with a
synthetic saved JPEG/PDF/MP3 reference set. The refreshed host is
**http://127.0.0.1:49677**, normal entry **http://127.0.0.1:49677/sign-in**,
observed ready **16:23:57 UTC** after the D16 rebuild. Earlier host 56339 stopped
cleanly before rebuilding. The established private access file is
`.scratch/design-references-review-host/private.json` (ignored; never attach,
paste or commit its credentials/cookie). Use its synthetic sign-in through the
normal form. Fresh normal sign-in and authenticated history reads both returned
200, with one version and three seeded references. T3's own review tab navigates
to normal sign-in; no session was injected into it. No tunnel, production demo,
real customer or minor image.

1. Select the synthetic garment's native top-piece scope and open v1. Review
   component/whole-scope labels, captions, inspiration/instruction, source/rights
   and the separate customer-approval boundary (**DS-B-02/04**). Open technical
   provenance only when needed. Authorise an image thumbnail and download the
   PDF/voice note; no autoplay or inline arbitrary document execution.
2. Revise v1. Inspect each attachment before publication. Create a private source
   or shop-owned reusable source with explicit source/rights evidence. Upload
   only a synthetic supported image, PDF or MP3/M4A/WAV; processing stays separate
   from ready. Attach the ready candidate to the intended component, enter a
   caption and text/normalised image annotation (**DS-B-01/02/04**).
3. Replace an asset or caption/note/intent, record the revision reason and save
   without using it. Before submitting, compare current and proposed component,
   exact asset IDs, caption, intent, notes/anchors and removals in the adjacent
   desktop review (stacked before submission on narrower screens). Current
   remains v1; reopen exact v1 and the successor. A
   separate explicit use action changes current. Changed-byte geometry requires
   review, and removal from a successor keeps old history (**DS-B-03**).
4. In English and Tamil/light and dark, use keyboard annotations/source fields
   and narrow layout. Observe safe feedback for a failed media read while still
   editing specification text. Automation covers synthetic denied reads and
   stale/CAS/privacy races; do not replay terminal checks or invent real minor
   evidence for human review (**DS-B-05–09**).

Report `acceptance ID — pass/fail — observation`, with actual Android device/RAM/
browser, fluent Tamil or screen-reader findings where applicable. Those human
findings, useful real sketch legibility and installed-device audio codec behavior
remain pending independently of Chromium automation. Teardown:
`pnpm exec node scripts/review-design-references.mjs stop`; the host cleans its
disposable web/database/storage fixture. No merge/deployment is implied.

Two clean-native attempts installed the unchanged frozen lockfile and built/
typechecked package exports in disposable paths containing spaces, but their
full verification did not pass. First (**156.544s**) found an old media unit
stub missing the request-key seam now acquired before authority; updated the
stub and kept the assertion that denial never inserts an asset. Second
(**158.969s**) hit the unchanged jobs binding property's 5s timeout while the
full browser suite was starting. No timeout, retry, seed or property coverage
was weakened. Stopped concurrent heavy suites; sequential root verification
then passed **288/288 unit/property tests**, all negative declarations and
**111** OpenAPI paths, and was deliberately interrupted during the PDF image
build to apply the finish-review changes. That intermediate run is not final
verification. The full browser attempt was also interrupted after its first
passing case; **234** discovered cases then, before the additional recovery
scenario. Their disposed fixture containers were cleaned explicitly.

Current checks do not yet prove full acceptance. Logs are outside Git under
`%TEMP%/aarili-design-references-b-20261022`; synthetic captures remain ignored.
The initial B review host was stopped while its API composition was updated;
fresh current access is recorded in the manual packet above. Draft
[PR #151](https://github.com/nishanthturnstile/aarili/pull/151) is open against
`development`, created **13:21:30 UTC**, immediately linked to T3. Capability
commit **00cb356a6b9b62c6aafd9bb868f97c22be647d69**. Hosted Fast/audit passed in
[run 39786125693](https://github.com/nishanthturnstile/aarili/actions/runs/39786125693):
Fast **13:21:37–13:24:01 UTC (144s)**; audit **13:21:37–13:21:54 UTC (17s)**.
These are capability-head results; a later UI/test/evidence commit needs current-head
hosted status before final handoff. The initial draft explicitly marked browser
and finish review pending; final results and limits are recorded below.

The final broad run started **12:15:30.356 UTC**. It passed lint, boundaries,
tokens, Knip, all strict types, **288/288 units**, negative checks, current OpenAPI
and the Linux PDF sandbox/goldens, then found an A2 regression. A single-case
diagnostic reproduced it (**23.227s**, **12:31:51.430–12:32:14.657 UTC**):
unsupported small-service design-list requests returned 503 instead of 404.
The new reference preflight threw a media-domain denial across the older
specification boundary; that boundary handled draft-domain denials. Source now
maps the denial to the existing draft 404. Compiled inputs were held unchanged
until the broad run ended; corrected verification follows below. No
timeouts, assertions or applicability rules were weakened.

That broad command finished **12:59:04.455 UTC**, **2614.099s**, exit 1:
**261 passed / 1 failed**, **48 passed / 1 failed files (49)**. The only failure
is the reproduced 503/404 regression above. Full-command production build/smoke/
artifact stages did not run after the integration failure. The correction was
rebuilt and verified with current `verify:fast`, all affected A2/B PG files
and applicability, followed by the remaining smoke/artifact and browser stages.
The original command is not relabelled green and the broad PG suite is not
repeated solely to replace its recorded result; affected retests follow the
repository's staged verification rule.

Post-correction `pnpm verify:fast` **exit 0**, **114.790s**,
**12:59:34.927–13:01:29.717 UTC**: lint/boundaries/tokens, Knip, strict types,
**288 units / 65 files**, negative declarations, **112 OpenAPI paths** and
production build (**17.988s**). The five affected PG files then pass **10/10**,
**150.607s**, **13:01:29.777–13:04:00.384 UTC**, including the exact previously
failing service-scope case, all A2 history/erasure/retry/CAS cases, salwar
applicability and all four new reference/consent/privacy cases. This proves the
correction at current compiled inputs; the broad 261/1 result remains above.

Current scoped clean-native verification **exit 0**, **101.732s**,
**13:04:00.454–13:05:42.186 UTC**. A disposable path containing spaces used the
existing clean verifier's source selection/exclusions and checked frozen install,
all current package exports, production web build with the private canary and
**29** browser artifacts. Lockfile unchanged; exact temporary copy removed after
an absolute temp-root containment check. This scoped check is distinct from the
two earlier failing full `verify:clean` attempts; no full clean-command green
claim. Temporary driver: `.scratch/verify-design-references-native.mjs`, ignored;
full command/output remains in the external log directory.
Production smoke **exit 0**, **11.883s**, **13:05:42.243–13:05:54.126 UTC**;
root artifact check **29 artifacts, exit 0, 0.294s**,
**13:05:54.187–13:05:54.481 UTC**. Full `pnpm test:ui` began
**13:05:54.540 UTC** and ended **15:55:06.426 UTC**, **10151.886s**, exit 1:
**233 passed / 4 failed (237)**, one worker, zero retries. All six new reference
cases passed. Failures were the three cached obsolete A2 assertions and the one
tablet generic-draft fixture clock case detailed below; no other failure.
Original failure artifacts were preserved outside Git before the fresh run.
The phone A2 browser case failed at an obsolete assertion that private references
were unavailable. B deliberately replaces that placeholder. Corrected the test
to require the bilingual source/rights region; no product code changed. The
initial phone failure remains in this full run. Tablet repeated the exact old
literal and original source location: the runner cached the original test body
for this invocation despite the source correction. A fresh affected **three-size**
file rerun is required afterward; these repetitions are not separate product bugs.
A separate tablet Tamil/dark generic draft-recovery case failed its first-page
25-row assertion (**28.2s**). Diagnostics show 27 committed rows but a list cutoff
of **14:34:28.649 UTC** before the latest seeded creation at **14:34:29.143 UTC**;
only 20 were eligible. The database clock observation was also behind that latest
creation timestamp. The fixture now checks, with bounded database reads, that
the clock is at least one second beyond the seed maximum before opening the list.
This is setup synchronisation, not a production tolerance or changed pagination;
all 25/27-row assertions, test timeouts and business retries remain intact. Fresh
affected recovery-file verification subsequently passed all twelve cases below;
retain the original failure.
The pre-commit whitespace check removed one final blank line from migration 0044;
only EOF whitespace changed after the PG/native commands, producing the current
SHA above. Executable SQL is unchanged. The real-PG browser fixtures
apply the current migration file; no history/object/data rewrite was introduced.

Post-D16 `pnpm verify:fast` **exit 0**, **126.851s**,
**15:55:17.329–15:57:24.180 UTC**: lint/boundaries/tokens, Knip, all strict types,
**288 units / 65 files**, negative declarations, **112 OpenAPI paths** and
production build (**19.216s**). The earlier standalone typecheck's stale i18n
declarations and corrected union narrowing are superseded by this complete
package rebuild and current typecheck. No backend/schema/privacy change in this
fix batch; affected real-PG evidence above remains applicable.
Current production smoke **exit 0, 12.591s**, **15:57:36.831–15:57:49.422 UTC**;
browser artifact scan **29 artifacts, exit 0, 0.292s**,
**15:57:49.482–15:57:49.774 UTC**. Fresh affected browser command runs the whole
reference, A2 specification and generic draft-recovery files, **21 cases** across
all three configured projects, with one worker and zero retries.
Its first phone outage/comparison case failed **22.3s** at a strict locator:
the synthetic reference already had a plain note, so the newly added note action
matched two textareas. Scoped the fill to the last, newly added note; production
code and comparison/history assertions are unchanged. Preserve this attempt;
the outage scenario needs a fresh three-project rerun after this invocation.
The complete invocation finished **15:57:49.842–16:10:39.525 UTC**, **769.683s**,
exit 1: **18 passed / 3 failed**. All three A2 specification cases, all twelve
generic recovery cases (including the original tablet Tamil/dark clock case),
and all three bilingual/theme reference workflows passed. The only failures
were the same cached note-selector body on all three projects, before outage
capture; their artifacts are preserved outside Git. The corrected scenario is
rerun separately, with no production changes or weakened assertions.
The first fresh outage-only invocation (**16:10:55.919–16:13:24.615 UTC**,
**148.696s**, exit 1, **0/3**) reached the new component/caption/intent/note,
replacement-ID, removal and unchanged-history assertions, then waited for a
submit button before entering the required revision reason. The application
correctly withheld promotion for that incomplete draft. The test now enters its
reason before the submission-order assertion; no production change. Artifacts
are retained and the three-project scenario is rerun with this setup correction.
The next outage invocation (**16:14:14.346–16:17:59.000 UTC**, **224.654s**,
exit 1, **0/3**) passed comparison/submission-order/geometry assertions and
produced all corrected captures, then found a second source-list Reload control
because the replacement setup had selected a source. Scoped that later reload
to the source list, preserving file reload and all source/IME/publication checks.
This is another test selector correction; application inputs remain frozen.
Final outage-only command **exit 0, 3/3**, **156.572s**,
**16:18:36.278–16:21:12.850 UTC**, all three configured sizes, one worker and zero
retries. Combined with the preceding eighteen passes, the latest affected evidence
covers all 21 cases; this is not a single green 21-case invocation or a relabelled
broad command. It verifies live component/caption/intent/note changes, different
replacement file identities, removal notices, unchanged historical values,
adjacent desktop/stacked narrow layout, comparison before submission, all three
failed historical media reads, source IME/publication and successor save.

All **31** current PNGs are fresh after the rebuilt inputs: original thirty plus
the supplemental **1440×1000 desktop-ta-comparison-viewport.png**, deliberately
scrolled to the editor/comparison (not a full-page/document-top claim). Full-page
outage dimensions are **360×17877 / 820×14037 / 1440×11770**. Draft-review crops
are **312 / 772 / 634px**, source crops **272×4214** within 320px pages. Parent
inspected the current three outage pages, supplemental desktop view, all four
desktop draft variants, representative phone/tablet English-light/Tamil-dark
drafts and the narrow source crop; no visible clipping. Fresh verdict pass returned
**ship** for the scored D16 fix: resolved, all four prior fixes retained, no
material batch regressions observed; all31 captures valid under their stated
roles. This is scoped visual review, not backend, whole-surface, actual device,
assistive-technology, fluent-Tamil or owner/live acceptance. The documenter
returned No changes; parent rechecked
the later promoted-state visibility guard against the same incumbent rules.
Final root lint after test-only corrections **exit 0, 3.885s**,
**16:23:53.805–16:23:57.690 UTC**. No capability/UI source changed after the
post-D16 fast build; later changes are test setup/selectors/capture evidence/docs.

The rebuilt manual host's normal sign-in and authenticated history read both
return **200**, with one saved version/three references. The T3 review tab is on
its ordinary sign-in page; no session was injected. Draft PR #151 remains the
owner review/merge boundary. Required Fast verification and Dependency audit
must pass on the final pushed revision; their current status is published on
the PR. No merge, production migration, deployment or live-data activation.

## A2 / #147 — selected implementation, 22 October 2026

Owner instruction: “merged to development branch take the latest pull and start
the implementation of issue #147”. The clean existing checkout was fetched,
`development` fast-forwarded to **3459ec44e327b6a7fc8bd5821d0bcba4d7aab12e**, and
`codex/design-specifications-a2` created there. The A1 disposable review host was
stopped before rebuilding. No worktree, deployment or live data.

All direct blockers are closed; each closing PR is merged and its merge commit
passed `git merge-base --is-ancestor <commit> HEAD` with exit 0:

| Issue / closing PR | Merge commit |
| --- | --- |
| #146 / #149 | `3459ec44e327b6a7fc8bd5821d0bcba4d7aab12e` |
| #114 / #116 | `c375a5af8090b846346c89c12fe097f133fc4701` |
| #118 / #121 | `80b339ff3ef192a29879f1922bed41efaff7622e` |
| #120 / #123 | `63d5123863e5324a35c635fa25592310593a828b` |
| #134 / #139 | `56b07f6b453cf560b73784c52fc60b4edbf3e34a` |
| #138 / #143 | `77766454ae9a0adede7224557b7962c22fbe3c3f` |
| #56 / #68 | `909b2798594054f9661afbbdd2bbdef4ac77f194` |

### Implementation and integrity review

`design.specification` v1 extends the existing server-draft registry, order detail,
typed API clients and owner transaction. Existing intake/repeat v1 schemas stay
strict and unchanged. Explicit repeat-design review operates after a fresh target
order has been accepted: choose the exact source version and fields, map by stable
question identity to the target's current supported profile, and review the new
draft. Its initial copied values are inspiration; a subsequent explicit owner
instruction decision is permitted. No approval, price/promise, task state or
private media transfers. Cross-wearer copying is denied even if both are visible.

Migration **0043_design_specifications.sql** adds six tenant tables: scope,
immutable event/version/typed answer, redactable saved values and redactable exact
draft-response values. Whole scope uses the order UUID and an explicit kind;
piece scope uses the native piece UUID. `UNIQUE NULLS NOT DISTINCT` and composite
order/piece/wearer/profile/question/choice FKs close null and cross-scope loopholes.
All six tables ENABLE/FORCE RLS; runtime grants are SELECT/INSERT except the
guarded scope pointer's four columns. Child INSERT is sealed to the creating
transaction, not only protected against later UPDATE/DELETE.

Each save increments the scope CAS revision and appends a complete version. A
save-only preserves current; save-and-use commits selection with the save. A
separate reasoned use command appends an event without creating a content version.
Both the latest saved base and scope revision must match. Selection of an old
version rechecks current choice eligibility and governed-work policy; inactive
old versions need a supported successor or library reactivation before selection.
An unchanged inactive answer can be retained in a same-scope revision only with
an explicit retention reason and identical prior answer/profile identity. Accepted
category/manifest availability does not replace or rewrite the pinned intake.

Actual lock graph: request key → draft → sorted booking aggregates → sorted order
aggregates → sorted customer/person and wearer authority → design scope → catalogue
→ forms → manifests → design configuration. Mixed draft-list preflight discovers
design/repeat source aggregates before taking the authority classes. A1 publishers
never acquire orders after configuration. Guardian/service authority applies on
draft edits, reads, history and replay, as well as publication. No media locks or
jobs are introduced in A2.

Business event, version/answers, pointer, minimal audit, promoted draft, exact
private response values and bound idempotency result commit together. Idempotency
JSON stores metadata with an empty payload. The new optional draft adapter hooks
read an exact response revision under current authority; older lost responses
remain exact after a later edit/promotion. Existing adapters retain their previous
behaviour. `app_privacy` receives two narrowly audited functions: saved-event
redaction also scrubs same-scope durable drafts and their exact private responses;
draft-only redaction covers never-published private drafts. They acquire the
ordinary draft/order lock classes, advance the durable draft ETag and preserve
provenance. Readers and idempotent replay re-read private values after acquiring
authority locks, so a concurrent erasure cannot return a stale private payload.
Immutable digests identify original content; redacted responses are not claimed
to hash to those digests. General retention/backups and live privacy policy remain
separate activation gates.

No new dependency, infrastructure or toolchain baseline. New package subpaths
require fresh focused clean-native export/build checks. SQL is additive, creates
no approved catalogue seeds and rewrites no acceptance snapshot or counter.
Compatible rollback disables these writers while retaining the new schema and
draft awareness; destructive down SQL is not supplied.

### A2 verification ledger

Frozen runtime inputs, base `3459ec4`, branch `codex/design-specifications-a2`.
Capability commit **3c96b945a4d4e9529bfe47bf56c2011dac2b6a5e** is published in
[draft PR #150](https://github.com/nishanthturnstile/aarili/pull/150), created
**09:49:19 UTC** and immediately registered with T3. Its required Fast verification
(**09:49:26–09:51:29**, 123s) and Dependency audit (**09:49:25–09:49:49**, 24s)
passed in [run 39758369014](https://github.com/nishanthturnstile/aarili/actions/runs/39758369014).
Later test-inventory corrections require their own affected-file evidence and
current-head CI; this earlier run is not presented as verifying later commits.
Command logs are outside Git in `%TEMP%/aarili-design-spec-a2-20261022`; synthetic
browser captures are ignored under `.scratch/design-specifications-ui`.

| Check | Fresh result and UTC command interval |
| --- | --- |
| `pnpm verify:fast` | **Exit 0, 118.199s**, **09:30:01.984–09:32:00.183**. Biome/boundaries/tokens, Knip, workspace/test types, **283 units / 64 files**, negative type checks, **106** OpenAPI paths and production build (**17.416s**). Five informational Biome messages in unchanged `review-service-additions.mjs` remain. |
| Focused clean-native export check | **Exit 0, 129.623s**, **08:33:51.025–08:36:00.648**. Frozen install, package exports/web build, private-configuration canary and **29** artifact checks; lockfile unchanged and exact disposable copy removed. This is not the full `verify:clean` command. No package/export/dependency changes followed it. |
| A2 focused real PostgreSQL | **5/5, exit 0, 76.719s**, **09:02:47–09:04:03**. Migration upgrade, whole/native scopes, all question types, exact history, forced isolation, inactive retention/reuse, CAS/replay, nine injected-write rollbacks with same-key retries, permission and erasure races. Later selection/history assertions are included in the broad run below. |
| Additional applicability real PostgreSQL | **1/1, exit 0, 26.724s**, **09:40:53.925–09:41:20.649**. `design-specification-applicability.integration.test.mjs`: exact salwar top/bottom/dupatta profiles, reviewed no-design scopes, unknown versus reviewed not-applicable, explicit none and wrong-piece rejection. Added after the broad run enumerated files, so reported separately. Runtime inputs did not change. |
| A2 Playwright / axe | **3/3, exit 0, 151.854s**, **09:25:25.144–09:27:56.998**. Phone **360×800**, tablet **820×1180**, desktop **1440×900**; EN/TA × light/dark, **12 captures**, zero axe violations. Includes keyboard, Tamil IME, save-only/use, exact committed-response loss and replay, stale comparison/recovery, inactive reuse, permission-loss clearing and no private browser storage. |
| Production smoke | **Exit 0, 23.320s**, **09:45:16.664–09:45:39.984**. Production Next/Hono/real PostgreSQL readiness/outage, typed client and worker shutdown. |
| Final test-only addition / documentation checks | `pnpm lint` **exit 0, 5.295s**, **09:47:14.277–09:47:19.572**; `pnpm knip` exit 0; artifact scan **exit 0, 0.374s**, **09:47:32.286–09:47:32.660**, **29** artifacts; `git diff --check` exit 0. No runtime changes since final fast gate. |
| Full existing real PostgreSQL regression | **Exit 1, 3301.763s**, **09:11:30.744–10:06:32.507**. `pnpm test:integration --reporter=verbose`: **253 passed / 4 stale-test failures**, **42 passed / 3 failed files (45)**. All five A2 cases passed. Failures and corrective checks are preserved below; no full-green rerun claim. |
| Existing browser regressions | **30/30, exit 0, 1473.358s**, **09:34:45.445–09:59:18.803**. Acceptance, native pieces, booking groups, booking/draft recovery, repeat and customer history, three device projects, zero retries. Disposable fixtures/web servers cleaned. |

Development failures remain in the private command logs. Early PG runs exposed
deferred FKs, an ambiguous alias and a missing privacy read policy. Expanded
browser runs exposed a scope-pointer UPSERT conflicting with the first-insert
guard, a request-generation busy-state bug, and Tamil phone overflow. The pointer
now has distinct guarded INSERT/UPDATE paths; source browsing has its own request
generation; the editor uses the existing form layout. A fixture initially tried
deleting a historical membership and correctly hit its FK; permission-loss testing
now revokes wearer authority. Final passing commands above cover these changes.
An earlier broad PG attempt was deliberately terminated to correct the UPSERT;
it has no completed-suite result. No fabricated pass count or hidden retry.

The continuing full regression reported four outdated-test failures: the two
legacy piece downgrade fixtures must preserve the new empty design-scope FK;
customer history now has seven unavailable domains because design history is
implemented; and self-review found a bootstrap inventory ordering mistake.
Only tests are corrected: the fixture captures/restores all five exact FKs,
checks both design tables are empty before its disposable downgrade, history checks
that designs is absent, and the bootstrap expected array uses JavaScript ordering.
The original broad result is retained. Corrected bootstrap file passed
**12/12, exit 0, 324.695s**, **09:51:01.601–09:56:26.296 UTC**. The first legacy
fixture correction omitted the exact draft-response FK, leaving the same two
fixture failures. After including it, both exact migration cases passed
**2/2 (42 filtered), exit 0, 47.207s**, **10:05:08.280–10:05:55.487 UTC**. The
acceptance/history-file run finished **46 passed / 2 legacy-fixture failures
(48 cases), exit 1, 910.517s**, **09:52:20.663–10:07:31.180 UTC**; all four
customer-history cases pass. Those two failures used the first correction before
the second design FK was added; their subsequent **2/2** result above verifies
the final fixture. Only those two cases call this downgrade helper. No whole-suite
rerun is claimed. Biome checked all three corrected files with exit 0;
five changed UTF-8 documents and **142** local links also passed the bounded
documentation check. Runtime inputs remain unchanged.

All four original failing scenarios now have passing corrective evidence. The
full broad command's original failure remains visible. Current-head feature CI
is linked on PR #150; the earlier capability run above records its exact tested
revision. Final documentation/test-only commits do not change runtime inputs.
Final local lint **exit 0, 2.603s**, **10:08:30.562–10:08:33.165 UTC**; the five
UTF-8 documents / 142 local links and `git diff --check` pass. The local review
packet is ready **10:08:33 UTC**. Current-head hosted checks are reported on the
PR, with human acceptance and merge still pending.

The UI received two bounded visual inspections and one mechanical review (no
findings). This does not constitute fluent Tamil, physical-device or screen-reader
acceptance. Full PDF goldens, full browser/promotion CI and full `verify:clean`
have not been run for A2; document generation is outside this ticket.

### A2 requirement review and manual packet

| Acceptance | Implementation and verification |
| --- | --- |
| **DS-A2-01** | Strict answer states and 14 independent question types; the first four controls are neck type, neck design, sleeve type, sleeve design. Exact intended-garment rational lengths and reviewed increments; no body measurements. Five core/property cases, all-types PG case and supplemental salwar/none/applicability case pass. |
| **DS-A2-02** | Explicit whole scope and native piece UUIDs, accepted wearer/category/manifest snapshot and composite tenant FKs. Whole alteration, salwar piece mismatch, foreign order/shop/wearer and unsupported/no-body service paths exercised against PostgreSQL. |
| **DS-A2-03** | Frozen definitions, exact prior answers and reasoned unchanged inactive retention. New/repeated inactive use denied. Current profile/choice eligibility rechecked under A1 configuration locks; label/disable/publish races and disabled accepted parent covered by PG cases. |
| **DS-A2-04** | Immutable versions/children, scope CAS plus latest-saved base, separate reasoned selection events and independent history pagination. Save-only/current preservation, atomic save-and-use, selecting older history, concurrent first save/revision/selection and late-child denial covered by PG/UI. |
| **DS-A2-05** | Explicit unresolved/inspiration/instruction intent; responses always report customer approval `not-recorded`. Governed-state policy fails closed on save-and-use and selection. The future governed-state seam is injected under a real owner transaction in PG tests; A2 does not implement or claim an actual 1.4.3 approval writer. |
| **DS-A2-06** | Exact source version/digest/scope revision plus explicit field selection; maps current target profile, fresh draft/IDs, copied values start as inspiration. Cross-wearer, stale, foreign and inactive sources denied; no media or commitment transfer. Existing intake/repeat schemas remain unchanged; custom/service/grouped repeat PG cases pass within the broad run, and existing three-size repeat browser regressions pass. |
| **DS-A2-07** | Six forced-RLS tenant tables, minimal durable idempotency metadata, exact private replay and narrow audited privacy functions. Real PG covers authority/erasure races, stale draft after erasure, actor/hash mismatch, all nine rollback points with successful retries, history cursor invalidation and denied runtime redaction. Broad isolation/draft/identity cases passed; corrected legacy/history checks are recorded separately. |
| **DS-A2-08** | Final three-size EN/TA/theme matrix passes, keyboard/IME/axe/reload/conflict/cancel/lost response/inactive source/access clearing exercised. Private values stay out of URLs/local storage/static service-worker cache. Owner language/device/assistive-technology review remains open. |

The running synthetic review host was ready **09:35:14 UTC**, observed by
**09:36:45 UTC**. Open
**http://127.0.0.1:49672/orders?order=01a162f6-ec15-7b9b-afe5-68ba5deb507b**.
The T3 review tab opens the normal sign-in. Read the generated email/password
privately from ignored `.scratch/design-specifications-review-host/private.json`;
do not paste it into chat or Git. This disposable shop/customer and both accepted
orders are synthetic. No outbound mail or external sharing. Playwright verified
the authenticated workflow; opening sign-in in T3 is not a manual acceptance claim.

1. Sign in, open the route above, choose the native `SYNTHETIC design-top` piece
   and inspect v1. The four independent construction/design choices and intended
   garment dimensions should be legible; references are explicitly unavailable.
2. Revise with a reason and save v2 only. Current stays v1. Close/reopen the draft,
   then deliberately use v2 with a reason. Inspect v1 and selection history.
3. Open the same scope in two tabs; advance one, then attempt to save the other.
   Compare current history and retained draft input; no automatic merge.
4. Choose the other synthetic order as a repeat source, exact version and fields.
   Inspect inspiration intent. Disable a selected source choice in A1 settings and
   retry: explicit reuse fails while ordinary intake remains available.
5. Return `DS-A2-01–08 — pass/fail — observation`. Customer approval remains
   unrecorded; private references await B #148. Human review and owner merge remain
   pending; this is not full 1.3.1 / ORD-07 completion or live activation.

To stop this host, run `node scripts/review-design-specifications.mjs stop` with
the pinned Node. To regenerate after stopping, run the same script without `stop`;
it creates a new disposable database/port/private access file. Do not rebuild the
production output while the review host is serving it. Stop/cleanup applies only
to this disposable host, not the owner's development database.

## Authority and selected outcome

After the concrete packet was presented, the owner explicitly answered
**“approved”** to publication and A1 selection. Published #146/#147/#148, read back
their native blockers, and selected only A1. All #146 direct blockers (#97/#98/
#99/#53/#55/#16) are merged, with closing commits in both development and main.
Created `codex/design-choices-a1` from updated development in the same checkout.
A2 #147 and B #148 remain blocked and unselected. Owner merge, real-data policy,
physical-device/Tamil/assistive-technology acceptance and deployment stay pending.

The following baseline/preparation sections retain what was observed before
approval; they do not describe the current implementation scope. Current A1
acceptance and fresh results follow under **A1 implementation** below.

## Historical preparation baseline evidence

`git status --short --branch` initially: `development...origin/development`,
modified roadmap and untracked `Design_Specification_REA_Prompt.md`. Both predate
the task and are preserved. `git fetch origin` succeeded. HEAD and
origin/development: **154a456ca6d132857216371694e5de08a661155f**;
origin/main: **0f784206eca5b0d0bede91ab2be62de9b5afc77c**.
Created `codex/design-specification-packet` in the same checkout, no worktree.
No application source, dependency, lockfile, migration or protected branch changed.

Commands inspected current issue titles/states/labels/comments, merged PR closing
references, native blockers (`gh api .../issues/114/dependencies/blocked_by`),
current CI and actual source. All inspected prerequisite issue comments were empty.
`gh issue list --repo nishanthturnstile/aarili --state all --search '1.3.1'`
returned `[]`; all-state inventory had only #28 open. Proposed A1/A2/B have no
native issue edges until approved publication.

| Prerequisite | Merged closing PRs; merge commits checked as ancestors of development AND main |
| --- | --- |
| 0.2.3 #16 | #21 |
| 0.4.1 #51/#52/#53/#54 | #61/#62/#64/#66 |
| Durable drafts/recovery #55/#56 | #65/#68 |
| Private uploads/processing #57/#58 | #67/#69 |
| 1.1.2 #97–#101 | #102/#104/#105/#107/#106 |
| 1.2.1 #113/#114 | #115/#116 |
| Grouped #118–#120 | #121–#123 |
| Small services #124–#126 | #127–#129 (plus #131 follow-up) |
| Repeat/history/identity #134–#138 | #139–#143 |

All `git merge-base --is-ancestor` checks above returned 0 for both branches.
Do not infer readiness from older pending headings in those evidence files.
Feature fix [PR #145](https://github.com/nishanthturnstile/aarili/pull/145)
merged 04:12:22 UTC; current-development Fast verification and Dependency audit
passed in [run 39720707778](https://github.com/nishanthturnstile/aarili/actions/runs/39720707778).
Promotion [PR #144](https://github.com/nishanthturnstile/aarili/pull/144)
merged 04:34:41 UTC; Scaffold verification, all nine browser shards, aggregate
Browser smoke/accessibility and audit passed in
[run 39721124709](https://github.com/nishanthturnstile/aarili/actions/runs/39721124709).
These are inspected inherited-baseline results, not fresh acceptance of 1.3.1.
They are background PRs, not PR work created or modified by this thread.

## Historical preparation coverage (before approval)

| Requirement | Reviewable artifact; implementation status |
| --- | --- |
| DES-01 | Design D1, source-seam inventory, A1 profile/choice publication and B rights-controlled examples. Not implemented. |
| DES-02 | D2/D3, four separate stable fields and intended-dimension distinction; DS-A1-02 / DS-A2-01. Not implemented. |
| DES-03 / AC-07 | D4/D7, current availability plus exact historical labels, explicit inactive retention/replacement/reactivation, repeat/new-use rules and races. Not implemented. |
| DES-04 | D2–D6, garment/piece applicability, immutable saved values, separate draft/current selection/concurrency; A2. Not implemented. |
| DES-05 | D5/D6/D10/D11, inspiration/instruction/approval distinction, annotations and successor reference associations; A2+B. Not implemented. |
| ORD-07 | D8–D11, images/documents/sketches/voice notes, exact component/version/source/uploader/date and existing format profiles; B. Not implemented. |
| DES-10 / AC-53 | D9/D12, private/reusable rights, current guardian authority, cross-wearer/repeat/merge denial, privacy tombstones; B. Not implemented. |
| AC-08 | Manual/external route remains possible; automatic drafting never implied. Actual method records are 1.3.3; full scenario open. |
| AC-40/55, isolation/history | Proposed PG/worker/browser negative/concurrency/retry/rollback tests in every ticket. No new runtime claims. |
| DES-06–09/11, MEA, PAT, ORD-10 | Approval/change control 1.4.3, measurements 1.3.2, pattern references 1.3.3, slips/PDF 1.3.4 remain open. |

REA executed bounded login-boundary and TailorMan observations. Authenticated Nool
sheet/attachment actions used T3 after the owner chose that fallback. Full raw
captures remain outside Git; precise IDs, actions, failures and unestablished
history/privacy capabilities are in the research record. No real data used.

## Preparation verification ledger (before implementation)

Preparation documentation checks and actual repository command results are
recorded below after execution. No software ticket acceptance or completion is
claimed. Verification-before-completion governs final reporting.

- Applied the installed verification-before-completion skill. Preparation check
  `node %TEMP%/aarili-design-spec-rea-20261022/verify-packet.mjs`: **exit 0**;
  four documents, **28 local links**, **D1–D18**, nine primary requirement/
  scenario IDs, **23 ticket acceptance IDs**, four roadmap links. It checks
  structure/links only, not software behaviour. `git diff --check`: **exit 0**.
- Initial shell resolved Node 24.20.0. Checks used the already-installed pinned
  **Node 24.21.0 / pnpm 12.11.2** without changing global configuration.
  First attempt did not start pnpm because PowerShell blocked `pnpm.ps1`.
  A `.cmd` follow-up ran child checks, but PowerShell native-stderr handling
  threw before logging/reporting a native result; the empty log provides no
  usable pass/fail evidence. No success is inferred from that wrapper.
- Reran via a Node native-process runner with stdout/stderr written directly
  to a log and exit code captured. **`pnpm verify:fast`: exit 1**,
  **63.007s**, 05:23:53.542–05:24:56.551 UTC. Lint/boundaries/tokens, Knip and
  strict types completed; Biome checked 636 files with five existing informational
  findings and no fixes. Unit stage **270 passed / 2 failed**, 62 files,
  **19.13s**. Both failures hit the unchanged 5,000ms timeout:
  `tests/command.test.ts` canonical request-JSON property and
  `tests/runtime-cleanup.test.mjs` development removed-routes check. No application
  or timeout was edited. The fast chain stopped before negative types/OpenAPI/
  final production build. Log/result: private `verify-fast-native.log` and
  `verify-fast-result.json` in the research temp directory.
- Focused diagnosis used the same unedited files/timeouts:
  **`pnpm test tests/command.test.ts tests/runtime-cleanup.test.mjs`: exit 0,
  12/12 tests, 2/2 files**, Vitest 6.34s / command 8.155s,
  05:26:21.051–05:26:29.207 UTC. Both suite-timeout cases pass in isolation;
  concurrency/load is a possible cause, not proven. No repeated full-suite
  rerun or increased timeout was used to obtain a green claim.
- **`pnpm test:negative`: exit 0, 8.036s**. All existing negative DTO/client/
  component fixtures rejected their invalid uses.
- **`pnpm openapi`: exit 0, 3.241s**. Generated 97 existing paths without
  mounting production API documentation; no tracked artifact changed.
- **`pnpm build`: exit 0, 46.768s**, finished 05:27:27.284 UTC; 12 successful
  Turbo tasks (11 cached), web production build executed. The prior unobservable
  wrapper may have populated unchanged package caches; this result explicitly
  reports reuse rather than claiming every compiler task reran.
- Follow-up command results and complete logs are private
  `followup-results.json` and `followup-1.log` through `followup-4.log` in
  `%TEMP%/aarili-design-spec-rea-20261022`. Final documentation link/coverage
  and whitespace checks were rerun after the last design clarification.

**Full `verify:fast` remains failed (two timeouts); no all-green gate claim.**
Lint, Knip, strict types, focused unchanged tests, negative types, OpenAPI and
production build have fresh successful evidence. This is verification of the
existing repository during preparation, not of unimplemented 1.3.1 behaviour.

No new PostgreSQL/S3/worker integration, full `pnpm verify`, `pnpm test:ui`,
dependency audit, physical-device, screen-reader, fluent Tamil or PDF-golden
acceptance was run for this documentation-only preparation. No runtime/schema/
media/UI implementation changed to exercise new 1.3.1 behaviour. Those remain
explicit selected-ticket checks, not waived feature acceptance. The inherited
promotion evidence is separately identified above and is not a substitute.

The inline design-review aid was rendered and inspected at 1,000px and 390px;
both previews reported no console messages. It is a diagram of the proposed
packet, not an implemented product screen or accessibility acceptance.

## Historical preparation review and live gates

Preparation review: read D1–D18 and the complete A1/A2/B acceptance/migration/
verification bodies, approve or correct the software decisions and choose the
first outcome. The final response identifies the exact approval needed. No
running design-specification screen exists, so no synthetic route or completed
human walkthrough is fabricated. The packet defines the required implementation
review host/steps/report/teardown; the selected ticket must actually prepare it.

Physical Android, fluent Tamil, assistive technology, production catalogue and
compatibility, rights/notice/retention, restore drill and product §32.2/33 live
gates remain unresolved. The inspected source has technical media cleanup and
scoped text-redaction precedents but no general retained-media purge workflow;
the design names that gap and cannot claim backup/processor erasure coverage.
No customer approval, authoritative measurement, pattern engine or PDF workflow
is delivered by this preparation.

[Delivery_Measurements.md](Delivery_Measurements.md) records implementation
deliveries. This work has no implementation start, review-ready runtime, PR or
merge timestamps. Do not count research/planning as one of the five deliveries
or reconstruct active coding time. Record those values when a ticket is selected.
No commit, push, issue/PR publication, merge, deployment, spending or live
activation occurred.

## A1 implementation — selected issue #146

Authority: owner approved publication and A1 selection after reviewing the concrete
packet. #146/#147/#148 and their native dependency edges were created and read
back. A1 starts from development `154a456ca6d132857216371694e5de08a661155f`;
the related previously dirty roadmap/prompt are preserved in this delivery.
No worktree, new dependency, lockfile or toolchain correction is involved.

### Delivered boundary and history/isolation review

- Owner Settings → Design choices and questions creates, saves, reloads, reviews
  and publishes choices and exact garment/piece question profiles. Revisions and
  attributable availability events reuse the existing durable-draft command,
  audit, idempotency, ETag and recovery engine. Configuration remains an owner
  proposal or explicitly synthetic fixture; publication is not live-policy approval.
- Contracts/core/database/API/client/UI stay in the existing packages. The typed
  client is explicitly registered with the browser import gate. Offline OpenAPI
  generation now asserts all six private query/preview routes. Mutation remains
  the existing Hono draft route; no business Server Action or duplicate draft engine.
- Four separate neck/sleeve construction/decoration dimensions, reviewed intended
  lengths (including independent front/back neckline depth), finite conditions,
  required/optional/applicability decisions and supported exact choices. No
  entered wearer answer, body measurement or specification is stored in A1.
- Exact category, manifest, piece, form and relevant checklist/task/instruction
  links are validated. Current source availability is checked at publication and
  illustrative preview. A category-label revision can be explicitly reviewed into
  a successor choice definition in the same category identity; changing category
  identity or choice meaning needs a new identity. Historical links stay exact.
- Publication serialises locks in catalogue → forms → manifests → design order,
  then atomically appends definition/typed children/availability/audit, advances
  the expected pointer and commits the draft/request result. Missing/stale/conflict/
  validation semantics remain 428/412/409/422; repeated exact requests replay once.
- Migration `0042_design_choices.sql` adds nine tenant tables. All have non-null
  shop IDs, shop-led keys, composite tenant foreign keys and ENABLE/FORCE RLS.
  `app_user` has SELECT/INSERT plus guarded current-pointer column updates; it
  cannot update/delete sealed history or add children after the creating transaction.
  Typed children mirror the immutable JSON definition, with completeness/provenance
  and cycle guards. CI's explicit tenant inventories include all nine tables.
- Browser business state is memory-only and uses existing owner-generation/session
  cleanup. Pending source/preview reads discard late results after edit/unmount or
  loss of authority. No private source query or answer is put in browser storage.
  A draft ID/section in the URL follows the incumbent durable-draft addressing.
- Preview has no business effects, makes unavailable private examples explicit,
  distinguishes unknown/selected/explicit-none/not-applicable/dependency-unresolved,
  and flags retained incompatible illustrative selections. It neither grants media
  access nor confirms a customer instruction/approval or starts production work.

### Acceptance mapping

| Acceptance | Concrete implementation and evidence |
| --- | --- |
| DS-A1-01 / DES-01 | `design-choices.ts` contracts/core, database repository and Settings screen; real-PG exact category/manifest/piece/form binding, draft save/promotion/history; browser bilingual choice creation/reload/publication and exact profile review. Synthetic salwar, alteration and fall/pico sources reuse the incumbent catalogue/forms/templates. |
| DS-A1-02 / DES-02 | Four independent controlled groups; separate typed intended lengths with reviewed units/precision; schema/property cases and PG preview distinguish unknown, explicit none, dependent and not-applicable states. No inferred defaults or wearer values. |
| DS-A1-03 / DES-04 configuration | PG scenarios cover salwar top/bottom/dupatta, alteration whole scope and fall/pico's explicit no-body/no-design decision. Wrong piece/kind/foreign category/changed semantic identity fail. Property cases reject duplicate stable fields and cycles. Preview retains incompatible selections. |
| DS-A1-04 / DES-03 | PG disable/reactivate, current eligibility, renamed labels with exact old definitions, concurrent CAS/first publication; immutable audit-linked availability. Historical reads remain accessible within the authorised shop. |
| DS-A1-05 / TRU-01 / AC-55 | Real runtime-role PostgreSQL: forced-policy inventory, missing/foreign context, update/delete/late-child denial, tenant FKs, missing/stale ETags, concurrent exact replay/mismatch, rollback after append/pointer/draft/audit/result writes; populated upgrade preserves accepted orders and all sampled earlier definitions. |
| DS-A1-06 / USE | New browser workflow covers real committed response loss + exact-key retry, unsaved cancel/reopen, save/reload/publish, IME events, keyboard/focus, English/light and Tamil/dark, axe, three screen classes, 320px reflow and tablet landscape. Human language/physical-device/AT findings remain pending. Search uses existing Tamil/Latin/skeleton normalisation, including aliases. |

### Verification environment and failure ledger

Native Windows checkout, pinned Node **24.21.0**, pnpm **12.11.2**, TypeScript
**7.0.2**, Docker Desktop Linux PostgreSQL containers. Commands use the pinned
Node directory first in PATH; the ordinary global Node differs. Complete private
logs are under `%TEMP%/aarili-design-spec-rea-20261022`; no credentials or raw
competitor captures are committed. All tests use disposable synthetic databases.
Working source was dirty atop the base above; commit/PR metadata is appended when
observed. No result below implies real-data or full parent-feature acceptance.

Development checks (not substitutes for final verification):

- Focused unit/schema/property command: **5/5 passed**, Vitest **387ms**, whole
  command **14.926s**. Initial focused PostgreSQL: **3/3 passed**, **26.35s**,
  whole command **27.309s**.
- Catalogue/forms/manifests/repeat + design PG regression: **22/22 across five
  files**, **178.65s**, whole command **193.311s**. Strengthened upgrade seeded
  an actual accepted order before migration 0042 and compared prior JSON rows.
- Added scenario check initially failed (409): its synthetic dupatta fixture
  attempted a not-required body form on a stitching service, which the incumbent
  form policy forbids. Corrected the fixture to preserve that policy; fall/pico
  retains the supported not-required body form. Then **4/4 passed**, **32.47s**,
  whole command **33.422s**. No baseline behaviour or policy was weakened.
- First desktop browser pass reached all domain/axe checks but failed its final
  storage allowlist assertion: test expected `aarili-theme`, while the incumbent
  appearance key is `aarili-appearance`. Corrected the test; no storage change.
- Clean-install attempt 1: install succeeded; boundary gate rejected the unlisted
  new typed client (**58.700s** total). Added its specific browser entry, keeping
  transitive server-import checks. Attempt 2 passed boundaries but Knip found an
  unnecessary exported fixture helper (**61.303s**); made it module-private.
- Self-review added independent front/back depth keys, bounded memoised preview
  dependency evaluation, field-associated validation, and reasoned category-label
  source refresh without changing identity. Final affected checks follow below;
  earlier source snapshots are not represented as final acceptance.
- Three-device recovery browser run passed **3/3**, **1.3m** Playwright,
  **129.639s** whole command. An expanded browser command then caught my no-design
  status using an editor-local variable (**34.683s**) and its missing union guard
  (**10.127s**). Corrected the preview to narrow `content.kind` before accessing
  applicability. These failed builds are retained, not described as browser passes.
- Final focused `pnpm test:integration tests/design-choices.integration.test.mjs`
  passed **4/4**, **59.40s**, whole command **61.682s**, including wrong-kind/
  foreign source rejection and an explicit same-category label-version refresh.
- `verify-packet.mjs` after approval/status updates: **4 documents, 27 local
  links, D1–D18, nine primary requirement/scenario IDs, 23 acceptance IDs and four
  roadmap links passed**. `git diff --check` passed; lockfile remains unchanged.

The clean/native verification copy was taken before the final front/back-key,
category-label refresh and no-design copy/status refinements. Install/export/
toolchain inputs stayed unchanged. Its broad regression result is recorded for
that frozen snapshot; current-source focused PG, fast verification and rebuilt
browser checks independently cover the affected final inputs. This distinction
prevents claiming an earlier clean-copy result as acceptance of later edits.

Current rebuilt browser regression:
`pnpm test:ui tests/ui/design-choices.spec.mjs tests/ui/shop-presentation.spec.mjs tests/ui/service-templates-history.spec.mjs`
— **exit 0, 12/12 passed**, Playwright **7.6m**, whole command **481.127s**.
The existing presentation cases cover lossless previews, preference recovery,
keyboard focus/cancel and exact bilingual template history on all three devices.

The expanded four-combination language/theme matrix then ran against that same
production build with `pnpm exec node scripts/test-ui.mjs tests/ui/design-choices.spec.mjs`
— **exit 0, 3/3 passed**, Playwright **1.8m**, command **116.344s**. Each screen
class checked English/light, English/dark, Tamil/light and Tamil/dark with axe;
**zero violations** and **12 captures** in `.scratch/design-choices-captures`.
Tablet landscape and 320px reflow also passed. This repeat was required by newly
expanded theme coverage, not a repeat of an unchanged successful check.

The explicit availability/profile and availability/definition races were added
to the existing concurrency case and rerun with
`pnpm test:integration tests/design-choices.integration.test.mjs -t concurrent`
— **exit 0, 1 passed / 3 filtered**, Vitest **22.41s**, command **24.037s**.
Profile publication either commits before disable or rejects the inactive source;
the final profile is ineligible after disable. Competing availability and definition
changes yield exactly **200/412**, with no lost update. Other current A1 cases
retain their unchanged-input 4/4 result above.

Final current-source `pnpm verify:fast` — **exit 0, 118.160s**; **277 units / 63
files**, Vitest **14.83s**; strict type tasks **23 successful**; production build
**12 successful tasks / 16.623s**, including web and worker. Lint/boundaries/tokens,
Knip, negative types and **103 offline OpenAPI paths** passed. Five existing
informational Biome template-literal suggestions in `review-service-additions.mjs`
are unchanged; no formatting/lint errors. That result predates the final
presentation/validation refinements described below.

Supplementary `pnpm verify:clean` is still running at draft publication. Its
frozen install passed with the lockfile unchanged; lint, Knip, strict types,
277 units, negative types, OpenAPI and the Linux sandbox's **five A4/A3 page
goldens / 50 synthetic strings / four fonts** passed. Its full integration/build/
smoke/artifact/cleanup result is pending until recorded below; no full-pass claim.

The continuing broad run exposed **four failures** in `drafts.integration.test.mjs`:
its exact production-workflow list omitted the new `design.choices` entry. Added
that one expected entry; no draft/runtime assertion was relaxed. Current-source
`pnpm test:integration tests/drafts.integration.test.mjs` — **exit 0, 6/6 passed**,
Vitest **106.68s**, whole command **108.050s**. The original broad run retains its
failed frozen assertion and is not represented as green; final totals follow.

Because the broad check's failed test prevents its later build/artifact stages,
ran a fresh disposable native **install/export/build/canary** check separately.
`pnpm exec node %TEMP%/aarili-design-spec-rea-20261022/verify-clean-exports.mjs`
— **exit 0, 154.268s**. This temporary recipe copies `scripts/verify-clean.mjs`,
replacing only its broad `verify` stage with `build:packages`; it retains frozen
install, clean web build with the existing private canary, artifact scan,
unchanged-lock assertion and guarded deletion of its exact temporary directory.
All installed packages are the pinned workspace dependencies. This explicitly
checks native export/install portability; it does not claim a second full verify.

Current `pnpm smoke` — **exit 0, 31.874s**: production standalone Next/Hono,
real PostgreSQL readiness/outage, typed operational client and worker shutdown.
`pnpm exec node scripts/check-artifacts.mjs` — **exit 0, 0.533s**, **29 browser
artifacts** checked for synthetic private-configuration leakage.

### Publication and review state

Capability commit **53be125bbef5c1e9b54e6309739be18f39d11ac2** was committed and
pushed after current-source fast/PG/browser evidence. Draft
[PR #149](https://github.com/nishanthturnstile/aarili/pull/149) targets development,
created **06:36:00 UTC** and registered with T3 immediately. At **06:36:11 UTC**,
required Fast verification and Dependency audit were running in
[run 39734956167](https://github.com/nishanthturnstile/aarili/actions/runs/39734956167).
Full scaffold/browser jobs are deliberately skipped on feature PRs under the
approved workflow; this is not a passing promotion gate. A later test-inventory/
evidence-only follow-up preserves runtime capability inputs. Current-head CI,
owner acceptance/merge and deployment remain separately gated.

The inventory-correction revision **def9b5d90deb7cebcb51570d2fa7c1b5f8054e15**
passed both required hosted checks in
[run 39735741565](https://github.com/nishanthturnstile/aarili/actions/runs/39735741565):
Fast verification **06:43:32–06:45:26 UTC** (114s), Dependency audit
**06:43:31–06:44:56 UTC** (85s). These are that revision's results; later
presentation/validation changes require their own current-head CI.

### Broad-run closeout and final refinements

The original `pnpm verify:clean` completed **exit 1, 3491.033s**. Its integration
stage finished **248 passed / 4 failed across 44 files**, **3185.47s**. The only
failures were the four draft calls whose test wrapper asserted an outdated
workflow inventory, producing a masked 503 instead of 200. The corrected complete
file's **6/6** result is above. The original frozen command remains failed; it was
not rerun wholesale after a one-entry assertion correction. Successful unaffected
results are retained under the workflow's evidence-reuse rule. Its temporary
installation directory and disposable PostgreSQL resources were cleaned up.

Its later build/smoke/artifact stages did not execute because integration failed.
Those checks were completed independently: current-source fast production build,
fresh native frozen install/package exports/web build/private-canary scan,
production readiness/outage/worker shutdown and browser-artifact scan above.
This does not turn the original full-command failure into a pass.

Final presentation review replaced internal ticket wording with the plain
unavailable-reference state and marks an explicit-none option visibly in the
illustrative selector. The browser case now selects it and checks the none label
separately from unknown and the selected state. Final validation review memoises
completed schema graph visits as well as preview evaluation; a malformed 40-node
shared dependency graph is rejected without exponentially revisiting branches.
It adds one bounded negative unit case; no compatibility policy or source history
is changed. A final fast attempt caught formatting in that test (**1.333s**),
then Biome corrected it without changing its behaviour.

Frozen final `pnpm verify:fast` — **exit 0, 97.886s**, **278 units / 63 files**,
Vitest **11.45s**, all strict type tasks, negative-type checks, Knip/lint/boundaries/
tokens, **103 OpenAPI paths** and production web/worker build (**14.311s**) passed.
Final `pnpm test:integration tests/design-choices.integration.test.mjs` — **exit 0,
4/4 passed**, Vitest **45.61s**, command **46.852s**. This includes the expanded
availability/profile/definition race in the complete file, not only a filtered run.
Final `pnpm exec node scripts/test-ui.mjs tests/ui/design-choices.spec.mjs` against
the frozen fast build — **exit 0, 3/3 passed**, Playwright **1.5m**, command
**97.091s**. All four language/theme combinations on all three screen classes,
explicit-none selection, IME/recovery, keyboard/axe, landscape and 320px reflow
passed; all **12 captures** were refreshed with **zero axe violations**.

These final checks tested dirty refinements above `def9b5d`: the design contract's
graph traversal, the content editor's explicit-none label, the English unavailable
copy and their two focused test files. No runtime source changed after these
results. This closeout and delivery-timing edits are documentation-only. Final
review-ready and latest running-host checks were observed **07:15:45 UTC**.
The final rebuilt browser-artifact scan also passed: **29 artifacts, exit 0,
0.290s**. The full browser suite, physical Android, fluent Tamil and assistive
technology acceptance were not rerun or claimed; the scoped automated matrix and
the earlier 12-workflow regression are the current UI evidence.

### Migration and recovery

Migration 0042 is additive and uses the existing advisory-locked migration runner.
It seeds no approved design choice, does no order backfill and leaves existing
readers/tables intact. The populated-upgrade test applies it twice and compares
catalogue/form/manifest/order/acceptance/draft rows before and after. Private
asset/garment specification tables are deliberately absent.

Before non-disposable use: backup and review the SQL through the established
process. Compatible rollback disables the new writers/navigation and retains
schema and immutable records; no destructive down migration or historical rewrite.
Restore/kill-switch/live-data activation retain their existing gates.

### A1 manual review packet

Startup after `pnpm build`: `node scripts/review-design-choices.mjs` using pinned
Node/PATH. It creates a disposable loopback host/database and prints only its
route and private access-file location. Exact running URL is recorded below when
observed. Final host: **http://127.0.0.1:58892/settings?section=design-choices**,
review-ready and HTTP **200** observed **07:15:45 UTC** on 22 October. Earlier
51739/62781/53713 hosts were stopped cleanly for rebuilds. The final host remains
running for owner review. Private credentials: `.scratch/design-choices-review-host/private.json`
(ignored, never paste into Git/chat). Ordinary owner sign-in; no hosted tunnel.
Named shop: **SYNTHETIC Design choices**. It contains **SYNTHETIC blouse questions**,
four independent neck/sleeve choices, salwar top/bottom/dupatta profiles, alteration
and no-body fall/pico profiles. These are illustrative decisions, not approved
production content. No customer/order/approval/media is required by A1.

1. **DS-A1-01/02:** Add a choice, enter bilingual labels/meaning/category/dimension
   and review reason; save, reload, review and publish. Confirm four independent
   neck/sleeve dimensions and separate intended lengths. Cancel an unsaved edit
   and resume the saved draft; the discarded text must not appear as saved.
2. **DS-A1-01/03:** Open blouse → revise → inspect each question's expandable
   controls and exact source links → preview. Try illustrative construction and
   decoration independently. Compare salwar top/bottom/dupatta and fall/pico;
   explicit no-design is different from an unreviewed/unknown answer.
3. **DS-A1-04:** Disable a choice with a reason, publish, then reopen its old
   revision/history. Prior bilingual labels/links remain; new profile publication
   using the inactive choice is blocked. Reactivation requires a reasoned event.
4. **DS-A1-06:** Try Tamil/dark and English/light with keyboard navigation and
   tablet landscape. Report physical Android device/RAM/browser, fluent-Tamil
   readability and assistive-technology observations where available. Emulation
   and axe are automation evidence only.

Return `DS-A1-0x — pass/fail — observation`. Owner merge authorisation remains
separate. Teardown: `node scripts/review-design-choices.mjs stop`; this stops the
disposable host/database and removes the private credential/lock/stop files.

### Remaining scope and gates

A2 #147 will save/select immutable garment-linked specification versions,
control same-scope inactive retention and reset repeat intent/approval. B #148
will add private component references/captions/annotations/version-preserving
replacement for required image/PDF/sketch/voice classes. They need their direct
blockers merged and separate owner selection. Customer approval remains 1.4.3,
measurement sessions 1.3.2, manual/external method records 1.3.3 and slips/PDF 1.3.4.
ORD-07/DES-05/10, full AC-07/08 and full 1.3.1 remain open. The REA authenticated
Nool access gap remains recorded; T3 observations never became backend proof.
Physical-device/Tamil/AT review, production catalogue/compatibility/precision,
privacy/rights/retention, restore drill and pilot/live activation remain pending.
