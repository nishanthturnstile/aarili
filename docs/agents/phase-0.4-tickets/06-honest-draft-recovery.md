# [W0 0.4.2b] Recover online drafts without false save states

Published and approved as [issue #56](https://github.com/nishanthturnstile/aarili/issues/56) on 15 October 2026.
Implementation starts only after its direct blockers merge.

## What to build

Reusable online form/resume components clearly distinguish saved data from
current unsaved input and resolve interrupted requests without duplicate actions.
The complete synthetic journey is operated through a test-only browser host.

## Sources and scope

Roadmap 0.4.2; product USE-03/04/08/09, AC-40/55; architecture §§5.2, 7.1–7.3,
8.5, 15. No production synthetic editor, offline persistence, business order form
or automatic conflict merge. Reuse the selected UI and shared translations.

## Blocked by

- 0.4.2a: durable draft contracts, typed clients and promotion semantics.

## Acceptance criteria

- [ ] F1: Create a UUIDv7 when a form opens. Save after approximately one second
  without edits; defer while Tamil IME composition is active. The draft's opaque
  URL ID appears only after the first committed save, never with personal values.
- [ ] F2: Only one save is in flight. Preserve its exact payload/key/version
  while checking an uncertain outcome; later edits queue in memory and get a
  new command only after the earlier outcome is known.
- [ ] F3: Saving, Saved, Not saved, Checking outcome and Conflict states are
  accessible and accurate. Saved refers only to acknowledged committed values,
  including when edits arrive during an earlier successful response.
- [ ] F4: Reconnect/retry resolves the same command. Failed current values stay
  on screen; reload/reopen/second-device resume restores committed values only.
  A stale conflict preserves local input and requires explicit resolution.
- [ ] F5: Resume/promote controls prevent duplicate clicks but rely on server
  guarantees. Promotion failure/current-state changes remain visible; no old
  approval, payment or date commitment silently carries to a new record.
- [ ] F6: Dirty/in-flight/unknown outcome state integrates with PWA safe-update
  guards when composed; navigation/reload warnings do not falsely promise that
  unsaved values survive closing the page. Sign-out/access loss clears values.
- [ ] F7: Real browser/server tests cover lost response after commit, offline
  before save, retry after later edits, reload, reopening, second context/device,
  stale versions, repeated promotion and denied access in both languages/themes
  and all three screen classes. Inspect storage/URLs for personal data.
- [ ] F8: Reusable exports contain no synthetic workflow. Normal routes remain
  free of demo editors; synthetic UI fixtures run only in the isolated test host.

## Verification and delivery

Resolve/fetch current React Hook Form/resolver and Query docs for APIs used.
Run lint, Knip, types, relevant controller/unit/server/browser tests and build.
Attach the state transition table and requirement-to-failure-test evidence.

## Recovery and activation

No new business migration is expected. Revert compatible controller/UI source.
Real quick intake integration remains 1.2.1. Include the synthetic form in the
phase's physical Tamil IME/reconnect/local-HTTPS review.
