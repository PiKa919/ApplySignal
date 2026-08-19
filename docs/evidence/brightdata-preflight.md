# Bright Data source preflight — 2026-08-20

## Authentication

- CLI: Bright Data CLI `0.3.3`
- Verification: `brightdata zones` returned `cli_unlocker` and `cli_browser`
- Secrets: no API key, token, or account identifier is stored in this repository

## CLI catalog check

`brightdata pipelines list --json` returned the built-in pipeline catalog. It included `linkedin_job_listings` and other platform-specific pipelines, but no candidate-specific pipeline for Visa, Cadence, BrowserStack, Meesho, Zerodha Fund House, CRED, Postman, or Razorpay.

This is evidence about the authenticated CLI pipeline catalog, not proof that Bright Data's broader 660+ web-scraper library has no matching template. The installed CLI exposes `pipelines list`, but it does not expose a Scrapers Library/Marketplace search command; `brightdata scraper --help` exposes only `create`, `run`, `heal`, and `approve`. Bright Data's official documentation says the Scrapers Library is browsed from the web dashboard and that Scraper Studio is for targets not found in the library ([library quickstart](https://docs.brightdata.com/datasets/scrapers/scrapers-library/quickstart), [Scraper Studio FAQ](https://docs.brightdata.com/datasets/scraper-studio/faqs)). The public FAQ page did not match Visa, Cadence, BrowserStack, Meesho, Zerodha Fund House, CRED, Postman, or Razorpay by name, but that page is not a substitute for an authenticated per-target dashboard lookup. The final submission must retain source-level Marketplace/library evidence before claiming a target is uncovered.

## Zero-credit public URL preflight — 2026-08-20

`bun run preflight` performs an ordinary HTTP reachability check before any Bright Data collector is considered. It follows redirects, checks the expected host, records status/content type/body size, filters block indicators out of scripts/styles to avoid false positives, and always reports `brightDataCalls: 0`.

| Source | Public URL result | Interpretation |
| --- | --- | --- |
| BrowserStack | HTTP 200, expected Workday host, 7,293 bytes, no block indicators | Public board reachable; existing Bright Data generation remains unresolved |
| CRED | HTTP 200, expected host, 54,616 bytes, no visible-text block indicators | Public page reachable; existing collector/detail extraction remains unresolved |
| Meesho | HTTP 403 with an explicit Access Denied body | Transport/access failure; no collector retry triggered |
| Postman | HTTP 200, expected host, 207,741 bytes, no block indicators | Branded page reachable; existing extraction remains partial |

Reachability is deliberately not promoted to a live source claim: the health gate and completed Scraper Studio output are still required.

## Candidate decisions

| Candidate | Current decision | Evidence/status |
| --- | --- | --- |
| Zerodha Fund House | Keep as first custom collector | Custom Scraper Studio collector created and live-run successfully; no matching CLI pipeline listed |
| Palantir Lever fallback | Keep as second live collector | Custom Scraper Studio collector completed; batch run returned 307 public listing rows |
| Visa | Live scoped detail | One public Workday detail collector completed; full-board generation remains unresolved |
| Cadence | Live scoped detail | One public Workday detail collector completed; full-board generation remains unresolved |
| BrowserStack | Unresolved generation | `c_mt0iq7oysxok3r6q4` reached preview picker but did not complete during bounded polling |
| Meesho | Failed generation | Two custom Scraper Studio generation attempts failed; no live data claimed |
| CRED | Unresolved after bounded detail probe | Candidate-specific Marketplace/library lookup still required; one public Lever detail attempt returned zero rows and was quarantined |
| Postman | Partial validation source | 50 normalized Scraper Studio IDs matched 111 public Greenhouse IDs; extraction remains incomplete |
| Razorpay | Keep as live candidate | Direct Greenhouse board collector completed and returned 26 public listing rows |

## Collection-generation outcomes

| Target | Collector | Outcome | Interpretation |
| --- | --- | --- | --- |
| Visa Workday | `c_mt0hdncdvl5pdsf61` | Generation stalled during code/preview polling; no completed artifact | Dynamic Workday structure is a demonstrated source risk, not a usable source |
| Visa Workday detail | `c_mt0k0jqb14b08r1uxz` | Completed against a public detail page; returned one successful row | Live scoped observation ingested; do not treat it as full-board cardinality |
| Meesho | `c_mt0hdp0f1cpuyp09vq` | Bright Data returned `status: failed` after template creation | Template failure is recorded as source-confidence evidence; do not ingest as live data |
| Meesho retry | `c_mt0jywoc3netn7272` | Narrower visible-card schema still failed during intent analysis at attempt 22 | Unresolved; no live output claimed; half-built collector requires manual UI deletion if desired |
| Postman branded careers | `c_mt0hhp8o2dj4euge69` | Generation remained in code/preview polling when bounded run was stopped | Unresolved; no live output claimed |
| Postman Greenhouse board | `c_mt0jgbmgtpeo9ghcx` | Generation reached preview picker at attempt 180 when bounded polling stopped | Unresolved; no live output claimed |
| Postman Greenhouse board retry | `c_mt0kenri1czi6msxio` / batch `j_mt0kix8hl18ggr55o` | Collector completed, but the run hit the realtime page limit and entered batch polling; local polling stopped at attempt 13 before output | Unresolved; no rows persisted and no rerun planned without a credit decision |
| CRED openings | `c_mt0hphi210sst7z27` | Generation reached preview-picker but remained unresolved after bounded polling | Unresolved; no live output claimed |
| CRED Lever board | `c_mt0jsv3s22rjyq5w83` | Direct public board generation reached code generation at attempt 184 when bounded polling stopped; one later public detail probe returned zero rows (`run_1787178058137`) | Unresolved; the zero-row run was quarantined and no retry is planned |
| Razorpay branded careers | `c_mt0huks12jww1ro77d` | Completed and returned the public Greenhouse board URL | Partial success; branded-page routing observed, but not a jobs dataset |
| Razorpay Greenhouse board | `c_mt0hxxvn1inyto72ik` | Generation remained in code generation after bounded polling | Unresolved; no live output claimed |
| Cadence Workday | `c_mt0il1zsoiz0umxxe` | Generation reached code generation at attempt 181 when bounded polling stopped | Unresolved; no live output claimed |
| Cadence Workday detail | `c_mt0kbe2b2abejp81k2` | Completed against one public detail page; returned one row with duplicated location/time/date text | Live scoped observation ingested; extraction-quality caveat retained |
| BrowserStack Workday | `c_mt0iq7oysxok3r6q4` | Generation reached preview picker at attempt 183 when bounded polling stopped | Unresolved; no live output claimed |
| BrowserStack Workday detail | `c_mt0k5nx71ktmkmh3ul` | Scoped public detail generation remained in schema generation at attempt 182 when bounded polling stopped | Unresolved; no live output claimed |
| Palantir Lever fallback | `c_mt0ivvftqptif51k9` | Completed; realtime switched to batch after page limit and returned 307 successful rows | Live listing dataset ingested; batch handoff retained as run evidence |
| Razorpay Greenhouse board (direct) | `c_mt0jo8sc1rqz4ef0pb` | Completed; returned 26 successful rows from the public linked board | Live listing dataset ingested; branded-page routing remains recorded as a separate partial attempt |

## Postman scoped recovery and oracle check — 2026-08-20

- Existing collector `c_mt0kenri1czi6msxio` was invoked once against a public Postman Greenhouse detail URL to avoid another board request.
- Bright Data returned a 111-row outer envelope whose usable records were nested under `jobs`; local ingestion now flattens and deduplicates that shape to 50 unique job observations.
- A second, explicit board-URL attempt hit the realtime page limit and handed off to batch `j_mt0l8qht2gqsa4doyh`; local polling was stopped immediately and no output was claimed.
- The public Greenhouse oracle returned 111 job IDs. The normalized Scraper Studio output matched 50 and missed 61, so Postman remains `partial`, not live.

## Collector created

- Name: `applysignal-zfh`
- Collector ID: `c_mt0gzmiq1zdx7m835o`
- Target: `https://careers.zerodhafundhouse.com/jobs`
- Schema intent: public listing ID, title, department, location, employment type, raw posted/closing date text, description, detail URL, and application URL
- Creation status: `done`
- Self-healing status: approved repair added `closing_date_text`; healed rerun returned 13 rows.
