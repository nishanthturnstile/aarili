# Issue #6 — scaffold CI and required repository gates

Slice **0.1.2b**, CI/repository portion of roadmap 0.1.2. Direct blocker #5 was
closed by merged PR #10 (`ce7ddb8`) on 13 October 2026 before work started.
The existing checkout was clean on main, updated from origin and verified before
branching to `codex/0.1.2b-ci-gates`. Issue #6 is approved (`ready-for-agent`) and
has no comments. No additional checkout/worktree was used.

Sources: architecture §§5.3, 11.4, 12.4, 15.1 and product §33 release gates.
This enforces the behaviours that exist; it adds no business capability or
live-release approval. The restored final application code matches integrated
main; only CI, update policy and traceability remain in the final change.

## Workflow and actual checks

`.github/workflows/verify.yml` runs branch pushes, PRs targeting main and manual
dispatch. A daily schedule runs the audit only after the workflow merges to main.
The job names are fixed:

| Check | Actual verification |
|---|---|
| Scaffold verification | `pnpm verify`: Biome, parsed import boundaries, canonical tokens, Knip, TypeScript 7 declarations/test types, Vitest unit/scaffold tests, negative client/UI fixtures, real Testcontainers PostgreSQL, production web/worker build and standalone HTTP readiness/outage smoke, browser artifact checks; then a private-canary web rebuild |
| Browser smoke and accessibility | Linux-native Chromium/system dependencies; `pnpm test:ui` with disposable PostgreSQL and all implemented phone/tablet/desktop Playwright/axe checks, including English/Tamil and light/dark preview cases |
| Dependency audit | Frozen install; `pnpm audit --audit-level low` covering runtime and development dependencies, failing for advisories or audit errors |

Every job runs on Ubuntu 24.04 with exact Node from `.node-version` (24.21.0)
and pnpm from `packageManager` (12.11.2), frozen lockfile and reviewed install
script denies. Linux installs its own platform dependencies; no Windows
node_modules, WSL address or development DB is used. Testcontainers discovers
the runner's local Docker engine and returned random database ports. Ryuk remains
enabled. No placeholder tenant/RLS/queue/property/PDF assertions were added.

Workflow tokens have `contents: read` and no other grant. Checkout credentials
are not persisted. There is no `pull_request_target`, external secret, cloud
credential, deploy, package publication or workflow auto-approval. The only
explicit configuration probe is a known synthetic canary. No upload-artifact
step publishes screenshots/traces or personal data; GitHub check/log URLs are
the evidence. Failed checks are not ignored and there are no path filters that
could leave required checks missing on documentation/update PRs.

Actions were resolved through official repositories and their action metadata
reviewed at these immutable commits:

| Action | Verified version/ref | Full commit |
|---|---|---|
| actions/checkout | v6 | `d23441a48e516b6c34aea4fa41551a30e30af803` |
| actions/setup-node | v6 | `249970729cb0ef3589644e2896645e5dc5ba9c38` |
| pnpm/action-setup | v4, annotated tag peeled to its commit | `b906affcce14559ad1aafd4ab0e942779e9f58b1` |

Context7 resolve/docs reviewed GitHub Actions SHA/permission semantics and
Renovate scheduling/security configuration. Its Actions collection did not
contain the branch-protection REST query; the official
[GitHub branch-protection API](https://docs.github.com/en/rest/branches/branch-protection)
and [vulnerability-alert API](https://docs.github.com/en/rest/repos/repos#enable-vulnerability-alerts)
were read for those operations. No API shape was substituted from memory.

## Deliberate negative demonstration

Commit `9f411548d9bb8b24fc6410bcd1f7c3914cb94ade` temporarily changed the health
response's service identifier from `aarili-web` to `aarili-worker`. The strict
response schema rejected it and Hono returned 500 instead of readiness 200.
This is a real contract/runtime regression, not a test that always throws.

Native `pnpm test` failed **3 actual tests** (26 passed). The hosted
[negative push run](https://github.com/nishanthturnstile/aarili/actions/runs/38363886340)
completed with:

- [Scaffold verification failed](https://github.com/nishanthturnstile/aarili/actions/runs/38363886340/job/115184288998)
  at the three contract/health unit assertions after install/lint/Knip/typechecks.
- [Browser smoke and accessibility failed](https://github.com/nishanthturnstile/aarili/actions/runs/38363886340/job/115184288949)
  at the healthy HTTP smoke on phone/tablet/desktop (3 failed, 21 passed).
- [Dependency audit passed](https://github.com/nishanthturnstile/aarili/actions/runs/38363886340/job/115184288702);
  changing the health contract does not fabricate an advisory.

The response was restored immediately in the local checkout before valid
verification, and restored before the final PR. No regression fixture, test
skip, changed acceptance expectation or broken application code remains.
The negative commit is retained only in topic-branch history as evidence; the
owner uses squash merge of the reviewed final diff.

## Local verification

Integrated main and the restored topic branch both passed native `pnpm verify`:
29 unit/scaffold tests, 3 real PostgreSQL tests, six negative request/response
and five negative UI diagnostics, production build and ready/outage smoke.
Observed main smoke used `localhost:32816`; restored smoke used
`localhost:32821`, each with matching cleanup. Native `pnpm test:ui` passed all
24 checks in 51.2 seconds with matching fixture cleanup on `localhost:32823`.

`pnpm audit --audit-level low` returned no known vulnerabilities. The pinned
disposable Renovate 44.155.1 validator passed strict **repository** validation:

~~~powershell
npx --yes --package=renovate@44.155.1 renovate-config-validator --strict --no-global renovate.json
~~~

No new application/test dependency, lockfile change or formatter was needed.

## Dependency policy and activation

See [the dependency-update policy](Dependency_Update_Policy.md). Compatible
updates/lock maintenance use Monday 00:00–06:00 Asia/Kolkata; exact pins/digests,
manual major approval and no automerge remain. Vulnerability fixes are immediate,
ungrouped and exempt from scheduling/age/major/concurrency delays when the hosted
Renovate App processes an alert. Critical advisories retain the architecture's
48-hour patch requirement. CI audits every push/PR and daily after merge.

GitHub dependency/vulnerability alerts were initially disabled (GET 404), enabled
through the authorized repository API and read back as HTTP 204. Dependabot
security PRs remain disabled; secret scanning/push protection are preserved.

**Remaining external activation:** the `gh` OAuth token receives 403 from
`/user/installations`, which requires a GitHub App user token. It cannot verify
Renovate's installation/repository selection. The owner must install or confirm
[Renovate](https://github.com/apps/renovate) for Aarili only, then verify onboarding
and a real bot run after config merge. No bot access or weekly execution is
claimed merely because this configuration validates. This is the activation
gap explicitly permitted by issue #6.

## Isolation, immutable history, recovery and limits

CI uses only synthetic/disposable fixtures. No business tables, tenant policies,
money, command semantics, immutable history, privacy records, migrations or
runtime services change. Ordinary health still connects as `app_user`; fixture
setup alone has disposable admin credentials. There is no deployment/production
promotion or customer data. Repository settings changes are limited to the
approved gate/alert scope, with read-back preserving existing protections.

App rollback needs no schema work. Workflow/update-policy edits require another
reviewed PR; do not remove required checks or weaken protection to bypass a red
gate. Later real RLS/transactional queue/finance/property/business-workflow/Tamil
PDF tests must be added as their features land. Physical devices, real IME,
privacy/recovery and product §33 pilot gates remain manual/later requirements.
No issue merge or live release is authorized by green CI.
