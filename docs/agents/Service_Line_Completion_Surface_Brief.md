# Independent service completion (#126)

Ordinary Operate extension of the selected Current light/dark Orders system.
No new world, concept roll, comp or assets; preserve docs/aarili-design-system.md.

- THESIS: Record what was done to one eligible service without declaring its garment ready.
- OWN-WORLD: Existing semantic tokens, Noto Sans/Tamil, labelled controls and shared textarea treatment.
- STORY: Exact accepted line and price → current independent state → explicit evidence/attestation → immutable completion/correction history.
- FIRST VIEWPORT: Retain order identity and original scope. Show pending/completed/not-required counts; do not label the order complete.
- FORM: Inline, keyboard-accessible line controls. Missing evidence blocks confirmation. Freeze body/key/precondition on unknown result; explicit retry or conflict reload preserves local text. Corrections link the exact completion and require a reason.

Source snapshots/readers remain immutable. A separate v1 progress query overlays current state for standalone and supplemental lines. Parent version plus line ETag prevents concurrent scope changes; completion does not advance parent production, capacity, money or custody.
Reuse existing app_privacy boundary for audited evidence-note redaction. No ordinary runtime erasure endpoint or live-data activation.
