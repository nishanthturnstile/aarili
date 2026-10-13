# Aarili repository readiness review

**Initial review status:** Proposed setup and planning changes for owner review. At that inspection, no product implementation, dependency installation, GitHub Issue creation, remote setting change or deployment had been performed.

**Follow-up:** The initial inspection below is historical. After owner authorisation, GitHub CLI authentication, branch/merge/Actions safeguards, the ready-for-agent label and the user-level to-tickets installation were completed; see [GitHub setup](GitHub_Setup.md). Required CI checks still wait for real scaffold workflows, and the roadmap remains proposed. No implementation issues have been created.

Sources: [Product Plan](Boutique_Business_Management_Final_Product_Plan.md), [Architecture Decisions](Architecture_and_Technology_Decisions.md), [revised roadmap](Boutique_Business_Management_Implementation_Roadmap.md), and [proposed AGENTS.md](../AGENTS.md). Source documents remain unchanged. Inspection used the local checkout, public GitHub API, GitHub connector, tool inventory, skill files and local runtime checks.

## Current state and minimum setup

| Area | Observed evidence | Recommendation / timing |
|---|---|---|
| Repository | Public `nishanthturnstile/aarili`; `main`; origin matches the supplied URL. Local and remote main are `3cde94e`. Working tree was clean at inspection. Two commits contain documentation and skills. | Keep this repository and source documents; no replacement scaffold or repository needed. |
| Structure | Three planning documents, seven vendored project skills and `skills-lock.json`. No root AGENTS.md before this review, README, package manifest, workspace, application code, migrations, tests, lockfile, CI or components.json. | The documentation-only state is appropriate. Proposed AGENTS.md and roadmap are review artifacts now. Scaffold the prescribed workspace, concise README, `.gitignore`, safe `.env.example` and runnable commands only after approval (Wave 0). |
| GitHub CLI | `gh` installed; `gh auth status` says no logged-in hosts. Git remote reads succeed. | Authenticate an identity with access before phase-by-phase ticket generation and PR work. Verify issue/PR writes without creating a dummy issue. Read access does not establish push permission. |
| GitHub connector | Tools available, but repository lookup for `nishanthturnstile` returns no repositories. Installed account list contains `mnishanth02` and `Thaarei-Technology`. | Grant the connected GitHub App access to this exact repository if using it. This is independent of CLI authentication; either authorised write path can serve ticketing. |
| GitHub safeguards | Public API: main `protected=false`, zero repository rulesets, zero Actions workflows, zero open issues/PRs, ten existing labels. Issues are enabled. Authenticated merge policies, secret settings and actor write permissions were not available. | At scaffold time add CI; then protect main with pull requests and required named checks, disallow force pushes/deletion, and review bypass/merge settings. For a solo owner, use a deliberate owner review checkpoint; do not require an unavailable second human approver. Prefer squash merge and automatic merged-branch cleanup if the owner agrees. Do not claim protection is configured now. |
| Local runtime | Node `v24.21.0`, pnpm `12.11.2`, Docker server `29.8.1` respond. `gh`, npm and Docker installed. No local `psql` found. | Pin project/runtime versions during scaffold. Use Docker PostgreSQL/Testcontainers; no host PostgreSQL or psql installation needed. Docker readiness does not prove the future test suite. |
| Package snapshot | Exact registry endpoints for Next `16.4.0`, React `19.3.0`, TypeScript `6.0.3`, pg-boss `12.37.1`, Better Auth `1.7.7` and TanStack table-core `9.2.8` return 200. | These are availability spot checks, not peer-compatibility checks. Verify all prescribed P1 versions, engine/peer ranges and Base UI recipes in 0.1.1. No silent replacement with RCs or a different major; record any required architecture correction before adoption. |
| Hosting and external services | Railway tools are exposed; no Aarili service/account configuration has been verified. No deployment assets in Git. | In Wave 0 configure only the prescribed Singapore dev/prod topology. Confirm PostgreSQL image/extensions and PITR. Before any real data, move the whole workspace to Pro, establish off-site backups, domain/OAuth/email DNS, safe processors and retention. No permanent staging or preview infrastructure needed. |

The first development increment should establish one runnable path with CI and real PostgreSQL safeguards. It should not install every future library or generate an empty package for every possible domain. Business configuration approval and manual baseline measurement can proceed alongside synthetic development; they must finish before live pilot use.

## Skills and instructions

