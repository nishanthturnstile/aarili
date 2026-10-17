# Customer and authorised wearer registration design

17 October 2026. Owner-approved scope for synthetic implementation of roadmap
1.1.3, subject to selected published tickets and merged prerequisites. Final
privacy policy remains under review, with explicitly draft fixtures permitted
by the owner's later decision in the ticket packet. [Research evidence and gaps](Customer_Wearer_REA_Evidence.md).
[Concrete ticket packet](Customer_Wearer_Ticket_Packet.md).

## Authority and outcome

Product §§4, 7, 24–25, 29.1, 30.1, 32–33 govern behavior. Architecture §§6–9,
11–12 and 15 govern implementation. The existing
[owner-entry revision](Owner_Entry_Onboarding_Revision_Plan.md) and
[design system](../aarili-design-system.md) govern entry and presentation.
This design is independent of Nool's code and contracts. Authenticated research
observed directory/create/profile, name search, duplicate-phone rejection and a
free-text measurement-member label. Separate persisted wearer/guardian authority
was not established. Exact Evidence IDs and scope limits remain in the evidence note.

An owner at the counter must find or register the contact, identify the exact
wearer and see whose authority is recorded. A phone, family label or payment
never substitutes for identity or permission. Registration does not start an
order, collect measurements or grant customer access.

Evidence-informed decisions: keep Customers discoverable and save/reopen explicit
(Empty directory/Save/Reopen profile captures); distinguish empty from no-match;
retain helpful active-person context from the member-label flow while using real
wearer identity. Deliberately follow Aarili's optional/shared-phone requirements
despite Nool's required/unique-phone behavior. Test Tamil/Tanglish and phone
normalization independently rather than assume the vendor search results suffice.
Add purpose/guardian evidence because the inspected Nool path did not expose it.

Existing onboarding edits and their evidence remain untouched. Customers joins
the authorized workspace only after those edits are deliberately integrated.
1.1.1 and 1.1.2 remain incomplete; 1.2.1 still depends on all three setup slices.
Phase 0.5, final policy approval and live activation remain held. Synthetic
development may use the [policy review draft](Customer_Wearer_Privacy_Draft.md)
under the owner's recorded exception; it does not establish approved policy.

## Owner journey and screen contract

1. Dashboard adds one Customers action. WorkspaceNavigation adds the same
   destination with current-shop context. No future modules or fabricated metrics.
2. `/customers` opens a scoped directory: heading, labelled name/phone/customer-ID
   search, Add customer, results. First use says no customers yet; a zero-match
   result says no matches and offers Clear search. Search terms live in memory
   and request bodies, never URLs. No result implies an identity merge.
3. `/customers/new` shows display name, an expandable optional-contact group,
   concise approved service notice and explicit applicable consent evidence.
   The name is one field; first/last name, email, phone, address, gender, date of
   birth, ID document and photograph are not prerequisites. Show required versus
   optional labels. Unknown optional values stay null, not empty assertions.
4. Save confirms a committed customer and opens `/customers/{opaqueId}`. The
   profile identifies contact name, shop-specific customer code and optional
   contact details; separate sections show preferences, wearers and permissions.
   No Orders/Measurements/Payments tabs or unavailable actions are presented.
5. Add wearer asks: this contact (self), another person, or an explicitly selected
   existing wearer in this shop. Self is a deliberate choice that creates a
   distinct wearer role; it does not infer adulthood or consent. Another person
   gets a separate identity. Search results include enough safe disambiguation
   (name, code, relationship), not unrelated private notes.
6. Wearer panel always names the active person and relationship. Changing wearer
   clears person-specific draft permission inputs and requires deliberate review;
   it never carries consent from the previous person. Preferences can describe
   language/channel, fit/style and practical delivery instructions, with expressed
   source and unknown allowed. Contact preferences do not silently overwrite
   another wearer's preferences or grant authority.
7. Age status uses Under 18 / 18 or over / Not recorded, without a preselection.
   Under 18 reveals parent/legal-guardian selection or separate minimal guardian
   entry. An aunt may be contact/payer; a separate parent is the consent giver.
   The owner recording evidence is not represented as the person giving consent.
8. Permission review names subject, purpose, authorising person, relationship,
   notice/version/language, source and time. Pending evidence remains visible.
   An acknowledged family relationship never becomes blanket access.

