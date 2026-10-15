# [W0 0.4.1a] Build the responsive bilingual owner shell

Published and approved as [issue #51](https://github.com/nishanthturnstile/aarili/issues/51) on 15 October 2026.
Implementation starts only after its direct blockers merge.

## What to build

The verified owner can navigate the implemented workspace and connection/account
actions using deliberate phone, tablet and desktop layouts in English or Tamil.
Changing identity/shop or losing access immediately clears private in-memory
state. Preserve selected themes, fonts and the existing access/setup flows.

## Sources and scope

Roadmap 0.4.1; product USE-01/02/09, TRU-01, §§32.1/33.1; architecture §§5.2,
6.2–6.4, 7.1, 8.2, 9.2, 15; selected design system and cleanup #47–#48.
Shared catalogues/formatting belong in i18n. No business pages, sample records,
persisted locale, offline capture or speculative navigation destinations.

## Blocked by

- Merged #3 and #12–#15: UI, owner access and tenancy.
- Merged #47–#48: selected-theme and runtime/demo cleanup.

## Acceptance criteria

- [ ] A1: Existing owner/setup/sign-in/recovery/connection flows retain behavior,
  entry routes and security; synthetic/demo routes remain absent.
- [ ] A2: Shared English/Tamil catalogues have key parity and existing Noto
  fonts. Every fresh page load/navigation starts in English, Tamil is explicit,
  names/notes remain original, and locale is not inferred or persisted.
- [ ] A3: Below 768px use compact bottom navigation; 768–1279px a collapsible
  rail; at 1280px+ a sidebar with current-shop context. Show only implemented
  destinations. Container-adaptive content and dialogs do not clip Tamil.
- [ ] A4: Shop/identity-keyed Query state is memory-only. Sign-out, access loss
  and shop transitions cancel pending reads, clear cache/component values and
  reject late responses. Synthetic second-shop tests require no new shop UI.
- [ ] A5: Typed clients retain authenticated transport, no-store and invalidation
  semantics. Client bundles contain no core/db/server auth/secrets; new i18n
  exports and package/build/boundary checks enforce the existing architecture.
- [ ] A6: Both themes/languages pass phone, tablet orientations and desktop
  keyboard/focus/axe/reflow checks, 44px targets and text enlargement. Tamil
  composition, reduced motion and dialog transition contrast remain covered.
- [ ] A7: No API/business storage, PII URL parameters or third-party tracking is
  introduced. The existing theme preference remains the only persisted UI
  preference. Record first-use/warm navigation measurements without claiming
  physical-device targets from emulation.

## Verification and delivery

Resolve/fetch current Next.js, next-intl and TanStack Query documentation for
the APIs used; preserve exact baselines and the owner language override. Run
lint, Knip, strict types, relevant tests and production build plus the owner
browser suite. Include cache invalidation race evidence and requirement mapping.
Use a focused topic branch in the existing checkout; require CI/owner review.

## Recovery and activation

No schema migration is expected. Revert compatible application source if needed.
Physical Android/fluent Tamil review remains required during phase closeout;
this slice does not authorize live data or a new deployed environment.
