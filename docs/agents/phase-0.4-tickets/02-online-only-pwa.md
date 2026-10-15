# [W0 0.4.1b] Install the online-only PWA with safe updates

Published and approved as [issue #52](https://github.com/nishanthturnstile/aarili/issues/52) on 15 October 2026.
Implementation starts only after its direct blockers merge.

## What to build

The owner can install Aarili, launch the implemented owner workspace and
understand loss of connectivity. Updates cannot discard edits in an open form.
No business information becomes available from a device cache.

## Sources and scope

Roadmap 0.4.1; product USE-01/03/04/09, AC-40 foundation, §§31.2/32.1;
architecture §§7.2–7.3, 11.4, 15. Use the prescribed minimal hand-written
service worker, static bilingual fallback and manifest with maskable icons.
Offline capture/synchronization and persisted query caches remain excluded.

## Blocked by

- 0.4.1a: real owner shell and shared language/cache behavior.

## Acceptance criteria

- [ ] B1: Manifest, icons, theme/display settings and owner-workspace start URL
  make the app installable in a supported secure context; signed-out launch
  follows normal authentication rather than exposing cached owner content.
- [ ] B2: Actual Cache Storage contains only the static offline fallback and
  its required assets. API/authenticated pages, private images/PDFs and signed
  responses are never cached or recovered from a service-worker fallback.
- [ ] B3: Offline navigation shows a static Tamil/English reconnect notice that
  distinguishes previously committed work from unsaved current values. A live
  open page retains in-memory values and is not forcibly navigated/reloaded.
- [ ] B4: A waiting update activates on a safe next launch or explicit reload
  after the form is safe. A shared dirty/in-flight/outcome-unknown guard prevents
  update prompts/actions from discarding current input; draft UX can reuse it.
- [ ] B5: Reconnect, denied registration, stale worker/cache cleanup and first
  installation fail visibly and safely. Never add background sync or an offline
  mutation queue. Static fallback contains no shop/account identifiers.
- [ ] B6: Browser tests inspect caches/storage and network in both languages,
  both themes and all screen classes, including a waiting update with an open
  dirty form in a test-only host. Existing owner flows and demo-route absence pass.

## Verification and delivery

Use current official Next.js/browser documentation for the actual PWA APIs.
Run lint, Knip, types, relevant unit/browser tests and production build. Test
service-worker behavior over a secure test origin, not by mocking its cache.
Document installation/update failure behavior and phase physical-phone review.

## Recovery and activation

Version the static cache; recovery unregisters/replaces only Aarili's worker and
cache. Do not delete unrelated browser data. Physical install/reopen review uses
the phase's temporary local HTTPS preview; no hosted resource setup is included.
