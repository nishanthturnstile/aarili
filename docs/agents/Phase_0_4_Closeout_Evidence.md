# Phase 0.4 integrated candidate evidence

This records the implementation candidate for issues #51–#60. #51–#60 have since
merged (PRs #61–#71) and the accepted state is now recorded in the
[Phase 0.4 closeout acceptance](Phase_0_4_Closeout_Acceptance.md); that document
supersedes the "candidate" framing here. It still does not grant live-data
permission. The owner deferred physical Android and fluent Tamil review; their
gates remain open.

## Full acceptance traceability

Every published acceptance ID is retained in the following issue evidence. The
fresh final candidate suites exercise the combined implementation; the historical
documents preserve slice-specific failure/recovery evidence and limitations.

| Issue / slice | All acceptance IDs | Evidence and remaining scope |
| --- | --- | --- |
| #51 / 0.4.1a | A1–A7 | [Responsive shell](Issue_51_Responsive_Shell_Evidence.md): bilingual client shell, current shop, theme/viewport/keyboard/accessibility, restricted imports and server authority. Physical review remains open. |
| #52 / 0.4.1b | B1–B6 | [Online-only PWA](Issue_52_PWA_Evidence.md): exact fallback-only cache, install metadata, honest reconnect/update behaviour, multiple dirty workflows/tabs, private-data denial. Actual phone install/reopen remains open. |
| #53 / 0.4.1c | C1–C6 | [Vocabulary](Issue_53_Vocabulary_Evidence.md): preserved original names/notes, deterministic Tamil/Tanglish keys, shop-scoped immutable revisions, explicit conflict control and synthetic search probes. Later pilot recall uses approved cases. |
| #54 / 0.4.1d | D1–D7 | [Private observability](Issue_54_Private_Observability_Evidence.md): tenant-isolated deduplicated allowlisted metrics, scrubbed logs/Sentry, safe owner/query lifecycle. External delivery remains disabled. |
| #55 / 0.4.2a | E1–E8 | [Durable drafts](Issue_55_Durable_Drafts_Evidence.md): bound keys, versions, tenant transactions, registered promotion, real queue/audit/replay atomicity and failure/concurrency checks. Synthetic registry remains test-only. |
| #56 / 0.4.2b | F1–F8 | [Draft recovery](Issue_56_Draft_Recovery_Evidence.md): online memory-only editing, serial saves, uncertain outcomes, explicit conflicts, IME-safe state, resume/promotion and accessible recovery. Real Tamil IME/device review remains open. |
| #57 / 0.4.3a | G1–G8 | [Private uploads](Issue_57_Private_Uploads_Evidence.md): authorised admission/read, immutable sealing, private keys, bound completion jobs, current consent/purpose authority and denial. Real consent/retention integration precedes activation. |
| #58 / 0.4.3b | H1–H8 | [Media processing](Issue_58_Media_Processing_Evidence.md): type/pixel/size validation, metadata stripping, derivatives, stale-result fencing, retries/cleanup, controlled browser capture fixture. Genuine HEIC/notebook legibility/device observations remain open. |
| #59 / 0.4.4a | I1–I10 | [Versioned PDFs](Issue_59_Versioned_PDF_Evidence.md): immutable models/fonts/templates/hashes, queue, real RLS, bounded sandboxed renderer, retries/shutdown/cleanup, 50-string technical Tamil goldens. Fluent Tamil template review remains open. |
| #60 / 0.4.4b | J1–J9 | [Preview/manual sharing](Issue_60_Private_PDF_Sharing_Evidence.md): authorised exact-byte preview, preparation before activation, file/download fallback, separate literal text action, attributable idempotent history, clearing/expiry, isolated HTTPS command. J8 is deferred; this document records J9 without claiming phase acceptance. |

## Fresh integrated verification

Stable candidate verification results belong to #60's verification record and
its PR checks; the accepted integrated results are recorded in the
[Phase 0.4 closeout acceptance](Phase_0_4_Closeout_Acceptance.md). No isolated
historical pass is represented as a current main pass.
The repository's full `pnpm verify` includes lint/boundaries/tokens, Knip, strict
workspace/negative types, unit tests, generated OpenAPI, Linux sandbox/PDF goldens,
real PostgreSQL/S3/jobs tests, production build, readiness/outage/worker-shutdown
smoke and private artifact checks. `pnpm test:ui` covers combined browser flows;
the additional installed-Chrome pass covers the new sharing surface at the three
supported sizes. CI performs frozen clean installs and Linux verification.

## Explicit remaining gates

- Actual Android/reference-phone and fluent Tamil observations are deferred;
  no device/RAM/browser identity or manual outcome has been fabricated. Emulation
  and controlled native-share stubs cannot satisfy J8/H8/I9 physical/human gates.
- Synthetic-only development continues. No normal-app fixture route, foundation
  demo handler or business template is enabled. No real customer data, provider
  messaging, customer links, AI, public publication or hosted tunnel is introduced.
- Phase 0.5 infrastructure/backup/restore/privacy work requires its separately
  selected approved tickets and applicable external-resource authorisation.
  No deployment or external service was started by this slice.
- Privacy notice, lawful retention/erasure, consent/minor authority and processor
  decisions require owner/legal approval and complete implementation before live use.
- Business document wording/numbering, rates/tolerances and other product §32
  decisions remain separate. This foundation does not approve bills/receipts/job slips.
- Restore drill/kill-switch/epoch/quarantine/reconciliation evidence, recovery
  readiness, reference-device performance, approved recall cases and all product
  §§28.3/32.2/33 pilot gates precede live records. Phase 0.4 completion alone cannot
  activate production, real-data storage or automatic provider delivery.
