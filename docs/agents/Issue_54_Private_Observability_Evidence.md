# Issue #54: private usage and operational evidence

Slice W0 0.4.1d. Sources: product §§1.6/28, TRU-01/03/13, USE-09;
architecture §§5.3, 8.2/8.5/8.6, 11.4–11.5, 12.5, 15; Phase 0.4 plan.
Direct prerequisites #51 (PR #61) and #16 (PR #21) were merged before work.
Implementation uses the owner's explicitly approved issue-specific managed worktree,
from integrated main `27e3a4675cf89d2cc2ebed593bfa6becfbe9207b`.
The separate local policy commit `f7c5e4e` remains preserved on its original branch.

## Event contract and authority

`createUsageWriter(usageRepository(tx, shopId))` is composed only inside `withShop`.
There is no public usage route, browser analytics SDK, synthetic application route,
new support account authority, or independently opened database connection.

The event allowlist is closed:

| Event | Allowed fields beyond durable action/subject UUIDs | Unit |
| --- | --- | --- |
| draft.saved/promoted/abandoned | positive integer schemaVersion | events |
| media.stored | positive safe integer bytes | bytes accepted |
| pdf.rendered | none | accepted renders |
| support.recorded | positive integer durationSeconds and setup/training/troubleshooting/recovery category | seconds |

Unknown fields, arbitrary names/text, unsupported provider consumption, invalid UUIDs,
fractional/negative quantities and out-of-range integers fail validation. UUIDs are
normalised. Support duration is explicitly entered; it is never inferred from page
activity. Technical integer bounds are not commercial quotas or retention decisions.

`product_event` is append-only. Its `(shop_id, action_id)` key references the durable
`audit_event(shop_id,id)`. A trigger checks the audited entity equals the event subject
and copies the audit transaction timestamp. Missing authority/source and cross-shop
references fail closed. Instrumentation runs after audit insertion and before commit.
Retries with identical durable action/payload do nothing; changed event binding fails.
A usage SQL failure aborts the business/audit/key transaction. Operational diagnostic
failures are best effort and never decide transaction success.

The schema enables and forces RLS; shop-led indexes cover period and subject access.
`app_user` has SELECT/INSERT only. The catalog checker rejects mutation grant drift.
No privacy deletion authority, destructive down migration or retention sweep is added.
Compatible application rollback leaves the additive table in place.

## Named metrics

Definitions live in `core/usage.ts`, rather than dashboard presentation code.
Every metric uses the audited transaction timestamp, UTC half-open `[from,to)`.
A request is limited to a 366-day window. Totals and source records use one SQL/MVCC
snapshot. Totals are exact decimal strings, including sums beyond JavaScript's safe
integer limit. Drilldown pages contain at most 100 sources with an opaque timestamp/
action cursor; timestamp microseconds are preserved. Pagination retains full-period
totals and does not hide additional source records.

| Definition | Source | Unit | Denominator |
| --- | --- | --- | --- |
| committed_product_events | product_event | events | N/A (count) |
| committed_draft_saves | draft.saved | events | N/A (count) |
| committed_draft_promotions | draft.promoted | events | N/A (count) |
| committed_draft_abandonments | draft.abandoned | events | N/A (count) |
| accepted_media_bytes | media.stored | bytes | N/A (total) |
| accepted_pdf_renders | pdf.rendered | events | N/A (count) |
| explicit_support_effort | support.recorded | seconds | N/A (total) |

Empty available-source totals are zero counts, not evidence of adoption/outcomes.
Unavailable messaging and AI are explicitly null/N/A, never observed zero consumption.
Cost completeness is **incomplete**: monetary costs, live retained storage and business
pilot cohorts do not yet exist. Accepted media bytes are cumulative source consumption,
not current storage after erasure/deletion. No pilot success threshold is invented.

## Diagnostics

Pino 10.4.0 projects fixed codes, web/worker surface and an optional UUID request ID.
It writes JSON to stdout without pid/hostname. A second fixed redaction layer removes
sensitive top-level keys. The public adapter accepts no free-form message text.

Sentry uses exact @sentry/node 11.6.0, no global initialisation and no automatic
integrations, tracing, replay, source-map upload or external transport. Production
Sentry remains unconfigured. An explicitly injected local test sink constructs a
standalone NodeClient with a custom in-memory transport. `beforeSend` reconstructs
only allowed code/surface/request identity, dropping error messages/stacks, user,
request, contexts, breadcrumbs and SDK-added server details. Sink failures are caught.

