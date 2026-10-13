# Issue #3 — configurable design-system foundation

Slice 0.1.1c, requested and approved through issue #3 (`ready-for-agent`).
Direct blocker #2 merged as PR #7, commit
`ac2b456476a35d9d9d15cee4b08e6ebd46e9eb04`; implementation starts from that
integrated main in the original Windows checkout on
`codex/0.1.1c-design-system`. The issue has no comments or additional blockers.

Sources: product USE-01/02/09, architecture §§4, 5.2, 6.2, 7.1/7.4,
roadmap 0.1.1. These are foundation checks, not completion of business or pilot
acceptance scenarios. The shell/PWA, translation catalogues, business forms,
PDFs, persistence, authentication and shop data remain later slices.

## Generator reproduction and review

Current registry metadata verified the exact stable pins: shadcn 4.21.4,
Base UI 1.9.0 (React 19 accepted), Tailwind/PostCSS plugin 4.3.3,
PostCSS 8.5.30, Fontsource Noto Sans/Noto Sans Tamil 5.3.0,
CVA 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0, lucide-react 1.55.0,
Playwright 1.64.0 and axe Playwright 4.13.0. Manifests and lockfile use exact
pins. pnpm recorded its exact release-age exception for PostCSS 8.5.30;
no blanket age-policy relaxation was added.

The inherited workspace retains the previously approved TypeScript 7.0.2
compatibility decision from #2. The architecture/roadmap snapshot still names
6.x; this issue does not silently revise that baseline or downgrade integrated
tooling. See Issue_2_Workspace_Evidence.md for the explicit owner decision and
Next compatibility evidence.

Context7 resolved and fetched shadcn, Tailwind, Base UI 1.9.0, Fontsource,
Playwright and Biome documentation. The actual CLI help and generated files
were inspected before adaptation. The current CLI rejects the documentation's
`--preset base-nova` alias; use `--preset nova --base base`. The generated
components.json style is correctly `base-nova`.

Run only in a new disposable generator directory, never over the repository:

~~~powershell
pnpm dlx shadcn@4.21.4 init --name aarili-preset --cwd "<temporary-directory>" --preset nova --base base --template next --monorepo --no-rtl --no-pointer --yes
npx shadcn@4.21.4 preset resolve --cwd "<temporary-directory>/aarili-preset/apps/web" --json
npx shadcn@4.21.4 add input field badge dialog card --cwd "<temporary-directory>/aarili-preset/apps/web" --yes
~~~

Two official generation runs were inspected: the initial npx run selects npm;
the pnpm dlx run selects the pnpm monorepo template. Both resolve to the same
real Create preset **b2fA**, with no fallback, exported in
[preset.json](design-system/preset.json). The pnpm template's 11.25.0 default
is replaced with this workspace's existing approved 12.11.2. Do not adopt
generator version ranges, TypeScript 5, ESLint/Prettier, next-themes persistence,
remote Geist font calls, generated apps, extra packages, or shadcn runtime CSS.
The first run's generated component/CSS snapshots are retained as `.txt`
provenance; they are never imported or part of the token authority.

