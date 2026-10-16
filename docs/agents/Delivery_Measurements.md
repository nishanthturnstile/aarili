# Delivery measurements

Owner-approved process improvement, 16 October 2026. Follow the
[development workflow](Development_Workflow.md). Record the next five
implementation PRs opened after the workflow improvement merges, one entry per
PR. No deliveries have been recorded yet. This log does not change release scope
or acceptance gates.

Use ISO 8601 timestamps with an explicit offset (for example, `+05:30`) or UTC.
Record observed spans as work happens. Use `unknown` for missing measurements
and `pending` for unfinished phases; never substitute zero. Add links to existing
issue/PR evidence rather than duplicating command logs. Exclude secrets, customer
data and private URLs.

Copy this template for each delivery:

~~~markdown
## Delivery <1–5>: <issue/slice and short outcome>

- Issue / PR / tested revision: <links and SHA; identify dirty verification>
- Implementation started: <timestamp>
- Review ready: <timestamp; implementation and required evidence prepared>
- Merged: <timestamp or pending>
- First usable behavior available for owner review: <timestamp and route/scenario,
  or pending; identify an isolated test host where used>

| Activity | Observed span(s) and elapsed minutes | Evidence / overlap / limitation |
| --- | --- | --- |
| Implementation | <start/end spans and minutes, or unknown> | <exclude verification and rework; record pauses> |
| Local verification | <start/end spans and minutes, or unknown> | <commands/results; required supplementary checks and reasons> |
| CI queue and execution | <queue and execution minutes separately, or unknown> | <run URLs, attempts, failures; overlapping jobs use workflow wall time> |
| Review waiting | <ready/request to feedback/authorization spans, or pending> | <separate overnight pauses and agent response time where observed> |
| Rework | <start/end spans and minutes, or none/unknown> | <cause: defect, flaky infrastructure, integration or changed requirement> |

- Implementation start → review-ready elapsed: <minutes or pending>
- PR opened → merged elapsed: <minutes or pending; not implementation time>
- Implementation start → first usable behavior elapsed: <minutes or pending>
- Human acceptance: <acceptance IDs, reported results and pending observations>
- Largest delay and candidate improvement: <observation, not an assumed cause>
~~~

After five completed deliveries, record the median elapsed measures and observed
activity durations (with known sample counts), the largest waits and repeated
failure causes. Overlapping activity durations are not additive. Recommend any
further process change separately; retain the required verification and review.