The seven committed skills are Better Auth best practices/security, Next.js best practices, find-skills, setup-matt-pocock-skills, verification-before-completion and web-design-guidelines. All have source/hash entries in `skills-lock.json`. Their supporting files are committed. Global/session skills also cover documentation, browser testing, frontend design, module design and security workflows; they are not dependencies of the product.

- Keep the installed focused skills. Their generic examples cannot override Aarili: no business Server Actions, no Better Auth organisation/role plugins, Base UI only, immutable money and forced RLS. Read relevant skill instructions when applying them; do not auto-invoke every skill.
- **`to-tickets` was not found** in the project, user skill roots or local plugin skill files. It is needed later, not for this review. Install only that requested skill from a reviewed source before the approved ticketing step; record it in the existing skills lock workflow. No broad skill pack is necessary.
- The installed setup-matt-pocock-skills skill references issue-tracker/domain files that do not exist yet. It has not been invoked. Before using to-tickets, inspect its actual instructions and prepare only the configuration it needs, usually a GitHub tracker file. Aarili already has terminology in product §3 and one architecture source; do not create a competing ADR tree or redundant glossary merely to follow generic setup defaults.
- There was no repository or inspected ancestor AGENTS.md on disk. The user's supplied development preferences and Context7 instructions remain applicable. The proposed root file adds project rules and source precedence without copying either baseline.
- No hooks, autonomous approval loop, multi-agent orchestration or extra tracker is required. Issues and PRs are sufficient; labels can be added with the approved ticketing vocabulary later.

## Available MCP and app capabilities

Configuration section names show local `node_repl`, `playwright` and `shadcn` servers. Their callable tools are exposed. Connected tools also include GitHub, Context7, Railway and Codex review/security; unrelated app tools are available but irrelevant to this repository. This is an inventory, not a claim that every server/account has been health-tested.

| Capability | Intended use | Readiness / constraint |
|---|---|---|
| GitHub | Read/write issues and PRs | Repository visibility gap described above; CLI is also logged out. |
| Context7 | Current library documentation | Available connector. Follow the user's `ctx7` CLI resolve-then-docs convention for library-specific work; no docs lookup was needed for this source-document review. CLI login/quota has not been tested. |
| Railway | Deployment/operations inspection | Available; account/project access not tested. Use only when the infrastructure slice is authorised. |
| shadcn | Inspect component recipes | Available; no components.json yet. Check recipes target Base UI and the pinned major versions. Do not initialise the project during planning. |
| Playwright/browser tools | Interactive QA | Available; they complement committed Playwright Test/axe checks and real phone testing. No running application to test yet. |
| Node REPL | Local orchestration/analysis | Available. No additional runtime connector needed. |
| Codex review/security | Later code/diff review | Available. No implementation to scan now; not a replacement for RLS/integrity tests. |

No new MCP server is required. A database, storage or billing connector would not make correctness verifiable; the prescribed local/integration harness does that. Reuse current capabilities and avoid connecting unrelated services.

## Findings resolved in the proposed roadmap

1. **Technical prerequisites were absent.** The prior 85-slice roadmap explicitly excluded architecture. Wave 0 now assigns executable foundation checks, and architecture §4–18 obligations have delivery owners. Existing business slice IDs remain stable.
2. **Early screens lacked shared safeguards.** Authentication, transaction-local membership/RLS, mutation/audit/idempotency and optimistic concurrency precede business slices. Private media, PDF infrastructure and jobs precede reference/upload/share workflows. Money primitives and journal precede payment or costing paths.
3. **Recovery could look like a final feature.** The backup/restore switch is built early with synthetic records and tested again against the completed business workflow. No live records precede the final drill, privacy and product §32.2 gates. Restores reapply erasure/revocation records, quarantine old jobs and freeze money pending reconciliation.
4. **Scope qualifications needed explicit treatment.** Phase 1 Should items remain non-blocking except their minimum correctness prerequisites. Product BIZ-01 marks practice UX Should, while architecture §6.5 supplies its design: safe synthetic/practice isolation is foundational; full resettable self-service practice can wait. Architecture's QR generator does not make optional QR lookup Must. Gallery remains a P1 Should option or P2 baseline, independent of Instagram.
5. **Reporting and subscription timing could hide early obligations.** Pilot events, cost-to-serve and support effort are captured from the first synthetic/live workflow; the later subscription interface does not own their initial instrumentation. Source reports use agreed metric definitions; original promises/cancellations cannot inflate readiness.
6. **Finance needed exact implementation checks.** Preserve the paise remainder in FIN-05, unallocated zero-charge credit, journal balancing, no double-costing, locking and non-recycled issue numbers. Unsafe bigint-to-JavaScript conversions are rejected or bounded explicitly. A receipt renderer failure remains retryable without undoing the committed payment.
7. **Later dependencies must remain conditional.** Registered shops wait for the matching regime; external access waits for roles/continuity; customer approvals wait for OTP; automated sends wait for number/template/budget/effect-ledger approval. Manual marketing, retail, gallery and drafting need no AI or social API.

