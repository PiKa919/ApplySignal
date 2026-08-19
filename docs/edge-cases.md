# ApplySignal edge-case contract

ApplySignal treats missing information as unknown and keeps scraper reliability separate from employer-facing analysis.

| Input or failure | Expected behavior |
| --- | --- |
| Exact source date | Store the exact date and its provenance. |
| `30+ Days Ago` or another relative date | Store the raw text and a lower-bound freshness signal; never fabricate an exact date. |
| No source date | Show first-seen time separately; do not infer a publish date. |
| Closing date without a publish date | Store the closing date independently. |
| Evergreen language | Label explicit evergreen only when the source says so; retain weaker evergreen-like evidence separately. |
| Talent-pool application | Label `TALENT_POOL`; do not treat it as an ordinary vacancy or a stale job. |
| Similar postings at the same time | Preserve separate observations; do not infer a repost. |
| Old posting disappears and a similar new one appears | Create a bounded possible-repost inference with evidence, never merge facts. |
| Different requisition IDs with similar content | Keep both source facts and lower confidence in any relationship inference. |
| Multiple locations or remote plus office | Preserve the raw multi-location value; do not invent a country. |
| Missing salary | Store `null`/unknown, never zero. |
| Public form with hidden fields | Count only visible public field metadata. |
| Public form asks for resume plus history/CTC/education | Record application burden and Resume Re-entry Tax; never collect values. |
| Login-required application | Record the account gate when observable and stop at the public boundary. |
| Apply page redirects or is closed | Validate the destination and expose `APPLICATION_CLOSED`/unknown evidence rather than submitting. |
| Board count collapses or required-field coverage drops | Quarantine the run and retain last-known-good observations. |
| Duplicate IDs or premature pagination | Quarantine or report structural health failure before business events are created. |
| Repeated listing URLs | Quarantine the run even when no source identity field is available. |
| Empty all-jobs board without explicit empty-state evidence | Quarantine before treating zero as a real catalog state. |
| Verified empty subset or talent-pool scope | Allow zero rows within that declared scope. |
| Inverted salary range | Quarantine the run as a semantic extraction error. |
| HTTP 200 block/CAPTCHA page | Treat explicit block evidence as transport failure. |
| Semantic title/location swap | Quarantine even when both fields are non-empty. |
| Distributional drift alone | Require review evidence; never trigger automatic healing. |
| Heal preview changes schema or swaps fields | Reject the preview; approval is not automatic. |
| Heal awaits approval or fails | Keep the source degraded and serve last-known-good observations. |
| Different source scopes | Compare within declared scope; a scoped zero is not a failed full-board scrape. |
| Tracking/query-string URL changes | Canonicalize only where identity evidence supports it; preserve raw URLs in provenance. |
| Controlled historical fixture | Mark it `dataMode: fixture` and `SIMULATED LIFECYCLE TEST DATA`; never present it as employer history. |

The controlled fixture exercises a fresh role, a relative-date role, explicit evergreen hiring, a talent pool, multi-location output, and a rich public application form in two semantically equivalent layouts. See [controlled fixture evidence](evidence/controlled-fixture.md).
