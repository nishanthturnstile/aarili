# Job slips and labels: preparation and verification evidence

24 October 2026. **Preparation only; 1.3.4 is not implemented. Owner has now
approved JS-D01–09/the A → B packet, authorised publication and the preparation
merge, and selected A to proceed.**
[REA ledger](Job_Slips_Labels_REA_Evidence.md),
[design/field matrix](Job_Slips_Labels_Design.md),
[concrete tickets](Job_Slips_Labels_Ticket_Packet.md),
[interactive review artifact](job-slips-labels-review.html).

## Checkout and readiness

Initial branch `codex/manual-pattern-outputs`, HEAD **61b177c**, with pre-existing
roadmap, Delivery_Measurements.md and Measurement_Fit_Implementation_Evidence.md
edits plus the untracked Job_Slips_Labels_REA_Prompt.md. Preserved all of them.
No automatic stash, reset, unrelated commit, new worktree, push or PR.

`git fetch origin` succeeded. Fresh origin/development is
**7bdeebc3db8ccb3a81d5d118c0e44d6df2123c29**. `git switch development` was
rejected because roadmap and delivery edits would be overwritten. The attempted
`git pull --ff-only origin development` on the unchanged feature branch also
refused divergent history. Neither advanced the checkout or discarded edits.
Preparation initially continued on that branch. The owner subsequently
authorised preserving/checking in the pending files on a new development-based
branch. All nine pending files were copied to a SHA-256-verified temporary backup
outside Git (`aarili-job-slips-checkin-20261024-084121`). After restoring the
backed-up tracked files and refreshing their line-ending-only index state,
`development` fast-forwarded from `96b3e54` to `7bdeebc` with
`git pull --ff-only origin development`. New branch
**`codex/job-slips-labels-preparation`** starts at that integrated commit.
The three-file patch reapplied cleanly with `git apply --3way`; all nine files
matched the backup after CRLF normalization before this status update. The
existing measurement evidence and timing changes are included under the owner's
explicit check-in instruction. No worktree, stash, push or issue publication.

`git diff --quiet origin/development -- packages apps scripts tests` exited **0**:
runtime/test/tool source in this checkout matches current development despite
different local feature/squash ancestry. This permits bounded source preparation
and foundation checks; it does not override the updated-branch implementation
workflow. The checkout update is now complete; implementation still needs its
own selected approved issue and focused branch from updated development.

Fresh authenticated `gh issue list --state all --limit 200` contains no 1.3.4
ticket. A and B remain draft, unapproved, unpublished and unselected. The task's
conditional implementation gate has no eligible selected issue yet. All direct
prerequisites below are closed with merged software; native blockers were read
and are closed. The query returned zero comments on these prerequisite issues,
with no additional comment pages. #155's closing-PR reference was empty, so its
known PR #163 was checked explicitly instead of treating closed status as proof.

| Capability | Issues | Merged PRs checked as ancestors of origin/development |
| --- | --- | --- |
| Command and shell | #16, #51–#54 | #21, #61/#62/#64/#66 |
| Immutable PDFs / preview/share | #59/#60 | #70/#71 |
| Grouped garments/native pieces | #118–#120 | #121–#123 |
| Applicable small services | #124–#126 | #127–#129, correction #131 |
| Exact design references | #146–#148 | #149–#151 |
| Measurement history/private references | #153–#155 | #156/#161/#163 |
| Manual pattern references/outputs | #164/#165 | #166/#167 |

#166 merged **23 October 14:58:09 UTC**, `96b3e54`; #167 merged
**17:35:49 UTC**, `7bdeebc`. #167's [run 39993819388](https://github.com/nishanthturnstile/aarili/actions/runs/39993819388)
has successful Fast verification and Dependency audit; full scaffold/browser
checks were skipped under the feature-PR workflow, not passed. Old development
branch workflow runs listed by `gh run list` have earlier SHAs and are not
claimed as full CI on this latest commit. No new promotion/main acceptance was
performed. Raw prerequisite query/merge data is outside Git with the REA inputs.

## Work prepared