The profile can exist with no wearer or unresolved authorisation, clearly
labelled. Unresolved data never grant downstream permission. Do not show a
measurements/photos action in this slice. Later modules must check the actual
current permission, not a registration-era boolean.

## Layout, language and accessibility

Operate mode; preserve the existing light/dark semantic tokens, Noto Sans and
Noto Sans Tamil 400/600, shared components and restrained workspace header.
No new palette, font, image, component library or authentication journey.

- Phone (<768px): single column, readable result rows/cards, full-page entry,
  primary save within thumb reach without covering focused content; bottom nav.
- Tablet (768–1279px): existing rail; single pane portrait, list/detail landscape
  where space permits. Related optional fields may share a row.
- Desktop (>=1280px): existing sidebar; directory table/list and readable profile
  content. Person identity and permission state appear before secondary detail.
- Focus goes to the screen heading after navigation, first invalid field after
  validation, and the originating action after cancellation. Inline errors have
  labels/descriptions; summary links focus fields. Busy/success/error states use
  text and live status, not color alone. Controls are at least 44px.
- Preserve input through Tamil IME composition, language/theme changes and
  responsive reflow. Names and notes keep original text. Allow Tamil wrapping,
  line height, 200% text enlargement and extra spacing.
- Preserve the recorded English-first UI default; explicit Tamil switching
  remains available. Customer communication language is independent of UI
  locale. Architecture §9.2's configurable Tamil-first default remains future
  settings work; this slice does not silently revise the existing owner decision.

## State and failure contract

| State | Visible behavior and recovery |
| --- | --- |
| Loading directory/profile | Labelled progress; no misleading zero count or stale foreign-shop content. |
| Failed read | Specific retry action; preserve search; no false empty state. |
| Unsaved form | Keep values in the open page; confirm discard on controlled navigation/cancel. Warn on browser unload where supported; no promise of recovering never-saved values after termination. |
| Saving | Disable repeated action, retain stable command key and request payload. |
| Connection loss | Latest changes not saved; keep typed values; retry with the same key. |
| Lost save response | Checking whether saved; replay original request before offering a fresh command. |
| 422 | Field validation or changed-payload/key rejection; preserve values. A changed command after resolution gets a new key. |
| 428 / 412 | Require update precondition / disclose stale edit and compare current versus intended fields; no silent merge. Fetch/rebase explicitly, then new command key. |
| 409 | Explain blocked domain action such as invalid guardian authority or missing approved policy. |
| Access expiry/change | Clear all authorized memory and in-flight results; route through existing entry policy. Late responses cannot repopulate an old shop/session. |

Minimal contact entry uses explicit Save. Longer multi-person registration uses
the existing server-draft boundary for connected autosave/resume, with separate
draft/command schemas and no automatic authoritative promotion. Each draft shows
Saving/Saved/Not saved, resumes by opaque ID, and has the existing stale/retention
behavior under approved policy. Promote against current person/notice/permission
state. Mark fixture policies synthetic in the draft as well as final records.
This introduces a direct draft prerequisite for the later tickets that use it;
it does not declare the quick-order draft journey complete.

## Proposed relational model

Names are proposed Aarili identifiers, not vendor-derived schema. Every table
below is tenant data with non-null `shop_id`, `(shop_id,id)` unique keys,
shop-led indexes, composite foreign keys, ENABLE/FORCE RLS and matching writes.

| Record | Responsibility and principal fields |
| --- | --- |
| `customer_person` | Explicit human identity: id, original display_name, optional personal contact details, version, created/updated actor/time. Derived versioned search keys are hints only. A guardian can exist without becoming a customer. |
| `customer` | Contact/customer role: person_id, shop-specific immutable customer_code, optional private contact notes, version. No unique phone constraint. |
| `wearer` | Wearer role: person_id, nullable under_18, age_status source/time/actor, version. No DOB. Self explicitly references the contact's person; another human never reuses it based on phone/name. |
| `customer_wearer_relationship` | customer_id, wearer_id, relationship label, attributable confirmation that payer is authorised to provide data and wearer informed, scope/source/time, version/status. A link is not a capability grant. |
| `wearer_guardian_relationship` | wearer_id, guardian_person_id, parent/legal-guardian claim and evidence reference under approved flow, state, actor/time/version. Contact/payer link alone cannot populate this. |
| `customer_preference` | Explicit contact or wearer subject, language/channel/fit/style/delivery preference, expressed source, version. Exactly one subject FK; no AI inference. |
| `privacy_notice_version` | Approved immutable Tamil/English content/version, purposes, approval provenance, effective status and content digest; synthetic fixture flag. No executable HTML from free text. |
| `consent_record` | Subject person/wearer, purpose, notice version/language, consent-giver person, related authority evidence, recorded-by actor, source/channel, occurred_at/recorded_at, grant/refusal/withdrawal event and linked prior event. Append evidence; never overwrite old consent. |

