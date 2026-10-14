# Phase 0.1 / 0.2 foundation closeout

Evidence date: 14 October 2026. Documentation issue
[#23](https://github.com/nishanthturnstile/aarili/issues/23) governs this record;
its linked PR records final CI and the owner's merge decision.
Implementation baseline: integrated main `4a5e4e5`, after the
owner-authorized squash merges of cleanup PR #24 and verification repair PR #30.
One native Windows checkout is used throughout.

This records the implemented synthetic foundations and actual validation.
It does not certify full product requirements, live provider activation or pilot
readiness. Sources: product §4, TRU-01/TRU-06/TRU-12, USE-01/02/08/09,
AC-38/AC-55 and §§32–33; architecture §§4–6, 8.1–8.5, 11.1, 12.4 and 15;
roadmap Phase 0.1/0.2. Existing issue evidence retains its historical results.

## Implemented scope and traceability

| Slice | Implemented and verified foundation | Detailed evidence |
| --- | --- | --- |
| 0.1.1a | Exact Node 24.21.0/pnpm 12.11.2/TypeScript 7.0.2 workspace, strict declarations, import boundaries, web/worker builds and clean installs | [Issue #2](Issue_2_Workspace_Evidence.md) |
| 0.1.1b | Dedicated synthetic PostgreSQL/S3 infrastructure, roles, runtime checks and ordinary restart persistence | [Issue #4](Issue_4_Local_Infrastructure_Evidence.md) |
| 0.1.1c | Base UI design system, shared tokens/fonts, Tamil/English and responsive accessible controls | [Issue #3](Issue_3_Design_System_Evidence.md) |
| 0.1.2a/b | Typed health path, real database outage/cleanup, actual CI gates and dependency handling | [Issue #5](Issue_5_Database_Health_Evidence.md), [issue #6](Issue_6_CI_Gates_Evidence.md) |
| 0.2.1a | Protected one-time owner admission, private-code verification, verified sessions and initial shop | [Issue #12](Issue_12_Owner_Bootstrap_Evidence.md), [bootstrap runbook](Owner_Bootstrap_Runbook.md) |
| 0.2.1b | Password reset, old-session revocation, durable limits and recent authentication | [Issue #13](Issue_13_Owner_Recovery_Evidence.md), [recovery runbook](Owner_Recovery_Runbook.md) |
| 0.2.1c | Explicit allow-listed Google connection, callback/session guards, closed signup/implicit linking and disconnect | [Issue #14](Issue_14_Owner_Google_Evidence.md), [activation checklist](Owner_Google_Activation_Runbook.md); provider tests are simulated |
| 0.2.2 | Current-path own membership, transaction-local context, composite tenant constraints, forced policies/catalog drift and cross-shop failure matrix | [Issue #15](Issue_15_Shop_Isolation_Evidence.md) |
| 0.2.3 | Atomic actor/action/request-bound idempotency, 428/412/409/422 conflicts, audit/history, replay/concurrency and rollback | [Issue #16](Issue_16_Command_Contract_Evidence.md); dev/test-only record exemplar, absent from production |

The current tenant tables are `shop`, `shop_membership`, `idempotency_key` and
`audit_event`. Each new table/repository/API/job/export path must extend these
proofs. The exemplar does not implement garment orders, money, measurements,
stock, custody, approvals, privacy execution or transactional queueing.

## Repository configuration and closeout maintenance

Read back from GitHub on 14 October 2026:

| Configuration | Observed result |
| --- | --- |
| Main gates | PR required, strict up-to-date checks: Scaffold verification, Browser smoke and accessibility, Dependency audit; administrators included |
| Owner review | Zero automatic approving reviews for the solo maintainer; explicit owner review/merge authorization still required |
| Merge controls | Squash only, automerge off, force push/deletion off, merged branch deletion on |
| Actions | Read-only workflow tokens, cannot approve PRs; repository SHA pinning required and workflow actions pinned to full commit SHAs |
| Secret handling | Secret scanning and push protection enabled; private runtime/migration credentials remain outside Git |
| Dependency operation | Owner selected only Aarili for Renovate; actual bot PRs #25–#27 observed; no automerge |
| Scheduled audit | Actual [scheduled run 38529837539](https://github.com/nishanthturnstile/aarili/actions/runs/38529837539) passed at 13:10 IST; scaffold/browser intentionally skip scheduled events |
| Open dependency alerts | Zero after cleanup merge; workspace audit and hosted dependency checks passed |

Approved issue #22 merged in [PR #24](https://github.com/nishanthturnstile/aarili/pull/24).
It removed 2,690 unused `.scratch/drizzle-compat` vendor files from Git tracking,
preserved all local bytes and 15 tracked project records, and added the scratch
ignore rule. It changed no active dependency/lockfile. The three vendor-manifest
alerts closed, and the obsolete Renovate PRs autoclosed.

Approved issue #29 merged in [PR #30](https://github.com/nishanthturnstile/aarili/pull/30).
It packages only the required canonical role SQL for native clean-copy/Linux
verification and supplies OpenSSL for the existing controlled HTTPS fixtures.
Private environments and infrastructure credentials remain excluded. See
[the failure/passing evidence](Issue_29_Portable_Verification_Evidence.md).

## Local preparation and automated evidence

Before retained-volume schema work, a private custom-format database archive
was taken and its header/catalog verified. Reviewed maintenance roles and
additive migrations were then applied with privileged/migration credentials
only in their scoped processes. Ordinary web/auth uses `app_user`.

`pnpm infra:check` passed PostgreSQL 18/extensions/runtime-role checks and private
S3 signed put/read/delete plus anonymous denial. `pnpm infra:verify` passed
ordinary down/up persistence and preserved unrelated Docker resources.
Archive catalog verification and normal restart persistence are **not a restore
drill**; the full recovery gate remains later scope.

The retained local owner uses a fictional address and synthetic shop. The
ignored web environment and capture directory have owner-only Windows ACLs.
Independent auth/setup secrets were generated privately. After permanent
bootstrap completion, `SETUP_TOKEN` was removed and the server restarted while
preserving the auth secret/runtime credential. Completed verification/reset
captures were removed after the exercise; no codes/passwords are recorded here.

| Verification | Fresh observed evidence before this documentation branch |
| --- | --- |
| Native workspace | `pnpm verify`: lint/boundaries/tokens, Knip, strict types, 48 unit tests, negative types, OpenAPI, 36 real PostgreSQL tests, build, actual production readiness/outage and worker shutdown smoke, artifact scans passed |
| Native browser | `pnpm test:ui`: 45 passed in English/Tamil at 360×800, 820×1180 and 1440×1000; repeated on cleanup branch |
| Clean native install | `pnpm verify:clean` passed from a temporary path with spaces, frozen lockfile, full verification and private-canary rebuild after SQL packaging repair |
| Linux verification | Repaired image build and actual full `pnpm verify` runtime passed: 48 unit/36 PostgreSQL tests, controlled HTTPS, build/smoke and artifact scans; fixture hashes/private-path exclusions checked |
| Linux browser | SQL-repaired image: 45 passed; subsequent image addition supplied only OpenSSL, with application/UI/browser sources unchanged |
| Hosted exact PR head | PR #30 head `e482482`: both [PR workflow](https://github.com/nishanthturnstile/aarili/actions/runs/38536057945) and [push workflow](https://github.com/nishanthturnstile/aarili/actions/runs/38536003949) passed all three checks |
| Integrated main | After PR #30 merge, this checkout advanced to `4a5e4e5`; rebuilt local verification image and actual `pnpm build`/`pnpm smoke` passed before branching for #23; [main hosted workflow](https://github.com/nishanthturnstile/aarili/actions/runs/38539398396) also passed |

For documentation issue #23, fresh `pnpm verify:clean` passed on the existing
native Windows host: frozen install, lint/Knip/strict types, 48 unit and
36 PostgreSQL tests, negative types/OpenAPI, production build and smoke,
private-canary rebuild and 26 artifact scans. All 52 local Markdown links
resolved and diff whitespace checks passed. Local UI tests were not repeated
for these documentation-only edits; prior 45-case evidence is retained and
the exact PR head's hosted workflow runs the browser suite. Final hosted
results and owner review are recorded with that PR. This changes no executable
code, schema, dependency or runtime configuration.

## Owner-reported manual acceptance

The owner reported these results during this closeout on 14 October 2026.
These are actual human reports, distinct from automated test results. Exact
browser/assistive-technology versions and voice identifiers were not recorded;
the responsive review used browser widths rather than physical phone hosting.

| Screen / case | Owner result and coverage boundary |
| --- | --- |
| `/` | Service/database ready screen passed; controlled outage/recovery is separately automated |
| `/dev/design-system` | English/Tamil, light/dark, Tab/Enter/Escape, dialog opening/closing and focus return passed |
| `/setup` and verification | Valid admission, private-code verification, sign-in and named shop creation passed; invalid/resume/concurrent cases have automated evidence rather than individual manual attestations |
| `/sign-in`, `/owner` | Same shop after refresh/restart, stable page, one wrong-password denial and correct-password restoration passed |
| Sign-out / protected access | Direct navigation and browser Back did not expose protected shop details until valid sign-in |
| `/recovery`, `/reset-password` | Reset, old-password denial and new-password same-shop sign-in passed; a 10-character password/non-generated-code attempt was correctly rejected before valid input |
| Optional separate old window | Not individually confirmed manually; all pre-reset session revocation and consumed/expired-code failures passed automated tests |
| `/owner`, `/reauthenticate` | Fresh access success, stale access after more than five minutes, wrong-password rejection and correct reauthentication restoration passed |
| `/connections` | Screen visible, Google unconnected as expected with local Google disabled; no real-provider certification |
| Responsive / actual input | Phone-like, tablet portrait/landscape and wide desktop review of sign-in/owner/connections/design-system passed in English/Tamil; actual Tamil keyboard/input-method typing passed |
| Screen reader | Owner reported labels, invalid/empty-form errors, status announcements and dialog/focus review passed in both English and Tamil |

No new retained owner or database reset is required to repeat negative cases.
Disposable PostgreSQL/API/browser fixtures provide rate-limit, unsafe-origin,
CSRF, RLS, membership, replay, failure/retry, concurrency and history evidence.

## Diagnostics and limitations retained

- Repeated development Fast Refresh made the owner page unusable. A supported
  Webpack comparison was stable; after stopping the server and preserving/moving
  only generated `apps/web/.next/dev` cache aside, normal Turbopack was stable
  and the owner passed the follow-up checks. No application/auth code changed.
  The exact cache cause is unestablished.
- PR #24's initial push browser job timed out in tablet Tamil recovery. The
  unchanged commit passed local suites, its PR workflow and a failed-job rerun.
  No assertion or timeout was weakened; the original timeout remains recorded.
- PR #29's initial Linux runtime exposed three missing-OpenSSL failures and one
  unexplained `AUTHENTICATION_STALE` Google callback test failure. Required
  verification prerequisites were repaired. The unchanged Google test passed
  native, final Linux and both hosted workflows; its intermittent cause is not
  claimed fixed by packaging changes.

## Remaining gates and next actions

1. Closeout control: the documentation PR for #23 needs actual hosted checks,
   separate owner merge authorization and integrated-main verification. Its
   linked issue/PR records that decision. Phase 0.3 drafting/publication needs concrete scope
   approval; completed foundations do not approve later implementation.
2. Actual Google activation needs a real matching verified/allow-listed identity,
   per-environment client ID/client secret, exact approved origin/callback and an
   authorized real-provider smoke. The fictional local owner cannot currently
   establish that identity match. No manually obtained access token is needed.
3. Outbound auth email requires 0.3.2 suppression/restore guards plus the approved
   domain, DNS and provider setup. Local captures do not prove delivery. Follow
   the existing activation/runbooks rather than introducing a second signup path.
4. Durable jobs/outbound suppression, exact money, private-media authorization,
   privacy execution, full restore rehearsal, hosted physical-device review,
   Tamil PDF goldens and business workflows remain their named later slices.
5. Product §§32.2/33.2 require owner business/privacy/configuration decisions,
   all applicable Phase 1 Must/scenario checks, recovery and the manual baseline
   before real customer data or pilot use. Current S3 probes and backup catalog
   checks do not certify those gates.
