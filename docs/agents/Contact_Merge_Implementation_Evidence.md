# C2 contact merge and current attribution — issue #138

Implementation started 21 October 2026 at 15:50:34 UTC from development
`1dc774626354269249009fec960637f6687b7af1`. Direct blockers #136/#137 are
closed; PR #142 merged with Fast verification and Dependency audit successful
in [run 39624106793](https://github.com/nishanthturnstile/aarili/actions/runs/39624106793).
Owner selected this approved C2 ticket. Local validation is complete; draft publication and hosted/owner gates are recorded in the closeout.

## Consumer inventory and correction boundary

This inventory is the release gate before enabling mutation, not a claim that
every domain supports relinking. Product CUS-05/06, ORD-12, TRU-01/03/05/06/08/12/13
and architecture §§8, 11, 12 and 15 govern the implementation.

| Implemented consumer | Access and correction policy |
| --- | --- |
| Customer profile, search and duplicate review | Keep original person, code, consent and contact values. Resolve an active alias explicitly to the survivor; display the original route and correction link. Survivor fields are individually selected from the two reviewed contacts. No automatic field union. |
| Contact and wearer corrections/search keys | Existing reasoned contact correction updates the survivor. Original person remains intact. Wearer identity/name, preferences and current purpose grants are never merged or transferred. |
| Customer/wearer relationships, registration and guardian claims/verification/purpose events | Retain exact original relationships and authority. Shared wearers with conflicting relationship/eligibility facts block the merge. No new relationship or guardian authority is inferred. |
| Durable custom/group/service/registration/booking/change/repeat drafts | Payloads, versions, request bindings and resume identity remain original. No draft rewrite or automatic substitution. New explicit intake can select the survivor; recovery of old intake retains original references. |
| Accepted custom/service orders, pieces, requirements, additions and progress | Original customer/wearer IDs, snapshots, source hashes, promises and lifecycle remain unchanged. Only wearer-free standalone services with no booking, native parent, repeat lineage or accepted additions can receive an explicitly selected current contact overlay. No wearer change is supported. |
| Bookings, members, payer and commercial proposals | Excluded. Original payer/customer, package basis and membership remain intact. No financial obligation moves by contact association. |
| Repeat provenance and reverse links | Excluded. Original source and target access checks remain authoritative. An alias grants no cross-wearer access. |
| Unified customer history | Keep original attribution and canonical audit identity. Add merge/restore events to both contacts and selected current service attribution with links back to original records. Cursor binds current correction state. |
| Capacity demand and code allocators | No change, no new demand or numbering. |
| Privacy/audit/idempotency | Minimal typed IDs, versions, field-source choices and hashes only. Reason uses existing audited redactable identity evidence. Exact retry rechecks current authority and returns one durable event. |
| Private media infrastructure, documents/PDFs, measurements, designs, fit, money, custody | No implemented identity integration authorises relinking. Explicitly unavailable; retain references. No placeholder record or simulated financial/privacy coverage. |

The bounded supported association is a current contact attribution overlay, not
a new acceptance, payer transfer or rewrite of an order. A mistaken merge is
corrected by a fresh version-bound restore event; its selected overlays return
to original attribution. Earlier events and survivor field corrections remain
auditable. Further contact corrections use the existing correction flow.
Alias chains/cycles are rejected rather than flattened or guessed.

## Reuse and reset matrix

| Field or association | Merge / restore behaviour |
| --- | --- |
| Survivor display name, phone, email, aliases, notes | Owner chooses each entire field from source or survivor at the reviewed version. No concatenation, inferred name or automatic union. Material changes use existing `customer.correct` and search-key replacement. |
| Source contact/person IDs, code and original values | Retain. Profile/search return original identity plus a typed `mergedInto` correction link; no silent identity substitution. |
| Wearer/person, relationship, purpose and guardian evidence | Retain exact original records and current access rules. Shared relationship/authority disagreement blocks merge. No grant is copied. |
| Accepted order/customer/wearer/piece/subject/line IDs, original snapshots/digests/promises, demand and booking/payer basis | Retain byte-identical accepted content and original domain references. |
| Selected eligible standalone service's current contact | Append one typed attribution revision per individually checked service. Excluded associations have no selection control. Source and survivor histories expose original/current attribution; service detail links both contacts. |
| Mistaken-merge correction | Append a restore event at a newly reviewed version. Explicitly select all of that merge's current overlays. Restore returns their attribution to the original contact even after later repeat activity; survivor field changes require separate reasoned correction. |
| Existing drafts, repeat origins/targets and strict readers | Retain original payloads, schema versions, IDs and provenance; no bulk rewrite or automatic draft acceptance. |
| Merge operation, audit and request | Fresh operation/audit ID, trusted actor/time, reason and actor/action/body/precondition-bound key. Exact retries reuse the same frozen request and return minimal IDs/version. |
| Measurements, private assets, issued finance and unavailable domains | Unavailable for relink; no copied consent, body data, document, payment, custody or approval. |

## Transaction and reader contract

Commands enter the existing owner membership transaction with `app_user` and
transaction-local shop/user/actor context. Locks are request key, shop merge
serialization, sorted existing orders, sorted customer correction advisory locks,
sorted contact person rows and sorted wearer authority locks. No later booking
lock is discovered. Contact row locks also pin relationship registration. After
identity locking, re-read association discovery; a newly accepted order invalidates
the preview instead of acquiring an earlier aggregate lock out of order.

Preview fingerprints include both contacts, current wearer authority, pair review
version, association versions/digests/exclusions/current attribution, alias/review
state and privacy generation. Review caps at 100 records as a bounded technical
request; larger sets fail closed. This is not a business confidence threshold.
Missing precondition is 428, changed version/fingerprint 412, domain or replay
authority conflict 409 and invalid/changed key payload 422.
Association discovery remains internal until current wearer authority is checked.
Inaccessible wearer work contributes to invalidation but its order code, ID and
digest are omitted from the preview; unavailable authority blocks the mutation.
This does not grant access through the other contact.

The same transaction commits existing survivor field correction when necessary,
canonical merge audit, append-only merge event, selected typed attribution rows,
redactable identity evidence and request result. Durable command uniqueness
survives normal key expiry. Check any active key actor/action/hash before durable
replay. Replay re-reads current identity authority and the current merge generation;
a restore or permission withdrawal cannot silently reapply an old merge.
Canonical audit metadata records both reviewed contact versions and the reviewed
fingerprint. History uses the original contact's reviewed version for its source
reference and exposes the separate merge-review version as an explicit fact.

Customer and service readers add optional typed correction metadata. Old IDs and
codes remain searchable and readable, and all ordinary order/repeat/guardian/draft
policies still use their original references. Metadata does not grant access.
History projects the existing audit ID once, retains original source attribution,
shows current service attribution separately and binds cursors to correction state.
No historical personal labels are fabricated. There is no event-sourcing rewrite.

UI follows Current light/dark, shared tokens and existing owner controls. Each
surviving field and supported service is deliberately selected. Frozen body/key/
If-Match survive response loss and explicit rate-limit retry. Window focus clears
private pair/preview labels while retaining an unresolved request in its mounted
recovery component; authentication/shop invalidation clears that state. Parent
reads cannot replace an unresolved child command. No browser persistence or new
business URL payload is added.

## Migration and recovery

Migration `0041_contact_merge.sql` expands two tenant tables:
`customer_merge_event` and `customer_order_attribution`. Both have non-null shop
IDs, composite tenant foreign keys, shop-led keys/indexes, ENABLE/FORCE RLS and
append-only grants/triggers. SQL guards enforce alias direction/no chains or
cycles, source event sequence, actor/audit provenance, durable operation uniqueness,
supported same-shop service attribution and atomic key/evidence commit. Field
source metadata contains only the five enumerated source/survivor choices.
No contact/order/booking FK or accepted snapshot is rewritten or backfilled.

Reasons use existing `identity_revision_evidence` and the audited
`redact_identity_reason` privacy function. Ordinary runtime cannot update/delete
those reasons or execute that function. Immutable merge metadata contains only
IDs, versions, choices and hashes; current personal labels come from live records.

Recovery: revoke INSERT on `customer_merge_event` and
`customer_order_attribution` from `app_user` to stop new merges/restore/relinks.
Keep compatible readers, alias/attribution history and request/evidence rows.
Do not drop tables, bulk rewrite historical FKs, delete aliases or perform a
destructive unmerge. A reviewed restore is a new business correction, not a down
migration. Existing migrations use advisory locking; schema backup/review gates
remain applicable before deployment. No deployment or live activation occurred.

## Validation ledger

All data are synthetic. Native Windows, pinned Node 24.21.0/pnpm 12.11.2,
PostgreSQL 18.6 Testcontainers, runtime `app_user` and Chromium repository harness.
Final revision/hash and final commands are recorded below after verification.

- Initial PostgreSQL packet: 3 setup failures, **43.46s**, from a migration IF
  expression's unparenthesised CASE; exact parser position 5574 identified it.
  Parenthesising that expression passed isolated migration and then **3/3, 31.30s**.
- Combined merge/C1/history packet: **12/12, 231.76s**. Expanded merge-only packets
  passed **4/4, 53.50s** then **4/4, 40.90s**, adding SQL-level 23505 duplicate-key,
  23514 alias-cycle and 23503 cross-shop FK rejection rather than only API errors.
- A further concurrency assertion initially found only advisory-lock waiters and
  missed the earlier contact-row lock: **3 passed / 1 failed, 57.53s**. Its corrected
  observation includes that actual earlier lock class; final result follows below.
  It then passed **4/4, 81.48s**, including an actual uncommitted merge versus
  waiting permission withdrawal and current-authority replay rejection.
- First browser packet: **3 failed**, test evidence counted the tenant table
  without context and RLS correctly returned zero. Replaced that assertion with
  the authenticated history API. Follow-up passed **3/3, 4.2m**.
- Expanded selected-service/history browser packet passed **6/6, 5.7m**, covering
  both languages, both themes, phone/tablet/desktop, selected service attribution,
  stale preview, lost response, native admission wait/retry, restore and existing
  history/source/repeat access clearing. Self-review then identified the parent
  focus/unmount recovery gap; affected final checks include that regression.
- Intermediate fast verification completed lint/Knip/types, **272 units / 62 files**,
  negative types, OpenAPI and production build. PowerShell's stderr redirection
  produced a misleading wrapper exit status; final run explicitly captures the
  native exit code and stopwatch. The first fast attempt had one formatting failure
  in a changed interface and was corrected. Five existing informational template
  suggestions in unchanged `review-service-additions.mjs` remain unrelated.
  The focus-recovery revision passed native exit **0**, **130.368s**, including the
  production build. Final audit-version/authority-metadata checks follow below.
- T3 preview opened the ordinary sign-in route, but two snapshots failed with
  **“Preview automation snapshot timed out after 15000ms.”** Repository Playwright
  supplies the authorised fallback. Credentials remain in ignored private JSON.

The frozen runtime/test patch is SHA-256
`53ddf076fac29a4ee3c99c24c0771bf1e59ccaa9d13a2d39de17c4bed418ca48`
(`git diff --cached --binary 1dc7746 -- apps packages scripts tests`). No
dependencies, lockfiles or package exports changed. Final local commands:

- `pnpm exec vitest run --config vitest.integration.config.ts tests/contact-merge.integration.test.mjs tests/customer-history.integration.test.mjs`:
  **exit 0, 8/8, 141.49s**, against the frozen patch. This adds reviewed original/
  survivor versions, withheld inaccessible association metadata, JSON-null SQL
  field-choice rejection and survivor correction rollback to the retained proofs.
- `node scripts/test-ui.mjs tests/ui/contact-merge.spec.mjs tests/ui/identity-review.spec.mjs`:
  **exit 0, 6/6, 8.2m**, against the focus-recovery UI before the final additive
  audit facts/authority-message boundary. It includes actual focus after a committed
  write with lost response, hidden pair labels and exact body/key/If-Match retry
  at all three sizes/languages. Current final-build merge checks follow below.
- A final fast attempt encountered the unchanged job-binding property test's
  **5000ms timeout**, **271 passed / 1 failed**, native exit 1, **69.937s**, while
  PostgreSQL ran concurrently. Kept the timeout/test unchanged. After PostgreSQL
  completed, `pnpm exec vitest run tests/jobs.test.ts` passed **2/2, 399ms**.
  The complete sequential fast rerun result is recorded below.
- Impeccable detector over the four affected UI components and shared stylesheet:
  **exit 0, no findings reported**. Automated browser axe findings are recorded
  with their corresponding runs; no human accessibility acceptance is inferred.

Full promotion-only scaffold/PDF/smoke/browser suites and extra clean-install/Linux
image checks were not run. No dependency, lockfile, export-map, toolchain or build
script change triggers additional portability checks. Required hosted feature
Fast verification/Dependency audit and owner review remain separate gates.

## Acceptance map

| Acceptance | Concrete evidence and scope |
| --- | --- |
| RH-07 / CUS-02/07 / TRU-03/05/13 / AC-02/53 | Shared-phone contacts remain distinct until deliberate review. No wearer/guardian/purpose row is transferred. Unsupported wearer links reject selection. Current permission withdrawal serializes against merge and prevents stale replay; C1/guardian baseline cases remain retained. |
| RH-08 / TRU-01/06/12 / AC-55 | Real `app_user` forced policies, missing context, cross-shop API and 23503 FK rejection, SQL alias-cycle/23505 key constraints, same-key and competing-key races, repeat lock waiting, association-change invalidation and post-relink injected rollback. |
| RH-12 / ORD-12 | Canonical audit IDs appear once in both involved contact histories. Original contact source version and merge review version are distinct; audit records both reviewed contact versions, field-source choices and preview fingerprint. Selected service history/detail retains original IDs plus explicit current attribution and navigation. Existing pagination/revocation/source/repeat UI regresses separately. |
| RH-13 / CUS-05/06 / USE-08/09 | Every contact field, supported service, reason and confirmation is explicit. Missing/stale/invalid requests fail with 428/412/422; aliases cannot chain/cycle. SQL commit couples event/key/evidence. Reviewed restore retains original merge, corrects overlays and leaves legitimate survivor field corrections auditable. Lost-response/focus/rate-limit browser checks preserve the frozen request. |
| RH-14 / architecture §§8/12/15 | Populated 0040-to-0041 migration preserves prior snapshot/draft bytes and strict reads. Existing isolation inventory is extended. Disable merge INSERT and verify compatible readers; force evidence failure after actual writes and verify atomic rollback. |
| RH-15 / TRU-05/08/12/13 | No personal reason/field values in immutable merge metadata, key results or URLs. Audited reason redaction retains provenance; ordinary runtime redaction denied. Unavailable/sensitive domains are excluded and no full CUS-05/06, pilot, recovery, human language/device or production activation closure is claimed. |

The implementation is Aarili's independent design against its approved plan and
architecture. Earlier [REA evidence](Repeat_Order_History_REA_Evidence.md) remains
the competitor observation record; this implementation adds no new Nool or
TailorMan claim and did not copy their code or undocumented policies.

## Owner review packet

The final running URL and revision are recorded in the delivery closeout below.
Start from the repository root after building production web:
`pnpm exec node scripts/review-repeat-services.mjs start --merge`.
Private synthetic sign-in is in ignored
`.scratch/contact-merge-review-host/private.json`; do not paste credentials into
Git, an issue, PR or chat. Open its `historyUrl` after normal owner sign-in.

Try this as one session, English/light and Tamil/dark, phone/tablet/desktop:

1. **RH-07/13:** Find possible matches and review the separately coded synthetic
   contact sharing the phone. Compare linked wearers/current authority. Choose
   the original and surviving contact deliberately; the phone is not proof of
   identity. Preview the merge. Every surviving field requires a choice.
2. **RH-12/13:** Compare both field values and the exact accepted service list.
   Only supported services have individual checkboxes. Wearer-linked, grouped,
   source-linked, repeat and other excluded associations retain their original
   context. Review the explicit unavailable-domain notice. Close the preview;
   nothing has merged and no service attribution changes.
3. **RH-13:** Reopen, choose each field, select the supported standalone service,
   enter a synthetic reason and confirm the reviewed consequences. The result
   provides links to both contacts. Reopen the original profile: its code and
   original identity remain, with a visible survivor correction link.
4. **RH-12/14:** Browse both histories and the service source. Merge appears once
   per scope with actor/time/reason and reviewed versions. The service shows
   original attribution and a separate current contact link. Original order,
   price, promise, progress, source IDs and snapshots remain intact. No payment,
   private asset or wearer permission has moved.
5. **RH-13:** On the original contact, use the direct pair-review action and
   review restoring a mistaken merge. Explicitly select all of its current
   service overlays, enter a new reason and confirm. The original contact is
   restored; merge and restore remain in history. Survivor field corrections
   remain auditable for a separate deliberate correction.
6. **RH-13/15:** Inspect copy, wrapping, keyboard focus, 200% text and controls.
   Automated tests cover stale review, loss/focus recovery, admission waits and
   exact retries; no owner terminal replay is requested.

Copyable report: `RH-ID — pass/fail — observation`. Business acceptance, fluent
Tamil, screen-reader and physical low-end Android/RAM/browser observations remain
human checks. Emulation/axe/screenshots do not replace them. CI and owner merge
review remain pending at draft publication.

Teardown: `pnpm exec node scripts/review-repeat-services.mjs stop --merge`.
The owned disposable runner stops its web process and PostgreSQL container.
No tunnel, public demo, live data or production activation is created.

## Final local closeout

- Runtime/test patch SHA-256 remains
  `53ddf076fac29a4ee3c99c24c0771bf1e59ccaa9d13a2d39de17c4bed418ca48`.
- `pnpm verify:fast`: **native exit 0, 166.194s**, **272 unit tests / 62 files**,
  unit stage **15.38s**, production build graph **38.709s**. Includes actual
  Biome/boundary/token checks, Knip, strict types, compiled negative DTO/client
  fixtures and OpenAPI. No timeout or implementation change was made to the
  unrelated job-binding test; the sequential complete run passed.
- Final PostgreSQL **8/8, 141.49s, exit 0** is recorded above. The 12-case retained
  merge/C1/history packet and selected SQL-level failures are separate runs.
- `node scripts/test-ui.mjs tests/ui/contact-merge.spec.mjs`: **exit 0, 3/3, 4.6m**
  on the frozen final build; English/Tamil, both themes, phone/tablet/desktop,
  tablet landscape/200% text, axe zero, deliberate service selection/restore,
  stale review and exact lost-response/focus/admission retry. Earlier passing
  packets remain separate evidence, not this run.
- Ordinary owner review check: **exit 0, 7.058s**; normal UI sign-in to dashboard,
  real pair/merge preview, English/light desktop 1440x900, Tamil/dark phone
  360x800, axe zero, reflow and static-only PWA storage. No business mutation.
  Screenshot checks completed in two bounded visual rounds; no further polish.
- Review-ready observed **2026-10-21T16:55:19Z**. Running synthetic surface:
  [original customer](http://127.0.0.1:65263/customers/01a15f62-2721-7f7a-82bc-ab40f80f0edf),
  [standalone service](http://127.0.0.1:65263/orders?services=1&serviceOrder=01a15f62-39ab-7827-a6b9-4ced79bdae5a).
  Private access remains `.scratch/contact-merge-review-host/private.json`.
  Runner session is retained for owner review; startup/teardown are above.
- Hosted feature CI, owner merge review and human language/device/AT acceptance
  remain pending. Full promotion and unavailable/sensitive-domain gates are open.
