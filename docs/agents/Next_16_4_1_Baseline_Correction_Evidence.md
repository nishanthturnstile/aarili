# Next.js 16.4.1 baseline correction — issue #157

23 October 2026. **Owner-approved implementation, validation in progress.**
[Selected issue #157](https://github.com/nishanthturnstile/aarili/issues/157).
This is independent of [measurement PR #156](https://github.com/nishanthturnstile/aarili/pull/156).
No merge, deployment, live data or worktree is authorised or performed.

## Authority, baseline and patch boundary

The owner approved the concrete separate correction proposal and issue/PR in
the existing checkout. The proposal is retained on the measurement branch;
issue #157 records the approved scope and NX-01–06 acceptance. It has no comments
or native blockers. Published/read back the issue, fetched origin, updated
development (already current) at `2aa1b1246213845f1dcaa55d7505051219aedecd`, then
created `codex/next-16.4.1-security`. The measurement branch and PR remain intact.
Its temporary review host was stopped before dependency relinking and rebuilding.

Implementation clock was recorded **00:02:54 UTC** before the first edit attempt.
An initial patch context mismatch changed no files; the corrected patch followed.
Active coding/rework time is unknown; elapsed validation time is recorded separately.

Only the direct Next pin, required Next/env/SWC/peer lock graph and active
architecture version/evidence are changed. React 19.3.0, TypeScript 7.0.2, sharp
0.35.5, strict declarations/typed routes, private headers, standalone tracing and
disabled package build scripts remain. Historical 16.4.0 records are retained.
No schema, money, tenant policy, immutable history or business workflow changes.
Recovery is a reviewed compatible fixed graph and roll-forward, without a schema
downgrade or an automatic return to the affected pin.

## Security classification and independent investigation

The [official 16.4.1 release](https://github.com/vercel/next.js/releases/tag/v16.4.1)
lists the three upstream fixes. The pre-change audit reproduced dependency
findings, not an exploit against Aarili:

- [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw), image
  optimizer/glibc Linux: Next already resolved sharp 0.35.5, its documented workaround.
- [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr), cache
  functions/typed arrays: no source-enabled Cache Components/use-cache path found.
- [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r), server
  actions: source has no Server Actions; business mutations use the Hono route.

The parent inspected API/proxy/config/media entry points. A fresh independent
read-only investigator checked aliases, native resolution, compatibility and
closest verification controls before editing; no source was changed by it. Both
passes distinguish package applicability from application exploitability. Framework
decoding precedes Hono; proxy authorization does not replace the fixed framework.
No next/image import does not prove that the framework optimizer endpoint is absent.
The application's bounded JPEG/PNG/WebP media validation is a separate sharp path.
Built standalone Next resolves to 16.4.1. Whitelisted manifest inspection found
zero node/edge Server Action entries. These checks qualify the runtime surface;
they do not reproduce the upstream exploits.

A second fresh read-only candidate reviewer independently inspected the current
diff and runtime boundaries without the parent's validation reports. It found no
concrete bypass/regression blocker, confirmed all ten updated package integrity
values against npm metadata, and checked installed Next/React/native resolution.
It reported clean-install, production/Linux runtime and HTTP verification as proof
gaps for its own review; the parent records those checks separately below. No
reviewer edits, commits, worktrees or further delegation occurred.

## Development evidence

Managed raw logs/results live in the security tool's temporary collection returned
for this repository; the final retained report will identify the persistent artifact.
No secrets/customer data or dependency/build trees are committed as evidence.
Windows uses pinned Node **24.21.0**, pnpm **12.11.2** (ambient plain Node is older).

| Check | Observed result |
| --- | --- |
| Pre-change `pnpm audit --audit-level low` | **Exit 1**, **00:02:24.668–00:02:26.289 UTC**, **1.621s**; two critical/one high Next 16.4.0 findings. 790-file source fingerprint `06df6c98d2927843ff95070a558e971063768162c0c30ea7c2366f270c4296d8`, unchanged. |
| Manifest/lock synchronisation | pnpm's exec preflight synchronized the changed exact manifest (**28.6s**); the subsequently logged idempotent `pnpm install` passed **00:03:41.636–00:03:42.357**, **0.721s**. Only required Next/env/eight SWC versions and peer references changed; other dependency versions retained. |
| `pnpm install --frozen-lockfile` | **Exit 0**, **00:04:28.046–00:04:28.545 UTC**, **0.499s**, lock/source unchanged. |
| `pnpm why next` and native resolution | Exactly one Next **16.4.1** shared by web, next-intl and Better Auth; env **16.4.1**, actual sharp **0.35.5**, libvips **8.18.7**. |
| Post-change `pnpm audit --audit-level low` | **Exit 0**, **00:04:03.970–00:04:04.845 UTC**, **0.875s**: **No known vulnerabilities found**. This is the focused before/after dependency trigger, not exploit reproduction. |
| `pnpm verify:fast` | **Exit 0**, **00:04:55.354–00:07:03.179 UTC**, **127.825s**. Lint (five existing informational diagnostics), Knip, strict types, 288 unit tests / 65 files, negative declaration checks, OpenAPI and production build pass. |
| `pnpm smoke` | **Exit 0**, **00:07:05.397–00:07:18.662 UTC**, **13.265s**. Standalone Node/Hono, PostgreSQL readiness/outage, redirects/static PWA and worker shutdown pass. |
| `pnpm exec node scripts/check-artifacts.mjs` | **Exit 0**, **00:09:40.744–00:09:41.431 UTC**, **0.687s**, 29 browser artifacts. |
| Focused root browser command | `pnpm test:ui tests/ui/documents.spec.mjs tests/ui/document-sharing.spec.mjs --project phone`: **exit 0**, **00:08:32.210–00:09:47.385 UTC**, **75.175s**, **2 passed**. Fresh shared development and disposable PDF component hosts start without the upgrade reminder; legitimate bilingual/themed PDF-sharing and accessibility controls pass. |
| Scoped clean native copy, first attempt | **Exit 1**, **00:10:17.705–00:11:14.589 UTC**, **56.884s**. Frozen installation passed, then Turbo's Windows executable spawn failed `ENOENT` under the long tool-managed evidence path. The disposable copy was removed. A shorter temporary drive alias of the same managed copy is being checked; no repository/configuration bypass. |
| Scoped clean native copy, alias attempt | **Exit 1**, **00:13:48.310–00:16:26.401 UTC**, **158.091s**. Frozen installation passed; native resolution expanded the alias back to the same overlong executable path. Alias and copy removed. The next attempt uses the repository's established short OS-temporary clean-copy location; raw output remains managed. No global long-path setting or package policy changed. |
| Scoped clean native copy, repository temp location | **Exit 0**, **00:17:07.325–00:19:55.219 UTC**, **167.894s**. Frozen install, 10 package builds, Next 16.4.1 production build and 29-artifact private-canary scan pass. Lock/source unchanged; exact owned temporary directory removed. This is the workflow's scoped portability check, not a second full verification run. |
| Full root `pnpm test:ui` | Started **00:12:53.980 UTC**, still running. One runner, existing one-worker/no-retry configuration, 237 applicable cases. Phone booking-group review failed its two-second confirmation-button assertion; trace shows review HTTP 200 (1096ms) followed by draft save HTTP 200 (866ms). Cause remains unresolved; this is not a claim of an unrelated defect or a broad green result. Original results will be retained. |

One diagnostic mistakenly included a generated build encryption key. Its
disposable cached key was removed after checking the exact resolved path, then
the focused root browser command rebuilt the artifacts. A hash-only comparison
confirmed rotation; no provided build key was present. Subsequent inspection
reports only versions/counts. The old key is not retained in the evidence packet.

Post-change application/configuration fingerprint: **790 files**,
`4d8155180cd112ca47f03e740544372cfa454313f8d2ea40c7c4bd62e6f09a93`;
base HEAD above, dirty pin/lock changes. Documentation is excluded from that hash.
No passed command is reused after a relevant input change.

## Acceptance and remaining gates

| Acceptance | Evidence / current qualification |
| --- | --- |
| NX-01 | Exact graph, frozen install, native resolution and scoped clean-copy install/build/export/canary pass. Original long-path harness failures retained above. |
| NX-02 | Original audit reproduced; corrected graph audit passes. No Aarili exploitability claim. |
| NX-03 | Fast checks/build, smoke, artifact scan, existing native/media unit controls and clean-copy portability pass. |
| NX-04 | Fresh shared-dev and disposable PDF component controls pass; full browser validation running with an unresolved booking-group assertion failure. No suppression, assertion relaxation or installed-package patch. |
| NX-05 | Independent pre-patch and candidate reviews complete with no concrete blocker. Built-artifact version/count inspection passes; upstream exploit reproduction and Linux native verification are not established by Windows checks. |
| NX-06 | Architecture baseline updated with owner authority. PR, final review entry, CI and owner acceptance pending. Measurement adoption awaits this PR's merge; B/C unstarted. |

No production, physical-device, fluent-Tamil, assistive-technology or pilot
acceptance is implied by dependency or emulation checks. Full browser results and
original failures will be recorded when observed.

## Local manual review entry

The existing synthetic owner-access review host is running the current production
build at **http://127.0.0.1:64543/sign-in**. The owner and shop have been prepared
through the real setup, verification, sign-in and completion HTTP commands. Private
sign-in details are in `.scratch/access-review/private.json`; do not copy them
into Git/chat. The collaborative browser's Aarili tab is at that sign-in page;
the Nool research tab was left untouched. Startup is `pnpm exec node
scripts/review-owner-access.mjs` if a fresh host is needed (the URL then changes).

1. **NX-03/04:** sign in, open the owner dashboard and shop settings, switch
   English/Tamil and the theme. Expect the existing navigation and forms to load
   without a startup-reminder failure. This patch introduces no new user flow.
2. **NX-05/06:** review the small dependency/baseline diff and qualifications above.
   Owner acceptance and permission to merge remain pending; CI does not grant them.
3. Report `NX-03/04 — pass/fail — observation` and any language/device finding.
   Existing automation covers setup and technical diagnostics; no terminal replay
   is requested. Physical-device and fluent-Tamil acceptance remain separate.

Stop with `pnpm exec node scripts/review-owner-access.mjs stop`; the host removes
its private access file and disposable PostgreSQL. An initial review setup helper
called completion before authenticating and received the expected 401. That
disposable host was stopped/cleaned; the corrected helper signed in before
completion and all setup commands returned 200. No application change was made.
An older measurement-form review lock was left untouched; its host is not used
as evidence for this patch.