Use constraints for valid subject combinations and same-shop links. Explicit
self mapping has a same-shop unique wearer/person relationship; duplicate-phone
people have different person IDs. Guardian authority must reference the same
wearer and guardian as the consent event. Validate cross-record eligibility in
core within the same locked transaction; DB constraints reinforce identity and
tenant integrity. Unknown age is not false. Prevent self-guardianship and invalid
guardian-purpose combinations. Changing an age/relationship claim invalidates
affected derived eligibility for review; it never erases historical events.

Service consent, permission to supply family data, communication preferences,
marketing, optional sensitive media and publication are separate concepts.
Do not require marketing to register or communicate about service. Optional
purposes are unselected/not recorded by default; no grant for a minor's marketing
or publication is accepted. Recording or withdrawing purpose evidence is in scope;
campaign execution, media capture, publication and full rights case management
remain absent. Production purpose wording/authority verification must be supplied
and approved; no legal text or retention duration is invented here.

Audit records store actor/action/entity/version and minimal changed-field
metadata. Avoid copying contact notes and permission narrative into audit logs,
jobs or idempotency responses. Keep replay responses minimal (IDs/version/result),
and re-authorize before replay. Personal values stay separable for the later
audited privacy functions; no normal runtime DELETE or erasure authority.

## API and module boundary

Use `packages/core` customer commands/queries/policies and DB repository
interfaces, with transaction-bound implementations in `packages/db`. Extend
existing packages; no new runtime package. Core imports no framework/vendor SDK.
`packages/api` holds thin Hono routes; the Next Node route only mounts the app.
Browser imports contracts, UI/i18n and a compiled typed customer-module client.

Proposed API shapes, all private and `no-store`:

| Method/path under `/api/shops/{shopId}` | Input/output boundary |
| --- | --- |
| POST `/customers/search` | Body: query and bounded cursor/page size; result summaries scoped to current shop. Read-only query, no business mutation/idempotency event. No search term in URL or logs. |
| POST `/customers` | Minimal display name, optional contact details and required approved notice evidence; stable Idempotency-Key; result IDs/version. |
| GET `/customers/{id}` | Authorized profile and ETag; omit unrelated private details. |
| PATCH `/customers/{id}` | Audited simple contact correction, Idempotency-Key and If-Match; no merge/relink. |
| POST `/customers/{id}/wearers` | Explicit self/new/existing wearer choice, age status, relationship and authority evidence; atomic result. |
| PATCH `/wearers/{id}` | Simple attributable profile/age correction under If-Match; consequential identity relinking remains unavailable. |
| POST/PATCH `/wearers/{id}/guardians[/{relationshipId}]` | Separate guardian identity/authority evidence; creation key, update key plus If-Match; reject cross-shop or payer-only claims. |
| POST/PATCH `/preferences[/{id}]` | Explicit subject and expressed preference; existing records need If-Match. |
| POST `/consent-events` | Append grant/refusal/withdrawal and authority/notice references. Serialize on subject/purpose aggregate and require its ETag for a consequential state change. |
| Existing `/drafts` paths | Supported workflow-specific draft payloads; existing membership/version/idempotency semantics. |

Every path authenticates verified owner, checks origin for unsafe methods and
the user's own membership, then uses `withShop()` for all repositories. The
server supplies actor/recorded time/shop authorization; request IDs and bounded
non-personal diagnostics use existing middleware. Foreign IDs yield no foreign
state. No new customer sign-in, share links, signed media links or export endpoint.

