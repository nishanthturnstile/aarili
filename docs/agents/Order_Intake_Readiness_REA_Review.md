# Implementation status and next order-intake REA investigation

Snapshot: 19 October 2026. This records a read-only review of GitHub status,
repository evidence and public competitor pages. No application tests were rerun,
competitor runtime captured, issue published or application code changed in this
review. CI status is time-bound, not a promise about later results.

## Current implementation and validation

The checkout was clean on `development`, HEAD and local `origin/development`
`125b173c7eff16bbb0e986da51d8ac0c9292f884`. Local `origin/main` was
`13ae3733e2fcde01a62845610ed1ad6a985ad689`, the earlier promotion #96.

Owner entry/onboarding, customer/adult-wearer/minor-guardian registration and
Shop Settings were promoted in #96. The subsequent service/template tickets are
all closed and merged into development:

| Slice | Delivered configuration | Issue / merged PR |
| --- | --- | --- |
| 1.1.2a | Versioned catalogue, outfit pieces and add-ons | #97 / #102 |
| 1.1.2b | Garment/piece measurement-form definitions | #98 / #104 |
| 1.1.2c | Reviewed operating templates and exact service manifests | #99 / #105 |
| 1.1.2d | Lossless Simple/Detailed preference and sample preview | #100 / #107 |
| 1.1.2e | Exact category-to-commitment-rule bindings and preview | #101 / #106 |

Each of those five feature runs was inspected: Fast verification and Dependency
audit succeeded; full scaffold/browser promotion jobs were skipped under the
feature workflow. This is narrower than a successful full promotion.

Existing evidence records successful local verification at their stated source
snapshots, including:

- [Measurement forms](Measurement_Forms_Implementation_Evidence.md): final
  PostgreSQL 5/5 and browser 3/3, alongside fast/build/export evidence.
- [Operating templates](Service_Templates_Implementation_Evidence.md): real
  PostgreSQL 4/4, six language/viewport flows and three corrected history/axe cases.
- [Integrated templates/bindings](Commitment_Bindings_Implementation_Evidence.md):
  integrated fast gate 226 tests, focused PostgreSQL 15 passed with eight deliberately
  excluded, and desktop integration 4/4. These predate #100 and do not independently
  establish the final all-feature tree.
- [Simple/Detailed presentation](Workflow_Presentation_Implementation_Evidence.md):
  fast gate 227 tests, focused PostgreSQL 13 tests, browser 6/6 and three affected
  focus/axe follow-ups at the documented revisions.

