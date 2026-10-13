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

## Hosted positive run and main protection

The restored commit `9eab922a907581b1559818b8a2cc504e54eaa99d` passed the
[first positive hosted run](https://github.com/nishanthturnstile/aarili/actions/runs/38364410383).
Its logs confirm 29 unit/scaffold tests, 3 real PostgreSQL tests, both negative
type fixtures, production smoke, a private-canary build and 24 browser checks
(34.5 seconds). Observed Linux endpoints included `localhost:32771` for
production smoke and `localhost:32769` for browser tests, both cleaned up.
Its actual check runs were read from the commit, all `success`, provided by
`github-actions` App ID **15368**:

- [Scaffold verification](https://github.com/nishanthturnstile/aarili/actions/runs/38364410383/job/115185983919)
- [Browser smoke and accessibility](https://github.com/nishanthturnstile/aarili/actions/runs/38364410383/job/115185984425)
- [Dependency audit](https://github.com/nishanthturnstile/aarili/actions/runs/38364410383/job/115185984263)

Only after this successful run were these three exact contexts required on
main, bound to App ID 15368 with `strict: true` (up-to-date branches). REST
read-back confirmed them. Every pre-existing protection field, excluding the
new required checks, was compared against the pre-change snapshot and matched.

The pre-existing settings remain: PRs required for administrators, zero required
approving reviews for the solo owner, stale approvals dismissed, conversations
resolved, linear history, no force pushes/deletions, no lock/bypass changes,
squash-only merge, automatic merged-branch deletion and no automerge. Actions
still requires SHA pins, defaults to read-only tokens and cannot approve PRs.

The initial status-only PATCH returned 404 because checks had not been enabled.
A full protection update preserved the read-back settings. Supplying both the
legacy `contexts` field and `checks` was rejected with 422 by the current API's
exclusive schema; the successful request used `checks` alone. Neither rejected
request changed repository settings. The final before/after snapshots are in
[the CI evidence directory](ci/main-protection-after.json).

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

## Acceptance coverage

| Issue #6 criterion | Fresh evidence / limits |
|---|---|
| Real push/PR checks, stable names | Hosted negative and positive runs above use three actual jobs and the repository's existing commands; final PR checks are verified before handoff |
| SHA pins, frozen installs and minimum privilege | Official action commit/metadata review, successful hosted installs, explicit read-only workflow token, no persisted checkout credentials/secrets/artifact upload, unchanged repository read-only/approval settings |
| Linux Docker and native Windows | Hosted real Testcontainers and all 24 Playwright/axe checks; native integrated/restored verification and browser results below; native binaries are never copied across OS boundaries |
| Real negative/positive gate | Three unit assertions and three HTTP browser checks failed for the temporary service-identifier regression; restoring the original implementation made all three hosted jobs pass |
| Actual required main checks/up-to-date/preserved safeguards | Successful commit check-runs supplied exact names and App ID 15368; strict protection was added only afterward; full REST before/after comparison and repository/Actions read-back |
| Weekly and security updates | Strict repository Renovate validation, weekly grouped/lock maintenance, immediate ungrouped alert-fix policy, no automerge, manual major gate, all-severity CI/daily audit, enabled GitHub alerts; hosted Renovate App access remains the specific owner activation gap below |
| Complete PR evidence and manual production | This guide, linked workflow/check runs and settings snapshots; no deployment/promotion or merge |
| Compiler/client/token/runtime/accessibility enforcement | Hosted/native `pnpm verify` checks TypeScript 7 declarations, six negative request/response and five negative UI uses, canonical tokens/imports, unit/runtime contracts and real PostgreSQL; browser job enforces implemented three-size axe/workflows |

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
