# Issue #33 — exact FIN-05 allocation

Evidence date: 14 October 2026. Wave 0 / 0.3.1b, subdivision of roadmap
0.3.1. Sources: product FIN-05, FIN-12 foundation, AC-17/AC-49 and §32.1;
architecture §§6.2, 8.4, 15; roadmap 0.3.1 and responsibility handoffs
1.4.2/1.4.4/1.4.5. This is pure arithmetic and a synthetic operational proof.
It does not certify confirmed funds, remaining business balances or live use.

## Admission and baseline

Authenticated `gh issue view 33 --repo nishanthturnstile/aarili` read the complete
body, labels and comments (none). The native `dependencies/blocked_by` API
returned only #32. Its implementation merged through PR #38 into main at
`8c59658ad9a42fded94d729663e25fc8894aaa10` on 14 October 2026. PR state,
merge commit and ancestry were verified; its three hosted gates passed.
The existing clean checkout was already at that integrated main after fetch
and fast-forward check. AGENTS.md, tracker/workflow, foundation closeout and
the relevant source sections were read. No source conflict was found.

Before branching, fresh native `pnpm verify` passed: 58 unit/property tests,
38 real PostgreSQL integration tests, lint/boundaries/tokens, Knip, strict
types, negative types, OpenAPI, production build/smoke and artifact scans.
Baseline `pnpm audit --audit-level low` found no known vulnerabilities.
Work uses `codex/0.3.1b-fin-05-allocation` in that same checkout. Existing
branches were preserved; no worktrees or additional feature checkout.

Context7 CLI resolved fast-check then fetched its current official
array/property/seed/run-count documentation. Existing pinned fast-check
4.10.2 declarations verify actual compatibility. No dependency, lockfile,
Node 24.21.0/pnpm 12.11.2/TypeScript 7.0.2 pin, declaration/typed-route
correction or Drizzle patch changed.

## Contract and acceptance map

`allocateFin05(sourcePaise, lines)` in `packages/money` accepts a nonnegative
safe integer source and a nonempty readonly array of `{lineId, chargePaise}`.
Charges use the approved nonnegative integer checks. Array position is the
explicit stable order; callers must supply agreed order rather than an
unordered database result. IDs are unique, case-sensitive opaque ASCII tokens
of 1–128 characters: first alphanumeric, then alphanumeric, dot, underscore
or hyphen. UUIDs fit; IDs neither establish membership nor authorize a shop.
Missing/empty/sparse arrays, invalid/duplicate IDs, unknown, negative,
fractional, nonfinite or unsafe amounts fail before returning a result.
Errors contain fixed codes, never entered values.

Totals and products use bigint internally, even above int8/wire bounds.
Each input and output remains within the approved safe-integer wire range.
Every share is `floor(source × charge / (total × 100)) × 100` paise.
All remaining paise go to the largest charge, first in supplied order on ties.
With a zero total, every share is zero and the entire source is unallocated.
The returned allocation records are new objects in original order.

| Criterion | Implementation and automated evidence |
| --- | --- |
| B1 | Exact bigint proportional arithmetic, whole-rupee floors, strict-greater maximum selection and remainder. Frozen-input and output-independence properties prove no mutation; repeated calls prove determinism. |
| B2 | AC-17 produces 40,000/60,000 paise; AC-49 produces 33,400/33,300/33,300. Named example tests and operational fixtures assert these values. |
| B3 | 70,000/40,000/30,000 charges and 100,000 source give 50,100/28,500/21,400; fractional-remainder allocation would differ. 100,001 across three equal charges gives 33,401/33,300/33,300. |
| B4 | All-zero fixtures and generated zero-charge properties retain the whole source as unallocated credit. Empty/malformed arrays fail explicitly. Operational blank source/charge remain unknown and are rejected. |
| B5 | Independent reference properties use integer-paise quotient then rupee truncation and stable ranking. Conservation, nonnegative safe outputs, one/many lines, sub-rupee sources, ties/reordering and MAX_SAFE_INTEGER inputs with oversized totals/products pass. Approved money schema/parser negatives plus six compiled type negatives reject unsupported inputs. |
| B6 | The same primitive drives 21 operational cases: seven each for deposit, discount and direct-cost labels. Harness adapter/fixture tests run in the existing unit gate, and compiled declaration negatives run in the existing negative-types gate. No confirmed-funds, charge cap or authorization policy is inferred. |

Properties use fixed replayable seeds 330031–330034, with 1,000/500/500/500
runs respectively. Zero and single lines, explicit examples and malformed
inputs supplement generated cases. A wrong two-line expected fixture was
caught and corrected to 50,001/50,000 paise; strict typechecking also caught
generic `Object.freeze` callback inference in the test, corrected with an
explicit callback. Neither required a baseline/tooling change.

## Fresh verification

