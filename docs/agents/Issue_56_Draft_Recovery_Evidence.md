# Issue 56 — honest online draft recovery

Scope: [#56](https://github.com/nishanthturnstile/aarili/issues/56), roadmap
0.4.2b; product USE-03/04/08/09, AC-40/55; architecture §§5.2, 7.1–7.3,
8.5 and 15. The selected Current UI and shared English/Tamil translations remain
the visual authority. No normal application route imports the synthetic host.

The owner's “proceed based on the recommendation” approved this #56/#57 run with
two separate managed worktrees and implementation agents only. Coordinator
preflight verified clean current `origin/main` at
`f053a441a15fd37ff8537fe618673129570d050f`, #55 merged through PR #65 and its
prerequisite ancestry. Frozen install/build/smoke/artifact baseline exited 0
(`TEMP/aarili-56-57-baseline.log`); that exact main's hosted CI run
[38852787777](https://github.com/nishanthturnstile/aarili/actions/runs/38852787777)
was green. Original local policy commit `f7c5e4e` and its branch remain preserved
and unpublished. This approval does not extend to later worktree scenarios.

The reusable app-local controller owns detached current input, acknowledged
server records and an exact pending command. The React Hook Form adapter uses
the incomplete workflow schema; it does not infer business authority or treat
empty amounts/measurements as zero. Promotion remains an explicit command after
the current input is acknowledged. Production workflow registration remains empty.

RHF remounts for each controller instance, including a new controller for the
same draft ID; old values/defaults cannot carry to another form/shop lifetime.
Resume uses bounded 25-row typed cursor pages with explicit Load more, ID
deduplication, fresh-list reset and late-response fencing. Optional navigation
callback failure preserves the acknowledged record and offers Resume drafts;
it never creates a false uncertain outcome or another network command.

## State transitions

| Trigger | Visible state | Retained data and next permitted action |
| --- | --- | --- |
| Open new form / edit | Not saved | UUIDv7 allocated in memory; no URL ID before acknowledgement |
| Pause typing for about one second | Saving | One detached payload/key/If-Match; later edits stay in memory |
| IME composition | Existing unsaved state | Cancel debounce until composition ends |
| Save acknowledgement matching current input | Saved | Committed version advances; opaque ID may enter URL |
| Earlier save acknowledged after more typing | Not saved | Current input stays; new key is created for queued edits |
| Transport/5xx uncertainty | Checking outcome | Exact command retained; Retry/reconnect replays it before queued edits |
| Stale 412 | Conflict | Local input preserved; display current saved values for explicit server/local choice |
| 412 without current record | Conflict | Explicit authenticated reload action and unavailable/reopen guidance |
| Explicit keep-local conflict resolution | Not saved | New command uses reviewed current ETag; no automatic merge |
| Promotion with dirty/in-flight/unknown input | Existing state | Block promotion until latest input is acknowledged |
| Known promotion rejection | Saved plus review error | Saved values remain acknowledged; deliberate new promotion after review |
| Lost promotion response | Checking outcome | Inputs remain disabled; same promotion key/version replays |
| Successful promotion | Completed | Disable edits/promotion; server result remains authoritative |
| Resume an abandoned draft | Closed | Keep historical values read-only; no ignored editable input |
| Sign-out/access loss/shop scope disposal | Access ended | Clear controller/form/query values, cancel reads and reject late responses |

## Composition and lifecycle

Create an owner/shop scope inside an effect and dispose that exact scope in its
cleanup. StrictMode's setup replay must create a new scope rather than reuse a
disposed instance. The isolated fixture demonstrates this pattern. A shop switch
disposes the old scope before creating the next. Pass the owner's existing PWA
work guard to the scope so a hidden form cannot falsely make updates safe; the
visible form also tracks its own mount. Release controllers when forms close.

Draft values and query caches exist only in memory. The UI warns that closing or
reloading loses unsaved input. Native beforeunload and same-origin link warnings
cover the tested navigation paths. Programmatic navigation, router back and
same-document history/popstate need the caller's explicit confirm-leave seam:
`controller.confirmLeave(() => window.confirm(draftMessages[locale].warning))`.
The owner's shell must also consult its shared work guard before transitions.
Native/mobile browsers may suppress close warnings; they are a warning, never a
persistence guarantee. History and server transaction logic are unchanged. No
new migration, service, worker or automatic conflict merge.

## Acceptance-to-failure evidence

| Criterion | Automated evidence |
| --- | --- |
| F1 | Controller debounce/composition test; browser composition and pre-ack URL inspection |
| F2 | Single-flight unit; lost committed save replay compares exact payload/key/version in browser; later edits get a new command |
| F3 | Acknowledgement/current-value unit; JSONB key-order regression; editable status and conflict axe checks |
| F4 | Real server offline/lost response/retry, close/reopen/reload and second browser context; explicit stale conflict choice |
| F5 | Dirty promotion blocked; known current-authority rejection remains visible; lost committed promotion compares exact request and one real SQL result |
| F6 | Work-guard/late-response/shop-denial units; navigation dialog; resumed and fresh input clearing after access loss |
| F7 | New real PostgreSQL/owner/createApi browser journey in both locales, both Current themes and all three configured screen sizes; storage/URL inspection |
| F8 | Test host lives outside normal routes; boundary checks, normal production build/artifact audit and existing route suite |

## Verification record

Current documentation was resolved/fetched with Context7 for React Hook Form,
Zod resolver, TanStack Query and uuidjs/uuid UUIDv7. Added only approved exact web pins RHF 7.90.0,
resolvers 5.9.1, uuid 14.0.3, existing Zod 4.6.6 and contracts workspace import.

Development diagnostics caught and repaired fixture scope reuse under Next
StrictMode, a missing fixture document title, Next's requirement for native
extensionless runtime source imports and an invalid test attempt to
delete membership referenced by immutable creator history. The latter is now
tested by revoking disposable synthetic sessions instead. They were failed
diagnostics, not final passing evidence.

The preliminary `pnpm test:ui` ran all 75 cases once: 73 passed in 14.5 minutes;
only existing PWA B5 registration/partial-install cases on phone and desktop
timed out at 30 seconds. Tablet B5 passed. The full log is
`TEMP/aarili-56-final-ui.log`; both failure artifact directories were preserved
in `TEMP/aarili-56-pwa-failures` before subsequent runs. These initial failures
are retained honestly; the existing suite's passed cases are not rerun without
an affected change. Review then corrected the form instance lifetime, complete
resume pagination, callback isolation and fixture semantic spacing. Only the
affected draft matrix and those two failed PWA cases were then run in isolation.

The final affected draft matrix passed 10/12 cases in 6.9 minutes
(`TEMP/aarili-56-final-draft-ui.log`). Phone English dark returned one resume row
and desktop English light returned 18 where the first page must contain 25.
The assertion remains exactly 25. Both cases passed individually with added
read-only seed-count, repository-list and browser-response diagnostics
(`TEMP/aarili-56-pagination-diagnostic.log` and
`TEMP/aarili-56-pagination-desktop-diagnostic.log`). A bounded direct API probe
on three fresh synthetic shops also returned 25 rows plus the next cursor after
26 committed creates (`TEMP/aarili-56-pagination-probe.log`, exit 0).
These passing diagnostics do not establish the cause of the earlier incomplete
pages: diagnostic reads can change timing. This remains an unresolved finding
for review/CI observation, not a blanket 12-case passing claim. The fixture now
preserves safe synthetic aggregate/list metadata and exact seed-count assertions.

The one permitted retry of the two existing PWA B5 failures passed both cases
in 12.9 seconds (`TEMP/aarili-56-pwa-single-retry.log`, exit 0), with their original
30-second timeout and source unchanged. No further browser retries were run.
Coordinator visual review approved the final phone Tamil dark conflict and
desktop English light editable captures. The mechanical design detector returned
an empty finding array (`TEMP/aarili-56-design-detector-final.json`, exit 0).

Final stable-code nonbrowser verification passed:

| Check | Result and log |
| --- | --- |
| `pnpm lint`, `pnpm knip` | Exit 0; Biome 253 files, boundaries 142 sources, 32 UI token sources and eight PWA assets; `TEMP/aarili-56-final-static.log` |
| `pnpm typecheck` | Exit 0; package, app and test types; `TEMP/aarili-56-final-nonbrowser.log` |
| `pnpm test` | 132 tests / 31 files passed, including 18 new focused draft tests; same log |
| `pnpm test:negative`, `pnpm openapi` | Exit 0; compiled negative DTO/client/UI fixtures and OpenAPI generation; same log |
| `pnpm build` | Exit 0; 11 Turbo tasks, production Next routes unchanged; same log |
| `pnpm smoke` | Exit 0; production Next/Hono, real PostgreSQL readiness/outage, typed client and worker shutdown; disposable database cleaned; same log |
| `node scripts/check-artifacts.mjs` | Exit 0; 29 browser artifacts checked; same log |
| `pnpm audit --prod` | Exit 0, no known vulnerabilities; same log |
| `pnpm audit --audit-level low` | Exit 0 for runtime and development dependencies, no known vulnerabilities; `TEMP/aarili-56-final-audit.log` |

Unrelated full PostgreSQL integration was not repeated for this UI-only branch:
the integrated-main CI baseline is recorded above, while affected draft browser
journeys use the real owner API, transactional repository and forced RLS. The
new matrix is discovered by the normal `test:ui`/hosted browser job. Hosted CI
and owner review, including the unresolved pagination observation, remain gates.

## Recovery and manual review gates

Revert compatible controller/UI source to remove this feature. Existing durable
server drafts remain readable; no schema rollback or deletion is required.
The browser host is synthetic-only and creates disposable PostgreSQL databases
and isolated Next output. No live/customer data, external delivery or services.

Physical Tamil IME, fluent Tamil copy, Android reconnect, local HTTPS/PWA and
real-device accessibility/performance remain manual phase review gates. Synthetic
composition events and viewport tests do not claim physical keyboard/device
validation. Real intake integration remains Wave 1 slice 1.2.1; no booking,
approval, payment or date commitment is inferred from a saved draft.
