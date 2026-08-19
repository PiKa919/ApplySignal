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
| Visa | Pending | Candidate-specific Marketplace/library lookup still required |
| Cadence | Pending | Candidate-specific Marketplace/library lookup still required |
| BrowserStack | Pending | Candidate-specific Marketplace/library lookup still required |
| Meesho | Pending | Candidate-specific Marketplace/library lookup still required |
| CRED | Pending | Candidate-specific Marketplace/library lookup still required |
| Postman | Validation candidate | Greenhouse oracle is useful; custom-source eligibility still requires lookup |
| Razorpay | Pending | Candidate-specific Marketplace/library lookup still required |

## Collection-generation outcomes

| Target | Collector | Outcome | Interpretation |
| --- | --- | --- | --- |
| Visa Workday | `c_mt0hdncdvl5pdsf61` | Generation stalled during code/preview polling; no completed artifact | Dynamic Workday structure is a demonstrated source risk, not a usable source |
| Meesho | `c_mt0hdp0f1cpuyp09vq` | Bright Data returned `status: failed` after template creation | Template failure is recorded as source-confidence evidence; do not ingest as live data |
| Postman branded careers | `c_mt0hhp8o2dj4euge69` | Generation remained in code/preview polling when bounded run was stopped | Unresolved; no live output claimed |

## Collector created

- Name: `applysignal-zfh`
- Collector ID: `c_mt0gzmiq1zdx7m835o`
- Target: `https://careers.zerodhafundhouse.com/jobs`
- Schema intent: public listing ID, title, department, location, employment type, raw posted/closing date text, description, detail URL, and application URL
- Creation status: `done`
- Self-healing status: approved repair added `closing_date_text`; healed rerun returned 13 rows.
