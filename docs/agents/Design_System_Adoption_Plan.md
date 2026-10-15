# Adopt Current light and Current dark; remove validation surfaces

Planning review, 15 October 2026. The owner approved this breakdown and publication
with “proceed”. Published as #47 and #48; #48 has a native blocker on #47.
PR #46 and issue #45 are closed as superseded without merging. Implementation of
#47 proceeds from integrated main; #48 awaits its merged prerequisite.

## Confirmed owner decisions

- Keep the Design Lab's **Current light** and **Current dark**, including their
  existing Noto Sans and Noto Sans Tamil fonts. Remove **Candidate light**.
- Remove demos and sample records from the running application. Keep synthetic
  test fixtures, recovery checks and historical verification evidence.
- Plan and review this change before implementation.

These decisions supersede the earlier proposal to adopt Grounded Editorial.
The existing canonical light/dark foundation on integrated main is the starting
point. The unmerged candidate PR #46 should not be merged to deliver this work.

## Inspection and review findings

- The checkout is clean on `codex/design-system-trial`; origin/main is `c45d26f`.
  PR #46 is open and draft; its reported CI checks have passed.
- `packages/ui/src/globals.css` already owns the selected light/dark tokens and
  self-hosted Noto typography. The web stylesheet imports this file only.
- Six shared visual component modules exist: Button, Input, Field, Card,
  Status and Dialog. The additional icon barrel serves the synthetic specimens.
- Current owner setup, sign-in, recovery, password reset, reauthentication,
  owner and Google connection screens are working application surfaces.
  Today, garment detail and their business records are preview compositions.
- The root page is a development workspace and database-status demonstration.
  Its metadata also describes a synthetic scaffold.
- Candidate fonts, theme selection/restoration, specimen CSS, screenshots and
  a separate owner trial configuration belong to the experiment.
- Foundation examples also occur in API clients, development command routes,
  jobs and verification scripts. Some prove tenant isolation, exact money,
  idempotency and restore fencing. Removing them indiscriminately would erase
  meaningful verification coverage.

## Proposed implementation tickets, in order

### A. Finalise the existing light/dark foundation and remove UI demos

Proposed branch: `codex/design-system-cleanup`, from integrated main in the same
checkout. Prerequisites: merged UI foundation #3 and merged owner foundation
tickets; no dependency on the withdrawn candidate implementation.

1. Retain the selected palette, typography, spacing and component geometry in
   the canonical shared stylesheet. Remove preview-specific selectors and
   names; keep useful owner layout styles under product-oriented names.
2. Retain self-hosted Noto Sans and Noto Sans Tamil at existing exact pins.
   Candidate-only Newsreader, Plus Jakarta Sans and Noto Serif Tamil imports
   and dependencies must be absent from the final tree. Starting from main
   avoids introducing those dependencies in the first place.
3. Audit all six shared modules against both selected themes: normal, hover,
   active, disabled, loading, invalid, read-only, focus and dialog portal states.
   Fix demonstrated defects using semantic tokens while preserving the selected
   visual identity, existing component contracts and Base UI primitives.
4. Keep both themes usable after deleting the preview controls. Add a small,
   accessible light/dark control to the existing owner header; default to light
   and remember only the visual preference. Apply the root theme consistently
   to portals and verify first-paint and hydration behaviour. Add no theme library.
5. Delete `/dev/design-system`, preview/specimen files, synthetic Today/detail
   navigation, fixture-only icons and unused preview assets from product code.
   Replace the development landing page with an entry to `/sign-in`; retain
   setup and recovery links through the existing owner flow. Remove scaffold
   wording from document metadata.
6. Remove candidate flags, trial-only configuration and comparison tests rather
   than carrying a dormant experiment into the product. Migrate useful contrast,
   fonts, token propagation, accessibility and failure assertions to maintained
   tests of real screens/shared primitives, without shipping another gallery route.
7. Keep `/api/healthz` and operational readiness checks. Remove its demo UI;
   update browser readiness URLs, health tests and smoke assertions accordingly.