- Competitor observations distinguish observed UI/actions, documented claims,
  independent proposals and unknowns. REA CLI recovery succeeded without
  installation/configuration changes. No saved competitor business mutation.
- JS-D01–09 define exact source/audience/asset freezing, minimal label allowlist,
  private-slip sharing acknowledgement, current authorization, audited erasure,
  A4 layout and honest failures/retries.
- Ticket A delivers the private garment/piece slip through the existing pipeline,
  including sharing; B delivers minimal labels. Current missing production
  adapters, image-rendering support and document-snapshot privacy coverage are
  explicit A requirements, not claimed foundations.
- HTML layout artifact uses synthetic examples, local Noto fonts, English/Tamil
  document language and distinct slip/label review modes. It is **not an issued
  PDF, live product route, implemented privacy boundary or manual acceptance**.
- Roadmap preparation links added without changing release allocation, business
  rates/policies or original dependencies. Delivery record marks preparation,
  not an implementation delivery or reconstructed coding duration.

## Fresh verification

Native Windows, Docker Desktop Linux document runtime, pnpm **12.15.0**.
Default shell Node was **24.20.0**. Commands explicitly prepend the existing
installed **24.22.1** directory to that process PATH; machine defaults and pins
were not changed. Tested runtime source is HEAD 61b177c, equal to the development
runtime comparison above; dirty files are documentation only. Logs are retained
under `%TEMP%/aarili-job-slips-20261024/`.

| Command/check | Actual result and limit |
| --- | --- |
| `pnpm verify:fast` under Node 24.22.1 | **Exit 0**. Biome, boundaries/tokens, Knip, strict types, **69 test files / 320 tests**, negative types, OpenAPI and production build passed. Final build: **12/12 tasks**, 11 cached, **43.857s**; test duration **57.70s**. Cached task logs are not fresh task execution. This is a fresh enclosing verification invocation on unchanged runtime source |
| `pnpm test:pdf` | **Exit 0**. Existing Linux namespace/seccomp sandbox under UID 1000, four fonts, 50 synthetic Tamil/mixed strings, **3 A4 + 2 A3 unchanged golden pages**; A4 594.96 × 841.92 points and A3 841.92 × 1191.12 points, renderer context/serialization/idle lifecycle passed. Fluent Tamil review remains deferred. No new template golden generated or approved |
| HTML review previews | T3 html_preview inspected **360px Tamil slip**, **820px Tamil labels**, **1440px English slip**, plus initial 728px English. No console errors or horizontal overflow in the three-size checks. Embedded existing local fonts for tool preview; repository artifact retains local font paths. One hint-contrast correction was made before the three-size round |
| Runtime comparison | `git diff --quiet origin/development -- packages apps scripts tests`: **0** |
| Whitespace check during preparation | `git diff --check`: **0**, with existing CRLF normalization notices; no discarded/reformatted unrelated edits |
| `pnpm test:integration tests/documents.integration.test.mjs tests/document-sharing.integration.test.mjs` | **Exit 0, 2 files / 8 tests, 112.83s** with real PostgreSQL/private storage/queue/native renderer foundation fixtures. Covers the existing document/storage/retry/sharing authority contracts, not the new business projection |
| Final `pnpm lint` | **Exit 0**, 740 files checked, no fixes; boundaries across 431 source files and 98 UI token sources passed. Existing unchanged script/UI-test diagnostics remain **5 warnings / 5 infos**, not a zero-warning claim |
| Preparation structure/link check | **Exit 0**: four documents, **17 local links**, nine JS-D decisions, sixteen JS-A/B criteria and A4 label grid arithmetic (180 × 267 mm usable area). This checks packet consistency, not business acceptance |
| Development-based documentation check-in | Fresh `pnpm lint`, preparation link/structure check and staged/unstaged `git diff --check` all **exit 0** after backup/reapply. `git diff HEAD --quiet -- packages apps scripts tests` also **0**. Earlier unit/type/Knip/build/PDF/integration evidence is retained because runtime inputs are identical; no unnecessary full-suite repeat |

