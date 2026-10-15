# [W0 0.4.1d] Record private usage and operational evidence

Published and approved as [issue #54](https://github.com/nishanthturnstile/aarili/issues/54) on 15 October 2026.
Implementation starts only after its direct blockers merge.

## What to build

Collect trustworthy per-shop usage, media consumption and explicit support effort
without leaking customer information. Diagnose failures through scrubbed logs
and tested error adapters. Later draft/media/PDF commands attach their own events
as those behaviors land, rather than inventing pilot outcomes now.

## Sources and scope

Roadmap 0.4.1; product §§1.6/28, TRU-01/03/13, USE-09; architecture §§5.3,
8.2/8.5/8.6, 11.4–11.5, 12.5, 15. No third-party product analytics,
session replay, commercial quotas, messaging/AI providers or pilot dashboards.

## Blocked by

- 0.4.1a: shared owner context and client/server boundaries.
- Merged #16: atomic command/idempotency and audit foundation.

## Acceptance criteria

- [ ] D1: Tenant-isolated product events and support/usage records are accessed
  through authorised transaction-bound core/repository operations. Each metric
  has a named definition, unit, date basis, denominator/N/A behavior and source.
- [ ] D2: Event names/fields are allowlisted and bounded. Support effort records
  explicit duration/category; events cannot contain arbitrary free-text form
  values. Do not record unavailable messaging/AI usage as observed consumption.
- [ ] D3: Committed-action instrumentation deduplicates by durable action
  identity and commits with the relevant change. Rollback/replay do not inflate
  counts; a test-only command demonstrates atomicity without a new demo route.
- [ ] D4: All tenant rows have composite references/shop-led indexes and forced
  RLS. Real PostgreSQL denies cross-shop access and missing context. Usage
  readouts expose only the requesting shop's allowed aggregate/source records.
- [ ] D5: Pino and Sentry adapters strip names, phones, measurement values,
  cookies/tokens, request bodies, signed URLs, file content and arbitrary error
  contexts. Canary tests prove exclusion for web/worker/error paths and bundles.
- [ ] D6: Default PII and session replay remain disabled. No external Sentry
  delivery or source-map upload is enabled without approved configuration;
  local test sinks prove the payload and graceful behavior when unconfigured.
- [ ] D7: Existing owner flows remain usable when telemetry fails. Record which
  later draft/media/PDF attachment points are covered by their own tickets;
  instrumenting them is part of those tickets' acceptance, not a hidden follow-up.

## Verification and delivery

Resolve/fetch current pino/Sentry documentation for configuration used. Preserve
exact approved pins and private environment handling. Run lint, Knip, strict
types, relevant unit/property/PostgreSQL/artifact/browser checks and build.
Include metric definitions, event field allowlist, canary and replay evidence.

## Recovery and activation

Use reviewed additive migrations and compatible code rollback. Record approved
retention as an activation input rather than choosing it. External processor
setup, live data and production monitoring activation retain later approvals.