| Check | Result |
| --- | --- |
| `pnpm verify` | Passed: Biome (144 files), boundaries (55 sources), tokens, Knip, strict types, 65 unit/property tests, negative types including six new allocation failures, OpenAPI, 38 real PostgreSQL tests, nine package/app builds, production readiness/outage/worker smoke and 26 artifact scans. |
| `pnpm test:ui` | Passed: all 45 English/Tamil phone (360×800), tablet (820×1180), desktop (1440×1000), keyboard/focus/axe and auth privacy-artifact cases. Incidental regenerated auth captures from unchanged screens were excluded. |
| `pnpm audit --audit-level low` | Passed; no known vulnerabilities. |
| `pnpm foundation:money --demo` | Passed: all 21 allocation fixtures, existing exact JSON/int8/quantity/rejection cases and disposable PostgreSQL cleanup. |
| Native interactive inspection | Agent operated `node scripts/foundation-money.mjs --interactive` after package build: required examples, paise, single line, zero-charge credit, reordered ties, malformed precision, duplicate IDs, empty lines, successful retry and `:quit` cleanup all observed. |
| Documentation/whitespace | All 15 local links in changed evidence/roadmap resolved; `git diff --check` passed. |

Hosted Linux uses the existing Scaffold verification, Browser smoke and
accessibility, and Dependency audit gates. Exact-head results are tracked on
the draft PR; CI and deliberate owner review are required before merge.

## Exact owner operational acceptance steps

Use the pinned installed workspace and Docker Desktop Linux containers.
From the existing Aarili checkout, run `pnpm foundation:money --interactive`
in a terminal without database URL overrides, production mode or enabled
OUTBOUND_EFFECTS. The harness refuses those targets/options before provisioning.
It loads no private app env file or real provider, creates only a disposable
PostgreSQL fixture and removes it on normal exit. Allocation inspection is
pure and does not write allocation/payment records.

Enter these commands at the amount prompt. Amounts and charges are plain INR
decimal text; the JSON output shows integer paise, ordered IDs, formatted shares,
unallocated credit and `conservedPaise` as an exact string.

| Input | Expected formatted shares in supplied order; unallocated |
| --- | --- |
| `:allocate 1000 a=1000 b=1500` | ₹400.00 / ₹600.00; ₹0.00 (AC-17). |
| `:allocate 1000 a=700 b=700 c=700` | ₹334.00 / ₹333.00 / ₹333.00; ₹0.00 (AC-49). |
| `:allocate 1000 a=700 b=400 c=300` | ₹501.00 / ₹285.00 / ₹214.00; ₹0.00. |
| `:allocate 1000.01 a=700 b=700 c=700` | ₹334.01 / ₹333.00 / ₹333.00; ₹0.00. |
| `:allocate 1000 b=700 a=700 c=700` | `b` receives ₹334.00; `a`/`c` ₹333.00. Compare with the original tie order. |
| `:allocate 1000.01 a=1` | ₹1,000.01; ₹0.00. Source is not capped to charge by this primitive. |
| `:allocate 1000.01 a=0 b=0` | ₹0.00 / ₹0.00; ₹1,000.01. |
| `:allocate 1`, `:allocate 1 a=`, `:allocate 1 a=1 a=2` | Reject empty lines, unknown charge and duplicate ID; continue accepting commands. |
| `:allocate 0.001 a=1`, `:allocate -1 a=1`, `:allocate 90071992547409.92 a=1` | Reject unsupported precision, negative source and unsafe source. |
| `:allocate 1 a=1` after rejection | ₹1.00; no prior failed inspection affects it. |
| `:allocations` | All seven fixtures under each of deposit/discount/direct-cost; inspect conservation and labels. |
| `:demo` | Allocation fixtures plus the existing exact JSON/int8/quantity/rejection demonstration. |
| `:quit` | Disposable PostgreSQL cleaned and process exits zero. |

`pnpm foundation:money --demo` runs the same assertions without prompts.
Agent terminal observations are operational checks, **not human acceptance**.
Owner observation is pending PR review. No money screen exists. Existing
sign-in, recovery/reset, owner/connections, sign-out and design-system screen
checks are regression coverage; no fresh human screen acceptance is claimed.

## Isolation, history, replay, recovery and handoff self-review

The new function has no framework/vendor imports, database, shop context,
clock, random ID, mutable module state, outbound provider or browser entry.
Repeated evaluation has no side effects. Input validation and exact arithmetic
do not establish shop access or available confirmed funds. Existing import
boundaries and money browser denial remain enforced.

No production migration, allocation persistence, journal, table or runtime
grant is added. Existing synthetic money fixture access remains app_user
through withShop with forced RLS and append-only protection; full PostgreSQL
regression tests remain the evidence for that existing path. The new CLI
allocation branch cannot edit history. Operational failure can be retried;
normal exit removes only its newly created disposable fixture. Abrupt process
recovery retains the existing Testcontainers cleanup limits and never touches
retained volumes. Application rollback is code-only with unchanged schema.

0.3.1c owns persistent postings. 1.4.2 owns source SELECT FOR UPDATE,
confirmed available value/over-allocation prevention, durable UTR uniqueness
and reasoned pre-issue reallocation; 1.4.5 owns post-issue adjustments;
1.4.4 owns document numbering. Full AC-17/AC-49 remaining-balance/payment
workflows are not certified by these foundation examples. No real rates,
stock/custody, tax, billing, providers, privacy execution, restore drill or
pilot readiness is activated. Physical devices, Tamil PDF goldens, search
recall and human screen review remain named later/manual gates.

Publication is a separate draft PR for owner review. No merge, deployment or
next story is authorized. After explicit owner merge authorization, update
main in the same checkout and run integrated checks before another branch.
