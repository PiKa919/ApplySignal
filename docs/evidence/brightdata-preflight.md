# Bright Data source preflight — 2026-08-20

## Authentication

- CLI: Bright Data CLI `0.3.3`
- Verification: `brightdata zones` returned `cli_unlocker` and `cli_browser`
- Secrets: no API key, token, or account identifier is stored in this repository

## CLI catalog check

`brightdata pipelines list --json` returned the built-in pipeline catalog. It included `linkedin_job_listings` and other platform-specific pipelines, but no candidate-specific pipeline for Visa, Cadence, BrowserStack, Meesho, Zerodha Fund House, CRED, Postman, or Razorpay.

This is evidence about the authenticated CLI pipeline catalog, not proof that Bright Data's broader 660+ web-scraper library has no matching template. The final submission must retain the source-level Marketplace/library lookup evidence before claiming a target is uncovered.

## Candidate decisions

| Candidate | Current decision | Evidence/status |
| --- | --- | --- |
| Zerodha Fund House | Keep as first custom collector | Custom Scraper Studio collector created and live-run successfully; no matching CLI pipeline listed |
| Palantir Lever fallback | Keep as second live collector | Custom Scraper Studio collector completed; batch run returned 307 public listing rows |
| Visa | Pending | Candidate-specific Marketplace/library lookup still required |
| Cadence | Unresolved generation | `c_mt0il1zsoiz0umxxe` reached code generation but did not complete during bounded polling |
| BrowserStack | Unresolved generation | `c_mt0iq7oysxok3r6q4` reached preview picker but did not complete during bounded polling |
| Meesho | Failed generation | Two custom Scraper Studio generation attempts failed; no live data claimed |
| CRED | Pending | Candidate-specific Marketplace/library lookup still required |
| Postman | Validation candidate | Greenhouse oracle is useful; custom-source eligibility still requires lookup |
| Razorpay | Keep as live candidate | Direct Greenhouse board collector completed and returned 26 public listing rows |

## Collection-generation outcomes

| Target | Collector | Outcome | Interpretation |
| --- | --- | --- | --- |
| Visa Workday | `c_mt0hdncdvl5pdsf61` | Generation stalled during code/preview polling; no completed artifact | Dynamic Workday structure is a demonstrated source risk, not a usable source |
| Meesho | `c_mt0hdp0f1cpuyp09vq` | Bright Data returned `status: failed` after template creation | Template failure is recorded as source-confidence evidence; do not ingest as live data |
| Meesho retry | `c_mt0jywoc3netn7272` | Narrower visible-card schema still failed during intent analysis at attempt 22 | Unresolved; no live output claimed; half-built collector requires manual UI deletion if desired |
| Postman branded careers | `c_mt0hhp8o2dj4euge69` | Generation remained in code/preview polling when bounded run was stopped | Unresolved; no live output claimed |
| Postman Greenhouse board | `c_mt0jgbmgtpeo9ghcx` | Generation reached preview picker at attempt 180 when bounded polling stopped | Unresolved; no live output claimed |
| CRED openings | `c_mt0hphi210sst7z27` | Generation reached preview-picker but remained unresolved after bounded polling | Unresolved; no live output claimed |
| CRED Lever board | `c_mt0jsv3s22rjyq5w83` | Direct public board generation reached code generation at attempt 184 when bounded polling stopped | Unresolved; no live output claimed |
| Razorpay branded careers | `c_mt0huks12jww1ro77d` | Completed and returned the public Greenhouse board URL | Partial success; branded-page routing observed, but not a jobs dataset |
| Razorpay Greenhouse board | `c_mt0hxxvn1inyto72ik` | Generation remained in code generation after bounded polling | Unresolved; no live output claimed |
| Cadence Workday | `c_mt0il1zsoiz0umxxe` | Generation reached code generation at attempt 181 when bounded polling stopped | Unresolved; no live output claimed |
| BrowserStack Workday | `c_mt0iq7oysxok3r6q4` | Generation reached preview picker at attempt 183 when bounded polling stopped | Unresolved; no live output claimed |
| Palantir Lever fallback | `c_mt0ivvftqptif51k9` | Completed; realtime switched to batch after page limit and returned 307 successful rows | Live listing dataset ingested; batch handoff retained as run evidence |
| Razorpay Greenhouse board (direct) | `c_mt0jo8sc1rqz4ef0pb` | Completed; returned 26 successful rows from the public linked board | Live listing dataset ingested; branded-page routing remains recorded as a separate partial attempt |

## Collector created

- Name: `applysignal-zfh`
- Collector ID: `c_mt0gzmiq1zdx7m835o`
- Target: `https://careers.zerodhafundhouse.com/jobs`
- Schema intent: public listing ID, title, department, location, employment type, raw posted/closing date text, description, detail URL, and application URL
- Creation status: `done`
- Self-healing status: approved repair added `closing_date_text`; healed rerun returned 13 rows.
