# Owner sign in onboarding and dashboard entry plan

Implementation approved, 17 October 2026. This replaces the
entry-flow presentation in [Owner Access Onboarding](Owner_Access_Onboarding.md).
That document remains evidence of the earlier implementation, whose visual/flow
result the owner rejected. Earlier automated passes do not approve this revision.

Confirmed: keep invite-only owner registration. Validate the existing setup ID
once during registration and carry its server-side admission into onboarding.
Do not ask for the ID again after sign-in. The setup credential and database
shop ID are different values; do not display or use the latter as an invitation.

Sources: product §4, BIZ-01, SET-01, USE-01/02/08/09, TRU-01 and §32.2;
architecture §§6.5, 7, 9, 11 and 15; roadmap 1.1.1–1.1.2, 1.9.2 and 1.10.4.
Use frontend-design and Impeccable for the visual brief and implementation.

## Intended journey

Future marketing site → app sign-in → server entry decision → onboarding if
required → dashboard after confirmed shop creation. The marketing site is a
separate future surface; the app's root resolves the user's current destination.

Authentication, initial shop onboarding and workspace are separate experiences.
Sign-in contains only authentication actions. It does not show an account-to-shop
progress bar, workspace navigation or business setup instructions.

"First time" means the verified owner still needs a shop, not a login counter.
Closing a browser or signing in again must not bypass incomplete setup. A
completed owner must not repeat onboarding after a new deployment or on another
device.

## Route and state contract

Proposed canonical routes: /sign-in, /setup, /recovery, /reset-password,
/onboarding, /dashboard, /connections and /reauthenticate. Preserve /owner as a
compatibility entry that resolves to the correct destination. /setup remains the
protected sign-up/verification route, presented through ordinary sign-up wording.

| Authoritative state | Requested route | Result |
| --- | --- | --- |
| No valid verified owner session | /, /owner, /dashboard, /onboarding, /connections | Replace/redirect to /sign-in; render no protected content |
| Verified admitted owner without completed shop | /, /owner, /sign-in, /dashboard, /connections | /onboarding |
| Verified admitted owner without completed shop | /onboarding | Show shop setup |
| Verified owner with completed shop and valid membership | /, /owner, /sign-in, /setup, /onboarding | /dashboard |
| Verified owner with completed shop and valid membership | /dashboard or /connections | Show requested authorized workspace |
| Session or membership cannot be resolved because of an outage | Protected entry | Blocking retry state; do not guess a destination or treat outage as sign-out |
| Valid identity without required admission/membership | Protected entry | Access denied; never infer permission to create another shop |

Unverified registration remains in the verification/resume flow. Account recovery,
reset and reauthentication keep their own purpose and security rules; do not
blindly redirect them using the sign-in-page rule. Explicit reauthentication
continues to the authorized workspace without executing a sensitive action.

Apply one entry policy at route entry, after sign-in/Google return, after creation,
and on access invalidation. Server route checks prevent direct-request content
flashes; client navigation and APIs enforce the same state. Cookie existence,
local flags and hidden navigation are not authorization. Use temporary redirects
and a non-cacheable entry decision; protected UI remains client-rendered through
typed clients. Preserve session-renewal response headers.

Sign-out/expiry clears authorized memory, then replaces the route with sign-in.
Recheck on return/back/forward and identity changes; delayed responses cannot
restore an old workspace. Preserve only allowlisted internal destinations if
return navigation is added. No arbitrary return URL or sensitive query values.

## Recommended visual direction

Use a dedicated onboarding page. Required setup, browser resume, phone keyboards
and direct links all fit a page better than a dismissible dialog over a dashboard.
There is no dashboard rendered behind an onboarding overlay and no skip action
that bypasses required creation.

Preserve the approved palette, Noto Sans/Noto Sans Tamil, Base UI components and
the canonical stylesheet. Replace the rejected composition and journey, while
keeping that identity. Operate mode: a boutique owner should understand the next
action immediately, including when returning after an interruption.

| Role | Existing light | Existing dark |
| --- | --- | --- |
| Page | #faf6ed | #211c1e |
| Text | #282323 | #f8f0e5 |
| Surface | #fffdf8 | #2d2629 |
| Primary | #751f3d | #efb4c8 |
| Primary text | #fff9f1 | #3a1422 |
| Control boundary | #89796b | #a39399 |

