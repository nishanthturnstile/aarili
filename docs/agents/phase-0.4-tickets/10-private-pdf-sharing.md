# [W0 0.4.4b] Preview and manually share private PDF outputs

Published and approved as [issue #60](https://github.com/nishanthturnstile/aarili/issues/60) on 15 October 2026.
Implementation starts only after its direct blockers merge.

## What to build

An owner previews an authorised immutable output, shares its file on Android or
downloads it on desktop, opens WhatsApp text separately and explicitly records
marked sent. Synthetic template/content runs only in the isolated test host.

## Sources and scope

Roadmap 0.4.4; product USE-01/02/07/09, COM-04/06, TRU-03/07, AC-64 job-slip
foundation; architecture §§7.1–7.3, 9.2–9.3, 11.4, 15. No customer links,
WhatsApp API, delivery/read receipts, automated messages or premature financial
templates. Physical Android and fluent Tamil review occur in this phase.

## Blocked by

- 0.4.4a: immutable model/artifact, render status and authorised read services.

## Acceptance criteria

- [ ] J1: Shared preview/status/download controls use typed authorised clients
  and lazily load only the selected ready document. Preview and output refer to
  the same immutable model/template/font revisions and language/paper choice.
- [ ] J2: Prepare the authorised PDF before the user's Android share tap. Use
  file-capability detection and file sharing only on user activation. Unsupported
  sharing falls back to download with clear manual instructions.
- [ ] J3: WhatsApp text opens on a separate explicit action with the intended
  phone/message; desktop downloads then guides manual attachment. Do not put
  private URLs or internal costs in prefilled text, logs or product events.
- [ ] J4: Prepared and marked-sent history is explicit, attributable, audited
  and idempotent. Cancellation/failure does not mark sent; no flow claims
  WhatsApp delivery, reading, approval or payment confirmation.
- [ ] J5: Rendering/download denial, expiry, storage outage, retry and access
  loss have accessible recovery states. No cached/persisted file, object URL or
  stale response survives sign-out/shop switch; release temporary memory URLs.
- [ ] J6: Browser/server tests cover both languages/themes, phone/tablet
  orientations/desktop, keyboard/focus/axe, file preparation before gesture,
  cancellation, fallback, repeated history commands and cross-shop denial.
- [ ] J7: A documented temporary local HTTPS test-host command supports the
  nearby reference phone with isolated synthetic data, certificate trust and
  narrowly scoped LAN access. Teardown removes its temporary processes/trust/
  access configuration as applicable. No normal-app validation mode or hosted
  tunnel/service is introduced.
- [ ] J8: Record actual Android device/RAM/browser, capture/HEIC result,
  notebook legibility, Tamil IME/reconnect, PWA install/reopen, PDF readability,
  share/text actions and download fallback. Record fluent Tamil reviewer/golden
  findings and fixes. Outstanding human/device review prevents phase acceptance.
- [ ] J9: Integrated phase closeout maps all ticket acceptance IDs to fresh
  evidence, confirms no demos/live data/external activation, and records remaining
  privacy/retention/consent/business-template/restore/pilot gates explicitly.

## Verification and delivery

Use current browser Web Share documentation for capability/user-activation APIs.
Run lint, Knip, strict types, relevant tests/build and final pnpm verify,
pnpm test:ui, audit and applicable clean-install/Linux checks. Include reviewed
goldens and actual manual observations; do not substitute emulation for them.

## Recovery and activation

Rollback compatible UI/client source without changing accepted PDFs or history.
Manual sharing is owner-triggered and synthetic during this phase; business
templates integrate later. Remove temporary preview access after review. Phase
completion is not permission to store live data or deploy production.