At the GitHub snapshot, [promotion PR #108](https://github.com/nishanthturnstile/aarili/pull/108)
was open at `125b173`. [Run 39218672677](https://github.com/nishanthturnstile/aarili/actions/runs/39218672677)
had Dependency audit successful and Scaffold verification plus phone/tablet/desktop
browser jobs running. Thus complete promotion validation and integration into
main were pending. Recheck the exact head/jobs before changing that conclusion.
The successful run at `feda53a` (39218437237) only ran the dependency audit and
must not be described as full integrated verification.

Physical Android, fluent Tamil, assistive-technology review, production business
content/policy approval, restore/privacy and pilot/live gates remain separate
unless later evidence explicitly closes them. Emulated browser and synthetic
configuration results do not close those gates.

## Next selected planning target

Proceed to the research/design/ticket packet for **1.2.1 - Create and Recover a
Quick Order**. Existing 1.1.1-1.1.3 implementation prerequisites are merged into
development; promotion and live gates retain their own scope. No roadmap reorder
is needed. Application implementation still needs its selected approved ticket
and verified merged direct blockers.

The first outcome connects the existing customer/wearer, service manifest,
presentation and commitment configuration to real synthetic order records:

- Select the correct customer and wearer without weakening guardian permissions.
- Select an eligible service and pin exact catalogue/form/template/configuration
  references. Generate unresolved requirements and owner assignment.
- Record the original/current promised dates, priority and price or to-be-quoted
  state. Do not invent a value for an unknown amount or policy.
- Save incomplete server drafts, reload/resume, disclose unsaved values and
  support conflict/retry handling without duplicate orders.
- Apply the existing commitment evaluator against server-resolved current state;
  implement the approved load/capacity acceptance and locking boundary. An old
  preview or client-supplied load never authorizes acceptance.
- Advance recording is provided by 1.4.2 later. Do not copy a competitor's payment,
  tax/bill issuance or production-completion action into base intake.

Actual wearer measurements remain 1.3.2; operational production is later. The
next increments remain 1.2.2 bookings/pieces and 1.2.3 small services, followed by
1.2.4 repeat/history/duplicate review. Research may look ahead; implementation
must preserve each slice's scope and dependency gate.

## Exact source applications and questions

| Aarili outcome | Primary investigation | Secondary / boundary |
| --- | --- | --- |
| 1.2.1 minimal intake | Nool live app: Orders -> new tailoring order, customer selection, garments and delivery fields | TailorMan New Bill demo: quick garment buttons, progressive item details, date/priority controls |
| 1.2.1 saved order/recovery | Nool live app: our synthetic order's save, reopen, edit and available draft/cancel paths | No draft recovery guarantee is established yet. Test Aarili's lost-response, concurrency and outage behaviour locally; do not fault-inject the vendor backend |
| 1.2.2 grouped garments | Nool live multi-garment order and order detail | TailorMate web is a reserve comparison for its advertised multi-item orders; separate wearer, outfit-piece and partial-status semantics remain research questions |
| 1.2.3 alterations/small services | TailorMan Alterations demo for dedicated intake/navigation; Nool documented reopen-for-alteration action for comparison | A follow-up alteration is not proof of a standalone fall/pico flow. Verify supported paths; follow Aarili's lightweight-service requirements where vendor coverage is absent |
| 1.2.4 repeat/history | Nool Order Details -> Repeat Order and customer history | TailorMan Customer Profile demo for history layout. Merging identities, preserved agreements and safe relinking remain unverified and require Aarili policies/tests |

Public sources checked in this review:

- [Nool order workflow](https://www.nooltech.com/tailoring-order-management-software/)
  and [authenticated entry](https://app.nooltech.com/login).
- [TailorMan New Bill](https://tailorman.in/demo/new-bill.html),
  [Bill Detail](https://tailorman.in/demo/bill.html),
  [Alterations](https://tailorman.in/demo/alterations.html),
  [Customer Profile](https://tailorman.in/demo/customer.html).
- [TailorMate feature claims](https://www.tailormateapp.com/) and
  [web entry](https://web.tailormateapp.com/).

These sources establish advertised coverage or retrieved public sample content,
not new REA observations. TailorMan combines intake and bill/payment controls;
Aarili keeps commitments, issued bills, payments and production separate. Nool's
retail/GST controls and optional messages do not change Phase 1 release scope.

## Research method and exit condition

Use web-first REA observation, with the existing dedicated Nool research profile
if still available. Rediscover the current target/session; private sign-in is
needed only if expired. Reuse service-worker/capture lessons from
[the prior investigation](Service_Templates_REA_Evidence.md) and actual installed
tool schemas. No APK or new paid account is needed initially; introduce TailorMate
access only if a concrete multi-item question remains unanswered.

Use a synthetic repeat-customer blouse order first. Observe minimal creation,
missing/unknown fields, cancel, save/reopen and order detail. Then use blouse and
salwar examples for the later grouping questions; keep live order effects and
external messages out of the experiment. Do not modify shared public-demo state.

Keep raw authenticated captures outside Git and write sanitized evidence with
real REA Evidence IDs, exact scope, observations, inferences and unknowns. Client
evidence cannot establish server schema, RLS, transactions or idempotency. Our
implementation must independently prove isolation, snapshot history, atomic
capacity acceptance, retry and conflict guarantees.

Produce the 1.2.1 evidence/design/acceptance matrix and a concrete vertical ticket
packet before publication. Do not extend the selected implementation to all four
order slices without their separate approval and dependency checks.
