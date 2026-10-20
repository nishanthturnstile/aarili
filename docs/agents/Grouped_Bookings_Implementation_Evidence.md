# Grouped bookings 1.2.2: preparation and owner-review status

19 October 2026; current frontier updated 20 October. **A–C approved/published
as #118–#120; A/B merged through #121/#122; C (#120) selected.**
The research/preparation record below is historical. A's application implementation,
verification and running owner review are tracked in
[piece implementation evidence](Grouped_Bookings_Pieces_Implementation_Evidence.md).
[B linking evidence](Grouped_Bookings_Linking_Implementation_Evidence.md) and
[C intake evidence](Grouped_Bookings_Intake_Implementation_Evidence.md) record the
later deliveries. C owner/merge review and human 1.2.2 acceptance remain pending.
[Evidence](Grouped_Bookings_REA_Evidence.md), [design/GB matrix](Grouped_Bookings_Design.md),
[proposed tickets](Grouped_Bookings_Ticket_Packet.md).

## Historical preparation: approval, baseline and result

The owner requested the full REA brief subject to repository gates. Clean
`development` and fetched `origin/development` matched **68d07ed**, including
planning PR #117. Created `codex/grouped-bookings-design` in that checkout;
no worktree, discarded edit, stash or automatic commit. No source, schema,
dependency, policy or product/architecture baseline changed.

Authenticated GitHub inventory found #113/#114 closed and no published 1.2.2
issue. PR #115 merged 19 October 13:36:15Z at `c6ab32d`; #116 merged 15:26:53Z
at `c375a5a`. Native #114 blockers read back as #113/#84/#85/#87/#101, all
closed. Catalogue/form/template/presentation/binding PRs #102/#104/#105/#107/#106
were separately read back as merged. No new issues or PRs were created/worked
on; these prerequisite PRs are background checks, not PRs owned by this thread.

