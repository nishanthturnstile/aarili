# [W0 0.4.2a] Save and promote durable tenant drafts

Published and approved as [issue #55](https://github.com/nishanthturnstile/aarili/issues/55) on 15 October 2026.
Implementation starts only after its direct blockers merge.

## What to build

Save incomplete server drafts, recover their committed state and promote one
exactly once through a registered workflow's current-state validation. A complete
synthetic API/database journey proves the foundation in a test-only host.

## Sources and scope

Roadmap 0.4.2; product USE-03/04/08, ORD-08 foundation, AC-02/40/55;
architecture §§6.3–6.4, 7.3, 8.1–8.5, 15. Order fields, customer deduplication
implementation and approvals remain Wave 1; production rejects unregistered
workflow types and never exposes the synthetic promotion adapter.

## Blocked by

- 0.4.1a: i18n/contracts/client conventions and protected owner context.
- Merged #16: atomic commands, ETags, audit and idempotency.

## Acceptance criteria

- [ ] E1: Extract narrowly reusable request binding/replay/version primitives
  from synthetic-specific command/repository types. Existing fixtures retain
  behavior; new production paths do not import exemplar types or routes.
- [ ] E2: Typed PUT/read/list/promotion operations use the verified owner shop
  transaction. Drafts have stable UUIDv7 identity, workflow/schema version,
  creator, lifecycle/version and timestamps. Incomplete and complete schemas are
  distinct; empty money/measurement inputs cannot become zero.
- [ ] E3: Initial save cannot blindly replace an existing ID. Updates require
  If-Match. Same key/actor/action/payload replays before stale checks; changed
  binding returns 422. Missing/stale/domain cases retain 428/412/409 semantics.
- [ ] E4: Promotion re-reads current dependencies/authority and calls the
  registered workflow adapter in the same transaction as result linkage,
  lifecycle transition, audit, idempotency and applicable jobs. Concurrent or
  retried promotion creates one result; failure rolls all of it back.
- [ ] E5: Synthetic validation proves duplicate-candidate/current-state checks
  reject rather than automatically merge, and old approval flags cannot become
  current authority. The production registry has no synthetic workflow.
- [ ] E6: Resume queries recover committed incomplete drafts with stable
  pagination/order. Promoted/abandoned states cannot accept ordinary edits.
  Thirty-day stale flags use trusted time. Notice/deletion settings are explicit;
  missing real policy prevents deletion while synthetic cleanup can be tested.
- [ ] E7: Every draft/reference uses shop-led keys and forced RLS. Real
  PostgreSQL covers cross-shop/missing-context denial, stale edits, same-key
  races, different-key promotion races, rollback and recovery after lost responses.
- [ ] E8: Normal startup exposes no synthetic draft type or exemplar route.
  Typed clients/OpenAPI and negative-import/type checks include the new boundary.
  Draft event hooks use the private instrumentation adapter when composed.

## Verification and delivery

Current Zod/Hono documentation is required for library-specific APIs. Run lint,
Knip, types, unit/property and real PostgreSQL tests, OpenAPI and production
build. Provide a disposable synthetic exercise and criterion-to-test evidence.

## Recovery and activation

Reviewed additive migration with pre-application backup; no destructive down
migration. Production deletion remains disabled pending owner/privacy policy.
Wave 1 connects real workflows and revalidates current-state promotion.
