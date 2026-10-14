# Issue #29 — portable verification fixture packaging

Wave 0 / 0.1.1 and 0.1.2 verification closeout; product §§32–33;
architecture §§4–6, 12.4 and 15. This repairs verification packaging for the
merged Phase 0.1/0.2 safeguards. It adds no application capability or activation.

The owner approved publication and implementation on 14 October 2026. Issue
[#29](https://github.com/nishanthturnstile/aarili/issues/29) has no comments or
native blockers; prerequisite issues #2–#6 and #12–#16 are closed with merged
PRs. Work uses the existing Windows checkout on
`codex/portable-verification-closeout`, based on integrated main `7c4a973`.

## Reproduced failure and repair

On that main commit, `pnpm verify:clean` exited 1: 35 of 36 PostgreSQL tests
failed because `infra/provision-maintenance-roles.sql` was absent from the
disposable copy. The missing fixture prevented database setup before safeguard
assertions could execute; these failures do not demonstrate an RLS defect.
The Linux verification Dockerfile omitted the same required fixture.

The clean-copy root list and Dockerfile now copy that exact canonical SQL file.
They do not copy the infrastructure directory wholesale. The SQL itself,
migrations, runtime paths, role permissions, test assertions, application dependencies and
lockfile are unchanged. Context7's official Docker documentation confirmed the
specific-file COPY/destination-directory and build-context exclusion semantics.

Actual Linux runtime execution exposed a second missing verification
prerequisite: `scripts/test-support/https-api.mjs` invokes OpenSSL to generate
ephemeral certificates for controlled HTTPS tests. The slim image did not
contain the executable; a direct Node `spawnSync("openssl", ["version"])` probe
returned `ENOENT`. The verification Dockerfile installs that OS package with
no recommended extras. It retains actual certificate validation and all HTTPS
assertions. Application dependencies and the pinned lockfile do not change.

During the repaired native run, the actual disposable copy was inspected:
the SQL SHA-256 matched the canonical source, its `infra` directory contained
only that file, and private `apps/web/.env.local` and `infra/.local` were absent.
Existing `.dockerignore` exclusions for private environments and local
infrastructure credentials remain in force.

The built Linux image was inspected with a disposable `docker run --rm`:
its SQL hash matched the same source and `infra` contained only that SQL.
Private web/infra environments, `infra/.local`, `.git` and `.scratch` were
absent. No host source or credential directory was mounted into this probe.

## Verification

`pnpm verify:clean` passed (exit 0) in a disposable Windows path containing
spaces: frozen install, lint/boundaries/tokens, Knip, strict types, 48 unit tests,
negative type tests, OpenAPI generation, 36 real PostgreSQL tests, production
build, production HTTP/worker smoke, private-canary rebuild and 26 browser
artifact scans. The frozen lockfile was unchanged and the copy was cleaned up.

The initial SQL-repaired Linux image build passed, including frozen Linux
dependencies, lint, Knip, strict types, unit and negative type tests, production
builds and artifact scans. Its full runtime returned 32 passed / 4 failed:
three HTTPS tests failed with `spawnSync openssl ENOENT`; the Google callback
rollback/concurrency case returned `AUTHENTICATION_STALE` where it expected
success. That latter failure's cause is unestablished. The same unchanged
Google case passed in the native clean run and in the final Linux run; no
freshness policy, guard, assertion, retry setting or timeout was weakened.

The SQL-repaired image's full `pnpm test:ui` passed all 45 English/Tamil
phone/tablet/desktop browser and axe cases in 7.4 minutes. No application,
browser binary or UI source changed when OpenSSL was subsequently added.

The final image build passed and `openssl version` reports OpenSSL 3.0.22.
Its immutable local image ID is
`sha256:77ccbcfd645230e002adb7814a05fc96b4c8f88932c33b512283c948d4df7150`.
Actual `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock
aarili-issue-29-verify:local` passed (exit 0): lint, Knip, strict types, all
48 unit and 36 PostgreSQL tests, negative type tests, OpenAPI generation,
production build, actual readiness/outage and worker shutdown smoke, and
29 browser artifact scans. Integration tests took 266.23 seconds. Controlled
HTTPS and all six Google integration cases passed without assertion changes.
The final image's fixture hash, OpenSSL availability and private-path
exclusions were independently checked again.

Fresh checkout `pnpm lint` and `git diff --check` also passed. Hosted PR checks
and owner review/merge remain subsequent gates. The earlier intermittent
Google failure is retained as a limitation rather than claimed to be fixed.

## Integrity and recovery

No application, schema, tenant isolation or immutable-history behavior changes.
Existing real PostgreSQL assertions continue to exercise those contracts. Test
containers remain disposable and retained synthetic owner/shop data is not
used by the verification fixtures. Rollback reverts the packaging changes;
it requires no data or migration rollback. This is a local verification image,
not a deployment image or authorization for live data, outbound email or Google.
