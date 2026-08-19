# Lifecycle event evidence

`demo-lifecycle` is **SIMULATED LIFECYCLE TEST DATA** for the fictional controlled career site, not a historical claim about a real employer.

`job_observations` remain the observed facts. Each successful ingestion additionally appends a `posting_events` record containing:

- the source and lifecycle state;
- the previous and current observation IDs when a relationship is available;
- the observation timestamp; and
- structured field-change evidence, plus a separately labeled repost inference when applicable.

For the controlled lifecycle fixture, the two versions share a source job ID but have different public URLs. Ingestion keeps both observations and records a `MEANINGFULLY_UPDATED` event instead of deduplicating them. The dashboard exposes these persisted events separately from generic field diffs and possible-repost inferences.