Typography stays sans with 400/600 weights, left-aligned form content and clear
heading/body/help hierarchy. Tamil keeps its larger line height and natural
wrapping. Brand, language and appearance controls occupy the same restrained
header across the three experiences. Only appearance persists.

### Authentication

A compact, approximately 24–28rem form with one heading and one primary action.
Show email/password, visibility control, forgot-password link, eligible Google
sign-in and a contextual sign-up link. Sign-up says an invitation/setup ID is
required; it never implies open account creation. Recovery/verification retain
their protected, neutral and explicit-sign-in behavior.

No cross-product stepper, onboarding preview or marketing panel belongs here.

```text
Aarili                                    Language  Appearance

                     Sign in
                     Email
                     Password          Show
                     Forgot password?
                     [ Sign in ]
                     [ Continue with Google ]
                     New owner? Sign up with a setup ID
```

### Onboarding

One focused setup screen, followed directly by the authorized dashboard. Avoid a
welcome-only page and repeated confirmation clicks. The owner already supplied
their name/email during protected registration; show these as readable account
details, not empty fields to type again. Email is verified and read-only. Owner
profile editing is not silently added to this slice.

The shop-name field is the main task. On desktop/tablet landscape, pair the form
with a live typographic shop-identity preview using the actual entered name. This
is the visual focal point: the owner sees their boutique taking its place in
Aarili. The preview is clearly a preview, not a created or live shop.

Use an approximately 60–68rem stage with a larger form area and a quieter preview
area, generous separation and one strong action. Do not split each line into a
card. On phone/portrait, use one column with the form/action first; the preview
must not push the action beyond an unnecessary decorative screen.

```text
Aarili                                    Language  Appearance

          Let's set up your shop
          Your owner account is ready.

          Signed in as                  Your shop in Aarili
          Owner name                    [ Shop name preview ]
          Verified email                Owner name

          Shop name
          [                         ]

          [ Create shop and continue ]
          Sign out
```

Motion responds to actual changes: input updates the preview, submission shows a
busy state, confirmed creation transitions to the dashboard. No fake progress,
typing animation, artificial delay, confetti or extra motion dependency. Respect
reduced motion and Tamil IME composition.

### Dashboard entry

After creation commits, re-read authorized entry state and replace the route with
/dashboard. The dashboard shows the real shop identity, a welcoming heading and
the existing responsive workspace navigation. Focus its heading on arrival.

This slice delivers a dashboard home shell with honest current state, not the
operational dashboard in roadmap 1.9.2. Do not invent orders, revenue, alerts,
charts or links to unimplemented screens. Business configuration remains pending;
related actions retain their later configuration gates. Existing connections and
reauthentication remain accessible with their current protections.

## Data and interruption behavior

- Read owner name/verified email from a narrow authenticated entry-context query.
  The current /api/auth/get-session intentionally returns only signed-in state;
  do not assume it already returns a profile or expand the vendor session payload.
  Propose a typed GET /api/owner/entry with minimal own-owner fields and a
  needs-onboarding/ready discriminator. Keep existing shop response compatibility.
- Keep profile reads in auth, membership checks in the authorized tenant path,
  routing in the web entry layer, and creation through the existing Hono command.
  Share the state decision between server entry and client navigation. Do not add
  business Server Actions or weaken API checks to make redirects work.
- Preserve the existing admission binding, verified-session check, bootstrap lock,
  idempotency, audit, RLS and migration compatibility. Do not create a second shop
  or manufacture onboarding history for completed legacy owners.
- Closing before Create leaves the account pending on the server. Returning with
  a valid session opens onboarding; an expired session first requires sign-in.
  Unsaved shop-name edits may need re-entry. Promise continuation of setup, not
  persistence of every keystroke. No credentials, setup IDs, business drafts or
  completion flags in browser storage.
- A lost create response triggers an authorized state read. If completed, enter
  the dashboard; if unresolved, explain and offer a safe explicit retry. Never
  infer completion from the preview or an optimistic flag. Concurrent tabs and
  changed-name requests preserve the existing single-shop/conflict behavior.
- No new schema is expected for routing and a read-only owner summary. A request
  to edit owner identity or persist partial details requires a separate contract;
  do not hide that scope inside the UI revision.