Feature #116's run
[39275046236](https://github.com/nishanthturnstile/aarili/actions/runs/39275046236)
passed Fast verification and Dependency audit; scaffold/browser were skipped.
Latest integrated documentation PR #117's run
[39279447075](https://github.com/nishanthturnstile/aarili/actions/runs/39279447075)
also passed those feature gates, with full/browser skipped. Promotion #110 was
rechecked as merged `29c4975`; its earlier full evidence is recorded in
[Quick Order B](Quick_Order_Acceptance_Implementation_Evidence.md). This is not
a new full promotion result for grouped bookings or the latest development tree.

Prepared A/B/C as complete vertical outcomes: piece-aware Quick Orders, grouping
accepted garments without new effects, then atomic grouped intake/package
proposal. All are **proposals** until concrete packet approval/publication and
selected-ticket authorisation. All-or-nothing acceptance, same-contact one-time
linking, package authority and booking numbering are explicit review decisions.
No production rates, split, guardian permission or ready state was invented.

## Research result and limits

Primary Nool: two different live garment rows, linked synthetic profiles, one
successful two-row save **ORD-20261019-002**, reopen/direct reload, shared saved
date/notes/status and phone Cancel/detail. Exactly one additional invented
Salwar measurement was necessary for that vendor prerequisite. Raw records
remain outside Git; failures/incomplete actions and actual Evidence IDs are in
the ledger. Existing access was reused without credentials/private sign-in.

Secondary TailorMan: multi-row sample and + Package control observed; click
left sample unchanged. Reused prior Bill Detail and single-item evidence instead
of claiming a new persisted demo. TailorMate reserve was not needed. Vendor
independent legal wearers, outfit pieces, package allocation and backend integrity
remain unestablished. Aarili's design follows its own sources despite those gaps.

## Fresh local verification

Native Windows; explicitly selected existing Node **24.21.0**, pnpm **12.11.2**.
Read installed Turbo docs before repository task execution. Tested application
base **68d07ed** with documentation-only additions. A later documentation QA pass
checks final text; unchanged application inputs do not require another heavy run.

Command: `VITEST_MAX_WORKERS=4 pnpm verify:fast` (PowerShell environment assignment
and `pnpm.cmd`, existing runtime placed first on PATH). **Exit 0**. Private local
log `.scratch/grouped-bookings/verify-fast.log`:

- Biome checked **535 files**; boundaries checked **314 source files**; canonical
  tokens/PWA assets passed. No automatic formatting or fixes applied.
- Knip and strict typechecks passed.
- Unit/property tests: **54 files / 235 tests passed**, **36.91s**.
- Negative DTO/UI checks and offline OpenAPI generation passed.
- Production build: **12/12 tasks**, 11 cached package/worker tasks; web was freshly
  compiled, **26.681s** total build. Cached tasks are disclosed, not presented as
  fresh uncached compilation.

PowerShell wrapped native stderr progress as `NativeCommandError` in the log;
the process returned 0 and all component results passed. No runtime errors were
suppressed, assertion relaxed or dependency/toolchain changed. Four workers reuse
the documented resource-concurrency correction without changing test deadlines.

Final documentation QA passed across **six files**, **112 relative links**,
**10 GB acceptance rows** and **three vertical tickets**. Every one of **20**
distinct REA IDs cited in the ledger matched an actual retained raw Evidence
record outside Git, including reused evidence and incomplete attempts. Initial
QA caught abbreviated `ORD-02/03` rather than a separate explicit ORD-03 reference;
the design now names every primary ID explicitly. Strict UTF-8 decoding and
relative-link checks passed. `git diff --check` passed. Private QA command:
`node .scratch/grouped-bookings/check-docs.mjs`. Fast verification excludes
Markdown under the committed Biome includes, so it does not substitute for
this document-specific QA.

Not run: new PostgreSQL integration/concurrency tests, new grouped-booking
browser/axe workflows, full `pnpm verify`, complete promotion browser suite,
new PDF goldens, physical Android/fluent Tamil/assistive technology, pilot search
recall or restore drill. No approved implementation exists to exercise the new
behaviour. Existing integration results are only the dated baseline evidence in
the Quick Order/template records. No isolation, atomicity, guardian, history or
three-size acceptance claim for 1.2.2 follows from this preparation.

## Requirement-by-requirement disposition

| Requested outcome | Prepared evidence/design | Implementation acceptance |
| --- | --- | --- |
| Optional booking, independent orders/wearers/dates/status | GB-01/05, B/C; Nool row/save observations distinguished from Aarili identity design | Pending selected approved tickets |
| Outfit pieces and scoped unresolved work | GB-02/08, A/C; exact historical manifest and legacy adapter/materialisation | Pending; actual AC-63 handover remains 1.8.3 |
| Package versus garment price, unknown/zero | GB-03, B/C; explicit price basis and no guessed split or revenue posting | Pending owner decisions; financial commands later |
| Preserve single-garment Quick Orders/no duplicate demand | GB-04, A/B/C; demand-neutral linking/pieces, cumulative locked new acceptance | Existing baseline fast passes; new integration proof pending |
| Recoverable drafts, retries/conflicts, lossless modes | GB-06/07/08, B/C; existing controller, exact origins/key/version envelope | New multi-line recovery/concurrency tests pending |
| Isolation, guardian authority, atomicity/history | GB-05/06/08 and per-ticket real-PostgreSQL negative/race/fault matrix | Pending; competitor UI cannot prove these |
| Bilingual accessible three-size flows | GB-09 and per-ticket manual/automated steps | Pending running implementation and human reports |
| Preserve later measurement/payment/production/custody/handover slices | GB-10 and roadmap traceability | Explicitly deferred, not accidentally completed |

## Historical preparation: original review gate

At the preparation checkpoint (before the subsequent owner approval), the concrete [A/B/C packet](Grouped_Bookings_Ticket_Packet.md) is ready for
policy/scope review. Review its five decisions and select A only after approving
the proposed breakdown and applicable publication. The approval gate comes from
[Development_Workflow.md](Development_Workflow.md), “propose a concrete breakdown
for approval before publishing new tickets,” and the brief's selected-approved-
issue requirement. Existing prerequisites are merged; the missing item is the
new slice's concrete approval/selection, not a demand to reapprove those merges.

No grouped-booking running surface is represented as available. The packet
specifies exact synthetic journeys, expected observations and reporting format;
each implementation delivery must supply actual local route/startup/fixture IDs,
private access, fresh automated evidence and teardown before human usability
acceptance. Physical-device, language/AT, live configuration, privacy/restore,
owner merge and deployment gates stay separate. No merge or deployment occurred.