## Review boundary and remaining decisions

Mandatory before implementation: approve this roadmap/instruction proposal and establish an authenticated GitHub working path before ticketing. Mandatory during foundation development: workspace/CI, RLS, command/money/history safeguards, required P1 infrastructure and safe verification. Mandatory before live use: every product §32.2 decision, baseline, all P1 Must/scenario checks, privacy approval, Pro/PITR/off-site recovery and budget evidence.

Optional now: extra skills, MCP servers, trackers, worktrees and elaborate issue labels. Optional later enhancements follow product §31 and architecture trigger rules: offline capture, passkeys, R2 for gallery traffic, virtualisation, API extraction, dedicated PDF service, full-text search or high availability. These are not hidden pilot prerequisites. Conditional full-product capabilities (retail, drafting/patterns, AI, social/ad review and paid-shop administration) remain in the roadmap with activation gates.

No rates, taxes, privacy commencement dates, pattern formulas, subscription quotas, production domain or break-glass operator have been invented. These need their named owner/reviewer decisions at the point stated in the sources. This review is not legal advice or live-service certification.

## Native Windows / WSL2 follow-up — 13 October 2026

The owner confirmed **dedicated Aarili PostgreSQL container and volume** rather than reuse of the existing shared server. Architecture §12.3.1 now defines the local execution boundary; AGENTS.md and slices 0.1.1/0.1.2 carry its setup and verification obligations. Product scope and slice IDs are unchanged.

| Inspection | Observed state |
|---|---|
| Checkout and runtime | Native Windows `C:` checkout; PowerShell 7.6.5, Node 24.21.0 and native Windows pnpm/docker/git executables |
| Docker engine | `desktop-linux`; server 29.8.1, Linux x86_64, Docker Desktop, kernel `6.18.40.1-microsoft-standard-WSL2`; Compose 5.5.1 |
| WSL | WSL 3.0.1.0; Ubuntu-24.04 and docker-desktop running as WSL2; default-Ubuntu integration enabled |
| Native Docker API | Windows Node connected to Docker Desktop's named pipe and received successful /_ping response |
| Existing database | `local-infra-postgres-1`, image `postgres:18.6-bookworm`, published only on `127.0.0.1:5432`; native Node TCP connection succeeded and pg_isready reported accepting connections |
| Existing ownership/storage | Another Compose project, `local-infra`, launched from an Ubuntu project directory; named volume `local-postgres-data`, not an Aarili resource |
| Proposed Aarili port | Native TCP connection to 55432 was refused, so no listener answered at inspection. This is not a reservation/bindability guarantee; check Windows exclusions and bind during Wave 0. |
| Environment overrides | No process DOCKER_HOST/DOCKER_CONTEXT/Testcontainers host/socket/Ryuk-disable overrides were set. Machine/user startup configuration and a real Testcontainers lifecycle have not been certified. |

No Docker settings, existing container data, credentials or infrastructure were changed. No application packages were installed. Documentation research confirms this host/container arrangement is supported; the actual pinned Testcontainers lifecycle, new Compose resources, native file watchers, Linux build and PDF-runtime checks remain Wave 0 verification work.

## Initial planning verification (before environment clarification)

Static checks matched all 241 source requirement IDs to unique explicit roadmap register rows, with 148 Phase 1 Must IDs retaining Wave 1 minimum owners. All 66 AC IDs are covered. The 98 slices (13 foundation + 85 business), 29 phases and 53 functionality groups are unique/structured; 535 expanded slice/phase dependency edges refer to existing earlier slices and form an acyclic graph. Register-to-slice traceability and local Markdown file links were checked. `git diff --check` passes; both source documents are unchanged. This evidence verifies the proposal's structure and traceability, not implemented acceptance, build/test success or external service readiness.
