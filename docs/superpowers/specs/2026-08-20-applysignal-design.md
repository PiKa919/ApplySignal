# ApplySignal design

## Goal

ApplySignal observes public employer career sites and helps candidates understand what a listing reveals, what an application demands, and how the listing changes over time. The product must make the Reciprocity Gap visible without pretending that freshness, transparency, burden, lifecycle, or scraper reliability are one objective score.

## Hackathon boundary

Bright Data Scraper Studio is the collection boundary and must be central to the demo. Live collection may use only public career-site data. The authenticated Bright Data Marketplace/library preflight is still pending; any target covered by a suitable prebuilt scraper must be removed from the hero source set and replaced. Greenhouse/Lever feeds may be used as validation oracles, not as the main demonstration of custom scraping.

## Initial vertical slice

The first demonstrable slice uses three roles of source rather than assuming a final source list:

1. A Workday tenant such as Visa or Cadence to exercise dynamic rendering, requisition IDs, relative dates, pagination, and closing-date fields.
2. Zerodha Fund House to exercise custom branded content, detailed job pages, application fields, and the explicit talent-pool listing.
3. A branded page with an ATS validation oracle, such as Postman or CRED, selected only after Bright Data preflight.

The remaining proposed targets—BrowserStack, Meesho, Postman, CRED, and Razorpay—remain expansion candidates subject to the same preflight.

## Facts and inferences

An observation is a timestamped fact: source URL, retrieval time, raw payload reference, normalized fields, extraction status, and source confidence. A possible repost or continuation relationship is a separate inference with a confidence value and evidence references. Similar titles or descriptions never establish that two observations represent the same vacancy.

## Data model

- `source`: target identity, URL, source family, preflight status, and configuration.
- `scrape_run`: collector identity, run timestamp, status, row/cardinality metrics, healing events, and raw artifact reference.
- `job_observation`: one observed listing at one point in time, including stable source ID when available, title, location, employment type, dates, description, URL, and normalized provenance.
- `application_field_observation`: fields requested by the public application flow, with labels, category, required/optional state when observable, and evidence URL.
- `posting_inference`: candidate relationship between observations, inference type, confidence, and supporting signals.
- `validation_result`: comparison between custom-scraper output and an independent public ATS/oracle observation.

## Derived views

- Freshness: observed dates and date-quality states; relative dates remain labeled as relative unless resolved with evidence.
- Transparency: disclosed fields and their evidence, with missing information represented as unknown rather than negative fact.
- Application burden: count and categories of publicly visible requested fields and interaction steps.
- Reciprocity Gap: a comparison of disclosure coverage against application burden, with an explanation instead of a universal score.
- Lifecycle: ordered observations, field-level diffs, disappearance/reappearance events, and explicitly labeled inferences.
- Source confidence: extraction completeness, schema validation, cardinality checks, healing state, and validation-oracle agreement.

## Product flow

1. A collector run is triggered through Bright Data Scraper Studio/CLI.
2. Raw structured output and run metadata are retained.
3. Normalizers produce observations without discarding unknowns.
4. Validators check required fields, cardinality, duplicate identity, and oracle agreement where available.
5. Diffs and bounded inferences are generated between observations.
6. The UI presents source health, job comparisons, a job detail view, the Reciprocity Gap, lifecycle history, and evidence/confidence.

## Reliability and self-healing

The collector contract declares expected output fields and minimum cardinality. Empty or anomalously small results are failures, not valid empty datasets, until the source is known to be scoped to zero. A failure record includes the affected fields and last known good run. Bright Data self-healing is demonstrated on a controlled field/schema break or a safe fixture, with before/after output and explicit approval state. Local validation does not claim that a scraper healed merely because a command exited successfully.

## Testing strategy

- Fixture tests for each source parser and normalization rule.
- Schema tests for unknown/missing/relative date states.
- Cardinality and pagination tests that fail on silent truncation.
- Application-field extraction tests using public application pages.
- Inference tests proving facts and repost hypotheses remain separate.
- Oracle comparison tests for the selected ATS-backed source.
- A controlled fault-injection test demonstrating detection and Bright Data self-healing evidence.

## Not in the initial slice

No fake employer history mixed with real employers, no private/login-protected application data, no automatic claim that an old listing is fraudulent, no single composite employer score, and no account-application submission automation.

## Open gate

Before finalizing live targets, authenticate the Bright Data CLI and record the Marketplace/library preflight result for every candidate. The user must review this spec before implementation planning proceeds.
