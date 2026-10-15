# [W0 0.4.1c] Version bilingual vocabulary and search keys

Published and approved as [issue #53](https://github.com/nishanthturnstile/aarili/issues/53) on 15 October 2026.
Implementation starts only after its direct blockers merge.

## What to build

The same Tamil, Tanglish, English and phone normalization works on stored data
and queries. Shop vocabulary and aliases are versioned without changing original
names or historical labels. Demonstrate the storage/query path with synthetic
fixtures; real customer search and vocabulary configuration screens follow later.

## Sources and scope

Roadmap 0.4.1; product USE-02, DAY-04 foundation, AC-02 identity protection;
architecture §§6.2–6.4, 8.1–8.3, 9.1–9.2, 15. Use shared i18n functions,
framework-free policies and transaction-bound repositories. No online translation
service, automatic identity merging or claim of pilot search recall.

## Blocked by

- 0.4.1a: shared i18n package and boundary/build wiring.
- Merged #15–#16: tenant context, protected history and idempotent/versioned writes.

## Acceptance criteria

- [ ] C1: Original names/notes are preserved; deterministic NFC Tamil, folded
  Latin, phonetic skeleton and phone digit/last4/last6 keys follow architecture
  §9.1. Stored/query normalization uses one versioned implementation.
- [ ] C2: Tests cover long vowels, repeated consonants, voiced/aspirated and
  retroflex/dental folds, v/w, final u, mixed scripts, punctuation, blank values
  and short phone inputs. Property tests establish determinism/idempotence of
  applicable normalization steps without asserting distinct identities merge.
- [ ] C3: Tenant vocabulary/aliases retain Tamil/English labels, revision and
  provenance. A synthetic version change leaves earlier referenced labels
  intact and uses command replay/concurrency safeguards for mutable state.
- [ ] C4: New tables/indexes have shop-led keys, composite tenant references
  and forced RLS. Real PostgreSQL proves read/write isolation, missing-context
  denial and cross-shop reference rejection under app_user.
- [ ] C5: A test-only end-to-end query uses current shop vocabulary/aliases and
  shared query keys; original identities remain distinct. Normal runtime gains
  neither synthetic search routes nor a premature customer-directory screen.
- [ ] C6: Version migrations/reindexing are explicit and compatible; do not
  silently reinterpret an existing key algorithm or auto-rewrite original data.
  Record the later approximately 200-case, 95%-top-five pilot recall gate.

## Verification and delivery

Use an in-house Tamil-to-Latin table unless measured evidence requires the
architecture's optional library. Document the selected mapping and fixtures.
Run lint, Knip, types, unit/property, real PostgreSQL tests and production build.
Include reviewed additive SQL, isolation catalog coverage and acceptance mapping.

## Recovery and activation

Back up before retained-schema application. Roll back application code only
against compatible additive schema; no destructive down migration. Real customer
search and owner vocabulary editing integrate in their Wave 1 slices.
