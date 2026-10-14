# Issue #32 — exact money and quantity boundaries

Evidence date: 14 October 2026. W0 / 0.3.1a is the exact-value subdivision of
roadmap 0.3.1. Sources: product FIN-12/TRU-12 foundations, USE-08, AC-23/AC-58
arithmetic and §§27, 29.1, 30.1, 32, 33; architecture §§5.3, 6.2, 8.1,
8.4, 8.5, 15. This establishes primitives and a synthetic proof, not completion
of financial/product workflows or approval for live data.

## Admission and compatibility

Read the complete issue body, all comments (none) and native blockers using
authenticated `gh`. The sole direct blocker #16 merged through PR #21 into main
at `abd67edd491be5a1dc46661750a3c138f57a1dce`. `git merge-base --is-ancestor`
confirmed inclusion in `origin/main`. The clean existing checkout was on
integrated main `02505708bfa7815261da1f1a1e310df0f929a5e4`; fast-forward pull
was already current. Fresh baseline `pnpm verify` passed (48 unit tests,
36 PostgreSQL tests, all existing lint/types/build/smoke/artifact gates) and
baseline audit reported no known vulnerabilities before branching.

Work uses `codex/0.3.1a-exact-money` in that same native Windows checkout.
No worktree, additional feature checkout, retained-volume migration or reset.
No source conflict found. The issue's exact pins, TypeScript declaration and
typed-route compatibility corrections, and Drizzle patch remain unchanged.
The lockfile adds workspace links only; no new external dependency.

Context7 CLI resolved libraries then fetched current official Zod 4.6.5
(installed 4.6.6) safe-integer/nullable/strict-object docs, Drizzle bigint
mapping, node-postgres type/parameter docs, PostgreSQL 18 integer ranges,
fast-check bigint arbitraries and MDN JSON.parse reviver-source documentation.
Pinned declarations, strict builds and real PostgreSQL verify actual compatibility.

## Boundary and acceptance map

| Criterion | Implementation and fresh evidence |
| --- | --- |
| A1 | `@aarili/money` checks operands and results, int8 and safe-number bounds. Add/subtract/multiply/exact divide use bigint; multiply/divide allows huge intermediate products whose final result fits. `money.test.ts` compares independent bigint references with 500 runs per property, signed limits, adjacent overflow, zero, invalid operands and division/fraction errors. |
| A2 | `contracts/money` distinguishes signed postings/nonnegative financial inputs, strict safe-integer numbers and mm. The compiled operational client validates both directions. JSON decoding checks original numeric tokens before accepting parsed numbers: decimal/exponent tokens cannot hide rounding/underflow. Seven invalid wire/arithmetic/client type uses must fail compilation. Real pg int8 read-back is exact; corrupt out-of-wire-range rows fail closed. Formatting splits integer rupees/paise before Intl grouping and preserves `.91` at the wire limits. |
| A3 | Separate draft nullable/optional schemas and complete values. Text parsing uses decimal strings and bigint scale factors; blank/null remain unknown, deliberate zero persists, excess precision/invalid grouping/symbols/exponents/negative unsigned entry fail. Unit/property, integration negatives and CLI observations cover this. |
| A4 | AC-58 stated basis: 2.2 m → 2,200 mm and 22,000 paise at synthetic INR 100/m. AC-23: 2,000/5,000 mm of INR 500 → 20,000 paise. Fractional-paise costs return `{supported:false,reason:"FRACTIONAL_PAISE"}`. No rounding, stock movement, valuation or real rate is invented. |
| A5 | `pnpm foundation:money --demo` and `--interactive` use a new non-reused Testcontainers PostgreSQL, fixture-only SQL, authorized `app_user` transactions and raw/validated read-back. Target/production/outbound guards precede provisioning. `money.integration.test.mjs` proves range, isolation, append-only history, failed/enlisted/disconnected transaction rollback and clean retry. Application migrations alone do not create the fixture. |
| A6 | Money is framework/vendor-free with an enforced import gate; core sees only contracts/repository types, DB implementations remain transaction-bound. No HTTP route, production money capability, browser import or business Server Action. Existing auth, OpenAPI, production and browser checks continue. |

Property seeds: 320031–320038; seven unit properties at 500 runs each,
plus 75 actual PostgreSQL property round trips and explicit edge/failure cases.
Test names expose 0.3.1a / A1–A6 and relevant requirement/AC identifiers.

## Verification record

Fresh native Windows results on the settled implementation:

| Command / gate | Observed result |
| --- | --- |
| `pnpm verify` | Passed: Biome (142 files), boundaries (55 sources), tokens, Knip, strict types, 58 unit/property tests, negative types (seven new invalid uses), OpenAPI, 38 real PostgreSQL tests, nine package/app builds, production readiness/outage/worker smoke and 26 artifact scans. |
| `pnpm audit --audit-level low` | Passed; no known vulnerabilities. |
| `pnpm test:ui` | Passed: all 45 Tamil/English phone (360×800), tablet (820×1180), desktop (1440×1000), keyboard/focus/axe and auth privacy-artifact cases. Incidental regenerated captures from unchanged screens were excluded. |
| `pnpm foundation:money --demo` | Passed on final code; exact JSON/int8 read-back, blank/zero/edge/rejection cases, AC-23/AC-58 and fractional-paise detection; disposable PostgreSQL cleanup confirmed. |
| Frozen install | `pnpm install --frozen-lockfile` passed; exact external versions and reviewed patch unchanged. |
| Documentation/whitespace | All 14 local links in the changed evidence/roadmap resolved; `git diff --check` passed. |

Hosted Linux runs the same applicable outcome through the existing three PR
checks. Exact-head hosted results are authoritative on the linked draft PR;
they were pending at publication. CI and deliberate owner review remain required.