Commands lock their idempotency key, bind actor/action/shop/target/If-Match/payload
hash, and replay the original result before stale-current-version rejection.
Changed payload on the same key is 422. Key, business effect, audit and any real
required job commit together; no artificial notification job is added. Existing
ETag semantics remain 428 missing, 412 stale, 409 domain, 422 validation.
Permission/guardian edits lock the affected subject/relationship in a consistent
order. Concurrent grant/withdraw or age changes cannot use a stale grant.

Current documentation was resolved with `ctx7 library Hono`, selecting the
official Hono documentation `/websites/hono_dev`, then `ctx7 docs` for
`@hono/zod-openapi` route validation and typed RPC. [OpenAPI route documentation](https://hono.dev/examples/zod-openapi)
and [typed client guidance](https://hono.dev/docs/guides/rpc) support the chosen
boundary. Use the repo's 422 hook and compiled module declaration corrections;
these docs do not authorize changing installed pins or adopting Hono 5.

## Migration and recovery

Allocate the next migration only after onboarding migration 0016 is integrated;
do not reserve or overwrite its file. Review generated SQL and hand-written
constraints/policies/grants. Add tables/indexes transactionally through the
existing advisory-locked migration runner. Register every tenant table in the
isolation catalog tests. Runtime remains `app_user`, never owner/BYPASSRLS.

Expand first; no existing customer data are imported or deduplicated. Add a
follow-on migration per dependent ticket as needed. Existing app versions must
tolerate the additive schema. Back up before approved schema application; use
only disposable synthetic DBs in development. On failure roll back the migration
transaction, verify no partial grants/policies, and retain logs without personal
data. Application rollback leaves compatible additive schema; no destructive
down migration or dropping populated identity/history tables.

Restore checks must include these rows, permission events and tombstone handling
when rights functions arrive. Registration produces no outbound effects; restored
jobs still follow the existing restore epoch/quarantine controls. Do not claim a
new restore drill, privacy workflow or minor-media protection has passed here.

## Acceptance ownership

Ticket-local `CW-*` IDs below are verification labels, not new product AC IDs.

| Requirement/scenario | Local proof obligation | Ticket |
| --- | --- | --- |
| CUS-01 | CW-01 name-only create/save/reopen, optional fields, shop code; CW-02 distinct shared phones and Tamil/Tanglish/name/phone search | A |
| CUS-02 | CW-03 explicit self and second adult; stable wearer identity independent of contact/payer | B |
| CUS-04 | CW-04 language/channel/fit/style/delivery preferences, original text and expressed provenance | B |
| CUS-07 | CW-05 interaction-scoped family authority, wearer informed, no inherited grants | B |
| TRU-01 | CW-06 missing context, cross-shop read/search/write/link, pooled-context reuse and runtime role | A–C |
| TRU-03 | CW-07 no unrelated person details, no private notes in public/diagnostic output or URLs/storage | A–C |
| TRU-04 | CW-08 approved bilingual notice, separate purposes, refusal/withdrawal, no opt-in defaults | A–C |
| TRU-05 | CW-09 nullable age flag, separate guardian, aunt rejected as consent giver; no DOB/photos; minor marketing/publication grant rejected | C |
| TRU-07 | CW-10 no public/share/export/media action or route created; no private record leaked through existing public output | A–C |
| TRU-13 | CW-11 subject/purpose/version/giver/recording-actor/time/source evidence, policy gate and family acknowledgement | A–C |
| USE-01/02/09 | CW-12 bilingual three-size flows, keyboard/focus, IME, contrast, zoom and manual real-device/Tamil review | A–C |
| USE-03/04/08 | CW-13 honest unsaved/saving/saved/retry; stable replay; rollback/concurrent edits; longer-form server-draft resume | A–C, draft resume B/C |
| AC-02 identity/permission portion | CW-02/03/05/06; two people sharing phone never merge | A/B; order/measurement and later customer access remain 1.2.4/1.3.2/2.6.1 |
| AC-53 registration portion | CW-09/11; minor, aunt contact/payer, different parent | C; actual order/measurement/photo operations and no-publication integration tested in their later slices |
| AC-39 and AC-52 | CW-07/08/10 protect this slice; no claim of complete media/erasure scenario | Actual media/gallery and 1.10.2 retain completion ownership |

All acceptance evidence is pending implementation. Synthetic policy fixtures
exercise mechanics only and cannot discharge production policy-approval gates.
