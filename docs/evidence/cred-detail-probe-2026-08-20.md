# CRED bounded detail probe — 2026-08-20

- Free preflight: the selected public Lever detail URL returned HTTP 200 and a public HTML body.
- Collector: `c_mt0jsv3s22rjyq5w83` (existing incomplete collector; no new collector created)
- Run: `run_1787178058137`
- Scope: one public detail URL only; no board crawl, retry, healing, or approval
- Result: zero usable rows; cardinality guard quarantined the run
- Budget after attempt: `$50.00` balance, `$0.00` pending

The public URL being reachable does not prove that the incomplete collector can extract it. ApplySignal keeps CRED `unresolved`, does not create a live observation, and does not infer that the underlying employer page is empty or broken.