On 16 October 2026 the owner explicitly approved the Sentry configuration
correction: pinned 11.6.0 removed sendDefaultPii:false. Architecture §5.3 now
records explicit deny-all dataCollection and includeServerName:false. Every
supported personal-data collection field, server names and runtime injection
are disabled. The exact package version, scrubber and no-replay policy remain.
External processor/delivery and source-map activation need separate approval.

A top-level API observer reports final responses with status >=500, including
child-route error handlers and health 503 operational failures. It receives no raw
error/request/context and invokes the reporter once per response. Successful/4xx
responses emit no operational error. All existing generic 500/503 envelopes remain
unchanged even if the reporter throws.
Next server request errors and worker startup errors report fixed safe codes without
passing their raw error/request/body/context to the telemetry adapter. Worker and
opt-in development in-process job handler/cycle failures use an optional reporter
with zero raw arguments. A real queue retry test proves a throwing reporter does
not change rollback/retry behavior. No production handlers/providers are activated.

## Acceptance and verification

| Criterion | Evidence |
| --- | --- |
| D1 | Named definitions, authorised transaction seam, exact aggregate/source drilldown; real PostgreSQL totals/pagination tests |
| D2 | Strict contract negatives, bounded units, explicit support category/duration, no unavailable provider events |
| D3 | Test-only synthetic command composition: concurrent replay, changed-binding rejection, forced rollback and SQL instrumentation failure leave counts/key/audit consistent |
| D4 | Real PostgreSQL two-shop/missing-context/foreign-source/subject mismatch/NULL field/immutable-row checks and catalog mutation-grant negative |
| D5 | Snapshot-once discriminator projection and stateful/throwing-getter canaries; Pino/Sentry local-envelope canaries for names, phones, measurements, cookie/token, body, signed URL, file content and error/context; 100 arbitrary-context property cases; browser artifact exclusions |
| D6 | Unconfigured no-op/local-only Sentry transport; no integrations/replay/external delivery; throwing sinks isolated |
| D7 | Standard health/error envelopes survive reporter failure; owner browser results and the targeted B5 rerun are recorded below with original timeouts retained |

Verification ran serially in this issue's worktree with synthetic-only disposable
PostgreSQL containers. The coordinator's initial full pnpm verify passed lint,
Knip, strict types, 94 unit tests, negative type checks and OpenAPI, then stopped
on two expected-list ordering assertions: 68/70 integration tests passed. The
catalog returned the correct alphabetical order, while the two new inventories
placed product_event before journal tables. The repair only reorders those lists.

Coordinator review also found that child route handlers could convert errors to
503 before the root error callback observed them. The final-response observer
covers child 503 and root 500 exactly once, preserves their existing response
bodies/statuses and catches reporter failure; successful/4xx responses are ignored.
Health 503 is deliberately included as an operational failure. The first affected
check run caught Hono's .use() return type narrowing OpenAPIHono to Hono before
.openapi(). Registering middleware in a separate statement preserves the named
OpenAPIHono and inferred health-route types without a cast.

The corrected, stable source passed the coordinator's affected pipeline:

| Check | Result |
| --- | --- |
| Lint, architecture boundaries and token/assets checks | Passed; 216 files / 119 source files |
| Knip and strict workspace/test types | Passed |
| Unit/property/canary tests | 95 passed across 23 files, including the new child-error observer case |
| Repaired PostgreSQL catalog/upgrade tests | 2 passed; 4 unrelated cases intentionally skipped in this targeted run |
| Production build | 11 tasks successful; web and worker rebuilt |
| Production smoke | Next/Hono/real PostgreSQL readiness and outage, typed client and worker shutdown passed |
| Browser artifact privacy scan | 29 artifacts checked |
| Dependency audit | No known vulnerabilities |
| Cross-PR #54/#55 real PostgreSQL composition | Passed: real private writer/repository with durable draft save/edit/promote, retry deduplication, shop isolation, atomic usage rollback and recovery |

