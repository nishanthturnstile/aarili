# [W0 0.4.3a] Authorise private uploads and immutable file reads

Published and approved as [issue #57](https://github.com/nishanthturnstile/aarili/issues/57) on 15 October 2026.
Implementation starts only after its direct blockers merge.

## What to build

An authorised workflow requests a private upload and later reads only accepted
immutable bytes. Browser consent claims and reusable upload URLs cannot bypass
subject policy or alter accepted history. Verify the lifecycle against real local
PostgreSQL/S3 through synthetic, test-only consent and validation adapters.

## Sources and scope

Roadmap 0.4.3; product TRU-01/03/05/07, USE-07, AC-38/39/53 foundations;
architecture §§6.4, 8.1–8.5, 10.1–10.2, 11.4–11.5, 15. No gallery/public copies,
new customer/consent subsystem or unrestricted file browser. Full content
processing is 0.4.3b; this slice's test validator is never production acceptance.

## Blocked by

- 0.4.2a: extracted production command/replay infrastructure.
- Merged #15, #35–#37: tenant context, transactional jobs and restore/runtime guards.

## Acceptance criteria

- [ ] G1: Typed upload admission/completion/read operations use the verified
  shop transaction and trusted purpose/subject policy. Unknown authority denies;
  a non-guardian payer cannot authorize minor photos. Browser consent flags do
  not create authority. Production adapters fail closed until real integration.
- [ ] G2: Admission validates supported declared format/limits, creates private
  pending state and fixes type/key in a roughly five-minute signed PUT. Signed
  secrets never enter logs, product events or browser persistence.
- [ ] G3: Staging and accepted keys differ. Completion captures a fenced
  processing request atomically with audit/idempotency/enqueue. Accepted objects
  are server-sealed from validated bytes; reusing the PUT cannot replace them.
- [ ] G4: Durable completion/attempt uniqueness handles duplicate requests and
  crash/retry. The test-only acceptance adapter proves sealing/read semantics;
  normal runtime cannot mark unvalidated input ready before 0.4.3b.
- [ ] G5: Reads recheck row/shop/current permission and ready status before
  issuing a roughly five-minute GET. Missing, foreign-shop, quarantined, deleted
  and pending assets disclose no private key/content. Downloads use safe names
  and headers; do not promise cancellation of already granted links before expiry.
- [ ] G6: Shop-led keys/references, forced RLS and data/policy restrictions
  prohibit minor/private-fitting publication. No publish endpoint or public
  bucket is introduced. Client-supplied object keys/URLs are never authority.
- [ ] G7: Abandoned-upload cleanup is idempotent and excludes references,
  accepted history and active processing attempts. Use explicit technical staging
  expiry/grace configuration; do not invent retained-personal-file policy.
- [ ] G8: Real PostgreSQL and S3 tests cover cross-shop/anonymous denial, forged
  subject authority, expired grants, PUT reuse, completion concurrency, database
  rollback, storage failure, crashes and cleanup races. Record local S3 support
  limits without claiming Railway behavior was verified locally.

## Verification and delivery

Resolve/fetch current AWS S3 SDK/presigner documentation, using installed
compatible exact pins. Run lint, Knip, types, real PostgreSQL/S3 integration,
relevant contract/security tests and build. Include immutable-key evidence and
safe environment/CORS instructions; no credentials are printed or committed.

## Recovery and activation

Reviewed additive migration/queue setup with backup and compatible code rollback.
Keep unaccepted objects private during reconciliation. Real consent binding,
retention/erasure and provider environment activation retain their later gates.