Create URL: [real exported preset](https://ui.shadcn.com/create?preset=b2fA).
This describes the upstream starting preset, not Aarili's subsequent CSS
customisations. The local comparison is
[customisation.patch](design-system/customisation.patch).

Retained: monorepo aliases, CSS variables, semantic utilities, Base UI
Button/Input/Dialog primitives, CVA variant typing and the Field/Card
composition patterns. Adapted: local cn helper, six small components, mandatory
translated dialog close label, wrapping controls, semantic status icons/text,
44px control floor, density/radius/type/motion tokens, responsive dialog,
explicit CSS source discovery, and self-hosted fonts. Unused Label/Separator,
general Badge rendering, extra Field/Card helpers and sub-44px variants were
discarded. No Radix or vaul is installed.

## Token and component maintenance

`packages/ui/src/globals.css` owns both themes, fonts, spacing/density, radii,
shadow, focus, status/sidebar/chart foreground/background pairs and motion.
The web's CSS is a single import. Typography is Noto Sans for Latin and
Noto Sans Tamil for Tamil, with locally bundled 400/600 font files, explicit
Tamil line-height, no letter-spacing and no remote runtime request.
The same licensed Fontsource assets can be reused by the later PDF slice;
PDF embedding/shaping is not implemented here.

Use semantic utilities (`bg-primary text-primary-foreground`, `bg-card`) and
the exported typed variants. Structural dimensions, grid breakpoints and
border widths are not brand tokens. Status always has an icon plus text.
Chart pairs are reserved tokens, not installed chart components or invented
business meanings. Business rates, policies and tolerances remain data.

To add a component:

1. Fetch current relevant docs; stay with Base UI and the pinned CLI.
2. Review `pnpm dlx shadcn@4.21.4 add <component> --cwd apps/web --dry-run`.
   Both committed components.json files point to the same canonical CSS.
   The actual button dry run correctly targets the shared UI path and warns
   about overwrite plus the upstream `cn` dependency; keep our local helper.
3. Generate the candidate in a disposable preset directory. Copy only intended
   source into `packages/ui`, fix aliases, remove unused helpers, use semantic
   tokens and typed variants, and retain the touch/wrapping/focus requirements.
4. Pin only required dependencies, run Biome, update the narrowly approved UI
   import list if necessary, and run `pnpm verify` plus `pnpm test:ui`.
5. Review the diff, including globals.css. Never run `init --force`, `apply`,
   `--reinstall` or blanket overwrite over the maintained system. To evaluate
   preset reapplication, do it in the disposable directory and compare against
   the saved export/customisation diff first. The baseline is provenance, not
   an update source. Token-change/browser checks must fail if generated defaults
   replace the custom controls, fonts or CSS authority.

The static guard is deliberately targeted: it rejects raw colour functions/hex,
raw Tailwind palette utilities and duplicate canonical ownership in CSS/inline
objects/setProperty. It allows semantic values and legitimate structural
layout. It is not a complete CSS/JavaScript security analyser. Future UI
dependencies must be added explicitly to the shared UI import allowlist;
direct vendor access from app client code stays rejected.

## Acceptance coverage and evidence

| Issue acceptance criterion | Evidence |
| --- | --- |
| Supported Create/CLI route, real preset, Base UI only | Pinned official pnpm Next monorepo generator, b2fA export, source snapshots and local diff; manifest/import guards reject Radix/vaul |
| One shared globals.css, semantic utilities/typed variants | Both generator configs target the same file; app import-only guard; shared CSS and CVA components |
| Approved ivory/ink/burgundy; self-hosted Tamil/Latin; accessible status/error/focus | CSS palette and font imports; pair contrast test ≥4.5:1, input/focus against surfaces ≥3:1; loaded font faces and no remote requests in browser |
| Development-only bilingual light/dark controls, fields, statuses, dialog, dense rows/cards | /dev/design-system with temporary in-memory switches; all 12 size/language/theme combinations plus dialog captures; production smoke checks 404 |
| Colour/radius/spacing/type changes propagate; reapplication preserves customisation | Browser test derives edited declarations from canonical CSS, changes primary/radius/spacing/font/font-size, and checks button/card/app computed values without component edits; 3 token-change captures; controlled generator procedure above |
| Contrast, keyboard/focus, 44px, 360px Tamil, IME-safe fields, reduced motion, status cues | 18 Playwright tests with axe on open/closed dialog, actual keyboard mode, focus trap/restore, visible controls/close targets, no horizontal overflow, Tamil composition/empty-value preservation, reduced-motion transitions and icon/text status samples |
| Typed negative variants; targeted static negatives and structural positives | Four compiler diagnostics exactly: invalid Button variant/size, Card density, Status tone; negative raw-colour/palette/duplicate fixtures and legitimate structural positives |
| Native preview and Linux production use the same authority and independent binaries | Native frozen install and full verify; Docker Linux frozen install, same checks/build/smoke; Linux browser installation/testing separately; guide above |

Native commands: `pnpm verify` (16 Vitest tests; lint, Knip, strict TypeScript,
negative DTO/UI fixtures, production web/worker build, smoke and private-artifact
scan); `pnpm test:ui` (18 tests); `pnpm verify:clean` (frozen native install in a
temporary path with spaces, unchanged lockfile, full checks and private canary).
`pnpm audit --prod` reports no known vulnerabilities.
The Impeccable mechanical detector reported `[]` for the changed UI; actual
phone Tamil dark, desktop English light and dialog captures were visually read.

Linux: `docker build -f Dockerfile.verify -t aarili-issue-3-verify .` installs
Linux dependencies, checks types/tests/builds and verifies production 404 plus
the private canary. Docker never copies Windows node_modules, Next outputs or
browser installations. A separate disposable Linux run also passes all 18
browser tests with its own installed Chromium and fonts:

~~~powershell
docker run --rm aarili-issue-3-verify sh -c 'pnpm exec playwright install --with-deps chromium && pnpm test:ui'
~~~

Browser captures are evidence rather than pixel goldens;
font rasterisation may differ across platforms. Next dev creates the committed
apps/web/AGENTS.md guidance block; it was read and its local bundled docs used.

Limitations: browser composition events are simulated, not physical Tamil IME
verification; no physical phone/tablet, manual screen reader, WebKit/Firefox,
Tamil PDF, search, PostgreSQL/RLS, queue, restore, offline/PWA or pilot workflow
is claimed. Those are later capability/pilot gates, not omitted implemented
business behaviours. Tamil wording still needs owner/native-speaker review.
CI/required GitHub checks remain issue #6; this draft needs deliberate owner
review before merge. No deployment or live-data approval is implied.

## Isolation, history and recovery review

No API business mutation, auth, tenant schema, money, custody, immutable history,
jobs, private media or external side effects are changed. Preview inputs are
uncontrolled in-memory fields, without coercion, formatting, validation/save
callbacks, network writes, browser persistence or URL state. Cancelling the
dialog restores focus and changes nothing. The server development gate is
outside the client graph; the boundary fixture proves that importing its
environment state from a client still fails.

No migration, backup or data repair is required. Revert the focused commit to
recover the previous shared CSS; dependency changes revert with the lockfile.
The optional developer theme controls never become a product settings feature.