The initial 68 passing integration cases include all private-usage and runtime
rollback/retry cases. No database or worker command/retry source changed after that full run; the
two repaired inventory cases were rerun on stable source. Earlier focused checks
also passed all three usage PostgreSQL tests, the actual worker reporter/retry
case and the timestamp-precision pagination case. All disposable test databases
and dynamically assigned ports were cleaned up.

The coordinator retained aarili-issue54-final-verify.log,
aarili-issue54-final-repair.log and aarili-issue54-final-repair2.log locally.
Their outputs were read back before this evidence update. The repair pipeline
exited 0; it is not described as a second complete pnpm verify run.

The coordinator also read back aarili-coordinator-composition.log: the real
#54 writer/repository and #55 draft lifecycle compose successfully, including
rollback after an inserted usage event and recovery. Its disposable PostgreSQL
container and dynamic port were cleaned up. This probe uses isolated test
composition; it does not merge branches or activate synthetic application routes.

Final read-only review found that the diagnostic scrubber reread properties after
validating them. Current callers use trusted literals, but an unknown input with
stateful getters could return an allowed value first and synthetic private text
on the next read. A local-sink probe confirmed two reads per discriminator and
canary leakage. The new regression failed before the fix with "private getter
value escaped diagnostic validation". The scrubber now snapshots code, surface
and requestId exactly once; focused platform compilation and the regression pass
(1 passed, 6 unrelated tests skipped). It also preserves throwing-getter safety
and checks Pino plus local Sentry receive only the initial allowlisted values.
The coordinator's post-fix affected pipeline then exited 0: lint, Knip, strict
workspace/test types, 96 unit/property/canary tests across 23 files, all 11 build
tasks (11.863 seconds), production smoke and the 29-artifact privacy scan passed.
The retained aarili-issue54-getter-final.log was read back for these counts.
Contracts, database/migrations and dependency pins were unchanged by the getter
fix, so prior negative types/OpenAPI, all 70 PostgreSQL cases (68 retained plus
the two repaired targeted cases) and clean dependency audit evidence remain
applicable. The combined #54/#55 transaction probe is likewise unchanged.

The initial full owner browser run ended with 61/63 passing: PWA B5 denied
registration/partial first-install timed out at 30 seconds on phone and desktop;
the tablet case passed. No failed assertion was captured, and PWA implementation
was unchanged. A targeted B5 diagnostic rerun then passed all three phone/tablet/
desktop projects in 14.2 seconds with the unchanged 30-second test timeout and
no PWA source/helper edits. DEBUG=pw:api showed successful operations; its
disposable PostgreSQL container/port was cleaned up. Both browser logs were read
back: aarili-issue54-browser-final.log and aarili-issue54-browser-b5.log.

The original timeouts did not reproduce, and their root cause remains unconfirmed.
The full run remains recorded as exit 1 with 61/63 passing; the targeted rerun
exited 0 with 3/3 passing. No full-suite success or fixture-root-cause claim is
made. These retained timeouts are a review-visible intermittent test finding,
not a reproduced application assertion failure. All scoped implementation and
verification work is ready for draft PR review; CI/owner review, physical Android/
fluent-Tamil phase closeout, and live activation remain separate gates.

## Attachment and activation gates

- #55 owns draft save/promote/abandon command attachment through the structural
  transaction-bound `recordDraftEvent` hook. Its actionId is the durable audit UUID.
  The two independent PRs have no unmerged import dependency. Both add the same
  optional AuthConfiguration.draftInstrumentation transaction factory; this PR
  composes the real private writer in ownerAuthFromEnvironment, and #55 invokes
  that factory inside withOwnerDraft. Once both PRs integrate, attachment is
  automatic with no deferred composition step. #56 owns editor recovery UI.
- #57–#58 own recording media.stored only when accepted immutable storage is committed;
  provisional uploads, failed/quarantined bytes and retries are not accepted consumption.
  Retained-storage/deletion accounting belongs with its actual lifecycle.
- #59 owns accepted PDF rendering attachment; #60 owns prepared/marked-sent history.
  Manual sharing is never observed messaging-provider consumption.
- Approved usage/log/error retention, processor/privacy configuration and any external
  Sentry delivery/source-map activation remain later explicit inputs. Live data and
  production monitoring await the privacy/recovery/pilot gates.
- Physical Android/fluent Tamil review and phase-wide accessibility/recovery evidence
  remain manual closeout gates; this foundation adds no new business UI.
