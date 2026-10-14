# Issue #34 — balanced journal and derived positions

Evidence date: 14 October 2026. Wave 0 / 0.3.1c, subdivision of roadmap
0.3.1. Sources: product FIN-12/13/14/21, TRU-01/06/12, USE-08,
AC-18/19/20/38/55; architecture §§6.2, 8.1–8.5, 15; roadmap 0.3.1.
This establishes journal infrastructure and synthetic operational examples.
It does not complete production payment, billing, refund or pilot workflows.

## Admission, baseline and documentation

Authenticated `gh issue view 34 --repo nishanthturnstile/aarili` read its
complete body, ready-for-agent label and comments (none). The native
`dependencies/blocked_by` API returned only #32. PR #38 merged #32 at
`8c59658ad9a42fded94d729663e25fc8894aaa10`; inherited #16 merged through
PR #21 at `abd67edd491be5a1dc46661750a3c138f57a1dce`. Both merge commits
were verified as ancestors of integrated main. Allocation #33 is not a blocker;
its PR #39 had also merged. Main was clean and up to date at `6898680`.
AGENTS.md, tracker/workflow, foundation closeout and relevant product,
architecture and roadmap sections were read. No source conflict was found.

Fresh baseline `pnpm verify` passed: 65 unit/property and 38 real PostgreSQL
tests, lint/boundaries/tokens, Knip, strict types, negative types, OpenAPI,
production build/readiness/outage/worker smoke and 26 artifact scans. Baseline
audit found no known vulnerabilities. Work uses
`codex/0.3.1c-balanced-journal` in the same native Windows checkout. No worktree,
additional development checkout, unrelated edit or branch was removed.

Context7 CLI resolved PostgreSQL and Drizzle ORM before fetching official
PostgreSQL 18 constraint-trigger, SET CONSTRAINTS, transaction-ID/locking docs
and Drizzle's node-postgres transaction/execute documentation. Pinned installed
declarations and actual PostgreSQL verification establish compatibility.
Node 24.21.0, pnpm 12.11.2, TypeScript 7.0.2, Drizzle/typed-route/declaration
corrections and all external exact versions are preserved. The lockfile adds
only core's dependency on the existing workspace money package.

## Contract, authoritative boundary and scope

`postJournal()` in framework/vendor-free core uses a transaction-bound
`JournalRepository`. Server composition supplies the verified actor and shop
through `withShop()`. No journal HTTP route, Server Action, browser client,
money screen, worker or real outbound entry point is added.

`journal_batch` and `journal_entry` are production infrastructure in reviewed
additive migration `0005_balanced_journal.sql`. Commercial fixture subjects
and sources are opaque synthetic UUIDs, not new customer/bill/payment tables.
Each batch has actor/time/reason, source, subject, audit and command references,
request hash, expected entry count and an optional same-shop predecessor.
Entries hold signed bigint paise for five small foundation accounts: cash,
receivable, revenue, deposit/customer credit and refund liability. Positive
means debit; negative means credit. Liability displays negate the account total.
These labels and mappings require accountant review before live activation.

Each account appears at most once per batch, with 2–5 nonzero entries. Core
checks safe integer paise using existing money primitives. PostgreSQL checks
each entry's range, complete entry count, zero net, positive-side aggregate
and each derived subject/account aggregate against ±9,007,199,254,740,991
paise. Numeric SQL sums and bigint core sums avoid intermediate overflow.
There is no mutable balance or set-balance operation; queries sum postings.

Deferred constraint triggers run on **both** batch and entry inserts. An
audited direct app_user insert still cannot commit an incomplete, unbalanced
or unsafe journal, or omit the matching key. Trigger-assigned transaction ID
and expected-count checks seal committed batches against later appends.
UPDATE/DELETE/TRUNCATE are ungranted; history triggers also reject ordinary
maintenance updates/deletes. Trigger functions use invoker rights, fixed
search paths and no PUBLIC execution grant, never SECURITY DEFINER.

Subject advisory locks serialize writes before authoritative aggregate/link
checks. Write transactions require Read Committed so a stale snapshot cannot
validate against obsolete aggregates. Missing context fails closed. Every
relation has non-null shop_id, shop-led keys/indexes, composite tenant FKs,
ENABLE/FORCE RLS and restrictive read/write context policies. The catalog
gate now also rejects any ordinary UPDATE/DELETE grant on journal tables.
Backup access remains SELECT only; privacy grants remain absent.

The actor/action/hash-bound key, batch, all entries and audit commit together.
Replay reconstructs the original immutable batch from the stored ID. Durable
shop/source uniqueness survives request-key purging, and changed durable
bindings conflict. Same-key mismatches are 422; domain/source/link conflicts
are 409, and missing authorized predecessors are 404. These are core errors,
not claims of a new HTTP API. There is no editable record needing If-Match.

