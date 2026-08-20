# ApplySignal submission form draft

This is a copy-paste draft for the official hackathon form. It is not a claim that the form has been submitted.

## Project

**Name:** ApplySignal

**Repository:** https://github.com/PiKa919/ApplySignal

**Demo video:** https://raw.githubusercontent.com/PiKa919/ApplySignal/main/artifacts/applysignal-demo-2026-08-20.mp4

## Short description

ApplySignal is candidate-side career intelligence that compares what a public job listing discloses with what its public application flow asks from a candidate. It keeps freshness, transparency, application burden, lifecycle, and source confidence as separate evidence-backed signals instead of collapsing them into a legitimacy or “worth applying” score.

## Project description

ApplySignal turns public career-site observations into an evidence dashboard. The Explorer shows recorded postings; Compare places two roles side by side across independent dimensions; Job Evidence exposes raw observed fields, application burden, lifecycle changes, and bounded repost inferences; and Source Health shows collector scope, validation, quarantine, last-known-good output, and unresolved source states.

The central product idea is the Reciprocity Gap: a role can request substantial application effort while disclosing little about the work. ApplySignal makes that asymmetry visible without treating missing information as a negative employer fact. Talent-pool pages, evergreen language, unknown dates, incomplete oracle coverage, and possible reposts remain explicitly labeled edge cases.

## How Bright Data Scraper Studio was used

Bright Data Scraper Studio is the collection boundary. The project uses custom Collector IDs for public career pages, including:

- Zerodha Fund House: `c_mt0gzmiq1zdx7m835o`
- Palantir Lever fallback: `c_mt0ivvftqptif51k9`
- Razorpay Greenhouse: `c_mt0jo8sc1rqz4ef0pb`
- Visa Workday detail: `c_mt0k0jqb14b08r1uxz`
- Cadence Workday detail: `c_mt0kbe2b2abejp81k2`

The collector output feeds deterministic normalization, health validation, SQLite persistence, lifecycle analysis, application-burden analysis, and the dashboard. The project also records bounded BrowserStack/CRED generation failures and a measured Postman oracle mismatch rather than presenting them as healthy coverage.

The self-healing boundary is review-gated: a failed or drifted run is quarantined, last-known-good output is retained, a heal preview is recorded, and approval is required before a repair is accepted. The GitHub Actions Bright Data workflow defaults to zero-credit public preflight; a paid run requires the `BRIGHTDATA_API_KEY` secret and the exact `RUN_PAID_COLLECTION` confirmation.

## Public-data and AI disclosure

Only public career-site pages and public application field labels are used. ApplySignal does not collect candidate-entered values or submit applications. Unknown fields remain unknown.

Codex/ChatGPT assisted with development, debugging, review, and test generation. Bright Data Scraper Studio’s AI workflow was used at the collector boundary. The participant reviewed the architecture, collector behavior, validation rules, and submitted code.

## Verification summary

- 128 automated tests pass.
- Bun application and collector builds pass.
- GitHub Actions verifies tests, builds, the Docker image, fixture audit, and formatting.
- The manual Bright Data workflow has been run in zero-credit preflight mode with `brightDataCalls: 0`.

## Final operator checklist

- [ ] Connect the Render account and deploy the Blueprint.
- [ ] Confirm the final hosted URL.
- [ ] Paste the repository, demo URL, description, and Scraper Studio section into the official form.
- [ ] Add `BRIGHTDATA_API_KEY` only as a GitHub Actions secret if a paid run is deliberately authorized.