The fractional-JSON regression was first observed failing against the original
decoder, then passed after original-token validation. The initial full run
also caught a tenant-path inventory mismatch: the registry was already loaded
when its assertion was updated during the run. The registry and assertion now
both include the money repository; final verification runs on the settled files.
No existing isolation assertion or failure test was weakened.

## Operational exercise and exact owner steps

Requirements: the pinned Node 24.21.0/pnpm 12.11.2 workspace installed with its
frozen lockfile and Docker Desktop Linux containers available. From the existing
checkout run `pnpm foundation:money --interactive`. No database URL or fixture
installer is supplied. The harness rejects process-level `DATABASE_URL`,
`MIGRATION_DATABASE_URL`, production mode, enabled OUTBOUND_EFFECTS and extra
arguments. It does not load the app's private environment files or providers.
Use a fresh terminal without target overrides; do not change retained credentials.

The amount prompt expects plain decimal text without a currency symbol. The
following amount/length pairs exercise the operational/API foundation:

| Amount text (INR) | Length text (m) | Expected observation |
| --- | --- | --- |
| blank | blank | Both draft values null; `UNKNOWN_NOT_PERSISTED`. |
| `0` | `0` | JSON/database/read-back all zero; formatted `₹0.00`. |
| `0.01` | `2.2` | Amount 1 paise, length 2,200 mm; database strings `"1"`/`"2200"`; fixture cost 22,000 paise. |
| `1,000.01` | `2.2` | Amount 100,001 paise; read-back exact; formatted `₹1,000.01`. |
| `90071992547409.91` | `0` | Amount 9,007,199,254,740,991 paise; formatted `₹9,00,71,99,25,47,409.91`. |
| `90071992547409.92` | `0` | Rejected, never narrowed or rounded. |
| `0.001` | `2.2` | Unsupported money precision rejected. |
| `1` | `2.2001` | Unsupported mm precision rejected. |
| `1e3` or `-0.01` | `0` | Malformed/negative unsigned entry rejected. |

At the amount prompt also enter:

1. `:json {"amountPaise":1.5,"lengthMm":0}` — reject fractional wire input.
2. `:json {"amountPaise":9007199254740990.9,"lengthMm":0}` — reject even though ordinary JSON.parse rounds it to a safe integer.
3. `:json {"amountPaise":9007199254740992,"lengthMm":0}` — reject unsafe wire integer.
4. `:json {"amountPaise":0,"lengthMm":9007199254740991}` — inspect the supported quantity limit without the fixture's cost calculation overflowing.
5. `:demo` — shows AC-23/AC-58 results and `FRACTIONAL_PAISE` for 1 mm at 1 paise/1,000 mm, plus all automated entry/rejection cases.
6. `:quit` — observe disposable PostgreSQL cleanup and exit zero.

The automated demo and agent-driven native terminal exercise observed blank,
zero, 0.01, 1,000.01, the money limit, unsafe input, the rounded-fraction JSON
negative, all `:demo` outcomes and successful `:quit` cleanup. These are
operational checks by the agent, **not human acceptance or a business screen**.
Owner observation of this table is pending; record deviations during PR review.
Existing screens provide regression coverage only. No screen was changed;
owner sign-in/recovery/reset/connections/sign-out and design-system manual
rechecks remain owner review, not a claimed fresh human validation.

## Isolation, history, recovery and scope self-review

`synthetic_money_value` exists only in the disposable fixture. It has non-null
shop_id, a shop-led composite primary key, shop reference, ENABLE/FORCE RLS,
matching restrictive/effective policies, narrow INSERT/SELECT runtime grants
and an immutable trigger. The catalog gate and bidirectional guessed-ID,
missing-context, unauthorized membership and foreign-shop insert cases pass
against actual PostgreSQL. This path is in the tenant inventory.

Schema installation uses app_owner plus the existing advisory lock in one
transaction. Admin credentials seed synthetic identities/corrupt values and
inject failure only in tests. Runtime insert/read/raw inspection use app_user
and withShop; no membership, role or shop supplied in a DTO can forge context.
Runtime cannot assume app_privacy. No broad erasure bypass is created.

The fixture is append-only even for direct maintenance UPDATE/DELETE. It is
not a payment, posting journal or issued record. It deliberately has no
synthetic business audit or correction workflow; real money events will reuse
the existing command/idempotency/audit contract and gain their own durable
constraints and linked corrections in their named slices. History is not
deleted to undo this implementation.

Injected failures after insert/read, enlisted SQL failure and backend loss
roll back the whole value write; the prior committed value survives and a
clean retry succeeds. A later transaction proves committed read-back and
pooled-context cleanup. This does not prove backup restoration, job quarantine
or exactly-once external delivery. Disposable cleanup never resets retained
owner data or volumes. Application rollback uses the compatible existing
production schema; no production migration is introduced.

Known limits: wire JSON uses plain integer tokens, text entry supports ASCII
decimals with valid Indian/international grouping, and all number outputs are
within the safe signed integer range. Fractional paise are unsupported, not
rounded. The codec fails closed without reviver source support; the operational
client runs on the pinned Node 24, not older browser runtimes.

FIN-05 (#33), persistent journal (#34), payment/UTR/number locks, real costing,
rounding decisions, tax/billing, durable work, restore/provider guards and
privacy/retention workflows remain their named later owners. Physical devices,
Tamil PDF goldens, search recall, live provider/backup/restore drills and pilot
readiness were not run or claimed. OUTBOUND_EFFECTS/provider configuration,
deployments, GitHub settings and all business policy decisions are unchanged.

Publication is a draft for required CI and deliberate owner review. No merge,
deployment or next story is authorized. After an explicit owner merge decision,
update main in this same checkout and run integrated checks before branching again.