Linked reversal entries must be exact negatives of their predecessor. A
linked liability reclassifies the original customer credit; a linked
settlement transfers exactly the predecessor refund liability. Durable
shop/predecessor/kind uniqueness permits one of each. A consumed credit or
settled liability cannot simply be reversed underneath its descendant.
Production partial credits, refund authority, receiving accounts, source
locks/UTR, numbering and further adjustments retain their later owners.

## Acceptance map

| Criterion | Fresh executable evidence |
| --- | --- |
| C1 | Named unit properties cover exact balanced totals, inverse reversals, malformed/unknown/duplicate accounts, incomplete batches and wire/gross overflow. Real PostgreSQL bypasses core with genuine audit/key writes and rejects missing entries, declared-count mismatch, imbalance, unsafe amounts, gross/derived overflow, concurrent aggregate overflow and later append. Failed commits preserve all four table counts. |
| C2 | `positions()` sums entries through the composite shop join. Harness starts quotation/agreed ₹2,000 with no postings/revenue/receivable; ₹700 advance produces deposit only; issue then applies deposit. Pending ₹500 remains fixture evidence outside confirmed postings. Five compiled declaration negatives include absence of setBalance. |
| C3 | Harness and PostgreSQL test derive 130,000 paise due from bill 200,000/confirmed 70,000/pending 50,000; one confirmation derives 80,000. Lost-response retry and repeated key preserve history length and original batch IDs. |
| C4 | Original entries/provenance remain unchanged. AC-19 reverses the confirmed ₹500 once, reopening ₹1,300 due. AC-20 separates paid sale, sale credit/customer credit, linked refund liability and linked actual settlement; failed settlement leaves payable, retry clears it once. Concurrent reversal/liability/settlement attempts produce one effect. SQL bypass rejects wrong amount/subject/predecessor. Independent generated event model reconciles arbitrary paise payments, retries and reversals. |
| C5 | Catalog covers both production journal relations and detects FORCE, restrictive-policy and extra mutation-grant drift. Real runtime tests exercise both shops, membership denial, unfiltered reads, source/query/link/write denial, composite references, missing context, rollback/pool reuse, privilege escalation and immutable originals. Artifact scans forbid journal server code in browser output. |
| C6 | Failure injection after audit, batch, each entry and key plus backend loss before commit leaves zero partial business/audit/key effects. Same-key/source concurrency, actor/action/payload mismatch, discarded committed response and disposable admin-only key-retention simulation prove replay and durable uniqueness. |
| C7 | `pnpm foundation:money --demo` and `--interactive` inspect source sequence, every signed entry, immutable IDs, derived positions, pending distinction, replays, failures and corrections using disposable PostgreSQL/app_user. Terminal observations are agent-operated; accountant mapping and owner human acceptance remain pending activation/review gates. |

Unit properties use seed 340031 with 1,000 amounts up to MAX_SAFE_INTEGER.
The real PostgreSQL independent event model uses seed 340019, 25 generated
sequences of up to eight payments, each with 0–2 retries and optional reversal.
It computes received/due independently from event intent, then checks all
derived accounts and conservation after every step.

## Verification record

Final full native commands and exact-head Linux CI results are recorded on the
linked draft PR. Owner human acceptance is not inferred from agent/test output.

| Check | Result |
| --- | --- |
| `pnpm verify` | Passed: lint/boundaries/tokens, Knip, strict types, 67 unit/property and 44 real PostgreSQL integration tests, five new declaration negatives, OpenAPI, production builds/readiness/outage/worker smoke and 26 artifact scans. |
| `pnpm test:ui` | Passed: all 45 English/Tamil phone (360×800), tablet (820×1180) and desktop (1440×1000) browser/keyboard/focus/axe/auth-artifact cases. Generated auth screenshots were preserved privately outside the commit. |
| `pnpm audit --audit-level low` | Passed final run; no known vulnerabilities. |
| Journal-specific tests | Six real PostgreSQL cases passed after separating the linked liability; final full gate also exercises the strengthened liability concurrency checks. |
| `pnpm foundation:money --demo` | Passed final source sequence, journal failures/replays and existing exact-value/allocation cases; disposable PostgreSQL removed. |
| Native interactive | Agent exercised all commands below, including denial of reversal before confirmation, replay/reversal/settlement repeats and cleanup; passed expected results. |

