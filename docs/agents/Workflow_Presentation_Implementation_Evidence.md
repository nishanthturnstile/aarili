# Issue #100 — lossless Simple and Detailed configuration preview

19 October 2026. Roadmap **1.1.2d**, SET-10/08; JOB-01/04 presentation;
ST-05/06/07/10–12 and AC-59 configuration contribution. Product §§6/15/27,
architecture §§6–9/11/15, the approved [design](Service_Templates_Design.md)
and [ticket packet](Service_Templates_Ticket_Packet.md) govern this slice.
No source scope or activation gate changes.

The owner requested implementation in the existing checkout. Native blocker #99
is closed by merged PR #105. Base `feda53a` includes the independently merged
binding slice #101; #106 Fast verification and Dependency audit passed at that
integrated head. Branch: `codex/simple-detailed-preview`. No worktree created.
Publication, owner merge review, deployment and live data remain separate gates.

## Behaviour and boundaries

- Simple is the implicit shop default until an owner publishes a preference.
  `shop.presentation` reuses durable drafts, recent-owner checks, ETags and
  actor/action/request-hash-bound idempotency. A preference revision records
  actor, effective time, previous revision, reason, origin draft and audit link.
  The current pointer advances once; historical values remain readable.
- A transient sample override changes disclosure only. Both views consume the
  same canonical object: definition, exact source references, generated items,
  unresolved decisions/tokens, owner assignment, dependency edges and fingerprint.
  Detailed reveals per-piece/add-on scope and instructions. Simple retains
  required blockers and unresolved checklist items. Locale and viewport do not
  enter the canonical calculation. Editing definitions or changing the selected
  template revision makes the old preview stale; explicit regeneration is required.
- Booked and Handed over are labelled separate lifecycle steps. Cutting,
  Work/Stitching, Trial and Ready are illustrative task groupings; nothing becomes
  complete. Reviewed absent/inapplicable task mappings differ from unresolved
  configuration. Every generated task uses the authenticated owner ID; no worker
  record or client-supplied actor is accepted.
- Foreign/missing catalogue or form references are visibly unavailable. Explicit
  historical definitions keep their original content; current availability is
  still shown by the incumbent manifest surface. Preview requires no production
  authority and always returns `activation: unavailable`, `effects: none`.
- No order, wearer value, approval, financial event, stock/custody event, booking,
  outbound message or job is produced by preview switching. Preferences never
  bulk-edit work. Actual per-order modes, quick-order fields and the real intake
  timing claim remain 1.2.1; no two-minute measurement is claimed.

## Storage, integrity and recovery

Reviewed additive migration `0029_shop_presentation.sql` adds only
`shop_presentation_revision` and `shop_presentation`. Both use non-null shop IDs,
shop-led primary/unique keys, tenant-composite references and forced matching RLS.
Runtime grants prevent history updates/deletes and pointer deletion. Database
guards bind revision fields to the active draft, actor and audit event; deferred
checks require promoted origin/result and a valid current pointer at commit.
Pointer guards reject reused historical revisions or skipped versions.

All repository calls use the existing owner-checked transaction. A shop lock
serializes publication and coherent current/history reads. Draft promotion
commits revision, pointer, audit, draft result and idempotency result together.
Missing context fails closed; no migration credentials enter runtime.

Back up before applying to a non-disposable database. Application rollback retains
both tables, previous preference revisions, audit and draft history. The earlier
application can ignore the new preference. Never delete/relabel history or seed
production configuration as a rollback. Dependencies, lockfile, package exports,
runtime packaging and toolchain are unchanged; no extra clean-install gate is
triggered by this slice.

## Verification record

Tested base `feda53a` plus this issue's dirty files; final source manifest and
command results are recorded below after verification. Native Windows uses the
existing pnpm-managed pinned Node runtime and Docker PostgreSQL 18 fixture.

| Acceptance | Automated evidence |
| --- | --- |
| ST-05 | Owner-assigned canonical items, six honest display milestones, implicit Simple default, published preference and exact history |
| ST-06 | fast-check repeated disclosure invariants; browser language/mode/viewport switching, exact preview equality, no mutation requests |
| ST-07 | Exact preference predecessor/history, pinned manifest references and unchanged historical manifest browser regression |
| ST-10 | Real PostgreSQL owner/foreign/missing context, strict 422 validation, 428/412/409, concurrent replay/publication, actor/action/hash denial and rollback after actual writes |
| ST-11 | English/light and Tamil/dark phone/tablet/desktop; axe/reflow, durable reload/resume, lost response exact-key retry, stale publication and sign-out clearing |
| ST-12 | Browser snapshots of every readable tenant table plus queue row counts before/after preview-only interaction; no business command requests |

