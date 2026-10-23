# Measurement validation recovery — 23 October 2026

Owner requested recovery of the preserved evidence, resolution of the outstanding
validation issues and a clean integration into development. This follows merged
measurement A / #153, PR #156 and baseline #157 / PR #158. It does not select
B/#154 or C/#155, change measurement policies or activate production.

## Authority and current inputs

The owner confirmed exclusive use of the existing checkout. Pulled development
at `83a6559e88dab9d1c8f9bc0c025e06b0a8acebe5` and created
`codex/measurement-validation-recovery`. PR #159 already approved/adopted Node
24.22.1, pnpm 12.15.0, Next 16.4.2, React 19.3.1, axe 4.14.0 and the other
recorded dependency changes, including migration 0046. This follow-up changes
none of those pins, migrations or policies. Historical results remain attributed
to their original inputs.

PR/commit comments were checked; #156, #158 and #159 have no comments requiring
resolution. The recent development change is the dependency-maintenance commit.
No Aarili Codebase Memory index or existing graphify graph was available; bounded
rooted source inspection was used. No repository index or worktree was created.

Recovery stashes `512e3f4f65794fca61350dcbdd1ba00e6fd16291` and
`6edc63c87062766defa58be9cf3068319c966a71` remain intact. Recovered only the
baseline evidence document; reconciled delivery/measurement facts explicitly.
Did not pop conflicted delivery text or unrelated generated policy PNGs.

## Confirmed causes and patch

- Fresh phone booking and identity workflows fail axe's
  `label-content-name-mismatch` on the dashboard link. The visible phone label
  is `Home`, while the accessible name was `Dashboard (Home)`. Axe 4.14 enables
  this rule by default and its token comparison removes parenthetical content.
  Replaced that name with `Dashboard, Home`, retaining both full/compact names,
  responsive labels, destinations, keyboard access and the existing visual design.
  The accessibility rule remains enabled. Tamil's identical full/short name is
  unchanged. Sources: installed axe 4.14 evaluator/tokenizer and
  [upstream rule](https://github.com/dequelabs/axe-core/blob/develop/lib/rules/label-content-name-mismatch.json).
- The older booking fixture checked confirmation within two seconds while the
  review action also awaits fingerprint persistence. The helper now waits for
  the existing Review action to finish (become enabled) before checking the same
  confirmation assertion. Admission retries still honour real Retry-After;
  keys, review fingerprints, concurrency checks, API limits and application
  confirmation logic are unchanged. No business timeout/threshold was invented.
- The earlier tablet identity timeout did not reproduce in the fresh focused
  baseline run; it passed unchanged. Its historical long heartbeat gap is not
  proof of a product defect or a diagnosed sleep/resume event. Retain the failure
  and obtain complete current coverage rather than changing its timeout.

Traceability: USE-01/02/09, TRU-01/06, AC-38/40/55, booking GB-B01/03/04/06–09,
identity RH-07/08/12/13/15, and measurement MV-A01–11. Product sections 7, 27,
29.1/32–33 and architecture sections 7, 8, 11/15 remain authoritative. No tenant,
immutable-history, private-fit, consent, exact-conversion or precision rule changes.

## Fresh command ledger

Raw local logs include exact UTC timestamps, exit status, head and source hashes;
documentation/generated presentation captures are excluded from the application
fingerprint. Final CI/results and manual review remain pending below.

| Command | Observed result |
| --- | --- |
| `pnpm install --frozen-lockfile` | **Exit 0**, **04:23:50.415–04:23:51.099 UTC**, **0.684s**. Source/lock unchanged. |
| Baseline focused root browser, booking + identity, phone/tablet | **Exit 1**, **04:24:08.155–04:29:33.617 UTC**, **325.462s**. **2 passed / 2 failed**: both phone failures are the same new axe violation; both tablet cases passed. 808-file fingerprint `34dbebdb6cdf3c2a7c7a50cf53dad975955ab1b12f47919592fe22f8b98728fc`, unchanged. |
| Changed-source Biome + mechanical design detector | **Exit 0**, two files checked; detector `[]`. No formatting fixes or visual drift. |
| Corrected focused root browser, booking + identity + owner shell + measurements, all three sizes | **Exit 0**, **04:30:22.112–04:45:15.217 UTC**, **893.105s**, **15/15 passed**. 808-file application fingerprint `42059449c2741fea3b68c4dd247c1a4076b2e06c3ae32964025ef0be6697eb3f`, unchanged. Real production hosts/PG; English/Tamil/themes, axe/reflow, exact measurement values/conversion, lost-response/explicit recovery and selection. |
| Full root `pnpm verify` | Started **04:45:53.437 UTC**, same 808-file application fingerprint; result pending. This includes the actual lint/Knip/types/unit/negative/OpenAPI/PDF/real-PG/build/smoke/artifact pipeline. |
| Recovery document checks | Seven changed evidence/design documents, **68 local links**, none missing; no conflict markers; `git diff --check` passed. |

Fresh phone/desktop owner-shell captures were inspected together (generated
**04:35:46 / 04:44:58 UTC**). Existing Home/Dashboard responsive navigation,
Tamil shop-name wrapping and surrounding presentation remain intact; the patch
changes the accessible name, not the visual system. This is emulation/screenshot
evidence, not physical-device or assistive-technology acceptance.

The older baseline browser run remains **101 passed / 2 failed / 134 unfinished**;
it is not replaced by a green total or labelled measurement A coverage.
Full root verification/browser results, hosted CI and owner review are pending.
Physical-device/fluent-Tamil/assistive-technology and pilot approval remain
separate from automation. No deployment, main promotion or live activation.