8. Record the selected foundation and owner decision in the design document
   and roadmap. Remove fictional business examples from the active design
   specification; retain historic evidence in its existing evidence documents.

Acceptance: both selected themes work on real owner screens in English/Tamil;
the demo route returns 404 in development and production; no candidate styling,
fonts, sample bookings or development landing page ships; safeguards remain.

### B. Remove foundation exemplar entry points from the running application

Proposed branch: `codex/foundation-demo-cleanup`, after A is reviewed, merged and
verified on main. This is separate because it affects API and worker composition.

1. Disconnect development synthetic command routes and their interactive API
   documentation from the application; require 404 in every runtime environment.
2. Separate exemplar browser clients/contracts from production client entry
   points. Keep the reusable authenticated transport and access invalidation.
3. Remove synthetic demonstration handlers/queues from normal worker startup;
   compose any required exemplars explicitly within verification support.
4. Retain synthetic fixtures and verification commands needed for RLS,
   concurrency, replay, ETags, money, durable jobs and recovery. Audit each
   reference before moving it, and update imports and boundary checks narrowly.
5. Keep applied migrations, tenant policies, immutable history, operational
   inspection/recovery tools and closeout evidence. No table drops, data purge,
   schema changes, auth changes or business-rule changes are proposed.

Acceptance: demos cannot be reached through the web/API or run through normal
worker composition; existing integrity and recovery tests still exercise the
same guarantees using explicit test composition.

## Component installation policy

Official shadcn documentation was fetched through Context7 during this review.
Its monorepo guidance installs selected components from the app directory using
the existing aliases; semantic CSS variables supply their theme.

- No missing primitive is currently required by the implemented owner screens.
  Audit and maintain the six installed modules rather than installing the catalog.
- If implementation reveals a concrete missing primitive, review the official
  generator output using pinned CLI 4.21.4 and existing `base-nova` configuration
  before applying it. Preserve local accessibility and token customisations.
- Future Select/Combobox, Calendar, Table, navigation, charts and other feature
  components belong with their approved workflows and pinned dependencies.
  A generic data-table recipe must not introduce TanStack Table v8; drawers must
  not introduce vaul or Radix. No future-only libraries in this cleanup.

References: [monorepo installation](https://ui.shadcn.com/docs/monorepo),
[theming](https://ui.shadcn.com/docs/theming),
[official CLI reference](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/cli.md).

## Verification and boundaries

For each ticket, run `pnpm verify` and `pnpm test:ui` with fresh evidence.
Maintain lint, Knip, strict types, negative guards, unit/property tests, real
PostgreSQL integration, OpenAPI, production build, smoke and artifact scans.

Cover both themes and languages, keyboard/focus, contrast, long/mixed-script
text, Tamil fonts/fallbacks, 44px targets, zoom/text spacing, reduced motion,
overflow and current owner success/busy/validation/recovery/Google failures.
Check 320/360/390/768/1024/1280/1440px widths and removed-route denial.
Record final font requests/payloads separately from old trial comparisons.

Traceability: USE-01/02/08/09; architecture §§5.2, 7.1, 9.2 and 15. Ticket B
also retains the relevant command/isolation/history/job/recovery guarantees in
architecture §§8, 10–13. No new product workflows, application shell, PWA,
autosave, PDFs or financial policies are included. Removing demonstrations does
not mean those future capabilities are complete. Physical-phone, shop-lighting
and Tamil screen-reader checks remain explicit manual validation items.

## Publication and sequencing

Approve this concrete two-ticket breakdown before issue publication, as required
by `issue-tracker.md`. Mark #45/PR #46 superseded by the owner's final selection
through an authorised tracker update; preserve the trial branch and evidence.
Implement A first, publish its draft PR and await owner merge review before B.
No merge or deployment is authorised by this planning document.

The planning review itself changed no application code. Implementation evidence
is recorded separately against the published tickets.