Initial package build and first corrected full typecheck passed. Initial
typecheck rejected duplicate inherited translation keys (`cancel`/`more`);
those duplicates were removed. Initial fast gate rejected incomplete unit-test
context assertions (TS2352). The preview interface now exposes only its required
read methods, and unit fixtures implement that read-only interface directly.
The initial diagnostic remains in `.scratch/issue-100-fast-initial.log`.
An incorrectly forwarded integration filter started the full suite; it was
interrupted and replaced by an explicit focused Vitest invocation. The stopped
run is not counted as passing evidence.

Fresh results so far:

- `pnpm verify:fast`: exit 0, 227 tests / 52 files; lint, boundaries/tokens, Knip,
  strict/negative types, 64-path offline OpenAPI and production build passed.
  Final core/data build: 12 tasks, 18.133s. Log `.scratch/issue-100-fast-final.log`.
- `pnpm exec vitest run --config vitest.integration.config.ts tests/shop-presentation.integration.test.mjs tests/service-templates.integration.test.mjs tests/tenant-isolation.integration.test.mjs`:
  exit 0, 13 tests / 3 files, 129.06s. Log `.scratch/issue-100-integration-final.log`.
- Focused browser matrix: exit 0, **6/6** in **5.1m**, across phone/tablet/desktop,
  each with English/light and Tamil/dark. Log `.scratch/issue-100-browser-admitted.log`.
  This covers canonical equality through repeated mode/locale/viewport switches,
  default preference propagation, tenant/queue count equality, reload/resume,
  exact-key lost-response retry, stale publication, dirty cancel and sign-out.
  Historical-manifest axe and 200% reflow regressions pass at all three sizes.
- Final focus-only UI refinement: fresh `pnpm lint`, `pnpm knip`,
  `pnpm --filter @aarili/web typecheck`, `pnpm --filter @aarili/web build` all exit 0;
  log `.scratch/issue-100-focus-verification.log`. No core/DB/package input changed
  after its complete fast/PostgreSQL evidence. The affected keyboard/axe/stale
  preview browser cases pass **3/3** in **1.1m**, in both languages at every size;
  log `.scratch/issue-100-browser-focus.log`. Final phone/light and tablet/dark
  captures were visually inspected; existing identity, wrapping and focus remain.
- Dirty-source manifest: **20** runtime/test/script/migration files in
  `.scratch/issue-100-source-manifest.json`, SHA-256
  `0607acbee0e371f530e3b4565337a0de962d6595dc7717758e91e303c208d71f`.
  Documentation is excluded from this fingerprint. `git diff --check` passes.

Retained corrections: the
  original browser locator stall was interrupted; the preview intentionally uses
  a heading instead of a duplicate landmark. Two subsequent runs reached the
  competing preference setup but received expected 429 admission; the fixture
  now respects the server retry window for both competing save and publication.
  Original logs: `.scratch/issue-100-browser-initial.log`,
  `.scratch/issue-100-browser-corrected-phone.log`, `.scratch/issue-100-browser-final.log`.
  The later keyboard refinement is confined to editor/review/password focus and
  restoring the initiating control; affected checks are recorded above.

Full promotion verification, full browser suite, PDF/smoke, hosted CI, fluent
Tamil review, physical Android and assistive-technology observations are not
claimed by this local implementation. New human findings remain separate from
the automated evidence.

## Owner walkthrough

The existing production-built synthetic review runner is reused:
`pnpm exec node scripts/review-service-templates.mjs`. Private credentials stay
in `.scratch/service-templates-review-host/private.json`; do not publish that
file. Final ready URL: http://127.0.0.1:55115/settings?section=serviceTemplates,
launcher process 29148; readiness observed by 13:07:00 IST, HTTP 200 confirmed.
The earlier 61005 host was stopped cleanly before the final focus build.
No tunnel, external activation or real shop is involved.

1. Open Settings → Operating templates. Check **Workflow presentation** defaults
   to Simple. Publish Detailed with a reason; reopen **Presentation history** and
   inspect actor, effective time and previous revisions (ST-05/07).
2. Open **SYNTHETIC before-craft**, generate its configuration preview, and switch
   Simple → Detailed → Simple. Check required blockers, owner assignment and
   illustrative milestones. Open piece details/instructions and exact sources;
   compare **SYNTHETIC after-craft** for the other dependency sequence (ST-05/06).
3. Switch English/Tamil and phone/tablet/desktop. Check wording, wrapping and
   keyboard focus. Change a definition draft: its old preview must become stale
   until regenerated. No completion, booking or handover is recorded (ST-06/11/12).
4. Save a preference draft, reload/resume, then close it. Use a second tab to
   publish a conflicting preference; compare the current value and deliberately
   start a new draft rather than overwrite. Historical manifests remain exact
   (ST-07/10/11). Sign out to clear private in-memory state.

Return `ST-ID — pass/fail — observation`, with fluent Tamil/physical Android/AT
details only for the observations actually made. Human acceptance and owner
merge authorization remain pending. Stop/cleanup:
`pnpm exec node scripts/review-service-templates.mjs stop`; the runner stops its
isolated web/database and removes private access. Source and Git changes remain.