Existing PDF/unit/integration checks
prove only their foundation scenarios, not the proposed business source/audience
projection. No full new-feature browser/axe, new job-slip/label golden, physical
Android/WhatsApp, print hardware, production restore drill or live activation
has occurred. No library setup/API syntax was changed, so no Context7 lookup was
needed for source review and documentation drafting.

The initial installed-skill search did not locate `to-tickets`. A fresh search
after owner approval located `.agents/skills/to-tickets/SKILL.md`; it was read
and applies to publication of this approved packet. No installation was needed.
The owner's explicit approval supersedes the earlier unpublished/unselected
status below; actual issue URLs will be recorded after publication.

## Requirement-by-requirement status

| Requested outcome | Preparation proof | Still required after approval |
| --- | --- | --- |
| Latest development pull | Owner-authorised backup/reapply completed; development and preparation branch base equal `7bdeebc` | New implementation branch only after an approved issue is selected |
| REA Nool/TailorMan investigation | Nine evidence IDs with actual single/multi-garment and long-note/discard actions; documented export/native-piece gaps | No invented PDF/download or vendor security claims; investigate only if an implementation decision needs another observation |
| Garment/piece private preview and immutable A4 PDF | JS-D02/04/05/06, ticket JS-A01/04/05/06/08 | Business implementation, actual stored PDFs and per-template visual/hash proof |
| Exact design/measurement/pattern references | Field matrix, source/selection locks and pinned-asset policy; JS-A02/03 | Real transaction/source-update race/consent/media tests |
| Minimal labels excluding private fitting and margins | JS-D01 matrix and structured allowlist; JS-B01/02/03 | Separate model/template and poison-field/metadata/file inspections |
| PDF download and deliberate WhatsApp sharing | JS-D07/08 and JS-A09/JS-B04; existing foundation checks | Business host, three-size controlled sharing/axe and separate physical-device acceptance |
| Missing assets/render failure/retry | JS-D03/04/05/07; JS-A03/05/10 | New business negative/recovery tests; no source substitution |
| Historical bytes/source versions/privacy | JS-D04/05; JS-A02/04/05/06/07, JS-B05 | Governed document snapshot erasure/purge extension, real RLS/queue/storage/fencing evidence |
| Tamil/pagination/printer-free use | Existing unchanged PDF goldens and HTML review layouts | All actual new template pages visually inspected, owner/fluent Tamil review and real Android review |
| QR/automation/true-scale exclusions | Design and both tickets explicitly exclude them | Remain later scope; AC-64 pattern portion not closed |
| Concrete reviewed design/tickets | Draft docs and interactive layout proposal | Owner approval/amendment, publication authorization, explicit A selection; B after A merge |

## Manual review packet for this preparation

Preparation review-ready checkpoint: **24 October 2026, 03:07 UTC**. This is
packet availability, not completion of a business implementation delivery.

**Open:** `docs/agents/job-slips-labels-review.html` in a local browser, or use the
inline review artifact. The file uses repository-relative local fonts. No server,
credentials, customer data or external send target is needed. This artifact is
an information/layout proposal, not the actual private PDF preview feature.

**Try:**

1. Review Private production slip at phone/tablet/desktop width; choose Tamil.
   Check exact reference labels, unknown values, source distinction and pattern
   warning. The example intentionally has a missing critical asset and cannot
   claim issuance readiness (JS-D02/03/06).
2. Choose Minimal labels. Review garment/piece, small-service and repeat-copy
   examples. Confirm the proposed safe fields and 87 × 63 mm eight-label A4
   geometry; screen examples are scaled, not a calibrated PDF (JS-D01/06).
3. Expand states and review failure/retry/manual-share rules. Review both ticket
   outcomes and blockers. Do not press any real WhatsApp or print control.

**Report:** `JS-Dxx — approve/change — observation`; include changed permitted
fields, audience, required assets or label layout. Approve/amend the concrete
packet and authorise publication separately; then select A if desired. The
[workflow](Development_Workflow.md) and [tracker](issue-tracker.md) require this
review before unapproved tickets/implementation. Production template, physical
device and pilot acceptance remain separate. No temporary service needs teardown;
raw research stays outside Git and the dedicated browser is left without a draft.