During development, the test suite caught a zero liability displayed as -0;
display subtraction now normalizes zero. A grant-drift test exposed the catalog
gap and drove its additional append-only grant check. An older bootstrap test's
exact tenant-table list needed the new relations. A superseded full run was
interrupted after that failure while the final linked-event mapping was being
completed; it is not passing evidence. A pg concurrent-query warning in
inspection came from parallel reads on one transaction; history reads are now
sequential. The final journal run had no such warning. No test assertion,
timeout, isolation guard or version baseline was weakened.

## Exact owner manual acceptance

Use the existing pinned workspace and Docker Desktop Linux containers. Run
`pnpm foundation:money --interactive` in a terminal without DATABASE_URL or
MIGRATION_DATABASE_URL overrides, production mode or enabled OUTBOUND_EFFECTS.
The harness refuses these before creating infrastructure. It loads no app
private env/provider and targets only its newly created Testcontainers database.
Output amounts are integer **paise** and `history` includes every signed entry,
source, actor, reason, hash, batch/audit IDs and predecessor IDs.

At the amount prompt, enter this sequence and record observations:

| Command | Expected result |
| --- | --- |
| `:journal start` | Quote/agreed 200,000 with all positions zero; advance deposit 70,000; billed/advance-applied due 130,000 with pending 50,000. Three committed batches. |
| `:journal reverse` before confirmation | Reject; no implicit confirmation or reversal. Continue accepting input. |
| `:journal lost-response` | Confirmation commits; response is deliberately discarded, same key retried. Due 80,000, pending zero, four batches. |
| `:journal confirm` again | Due stays 80,000; same four IDs, no second confirmation. |
| `:journal reverse` twice | Due 130,000 with one fifth batch linked to the confirmation. Original four batches unchanged. |
| `:journal inspect` | Inspect the same immutable originals and linked reversal, balancing every batch to zero. |
| `:journal sale` | Separate ₹1,000 example: two batches, fully paid, due zero, cash 100,000 and revenue -100,000. |
| `:journal credit` | Third batch reduces revenue to zero; customer credit/deposit 100,000, refund liability still zero. |
| `:journal liability` | Fourth batch links to credit; customer credit zero, refund liability 100,000. |
| `:journal fail-refund` | Failure after all attempted writes before commit; same four batches, refund still payable 100,000. No actual provider refund is attempted. |
| `:journal settle` twice | Fifth batch links to liability; all five accounts zero. Second attempt preserves the same IDs and no extra effect. |
| `:journal reject` | JOURNAL_UNBALANCED before writes; then deliberately corrupted direct runtime entries fail at COMMIT (23514), rolling back postings/audit/key. |
| `:journal mutate` | Ordinary update denied (42501). AC-18 history and due stay unchanged. |
| `:quit` | Only this disposable PostgreSQL is removed; process exits zero. |

`pnpm foundation:money --demo` runs the asserted sequence without prompts.
Neither invocation asks for a retained database, new owner, provider, tax/rate
or secret. Agent observations are not owner/accountant approval. No billing
screen exists; existing auth/design-system screens provide regression coverage.
Fresh human screen, physical-device, Tamil PDF golden, search recall, privacy
execution and full restore/pilot acceptance are not claimed.

## Migration, recovery, review and handoff

This implementation applies schema only inside disposable tests/harnesses.
The retained local database/volumes and private environments are untouched.
Before any separately authorized retained-volume schema/money migration,
take and verify the required private backup; use existing app_owner/advisory-lock
migrator. Never use production drizzle-kit push, a destructive down migration
or weakening of triggers/policies for application rollback. Old app code can
ignore the additive relations while preserving all safeguards and history.

Before-commit failures roll back and can retry. After-commit response loss
replays immutable originals. Source and correction references survive request
retention. Restore must preserve journal IDs, source/link uniqueness, entries,
audit and request bindings; reconcile per-shop totals before resumed effects.
Schema sealing combines transaction provenance with immutable expected counts,
so restoration must not reopen old batches. Full restore rehearsal, restore
epoch/quarantine and money freeze remain 0.3.2b/0.5.1; this slice exposes no
live money entry point and does not certify those later guards.

Accountant review must explicitly approve debit/credit definitions, commercial
event timing, credit/liability/settlement mappings and reconciliation examples
before go-live. No fixed tax/refund/rate/retention policy is inferred. Product
§32 configuration/privacy and §33 pilot gates remain. Payment availability,
production source locks/UTR controls (1.4.2), document issue/numbering (1.4.4),
real credits/refunds (1.4.5) and privacy execution retain separate scope.

Publication is a separate draft PR linking Closes #34. Require Scaffold
verification, Browser smoke and accessibility, Dependency audit and deliberate
owner review. Do not merge, deploy or start another story. After explicit owner
merge authorization, update main in this same checkout and run integrated
checks before the next implementation branch.