## Delivery sequence

1. Confirm this brief and route contract. Produce a clickable visual preview of
   sign-in, onboarding and dashboard entry, with phone/desktop layouts and real
   synthetic content. Include an interrupted-setup path. Review that visual result
   before functional wiring; a text plan alone is not visual acceptance.
2. Add the minimal typed entry query and shared state policy. Prove the route/state
   matrix, direct access, denied/outage cases and completed legacy-owner behavior.
3. Replace the auth layout, introduce the onboarding page and dashboard entry,
   and wire navigation to authoritative state. Reuse creation and security logic.
4. Run focused journey/security/isolation checks, then required final verification.
   Inspect phone/tablet/desktop together, fix observed defects in one batch, and
   confirm affected fixes. Record acceptance evidence and a fresh review packet.

The owner authorized implementation on 17 October 2026. No GitHub issues are required.
Keep the current source work and unrelated AGENTS.md edit intact. Business policy,
services, imports, practice/pilot readiness and external-shop onboarding stay in
their existing phases. Live activation remains held.

## Acceptance checks for the revision

| ID | Required result |
| --- | --- |
| ENTRY-01 | Sign-in/sign-up/recovery show authentication only; no shop/workspace progress chrome |
| ENTRY-02 | Invite-only admission and verification remain protected; no public or implicit Google signup; no second setup-ID entry |
| ENTRY-03 | Direct anonymous access to dashboard, onboarding and connections redirects to sign-in without protected content flashing |
| ENTRY-04 | Valid pending owner always enters onboarding; unrelated/denied identities never receive shop-creation permission |
| ENTRY-05 | Close/reopen, reload, expired-session sign-in and another device all resolve incomplete setup from server state |
| ENTRY-06 | Explicit creation commits exactly one shop/membership/audit, resolves lost responses and enters the dashboard |
| ENTRY-07 | Completed new/legacy owners skip onboarding, including direct visits and browser back navigation |
| ENTRY-08 | Outages, expired sessions and membership denials remain distinct; no redirect loops or false completion |
| ENTRY-09 | Sign-out/expiry/identity changes clear memory; delayed/cross-tab responses cannot expose prior workspace data |
| ENTRY-10 | Both languages/themes, three sizes, tablet rotation, five reflow widths, IME, keyboard, focus, axe and reduced motion remain usable |
| ENTRY-11 | No secrets/personal details in URLs or browser persistence; no-script credentials use POST; internal return paths are allowlisted |
| ENTRY-12 | Dashboard contains real current state only; business configuration and live readiness remain separate |

Use unit tests for the entry decision and contracts; real PostgreSQL/API tests for
identity, membership and creation guarantees; browser tests for complete paths,
direct URLs, interruption, callbacks, history and no-content-flash behavior. Preserve
the earlier security negatives rather than replacing them with UI-only checks.
After implementation run pnpm verify and pnpm test:ui with fresh evidence for the
tested revision. Keep owner visual/flow, fluent Tamil, physical Android and
assistive-technology observations separate. No new behavior has been tested or
implemented by this planning document alone.

## Direction contract

THESIS: Authentication, required shop setup and workspace are distinct surfaces.
Sign-in is compact; onboarding gives shop identity the focal position; dashboard
entry depends on verified server state.

OWN-WORLD: Preserve Current light/dark, Noto Sans/Tamil, semantic Base UI controls
and the canonical CSS authority. A solid primary-colour identity preview is the
single expressive element; form hierarchy stays quiet and direct.

STORY: An invited owner verifies and signs in, recognizes their existing account,
names the boutique, then enters its workspace. Returning unfinished owners resume
setup; completed owners enter directly.

FIRST VIEWPORT: Shared brand/language/appearance header. Auth has one centered
surface. Onboarding has a left-aligned task and a quieter right-hand shop preview;
phone places the complete task before the preview. The creation action is explicit.

FORM: The owner-approved fixed composition and route/state plan above; no new
identity selection. Development-only clickable preview at .scratch/owner-entry-preview.

FINISH: unreviewed and undocumented is unfinished. This build ends with the finish
review, its scoped verdict, the existing `docs/aarili-design-system.md` authority
updated in place, and fresh acceptance evidence. No raster assets are introduced.
