# Phase 0.4 closeout acceptance

Evidence date: 16 October 2026. The ten approved Phase 0.4 implementations
merged through PRs #61–#71 and are present in integrated main
`4eab791efab8f6e2409684c51458a6909613f27d`; issues #51–#60 are closed. Every
merged feature PR passed `Scaffold verification` and `Dependency audit`, and the
promotion PR [#74](https://github.com/nishanthturnstile/aarili/pull/74) ran all
three required checks on revision `13b31ca` through
[run 38923921539](https://github.com/nishanthturnstile/aarili/actions/runs/38923921539).
`development` and `main` are content-identical apart from the promotion merge
commit, and the closeout uses the promotion results under the workflow's
integrated-main evidence rule rather than a duplicate local re-run.

This closes the **implementation** of Phase 0.4. It does not close the deferred
physical-device, fluent-Tamil, privacy or live-activation gates listed below, and
it does not authorise real customer data.

## Requirements and implementation coverage

Sources: [Phase 0.4 implementation plan](Phase_0_4_Implementation_Plan.md);
product §§1.6, 24–25, 27–30, 32–33; architecture §§5–11, 12.5, 15; roadmap
0.4.1–0.4.4. All published acceptance IDs (A–J) are reconciled below against the
merged implementation and its per-slice evidence.

| Issue / slice | Acceptance IDs | Agreed outcome and detailed evidence |
| --- | --- | --- |
| #51 / 0.4.1a | A1–A7 | Bilingual client-rendered owner shell, current shop, theme/viewport/keyboard/accessibility and restricted imports. [Shell evidence](Issue_51_Responsive_Shell_Evidence.md) |
| #52 / 0.4.1b | B1–B6 | Online-only PWA with exact fallback-only cache, install metadata and honest reconnect/update behaviour. [PWA evidence](Issue_52_PWA_Evidence.md) |
| #53 / 0.4.1c | C1–C6 | Preserved original names/notes, deterministic Tamil/Tanglish keys, shop-scoped immutable vocabulary revisions. [Vocabulary evidence](Issue_53_Vocabulary_Evidence.md) |
| #54 / 0.4.1d | D1–D7 | Tenant-isolated deduplicated allowlisted metrics, scrubbed logs/Sentry, safe owner/query lifecycle. [Observability evidence](Issue_54_Private_Observability_Evidence.md) |
| #55 / 0.4.2a | E1–E8 | Bound draft keys, versions, tenant transactions, registered promotion and real queue/audit/replay atomicity. [Durable drafts evidence](Issue_55_Durable_Drafts_Evidence.md) |
| #56 / 0.4.2b | F1–F8 | Online memory-only editing, serial saves, uncertain outcomes, explicit conflicts, resume/promotion. [Draft recovery evidence](Issue_56_Draft_Recovery_Evidence.md) |
| #57 / 0.4.3a | G1–G8 | Authorised admission/read, immutable sealing, private shop keys, bound completion jobs and current-authority denial. [Private uploads evidence](Issue_57_Private_Uploads_Evidence.md) |
| #58 / 0.4.3b | H1–H8 | Type/pixel/size validation, metadata stripping, derivatives, stale-result fencing, retries and cleanup. [Media processing evidence](Issue_58_Media_Processing_Evidence.md) |
| #59 / 0.4.4a | I1–I10 | Immutable models/fonts/templates/hashes, queued real-RLS rendering, bounded sandboxed renderer and 50-string Tamil goldens. [Versioned PDF evidence](Issue_59_Versioned_PDF_Evidence.md) |
| #60 / 0.4.4b | J1–J9 | Authorised exact-byte preview, file/download fallback, separate literal text action, attributable idempotent history and expiry. [Sharing evidence](Issue_60_Private_PDF_Sharing_Evidence.md) |

The [integrated candidate record](Phase_0_4_Closeout_Evidence.md) and the
individual evidence files retain their historical publication-time wording. Their
draft/merge and pending-observation statements do not override the merged PR
states or the integrated verification recorded here.

## Hosted verification on integrated main

| Check (promotion PR #74) | Result |
| --- | --- |
| `Scaffold verification` (9.3 min) | `pnpm verify` exit 0: Biome/boundaries/tokens across 181 source files, Knip, strict types, 39 unit/property files (151 tests), 21 real PostgreSQL/S3/jobs/PDF files (95 tests), OpenAPI, 50-string Linux sandbox PDF goldens with 5 A4/A3 page goldens, production build (11 routes), Next/Hono database readiness/outage and worker-shutdown smoke, and 29 browser artifact leakage scans |
| `Browser smoke and accessibility` (13.9 min) | 84 Playwright cases passed at phone, tablet and desktop sizes against a disposable PostgreSQL, covering setup/auth/recovery/connections, PWA install/reconnect, drafts, media, PDF preview/share, keyboard/focus, axe and privacy-artifact checks in Tamil and English |
| `Dependency audit` | Exit 0; no known vulnerabilities |

All three checks also passed on every merged feature PR #61–#71. No fix, follow-up
or failed check was outstanding at promotion, so no local suite re-run was
required; the local checkout was confirmed clean and equal to `origin/development`
and `origin/main` at closeout.

## Explicit remaining gates

These are deferred owner/human, external-resource or policy gates, not missing
Phase 0.4 implementation:

- **Physical device and language review.** Actual Android/reference-phone
  observations and fluent Tamil review were deferred by the owner; no device/RAM/
  browser identity or manual outcome has been fabricated. Emulation and controlled
  native-share stubs cannot satisfy the J8/H8/I9 physical/human gates. J8 remains
  deferred in the [sharing evidence](Issue_60_Private_PDF_Sharing_Evidence.md).
- **Synthetic-only development.** No normal-app fixture route, foundation demo
  handler or business template is enabled, and no real customer data, provider
  messaging, customer links, AI, public publication or hosted tunnel is introduced.
- **Privacy and policy.** Privacy notice, lawful retention/erasure, consent/minor
  authority and processor decisions require owner/legal approval; real retained-file
  erasure and draft deletion stay disabled until the later approved machinery.
- **Business documents and values.** Bill/receipt/job-slip wording and numbering,
  commercial rates, tolerances and other product §32 decisions remain separate.
- **Operational recovery.** Restore drill, kill switch, epoch/quarantine
  reconciliation and measured RPO/RTO remain Phase 0.5 (0.5.1/0.5.2) work.

## Next phase

Phase 0.5 (0.5.1 synthetic deployment and restore, 0.5.2 privacy maintenance)
is the next roadmap step. Its technical prerequisites (0.1.2, 0.2.2, 0.3.2, 0.4.4)
are merged, but it requires separately approved tickets and applicable
external-resource/legal authorisation before any implementation.

Owner direction (16 October 2026): Phase 0.5 is **held** and will be performed
immediately before deployment, not now. Development continues locally with
synthetic data only; no hosting, off-site backup, PITR, domain or provider is
provisioned by this closeout. The hosting/provider, backup-storage and domain
decisions, plus the privacy notice and retention periods, are prerequisites of the
held Phase 0.5 slices and will be requested when those tickets are prepared.

A safe synthetic Wave 1 slice (Phase 1.1) may be started meanwhile under its own
approved tickets and owner-supplied business values. Phase 0.4 completion alone
cannot activate production, real-data storage or automatic provider delivery.
