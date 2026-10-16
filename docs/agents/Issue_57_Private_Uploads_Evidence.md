# Issue 57: private upload and immutable read foundation

Scope: [#57](https://github.com/nishanthturnstile/aarili/issues/57), roadmap 0.4.3a;
TRU-01/03/05/07, USE-07 and AC-38/39/53. Sources: Product Plan §§24–25,
Architecture §§6.4, 8.1–8.5, 10.1–10.2, 11.4–11.5 and 15, and the approved
[Phase 0.4 plan](Phase_0_4_Implementation_Plan.md). Direct blockers #55/#15/#35/#36/#37
were closed through merged PRs #65/#20/#41/#42/#43 on integrated main `f053a441`.

The owner approved this parallel #56/#57 run on 16 October 2026. This work stays in
`codex/issue-57-private-uploads` in its assigned managed worktree. Coordinator
owns publication/integration; #56 owns draft UI and web dependency changes. This
slice owns migration `0012_private_media.sql`, media subpath exports and the
platform AWS importer/lock changes. Local policy commit `f7c5e4e` is untouched.

## Implemented boundary

Authenticated typed POST admission, POST completion and GET read operations are
mounted through the actual owner/draft/media API composition. Owner sessions,
verified identity and current membership precede one `withShop` transaction.
`GET /shops/{shop}/files/{id}` returns the architecture's 303 redirect after
current authorization. Its companion `GET /files/{id}/access` returns a typed
JSON capability for module clients; both call the same core read policy. No
signed Location is logged or persisted. Middleware applies only to files paths;
mutations have origin/rate/8 KiB streamed body guards and no query parameters. Responses are no-store/no-referrer. Typed
clients use page memory only, reject late identity responses, invalidate auth loss
(including non-JSON 401), and validate mutation ETags against returned versions.
Completion If-Match derives from returned asset.version as `"v1"`, etc.

Trusted purpose/subject policy is injected on that exact transaction. It receives
current subject, purpose and type; no browser consent flags or keys are accepted.
Unknown production authority denies. Minor image authority requires recorded
parent/guardian consent regardless of browser purpose. Test-only SQL distinguishes
the guardian and non-guardian payer. Concrete customer/guardian records and
composite subject FKs belong to the later real business integration.

The phase plan's explicit technical limits are 20 MiB images and 25 MiB PDF/audio.
JPEG/PNG/WebP, PDF and MP3/M4A/WAV are declared formats. Purpose/type pairings are
checked before signing; no HEIC or content decoding promise is made here. The
real validator, image metadata removal, derivatives and worker registration are
#58. Normal environment composition cannot mark any input ready.

Admission fixes one private staging key/type with a roughly five-minute PUT
(content-type is signed). Replay stores only asset metadata, rechecks current
policy/status and cannot extend the original deadline. Expired grants require a
new admission; processing/accepted assets cannot be reopened. Completion requires
bound request key and If-Match and atomically commits durable attempt, audit,
request result and `media.process` enqueue. Unique `(shop_id,asset_id)` attempt
identity outlives request-key and queue retention. Queue payloads contain locators
and restore epoch only. Runtime does not provision or start the queue.

## Immutable bytes, recovery and cleanup

A claimant commits a fresh fence and five-minute lease, then reads a bounded byte
snapshot once. A trusted validator returns bytes; precisely those bytes are hashed
and conditionally sealed under `shops/{shop}/private/{asset}/{fence}/{opaque-output-id}`, distinct
from the reusable staging PUT key. No CopyObject race or accepted overwrite is
allowed. A fresh transaction rechecks owner authority, the durable original initiator, current subject policy,
restore switch/epoch, lifecycle/fence/lease before accepting or quarantining. A
forged locator cannot substitute a different authorized same-shop user for a
revoked original initiator. Acceptance, immutable
metadata, audit and allowlisted `media.stored` byte event commit together. Explicit
trusted validation rejection quarantines; infrastructure/storage errors remain
retryable after lease expiry. No validator or handler is registered in normal
startup. Old-epoch attempts remain unaccepted/private for reviewed reconciliation.
The #58 runner must inspect durable lifecycle/attempt state: an ignored locator,
restore denial or active-lease result is not proof of accepted output. Retry or
reconcile processing attempts after lease expiry rather than interpreting such
results as a successful content-processing effect.

A crash or veto after sealing can leave a private unaccepted object. The committed
`media.claim` audit has fence=id, asset=entity_id and attempt=request_id. An operator
can enumerate the exact claim prefix from shop/asset/fence using reviewed storage
maintenance authority, then compare each candidate key against
`media_asset.accepted_key`, the durable attempt's current fence/lease and references,
and retry the current valid attempt after lease expiry. Never delete a ready key,
accepted history or any current active claimant. Unaccepted orphan output removal
requires reviewed maintenance authority and rechecking those rows under the same
media advisory lock; this slice grants no broad private-object delete method.
Keep such objects private during reconciliation. This is a concrete recovery
manifest, not automatic personal-file retention/erasure policy.

`cleanupMedia` only expires/removes abandoned staging after its original grant
expiry plus an explicit caller-supplied grace (minimum 300 seconds). It excludes
references, every active/durable processing attempt and accepted history. It
records technical expiry, holds the asset lock through storage deletion, and safely
retries an already expired staging delete. Reference insertion shares that lock and
denies expired/deleted/quarantined targets. Database rollback cannot reopen a valid
PUT because cleanup begins after grant expiry plus grace. No retained personal
asset deletion, privacy erasure or automatic retention schedule is enabled.

The additive migration creates three shop-led forced-RLS tables, composite tenant
FKs, private-only visibility, status/provenance/history triggers and the processing
queue with migration authority. Runtime has no DELETE/TRUNCATE/DDL; references are
append-only and ready asset history cannot be edited. Back up before application;
apply using existing migration advisory locking. Compatible rollback disables/reverts the media API/processor composition while
retaining the additive migration and media-aware catalog support. An arbitrary
pre-0012 build is not compatible: its catalog allowlist rejects the newly
provisioned media.process queue. Leave private unaccepted rows/objects intact;
do not run destructive down SQL.

## Storage setup and remaining activation gates

Runtime platform pins `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
exactly `3.1149.0`, as Architecture §5. Root dev-only infrastructure probes retain
`3.1150.0`; this is intentional and no baseline correction. Current official
Context7 AWS SDK docs were fetched via library resolution and two scoped docs
queries: signed Content-Type/response headers and bounded GetObject/conditional
PutObject operations. Current official Hono Context docs were also resolved and
fetched for explicit redirect status and response-header behavior. Presigner and storage exceptions are replaced by fixed
safe errors; URLs, object contents and credentials never enter events or logs.

The integration fixture uses the existing pinned Garage 2.4.1 image/digest, unique
container/temp directory, random in-memory credentials and dynamic loopback port.
It tears down its own resources and never touches shared infra/.local. Production
requires an explicitly private provider bucket, reviewed server-only credentials,
endpoint/region/bucket configuration and narrow browser CORS: only the approved
application origin, PUT/GET/HEAD as needed, Content-Type, and explicitly needed
ETag exposure. Never allow wildcard credentialed origins or public bucket policy.
Do not put storage credentials in NEXT_PUBLIC variables. Grant URLs remain
page-memory-only and are not suitable for browser storage/cache/analytics.

Garage proves the exercised local SigV4, GET and immutable-byte semantics. The
actual repeated-PUT test found Garage 2.4.1 ignores If-None-Match. Safety therefore
derives from the adapter accepting only a claim prefix and generating a fresh
opaque suffix for every seal, including concurrent calls; an existing complete
key is rejected as a destination. The conditional header remains defense in depth
for supporting providers. These tests do not establish Railway configuration/CORS, eventual-consistency, deployment or
provider-wide IAM behavior. Expired grants are rejected locally with provider-specific
4xx responses. Previously granted signed GET links can remain usable until their
bounded expiry despite later permission revocation; no immediate-revocation promise.
Provider activation, real consent/notice binding, retained-file privacy/erasure,
restore/pilot approval and #58 content validation remain explicit gates.

## Acceptance and verification

| Criterion | Concrete evidence |
| --- | --- |
| G1 | media integration scenario 1: real session/API/current SQL policy, foreign/anonymous/unknown/forged claims, distinct payer/guardian, production denial; unit purpose-forgery check |
| G2 | scenarios 1–2: fixed type/key/deadline, signed header mismatch, expired grants, metadata-only replay; transport/limit/client tests |
| G3 | scenarios 2–3: atomic queue/key/audit rollback, same-key races, one durable attempt, mutation of staging during validation leaves accepted bytes unchanged |
| G4 | scenarios 2–4: durable uniqueness, lease fencing, retry after storage failure/crash, no production validator, explicit quarantine |
| G5 | scenarios 1–2/4: pending/foreign/expired/quarantined denial; ready read current permission; safe attachment name, previous grant expiry caveat |
| G6 | scenario 1/4 and catalog: forced RLS, missing context, shop-led keys/FKs, no publish route/private visibility, SQL provenance/null rejection |
| G7 | scenario 4: active-attempt/reference exclusion, repeated expired deletion, completion/cleanup race and both reference lock orders |
| G8 | four real PostgreSQL/Garage scenarios plus unit, API transport, client, negative types and architecture graph checks |

Baseline: coordinator verified integrated main before branching. Frozen install,
build/smoke/artifacts exited 0 in TEMP `aarili-56-57-baseline.log`; exact-main
[hosted CI 38852787777](https://github.com/nishanthturnstile/aarili/actions/runs/38852787777)
was green (114 unit, 79 PostgreSQL and 63 browser tests). Merged prerequisite
commit ancestry was checked before branch creation. Development checks are retained in
TEMP `aarili57-*` logs. Initial focused PG/S3 run stopped at missing explicit queue
policy; fixed by matching existing reviewed SQL. Second run reached actual
capabilities and identified provider-specific expired-grant status, required audit
key provenance and wrapped PostgreSQL assertion handling; these were corrected.
Focused diagnostics: after those corrections, scenarios 1/3/4 passed; scenario 2
then exposed Garage ignoring the conditional PUT header. The approved fresh-output
suffix correction replaced reliance on that unsupported behavior. The affected
scenarios 2/3 were rerun alone and passed (2 passed, 2 skipped, 15.70 s; TEMP
`aarili57-media-pg-s3-4.log`). Eight new cheap unit/client/API/boundary tests pass.
Lint, Knip and test-consumer TypeScript checks have also passed during development.
Fresh stable-tree full final results are recorded below after verification completes.


### Final check record (16 October 2026)

- Initial `pnpm verify` passed lint, Knip and all TypeScript gates, then stopped:
  121/122 unit cases passed; the existing unchanged seeded binding property in
  `tests/jobs.test.ts` exceeded its 5,000 ms timeout at 5,044 ms. This was not a
  media assertion failure. Retained log: TEMP `aarili57-final-verify.log`.
- Only that failed property was retried unchanged: 1 passed / 1 skipped,
  745 ms total. No timeout setting changed. Log: `aarili57-final-unit-retry.log`.
- The remaining required commands then exited 0: negative contracts, OpenAPI
  (11 paths), all 83 PostgreSQL/S3 integration cases across 17 files (544.51 s),
  production build (11 tasks, 24.693 s), real-PostgreSQL readiness/outage and
  worker-shutdown smoke, 29 browser-artifact checks, and dependency audit
  (no known vulnerabilities). Log: `aarili57-final-remaining.log`.
- Late review found the original-attempt initiator needed an explicit core
  identity binding. That repair affects media processing only; the 79 existing
  integration cases retain their evidence. Fresh focused media processing,
  build/smoke and final artifact evidence is recorded after the repair below.
  The local umbrella command is not represented as an uninterrupted exit-0 run.

- After the original-initiator binding repair, the three affected media scenarios
  (2/3/4) passed fresh: 3 passed / 1 unaffected scenario skipped, 26.75 s.
  They include a different verified same-shop owner substituted for a revoked
  original initiator, post-I/O actor substitution on both accept/quarantine,
  and concurrent different-key completion. No unaccepted/private output was
  exposed. All TypeScript checks passed (21 tasks, 11.084 s), production build
  passed (11 tasks, 12.496 s), readiness/outage/worker smoke passed, and all
  29 browser-artifact checks passed. Continuation exited 0; retained log:
  TEMP `aarili57-final-provenance-repair.log`.
- Post-repair lint/boundaries/tokens, Knip, direct test-consumer TypeScript and
  all eight focused media unit/client/transport/boundary cases passed. Contracts,
  dependencies and migrations did not change during the late processing repair;
  negative-type, 11-path OpenAPI and no-vulnerability audit evidence is unchanged.
- Final non-document working-change digest before staging:
  `36317b1c05360e2763a8c5e6c013d784df2548d33fdf8959fb996855884c1f13`.
  Final processing verification ran without concurrent heavy browser/build work.
  No unrelated full integration or full browser suite was repeated after the
  narrow repair. Hosted CI remains a publication-time check for the coordinator.

All G1–G8 foundation criteria have scoped evidence above. No blocking code finding
remains from coordinator/self-review. Real business/guardian binding, production
content acceptance and queue-runner integration (#58), provider activation/CORS,
privacy retention/erasure, restore/pilot acceptance, and physical device/Tamil
review where applicable remain activation gates. Nothing was merged, deployed or
connected to an external provider by this implementation agent.
