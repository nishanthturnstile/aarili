# Issue #53 — vocabulary and search-key evidence

Slice W0 0.4.1c; [issue #53](https://github.com/nishanthturnstile/aarili/issues/53).
Sources: product USE-02, DAY-04 foundation and AC-02; architecture §§6.2–6.4,
8.1–8.3, 8.5, 9.1–9.2 and 15; roadmap 0.4.1. Direct prerequisites #51/#15/#16
were merged before this branch started from integrated `27e3a46`. Worktree
approval is scoped to #53/#54/#55; no later issue is included.

## Implementation and acceptance

| Criterion | Implementation and executable evidence |
|---|---|
| C1 | `@aarili/i18n/search` exposes explicit `searchKeysV1`, shared by stored vocabulary keys and query resolution. Test-only identity storage also calls it. Original display names, phone text and notes are separate untouched fixture columns. `tests/search.test.ts` asserts NFC equivalence and input preservation; the PostgreSQL test reads the original names/notes back. |
| C2 | Fixed fixtures cover long vowels, repeated consonants, voiced/aspirated, dental/retroflex, v/w, final u, standalone u/whitespace, mixed scripts, punctuation, blank input, and short phone suffixes. 500 generated strings exercise deterministic and applicable idempotent Latin/skeleton/phone/NFC steps. Similar keys never establish identity equality. |
| C3 | `reviseVocabulary` is framework-free, with a transaction-bound repository interface, actor/action/request binding and persisted response. Advisory locks serialize command keys and vocabulary heads; If-Match gives 428/412, validation gives 422 and version exhaustion gives 409. Immutable revisions contain Tamil/English labels, aliases, reason, actor and audit reference; a versioned current head advances by compare-and-set. Database guards prevent historical updates/deletes and late key appends; revision completeness is checked at commit. Real transactions prove duplicate replay, changed payload/actor/target denial, competing version updates, lost-response replay, rollback after append/head/key writes and successful retry. |
| C4 | Additive migration `0009_vocabulary_search.sql` uses non-null shop IDs, shop-led primary/unique/index keys and composite tenant foreign keys. All three tables ENABLE/FORCE RLS with restrictive context/read/write coverage. Runtime is app_user; only the head's version/pointer is mutable. Catalog coverage includes the new tables and append-only grant drift checks. Real PostgreSQL tests cover missing context, foreign-shop reads/writes/references, membership denial, history grants/triggers and grant drift. |
| C5 | `scripts/test-support/vocabulary-fixture.mjs` installs synthetic identities only into a disposable Testcontainers database. Search uses shared query keys and current vocabulary aliases, returning two distinct identities even when skeleton/phone match. Updating a vocabulary entry changes current alias resolution while each identity's explicit earlier revision still returns its original historical labels. There is no production search route, customer screen, new browser cache or external service. |
| C6 | Both keys and revision provenance explicitly record algorithm version 1; schemas reject unsupported versions. No startup job rewrites original text or silently recalculates retained keys. The version/reindex protocol and later pilot gate are below. |

## Selected v1 mapping

The in-house table lives in `packages/i18n/src/search.ts`; there is no translation
SDK or network service. NFC text is traversed with consonant plus optional vowel
sign: an unmarked consonant has `a`, pulli removes that vowel. Tamil consonants
map to `k, ng, c, nj, t, n, t, n, p, m, y, r, l, v, zh, l, r, n`; Grantha
letters use `j, s, sh, s, h`, and aytham uses `h`. Independent vowels and signs
use `a, aa, i, ii, u, uu, e, e, ai, o, o, au`. Long Tamil e/o map directly to e/o
so they do not accidentally enter the Tanglish ee→i / oo→u spelling folds.
Names such as கோபி/Gopi, தேவி/Devi, மீனா/Meena and தோழி/thozhi have explicit
cross-script fixtures. This is a search hint mapping, not lossless transliteration.

Latin keys use NFKD, remove combining marks, lowercase and collapse punctuation
and whitespace. Skeletons repeatedly fold aa→a, ee/ii→i, oo/uu→u; kh/gh/g→k;
ch/sh/c→s; th/dh/d→t; ph/bh/b→p; zh→l; w→v; repeated consonants collapse and
final u is removed per token. Whitespace is collapsed again after removal, giving
a stable fixed point even for standalone u tokens. Retroflex/dental diacritics
fold with Latin decomposition. Unknown script letters remain in derived keys;
original text is never replaced by keys or translated.

Phone digits support explicit ASCII, Tamil, Devanagari, Arabic, Persian and
fullwidth decimal blocks. Under four digits there is no last4; under six there
is no last6. The synthetic query uses exact phone or exactly four/six-digit
suffixes; a five-digit input is not silently broadened into a four-digit suffix.
Its SQL ranks exact ID/phone/suffix, then current vocabulary/alias, prefix and
trigram matches (0.3 is a synthetic demonstration threshold, not a recall claim).
Synthetic phone suffix columns are generated and have shop-led B-tree indexes.
Production customer name GIN trigram indexes arrive with the customer search
slice, when there are real name tables to index; this foundation has shop-led
exact vocabulary key indexes and does not add a btree_gin extension.

## Algorithm upgrades and recovery

Do not change the semantics of a deployed `*V1` function or rebuild v1 keys using
another mapping. A future V2 requires new functions, fixture/property/recall
comparisons and reviewed additive SQL allowing a second key version. Backfill
V2 keys from original text in an approved maintenance/migration path, keeping V1
keys while old code remains supported. The current same-transaction key seal and
version constraints intentionally reject ordinary runtime reindexing; any
maintenance exception must be explicit in that reviewed migration. Switch query
selection only after coverage/recall evidence, then remove old keys in a later
approved contract step. Historical labels and revision references never change
as part of reindexing.

Back up before applying retained schema. Application rollback requires the
compatible additive schema; there is no destructive down migration and no live
schema application here. Privacy redaction remains limited to later audited
privacy functions/tombstones; this change grants no ordinary erasure bypass.

## Verification record

The coordinator serialized final verification against the frozen implementation.
The initial `pnpm verify` passed lint, Knip, typecheck, all 94 unit/property tests
in 24 files, negative type fixtures and OpenAPI generation. Its integration stage
reported 69 passed and one failed out of 70: the bootstrap A5 test had an exact
tenant-table inventory that omitted the three newly added vocabulary tables.
The umbrella command exited 1 at that stage; it is not reported as a successful
full `pnpm verify` run.

After adding only those three expected table names to the bootstrap test, the
coordinator's remaining verification pipeline exited 0: `pnpm lint`; the targeted
bootstrap A5 check (one passed, seven unrelated tests skipped, 6.49 seconds);
`pnpm build` (11 successful tasks, 23.387 seconds); `pnpm smoke`; and the artifact
check (29 artifacts). Together the original integration run and targeted repair
cover all 70 distinct integration checks. Already passing checks were not
repeated because the repair changed only the expected test inventory.

Focused development evidence also includes the five search/vocabulary unit
tests (including 500 generated normalization cases), the four vocabulary
PostgreSQL checks and the six existing tenant-isolation checks. The coordinator
ran `pnpm audit` with no known vulnerabilities and confirmed `git diff --check`
was clean. Browser tests were not run locally for this backend/search foundation;
the existing hosted browser checks and owner review remain required before merge.
No new UI, routing or browser runtime was introduced.

The test PostgreSQL extension setup is confined to the disposable fixture and
uses the same approved pg_trgm extension as local infrastructure. Containers,
ports, databases and generated output are isolated in this issue's worktree.

## Remaining activation and manual gates

Owner review and CI precede any merge. Vocabulary editing screens and real
customer search integrate in their Wave 1 issues; no such capability is activated
here. A Tamil-speaking owner should review spelling/terminology and the mapping
against actual expected variants. Before pilot, approximately 200 consented,
anonymised customer-name cases across Tamil/Tanglish/English must achieve at
least 95% in the top five; these synthetic tests do not satisfy that gate.
Physical-device, pilot and live recovery/privacy/configuration gates remain
with their owning slices. No real customer data, deployment or external service
activation was used.
